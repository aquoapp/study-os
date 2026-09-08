import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PUBLIC_ENV_ALLOWLIST } from '@study-os/config';
import { SERVER_ONLY_ENV_KEYS } from '@study-os/config/server-env-keys';

import { REPO_ROOT, runGuard, withReplacedFile, withViolation } from './lib/run-guard';

/**
 * `bundle.secret-scan.spec` · prueba del check `secret-scan`.
 *
 * EC-010 · REQ-A05 · gate **P0-G3** · Manifest §14.
 *
 * El escaneo del bundle exige `apps/web/.next`. Cuando no existe, el check **falla**
 * a propósito: un escáner que se auto-exime deja de ser un control. Aquí se
 * verifica exactamente esa propiedad además del comportamiento sobre la fuente.
 */

describe('bundle.secret-scan · EC-010 · REQ-A05 · gate P0-G3', () => {
  it('la allowlist del escáner coincide con la de packages/config', () => {
    // Duplicar la lista es inevitable: el escáner es un script de Node que corre
    // sin el resolutor de TypeScript. Que coincidan sí puede comprobarse.
    const scanner = readFileSync(join(REPO_ROOT, 'tools/guards/secret-scan.mjs'), 'utf8');
    for (const key of PUBLIC_ENV_ALLOWLIST) {
      expect(scanner, `el escáner no conoce ${key}`).toContain(key);
    }
    for (const key of SERVER_ONLY_ENV_KEYS) {
      expect(scanner, `el escáner no vigila ${key}`).toContain(key);
    }
  });

  /**
   * Los fixtures se **componen** en tiempo de ejecución en lugar de escribirse
   * literalmente. Si aparecieran como literales, el escáner los encontraría en
   * este propio fichero y el test se denunciaría a sí mismo. La alternativa
   * —excluir este fichero del escaneo— dejaría un hueco permanente en la
   * cobertura del escáner sobre `tests/`, que es peor.
   */
  const fixture = {
    pemKey: [
      '-----BEGIN ',
      'PRIVATE',
      ' KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcw\n-----END ',
      'PRIVATE',
      ' KEY-----',
    ].join(''),
    providerToken: ['sk', '-', 'abcdefghijklmnopqrstuvwxyz0123456789'].join(''),
    serviceRoleAssignment: [
      'SUPABASE_SERVICE_ROLE',
      '_KEY',
      " = 'valor-real-que-no-debe-existir'",
    ].join(''),
  };

  it('detecta una clave privada versionada en la fuente', () => {
    const result = withViolation(
      'packages/domain/src/_violation-key.ts',
      `export const key = \`${fixture.pemKey}\`;\n`,
      () => runGuard('secret-scan.mjs'),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('clave privada PEM');
  });

  it('detecta un token de proveedor de IA en la fuente', () => {
    const result = withViolation(
      'packages/domain/src/_violation-token.ts',
      `export const token = '${fixture.providerToken}';\n`,
      () => runGuard('secret-scan.mjs'),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('token de proveedor de IA');
  });

  it('detecta una asignación literal de la clave de rol de servicio', () => {
    const result = withViolation(
      'packages/domain/src/_violation-service.ts',
      `export const ${fixture.serviceRoleAssignment};\n`,
      () => runGuard('secret-scan.mjs'),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('service role');
  });

  it('sin --build no se da por bueno: el propio check lo declara como hallazgo', () => {
    // Ejecutarlo sin construir no inyecta centinela ni inspecciona el renderizado.
    // Terminar en verde en ese caso sería un falso positivo del control.
    const result = runGuard('secret-scan.mjs');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Ejecutado sin --build');
  });

  it('el check construye por sí mismo: no depende de un build anterior', () => {
    const scanner = readFileSync(join(REPO_ROOT, 'tools/guards/secret-scan.mjs'), 'utf8');
    expect(scanner).toContain('Reproducible desde un checkout limpio');
    expect(scanner).toContain("'build'");

    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['secret-scan']).toContain('--build');
  });

  /**
   * La prueba que hace significativo todo lo anterior.
   *
   * Comprobar que un centinela **no** aparece solo dice algo si sabemos que
   * aparecería en caso de fuga. Aquí se provoca la fuga realista —un Server
   * Component que serializa el valor hacia la salida renderizada— y se exige que el
   * escáner la encuentre.
   *
   * Es lenta (dos builds completos) y aun así vale la pena: es la diferencia entre
   * un control y un adorno. Gate P0-G3.
   */
  it(
    'P0-G3 · detecta el centinela cuando una ruta lo filtra al renderizar',
    { timeout: 600_000 },
    () => {
      const leaking = [
        "export const metadata = { title: 'Sin conexión · Study OS' };",
        '',
        'export default function OfflinePage() {',
        '  const leaked = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";',
        '  return (',
        '    <div data-testid="offline-page">',
        '      <h1>Sin conexión</h1>',
        '      <p data-leak={leaked}>{leaked}</p>',
        '    </div>',
        '  );',
        '}',
      ].join('\n');

      const result = withReplacedFile('apps/web/src/app/offline/page.tsx', leaking, () =>
        runGuard('secret-scan.mjs', { SECRET_SCAN_PORT: '3211' }, ['--build']),
      );

      expect(result.exitCode, result.output).toBe(1);
      expect(result.output).toContain('centinela');
      expect(result.output).toContain('SUPABASE_SERVICE_ROLE_KEY');
    },
  );
});
