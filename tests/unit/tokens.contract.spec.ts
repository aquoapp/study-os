import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BREAKPOINTS,
  COLOR,
  LAYOUT,
  MOTION,
  RADIUS,
  SPACING,
  TOKEN_CONTRACT,
  TOUCH_TARGET_MIN_PX,
  TYPOGRAPHY,
} from '@study-os/design-system';

/**
 * `tokens.contract.spec` · REQ-A06.
 *
 * Verifica que los tokens **coinciden con el documento gobernante**
 * `STUDY_OS_Design_System_v1.0` §2, §3 y §13, no solo que existan.
 *
 * Los valores esperados se escriben aquí **literalmente**, transcritos del
 * documento. Importarlos para compararlos consigo mismos no probaría nada: pasaría
 * igual después de cambiarlos.
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
  LAYOUT,
};

/** `surfaceRaised` → `--so-color-surface-raised` */
function cssVar(prefix: string, token: string): string {
  return `--so-${prefix}-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

describe('tokens.contract · REQ-A06 · Design System §2', () => {
  it('declara el documento del que proceden los valores', () => {
    expect(TOKEN_CONTRACT.source).toBe('STUDY_OS_Design_System_v1.0');
  });

  it('declara todas las escalas exigidas y ninguna vacía', () => {
    for (const scale of TOKEN_CONTRACT.requiredScales) {
      const value = SCALES[scale];
      expect(value, `falta la escala ${scale}`).toBeDefined();
      expect(Object.keys(value ?? {}).length, `la escala ${scale} está vacía`).toBeGreaterThan(0);
    }
  });

  describe('color · §2 «Core tokens · Colour»', () => {
    /** Transcripción literal del documento. */
    const DOCUMENT_PALETTE = {
      canvas: '#F7F3EA',
      surface: '#FFFDF9',
      ink: '#17262D',
      navy: '#0B2D3A',
      teal: '#2B8C8C',
      magenta: '#C13A8B',
      forest: '#2F6B57',
      amber: '#A56A18',
      brick: '#A8473F',
      slate: '#66757C',
    } as const;

    for (const [token, value] of Object.entries(DOCUMENT_PALETTE)) {
      it(`${token} es ${value}`, () => {
        expect(COLOR[token as keyof typeof COLOR]).toBe(value);
      });
    }

    it('no hay ningún color que el documento no declare', () => {
      const extra = Object.keys(COLOR).filter(
        (token) => !(token in DOCUMENT_PALETTE) && token !== 'onDark',
      );
      expect(extra, `colores no presentes en §2: ${extra.join(', ')}`).toEqual([]);
    });

    it('no existe tema oscuro: el documento no lo especifica', () => {
      // Inventar diez colores más sería exactamente lo que la ronda correctiva vino
      // a eliminar.
      expect(TOKENS_CSS).not.toContain('prefers-color-scheme: dark');
      expect(TOKENS_CSS).not.toContain("data-theme='dark'");
      expect(TOKENS_CSS).not.toContain('data-theme="dark"');
      expect(TOKENS_CSS).toContain('color-scheme: light;');
    });
  });

  describe('espaciado · §2 «4 · 8 · 12 · 16 · 24 · 32 · 48 · 64»', () => {
    it('contiene exactamente esos pasos, más el cero', () => {
      expect(Object.values(SPACING)).toEqual([0, 4, 8, 12, 16, 24, 32, 48, 64]);
    });

    it('es monótona creciente', () => {
      const values = Object.values(SPACING);
      for (let i = 1; i < values.length; i += 1) {
        expect(values[i]!).toBeGreaterThan(values[i - 1]!);
      }
    });
  });

  describe('radio · §2 «micro: 8 · control: 12 · card: 16 · hero/resume: 20»', () => {
    it('usa los nombres y valores del documento', () => {
      expect(RADIUS.micro).toBe(8);
      expect(RADIUS.control).toBe(12);
      expect(RADIUS.card).toBe(16);
      expect(RADIUS.hero).toBe(20);
    });
  });

  describe('tipografía · §2 «Typography direction»', () => {
    it('conserva los rangos del documento', () => {
      expect(TYPOGRAPHY.size.metadataMin).toBe(12);
      expect(TYPOGRAPHY.size.metadataMax).toBe(13);
      expect(TYPOGRAPHY.size.secondaryMin).toBe(14);
      expect(TYPOGRAPHY.size.secondaryMax).toBe(15);
      expect(TYPOGRAPHY.size.bodyMin).toBe(16);
      expect(TYPOGRAPHY.size.bodyMax).toBe(18);
      expect(TYPOGRAPHY.size.titleMin).toBe(20);
      expect(TYPOGRAPHY.size.titleMax).toBe(24);
      expect(TYPOGRAPHY.size.headlineMin).toBe(28);
      expect(TYPOGRAPHY.size.headlineMax).toBe(34);
    });

    it('declara numerales tabulares para datos numéricos', () => {
      expect(TYPOGRAPHY.numericVariant).toBe('tabular-nums');
      expect(TOKENS_CSS).toContain('font-variant-numeric: tabular-nums;');
    });
  });

  describe('movimiento · §13', () => {
    it('conserva las duraciones del documento', () => {
      expect(MOTION.answerSubmitMin).toBe(150);
      expect(MOTION.answerSubmitMax).toBe(220);
      expect(MOTION.sessionResumeMin).toBe(200);
      expect(MOTION.sessionResumeMax).toBe(300);
      expect(MOTION.replanMin).toBe(250);
      expect(MOTION.replanMax).toBe(350);
      expect(MOTION.masteryStateChange).toBe(200);
      expect(MOTION.drawerMin).toBe(180);
      expect(MOTION.drawerMax).toBe(240);
      expect(MOTION.progressRevealMin).toBe(250);
      expect(MOTION.progressRevealMax).toBe(400);
    });

    it('el CSS respeta prefers-reduced-motion · §13', () => {
      expect(TOKENS_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    });
  });

  describe('retícula · §3 «Layout»', () => {
    it('conserva la referencia móvil y el número de columnas', () => {
      expect(LAYOUT.mobile.referenceWidth).toBe(390);
      expect(LAYOUT.mobile.referenceHeight).toBe(844);
      expect(LAYOUT.mobile.columns).toBe(4);
      expect(LAYOUT.mobile.gutter).toBe(12);
      expect(LAYOUT.tablet.columns).toBe(8);
      expect(LAYOUT.desktop.columns).toBe(12);
    });
  });

  it('el mínimo de diana táctil es 44px · §2 y §14', () => {
    expect(TOUCH_TARGET_MIN_PX).toBe(44);
    expect(TOKEN_CONTRACT.touchTargetMinPx).toBe(44);
    expect(TOKENS_CSS).toContain('--so-touch-target-min: 44px;');
  });

  it('§15 y EC-017 · ningún token nombra un anti-patrón prohibido', () => {
    const allTokenNames = [
      ...Object.keys(SPACING),
      ...Object.keys(RADIUS),
      ...Object.keys(MOTION),
      ...Object.keys(BREAKPOINTS),
      ...Object.keys(COLOR),
      ...Object.keys(TYPOGRAPHY.size),
      ...Object.keys(TYPOGRAPHY.weight),
      ...Object.keys(TYPOGRAPHY.family),
    ].map((name) => name.toLowerCase());

    for (const forbidden of TOKEN_CONTRACT.forbiddenTokenSubstrings) {
      const offenders = allTokenNames.filter((name) => name.includes(forbidden));
      expect(offenders, `token prohibido por §15 / EC-017: "${forbidden}"`).toEqual([]);
      expect(TOKENS_CSS.toLowerCase()).not.toContain(`--so-${forbidden}`);
    }
  });

  describe('el espejo CSS no ha divergido del TypeScript', () => {
    it('color', () => {
      for (const [token, value] of Object.entries(COLOR)) {
        expect(TOKENS_CSS, `falta ${cssVar('color', token)}`).toContain(
          `${cssVar('color', token)}: ${value.toLowerCase()};`,
        );
      }
    });

    it('espaciado', () => {
      for (const [token, value] of Object.entries(SPACING)) {
        expect(TOKENS_CSS).toContain(`${cssVar('space', token)}: ${value}px;`);
      }
    });

    it('radio', () => {
      for (const [token, value] of Object.entries(RADIUS)) {
        expect(TOKENS_CSS).toContain(`${cssVar('radius', token)}: ${value}px;`);
      }
    });
  });

  it('el CSS declara un contorno de foco visible · §14', () => {
    expect(TOKENS_CSS).toContain(':focus-visible');
    expect(TOKENS_CSS).toContain('var(--so-color-navy)');
  });
});
