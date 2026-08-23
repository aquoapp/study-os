import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  isEmailOfRun,
  isTestEmail,
  isValidRunId,
  newRunId,
  purgeTestUsers,
  runScopedEmail,
  selectUsersToPurge,
  type TestEnv,
} from '../support/supabase-test-env';
import { runMarkerPath } from '../e2e/auth/global-setup';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `e2eCleanupScope.spec` · la limpieza se lleva lo suyo y solo lo suyo.
 *
 * ---------------------------------------------------------------------------
 * El defecto que cierra
 *
 * La limpieza anterior borraba **todo** usuario con el prefijo de prueba. Contra
 * una instancia local de una sola persona no se nota. Contra CI con dos trabajos en
 * paralelo, o contra un stack compartido, una ejecución borra los usuarios que otra
 * está usando: la que falla no es la que cometió el error.
 *
 * Y el marcador tenía nombre fijo, así que dos ejecuciones simultáneas se pisaban
 * el fichero y la segunda en terminar limpiaba con el censo de la primera.
 *
 * ---------------------------------------------------------------------------
 * Por qué estas pruebas se pueden ejecutar
 *
 * La regla de «solo los míos» está en una función pura —`selectUsersToPurge`— en
 * lugar de dentro del bucle que habla con Supabase. Una regla que solo corre cuando
 * hay una instancia delante no se prueba nunca, y esta es precisamente la que puede
 * equivocarse de forma silenciosa y cara.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

/** Fabrica un usuario listado, con la forma mínima que usa la selección. */
const user = (email: string, id = email) => ({ id, email });

