import {
  EXCLUSION_REASONS,
  V1_MASTERY_STATES,
  V1_UNCERTAINTY,
  type ActionKind,
  type CandidateAudit,
  type CompositionReason,
  type ExclusionReason,
  type Need,
  type PlanDecision,
  type PlannedAction,
  type PlannedStep,
  type PlannerConcept,
  type PlannerInput,
  type QuestionCandidate,
  type UnitCandidate,
} from './types';

/**
 * El Planner v1 · función de decisión.
 *
 * Determinista y total sobre una entrada válida: la misma entrada canónica da la misma decisión,
 * byte a byte (§B.2). No lee reloj, ni red, ni azar, ni historial de ejecuciones: **un plan es un
 * registro de decisión, no evidencia de ejecución** (§F.4), así que ninguna ejecución anterior
 * entra aquí.
 *
 * Todo lo que decide procede del contrato del Planner v1.4:
 *
 *   - elegibilidad como filtro duro con razón (§E);
 *   - necesidad por estado categórico y granularidad híbrida (§F.1, §F.2 · P4-D3);
 *   - reparación por **última evidencia negativa, más antigua primero** (§F.5 · P4-D5), con la
 *     posición proyectada por el motor (P4-D6);
 *   - continuidad con `EXPOSED` antes que `NEW` (§F.6 · P4-D4);
 *   - composición: una reparación en la cabeza, la continuidad en el resto, el desbordamiento de
 *     reparación solo al agotar la continuidad (§G.2);
 *   - empaquetado que **salta** lo que no cabe y no optimiza minutos (§I.5).
 */

export class PlannerInputError extends Error {
  constructor(message: string) {
    super(`PLANNER_INPUT · ${message}`);
    this.name = 'PlannerInputError';
  }
}

/** Comparación por punto de código, nunca por colación de locale (§H). */
export function compareCodePoints(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const na = ia.next();
    const nb = ib.next();
    if (na.done && nb.done) return 0;
    if (na.done) return -1;
    if (nb.done) return 1;
    const ca = na.value.codePointAt(0) ?? 0;
    const cb = nb.value.codePointAt(0) ?? 0;
    if (ca !== cb) return ca < cb ? -1 : 1;
  }
}

const REMEDIATION_STATES = new Set(['EVIDENCE_NEGATIVE', 'EVIDENCE_CONFLICTING']);
const MASTERY = new Set<string>(V1_MASTERY_STATES);
const UNCERTAINTY = new Set<string>(V1_UNCERTAINTY);
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 600;
}

/**
 * Valida las invariantes de entrada. Una entrada que las viole no se planifica: el Planner no
 * «arregla» datos que contradicen al motor.
 */
export function assertPlannerInput(input: PlannerInput): void {
  if (!DAY.test(input.planDay))
    throw new PlannerInputError(`planDay mal formado: ${input.planDay}`);
  if (!input.timezone) throw new PlannerInputError('sin zona horaria no existe «hoy» (§I.1)');
  const budget = input.budget.minutes;
  if (!Number.isInteger(budget) || budget < 0 || budget > 600) {
    throw new PlannerInputError(`presupuesto fuera de rango: ${budget}`);
  }
  if (!Number.isInteger(input.engine.consumedPosition) || input.engine.consumedPosition < 0) {
    throw new PlannerInputError('posición consumida del motor inválida');
  }
  const ids = new Set<string>();
  for (const concept of input.concepts) {
    if (ids.has(concept.conceptId)) {
      throw new PlannerInputError(`concepto duplicado: ${concept.conceptId}`);
    }
    ids.add(concept.conceptId);
    if (!MASTERY.has(concept.masteryState)) {
      throw new PlannerInputError(`estado no v1: ${concept.masteryState}`);
    }
    if (!UNCERTAINTY.has(concept.uncertainty)) {
      throw new PlannerInputError(`incertidumbre no v1: ${concept.uncertainty}`);
    }
    const remediation = REMEDIATION_STATES.has(concept.masteryState);
    // Contrato del motor §25.2: la posición existe exactamente en reparación.
    if (remediation !== (concept.lastNegativePosition !== null)) {
      throw new PlannerInputError(
        `last_negative_position incoherente con ${concept.masteryState} en ${concept.conceptId}`,
      );
    }
    if (
      concept.lastNegativePosition !== null &&
      (!Number.isInteger(concept.lastNegativePosition) ||
        concept.lastNegativePosition < 1 ||
        concept.lastNegativePosition > input.engine.consumedPosition)
    ) {
      throw new PlannerInputError(`last_negative_position fuera de rango en ${concept.conceptId}`);
    }
    // Contrato del motor §17: todo patrón procede de intentos no correctos.
    if (concept.activeErrorPattern && !remediation) {
      throw new PlannerInputError(`patrón activo sin evidencia negativa en ${concept.conceptId}`);
    }
    for (const unit of concept.units) {
      // ADR-013 §2.5 · la ausencia es dato y se excluye con razón propia; un número presente
      // sigue teniendo que ser un número de minutos válido.
      if (unit.minutes !== null && !isMinutes(unit.minutes)) {
        throw new PlannerInputError(`duración inválida en la unidad ${unit.learningUnitId}`);
      }
    }
    for (const question of concept.questions) {
      if (!isMinutes(question.minutes)) {
        throw new PlannerInputError(`duración inválida en la pregunta ${question.questionId}`);
      }
    }
  }
}

