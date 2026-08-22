import { expect, test } from '@playwright/test';

/**
 * `app.boot.e2e` · gate **P0-G1** · «La app arranca».
 *
 * REQ-A02. Es el gate más simple del proyecto y por eso conviene que sea estricto:
 * comprueba que arranca **sin errores de consola** y que la superficie mínima está
 * presente, no solo que devuelve 200.
 */

test.describe('app.boot · gate P0-G1', () => {
  test('la raíz responde y monta la aplicación', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('app-root')).toBeVisible();
    await expect(page.getByTestId('phase-marker')).toHaveText('Phase 0 · Foundation');
    expect(consoleErrors, `errores de consola: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('declara idioma y título', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveTitle(/Study OS/);
  });

  test('el enlace de salto al contenido es accesible por teclado', async ({ page }) => {
    // Manifest §20 · navegación por teclado y orden de foco.
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  });

  test('la ruta protegida redirige a entrar cuando no hay identidad verificada', async ({
    page,
  }) => {
    // INV-116 · el proxy decide sobre identidad verificada en servidor.
    await page.goto('/cuenta');
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('la página sin conexión existe y no promete sincronización', async ({ page }) => {
    // EC-012 · la UI no afirma sincronización sin confirmación.
    await page.goto('/offline');
    await expect(page.getByTestId('offline-page')).toBeVisible();
    await expect(page.getByText(/sincroniz/i)).toHaveCount(0);
  });

  test('cabeceras de seguridad presentes', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
  });
});
