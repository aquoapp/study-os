import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_ENV_VAR,
  assertAutomatedTestsAllowed,
  assertDestructiveOperationAllowed,
  authorizationTokenFor,
  destructivePolicyFor,
  isLoopbackUrl,
} from '@study-os/config/destructive';
// Gemelo en Node que usan las herramientas de línea de comandos.
import * as tooling from '../../tools/lib/environment-policy.mjs';

import { isTestEmail } from '../support/supabase-test-env';
import { REPO_ROOT } from './lib/run-guard';

/**
 * `operational-security.spec` · seguridad operacional de las herramientas y los tests.
 *
 * Engineering Constitution · «Human approval required for: destructive migrations,
 * … production-secret changes.»
 * Manifest §14 · líneas rojas de seguridad.
 *
 * La auditoría externa señaló cuatro defectos concretos, y este fichero prueba que
 * los cuatro están cerrados:
 *
 *   1. los tests con rol de servicio podían apuntar a producción;
 *   2. staging no exigía ninguna autorización;
 *   3. los usuarios creados por los E2E no se borraban —al contrario de lo que
 *      afirmaba el informe de checkpoint anterior—;
 *   4. `assertDestructiveOperationAllowed` existía pero no la llamaba nadie.
 */

const ENVIRONMENTS = ['local', 'staging', 'production'] as const;
const OPERATIONS = ['db-reset', 'automated-tests', 'purge'] as const;

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

describe('operaciones destructivas · producción', () => {
  it('deniega el reset aunque se aporte la autorización', () => {
    // Producción no se desbloquea con una variable de entorno. Si bastara con
    // definirla, el control sería un recordatorio, no una barrera.
    expect(() =>
      assertDestructiveOperationAllowed('db-reset', 'production', 'production:db-reset'),
    ).toThrow(/prohibida en "production"/);
  });

  it('deniega los tests automatizados aunque se aporte la autorización', () => {
    expect(() => assertAutomatedTestsAllowed('production', 'production:automated-tests')).toThrow(
      /prohibidos en "production"/,
    );
  });

  it('declara que contiene datos reales de personas', () => {
    expect(destructivePolicyFor('production').holdsRealUserData).toBe(true);
    expect(destructivePolicyFor('production').allowsAutomatedTests).toBe(false);
  });
});

describe('operaciones destructivas · staging exige autorización explícita', () => {
  it('deniega sin autorización', () => {
    expect(() => assertDestructiveOperationAllowed('db-reset', 'staging', undefined)).toThrow(
      /requiere autorización explícita/,
    );
  });

  it('deniega con una autorización de otro entorno', () => {
    expect(() =>
      assertDestructiveOperationAllowed('db-reset', 'staging', 'local:db-reset'),
    ).toThrow(/requiere autorización explícita/);
  });

  it('deniega con una autorización de otra operación', () => {
    expect(() =>
      assertDestructiveOperationAllowed('db-reset', 'staging', 'staging:automated-tests'),
    ).toThrow(/requiere autorización explícita/);
  });

  it('admite con la autorización exacta', () => {
    expect(() =>
      assertDestructiveOperationAllowed('db-reset', 'staging', 'staging:db-reset'),
    ).not.toThrow();
  });

  it('los tests automatizados en staging también la exigen', () => {
    expect(() => assertAutomatedTestsAllowed('staging', undefined)).toThrow(
      /requiere autorización explícita/,
    );
    expect(() => assertAutomatedTestsAllowed('staging', 'staging:automated-tests')).not.toThrow();
  });
});

describe('operaciones destructivas · local y entornos desconocidos', () => {
  it('local admite sin autorización', () => {
    expect(() => assertDestructiveOperationAllowed('db-reset', 'local', undefined)).not.toThrow();
    expect(() => assertAutomatedTestsAllowed('local', undefined)).not.toThrow();
  });

  it('un entorno desconocido se deniega, no se asume', () => {
    for (const unknown of ['', 'prod', 'dev', 'PRODUCTION', undefined as unknown as string]) {
      expect(() => assertDestructiveOperationAllowed('db-reset', unknown, undefined)).toThrow(
        /entorno desconocido/,
      );
      expect(() => assertAutomatedTestsAllowed(unknown, undefined)).toThrow(/entorno desconocido/);
    }
  });

  it('el token de autorización tiene un formato inequívoco', () => {
    expect(authorizationTokenFor('staging', 'db-reset')).toBe('staging:db-reset');
    expect(AUTHORIZATION_ENV_VAR).toBe('STUDY_OS_DESTRUCTIVE_AUTHORIZATION');
  });
});

