import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildSyntheticPack, purgePack, question, type SyntheticPack } from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  eventFor,
  itemAt,
  itemEvent,
  presentAndAnswer,
  sessionEvents,
  sessionRow,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { one } from '../support/sql';
import { adminClient, deleteTestUser, readTestEnv, type TestEnv } from '../support/supabase-test-env';

/**
 * `events.streamPositionMonotonic.spec` · ADR-008 punto 1 · gate P2-G3.
 *
 * Las posiciones de un usuario son consecutivas desde 1, sin huecos, por usuario y no
 * globales: dos aprendices que intercalan eventos reciben cada uno su propia secuencia.
 * Es también el recorrido de referencia del vertical de Phase 2: sesión creada por el
 * flujo validado, iniciada, pregunta presentada y respondida, sesión completada.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let bea: Learner;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2mono');
  ana = await createLearner(env, 'mono-a', pack);
  bea = await createLearner(env, 'mono-b', pack);
}, 240_000);

afterAll(async () => {
  for (const learner of [ana, bea]) if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 punto 1 · stream_position por usuario, monotónica y sin huecos', () => {
  let session: CreatedSession;

  it('la sesión nace PLANNED por el flujo validado con sus ítems tipados', async () => {
    session = await createSession(ana, [
      { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
      { item_type: 'QUESTION', target_id: question(pack, 1).questionId },
      { item_type: 'CONCEPT_REVIEW', target_id: pack.conceptIds[0] ?? '' },
    ]);
    expect(session.status).toBe('PLANNED');
    expect(session.items.map((i) => i.sort_order)).toEqual([1, 2, 3]);
    expect((await sessionRow(ana, session.session_id)).status).toBe('PLANNED');
  });

  it('el primer evento del usuario recibe la posición 1 y los siguientes son consecutivos', async () => {
    const started = await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
    expect(started.stream_position).toBe(1);
    expect(started.idempotent).toBe(false);
    expect(started.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(started.session?.status).toBe('ACTIVE');
    expect(started.session?.resume_cursor?.['session_item_id']).toBe(itemAt(session, 0).session_item_id);

    const q0 = question(pack, 0);
    const answered = await presentAndAnswer(ana, session, itemAt(session, 0), q0.representationId, {
      option_key: q0.correctOptionKey,
      confidence: 4,
      response_ms: 3200,
    });
    // SESSION_STARTED = 1, QUESTION_PRESENTED = 2, ANSWER_SUBMITTED = 3.
    expect(answered.stream_position).toBe(3);
    expect(answered.attempt?.['is_correct']).toBe(true);
    expect(answered.attempt?.['attempt_number']).toBe(1);
    expect(answered.session?.resume_cursor?.['session_item_id']).toBe(itemAt(session, 1).session_item_id);
  });

  it('otro usuario tiene su propio stream: sus posiciones empiezan en 1 aunque se intercalen', async () => {
    const other = await createSession(bea, [{ item_type: 'QUESTION', target_id: question(pack, 2).questionId }]);
    const started = await accept(bea, eventFor(bea, other, 'SESSION_STARTED'));
    expect(started.stream_position).toBe(1);
    const interrupted = await accept(ana, eventFor(ana, session, 'SESSION_INTERRUPTED'));
    expect(interrupted.stream_position).toBe(4);
    const presented = await accept(
      bea,
      itemEvent(bea, other, itemAt(other, 0), 'QUESTION_PRESENTED', { question_representation_id: question(pack, 2).representationId }),
    );
    expect(presented.stream_position).toBe(2);
  });

  it('el stream completo de la sesión es contiguo y el contador del usuario apunta a la siguiente posición', async () => {
    const resumed = await accept(ana, eventFor(ana, session, 'SESSION_RESUMED'));
    expect(resumed.stream_position).toBe(5);
    const events = await sessionEvents(ana, session.session_id);
    expect(events.map((e) => e.stream_position)).toEqual([1, 2, 3, 4, 5]);
    expect(events.map((e) => e.event_type)).toEqual([
      'SESSION_STARTED',
      'QUESTION_PRESENTED',
      'ANSWER_SUBMITTED',
      'SESSION_INTERRUPTED',
      'SESSION_RESUMED',
    ]);
    const counter = one<{ next_position: number }>(
      `select next_position from ingest.user_event_counters where user_id = '${ana.id}'`,
    );
    expect(Number(counter.next_position)).toBe(6);
    const gaps = one<{ gaps: number }>(
      `select count(*)::int as gaps from generate_series(1, 5) g where not exists (select 1 from public.learning_events e where e.user_id = '${ana.id}' and e.stream_position = g)`,
    );
    expect(Number(gaps.gaps)).toBe(0);
  });

  it('la sesión se completa y el cursor queda vacío', async () => {
    const completed = await accept(ana, eventFor(ana, session, 'SESSION_COMPLETED'));
    expect(completed.session?.status).toBe('COMPLETED');
    expect(completed.session?.resume_cursor).toBeNull();
    const row = await sessionRow(ana, session.session_id);
    expect(row.status).toBe('COMPLETED');
    expect(row.completed_at).not.toBeNull();
  });
});
