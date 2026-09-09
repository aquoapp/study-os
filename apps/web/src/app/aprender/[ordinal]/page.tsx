import { redirect } from 'next/navigation';

import { FpsActionButton } from '../../_components/fps/fps-action-button';
import {
  FpsActions,
  FpsHeading,
  FpsReading,
  FpsSurface,
  FpsShell,
} from '../../_components/fps/fps-shell';
import { completeUnitAction, interruptSessionAction } from '../../actions/fps';
import { getVerifiedIdentity } from '../../../server/auth/identity';
import { createSupabaseServerClient } from '../../../server/supabase/server-client';
import { loadUnitContent } from '../../../server/fps/content';
import {
  deriveStep,
  findOpenSession,
  loadSessionState,
  pathForStep,
} from '../../../server/fps/session';

export const metadata = { title: 'Aprender · Study OS' };

/**
 * APRENDER · gate FPS-G4 · `docs/FPS_SCREEN_CONTRACT.md` §3.
 *
 * Presenta **la versión vinculada** de la unidad, no «la vigente ahora»: el ítem guarda lo que
 * se presentó y una publicación posterior no reescribe lo que alguien ya leyó (SD-021, SD-023).
 * Si el ítem todavía no tiene versión vinculada, esta pantalla no la vincula: eso lo hace la
 * acción que trae hasta aquí, porque una página es una lectura y emitir evidencia al renderizar
 * la duplicaría en cada recarga.
 *
 * El ordinal de la URL es el orden del ítem dentro de la sesión del propio aprendiz. No hay
 * identificadores en la barra de direcciones, y RLS hace que un ordinal ajeno no exista.
 */
export default async function AprenderPage({
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
  // El paso lo decide la evidencia, no la URL: un ordinal que no corresponde se corrige.
  if (step.kind !== 'learn' || String(step.ordinal) !== ordinal) redirect(pathForStep(step));

  const unit = await loadUnitContent(supabase, step.item);
  if (!unit) redirect('/hoy');

  const total = state.items.length;

  return (
    <FpsShell>
      <FpsHeading
        kicker={`Paso ${step.ordinal} de ${total}`}
        title={unit.title}
        testId="aprender-titulo"
      />
      <FpsSurface label="Unidad de aprendizaje" testId="aprender-cuerpo">
        <FpsReading>{unit.body}</FpsReading>
      </FpsSurface>
      <FpsActions>
        <FpsActionButton
          action={completeUnitAction.bind(null, step.item.id)}
          pendingLabel="Guardando…"
          testId="aprender-continuar"
        >
          Continuar
        </FpsActionButton>
        <FpsActionButton
          action={interruptSessionAction}
          pendingLabel="Guardando…"
          variant="text"
          testId="dejarlo"
        >
          Dejarlo por ahora
        </FpsActionButton>
      </FpsActions>
    </FpsShell>
  );
}
