import { describe, expect, it } from 'vitest';

import {
  plan,
  type Concept,
  type CoverageOrder,
  type EngineState,
  type Granularity,
  type PlannerInput,
  type RemediationOrder,
} from './model/planner-model';
import { checkSinglePlan, concept, p8NoFalseCompletion } from './model/properties';
import { runTrajectory } from './model/simulate';

/**
 * `modelCheck.spec` · comprobación exhaustiva de espacios de estado pequeños · **gobernanza**.
 *
 * Enumera espacios abstractos completos y ejecuta las propiedades formales sobre cada caso
 * alcanzable. Su valor no está en pasar: está en que **puede fallar**, y en que tres variantes
 * de política quedan falsadas aquí con su contraejemplo mínimo.
 *
 * No afirma nada sobre eficacia pedagógica.
 */

const STATES: EngineState[] = [
  'NEW',
  'EXPOSED',
  'EVIDENCE_POSITIVE',
  'EVIDENCE_NEGATIVE',
  'EVIDENCE_CONFLICTING',
];

const DURATIONS: Array<[number, number]> = [
  [5, 3],
  [8, 2],
  [3, 3],
];

const BUDGETS = [0, 1, 3, 8, 11, 40, 1000];

const GRANULARITIES: Granularity[] = ['ATOMIC', 'CHAINED', 'HYBRID'];
const COVERAGE_ORDERS: CoverageOrder[] = ['EXPOSED_FIRST', 'NEW_FIRST', 'SYLLABUS'];

interface Explored {
  states: number;
  transitions: number;
  violations: string[];
}

/** Enumera todas las combinaciones de estado para `n` conceptos. */
function* stateVectors(n: number): Generator<EngineState[]> {
  const total = STATES.length ** n;
  for (let i = 0; i < total; i += 1) {
    const out: EngineState[] = [];
    let rest = i;
    for (let k = 0; k < n; k += 1) {
      out.push(STATES[rest % STATES.length]!);
      rest = Math.floor(rest / STATES.length);
    }
    yield out;
  }
}

function buildConcepts(states: EngineState[], durations: [number, number]): Concept[] {
  return states.map((state, i) =>
    concept({
      id: `c${i + 1}`,
      syllabus: i + 1,
      state,
      learnMinutes: durations[0],
      checkMinutes: durations[1],
      // La evidencia negativa lleva posición de flujo; sin ella el orden por antigüedad no
      // tendría sobre qué operar. Posiciones distintas por concepto, deterministas.
      lastNegativeAt:
        state === 'EVIDENCE_NEGATIVE' || state === 'EVIDENCE_CONFLICTING' ? (i + 1) * 10 : null,
    }),
  );
}

function exhaustive(
  maxConcepts: number,
  granularities: Granularity[] = GRANULARITIES,
  coverageOrders: CoverageOrder[] = COVERAGE_ORDERS,
): Explored {
  const result: Explored = { states: 0, transitions: 0, violations: [] };
  for (let n = 1; n <= maxConcepts; n += 1) {
    for (const states of stateVectors(n)) {
      for (const durations of DURATIONS) {
        const concepts = buildConcepts(states, durations);
        for (const budget of BUDGETS) {
          for (const granularity of granularities) {
            for (const coverageOrder of coverageOrders) {
              const input: PlannerInput = {
                concepts,
                budget,
                completedToday: [],
                granularity,
                coverageOrder,
              };
              result.states += 1;
              // Cada `checkSinglePlan` ejecuta la decisión varias veces (determinismo, orden de
              // filas, reproducción): esas son las transiciones exploradas.
              result.transitions += 6;
              const violation = checkSinglePlan(input);
              if (violation && result.violations.length < 10) {
                result.violations.push(
                  `${violation} · n=${n} estados=${states.join('/')} presupuesto=${budget} ` +
                    `granularidad=${granularity} cobertura=${coverageOrder}`,
                );
              }
            }
          }
        }
      }
    }
  }
  return result;
}

