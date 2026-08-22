import { describe, expect, it } from 'vitest';

import { runGuard, withViolation } from './lib/run-guard';

/**
 * EC-018 · «TAI es un pack; el shell es exam-neutral».
 * Manifest §5 · «TAI-specific assumptions must not contaminate the reusable shell».
 * Gate P0-G5.
 */

describe('tai-literal · EC-018', () => {
  it('el shell actual no contiene el literal del pack', () => {
    const result = runGuard('tai-literal.mjs');
    expect(result.output).toContain('sin hallazgos');
    expect(result.exitCode).toBe(0);
  });

  it('P0-G5 · falla cuando el literal aparece en el shell', () => {
    const result = withViolation(
      'packages/domain/src/_violation-pack.ts',
      ['export const DEFAULT_PACK = "TAI";'].join('\n'),
      () => runGuard('tai-literal.mjs'),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('_violation-pack.ts');
  });

  it('no salta con palabras que simplemente contienen esas tres letras', () => {
    const result = withViolation(
      'packages/domain/src/_violation-falsepositive.ts',
      [
        'export const words = ["retain", "contains", "TAIL", "detail", "MOUNTAIN"];',
        'export const identifier = TAIL_ROOM;',
        'declare const TAIL_ROOM: number;',
      ].join('\n'),
      () => runGuard('tai-literal.mjs'),
    );

    expect(result.exitCode).toBe(0);
  });
});
