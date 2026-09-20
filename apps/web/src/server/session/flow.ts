import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadQuestionContent, loadUnitContent } from '../fps/content';
import { appendEvent, buildEnvelope, derivedEventId } from '../fps/events';
import {
  deriveStep,
  findOpenSession,
  loadSessionState,
  pathForStep,
  type ItemRow,
} from '../fps/session';

/**
 * Avance dentro de una sesión, **independiente de quién la seleccionó**.
 *
 * Esta lógica nació en el First Product Slice y no era específica de él: opera sobre
 * `study_sessions`, `session_items` y `learning_events`, que son el modelo canónico. Al entrar el
 * Planner se extrae aquí para que **los dos orígenes usen exactamente el mismo camino** y no
 * exista una segunda máquina de estados paralela.
 *
 * **Preparar al navegar** (§P). El evento que presenta un ítem lo emite la acción que lleva hasta
 * él, **nunca la pantalla al pintarse**: una página es una lectura, y emitir evidencia al
 * renderizar la duplicaría en cada recarga o prefetch (UX-INV-16).
 */

/**
 * Emite el evento de presentación del ítem si todavía no está vinculado.
 *
 * **INV-117 · fidelidad de plan.** Para una sesión planificada, `start_planned_session` ya dejó
 * fijadas `presented_learning_unit_version_id` y `presented_representation_id` en el insert, de
 * modo que este camino encuentra el ítem **ya vinculado** y no vuelve a resolver nada. Es la
 * consecuencia buscada: el respaldo «resolver la publicada vigente» queda **inalcanzable** para
 * sesiones `PLANNER_RUN` y se conserva solo para las históricas `FPS_FIXED`.
 *
 * Idempotente por construcción: el identificador se deriva del ítem, así que dos peticiones
 * simultáneas producen el mismo evento y el servidor devuelve la segunda como repetición.
 */
export async function prepareStep(
  supabase: SupabaseClient,
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
export async function advanceToCurrentStep(supabase: SupabaseClient): Promise<string> {
  const session = await findOpenSession(supabase);
  if (!session) return '/hoy';
  const state = await loadSessionState(supabase, session);
  const step = deriveStep(state);
  if (step.kind !== 'end') await prepareStep(supabase, session.id, step.item);
  return pathForStep(step);
}
