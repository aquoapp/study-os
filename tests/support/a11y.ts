import { type Page } from '@playwright/test';

/**
 * Medición de accesibilidad **en el navegador**, compartida por las suites que la necesitan.
 *
 * Vive aquí y no dentro de una suite porque desde el First Product Slice hay dos superficies
 * que medir: las pantallas públicas de Phase 0 y las pantallas de estudio, que exigen sesión.
 * Duplicar el recolector habría hecho que una de las dos midiera peor sin que se notara.
 *
 * Design System §14 · «WCAG-minded AA contrast» y «≥44×44 px targets» como P0. REQ-A06 y
 * REQ-F15. **SD-019 · opción A**.
 */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface TextSample {
  readonly selector: string;
  readonly text: string;
  readonly color: Rgb;
  readonly background: Rgb;
  readonly backgroundFrom: string;
  readonly fontSizePx: number;
  readonly fontWeight: number;
}

export interface ControlSample {
  readonly selector: string;
  readonly label: string;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function hex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * WCAG 2.1: «texto grande» es ≥18pt (24px) o ≥14pt (18.66px) en negrita. Solo el
 * texto grande puede bajar a 3:1; **todo texto normal exige 4.5:1**, sin excepción
 * por ser secundario, de apoyo o descriptivo.
 */
function isLargeText(sample: TextSample): boolean {
  return sample.fontSizePx >= 24 || (sample.fontSizePx >= 18.66 && sample.fontWeight >= 700);
}

/** Colores congelados que SD-019 acota. */
const FROZEN = {
  canvas: { r: 247, g: 243, b: 234 },
  surface: { r: 255, g: 253, b: 249 },
  slate: { r: 102, g: 117, b: 124 },
  teal: { r: 43, g: 140, b: 140 },
  amber: { r: 165, g: 106, b: 24 },
} as const;

function sameColor(a: Rgb, b: Rgb): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export async function collectTextSamples(page: Page): Promise<TextSample[]> {
  return page.evaluate(() => {
    function parse(value: string): { r: number; g: number; b: number; a: number } | null {
      const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i.exec(
        value,
      );
      if (!match) return null;
      return {
        r: Math.round(Number(match[1])),
        g: Math.round(Number(match[2])),
        b: Math.round(Number(match[3])),
        a: match[4] === undefined ? 1 : Number(match[4]),
      };
    }

    /** Sube por los ancestros hasta el primer fondo no transparente. */
    function effectiveBackground(element: Element): {
      color: { r: number; g: number; b: number };
      from: string;
    } {
      let current: Element | null = element;
      while (current) {
        const parsed = parse(getComputedStyle(current).backgroundColor);
        if (parsed && parsed.a > 0) {
          return {
            color: { r: parsed.r, g: parsed.g, b: parsed.b },
            from: current === element ? 'sí mismo' : (current as HTMLElement).tagName.toLowerCase(),
          };
        }
        current = current.parentElement;
      }
      // Sin ningún fondo declarado, el lienzo del navegador es blanco.
      return { color: { r: 255, g: 255, b: 255 }, from: 'lienzo del navegador' };
    }

    function describe(element: Element): string {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : '';
      const cls =
        element.className && typeof element.className === 'string'
          ? `.${element.className.trim().split(/\s+/).join('.')}`
          : '';
      const testId = element.getAttribute('data-testid');
      return `${tag}${id}${cls}${testId ? `[data-testid="${testId}"]` : ''}`;
    }

    const samples: unknown[] = [];

    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      // Solo elementos con texto propio: si el texto está en un hijo, el color
      // que importa es el del hijo.
      const ownText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join('')
        .trim();

      if (ownText === '') continue;

      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (Number(style.opacity) === 0) continue;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // El enlace de salto está fuera de pantalla hasta recibir foco.
      if (rect.bottom < 0 || rect.right < 0) continue;

      const color = parse(style.color);
      if (!color) continue;

      const background = effectiveBackground(element);

      samples.push({
        selector: describe(element),
        text: ownText.slice(0, 60),
        color: { r: color.r, g: color.g, b: color.b },
        background: background.color,
        backgroundFrom: background.from,
        fontSizePx: Number.parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight) || 400,
      });
    }

    return samples;
  }) as Promise<TextSample[]>;
}

