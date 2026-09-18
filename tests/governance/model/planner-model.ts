/**
 * Modelo de referencia del Planner · **gobernanza, no producción**.
 *
 * Este fichero NO es el Planner. No se importa desde `apps/`, `packages/` ni ninguna ruta de
 * runtime, y no puede llegar a serlo: vive bajo `tests/` y la guarda de importación vigila la
 * dirección contraria. Existe para **falsar** la política propuesta antes de que exista código
 * de producción, enumerando espacios de estado pequeños y ejecutando trayectorias deterministas.
 *
 * Lo que este modelo **no** hace: afirmar eficacia pedagógica. Mide propiedades estructurales
 * —determinismo, inanición, bucles, honestidad de presupuesto— y nada más.
 *
 * Las variantes de granularidad y de orden de cobertura están parametrizadas **a propósito**:
 * la revisión independiente rechazó que la atomicidad estuviera derivada, y un modelo que solo
 * pudiera expresar la variante preferida no serviría para falsarla.
 */

export type EngineState =
  'NEW' | 'EXPOSED' | 'EVIDENCE_POSITIVE' | 'EVIDENCE_NEGATIVE' | 'EVIDENCE_CONFLICTING';

/** Granularidad de la acción. Decisión humana P4-D3 · ninguna está aceptada. */
export type Granularity =
  /** A · `APRENDER + COMPROBAR` y `REAPRENDER + COMPROBAR` son un único ítem indivisible. */
  | 'ATOMIC'
  /** B · cadena ordenada; cada paso es un ítem de presupuesto y no se afirma estado entre ellos. */
  | 'CHAINED'
  /** D · encadenado donde el motor sabe representar el bucle (`EXPOSED`), atómico donde no. */
  | 'HYBRID';

/** Orden dentro del conjunto de continuidad. Decisión humana P4-D4 · ninguna está aceptada. */
export type CoverageOrder = 'EXPOSED_FIRST' | 'NEW_FIRST' | 'SYLLABUS';

/**
 * Orden dentro de la reparación. Las variantes existen **para poder falsarlas**, y la familia se
 * amplía en la prueba residual A: no basta con derrotar a dos rivales para declarar unicidad.
 *
 *   - `EVIDENCE_OLDEST`   · posición de la **última** evidencia negativa, de más antigua a más
 *                           reciente. Cada fallo nuevo refresca la posición.
 *   - `FIRST_UNRESOLVED`  · posición de la **primera** evidencia negativa aún sin resolver. Un
 *                           fallo nuevo **no** la mueve.
 *   - `LAST_CONTACT`      · posición del último contacto real de la persona con el concepto
 *                           (exposición o intento). Es acción de la persona, no historial del
 *                           Planner.
 *   - `EVIDENCE_NEWEST`, `SYLLABUS`, `REVERSE_SYLLABUS`, `IDENTITY` · rivales de control.
 */
export type RemediationOrder =
  | 'EVIDENCE_OLDEST'
  | 'FIRST_UNRESOLVED'
  | 'LAST_CONTACT'
  | 'EVIDENCE_NEWEST'
  | 'SYLLABUS'
  | 'REVERSE_SYLLABUS'
  | 'IDENTITY';

/**
 * Mutaciones de control negativo. Ninguna puede sobrevivir al candidato.
 *
 * No hay mutación para IR-P4A-01 porque el modelo corregido **ya no consulta** el historial de
 * ejecuciones: no queda ningún punto donde inyectar «la recomendación cuenta como ejecución».
 * Ese control se demuestra en `negativeControls.spec` reproduciendo la definición rechazada.
 */
export interface Mutations {
  /** Invertir el desempate determinista. */
  readonly reverseTieBreak?: boolean;
  /** Consumir estado del motor que se sabe atrasado. */
  readonly consumeStaleEngine?: boolean;
  /** Reciclar `EVIDENCE_POSITIVE` como candidato. */
  readonly includePositive?: boolean;
  /** Ratio oculto 50/50 entre reparación y cobertura. */
  readonly ratio5050?: boolean;
  /** Dejar que el orden de filas decida. */
  readonly rowOrderDecides?: boolean;
  /** Permitir que el plan exceda el presupuesto. */
  readonly exceedBudget?: boolean;
  /** No responder nunca a la reparación. */
  readonly ignoreRemediation?: boolean;
  /** No dar nunca continuidad a la cobertura. */
  readonly ignoreCoverage?: boolean;
  /** Fabricar trabajo al agotarse lo elegible. */
  readonly fabricateOnExhaustion?: boolean;
}

