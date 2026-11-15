import { describe, expect, it } from 'vitest';

import {
  OracleRefused,
  evaluate,
  summarize,
  type EvidenceSnapshot,
  type PropertyEvaluation,
} from '../../lab/src/oracle';
import { seal } from '../../lab/src/preregistration';
import { CONTRACT_PROPERTIES } from '../../lab/src/scenario';

/**
 * Contract Oracle · CP4.
 *
 * El oráculo se prueba por su **capacidad de no aprobar**. Un oráculo que siempre devuelve PASS
 * pasaría cualquier campaña, así que cada propiedad se somete a un mundo que la cumple y a otro
 * que la rompe, y además a un mundo donde no se pudo observar lo necesario.
 */

const PREREG = seal('2026-11-14T00:00:00Z');

/** Mundo sano mínimo: un ítem, un envío, un intento, proyección al día. */
function healthy(): EvidenceSnapshot {
  return {
    subjectRef: 'sujeto-1',
    events: [
      { streamPosition: 1, eventType: 'SESSION_STARTED', sessionItemId: null },
      { streamPosition: 2, eventType: 'ANSWER_SUBMITTED', sessionItemId: 'item-1' },
    ],
    attempts: [
      {
        sessionItemId: 'item-1',
        questionId: 'q-1',
        questionRepresentationId: 'rep-1',
        submittedEventId: 'evt-2',
        answerKind: 'OPTION',
        selectedOptionKey: 'A',
        isCorrectAtSubmission: true,
        confidenceValue: 3,
        confidenceScaleVersion: 'v1',
        attemptNumber: 1,
        serverCorrectOptionKey: 'A',
      },
    ],
    presentedItems: [
      {
        sessionItemId: 'item-1',
        itemType: 'QUESTION',
        presentedRepresentationId: 'rep-1',
        presentedLearningUnitVersionId: null,
        status: 'COMPLETED',
      },
    ],
    barrier: { maxPosition: 2, consumedPosition: 2, pending: false },
    planner: {
      plannedConceptKeys: ['c1'],
      exclusions: [{ conceptKey: 'c4', reason: 'NO_PUBLISHED_UNIT' }],
    },
    actor: {
      confidenceByItem: new Map([['item-1', 3]]),
      presentedRepresentationByItem: new Map([['item-1', 'rep-1']]),
      abandonedWithoutSubmit: ['item-9'],
      answerKeyVisibleBeforeSubmit: false,
      submitsByItem: new Map([['item-1', 1]]),
    },
    structuralScarcityConcepts: ['c4'],
    observationComplete: true,
  };
}

function verdictOf(evaluations: readonly PropertyEvaluation[], id: string): string {
  const found = evaluations.find((evaluation) => evaluation.propertyId === id);
  if (!found) throw new Error(`no se evaluó ${id}`);
  return found.record.contract;
}

describe('el oráculo evalúa exactamente el pre-registro', () => {
  it('emite un veredicto por criterio sellado, en su orden', () => {
    const evaluations = evaluate(healthy(), PREREG);
    expect(evaluations).toHaveLength(PREREG.criteria.length);
    expect(evaluations.map((evaluation) => evaluation.propertyId)).toEqual(
      PREREG.criteria.map((criterion) => criterion.propertyId),
    );
  });

  it('no evalúa una propiedad que nadie pre-registró', () => {
    const inventada = {
      ...PREREG,
      criteria: [...PREREG.criteria, { ...PREREG.criteria[0]!, propertyId: 'P-99' }],
    };
    expect(() => evaluate(healthy(), inventada)).toThrow(OracleRefused);
  });

  it('un pre-registro vacío no produce una campaña aprobada: se rechaza', () => {
    expect(() => evaluate(healthy(), { ...PREREG, criteria: [] })).toThrow(OracleRefused);
  });

  it('todo veredicto lleva regla y versión', () => {
    for (const evaluation of evaluate(healthy(), PREREG)) {
      expect(evaluation.record.ruleId).toBe(evaluation.propertyId);
      expect(evaluation.record.ruleVersion).toBeTruthy();
    }
  });
});

