import { describe, expect, it } from 'vitest';

import { freezeCampaignManifest } from '../../lab/src/campaign';
import {
  ReportRefused,
  deriveVerdict,
  humanReport,
  machineReport,
  type CampaignOutcome,
  type CampaignVerdict,
} from '../../lab/src/report';
import { seal } from '../../lab/src/preregistration';
import type { ContractSummary, PropertyEvaluation } from '../../lab/src/oracle';
import type { SubstrateIdentity } from '../../lab/src/substrate';

/**
 * Informes · CP4 · §13.
 *
 * Lo que esta suite protege: el informe **no recalcula**. Si lo hiciera habría dos autoridades
 * sobre el mismo hecho, y su discrepancia sería invisible.
 */

const IDENTITY: SubstrateIdentity = {
  kind: 'ephemeral-ci',
  apiUrl: 'http://127.0.0.1:54321',
  databaseHost: '127.0.0.1',
  databasePort: '54322',
  fingerprint: '0123456789abcdef',
  observedAt: '2026-11-14T00:00:00Z',
};

const MANIFEST = freezeCampaignManifest({
  labBuild: '1f02a70',
  studyOsBuild: '578b99c',
  identity: IDENTITY,
  preregistration: seal('2026-11-14T00:00:00Z'),
  executionMode: 'ephemeral-ci',
  startedAt: '2026-11-14T21:00:00Z',
});

function evaluation(
  id: string,
  contract: PropertyEvaluation['record']['contract'],
): PropertyEvaluation {
  return {
    propertyId: id,
    rationale: 'motivo de prueba',
    record: {
      runValidity: 'VALID',
      coverage: contract === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'EXECUTED',
      contract,
      productFindings: [],
      humanReview: contract === 'FAIL' ? 'GOVERNANCE_REVIEW_REQUIRED' : 'PENDING',
      ruleId: id,
      ruleVersion: '1.0.0',
      completenessEstablished: true,
      negativeAssertion: false,
    },
  };
}

function summaryOf(evaluations: readonly PropertyEvaluation[]): ContractSummary {
  const count = (verdict: string) =>
    evaluations.filter((item) => item.record.contract === verdict).length;
  const pass = count('PASS');
  const fail = count('FAIL');
  const inconclusive = count('INCONCLUSIVE');
  return {
    pass,
    fail,
    inconclusive,
    notApplicable: count('NOT_APPLICABLE'),
    denominator: pass + fail + inconclusive,
  };
}

function outcomeOf(
  evaluations: readonly PropertyEvaluation[],
  overrides: Partial<CampaignOutcome> = {},
): CampaignOutcome {
  const summary = summaryOf(evaluations);
  return {
    manifest: MANIFEST,
    runValidity: 'VALID',
    verdict: deriveVerdict({ runValidity: 'VALID', summary }),
    evaluations,
    summary,
    abortReason: null,
    notes: [],
    teardownVerified: true,
    observationComplete: true,
    scenarioCompleted: true,
    ledgerPath: 'test-results/lab-campaign/run-1.json',
    ledgerSha256: 'a'.repeat(64),
    ...overrides,
  };
}

describe('el veredicto global se deriva de hechos, en un solo sitio', () => {
  it('la invalidez manda sobre todo lo demás', () => {
    const summary = summaryOf([evaluation('P-01', 'PASS')]);
    expect(deriveVerdict({ runValidity: 'INVALID_RUN', summary })).toBe('INVALID_RUN');
  });

  it('un FAIL manda sobre la cobertura', () => {
    const summary = summaryOf([evaluation('P-01', 'PASS'), evaluation('P-02', 'FAIL')]);
    expect(deriveVerdict({ runValidity: 'VALID', summary })).toBe('VALID_CONTRACT_FAILURES');
  });

  it('un INCONCLUSIVE impide declarar PASS', () => {
    const summary = summaryOf([evaluation('P-01', 'PASS'), evaluation('P-02', 'INCONCLUSIVE')]);
    expect(deriveVerdict({ runValidity: 'VALID', summary })).toBe('VALID_INCONCLUSIVE');
  });

  it('una ejecución sin ninguna propiedad evaluada NO es un PASS', () => {
    const summary = summaryOf([evaluation('P-07', 'NOT_APPLICABLE')]);
    expect(deriveVerdict({ runValidity: 'VALID', summary })).toBe('VALID_INCONCLUSIVE');
  });

  it('solo con al menos un PASS y sin FAIL ni INCONCLUSIVE se declara PASS', () => {
    const summary = summaryOf([evaluation('P-01', 'PASS'), evaluation('P-07', 'NOT_APPLICABLE')]);
    expect(deriveVerdict({ runValidity: 'VALID', summary })).toBe('VALID_PASS');
  });
});

