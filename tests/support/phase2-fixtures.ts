import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { LearningEventEnvelope, LearningEventType } from '@study-os/domain';

import { publish, type SyntheticPack } from './phase1a-fixtures';
import { createTestUser, type TestEnv, type TestUser } from './supabase-test-env';

/**
 * Fixtures de Phase 2 · aprendices sintéticos sobre packs GENERATED.
 *
 * Todo lo que crea un aprendiz de prueba cuelga de su cuenta: al borrarla (`deleteTestUser`)
 * la cascada se lleva ajustes, objetivos, dispositivos, sesiones, ítems, eventos e intentos
 * (CDEM §24), de modo que la purga del pack (`purge_generated_pack`) encuentra los destinos
 * sin referencias (ON DELETE RESTRICT, ADR-007 v1.1). Ninguna prueba escribe evidencia por
 * otra vía que `append_learning_event`; ninguna crea sesiones por otra vía que
 * `create_study_session`.
 */

export interface Learner extends TestUser {
  readonly goalId: string;
  readonly deviceId: string;
  readonly packId: string;
}

export interface RpcResult<T = Record<string, unknown>> {
  readonly data: T | null;
  readonly error: { code?: string; message: string; details?: string } | null;
}

export async function rpc<T = Record<string, unknown>>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const { data, error } = await client.rpc(name, args);
  return { data: (data as T | null) ?? null, error: error ? { ...error } : null };
}

/** Crea usuario + ajustes + objetivo ACTIVE sobre el pack + dispositivo, por las rutas de cliente. */
export async function createLearner(env: TestEnv, label: string, pack: SyntheticPack): Promise<Learner> {
  const user = await createTestUser(env, label);
  const settings = await user.client
    .from('learner_settings')
    .insert({ user_id: user.id, default_daily_minutes: 40, weekly_availability_json: { mon: 40, wed: 40 } });
  if (settings.error) throw new Error(`learner_settings: ${settings.error.message}`);
  const goal = await user.client
    .from('learner_exam_goals')
    .insert({ user_id: user.id, exam_pack_id: pack.packId, target_date: '2027-06-01', starting_level: 'BEGINNER' })
    .select('id')
    .single();
  if (goal.error || !goal.data) throw new Error(`learner_exam_goals: ${goal.error?.message ?? 'sin fila'}`);
  const device = await user.client
    .from('devices')
    .insert({ user_id: user.id, device_label: `fixture:${label}`, installation_id: `inst-${randomUUID()}` })
    .select('id')
    .single();
  if (device.error || !device.data) throw new Error(`devices: ${device.error?.message ?? 'sin fila'}`);
  return { ...user, goalId: goal.data.id as string, deviceId: device.data.id as string, packId: pack.packId };
}

export interface SessionItemRef {
  readonly session_item_id: string;
  readonly sort_order: number;
  readonly item_type: string;
  readonly target_id: string;
}

export interface CreatedSession {
  readonly session_id: string;
  readonly status: string;
  readonly items: SessionItemRef[];
}

export async function createSession(
  learner: Learner,
  items: Array<{ item_type: string; target_id: string; planned_minutes?: number }>,
  sessionType = 'FIXTURE',
): Promise<CreatedSession> {
  const result = await rpc<CreatedSession>(learner.client, 'create_study_session', {
    p_goal_id: learner.goalId,
    p_session_type: sessionType,
    p_planned_minutes: 30,
    p_items: items,
  });
  if (result.error || !result.data) throw new Error(`create_study_session: ${result.error?.message ?? 'sin datos'}`);
  return result.data;
}

export interface EventOptions {
  readonly event_id?: string;
  readonly session_id?: string;
  readonly session_item_id?: string;
  readonly device_id?: string | null;
  readonly client_created_at?: string;
  readonly client_sequence?: number;
  readonly created_offline?: boolean;
  readonly source_event_id?: string;
  readonly schema_version?: number;
}

let sequence = 0;

/** Sobre de evento válido por defecto; cada opción puede sobrescribirse para atacar. */
export function envelope(
  learner: Learner,
  type: LearningEventType,
  payload: Record<string, unknown> = {},
  options: EventOptions = {},
): Record<string, unknown> {
  sequence += 1;
  const out: Record<string, unknown> = {
    event_id: options.event_id ?? randomUUID(),
    event_type: type,
    schema_version: options.schema_version ?? 1,
    client_created_at: options.client_created_at ?? new Date().toISOString(),
    client_sequence: options.client_sequence ?? sequence,
    payload,
  };
  if (options.session_id) out['session_id'] = options.session_id;
  if (options.session_item_id) out['session_item_id'] = options.session_item_id;
  if (options.device_id !== null) out['device_id'] = options.device_id ?? learner.deviceId;
  if (options.created_offline !== undefined) out['created_offline'] = options.created_offline;
  if (options.source_event_id) out['source_event_id'] = options.source_event_id;
  return out;
}

export interface AcceptedEvent {
  readonly event_id: string;
  readonly stream_position: number;
  readonly payload_hash: string;
  readonly canonicalization_version: string;
  readonly server_received_at: string;
  readonly idempotent: boolean;
  readonly session: { session_id: string; status: string; resume_cursor: Record<string, unknown> | null } | null;
  readonly attempt: Record<string, unknown> | null;
}

export async function send(learner: Learner, event: Record<string, unknown>): Promise<RpcResult<AcceptedEvent>> {
  return rpc<AcceptedEvent>(learner.client, 'append_learning_event', { p_event: event });
}

