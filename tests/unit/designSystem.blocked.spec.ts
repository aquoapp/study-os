import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
 * `designSystem.blocked.spec` · procedencia de los tokens y estado de P0-S7 / REQ-A06.
 *
 * Manifest §6 · regla de no invención. EC-019 · ningún cambio silencioso de
 * invariante congelado.
 *
 * ---------------------------------------------------------------------------
 * Historia de este fichero, que importa para entenderlo
 *
 * La primera entrega inventó una paleta porque `STUDY_OS_Design_System_v1.0` no
 * estaba disponible, y declaró P0-S7 completo. La auditoría externa lo rechazó.
 *
 * El documento **apareció** durante la ronda correctiva. Los tokens ya no son
 * inventados: se comprueba aquí que proceden del documento y que el documento es el
 * que dice ser, por hash.
 *
 * Y aun así REQ-A06 sigue bloqueado, por un motivo nuevo y verificado: la paleta
 * congelada de §2 contiene tres combinaciones que no alcanzan el AA que §14 exige
 * como P0. Eso no se arregla retocando colores congelados; se registra como SD-019
 * y lo decide una persona.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

const ORIGINALS = join(REPO_ROOT, '_handoff', 'originals');

/**
 * Los tres documentos gobernantes que faltaban en el preflight y que llegaron
 * durante la ronda correctiva, con el hash con el que se verificaron.
 */
const ARRIVED_DOCUMENTS = [
  {
    file: 'STUDY_OS_Design_System_v1.0.pdf',
    sha256: '62a85885709cc2dc9ed4cffd71ed852ed1e54cf0962940ff53da93dd8c357aa4',
  },
  {
    file: 'STUDY_OS_Functional_Closure_MVP_Scope_v0.1.pdf',
    sha256: '6645bc17aca99a6070f7c958d07569857f596a07bac88fc285cf411918c07f3f',
  },
  {
    file: 'STUDY_OS_Onboarding_Edge_States_Visual_Spec_v1.0.pdf',
    sha256: 'e7bb2e91ed114778b6a46b15eb75b89a33e2c7261c1f7eee3e6d2cbb59ca9078',
  },
] as const;

describe('procedencia del Design System', () => {
  it('la paleta procede del documento, no de una invención', () => {
    expect(PALETTE_PROVENANCE).toBe('DOCUMENT');
    expect(DESIGN_SYSTEM_SOURCE.availability).toBe('AVAILABLE');
  });

  it('el documento declarado es el que gobierna los tokens', () => {
    expect(DESIGN_SYSTEM_SOURCE.document).toBe('STUDY_OS_Design_System_v1.0');
    expect(read('packages/design-system/src/tokens.ts')).toContain('STUDY_OS_Design_System_v1.0');
  });

  describe('los documentos que llegaron son los que dicen ser', () => {
    for (const { file, sha256 } of ARRIVED_DOCUMENTS) {
      it(`${file} conserva su SHA-256 registrado`, () => {
        const path = join(ORIGINALS, file);

        // Si el fichero desaparece, el bloqueo cambia de naturaleza y hay que
        // reevaluarlo: fallar aquí es preferible a seguir citando un hash de algo
        // que ya no está.
        expect(existsSync(path), `${file} ya no está en _handoff/originals/`).toBe(true);

        const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
        expect(actual, `${file} ha cambiado desde que se verificó`).toBe(sha256);
      });
    }

    it('el hash del Design System coincide con el que citan los tokens', () => {
      expect(DESIGN_SYSTEM_SOURCE.sha256).toBe(ARRIVED_DOCUMENTS[0].sha256);
      expect(read('packages/design-system/src/tokens.ts')).toContain(ARRIVED_DOCUMENTS[0].sha256);
    });

    it('son PDF de texto, no imágenes escaneadas', () => {
      for (const { file } of ARRIVED_DOCUMENTS) {
        const bytes = readFileSync(join(ORIGINALS, file));
        const text = bytes.toString('latin1');

        expect(bytes.subarray(0, 5).toString('latin1'), file).toBe('%PDF-');
        expect((text.match(/\/Font/g) ?? []).length, `${file} no declara fuentes`).toBeGreaterThan(
          0,
        );
        expect((text.match(/\/Subtype\s*\/Image/g) ?? []).length, `${file} contiene imágenes`).toBe(
          0,
        );
      }
    });
  });
});

describe('P0-S7 y REQ-A06 siguen bloqueados · SD-019', () => {
  it('el estado declarado es BLOCKED', () => {
    expect(DESIGN_SYSTEM_STATUS).toBe('BLOCKED');
    expect(isDesignSystemBlocked()).toBe(true);
  });

  it('nombra qué bloquea y por qué', () => {
    expect([...DESIGN_SYSTEM_SOURCE.blocks]).toEqual(['P0-S7', 'REQ-A06']);
    expect(DESIGN_SYSTEM_SOURCE.blockedBy).toBe('SD-019');
  });

  it('el motivo del bloqueo es el conflicto de contraste, no la ausencia del documento', () => {
    const blocked = [...DESIGN_SYSTEM_COVERAGE.blocked].join(' ');
    expect(blocked).toContain('SD-019');
    expect(blocked).toContain('4.5');
    // Y ya no es «falta el documento».
    expect(blocked).not.toContain('AUSENTE');
  });

  it('separa lo verificado de lo bloqueado sin mezclarlo', () => {
    // «Hay tokens del documento, luego REQ-A06 está hecho» es la lectura cómoda
    // que esto impide: el criterio de aceptación incluye «contraste AA verificado».
    expect(DESIGN_SYSTEM_COVERAGE.verified.length).toBeGreaterThan(0);
    expect(DESIGN_SYSTEM_COVERAGE.blocked.length).toBeGreaterThan(0);
  });

  it('SD-019 está registrado en el SPEC_DIFF_LOG', () => {
    const log = read('docs/SPEC_DIFF_LOG.md');
    expect(log).toContain('SD-019');
    expect(log).toContain('PROPOSED');
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

describe('registro de documentos gobernantes', () => {
  it('existe y refleja que los tres llegaron', () => {
    const registry = read('docs/GOVERNING_DOCUMENTS.md');
    for (const { file, sha256 } of ARRIVED_DOCUMENTS) {
      expect(registry, `${file} no figura en el registro`).toContain(file.replace('.pdf', ''));
      expect(registry, `falta el hash de ${file}`).toContain(sha256);
    }
  });

  it('el Founder Portfolio sigue siendo material exploratorio de nivel 7', () => {
    const registry = read('docs/GOVERNING_DOCUMENTS.md');
    expect(registry).toContain('STUDY_OS_Founder_Portfolio_Master_Context_v0.1.md');
    expect(registry).toContain('nivel 7');
    expect(registry).toContain('no gobierna');
  });
});
