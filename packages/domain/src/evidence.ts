/**
 * Contrato de evidencia de Phase 2 · espejo de la migración 18 (`ingest.event_field_types`,
 * `public.confidence_scales`) y de SD-008 / SD-022 / SD-023.
 *
 * El servidor es la autoridad: estas constantes existen para que el cliente construya
 * eventos válidos y para que las pruebas comprueben, contra el texto de la migración, que
 * ambos lados dicen lo mismo (`evidence.contract.spec`). Un desajuste es un fallo de
 * prueba, nunca una divergencia silenciosa (D-06: listas espejo, verificadas).
 */

/** CDEM §11 · taxonomía P0 completa, en el orden del enum `public.learning_event_type`. */
export const LEARNING_EVENT_TYPES = [
  'SESSION_STARTED',
  'SESSION_INTERRUPTED',
  'SESSION_RESUMED',
  'SESSION_COMPLETED',
  'SESSION_ITEM_STARTED',
  'SESSION_ITEM_COMPLETED',
  'LEARNING_UNIT_VIEWED',
  'LEARNING_UNIT_COMPLETED',
  'HELP_REQUESTED',
  'ALREADY_KNOW_CLAIMED',
  'ALREADY_KNOW_CHECKED',
  'INTERVENTION_SHOWN',
  'INTERVENTION_COMPLETED',
  'QUESTION_PRESENTED',
  'ANSWER_SELECTED',
  'ANSWER_SUBMITTED',
  'CONFIDENCE_RECORDED',
  'FEEDBACK_VIEWED',
  'PRACTICAL_STARTED',
  'PRACTICAL_COMPLETED',
  'SIMULATION_STARTED',
  'SIMULATION_COMPLETED',
  'AVAILABILITY_CHANGED',
  'TODAY_OVERRIDE_SET',
  'RESCUE_MODE_ENTERED',
  'REPLAN_CONFIRMED',
  'RECOVERY_STARTED',
  'NOTE_CREATED',
  'NOTE_UPDATED',
  'NOTE_REMEMBER_FLAGGED',
  'PERSONAL_MATERIAL_APPROVED',
  'SYNC_PENDING',
  'SYNC_CONFIRMED',
  'SOURCE_UPDATE_ACKNOWLEDGED',
] as const;

export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

export type EventFieldType = 'uuid' | 'string' | 'integer' | 'boolean' | 'object' | 'uuid_array';

export interface EventSchemaV1 {
  readonly scope: 'session' | 'item' | 'user';
  readonly item_type?: 'LEARNING_UNIT' | 'QUESTION' | 'PRACTICAL' | 'CONCEPT_REVIEW';
  readonly required: Readonly<Record<string, EventFieldType>>;
  readonly optional: Readonly<Record<string, EventFieldType>>;
}

/**
 * Esquemas v1 de los tipos que Phase 2 acepta. Los tipos ausentes se rechazan en servidor
 * (`EVENT_TYPE_NOT_ACCEPTED`) hasta que su fase productora exista.
 */
