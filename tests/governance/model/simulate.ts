/**
 * Simulación longitudinal determinista · **gobernanza, no producción**.
 *
 * Ejecuta muchas sesiones sobre un sílabo sintético con comportamientos de aprendiz sembrados,
 * y mide **solo propiedades estructurales**: cobertura alcanzada, antigüedad de una necesidad sin
 * servir, bucles, inanición, violaciones de presupuesto, actividad fabricada.
 *
 * No mide, no estima y no reporta eficacia de aprendizaje. No hay puntuación de dominio, ni de
 * preparación, ni probabilidad de nada.
 */

import {
  execute,
  plan,
  type Concept,
  type CoverageOrder,
  type Granularity,
  type PlannerInput,
  type RemediationOrder,
} from './planner-model';

/** Generador congruente lineal: sembrado, portable y reproducible byte a byte. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export type Behaviour =
  | 'ALWAYS_CORRECT'
  | 'ALWAYS_WRONG'
  | 'ALTERNATING'
  | 'ONE_WEAK'
  | 'EARLY_WEAK'
  | 'LATE_WEAK'
  | 'SEEDED_RANDOM'
  | 'NEVER_EXECUTES'
  | 'ABANDONS_AFTER_FIRST'
  /** Abre la acción, la lee y se va sin comprobar: contacto real sin evidencia nueva. */
  | 'ABANDONS_AFTER_LEARN'
  | 'MULTI_WEAK'
  | 'CLUSTERED_WEAK'
  | 'MOVING_WEAKNESS';

export interface TrajectoryConfig {
  readonly concepts: number;
  readonly sessions: number;
  readonly budget: number | readonly number[];
  readonly behaviour: Behaviour;
  readonly granularity: Granularity;
  readonly coverageOrder: CoverageOrder;
  readonly remediationOrder?: RemediationOrder;
  readonly seed: number;
}

export interface TrajectoryResult {
  readonly plans: number;
  readonly actionsExecuted: number;
  /** Conceptos que alcanzaron alguna evidencia. */
  readonly coverageReached: number;
  /** Máximo de sesiones consecutivas que una necesidad legítima quedó sin servir. */
  readonly maxUnservedAge: number;
  readonly budgetViolations: number;
  readonly syntheticActivity: number;
  readonly nothingEligible: number;
  readonly nothingFits: number;
  /** Planes idénticos consecutivos sin que nada se ejecutara: no es patología, es corrección. */
  readonly repeatedIdenticalPlans: number;
  /** Bucle estructural: el mismo plan se repite pese a haberse ejecutado trabajo. */
  readonly structuralLoops: number;
  readonly nondeterministic: number;
  /** Mayor número de conceptos EXPOSED pendientes de comprobar en cualquier momento. */
  readonly maxExposedBacklog: number;
}

function budgetAt(cfg: TrajectoryConfig, session: number): number {
  if (typeof cfg.budget === 'number') return cfg.budget;
  return cfg.budget[session % cfg.budget.length]!;
}

function answersCorrectly(
  cfg: TrajectoryConfig,
  c: Concept,
  session: number,
  r: () => number,
): boolean {
  switch (cfg.behaviour) {
    case 'ALWAYS_CORRECT':
      return true;
    case 'ALWAYS_WRONG':
      return false;
    case 'ALTERNATING':
      return session % 2 === 0;
    case 'ONE_WEAK':
      return c.syllabus !== 1;
    case 'EARLY_WEAK':
      return c.syllabus > Math.ceil(cfg.concepts / 3);
    case 'LATE_WEAK':
      return c.syllabus <= Math.floor((cfg.concepts * 2) / 3);
    case 'SEEDED_RANDOM':
      return r() < 0.5;
    case 'MULTI_WEAK':
      return c.syllabus % 5 !== 1;
    case 'CLUSTERED_WEAK':
      return !(c.syllabus >= 3 && c.syllabus <= Math.max(4, Math.floor(cfg.concepts / 4)));
    case 'MOVING_WEAKNESS':
      // La debilidad se desplaza por el temario a medida que avanzan las sesiones.
      return c.syllabus !== (session % cfg.concepts) + 1;
    default:
      return true;
  }
}

export function buildSyllabus(n: number, seed: number): Concept[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const learn = 3 + Math.floor(r() * 8);
    const check = 2 + Math.floor(r() * 4);
    return {
      id: `c${String(i + 1).padStart(3, '0')}`,
      syllabus: i + 1,
      state: 'NEW' as const,
      errorPattern: false,
      lastNegativeAt: null,
      learnMinutes: learn,
      checkMinutes: check,
      eligibleContent: true,
    };
  });
}

