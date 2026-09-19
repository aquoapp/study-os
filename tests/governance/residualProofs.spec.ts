import { describe, expect, it } from 'vitest';

import {
  execute,
  plan,
  type Concept,
  type PlannedAction,
  type PlannerInput,
  type RemediationOrder,
} from './model/planner-model';
import { concept } from './model/properties';

/**
 * `residualProofs.spec` · Gate A · pruebas residuales A y B · **gobernanza, no producción**.
 *
 * La ronda anterior falsó dos rivales del orden de reparación y llamó «derivado» al superviviente.
 * Derrotar a dos rivales no demuestra unicidad. Aquí la familia de políticas se amplía todo lo
 * que se puede formular **sin inventar semántica de ciencia del aprendizaje y sin usar el
 * historial del Planner como señal**, y se comprueba cuáles sobreviven de verdad.
 *
 * Si sobrevive más de una política no equivalente, Gate A **no** puede pasar.
 */

/** Familia completa de órdenes de reparación considerada en la prueba residual A. */
const FAMILY: RemediationOrder[] = [
  'EVIDENCE_OLDEST',
  'FIRST_UNRESOLVED',
  'LAST_CONTACT',
  'EVIDENCE_NEWEST',
  'SYLLABUS',
  'REVERSE_SYLLABUS',
  'IDENTITY',
];

interface LivenessResult {
  readonly served: number;
  readonly sessions: number;
}

/**
 * Vivacidad: dos necesidades de reparación persistentes y una persona que **ejecuta** lo que se
 * le ofrece y vuelve a fallar. ¿Llega el Planner a atender a las dos?
 */
function liveness(order: RemediationOrder, abandonAfterLearn = false): LivenessResult {
  let concepts: Concept[] = [
    concept({
      id: 'c1',
      syllabus: 1,
      state: 'EVIDENCE_NEGATIVE',
      lastNegativeAt: 10,
      firstNegativeAt: 10,
      lastContactAt: 10,
    }),
    concept({
      id: 'c2',
      syllabus: 2,
      state: 'EVIDENCE_NEGATIVE',
      lastNegativeAt: 20,
      firstNegativeAt: 20,
      lastContactAt: 20,
    }),
  ];
  const served = new Set<string>();
  let stream = 100;
  const sessions = 14;

  for (let session = 0; session < sessions; session += 1) {
    const result = plan({
      concepts,
      budget: 8,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'EXPOSED_FIRST',
      remediationOrder: order,
    });
    for (const action of result.actions) {
      served.add(action.conceptId);
      stream += 1;
      const index = concepts.findIndex((c) => c.id === action.conceptId);
      if (index < 0) continue;
      if (abandonAfterLearn) {
        // La persona abre la acción, lee, y se va sin comprobar: hay contacto real y no hay
        // evidencia nueva. Es el estado que separa a `LAST_CONTACT` de `EVIDENCE_OLDEST`.
        const exposure: PlannedAction = { ...action, kind: 'RELEARN' };
        concepts = concepts.map((c, i) => (i === index ? execute(c, exposure, false, stream) : c));
      } else {
        concepts = concepts.map((c, i) => (i === index ? execute(c, action, false, stream) : c));
      }
    }
  }
  return { served: served.size, sessions };
}

