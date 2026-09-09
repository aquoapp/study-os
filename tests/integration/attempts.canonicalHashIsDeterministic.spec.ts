import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { canonicalHash, canonicalTimestamp } from '@study-os/domain';

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
 * `attempts.canonicalHashIsDeterministic.spec` · ADR-008 «dos representaciones equivalentes
 * del mismo payload producen el mismo hash» · SD-022 conjuntos de campos.
 *
 * El hash de respuesta que el servidor almacena es exactamente el SHA-256 del payload
 * canónico del conjunto de campos de respuesta (incluida la versión de clave resuelta), y el
 * hash de evento es el del sobre normalizado: las dos implementaciones (SQL y TypeScript)
 * coinciden sobre datos reales, no solo sobre vectores.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let session: CreatedSession;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2hash');
  ana = await createLearner(env, 'hash', pack);
  session = await createSession(ana, [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }]);
  await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
}, 240_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('SD-022 · el hash almacenado es reproducible desde el contrato', () => {
  it('hash de evento: sobre normalizado (instante en UTC, UUID en minúsculas, ausentes omitidos)', async () => {
    const q = question(pack, 0);
    const item = itemAt(session, 0);
    const options = await optionsOf(ana, q.representationId);
    const order = [options[2]?.id, options[0]?.id, options[1]?.id].map((id) => String(id).toUpperCase());
    const event = itemEvent(ana, session, item, 'QUESTION_PRESENTED', {
      presented_option_order: order,
      question_representation_id: q.representationId.toUpperCase(),
    }, { client_created_at: '2026-09-09T12:00:00.250+02:00', client_sequence: 41 });
    const accepted = await accept(ana, event);
    const expected = await canonicalHash({
      event_type: 'QUESTION_PRESENTED',
      schema_version: 1,
      client_created_at: canonicalTimestamp('2026-09-09T12:00:00.250+02:00'),
      payload: {
        question_representation_id: q.representationId.toLowerCase(),
        presented_option_order: order.map((id) => id.toLowerCase()),
      },
      session_id: session.session_id,
      session_item_id: item.session_item_id,
      device_id: ana.deviceId,
      client_sequence: 41,
    });
    expect(accepted.payload_hash).toBe(expected);
    const stored = one<{ h: string; v: string }>(
      `select payload_hash as h, canonicalization_version as v from public.learning_events where event_id = '${accepted.event_id}'`,
    );
    expect(stored.h).toBe(expected);
    expect(stored.v).toBe('v1');
  });

  it('hash de respuesta: los nueve campos del contrato, con la clave resuelta por el servidor', async () => {
    const q = question(pack, 0);
    const item = itemAt(session, 0);
    const options = await optionsOf(ana, q.representationId);
    const chosen = options.find((o) => o.option_key === q.correctOptionKey);
    const order = [options[2]?.id, options[0]?.id, options[1]?.id].map(String);
    const answered = await accept(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: q.representationId,
        answer_kind: 'OPTION',
        selected_option_id: chosen?.id,
        presented_option_order: order,
        confidence_value: 4,
        confidence_scale_version: 'v1',
        response_ms: 777,
      }),
    );
    const row = one<{
      answer_payload_hash: string;
      canonicalization_version: string;
      answer_key_version_id: string;
      question_representation_id: string;
      selected_option_id: string;
      presented_option_order: string[];
    }>(
      `select answer_payload_hash, canonicalization_version, answer_key_version_id, question_representation_id, selected_option_id, presented_option_order from public.question_attempts where submitted_event_id = '${answered.event_id}'`,
    );
    expect(row.answer_key_version_id).toBe(q.keyId);
    expect(row.canonicalization_version).toBe('v1');
    const expected = await canonicalHash({
      question_id: q.questionId,
      question_representation_id: q.representationId,
      answer_kind: 'OPTION',
      selected_option_id: chosen?.id,
      presented_option_order: order,
      confidence_value: 4,
      confidence_scale_version: 'v1',
      response_ms: 777,
      answer_key_version_id: q.keyId,
    });
    expect(row.answer_payload_hash).toBe(expected);
    expect(answered.attempt?.['is_correct']).toBe(true);
  });

  it('un blanco sin confianza ni tiempo serializa nulos explícitos (ausente ≠ nulo en el conjunto fijo)', async () => {
    const q = question(pack, 1);
    const second = await createSession(ana, [{ item_type: 'QUESTION', target_id: q.questionId }]);
    await accept(ana, eventFor(ana, second, 'SESSION_STARTED'));
    await accept(ana, itemEvent(ana, second, itemAt(second, 0), 'QUESTION_PRESENTED', { question_representation_id: q.representationId }));
    const blank = await accept(
      ana,
      itemEvent(ana, second, itemAt(second, 0), 'ANSWER_SUBMITTED', { question_representation_id: q.representationId, answer_kind: 'BLANK' }),
    );
    const row = one<{ h: string }>(
      `select answer_payload_hash as h from public.question_attempts where submitted_event_id = '${blank.event_id}'`,
    );
    const expected = await canonicalHash({
      question_id: q.questionId,
      question_representation_id: q.representationId,
      answer_kind: 'BLANK',
      selected_option_id: null,
      confidence_value: null,
      confidence_scale_version: null,
      response_ms: null,
      answer_key_version_id: q.keyId,
    });
    expect(row.h).toBe(expected);
  });
});