/** Clave de sílabo completa (§H): bloque · tema · concepto · `concept_key` · `concepts.id`. */
export function bySyllabus(a: PlannerConcept, b: PlannerConcept): number {
  const x = a.syllabus;
  const y = b.syllabus;
  if (x.blockSortOrder !== y.blockSortOrder) return x.blockSortOrder - y.blockSortOrder;
  if (x.topicSortOrder !== y.topicSortOrder) return x.topicSortOrder - y.topicSortOrder;
  if (x.conceptSortOrder !== y.conceptSortOrder) return x.conceptSortOrder - y.conceptSortOrder;
  return (
    compareCodePoints(x.conceptKey, y.conceptKey) || compareCodePoints(a.conceptId, b.conceptId)
  );
}

/** §F.5 · P4-D5 · última evidencia negativa, más antigua primero; a igualdad, sílabo. */
export function byLastNegative(a: PlannerConcept, b: PlannerConcept): number {
  const x = a.lastNegativePosition ?? Number.MAX_SAFE_INTEGER;
  const y = b.lastNegativePosition ?? Number.MAX_SAFE_INTEGER;
  return x !== y ? x - y : bySyllabus(a, b);
}

/** §F.6 · P4-D4 · `EXPOSED` antes que `NEW`; dentro de cada una, sílabo. */
export function byContinuity(a: PlannerConcept, b: PlannerConcept): number {
  const x = a.masteryState === 'EXPOSED' ? 0 : 1;
  const y = b.masteryState === 'EXPOSED' ? 0 : 1;
  return x !== y ? x - y : bySyllabus(a, b);
}

function needOf(concept: PlannerConcept): Need {
  if (REMEDIATION_STATES.has(concept.masteryState) || concept.activeErrorPattern) {
    return 'REMEDIATION';
  }
  if (concept.masteryState === 'EXPOSED') return 'VERIFICATION';
  if (concept.masteryState === 'NEW') return 'COVERAGE';
  return 'NONE';
}

/** La acción que corresponde a una necesidad bajo granularidad híbrida (§F.2 · P4-D3). */
function actionKindOf(need: Need): ActionKind | null {
  if (need === 'REMEDIATION') return 'RELEARN_CHECK';
  if (need === 'VERIFICATION') return 'CHECK';
  if (need === 'COVERAGE') return 'LEARN';
  return null;
}

/** Desempate de contenido: identidad estable por punto de código (§H, último criterio). */
function firstUnit(units: readonly UnitCandidate[]): UnitCandidate | undefined {
  return [...units].sort((a, b) => compareCodePoints(a.learningUnitId, b.learningUnitId))[0];
}

/** §H · entre las publicadas, atribuidas y no respondidas en el día de plan, id por punto de código. */
function firstQuestion(questions: readonly QuestionCandidate[]): QuestionCandidate | undefined {
  return [...questions].sort((a, b) => compareCodePoints(a.questionId, b.questionId))[0];
}

type Resolution =
  | { readonly ok: true; readonly steps: readonly PlannedStep[]; readonly minutes: number }
  | { readonly ok: false; readonly reason: ExclusionReason };

