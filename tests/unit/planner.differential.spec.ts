import { describe, expect, it } from 'vitest';

import { canonicalDecision, plan as productionPlan } from '@study-os/planner-engine';

import {
  execute,
  plan as modelPlan,
  type Concept,
  type EngineState,
  type PlannedAction as ModelAction,
  type PlannerInput as ModelInput,
} from '../governance/model/planner-model';
import { rng } from '../governance/model/simulate';
import { comparable, comparableModel, fromModel, input } from '../support/planner-fixtures';

/**
 * `planner.differential.spec` · el Planner de producción contra el modelo de referencia de
 * gobernanza, que es el oráculo con el que se validaron P4-D1 … P4-D6.
 *
 * El modelo se fija en la variante aceptada: granularidad `HYBRID` (P4-D3), `EXPOSED_FIRST`
 * (P4-D4) y `EVIDENCE_OLDEST` (P4-D5). El dominio se restringe a las invariantes que el motor
 * garantiza (contrato del motor §17 y §25.2): un patrón solo existe con evidencia negativa, y la
 * posición existe exactamente en reparación.
 *
 * Diferencias de registro, no de decisión: el modelo registra `OVER_BUDGET` solo para la acción
 * más corta en `NOTHING_FITS`; producción lo registra para **todo** elegible no colocado, porque
 * todos se intentaron y ninguno cupo. Se comprueba que el del modelo esté incluido.
 */

function modelInput(concepts: Concept[], budget: number, completed: string[]): ModelInput {
  return {
    concepts,
    budget,
    completedToday: completed,
    granularity: 'HYBRID',
    coverageOrder: 'EXPOSED_FIRST',
    remediationOrder: 'EVIDENCE_OLDEST',
  };
}

function productionInput(concepts: Concept[], budget: number, completed: string[]) {
  const done = new Set(completed);
  return input(
    concepts.map((c) => fromModel(c, done.has(c.id))),
    budget,
  );
}

/** Compara una decisión; devuelve el motivo de discrepancia o `null`. */
function disagreement(concepts: Concept[], budget: number, completed: string[]): string | null {
  const m = comparableModel(modelPlan(modelInput(concepts, budget, completed)));
  const p = comparable(productionPlan(productionInput(concepts, budget, completed)));
  const sameCore =
    JSON.stringify({ ...m, overBudget: [] }) === JSON.stringify({ ...p, overBudget: [] });
  if (!sameCore) return `modelo ${JSON.stringify(m)} · producción ${JSON.stringify(p)}`;
  for (const id of m.overBudget) {
    if (!p.overBudget.includes(id)) return `OVER_BUDGET del modelo ausente: ${id}`;
  }
  return null;
}

interface Option {
  readonly state: EngineState;
  readonly pattern: boolean;
  readonly lastNegativeAt: number | null;
}

const FULL_OPTIONS: Option[] = [
  { state: 'NEW', pattern: false, lastNegativeAt: null },
  { state: 'EXPOSED', pattern: false, lastNegativeAt: null },
  { state: 'EVIDENCE_POSITIVE', pattern: false, lastNegativeAt: null },
  ...(['EVIDENCE_NEGATIVE', 'EVIDENCE_CONFLICTING'] as const).flatMap((state) =>
    [false, true].flatMap((pattern) =>
      [5, 9].map((lastNegativeAt) => ({ state, pattern, lastNegativeAt })),
    ),
  ),
];

function make(i: number, o: Option, eligible: boolean, learn: number): Concept {
  return {
    id: `c${i}`,
    syllabus: i,
    state: o.state,
    errorPattern: o.pattern,
    lastNegativeAt: o.lastNegativeAt,
    learnMinutes: learn,
    checkMinutes: 3,
    eligibleContent: eligible,
  };
}

const BUDGETS = [0, 3, 5, 9, 12, 30];

