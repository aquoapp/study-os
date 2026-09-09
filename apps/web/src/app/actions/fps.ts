'use server';

import { redirect } from 'next/navigation';

import {
  FPS_SESSION_TYPE,
  selectFixedSessionItems,
  type PublishedQuestion,
  type PublishedUnit,
} from '@study-os/domain';

import { requireVerifiedIdentity } from '../../server/auth/identity';
import { createSupabaseServerClient } from '../../server/supabase/server-client';
import {
  appendEvent,
  buildEnvelope,
  derivedEventId,
  envelopeFromStored,
  EventRejected,
  newEventId,
} from '../../server/fps/events';
import {
  deriveStep,
  findOpenSession,
  loadSessionState,
  pathForStep,
  submittedEventFor,
  type ItemRow,
} from '../../server/fps/session';
import { loadQuestionContent, loadUnitContent } from '../../server/fps/content';

/**
 * Acciones del First Product Slice.
 *
 * Todas las escrituras del vertical viven aquí, en el servidor, y todas pasan por las dos
 * únicas RPC invocables por cliente. Ninguna acción escribe una tabla directamente, ninguna
 * resuelve una clave y ninguna decide identidad: el `user_id` sale de `auth.uid()` dentro de
 * la función, nunca del formulario (INV-116, Manifest §14).
 *
 * **Preparar al navegar.** El evento que presenta un ítem lo emite la acción que lleva hasta
 * él, no la pantalla al pintarse: una página es una lectura, y emitir evidencia al renderizar
 * la duplicaría en cada recarga o prefetch. Al llegar, el ítem ya tiene vinculado lo
 * presentado, y a partir de ahí siempre se muestra eso.
 */

export interface FpsActionState {
  readonly error: string | null;
}

const GENERIC_ERROR = 'Algo no ha ido bien. Vuelve a Hoy y retómalo.';

/** Mensajes de producto para los rechazos que un aprendiz puede provocar de verdad. */
function humanMessage(code: string): string {
  switch (code) {
    case 'SESSION_NOT_ACTIVE':
    case 'SESSION_STATE':
      return 'Esta sesión ya no está activa. Vuelve a Hoy y retómala.';
    case 'ITEM_COMPLETED':
      return 'Esta pregunta ya está respondida.';
    case 'NO_ANSWER_KEY':
      return 'Esta pregunta todavía no está disponible.';
    case 'GOAL_NOT_FOUND':
    case 'GOAL_NOT_ACTIVE':
      return 'Todavía no has elegido qué examen preparas.';
    default:
      return GENERIC_ERROR;
  }
}

async function context() {
  const identity = await requireVerifiedIdentity('/hoy');
  const supabase = await createSupabaseServerClient();
  return { identity, supabase };
}

/**
 * Emite el evento de presentación del ítem si todavía no está vinculado.
 *
 * Es idempotente por construcción: en cuanto el ítem tiene vinculado lo presentado, no vuelve
 * a emitirse. El identificador se deriva del ítem, de modo que dos peticiones simultáneas
 * producen el mismo evento y el servidor devuelve la segunda como repetición.
 */
async function prepareStep(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string,
  item: ItemRow,
): Promise<void> {
  if (item.item_type === 'LEARNING_UNIT') {
    if (item.presented_learning_unit_version_id) return;
    const unit = await loadUnitContent(supabase, item);
    if (!unit) return;
    await appendEvent(
      supabase,
      buildEnvelope({
        eventId: derivedEventId(`view:${item.id}`),
        type: 'LEARNING_UNIT_VIEWED',
        sessionId,
        itemId: item.id,
        payload: { learning_unit_version_id: unit.versionId },
      }),
    );
    return;
  }
  if (item.item_type === 'QUESTION') {
    if (item.presented_representation_id) return;
    const question = await loadQuestionContent(supabase, item);
    if (!question) return;
    await appendEvent(
      supabase,
      buildEnvelope({
        eventId: derivedEventId(`present:${item.id}`),
        type: 'QUESTION_PRESENTED',
        sessionId,
        itemId: item.id,
        payload: { question_representation_id: question.representationId },
      }),
    );
  }
}

