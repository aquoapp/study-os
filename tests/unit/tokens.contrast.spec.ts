import { describe, expect, it } from 'vitest';

import {
  COLOR,
  CONTRAST_REQUIREMENTS,
  TOKEN_CONTRACT,
  contrastRatio,
  parseHexColor,
} from '@study-os/design-system';

/**
 * REQ-A06 · «Tokens conformes; contraste AA verificado»
 * P0-S7 · «Paquete design-system con tokens y test de contraste»
 * Manifest §20 · puerta de accesibilidad: contraste
 *
 * WCAG 2.1 AA: 4.5:1 para texto normal; 3:1 para componentes de interfaz y
 * contornos de foco (1.4.11).
 */

describe('tokens.contrast · REQ-A06', () => {
  it('el cálculo de contraste es correcto en los extremos conocidos', () => {
    // Negro sobre blanco: 21:1 exacto. Blanco sobre blanco: 1:1.
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // Simétrico: el orden de los argumentos no cambia la razón.
    expect(contrastRatio('#2A4FBF', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#2A4FBF'),
      10,
    );
  });

  it('rechaza colores mal formados en lugar de devolver un número inventado', () => {
    expect(() => parseHexColor('#12345')).toThrow();
    expect(() => parseHexColor('azul')).toThrow();
    expect(() => parseHexColor('')).toThrow();
  });

  for (const theme of TOKEN_CONTRACT.themes) {
    describe(`tema ${theme}`, () => {
      for (const requirement of CONTRAST_REQUIREMENTS) {
        it(`${requirement.label} ≥ ${requirement.minRatio}:1`, () => {
          const scale = COLOR[theme];
          const ratio = contrastRatio(scale[requirement.foreground], scale[requirement.background]);

          expect(
            ratio,
            `${theme}: ${requirement.foreground} (${scale[requirement.foreground]}) sobre ` +
              `${requirement.background} (${scale[requirement.background]}) = ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(requirement.minRatio);
        });
      }
    });
  }

  it('ningún par de contraste queda sin comprobar en algún tema', () => {
    expect(CONTRAST_REQUIREMENTS.length).toBeGreaterThan(0);
    for (const requirement of CONTRAST_REQUIREMENTS) {
      expect(TOKEN_CONTRACT.requiredColorRoles).toContain(requirement.foreground);
      expect(TOKEN_CONTRACT.requiredColorRoles).toContain(requirement.background);
    }
  });
});
