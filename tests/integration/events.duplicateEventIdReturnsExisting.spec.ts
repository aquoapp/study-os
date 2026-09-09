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
  send,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { one } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `events.duplicateEventIdReturnsExisting.spec` · ADR-008 punto 4 · REQ-C05 · EC-013 ·
 * Manifest (gate de Phase 2: «duplicate event is idempotent»).
 *
 * El mismo event_id con el mismo usuario y el mismo payload canónico devuelve el evento
 * existente: misma posición, mismo hash, `idempotent: true`, y el contador no avanza. Dos
 * codificaciones distintas del mismo hecho (orden de claves, UUID en mayúsculas, instante
 * con otro desplazamiento horario) son el mismo evento (SD-022).
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let session: CreatedSession;

const counter = (userId: string) =>
  Number(
    one<{ next_position: number }>(
      `select next_position from ingest.user_event_counters where user_id = '${userId}'`,
    ).next_position,
  );

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2dup');
  ana = await createLearner(env, 'dup', pack);
  session = await createSession(ana, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
  ]);
}, 240_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 punto 4 · el mismo hecho reenviado es idempotente', () => {
  it('el reenvío exacto devuelve el evento original sin avanzar el contador', async () => {
    const event = eventFor(ana, session, 'SESSION_STARTED');
    const first = await accept(ana, event);
    const before = counter(ana.id);
    const again = await accept(ana, event);
    expect(again.idempotent).toBe(true);
    expect(again.stream_position).toBe(first.stream_position);
    expect(again.payload_hash).toBe(first.payload_hash);
    expect(again.server_received_at).toBe(first.server_received_at);
    expect(counter(ana.id)).toBe(before);
    const rows = one<{ n: number }>(
      `select count(*)::int as n from public.learning_events where event_id = '${String(event['event_id'])}'`,
    );
    expect(Number(rows.n)).toBe(1);
  });

  it('dos codificaciones equivalentes del mismo evento son el mismo evento (SD-022)', async () => {
    const q = question(pack, 0);
    const item = itemAt(session, 0);
    const base = itemEvent(ana, session, item, 'QUESTION_PRESENTED', {
      question_representation_id: q.representationId,
    });
    const first = await accept(ana, base);

    // Mismo hecho: claves en otro orden, UUID en mayúsculas, mismo instante en otra zona.
    const at = new Date(String(base['client_created_at']));
    const shifted = `${new Date(at.getTime() + 2 * 3_600_000).toISOString().slice(0, -1)}+02:00`;
    const equivalent: Record<string, unknown> = {
      payload: { question_representation_id: q.representationId.toUpperCase() },
      client_sequence: base['client_sequence'],
      session_item_id: String(base['session_item_id']).toUpperCase(),
      client_created_at: shifted,
      device_id: base['device_id'],
      schema_version: 1,
      session_id: base['session_id'],
      event_type: 'QUESTION_PRESENTED',
      event_id: String(base['event_id']).toUpperCase(),
    };
    const again = await accept(ana, equivalent);
    expect(again.idempotent).toBe(true);
    expect(again.stream_position).toBe(first.stream_position);
    expect(again.payload_hash).toBe(first.payload_hash);
  });

  it('un evento nuevo con otro event_id es otro hecho, aunque el payload sea idéntico', async () => {
    const a = eventFor(ana, session, 'SESSION_INTERRUPTED');
    const accepted = await accept(ana, a);
    await accept(ana, eventFor(ana, session, 'SESSION_RESUMED'));
    const b = { ...a, event_id: crypto.randomUUID() };
    const second = await accept(ana, b);
    expect(second.idempotent).toBe(false);
    expect(second.stream_position).toBeGreaterThan(accepted.stream_position);
  });

  it('el reenvío de un evento rechazado no deja rastro: puede aceptarse corregido con el mismo event_id', async () => {
    const bad = eventFor(ana, session, 'SESSION_RESUMED', { unknown_key: 1 });
    const rejected = await send(ana, bad);
    expect(rejected.error?.message).toContain('PAYLOAD_UNKNOWN_KEY');
    const fixed = { ...bad, payload: {} };
    const accepted = await accept(ana, fixed);
    expect(accepted.idempotent).toBe(false);
  });
});
