import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildSyntheticPack, purgePack, question, type SyntheticPack } from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  eventFor,
  itemAt,
  itemEvent,
  send,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { query } from '../support/sql';
import { adminClient, deleteTestUser, readTestEnv, type TestEnv } from '../support/supabase-test-env';

/**
 * `events.concurrentInsertSerialized.spec` · ADR-008 condición «inserciones concurrentes de
 * un usuario producen posiciones consecutivas» · dos actores · varios dispositivos.
 *
 * Concurrencia real: peticiones HTTP simultáneas contra PostgREST, cada una en su propia
 * transacción. El contador por usuario serializa solo a ese usuario; dos usuarios en
 * paralelo no se estorban ni comparten posiciones.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let bea: Learner;
let anaSession: CreatedSession;
let beaSession: CreatedSession;
let anaSecondDevice = '';

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2conc');
  ana = await createLearner(env, 'conc-a', pack);
  bea = await createLearner(env, 'conc-b', pack);
  anaSession = await createSession(ana, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
    { item_type: 'CONCEPT_REVIEW', target_id: pack.conceptIds[1] ?? '' },
  ]);
  beaSession = await createSession(bea, [{ item_type: 'QUESTION', target_id: question(pack, 1).questionId }]);
  await accept(ana, eventFor(ana, anaSession, 'SESSION_STARTED'));
  await accept(bea, eventFor(bea, beaSession, 'SESSION_STARTED'));
  const device = await ana.client
    .from('devices')
    .insert({ user_id: ana.id, device_label: 'fixture: segundo dispositivo', installation_id: `inst-${randomUUID()}` })
    .select('id')
    .single();
  anaSecondDevice = String(device.data?.id ?? '');
  expect(anaSecondDevice).not.toBe('');
}, 240_000);

afterAll(async () => {
  for (const learner of [ana, bea]) if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

const positionsOf = (userId: string) =>
  query<{ p: number }>(
    `select stream_position as p from public.learning_events where user_id = '${userId}' order by 1`,
  ).map((r) => Number(r.p));

describe('ADR-008 · inserciones concurrentes serializadas por usuario', () => {
  it('doce eventos distintos de un mismo usuario en paralelo reciben doce posiciones consecutivas', async () => {
    const item = itemAt(anaSession, 1);
    const events = Array.from({ length: 12 }, (_, i) =>
      itemEvent(ana, anaSession, item, i % 2 === 0 ? 'HELP_REQUESTED' : 'ALREADY_KNOW_CLAIMED', {}, {
        device_id: i % 3 === 0 ? anaSecondDevice : ana.deviceId,
      }),
    );
    const results = await Promise.all(events.map((event) => send(ana, event)));
    const errors = results.filter((r) => r.error);
    expect(errors, errors.map((e) => e.error?.message).join('; ')).toEqual([]);
    const got = results.map((r) => Number(r.data?.stream_position)).sort((a, b) => a - b);
    expect(got).toEqual(Array.from({ length: 12 }, (_, i) => i + 2));
    expect(positionsOf(ana.id)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
  });

  it('dos usuarios en paralelo mantienen streams independientes y contiguos', async () => {
    const anaBurst = Array.from({ length: 6 }, () =>
      itemEvent(ana, anaSession, itemAt(anaSession, 1), 'HELP_REQUESTED'),
    );
    const beaBurst = Array.from({ length: 6 }, () =>
      itemEvent(bea, beaSession, itemAt(beaSession, 0), 'HELP_REQUESTED'),
    );
    const results = await Promise.all([
      ...anaBurst.map((event) => send(ana, event)),
      ...beaBurst.map((event) => send(bea, event)),
    ]);
    expect(results.filter((r) => r.error)).toEqual([]);
    expect(positionsOf(ana.id)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(positionsOf(bea.id)).toEqual(Array.from({ length: 7 }, (_, i) => i + 1));
  });

  it('el estado de sincronización por dispositivo refleja el último evento aceptado de cada uno (EC-012)', async () => {
    const { data, error } = await ana.client
      .from('sync_state')
      .select('device_id, last_server_event_id, last_sync_at')
      .order('device_id');
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    for (const row of data ?? []) {
      expect(row.last_server_event_id).toMatch(/^[0-9a-f-]{36}$/);
      const owned = query<{ n: number }>(
        `select count(*)::int as n from public.learning_events where event_id = '${String(row.last_server_event_id)}' and user_id = '${ana.id}' and device_id = '${String(row.device_id)}'`,
      );
      expect(Number(owned[0]?.n)).toBe(1);
    }
  });
});