export async function collectControls(page: Page): Promise<ControlSample[]> {
  return page.evaluate(() => {
    const selector = 'a[href], button, input, select, textarea, [role="button"]';
    const controls: unknown[] = [];

    for (const element of Array.from(document.querySelectorAll(selector))) {
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Fuera de pantalla: el enlace de salto solo aparece con foco.
      if (rect.bottom < 0 || rect.right < 0) continue;

      const tag = element.tagName.toLowerCase();
      const testId = element.getAttribute('data-testid');
      const label =
        (element.textContent ?? '').trim().slice(0, 40) || element.getAttribute('name') || tag;

      controls.push({
        selector: `${tag}${testId ? `[data-testid="${testId}"]` : ''}`,
        label,
      });
    }

    return controls;
  }) as Promise<ControlSample[]>;
}

// ---------------------------------------------------------------------------
// Auditorías. Se extraen a funciones para que el fixture negativo pueda ejecutar
// exactamente el mismo código contra una página rota a propósito.
// ---------------------------------------------------------------------------

export interface ContrastFailure {
  readonly selector: string;
  readonly text: string;
  readonly ratio: number;
  readonly required: number;
  readonly description: string;
}

export function auditContrast(samples: readonly TextSample[]): ContrastFailure[] {
  const failures: ContrastFailure[] = [];

  for (const sample of samples) {
    const required = isLargeText(sample) ? 3 : 4.5;
    const ratio = contrast(sample.color, sample.background);
    if (ratio >= required) continue;

    failures.push({
      selector: sample.selector,
      text: sample.text,
      ratio,
      required,
      description:
        `${sample.selector} · «${sample.text}»\n` +
        `      color ${hex(sample.color)} sobre ${hex(sample.background)} ` +
        `(fondo de: ${sample.backgroundFrom})\n` +
        `      ${ratio.toFixed(2)}:1 · exigido ${required}:1 ` +
        `(${sample.fontSizePx}px, peso ${sample.fontWeight})`,
    });
  }

  return failures;
}

export function auditSlateOnCanvas(samples: readonly TextSample[]): TextSample[] {
  return samples.filter(
    (sample) =>
      sameColor(sample.color, FROZEN.slate) && sameColor(sample.background, FROZEN.canvas),
  );
}

export function auditTextOnForbiddenBackground(samples: readonly TextSample[]): TextSample[] {
  return samples.filter(
    (sample) =>
      sameColor(sample.background, FROZEN.teal) || sameColor(sample.background, FROZEN.amber),
  );
}

export function auditSlateOffSurface(samples: readonly TextSample[]): TextSample[] {
  return samples
    .filter((sample) => sameColor(sample.color, FROZEN.slate))
    .filter((sample) => !sameColor(sample.background, FROZEN.surface));
}

export const CONTROL_SELECTOR = 'a[href], button, input, select, textarea, [role="button"]';

/** Mide cada control con `boundingBox()`, que es la caja real tras el layout. */
export async function auditTargets(page: Page): Promise<string[]> {
  const failures: string[] = [];

  for (const handle of await page.locator(CONTROL_SELECTOR).all()) {
    if (!(await handle.isVisible())) continue;
    const box = await handle.boundingBox();
    if (!box) continue;
    // El enlace de salto vive fuera de la pantalla hasta recibir foco.
    if (box.y + box.height < 0) continue;

    if (box.width < 44 || box.height < 44) {
      const description =
        (await handle.getAttribute('data-testid')) ??
        (await handle.textContent())?.trim().slice(0, 40) ??
        (await handle.getAttribute('name')) ??
        'sin nombre';
      failures.push(
        `«${description}» · ${box.width.toFixed(1)}×${box.height.toFixed(1)} px · exigido 44×44`,
      );
    }
  }

  return failures;
}
