import { describe, expect, it } from 'vitest';

import {
  EXCLUSION_REASONS,
  PlannerInputError,
  canonicalDecision,
  canonicalInput,
  inputHash,
  plan,
  replayFromSnapshot,
  resolveBudget,
  weekdayOf,
  type PlanDecision,
} from '@study-os/planner-engine';

import { concept, input } from '../support/planner-fixtures';

/**
 * `planner.contract.spec` · el paquete puro contra el contrato del Planner v1.4, cláusula a
 * cláusula. Las duraciones son **fixtures** (P4-D2 diferida).
 */

const ids = (decision: PlanDecision) => decision.actions.map((a) => a.conceptId);
const reasonOf = (decision: PlanDecision, id: string) =>
  decision.candidates.find((c) => c.conceptId === id)?.exclusion ?? null;

describe('§I.5 · P4-G22 · empaquetado sin optimización', () => {
  it('presupuesto 12 con acciones 10, 6, 6: planifica la de 10 y deja 2 minutos sin usar', () => {
    const decision = plan(
      input(
        [
          concept({ n: 1, learnMinutes: 10 }),
          concept({ n: 2, learnMinutes: 6 }),
          concept({ n: 3, learnMinutes: 6 }),
        ],
        12,
      ),
    );
    expect(ids(decision)).toEqual(['c-0001']);
    expect(decision.plannedMinutes).toBe(10);
    expect(reasonOf(decision, 'c-0002')).toBe('OVER_BUDGET');
    expect(reasonOf(decision, 'c-0003')).toBe('OVER_BUDGET');
  });

  it('salta lo que no cabe y sigue: un candidato largo no suprime a los siguientes', () => {
    const decision = plan(
      input(
        [
          concept({ n: 1, learnMinutes: 30 }),
          concept({ n: 2, learnMinutes: 5 }),
          concept({ n: 3, learnMinutes: 5 }),
        ],
        12,
      ),
    );
    expect(ids(decision)).toEqual(['c-0002', 'c-0003']);
    expect(reasonOf(decision, 'c-0001')).toBe('OVER_BUDGET');
  });

  it('nunca excede el presupuesto', () => {
    for (let budget = 0; budget <= 60; budget += 1) {
      const decision = plan(
        input(
          [
            concept({ n: 1, state: 'EVIDENCE_NEGATIVE', learnMinutes: 7, checkMinutes: 4 }),
            concept({ n: 2, state: 'EXPOSED', checkMinutes: 9 }),
            concept({ n: 3, learnMinutes: 13 }),
            concept({ n: 4, learnMinutes: 2 }),
          ],
          budget,
        ),
      );
      expect(decision.plannedMinutes).toBeLessThanOrEqual(budget);
    }
  });
});

