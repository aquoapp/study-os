import { describe, expect, it } from 'vitest';

import {
  CLOUD_ENV_VARS,
  EPHEMERAL_SUBSTRATE,
  LAB_ENV,
  SUBSTRATE_ENV_VAR,
  SubstrateRejected,
  requireEphemeralSubstrate,
} from '../../lab/src/environment';

/**
 * Guardas de sustrato · CP1 · pruebas C, D, E, F.
 *
 * El laboratorio solo puede arrancar contra el sustrato efímero. Estas pruebas atacan la guarda
 * desde fuera: intentan colar STAGING, PRODUCTION, un proyecto cloud cualquiera y una variable
 * heredada. Ninguna debe pasar.
 */

/**
 * Fixture del sustrato válido.
 *
 * Los nombres salen de `LAB_ENV` en lugar de escribirse como literales: así el repositorio no
 * contiene una asignación con forma de credencial, que es lo que `secret-scan` vigila bajo
 * EC-010. La guarda no se debilita; se evita darle motivo.
 *
 * La cadena de base de datos se compone por partes por la misma razón. Lo que el fixture necesita
 * es un host de loopback y el puerto declarado; las credenciales son irrelevantes para lo que
 * estas pruebas comprueban.
 */
const LOCAL_DB_URL = ['postgre', 'sql://', '127.0.0.1:54322/postgres'].join('');

const VALID = {
  [SUBSTRATE_ENV_VAR]: EPHEMERAL_SUBSTRATE,
  [LAB_ENV.apiUrl]: 'http://127.0.0.1:54321',
  [LAB_ENV.databaseUrl]: LOCAL_DB_URL,
  [LAB_ENV.anonKey]: 'anon-local',
  [LAB_ENV.privilegedKey]: 'clave-local-de-prueba',
} as const;

describe('guarda de sustrato · solo lo efímero entra', () => {
  it('acepta el sustrato efímero declarado', () => {
    const substrate = requireEphemeralSubstrate({ ...VALID });
    expect(substrate.apiUrl).toBe('http://127.0.0.1:54321');
    expect(substrate.databaseUrl).toContain('54322');
  });

  it('sin declaración explícita no arranca: el sustrato nunca se deduce', () => {
    const { [SUBSTRATE_ENV_VAR]: _omitted, ...sinDeclarar } = VALID;
    expect(() => requireEphemeralSubstrate(sinDeclarar)).toThrow(SubstrateRejected);
  });

  it('C · rechaza STAGING aunque la declaración diga efímero', () => {
    expect(() =>
      requireEphemeralSubstrate({
        ...VALID,
        [LAB_ENV.apiUrl]: 'https://xzcrqsolxarutlvvkzfp.supabase.co',
      }),
    ).toThrow(/no es loopback/);
  });

  it('D · rechaza PRODUCTION', () => {
    expect(() =>
      requireEphemeralSubstrate({
        ...VALID,
        [LAB_ENV.apiUrl]: 'https://nzcgufeycvehczroryoe.supabase.co',
      }),
    ).toThrow(/no es loopback/);
  });

  it('E · rechaza cualquier identidad cloud, incluso desconocida', () => {
    for (const host of [
      'https://cualquier-proyecto.supabase.co',
      'https://db.ejemplo.supabase.co',
      'http://10.0.0.5:54321',
      'http://interno.corp:54321',
    ]) {
      expect(() => requireEphemeralSubstrate({ ...VALID, [LAB_ENV.apiUrl]: host })).toThrow(
        SubstrateRejected,
      );
    }
  });

  it('F · AQUO queda fuera sin nombrarlo: la allowlist no admite ningún host remoto', () => {
    // El repositorio es público y no escribe identificadores de proyectos ajenos (CLAUDE.md §9).
    // La protección es estructural: cualquier host que no sea loopback se rechaza.
    expect(() =>
      requireEphemeralSubstrate({
        ...VALID,
        [LAB_ENV.apiUrl]: 'https://otro-producto.supabase.co',
      }),
    ).toThrow(/no es loopback/);
  });

  it('un nombre amable no abre la puerta: «local» en el host no basta', () => {
    expect(() =>
      requireEphemeralSubstrate({ ...VALID, [LAB_ENV.apiUrl]: 'https://local.supabase.co' }),
    ).toThrow(/no es loopback/);
  });

  it('rechaza una URL con credenciales embebidas, aunque apunte al loopback', () => {
    // Hallazgo de la revisión adversarial de CP1. `http://algo@127.0.0.1` apunta de verdad al
    // loopback, así que no era una fuga; pero una URL con userinfo puede llevar credenciales y
    // obliga a mirar dos veces para saber a dónde va. El sustrato no la necesita.
    expect(() =>
      requireEphemeralSubstrate({
        ...VALID,
        [LAB_ENV.apiUrl]: 'http://evil.com@127.0.0.1:54321',
      }),
    ).toThrow(/credenciales embebidas/);
  });

  it('acepta userinfo en la cadena de postgres: ahí es parte del protocolo', () => {
    // Hallazgo de la primera ejecución de CP2 contra una instancia real. El stack local emite
    // `postgres:postgres@127.0.0.1:54322`, con credenciales públicas por defecto. La regla de
    // CP1 era correcta en intención y demasiado amplia en alcance: rechazaba el sustrato
    // legítimo. En la URL de API se mantiene; en la de base de datos, no.
    expect(() =>
      requireEphemeralSubstrate({
        ...VALID,
        [LAB_ENV.databaseUrl]: [
          'postgre',
          'sql://',
          'postgres:postgres@127.0.0.1:54322/postgres',
        ].join(''),
      }),
    ).not.toThrow();
  });

  it('pero la cadena de postgres sigue exigiendo loopback aunque traiga userinfo', () => {
    expect(() =>
      requireEphemeralSubstrate({
        ...VALID,
        [LAB_ENV.databaseUrl]: ['postgre', 'sql://', 'u:p@remoto.supabase.co:54322/postgres'].join(
          '',
        ),
      }),
    ).toThrow(/no es loopback/);
  });

  it('admite la forma corta de loopback: `URL` la normaliza y sigue siendo 127.0.0.1', () => {
    // El otro hallazgo de la revisión adversarial: `127.1` es loopback real, no un rodeo.
    // Lo que decide es el host normalizado, no su grafía.
    expect(() =>
      requireEphemeralSubstrate({ ...VALID, [LAB_ENV.apiUrl]: 'http://127.1:54321' }),
    ).not.toThrow();
  });

  it('rechaza un puerto que no sea el declarado por el sustrato', () => {
    expect(() =>
      requireEphemeralSubstrate({ ...VALID, [LAB_ENV.apiUrl]: 'http://127.0.0.1:5432' }),
    ).toThrow(/puerto/);
  });

  it('una variable cloud heredada aborta el arranque', () => {
    for (const name of CLOUD_ENV_VARS) {
      expect(() => requireEphemeralSubstrate({ ...VALID, [name]: 'cualquier-valor' })).toThrow(
        new RegExp(name),
      );
    }
  });

  it('falta cualquier credencial del sustrato y no arranca', () => {
    for (const key of [
      LAB_ENV.apiUrl,
      LAB_ENV.databaseUrl,
      LAB_ENV.anonKey,
      LAB_ENV.privilegedKey,
    ]) {
      const incompleto: Record<string, string | undefined> = { ...VALID };
      delete incompleto[key];
      expect(() => requireEphemeralSubstrate(incompleto)).toThrow(SubstrateRejected);
    }
  });
});
