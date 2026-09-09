import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveFpsStep, fpsPathForStep } from '@study-os/domain';

/**
 * Estado de la sesión del First Product Slice, **derivado de la evidencia del servidor**.
 *
 * Ninguna decisión de este módulo consulta el reloj del cliente ni un estado local. El paso
 * actual se deduce de tres cosas que el aprendiz puede leer con su propio token: la sesión,
 * sus ítems y sus eventos. Un cursor local podría acelerar la interfaz, pero nunca puede ser
 * autoridad (`docs/FPS_AUTHORIZATION_PACKET.md` §4.4).
 */

export interface SessionRow {
  readonly id: string;
  readonly status: 'PLANNED' | 'ACTIVE' | 'INTERRUPTED' | 'COMPLETED' | 'ABANDONED';
  readonly session_type: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly resume_cursor_json: Record<string, unknown> | null;
}

export interface ItemRow {
  readonly id: string;
  readonly item_type: 'LEARNING_UNIT' | 'QUESTION' | 'PRACTICAL' | 'CONCEPT_REVIEW';
  readonly sort_order: number;
  readonly status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  readonly learning_unit_id: string | null;
  readonly question_id: string | null;
  readonly presented_representation_id: string | null;
  readonly presented_learning_unit_version_id: string | null;
}

export interface EventRow {
  readonly event_id: string;
  readonly event_type: string;
  readonly session_id: string | null;
  readonly session_item_id: string | null;
  readonly stream_position: number;
  readonly payload: Record<string, unknown>;
  readonly client_created_at: string;
  readonly client_sequence: number | null;
  readonly created_offline: boolean;
  readonly device_id: string | null;
}

export interface SessionState {
  readonly session: SessionRow;
  readonly items: readonly ItemRow[];
  readonly events: readonly EventRow[];
}

export type Step =
  | { readonly kind: 'learn'; readonly ordinal: number; readonly item: ItemRow }
  | { readonly kind: 'check'; readonly ordinal: number; readonly item: ItemRow }
  | {
      readonly kind: 'feedback';
      readonly ordinal: number;
      readonly item: ItemRow;
      readonly submitted: EventRow;
    }
  | { readonly kind: 'end' };

/** Estados en los que una sesión sigue abierta y por tanto **gana** sobre crear otra. */
const OPEN_STATUSES = ['PLANNED', 'ACTIVE', 'INTERRUPTED'] as const;

/**
 * La sesión abierta del aprendiz, si existe.
 *
 * Se toma la más reciente porque el flujo solo permite una: HOY nunca ofrece crear otra
 * mientras haya alguna abierta. Si hubiera dos por una carrera real, quedarse con la más
 * reciente es determinista y la anterior sigue siendo evidencia intacta.
 */
export async function findOpenSession(supabase: SupabaseClient): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('id, status, session_type, started_at, completed_at, resume_cursor_json')
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`sesión abierta: ${error.message}`);
  return (data?.[0] as SessionRow | undefined) ?? null;
}

/** La última sesión del aprendiz, abierta o terminada. Para la pantalla de FIN. */
export async function findLatestSession(supabase: SupabaseClient): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('id, status, session_type, started_at, completed_at, resume_cursor_json')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`última sesión: ${error.message}`);
  return (data?.[0] as SessionRow | undefined) ?? null;
}

export async function loadSessionState(
  supabase: SupabaseClient,
  session: SessionRow,
): Promise<SessionState> {
  const items = await supabase
    .from('session_items')
    .select(
      'id, item_type, sort_order, status, learning_unit_id, question_id, presented_representation_id, presented_learning_unit_version_id',
    )
    .eq('session_id', session.id)
    .order('sort_order');
  if (items.error) throw new Error(`ítems de la sesión: ${items.error.message}`);

  const events = await supabase
    .from('learning_events')
    .select(
      'event_id, event_type, session_id, session_item_id, stream_position, payload, client_created_at, client_sequence, created_offline, device_id',
    )
    .eq('session_id', session.id)
    .order('stream_position');
  if (events.error) throw new Error(`eventos de la sesión: ${events.error.message}`);

  return {
    session,
    items: (items.data ?? []) as ItemRow[],
    events: (events.data ?? []) as EventRow[],
  };
}

