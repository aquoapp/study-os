import { describe, expect, it } from 'vitest';

import {
  DURATION_PROVENANCES,
  EXCLUSION_REASONS,
  assertPlannerInput,
  eligibleActionMinutes,
  plan,
  type PlannerConcept,
  type PlannerInput,
} from '@study-os/planner-engine';

/**
 * `planner.durationAuthority.spec` · P4-D2 · ADR-013 · el motor puro y la duración.
 *
 * Aquí la duración es **un dato de entrada**, que es exactamente lo que el contrato dice que es
 * (§I.3). Por eso esta propiedad se prueba sin base de datos y sin DDL: la condición «una versión
 * publicada no declara duración» es un `null` en la entrada, y no hace falta reproducirla tocando
 * el esquema. El intento de hacerlo en integración desactivando un trigger podía dejarlo
 * desactivado para otras suites, y eso vale menos que lo que prueba.
 *
 * Reparto: la frontera de ingestión **exige** la duración (`learningUnits.lifecycle.spec`), la
 * ejecución de producción declara su **procedencia** (`phase4b.hardGates.spec`), y aquí se
 * comprueba qué hace el motor cuando falta.
 */

const ENGINE = {
  engineVersion: 'engine-v1',
  engineConfigVersion: 'v1',
  attributionPackVersionId: '00000000-0000-4000-8000-000000000001',
  attributionGeneration: 1,
  consumedPosition: 0,
} as const;

function concept(
  id: string,
  sortOrder: number,
  unitMinutes: number | null,
  questionMinutes = 3,
): PlannerConcept {
  return {
    conceptId: id,
    conceptStatus: 'PUBLISHED',
    syllabus: {
      blockSortOrder: 1,
      topicSortOrder: 1,
      conceptSortOrder: sortOrder,
      conceptKey: `c${sortOrder}`,
    },
    // `NEW` · la necesidad es cobertura, y la acción que le corresponde es APRENDER, que exige
    // unidad. Es el caso donde la ausencia de duración se nota.
    masteryState: 'NEW',
    uncertainty: 'NO_EVIDENCE',
    activeErrorPattern: false,
    lastNegativePosition: null,
    completedToday: false,
    units: [
      {
        learningUnitId: `${id}-u`,
        learningUnitVersionId: `${id}-v`,
        sourceExcluded: false,
        minutes: unitMinutes,
      },
    ],
    questions: [
      {
        questionId: `${id}-q`,
        representationId: `${id}-r`,
        sourceExcluded: false,
        answeredToday: false,
        minutes: questionMinutes,
      },
    ],
  };
}

function input(concepts: readonly PlannerConcept[], budget = 60): PlannerInput {
  return {
    plannerVersion: 'planner-v1',
    plannerConfigVersion: 'v2',
    userId: '00000000-0000-4000-8000-0000000000aa',
    goalId: '00000000-0000-4000-8000-0000000000bb',
    packVersionId: '00000000-0000-4000-8000-000000000001',
    planDay: '2026-09-21',
    timezone: 'Europe/Madrid',
    budget: { minutes: budget, source: 'DEFAULT_DAILY' },
    engine: ENGINE,
    durationProvenance: 'HYBRID_V1',
    concepts,
  };
}

describe('el vocabulario de duración es cerrado y está declarado', () => {
  it('admite FIXTURE y HYBRID_V1, y nada aprendido ni adaptativo', () => {
    expect([...DURATION_PROVENANCES]).toEqual(['FIXTURE', 'HYBRID_V1']);
  });

  it('NO_DURATION_METADATA pertenece al enum cerrado de razones', () => {
    expect([...EXCLUSION_REASONS]).toContain('NO_DURATION_METADATA');
  });
});