describe('§G · P4-G20 · composición equilibrada', () => {
  const mixed = [
    concept({ n: 1, state: 'EVIDENCE_NEGATIVE', lastNegative: 40 }),
    concept({ n: 2, state: 'EVIDENCE_CONFLICTING', lastNegative: 12 }),
    concept({ n: 3, state: 'EXPOSED' }),
    concept({ n: 4 }),
  ];

  it('con reparación y continuidad elegibles y presupuesto amplio, exactamente una reparación en la cabeza', () => {
    const decision = plan(input(mixed, 18));
    expect(decision.actions.map((a) => [a.conceptId, a.kind, a.reason])).toEqual([
      ['c-0002', 'RELEARN_CHECK', 'REMEDIATION_GUARANTEE'],
      ['c-0003', 'CHECK', 'COVERAGE'],
      ['c-0004', 'LEARN', 'COVERAGE'],
    ]);
  });

  it('el desbordamiento de reparación solo llega agotada la continuidad', () => {
    const decision = plan(input(mixed, 600));
    expect(decision.actions.map((a) => [a.conceptId, a.reason])).toEqual([
      ['c-0002', 'REMEDIATION_GUARANTEE'],
      ['c-0003', 'COVERAGE'],
      ['c-0004', 'COVERAGE'],
      ['c-0001', 'REMEDIATION_OVERFLOW'],
    ]);
  });

  it('§F.5 · P4-D5 · la evidencia negativa más antigua va primero, no el sílabo', () => {
    const decision = plan(
      input(
        [
          concept({ n: 1, state: 'EVIDENCE_NEGATIVE', lastNegative: 90 }),
          concept({ n: 9, state: 'EVIDENCE_NEGATIVE', lastNegative: 10 }),
        ],
        600,
      ),
    );
    expect(ids(decision)).toEqual(['c-0009', 'c-0001']);
  });

  it('§F.6 · P4-D4 · EXPOSED antes que NEW aunque NEW sea anterior en el sílabo', () => {
    const decision = plan(input([concept({ n: 1 }), concept({ n: 2, state: 'EXPOSED' })], 600));
    expect(ids(decision)).toEqual(['c-0002', 'c-0001']);
  });

  it('§F.2 · P4-D3 · NEW aprende solo; EXPOSED comprueba; reparación es atómica', () => {
    const decision = plan(
      input(
        [
          concept({ n: 1 }),
          concept({ n: 2, state: 'EXPOSED' }),
          concept({ n: 3, state: 'EVIDENCE_NEGATIVE' }),
        ],
        600,
      ),
    );
    const kinds = Object.fromEntries(decision.actions.map((a) => [a.conceptId, a]));
    expect(kinds['c-0001']?.steps.map((s) => s.itemType)).toEqual(['LEARNING_UNIT']);
    expect(kinds['c-0002']?.steps.map((s) => s.itemType)).toEqual(['QUESTION']);
    expect(kinds['c-0003']?.steps.map((s) => s.itemType)).toEqual(['LEARNING_UNIT', 'QUESTION']);
    expect(kinds['c-0003']?.minutes).toBe(8);
  });

  it('la garantía no se cumple por encima del presupuesto: si no cabe, la continuidad sigue', () => {
    const decision = plan(
      input(
        [concept({ n: 1, state: 'EVIDENCE_NEGATIVE', learnMinutes: 30 }), concept({ n: 2 })],
        10,
      ),
    );
    expect(ids(decision)).toEqual(['c-0002']);
    expect(reasonOf(decision, 'c-0001')).toBe('OVER_BUDGET');
  });
});

describe('§E · elegibilidad con razón registrada', () => {
  it('cada exclusión lleva su razón, y ningún candidato desaparece de la auditoría', () => {
    const concepts = [
      concept({ n: 1, status: 'RETIRED' }),
      concept({ n: 2, units: 0, questions: 0 }),
      concept({ n: 3, completedToday: true }),
      concept({ n: 4, state: 'EVIDENCE_POSITIVE' }),
      concept({ n: 5, units: 0 }),
      concept({ n: 6, state: 'EXPOSED', questions: 0 }),
      concept({ n: 7, state: 'EXPOSED', questionSourceExcluded: true }),
      concept({ n: 8, unitSourceExcluded: true }),
      concept({ n: 9, state: 'EXPOSED', answeredToday: true }),
    ];
    const decision = plan(input(concepts, 600));
    expect(decision.candidates).toHaveLength(concepts.length);
    expect(Object.fromEntries(decision.candidates.map((c) => [c.conceptId, c.exclusion]))).toEqual({
      'c-0001': 'TARGET_RETIRED',
      'c-0002': 'NO_ATTRIBUTED_QUESTION',
      'c-0003': 'COMPLETED_TODAY',
      'c-0004': 'POSITIVE_NO_REVIEW_POLICY',
      'c-0005': 'NO_PUBLISHED_UNIT',
      'c-0006': 'NO_ATTRIBUTED_QUESTION',
      'c-0007': 'SOURCE_STATUS_EXCLUDED',
      'c-0008': 'SOURCE_STATUS_EXCLUDED',
      'c-0009': 'COMPLETED_TODAY',
    });
    expect(decision.outcome).toBe('NOTHING_ELIGIBLE');
    for (const c of decision.candidates) {
      if (c.exclusion) expect(EXCLUSION_REASONS).toContain(c.exclusion);
    }
  });

  it('§H · la pregunta elegida es la no respondida hoy de menor id por punto de código', () => {
    const base = concept({ n: 1, state: 'EXPOSED', questions: 3 });
    const decision = plan(
      input(
        [
          {
            ...base,
            questions: [
              { ...base.questions[2]!, questionId: 'q-b' },
              { ...base.questions[0]!, questionId: 'q-a', answeredToday: true },
              { ...base.questions[1]!, questionId: 'q-B' },
            ],
          },
        ],
        600,
      ),
    );
    const step = decision.actions[0]?.steps[0];
    // 'B' (U+0042) < 'b' (U+0062) por punto de código; una colación de locale diría lo contrario.
    expect(step && step.itemType === 'QUESTION' ? step.questionId : null).toBe('q-B');
  });
});

