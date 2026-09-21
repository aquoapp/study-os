import { expect, test, type Page } from '@playwright/test';

import { buildSyntheticPack, purgePack, type SyntheticPack } from '../../support/phase1a-fixtures';
import { publishLearningUnit } from '../../support/phase2-fixtures';
import { query } from '../../support/sql';
import {
  auditContrast,
  auditSlateOffSurface,
  auditSlateOnCanvas,
  auditTargets,
  auditTextOnForbiddenBackground,
  collectTextSamples,
} from '../../support/a11y';
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
  // Accesibilidad medida, no declarada (REQ-F15): contraste real de cada texto visible y
  // caja real de cada control tras el layout.
  const samples = await collectTextSamples(page);
  expect(samples.length, 'la pantalla no tiene texto que medir').toBeGreaterThan(0);
  expect(auditContrast(samples).map((failure) => failure.description)).toEqual([]);
  expect(auditSlateOnCanvas(samples).map((sample) => sample.selector)).toEqual([]);
  expect(auditTextOnForbiddenBackground(samples).map((sample) => sample.selector)).toEqual([]);
  expect(auditSlateOffSurface(samples).map((sample) => sample.selector)).toEqual([]);
  expect(await auditTargets(page)).toEqual([]);

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
  // Phase 4B · §I.1 · sin zona declarada no existe «hoy» y el Planner se niega, con razón.
  await page.getByTestId('timezone-select').selectOption('Europe/Madrid');
  await page.getByTestId('daily-minutes-input').fill('60');
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByTestId('onboarding-completado')).toBeVisible();

  await page.getByTestId('onboarding-ir-a-hoy').click();
  await expect(page).toHaveURL(/\/hoy/);
}