/**
 * El evento de envío de un ítem, si existe. Es la pieza con la que se recupera la corrección
 * después de una recarga: `question_attempts` no guarda ni la opción correcta ni la
 * explicación, de modo que la única vía dentro del contrato congelado es repetir este mismo
 * sobre y dejar que el servidor devuelva el resultado de forma idempotente.
 */
export function submittedEventFor(state: SessionState, itemId: string): EventRow | null {
  return (
    state.events.find(
      (event) => event.session_item_id === itemId && event.event_type === 'ANSWER_SUBMITTED',
    ) ?? null
  );
}

/** La última selección guardada de un ítem, para restaurarla al volver. */
export function lastSelectedOptionFor(state: SessionState, itemId: string): string | null {
  const selections = state.events.filter(
    (event) => event.session_item_id === itemId && event.event_type === 'ANSWER_SELECTED',
  );
  const last = selections[selections.length - 1];
  const value = last?.payload?.['selected_option_id'];
  return typeof value === 'string' ? value : null;
}

/** La última confianza registrada de un ítem. */
export function lastConfidenceFor(state: SessionState, itemId: string): number | null {
  const records = state.events.filter(
    (event) => event.session_item_id === itemId && event.event_type === 'CONFIDENCE_RECORDED',
  );
  const last = records[records.length - 1];
  const value = last?.payload?.['confidence_value'];
  return typeof value === 'number' ? value : null;
}

/**
 * El paso exacto en el que está la sesión.
 *
 * La regla vive en `@study-os/domain` (`deriveFpsStep`) porque es **pura**: depende solo de la
 * evidencia y por eso se puede comprobar sin base de datos ni navegador. Aquí solo se le
 * adjuntan las filas completas que la pantalla necesita.
 */
export function deriveStep(state: SessionState): Step {
  const step = deriveFpsStep(state.session.status, state.items, state.events);
  if (step.kind === 'end') return { kind: 'end' };
  const item = state.items.find((candidate) => candidate.id === step.itemId);
  if (!item) return { kind: 'end' };
  if (step.kind === 'feedback') {
    const submitted = submittedEventFor(state, item.id);
    if (!submitted) return { kind: 'end' };
    return { kind: 'feedback', ordinal: step.ordinal, item, submitted };
  }
  return { kind: step.kind, ordinal: step.ordinal, item };
}

/** La ruta que corresponde a un paso. Única fuente de navegación del vertical. */
export function pathForStep(step: Step): string {
  return fpsPathForStep(step.kind === 'end' ? { kind: 'end' } : { ...step, itemId: step.item.id });
}

/** Recuentos de FIN, derivados **solo** de la evidencia del propio aprendiz. */
export interface SessionSummary {
  readonly unidades: number;
  readonly preguntas: number;
  readonly aciertos: number;
  readonly fallos: number;
  readonly enBlanco: number;
  readonly minutos: number | null;
}

export async function summarize(
  supabase: SupabaseClient,
  state: SessionState,
): Promise<SessionSummary> {
  const attempts = await supabase
    .from('question_attempts')
    .select('is_correct_at_submission, answer_kind')
    .eq('session_id', state.session.id);
  if (attempts.error) throw new Error(`intentos de la sesión: ${attempts.error.message}`);
  const rows = (attempts.data ?? []) as Array<{
    is_correct_at_submission: boolean | null;
    answer_kind: string;
  }>;

  const unidades = state.items.filter(
    (item) => item.item_type === 'LEARNING_UNIT' && item.status === 'COMPLETED',
  ).length;

  const started = state.session.started_at ? Date.parse(state.session.started_at) : null;
  const ended = state.session.completed_at ? Date.parse(state.session.completed_at) : null;
  const minutos =
    started !== null && ended !== null && ended >= started
      ? Math.max(1, Math.round((ended - started) / 60000))
      : null;

  return {
    unidades,
    preguntas: rows.length,
    aciertos: rows.filter((row) => row.is_correct_at_submission === true).length,
    fallos: rows.filter((row) => row.is_correct_at_submission === false).length,
    enBlanco: rows.filter((row) => row.answer_kind === 'BLANK').length,
    minutos,
  };
}
