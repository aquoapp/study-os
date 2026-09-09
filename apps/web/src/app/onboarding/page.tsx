import { redirect } from 'next/navigation';

import { completeOnboardingAction } from '../actions/onboarding';
import { OnboardingForm, type ExamPackOption } from '../_components/onboarding-form';
import { getVerifiedIdentity } from '../../server/auth/identity';
import { createSupabaseServerClient } from '../../server/supabase/server-client';

export const metadata = { title: 'Empezar · Study OS' };

/**
 * Onboarding mínimo de Phase 2 · REQ-C01 · gate P2-G7.
 *
 * «Llega al primer plan sin ajustes avanzados»: objetivo, disponibilidad y diagnóstico
 * opcional, y después una primera vista de lo acordado. Esa vista es **provisional y lo
 * dice**: en Phase 2 no existe Planner (Phase 4) ni motor (Phase 3), y prometer un plan
 * calculado sería exactamente lo que EC-012 y el Onboarding & Edge States Spec prohíben.
 *
 * Esto no es la superficie de producto de Phase 5 ni el First Product Sight: no hay HOY,
 * APRENDER, ENTRENAR, PROGRESO ni PLAN, y no se presenta ninguna sesión de estudio.
 *
 * La identidad se verifica **otra vez** aquí aunque el proxy ya lo haya hecho: el proxy es
 * una barrera de enrutado, no una autorización de datos (INV-116).
 */
export default async function OnboardingPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/entrar?siguiente=/onboarding');

  const supabase = await createSupabaseServerClient();

  // Los packs publicados los lee RLS con el token del aprendiz: si no hay contenido, no hay
  // nada que elegir, y la pantalla lo dice en lugar de inventarlo.
  const packsResult = await supabase
    .from('exam_packs')
    .select('id, name')
    .eq('status', 'PUBLISHED')
    .order('name');
  const packs: ExamPackOption[] = (packsResult.data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    name: String((row as { name: string }).name),
  }));

  const settings = await supabase
    .from('learner_settings')
    .select('default_daily_minutes, weekly_availability_json, diagnostic_preference')
    .maybeSingle();
  const goal = await supabase
    .from('learner_exam_goals')
    .select('id, target_date, exam_pack_id')
    .eq('status', 'ACTIVE')
    .maybeSingle();

  const listo = Boolean(settings.data && goal.data);

  return (
    <div className="so-page">
      <h1>Empezar</h1>

      {listo ? (
        <section data-testid="onboarding-completado">
          <p>
            Tu objetivo y tu disponibilidad están guardados. Puedes cambiarlos cuando quieras: nada
            de lo que estudies se pierde al hacerlo.
          </p>

          <dl data-testid="onboarding-resumen">
            <dt>Minutos al día</dt>
            <dd data-testid="resumen-minutos">
              {String((settings.data as { default_daily_minutes: number }).default_daily_minutes)}
            </dd>
            <dt>Fecha objetivo</dt>
            <dd data-testid="resumen-fecha">
              {String((goal.data as { target_date: string | null }).target_date ?? 'sin fecha')}
            </dd>
          </dl>

          {/*
            Marcador provisional del «primer plan». No es un plan: es el acuse de que hay
            objetivo y disponibilidad. El Planner es de Phase 4 y decirlo aquí es la única
            forma honesta de mostrar algo (EC-012: la interfaz no afirma lo que no existe).
          */}
          <section
            data-testid="plan-provisional"
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 'var(--so-radius-micro)',
              border: '1px dashed var(--so-color-slate)',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Tu primer plan</h2>
            <p data-testid="plan-provisional-aviso">
              <strong>Provisional.</strong> Todavía no hay un plan calculado: la planificación
              adaptativa llega en una fase posterior. Por ahora esto solo confirma lo que has
              indicado.
            </p>
          </section>
        </section>
      ) : (
        <>
          <p>
            Tres datos y empezamos: qué examen preparas, cuánto tiempo tienes y si quieres hacer un
            diagnóstico inicial.
          </p>
          <OnboardingForm action={completeOnboardingAction} packs={packs} />
        </>
      )}
    </div>
  );
}
