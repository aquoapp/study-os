/**
 * Lectura del snapshot de evidencia · CP4 · §9.
 *
 * ---------------------------------------------------------------------------------------
 * Todo lo de aquí es `SELECT`, y la completitud se declara, no se presume
 *
 * Cada consulta pasa por `assertReadOnly`. Cada una puede fallar por separado, y cuando una
 * falla el snapshot sale con `observationComplete: false`: el oráculo entonces no puede dar
 * `PASS` a ninguna aserción negativa. La alternativa —rellenar con listas vacías— convertiría
 * un fallo de lectura en una afirmación de ausencia, que es exactamente el error que la barrera
 * de observación existe para impedir.
 *
 * El Observador lee la clave de respuesta **después** de la ejecución, y nunca se la pasa al
 * Actor. Es lo que hace comprobable P-05 sin violar INV-101: la clave entra en el oráculo, no
 * en el aprendiz.
 * ---------------------------------------------------------------------------------------
 */

import { observe, readBarrier, type ObservationContext } from './observation';
import type {
  AttemptObservation,
  EventObservation,
  EvidenceSnapshot,
  PlannerObservation,
  PresentedItemObservation,
  ActorTestimony,
} from './oracle';

export class EvidenceReadIncomplete extends Error {
  constructor(message: string) {
    super(`lectura de evidencia · ${message}`);
    this.name = 'EvidenceReadIncomplete';
  }
}

/** Un uuid y nada más: lo que se interpola en una consulta se valida antes de interpolarse. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, label: string): void {
  if (!UUID.test(value)) {
    throw new EvidenceReadIncomplete(`«${label}» no es un uuid y no se interpola en una consulta`);
  }
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

// ---------------------------------------------------------------------------------------
// Consultas. Una por concern, para que un fallo se localice donde ocurrió.
// ---------------------------------------------------------------------------------------

function readEvents(
  context: ObservationContext,
  subjectRef: string,
): readonly EventObservation[] | null {
  const rows = observe(
    context,
    'select stream_position, event_type::text as event_type, session_item_id::text as session_item_id ' +
      `from public.learning_events where user_id = '${subjectRef}' order by stream_position`,
  );
  if (rows === null) return null;
  return rows.map((row) => ({
    streamPosition: asNumber(row['stream_position']) ?? 0,
    eventType: asString(row['event_type']) ?? 'DESCONOCIDO',
    sessionItemId: asString(row['session_item_id']),
  }));
}

/**
 * Intentos, con la clave correcta del servidor resuelta aparte.
 *
 * `selected_option_id` apunta a la opción de la representación concreta; su `option_key` es la
 * letra que el aprendiz eligió. La clave correcta vive en `content.answer_key_versions`, que el
 * Data API no expone: se lee por SQL directo, como Observador.
 */
function readAttempts(
  context: ObservationContext,
  subjectRef: string,
): readonly AttemptObservation[] | null {
  const rows = observe(
    context,
    'select a.session_item_id::text as session_item_id, a.question_id::text as question_id, ' +
      'a.question_representation_id::text as question_representation_id, ' +
      'a.submitted_event_id::text as submitted_event_id, a.answer_kind::text as answer_kind, ' +
      'o.option_key as selected_option_key, a.is_correct_at_submission, a.confidence_value, ' +
      'a.confidence_scale_version, a.attempt_number, k.correct_option_key as server_correct_option_key ' +
      'from public.question_attempts a ' +
      'left join public.question_options o on o.id = a.selected_option_id ' +
      'join content.answer_key_versions k on k.id = a.answer_key_version_id ' +
      `where a.user_id = '${subjectRef}' order by a.graded_at, a.attempt_number`,
  );
  if (rows === null) return null;
  return rows.map((row) => ({
    sessionItemId: asString(row['session_item_id']) ?? '',
    questionId: asString(row['question_id']) ?? '',
    questionRepresentationId: asString(row['question_representation_id']) ?? '',
    submittedEventId: asString(row['submitted_event_id']) ?? '',
    answerKind: asString(row['answer_kind']) === 'BLANK' ? 'BLANK' : 'OPTION',
    selectedOptionKey: asString(row['selected_option_key']),
    isCorrectAtSubmission: row['is_correct_at_submission'] === true,
    confidenceValue: asNumber(row['confidence_value']),
    confidenceScaleVersion: asString(row['confidence_scale_version']),
    attemptNumber: asNumber(row['attempt_number']) ?? 0,
    serverCorrectOptionKey: asString(row['server_correct_option_key']) ?? '',
  }));
}