describe('Phase 4A · comprobación exhaustiva de estados pequeños', () => {
  /** Barrido de variantes: 1..4 conceptos por las tres granularidades y los tres órdenes. */
  const variants = exhaustive(4);
  /**
   * Barrido de la configuración **aceptada** (P4-D3 híbrida, P4-D4 `EXPOSED` primero), más
   * profundo porque ya no hay que cruzar variantes: 1..6 conceptos.
   *
   * Seis es el límite exhaustivo tratable: 5^7 × 21 configuraciones por concepto adicional
   * multiplicaría el espacio por cinco cada vez. Más allá, la cobertura la dan las pruebas
   * metamórficas y la simulación longitudinal, que sí alcanzan sílabos de 100 conceptos.
   */
  const accepted = exhaustive(6, ['HYBRID'], ['EXPOSED_FIRST']);
  const explored = {
    states: variants.states + accepted.states,
    transitions: variants.transitions + accepted.transitions,
    violations: [...variants.violations, ...accepted.violations],
  };

  it('no encuentra ningún contraejemplo de las propiedades formales', () => {
    expect(explored.violations, explored.violations.join('\n')).toEqual([]);
  });

  it('exploró un espacio no trivial, y la configuración aceptada hasta seis conceptos', () => {
    expect(variants.states).toBeGreaterThan(100_000);
    expect(accepted.states).toBeGreaterThan(80_000);
    expect(explored.states).toBeGreaterThan(200_000);
    expect(explored.transitions).toBeGreaterThan(1_000_000);
  });

  it('`NOTHING_ELIGIBLE` solo aparece cuando de verdad no queda nada elegible', () => {
    const all: EngineState[] = ['EVIDENCE_POSITIVE', 'EVIDENCE_POSITIVE'];
    const result = plan({
      concepts: buildConcepts(all, [5, 3]),
      budget: 60,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'SYLLABUS',
    });
    expect(result.outcome).toBe('NOTHING_ELIGIBLE');
    expect(result.actions).toEqual([]);
    expect(result.exclusions.every((e) => e.reason === 'POSITIVE_NO_REVIEW_POLICY')).toBe(true);
  });

  it('`NOTHING_FITS` y `ZERO_TIME` no se confunden', () => {
    const concepts = buildConcepts(['NEW'], [8, 2]);
    const tight = plan({
      concepts,
      budget: 3,
      completedToday: [],
      granularity: 'ATOMIC',
      coverageOrder: 'SYLLABUS',
    });
    expect(tight.outcome).toBe('NOTHING_FITS');
    expect(tight.exclusions.some((e) => e.reason === 'OVER_BUDGET')).toBe(true);

    const zero = plan({
      concepts,
      budget: 0,
      completedToday: [],
      granularity: 'ATOMIC',
      coverageOrder: 'SYLLABUS',
    });
    expect(zero.outcome).toBe('ZERO_TIME');
    expect(zero.actions).toEqual([]);
  });

  it('el motor atrasado no se consume: no se escribe ejecución', () => {
    const result = plan({
      concepts: buildConcepts(['NEW'], [5, 3]),
      budget: 60,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'SYLLABUS',
      engineStale: true,
    });
    expect(result.outcome).toBe('PLAN_UNAVAILABLE_ENGINE');
    expect(result.actions).toEqual([]);
  });
});

describe('Phase 4A · IR-P4A-01 · una recomendación no es ejecución', () => {
  const concepts = buildConcepts(['EVIDENCE_NEGATIVE', 'NEW'], [5, 3]);
  const input: PlannerInput = {
    concepts,
    budget: 30,
    completedToday: [],
    granularity: 'HYBRID',
    coverageOrder: 'SYLLABUS',
  };

  it('planificar sin ejecutar no reduce la presión de la reparación', () => {
    const first = plan(input);
    expect(first.actions[0]?.conceptId).toBe('c1');
    expect(first.actions[0]?.reason).toBe('REMEDIATION_GUARANTEE');

    // La persona cierra la aplicación. No hay evidencia nueva, así que el estado no cambia.
    const second = plan(input);
    expect(second.actions).toEqual(first.actions);
    expect(p8NoFalseCompletion(input, input)).toBeNull();
  });

  it('la necesidad solo se mueve cuando llega evidencia nueva', () => {
    const answered = concepts.map((c) =>
      c.id === 'c1' ? { ...c, state: 'EVIDENCE_POSITIVE' as const, lastNegativeAt: null } : c,
    );
    const after = plan({ ...input, concepts: answered });
    expect(after.actions.every((a) => a.conceptId !== 'c1')).toBe(true);
  });
});

