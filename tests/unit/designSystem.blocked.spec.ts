import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DESIGN_SYSTEM_COVERAGE,
  DESIGN_SYSTEM_SOURCE,
  DESIGN_SYSTEM_STATUS,
  PALETTE_PROVENANCE,
  isDesignSystemBlocked,
} from '@study-os/design-system';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `designSystem.blocked.spec` · estado de P0-S7 y REQ-A06.
 *
 * Manifest §6 · regla de no invención. EC-019 · ningún cambio silencioso.
 *
 * ---------------------------------------------------------------------------
 * Este fichero ya no lee `_handoff/`
 *
 * La versión anterior calculaba hashes de los ficheros de origen aquí dentro. Eso
 * ataba `test:unit` a material no versionado: en un checkout limpio o en CI el
 * test no podía pasar. La verificación de los ficheros reales es ahora
 * `npm run verify:originals`, y el contrato del registro lo comprueba
 * `governingDocuments.registry.spec`.
 *
 * Lo que queda aquí es lo que se puede afirmar desde el árbol Git: qué estado se
 * declara, por qué, y que ningún documento del repositorio lo contradiga.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

describe('procedencia de los tokens', () => {
  it('la paleta procede del documento, no de una invención', () => {
    expect(PALETTE_PROVENANCE).toBe('DOCUMENT');
    expect(DESIGN_SYSTEM_SOURCE.availability).toBe('AVAILABLE');
  });

  it('el documento declarado es el que gobierna los tokens', () => {
    expect(DESIGN_SYSTEM_SOURCE.document).toBe('STUDY_OS_Design_System_v1.0');
    expect(read('packages/design-system/src/tokens.ts')).toContain('STUDY_OS_Design_System_v1.0');
  });
});

describe('P0-S7 y REQ-A06 · estado y motivo', () => {
  it('el estado declarado es BLOCKED', () => {
    expect(DESIGN_SYSTEM_STATUS).toBe('BLOCKED');
    expect(isDesignSystemBlocked()).toBe(true);
  });

  it('nombra qué bloquea y por qué', () => {
    expect([...DESIGN_SYSTEM_SOURCE.blocks]).toEqual(['P0-S7', 'REQ-A06']);
    expect(DESIGN_SYSTEM_SOURCE.blockedBy).toBe('SD-019');
  });

  it('el motivo del bloqueo no es la ausencia del documento', () => {
    const blocked = [...DESIGN_SYSTEM_COVERAGE.blocked].join(' ');
    expect(blocked).toContain('SD-019');
    expect(blocked).not.toContain('AUSENTE');
  });

  it('la decisión autorizada de SD-019 consta como opción A', () => {
    expect(DESIGN_SYSTEM_SOURCE.decision).toBe('SD-019 opción A · autorizada para Phase 0');
  });

  it('separa lo verificado de lo bloqueado sin mezclarlo', () => {
    expect(DESIGN_SYSTEM_COVERAGE.verified.length).toBeGreaterThan(0);
    expect(DESIGN_SYSTEM_COVERAGE.blocked.length).toBeGreaterThan(0);
  });

  it('SD-019 está registrado en el SPEC_DIFF_LOG con la opción autorizada', () => {
    const log = read('docs/SPEC_DIFF_LOG.md');
    expect(log).toContain('SD-019');
    expect(log).toContain('opción A');
  });

  it('el checkpoint no declara P0-S7 ni REQ-A06 completos', () => {
    const checkpoint = read('docs/PHASE_0_CHECKPOINT.md');
    expect(checkpoint).toContain('P0-S7');
    expect(checkpoint).toContain('REQ-A06');

    for (const line of checkpoint.split('\n')) {
      if (!line.includes('P0-S7') && !line.includes('REQ-A06')) continue;
      expect(line, `el checkpoint declara completo un paso bloqueado: ${line.trim()}`).not.toMatch(
        /\bCompleto\b/,
      );
    }
  });
});
