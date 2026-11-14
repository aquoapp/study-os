import { describe, expect, it } from 'vitest';

import {
  LEDGER_SCHEMA_VERSION,
  LedgerRejection,
  appendEvaluation,
  assertCampaign,
  emptyCampaign,
  type CampaignRecord,
  type StepRecord,
} from '../../lab/src/ledger';
import {
  ObserverNotActive,
  activateObserver,
  createObserver,
  emitSignal,
} from '../../lab/src/observer';
import { InvalidEvaluationRecord, type EvaluationRecord } from '../../lab/src/verdict';

/** Ledger y observador · CP1 · pruebas I y J. */

const PROVENANCE = {
  appCommit: '578b99c',
  engineVersion: 'concept-evidence-1.0.0',
  plannerVersion: 'v2',
  corpusVersion: 'lab-core-0',
  configDigest: 'sha256:0',
  substrateIdentity: 'ephemeral-ci',
};

const STEP: StepRecord = {
  ordinal: 1,
  intent: 'abrir HOY',
  expectedSurface: 'BROWSER',
  actions: [],
  accepted: [],
  observations: [],
  evaluations: [],
  signals: [],
};

describe('I · fundación del ledger', () => {
  it('una campaña vacía lleva versión de esquema y procedencia', () => {
    const campaign = emptyCampaign('camp-1', 'LAB-DF-001', PROVENANCE);
    expect(campaign.schemaVersion).toBe(LEDGER_SCHEMA_VERSION);
    expect(campaign.provenance.substrateIdentity).toBe('ephemeral-ci');
    expect(campaign.scenarios).toEqual([]);
    expect(() => assertCampaign(campaign)).not.toThrow();
  });

  it('una campaña de otra versión de esquema no se acepta en silencio', () => {
    const campaign = {
      ...emptyCampaign('camp-1', 'LAB-DF-001', PROVENANCE),
      schemaVersion: 'lab-ledger-0.9.0',
    } as unknown as CampaignRecord;
    expect(() => assertCampaign(campaign)).toThrow(LedgerRejection);
  });

  it('un veredicto inválido no se persiste', () => {
    const invalido = {
      runValidity: 'VALID',
      coverage: 'EXECUTED',
      contract: 'PASS',
      productFindings: [],
      humanReview: 'PENDING',
      ruleId: null,
      ruleVersion: null,
      completenessEstablished: false,
      negativeAssertion: true,
    } as EvaluationRecord;
    expect(() => appendEvaluation(STEP, invalido)).toThrow(InvalidEvaluationRecord);
    expect(STEP.evaluations).toHaveLength(0);
  });

  it('aceptación sin intento es evidencia fabricada y se rechaza', () => {
    const campaign: CampaignRecord = {
      ...emptyCampaign('camp-2', 'LAB-DF-001', PROVENANCE),
      scenarios: [
        {
          scenarioId: 'sc-1',
          scenarioVersion: '1',
          preregistrationDigest: null,
          steps: [
            {
              ...STEP,
              actions: [],
              accepted: [{ actionId: 'a-1', acceptedRefs: ['e-1'], acceptedDigest: 'd' }],
            },
          ],
        },
      ],
    };
    expect(() => assertCampaign(campaign)).toThrow(/evidencia fabricada/);
  });

  it('acción intentada y aceptada son campos distintos, con digests distintos', () => {
    const step: StepRecord = {
      ...STEP,
      actions: [
        {
          actionId: 'a-1',
          surface: 'BROWSER',
          intent: 'enviar',
          requestFingerprint: 'fp-intento',
          attemptedAt: '2026-11-14T00:00:00Z',
          retryOf: null,
        },
      ],
      accepted: [{ actionId: 'a-1', acceptedRefs: ['evt-9'], acceptedDigest: 'fp-aceptado' }],
    };
    expect(step.actions[0]?.requestFingerprint).not.toBe(step.accepted[0]?.acceptedDigest);
  });
});

describe('J · el Product Observer permanece NOT ACTIVE', () => {
  it('arranca apagado', () => {
    expect(createObserver().state).toBe('NOT_ACTIVE');
  });

  it('apagado no emite: un silencio por apagado no es un silencio por ausencia', () => {
    expect(() => emitSignal(createObserver(), 'OBS-01')).toThrow(ObserverNotActive);
  });

  it('no puede activarse sin pre-registro con umbrales (BD-09 sigue abierta)', () => {
    expect(() =>
      activateObserver(createObserver(), {
        observerVersion: '0.1',
        digest: 'sha256:x',
        registeredAt: '2026-11-14T00:00:00Z',
        thresholds: {},
      }),
    ).toThrow(/umbral/);
  });

  it('ni con versión o digest vacíos', () => {
    expect(() =>
      activateObserver(createObserver(), {
        observerVersion: '',
        digest: '',
        registeredAt: '2026-11-14T00:00:00Z',
        thresholds: { 'OBS-01': 3 },
      }),
    ).toThrow(ObserverNotActive);
  });
});
