/**
 * Propiedades formales del Planner · **gobernanza, no producción**.
 *
 * Cada propiedad se expresa como una función total que devuelve `null` si se cumple o el motivo
 * de la violación si no. Así el enumerador puede reportar **el contraejemplo mínimo** en vez de
 * un booleano, que es lo único que sirve para corregir una política.
 */

import {
  plan,
  type Concept,
  type Plan,
  type PlannerInput,
  type PlannedAction,
} from './planner-model';

export type Violation = string | null;

const total = (actions: readonly PlannedAction[]) => actions.reduce((n, a) => n + a.minutes, 0);

/** P1 · determinismo: la misma entrada canónica produce la misma decisión. */
export function p1Determinism(input: PlannerInput): Violation {
  const a = plan(input);
  const b = plan(input);
  return JSON.stringify(a) === JSON.stringify(b) ? null : 'P1 · dos ejecuciones difieren';
}

/** P2 · invariancia al orden de filas: barajar la entrada no puede cambiar la decisión. */
export function p2RowOrder(input: PlannerInput): Violation {
  const base = plan(input);
  const rotated = plan({ ...input, concepts: [...input.concepts].reverse() });
  const sorted = plan({
    ...input,
    concepts: [...input.concepts].sort((x, y) => (x.id < y.id ? 1 : -1)),
  });
  const key = (p: Plan) => JSON.stringify(p.actions);
  if (key(base) !== key(rotated)) return 'P2 · invertir el orden de filas cambia el plan';
  if (key(base) !== key(sorted)) return 'P2 · reordenar por id cambia el plan';
  return null;
}

/** P3 · reproducibilidad: replanificar desde la misma instantánea da la misma decisión. */
export function p3Replay(input: PlannerInput): Violation {
  const snapshot: PlannerInput = JSON.parse(JSON.stringify(input));
  return JSON.stringify(plan(snapshot)) === JSON.stringify(plan(input))
    ? null
    : 'P3 · la reproducción desde instantánea difiere';
}

/** P4 · ninguna señal no autorizada: `EVIDENCE_POSITIVE` nunca se selecciona. */
export function p4NoUnauthorizedSignal(input: PlannerInput, result: Plan): Violation {
  const byId = new Map(input.concepts.map((c) => [c.id, c]));
  for (const a of result.actions) {
    const c = byId.get(a.conceptId);
    if (c && c.state === 'EVIDENCE_POSITIVE' && !c.errorPattern) {
      return `P4 · se planificó ${c.id}, con evidencia positiva y sin patrón de error`;
    }
  }
  return null;
}

/** P5 · sin actividad sintética: sin necesidad elegible no se fabrica trabajo. */
export function p5NoSyntheticActivity(result: Plan): Violation {
  if (result.outcome === 'NOTHING_ELIGIBLE' && result.actions.length > 0) {
    return 'P5 · se fabricó actividad con el conjunto elegible vacío';
  }
  return null;
}

/** P9 · honestidad de presupuesto: ninguna acción planificada excede el presupuesto. */
export function p9BudgetHonesty(input: PlannerInput, result: Plan): Violation {
  const used = total(result.actions);
  if (used > input.budget)
    return `P9 · el plan usa ${used} sobre un presupuesto de ${input.budget}`;
  return null;
}

/**
 * P10 · seguridad ante interrupción: cerrar la aplicación no puede convertir trabajo no
 * ejecutado en trabajo ejecutado. Planificar dos veces sin ejecutar nada da el mismo plan.
 *
 * Esta es la propiedad que falsa IR-P4A-01: bajo la definición anterior de «respondida», el
 * segundo plan dejaba de responder a la reparación sin que nadie hubiera hecho nada.
 */
export function p10InterruptionSafety(input: PlannerInput): Violation {
  const first = plan(input);
  const second = plan(input);
  if (JSON.stringify(first.actions) !== JSON.stringify(second.actions)) {
    return 'P10 · replanificar sin ejecución cambia el plan';
  }
  return null;
}

