import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DESIGN_SYSTEM_COVERAGE,
  DESIGN_SYSTEM_SOURCE,
  DESIGN_SYSTEM_STATUS,
  PALETTE_PROVENANCE,
  hasDeferredDesignDecision,
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
 * ---------------------------------------------------------------------------
 * Y el estado cambió de BLOCKED a satisfecho bajo restricciones
 *
 * La opción A de SD-019 está autorizada y aplicada. Bajo sus restricciones, todo
 * texto renderizado alcanza el contraste que WCAG le exige, y eso se mide en el
 * navegador. Ese es el criterio de aceptación de REQ-A06, así que declararlo
 * bloqueado era describir mal el estado: lo que queda abierto —elegir entre B y
 * C— no condiciona ningún entregable de Phase 0.
 *
 * Estas pruebas vigilan las dos formas de equivocarse: declarar el paso completo
 * sin restricciones, y seguir declarándolo bloqueado cuando ya no lo está.
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

describe('P0-S7 y REQ-A06 · satisfechos bajo la opción A', () => {
  it('el estado declarado no es BLOCKED ni COMPLETE', () => {
    expect(DESIGN_SYSTEM_STATUS).toBe('SATISFIED_UNDER_SD019_A');
    expect(isDesignSystemBlocked()).toBe(false);
  });

  it('nombra qué satisface y bajo qué decisión', () => {
    expect([...DESIGN_SYSTEM_SOURCE.satisfies]).toEqual(['P0-S7', 'REQ-A06']);
    expect(DESIGN_SYSTEM_SOURCE.decision).toBe('SD-019 opción A · autorizada para Phase 0');
  });

  it('las restricciones de la opción A están escritas, no implícitas', () => {
    const constraints = [...DESIGN_SYSTEM_COVERAGE.constraints].join(' ');
    expect(constraints).toContain('teal y amber no llevan texto normal');
    expect(constraints).toContain('slate solo como texto sobre surface');
    expect(DESIGN_SYSTEM_COVERAGE.constraints.length).toBeGreaterThanOrEqual(3);
  });

  it('separa lo verificado, las restricciones y lo diferido', () => {
    expect(DESIGN_SYSTEM_COVERAGE.verified.length).toBeGreaterThan(0);
    expect(DESIGN_SYSTEM_COVERAGE.constraints.length).toBeGreaterThan(0);
    expect(DESIGN_SYSTEM_COVERAGE.deferred.length).toBeGreaterThan(0);
  });

  it('declara la evidencia renderizada, no solo la lista de tokens', () => {
    const evidence = [...DESIGN_SYSTEM_COVERAGE.renderedEvidence].join(' ');
    expect(evidence).toContain('boundingBox');
    expect(evidence).toContain('computado real');
    expect(evidence).toContain('fixture negativo');
  });

  it('la prueba de accesibilidad renderizada existe y mide, no enumera', () => {
    // El arnés vive en `tests/support/a11y.ts` desde el First Product Slice: hay dos
    // superficies que medir, y una de ellas exige sesión.
    const harness = read('tests/support/a11y.ts');
    expect(harness).toContain('getComputedStyle');
    expect(harness).toContain('boundingBox()');
    expect(harness).toContain('effectiveBackground');
    // Y las dos suites lo usan: la pública y la del vertical de estudio.
    expect(read('tests/e2e/static/accessibility.a11y.spec.ts')).toContain(
      "from '../../support/a11y'",
    );
    expect(read('tests/e2e/auth/fps.vertical.e2e.ts')).toContain("from '../../support/a11y'");
  });

  it('el fixture negativo es automático y se ejecuta en cada pasada', () => {
    const spec = read('tests/e2e/static/accessibility.a11y.spec.ts');
    expect(spec).toContain('fixture negativo');
    expect(spec).toContain('BROKEN_PAGE');
    expect(spec).toContain('control-pequeno');
    // Y su propio control, para que unas funciones que saltaran con cualquier
    // entrada no lo hicieran pasar sin demostrar nada.
    expect(spec).toContain('no encuentra nada en una página correcta');
  });
});

describe('SD-019 · B y C quedan diferidas, no bloquean', () => {
  it('elegir entre B y C sigue abierto, con plazo antes de Phase 5', () => {
    const deferred = [...DESIGN_SYSTEM_COVERAGE.deferred].join(' ');
    expect(deferred).toContain('elegir entre B');
    expect(deferred).toContain('antes de Phase 5');
    expect(DESIGN_SYSTEM_SOURCE.deferredDeadline).toBe('antes de Phase 5');
    expect(hasDeferredDesignDecision()).toBe(true);
  });

  it('lo diferido no aparece como bloqueo de Phase 0', () => {
    // La distinción es el punto entero de esta corrección: una decisión con plazo
    // en Phase 5 no puede seguir presentándose como impedimento de Phase 0.
    expect(Object.keys(DESIGN_SYSTEM_COVERAGE)).not.toContain('blocked');
    expect(Object.keys(DESIGN_SYSTEM_SOURCE)).not.toContain('blockedBy');
  });

  it('SD-019 está registrado en el SPEC_DIFF_LOG con la opción autorizada', () => {
    const log = read('docs/SPEC_DIFF_LOG.md');
    expect(log).toContain('SD-019');
    expect(log).toContain('opción A');
  });

  it('el checkpoint no declara P0-S7 ni REQ-A06 bloqueados', () => {
    const checkpoint = read('docs/PHASE_0_CHECKPOINT.md');
    expect(checkpoint).toContain('P0-S7');
    expect(checkpoint).toContain('REQ-A06');

    for (const line of checkpoint.split('\n')) {
      if (!line.includes('P0-S7') && !line.includes('REQ-A06')) continue;
      expect(line, `el checkpoint sigue declarándolo bloqueado: ${line.trim()}`).not.toMatch(
        /BLOQUEADO/,
      );
    }
  });
});

describe('el umbral de 3:1 no admite texto', () => {
  it('ningún requisito de 3:1 se justifica por ser «metadato»', () => {
    // «Metadato» es texto: un dato secundario se lee, y leerlo exige 4.5:1. Esa
    // palabra autorizaba de hecho slate sobre canvas para texto de apoyo.
    const tokens = read('packages/design-system/src/tokens.ts');
    const requirements = tokens.slice(tokens.indexOf('CONTRAST_REQUIREMENTS'));
    expect(requirements).not.toContain("label: 'borde y metadato sobre canvas'");
    expect(requirements).toContain('borde sobre canvas (elemento no textual)');
  });

  it('la prueba renderizada solo baja a 3:1 por tamaño, nunca por rol', () => {
    const harness = read('tests/support/a11y.ts');
    expect(harness).toContain('isLargeText(sample) ? 3 : 4.5');
    expect(harness).toContain('todo texto normal exige 4.5:1');
  });
});
