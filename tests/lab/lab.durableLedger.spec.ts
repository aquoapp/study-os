import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { corpusManifest } from '../../lab/src/corpus';
import { emptyCampaign, type StepRecord } from '../../lab/src/ledger';
import {
  LedgerPersistenceRefused,
  appendAccepted,
  assertNoAnswerKeys,
  assertNoSecrets,
  writeDurableLedger,
  type DurableLedger,
} from '../../lab/src/ledger-store';
import { seal } from '../../lab/src/preregistration';
import { profileManifest } from '../../lab/src/profile';
import { scenarioManifest } from '../../lab/src/scenario';

/** Ledger durable · CP3 · autotests L, M, N. Cierra el punto M parcial de CP2. */

const OUT = join(process.cwd(), 'test-results', 'lab-ledger');

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

function ledgerFixture(): DurableLedger {
  const profile = profileManifest();
  const scenario = scenarioManifest();
  const corpus = corpusManifest();
  const preregistration = seal('2026-11-14T00:00:00Z');
  return {
    ledgerSchemaVersion: 'lab-ledger-1.0.0',
    campaignId: 'camp-cp3',
    runId: 'run-1',
    provenance: {
      studyOsBuild: '8de18e9',
      labBuild: 'cp3',
      substrateFingerprint: 'abcdef0123456789',
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      profileHash: 'p-hash',
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      scenarioHash: scenario.scenarioHash,
      corpusId: corpus.corpusId,
      corpusVersion: corpus.corpusVersion,
      corpusHash: corpus.contentHash,
      preregistrationDigest: preregistration.digest,
    },
    observerState: 'NOT_ACTIVE',
    campaign: emptyCampaign('camp-cp3', 'LAB-DF-001', {
      appCommit: '8de18e9',
      engineVersion: 'concept-evidence-1.0.0',
      plannerVersion: 'v2',
      corpusVersion: corpus.corpusVersion,
      configDigest: 'sha256:0',
      substrateIdentity: 'ephemeral-ci',
    }),
    operationalTimestamps: { startedAt: '2026-11-14T00:00:00Z', writtenAt: '2026-11-14T00:01:00Z' },
    teardown: null,
    artifacts: [{ kind: 'corpus', sha256: corpus.contentHash }],
  };
}

describe('L · el ledger se persiste de forma durable', () => {
  it('se escribe como artefacto del laboratorio, con su propio hash', () => {
    const result = writeDurableLedger(ledgerFixture(), join(OUT, 'run-1.json'));
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.sha256).toHaveLength(64);

    const written = JSON.parse(readFileSync(result.path, 'utf8')) as DurableLedger;
    expect(written.ledgerSchemaVersion).toBe('lab-ledger-1.0.0');
    expect(written.observerState).toBe('NOT_ACTIVE');
    expect(written.provenance.corpusHash).toBe(corpusManifest().contentHash);
  });

  it('registra las identidades que hacen reproducible una ejecución', () => {
    const { provenance } = ledgerFixture();
    for (const key of [
      'studyOsBuild',
      'labBuild',
      'substrateFingerprint',
      'profileId',
      'scenarioHash',
      'corpusHash',
      'preregistrationDigest',
    ] as const) {
      expect(provenance[key]).toBeTruthy();
    }
  });

  it('una versión de esquema desconocida no se escribe', () => {
    const roto = { ...ledgerFixture(), ledgerSchemaVersion: 'otra' } as unknown as DurableLedger;
    expect(() => writeDurableLedger(roto, join(OUT, 'roto.json'))).toThrow(
      LedgerPersistenceRefused,
    );
  });
});

describe('M · el ledger no contiene secretos ni claves de respuesta', () => {
  it('rechaza una cadena de conexión', () => {
    expect(() => assertNoSecrets(JSON.stringify({ db: 'postgresql://u:p@host:5432/db' }))).toThrow(
      LedgerPersistenceRefused,
    );
  });

  it('rechaza una clave de servicio con forma reconocible', () => {
    expect(() => assertNoSecrets(JSON.stringify({ k: 'sb_secret_abc123XYZ' }))).toThrow(
      LedgerPersistenceRefused,
    );
  });

  it('rechaza una clave de respuesta', () => {
    expect(() => assertNoAnswerKeys(JSON.stringify({ correct_option_key: 'B' }))).toThrow(
      /clave de respuesta/,
    );
    expect(() => assertNoAnswerKeys(JSON.stringify({ answerKey: 'B' }))).toThrow(
      LedgerPersistenceRefused,
    );
  });

  it('y no escribe nada cuando lo detecta', () => {
    const contaminado = {
      ...ledgerFixture(),
      artifacts: [{ kind: 'db', sha256: 'postgresql://u:p@127.0.0.1:5432/x' }],
    };
    const path = join(OUT, 'nunca.json');
    expect(() => writeDurableLedger(contaminado, path)).toThrow(LedgerPersistenceRefused);
    expect(() => readFileSync(path, 'utf8')).toThrow();
  });

  it('el ledger real que se escribe pasa ambas comprobaciones', () => {
    const serialized = JSON.stringify(ledgerFixture());
    expect(() => assertNoSecrets(serialized)).not.toThrow();
    expect(() => assertNoAnswerKeys(serialized)).not.toThrow();
  });
});

describe('N · acción intentada ≠ acción aceptada', () => {
  const step: StepRecord = {
    ordinal: 1,
    intent: 'enviar respuesta',
    expectedSurface: 'BROWSER',
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
    accepted: [],
    observations: [],
    evaluations: [],
    signals: [],
  };

  it('una aceptación exige su intento previo', () => {
    expect(() =>
      appendAccepted(step, { actionId: 'fantasma', acceptedRefs: [], acceptedDigest: 'd' }),
    ).toThrow(/evidencia fabricada/);
  });

  it('una aceptación no se reescribe', () => {
    const once = appendAccepted(step, {
      actionId: 'a-1',
      acceptedRefs: ['evt-1'],
      acceptedDigest: 'fp-aceptado',
    });
    expect(once.accepted).toHaveLength(1);
    expect(() =>
      appendAccepted(once, { actionId: 'a-1', acceptedRefs: ['evt-2'], acceptedDigest: 'otro' }),
    ).toThrow(/no se reescribe/);
  });

  it('intento y aceptación llevan digests distintos', () => {
    const once = appendAccepted(step, {
      actionId: 'a-1',
      acceptedRefs: ['evt-1'],
      acceptedDigest: 'fp-aceptado',
    });
    expect(once.actions[0]?.requestFingerprint).not.toBe(once.accepted[0]?.acceptedDigest);
  });
});