/**
 * P8 · sin falsa reparación completada: si el estado del motor y la evidencia no han cambiado,
 * una necesidad de reparación sigue siendo una necesidad de reparación.
 */
export function p8NoFalseCompletion(before: PlannerInput, after: PlannerInput): Violation {
  const remediation = (i: PlannerInput) =>
    new Set(
      i.concepts
        .filter(
          (c) =>
            c.eligibleContent &&
            (c.state === 'EVIDENCE_NEGATIVE' ||
              c.state === 'EVIDENCE_CONFLICTING' ||
              c.errorPattern),
        )
        .map((c) => c.id),
    );
  const a = remediation(before);
  const b = remediation(after);
  for (const id of a) {
    if (!b.has(id)) return `P8 · ${id} dejó de ser necesidad sin evidencia nueva`;
  }
  return null;
}

/** P16 / P17 · ninguna cifra sale del Planner salvo posición y minutos planificados. */
export function p16NoReadinessProxy(result: Plan): Violation {
  for (const a of result.actions) {
    const keys = Object.keys(a).sort().join(',');
    if (keys !== 'conceptId,kind,minutes,reason')
      return `P16 · campo inesperado en la acción: ${keys}`;
    if (!Number.isInteger(a.minutes)) return 'P16 · minutos no enteros';
  }
  return null;
}

/** P20 · agotamiento veraz: `NOTHING_ELIGIBLE` y `NOTHING_FITS` no se confunden. */
export function p20TruthfulExhaustion(input: PlannerInput, result: Plan): Violation {
  const eligible = input.concepts.filter(
    (c) =>
      c.eligibleContent &&
      !input.completedToday.includes(c.id) &&
      !(c.state === 'EVIDENCE_POSITIVE' && !c.errorPattern),
  );
  if (result.outcome === 'NOTHING_ELIGIBLE' && eligible.length > 0) {
    return 'P20 · se dijo NOTHING_ELIGIBLE habiendo candidatos elegibles';
  }
  if (result.outcome === 'NOTHING_FITS' && eligible.length === 0) {
    return 'P20 · se dijo NOTHING_FITS sin ningún candidato elegible';
  }
  if (result.outcome === 'NOTHING_FITS' && input.budget <= 0) {
    return 'P20 · presupuesto cero debe ser ZERO_TIME, no NOTHING_FITS';
  }
  if (result.outcome === 'PLANNED' && result.actions.length === 0) {
    return 'P20 · PLANNED sin acciones';
  }
  return null;
}

/**
 * P21 · honestidad de la granularidad híbrida (P4-D3).
 *
 * `APRENDER` puede planificarse solo para `NEW`; la reparación **nunca** se parte.
 */
export function p21HybridGranularity(input: PlannerInput, result: Plan): Violation {
  if (input.granularity !== 'HYBRID') return null;
  const byId = new Map(input.concepts.map((c) => [c.id, c]));
  for (const a of result.actions) {
    const c = byId.get(a.conceptId);
    if (!c) continue;
    const remediation =
      c.state === 'EVIDENCE_NEGATIVE' || c.state === 'EVIDENCE_CONFLICTING' || c.errorPattern;
    if (remediation && a.kind !== 'RELEARN_CHECK') {
      return `P21 · la reparación de ${c.id} se planificó partida como ${a.kind}`;
    }
    if (!remediation && c.state === 'NEW' && a.kind !== 'LEARN') {
      return `P21 · ${c.id} es NEW y se planificó como ${a.kind}`;
    }
  }
  return null;
}

/**
 * P22 / P27 · `EXPOSED` precede a `NEW` (P4-D4), salvo que no quepa.
 *
 * Solo se exige entre acciones de continuidad: la garantía de reparación va antes que ambas.
 */