test.beforeAll(async () => {
  const env = readTestEnv();
  const admin = adminClient(env);
  pack = await buildSyntheticPack(admin, `fps-e2e${test.info().workerIndex}`);
  // ADR-013 · la duración es metadato de autoría y la frontera de ingestión la exige.
  await publishLearningUnit(admin, pack, 0, 'e2e-uno', { minutes: 5 });
  await publishLearningUnit(admin, pack, 1, 'e2e-dos', { minutes: 5 });
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

test.describe('Phase 4B · el bucle real del producto', () => {
  test('las rutas del vertical exigen identidad verificada', async ({ page }) => {
    for (const route of ['/hoy', '/aprender/1', '/comprobar/1', '/fin', '/ajustes']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/entrar/);
    }
  });

  /**
   * El recorrido que la autorización describe como objetivo, contra el Planner real.
   *
   * **Lo que cambia respecto al FPS, y no es cosmético.** La sesión fija daba siempre dos unidades
   * y tres preguntas. El Planner da lo que la evidencia justifica, y para alguien que acaba de
   * empezar eso es **solo APRENDER**: con granularidad híbrida (P4-D3), un concepto `NEW` recibe
   * APRENDER, nunca APRENDER + COMPROBAR. COMPROBAR llega cuando el concepto está `EXPOSED`, y para
   * estarlo hace falta haber completado su lectura.
   *
   * Por eso este recorrido tiene dos días. El primero se lee; el segundo se comprueba. Que haya que
   * escribirlo así **es** la prueba de que el plan responde a la evidencia y no a un guion.
   */
  test('día 1 · leer lo que el Planner elige, interrumpir, volver y cerrar', async ({ page }) => {
    await registerAndOnboard(page, 'p4b');

    // ---------------------------------------------------------------- HOY · S5
    await expect(page.getByTestId('hoy-titulo')).toHaveText('Hoy');
    await expect(page.getByTestId('hoy-plan')).toBeVisible();
    // La naturaleza de la acción, en términos de la persona. Dos conceptos nuevos: dos acciones.
    await expect(page.getByTestId('hoy-siguiente')).toContainText('Aprender');
    await expect(page.getByTestId('hoy-forma-sesion')).toContainText('2 acciones');
    await expect(page.getByTestId('hoy-razon')).toContainText('nuevo');
    await assertProductSurface(page);

    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/aprender\/1/);

    // ------------------------------------------------------------- APRENDER · S13
    await expect(page.getByTestId('aprender-cuerpo')).toBeVisible();
    // UX-INV-24 · la posición es de la **acción**, no del ítem ni de la ruta.
    await expect(page.getByTestId('accion-posicion')).toHaveText('Acción 1 de 2');
    // UX-INV-17 · una acción de un solo paso **no** muestra indicador de fase.
    await expect(page.getByTestId('accion-fase')).toHaveCount(0);
    const primeraUnidad = await page.getByTestId('aprender-titulo').innerText();
    await assertProductSurface(page);

    // INV-117 · una recarga vuelve a mostrar exactamente la versión que el Planner fijó.
    await page.reload();
    await expect(page.getByTestId('aprender-titulo')).toHaveText(primeraUnidad);

    // ---- Interrupción: dejarlo por ahora. La sesión sigue abierta, sin juicio.
    await page.getByTestId('dejarlo').click();
    await expect(page).toHaveURL(/\/hoy/);
    // UX-INV-19 · S10 no llama a la sesión abierta «el plan de hoy».
    await expect(page.getByTestId('hoy-retomar')).toContainText('Te quedaste');
    await assertProductSurface(page);

    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/aprender\/1/);
    await expect(page.getByTestId('aprender-titulo')).toHaveText(primeraUnidad);

    await page.getByTestId('aprender-continuar').click();
    await expect(page).toHaveURL(/\/aprender\/2/);
    await expect(page.getByTestId('accion-posicion')).toHaveText('Acción 2 de 2');
    await expect(page.getByTestId('aprender-titulo')).not.toHaveText(primeraUnidad);

    // ------------------------------------------------------------------ FIN · S16
    // UX-INV-18 · **sin pantalla previa**: la acción cierra y aterriza en el resumen.
    await page.getByTestId('aprender-continuar').click();
    await expect(page).toHaveURL(/\/fin/);
    await expect(page.getByTestId('fin-titulo')).toHaveText('Sesión terminada');
    await expect(page.getByTestId('resumen')).toContainText('Unidades leídas');
    // El cierre ya no dice que no hay plan: eso era cierto en el FPS y es falso ahora.
    await expect(page.getByTestId('fin-cierre')).not.toContainText('Todavía no hay un plan');
    await assertProductSurface(page);

    // ---- Vuelta a HOY el mismo día: los dos conceptos se trabajaron hoy, así que no hay nada
    // que recomendar. Es vacío **veraz**, y S8 no ofrece ninguna acción (UX-INV-23).
    await page.getByTestId('fin-volver').click();
    await expect(page).toHaveURL(/\/hoy/);
    await expect(page.getByTestId('hoy-nada-elegible')).toBeVisible();
    await expect(page.getByTestId('hoy-primaria')).toHaveCount(0);
    await expect(page.getByTestId('tiempo-hoy-abrir')).toHaveCount(0);
    // Y no insinúa que haya terminado ni que esté preparada.
    const vacio = await page.locator('body').innerText();
    expect(vacio).not.toMatch(/preparad|list[oa] para|domina|has terminado|temario completo/i);
    await assertProductSurface(page);
  });

  /**
   * Día 2 · la evidencia mueve el plan.
   *
   * El paso del día se simula como en `planner.runtime.spec`: se retrasan dos días los
   * `completed_at` de los ítems completados. Es **estado de sesión**, no evidencia: ningún evento
   * ni intento se toca, de modo que lo que el motor plegó sigue igual y lo único que cambia es que
   * esos conceptos dejan de contar como trabajados hoy.
   */
  test('día 2 · el Planner pide comprobar lo que se leyó, y la corrección es veraz', async ({
    page,
  }) => {
    await registerAndOnboard(page, 'p4b-d2');

    // Día 1, abreviado: leer las dos unidades y cerrar.
    await page.getByTestId('hoy-primaria').click();
    await page.getByTestId('aprender-continuar').click();
    await page.getByTestId('aprender-continuar').click();
    await expect(page).toHaveURL(/\/fin/);

    // Pasa el día.
    const email = createdEmails[createdEmails.length - 1];
    query(
      `update public.session_items si set completed_at = si.completed_at - interval '2 days'
         where si.status = 'COMPLETED' and si.user_id = (
           select id from auth.users where email = '${email}'
         )
         returning si.id`,
    );

    await page.goto('/hoy');
    // Los dos conceptos están ahora EXPOSED: la necesidad es verificación, y la acción COMPROBAR.
    await expect(page.getByTestId('hoy-plan')).toBeVisible();
    await expect(page.getByTestId('hoy-siguiente')).toContainText('Comprobar');
    await expect(page.getByTestId('hoy-razon')).toContainText('ya lo has visto');
    await assertProductSurface(page);

    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/comprobar\/1/);

    // ------------------------------------------------------------ COMPROBAR · S14
    await expect(page.getByTestId('comprobar-enunciado')).toBeVisible();
    // INV-103 · UX-INV-4 · ninguna señal de corrección antes del envío.
    const antes = await page.locator('body').innerText();
    expect(antes).not.toMatch(/correcto|incorrecto|respuesta correcta|explicación/i);
    // INV-102 · UX-INV-5 · sin confianza no se envía, y la pantalla dice por qué.
    await expect(page.getByTestId('comprobar')).toBeDisabled();
    await expect(page.getByTestId('falta-confianza')).toBeVisible();
    await assertProductSurface(page);

    await page.getByTestId('opcion-A').click();
    await expect(page.getByTestId('opcion-A')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('confianza-3').click();
    await expect(page.getByTestId('comprobar')).toBeEnabled();
    await page.getByTestId('comprobar').click();

    // ------------------------------------------------------------- CORRECCIÓN · S15
    await expect(page.getByTestId('feedback')).toBeVisible();
    await expect(page.getByTestId('resultado')).toBeVisible();
    await expect(page.getByTestId('respuesta-correcta')).not.toBeEmpty();
    await expect(page.getByTestId('explicacion')).not.toBeEmpty();
    // El resultado nunca depende solo del color: hay palabra.
    await expect(page.getByTestId('resultado')).not.toBeEmpty();
    await assertProductSurface(page);

    await page.getByTestId('feedback-siguiente').click();
    // Segunda acción: la otra pregunta. En blanco es una respuesta legítima.
    await expect(page).toHaveURL(/\/comprobar\/2/);
    await page.getByTestId('confianza-1').click();
    await page.getByTestId('comprobar').click();
    await expect(page.getByTestId('resultado')).toContainText('Sin responder');
    await expect(page.getByTestId('tu-respuesta')).toContainText('No respondiste');
    await expect(page.getByTestId('feedback-siguiente')).toHaveText('Terminar la sesión');
    await page.getByTestId('feedback-siguiente').click();

    await expect(page).toHaveURL(/\/fin/);
    await expect(page.getByTestId('resumen')).toContainText('Preguntas respondidas');
    await assertProductSurface(page);
  });

  /**
   * El tiempo de hoy es autoritativo, y cambiarlo recompone el plan.
   *
   * Es el demostrador principal de §S.6: la persona cambia su disponibilidad, el sistema acepta la
   * restricción y trae una decisión nueva y veraz. Con un minuto, nada completo cabe, y
   * `NOTHING_FITS` **no ofrece** la acción fuera de presupuesto (P4B-D1).
   */
  test('cambiar el tiempo de hoy recompone el plan, y el cero es legítimo', async ({ page }) => {
    await registerAndOnboard(page, 'p4b-time');
    await expect(page.getByTestId('hoy-plan')).toBeVisible();

    // ---- Un minuto: hay trabajo, pero nada completo cabe. Cero acciones primarias.
    await page.getByTestId('tiempo-hoy-abrir').click();
    await page.getByTestId('tiempo-hoy-personalizar').fill('1');
    await page.getByTestId('tiempo-hoy-guardar').click();
    await expect(page.getByTestId('hoy-nada-cabe')).toBeVisible();
    await expect(page.getByTestId('hoy-primaria')).toHaveCount(0);
    // P4B-D1 · puede decir con verdad cuánto necesita la más corta.
    await expect(page.getByTestId('hoy-mas-corta')).toContainText('min');
    await assertProductSurface(page);

    // ---- Cero: su propia declaración, respetada. Ni deuda, ni día perdido, ni empujón.
    await page.getByTestId('tiempo-hoy-abrir').click();
    await page.getByTestId('tiempo-hoy-opcion-0').click();
    await page.getByTestId('tiempo-hoy-guardar').click();
    await expect(page.getByTestId('hoy-tiempo-cero')).toBeVisible();
    await expect(page.getByTestId('hoy-primaria')).toHaveCount(0);
    const cero = await page.locator('body').innerText();
    expect(cero).not.toMatch(/deber[íi]as|aprovecha|no pierdas|deuda|recupera/i);
    await assertProductSurface(page);

    // ---- Y volver a subirlo trae un plan de verdad: la recomposición es real.
    await page.getByTestId('tiempo-hoy-abrir').click();
    await page.getByTestId('tiempo-hoy-opcion-30').click();
    await page.getByTestId('tiempo-hoy-guardar').click();
    await expect(page.getByTestId('hoy-plan')).toBeVisible();
    await expect(page.getByTestId('hoy-primaria')).toBeVisible();
  });
});

