import { expect, test, type Page } from '@playwright/test';

import { buildSyntheticPack, purgePack, type SyntheticPack } from '../../support/phase1a-fixtures';
import {
  presentAndAnswer,
  publishLearningUnit,
  type CreatedSession,
  type Learner,
} from '../../support/phase2-fixtures';
import {
  computeFor,
  expectedProjection,
  persistedProjection,
  sqlText,
} from '../../support/engine-fixtures';
import { query } from '../../support/sql';
import {
  adminClient,
  anonClient,
  isValidRunId,
  readTestEnv,
  RUN_ID_ENV_VAR,
  runScopedEmail,
} from '../../support/supabase-test-env';

/**
 * `engine.runtime.e2e` · Phase 3.1 · D-26 · gates P3.1-G2, G3, G4 y G6 en la aplicación real.
 *
 * La aplicación se construye y arranca con `next build` y `next start`: no hay ningún módulo
 * importado, simulado ni sustituido. Una persona se da de alta, responde una pregunta desde el
 * navegador y, **sin que la prueba invoque el motor**, la proyección aparece:
 *
 *   **ruta A** · la acción que acepta la respuesta entrega el cálculo a `after()`;
 *   **ruta B** · llega evidencia que ninguna ruta A proyecta —como una invocación perdida— y
 *   basta con que la persona vuelva a HOY para que el servidor la recupere.
 *
 * En los dos casos lo persistido se compara con el pliegue completo (EC-006). Y la pantalla no
 * cambia: HOY sigue diciendo exactamente lo mismo que decía en `phase-3-v1.0`.
 */

let pack: SyntheticPack | null = null;
let ordinal = 0;
const createdEmails: string[] = [];
const PASSWORD = 'Contrasena-De-Prueba-1!';

function uniqueEmail(label: string): string {
  const runId = process.env[RUN_ID_ENV_VAR];
  if (!isValidRunId(runId))
    throw new Error(`No hay identificador de ejecución (${RUN_ID_ENV_VAR}).`);
  ordinal += 1;
  const scope = `${label}-${test.info().project.name}-w${test.info().workerIndex}`;
  const email = runScopedEmail(String(runId), scope, ordinal);
  createdEmails.push(email);
  return email;
}

