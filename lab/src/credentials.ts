/**
 * Separación de credenciales por proceso · `ACTOR DOES · ORACLE OBSERVES · HARNESS PREPARES`.
 *
 * ---------------------------------------------------------------------------
 * Por qué esto no es higiene, sino la condición de que el laboratorio signifique algo
 *
 * El preflight de bindings demostró que la superficie alcanzable por una cuenta de aprendiz son
 * **dos** funciones; todo lo demás exige rol de servicio. Si el proceso del Actor tuviera a mano
 * una credencial privilegiada, «el actor no pudo hacer X» dejaría de ser una observación sobre
 * el producto para ser una observación sobre nuestra disciplina. Y la disciplina no es evidencia.
 *
 * Por eso aquí no se comprueba que el Actor *no use* el secreto: se construye el entorno del
 * proceso del Actor de modo que **el secreto no esté**. La diferencia entre «no lo usa» y «no lo
 * tiene» es exactamente la diferencia entre creer y comprobar.
 * ---------------------------------------------------------------------------
 */

import type { EphemeralSubstrate } from './environment';

/** Lo único que el Actor necesita: la URL pública y la clave anónima. */
export interface ActorCredentials {
  readonly apiUrl: string;
  readonly anonKey: string;
}

/** El Observador lee; no actúa. Una cadena de solo lectura y nada más. */
export interface ObserverCredentials {
  readonly databaseUrl: string;
}

/** El Harness prepara y destruye. Es el único que toca la clave de servicio. */
export interface HarnessCredentials {
  readonly apiUrl: string;
  readonly serviceRoleKey: string;
  readonly databaseUrl: string;
}

export function actorCredentials(substrate: EphemeralSubstrate): ActorCredentials {
  return { apiUrl: substrate.apiUrl, anonKey: substrate.anonKey };
}

export function observerCredentials(substrate: EphemeralSubstrate): ObserverCredentials {
  return { databaseUrl: substrate.databaseUrl };
}

export function harnessCredentials(substrate: EphemeralSubstrate): HarnessCredentials {
  return {
    apiUrl: substrate.apiUrl,
    serviceRoleKey: substrate.serviceRoleKey,
    databaseUrl: substrate.databaseUrl,
  };
}

/**
 * Variables que **nunca** pueden viajar al proceso del Actor, por nombre.
 *
 * La lista por nombre no basta —de ahí el barrido por valor de `buildActorProcessEnv`—, pero
 * documenta la intención y atrapa el caso evidente.
 */
export const ACTOR_FORBIDDEN_ENV_NAMES = [
  'LAB_SUPABASE_SERVICE_ROLE_KEY',
  'LAB_DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'STAGING_DB_URL',
  'SUPABASE_ACCESS_TOKEN',
] as const;

export class ActorPrivilegeLeak extends Error {
  constructor(message: string) {
    super(`fuga de privilegio hacia el Actor · ${message}`);
    this.name = 'ActorPrivilegeLeak';
  }
}

/**
 * Construye el entorno **completo** del proceso del Actor.
 *
 * Es una lista blanca: se parte de nada y se añade lo imprescindible. Después se barre el
 * resultado **por valor**, no solo por nombre, porque un secreto renombrado sigue siendo el
 * mismo secreto: basta que alguien lo copie a `MI_VARIABLE` para que una comprobación por nombre
 * no vea nada.
 *
 * @param substrate sustrato ya verificado
 * @param inherit variables no sensibles que el proceso necesite (`PATH`, `HOME`, …)
 */
export function buildActorProcessEnv(
  substrate: EphemeralSubstrate,
  inherit: Readonly<Record<string, string | undefined>> = {},
): Record<string, string> {
  const actor = actorCredentials(substrate);

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(inherit)) {
    if (value === undefined) continue;
    if ((ACTOR_FORBIDDEN_ENV_NAMES as readonly string[]).includes(key)) continue;
    result[key] = value;
  }

  result['LAB_SUPABASE_URL'] = actor.apiUrl;
  result['LAB_SUPABASE_ANON_KEY'] = actor.anonKey;

  // Barrido por valor: el secreto no puede estar presente bajo ningún nombre.
  const secrets = [substrate.serviceRoleKey, substrate.databaseUrl].filter(
    (secret): secret is string => typeof secret === 'string' && secret.length > 0,
  );
  for (const [key, value] of Object.entries(result)) {
    for (const secret of secrets) {
      if (value.includes(secret)) {
        throw new ActorPrivilegeLeak(
          `la variable ${key} contiene una credencial privilegiada. El proceso del Actor no ` +
            'puede recibirla ni siquiera sin usarla: lo que se demuestra es ausencia, no desuso.',
        );
      }
    }
  }

  return result;
}
