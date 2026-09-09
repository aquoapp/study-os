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
  reject,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { one, query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `events.noGapsUnderRollback.spec` · ADR-008 puntos 6 y 8.
 *
 * Toda transacción rechazada —malformación, estado, propiedad, conflicto de intento— se
 * revierte entera, incluido el contador: la posición vive y muere con la transacción que la
 * usa. Tras una serie de rechazos intercalados, el stream sigue siendo 1..n sin huecos.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let session: CreatedSession;

const counter = (userId: string) =>
  Number(
    one<{ next_position: number }>(
      `select coalesce((select next_position from ingest.user_event_counters where user_id = '${userId}'), 1) as next_position`,
    ).next_position,
  );

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2gaps');
  ana = await createLearner(env, 'gaps', pack);
  session = await createSession(ana, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
    { item_type: 'QUESTION', target_id: question(pack, 1).questionId },
  ]);
}, 240_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 puntos 6 y 8 · un rechazo no consume posición', () => {
  it('rechazos de distintas clases intercalados con aceptaciones dejan un stream contiguo', async () => {
    const item0 = itemAt(session, 0);
    const q0 = question(pack, 0);
    const q1 = question(pack, 1);

    // Antes de empezar: estado inválido (ítem sin sesión activa).
    await reject(ana, itemEvent(ana, session, item0, 'SESSION_ITEM_STARTED'), 'SESSION_NOT_ACTIVE');
    expect(counter(ana.id)).toBe(1);

    await accept(ana, eventFor(ana, session, 'SESSION_STARTED')); // 1
    // Malformado: clave desconocida.
    await reject(
      ana,
      eventFor(ana, session, 'SESSION_INTERRUPTED', { extra: true }),
      'PAYLOAD_UNKNOWN_KEY',
    );
    // Sin presentación previa.
    await reject(
      ana,
      itemEvent(ana, session, item0, 'ANSWER_SUBMITTED', {
        question_representation_id: q0.representationId,
        answer_kind: 'BLANK',
      }),
      'NOT_PRESENTED',
    );
    expect(counter(ana.id)).toBe(2);

    await accept(
      ana,
      itemEvent(ana, session, item0, 'QUESTION_PRESENTED', {
        question_representation_id: q0.representationId,
      }),
    ); // 2
    // Representación que no es la presentada.
    await reject(
      ana,
      itemEvent(ana, session, item0, 'ANSWER_SUBMITTED', {
        question_representation_id: q1.representationId,
        answer_kind: 'BLANK',
      }),
      'REPRESENTATION_MISMATCH',
    );
    // Opción de otra representación (conflicto dentro de la normalización del intento).
    const foreignOption = one<{ id: string }>(
      `select id from public.question_options where representation_id = '${q1.representationId}' limit 1`,
    );
    await reject(
      ana,
      itemEvent(ana, session, item0, 'ANSWER_SUBMITTED', {
        question_representation_id: q0.representationId,
        answer_kind: 'OPTION',
        selected_option_id: foreignOption.id,
        confidence_value: 2,
        confidence_scale_version: 'v1',
      }),
      'OPTION_NOT_IN_REPRESENTATION',
    );
    // Campo autoritativo del cliente.
    await reject(
      ana,
      itemEvent(ana, session, item0, 'ANSWER_SUBMITTED', {
        question_representation_id: q0.representationId,
        answer_kind: 'BLANK',
        answer_key_version_id: q0.keyId,
      }),
      'AUTHORITATIVE_FIELD_REJECTED',
    );
    expect(counter(ana.id)).toBe(3);

    const blank = await accept(
      ana,
      itemEvent(ana, session, item0, 'ANSWER_SUBMITTED', {
        question_representation_id: q0.representationId,
        answer_kind: 'BLANK',
      }),
    ); // 3
    expect(blank.stream_position).toBe(3);
    expect(blank.attempt?.['answer_kind']).toBe('BLANK');
    expect(blank.attempt?.['is_correct']).toBe(false);

    const positions = query<{ p: number }>(
      `select stream_position as p from public.learning_events where user_id = '${ana.id}' order by 1`,
    ).map((r) => Number(r.p));
    expect(positions).toEqual([1, 2, 3]);
    expect(counter(ana.id)).toBe(4);
    // Ningún intento nació de los envíos rechazados.
    const attempts = one<{ n: number }>(
      `select count(*)::int as n from public.question_attempts where user_id = '${ana.id}'`,
    );
    expect(Number(attempts.n)).toBe(1);
    const qc = one<{ n: number }>(
      `select next_attempt_number as n from ingest.user_question_counters where user_id = '${ana.id}' and question_id = '${q0.questionId}'`,
    );
    expect(Number(qc.n)).toBe(2);
  });
});