export function runTrajectory(cfg: TrajectoryConfig): TrajectoryResult {
  let concepts = buildSyllabus(cfg.concepts, cfg.seed);
  const r = rng(cfg.seed ^ 0x5f3759df);
  let stream = 0;

  let plans = 0;
  let actionsExecuted = 0;
  let budgetViolations = 0;
  let syntheticActivity = 0;
  let nothingEligible = 0;
  let nothingFits = 0;
  let repeatedIdenticalPlans = 0;
  let structuralLoops = 0;
  let nondeterministic = 0;
  let maxExposedBacklog = 0;

  /** Sesiones consecutivas que cada concepto lleva siendo necesidad legítima sin ser servido. */
  const unserved = new Map<string, number>();
  let maxUnservedAge = 0;
  let previousKey = '';

  for (let session = 0; session < cfg.sessions; session += 1) {
    const input: PlannerInput = {
      concepts,
      budget: budgetAt(cfg, session),
      completedToday: [],
      granularity: cfg.granularity,
      coverageOrder: cfg.coverageOrder,
      ...(cfg.remediationOrder ? { remediationOrder: cfg.remediationOrder } : {}),
    };

    const result = plan(input);
    if (JSON.stringify(plan(input)) !== JSON.stringify(result)) nondeterministic += 1;
    plans += 1;

    const used = result.actions.reduce((n, a) => n + a.minutes, 0);
    if (used > input.budget) budgetViolations += 1;
    if (result.outcome === 'NOTHING_ELIGIBLE') {
      nothingEligible += 1;
      if (result.actions.length > 0) syntheticActivity += 1;
    }
    if (result.outcome === 'NOTHING_FITS') nothingFits += 1;

    // Antigüedad sin servir de cada necesidad legítima.
    const served = new Set(result.actions.map((a) => a.conceptId));
    for (const c of concepts) {
      const isNeed = c.eligibleContent && !(c.state === 'EVIDENCE_POSITIVE' && !c.errorPattern);
      if (!isNeed) {
        unserved.delete(c.id);
        continue;
      }
      const age = served.has(c.id) ? 0 : (unserved.get(c.id) ?? 0) + 1;
      unserved.set(c.id, age);
      if (age > maxUnservedAge) maxUnservedAge = age;
    }

    const exposedNow = concepts.filter((c) => c.state === 'EXPOSED').length;
    if (exposedNow > maxExposedBacklog) maxExposedBacklog = exposedNow;

    const key = JSON.stringify(result.actions);

    // Ejecución. `NEVER_EXECUTES` no toca nada: el plan se emite y la persona cierra.
    let executedSomething = false;
    let producedEvidence = false;
    if (cfg.behaviour !== 'NEVER_EXECUTES') {
      const toRun =
        cfg.behaviour === 'ABANDONS_AFTER_FIRST' ? result.actions.slice(0, 1) : result.actions;
      for (const action of toRun) {
        const index = concepts.findIndex((c) => c.id === action.conceptId);
        if (index < 0) continue;
        const before = concepts[index]!;
        stream += 1;
        const correct = answersCorrectly(cfg, before, session, r);
        // Abandonar tras leer: hay contacto, no hay comprobación y por tanto no hay evidencia.
        const performed =
          cfg.behaviour === 'ABANDONS_AFTER_LEARN' && action.kind !== 'CHECK'
            ? { ...action, kind: 'RELEARN' as const }
            : action;
        const after = execute(before, performed, correct, stream);
        concepts = concepts.map((c, i) => (i === index ? after : c));
        actionsExecuted += 1;
        executedSomething = true;
        // «Producir evidencia» es lo que hace avanzar al motor: un COMPROBAR siempre la produce;
        // exponer material solo mueve `NEW` → `EXPOSED`.
        if (after.state !== before.state || after.lastNegativeAt !== before.lastNegativeAt) {
          producedEvidence = true;
        }
      }
    }

    /**
     * Bucle estructural: el mismo plan se repite **y la ejecución no hizo avanzar nada**. Repetir
     * un plan porque la persona sigue fallando el mismo concepto no es patología: es la respuesta
     * correcta a una evidencia que se renueva. Lo patológico es una acción que, por construcción,
     * nunca puede cambiar el estado que la motiva.
     */
    if (key === previousKey && key !== '[]') {
      if (executedSomething && !producedEvidence) structuralLoops += 1;
      else if (!executedSomething) repeatedIdenticalPlans += 1;
    }
    previousKey = key;
  }

  const coverageReached = concepts.filter((c) => c.state !== 'NEW').length;

  return {
    plans,
    actionsExecuted,
    coverageReached,
    maxUnservedAge,
    budgetViolations,
    syntheticActivity,
    nothingEligible,
    nothingFits,
    repeatedIdenticalPlans,
    structuralLoops,
    nondeterministic,
    maxExposedBacklog,
  };
}