/** Recarga el estado, deriva el paso, lo prepara y devuelve su ruta. */
async function advance(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string> {
  const session = await findOpenSession(supabase);
  if (!session) return '/hoy';
  const state = await loadSessionState(supabase, session);
  const step = deriveStep(state);
  if (step.kind !== 'end') await prepareStep(supabase, session.id, step.item);
  return pathForStep(step);
}

// ---------------------------------------------------------------------------------------
// HOY
// ---------------------------------------------------------------------------------------

export async function startOrResumeSessionAction(): Promise<FpsActionState> {
  let destination = '/hoy';
  try {
    const { supabase } = await context();
    let session = await findOpenSession(supabase);

    if (!session) {
      const goal = await supabase
        .from('learner_exam_goals')
        .select('id, exam_pack_id')
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (goal.error) return { error: GENERIC_ERROR };
      const row = goal.data as { id: string; exam_pack_id: string } | null;
      if (!row) redirect('/onboarding');

      const units = await supabase
        .from('learning_units')
        .select('id, concept_id')
        .eq('exam_pack_id', row.exam_pack_id)
        .eq('status', 'PUBLISHED');
      const questions = await supabase
        .from('canonical_questions')
        .select('id')
        .eq('exam_pack_id', row.exam_pack_id)
        .eq('status', 'PUBLISHED');
      if (units.error || questions.error) return { error: GENERIC_ERROR };

      const conceptKeys = await loadConceptKeys(
        supabase,
        (units.data ?? []).map((unit) => (unit as { concept_id: string }).concept_id),
      );
      const publishedUnits: PublishedUnit[] = (units.data ?? []).map((unit) => {
        const typed = unit as { id: string; concept_id: string };
        return { id: typed.id, conceptKey: conceptKeys.get(typed.concept_id) ?? typed.concept_id };
      });
      const publishedQuestions: PublishedQuestion[] = (questions.data ?? []).map((question) => ({
        id: (question as { id: string }).id,
      }));

      const items = selectFixedSessionItems(publishedUnits, publishedQuestions);
      if (items.length === 0) {
        return { error: 'Todavía no hay contenido disponible para este examen.' };
      }

      const created = await supabase.rpc('create_study_session', {
        p_goal_id: row.id,
        p_session_type: FPS_SESSION_TYPE,
        p_planned_minutes: null,
        p_items: items,
      });
      if (created.error) {
        return { error: humanMessage(rejection(created.error.message)) };
      }
      session = await findOpenSession(supabase);
      if (!session) return { error: GENERIC_ERROR };
    }

    if (session.status === 'PLANNED') {
      await appendEvent(
        supabase,
        buildEnvelope({
          eventId: derivedEventId(`start:${session.id}`),
          type: 'SESSION_STARTED',
          sessionId: session.id,
        }),
      );
    } else if (session.status === 'INTERRUPTED') {
      await appendEvent(
        supabase,
        buildEnvelope({ eventId: newEventId(), type: 'SESSION_RESUMED', sessionId: session.id }),
      );
    }

    destination = await advance(supabase);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: messageFor(error) };
  }
  redirect(destination);
}

async function loadConceptKeys(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conceptIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(conceptIds)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from('concepts').select('id, concept_key').in('id', unique);
  return new Map(
    ((data ?? []) as Array<{ id: string; concept_key: string }>).map((row) => [
      row.id,
      row.concept_key,
    ]),
  );
}

// ---------------------------------------------------------------------------------------
// Interrupción
// ---------------------------------------------------------------------------------------

export async function interruptSessionAction(): Promise<FpsActionState> {
  try {
    const { supabase } = await context();
    const session = await findOpenSession(supabase);
    if (session?.status === 'ACTIVE') {
      await appendEvent(
        supabase,
        buildEnvelope({
          eventId: newEventId(),
          type: 'SESSION_INTERRUPTED',
          sessionId: session.id,
        }),
      );
    }
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: messageFor(error) };
  }
  redirect('/hoy');
}

// ---------------------------------------------------------------------------------------
// APRENDER
// ---------------------------------------------------------------------------------------

export async function completeUnitAction(itemId: string): Promise<FpsActionState> {
  let destination = '/hoy';
  try {
    const { supabase } = await context();
    const session = await findOpenSession(supabase);
    if (!session) redirect('/hoy');
    await appendEvent(
      supabase,
      buildEnvelope({
        eventId: derivedEventId(`unit-done:${itemId}`),
        type: 'LEARNING_UNIT_COMPLETED',
        sessionId: session.id,
        itemId,
      }),
    );
    destination = await advance(supabase);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: messageFor(error) };
  }
  redirect(destination);
}

// ---------------------------------------------------------------------------------------
// COMPROBAR
// ---------------------------------------------------------------------------------------

export async function selectAnswerAction(
  itemId: string,
  representationId: string,
  optionId: string,
): Promise<FpsActionState> {
  try {
    const { supabase } = await context();
    const session = await findOpenSession(supabase);
    if (!session) return { error: null };
    await appendEvent(
      supabase,
      buildEnvelope({
        eventId: newEventId(),
        type: 'ANSWER_SELECTED',
        sessionId: session.id,
        itemId,
        payload: {
          question_representation_id: representationId,
          selected_option_id: optionId,
        },
      }),
    );
    return { error: null };
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: messageFor(error) };
  }
}