/**
 * Los destinos concretos de la acción de un candidato. Si el destino que su necesidad exige no
 * existe, la acción no puede planificarse y la razón queda registrada.
 *
 * `NO_PUBLISHED_UNIT` no figura en la lista de §E. Nombra una exclusión **forzada**, no una
 * regla: §E.2 admite como candidato un concepto con solo pregunta atribuida, pero `APRENDER` y
 * `REAPRENDER` (§F.1) exigen una unidad que no existe. No planificar lo inexistente no es una
 * decisión; la etiqueta es nueva y está **ratificada** por decisión humana del 2026-09-19
 * (OBS-4A-B1). No autoriza actividad sintética, contenido de respaldo ni sustituir APRENDER por
 * una pregunta: solo nombra y audita una exclusión forzada.
 */
function resolveAction(concept: PlannerConcept, kind: ActionKind): Resolution {
  const steps: PlannedStep[] = [];
  let minutes = 0;

  if (kind === 'LEARN' || kind === 'RELEARN_CHECK') {
    if (concept.units.length === 0) return { ok: false, reason: 'NO_PUBLISHED_UNIT' };
    const available = concept.units.filter((candidate) => !candidate.sourceExcluded);
    if (available.length === 0) return { ok: false, reason: 'SOURCE_STATUS_EXCLUDED' };
    // ADR-013 §2.5 · una versión sin duración declarada no es un destino planificable, igual que
    // una con la fuente excluida. **No se rellena** con ningún valor: si ninguna la declara, el
    // candidato se excluye con su razón propia y la ejecución sigue con el resto.
    const unit = firstUnit(available.filter((candidate) => candidate.minutes !== null));
    if (!unit || unit.minutes === null) return { ok: false, reason: 'NO_DURATION_METADATA' };
    steps.push({
      step: 'LEARN',
      itemType: 'LEARNING_UNIT',
      learningUnitId: unit.learningUnitId,
      learningUnitVersionId: unit.learningUnitVersionId,
      minutes: unit.minutes,
    });
    minutes += unit.minutes;
  }

  if (kind === 'CHECK' || kind === 'RELEARN_CHECK') {
    if (concept.questions.length === 0) return { ok: false, reason: 'NO_ATTRIBUTED_QUESTION' };
    const valid = concept.questions.filter((candidate) => !candidate.sourceExcluded);
    if (valid.length === 0) return { ok: false, reason: 'SOURCE_STATUS_EXCLUDED' };
    const question = firstQuestion(valid.filter((candidate) => !candidate.answeredToday));
    // Todas las válidas ya se respondieron hoy: el concepto ya se trabajó hoy (§E.5, §H).
    if (!question) return { ok: false, reason: 'COMPLETED_TODAY' };
    steps.push({
      step: 'CHECK',
      itemType: 'QUESTION',
      questionId: question.questionId,
      representationId: question.representationId,
      minutes: question.minutes,
    });
    minutes += question.minutes;
  }

  return { ok: true, steps, minutes };
}

/** Exclusión previa a la acción (§E). `null` si el concepto sigue siendo candidato. */
function baseExclusion(concept: PlannerConcept): ExclusionReason | null {
  if (concept.conceptStatus !== 'PUBLISHED') return 'TARGET_RETIRED';
  // §E.2 · ni unidad publicada ni pregunta atribuida.
  if (concept.units.length === 0 && concept.questions.length === 0) return 'NO_ATTRIBUTED_QUESTION';
  if (concept.completedToday) return 'COMPLETED_TODAY';
  if (needOf(concept) === 'NONE') return 'POSITIVE_NO_REVIEW_POLICY';
  return null;
}

interface Eligible {
  readonly concept: PlannerConcept;
  readonly need: Need;
  readonly kind: ActionKind;
  readonly steps: readonly PlannedStep[];
  readonly minutes: number;
}

