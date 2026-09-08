import { expect, test } from '@playwright/test';

/**
 * `auth.signup-login.e2e` · check de CI `test:e2e`.
 *
 * REQ-A07 · «Alta y login funcionan; `profiles` 1:1 con `auth.users`».
 * P0-S5. Recorre alta → sesión → cierre de sesión → login, y comprueba que la
 * identidad mostrada procede de una verificación en servidor (INV-116).
 */

import { RUN_ID_ENV_VAR, isValidRunId, runScopedEmail } from '../../support/supabase-test-env';

/**
 * Correo marcado con la ejecución en curso.
 *
 * Si el identificador no llegó, la suite se detiene aquí. Un correo sin marca no
 * lo puede reclamar ninguna limpieza: quedaría huérfano, o —peor— lo borraría la
 * limpieza de otra ejecución.
 */
let ordinal = 0;

function uniqueEmail(label: string): string {
  const runId = process.env[RUN_ID_ENV_VAR];
  if (!isValidRunId(runId)) {
    throw new Error(
      'No hay identificador de ejecución (' +
        RUN_ID_ENV_VAR +
        '). El global-setup de auth es quien lo publica: sin él, los usuarios que cree ' +
        'esta suite no se pueden atribuir a nadie y la limpieza no puede llevárselos.',
    );
  }
  ordinal += 1;
  // El ordinal vive en el proceso del worker. Playwright arranca otro worker por
  // proyecto (móvil, escritorio) y tras cada reintento, y ahí el ordinal vuelve a 1:
  // el segundo proyecto repetía el correo que el primero ya había dado de alta y se
  // quedaba en /registro (CI run 34230693848). El proyecto y el índice del worker
  // forman parte del correo para que dos workers no puedan coincidir.
  const scope = `${label}-${test.info().project.name}-w${test.info().workerIndex}`;
  return runScopedEmail(String(runId), scope, ordinal);
}

const PASSWORD = 'Contrasena-De-Prueba-1!';

test.describe('auth.signup-login · REQ-A07 · INV-116', () => {
  test('alta, sesión verificada, cierre y vuelta a entrar', async ({ page }) => {
    const email = uniqueEmail('e2e');

    // --- Alta ---------------------------------------------------------------
    await page.goto('/registro');
    await page.getByTestId('email-input').fill(email);
    await page.getByTestId('password-input').fill(PASSWORD);
    await page.getByTestId('submit-button').click();

    await expect(page).toHaveURL(/\/cuenta/);

    // La identidad se muestra con el método que la verificó: getClaims o getUser.
    // Nunca «session».
    const method = await page.getByTestId('verification-method').textContent();
    expect(['getClaims', 'getUser']).toContain(method?.trim());

    // --- Perfil 1:1 ---------------------------------------------------------
    const userId = (await page.getByTestId('user-id').textContent())?.trim();
    const profileId = (await page.getByTestId('profile-id').textContent())?.trim();

    expect(userId).toBeTruthy();
    expect(profileId, 'el perfil debe existir tras el alta').toBe(userId);
    await expect(page.getByTestId('profile-error')).toHaveCount(0);
    await expect(page.getByTestId('profile-locale')).toHaveText('es');

    // --- Cierre de sesión ---------------------------------------------------
    await page.getByTestId('signout-button').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('session-state')).toHaveAttribute('data-authenticated', 'false');

    // La ruta protegida vuelve a estar cerrada.
    await page.goto('/cuenta');
    await expect(page).toHaveURL(/\/entrar/);

    // --- Login --------------------------------------------------------------
    await page.getByTestId('email-input').fill(email);
    await page.getByTestId('password-input').fill(PASSWORD);
    await page.getByTestId('submit-button').click();

    await expect(page).toHaveURL(/\/cuenta/);
    await expect(page.getByTestId('user-id')).toHaveText(userId ?? '');
  });

  test('unas credenciales incorrectas no crean sesión y se explican con texto', async ({
    page,
  }) => {
    await page.goto('/entrar');
    await page.getByTestId('email-input').fill(uniqueEmail('e2e'));
    await page.getByTestId('password-input').fill('contrasena-que-no-existe');
    await page.getByTestId('submit-button').click();

    // INV-105 · el estado no se comunica solo por color: hay un `role="alert"` con texto.
    await expect(page.getByTestId('auth-error')).toBeVisible();
    await expect(page).toHaveURL(/\/entrar/);

    await page.goto('/cuenta');
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('una sesión iniciada no se queda en las pantallas de autenticación', async ({ page }) => {
    const email = uniqueEmail('e2e');

    await page.goto('/registro');
    await page.getByTestId('email-input').fill(email);
    await page.getByTestId('password-input').fill(PASSWORD);
    await page.getByTestId('submit-button').click();
    await expect(page).toHaveURL(/\/cuenta/);

    await page.goto('/entrar');
    await expect(page).toHaveURL(/\/cuenta/);
  });

  test('INV-104 · una sola acción primaria por vista en el formulario', async ({ page }) => {
    await page.goto('/entrar');
    await expect(page.getByTestId('submit-button')).toHaveCount(1);
  });

  test('los campos declaran etiqueta y autocompletado', async ({ page }) => {
    await page.goto('/entrar');
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByTestId('password-input')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });
});
