import { describe, expect, it } from 'vitest';

import {
  CampaignManifestViolation,
  assertManifestUnmodified,
  freezeCampaignManifest,
  repeatRun,
  type CampaignManifest,
} from '../../lab/src/campaign';
import { corpusManifest } from '../../lab/src/corpus';
import { LEDGER_SCHEMA_VERSION } from '../../lab/src/ledger';
import { seal } from '../../lab/src/preregistration';
import { profileManifest } from '../../lab/src/profile';
import { scenarioManifest } from '../../lab/src/scenario';
import type { SubstrateIdentity } from '../../lab/src/substrate';

/** Manifiesto de campaña · CP4 · §2. Se congela antes de arrancar y no se toca después. */

const PREREG = seal('2026-11-14T00:00:00Z');

const IDENTITY: SubstrateIdentity = {
  kind: 'ephemeral-ci',
  apiUrl: 'http://127.0.0.1:54321',
  databaseHost: '127.0.0.1',
  databasePort: '54322',
  fingerprint: '0123456789abcdef',
  observedAt: '2026-11-14T00:00:00Z',
};

function manifest(overrides: Partial<Parameters<typeof freezeCampaignManifest>[0]> = {}) {
  return freezeCampaignManifest({
    labBuild: 'b69266a',
    studyOsBuild: '578b99c',
    identity: IDENTITY,
    preregistration: PREREG,
    executionMode: 'ephemeral-ci',
    startedAt: '2026-11-14T21:00:00Z',
    ...overrides,
  });
}

describe('el manifiesto fija qué se ejecuta y contra qué', () => {
  it('registra las identidades que hacen reproducible la campaña', () => {
    const frozen = manifest();
    expect(frozen.profileHash).toBe(profileManifest().profileHash);
    expect(frozen.scenarioHash).toBe(scenarioManifest().scenarioHash);
    expect(frozen.corpusHash).toBe(corpusManifest().contentHash);
    expect(frozen.preregistrationDigest).toBe(PREREG.digest);
    expect(frozen.ledgerSchemaVersion).toBe(LEDGER_SCHEMA_VERSION);
    expect(frozen.substrateFingerprint).toBe(IDENTITY.fingerprint);
    expect(frozen.digest).toHaveLength(64);
    expect(frozen.runOrdinal).toBe(1);
  });

  it('no contiene credenciales ni URLs del sustrato: solo la huella', () => {
    const serialized = JSON.stringify(manifest());
    expect(serialized).not.toContain('54321');
    expect(serialized).not.toContain('54322');
    expect(serialized).not.toContain('127.0.0.1');
    expect(serialized).toContain(IDENTITY.fingerprint);
  });

  it('está congelado: reescribirlo no surte efecto', () => {
    const frozen = manifest();
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => {
      (frozen as { startedAt: string }).startedAt = 'otro';
    }).toThrow();
  });

  it('una reescritura por otra vía se detecta al recalcular el digest', () => {
    const frozen = manifest();
    expect(() => assertManifestUnmodified(frozen)).not.toThrow();
    const copia = { ...frozen, studyOsBuild: 'otro-commit' } as CampaignManifest;
    expect(() => assertManifestUnmodified(copia)).toThrow(CampaignManifestViolation);
  });
});

describe('el manifiesto se niega a describir una campaña incoherente', () => {
  it('rechaza un pre-registro de otro escenario', () => {
    const ajeno = { ...PREREG, scenarioId: 'SC-OTRO' };
    expect(() => manifest({ preregistration: ajeno })).toThrow(/SC-OTRO/);
  });

  it('rechaza un pre-registro de otra versión del escenario', () => {
    const ajeno = { ...PREREG, scenarioVersion: '9.9.9' };
    expect(() => manifest({ preregistration: ajeno })).toThrow(CampaignManifestViolation);
  });

  it('rechaza un modo de ejecución no declarado', () => {
    expect(() => manifest({ executionMode: 'staging' as unknown as 'ephemeral-ci' })).toThrow(
      /modo de ejecución/,
    );
  });

  it('rechaza una campaña sin commit de producto: no sería reproducible', () => {
    expect(() => manifest({ studyOsBuild: '' })).toThrow(/reproducible/);
  });
});

describe('la repetición autorizada (§16) es la misma campaña, no otra', () => {
  it('conserva campaña e identidades y solo avanza el ordinal y el instante', () => {
    const first = manifest();
    const second = repeatRun(first, '2026-11-14T22:00:00Z');
    expect(second.campaignId).toBe(first.campaignId);
    expect(second.runOrdinal).toBe(2);
    expect(second.startedAt).not.toBe(first.startedAt);
    for (const key of [
      'profileHash',
      'scenarioHash',
      'corpusHash',
      'preregistrationDigest',
      'studyOsBuild',
      'labBuild',
    ] as const) {
      expect(second[key]).toBe(first[key]);
    }
  });

  it('el digest de la repetición es distinto: dos ejecuciones no se confunden', () => {
    const first = manifest();
    expect(repeatRun(first, '2026-11-14T22:00:00Z').digest).not.toBe(first.digest);
  });

  it('no se repite una repetición: CP4 autoriza una sola', () => {
    const second = repeatRun(manifest(), '2026-11-14T22:00:00Z');
    expect(() => repeatRun(second, '2026-11-14T23:00:00Z')).toThrow(/una sola vez/);
  });
});