function readPresentedItems(
  context: ObservationContext,
  subjectRef: string,
): readonly PresentedItemObservation[] | null {
  const rows = observe(
    context,
    'select id::text as session_item_id, item_type::text as item_type, ' +
      'presented_representation_id::text as presented_representation_id, ' +
      'presented_learning_unit_version_id::text as presented_learning_unit_version_id, ' +
      `status::text as status from public.session_items where user_id = '${subjectRef}' ` +
      'order by session_id, sort_order',
  );
  if (rows === null) return null;
  return rows.map((row) => ({
    sessionItemId: asString(row['session_item_id']) ?? '',
    itemType: asString(row['item_type']) ?? '',
    presentedRepresentationId: asString(row['presented_representation_id']),
    presentedLearningUnitVersionId: asString(row['presented_learning_unit_version_id']),
    status: asString(row['status']) ?? '',
  }));
}

/**
 * Plan y exclusiones.
 *
 * Las exclusiones no viven en `planner_items` —ahí solo está lo planificado— sino en
 * `planner_run_audit.decision_canonical`, en `candidates[].exclusion`. Leerlas de la auditoría
 * es leer la decisión que el Planner tomó, no reconstruirla.
 */
function readPlanner(
  context: ObservationContext,
  subjectRef: string,
  conceptKeyById: ReadonlyMap<string, string>,
): PlannerObservation | null {
  const planned = observe(
    context,
    'select i.concept_id::text as concept_id from public.planner_items i ' +
      'join public.planner_runs r on r.id = i.run_id ' +
      `where i.user_id = '${subjectRef}' order by r.created_at, i.position`,
  );
  if (planned === null) return null;

  const audits = observe(
    context,
    'select a.decision_canonical from public.planner_run_audit a ' +
      'join public.planner_runs r on r.id = a.run_id ' +
      `where a.user_id = '${subjectRef}' order by r.created_at`,
  );
  if (audits === null) return null;

  const exclusions: Array<{ conceptKey: string; reason: string }> = [];
  for (const row of audits) {
    const raw = asString(row['decision_canonical']);
    if (raw === null) continue;
    let decision: unknown;
    try {
      decision = JSON.parse(raw);
    } catch {
      // Una decisión ilegible no se interpreta: se omite, y la completitud lo refleja.
      return null;
    }
    const candidates = (decision as { candidates?: unknown }).candidates;
    if (!Array.isArray(candidates)) continue;
    for (const candidate of candidates) {
      const conceptId = asString((candidate as { conceptId?: unknown }).conceptId);
      const reason = asString((candidate as { exclusion?: unknown }).exclusion);
      if (conceptId === null || reason === null) continue;
      const key = conceptKeyById.get(conceptId);
      if (key !== undefined) exclusions.push({ conceptKey: key, reason });
    }
  }

  const plannedConceptKeys: string[] = [];
  for (const row of planned) {
    const key = conceptKeyById.get(asString(row['concept_id']) ?? '');
    if (key !== undefined && !plannedConceptKeys.includes(key)) plannedConceptKeys.push(key);
  }

  return { plannedConceptKeys, exclusions };
}

export interface SnapshotRequest {
  readonly context: ObservationContext;
  readonly subjectRef: string;
  /** uuid de concepto → clave del corpus. La da el instalador; no se infiere de títulos. */
  readonly conceptKeyById: ReadonlyMap<string, string>;
  readonly actor: ActorTestimony;
  readonly structuralScarcityConcepts: readonly string[];
}

/**
 * Lee el snapshot completo.
 *
 * `observationComplete` es verdadero **solo** si las cuatro lecturas y la barrera salieron. Es
 * la precondición de cualquier aserción negativa, y por eso se calcula aquí y no se delega.
 */
export function readEvidenceSnapshot(request: SnapshotRequest): EvidenceSnapshot {
  assertUuid(request.subjectRef, 'subjectRef');

  const events = readEvents(request.context, request.subjectRef);
  const attempts = readAttempts(request.context, request.subjectRef);
  const presentedItems = readPresentedItems(request.context, request.subjectRef);
  const planner = readPlanner(request.context, request.subjectRef, request.conceptKeyById);
  const barrier = readBarrier(request.context, request.subjectRef);

  const complete =
    events !== null &&
    attempts !== null &&
    presentedItems !== null &&
    planner !== null &&
    barrier.maxPosition !== null &&
    barrier.consumedPosition !== null &&
    barrier.pending !== null;

  return {
    subjectRef: request.subjectRef,
    events: events ?? [],
    attempts: attempts ?? [],
    presentedItems: presentedItems ?? [],
    barrier: {
      maxPosition: barrier.maxPosition,
      consumedPosition: barrier.consumedPosition,
      pending: barrier.pending,
    },
    planner: planner ?? { plannedConceptKeys: [], exclusions: [] },
    actor: request.actor,
    structuralScarcityConcepts: request.structuralScarcityConcepts,
    observationComplete: complete,
  };
}
