import { redirect } from 'next/navigation';

import { FpsActionButton } from '../_components/fps/fps-action-button';
import {
  FpsActions,
  FpsCard,
  FpsHeading,
  FpsNote,
  FpsSecondary,
  FpsShell,
} from '../_components/fps/fps-shell';
import { startOrResumeSessionAction } from '../actions/fps';
import { getVerifiedIdentity } from '../../server/auth/identity';
import { createSupabaseServerClient } from '../../server/supabase/server-client';
import { deriveStep, findOpenSession, loadSessionState } from '../../server/fps/session';

export const metadata = { title: 'Hoy · Study OS' };

/**
 * HOY · gate FPS-G3 · `docs/FPS_SCREEN_CONTRACT.md` §2.
 *
 * Dice qué hacer ahora, y solo eso. No es un panel de mando (REQ-F02): una tarjeta de sesión
 * dominante, una razón provisional verdadera y **una sola acción primaria** (INV-104).
 *
 * Precedencia, que es lo único que HOY decide: si existe una sesión abierta —`PLANNED`,
 * `ACTIVE` o `INTERRUPTED`—, **gana** y se ofrece continuar; solo si no hay ninguna se ofrece
 * crear una. La RPC de creación no es idempotente, así que ofrecer «empezar» con una sesión
 * viva sería fabricar duplicados.
 *
 * Lo que aquí no aparece, y no por olvido: nivel global, porcentajes, recomendación
 * adaptativa, tarjeta motivacional y trofeo. Ni el motor ni el planificador existen, y
 * afirmarlos sería exactamente lo que EC-012 prohíbe (C-06 b, c, d, g).
 */
export default async function HoyPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/entrar?siguiente=/hoy');

  const supabase = await createSupabaseServerClient();

  const goal = await supabase
    .from('learner_exam_goals')
    .select('id, exam_pack_id')
    .eq('status', 'ACTIVE')
    .maybeSingle();
  const goalRow = goal.data as { id: string; exam_pack_id: string } | null;

  if (!goalRow) {
    return (
      <FpsShell>
        <FpsHeading title="Hoy" testId="hoy-titulo" />
        <FpsCard testId="hoy-sin-objetivo">
          <p>Todavía no has elegido qué examen preparas.</p>
          <FpsActions>
            <a className="so-action" href="/onboarding">
              Elegir examen
            </a>
          </FpsActions>
        </FpsCard>
      </FpsShell>
    );
  }

  const pack = await supabase
    .from('exam_packs')
    .select('name')
    .eq('id', goalRow.exam_pack_id)
    .maybeSingle();
  const packName = (pack.data as { name: string } | null)?.name ?? null;

  const session = await findOpenSession(supabase);

  if (session) {
    const state = await loadSessionState(supabase, session);
    const step = deriveStep(state);
    const total = state.items.length;
    const done = state.items.filter((item) => item.status === 'COMPLETED').length;
    const stepName =
      step.kind === 'learn'
        ? 'una unidad para leer'
        : step.kind === 'check'
          ? 'una pregunta para comprobar'
          : step.kind === 'feedback'
            ? 'la corrección de tu última respuesta'
            : 'el final de la sesión';

    return (
      <FpsShell>
        <FpsHeading title="Hoy" testId="hoy-titulo" />
        <FpsCard testId="hoy-sesion">
          <p className="so-text-secondary">{packName}</p>
          <p data-testid="hoy-continuar">
            Te quedaste aquí: {stepName}. Llevas {done} de {total} pasos.
          </p>
          <FpsNote testId="hoy-provisional">
            <strong>Sesión fija.</strong> Esta selección es la misma para todo el mundo y no está
            personalizada: la planificación adaptativa llega más adelante.
          </FpsNote>
          <FpsActions>
            <FpsActionButton
              action={startOrResumeSessionAction}
              pendingLabel="Abriendo la sesión…"
              testId="hoy-primaria"
            >
              Retomamos desde aquí
            </FpsActionButton>
          </FpsActions>
        </FpsCard>
      </FpsShell>
    );
  }

  const units = await supabase
    .from('learning_units')
    .select('id', { count: 'exact', head: true })
    .eq('exam_pack_id', goalRow.exam_pack_id)
    .eq('status', 'PUBLISHED');
  const questions = await supabase
    .from('canonical_questions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_pack_id', goalRow.exam_pack_id)
    .eq('status', 'PUBLISHED');
  const unitCount = units.count ?? 0;
  const questionCount = questions.count ?? 0;

  if (unitCount + questionCount === 0) {
    return (
      <FpsShell>
        <FpsHeading title="Hoy" testId="hoy-titulo" />
        <FpsCard testId="hoy-sin-contenido">
          <p>Todavía no hay contenido disponible para este examen.</p>
          <FpsSecondary>En cuanto lo haya, podrás empezar una sesión desde aquí.</FpsSecondary>
        </FpsCard>
      </FpsShell>
    );
  }

  return (
    <FpsShell>
      <FpsHeading title="Hoy" testId="hoy-titulo" />
      <FpsCard testId="hoy-sesion">
        <p className="so-text-secondary">{packName}</p>
        <p data-testid="hoy-preview">
          {unitCount} {unitCount === 1 ? 'unidad para leer' : 'unidades para leer'} ·{' '}
          {questionCount} {questionCount === 1 ? 'pregunta' : 'preguntas'} para comprobar.
        </p>
        <FpsNote testId="hoy-provisional">
          <strong>Sesión fija.</strong> Esta selección es la misma para todo el mundo y no está
          personalizada: la planificación adaptativa llega más adelante.
        </FpsNote>
        <FpsActions>
          <FpsActionButton
            action={startOrResumeSessionAction}
            pendingLabel="Preparando la sesión…"
            testId="hoy-primaria"
          >
            Empezar la sesión
          </FpsActionButton>
        </FpsActions>
      </FpsCard>
    </FpsShell>
  );
}