describe('§J · §K · §L · P4-G8 · P4-G19 · estados de agotamiento', () => {
  it('ZERO_TIME: cero ítems y ninguna marca de deuda', () => {
    const decision = plan(input([concept({ n: 1 })], 0));
    expect(decision.outcome).toBe('ZERO_TIME');
    expect(decision.actions).toEqual([]);
    expect(Object.keys(decision)).toEqual(['outcome', 'plannedMinutes', 'actions', 'candidates']);
    // §S · ningún candidato queda sin razón: con cero minutos, lo elegible no cabía.
    expect(reasonOf(decision, 'c-0001')).toBe('OVER_BUDGET');
  });

  it('NOTHING_ELIGIBLE: todo positivo no se recicla y no se fabrica actividad', () => {
    const decision = plan(
      input(
        [
          concept({ n: 1, state: 'EVIDENCE_POSITIVE' }),
          concept({ n: 2, state: 'EVIDENCE_POSITIVE' }),
        ],
        600,
      ),
    );
    expect(decision.outcome).toBe('NOTHING_ELIGIBLE');
    expect(decision.actions).toEqual([]);
    expect(canonicalDecision(decision)).not.toMatch(/READY|MASTER|DONE|COMPLETE_ALL|PERCENT|SCORE/);
  });

  it('NOTHING_FITS: nada por encima del presupuesto y la exclusión OVER_BUDGET queda registrada', () => {
    const decision = plan(input([concept({ n: 1, learnMinutes: 20 })], 10));
    expect(decision.outcome).toBe('NOTHING_FITS');
    expect(decision.actions).toEqual([]);
    expect(reasonOf(decision, 'c-0001')).toBe('OVER_BUDGET');
  });
});

