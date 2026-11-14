/**
 * Manifiesto de campaña · CP4 · §2.
 *
 * ---------------------------------------------------------------------------------------
 * Se congela **antes** de arrancar y no se toca después
 *
 * El manifiesto fija qué se va a ejecutar y contra qué. Si pudiera editarse a mitad de la
 * ejecución, la campaña podría acabar describiendo lo que pasó en vez de lo que se propuso
 * comprobar, que es exactamente el fallo que el pre-registro evita en el oráculo.
 *
 * Igual que `preregistration.seal()`: congelado en profundidad y con digest propio. Reescribirlo
 * falla; recrearlo cambia el digest y deja rastro.
 *
 * El manifiesto **no contiene credenciales**. La identidad del sustrato entra como huella, no
 * como URL ni como clave: `substrateIdentity()` ya garantiza eso.
 * ---------------------------------------------------------------------------------------
 */

import { createHash, randomUUID } from 'node:crypto';

import { corpusManifest } from './corpus';
import { LEDGER_SCHEMA_VERSION } from './ledger';
import { PROFILE_ID, PROFILE_VERSION, profileManifest } from './profile';
import { SCENARIO_ID, SCENARIO_VERSION, scenarioManifest } from './scenario';
import type { OraclePreregistration } from './preregistration';
import type { SubstrateIdentity } from './substrate';

/** Modo de ejecución. `ephemeral-ci` es el canónico (D-LAB-01). */
export const EXECUTION_MODES = ['ephemeral-ci', 'ephemeral-local'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export class CampaignManifestViolation extends Error {
  constructor(message: string) {
    super(`manifiesto de campaña · ${message}`);
    this.name = 'CampaignManifestViolation';
  }
}

export interface CampaignManifest {
  readonly campaignId: string;
  /** Commit del laboratorio: qué código observó. */
  readonly labBuild: string;
  /** Commit de STUDY OS: qué producto se observó. */
  readonly studyOsBuild: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly profileHash: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly scenarioHash: string;
  readonly corpusId: string;
  readonly corpusVersion: string;
  readonly corpusHash: string;
  readonly preregistrationDigest: string;
  readonly ledgerSchemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly substrateFingerprint: string;
  readonly executionMode: ExecutionMode;
  readonly startedAt: string;
  /** Número de ejecución dentro de la campaña. CP4 autoriza 1 y, condicionada, una repetición. */
  readonly runOrdinal: 1 | 2;
  readonly digest: string;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** Campos que entran en el digest. El `campaignId` entra; el digest no se incluye a sí mismo. */
function digestBody(manifest: Omit<CampaignManifest, 'digest'>): string {
  const {
    campaignId,
    labBuild,
    studyOsBuild,
    profileHash,
    scenarioHash,
    corpusHash,
    preregistrationDigest,
    ledgerSchemaVersion,
    substrateFingerprint,
    executionMode,
    startedAt,
    runOrdinal,
  } = manifest;
  return JSON.stringify({
    campaignId,
    labBuild,
    studyOsBuild,
    profileHash,
    scenarioHash,
    corpusHash,
    preregistrationDigest,
    ledgerSchemaVersion,
    substrateFingerprint,
    executionMode,
    startedAt,
    runOrdinal,
  });
}

export interface CampaignInput {
  readonly labBuild: string;
  readonly studyOsBuild: string;
  readonly identity: SubstrateIdentity;
  readonly preregistration: OraclePreregistration;
  readonly executionMode: ExecutionMode;
  readonly startedAt: string;
  readonly runOrdinal?: 1 | 2;
  /** Solo para repetir una ejecución bajo la misma campaña (§16). */
  readonly campaignId?: string;
}

/**
 * Congela el manifiesto.
 *
 * Exige que el pre-registro que recibe sea el del escenario declarado: un manifiesto que
 * apuntara a otro pre-registro permitiría evaluar con criterios distintos de los sellados.
 */
export function freezeCampaignManifest(input: CampaignInput): CampaignManifest {
  if (input.preregistration.scenarioId !== SCENARIO_ID) {
    throw new CampaignManifestViolation(
      `el pre-registro es de «${input.preregistration.scenarioId}» y el escenario es «${SCENARIO_ID}»`,
    );
  }
  if (input.preregistration.scenarioVersion !== SCENARIO_VERSION) {
    throw new CampaignManifestViolation(
      'el pre-registro no corresponde a la versión declarada del escenario',
    );
  }
  if (!EXECUTION_MODES.includes(input.executionMode)) {
    throw new CampaignManifestViolation(`modo de ejecución no admitido: «${input.executionMode}»`);
  }
  if (!input.labBuild || !input.studyOsBuild) {
    throw new CampaignManifestViolation(
      'sin commit de laboratorio y de producto la ejecución no es reproducible',
    );
  }

  const corpus = corpusManifest();
  const scenario = scenarioManifest();
  const profile = profileManifest();

  const body: Omit<CampaignManifest, 'digest'> = {
    campaignId: input.campaignId ?? `camp-${randomUUID()}`,
    labBuild: input.labBuild,
    studyOsBuild: input.studyOsBuild,
    profileId: PROFILE_ID,
    profileVersion: PROFILE_VERSION,
    profileHash: profile.profileHash,
    scenarioId: scenario.scenarioId,
    scenarioVersion: scenario.scenarioVersion,
    scenarioHash: scenario.scenarioHash,
    corpusId: corpus.corpusId,
    corpusVersion: corpus.corpusVersion,
    corpusHash: corpus.contentHash,
    preregistrationDigest: input.preregistration.digest,
    ledgerSchemaVersion: LEDGER_SCHEMA_VERSION,
    substrateFingerprint: input.identity.fingerprint,
    executionMode: input.executionMode,
    startedAt: input.startedAt,
    runOrdinal: input.runOrdinal ?? 1,
  };

  return deepFreeze({
    ...body,
    digest: createHash('sha256').update(digestBody(body)).digest('hex'),
  });
}

/** Recalcula el digest y lo compara: detecta cualquier reescritura posterior al arranque. */
export function assertManifestUnmodified(manifest: CampaignManifest): void {
  const recomputed = createHash('sha256').update(digestBody(manifest)).digest('hex');
  if (recomputed !== manifest.digest) {
    throw new CampaignManifestViolation(
      'el manifiesto no coincide con su digest: se modificó después de congelarlo',
    );
  }
}

/**
 * Manifiesto de la repetición autorizada (§16).
 *
 * Misma campaña, mismas identidades, `runOrdinal` 2. Cambiar cualquier hash aquí sería otra
 * campaña, no una repetición, y por eso se comprueba en vez de confiarse.
 */
export function repeatRun(first: CampaignManifest, startedAt: string): CampaignManifest {
  if (first.runOrdinal !== 1) {
    throw new CampaignManifestViolation('solo se repite la primera ejecución, y una sola vez');
  }
  const body: Omit<CampaignManifest, 'digest'> = { ...first, startedAt, runOrdinal: 2 };
  const repeated = deepFreeze({
    ...body,
    digest: createHash('sha256').update(digestBody(body)).digest('hex'),
  });
  for (const key of [
    'profileHash',
    'scenarioHash',
    'corpusHash',
    'preregistrationDigest',
  ] as const) {
    if (repeated[key] !== first[key]) {
      throw new CampaignManifestViolation(`la repetición cambió «${key}»: no es la misma campaña`);
    }
  }
  return repeated;
}