describe('el código y las herramientas aplican la misma regla', () => {
  /**
   * `tools/lib/environment-policy.mjs` es un gemelo en Node del módulo TypeScript,
   * necesario porque las herramientas de línea de comandos no pueden importar TS.
   * Dos implementaciones de la misma regla se separan tarde o temprano; esto lo
   * detecta el día que ocurra.
   */
  const authorizations = [undefined, 'local:db-reset', 'staging:db-reset', 'production:db-reset'];

  for (const environment of ENVIRONMENTS) {
    for (const operation of OPERATIONS) {
      for (const authorization of authorizations) {
        it(`coinciden para ${environment} · ${operation} · ${String(authorization)}`, () => {
          const typescript = (() => {
            try {
              assertDestructiveOperationAllowed(operation, environment, authorization);
              return 'permitido';
            } catch (error) {
              return (error as Error).message;
            }
          })();

          const node = (() => {
            try {
              tooling.assertDestructiveOperationAllowed(operation, environment, authorization);
              return 'permitido';
            } catch (error) {
              return (error as Error).message;
            }
          })();

          expect(node).toBe(typescript);
        });
      }
    }
  }

  it('leen el mismo fichero de políticas', () => {
    const toolingSource = read('tools/lib/environment-policy.mjs');
    expect(toolingSource).toContain('packages/config/src/environment-policies.json');

    const configSource = read('packages/config/src/environments.ts');
    expect(configSource).toContain("from './environment-policies.json'");
  });
});

describe('la guarda está realmente conectada, no solo definida', () => {
  it('tools/db.mjs la aplica en db:reset', () => {
    const source = read('tools/db.mjs');
    expect(source).toContain('assertDestructiveOperationAllowed');
    expect(source).toContain("destructive: 'db-reset'");
  });

  it('tools/db.mjs comprueba también el host real, no solo la etiqueta', () => {
    expect(read('tools/db.mjs')).toContain('isLoopbackUrl');
  });

  it('los scripts destructivos pasan por tools/db.mjs', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['db:reset']).toBe('node tools/db.mjs reset');
  });

  it('el arranque de los tests de integración y RLS la aplica', () => {
    const source = read('tests/support/supabase-test-env.ts');
    expect(source).toContain('assertAutomatedTestsAllowed');
    expect(source).toContain('isLoopbackUrl');
  });

  it('@study-os/config/server sigue exponiendo la firma anterior', () => {
    // Se movió la implementación, no la interfaz pública.
    const source = read('packages/config/src/server.ts');
    expect(source).toContain(
      'export function assertDestructiveOperationAllowed(operation: string)',
    );
  });
});

describe('usuarios de prueba', () => {
  it('usan un dominio reservado por la RFC 2606 y un prefijo localizable', () => {
    expect(isTestEmail('p0-alice-1-1@example.test')).toBe(true);
    expect(isTestEmail('alice@example.test')).toBe(false);
    expect(isTestEmail('p0-alice@gmail.com')).toBe(false);
    expect(isTestEmail(undefined)).toBe(false);
  });

  it('existe una limpieza acotada a la ejecución para los que crean los E2E', () => {
    const source = read('tests/support/supabase-test-env.ts');
    expect(source).toContain('export async function purgeTestUsers');
    // Solo debe borrar los de ESTA ejecución. Borrar todos los de prueba era peor
    // que la fuga que corregía: contra una instancia compartida, una ejecución se
    // llevaba por delante los usuarios que otra estaba usando.
    expect(source).toContain('selectUsersToPurge(users, runId)');
    expect(source).toContain('if (isEmailOfRun(user.email, runId)) toDelete.push(user);');
  });

  it('Playwright ejecuta esa limpieza al terminar', () => {
    // La suite de auth es la única que crea usuarios, y es la única con teardown.
    const config = read('playwright.auth.config.ts');
    expect(config).toContain("globalTeardown: './tests/e2e/auth/global-teardown.ts'");
    expect(read('tests/e2e/auth/global-teardown.ts')).toContain('purgeTestUsers');
  });

  it('Playwright deniega el arranque contra un entorno no autorizado', () => {
    const config = read('playwright.auth.config.ts');
    expect(config).toContain("globalSetup: './tests/e2e/auth/global-setup.ts'");

    const setup = read('tests/e2e/auth/global-setup.ts');
    expect(setup).toContain('assertAutomatedTestsAllowed');
    expect(setup).toContain('isLoopbackUrl');
  });

  it('si no puede limpiar, la suite no se ejecuta', () => {
    // Antes avisaba y seguía en verde. Ahora la credencial se exige en el setup,
    // antes de crear ningún usuario, y el teardown falla si queda alguno.
    const setup = read('tests/e2e/auth/global-setup.ts');
    expect(setup).toContain('NO se ejecutan sin credenciales de limpieza');

    const teardown = read('tests/e2e/auth/global-teardown.ts');
    expect(teardown).toContain('La limpieza dejó');
  });
});

describe('detección de loopback', () => {
  it('reconoce las formas locales', () => {
    expect(isLoopbackUrl('http://127.0.0.1:54321')).toBe(true);
    expect(isLoopbackUrl('http://localhost:54321')).toBe(true);
  });

  it('rechaza cualquier host remoto', () => {
    expect(isLoopbackUrl('https://abcdefgh.supabase.co')).toBe(false);
    expect(isLoopbackUrl('https://127.0.0.1.evil.example')).toBe(false);
    expect(isLoopbackUrl('no-es-una-url')).toBe(false);
  });
});
