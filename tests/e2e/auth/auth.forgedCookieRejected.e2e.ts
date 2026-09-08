import { expect, test } from '@playwright/test';

/**
 * `auth.forgedCookieRejected.e2e` · enforcement 2 de **INV-116** (SD-016):
 * «rechazo de cookie o sesión manipulada».
 *
 * Este es el test que distingue una identidad *verificada* de una identidad
 * *declarada*. Con `getSession()` una cookie fabricada produciría una identidad
 * válida a ojos de la aplicación; con `getClaims()`/`getUser()` la firma no cuadra
 * y el acceso se deniega.
 *
 * REQ-A07 · EC-009 · Manifest §14.
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
  // Ver la nota equivalente en auth.signup-login.e2e.ts: el ordinal es por worker y
  // el segundo proyecto de Playwright repetía el correo del primero.
  const scope = `${label}-${test.info().project.name}-w${test.info().workerIndex}`;
  return runScopedEmail(String(runId), scope, ordinal);
}

const PASSWORD = 'Contrasena-De-Prueba-1!';

test.describe('auth.forgedCookieRejected · INV-116', () => {
  test('una cookie de sesión alterada no concede acceso', async ({ page, context }) => {
    // 1 · sesión legítima
    await page.goto('/registro');
    await page.getByTestId('email-input').fill(uniqueEmail('forge'));
    await page.getByTestId('password-input').fill(PASSWORD);
    await page.getByTestId('submit-button').click();
    await expect(page).toHaveURL(/\/cuenta/);

    const legitimateUserId = (await page.getByTestId('user-id').textContent())?.trim();
    expect(legitimateUserId).toBeTruthy();

    // 2 · manipular la cookie de auth
    const cookies = await context.cookies();
    const authCookies = cookies.filter((cookie) => cookie.name.includes('auth-token'));
    expect(authCookies.length, 'no se encontró la cookie de sesión de Supabase').toBeGreaterThan(0);

    await context.clearCookies();
    await context.addCookies(
      authCookies.map((cookie) => ({
        ...cookie,
        // Alterar la carga útil invalida la firma. Un verificador real lo detecta;
        // `getSession()` no.
        value: `${cookie.value.slice(0, -6)}AAAAAA`,
      })),
    );

    // 3 · la ruta protegida debe cerrarse
    await page.goto('/cuenta');
    await expect(page).toHaveURL(/\/entrar/);
    await expect(page.getByTestId('user-id')).toHaveCount(0);
  });

  test('una cookie de sesión inventada no concede acceso', async ({ page, context }) => {
    await context.clearCookies();

    const fabricated = Buffer.from(
      JSON.stringify({
        access_token: 'no-es-un-token',
        token_type: 'bearer',
        user: { id: '00000000-0000-4000-8000-00000000dead', email: 'intruso@example.test' },
      }),
      'utf8',
    ).toString('base64');

    await context.addCookies([
      {
        name: 'sb-127-auth-token',
        value: `base64-${fabricated}`,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/cuenta');
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('sin cookie alguna, la ruta protegida está cerrada', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/cuenta');
    await expect(page).toHaveURL(/\/entrar/);
  });
});