describe('ADR-013 §2.5 · una versión sin duración se excluye, y no se rellena', () => {
  it('el candidato queda excluido con su razón propia', () => {
    const decision = plan(input([concept('a', 1, null)]));
    const audit = decision.candidates.find((candidate) => candidate.conceptId === 'a');
    expect(audit?.exclusion).toBe('NO_DURATION_METADATA');
    // **No se rellena con nada**: no aparece ninguna acción para ese concepto.
    expect(decision.actions).toHaveLength(0);
  });

  it('la razón es **propia** y no se confunde con NO_PUBLISHED_UNIT', () => {
    // Dos causas distintas: «no hay unidad que leer» y «la unidad no declara cuánto dura».
    // Reutilizar una etiqueta para las dos degradaría la explicabilidad que §R exige.
    const sinUnidad: PlannerConcept = { ...concept('b', 1, 5), units: [] };
    const sinDuracion = concept('c', 2, null);
    const decision = plan(input([sinUnidad, sinDuracion]));
    const byId = new Map(decision.candidates.map((c) => [c.conceptId, c.exclusion]));
    expect(byId.get('b')).toBe('NO_PUBLISHED_UNIT');
    expect(byId.get('c')).toBe('NO_DURATION_METADATA');
  });

  it('la ejecución **continúa** con el resto: §E excluye candidatos, no aborta planes', () => {
    const decision = plan(input([concept('a', 1, null), concept('b', 2, 7)]));
    expect(decision.outcome).toBe('PLANNED');
    expect(decision.actions).toHaveLength(1);
    expect(decision.actions[0]?.conceptId).toBe('b');
    expect(decision.actions[0]?.minutes).toBe(7);
  });

  it('una unidad sin duración no bloquea a otra del mismo concepto que sí la declara', () => {
    // Filtrar por «declara duración» es elegibilidad, igual que filtrar por fuente excluida. No
    // es un respaldo silencioso: no se inventa ningún minuto, se descarta un destino inservible.
    const base = concept('d', 1, 4);
    const conDos: PlannerConcept = {
      ...base,
      units: [
        {
          learningUnitId: 'd-u1',
          learningUnitVersionId: 'd-v1',
          sourceExcluded: false,
          minutes: null,
        },
        {
          learningUnitId: 'd-u2',
          learningUnitVersionId: 'd-v2',
          sourceExcluded: false,
          minutes: 9,
        },
      ],
    };
    const decision = plan(input([conDos]));
    expect(decision.outcome).toBe('PLANNED');
    expect(decision.actions[0]?.minutes).toBe(9);
    expect(decision.actions[0]?.steps[0]).toMatchObject({ learningUnitVersionId: 'd-v2' });
  });

  it('un número presente sigue teniendo que ser minutos válidos', () => {
    const roto: PlannerConcept = {
      ...concept('e', 1, 5),
      units: [
        { learningUnitId: 'e-u', learningUnitVersionId: 'e-v', sourceExcluded: false, minutes: 0 },
      ],
    };
    // La ausencia es dato; un cero o un valor fuera de rango es una entrada inválida, y el motor
    // no «arregla» datos que contradicen a su fuente.
    expect(() => assertPlannerInput(input([roto]))).toThrow(/duración inválida/);
  });
});

describe('P4B-D1 · la estimación de la acción elegible más corta es derivada, no persistida', () => {
  it('eligibleActionMinutes da los minutos de cada candidato elegible', () => {
    const minutes = eligibleActionMinutes(input([concept('a', 1, 4), concept('b', 2, 11)]));
    expect(minutes.get('a')).toBe(4);
    expect(minutes.get('b')).toBe(11);
  });

  it('no incluye a los excluidos, ni siquiera a los que se excluyen por falta de duración', () => {
    const minutes = eligibleActionMinutes(input([concept('a', 1, null), concept('b', 2, 6)]));
    expect(minutes.has('a')).toBe(false);
    expect(minutes.get('b')).toBe(6);
  });

  it('con un presupuesto en el que nada cabe, lo no colocado lleva OVER_BUDGET y su minutaje', () => {
    const entrada = input([concept('a', 1, 8), concept('b', 2, 12)], 1);
    const decision = plan(entrada);
    expect(decision.outcome).toBe('NOTHING_FITS');
    expect(decision.actions).toHaveLength(0);
    const minutes = eligibleActionMinutes(entrada);
    const overBudget = decision.candidates
      .filter((candidate) => candidate.exclusion === 'OVER_BUDGET')
      .map((candidate) => minutes.get(candidate.conceptId))
      .filter((value): value is number => typeof value === 'number');
    expect(overBudget.length).toBe(2);
    // Lo que la interfaz puede decir con verdad: la más corta necesita 8 minutos.
    expect(Math.min(...overBudget)).toBe(8);
  });
});

describe('la decisión serializada no cambia de forma', () => {
  it('`PlanDecision` no gana campos: reproducir una ejecución pasada debe dar el mismo texto', () => {
    // P4-G4 · ampliar la forma de la decisión cambiaría el texto canónico de **toda** ejecución
    // anterior al reproducirla. Por eso la derivación de P4B-D1 vive fuera de ella.
    const decision = plan(input([concept('a', 1, 5)]));
    expect(Object.keys(decision).sort()).toEqual([
      'actions',
      'candidates',
      'outcome',
      'plannedMinutes',
    ]);
  });
});
