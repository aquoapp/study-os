import { describe, expect, it } from 'vitest';

import {
  COLOR,
  CONTRAST_REQUIREMENTS,
  NON_TEXT_BACKGROUNDS,
  SEMANTIC_ROLES,
  contrastRatio,
  parseHexColor,
} from '@study-os/design-system';

/**
 * `tokens.contrast.spec` · REQ-A06 · «contraste AA verificado».
 *
 * Design System §14 · «WCAG-minded AA contrast» como requisito P0.
 * WCAG 2.1 AA: 4.5:1 texto normal · 3:1 texto grande, componentes de interfaz y
 * contornos de foco (1.4.11).
 *
 * ---------------------------------------------------------------------------
 * Este fichero también documenta una contradicción del documento congelado
 *
 * La paleta de §2 y el requisito de §14 no son compatibles en tres combinaciones.
 * No se resuelve retocando los colores —serían valores congelados alterados sin
 * ADR, que es lo que EC-019 prohíbe—, sino acotando su uso y registrando la
 * contradicción como `SD-019`. Los números concretos están abajo, medidos, para que
 * la decisión humana se tome sobre datos y no sobre una impresión.
 * ---------------------------------------------------------------------------
 */

describe('tokens.contrast · REQ-A06 · Design System §14', () => {
  it('el cálculo de contraste es correcto en los extremos conocidos', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // Simétrico: el orden de los argumentos no cambia la razón.
    expect(contrastRatio(COLOR.navy, COLOR.canvas)).toBeCloseTo(
      contrastRatio(COLOR.canvas, COLOR.navy),
      10,
    );
  });

  it('rechaza colores mal formados en lugar de devolver un número inventado', () => {
    expect(() => parseHexColor('#12345')).toThrow();
    expect(() => parseHexColor('azul')).toThrow();
    expect(() => parseHexColor('')).toThrow();
  });

  describe('pares declarados', () => {
    for (const requirement of CONTRAST_REQUIREMENTS) {
      it(`${requirement.label} ≥ ${requirement.minRatio}:1`, () => {
        const ratio = contrastRatio(COLOR[requirement.foreground], COLOR[requirement.background]);

        expect(
          ratio,
          `${requirement.foreground} (${COLOR[requirement.foreground]}) sobre ` +
            `${requirement.background} (${COLOR[requirement.background]}) = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(requirement.minRatio);
      });
    }
  });

  describe('roles semánticos', () => {
    for (const [role, { background, foreground }] of Object.entries(SEMANTIC_ROLES)) {
      it(`${role}: el primer plano declarado alcanza AA sobre su fondo`, () => {
        const ratio = contrastRatio(COLOR[foreground], COLOR[background]);
        expect(
          ratio,
          `${foreground} sobre ${background} = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }

    it('ningún rol semántico usa un fondo marcado como no apto para texto', () => {
      const nonText: readonly string[] = NON_TEXT_BACKGROUNDS;
      for (const [role, { background }] of Object.entries(SEMANTIC_ROLES)) {
        expect(nonText, `el rol "${role}" usa un fondo que no admite texto`).not.toContain(
          background,
        );
      }
    });
  });

  describe('SD-019 · contradicción medida entre §2 y §14', () => {
    /**
     * Estas aserciones fijan los números **reales** de la paleta congelada. No son
     * un objetivo: son la prueba de que la limitación existe y de cuánto falta.
     * Si alguien cambia un color, esto falla y obliga a revisar SD-019 en lugar de
     * dejar que la contradicción cambie de forma en silencio.
     */
    it('onDark sobre teal se queda en 3.95: no admite texto normal', () => {
      const ratio = contrastRatio(COLOR.onDark, COLOR.teal);
      expect(ratio).toBeCloseTo(3.95, 2);
      expect(ratio).toBeLessThan(4.5);
      // Sí alcanza el 3:1 de componentes de interfaz, así que sirve como indicador.
      expect(ratio).toBeGreaterThanOrEqual(3);
      expect([...NON_TEXT_BACKGROUNDS]).toContain('teal');
    });

    it('onDark sobre amber se queda en 4.42: falla AA de texto por poco', () => {
      const ratio = contrastRatio(COLOR.onDark, COLOR.amber);
      expect(ratio).toBeCloseTo(4.42, 2);
      expect(ratio).toBeLessThan(4.5);
      expect(ratio).toBeGreaterThanOrEqual(3);
      expect([...NON_TEXT_BACKGROUNDS]).toContain('amber');
    });

    it('slate sobre canvas se queda en 4.31: el texto secundario sobre el fondo de página no alcanza AA', () => {
      const ratio = contrastRatio(COLOR.slate, COLOR.canvas);
      expect(ratio).toBeCloseTo(4.31, 2);
      expect(ratio).toBeLessThan(4.5);
      expect(ratio).toBeGreaterThanOrEqual(3);
      // Sobre `surface` sí llega, así que la restricción es de superficie, no del color.
      expect(contrastRatio(COLOR.slate, COLOR.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('ningún color de fondo no apto para texto aparece en un requisito de 4.5', () => {
      const nonText: readonly string[] = NON_TEXT_BACKGROUNDS;
      for (const requirement of CONTRAST_REQUIREMENTS) {
        if (requirement.minRatio < 4.5) continue;
        expect(
          nonText,
          `"${requirement.label}" exige AA de texto sobre un fondo que no puede darlo`,
        ).not.toContain(requirement.background);
      }
    });
  });

  it('todo color de la paleta es un hexadecimal de seis dígitos', () => {
    for (const [role, value] of Object.entries(COLOR)) {
      expect(value, role).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('cada requisito referencia tokens que existen', () => {
    expect(CONTRAST_REQUIREMENTS.length).toBeGreaterThan(0);
    for (const requirement of CONTRAST_REQUIREMENTS) {
      expect(COLOR[requirement.foreground]).toBeDefined();
      expect(COLOR[requirement.background]).toBeDefined();
    }
  });
});
