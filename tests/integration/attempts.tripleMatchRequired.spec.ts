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
  optionsOf,
  presentAndAnswer,
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
 * `attempts.tripleMatchRequired.spec` · ADR-008 «triple coincidencia» · SD-018 corrección.
 *
 * Un submitted_event_id ya presente solo es idempotente si coinciden usuario, pregunta y
 * payload canónico completo (answer_payload_hash). Como la RPC resuelve el reenvío en el
 * nivel de evento, la regla del intento se ejercita directamente sobre la función de
 * normalización, con el propietario de la base: la defensa en profundidad tiene que
 * funcionar aunque un día se invoque desde otro camino.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let bea: Learner;
let session: CreatedSession;
let submittedEventId = '';
let attemptId = '';

const lit = (value: Record<string, unknown>) =>
  `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2trip');
  ana = await createLearner(env, 'trip-a', pack);
  bea = await createLearner(env, 'trip-b', pack);
  session = await createSession(ana, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
  ]);
  await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
  const q = question(pack, 0);
  const answered = await presentAndAnswer(ana, session, itemAt(session, 0), q.representationId, {
    option_key: 'A',
    confidence: 3,
    response_ms: 2000,
  });
  submittedEventId = answered.event_id;
  attemptId = String(answered.attempt?.['attempt_id']);
}, 240_000);

afterAll(async () => {
  for (const learner of [ana, bea]) if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 · triple coincidencia sobre ingest.normalize_attempt', () => {
  const basePayload = async () => {
    const q = question(pack, 0);
    const options = await optionsOf(ana, q.representationId);
    return {
      question_representation_id: q.representationId,
      answer_kind: 'OPTION',
      selected_option_id: options.find((o) => o.option_key === 'A')?.id,
      confidence_value: 3,
      confidence_scale_version: 'v1',
      response_ms: 2000,
    };
  };

  it('mismo usuario, misma pregunta, mismo payload canónico → devuelve el intento existente sin número nuevo', async () => {
    const item = itemAt(session, 0);
    const payload = await basePayload();
    const before = one<{ n: number }>(
      `select next_attempt_number as n from ingest.user_question_counters where user_id = '${ana.id}' and question_id = '${question(pack, 0).questionId}'`,
    );
    const rows = query<{ outcome: Record<string, unknown> }>(
      `select ingest.normalize_attempt('${ana.id}', '${submittedEventId}', '${session.session_id}', '${item.session_item_id}', ${lit(payload)}, now()) as outcome`,
    );
    expect(rows[0]?.outcome['attempt_id']).toBe(attemptId);
    expect(rows[0]?.outcome['attempt_number']).toBe(1);
    const after = one<{ n: number }>(
      `select next_attempt_number as n from ingest.user_question_counters where user_id = '${ana.id}' and question_id = '${question(pack, 0).questionId}'`,
    );
    expect(Number(after.n)).toBe(Number(before.n));
    // Una codificación equivalente (opción en mayúsculas, claves en otro orden) también coincide.
    const shuffled = {
      response_ms: 2000,
      confidence_scale_version: 'v1',
      selected_option_id: String(payload.selected_option_id).toUpperCase(),
      answer_kind: 'OPTION',
      confidence_value: 3,
      question_representation_id: payload.question_representation_id.toUpperCase(),
    };
    const again = query<{ outcome: Record<string, unknown> }>(
      `select ingest.normalize_attempt('${ana.id}', '${submittedEventId}', '${session.session_id}', '${item.session_item_id}', ${lit(shuffled)}, now()) as outcome`,
    );
    expect(again[0]?.outcome['attempt_id']).toBe(attemptId);
  });

  it('mismo identificador con otro payload → ATTEMPT_CONFLICT_PAYLOAD, sin residuo', async () => {
    const item = itemAt(session, 0);
    const payload = { ...(await basePayload()), confidence_value: 1 };
    const outcome = attack(
      `perform ingest.normalize_attempt('${ana.id}', '${submittedEventId}', '${session.session_id}', '${item.session_item_id}', ${lit(payload)}, now());`,
    );
    expect(outcome.rejected, outcome.message).toBe(true);
    expect(outcome.message).toContain('ATTEMPT_CONFLICT_PAYLOAD');
  });

  it('mismo identificador con otro usuario → ATTEMPT_CONFLICT_OWNER', async () => {
    const beaSession = await createSession(bea, [
      { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
    ]);
    await accept(bea, eventFor(bea, beaSession, 'SESSION_STARTED'));
    const q = question(pack, 0);
    await accept(bea, {
      ...(await import('../support/phase2-fixtures')).itemEvent(
        bea,
        beaSession,
        itemAt(beaSession, 0),
        'QUESTION_PRESENTED',
        {
          question_representation_id: q.representationId,
        },
      ),
    });
    const payload = await basePayload();
    const outcome = attack(
      `perform ingest.normalize_attempt('${bea.id}', '${submittedEventId}', '${beaSession.session_id}', '${itemAt(beaSession, 0).session_item_id}', ${lit(payload)}, now());`,
    );
    expect(outcome.rejected, outcome.message).toBe(true);
    expect(outcome.message).toContain('ATTEMPT_CONFLICT_OWNER');
  });

  it('mismo identificador sobre otra pregunta → ATTEMPT_CONFLICT_QUESTION', async () => {
    const other = await createSession(ana, [
      { item_type: 'QUESTION', target_id: question(pack, 1).questionId },
    ]);
    await accept(ana, eventFor(ana, other, 'SESSION_STARTED'));
    const q1 = question(pack, 1);
    const { itemEvent } = await import('../support/phase2-fixtures');
    await accept(
      ana,
      itemEvent(ana, other, itemAt(other, 0), 'QUESTION_PRESENTED', {
        question_representation_id: q1.representationId,
      }),
    );
    const options = await optionsOf(ana, q1.representationId);
    const payload = {
      question_representation_id: q1.representationId,
      answer_kind: 'OPTION',
      selected_option_id: options[0]?.id,
      confidence_value: 3,
      confidence_scale_version: 'v1',
    };
    const outcome = attack(
      `perform ingest.normalize_attempt('${ana.id}', '${submittedEventId}', '${other.session_id}', '${itemAt(other, 0).session_item_id}', ${lit(payload)}, now());`,
    );
    expect(outcome.rejected, outcome.message).toBe(true);
    expect(outcome.message).toContain('ATTEMPT_CONFLICT_QUESTION');
  });
});
