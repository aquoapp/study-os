import { expect, test } from '@playwright/test';

/**
 * `pwa.manifest.spec` · gate **P0-G1** · REQ-A02
 * «Arranca; manifest PWA válido e instalable».
 */

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface WebManifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
}

test.describe('pwa.manifest · gate P0-G1 · REQ-A02', () => {
  test('el documento enlaza el manifest', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      /manifest\.webmanifest/,
    );
  });

  test('el manifest cumple los mínimos de instalabilidad', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as WebManifest;

    expect(manifest.name).toBe('Study OS');
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    // `standalone` (o `fullscreen`) es requisito de instalabilidad.
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('declara los iconos de 192 y 512 y uno maskable', async ({ request }) => {
    const manifest = (await (await request.get('/manifest.webmanifest')).json()) as WebManifest;

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    const maskable = manifest.icons.find((icon) => icon.purpose?.includes('maskable'));
    expect(maskable, 'falta un icono maskable: Android recortaría el logotipo').toBeDefined();
  });

  test('todos los iconos declarados existen y son PNG del tamaño anunciado', async ({
    request,
  }) => {
    const manifest = (await (await request.get('/manifest.webmanifest')).json()) as WebManifest;

    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.status(), `${icon.src} no se sirve`).toBe(200);

      const body = await response.body();
      // Firma PNG.
      expect(body.subarray(1, 4).toString('latin1'), `${icon.src} no es un PNG`).toBe('PNG');

      // Ancho y alto viven en el chunk IHDR, en los bytes 16..24.
      const width = body.readUInt32BE(16);
      const height = body.readUInt32BE(20);
      const [declaredWidth, declaredHeight] = icon.sizes.split('x').map(Number);

      expect(width, `${icon.src}: ancho real ${width}, declarado ${declaredWidth}`).toBe(
        declaredWidth,
      );
      expect(height, `${icon.src}: alto real ${height}, declarado ${declaredHeight}`).toBe(
        declaredHeight,
      );
    }
  });

  test('el service worker se sirve y no se cachea', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-cache');
  });

  test('el service worker no cachea rutas de autenticación ni de datos', async ({ request }) => {
    // EC-012 · offline acotado. Un service worker generoso rompe el invariante sin avisar.
    const source = await (await request.get('/sw.js')).text();
    expect(source).toContain("url.pathname.startsWith('/auth')");
    expect(source).toContain("url.pathname.startsWith('/api')");
  });

  test('el viewport permite el zoom del usuario', async ({ page }) => {
    // Manifest §20 · accesibilidad. Bloquear el zoom es una barrera, no un detalle.
    await page.goto('/');
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('width=device-width');
    expect(content ?? '').not.toContain('user-scalable=no');
    expect(content ?? '').not.toContain('maximum-scale=1');
  });
});