describe('Gate A · prueba residual A · orden dentro de la reparación', () => {
  it('cuatro rivales mueren de hambre con ejecución real', () => {
    for (const order of [
      'SYLLABUS',
      'REVERSE_SYLLABUS',
      'IDENTITY',
      'EVIDENCE_NEWEST',
    ] as RemediationOrder[]) {
      expect(liveness(order).served, `${order} debería matar de hambre a uno de los dos`).toBe(1);
    }
  });

  it('`FIRST_UNRESOLVED` también muere de hambre: un fallo nuevo no mueve su clave', () => {
    // Contraejemplo mínimo: c1 falló antes que c2 y sigue fallando. Su «primera negativa sin
    // resolver» no se mueve nunca, así que c2 no llega jamás.
    expect(liveness('FIRST_UNRESOLVED').served).toBe(1);
  });

  it('`EVIDENCE_OLDEST` y `LAST_CONTACT` **ambas** dan vivacidad', () => {
    expect(liveness('EVIDENCE_OLDEST').served).toBe(2);
    expect(liveness('LAST_CONTACT').served).toBe(2);
  });

  /**
   * El hallazgo que detiene Gate A.
   *
   * Las dos supervivientes no son equivalentes. Se separan exactamente cuando hay **contacto sin
   * verificación**: la persona abre la reparación, la lee y se va sin comprobar. Bajo
   * `EVIDENCE_OLDEST` la evidencia negativa no se ha movido y el concepto sigue primero: se le
   * vuelve a ofrecer. Bajo `LAST_CONTACT` el contacto es reciente y cede el turno al siguiente.
   */
  it('`EVIDENCE_OLDEST` y `LAST_CONTACT` divergen ante contacto sin verificación', () => {
    const base: Concept[] = [
      concept({
        id: 'c1',
        syllabus: 1,
        state: 'EVIDENCE_NEGATIVE',
        lastNegativeAt: 10,
        firstNegativeAt: 10,
        // La persona volvió a leerlo hace poco y se fue sin comprobar.
        lastContactAt: 90,
      }),
      concept({
        id: 'c2',
        syllabus: 2,
        state: 'EVIDENCE_NEGATIVE',
        lastNegativeAt: 20,
        firstNegativeAt: 20,
        lastContactAt: 20,
      }),
    ];
    const pick = (order: RemediationOrder) =>
      plan({
        concepts: base,
        budget: 8,
        completedToday: [],
        granularity: 'HYBRID',
        coverageOrder: 'EXPOSED_FIRST',
        remediationOrder: order,
      }).actions[0]?.conceptId;

    expect(pick('EVIDENCE_OLDEST')).toBe('c1');
    expect(pick('LAST_CONTACT')).toBe('c2');
  });

  it('la divergencia es alcanzable de verdad, no un estado artificial', () => {
    // Se llega a ella ejecutando: abandonar tras REAPRENDER deja contacto sin evidencia.
    const abandoned = liveness('LAST_CONTACT', true);
    const insisted = liveness('EVIDENCE_OLDEST', true);
    // Quien abandona siempre rota bajo LAST_CONTACT y se queda en el mismo concepto bajo
    // EVIDENCE_OLDEST. Las dos conductas son defendibles, y por eso hay que elegir.
    expect(abandoned.served).toBe(2);
    expect(insisted.served).toBe(1);
  });

  it('las dos supervivientes cumplen todos los criterios mecánicos exigidos', () => {
    for (const order of ['EVIDENCE_OLDEST', 'LAST_CONTACT'] as RemediationOrder[]) {
      const input: PlannerInput = {
        concepts: [
          concept({ id: 'c1', syllabus: 1, state: 'EVIDENCE_NEGATIVE', lastNegativeAt: 10 }),
          concept({ id: 'c2', syllabus: 2, state: 'EVIDENCE_CONFLICTING', lastNegativeAt: 5 }),
          concept({ id: 'c3', syllabus: 3, state: 'NEW' }),
        ],
        budget: 40,
        completedToday: [],
        granularity: 'HYBRID',
        coverageOrder: 'EXPOSED_FIRST',
        remediationOrder: order,
      };
      // Determinismo.
      expect(JSON.stringify(plan(input))).toBe(JSON.stringify(plan(input)));
      // Invariancia al orden de filas.
      const reversed = plan({ ...input, concepts: [...input.concepts].reverse() });
      expect(reversed.actions).toEqual(plan(input).actions);
      // Sin historial del Planner: replanificar sin ejecutar no cambia nada.
      expect(plan(input).actions).toEqual(plan(input).actions);
    }
  });

  it('las políticas excluidas por autoridad no entran en la familia admisible', () => {
    // Se documentan aquí para que la exclusión sea explícita y no por olvido.
    const excluded = {
      LEAST_RECENTLY_SERVED: 'usaría el historial del Planner como señal · prohibido',
      ROUND_ROBIN_BY_PLANNER_HISTORY: 'ídem',
      ATTEMPT_COUNT: 'recuento derivado del vector de evidencia · contrato del motor §10',
      ERROR_COUNT: 'ídem, y es dominio numérico por proxy',
      RANDOM_SEEDED: 'P4-D1.7 prohíbe la aleatoriedad; la semilla es un parámetro oculto',
    };
    expect(Object.keys(excluded)).toHaveLength(5);
    expect(FAMILY).not.toContain('LEAST_RECENTLY_SERVED' as RemediationOrder);
  });
});

