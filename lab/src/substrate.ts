/**
 * Arranque del sustrato efímero · CP2.
 *
 * ---------------------------------------------------------------------------
 * Qué hace y qué se niega a hacer
 *
 * Lee del entorno los datos de la instancia efímera, los verifica con la guarda de CP1 y
 * construye la identidad de procedencia de la ejecución. **No levanta ni destruye nada**: eso es
 * del Harness. Aquí solo se decide si el sustrato es admisible.
 *
 * Lo importante es lo que no tiene: no hay rama de reserva, no hay destino alternativo y no hay
 * degradación. Si la instancia efímera no está, el laboratorio no corre. «Caer a STAGING» no es
 * un comportamiento que exista en este código.
 * ---------------------------------------------------------------------------
 */

import { createHash } from 'node:crypto';

import {
  EPHEMERAL_SUBSTRATE,
  LAB_ENV,
  SUBSTRATE_ENV_VAR,
  requireEphemeralSubstrate,
  type EphemeralSubstrate,
  type SubstrateInput,
} from './environment';

/** Identidad de la instancia observada. Viaja al ledger como procedencia. */
export interface SubstrateIdentity {
  readonly kind: typeof EPHEMERAL_SUBSTRATE;
  readonly apiUrl: string;
  readonly databaseHost: string;
  readonly databasePort: string;
  /** Huella de la instancia: distingue dos ejecuciones sin revelar credenciales. */
  readonly fingerprint: string;
  readonly observedAt: string;
}

/**
 * Huella de la instancia.
 *
 * Se calcula sobre la URL y el host/puerto, **nunca sobre las claves**: la procedencia debe poder
 * publicarse en un informe, y un digest de un secreto sigue siendo un derivado de un secreto.
 */
export function substrateIdentity(substrate: EphemeralSubstrate): SubstrateIdentity {
  const db = new URL(substrate.databaseUrl);
  const material = `${substrate.apiUrl}|${db.hostname}|${db.port}`;
  return {
    kind: EPHEMERAL_SUBSTRATE,
    apiUrl: substrate.apiUrl,
    databaseHost: db.hostname,
    databasePort: db.port,
    fingerprint: createHash('sha256').update(material).digest('hex').slice(0, 16),
    observedAt: new Date().toISOString(),
  };
}

export class SubstrateUnavailable extends Error {
  constructor(message: string) {
    super(`sustrato no disponible · ${message}`);
    this.name = 'SubstrateUnavailable';
  }
}

/**
 * Resuelve el sustrato efímero o aborta.
 *
 * Deliberadamente **no** acepta un destino por parámetro: el sustrato se declara en el entorno y
 * se verifica, de modo que ningún llamador pueda pasarle una URL a su gusto.
 */
export function resolveSubstrate(env: SubstrateInput): {
  readonly substrate: EphemeralSubstrate;
  readonly identity: SubstrateIdentity;
} {
  if (env[SUBSTRATE_ENV_VAR] === undefined) {
    throw new SubstrateUnavailable(
      `${SUBSTRATE_ENV_VAR} no está definida. El laboratorio no busca un destino alternativo: ` +
        'sin sustrato declarado no hay ejecución.',
    );
  }
  const substrate = requireEphemeralSubstrate(env);
  return { substrate, identity: substrateIdentity(substrate) };
}

/** Las variables que el Harness debe publicar tras levantar la instancia. */
export const SUBSTRATE_ENV_CONTRACT = [
  SUBSTRATE_ENV_VAR,
  LAB_ENV.apiUrl,
  LAB_ENV.databaseUrl,
  LAB_ENV.anonKey,
  LAB_ENV.privilegedKey,
] as const;