describe('P-01 · contigüidad del stream', () => {
  it('PASS con posiciones contiguas desde 1', () => {
    expect(verdictOf(evaluate(healthy(), PREREG), 'P-01')).toBe('PASS');
  });

  it('FAIL con un hueco', () => {
    const roto = {
      ...healthy(),
      events: [
        { streamPosition: 1, eventType: 'A', sessionItemId: null },
        { streamPosition: 3, eventType: 'B', sessionItemId: null },
      ],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-01')).toBe('FAIL');
  });

  it('FAIL con un duplicado', () => {
    const roto = {
      ...healthy(),
      events: [
        { streamPosition: 1, eventType: 'A', sessionItemId: null },
        { streamPosition: 1, eventType: 'B', sessionItemId: null },
      ],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-01')).toBe('FAIL');
  });

  it('FAIL si no empieza en 1: un stream que arranca en 5 perdió sus primeras posiciones', () => {
    const roto = {
      ...healthy(),
      events: [{ streamPosition: 5, eventType: 'A', sessionItemId: null }],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-01')).toBe('FAIL');
  });

  it('INCONCLUSIVE sin eventos: no hay stream del que afirmar nada', () => {
    expect(verdictOf(evaluate({ ...healthy(), events: [] }, PREREG), 'P-01')).toBe('INCONCLUSIVE');
  });
});

describe('P-02 · un intento aceptado por envío', () => {
  it('FAIL si dos intentos comparten el evento de envío', () => {
    const base = healthy();
    const roto = {
      ...base,
      attempts: [base.attempts[0]!, { ...base.attempts[0]!, attemptNumber: 2 }],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-02')).toBe('FAIL');
  });

  it('FAIL si el producto aceptó más intentos que envíos hizo el Actor', () => {
    const base = healthy();
    const roto = {
      ...base,
      attempts: [
        base.attempts[0]!,
        { ...base.attempts[0]!, submittedEventId: 'evt-3', attemptNumber: 2 },
      ],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-02')).toBe('FAIL');
  });

  it('INCONCLUSIVE si hay intento aceptado sin envío registrado por el Actor', () => {
    const base = healthy();
    const roto = { ...base, actor: { ...base.actor, submitsByItem: new Map<string, number>() } };
    expect(verdictOf(evaluate(roto, PREREG), 'P-02')).toBe('INCONCLUSIVE');
  });
});

describe('P-03 · la representación evaluada es la presentada', () => {
  it('FAIL si el intento evalúa otra representación', () => {
    const base = healthy();
    const roto = {
      ...base,
      attempts: [{ ...base.attempts[0]!, questionRepresentationId: 'rep-otra' }],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-03')).toBe('FAIL');
  });

  it('FAIL si el Actor vio una representación distinta de la registrada', () => {
    const base = healthy();
    const roto = {
      ...base,
      actor: {
        ...base.actor,
        presentedRepresentationByItem: new Map([['item-1', 'rep-vista-distinta']]),
      },
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-03')).toBe('FAIL');
  });

  it('INCONCLUSIVE si el ítem no registró qué presentó', () => {
    const base = healthy();
    const roto = {
      ...base,
      presentedItems: [{ ...base.presentedItems[0]!, presentedRepresentationId: null }],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-03')).toBe('INCONCLUSIVE');
  });
});

describe('P-04 · la confianza se registra antes del envío y se conserva', () => {
  it('FAIL si se aceptó sin confianza', () => {
    const base = healthy();
    const roto = {
      ...base,
      attempts: [{ ...base.attempts[0]!, confidenceValue: null, confidenceScaleVersion: null }],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-04')).toBe('FAIL');
  });

  it('FAIL si la confianza guardada no es la declarada', () => {
    const base = healthy();
    const roto = { ...base, attempts: [{ ...base.attempts[0]!, confidenceValue: 1 }] };
    expect(verdictOf(evaluate(roto, PREREG), 'P-04')).toBe('FAIL');
  });

  it('FAIL si falta la versión de escala: una confianza sin escala no es interpretable', () => {
    const base = healthy();
    const roto = { ...base, attempts: [{ ...base.attempts[0]!, confidenceScaleVersion: null }] };
    expect(verdictOf(evaluate(roto, PREREG), 'P-04')).toBe('FAIL');
  });
});

describe('P-05 · la corrección la fija el servidor', () => {
  it('FAIL si el Actor pudo ver la clave antes de enviar', () => {
    const base = healthy();
    const roto = { ...base, actor: { ...base.actor, answerKeyVisibleBeforeSubmit: true } };
    expect(verdictOf(evaluate(roto, PREREG), 'P-05')).toBe('FAIL');
  });

  it('FAIL si la corrección guardada no concuerda con la clave del servidor', () => {
    const base = healthy();
    const roto = {
      ...base,
      attempts: [{ ...base.attempts[0]!, serverCorrectOptionKey: 'B' }],
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-05')).toBe('FAIL');
  });

  it('PASS cuando concuerda y el cliente no tuvo la clave', () => {
    expect(verdictOf(evaluate(healthy(), PREREG), 'P-05')).toBe('PASS');
  });

  it('INCONCLUSIVE si la clave del servidor no se pudo leer: no es un incumplimiento', () => {
    const base = healthy();
    const roto = { ...base, attempts: [{ ...base.attempts[0]!, serverCorrectOptionKey: '' }] };
    expect(verdictOf(evaluate(roto, PREREG), 'P-05')).toBe('INCONCLUSIVE');
  });
});

describe('P-06 · la proyección alcanza la última posición aceptada', () => {
  it('FAIL si la proyección se quedó atrás', () => {
    const roto = { ...healthy(), barrier: { maxPosition: 7, consumedPosition: 4, pending: false } };
    expect(verdictOf(evaluate(roto, PREREG), 'P-06')).toBe('FAIL');
  });

  it('INCONCLUSIVE si la barrera no se pudo leer', () => {
    const roto = {
      ...healthy(),
      barrier: { maxPosition: null, consumedPosition: null, pending: null },
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-06')).toBe('INCONCLUSIVE');
  });
});

describe('P-07 · aserción negativa: abandonar sin enviar no crea evidencia', () => {
  it('PASS solo con barrera establecida', () => {
    expect(verdictOf(evaluate(healthy(), PREREG), 'P-07')).toBe('PASS');
  });

  it('INCONCLUSIVE si la barrera no quedó establecida, aunque no se viera evidencia', () => {
    const roto = { ...healthy(), barrier: { maxPosition: 2, consumedPosition: 1, pending: true } };
    expect(verdictOf(evaluate(roto, PREREG), 'P-07')).toBe('INCONCLUSIVE');
  });

  it('INCONCLUSIVE si alguna lectura del Observador falló', () => {
    expect(verdictOf(evaluate({ ...healthy(), observationComplete: false }, PREREG), 'P-07')).toBe(
      'INCONCLUSIVE',
    );
  });

  it('FAIL si un ítem abandonado dejó evidencia aceptada', () => {
    const base = healthy();
    const roto = {
      ...base,
      actor: { ...base.actor, abandonedWithoutSubmit: ['item-1'] },
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-07')).toBe('FAIL');
  });

  it('NOT_APPLICABLE si el escenario no abandonó ninguna pantalla', () => {
    const base = healthy();
    const sin = { ...base, actor: { ...base.actor, abandonedWithoutSubmit: [] } };
    expect(verdictOf(evaluate(sin, PREREG), 'P-07')).toBe('NOT_APPLICABLE');
  });

  it('y NOT_APPLICABLE no puede disfrazarse de PASS: su cobertura es NOT_APPLICABLE', () => {
    const base = healthy();
    const sin = { ...base, actor: { ...base.actor, abandonedWithoutSubmit: [] } };
    const record = evaluate(sin, PREREG).find((e) => e.propertyId === 'P-07')!.record;
    expect(record.contract).toBe('NOT_APPLICABLE');
    expect(record.coverage).toBe('NOT_APPLICABLE');
  });
});

describe('P-08 · escasez de contenido, no de capacidad', () => {
  it('PASS si el concepto sin unidad se excluyó como NO_PUBLISHED_UNIT', () => {
    expect(verdictOf(evaluate(healthy(), PREREG), 'P-08')).toBe('PASS');
  });

  it('FAIL si se planificó un concepto sin unidad publicada', () => {
    const base = healthy();
    const roto = { ...base, planner: { ...base.planner, plannedConceptKeys: ['c1', 'c4'] } };
    expect(verdictOf(evaluate(roto, PREREG), 'P-08')).toBe('FAIL');
  });

  it('FAIL si se excluyó por una razón que no es escasez de contenido', () => {
    const base = healthy();
    const roto = {
      ...base,
      planner: { ...base.planner, exclusions: [{ conceptKey: 'c4', reason: 'COMPLETED_TODAY' }] },
    };
    expect(verdictOf(evaluate(roto, PREREG), 'P-08')).toBe('FAIL');
  });

  it('INCONCLUSIVE si no se observó ninguna razón de exclusión', () => {
    const base = healthy();
    const roto = { ...base, planner: { ...base.planner, exclusions: [] } };
    expect(verdictOf(evaluate(roto, PREREG), 'P-08')).toBe('INCONCLUSIVE');
  });
});

describe('un FAIL real no invalida el run (§03.2)', () => {
  it('el eje 1 sigue siendo VALID aunque el eje 3 sea FAIL', () => {
    const roto = { ...healthy(), barrier: { maxPosition: 9, consumedPosition: 1, pending: false } };
    const record = evaluate(roto, PREREG).find((e) => e.propertyId === 'P-06')!.record;
    expect(record.contract).toBe('FAIL');
    expect(record.runValidity).toBe('VALID');
    expect(record.humanReview).toBe('GOVERNANCE_REVIEW_REQUIRED');
  });
});

describe('el denominador contractual', () => {
  it('excluye NOT_APPLICABLE e incluye INCONCLUSIVE', () => {
    const base = healthy();
    const mundo = {
      ...base,
      events: [],
      actor: { ...base.actor, abandonedWithoutSubmit: [] },
    };
    const summary = summarize(evaluate(mundo, PREREG));
    expect(summary.denominator).toBe(summary.pass + summary.fail + summary.inconclusive);
    expect(summary.denominator).toBe(CONTRACT_PROPERTIES.length - summary.notApplicable);
  });

  it('un mundo sano no deja ningún FAIL', () => {
    const summary = summarize(evaluate(healthy(), PREREG));
    expect(summary.fail).toBe(0);
    expect(summary.pass).toBeGreaterThan(0);
  });
});