describe('Phase 4A · falsación de las variantes de política', () => {
  /**
   * Orden de reparación. Dos concepts fallidos; la persona falla siempre el que se le ofrece.
   * Con `EVIDENCE_OLDEST`, actuar produce evidencia nueva que empuja el concepto al final y deja
   * pasar al otro. Con las otras dos, el mismo concepto se lleva la ranura para siempre.
   */
  const remediationStarvation = (order: RemediationOrder): number => {
    let concepts = buildConcepts(['EVIDENCE_NEGATIVE', 'EVIDENCE_NEGATIVE'], [5, 3]);
    const served = new Set<string>();
    let stream = 100;
    for (let session = 0; session < 12; session += 1) {
      const result = plan({
        concepts,
        budget: 8,
        completedToday: [],
        granularity: 'ATOMIC',
        coverageOrder: 'SYLLABUS',
        remediationOrder: order,
      });
      for (const action of result.actions) {
        served.add(action.conceptId);
        stream += 1;
        concepts = concepts.map((c) =>
          c.id === action.conceptId ? { ...c, lastNegativeAt: stream } : c,
        );
      }
    }
    return served.size;
  };

  it('`SYLLABUS` dentro de la reparación mata de hambre al segundo concepto', () => {
    expect(remediationStarvation('SYLLABUS')).toBe(1);
  });

  it('`EVIDENCE_NEWEST` también lo mata de hambre', () => {
    expect(remediationStarvation('EVIDENCE_NEWEST')).toBe(1);
  });

  it('`EVIDENCE_OLDEST` sirve a los dos: es la única con vivacidad', () => {
    expect(remediationStarvation('EVIDENCE_OLDEST')).toBe(2);
  });

  /**
   * Granularidad. Con `CHAINED`, una necesidad de reparación no puede progresar: `REAPRENDER`
   * no produce evidencia y no existe estado que represente «reaprendido sin comprobar», así que
   * la siguiente ejecución vuelve a proponer exactamente lo mismo. Es un bucle estructural
   * causado solo por la política de selección (P19).
   */
  it('`CHAINED` crea un bucle estructural en la reparación · contraejemplo mínimo', () => {
    const result = runTrajectory({
      concepts: 1,
      sessions: 6,
      budget: 60,
      behaviour: 'ALWAYS_WRONG',
      granularity: 'CHAINED',
      coverageOrder: 'SYLLABUS',
      seed: 1,
    });
    // El concepto arranca en NEW; con CHAINED aprende, comprueba —falla— y a partir de ahí
    // solo puede REAPRENDER, para siempre.
    expect(result.structuralLoops).toBeGreaterThan(0);
  });

  it('`CHAINED` viola además P26: parte una reparación que no puede partirse', () => {
    const concepts = buildConcepts(['EVIDENCE_NEGATIVE'], [5, 3]);
    const input: PlannerInput = {
      concepts,
      budget: 40,
      completedToday: [],
      granularity: 'CHAINED',
      coverageOrder: 'SYLLABUS',
    };
    const result = plan(input);
    expect(result.actions[0]?.kind).toBe('RELEARN');
    // La acción entera exige 8 minutos; entró con 5 y sin comprobación posible después.
    expect(result.actions[0]?.minutes).toBe(5);
    const hybrid = plan({ ...input, granularity: 'HYBRID' });
    expect(hybrid.actions[0]?.kind).toBe('RELEARN_CHECK');
    expect(hybrid.actions[0]?.minutes).toBe(8);
  });

  it('`ATOMIC` e `HYBRID` no crean bucle estructural', () => {
    for (const granularity of ['ATOMIC', 'HYBRID'] as const) {
      const result = runTrajectory({
        concepts: 1,
        sessions: 6,
        budget: 60,
        behaviour: 'ALWAYS_WRONG',
        granularity,
        coverageOrder: 'SYLLABUS',
        seed: 1,
      });
      expect(result.structuralLoops, granularity).toBe(0);
    }
  });

  it('`ATOMIC` e `HYBRID` no son equivalentes: difieren en presupuestos pequeños', () => {
    const concepts = buildConcepts(['NEW'], [5, 3]);
    const atomic = plan({
      concepts,
      budget: 5,
      completedToday: [],
      granularity: 'ATOMIC',
      coverageOrder: 'SYLLABUS',
    });
    const hybrid = plan({
      concepts,
      budget: 5,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'SYLLABUS',
    });
    expect(atomic.outcome).toBe('NOTHING_FITS');
    expect(hybrid.outcome).toBe('PLANNED');
    expect(hybrid.actions[0]?.kind).toBe('LEARN');
  });

  it('`NEW_FIRST` deja sin verificar un bucle abierto mientras quede material nuevo', () => {
    const concepts = buildConcepts(['EXPOSED', 'NEW', 'NEW'], [5, 3]);
    const newFirst = plan({
      concepts,
      budget: 6,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'NEW_FIRST',
    });
    const exposedFirst = plan({
      concepts,
      budget: 6,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'EXPOSED_FIRST',
    });
    expect(newFirst.actions[0]?.conceptId).toBe('c2');
    expect(exposedFirst.actions[0]?.conceptId).toBe('c1');
  });

  it('`EXPOSED_FIRST` y `SYLLABUS` difieren solo en estados que el Planner no puede crear', () => {
    // Alcanzable únicamente si algo externo expuso un concepto posterior del sílabo: hoy, el
    // vertical congelado del FPS puede hacerlo.
    const concepts = buildConcepts(['NEW', 'EXPOSED'], [5, 3]);
    const exposedFirst = plan({
      concepts,
      budget: 6,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'EXPOSED_FIRST',
    });
    const syllabus = plan({
      concepts,
      budget: 6,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'SYLLABUS',
    });
    expect(exposedFirst.actions[0]?.conceptId).toBe('c2');
    expect(syllabus.actions[0]?.conceptId).toBe('c1');

    // Con el orden natural —lo expuesto es anterior en el sílabo— las dos coinciden.
    const natural = buildConcepts(['EXPOSED', 'NEW'], [5, 3]);
    const a = plan({
      concepts: natural,
      budget: 6,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'EXPOSED_FIRST',
    });
    const b = plan({
      concepts: natural,
      budget: 6,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'SYLLABUS',
    });
    expect(a.actions).toEqual(b.actions);
  });
});

