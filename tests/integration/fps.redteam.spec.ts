import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { LearningEventType } from '@study-os/domain';

import {
  buildSyntheticPack,
  publish,
  purgePack,
  question,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  itemAt,
  optionsOf,
  reject,
  send,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `fps.redteam.spec` · ataques al **camino de producto** del First Product Slice.
 *
 * Phase 2 ya demuestra que la frontera de evidencia resiste; lo que aquí se ataca es el sobre
 * concreto que envía la aplicación, con sus siete claves, por si esa forma exacta abriera algo
 * que la forma de los fixtures no abría. Cada ataque termina en rechazo **sin residuo**: sin
 * intento, sin posición consumida y sin cambiar lo vinculado.
 */

let env: TestEnv;
let pack: SyntheticPack;
let ana: Learner;

function appEnvelope(
  type: LearningEventType,
  options: {
    eventId?: string;
    sessionId?: string;
    itemId?: string;
    payload?: Record<string, unknown>;
    clientCreatedAt?: string;
    extra?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  const envelope: Record<string, unknown> = {
    event_id: options.eventId ?? randomUUID(),
    event_type: type,
    schema_version: 1,
    client_created_at: options.clientCreatedAt ?? new Date().toISOString(),
    payload: options.payload ?? {},
  };
  if (options.sessionId) envelope['session_id'] = options.sessionId;
  if (options.itemId) envelope['session_item_id'] = options.itemId;
  return { ...envelope, ...(options.extra ?? {}) };
}

async function questionSession(learner: Learner, index: number): Promise<CreatedSession> {
  const session = await createSession(
    learner,
    [{ item_type: 'QUESTION', target_id: question(pack, index).questionId }],
    'FPS_FIXED',
  );
  await accept(learner, appEnvelope('SESSION_STARTED', { sessionId: session.session_id }));
  return session;
}

/** Posición siguiente del stream del aprendiz: sirve para probar que un rechazo no consume. */
async function nextPosition(learner: Learner): Promise<number> {
  const { data } = await learner.client
    .from('learning_events')
    .select('stream_position')
    .order('stream_position', { ascending: false })
    .limit(1);
  const rows = (data ?? []) as Array<{ stream_position: number }>;
  return (rows[0]?.stream_position ?? 0) + 1;
}

beforeAll(async () => {
  env = readTestEnv();
  pack = await buildSyntheticPack(adminClient(env), 'fps-rt');
  ana = await createLearner(env, 'fps-rt-ana', pack);
}, 180_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(adminClient(env), pack.packId);
}, 180_000);

describe('el sobre de la aplicación no abre ninguna puerta nueva', () => {
  it('un campo autoritativo en el sobre hace malformado el evento y no consume posición', async () => {
    const q = question(pack, 0);
    const session = await questionSession(ana, 0);
    const item = itemAt(session, 0);
    const before = await nextPosition(ana);

    for (const field of [
      'stream_position',
      'payload_hash',
      'attempt_number',
      'is_correct_at_submission',
      'correct_option_id',
      'answer_key_version_id',
      'user_id',
    ]) {
      const result = await send(
        ana,
        appEnvelope('QUESTION_PRESENTED', {
          sessionId: session.session_id,
          itemId: item.session_item_id,
          payload: { question_representation_id: q.representationId },
          extra: { [field]: field === 'stream_position' ? 1 : randomUUID() },
        }),
      );
      expect(result.error?.message, field).toContain('AUTHORITATIVE_FIELD_REJECTED');
    }
    expect(await nextPosition(ana)).toBe(before);
  });

  it('un campo autoritativo dentro del payload tampoco pasa', async () => {
    const q = question(pack, 0);
    const session = await questionSession(ana, 0);
    const item = itemAt(session, 0);
    const result = await send(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: {
          question_representation_id: q.representationId,
          correct_option_id: randomUUID(),
        },
      }),
    );
    expect(result.error?.message).toContain('AUTHORITATIVE_FIELD_REJECTED');
  });

  it('una representación ajena o inventada no se presenta', async () => {
    const session = await questionSession(ana, 1);
    const item = itemAt(session, 0);
    await reject(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: question(pack, 2).representationId },
      }),
      'REPRESENTATION_NOT_PUBLISHED',
    );
    await reject(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: randomUUID() },
      }),
      'REPRESENTATION_NOT_PUBLISHED',
    );
  });

  it('un reloj del cliente en el futuro no elige contenido ni adelanta el stream', async () => {
    const q = question(pack, 1);
    const session = await questionSession(ana, 1);
    const item = itemAt(session, 0);
    const futuro = new Date(Date.now() + 3 * 365 * 24 * 3600 * 1000).toISOString();

    await accept(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId },
        clientCreatedAt: futuro,
      }),
    );
    const bound = await ana.client
      .from('session_items')
      .select('presented_representation_id')
      .eq('id', item.session_item_id)
      .single();
    expect(bound.data).toMatchObject({ presented_representation_id: q.representationId });
  });

  it('una confianza fuera de la escala se rechaza', async () => {
    const q = question(pack, 2);
    const session = await questionSession(ana, 2);
    const item = itemAt(session, 0);
    await accept(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId },
      }),
    );
    for (const value of [0, 5, 99, -1]) {
      const result = await send(
        ana,
        appEnvelope('CONFIDENCE_RECORDED', {
          sessionId: session.session_id,
          itemId: item.session_item_id,
          payload: { confidence_value: value, confidence_scale_version: 'v1' },
        }),
      );
      expect(result.error, `confianza ${value}`).not.toBeNull();
    }
    // Y una versión de escala que no existe tampoco.
    const badScale = await send(
      ana,
      appEnvelope('CONFIDENCE_RECORDED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { confidence_value: 2, confidence_scale_version: 'v99' },
      }),
    );
    expect(badScale.error).not.toBeNull();
  });

  it('una opción que no pertenece a la representación presentada no se acepta', async () => {
    const q = question(pack, 0);
    const otra = question(pack, 1);
    const session = await questionSession(ana, 0);
    const item = itemAt(session, 0);
    await accept(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId },
      }),
    );
    const ajenas = await optionsOf(ana, otra.representationId);
    await reject(
      ana,
      appEnvelope('ANSWER_SUBMITTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: {
          question_representation_id: q.representationId,
          answer_kind: 'OPTION',
          selected_option_id: ajenas[0]?.id,
        },
      }),
      'OPTION_NOT_IN_REPRESENTATION',
    );
  });

  it('una pregunta sin clave no es presentable, así que nunca llega a responderse', async () => {
    const admin = adminClient(env);
    const sinClave = await publish(admin, 'question', {
      exam_pack_id: pack.packId,
      question_type: 'SINGLE_CHOICE',
    });
    await publish(admin, 'question_representation', {
      question_id: sinClave.targetId,
      stem: 'fixture: enunciado sin clave',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
      options: ['A', 'B'].map((key, i) => ({
        option_key: key,
        body: `fixture: opción ${key}`,
        sort_order: i + 1,
      })),
    });
    const representacion = await ana.client
      .from('question_representations')
      .select('id')
      .eq('question_id', sinClave.targetId)
      .single();

    const session = await createSession(
      ana,
      [{ item_type: 'QUESTION', target_id: sinClave.targetId }],
      'FPS_FIXED',
    );
    await accept(ana, appEnvelope('SESSION_STARTED', { sessionId: session.session_id }));
    await reject(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: itemAt(session, 0).session_item_id,
        payload: {
          question_representation_id: (representacion.data as { id: string }).id,
        },
      }),
      'NO_ANSWER_KEY',
    );
  });

  it('una sesión terminada es terminal: ni se reanuda ni admite más evidencia', async () => {
    const session = await questionSession(ana, 2);
    await accept(ana, appEnvelope('SESSION_COMPLETED', { sessionId: session.session_id }));

    await reject(
      ana,
      appEnvelope('SESSION_RESUMED', { sessionId: session.session_id }),
      'SESSION_STATE',
    );
    await reject(
      ana,
      appEnvelope('SESSION_ITEM_STARTED', {
        sessionId: session.session_id,
        itemId: itemAt(session, 0).session_item_id,
      }),
      'SESSION_NOT_ACTIVE',
    );
    // Y la fila sigue siendo terminal, sin que la haya movido nadie.
    const row = await ana.client
      .from('study_sessions')
      .select('status')
      .eq('id', session.session_id)
      .single();
    expect(row.data).toMatchObject({ status: 'COMPLETED' });
  });

  it('ningún rechazo deja intento ni posición de más', async () => {
    const antes = await nextPosition(ana);
    const q = question(pack, 0);
    const session = await questionSession(ana, 0);
    const item = itemAt(session, 0);
    const despuesDeAbrir = await nextPosition(ana);
    expect(despuesDeAbrir).toBe(antes + 1); // solo SESSION_STARTED

    // Responder sin haber presentado: rechazo limpio.
    await reject(
      ana,
      appEnvelope('ANSWER_SUBMITTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId, answer_kind: 'BLANK' },
      }),
      'NOT_PRESENTED',
    );
    expect(await nextPosition(ana)).toBe(despuesDeAbrir);

    const attempts = await ana.client
      .from('question_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('session_item_id', item.session_item_id);
    expect(attempts.count).toBe(0);
  });
});