describe('diferencial exhaustivo · dos conceptos, todo el dominio admisible', () => {
  it('coincide con el oráculo en cada estado y presupuesto', () => {
    let cases = 0;
    const failures: string[] = [];
    for (const a of FULL_OPTIONS)
      for (const b of FULL_OPTIONS)
        for (const ea of [true, false])
          for (const eb of [true, false])
            for (const la of [2, 7])
              for (const lb of [2, 7])
                for (const done of [[], ['c0'], ['c1']])
                  for (const budget of BUDGETS) {
                    cases += 1;
                    const why = disagreement(
                      [make(0, a, ea, la), make(1, b, eb, lb)],
                      budget,
                      done,
                    );
                    if (why && failures.length < 5) failures.push(why);
                  }
    expect(failures).toEqual([]);
    expect(cases).toBeGreaterThanOrEqual(30_000);
  });
});

describe('diferencial exhaustivo · tres conceptos con contenido elegible', () => {
  it('coincide con el oráculo', () => {
    let cases = 0;
    const failures: string[] = [];
    for (const a of FULL_OPTIONS)
      for (const b of FULL_OPTIONS)
        for (const c of FULL_OPTIONS)
          for (const learn of [2, 7])
            for (const budget of BUDGETS) {
              cases += 1;
              const why = disagreement(
                [make(0, a, true, learn), make(1, b, true, 9 - learn), make(2, c, true, 4)],
                budget,
                [],
              );
              if (why && failures.length < 5) failures.push(why);
            }
    expect(failures).toEqual([]);
    expect(cases).toBeGreaterThanOrEqual(15_000);
  });
});

/**
 * Controles de mutación: el oráculo diferencial **sí** detecta cada clase de defecto. Se aplica
 * al modelo una variante rechazada y se comprueba que el diferencial encuentra discrepancia con
 * producción. Si un mutante sobreviviera, el diferencial no tendría poder sobre esa clase.
 */
describe('controles de mutación · el diferencial tiene poder de detección', () => {
  const variants: Array<[string, Partial<ModelInput>]> = [
    ['reparación por sílabo', { remediationOrder: 'SYLLABUS' }],
    ['reparación por la evidencia más reciente', { remediationOrder: 'EVIDENCE_NEWEST' }],
    ['primera negativa sin resolver', { remediationOrder: 'FIRST_UNRESOLVED' }],
    ['NEW antes que EXPOSED', { coverageOrder: 'NEW_FIRST' }],
    ['granularidad atómica', { granularity: 'ATOMIC' }],
    ['granularidad en cadena', { granularity: 'CHAINED' }],
    ['reciclar EVIDENCE_POSITIVE', { mutations: { includePositive: true } }],
    ['ratio 50/50', { mutations: { ratio5050: true } }],
    ['orden de filas', { mutations: { rowOrderDecides: true } }],
    ['exceder el presupuesto', { mutations: { exceedBudget: true } }],
    ['ignorar la reparación', { mutations: { ignoreRemediation: true } }],
    ['ignorar la continuidad', { mutations: { ignoreCoverage: true } }],
    ['fabricar al agotarse', { mutations: { fabricateOnExhaustion: true } }],
    ['desempate invertido', { mutations: { reverseTieBreak: true } }],
  ];

  const scenarios: Array<{ concepts: Concept[]; budget: number }> = [];
  const order = [3, 1, 2, 0];
  for (const a of FULL_OPTIONS)
    for (const b of FULL_OPTIONS)
      for (const budget of [4, 7, 12, 30])
        scenarios.push({
          concepts: order.map((i) =>
            make(
              i,
              i === 0 ? a : i === 1 ? b : i === 2 ? FULL_OPTIONS[1]! : FULL_OPTIONS[5]!,
              true,
              i === 3 ? 7 : 2,
            ),
          ),
          budget,
        });
  // Un escenario sin nada elegible para el mutante que fabrica actividad.
  scenarios.push({
    concepts: [make(0, FULL_OPTIONS[2]!, true, 2), make(1, FULL_OPTIONS[2]!, true, 2)],
    budget: 30,
  });

  for (const [name, variant] of variants) {
    it(`mata al mutante: ${name}`, () => {
      const killed = scenarios.some(({ concepts, budget }) => {
        const mutated = comparableModel(
          modelPlan({ ...modelInput(concepts, budget, []), ...variant }),
        );
        const production = comparable(productionPlan(productionInput(concepts, budget, [])));
        return (
          JSON.stringify({ ...mutated, overBudget: [] }) !==
          JSON.stringify({ ...production, overBudget: [] })
        );
      });
      expect(killed).toBe(true);
    });
  }
});

