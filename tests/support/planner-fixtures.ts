/**
 * Fixtures puros del Planner v1. **Datos de prueba**: las duraciones de aquí son fixtures
 * (P4-D2 diferida) y no pueden convertirse en constantes de runtime (contrato §I.3).
 *
 * También el puente hacia el modelo de referencia de gobernanza (`tests/governance/model`), que
 * sirve de oráculo diferencial. El puente vive en `tests/`: ningún código de producción importa
 * el modelo.
 */
import {
  PLANNER_VERSION,
  type MasteryState,
  type PlanDecision,
  type PlannerConcept,
  type PlannerInput,
  type Uncertainty,
} from '@study-os/planner-engine';

import type { Concept as ModelConcept, Plan as ModelPlan } from '../governance/model/planner-model';

/** Identificador sintético estable y ordenable. */
export function fixtureId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

export interface ConceptSpec {
  readonly n: number;
  readonly state?: MasteryState;
  readonly uncertainty?: Uncertainty;
  readonly pattern?: boolean;
  readonly lastNegative?: number | null;
  readonly block?: number;
  readonly topic?: number;
  readonly sort?: number;
  readonly status?: PlannerConcept['conceptStatus'];
  readonly completedToday?: boolean;
  readonly units?: number;
  readonly questions?: number;
  readonly learnMinutes?: number;
  readonly checkMinutes?: number;
  readonly unitSourceExcluded?: boolean;
  readonly questionSourceExcluded?: boolean;
  readonly answeredToday?: boolean;
}

const REMEDIATION = new Set(['EVIDENCE_NEGATIVE', 'EVIDENCE_CONFLICTING']);

export function concept(spec: ConceptSpec): PlannerConcept {
  const state = spec.state ?? 'NEW';
  const id = fixtureId('c', spec.n);
  const lastNegative =
    spec.lastNegative !== undefined ? spec.lastNegative : REMEDIATION.has(state) ? spec.n : null;
  return {
    conceptId: id,
    conceptStatus: spec.status ?? 'PUBLISHED',
    syllabus: {
      blockSortOrder: spec.block ?? 1,
      topicSortOrder: spec.topic ?? 1,
      conceptSortOrder: spec.sort ?? spec.n,
      conceptKey: `k${String(spec.n).padStart(4, '0')}`,
    },
    masteryState: state,
    uncertainty:
      spec.uncertainty ??
      (state === 'NEW' || state === 'EXPOSED' ? 'NO_EVIDENCE' : 'SINGLE_OBSERVATION'),
    activeErrorPattern: spec.pattern ?? false,
    lastNegativePosition: lastNegative,
    completedToday: spec.completedToday ?? false,
    units: Array.from({ length: spec.units ?? 1 }, (_, i) => ({
      learningUnitId: fixtureId(`u${spec.n}`, i),
      learningUnitVersionId: fixtureId(`uv${spec.n}`, i),
      sourceExcluded: spec.unitSourceExcluded ?? false,
      minutes: spec.learnMinutes ?? 5,
    })),
    questions: Array.from({ length: spec.questions ?? 1 }, (_, i) => ({
      questionId: fixtureId(`q${spec.n}`, i),
      representationId: fixtureId(`r${spec.n}`, i),
      sourceExcluded: spec.questionSourceExcluded ?? false,
      answeredToday: spec.answeredToday ?? false,
      minutes: spec.checkMinutes ?? 3,
    })),
  };
}

export function input(
  concepts: readonly PlannerConcept[],
  budget: number,
  overrides: Partial<PlannerInput> = {},
): PlannerInput {
  const maxNegative = Math.max(0, ...concepts.map((c) => c.lastNegativePosition ?? 0));
  return {
    plannerVersion: PLANNER_VERSION,
    plannerConfigVersion: 'v1',
    userId: '00000000-0000-4000-8000-000000000001',
    goalId: '00000000-0000-4000-8000-000000000002',
    packVersionId: '00000000-0000-4000-8000-000000000003',
    planDay: '2026-09-21',
    timezone: 'Europe/Madrid',
    budget: { minutes: budget, source: 'DEFAULT_DAILY' },
    engine: {
      engineVersion: 'fixture-engine',
      engineConfigVersion: 'v1',
      attributionPackVersionId: '00000000-0000-4000-8000-000000000003',
      attributionGeneration: 1,
      consumedPosition: Math.max(1000, maxNegative),
    },
    durationProvenance: 'FIXTURE',
    concepts,
    ...overrides,
  };
}

/** Un concepto del modelo de referencia, en la forma de producción. */
export function fromModel(model: ModelConcept, completedToday: boolean): PlannerConcept {
  return {
    conceptId: model.id,
    conceptStatus: 'PUBLISHED',
    syllabus: {
      blockSortOrder: 0,
      topicSortOrder: 0,
      conceptSortOrder: model.syllabus,
      conceptKey: model.id,
    },
    masteryState: model.state,
    uncertainty:
      model.state === 'NEW' || model.state === 'EXPOSED' ? 'NO_EVIDENCE' : 'SINGLE_OBSERVATION',
    activeErrorPattern: model.errorPattern,
    lastNegativePosition: model.lastNegativeAt,
    completedToday,
    units: model.eligibleContent
      ? [
          {
            learningUnitId: `u-${model.id}`,
            learningUnitVersionId: `uv-${model.id}`,
            sourceExcluded: false,
            minutes: model.learnMinutes,
          },
        ]
      : [],
    questions: model.eligibleContent
      ? [
          {
            questionId: `q-${model.id}`,
            representationId: `r-${model.id}`,
            sourceExcluded: false,
            answeredToday: false,
            minutes: model.checkMinutes,
          },
        ]
      : [],
  };
}

/** Lo comparable de una decisión, en el vocabulario del modelo. */
export function comparable(decision: PlanDecision) {
  return {
    outcome: decision.outcome,
    minutes: decision.plannedMinutes,
    actions: decision.actions.map((a) => ({
      conceptId: a.conceptId,
      kind: a.kind,
      minutes: a.minutes,
      reason: a.reason,
    })),
    exclusions: Object.fromEntries(
      decision.candidates
        .filter((c) => c.exclusion !== null && c.exclusion !== 'OVER_BUDGET')
        .map((c) => [
          c.conceptId,
          c.exclusion === 'NO_ATTRIBUTED_QUESTION' ? 'NO_ELIGIBLE_CONTENT' : c.exclusion,
        ]),
    ),
    overBudget: decision.candidates
      .filter((c) => c.exclusion === 'OVER_BUDGET')
      .map((c) => c.conceptId),
  };
}

export function comparableModel(model: ModelPlan) {
  return {
    outcome: model.outcome,
    minutes: model.minutes,
    actions: model.actions.map((a) => ({
      conceptId: a.conceptId,
      kind: a.kind,
      minutes: a.minutes,
      reason: a.reason,
    })),
    exclusions: Object.fromEntries(
      model.exclusions
        .filter((e) => e.reason !== 'OVER_BUDGET')
        .map((e) => [e.conceptId, e.reason]),
    ),
    overBudget: model.exclusions.filter((e) => e.reason === 'OVER_BUDGET').map((e) => e.conceptId),
  };
}