describe('el informe redacta lo que recibe', () => {
  it('el informe de máquina conserva cada veredicto sin recalcularlo', () => {
    const evaluations = [evaluation('P-01', 'PASS'), evaluation('P-06', 'FAIL')];
    const parsed = JSON.parse(machineReport(outcomeOf(evaluations))) as {
      contract: { properties: Array<{ propertyId: string; contract: string }>; fail: number };
      run: { verdict: string };
    };
    expect(parsed.contract.properties.map((p) => p.contract)).toEqual(['PASS', 'FAIL']);
    expect(parsed.contract.fail).toBe(1);
    expect(parsed.run.verdict).toBe('VALID_CONTRACT_FAILURES');
  });

  it('no inventa un veredicto cuando el que recibe no es admisible', () => {
    const outcome = outcomeOf([evaluation('P-01', 'PASS')], {
      verdict: 'CASI_PASS' as unknown as CampaignVerdict,
    });
    expect(() => machineReport(outcome)).toThrow(ReportRefused);
  });

  it('registra las identidades que hacen citable el resultado', () => {
    const report = machineReport(outcomeOf([evaluation('P-01', 'PASS')]));
    for (const token of [
      MANIFEST.digest,
      MANIFEST.corpusHash,
      MANIFEST.preregistrationDigest,
      MANIFEST.substrateFingerprint,
    ]) {
      expect(report).toContain(token);
    }
  });

  it('no filtra credenciales ni URLs del sustrato', () => {
    const report = machineReport(outcomeOf([evaluation('P-01', 'PASS')]));
    expect(report).not.toContain('54321');
    expect(report).not.toContain('127.0.0.1');
  });
});

describe('el informe humano dice lo mismo, sin un número nuevo', () => {
  it('declara el veredicto, el denominador y cada propiedad', () => {
    const evaluations = [
      evaluation('P-01', 'PASS'),
      evaluation('P-02', 'INCONCLUSIVE'),
      evaluation('P-07', 'NOT_APPLICABLE'),
    ];
    const report = humanReport(outcomeOf(evaluations));
    expect(report).toContain('inconcluyente');
    expect(report).toContain('Denominador contractual: 2');
    for (const id of ['P-01', 'P-02', 'P-07']) expect(report).toContain(id);
  });

  it('deja constancia de que el Observador sigue NOT_ACTIVE', () => {
    const report = humanReport(outcomeOf([evaluation('P-01', 'PASS')], { notes: ['una nota'] }));
    expect(report).toContain('NOT_ACTIVE');
    expect(report).toContain('no son evaluativas');
    expect(report).toContain('- una nota');
  });

  it('no afirma nada sobre eficacia pedagógica, y lo dice', () => {
    const report = humanReport(outcomeOf([evaluation('P-01', 'PASS')]));
    expect(report).toContain('no afirma nada sobre eficacia pedagógica');
  });

  it('cuando hubo aborto, el aborto aparece', () => {
    const report = humanReport(
      outcomeOf([evaluation('P-01', 'INCONCLUSIVE')], {
        runValidity: 'INVALID_RUN',
        verdict: 'INVALID_RUN',
        abortReason: 'el corpus instalado no coincide con su contentHash',
        scenarioCompleted: false,
      }),
    );
    expect(report).toContain('Ejecución inválida');
    expect(report).toContain('contentHash');
    expect(report).toContain('escenario completado: no');
  });
});
