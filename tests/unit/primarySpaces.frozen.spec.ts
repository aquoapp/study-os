import { describe, expect, it } from 'vitest';

import {
  PRIMARY_SPACES,
  PRIMARY_SPACE_COUNT,
  TRANSVERSAL_CAPABILITIES,
  isPrimarySpace,
} from '@study-os/design-system';

/**
 * EC-015 · «IA primaria exactamente: HOY · APRENDER · ENTRENAR · PROGRESO · PLAN»
 * REQ-A09 · «Constante única de espacios primarios (5)»
 * Manifest §5 · «Five primary spaces only» · «Notes is transversal, not a sixth primary space»
 *
 * La lista congelada se escribe **literalmente aquí**, no se importa. Si el test
 * importara la constante para compararla consigo misma no probaría nada: pasaría
 * igual después de cambiarla.
 */

/** Copia literal congelada. Cambiarla es un cambio constitucional (EC-019). */
const FROZEN_PRIMARY_SPACES = ['HOY', 'APRENDER', 'ENTRENAR', 'PROGRESO', 'PLAN'] as const;

describe('primarySpaces.frozen · EC-015 · REQ-A09', () => {
  it('contiene exactamente los cinco espacios congelados, en orden', () => {
    expect([...PRIMARY_SPACES]).toEqual([...FROZEN_PRIMARY_SPACES]);
  });

  it('son exactamente cinco', () => {
    expect(PRIMARY_SPACES).toHaveLength(5);
    expect(PRIMARY_SPACE_COUNT).toBe(5);
  });

  it('no hay duplicados', () => {
    expect(new Set(PRIMARY_SPACES).size).toBe(PRIMARY_SPACES.length);
  });

  it('Notas no es un espacio primario', () => {
    expect(isPrimarySpace('NOTAS')).toBe(false);
    expect([...TRANSVERSAL_CAPABILITIES]).toContain('NOTAS');
  });

  it('el Tutor tampoco es un espacio primario', () => {
    expect(isPrimarySpace('TUTOR')).toBe(false);
    expect([...TRANSVERSAL_CAPABILITIES]).toContain('TUTOR');
  });

  it('reconoce cada espacio congelado y rechaza cualquier otro', () => {
    for (const space of FROZEN_PRIMARY_SPACES) {
      expect(isPrimarySpace(space)).toBe(true);
    }
    for (const other of ['INICIO', 'DASHBOARD', 'hoy', '', 'SIMULACRO']) {
      expect(isPrimarySpace(other)).toBe(false);
    }
  });
});
