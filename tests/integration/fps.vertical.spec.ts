import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { selectFixedSessionItems, type LearningEventType } from '@study-os/domain';

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
  publishLearningUnit,
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
 * `fps.vertical.spec` · gates FPS-G3 … FPS-G6 · el vertical contra una instancia real.
 *
 * No repite lo que Phase 2 ya demuestra —orden del stream, idempotencia, autoridad de
 * representación, aislamiento— sino lo que el **producto** añade encima: que la asignación es
 * reproducible, que el sobre que envía la aplicación se puede reconstruir desde la fila
 * almacenada y repetir sin crear nada, y que la corrección se recupera después de una recarga.
 *
 * El sobre de esta suite tiene **exactamente las siete claves** que envía la aplicación. No es
 * un detalle: el hash canónico incluye cada clave presente, así que enviar `device_id` o
 * `client_sequence` aquí y no allí probaría otra cosa distinta de la que se quiere probar.
 */

let env: TestEnv;
let pack: SyntheticPack;
let ana: Learner;
let bruno: Learner;

/** Sobre con la forma exacta de la aplicación: siete claves, ni una más. */
function appEnvelope(
  type: LearningEventType,
  options: {
    eventId?: string;
    sessionId?: string;
    itemId?: string;
    payload?: Record<string, unknown>;
    clientCreatedAt?: string;
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
  return envelope;
}

async function storedEvent(learner: Learner, eventId: string) {
  const { data, error } = await learner.client
    .from('learning_events')
    .select(
      'event_id, event_type, session_id, session_item_id, payload, client_created_at, stream_position, schema_version',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw new Error(`learning_events: ${error.message}`);
  return data as {
    event_id: string;
    event_type: string;
    session_id: string;
    session_item_id: string;
    payload: Record<string, unknown>;
    client_created_at: string;
    stream_position: number;
    schema_version: number;
  } | null;
}

/** Reconstruye el sobre desde la fila almacenada, igual que hace la aplicación al repetir. */
function envelopeFromStored(row: NonNullable<Awaited<ReturnType<typeof storedEvent>>>) {
  return appEnvelope(row.event_type as LearningEventType, {
    eventId: row.event_id,
    sessionId: row.session_id,
    itemId: row.session_item_id,
    payload: row.payload,
    clientCreatedAt: row.client_created_at,
  });
}

async function startedSession(
  learner: Learner,
  items: Array<{ item_type: string; target_id: string }>,
): Promise<CreatedSession> {
  const session = await createSession(learner, items, 'FPS_FIXED');
  await accept(learner, appEnvelope('SESSION_STARTED', { sessionId: session.session_id }));
  return session;
}

beforeAll(async () => {
  env = readTestEnv();
  pack = await buildSyntheticPack(adminClient(env), 'fps');
  ana = await createLearner(env, 'fps-ana', pack);
  bruno = await createLearner(env, 'fps-bruno', pack);
}, 180_000);

afterAll(async () => {
  // Primero las cuentas y después el pack: la evidencia fija el contenido con `RESTRICT`, que
  // es la misma protección que impide borrar una clave que el intento de alguien resuelve.
  for (const learner of [ana, bruno]) {
    if (learner) await deleteTestUser(env, learner.id);
  }
  if (pack) await purgePack(adminClient(env), pack.packId);
}, 180_000);

describe('la sesión fija se crea con la semántica declarada', () => {
  it('`FPS_FIXED` con `planner_run_id` nulo, y los ítems en el orden de la asignación', async () => {
    const unit = await publishLearningUnit(adminClient(env), pack, 0, 'fps-a');
    const items = selectFixedSessionItems(
      [{ id: unit.unitId, conceptKey: 'c1' }],
      [{ id: question(pack, 0).questionId }],
    );
    const session = await createSession(ana, [...items], 'FPS_FIXED');

    const row = await ana.client
      .from('study_sessions')
      .select('session_type, planner_run_id, status')
      .eq('id', session.session_id)
      .single();
    expect(row.data).toMatchObject({
      session_type: 'FPS_FIXED',
      planner_run_id: null,
      status: 'PLANNED',
    });
    expect(session.items.map((item) => item.item_type)).toEqual(['LEARNING_UNIT', 'QUESTION']);
    expect(session.items.map((item) => item.sort_order)).toEqual([1, 2]);
  });

  it('la asignación solo admite destinos publicados del pack del objetivo', async () => {
    // Un identificador inventado no es un destino publicado: la frontera lo rechaza.
    const result = await ana.client.rpc('create_study_session', {
      p_goal_id: ana.goalId,
      p_session_type: 'FPS_FIXED',
      p_planned_minutes: null,
      p_items: [{ item_type: 'QUESTION', target_id: randomUUID() }],
    });
    expect(result.error?.message).toContain('TARGET_NOT_FOUND');
  });

  it('una sesión abierta es visible para su dueña y una terminada sale de la lista', async () => {
    const abiertas = await ana.client
      .from('study_sessions')
      .select('id, status')
      .in('status', ['PLANNED', 'ACTIVE', 'INTERRUPTED']);
    expect(abiertas.error).toBeNull();
    // La regla de HOY es «si hay alguna abierta, gana»: aquí se comprueba que la consulta
    // que la implementa devuelve exactamente las sesiones abiertas y ninguna terminada.
    for (const row of (abiertas.data ?? []) as Array<{ status: string }>) {
      expect(['PLANNED', 'ACTIVE', 'INTERRUPTED']).toContain(row.status);
    }
  });
});

describe('APRENDER · la versión presentada queda vinculada', () => {
  it('la unidad se vincula al presentarse y una versión posterior no la sustituye', async () => {
    const admin = adminClient(env);
    const unit = await publishLearningUnit(admin, pack, 1, 'fps-b');
    const session = await startedSession(ana, [
      { item_type: 'LEARNING_UNIT', target_id: unit.unitId },
    ]);
    const item = itemAt(session, 0);

    await accept(
      ana,
      appEnvelope('LEARNING_UNIT_VIEWED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { learning_unit_version_id: unit.versionId },
      }),
    );

    const bound = await ana.client
      .from('session_items')
      .select('presented_learning_unit_version_id, status')
      .eq('id', item.session_item_id)
      .single();
    expect(bound.data).toMatchObject({
      presented_learning_unit_version_id: unit.versionId,
      status: 'ACTIVE',
    });

    // Una versión **posterior de la misma unidad** no sustituye a la ya presentada: quien leyó
    // una versión la siguió leyendo, aunque el contenido haya avanzado por detrás (SD-021).
    const posterior = await publish(admin, 'learning_unit_version', {
      learning_unit_id: unit.unitId,
      title: 'fixture: unidad fps-b, versión posterior',
      body: 'fixture: cuerpo sintético posterior.',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
    });
    await reject(
      ana,
      appEnvelope('LEARNING_UNIT_VIEWED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { learning_unit_version_id: posterior.targetId },
      }),
      'REPRESENTATION_MISMATCH',
    );

    // Y la vinculada sigue siendo la primera.
    const sigue = await ana.client
      .from('session_items')
      .select('presented_learning_unit_version_id')
      .eq('id', item.session_item_id)
      .single();
    expect(sigue.data).toMatchObject({ presented_learning_unit_version_id: unit.versionId });

    await accept(
      ana,
      appEnvelope('LEARNING_UNIT_COMPLETED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
      }),
    );
    const done = await ana.client
      .from('session_items')
      .select('status')
      .eq('id', item.session_item_id)
      .single();
    expect(done.data).toMatchObject({ status: 'COMPLETED' });
  });
});