/** Envía y exige aceptación; devuelve el resultado. */
export async function accept(learner: Learner, event: Record<string, unknown>): Promise<AcceptedEvent> {
  const result = await send(learner, event);
  if (result.error || !result.data) {
    throw new Error(`append_learning_event rechazó ${String(event['event_type'])}: ${result.error?.message ?? 'sin datos'}`);
  }
  return result.data;
}

/** Envía y exige rechazo con un código concreto en el mensaje; devuelve el error. */
export async function reject(
  learner: Learner,
  event: Record<string, unknown>,
  code: string,
): Promise<{ code?: string; message: string }> {
  const result = await send(learner, event);
  if (!result.error) {
    throw new Error(`append_learning_event aceptó ${String(event['event_type'])} y debía rechazarlo con ${code}`);
  }
  if (!result.error.message.includes(code)) {
    throw new Error(`rechazo con otro código: esperado ${code}, recibido ${result.error.message}`);
  }
  return result.error;
}

export function eventFor(
  learner: Learner,
  session: CreatedSession,
  type: LearningEventType,
  payload: Record<string, unknown> = {},
  options: EventOptions = {},
): Record<string, unknown> {
  return envelope(learner, type, payload, { session_id: session.session_id, ...options });
}

export function itemEvent(
  learner: Learner,
  session: CreatedSession,
  item: SessionItemRef,
  type: LearningEventType,
  payload: Record<string, unknown> = {},
  options: EventOptions = {},
): Record<string, unknown> {
  return envelope(learner, type, payload, {
    session_id: session.session_id,
    session_item_id: item.session_item_id,
    ...options,
  });
}

export function itemAt(session: CreatedSession, index: number): SessionItemRef {
  const item = session.items[index];
  if (!item) throw new Error(`la sesión no tiene el ítem ${index}`);
  return item;
}

/** Opciones (id, clave) de una representación, leídas como el propio aprendiz. */
export async function optionsOf(
  learner: Learner,
  representationId: string,
): Promise<Array<{ id: string; option_key: string }>> {
  const { data, error } = await learner.client
    .from('question_options')
    .select('id, option_key')
    .eq('representation_id', representationId)
    .order('sort_order');
  if (error) throw new Error(`question_options: ${error.message}`);
  return (data ?? []) as Array<{ id: string; option_key: string }>;
}

/** Presenta y responde una pregunta (ítem QUESTION); devuelve el resultado del envío. */
export async function presentAndAnswer(
  learner: Learner,
  session: CreatedSession,
  item: SessionItemRef,
  representationId: string,
  answer: { option_key?: string; blank?: boolean; confidence?: number; response_ms?: number },
): Promise<AcceptedEvent> {
  await accept(learner, itemEvent(learner, session, item, 'QUESTION_PRESENTED', { question_representation_id: representationId }));
  const options = await optionsOf(learner, representationId);
  const payload: Record<string, unknown> = {
    question_representation_id: representationId,
    answer_kind: answer.blank ? 'BLANK' : 'OPTION',
  };
  if (!answer.blank) {
    const chosen = options.find((o) => o.option_key === (answer.option_key ?? 'A'));
    if (!chosen) throw new Error('opción inexistente');
    payload['selected_option_id'] = chosen.id;
    payload['confidence_value'] = answer.confidence ?? 3;
    payload['confidence_scale_version'] = 'v1';
  }
  if (answer.response_ms !== undefined) payload['response_ms'] = answer.response_ms;
  return accept(learner, itemEvent(learner, session, item, 'ANSWER_SUBMITTED', payload));
}

/** Publica una unidad de aprendizaje GENERATED (identidad + primera versión) por la frontera. */
export async function publishLearningUnit(
  admin: SupabaseClient,
  pack: SyntheticPack,
  conceptIndex: number,
  label: string,
): Promise<{ unitId: string; versionId: string }> {
  const conceptId = pack.conceptIds[conceptIndex];
  if (!conceptId) throw new Error('concepto inexistente');
  const { targetId: unitId } = await publish(admin, 'learning_unit', {
    exam_pack_id: pack.packId,
    concept_id: conceptId,
    unit_type: 'LESSON',
  });
  const { targetId: versionId } = await publish(admin, 'learning_unit_version', {
    learning_unit_id: unitId,
    title: `fixture: unidad ${label}`,
    body: 'fixture: cuerpo sintético de una unidad de aprendizaje, sin contenido real.',
    provenance_class: 'GENERATED',
    source_version_id: pack.sourceVersionId,
  });
  return { unitId, versionId };
}

/** Todos los eventos de una sesión, en orden de stream, leídos como el aprendiz. */
export async function sessionEvents(
  learner: Learner,
  sessionId: string,
): Promise<Array<{ event_id: string; event_type: string; session_item_id: string | null; stream_position: number; payload: Record<string, unknown> }>> {
  const { data, error } = await learner.client
    .from('learning_events')
    .select('event_id, event_type, session_item_id, stream_position, payload')
    .eq('session_id', sessionId)
    .order('stream_position');
  if (error) throw new Error(`learning_events: ${error.message}`);
  return (data ?? []) as Array<{ event_id: string; event_type: string; session_item_id: string | null; stream_position: number; payload: Record<string, unknown> }>;
}

export async function sessionRow(
  learner: Learner,
  sessionId: string,
): Promise<{ status: string; resume_cursor_json: Record<string, unknown> | null; started_at: string | null; completed_at: string | null }> {
  const { data, error } = await learner.client
    .from('study_sessions')
    .select('status, resume_cursor_json, started_at, completed_at')
    .eq('id', sessionId)
    .single();
  if (error || !data) throw new Error(`study_sessions: ${error?.message ?? 'sin fila'}`);
  return data as { status: string; resume_cursor_json: Record<string, unknown> | null; started_at: string | null; completed_at: string | null };
}

export type { LearningEventEnvelope };
