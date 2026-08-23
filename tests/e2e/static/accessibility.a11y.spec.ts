import { expect, test, type Page } from '@playwright/test';

/**
 * `accessibility.a11y.spec` · contraste y diana táctil **medidos en el navegador**.
 *
 * Design System §14 · «WCAG-minded AA contrast» y «≥44×44 px targets» como P0.
 * REQ-A06 · «contraste AA verificado».
 * **SD-019 · opción A**, autorizada para Phase 0.
 *
 * ---------------------------------------------------------------------------
 * Por qué esta prueba y no la lista de tokens
 *
 * `tokens.contrast.spec` comprueba pares de tokens declarados a mano. Eso no dice
 * nada sobre lo que ve una persona: un texto puede heredar un color que nadie
 * declaró, caer sobre un fondo distinto del previsto, o quedar sobre el fondo de
 * página porque el contenedor no pintaba nada.
 *
 * Aquí se recorre el DOM del build de producción, se lee el **color computado real**
 * de cada texto visible y su **fondo efectivo** —subiendo por los ancestros hasta
 * encontrar uno no transparente— y se calcula el contraste sobre esos valores. Si
 * alguien vuelve a poner `slate` sobre `canvas`, o texto sobre `teal`, esto falla
 * aunque los tokens sigan siendo correctos.
 *
 * La diana táctil se mide con `boundingBox()`, que es la caja real tras el layout,
 * no la altura declarada en CSS.
 * ---------------------------------------------------------------------------
 */

/**
 * Rutas de Phase 0 que no requieren Supabase. `/cuenta` redirige a `/entrar`.
 *
 * `hasControls` es explícito porque `/offline` no tiene ninguno: es una pantalla
 * de estado sin acciones. Exigir controles ahí sería inventar un requisito.
 */
const ROUTES = [
  { path: '/', hasControls: true },
  { path: '/entrar', hasControls: true },
  { path: '/registro', hasControls: true },
  { path: '/offline', hasControls: false },
] as const;

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface TextSample {
  readonly selector: string;
  readonly text: string;
  readonly color: Rgb;
  readonly background: Rgb;
  readonly backgroundFrom: string;
  readonly fontSizePx: number;
  readonly fontWeight: number;
}

interface ControlSample {
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

function contrast(a: Rgb, b: Rgb): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function hex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * WCAG 2.1: «texto grande» es ≥18pt (24px) o ≥14pt (18.66px) en negrita. Solo el
 * texto grande puede bajar a 3:1; el resto necesita 4.5:1.
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

async function collectTextSamples(page: Page): Promise<TextSample[]> {
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

async function collectControls(page: Page): Promise<ControlSample[]> {
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

test.describe('accesibilidad renderizada · REQ-A06 · Design System §14 · SD-019 opción A', () => {
  for (const { path: route, hasControls } of ROUTES) {
    test.describe(route, () => {
      test('todo texto visible alcanza el contraste que le corresponde', async ({ page }) => {
        await page.goto(route);
        const samples = await collectTextSamples(page);

        expect(samples.length, `${route} no tiene texto visible que medir`).toBeGreaterThan(0);

        const failures: string[] = [];

        for (const sample of samples) {
          const required = isLargeText(sample) ? 3 : 4.5;
          const ratio = contrast(sample.color, sample.background);

          if (ratio < required) {
            failures.push(
              `${sample.selector} · «${sample.text}»\n` +
                `      color ${hex(sample.color)} sobre ${hex(sample.background)} ` +
                `(fondo de: ${sample.backgroundFrom})\n` +
                `      ${ratio.toFixed(2)}:1 · exigido ${required}:1 ` +
                `(${sample.fontSizePx}px, peso ${sample.fontWeight})`,
            );
          }
        }

        expect(
          failures,
          `${failures.length} texto(s) por debajo del contraste exigido en ${route}:\n\n${failures.join('\n\n')}`,
        ).toEqual([]);
      });

      test('SD-019 · no reaparece slate sobre canvas ni texto sobre teal o amber', async ({
        page,
      }) => {
        await page.goto(route);
        const samples = await collectTextSamples(page);

        const slateOnCanvas = samples.filter(
          (sample) =>
            sameColor(sample.color, FROZEN.slate) && sameColor(sample.background, FROZEN.canvas),
        );
        expect(
          slateOnCanvas.map((sample) => `${sample.selector} · «${sample.text}»`),
          'slate sobre canvas da 4.31:1 · SD-019 opción A lo prohíbe',
        ).toEqual([]);

        const onForbiddenBackground = samples.filter(
          (sample) =>
            sameColor(sample.background, FROZEN.teal) || sameColor(sample.background, FROZEN.amber),
        );
        expect(
          onForbiddenBackground.map((sample) => `${sample.selector} · «${sample.text}»`),
          'teal y amber no admiten texto normal · SD-019 opción A',
        ).toEqual([]);
      });

      test('slate solo aparece como texto sobre surface', async ({ page }) => {
        await page.goto(route);
        const samples = await collectTextSamples(page);

        const misplaced = samples
          .filter((sample) => sameColor(sample.color, FROZEN.slate))
          .filter((sample) => !sameColor(sample.background, FROZEN.surface));

        expect(
          misplaced.map((sample) => `${sample.selector} sobre ${hex(sample.background)}`),
          'slate como texto solo alcanza AA sobre surface',
        ).toEqual([]);
      });

      test('todo control interactivo visible alcanza 44×44 px', async ({ page }) => {
        await page.goto(route);
        const controls = await collectControls(page);

        if (hasControls) {
          expect(controls.length, `${route} debería tener controles y no tiene`).toBeGreaterThan(0);
        } else {
          expect(controls.length, `${route} no debería tener controles`).toBe(0);
        }

        const failures: string[] = [];

        // Se mide con `boundingBox()` sobre cada control real, no sobre el CSS.
        const selector = 'a[href], button, input, select, textarea, [role="button"]';
        const handles = await page.locator(selector).all();

        for (const handle of handles) {
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

        expect(
          failures,
          `${failures.length} control(es) por debajo de 44×44 en ${route}:\n\n${failures.join('\n')}`,
        ).toEqual([]);
      });
    });
  }

  test('el enlace de salto alcanza 44×44 cuando recibe foco', async ({ page }) => {
    // Está fuera de pantalla hasta entonces, así que se mide en su estado usable.
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skip = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(skip).toBeFocused();

    const box = await skip.boundingBox();
    expect(box, 'el enlace de salto no tiene caja').not.toBeNull();
    expect(box!.height, `alto ${box!.height}`).toBeGreaterThanOrEqual(44);
    expect(box!.width, `ancho ${box!.width}`).toBeGreaterThanOrEqual(44);
  });
});
