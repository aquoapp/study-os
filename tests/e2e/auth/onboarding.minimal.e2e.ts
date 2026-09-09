import { expect, test } from '@playwright/test';

import { buildSyntheticPack, purgePack, type SyntheticPack } from '../../support/phase1a-fixtures';
import {
  adminClient,
  readTestEnv,
  RUN_ID_ENV_VAR,
  isValidRunId,
  runScopedEmail,
} from '../../support/supabase-test-env';

/**
 * `onboarding.minimal.e2e` · REQ-C01 · gate P2-G7.
 *
 * «Llega al primer plan sin ajustes avanzados.» El recorrido completo con navegador real:
 * alta → onboarding → objetivo y disponibilidad guardados → primera vista, etiquetada como
 * provisional porque en Phase 2 no hay Planner.
 *
 * El pack sintético se publica por la frontera de ingestión antes de la prueba y se purga
 * después: sin contenido publicado no habría nada que elegir, y la pantalla lo diría.
 */

let pack: SyntheticPack | null = null;
let ordinal = 0;
/** Correos dados de alta por este fichero: se borran antes de purgar el pack. */
const createdEmails: string[] = [];

function uniqueEmail(label: string): string {
  const runId = process.env[RUN_ID_ENV_VAR];
  if (!isValidRunId(runId)) {
    throw new Error(`No hay identificador de ejecución (${RUN_ID_ENV_VAR}).`);
  }
  ordinal += 1;
  const scope = `${label}-${test.info().project.name}-w${test.info().workerIndex}`;
  const email = runScopedEmail(String(runId), scope, ordinal);
  createdEmails.push(email);
  return email;
}

const PASSWORD = 'Contrasena-De-Prueba-1!';

test.beforeAll(async () => {
  const env = readTestEnv();
  pack = await buildSyntheticPack(adminClient(env), `e2e${test.info().workerIndex}`);
});

test.afterAll(async () => {
  if (!pack) return;
  const env = readTestEnv();
  const admin = adminClient(env);

  // Primero las cuentas, después el pack. El objetivo de estudio referencia el pack con
  // `RESTRICT`, así que mientras exista un aprendiz con objetivo sobre él la purga se niega
  // —y hace bien: es la misma protección que impide borrar contenido que la evidencia de
  // alguien todavía resuelve—. La limpieza global de la suite borra las cuentas al final,
  // que es más tarde que este `afterAll`, así que este fichero se lleva las suyas.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  for (const user of data.users) {
    if (user.email && createdEmails.includes(user.email)) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(`deleteUser(${user.email}): ${deleteError.message}`);
    }
  }

  await purgePack(admin, pack.packId);
  pack = null;
});

test.describe('onboarding mínimo · REQ-C01', () => {
  test('sin sesión, /onboarding no se abre: exige identidad verificada', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/entrar/);
    await expect(page.getByTestId('onboarding-form')).toHaveCount(0);
  });

  test('alta, objetivo y disponibilidad, y primera vista marcada como provisional', async ({
    page,
  }) => {
    const email = uniqueEmail('onb');

    await page.goto('/registro');
    await page.getByTestId('email-input').fill(email);
    await page.getByTestId('password-input').fill(PASSWORD);
    await page.getByTestId('signup-form').getByRole('button').click();
    await expect(page).toHaveURL(/\/cuenta/);

    await page.goto('/onboarding');
    const form = page.getByTestId('onboarding-form');
    await expect(form).toBeVisible();

    // El pack sintético publicado aparece como opción: nada se inventa si no hay contenido.
    const select = page.getByTestId('pack-select');
    await expect(select).toBeVisible();
    await select.selectOption({ label: `fixture: pack sintético e2e${test.info().workerIndex}` });

    await page.getByTestId('daily-minutes-input').fill('45');
    await page.getByTestId('availability-mon').fill('60');
    await page.getByTestId('availability-wed').fill('30');
    await page.getByTestId('target-date-input').fill('2027-06-01');
    await page.getByTestId('diagnostic-select').selectOption('SKIP');
    await page.getByTestId('onboarding-submit').click();

    // Primera vista: confirma lo acordado y NO promete un plan que no existe (EC-012).
    await expect(page.getByTestId('onboarding-completado')).toBeVisible();
    await expect(page.getByTestId('resumen-minutos')).toHaveText('45');
    await expect(page.getByTestId('resumen-fecha')).toHaveText('2027-06-01');
    const aviso = page.getByTestId('plan-provisional-aviso');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Provisional');
    await expect(aviso).toContainText('no hay un plan calculado');

    // Y no aparece ninguna superficie de producto de Phase 5 ni del First Product Sight.
    for (const espacio of ['HOY', 'APRENDER', 'ENTRENAR', 'PROGRESO', 'PLAN']) {
      await expect(page.getByRole('link', { name: espacio, exact: true })).toHaveCount(0);
    }
  });

  test('al volver, el onboarding recuerda lo guardado y no lo vuelve a pedir', async ({ page }) => {
    const email = uniqueEmail('onb-vuelta');

    await page.goto('/registro');
    await page.getByTestId('email-input').fill(email);
    await page.getByTestId('password-input').fill(PASSWORD);
    await page.getByTestId('signup-form').getByRole('button').click();
    await expect(page).toHaveURL(/\/cuenta/);

    await page.goto('/onboarding');
    await page.getByTestId('pack-select').selectOption({ index: 0 });
    await page.getByTestId('daily-minutes-input').fill('20');
    await page.getByTestId('onboarding-submit').click();
    await expect(page.getByTestId('onboarding-completado')).toBeVisible();

    // Recarga completa: el estado viene del servidor, no de la memoria del navegador.
    await page.reload();
    await expect(page.getByTestId('onboarding-completado')).toBeVisible();
    await expect(page.getByTestId('resumen-minutos')).toHaveText('20');
    await expect(page.getByTestId('onboarding-form')).toHaveCount(0);
  });
});