export interface Concept {
  readonly id: string;
  /** Clave de sílabo: bloque·tema·concepto colapsados en un entero monótono. */
  readonly syllabus: number;
  readonly state: EngineState;
  /** Patrón de error estructural activo. Cuenta como necesidad de reparación. */
  readonly errorPattern: boolean;
  /**
   * Posición de flujo de la **última** evidencia negativa o conflictiva del concepto.
   * `null` cuando no la hay. Es un hecho semántico del motor, nunca un dato de auditoría.
   */
  readonly lastNegativeAt: number | null;
  /**
   * Posición de la **primera** evidencia negativa aún sin resolver. Un fallo posterior no la
   * mueve. Solo la usa la variante `FIRST_UNRESOLVED`, que existe para ser falsada.
   */
  readonly firstNegativeAt?: number | null;
  /**
   * Posición del **último contacto real** de la persona con el concepto: exposición o intento.
   * Es una acción de la persona registrada en el flujo de eventos, no historial del Planner.
   */
  readonly lastContactAt?: number | null;
  /** Minutos declarados. Son **entrada** del contrato: P4-D2 sigue diferida. */
  readonly learnMinutes: number;
  readonly checkMinutes: number;
  /** El concepto tiene contenido elegible (publicado y con mapeo atribuido). */
  readonly eligibleContent: boolean;
}

export interface PlannerInput {
  readonly concepts: readonly Concept[];
  readonly budget: number;
  readonly completedToday: readonly string[];
  readonly granularity: Granularity;
  readonly coverageOrder: CoverageOrder;
  /** Por defecto `EVIDENCE_OLDEST`, que es la única que da vivacidad (ver `modelCheck.spec`). */
  readonly remediationOrder?: RemediationOrder;
  readonly engineStale?: boolean;
  readonly mutations?: Mutations;
}

export type ActionKind = 'LEARN' | 'CHECK' | 'RELEARN' | 'LEARN_CHECK' | 'RELEARN_CHECK';

export type CompositionReason = 'REMEDIATION_GUARANTEE' | 'COVERAGE' | 'REMEDIATION_OVERFLOW';

export interface PlannedAction {
  readonly conceptId: string;
  readonly kind: ActionKind;
  readonly minutes: number;
  readonly reason: CompositionReason;
}

export type Outcome =
  'PLANNED' | 'NOTHING_FITS' | 'NOTHING_ELIGIBLE' | 'ZERO_TIME' | 'PLAN_UNAVAILABLE_ENGINE';

export interface Exclusion {
  readonly conceptId: string;
  readonly reason:
    'POSITIVE_NO_REVIEW_POLICY' | 'COMPLETED_TODAY' | 'NO_ELIGIBLE_CONTENT' | 'OVER_BUDGET';
}

export interface Plan {
  readonly outcome: Outcome;
  readonly actions: readonly PlannedAction[];
  readonly exclusions: readonly Exclusion[];
  readonly minutes: number;
}

/** ¿Es una necesidad de reparación? */
function isRemediation(c: Concept): boolean {
  return c.state === 'EVIDENCE_NEGATIVE' || c.state === 'EVIDENCE_CONFLICTING' || c.errorPattern;
}

/** ¿Es una necesidad de continuidad (cobertura o verificación)? */
function isCoverage(c: Concept): boolean {
  return c.state === 'NEW' || c.state === 'EXPOSED';
}

/**
 * Desempate determinista. Solo datos estables de contenido, comparados por punto de código.
 * Nunca el orden de filas, nunca `created_at`, nunca el UUID como clave primaria de orden.
 */
