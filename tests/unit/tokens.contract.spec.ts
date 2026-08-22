import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BREAKPOINTS,
  COLOR,
  MOTION,
  RADIUS,
  SPACING,
  TOKEN_CONTRACT,
  TOUCH_TARGET_MIN_PX,
  TYPOGRAPHY,
} from '@study-os/design-system';

/**
 * REQ-A06 · «Tokens del Design System (color, espaciado, radio, tipografía, 44px)»
 *
 * Verifica el **contrato**: que las escalas existen, que ambos temas declaran los
 * mismos roles, que el mínimo táctil es 44px, que no hay tokens de gamificación
 * (EC-017) y que el espejo CSS no ha divergido del TypeScript.
 */

const TOKENS_CSS = readFileSync(
  fileURLToPath(new URL('../../packages/design-system/src/tokens.css', import.meta.url)),
  'utf8',
);

const SCALES: Record<string, Record<string, unknown>> = {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  COLOR,
  MOTION,
  BREAKPOINTS,
};

/** `surfaceRaised` → `--so-color-surface-raised` */
function cssVarFor(role: string): string {
  return `--so-color-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

describe('tokens.contract · REQ-A06', () => {
  it('declara todas las escalas exigidas y ninguna vacía', () => {
    for (const scale of TOKEN_CONTRACT.requiredScales) {
      const value = SCALES[scale];
      expect(value, `falta la escala ${scale}`).toBeDefined();
      expect(Object.keys(value ?? {}).length, `la escala ${scale} está vacía`).toBeGreaterThan(0);
    }
  });

  it('el mínimo de diana táctil es 44px', () => {
    expect(TOUCH_TARGET_MIN_PX).toBe(44);
    expect(TOKEN_CONTRACT.touchTargetMinPx).toBe(44);
    expect(TOKENS_CSS).toContain('--so-touch-target-min: 44px;');
  });

  it('ambos temas declaran exactamente los mismos roles de color', () => {
    const light = Object.keys(COLOR.light).sort();
    const dark = Object.keys(COLOR.dark).sort();
    expect(dark).toEqual(light);
    expect(light).toEqual([...TOKEN_CONTRACT.requiredColorRoles].sort());
  });

  it('todo color es un hexadecimal de seis dígitos', () => {
    for (const theme of TOKEN_CONTRACT.themes) {
      for (const [role, value] of Object.entries(COLOR[theme])) {
        expect(value, `${theme}.${role}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('EC-017 · ningún token nombra XP, monedas, rachas ni ranking', () => {
    const allTokenNames = [
      ...Object.keys(SPACING),
      ...Object.keys(RADIUS),
      ...Object.keys(MOTION),
      ...Object.keys(BREAKPOINTS),
      ...Object.keys(COLOR.light),
      ...Object.keys(TYPOGRAPHY.size),
      ...Object.keys(TYPOGRAPHY.weight),
      ...Object.keys(TYPOGRAPHY.family),
    ].map((name) => name.toLowerCase());

    for (const forbidden of TOKEN_CONTRACT.forbiddenTokenSubstrings) {
      const offenders = allTokenNames.filter((name) => name.includes(forbidden));
      expect(offenders, `token prohibido por EC-017: "${forbidden}"`).toEqual([]);
      expect(TOKENS_CSS.toLowerCase()).not.toContain(`--so-${forbidden}`);
    }
  });

  it('el espejo CSS del tema claro coincide con los valores de TypeScript', () => {
    for (const [role, value] of Object.entries(COLOR.light)) {
      expect(TOKENS_CSS, `falta ${cssVarFor(role)}`).toContain(
        `${cssVarFor(role)}: ${value.toLowerCase()};`,
      );
    }
  });

  it('el espejo CSS del tema oscuro coincide con los valores de TypeScript', () => {
    // Cada valor oscuro debe aparecer dos veces: media query y `data-theme="dark"`.
    for (const [role, value] of Object.entries(COLOR.dark)) {
      const declaration = `${cssVarFor(role)}: ${value.toLowerCase()};`;
      const occurrences = TOKENS_CSS.split(declaration).length - 1;
      expect(
        occurrences,
        `${declaration} debe declararse en la media query y en [data-theme="dark"]`,
      ).toBe(2);
    }
  });

  it('el CSS respeta prefers-reduced-motion', () => {
    expect(TOKENS_CSS).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('el CSS declara un anillo de foco visible', () => {
    expect(TOKENS_CSS).toContain(':focus-visible');
    expect(TOKENS_CSS).toContain('var(--so-color-focus-ring)');
  });

  it('la escala de espaciado es monótona creciente', () => {
    const values = Object.values(SPACING);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});
