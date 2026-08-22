import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PUBLIC_ENV_ALLOWLIST, SERVER_ONLY_ENV_KEYS } from '@study-os/config';

import { REPO_ROOT, runGuard, withViolation } from './lib/run-guard';

/**
 * `bundle.secret-scan.spec` · prueba del check `secret-scan`.
 *
 * EC-010 · REQ-A05 · gate **P0-G3** · Manifest §14.
 *
 * El escaneo del bundle exige `apps/web/.next`. Cuando no existe, el check **falla**
 * a propósito: un escáner que se auto-exime deja de ser un control. Aquí se
 * verifica exactamente esa propiedad además del comportamiento sobre la fuente.
 */

const BUNDLE_DIR = join(REPO_ROOT, 'apps', 'web', '.next');

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

  const describeBundle = existsSync(BUNDLE_DIR) ? describe : describe.skip;

  describeBundle('con bundle construido', () => {
    it('no hay hallazgos en apps/web/.next/static', () => {
      const result = runGuard('secret-scan.mjs');
      expect(result.output, result.output).toContain('sin hallazgos');
      expect(result.exitCode).toBe(0);
    });
  });

  it('sin bundle, el check falla en lugar de omitirse', () => {
    // Solo puede comprobarse cuando efectivamente no hay build. Si lo hay, la
    // propiedad la garantiza la rama anterior y esta aserción documenta la regla.
    if (existsSync(BUNDLE_DIR)) {
      // La ausencia de bundle se registra como hallazgo, de modo que el check
      // termina en rojo por la vía normal de `report()` en lugar de salir antes
      // de tiempo y perderse los hallazgos de la pasada sobre la fuente.
      const scanner = readFileSync(join(REPO_ROOT, 'tools/guards/secret-scan.mjs'), 'utf8');
      expect(scanner).toContain('no puede omitirse');
      expect(scanner).toContain("file: 'apps/web/.next'");
      return;
    }

    const result = runGuard('secret-scan.mjs');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('no existe apps/web/.next');
  });
});
