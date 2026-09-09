import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildSyntheticPack, purgePack, type SyntheticPack } from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  eventFor,
  itemAt,
  itemEvent,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { one, query } from '../support/sql';
import { adminClient, deleteTestUser, readTestEnv, type TestEnv } from '../support/supabase-test-env';

/**
 * `events.lateArrivalNoTimeout.spec` · ADR-008 punto 11 · SD-023 §1.
 *
 * La evidencia offline tardía se acepta en la siguiente posición de su stream, conserva su
 * `client_created_at` (días atrás), lleva `created_offline`, y NO reordena la historia: el
 * orden autoritativo es stream_position; `server_received_at` es auditoría. Nada se declara
 * ausente por timeout.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let session: CreatedSession;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2late');
  ana = await createLearner(env, 'late', pack);
  session = await createSession(ana, [{ item_type: 'CONCEPT_REVIEW', target_id: pack.conceptIds[0] ?? '' }]);
  await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
}, 240_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 punto 11 · la evidencia tardía se acepta y no reescribe la historia', () => {
  it('un evento creado hace nueve días llega después de otro reciente y toma la siguiente posición', async () => {
    const item = itemAt(session, 0);
    const recent = await accept(ana, itemEvent(ana, session, item, 'SESSION_ITEM_STARTED'));
    const nineDaysAgo = new Date(Date.now() - 9 * 86_400_000).toISOString();
    const late = await accept(
      ana,
      itemEvent(ana, session, item, 'HELP_REQUESTED', { topic: 'fixture: offline' }, {
        client_created_at: nineDaysAgo,
        created_offline: true,
        client_sequence: 1,
      }),
    );
    expect(late.stream_position).toBe(recent.stream_position + 1);
    const stored = one<{ client_created_at: string; server_received_at: string; created_offline: boolean }>(
      `select client_created_at, server_received_at, created_offline from public.learning_events where event_id = '${String(late.event_id)}'`,
    );
    expect(new Date(stored.client_created_at).toISOString()).toBe(nineDaysAgo);
    expect(stored.created_offline).toBe(true);
    expect(new Date(stored.server_received_at).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('el orden por stream_position no coincide con el orden por client_created_at, y el stream es el autoritativo', () => {
    const byPosition = query<{ t: string; p: number }>(
      `select event_type as t, stream_position as p from public.learning_events where user_id = '${ana.id}' order by stream_position`,
    );
    const byClientTime = query<{ t: string }>(
      `select event_type as t from public.learning_events where user_id = '${ana.id}' order by client_created_at`,
    );
    expect(byPosition.map((r) => r.t)).toEqual(['SESSION_STARTED', 'SESSION_ITEM_STARTED', 'HELP_REQUESTED']);
    expect(byClientTime.map((r) => r.t)[0]).toBe('HELP_REQUESTED');
    expect(byPosition.map((r) => Number(r.p))).toEqual([1, 2, 3]);
  });

  it('un instante futuro también se conserva tal cual y no altera el orden ni el estado', async () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const accepted = await accept(ana, eventFor(ana, session, 'SESSION_INTERRUPTED', {}, { client_created_at: future }));
    expect(accepted.stream_position).toBe(4);
    expect(accepted.session?.status).toBe('INTERRUPTED');
    const stored = one<{ c: string }>(
      `select client_created_at as c from public.learning_events where event_id = '${accepted.event_id}'`,
    );
    expect(new Date(stored.c).toISOString()).toBe(future);
  });
});
