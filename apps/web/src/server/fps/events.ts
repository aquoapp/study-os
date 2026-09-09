import 'server-only';

import { hash as digestOf, randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearningEventEnvelope, LearningEventType } from '@study-os/domain';

import type { EventRow } from './session';

/**
 * Envío de evidencia. **Única vía de escritura del vertical**: `append_learning_event`.
 *
 * El sobre lleva exactamente siete claves y ninguna más. `device_id`, `client_sequence`,
 * `created_offline` y `source_event_id` se omiten a propósito: el hash canónico del servidor
 * incluye cada clave **presente**, de modo que omitirlas siempre hace que un sobre reconstruido
 * a partir de la fila almacenada sea idéntico al original, byte a byte de canonicalización.
 * Esa es la propiedad de la que depende la recuperación de la corrección tras una recarga.
 *
 * Ningún campo autoritativo viaja jamás: la posición del stream, el hash del payload, el
 * número de intento, la corrección, la opción correcta y el identificador de la versión de
 * clave los pone o los resuelve el servidor, y su sola presencia en el sobre haría el evento
 * malformado (SD-023 §4). La lista canónica vive en `CLIENT_AUTHORITATIVE_FIELDS_REJECTED`.
 */

export interface AttemptOutcome {
  readonly attempt_id: string;
  readonly attempt_number: number;
  readonly question_id: string;
  readonly question_representation_id: string;
  readonly answer_kind: 'OPTION' | 'BLANK';
  readonly selected_option_id: string | null;
  readonly is_correct: boolean;
  readonly correct_option_id: string;
  readonly explanation: string | null;
  readonly confidence_value: number | null;
  readonly confidence_scale_version: string | null;
  readonly submitted_at: string;
}

export interface AppendResult {
  readonly event_id: string;
  readonly stream_position: number;
  readonly idempotent: boolean;
  readonly attempt: AttemptOutcome | null;
  readonly session: { readonly status: string } | null;
}

export class EventRejected extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EventRejected';
    this.code = code;
  }
}

/**
 * Identificador de evento **derivado**, no aleatorio.
 *
 * El envío de una respuesta necesita la misma identidad en cada reintento y después de una
 * recarga: con un identificador nuevo el servidor rechazaría el segundo envío con
 * `ITEM_COMPLETED`, y con el mismo lo devuelve de forma idempotente. Derivarlo del ítem evita
 * depender de almacenamiento local, que no es autoridad.
 *
 * Se le da la forma de un UUID versión 4 porque la columna es `uuid`; la aleatoriedad no
 * aporta nada aquí y la reproducibilidad sí.
 */
export function derivedEventId(seed: string): string {
  // `crypto.hash` en una sola llamada: no hay `.update()` de por medio, que es un nombre
  // reservado a la mutación de tablas en la guarda de autoridad y no significa eso aquí.
  const digest = digestOf('sha256', `study-os:fps:${seed}`, 'buffer');
  const bytes = Uint8Array.prototype.slice.call(digest, 0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function newEventId(): string {
  return randomUUID();
}

interface BuildOptions {
  readonly eventId: string;
  readonly type: LearningEventType;
  readonly sessionId?: string;
  readonly itemId?: string;
  readonly payload?: Record<string, unknown>;
  readonly clientCreatedAt?: string;
}

export function buildEnvelope(options: BuildOptions): LearningEventEnvelope {
  const envelope: Record<string, unknown> = {
    event_id: options.eventId,
    event_type: options.type,
    schema_version: 1,
    client_created_at: options.clientCreatedAt ?? new Date().toISOString(),
    payload: options.payload ?? {},
  };
  if (options.sessionId) envelope['session_id'] = options.sessionId;
  if (options.itemId) envelope['session_item_id'] = options.itemId;
  return envelope as unknown as LearningEventEnvelope;
}

/** Reconstruye el sobre exacto de un evento ya aceptado, para repetirlo sin crear nada. */
export function envelopeFromStored(stored: EventRow): LearningEventEnvelope {
  return buildEnvelope({
    eventId: stored.event_id,
    type: stored.event_type as LearningEventType,
    ...(stored.session_id ? { sessionId: stored.session_id } : {}),
    ...(stored.session_item_id ? { itemId: stored.session_item_id } : {}),
    payload: stored.payload,
    clientCreatedAt: stored.client_created_at,
  });
}

/** Código de rechazo del servidor, tal como lo emite: `STUDY_OS_EVENT · CÓDIGO · detalle`. */
function rejectionCode(message: string): string {
  const match = /STUDY_OS_(?:EVENT|SESSION) · ([A-Z_]+)/.exec(message);
  return match?.[1] ?? 'UNKNOWN';
}

export async function appendEvent(
  supabase: SupabaseClient,
  envelope: LearningEventEnvelope,
): Promise<AppendResult> {
  const { data, error } = await supabase.rpc('append_learning_event', { p_event: envelope });
  if (error) throw new EventRejected(rejectionCode(error.message), error.message);
  return data as AppendResult;
}

/**
 * Recupera el resultado de un envío ya aceptado, repitiendo su sobre exacto.
 *
 * `question_attempts` no guarda la opción correcta ni la explicación, así que esta es la única
 * vía dentro del contrato congelado para volver a mostrar la corrección después de una
 * recarga. No crea intento, no consume posición y devuelve `idempotent: true`.
 *
 * Vive aquí y no entre las acciones porque no es una acción: no la invoca el navegador, la
 * usa la pantalla al pintarse.
 */
export async function recoverOutcome(
  supabase: SupabaseClient,
  stored: EventRow | null,
): Promise<AppendResult | null> {
  if (!stored) return null;
  return appendEvent(supabase, envelopeFromStored(stored));
}