/**
 * Simulación longitudinal en paralelo: en cada sesión de cada trayectoria, producción y oráculo
 * deciden sobre el mismo estado, y deben coincidir. La transición la da la ejecución simulada
 * del modelo, que solo cambia estado con evidencia (§F.4).
 */
type Mode = 'EXECUTES' | 'ABANDONS_MIDWAY' | 'READS_WITHOUT_CHECKING';

function runLockstep(size: number, pCorrect: number, mode: Mode, seed: number) {
  const random = rng(seed);
  let concepts: Concept[] = Array.from({ length: size }, (_, i) => ({
    id: `c${String(i).padStart(3, '0')}`,
    syllabus: i,
    state: 'NEW' as EngineState,
    errorPattern: false,
    lastNegativeAt: null,
    learnMinutes: 2 + Math.floor(random() * 9),
    checkMinutes: 1 + Math.floor(random() * 5),
    eligibleContent: random() > 0.05,
  }));
  const budgets = [0, 4, 12, 30, 60, 240];
  let position = 1;
  let completed: string[] = [];
  let mismatches = 0;
  let overBudget = 0;
  let positivePlanned = 0;
  let first: string | null = null;
  const seen = new Set<string>();

  for (let session = 0; session < 100; session += 1) {
    if (session % 2 === 0) completed = [];
    const budget = budgets[Math.floor(random() * budgets.length)]!;
    const why = disagreement(concepts, budget, completed);
    if (why) {
      mismatches += 1;
      first ??= why;
    }
    const decision = productionPlan(productionInput(concepts, budget, completed));
    if (decision.plannedMinutes > budget) overBudget += 1;
    seen.add(decision.outcome);
    for (const action of decision.actions) seen.add(`${action.kind}:${action.reason}`);
    const byId = new Map(concepts.map((c) => [c.id, c]));
    for (const action of decision.actions) {
      if (byId.get(action.conceptId)?.state === 'EVIDENCE_POSITIVE') positivePlanned += 1;
    }

    // Ejecución simulada: solo la evidencia cambia el estado.
    const executed: string[] = [];
    for (const action of decision.actions) {
      if (mode === 'ABANDONS_MIDWAY' && random() < 0.5) break;
      const current = byId.get(action.conceptId)!;
      const modelAction: ModelAction = {
        conceptId: action.conceptId,
        kind:
          mode === 'READS_WITHOUT_CHECKING' && action.kind === 'RELEARN_CHECK'
            ? 'RELEARN'
            : action.kind,
        minutes: action.minutes,
        reason: action.reason,
      };
      position += 1;
      byId.set(action.conceptId, execute(current, modelAction, random() < pCorrect, position));
      executed.push(action.conceptId);
    }
    // Derivación del motor: el patrón existe solo con evidencia negativa (§17).
    concepts = concepts.map((c) => {
      const next = byId.get(c.id)!;
      const remediation =
        next.state === 'EVIDENCE_NEGATIVE' || next.state === 'EVIDENCE_CONFLICTING';
      return { ...next, errorPattern: remediation && next.errorPattern };
    });
    completed = [...completed, ...executed];
  }
  return { mismatches, overBudget, positivePlanned, first, seen };
}

