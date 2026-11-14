import { describe, expect, it } from 'vitest';

import {
  ACTOR_FORBIDDEN_ENV_NAMES,
  ActorPrivilegeLeak,
  actorCredentials,
  buildActorProcessEnv,
  harnessCredentials,
  observerCredentials,
} from '../../lab/src/credentials';
import type { EphemeralSubstrate } from '../../lab/src/environment';

/**
 * Fronteras de confianza · CP1 · pruebas A, B, G.
 *
 * Lo que se demuestra aquí es **ausencia**, no desuso: el entorno que recibiría el proceso del
 * Actor se inspecciona entero, por valor, y el secreto no puede estar bajo ningún nombre.
 */

const SUBSTRATE: EphemeralSubstrate = {
  apiUrl: 'http://127.0.0.1:54321',
  anonKey: 'anon-local',
  serviceRoleKey: 'SECRETO-DE-SERVICIO',
  databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
};

describe('ACTOR DOES · ORACLE OBSERVES · HARNESS PREPARES', () => {
  it('A · las credenciales del Actor no contienen nada privilegiado', () => {
    const actor = actorCredentials(SUBSTRATE);
    const serialized = JSON.stringify(actor);
    expect(serialized).not.toContain(SUBSTRATE.serviceRoleKey);
    expect(serialized).not.toContain(SUBSTRATE.databaseUrl);
    expect(Object.keys(actor).sort()).toEqual(['anonKey', 'apiUrl']);
  });

  it('B · el Actor no recibe ninguna cadena SQL, ni siquiera inservible', () => {
    const env = buildActorProcessEnv(SUBSTRATE, { PATH: '/usr/bin' });
    for (const value of Object.values(env)) {
      expect(value).not.toContain('postgresql://');
      expect(value).not.toContain('54322');
    }
  });

  it('A · el entorno del proceso del Actor no contiene el secreto bajo ningún nombre', () => {
    const env = buildActorProcessEnv(SUBSTRATE, {
      PATH: '/usr/bin',
      HOME: '/home/lab',
      LAB_SUPABASE_SERVICE_ROLE_KEY: SUBSTRATE.serviceRoleKey,
      LAB_DATABASE_URL: SUBSTRATE.databaseUrl,
    });
    expect(Object.values(env).join('\u0000')).not.toContain(SUBSTRATE.serviceRoleKey);
    for (const forbidden of ACTOR_FORBIDDEN_ENV_NAMES) {
      expect(env).not.toHaveProperty(forbidden);
    }
    expect(env['PATH']).toBe('/usr/bin');
  });

  it('un secreto renombrado también se detecta: la comprobación es por valor', () => {
    expect(() =>
      buildActorProcessEnv(SUBSTRATE, { MI_VARIABLE_INOCENTE: SUBSTRATE.serviceRoleKey }),
    ).toThrow(ActorPrivilegeLeak);
  });

  it('una cadena que embebe la conexión dentro de otra cosa también se detecta', () => {
    expect(() =>
      buildActorProcessEnv(SUBSTRATE, { CONFIG_JSON: `{"db":"${SUBSTRATE.databaseUrl}"}` }),
    ).toThrow(ActorPrivilegeLeak);
  });

  it('G · Observer y Harness están separados y tienen lo justo', () => {
    const observer = observerCredentials(SUBSTRATE);
    const harness = harnessCredentials(SUBSTRATE);

    // El observador lee; no tiene clave de servicio ni URL de API.
    expect(Object.keys(observer)).toEqual(['databaseUrl']);
    expect(JSON.stringify(observer)).not.toContain(SUBSTRATE.serviceRoleKey);

    // El harness es el único con la clave de servicio.
    expect(harness.serviceRoleKey).toBe(SUBSTRATE.serviceRoleKey);

    // Y el Actor no comparte nada con ninguno de los dos.
    const actor = actorCredentials(SUBSTRATE);
    expect(Object.keys(actor)).not.toContain('serviceRoleKey');
    expect(Object.keys(actor)).not.toContain('databaseUrl');
  });
});