describe('P4-D5 · ACCEPTED · la última evidencia negativa ordena la reparación', () => {
  /**
   * Decisión humana del 2026-09-19. La divergencia de arriba sigue documentada porque explica por
   * qué hubo que decidir; aquí se fija lo decidido y se demuestra que desviarse de ello se ve.
   */
  const abandoned: Concept[] = [
    concept({
      id: 'c1',
      syllabus: 1,
      state: 'EVIDENCE_NEGATIVE',
      lastNegativeAt: 10,
      firstNegativeAt: 10,
      // Se abrió la reparación, se leyó y se abandonó sin comprobar.
      lastContactAt: 90,
    }),
    concept({
      id: 'c2',
      syllabus: 2,
      state: 'EVIDENCE_NEGATIVE',
      lastNegativeAt: 20,
      firstNegativeAt: 20,
      lastContactAt: 20,
    }),
  ];
  const base: PlannerInput = {
    concepts: abandoned,
    budget: 8,
    completedToday: [],
    granularity: 'HYBRID',
    coverageOrder: 'EXPOSED_FIRST',
  };

  it('el orden por defecto del modelo es el aceptado', () => {
    // Sin `remediationOrder` explícito, la decisión es la de P4-D5.
    expect(plan(base).actions[0]?.conceptId).toBe('c1');
    expect(plan(base).actions).toEqual(
      plan({ ...base, remediationOrder: 'EVIDENCE_OLDEST' }).actions,
    );
  });

  it('el contacto sin verificación no rebaja una reparación abierta', () => {
    // c1 se leyó hace poco y no se comprobó: su evidencia negativa sigue siendo la más antigua,
    // y se le vuelve a ofrecer. La presentación no cuenta como progreso.
    expect(plan(base).actions[0]?.conceptId).toBe('c1');
  });

  it('control negativo · usar el último contacto cambia la decisión y se detecta', () => {
    const rejected = plan({ ...base, remediationOrder: 'LAST_CONTACT' });
    expect(rejected.actions[0]?.conceptId).toBe('c2');
    expect(rejected.actions).not.toEqual(plan(base).actions);
  });

  it('la clave aceptada conserva la vivacidad con ejecución real', () => {
    expect(liveness('EVIDENCE_OLDEST').served).toBe(2);
  });
});

describe('Gate A · prueba residual B · empaquetado del presupuesto', () => {
  const candidates = (durations: Array<[string, number, number]>): Concept[] =>
    durations.map(([id, learn, check], i) =>
      concept({ id, syllabus: i + 1, state: 'NEW', learnMinutes: learn, checkMinutes: check }),
    );

  const planWith = (concepts: Concept[], budget: number) =>
    plan({
      concepts,
      budget,
      completedToday: [],
      granularity: 'ATOMIC',
      coverageOrder: 'SYLLABUS',
    });

  it('no se detiene ante el primero que no cabe: eso suprimiría candidatos que sí caben', () => {
    // c1 = 10, c2 = 35, c3 = 4. Presupuesto 15.
    const result = planWith(
      candidates([
        ['c1', 8, 2],
        ['c2', 30, 5],
        ['c3', 2, 2],
      ]),
      15,
    );
    expect(result.actions.map((a) => a.conceptId)).toEqual(['c1', 'c3']);
    // «prefix-stop» habría devuelto solo c1, dejando que la duración de c2 decidiera sobre c3.
  });

  it('no se reordena para llenar minutos: la prioridad manda sobre el relleno', () => {
    // c1 = 10, c2 = 6, c3 = 6. Presupuesto 12.
    const result = planWith(
      candidates([
        ['c1', 8, 2],
        ['c2', 3, 3],
        ['c3', 3, 3],
      ]),
      12,
    );
    expect(result.actions.map((a) => a.conceptId)).toEqual(['c1']);
    expect(result.minutes).toBe(10);
    // Maximizar minutos habría elegido c2 + c3 = 12, descartando la acción más prioritaria.
  });

  it('nunca excede el presupuesto, con duraciones heterogéneas', () => {
    for (const budget of [1, 4, 7, 10, 13, 22, 100]) {
      const result = planWith(
        candidates([
          ['c1', 8, 2],
          ['c2', 3, 3],
          ['c3', 2, 2],
          ['c4', 30, 5],
        ]),
        budget,
      );
      expect(result.minutes).toBeLessThanOrEqual(budget);
    }
  });

  it('el resultado es exactamente el de recorrer la prioridad tomando lo que cabe', () => {
    // Definición independiente de la implementación: si coinciden en todo el espacio pequeño,
    // la política está determinada por los cuatro criterios y no queda grado de libertad.
    const concepts = candidates([
      ['c1', 8, 2],
      ['c2', 3, 3],
      ['c3', 2, 2],
      ['c4', 30, 5],
    ]);
    for (let budget = 0; budget <= 60; budget += 1) {
      const result = planWith(concepts, budget);
      const expected: string[] = [];
      let used = 0;
      for (const c of concepts) {
        const minutes = c.learnMinutes + c.checkMinutes;
        if (used + minutes <= budget) {
          expected.push(c.id);
          used += minutes;
        }
      }
      expect(
        result.actions.map((a) => a.conceptId),
        `presupuesto ${budget}`,
      ).toEqual(expected);
    }
  });
});
