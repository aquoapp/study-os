import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSyntheticPack,
  purgePack,
  question,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  eventFor,
  itemAt,
  itemEvent,
  presentAndAnswer,
  reject,
  send,
  sessionEvents,
  sessionRow,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { attack, one, query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * Continuidad de sesión · REQ-C04, C09, C10, C11, C12 · Master §10 · Closure D-001, AT-01,
 * AT-02, AT-03 · CDEM §9 y §29.10 · gate P2-G4.
 *
 * Cuatro promesas del producto, probadas contra la instancia real:
 *   - el autoguardado no depende de ninguna acción del usuario: la evidencia aceptada ES el
 *     guardado, y un cierre abrupto no pierde nada;
 *   - la reanudación cae en el ítem **exacto**, nunca en el primero;
 *   - lo completado cuenta, y lo no terminado no se etiqueta como fracaso;
 *   - el estado que manda es el del servidor, también entre dispositivos, y un dispositivo
 *     obsoleto no borra historia más nueva.
 *
 * El cursor materializado (`resume_cursor_json`) es una proyección de los eventos aceptados:
 * cada aserción lo compara además con el cursor recalculado desde el stream, de modo que una
 * divergencia entre lo materializado y lo reconstruible se detecta en lugar de heredarse.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;

/** Cursor recalculado desde los eventos, tal como lo reconstruiría un rebuild. */
const recomputedCursor = (sessionId: string) =>
  one<{ cursor: { session_item_id?: string; sort_order?: number } | null }>(
    `select ingest.compute_resume_cursor('${sessionId}') as cursor`,
  ).cursor;

/** Sesión de quince ítems (tres preguntas del pack, cinco vueltas), ya ACTIVE. */
async function fifteenItemSession(): Promise<CreatedSession> {
  const items = Array.from({ length: 15 }, (_, i) => ({
    item_type: 'QUESTION',
    target_id: question(pack, i % 3).questionId,
    planned_minutes: 4,
  }));
  const session = await createSession(ana, items, 'FIXTURE_MIXED');
  await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
  return session;
}

async function answerFirst(session: CreatedSession, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const item = itemAt(session, i);
    const q = question(pack, i % 3);
    await presentAndAnswer(ana, session, item, q.representationId, {
      option_key: 'A',
      confidence: 3,
      response_ms: 1000 + i,
    });
  }
}

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2cont');
  ana = await createLearner(env, 'cont', pack);
}, 300_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

