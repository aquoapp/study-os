import { expect, test, type Page } from '@playwright/test';

import { buildSyntheticPack, purgePack, type SyntheticPack } from '../../support/phase1a-fixtures';
import { publishLearningUnit } from '../../support/phase2-fixtures';
import {
  adminClient,
  readTestEnv,
  RUN_ID_ENV_VAR,
  isValidRunId,
  runScopedEmail,
} from '../../support/supabase-test-env';

/**
 * `fps.vertical.e2e` · gates FPS-G3 … FPS-G6 y FPS-G8 · el recorrido real en navegador.
 *
 * Esta es la prueba que dice si el First Product Slice es un producto o una demostración de
 * base de datos: una persona se da de alta, elige qué prepara, estudia, responde, ve la
 * corrección, **se va a la mitad**, vuelve y termina. Nada se simula: la sesión, los eventos,
 * la corrección y la reanudación son los del servidor.
 *
 * La interrupción no es un extra. Un vertical que solo funciona de un tirón no sirve para
 * estudiar de verdad, así que aquí se corta dos veces: antes de enviar una respuesta y entre
 * el envío y la corrección, que es el punto donde el cursor del servidor ya ha avanzado.
 */

let pack: SyntheticPack | null = null;
let ordinal = 0;
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

/** Términos que jamás deben aparecer en una pantalla del vertical. */
const PROHIBIDOS = [
  /racha/i,
  /has fallado/i,
  /sesión fallida/i,
  /atrasad/i,
  /perdiste/i,
  /confeti/i,
  /trofeo/i,
  /insignia/i,
  /puntuación/i,
  /nivel global/i,
  /dominio/i,
  /preparación para el examen/i,
];

/** Ningún identificador, JSON ni término interno visible (FPS-G8). */
const INTERNOS = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
  /session_item|learning_event|question_attempt|append_learning_event|create_study_session/,
  /supabase|postgres|rls|migration/i,
];

async function assertProductSurface(page: Page): Promise<void> {
  const body = (await page.locator('body').innerText()).trim();
  for (const pattern of PROHIBIDOS) {
    expect(body, `copy prohibido: ${pattern}`).not.toMatch(pattern);
  }
  for (const pattern of INTERNOS) {
    expect(body, `interno visible: ${pattern}`).not.toMatch(pattern);
  }
  // Una sola acción dominante (INV-104): además de ella, como mucho una salida textual.
  // Las opciones y los niveles de confianza son `role="radio"`, no acciones.
  const acciones = await page.locator('button:not([role="radio"]):not([disabled])').count();
  expect(acciones, 'hay más de una acción y una salida en la pantalla').toBeLessThanOrEqual(2);
  // Y sin desbordamiento horizontal.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow, 'la página desborda horizontalmente').toBe(false);
}

async function registerAndOnboard(page: Page, label: string): Promise<void> {
  const email = uniqueEmail(label);
  await page.goto('/registro');
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(PASSWORD);
  await page.getByTestId('signup-form').getByRole('button').click();
  await expect(page).toHaveURL(/\/cuenta/);

  await page.goto('/onboarding');
  await page
    .getByTestId('pack-select')
    .selectOption({ label: `fixture: pack sintético fps-e2e${test.info().workerIndex}` });
  await page.getByTestId('daily-minutes-input').fill('30');
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByTestId('onboarding-completado')).toBeVisible();

  await page.getByTestId('onboarding-ir-a-hoy').click();
  await expect(page).toHaveURL(/\/hoy/);
}

test.beforeAll(async () => {
  const env = readTestEnv();
  const admin = adminClient(env);
  pack = await buildSyntheticPack(admin, `fps-e2e${test.info().workerIndex}`);
  await publishLearningUnit(admin, pack, 0, 'e2e-uno');
  await publishLearningUnit(admin, pack, 1, 'e2e-dos');
});

test.afterAll(async () => {
  if (!pack) return;
  const env = readTestEnv();
  const admin = adminClient(env);
  // Las cuentas primero: la evidencia fija el contenido con RESTRICT.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  for (const user of data.users) {
    if (user.email && createdEmails.includes(user.email)) {
      const removed = await admin.auth.admin.deleteUser(user.id);
      if (removed.error) throw new Error(`deleteUser: ${removed.error.message}`);
    }
  }
  await purgePack(admin, pack.packId);
});