function bySyllabus(a: Concept, b: Concept): number {
  if (a.syllabus !== b.syllabus) return a.syllabus - b.syllabus;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Orden dentro de la reparación: **evidencia más antigua primero**.
 *
 * No es una preferencia estética. Es lo único que da vivacidad: actuar sobre una necesidad
 * produce evidencia nueva, que empuja ese concepto al final de la cola y deja pasar al
 * siguiente. Con orden de sílabo, o con «evidencia más reciente primero», un concepto que
 * falla repetidamente monopoliza la ranura y los demás no llegan nunca (se demuestra en
 * `modelCheck.spec`).
 *
 * Depende **solo** de evidencia: si la persona no ejecuta nada, nada se mueve, que es
 * exactamente lo correcto.
 */
function byEvidenceAge(a: Concept, b: Concept): number {
  const av = a.lastNegativeAt ?? Number.MAX_SAFE_INTEGER;
  const bv = b.lastNegativeAt ?? Number.MAX_SAFE_INTEGER;
  if (av !== bv) return av - bv;
  return bySyllabus(a, b);
}

function coverageComparator(order: CoverageOrder): (a: Concept, b: Concept) => number {
  if (order === 'SYLLABUS') return bySyllabus;
  const first: EngineState = order === 'EXPOSED_FIRST' ? 'EXPOSED' : 'NEW';
  return (a, b) => {
    const ax = a.state === first ? 0 : 1;
    const bx = b.state === first ? 0 : 1;
    if (ax !== bx) return ax - bx;
    return bySyllabus(a, b);
  };
}

/** Las acciones que corresponden a una necesidad, según la granularidad. */
function actionsFor(
  c: Concept,
  granularity: Granularity,
): Array<{ kind: ActionKind; minutes: number }> {
  const remediation = isRemediation(c);
  if (c.state === 'EXPOSED' && !remediation) return [{ kind: 'CHECK', minutes: c.checkMinutes }];

  if (granularity === 'ATOMIC') {
    return remediation
      ? [{ kind: 'RELEARN_CHECK', minutes: c.learnMinutes + c.checkMinutes }]
      : [{ kind: 'LEARN_CHECK', minutes: c.learnMinutes + c.checkMinutes }];
  }
  if (granularity === 'CHAINED') {
    // Solo el primer paso entra en este plan; el resto depende de que el estado avance.
    return remediation
      ? [{ kind: 'RELEARN', minutes: c.learnMinutes }]
      : [{ kind: 'LEARN', minutes: c.learnMinutes }];
  }
  // HYBRID · encadenado donde el motor sabe representar el bucle abierto (`NEW` → `EXPOSED`),
  // atómico donde no existe estado que lo represente (reaprender sin comprobar).
  return remediation
    ? [{ kind: 'RELEARN_CHECK', minutes: c.learnMinutes + c.checkMinutes }]
    : [{ kind: 'LEARN', minutes: c.learnMinutes }];
}

/**
 * La función de decisión.
 *
 * Determinista y total. No consulta historial de ejecuciones del Planner: una recomendación
 * emitida **no** es evidencia de ejecución (IR-P4A-01), de modo que ningún hecho de auditoría
 * entra en la selección.
 */
export function plan(input: PlannerInput): Plan {
  const m = input.mutations ?? {};

  if (input.engineStale && !m.consumeStaleEngine) {
    return { outcome: 'PLAN_UNAVAILABLE_ENGINE', actions: [], exclusions: [], minutes: 0 };
  }

  const exclusions: Exclusion[] = [];
  const done = new Set(input.completedToday);

  const eligible = input.concepts.filter((c) => {
    if (!c.eligibleContent) {
      exclusions.push({ conceptId: c.id, reason: 'NO_ELIGIBLE_CONTENT' });
      return false;
    }
    if (done.has(c.id)) {
      exclusions.push({ conceptId: c.id, reason: 'COMPLETED_TODAY' });
      return false;
    }
    if (c.state === 'EVIDENCE_POSITIVE' && !c.errorPattern) {
      if (m.includePositive) return true;
      exclusions.push({ conceptId: c.id, reason: 'POSITIVE_NO_REVIEW_POLICY' });
      return false;
    }
    return true;
  });

  if (input.budget <= 0) {
    return { outcome: 'ZERO_TIME', actions: [], exclusions, minutes: 0 };
  }
  if (eligible.length === 0) {
    if (m.fabricateOnExhaustion) {
      const victim = input.concepts[0];
      if (victim) {
        return {
          outcome: 'PLANNED',
          actions: [
            {
              conceptId: victim.id,
              kind: 'CHECK',
              minutes: victim.checkMinutes,
              reason: 'COVERAGE',
            },
          ],
          exclusions,
          minutes: victim.checkMinutes,
        };
      }
    }
    return { outcome: 'NOTHING_ELIGIBLE', actions: [], exclusions, minutes: 0 };
  }

  const sort = <T extends Concept>(xs: T[], cmp: (a: T, b: T) => number) =>
    m.rowOrderDecides ? [...xs] : [...xs].sort(cmp);
  const sign = m.reverseTieBreak ? -1 : 1;

  const order = input.remediationOrder ?? 'EVIDENCE_OLDEST';
  const positional = (a: Concept, b: Concept, pick: (c: Concept) => number | null | undefined) => {
    const av = pick(a) ?? Number.MAX_SAFE_INTEGER;
    const bv = pick(b) ?? Number.MAX_SAFE_INTEGER;
    if (av !== bv) return av - bv;
    return bySyllabus(a, b);
  };
  const remediationComparator = (a: Concept, b: Concept) => {
    switch (order) {
      case 'SYLLABUS':
        return bySyllabus(a, b);
      case 'REVERSE_SYLLABUS':
        return -bySyllabus(a, b);
      case 'IDENTITY':
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      case 'EVIDENCE_NEWEST':
        return -byEvidenceAge(a, b);
      case 'FIRST_UNRESOLVED':
        return positional(a, b, (c) => c.firstNegativeAt ?? c.lastNegativeAt);
      case 'LAST_CONTACT':
        return positional(a, b, (c) => c.lastContactAt ?? c.lastNegativeAt);
      default:
        return byEvidenceAge(a, b);
    }
  };
  const remediation = sort(
    eligible.filter(isRemediation),
    (a, b) => sign * remediationComparator(a, b),
  );
  const coverage = sort(
    eligible.filter(
      (c) =>
        !isRemediation(c) &&
        (isCoverage(c) || (m.includePositive === true && c.state === 'EVIDENCE_POSITIVE')),
    ),
    (a, b) => sign * coverageComparator(input.coverageOrder)(a, b),
  );

  const actions: PlannedAction[] = [];
  let used = 0;
  const place = (c: Concept, reason: CompositionReason): boolean => {
    const [action] = actionsFor(c, input.granularity);
    if (!action) return false;
    if (!m.exceedBudget && used + action.minutes > input.budget) return false;
    actions.push({ conceptId: c.id, kind: action.kind, minutes: action.minutes, reason });
    used += action.minutes;
    return true;
  };

  const placedRemediation = new Set<string>();

  // 1 · Garantía de reparación (P4-D1.1). Exactamente una mientras quede continuidad elegible:
  //     la aridad de un existencial, no una cuota elegida.
  if (!m.ignoreRemediation && remediation.length > 0) {
    if (place(remediation[0]!, 'REMEDIATION_GUARANTEE')) placedRemediation.add(remediation[0]!.id);
  }

  // 2 · Continuidad (P4-D1.2). Se recorre en orden de prioridad y se **salta** lo que no cabe:
  //     detenerse en el primero que no cabe dejaría que la duración de un candidato decidiera
  //     sobre otro, que es un acoplamiento sin autoridad. No se reordena para llenar minutos.
  if (!m.ignoreCoverage) {
    for (const c of coverage) {
      if (m.ratio5050) {
        // Una reparación por cada acción de cobertura: exactamente la cuota que P4-D1.7 prohíbe.
        const next = remediation.find((r) => !placedRemediation.has(r.id));
        if (next && place(next, 'REMEDIATION_OVERFLOW')) placedRemediation.add(next.id);
      }
      place(c, 'COVERAGE');
    }
  }

  // 3 · Desbordamiento de reparación, solo una vez agotada la continuidad: ya no hay nada a lo
  //     que P4-D1.2 pueda proteger.
  if (!m.ignoreRemediation) {
    for (const c of remediation) {
      if (placedRemediation.has(c.id)) continue;
      if (place(c, 'REMEDIATION_OVERFLOW')) placedRemediation.add(c.id);
    }
  }

  if (actions.length === 0) {
    const shortest = [...eligible].sort(
      (a, b) =>
        actionsFor(a, input.granularity)[0]!.minutes - actionsFor(b, input.granularity)[0]!.minutes,
    )[0];
    if (shortest) exclusions.push({ conceptId: shortest.id, reason: 'OVER_BUDGET' });
    return { outcome: 'NOTHING_FITS', actions: [], exclusions, minutes: 0 };
  }

  return { outcome: 'PLANNED', actions, exclusions, minutes: used };
}

/**
 * Transición de estado del aprendiz al **ejecutar** una acción. Es la mitad honesta del modelo:
 * sin ejecución no hay transición, y una recomendación no ejecutada no cambia absolutamente nada.
 */
export function execute(
  concept: Concept,
  action: PlannedAction,
  correct: boolean,
  streamPosition: number,
): Concept {
  const learned = action.kind === 'LEARN' || action.kind === 'RELEARN';
  if (learned) {
    // Exponer material no produce evidencia de acierto ni de error. Solo `NEW` cambia de estado,
    // porque `EXPOSED` es justamente «visto y sin comprobar». Sí es **contacto real** de la
    // persona con el concepto, y eso es lo que distingue a la variante `LAST_CONTACT`.
    const contacted = { ...concept, lastContactAt: streamPosition };
    return contacted.state === 'NEW' ? { ...contacted, state: 'EXPOSED' } : contacted;
  }
  // Toda acción con COMPROBAR produce evidencia nueva.
  const next: EngineState = correct
    ? concept.state === 'EVIDENCE_NEGATIVE' || concept.state === 'EVIDENCE_CONFLICTING'
      ? 'EVIDENCE_CONFLICTING'
      : 'EVIDENCE_POSITIVE'
    : concept.state === 'EVIDENCE_POSITIVE'
      ? 'EVIDENCE_CONFLICTING'
      : 'EVIDENCE_NEGATIVE';
  const negative = next === 'EVIDENCE_NEGATIVE' || next === 'EVIDENCE_CONFLICTING';
  return {
    ...concept,
    state: next,
    lastNegativeAt: negative ? streamPosition : concept.lastNegativeAt,
    // La **primera** negativa sin resolver no se mueve con cada fallo nuevo; se limpia cuando la
    // necesidad desaparece.
    firstNegativeAt: negative
      ? (concept.firstNegativeAt ?? concept.lastNegativeAt ?? streamPosition)
      : null,
    lastContactAt: streamPosition,
  };
}