// ---------------------------------------------------------------------------
describe('session.stateMachine · las transiciones válidas son las del CDEM §9', () => {
  it('PLANNED → ACTIVE → INTERRUPTED → ACTIVE → COMPLETED, y nada más', async () => {
    const session = await createSession(ana, [
      { item_type: 'CONCEPT_REVIEW', target_id: pack.conceptIds[0] ?? '' },
    ]);
    expect((await sessionRow(ana, session.session_id)).status).toBe('PLANNED');

    // Un evento de ítem antes de arrancar no es una transición válida.
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'SESSION_ITEM_STARTED'),
      'SESSION_NOT_ACTIVE',
    );
    // Reanudar algo que no ha empezado, tampoco.
    await reject(ana, eventFor(ana, session, 'SESSION_RESUMED'), 'SESSION_STATE');

    await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
    expect((await sessionRow(ana, session.session_id)).status).toBe('ACTIVE');
    // Arrancar dos veces no es válido.
    await reject(ana, eventFor(ana, session, 'SESSION_STARTED'), 'SESSION_STATE');

    await accept(ana, eventFor(ana, session, 'SESSION_INTERRUPTED', { reason: 'fixture: pausa' }));
    expect((await sessionRow(ana, session.session_id)).status).toBe('INTERRUPTED');

    await accept(ana, eventFor(ana, session, 'SESSION_RESUMED'));
    expect((await sessionRow(ana, session.session_id)).status).toBe('ACTIVE');

    await accept(ana, eventFor(ana, session, 'SESSION_COMPLETED'));
    const completed = await sessionRow(ana, session.session_id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completed_at).not.toBeNull();
    expect(completed.started_at).not.toBeNull();

    // COMPLETED es terminal: ningún evento posterior la mueve.
    await reject(ana, eventFor(ana, session, 'SESSION_RESUMED'), 'SESSION_STATE');
    await reject(ana, eventFor(ana, session, 'SESSION_INTERRUPTED'), 'SESSION_STATE');
  });

  it('el grafo de estados también se defiende en la base, no solo en la función', () => {
    const row = one<{ id: string }>(
      `select id from public.study_sessions where user_id = '${ana.id}' and status = 'COMPLETED' limit 1`,
    );
    const reopened = attack(
      `update public.study_sessions set status = 'ACTIVE' where id = '${row.id}';`,
    );
    expect(reopened.rejected, reopened.message).toBe(true);
    expect(reopened.message).toContain('terminal');
    const stolen = attack(
      `update public.study_sessions set user_id = gen_random_uuid() where id = '${row.id}';`,
    );
    expect(stolen.rejected, stolen.message).toBe(true);
  });

  it('ABANDONED existe como estado técnico y así está documentado (INV-107)', () => {
    const labels = one<{ labels: string }>(
      "select string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'session_status'",
    );
    expect(labels.labels).toBe('PLANNED,ACTIVE,INTERRUPTED,COMPLETED,ABANDONED');
    const comment = one<{ c: string }>(
      "select obj_description(t.oid, 'pg_type') as c from pg_type t where t.typname = 'session_status'",
    );
    expect(comment.c).toContain('INV-107');
    // Y ninguna columna del dominio de sesión habla de fracaso (REQ-C12).
    const shaming = query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name in ('study_sessions','session_items') and column_name ~* '(fail|fracas|missed|penal|streak|score)'",
    );
    expect(shaming).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('session.autosave.abruptExit · cerrar la app en Q7/15 no pierde nada (REQ-C09 · AT-01)', () => {
  let session: CreatedSession;

  it('siete respuestas quedan guardadas sin que el usuario guarde nada', async () => {
    session = await fifteenItemSession();
    await answerFirst(session, 7);
    // Cierre abrupto: no hay SESSION_INTERRUPTED ni ningún evento de despedida.
    const attempts = one<{ n: number }>(
      `select count(*)::int as n from public.question_attempts where session_id = '${session.session_id}'`,
    );
    expect(Number(attempts.n)).toBe(7);
    const completedItems = one<{ n: number }>(
      `select count(*)::int as n from public.session_items where session_id = '${session.session_id}' and status = 'COMPLETED'`,
    );
    expect(Number(completedItems.n)).toBe(7);
    // La sesión sigue ACTIVE: nadie la cerró.
    expect((await sessionRow(ana, session.session_id)).status).toBe('ACTIVE');
  });

  it('al volver, el cursor está en Q8 y coincide con el reconstruido desde los eventos', async () => {
    const row = await sessionRow(ana, session.session_id);
    const expected = itemAt(session, 7);
    expect(row.resume_cursor_json?.['session_item_id']).toBe(expected.session_item_id);
    expect(row.resume_cursor_json?.['sort_order']).toBe(8);
    const recomputed = recomputedCursor(session.session_id);
    expect(recomputed?.session_item_id).toBe(expected.session_item_id);
    expect(recomputed?.sort_order).toBe(8);
  });

  it('un cursor materializado obsoleto se detecta al recalcularlo', () => {
    // Se corrompe el cursor dentro de un ataque que siempre revierte, y se comprueba que
    // la reconstrucción desde los eventos NO coincide con la mentira: el defecto es
    // detectable, que es lo que exige que el cursor sea una proyección y no la verdad.
    const outcome = attack(
      `update public.study_sessions set resume_cursor_json = jsonb_build_object('session_item_id', '${itemAt(session, 0).session_item_id}', 'sort_order', 1) where id = '${session.session_id}';
       if (select (resume_cursor_json->>'sort_order')::int from public.study_sessions where id = '${session.session_id}')
          is distinct from (ingest.compute_resume_cursor('${session.session_id}')->>'sort_order')::int then
         raise exception 'DIVERGENCIA_DETECTADA';
       end if;`,
    );
    // El bloque revierte siempre. Que la excepción sea la nuestra —y no la centinela de
    // `attack()`— demuestra que la reconstrucción desde los eventos NO acepta el cursor
    // corrupto: la proyección es verificable, no una verdad heredada.
    expect(outcome.rejected, outcome.message).toBe(true);
    expect(outcome.message).toContain('DIVERGENCIA_DETECTADA');
    // Y nada quedó tocado.
    const row = one<{ sort_order: number }>(
      `select (resume_cursor_json->>'sort_order')::int as sort_order from public.study_sessions where id = '${session.session_id}'`,
    );
    expect(Number(row.sort_order)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
describe('session.resumeCursor.exact · la reanudación cae en el ítem exacto (REQ-C10 · CDEM §29.10)', () => {
  it('tras interrumpir en Q4 de 15, reanudar devuelve Q5, no Q1', async () => {
    const session = await fifteenItemSession();
    await answerFirst(session, 4);
    const interrupted = await accept(ana, eventFor(ana, session, 'SESSION_INTERRUPTED'));
    expect(interrupted.session?.status).toBe('INTERRUPTED');
    expect(interrupted.session?.resume_cursor?.['sort_order']).toBe(5);

    const resumed = await accept(ana, eventFor(ana, session, 'SESSION_RESUMED'));
    expect(resumed.session?.status).toBe('ACTIVE');
    expect(resumed.session?.resume_cursor?.['session_item_id']).toBe(
      itemAt(session, 4).session_item_id,
    );
    expect(resumed.session?.resume_cursor?.['sort_order']).toBe(5);
    expect(resumed.session?.resume_cursor?.['sort_order']).not.toBe(1);

    // Y se puede seguir exactamente ahí.
    const q = question(pack, 4 % 3);
    await presentAndAnswer(ana, session, itemAt(session, 4), q.representationId, {
      option_key: 'B',
      confidence: 2,
    });
    const after = await sessionRow(ana, session.session_id);
    expect(after.resume_cursor_json?.['sort_order']).toBe(6);
  });

  it('si el ítem en curso quedó a medias, el cursor vuelve a él y no lo salta', async () => {
    const session = await fifteenItemSession();
    await answerFirst(session, 2);
    // Se presenta el tercero y se abandona sin responder.
    const item = itemAt(session, 2);
    await accept(
      ana,
      itemEvent(ana, session, item, 'QUESTION_PRESENTED', {
        question_representation_id: question(pack, 2).representationId,
      }),
    );
    const row = await sessionRow(ana, session.session_id);
    expect(row.resume_cursor_json?.['session_item_id']).toBe(item.session_item_id);
    expect(row.resume_cursor_json?.['sort_order']).toBe(3);
    expect(recomputedCursor(session.session_id)?.sort_order).toBe(3);
  });
});

// ---------------------------------------------------------------------------
describe('session.partialCounts · lo completado cuenta y lo demás no es un fracaso (REQ-C12 · AT-02)', () => {
  it('una sesión completada con 7 de 15 conserva los 7 y deja los 8 pendientes sin penalización', async () => {
    const session = await fifteenItemSession();
    await answerFirst(session, 7);
    const completed = await accept(ana, eventFor(ana, session, 'SESSION_COMPLETED'));
    expect(completed.session?.status).toBe('COMPLETED');
    expect(completed.session?.resume_cursor).toBeNull();

    const counts = one<{
      completados: number;
      pendientes: number;
      intentos: number;
      minutos: number;
    }>(
      `select
         (select count(*)::int from public.session_items where session_id = '${session.session_id}' and status = 'COMPLETED') as completados,
         (select count(*)::int from public.session_items where session_id = '${session.session_id}' and status = 'PENDING') as pendientes,
         (select count(*)::int from public.question_attempts where session_id = '${session.session_id}') as intentos,
         (select coalesce(sum(planned_minutes), 0)::int from public.session_items where session_id = '${session.session_id}' and status = 'COMPLETED') as minutos`,
    );
    expect(Number(counts.completados)).toBe(7);
    expect(Number(counts.pendientes)).toBe(8);
    expect(Number(counts.intentos)).toBe(7);
    // 7 ítems × 4 minutos planificados: el trabajo hecho es medible sin motor alguno.
    expect(Number(counts.minutos)).toBe(28);
  });

  it('la evidencia de una sesión completada sigue intacta y es suya', async () => {
    const rows = query<{ session_id: string; user_id: string }>(
      `select session_id, user_id from public.question_attempts where user_id = '${ana.id}'`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.user_id === ana.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('session.crossDevice.latestState · el servidor es el estado, y lo obsoleto no borra (REQ-C11 · AT-03)', () => {
  it('un segundo dispositivo continúa en el cursor exacto que dejó el primero', async () => {
    const session = await fifteenItemSession();
    await answerFirst(session, 3);

    const second = await ana.client
      .from('devices')
      .insert({
        user_id: ana.id,
        device_label: 'fixture: dispositivo B',
        installation_id: `inst-${randomUUID()}`,
      })
      .select('id')
      .single();
    expect(second.error).toBeNull();
    const deviceB = String(second.data?.id);

    // El dispositivo B lee el estado confirmado por el servidor, no una copia local.
    const row = await sessionRow(ana, session.session_id);
    expect(row.resume_cursor_json?.['sort_order']).toBe(4);

    // Y continúa desde ahí, con su propio device_id.
    const item = itemAt(session, 3);
    await accept(
      ana,
      itemEvent(
        ana,
        session,
        item,
        'QUESTION_PRESENTED',
        { question_representation_id: question(pack, 0).representationId },
        { device_id: deviceB },
      ),
    );
    const after = await sessionRow(ana, session.session_id);
    expect(after.resume_cursor_json?.['session_item_id']).toBe(item.session_item_id);

    // El estado de sincronización distingue los dos dispositivos (EC-012).
    const sync = query<{ device_id: string }>(
      `select device_id from public.sync_state where user_id = '${ana.id}'`,
    );
    expect(sync.length).toBeGreaterThanOrEqual(2);
  });

  it('un dispositivo obsoleto que reenvía evidencia antigua no borra ni reordena la historia (CDEM §29.9)', async () => {
    const session = await fifteenItemSession();
    await answerFirst(session, 2);
    const before = await sessionEvents(ana, session.session_id);
    const oldest = before[0];
    expect(oldest).toBeDefined();

    // Reenvío exacto del evento más antiguo: idempotente, misma posición, nada cambia.
    const replayed = await send(ana, {
      event_id: oldest?.event_id,
      event_type: oldest?.event_type,
      schema_version: 1,
      client_created_at: new Date(Date.now() - 86_400_000).toISOString(),
      payload: oldest?.payload,
      session_id: session.session_id,
      ...(oldest?.session_item_id ? { session_item_id: oldest.session_item_id } : {}),
    });
    // El sobre difiere del original (otro client_created_at, sin device): hash distinto con
    // el mismo event_id ⇒ conflicto de integridad, nunca una sobrescritura silenciosa.
    expect(replayed.error?.message).toContain('EVENT_ID_CONFLICT_PAYLOAD');

    const after = await sessionEvents(ana, session.session_id);
    expect(after.map((e) => e.stream_position)).toEqual(before.map((e) => e.stream_position));
    expect(after.map((e) => e.event_type)).toEqual(before.map((e) => e.event_type));
  });

  it('una sesión de otro usuario no es alcanzable ni nombrándola', async () => {
    const otro = await createLearner(env, 'cont-otro', pack);
    try {
      const session = await fifteenItemSession();
      const result = await send(otro, {
        event_id: randomUUID(),
        event_type: 'SESSION_INTERRUPTED',
        schema_version: 1,
        client_created_at: new Date().toISOString(),
        payload: {},
        session_id: session.session_id,
      });
      expect(result.error?.message).toContain('SESSION_NOT_FOUND');
      // El mensaje no confirma que la sesión exista ni de quién es.
      expect(result.error?.message).not.toContain(ana.id);
    } finally {
      await deleteTestUser(env, otro.id);
    }
  });
});
