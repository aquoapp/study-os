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
  presentAndAnswer,
  reject,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { attack, one } from '../support/sql';
import { adminClient, deleteTestUser, readTestEnv, type TestEnv } from '../support/supabase-test-env';

/**
 * `attempts.conflictDoesNotConsumeAttemptNumber.spec` · ADR-008 «mismo orden» punto 4.
 *
 * Tras un conflicto de integridad —en el nivel de evento o en el de intento— el siguiente
 * intento legítimo del par (usuario, pregunta) recibe el número que le tocaba, como si el
 * envío en conflicto no hubiera existido.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let first: CreatedSession;
let firstEventId = '';

const lit = (value: Record<string, unknown>) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
const attemptCounter = (userId: string, questionId: string) =>
  Number(
    one<{ n: number }>(
      `select next_attempt_number as n from ingest.user_question_counters where user_id = '${userId}' and question_id = '${questionId}'`,
    ).n,
  );

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2cons');
  ana = await createLearner(env, 'cons', pack);
  first = await createSession(ana, [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }]);
  await accept(ana, eventFor(ana, first, 'SESSION_STARTED'));
  const answered = await presentAndAnswer(ana, first, itemAt(first, 0), question(pack, 0).representationId, {
    option_key: 'B',
    confidence: 2,
  });
  firstEventId = answered.event_id;
}, 240_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 · un conflicto no consume attempt_number', () => {
  it('conflictos de intento y de evento no mueven el contador; el siguiente intento legítimo es el 2', async () => {
    const q = question(pack, 0);
    expect(attemptCounter(ana.id, q.questionId)).toBe(2);

    // Conflicto en el nivel de intento (payload distinto con el mismo submitted_event_id).
    const options = await optionsOf(ana, q.representationId);
    const conflict = attack(
      `perform ingest.normalize_attempt('${ana.id}', '${firstEventId}', '${first.session_id}', '${itemAt(first, 0).session_item_id}', ${lit({
        question_representation_id: q.representationId,
        answer_kind: 'OPTION',
        selected_option_id: options[2]?.id,
        confidence_value: 4,
        confidence_scale_version: 'v1',
      })}, now());`,
    );
    expect(conflict.rejected).toBe(true);
    expect(conflict.message).toContain('ATTEMPT_CONFLICT_PAYLOAD');
    expect(attemptCounter(ana.id, q.questionId)).toBe(2);

    // Conflicto en el nivel de evento: mismo event_id con otro payload, en una segunda sesión.
    const second = await createSession(ana, [{ item_type: 'QUESTION', target_id: q.questionId }]);
    await accept(ana, eventFor(ana, second, 'SESSION_STARTED'));
    await accept(ana, itemEvent(ana, second, itemAt(second, 0), 'QUESTION_PRESENTED', { question_representation_id: q.representationId }));
    const reused = itemEvent(ana, second, itemAt(second, 0), 'ANSWER_SUBMITTED', {
      question_representation_id: q.representationId,
      answer_kind: 'BLANK',
    }, { event_id: firstEventId });
    await reject(ana, reused, 'EVENT_ID_CONFLICT_PAYLOAD');
    expect(attemptCounter(ana.id, q.questionId)).toBe(2);

    // Rechazos de validación en la normalización tampoco consumen número.
    await reject(
      ana,
      itemEvent(ana, second, itemAt(second, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: q.representationId,
        answer_kind: 'OPTION',
        selected_option_id: options[0]?.id,
        confidence_value: 9,
        confidence_scale_version: 'v1',
      }),
      'CONFIDENCE_OUT_OF_RANGE',
    );
    expect(attemptCounter(ana.id, q.questionId)).toBe(2);

    // El siguiente intento legítimo recibe el 2.
    const legit = await accept(
      ana,
      itemEvent(ana, second, itemAt(second, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: q.representationId,
        answer_kind: 'OPTION',
        selected_option_id: options[0]?.id,
        confidence_value: 1,
        confidence_scale_version: 'v1',
      }),
    );
    expect(legit.attempt?.['attempt_number']).toBe(2);
    expect(attemptCounter(ana.id, q.questionId)).toBe(3);
    const numbers = one<{ ns: number[] }>(
      `select array_agg(attempt_number order by attempt_number) as ns from public.question_attempts where user_id = '${ana.id}' and question_id = '${q.questionId}'`,
    );
    expect(numbers.ns.map(Number)).toEqual([1, 2]);
  });
});