test.describe('Phase 4B · lo que no se puede forzar desde el navegador', () => {
  test('la URL no adelanta el paso, no abre el de otra persona y no revive lo terminado', async ({
    page,
  }) => {
    await registerAndOnboard(page, 'p4b-rt');
    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/aprender\/1/);

    // Adelantar por la barra de direcciones no sirve: el paso lo decide la evidencia.
    await page.goto('/comprobar/5');
    await expect(page).toHaveURL(/\/aprender\/1/);
    await page.goto('/aprender/2');
    await expect(page).toHaveURL(/\/aprender\/1/);
    await page.goto('/fin');
    await expect(page).toHaveURL(/\/aprender\/1/);
    await page.goto('/comprobar/99');
    await expect(page).toHaveURL(/\/aprender\/1/);

    // El botón atrás puede devolver una pantalla ya superada desde la caché del navegador: eso lo
    // hace el navegador y no se le discute. Lo que no puede ocurrir es que repetir la acción desde
    // ahí rompa, porque un producto que castiga usar el botón atrás no es un producto.
    await page.getByTestId('aprender-continuar').click();
    await expect(page.getByTestId('accion-error')).toHaveCount(0);
    await expect(page).toHaveURL(/\/aprender\/2/);
    await page.goBack();
    await page.getByTestId('aprender-continuar').click();
    await expect(page.getByTestId('accion-error')).toHaveCount(0);
    await expect(page).toHaveURL(/\/aprender\/2/);

    // Terminar, y comprobar que una sesión cerrada no reanuda.
    await page.reload();
    await page.getByTestId('aprender-continuar').click();
    await expect(page).toHaveURL(/\/fin/);
    await page.goto('/aprender/1');
    await expect(page).toHaveURL(/\/hoy/);
  });

  test('el ordinal de otra persona resuelve dentro de la sesión propia', async ({ page }) => {
    // Primera aprendiz: deja una sesión abierta en su paso 1.
    await registerAndOnboard(page, 'p4b-a');
    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/aprender\/1/);
    const suyo = await page.getByTestId('aprender-titulo').innerText();

    // Segunda aprendiz, en el mismo navegador: sesión propia y contenido propio.
    await page.goto('/cuenta');
    await page.getByTestId('signout-button').click();
    await expect(page.getByTestId('signout-button')).toHaveCount(0);
    await registerAndOnboard(page, 'p4b-b');

    // Sin sesión abierta todavía, el ordinal ajeno no abre nada.
    await page.goto('/aprender/1');
    await expect(page).toHaveURL(/\/hoy/);

    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/aprender\/1/);
    // El paso 1 existe para las dos, y cada una ve el suyo: el ordinal no es una identidad.
    await expect(page.getByTestId('aprender-titulo')).toHaveText(suyo);
    await expect(page.getByTestId('aprender-cuerpo')).toBeVisible();
  });
});