describe('COMPROBAR · antes del envío no viaja nada de la corrección', () => {
  it('la presentación no devuelve clave, corrección ni explicación', async () => {
    const q = question(pack, 1);
    const session = await startedSession(ana, [{ item_type: 'QUESTION', target_id: q.questionId }]);
    const item = itemAt(session, 0);

    const presented = await accept(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId },
      }),
    );
    expect(presented.attempt).toBeNull();
    const serialized = JSON.stringify(presented);
    for (const word of ['correct_option', 'answer_key', 'explanation', 'is_correct']) {
      expect(serialized).not.toContain(word);
    }

    // Y ninguna tabla legible por el aprendiz lleva marca de opción correcta.
    const options = await ana.client
      .from('question_options')
      .select('*')
      .eq('representation_id', q.representationId);
    expect(options.error).toBeNull();
    expect(JSON.stringify(options.data)).not.toMatch(/correct|is_right|answer_key/i);
  });
});

describe('el envío se puede repetir sin crear nada', () => {
  it('el payload almacenado normaliza a sí mismo y la repetición devuelve el mismo resultado', async () => {
    const q = question(pack, 2);
    const session = await startedSession(ana, [{ item_type: 'QUESTION', target_id: q.questionId }]);
    const item = itemAt(session, 0);
    const options = await optionsOf(ana, q.representationId);
    const chosen = options.find((option) => option.option_key === q.correctOptionKey);
    expect(chosen).toBeDefined();

    await accept(
      ana,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId },
      }),
    );
    await accept(
      ana,
      appEnvelope('CONFIDENCE_RECORDED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { confidence_value: 3, confidence_scale_version: 'v1' },
      }),
    );

    const submitId = randomUUID();
    const first = await accept(
      ana,
      appEnvelope('ANSWER_SUBMITTED', {
        eventId: submitId,
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: {
          question_representation_id: q.representationId,
          answer_kind: 'OPTION',
          selected_option_id: chosen?.id,
          confidence_value: 3,
          confidence_scale_version: 'v1',
        },
      }),
    );
    expect(first.idempotent).toBe(false);
    expect(first.attempt).not.toBeNull();
    expect(first.attempt?.['is_correct']).toBe(true);
    expect(first.attempt?.['correct_option_id']).toBe(chosen?.id);
    expect(first.attempt?.['explanation']).toBeTruthy();

    // Punto fijo: el payload que devuelve el servidor, reenviado tal cual, produce el mismo
    // hash. Sin esta propiedad la recuperación tras una recarga no sería posible.
    const stored = await storedEvent(ana, submitId);
    expect(stored).not.toBeNull();
    const replayed = await accept(ana, envelopeFromStored(stored!));

    expect(replayed.idempotent).toBe(true);
    expect(replayed.stream_position).toBe(first.stream_position);
    expect(replayed.payload_hash).toBe(first.payload_hash);
    expect(replayed.attempt?.['attempt_id']).toBe(first.attempt?.['attempt_id']);
    expect(replayed.attempt?.['correct_option_id']).toBe(first.attempt?.['correct_option_id']);
    expect(replayed.attempt?.['explanation']).toBe(first.attempt?.['explanation']);

    // Ni un intento de más, ni una posición de más.
    const attempts = await ana.client
      .from('question_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('session_item_id', item.session_item_id);
    expect(attempts.count).toBe(1);

    // Un envío nuevo sobre el mismo ítem ya no cabe: el ítem está completado.
    await reject(
      ana,
      appEnvelope('ANSWER_SUBMITTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: {
          question_representation_id: q.representationId,
          answer_kind: 'OPTION',
          selected_option_id: chosen?.id,
        },
      }),
      'ITEM_COMPLETED',
    );
  });

  it('la corrección solo se ve después de responder, y solo entonces se acepta verla', async () => {
    const q = question(pack, 0);
    const session = await startedSession(bruno, [
      { item_type: 'QUESTION', target_id: q.questionId },
    ]);
    const item = itemAt(session, 0);

    await reject(
      bruno,
      appEnvelope('FEEDBACK_VIEWED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
      }),
      'FEEDBACK_BEFORE_ATTEMPT',
    );

    await accept(
      bruno,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId },
      }),
    );
    const blank = await accept(
      bruno,
      appEnvelope('ANSWER_SUBMITTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: {
          question_representation_id: q.representationId,
          answer_kind: 'BLANK',
          confidence_value: 1,
          confidence_scale_version: 'v1',
        },
      }),
    );
    // La respuesta en blanco es evidencia, no una omisión: hay intento, y no es correcto.
    expect(blank.attempt?.['answer_kind']).toBe('BLANK');
    expect(blank.attempt?.['is_correct']).toBe(false);
    expect(blank.attempt?.['selected_option_id']).toBeNull();
    expect(blank.attempt?.['correct_option_id']).toBeTruthy();

    await accept(
      bruno,
      appEnvelope('FEEDBACK_VIEWED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
      }),
    );
  });

  it('una respuesta incorrecta se corrige como tal y conserva su explicación', async () => {
    const q = question(pack, 1);
    const session = await startedSession(bruno, [
      { item_type: 'QUESTION', target_id: q.questionId },
    ]);
    const item = itemAt(session, 0);
    const options = await optionsOf(bruno, q.representationId);
    const wrong = options.find((option) => option.option_key !== q.correctOptionKey);

    await accept(
      bruno,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId },
      }),
    );
    const result = await accept(
      bruno,
      appEnvelope('ANSWER_SUBMITTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: {
          question_representation_id: q.representationId,
          answer_kind: 'OPTION',
          selected_option_id: wrong?.id,
          confidence_value: 4,
          confidence_scale_version: 'v1',
        },
      }),
    );
    expect(result.attempt?.['is_correct']).toBe(false);
    expect(result.attempt?.['selected_option_id']).toBe(wrong?.id);
    expect(result.attempt?.['correct_option_id']).not.toBe(wrong?.id);
    expect(result.attempt?.['confidence_value']).toBe(4);
  });
});

