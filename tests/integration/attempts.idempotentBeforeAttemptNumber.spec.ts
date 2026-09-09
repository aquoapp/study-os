import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildSyntheticPack, purgePack, question, type SyntheticPack } from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  eventFor,
  itemAt,
  itemEvent,
  optionsOf,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { one } from '../support/sql';
import { adminClient, deleteTestUser, readTestEnv, type TestEnv } from '../support/supabase-test-env';

/**
 * `attempts.idempotentBeforeAttemptNumber.spec` · ADR-008 «el mismo orden para
 * question_attempts» · EC-013 · CDEM §29.3 («offline answer submitted twice after retry
 * produces one attempt») · REQ-C16.
 *
 * N reenvíos del mismo ANSWER_SUBMITTED ⇒ un intento, con su attempt_number original; el
 * contador de intentos no avanza. Un ANSWER_SUBMITTED distinto (otro event_id) sobre otra
 * sesión es otro intento legítimo con el número siguiente.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let session: CreatedSession;

const attemptCounter = (userId: string, questionId: string) =>
  Number(
    one<{ n: number }>(
      `select coalesce((select next_attempt_number from ingest.user_question_counters where user_id = '${userId}' and question_id = '${questionId}'), 1) as n`,
    ).n,
  );

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2idem');
  ana = await createLearner(env, 'idem', pack);
  session = await createSession(ana, [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }]);
  await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
}, 240_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 · la idempotencia del intento precede al attempt_number', () => {
  it('cinco reenvíos del mismo ANSWER_SUBMITTED producen un único intento con attempt_number 1', async () => {
    const q = question(pack, 0);
    const item = itemAt(session, 0);
    await accept(ana, itemEvent(ana, session, item, 'QUESTION_PRESENTED', { question_representation_id: q.representationId }));
    const options = await optionsOf(ana, q.representationId);
    const submitted = itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
      question_representation_id: q.representationId,
      answer_kind: 'OPTION',
      selected_option_id: options[0]?.id,
      confidence_value: 2,
      confidence_scale_version: 'v1',
      response_ms: 1500,
    });
    const first = await accept(ana, submitted);
    expect(first.attempt?.['attempt_number']).toBe(1);
    expect(attemptCounter(ana.id, q.questionId)).toBe(2);

    const replays = await Promise.all(Array.from({ length: 5 }, () => accept(ana, submitted)));
    for (const replay of replays) {
      expect(replay.idempotent).toBe(true);
      expect(replay.stream_position).toBe(first.stream_position);
      expect(replay.attempt?.['attempt_id']).toBe(first.attempt?.['attempt_id']);
      expect(replay.attempt?.['attempt_number']).toBe(1);
    }
    expect(attemptCounter(ana.id, q.questionId)).toBe(2);
    const rows = one<{ n: number }>(
      `select count(*)::int as n from public.question_attempts where user_id = '${ana.id}' and question_id = '${q.questionId}'`,
    );
    expect(Number(rows.n)).toBe(1);
  });

  it('otra respuesta a la misma pregunta en otra sesión es un intento nuevo con el número siguiente', async () => {
    const q = question(pack, 0);
    const second = await createSession(ana, [{ item_type: 'QUESTION', target_id: q.questionId }]);
    await accept(ana, eventFor(ana, second, 'SESSION_STARTED'));
    const item = itemAt(second, 0);
    await accept(ana, itemEvent(ana, second, item, 'QUESTION_PRESENTED', { question_representation_id: q.representationId }));
    const blank = await accept(
      ana,
      itemEvent(ana, second, item, 'ANSWER_SUBMITTED', { question_representation_id: q.representationId, answer_kind: 'BLANK' }),
    );
    expect(blank.idempotent).toBe(false);
    expect(blank.attempt?.['attempt_number']).toBe(2);
    expect(attemptCounter(ana.id, q.questionId)).toBe(3);
  });

  it('no puede responderse dos veces el mismo ítem: el ítem ya está completado', async () => {
    const q = question(pack, 0);
    const item = itemAt(session, 0);
    const { error } = await ana.client.rpc('append_learning_event', {
      p_event: itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: q.representationId,
        answer_kind: 'BLANK',
      }),
    });
    expect(error?.message).toContain('ITEM_COMPLETED');
    expect(attemptCounter(ana.id, q.questionId)).toBe(3);
  });
});
