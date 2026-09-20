import { redirect } from 'next/navigation';

import { FpsAnswerForm } from '../../_components/fps/fps-answer-form';
import { FpsFeedback } from '../../_components/fps/fps-feedback';
import { FpsSurface, FpsSectionTitle } from '../../_components/fps/fps-shell';
import { PrimaryAction } from '../../_components/product/primary-action';
import {
  ActionHeader,
  Actions,
  ProductShell,
  productStyles,
} from '../../_components/product/shell';
import {
  interruptSessionAction,
  recordConfidenceAction,
  selectAnswerAction,
  submitAnswerAction,
  viewFeedbackAction,
} from '../../actions/fps';
import { recoverOutcome } from '../../../server/fps/events';
import { getVerifiedIdentity } from '../../../server/auth/identity';
import { createSupabaseServerClient } from '../../../server/supabase/server-client';
import { loadConfidenceScale, loadQuestionContent } from '../../../server/fps/content';
import { NATURE_LABEL, loadActionPlacements, phaseLabel } from '../../../server/session/actions';
import {
  deriveStep,
  findOpenSession,
  lastConfidenceFor,
  lastSelectedOptionFor,
  loadSessionState,
  submittedEventFor,
  pathForStep,
} from '../../../server/fps/session';

export const metadata = { title: 'Comprobar · Study OS' };

/**
 * COMPROBAR · gate FPS-G5 · `docs/FPS_SCREEN_CONTRACT.md` §4.
 *
 * Una ruta con **dos estados**: responder y corrección. La corrección no es otra ruta porque
 * el resultado llega en la misma respuesta del envío; separarla obligaría a recuperarlo dos
 * veces sin ganar nada de producto.
 *
 * Antes del envío no viaja ningún material de corrección: la clave vive en un esquema no
 * expuesto y ninguna tabla legible por el aprendiz lleva marca de opción correcta (INV-101).
 * La selección se ve con énfasis neutral (INV-103) y la confianza se registra antes de la
 * corrección (INV-102).
 *
 * Tras una recarga entre el envío y la corrección, el resultado se recupera **repitiendo el
 * mismo sobre**: `question_attempts` no guarda ni la opción correcta ni la explicación, así que
 * la repetición idempotente es la única vía dentro del contrato congelado, y no crea intento
 * ni consume posición.
 */
export default async function ComprobarPage({
  params,
}: {
  readonly params: Promise<{ readonly ordinal: string }>;
}) {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/entrar?siguiente=/hoy');

  const { ordinal } = await params;
  const supabase = await createSupabaseServerClient();

  const session = await findOpenSession(supabase);
  if (!session || session.status !== 'ACTIVE') redirect('/hoy');

  const state = await loadSessionState(supabase, session);
  const step = deriveStep(state);
  if ((step.kind !== 'check' && step.kind !== 'feedback') || String(step.ordinal) !== ordinal) {
    redirect(pathForStep(step));
  }

  const question = await loadQuestionContent(supabase, step.item);
  if (!question) redirect('/hoy');
  const scale = await loadConfidenceScale(supabase);

  // UX-INV-24 · la posición visible es la de la **acción**, obtenida de la agrupación
  // autoritativa del Planner; nunca el ordinal de ruta ni el recuento de ítems.
  const placements = await loadActionPlacements(session);
  const placement = placements?.get(step.item.sort_order) ?? null;
  const header = placement ? (
    <ActionHeader
      nature={NATURE_LABEL[placement.nature]}
      position={placement.position}
      total={placement.total}
      phase={phaseLabel(placement)}
    />
  ) : null;

  if (step.kind === 'feedback') {
    const result = await recoverOutcome(supabase, submittedEventFor(state, step.item.id));
    const outcome = result?.attempt;
    if (!outcome) redirect('/hoy');

    const confidenceLabel =
      outcome.confidence_value !== null && scale
        ? (scale.labels[outcome.confidence_value - 1] ?? null)
        : null;
    const isLast = state.items.every(
      (item) => item.status === 'COMPLETED' || item.id === step.item.id,
    );

    return (
      <ProductShell testId="correccion">
        {header}
        <div className={productStyles.readingSurface}>
          <FpsSurface label="Pregunta">
            <FpsSectionTitle>{question.stem}</FpsSectionTitle>
          </FpsSurface>
          <FpsFeedback
            outcome={{
              answerKind: outcome.answer_kind,
              isCorrect: outcome.is_correct,
              selectedOptionId: outcome.selected_option_id,
              correctOptionId: outcome.correct_option_id,
              explanation: outcome.explanation,
              confidenceValue: outcome.confidence_value,
            }}
            options={question.options}
            confidenceLabel={confidenceLabel}
            reference={question.reference}
          />
          <Actions>
            <PrimaryAction
              action={viewFeedbackAction.bind(null, step.item.id)}
              pendingLabel="Guardando…"
              testId="feedback-siguiente"
            >
              {isLast ? 'Terminar la sesión' : 'Siguiente'}
            </PrimaryAction>
          </Actions>
        </div>
      </ProductShell>
    );
  }

  const levels = (scale?.labels ?? []).map((label, index) => ({ value: index + 1, label }));
  const selected = lastSelectedOptionFor(state, step.item.id);
  const confidence = lastConfidenceFor(state, step.item.id);

  return (
    <ProductShell testId="comprobar">
      {header}
      <div className={productStyles.readingSurface}>
        <FpsSurface label="Pregunta" testId="comprobar-enunciado">
          <FpsSectionTitle>{question.stem}</FpsSectionTitle>
          <FpsAnswerForm
            options={question.options}
            levels={levels}
            initialSelectedOptionId={selected}
            initialConfidence={confidence}
            onSelect={selectAnswerAction.bind(null, step.item.id, question.representationId)}
            onConfidence={recordConfidenceAction.bind(null, step.item.id, scale?.version ?? 'v1')}
            onSubmit={submitAnswerAction.bind(
              null,
              step.item.id,
              question.representationId,
              scale?.version ?? 'v1',
            )}
          />
        </FpsSurface>
        <Actions>
          <PrimaryAction
            action={interruptSessionAction}
            pendingLabel="Guardando…"
            variant="secondary"
            testId="dejarlo"
          >
            Dejarlo por ahora
          </PrimaryAction>
        </Actions>
      </div>
    </ProductShell>
  );
}
