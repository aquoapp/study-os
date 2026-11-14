import { describe, expect, it } from 'vitest';

import { resolveNegativeAssertion } from '../../lab/src/contracts';
import {
  CONTRACT_VERDICT,
  COVERAGE,
  HUMAN_REVIEW,
  InvalidEvaluationRecord,
  PRODUCT_FINDING,
  RUN_VALIDITY,
  assertEvaluationRecord,
  countsTowardContractDenominator,
  type EvaluationRecord,
} from '../../lab/src/verdict';

/**
 * Modelo de veredicto · CP1 · prueba H.
 *
 * El Experimental Design §03.2 define cinco ejes ortogonales y se titula «no mezclar». Estas
 * pruebas fijan el vocabulario exacto y las dos reglas duras: una observación ausente nunca
 * produce PASS, y PASS/FAIL exigen contrato.
 */

const BASE: EvaluationRecord = {
  runValidity: 'VALID',
  coverage: 'EXECUTED',
  contract: 'PASS',
  productFindings: [],
  humanReview: 'PENDING',
  ruleId: 'CTM-01',
  ruleVersion: '1.0',
  completenessEstablished: true,
  negativeAssertion: false,
};

describe('los cinco ejes, sin aplanar', () => {
  it('cada eje conserva exactamente su vocabulario congelado', () => {
    expect([...RUN_VALIDITY]).toEqual(['VALID', 'INVALID_RUN']);
    expect([...COVERAGE]).toEqual(['EXECUTED', 'NOT_EXECUTED', 'BLOCKED', 'NOT_APPLICABLE']);
    expect([...CONTRACT_VERDICT]).toEqual(['PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_APPLICABLE']);
    expect([...PRODUCT_FINDING]).toEqual(['SIGNAL', 'OBSERVATION']);
    expect([...HUMAN_REVIEW]).toEqual([
      'ACCEPTABLE',
      'PRODUCT_WEAKNESS',
      'MORE_EVIDENCE_REQUIRED',
      'GOVERNANCE_REVIEW_REQUIRED',
      'PENDING',
    ]);
  });

  it('NOT_APPLICABLE existe en los ejes 2 y 3, como manda §03.2', () => {
    expect(COVERAGE).toContain('NOT_APPLICABLE');
    expect(CONTRACT_VERDICT).toContain('NOT_APPLICABLE');
  });

  it('un valor de un eje no vale en otro: no se mezclan', () => {
    expect(() => assertEvaluationRecord({ ...BASE, coverage: 'PASS' as never })).toThrow(
      InvalidEvaluationRecord,
    );
    expect(() => assertEvaluationRecord({ ...BASE, contract: 'EXECUTED' as never })).toThrow(
      InvalidEvaluationRecord,
    );
    expect(() => assertEvaluationRecord({ ...BASE, humanReview: 'SIGNAL' as never })).toThrow(
      InvalidEvaluationRecord,
    );
  });

  it('un estado inventado se rechaza', () => {
    expect(() => assertEvaluationRecord({ ...BASE, contract: 'MOSTLY_FINE' as never })).toThrow(
      InvalidEvaluationRecord,
    );
  });

  it('VALID convive con FAIL: un fallo real no invalida el run', () => {
    expect(() =>
      assertEvaluationRecord({ ...BASE, runValidity: 'VALID', contract: 'FAIL' }),
    ).not.toThrow();
  });

  it('PASS convive con SIGNAL: los canales son independientes (DEC-01)', () => {
    expect(() =>
      assertEvaluationRecord({ ...BASE, contract: 'PASS', productFindings: ['SIGNAL'] }),
    ).not.toThrow();
  });
});

describe('las dos reglas duras', () => {
  it('una aserción negativa sin barrera no puede ser PASS', () => {
    expect(() =>
      assertEvaluationRecord({
        ...BASE,
        negativeAssertion: true,
        completenessEstablished: false,
        contract: 'PASS',
      }),
    ).toThrow(/no puede ser PASS/);
  });

  it('con barrera establecida, la misma aserción negativa sí puede ser PASS', () => {
    expect(() =>
      assertEvaluationRecord({
        ...BASE,
        negativeAssertion: true,
        completenessEstablished: true,
        contract: 'PASS',
      }),
    ).not.toThrow();
  });

  it('PASS y FAIL exigen regla contractual; sin contrato, NOT_APPLICABLE', () => {
    for (const verdict of ['PASS', 'FAIL'] as const) {
      expect(() =>
        assertEvaluationRecord({ ...BASE, contract: verdict, ruleId: null, ruleVersion: null }),
      ).toThrow(/exige una regla contractual/);
    }
    expect(() =>
      assertEvaluationRecord({
        ...BASE,
        contract: 'NOT_APPLICABLE',
        ruleId: null,
        ruleVersion: null,
      }),
    ).not.toThrow();
  });

  it('una regla sin versión no es reproducible', () => {
    expect(() => assertEvaluationRecord({ ...BASE, ruleVersion: null })).toThrow(/versión/);
  });
});

describe('denominador de cobertura', () => {
  it('NOT_APPLICABLE queda fuera; INCONCLUSIVE queda dentro', () => {
    expect(countsTowardContractDenominator('NOT_APPLICABLE')).toBe(false);
    expect(countsTowardContractDenominator('INCONCLUSIVE')).toBe(true);
    expect(countsTowardContractDenominator('PASS')).toBe(true);
    expect(countsTowardContractDenominator('FAIL')).toBe(true);
  });
});

describe('puerta de la aserción negativa', () => {
  it('sin completitud, sin pendiente resuelto o con watermark atrasado ⇒ INCONCLUSIVE', () => {
    expect(
      resolveNegativeAssertion({
        completenessEstablished: false,
        pending: false,
        consumedPosition: 10,
        lastAcceptedPosition: 10,
      }),
    ).toBe('INCONCLUSIVE');
    expect(
      resolveNegativeAssertion({
        completenessEstablished: true,
        pending: true,
        consumedPosition: 10,
        lastAcceptedPosition: 10,
      }),
    ).toBe('INCONCLUSIVE');
    expect(
      resolveNegativeAssertion({
        completenessEstablished: true,
        pending: false,
        consumedPosition: 9,
        lastAcceptedPosition: 10,
      }),
    ).toBe('INCONCLUSIVE');
  });

  it('con las tres condiciones, PASS', () => {
    expect(
      resolveNegativeAssertion({
        completenessEstablished: true,
        pending: false,
        consumedPosition: 10,
        lastAcceptedPosition: 10,
      }),
    ).toBe('PASS');
  });
});