test.describe('First Product Slice · el recorrido completo', () => {
  test('las rutas del vertical exigen identidad verificada', async ({ page }) => {
    for (const route of ['/hoy', '/aprender/1', '/comprobar/1', '/fin']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/entrar/);
    }
  });

  test('estudiar, responder, interrumpir, volver y terminar', async ({ page }) => {
    await registerAndOnboard(page, 'fps');

    // ---------------------------------------------------------------- HOY
    await expect(page.getByTestId('hoy-titulo')).toHaveText('Hoy');
    await expect(page.getByTestId('hoy-provisional')).toContainText('Sesión fija');
    await expect(page.getByTestId('hoy-preview')).toContainText('unidades para leer');
    await assertProductSurface(page);

    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/aprender\/1/);

    // ------------------------------------------------------------- APRENDER
    await expect(page.getByTestId('aprender-cuerpo')).toBeVisible();
    const primeraUnidad = await page.getByTestId('aprender-titulo').innerText();
    await assertProductSurface(page);

    // Una recarga vuelve a mostrar exactamente la misma versión vinculada.
    await page.reload();
    await expect(page.getByTestId('aprender-titulo')).toHaveText(primeraUnidad);

    await page.getByTestId('aprender-continuar').click();
    await expect(page).toHaveURL(/\/aprender\/2/);
    await page.getByTestId('aprender-continuar').click();
    await expect(page).toHaveURL(/\/comprobar\/3/);

    // ------------------------------------------------------------ COMPROBAR
    await expect(page.getByTestId('comprobar-enunciado')).toBeVisible();
    // Antes de responder no hay ninguna señal de corrección en la pantalla.
    const antes = await page.locator('body').innerText();
    expect(antes).not.toMatch(/correcto|incorrecto|respuesta correcta|explicación/i);
    await assertProductSurface(page);

    // Sin confianza no se puede comprobar, y la pantalla dice por qué (INV-102).
    await expect(page.getByTestId('comprobar')).toBeDisabled();
    await expect(page.getByTestId('falta-confianza')).toBeVisible();

    await page.getByTestId('opcion-A').click();
    await expect(page.getByTestId('opcion-A')).toHaveAttribute('aria-checked', 'true');

    // ---- Interrupción 1: antes de enviar. Al volver, la elección sigue ahí.
    await page.getByTestId('dejarlo').click();
    await expect(page).toHaveURL(/\/hoy/);
    await expect(page.getByTestId('hoy-continuar')).toContainText('Te quedaste aquí');
    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/comprobar\/3/);
    await expect(page.getByTestId('opcion-A')).toHaveAttribute('aria-checked', 'true');

    await page.getByTestId('confianza-3').click();
    await expect(page.getByTestId('comprobar')).toBeEnabled();
    await page.getByTestId('comprobar').click();

    // -------------------------------------------------------------- FEEDBACK
    await expect(page.getByTestId('feedback')).toBeVisible();
    await expect(page.getByTestId('resultado')).toBeVisible();
    await expect(page.getByTestId('respuesta-correcta')).not.toBeEmpty();
    await expect(page.getByTestId('explicacion')).not.toBeEmpty();
    await expect(page.getByTestId('calibracion')).toContainText('Bastante');
    await assertProductSurface(page);

    // ---- Interrupción 2: entre el envío y la corrección. El cursor del servidor ya
    // apunta a la pregunta siguiente, y aun así la corrección pendiente se muestra antes.
    await page.goto('/hoy');
    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/comprobar\/3/);
    await expect(page.getByTestId('feedback')).toBeVisible();
    await expect(page.getByTestId('respuesta-correcta')).not.toBeEmpty();

    await page.getByTestId('feedback-siguiente').click();
    await expect(page).toHaveURL(/\/comprobar\/4/);

    // ---- Segunda pregunta: en blanco, que es una respuesta legítima.
    await page.getByTestId('confianza-1').click();
    await page.getByTestId('comprobar').click();
    await expect(page.getByTestId('resultado')).toContainText('Sin responder');
    await expect(page.getByTestId('tu-respuesta')).toContainText('No respondiste');
    await expect(page.getByTestId('respuesta-correcta')).not.toBeEmpty();
    await page.getByTestId('feedback-siguiente').click();

    // ---- Tercera pregunta: la última.
    await expect(page).toHaveURL(/\/comprobar\/5/);
    await page.getByTestId('opcion-B').click();
    await page.getByTestId('confianza-4').click();
    await page.getByTestId('comprobar').click();
    await expect(page.getByTestId('feedback')).toBeVisible();
    await expect(page.getByTestId('feedback-siguiente')).toHaveText('Terminar la sesión');
    await page.getByTestId('feedback-siguiente').click();

    // ------------------------------------------------------------------ FIN
    await expect(page).toHaveURL(/\/fin/);
    await page.getByTestId('fin-cerrar').click();
    await expect(page.getByTestId('fin-titulo')).toHaveText('Sesión terminada');
    await expect(page.getByTestId('resumen')).toContainText('Unidades leídas');
    await expect(page.getByTestId('resumen')).toContainText('Preguntas respondidas');
    await expect(page.getByTestId('fin-cierre')).toContainText('Todavía no hay un plan');
    await assertProductSurface(page);

    // Una sesión terminada no reanuda: HOY vuelve a ofrecer empezar.
    await page.getByTestId('fin-volver').click();
    await expect(page).toHaveURL(/\/hoy/);
    await expect(page.getByTestId('hoy-primaria')).toHaveText('Empezar la sesión');
  });
});