export const EVENT_SCHEMAS_V1: Readonly<Partial<Record<LearningEventType, EventSchemaV1>>> = {
  SESSION_STARTED: { scope: 'session', required: {}, optional: {} },
  SESSION_INTERRUPTED: { scope: 'session', required: {}, optional: { reason: 'string' } },
  SESSION_RESUMED: { scope: 'session', required: {}, optional: {} },
  SESSION_COMPLETED: { scope: 'session', required: {}, optional: {} },
  SESSION_ITEM_STARTED: { scope: 'item', required: {}, optional: {} },
  SESSION_ITEM_COMPLETED: { scope: 'item', required: {}, optional: {} },
  LEARNING_UNIT_VIEWED: {
    scope: 'item',
    item_type: 'LEARNING_UNIT',
    required: { learning_unit_version_id: 'uuid' },
    optional: {},
  },
  LEARNING_UNIT_COMPLETED: { scope: 'item', item_type: 'LEARNING_UNIT', required: {}, optional: {} },
  HELP_REQUESTED: { scope: 'item', required: {}, optional: { topic: 'string' } },
  ALREADY_KNOW_CLAIMED: { scope: 'item', required: {}, optional: {} },
  QUESTION_PRESENTED: {
    scope: 'item',
    item_type: 'QUESTION',
    required: { question_representation_id: 'uuid' },
    optional: { presented_option_order: 'uuid_array' },
  },
  ANSWER_SELECTED: {
    scope: 'item',
    item_type: 'QUESTION',
    required: { question_representation_id: 'uuid', selected_option_id: 'uuid' },
    optional: {},
  },
  CONFIDENCE_RECORDED: {
    scope: 'item',
    item_type: 'QUESTION',
    required: { confidence_value: 'integer', confidence_scale_version: 'string' },
    optional: {},
  },
  ANSWER_SUBMITTED: {
    scope: 'item',
    item_type: 'QUESTION',
    required: { question_representation_id: 'uuid', answer_kind: 'string' },
    optional: {
      selected_option_id: 'uuid',
      presented_option_order: 'uuid_array',
      confidence_value: 'integer',
      confidence_scale_version: 'string',
      response_ms: 'integer',
    },
  },
  FEEDBACK_VIEWED: { scope: 'item', item_type: 'QUESTION', required: {}, optional: {} },
  PRACTICAL_STARTED: { scope: 'item', item_type: 'PRACTICAL', required: {}, optional: {} },
  PRACTICAL_COMPLETED: { scope: 'item', item_type: 'PRACTICAL', required: {}, optional: {} },
  AVAILABILITY_CHANGED: {
    scope: 'user',
    required: { default_daily_minutes: 'integer', weekly_availability_json: 'object' },
    optional: {},
  },
};

export const PHASE_2_ACCEPTED_EVENT_TYPES = Object.keys(EVENT_SCHEMAS_V1) as readonly LearningEventType[];

/** Claves del sobre que el cliente puede enviar. Cualquier otra se rechaza. */
export const EVENT_ENVELOPE_KEYS = [
  'event_id',
  'event_type',
  'schema_version',
  'client_created_at',
  'payload',
  'session_id',
  'session_item_id',
  'device_id',
  'client_sequence',
  'created_offline',
  'source_event_id',
] as const;

/**
 * SD-023 §4 · campos autoritativos: su presencia en el sobre o en el payload hace malformado
 * el evento. Nunca se ignoran en silencio.
 */
export const CLIENT_AUTHORITATIVE_FIELDS_REJECTED = [
  'user_id',
  'stream_position',
  'server_received_at',
  'engine_processed_at',
  'payload_hash',
  'canonicalization_version',
  'attempt_number',
  'is_correct_at_submission',
  'correct_option_id',
  'answer_key_version_id',
] as const;

/** SD-008 · escala de confianza v1 (BD-03): cuatro niveles con las etiquetas canónicas. */
export const CONFIDENCE_SCALE_V1 = {
  version: 'v1',
  levels: 4,
  labels: ['Nada segura', 'Dudosa', 'Bastante', 'Segura'],
} as const;

export const ANSWER_KINDS = ['OPTION', 'BLANK'] as const;
export const SESSION_STATUSES = ['PLANNED', 'ACTIVE', 'INTERRUPTED', 'COMPLETED', 'ABANDONED'] as const;
export const SESSION_ITEM_TYPES = ['LEARNING_UNIT', 'QUESTION', 'PRACTICAL', 'CONCEPT_REVIEW'] as const;
export const SESSION_ITEM_STATUSES = ['PENDING', 'ACTIVE', 'COMPLETED'] as const;

export interface LearningEventEnvelope {
  readonly event_id: string;
  readonly event_type: LearningEventType;
  readonly schema_version: 1;
  readonly client_created_at: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly session_id?: string;
  readonly session_item_id?: string;
  readonly device_id?: string;
  readonly client_sequence?: number;
  readonly created_offline?: boolean;
  readonly source_event_id?: string;
}