describe('Phase 4A · empaquetado del presupuesto', () => {
  it('se recorre en orden de prioridad y se salta lo que no cabe; no se reordena', () => {
    // Prioridad c1 (8+2=10), c2 (3+3=6), c3 (3+3=6) con presupuesto 12.
    const concepts = [
      concept({ id: 'c1', syllabus: 1, state: 'NEW', learnMinutes: 8, checkMinutes: 2 }),
      concept({ id: 'c2', syllabus: 2, state: 'NEW', learnMinutes: 3, checkMinutes: 3 }),
      concept({ id: 'c3', syllabus: 3, state: 'NEW', learnMinutes: 3, checkMinutes: 3 }),
    ];
    const result = plan({
      concepts,
      budget: 12,
      completedToday: [],
      granularity: 'ATOMIC',
      coverageOrder: 'SYLLABUS',
    });
    // Se toma c1 (10). c2 no cabe (10+6=16 > 12) y se **salta**; c3 tampoco.
    expect(result.actions.map((a) => a.conceptId)).toEqual(['c1']);
    expect(result.minutes).toBe(10);
    // Un optimizador de mochila habría elegido c2+c3 = 12 minutos. No está autorizado: habría
    // descartado la acción de mayor prioridad para llenar minutos.
    expect(result.minutes).toBeLessThan(12);
  });

  it('saltar lo que no cabe deja entrar a un candidato posterior que sí cabe', () => {
    const concepts = [
      concept({ id: 'c1', syllabus: 1, state: 'NEW', learnMinutes: 8, checkMinutes: 2 }),
      concept({ id: 'c2', syllabus: 2, state: 'NEW', learnMinutes: 30, checkMinutes: 5 }),
      concept({ id: 'c3', syllabus: 3, state: 'NEW', learnMinutes: 2, checkMinutes: 2 }),
    ];
    const result = plan({
      concepts,
      budget: 15,
      completedToday: [],
      granularity: 'ATOMIC',
      coverageOrder: 'SYLLABUS',
    });
    expect(result.actions.map((a) => a.conceptId)).toEqual(['c1', 'c3']);
  });
});