describe('§B · P4-G4 · P4-G5 · determinismo, hash y reproducción', () => {
  const concepts = [
    concept({ n: 3, state: 'EXPOSED' }),
    concept({ n: 1, state: 'EVIDENCE_NEGATIVE', lastNegative: 7 }),
    concept({ n: 2 }),
  ];

  it('el orden de filas no cambia ni el texto canónico ni el hash ni la decisión', async () => {
    const a = input(concepts, 30);
    const b = input([...concepts].reverse(), 30);
    expect(canonicalInput(a)).toBe(canonicalInput(b));
    expect(await inputHash(a)).toBe(await inputHash(b));
    expect(canonicalDecision(plan(a))).toBe(canonicalDecision(plan(b)));
  });

  it('reproducir desde la instantánea canónica da la decisión byte a byte', () => {
    const a = input(concepts, 30);
    expect(replayFromSnapshot(canonicalInput(a))).toBe(canonicalDecision(plan(a)));
  });

  it('planificar dos veces sin evidencia nueva da el mismo plan (P4-G21)', () => {
    const a = input(concepts, 30);
    expect(canonicalDecision(plan(a))).toBe(canonicalDecision(plan(a)));
  });

  it('el hash es SHA-256 hex del texto canónico', async () => {
    expect(await inputHash(input(concepts, 30))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('invariantes de entrada · el Planner no arregla datos que contradicen al motor', () => {
  it('rechaza una reparación sin posición, y una posición fuera de reparación', () => {
    expect(() =>
      plan(input([concept({ n: 1, state: 'EVIDENCE_NEGATIVE', lastNegative: null })], 10)),
    ).toThrow(PlannerInputError);
    expect(() => plan(input([concept({ n: 1, state: 'EXPOSED', lastNegative: 3 })], 10))).toThrow(
      PlannerInputError,
    );
  });

  it('rechaza un patrón activo sin evidencia negativa', () => {
    expect(() =>
      plan(input([concept({ n: 1, state: 'EVIDENCE_POSITIVE', pattern: true })], 10)),
    ).toThrow(PlannerInputError);
  });

  it('rechaza duraciones y presupuestos fuera de rango, y conceptos duplicados', () => {
    expect(() => plan(input([concept({ n: 1, learnMinutes: 0 })], 10))).toThrow(PlannerInputError);
    expect(() => plan(input([concept({ n: 1 })], 601))).toThrow(PlannerInputError);
    expect(() => plan(input([concept({ n: 1 }), concept({ n: 1 })], 10))).toThrow(
      PlannerInputError,
    );
  });

  it('sin zona horaria no hay día de plan', () => {
    expect(() => plan(input([concept({ n: 1 })], 10, { timezone: '' }))).toThrow(PlannerInputError);
  });
});

describe('§I.2 · P4-G1 · P4-G2 · presupuesto', () => {
  const base = { planDay: '2026-09-21', defaultDailyMinutes: 30, weeklyAvailability: {} };

  it('2026-09-21 es lunes', () => {
    expect(weekdayOf('2026-09-21')).toBe('mon');
    expect(weekdayOf('2026-09-27')).toBe('sun');
  });

  it('precedencia: override · entrada del día (incluido 0) · valor por defecto', () => {
    expect(resolveBudget({ ...base, todayOverride: null })).toEqual({
      minutes: 30,
      source: 'DEFAULT_DAILY',
    });
    expect(resolveBudget({ ...base, weeklyAvailability: { mon: 0 }, todayOverride: null })).toEqual(
      { minutes: 0, source: 'WEEKLY_ENTRY' },
    );
    expect(
      resolveBudget({ ...base, weeklyAvailability: { tue: 90 }, todayOverride: null }),
    ).toEqual({ minutes: 30, source: 'DEFAULT_DAILY' });
    expect(resolveBudget({ ...base, weeklyAvailability: { mon: 45 }, todayOverride: 10 })).toEqual({
      minutes: 10,
      source: 'TODAY_OVERRIDE',
    });
  });

  it('el override no toca el valor por defecto: la función no escribe nada', () => {
    const declarations = Object.freeze({
      ...base,
      weeklyAvailability: Object.freeze({ mon: 45 }),
      todayOverride: 10,
    });
    resolveBudget(declarations);
    expect(declarations.defaultDailyMinutes).toBe(30);
  });

  it('rechaza días inexistentes', () => {
    expect(() => weekdayOf('2026-02-30')).toThrow(PlannerInputError);
  });
});

describe('§Y · P4-G12 · sin proxy de readiness en la salida', () => {
  it('la decisión solo lleva posiciones y minutos como números', () => {
    const decision = plan(
      input([concept({ n: 1, state: 'EVIDENCE_NEGATIVE' }), concept({ n: 2 })], 30),
    );
    const text = canonicalDecision(decision);
    expect(text).not.toMatch(/percent|ratio|score|weight|ready|readiness|probab|risk|weak/i);
  });
});
