import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildActorProcessEnv } from '../../lab/src/credentials';
import type { EphemeralSubstrate } from '../../lab/src/environment';
import { actAsLearner, ObservationRefused } from '../../lab/src/observation';

/**
 * Aislamiento de proceso · CP2 · pruebas F, G, H y adversariales 1, 2 y 3.
 *
 * Estas pruebas **lanzan un proceso hijo real**. Una comprobación en el mismo proceso del test
 * demostraría que el objeto de credenciales está bien formado; solo desde dentro del proceso que
 * de verdad correría se ve si el Actor tiene o no privilegios.
 */

const PROBE = join(process.cwd(), 'lab', 'src', 'actor-probe.mjs');

const SUBSTRATE: EphemeralSubstrate = {
  apiUrl: 'http://127.0.0.1:54321',
  anonKey: 'anon-de-prueba',
  serviceRoleKey: 'CLAVE-PRIVILEGIADA-DE-PRUEBA',
  databaseUrl: ['postgre', 'sql://', '127.0.0.1:54322/postgres'].join(''),
};

interface ProbeResult {
  readonly leakedSecrets: number;
  readonly sqlConnectionVariables: readonly string[];
  readonly privilegedNames: readonly string[];
  readonly sawAnonKey: boolean;
  readonly sawApiUrl: boolean;
}

function runProbe(env: Record<string, string>): ProbeResult {
  const needles = [SUBSTRATE.serviceRoleKey, SUBSTRATE.databaseUrl].join('\n');
  const out = execFileSync(process.execPath, [PROBE, needles], {
    // El tipo de `env` exige `NODE_ENV`; el laboratorio construye el entorno entero por lista
    // blanca, así que se declara aquí y no se hereda nada más.
    env: env as NodeJS.ProcessEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out) as ProbeResult;
}

describe('F · el proceso del Actor carece de privilegios, visto desde dentro', () => {
  it('no encuentra ningún secreto, bajo ningún nombre', () => {
    const env = buildActorProcessEnv(SUBSTRATE, {
      PATH: process.env['PATH'],
      SystemRoot: process.env['SystemRoot'],
    });
    const result = runProbe(env);
    expect(result.leakedSecrets).toBe(0);
  });

  it('adversarial 2 · no dispone de ninguna cadena de conexión para abrir SQL', () => {
    const env = buildActorProcessEnv(SUBSTRATE, { PATH: process.env['PATH'] });
    const result = runProbe(env);
    expect(result.sqlConnectionVariables).toEqual([]);
    expect(result.privilegedNames).toEqual([]);
  });

  it('sí tiene lo que un aprendiz necesita, y solo eso', () => {
    const env = buildActorProcessEnv(SUBSTRATE, { PATH: process.env['PATH'] });
    const result = runProbe(env);
    expect(result.sawAnonKey).toBe(true);
    expect(result.sawApiUrl).toBe(true);
  });

  it('adversarial 1 · el entorno real del test sí tiene privilegios, y aun así no los hereda', () => {
    // Control positivo: si la sonda corriera con el entorno del proceso padre —que en CI sí
    // tiene la clave de servicio— los vería. Que no los vea con el entorno del Actor demuestra
    // que la construcción filtra, en vez de que la máquina estuviera limpia por casualidad.
    const contaminado = {
      ...process.env,
      MI_SECRETO_RENOMBRADO: SUBSTRATE.serviceRoleKey,
    } as Record<string, string>;
    const visto = runProbe(contaminado);
    expect(visto.leakedSecrets).toBeGreaterThan(0);

    const limpio = runProbe(buildActorProcessEnv(SUBSTRATE, { PATH: process.env['PATH'] }));
    expect(limpio.leakedSecrets).toBe(0);
  });
});

describe('G · el Observation Adapter observa y no actúa', () => {
  it('adversarial 3 · no existe camino para ejecutar una acción de aprendiz', () => {
    expect(() => actAsLearner()).toThrow(ObservationRefused);
    expect(() => actAsLearner()).toThrow(/observa; no actúa/);
  });
});
