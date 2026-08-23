import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TOKEN_PROVENANCE } from '@study-os/design-system';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `tokens.provenance.spec` · lo literal del documento y lo provisional, separados.
 *
 * ---------------------------------------------------------------------------
 * Qué se corrige
 *
 * La entrega anterior afirmaba que «todos los valores proceden del documento». Era
 * falso: el Design System no nombra familias tipográficas, ni pesos, ni
 * interlineados, ni anchos de ruptura, ni un color de papel sobre fondos oscuros.
 *
 * Presentar un default de implementación como si fuera decisión de marca es la
 * misma clase de error que inventar la paleta, solo que más difícil de detectar:
 * quien lea el código creerá que cambiar `TYPOGRAPHY.weight` requiere un ADR, y no
 * lo requiere; o al revés, tocará un color creyendo que es un default.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

describe('procedencia de los tokens', () => {
  it('ya no se afirma que todos los valores procedan del documento', () => {
    expect(read('packages/design-system/src/tokens.ts')).not.toContain(
      'Todos los valores de este fichero están tomados del documento',
    );
  });

  it('distingue dos clases y las nombra', () => {
    expect(Object.keys(TOKEN_PROVENANCE)).toEqual(['document', 'provisional']);
    expect(Object.keys(TOKEN_PROVENANCE.document).length).toBeGreaterThan(0);
    expect(Object.keys(TOKEN_PROVENANCE.provisional).length).toBeGreaterThan(0);
  });

  /** Lo que la auditoría exigió marcar como provisional, como mínimo. */
  const mustBeProvisional = [
    'RADIUS.none',
    'RADIUS.full',
    'TYPOGRAPHY.family',
    'TYPOGRAPHY.weight',
    'TYPOGRAPHY.lineHeight',
    'BREAKPOINTS',
    'SEMANTIC_ROLES',
    'COLOR.onDark',
  ];

  for (const key of mustBeProvisional) {
    it(`${key} está declarado provisional`, () => {
      expect(Object.keys(TOKEN_PROVENANCE.provisional), `${key} falta`).toContain(key);
    });
  }

  it('cada entrada provisional explica por qué lo es', () => {
    for (const [key, reason] of Object.entries(TOKEN_PROVENANCE.provisional)) {
      expect(reason.length, `${key} no explica su motivo`).toBeGreaterThan(40);
    }
  });

  it('nada está en las dos clases a la vez', () => {
    const documentKeys = Object.keys(TOKEN_PROVENANCE.document);
    const provisionalKeys = Object.keys(TOKEN_PROVENANCE.provisional);
    const both = documentKeys.filter((key) => provisionalKeys.includes(key));
    expect(both, `clasificado dos veces: ${both.join(', ')}`).toEqual([]);
  });

  it('los diez colores del documento están del lado DOCUMENT', () => {
    const palette = TOKEN_PROVENANCE.document['COLOR (los diez de §2)'];
    for (const token of [
      'canvas',
      'surface',
      'ink',
      'navy',
      'teal',
      'magenta',
      'forest',
      'amber',
      'brick',
      'slate',
    ]) {
      expect(palette, `${token} no consta como literal del documento`).toContain(token);
    }
  });

  it('la diana táctil y los radios del documento están del lado DOCUMENT', () => {
    expect(TOKEN_PROVENANCE.document).toHaveProperty('TOUCH_TARGET_MIN_PX');
    expect(TOKEN_PROVENANCE.document).toHaveProperty('RADIUS.micro/control/card/hero');
  });
});