function userIdOf(email: string): string {
  const rows = query<{ id: string }>(
    `select id::text from auth.users where email = ${sqlText(email)}`,
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('la cuenta de prueba no existe');
  return id;
}

interface WatermarkState {
  readonly consumed: number | null;
  readonly max: number;
}

function watermarkState(userId: string): WatermarkState {
  const rows = query<{ consumed: number | null; max: number }>(
    `select (select consumed_position from engine.projection_watermarks
              where user_id = ${sqlText(userId)}::uuid and projection_name = 'concept_mastery') as consumed,
            (select coalesce(max(stream_position), 0) from public.learning_events
              where user_id = ${sqlText(userId)}::uuid) as max`,
  );
  const row = rows[0];
  return {
    consumed: row?.consumed === null || row?.consumed === undefined ? null : Number(row.consumed),
    max: Number(row?.max ?? 0),
  };
}

/** Espera a que el servidor, por su cuenta, deje la proyección al día. La prueba no la invoca. */
async function waitForProjection(userId: string, label: string): Promise<WatermarkState> {
  const deadline = Date.now() + 90_000;
  let state = watermarkState(userId);
  while (Date.now() < deadline) {
    state = watermarkState(userId);
    if (state.consumed !== null && state.consumed === state.max && state.max > 0) return state;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(
    `${label}: la proyección no llegó (consumido ${state.consumed}, stream ${state.max})`,
  );
}

async function registerAndOnboard(
  page: Page,
  label: string,
): Promise<{ email: string; userId: string }> {
  const email = uniqueEmail(label);
  await page.goto('/registro');
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(PASSWORD);
  await page.getByTestId('signup-form').getByRole('button').click();
  await expect(page).toHaveURL(/\/cuenta/);

  await page.goto('/onboarding');
  await page
    .getByTestId('pack-select')
    .selectOption({ label: `fixture: pack sintético p31e2e${test.info().workerIndex}` });
  // Phase 4B · §I.1 · sin zona declarada no existe «hoy» y el Planner se niega.
  await page.getByTestId('timezone-select').selectOption('Europe/Madrid');
  await page.getByTestId('daily-minutes-input').fill('60');
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByTestId('onboarding-completado')).toBeVisible();
  await page.getByTestId('onboarding-ir-a-hoy').click();
  await expect(page).toHaveURL(/\/hoy/);
  return { email, userId: userIdOf(email) };
}

test.beforeAll(async () => {
  const env = readTestEnv();
  const admin = adminClient(env);
  pack = await buildSyntheticPack(admin, `p31e2e${test.info().workerIndex}`);
  // ADR-013 · la frontera de ingestión exige la duración de una versión de unidad.
  await publishLearningUnit(admin, pack, 0, 'p31-uno', { minutes: 5 });
  await publishLearningUnit(admin, pack, 1, 'p31-dos', { minutes: 5 });
});

test.afterAll(async () => {
  if (!pack) return;
  const env = readTestEnv();
  const admin = adminClient(env);
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const removedIds: string[] = [];
  for (const user of data.users) {
    if (user.email && createdEmails.includes(user.email)) {
      const removed = await admin.auth.admin.deleteUser(user.id);
      if (removed.error) throw new Error(`deleteUser: ${removed.error.message}`);
      removedIds.push(user.id);
    }
  }
  await purgePack(admin, pack.packId);
  // Residuo cero del motor: la cuenta borrada arrastra proyección, historial y watermark.
  for (const id of removedIds) {
    const rows = query<{ n: number }>(
      `select (select count(*) from engine.concept_mastery where user_id = ${sqlText(id)}::uuid)
            + (select count(*) from engine.mastery_history where user_id = ${sqlText(id)}::uuid)
            + (select count(*) from engine.projection_watermarks where user_id = ${sqlText(id)}::uuid)
            + (select count(*) from engine.error_patterns where user_id = ${sqlText(id)}::uuid) as n`,
    );
    expect(Number(rows[0]?.n)).toBe(0);
  }
});

test.describe('Phase 3.1 · el Learning Engine corre en la aplicación real', () => {
  test('ruta A tras responder y ruta B al volver a HOY, sin cambiar lo que HOY muestra', async ({
    page,
  }) => {
    const { email, userId } = await registerAndOnboard(page, 'p31');

    /*
     * Antes de estudiar no hay estado de concepto: nada que el servidor deba inventar.
     *
     * **Phase 4B · R-8.** El stream ya **no** está vacío tras el onboarding: la disponibilidad
     * declarada emite `AVAILABILITY_CHANGED`, que ocupa la posición 1. Es una declaración de la
     * persona, no evidencia de aprendizaje, y el motor no la pliega en ningún concepto. Lo que esta
     * prueba vigila se conserva intacto: **ninguna fila de concepto** antes de estudiar. El
     * watermark puede estar sin crear, en 0 o ya al día en 1, según si la ruta B pasó por él.
     */
    const initial = watermarkState(userId);
    expect(initial.max).toBe(1);
    const declared = query<{ event_type: string }>(
      `select event_type::text from public.learning_events where user_id = ${sqlText(userId)}::uuid`,
    );
    expect(declared.map((row) => row.event_type)).toEqual(['AVAILABILITY_CHANGED']);
    expect([null, 0, 1]).toContain(initial.consumed);
    const conceptsBefore = query<{ n: number }>(
      `select count(*)::int as n from engine.concept_mastery where user_id = ${sqlText(userId)}::uuid`,
    );
    expect(Number(conceptsBefore[0]?.n)).toBe(0);

    /*
     * --------------------------------------------------------------- ruta A
     *
     * **Phase 4B · el plan del primer día es solo APRENDER.** Con granularidad híbrida (P4-D3) un
     * concepto `NEW` recibe APRENDER, nunca APRENDER + COMPROBAR, así que para llegar a responder
     * hay que leer primero y **pasar el día**: los conceptos leídos hoy cuentan como trabajados hoy
     * y quedan excluidos (§E.5).
     *
     * El paso del día se simula retrasando dos días los `completed_at` de los ítems completados.
     * Es **estado de sesión**, no evidencia: ningún evento ni intento se toca, de modo que lo que
     * el motor plegó sigue exactamente igual.
     */
    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/aprender\/1/);
    await page.getByTestId('aprender-continuar').click();
    await expect(page).toHaveURL(/\/aprender\/2/);
    await page.getByTestId('aprender-continuar').click();
    await expect(page).toHaveURL(/\/fin/);

    query(
      `update public.session_items si set completed_at = si.completed_at - interval '2 days'
         where si.status = 'COMPLETED' and si.user_id = ${sqlText(userId)}::uuid`,
    );

    await page.goto('/hoy');
    await page.getByTestId('hoy-primaria').click();
    await expect(page).toHaveURL(/\/comprobar\/1/);
    await page.getByTestId('opcion-A').click();
    await page.getByTestId('confianza-3').click();
    await page.getByTestId('comprobar').click();
    await expect(page.getByTestId('feedback')).toBeVisible();

    const afterA = await waitForProjection(userId, 'ruta A');
    expect(afterA.consumed).toBe(afterA.max);
    // EC-006: lo que dejó la invocación real es exactamente el pliegue completo.
    expect(persistedProjection(userId)).toBe(expectedProjection(computeFor(userId)));
    const conceptsA = query<{ n: number }>(
      `select count(*)::int as n from engine.concept_mastery where user_id = ${sqlText(userId)}::uuid`,
    );
    expect(Number(conceptsA[0]?.n)).toBeGreaterThan(0);

    // --------------------------------------------------------------- ruta B
    // Evidencia aceptada que ninguna ruta A proyecta: la misma RPC que usa la aplicación, pero
    // sin pasar por la acción del servidor. Es una invocación perdida, hecha a propósito.
    const env = readTestEnv();
    const client = anonClient(env);
    const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
    expect(signIn.error).toBeNull();
    const openSession = await client
      .from('study_sessions')
      .select('id, status')
      .in('status', ['ACTIVE', 'INTERRUPTED'])
      .single();
    expect(openSession.error).toBeNull();
    const items = await client
      .from('session_items')
      .select('id, sort_order, item_type, question_id, status')
      .eq('session_id', (openSession.data as { id: string }).id)
      .order('sort_order');
    expect(items.error).toBeNull();
    const rows = (items.data ?? []) as Array<{
      id: string;
      sort_order: number;
      item_type: string;
      question_id: string | null;
      status: string;
    }>;
    const pending = rows.find((row) => row.item_type === 'QUESTION' && row.status === 'PENDING');
    if (!pending?.question_id || !pack) throw new Error('no queda ninguna pregunta pendiente');
    const target = pack.questions.find((entry) => entry.questionId === pending.question_id);
    if (!target) throw new Error('la pregunta pendiente no pertenece al pack de la prueba');

    const learner = {
      id: userId,
      email,
      password: PASSWORD,
      client,
      goalId: '',
      deviceId: undefined,
      packId: pack.packId,
    } as unknown as Learner;
    const session: CreatedSession = {
      session_id: (openSession.data as { id: string }).id,
      status: (openSession.data as { status: string }).status,
      items: rows.map((row) => ({
        session_item_id: row.id,
        sort_order: row.sort_order,
        item_type: row.item_type,
        target_id: row.question_id ?? '',
      })),
    };
    await presentAndAnswer(
      learner,
      session,
      {
        session_item_id: pending.id,
        sort_order: pending.sort_order,
        item_type: 'QUESTION',
        target_id: pending.question_id,
      },
      target.representationId,
      { blank: true },
    );

    const stale = watermarkState(userId);
    expect(stale.consumed, 'la proyección debería estar atrasada').not.toBeNull();
    expect(stale.consumed).toBeLessThan(stale.max);

    // La persona vuelve a HOY. HOY dice lo mismo que en phase-3-v1.0 …
    // La persona vuelve a HOY. Lo que HOY muestra es ahora la decisión del Planner —el marcador
    // provisional de «sesión fija» desapareció con la selección fija (P4-G34)—, y lo que esta
    // prueba vigila sigue siendo lo mismo: que **volver no cambia lo que HOY dice**, y que el
    // servidor recupera la proyección atrasada después de responder.
    await page.goto('/hoy');
    await expect(page.getByTestId('hoy-titulo')).toHaveText('Hoy');
    await expect(page.getByTestId('hoy-retomar')).toContainText('Te quedaste');

    // … y el servidor, después de responder, recupera la proyección.
    const afterB = await waitForProjection(userId, 'ruta B');
    expect(afterB.max).toBe(stale.max);
    expect(persistedProjection(userId)).toBe(expectedProjection(computeFor(userId)));

    // Volver otra vez no escribe nada nuevo: es seguro repetirlo.
    const history = () =>
      Number(
        query<{ n: number }>(
          `select count(*)::int as n from engine.mastery_history where user_id = ${sqlText(userId)}::uuid`,
        )[0]?.n,
      );
    const historyBefore = history();
    await page.goto('/hoy');
    await expect(page.getByTestId('hoy-titulo')).toHaveText('Hoy');
    await page.waitForTimeout(5_000);
    expect(history()).toBe(historyBefore);
    await client.auth.signOut();
  });
});
