import { redirect } from 'next/navigation';

import { FpsActionButton } from '../_components/fps/fps-action-button';
import {
  FpsActions,
  FpsHeading,
  FpsNote,
  FpsSummary,
  FpsSurface,
  FpsShell,
} from '../_components/fps/fps-shell';
import { completeSessionAction } from '../actions/fps';
import { getVerifiedIdentity } from '../../server/auth/identity';
import { createSupabaseServerClient } from '../../server/supabase/server-client';
import {
  deriveStep,
  findLatestSession,
  findOpenSession,
  loadSessionState,
  pathForStep,
  summarize,
} from '../../server/fps/session';

export const metadata = { title: 'Sesión terminada · Study OS' };

/**
 * FIN · `docs/FPS_SCREEN_CONTRACT.md` §5 · REQ-F12 (parcialmente satisfecho).
 *
 * Comunica **consecuencia, no celebración** (Master §22, EC-017): sin confeti, sin trofeo, sin
 * puntuación, sin racha, sin insignia. Lo que se muestra son hechos contados a partir de la
 * evidencia del propio aprendiz, nunca porcentajes proyectados (INV-111).
 *
 * De la sustitución que pide C-06 a se entrega lo que la evidencia sostiene. «Errores
 * reparados» y «próximo repaso» **no se fabrican**: exigen un bucle de reparación y un
 * programador que no existen, y afirmarlos sería precisamente la mentira que EC-012 prohíbe.
 *
 * Una sesión terminada es terminal: nunca se reanuda. Desde aquí solo se vuelve a Hoy.
 */
export default async function FinPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/entrar?siguiente=/hoy');

  const supabase = await createSupabaseServerClient();

  // Si queda una sesión abierta con trabajo pendiente, esta no es la pantalla que toca.
  const open = await findOpenSession(supabase);
  if (open) {
    const openState = await loadSessionState(supabase, open);
    const step = deriveStep(openState);
    if (step.kind !== 'end') redirect(pathForStep(step));
    if (open.status !== 'PLANNED') {
      const summary = await summarize(supabase, openState);
      return (
        <FpsShell>
          <FpsHeading title="Ya casi está" testId="fin-titulo" />
          <FpsSurface label="Resumen de la sesión">
            <p>Has terminado todos los pasos de esta sesión.</p>
            <FpsSummary rows={rowsFor(summary)} />
          </FpsSurface>
          <FpsActions>
            <FpsActionButton
              action={completeSessionAction}
              pendingLabel="Cerrando…"
              testId="fin-cerrar"
            >
              Terminar la sesión
            </FpsActionButton>
          </FpsActions>
        </FpsShell>
      );
    }
    redirect('/hoy');
  }

  const session = await findLatestSession(supabase);
  if (!session || session.status !== 'COMPLETED') redirect('/hoy');

  const state = await loadSessionState(supabase, session);
  const summary = await summarize(supabase, state);

  return (
    <FpsShell>
      <FpsHeading title="Sesión terminada" testId="fin-titulo" />
      <FpsSurface label="Resumen de la sesión">
        <FpsSummary rows={rowsFor(summary)} />
      </FpsSurface>
      <FpsNote testId="fin-cierre">
        Esto es lo que hiciste hoy. Todavía no hay un plan que decida lo siguiente: la planificación
        llega más adelante.
      </FpsNote>
      <FpsActions>
        <a className="so-action" href="/hoy" data-testid="fin-volver">
          Volver a Hoy
        </a>
      </FpsActions>
    </FpsShell>
  );
}

function rowsFor(summary: {
  unidades: number;
  preguntas: number;
  aciertos: number;
  fallos: number;
  enBlanco: number;
  minutos: number | null;
}): { label: string; value: string }[] {
  const rows = [
    { label: 'Unidades leídas', value: String(summary.unidades) },
    { label: 'Preguntas respondidas', value: String(summary.preguntas) },
    { label: 'Aciertos', value: String(summary.aciertos) },
    { label: 'Fallos', value: String(summary.fallos) },
  ];
  if (summary.enBlanco > 0) {
    rows.push({ label: 'Sin responder', value: String(summary.enBlanco) });
  }
  if (summary.minutos !== null) {
    rows.push({ label: 'Tiempo de la sesión', value: `${summary.minutos} min` });
  }
  return rows;
}