export function p22ExposedFirst(input: PlannerInput, result: Plan): Violation {
  if (input.coverageOrder !== 'EXPOSED_FIRST') return null;
  const byId = new Map(input.concepts.map((c) => [c.id, c]));
  const coverage = result.actions.filter((a) => a.reason === 'COVERAGE');
  let seenNew = false;
  for (const a of coverage) {
    const c = byId.get(a.conceptId);
    if (!c) continue;
    if (c.state === 'NEW') seenNew = true;
    else if (c.state === 'EXPOSED' && seenNew) {
      return `P22 · ${c.id} está EXPOSED y se planificó después de un NEW`;
    }
  }
  return null;
}

/**
 * P23 / P24 · un plan no es evidencia, y el historial del Planner no es señal.
 *
 * El modelo no recibe historial de ejecuciones: la propiedad comprueba que la decisión depende
 * **solo** de la entrada autoritativa, replanificando sobre la misma entrada.
 */
export function p23PlanIsNotEvidence(input: PlannerInput): Violation {
  const first = plan(input);
  const second = plan(input);
  const third = plan(input);
  const key = (p: Plan) => JSON.stringify(p.actions);
  if (key(first) !== key(second) || key(second) !== key(third)) {
    return 'P23 · repetir la petición cambió la decisión: hay realimentación de auditoría';
  }
  return null;
}

/** P25 · el empaquetado no reordena la prioridad para consumir más minutos. */
export function p25PackingNonOptimization(input: PlannerInput, result: Plan): Violation {
  const used = result.actions.reduce((n, a) => n + a.minutes, 0);
  if (used > input.budget) return `P25 · el plan usa ${used} sobre ${input.budget}`;
  // Las posiciones seleccionadas deben ser crecientes respecto del orden de decisión emitido.
  const positions = result.actions.map((a) => a.conceptId);
  if (new Set(positions).size !== positions.length) {
    return 'P25 · un concepto aparece dos veces en el mismo plan';
  }
  return null;
}

/**
 * P26 · un presupuesto pequeño puede producir `APRENDER`, pero nunca parte la reparación.
 *
 * No se evalúa bajo `CHAINED` porque esa granularidad **la viola por construcción**: es
 * precisamente su falsación, y se comprueba aparte en `modelCheck.spec` para que conste como
 * hallazgo y no como ruido.
 */
export function p26SmallBudgetTruthfulness(input: PlannerInput, result: Plan): Violation {
  if (input.granularity === 'CHAINED') return null;
  const byId = new Map(input.concepts.map((c) => [c.id, c]));
  for (const a of result.actions) {
    const c = byId.get(a.conceptId);
    if (!c) continue;
    const remediation =
      c.state === 'EVIDENCE_NEGATIVE' || c.state === 'EVIDENCE_CONFLICTING' || c.errorPattern;
    if (remediation && a.minutes < c.learnMinutes + c.checkMinutes) {
      return `P26 · la reparación de ${c.id} entró con menos minutos de los que exige entera`;
    }
  }
  return null;
}

/** Todas las propiedades comprobables sobre un único plan. */
export function checkSinglePlan(input: PlannerInput): Violation {
  const result = plan(input);
  return (
    p1Determinism(input) ??
    p2RowOrder(input) ??
    p3Replay(input) ??
    p4NoUnauthorizedSignal(input, result) ??
    p5NoSyntheticActivity(result) ??
    p9BudgetHonesty(input, result) ??
    p10InterruptionSafety(input) ??
    p16NoReadinessProxy(result) ??
    p20TruthfulExhaustion(input, result) ??
    p21HybridGranularity(input, result) ??
    p22ExposedFirst(input, result) ??
    p23PlanIsNotEvidence(input) ??
    p25PackingNonOptimization(input, result) ??
    p26SmallBudgetTruthfulness(input, result)
  );
}

/** Conceptos de referencia para las enumeraciones. */
export function concept(partial: Partial<Concept> & { id: string; syllabus: number }): Concept {
  return {
    state: 'NEW',
    errorPattern: false,
    lastNegativeAt: null,
    learnMinutes: 5,
    checkMinutes: 3,
    eligibleContent: true,
    ...partial,
  };
}