describe('simulación longitudinal en paralelo · ≥ 1000 trayectorias × 100 sesiones', () => {
  const configs: Array<[number, number, Mode, number]> = [];
  for (const size of [3, 8, 20, 40])
    for (const p of [0, 0.3, 0.7, 1])
      for (const mode of ['EXECUTES', 'ABANDONS_MIDWAY', 'READS_WITHOUT_CHECKING'] as Mode[])
        for (let seed = 1; seed <= 21; seed += 1) configs.push([size, p, mode, seed]);

  it('el barrido tiene al menos 1000 trayectorias y 100 000 sesiones', () => {
    expect(configs.length).toBeGreaterThanOrEqual(1000);
    expect(configs.length * 100).toBeGreaterThanOrEqual(100_000);
  });

  it('producción y oráculo coinciden en cada sesión; nunca se excede el presupuesto ni se recicla positivo', () => {
    const summary = {
      mismatches: 0,
      overBudget: 0,
      positivePlanned: 0,
      first: null as string | null,
    };
    const seen = new Set<string>();
    for (const [size, p, mode, seed] of configs) {
      const r = runLockstep(size, p, mode, seed);
      for (const key of r.seen) seen.add(key);
      summary.mismatches += r.mismatches;
      summary.overBudget += r.overBudget;
      summary.positivePlanned += r.positivePlanned;
      summary.first ??= r.first;
    }
    expect(summary).toEqual({ mismatches: 0, overBudget: 0, positivePlanned: 0, first: null });
    // El barrido recorre de verdad todos los desenlaces y todas las razones de composición.
    expect([...seen].sort()).toEqual([
      'CHECK:COVERAGE',
      'LEARN:COVERAGE',
      'NOTHING_ELIGIBLE',
      'NOTHING_FITS',
      'PLANNED',
      'RELEARN_CHECK:REMEDIATION_GUARANTEE',
      'RELEARN_CHECK:REMEDIATION_OVERFLOW',
      'ZERO_TIME',
    ]);
  }, 300_000);
});

describe('metamórficas', () => {
  const base: Concept[] = [
    make(0, FULL_OPTIONS[3]!, true, 7),
    make(1, FULL_OPTIONS[1]!, true, 2),
    make(2, FULL_OPTIONS[0]!, true, 4),
    make(3, FULL_OPTIONS[8]!, true, 2),
  ];

  it('permutar la entrada no cambia la decisión canónica', () => {
    const a = canonicalDecision(productionPlan(productionInput(base, 12, [])));
    const b = canonicalDecision(productionPlan(productionInput([...base].reverse(), 12, [])));
    expect(b).toBe(a);
  });

  it('las posiciones solo importan por su orden: trasladarlas no cambia las acciones', () => {
    const shifted = base.map((c) =>
      c.lastNegativeAt === null ? c : { ...c, lastNegativeAt: c.lastNegativeAt + 500 },
    );
    expect(comparable(productionPlan(productionInput(shifted, 12, []))).actions).toEqual(
      comparable(productionPlan(productionInput(base, 12, []))).actions,
    );
  });

  it('escalar presupuesto y duraciones por el mismo factor no cambia qué se elige', () => {
    const scaled = base.map((c) => ({
      ...c,
      learnMinutes: c.learnMinutes * 3,
      checkMinutes: c.checkMinutes * 3,
    }));
    const ids = (d: ReturnType<typeof productionPlan>) => d.actions.map((a) => a.conceptId);
    expect(ids(productionPlan(productionInput(scaled, 36, [])))).toEqual(
      ids(productionPlan(productionInput(base, 12, []))),
    );
  });

  it('añadir conceptos con evidencia positiva no cambia el plan', () => {
    const extra = [make(10, FULL_OPTIONS[2]!, true, 2), make(11, FULL_OPTIONS[2]!, true, 2)];
    expect(
      comparable(productionPlan(productionInput([...base, ...extra], 12, []))).actions,
    ).toEqual(comparable(productionPlan(productionInput(base, 12, []))).actions);
  });
});