describe('identificador de ejecución', () => {
  it('tiene la forma admitida y dos ejecuciones no coinciden', () => {
    const a = newRunId();
    const b = newRunId();
    expect(isValidRunId(a)).toBe(true);
    expect(isValidRunId(b)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('rechaza formas que no puede llevar un correo', () => {
    for (const invalid of [
      '',
      'corto',
      'CON-MAYUSCULAS',
      'con-guion-x',
      'a'.repeat(33),
      undefined,
    ]) {
      expect(isValidRunId(invalid), `aceptó "${String(invalid)}"`).toBe(false);
    }
  });
});

describe('el correo lleva la marca de la ejecución', () => {
  const runId = 'k1a2b3c4d5';

  it('sigue siendo un correo de prueba reconocible', () => {
    const email = runScopedEmail(runId, 'alice', 1);
    expect(email).toBe(`p0-${runId}-alice-1@example.test`);
    expect(isTestEmail(email)).toBe(true);
  });

  it('sin identificador válido no se fabrica ningún correo', () => {
    expect(() => runScopedEmail('', 'alice', 1)).toThrow(/Identificador de ejecución inválido/);
    expect(() => runScopedEmail('MAL', 'alice', 1)).toThrow(/Identificador de ejecución inválido/);
  });

  it('reconoce los suyos', () => {
    expect(isEmailOfRun(runScopedEmail(runId, 'alice', 1), runId)).toBe(true);
  });

  it('no reclama los de otra ejecución', () => {
    const otro = 'z9y8x7w6v5';
    expect(isEmailOfRun(runScopedEmail(otro, 'alice', 1), runId)).toBe(false);
  });

  it('no reclama una ejecución cuyo identificador empieza igual', () => {
    // El caso que un `startsWith` ingenuo sin el guion de cierre se llevaría por
    // delante: `k1a2b3c4d5` frente a `k1a2b3c4d50`.
    const parecido = `${runId}0`;
    expect(isValidRunId(parecido)).toBe(true);
    expect(isEmailOfRun(runScopedEmail(parecido, 'alice', 1), runId)).toBe(false);
    expect(isEmailOfRun(runScopedEmail(runId, 'alice', 1), parecido)).toBe(false);
  });

  it('no reclama un correo que no es de prueba', () => {
    expect(isEmailOfRun('persona@ejemplo.com', runId)).toBe(false);
    expect(isEmailOfRun(undefined, runId)).toBe(false);
  });
});

describe('preservación · lo que ya estaba no se toca', () => {
  const runId = 'k1a2b3c4d5';

  it('preserva usuarios de prueba sin marca de ejecución', () => {
    // Los del esquema antiguo: prefijo de prueba, sin identificador.
    const listed = [
      user('p0-alice-1700000000000-1@example.test'),
      user('p0-bob-1700000000000-2@example.test'),
      user(runScopedEmail(runId, 'mio', 1)),
    ];

    const { toDelete, preserved } = selectUsersToPurge(listed, runId);

    expect(toDelete.map((u) => u.email)).toEqual([runScopedEmail(runId, 'mio', 1)]);
    expect(preserved).toHaveLength(2);
  });

  it('preserva cuentas que no son de prueba', () => {
    const listed = [user('persona@ejemplo.com'), user(runScopedEmail(runId, 'mio', 1))];
    const { toDelete, preserved } = selectUsersToPurge(listed, runId);

    expect(toDelete).toHaveLength(1);
    expect(preserved.map((u) => u.email)).toEqual(['persona@ejemplo.com']);
  });

  it('con la instancia vacía no borra nada y no falla', () => {
    const { toDelete, preserved } = selectUsersToPurge([], runId);
    expect(toDelete).toHaveLength(0);
    expect(preserved).toHaveLength(0);
  });
});

describe('concurrencia · dos ejecuciones a la vez sobre la misma instancia', () => {
  const runA = 'aa11bb22cc';
  const runB = 'dd33ee44ff';

  const listed = [
    user('p0-heredado-1@example.test'), // preexistente, sin marca
    user('persona@ejemplo.com'), // ni siquiera es de prueba
    user(runScopedEmail(runA, 'alice', 1)),
    user(runScopedEmail(runA, 'alice', 2)),
    user(runScopedEmail(runB, 'bob', 1)),
  ];

  it('cada ejecución selecciona exactamente los suyos', () => {
    expect(selectUsersToPurge(listed, runA).toDelete.map((u) => u.email)).toEqual([
      runScopedEmail(runA, 'alice', 1),
      runScopedEmail(runA, 'alice', 2),
    ]);
    expect(selectUsersToPurge(listed, runB).toDelete.map((u) => u.email)).toEqual([
      runScopedEmail(runB, 'bob', 1),
    ]);
  });

  it('las dos selecciones son disjuntas', () => {
    const a = new Set(selectUsersToPurge(listed, runA).toDelete.map((u) => u.id));
    const b = new Set(selectUsersToPurge(listed, runB).toDelete.map((u) => u.id));
    const interseccion = [...a].filter((id) => b.has(id));
    expect(interseccion, `ambas reclaman: ${interseccion.join(', ')}`).toEqual([]);
  });

  it('ninguna de las dos toca lo que ya estaba', () => {
    const borrados = new Set([
      ...selectUsersToPurge(listed, runA).toDelete.map((u) => u.id),
      ...selectUsersToPurge(listed, runB).toDelete.map((u) => u.id),
    ]);
    expect(borrados.has('p0-heredado-1@example.test')).toBe(false);
    expect(borrados.has('persona@ejemplo.com')).toBe(false);
  });

  it('el marcador es propio de cada ejecución', () => {
    expect(runMarkerPath(runA)).not.toBe(runMarkerPath(runB));
    expect(runMarkerPath(runA)).toBe(join(tmpdir(), `study-os-e2e-auth-${runA}.json`));
  });
});

describe('la limpieza se niega a actuar a ciegas', () => {
  const env: TestEnv = {
    url: 'http://127.0.0.1:54321',
    anonKey: 'anon',
    serviceRoleKey: 'service',
    environment: 'local',
  };

  it('sin identificador de ejecución no lista ni borra nada', async () => {
    // Falla antes de construir el cliente: no hay red de por medio.
    await expect(purgeTestUsers(env, '')).rejects.toThrow(/identificador de ejecución válido/);
  });

  it('con un identificador con forma inválida tampoco', async () => {
    await expect(purgeTestUsers(env, 'NO-VALE')).rejects.toThrow(
      /identificador de ejecución válido/,
    );
  });
});

describe('el arranque y la limpieza aplican el contrato', () => {
  const setup = read('tests/e2e/auth/global-setup.ts');
  const teardown = read('tests/e2e/auth/global-teardown.ts');

  it('el arranque genera y publica el identificador', () => {
    expect(setup).toContain('newRunId()');
    expect(setup).toContain(`process.env[RUN_ID_ENV_VAR] = runId`);
  });

  it('el arranque censa lo preexistente para no tocarlo', () => {
    expect(setup).toContain('preexisting');
    expect(setup).toContain('NO se tocarán');
  });

  it('el marcador lleva el identificador en el nombre', () => {
    expect(setup).toContain('study-os-e2e-auth-${runId}.json');
  });

  it('la limpieza se hace con el identificador de esta ejecución', () => {
    expect(teardown).toContain('purgeTestUsers(env, runId)');
  });

  it('la limpieza comprueba que no queda ninguno suyo', () => {
    expect(teardown).toContain('isEmailOfRun(user.email, runId)');
    expect(teardown).toContain('La limpieza dejó');
  });

  it('la limpieza comprueba también que no borró de más', () => {
    // Sin esta comprobación, borrar los usuarios de otra ejecución sería invisible.
    expect(teardown).toContain('vanished');
    expect(teardown).toContain('NO eran de esta ejecución');
  });

  it('no queda ninguna limpieza indiscriminada por prefijo', () => {
    const source = read('tests/support/supabase-test-env.ts');
    // `isTestEmail` sigue existiendo —hace falta para el censo—, pero la selección
    // de lo que se borra ya no puede apoyarse solo en él.
    expect(source).toContain('if (isEmailOfRun(user.email, runId)) toDelete.push(user);');
    expect(source).not.toContain('if (!isTestEmail(user.email)) continue;');
  });

  it('los E2E que crean usuarios los marcan, y se detienen si no pueden', () => {
    for (const spec of [
      'tests/e2e/auth/auth.signup-login.e2e.ts',
      'tests/e2e/auth/auth.forgedCookieRejected.e2e.ts',
    ]) {
      const source = read(spec);
      expect(source, `${spec} no usa correos marcados`).toContain('runScopedEmail(');
      expect(source, `${spec} no se detiene sin identificador`).toContain('isValidRunId(runId)');
    }
  });
});