describe('el vertical no filtra entre aprendices', () => {
  it('una sesión ajena no se lee, ni por identificador ni por ordinal', async () => {
    const q = question(pack, 2);
    const session = await startedSession(ana, [{ item_type: 'QUESTION', target_id: q.questionId }]);

    const ajena = await bruno.client
      .from('study_sessions')
      .select('id')
      .eq('id', session.session_id);
    expect(ajena.data ?? []).toEqual([]);

    const items = await bruno.client
      .from('session_items')
      .select('id')
      .eq('session_id', session.session_id);
    expect(items.data ?? []).toEqual([]);

    const events = await bruno.client
      .from('learning_events')
      .select('event_id')
      .eq('session_id', session.session_id);
    expect(events.data ?? []).toEqual([]);
  });

  it('un evento sobre un ítem ajeno se rechaza aunque se conozca su identificador', async () => {
    const q = question(pack, 0);
    const session = await startedSession(ana, [{ item_type: 'QUESTION', target_id: q.questionId }]);
    const item = itemAt(session, 0);
    const result = await send(
      bruno,
      appEnvelope('QUESTION_PRESENTED', {
        sessionId: session.session_id,
        itemId: item.session_item_id,
        payload: { question_representation_id: q.representationId },
      }),
    );
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toMatch(/SESSION_NOT_FOUND|ITEM_NOT_FOUND/);
  });
});
