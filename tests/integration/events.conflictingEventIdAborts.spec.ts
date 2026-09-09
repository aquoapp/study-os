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
  reject,
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
 * `events.conflictingEventIdAborts.spec` · ADR-008 punto 5 · Security impact de ADR-008.
 *
 * Mismo event_id con otro payload o con otro usuario NO es un reintento: aborta como
 * conflicto de integridad, nunca como éxito idempotente, y no consume posición. La
 * idempotencia no es una vía de suplantación.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let bea: Learner;
let session: CreatedSession;
let beaSession: CreatedSession;

const counter = (userId: string) =>
  Number(
    one<{ next_position: number }>(
      `select next_position from ingest.user_event_counters where user_id = '${userId}'`,
    ).next_position,
  );

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2conf');
  ana = await createLearner(env, 'conf-a', pack);
  bea = await createLearner(env, 'conf-b', pack);
  session = await createSession(ana, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
  ]);
  beaSession = await createSession(bea, [
    { item_type: 'QUESTION', target_id: question(pack, 1).questionId },
  ]);
  await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
  await accept(bea, eventFor(bea, beaSession, 'SESSION_STARTED'));
}, 240_000);

afterAll(async () => {
  for (const learner of [ana, bea]) if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 punto 5 · un event_id reutilizado es conflicto, no éxito', () => {
  it('mismo event_id, mismo usuario, otro payload → EVENT_ID_CONFLICT_PAYLOAD; sin posición consumida', async () => {
    const original = eventFor(ana, session, 'SESSION_INTERRUPTED', { reason: 'fixture: pausa' });
    await accept(ana, original);
    const before = counter(ana.id);
    const tampered = { ...original, payload: { reason: 'fixture: otra cosa' } };
    const error = await reject(ana, tampered, 'EVENT_ID_CONFLICT_PAYLOAD');
    expect(error.code).toBe('23000');
    expect(counter(ana.id)).toBe(before);
    // El evento original sigue intacto.
    const stored = one<{ payload: { reason: string } }>(
      `select payload from public.learning_events where event_id = '${String(original['event_id'])}'`,
    );
    expect(stored.payload.reason).toBe('fixture: pausa');
  });

  it('mismo event_id con otro usuario → EVENT_ID_CONFLICT_OWNER, aunque el payload sea idéntico', async () => {
    const anaEvent = eventFor(ana, session, 'SESSION_RESUMED');
    await accept(ana, anaEvent);
    const before = counter(bea.id);
    // Bea reutiliza el identificador de Ana sobre su propia sesión.
    const stolen = {
      ...anaEvent,
      session_id: beaSession.session_id,
      device_id: bea.deviceId,
    };
    const error = await reject(bea, stolen, 'EVENT_ID_CONFLICT_OWNER');
    expect(error.code).toBe('23000');
    expect(counter(bea.id)).toBe(before);
    // Ni con el mismo sobre exacto (sesión y dispositivo de Ana): la propiedad se compara
    // antes que cualquier otra cosa, y el mensaje no revela nada de la sesión ajena.
    const verbatim = await send(bea, anaEvent);
    expect(verbatim.error?.message).toContain('EVENT_ID_CONFLICT_OWNER');
    expect(verbatim.error?.message).not.toContain(session.session_id);
  });

  it('un conflicto no deja hueco: el siguiente evento legítimo recibe la posición que le tocaba', async () => {
    const before = counter(ana.id);
    const next = await accept(ana, eventFor(ana, session, 'SESSION_INTERRUPTED'));
    expect(next.stream_position).toBe(before);
    expect(counter(ana.id)).toBe(before + 1);
  });
});
