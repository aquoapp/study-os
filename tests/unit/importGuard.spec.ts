import { describe, expect, it } from 'vitest';

import { runGuard, withViolation } from './lib/run-guard';

/**
 * Guarda de import de motores.
 *
 * ADR-001 v1.1 punto 2 · EC-002 · EC-003 · gate P0-G5.
 *
 * En Phase 0 no existe ningún paquete de motor. La guarda ya está activa para que
 * el primer import indebido falle el día que se escriba.
 */

describe('import-guard · ADR-001 · EC-002 · EC-003', () => {
  it('el repositorio actual está limpio', () => {
    const result = runGuard('import-guard.mjs');
    expect(result.output).toContain('sin hallazgos');
    expect(result.exitCode).toBe(0);
  });

  it('P0-G5 · falla cuando un fichero de cliente importa el Learning Engine', () => {
    const result = withViolation(
      'apps/web/src/app/_violation-engine.tsx',
      [
        "'use client';",
        "import { computeMastery } from '@study-os/learning-engine';",
        'export const value = computeMastery;',
      ].join('\n'),
      () => runGuard('import-guard.mjs'),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('@study-os/learning-engine');
  });

  it('P0-G5 · falla también con el Planner Engine', () => {
    const result = withViolation(
      'apps/web/src/app/_violation-planner.tsx',
      [
        "'use client';",
        "import { buildPlan } from '@study-os/planner-engine';",
        'export const value = buildPlan;',
      ].join('\n'),
      () => runGuard('import-guard.mjs'),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('@study-os/planner-engine');
  });

  it('no marca un import de motor desde una superficie de servidor', () => {
    // La regla es sobre el cliente. En servidor el motor es exactamente donde debe estar.
    const result = withViolation(
      'apps/web/src/server/_allowed-engine.ts',
      [
        "import 'server-only';",
        "import { computeMastery } from '@study-os/learning-engine';",
        'export const value = computeMastery;',
      ].join('\n'),
      () => runGuard('import-guard.mjs'),
    );

    expect(result.exitCode).toBe(0);
  });
});