/** La función de decisión. */
export function plan(input: PlannerInput): PlanDecision {
  assertPlannerInput(input);

  const exclusions = new Map<string, ExclusionReason>();
  const eligible: Eligible[] = [];

  for (const concept of input.concepts) {
    const excluded = baseExclusion(concept);
    if (excluded) {
      exclusions.set(concept.conceptId, excluded);
      continue;
    }
    const need = needOf(concept);
    const kind = actionKindOf(need);
    if (!kind) {
      exclusions.set(concept.conceptId, 'POSITIVE_NO_REVIEW_POLICY');
      continue;
    }
    const resolved = resolveAction(concept, kind);
    if (!resolved.ok) {
      exclusions.set(concept.conceptId, resolved.reason);
      continue;
    }
    eligible.push({ concept, need, kind, steps: resolved.steps, minutes: resolved.minutes });
  }

  const budget = input.budget.minutes;
  const placed = new Map<string, number>();
  const actions: PlannedAction[] = [];

  const finish = (outcome: PlanDecision['outcome']): PlanDecision => {
    // Todo elegible no colocado se intentó en su turno y no cupo (§E · `OVER_BUDGET`, §J), también
    // con presupuesto cero (§L): ningún candidato queda en la auditoría sin su razón (§S).
    for (const candidate of eligible) {
      if (!placed.has(candidate.concept.conceptId)) {
        exclusions.set(candidate.concept.conceptId, 'OVER_BUDGET');
      }
    }
    return decisionOf(outcome);
  };
  const decisionOf = (outcome: PlanDecision['outcome']): PlanDecision => ({
    outcome,
    plannedMinutes: actions.reduce((sum, action) => sum + action.minutes, 0),
    actions,
    candidates: auditOf(input, exclusions, placed),
  });

  // §L · el cero es una declaración de la persona, no una deuda.
  if (budget === 0) return finish('ZERO_TIME');
  // §K · sin necesidad autorizada no se fabrica nada (§K.1).
  if (eligible.length === 0) return finish('NOTHING_ELIGIBLE');

  const remediation = eligible
    .filter((candidate) => candidate.need === 'REMEDIATION')
    .sort((a, b) => byLastNegative(a.concept, b.concept));
  const continuity = eligible
    .filter((candidate) => candidate.need !== 'REMEDIATION')
    .sort((a, b) => byContinuity(a.concept, b.concept));

  let used = 0;
  const place = (candidate: Eligible, reason: CompositionReason): boolean => {
    // §I.5 · lo que no cabe se salta; nunca se reordena para llenar minutos.
    if (used + candidate.minutes > budget) return false;
    used += candidate.minutes;
    const ordinal = actions.length + 1;
    actions.push({
      ordinal,
      conceptId: candidate.concept.conceptId,
      kind: candidate.kind,
      reason,
      minutes: candidate.minutes,
      steps: candidate.steps,
    });
    placed.set(candidate.concept.conceptId, ordinal);
    return true;
  };

  // 1 · G-R · la garantía existencial: la reparación con la evidencia negativa más antigua.
  const head = remediation[0];
  if (head) place(head, 'REMEDIATION_GUARANTEE');
  // 2 · G-C · la continuidad en su orden, saltando lo que no cabe.
  for (const candidate of continuity) place(candidate, 'COVERAGE');
  // 3 · el resto de la reparación, solo agotada la continuidad.
  for (const candidate of remediation) {
    if (!placed.has(candidate.concept.conceptId)) place(candidate, 'REMEDIATION_OVERFLOW');
  }

  return finish(actions.length === 0 ? 'NOTHING_FITS' : 'PLANNED');
}

function auditOf(
  input: PlannerInput,
  exclusions: ReadonlyMap<string, ExclusionReason>,
  placed: ReadonlyMap<string, number>,
): CandidateAudit[] {
  return [...input.concepts]
    .sort((a, b) => compareCodePoints(a.conceptId, b.conceptId))
    .map((concept) => ({
      conceptId: concept.conceptId,
      masteryState: concept.masteryState,
      uncertainty: concept.uncertainty,
      activeErrorPattern: concept.activeErrorPattern,
      lastNegativePosition: concept.lastNegativePosition,
      need: needOf(concept),
      exclusion: exclusions.get(concept.conceptId) ?? null,
      syllabus: concept.syllabus,
      placedOrdinal: placed.get(concept.conceptId) ?? null,
    }));
}

/** Verificación de cierre del enum: toda razón producida pertenece a la lista versionada. */
export function isExclusionReason(value: string): value is ExclusionReason {
  return (EXCLUSION_REASONS as readonly string[]).includes(value);
}