export async function recordConfidenceAction(
  itemId: string,
  scaleVersion: string,
  value: number,
): Promise<FpsActionState> {
  try {
    const { supabase } = await context();
    const session = await findOpenSession(supabase);
    if (!session) return { error: null };
    await appendEvent(
      supabase,
      buildEnvelope({
        eventId: newEventId(),
        type: 'CONFIDENCE_RECORDED',
        sessionId: session.id,
        itemId,
        payload: { confidence_value: value, confidence_scale_version: scaleVersion },
      }),
    );
    return { error: null };
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: messageFor(error) };
  }
}

/**
 * Envío de la respuesta.
 *
 * Estrategia de identidad: el evento se deriva del ítem, así que un reintento repite el mismo
 * sobre y el servidor lo devuelve idempotente. Si el envío anterior llegó a aceptarse pero su
 * respuesta se perdió, el sobre nuevo llevaría otra hora y el servidor lo rechazaría por
 * conflicto de payload; en ese caso se **repite el sobre almacenado**, que es la única forma
 * de recuperar el resultado sin crear un segundo intento.
 */
export async function submitAnswerAction(
  itemId: string,
  representationId: string,
  scaleVersion: string,
  optionId: string | null,
  confidenceValue: number | null,
): Promise<FpsActionState> {
  let destination = '/hoy';
  try {
    const { supabase } = await context();
    const session = await findOpenSession(supabase);
    if (!session) redirect('/hoy');

    const state = await loadSessionState(supabase, session);
    const already = submittedEventFor(state, itemId);
    if (!already) {
      const payload: Record<string, unknown> = {
        question_representation_id: representationId,
        answer_kind: optionId ? 'OPTION' : 'BLANK',
      };
      if (optionId) payload['selected_option_id'] = optionId;
      if (confidenceValue !== null && scaleVersion) {
        payload['confidence_value'] = confidenceValue;
        payload['confidence_scale_version'] = scaleVersion;
      }
      try {
        await appendEvent(
          supabase,
          buildEnvelope({
            eventId: derivedEventId(`submit:${itemId}`),
            type: 'ANSWER_SUBMITTED',
            sessionId: session.id,
            itemId,
            payload,
          }),
        );
      } catch (error) {
        if (!(error instanceof EventRejected) || error.code !== 'EVENT_ID_CONFLICT_PAYLOAD') {
          throw error;
        }
        // El envío anterior sí se aceptó: se recupera repitiéndolo, sin crear nada.
        const stored = submittedEventFor(await loadSessionState(supabase, session), itemId);
        if (stored) await appendEvent(supabase, envelopeFromStored(stored));
      }
    }
    const ordinal = state.items.find((item) => item.id === itemId)?.sort_order;
    destination = ordinal ? `/comprobar/${ordinal}` : await advance(supabase);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: messageFor(error) };
  }
  redirect(destination);
}

export async function viewFeedbackAction(itemId: string): Promise<FpsActionState> {
  let destination = '/hoy';
  try {
    const { supabase } = await context();
    const session = await findOpenSession(supabase);
    if (!session) redirect('/hoy');
    await appendEvent(
      supabase,
      buildEnvelope({
        eventId: derivedEventId(`feedback:${itemId}`),
        type: 'FEEDBACK_VIEWED',
        sessionId: session.id,
        itemId,
      }),
    );
    destination = await advance(supabase);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: messageFor(error) };
  }
  redirect(destination);
}

// ---------------------------------------------------------------------------------------
// FIN
// ---------------------------------------------------------------------------------------

export async function completeSessionAction(): Promise<FpsActionState> {
  try {
    const { supabase } = await context();
    const session = await findOpenSession(supabase);
    if (session && session.status !== 'PLANNED') {
      await appendEvent(
        supabase,
        buildEnvelope({
          eventId: derivedEventId(`complete:${session.id}`),
          type: 'SESSION_COMPLETED',
          sessionId: session.id,
        }),
      );
    }
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: messageFor(error) };
  }
  redirect('/fin');
}

// ---------------------------------------------------------------------------------------

function rejection(message: string): string {
  const match = /STUDY_OS_(?:EVENT|SESSION) · ([A-Z_]+)/.exec(message);
  return match?.[1] ?? 'UNKNOWN';
}

/** `redirect()` lanza para interrumpir el render: nunca se trata como error de producto. */
function isRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

function messageFor(error: unknown): string {
  return error instanceof EventRejected ? humanMessage(error.code) : GENERIC_ERROR;
}
