/**
 * Cálculo de contraste WCAG 2.1.
 *
 * Vive en el paquete, no en el test, porque la comprobación de contraste debe poder
 * ejecutarse también en tiempo de desarrollo y no solo en CI.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function parseHexColor(hex: string): Rgb {
  const normalized = hex.trim().replace(/^#/, '');

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Color hexadecimal inválido: "${hex}"`);
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function channelLuminance(value8Bit: number): number {
  const channel = value8Bit / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa según WCAG 2.1. */
export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

/** Razón de contraste entre dos colores hexadecimales. Rango [1, 21]. */
export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(parseHexColor(foregroundHex));
  const l2 = relativeLuminance(parseHexColor(backgroundHex));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(
  foregroundHex: string,
  backgroundHex: string,
  minRatio: number,
): boolean {
  return contrastRatio(foregroundHex, backgroundHex) >= minRatio;
}
