import { redirect } from 'next/navigation';

import { getVerifiedIdentity } from '../../../server/auth/identity';
import { findOpenSession, loadSessionState } from '../../../server/fps/session';
import { createSupabaseServerClient } from '../../../server/supabase/server-client';
import { replanTodayAction } from '../../actions/planner';
import { PrimaryAction } from '../../_components/product/primary-action';
import {
  ActionTitle,
  Actions,
  DecisionSurface,
  PageTitle,
  ProductShell,
  Secondary,
  SystemVoice,
  Wordmark,
} from '../../_components/product/shell';

export const metadata = { title: 'Replanificar · Study OS' };
export const dynamic = 'force-dynamic';

/**
 * S21 · **Confirmar replanificar** · `docs/PRODUCT_UX_CONTRACT.md` §E, §P.
 *
 * Es irreversible, de modo que **nunca ocurre de un toque**: la confirmación enuncia la
 * consecuencia antes de que la persona la provoque.
 *
 * Lo que tiene que saber, según el contrato: qué se guarda, qué vuelve, y **que si nada ha
 * cambiado el plan será el mismo**. Esa última frase parece un detalle y no lo es: sin ella, ver
 * un plan idéntico después de replanificar se lee como un fallo del sistema, cuando es la
 * respuesta correcta.
 *
 * Lo que **no** debe implicar: que se borra el progreso, ni que parar fuera un fallo.
 *
 * **P4B-D2 · B2-a.** Terminar la sesión consume la ejecución, así que la petición siguiente
 * escribe una **sucesora** aunque la entrada canónica no haya cambiado. Terminar antes no fabrica
 * evidencia: los ítems no completados quedan pendientes y la evidencia ya producida sigue siendo
 * válida, independiente del linaje.
 */
export default async function ReplanificarPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/entrar?siguiente=/hoy');

  const supabase = await createSupabaseServerClient();
  const session = await findOpenSession(supabase);
  // Sin sesión abierta no hay nada que replanificar, y llegar aquí no es un error de la persona.
  if (!session) redirect('/hoy');

  const state = await loadSessionState(supabase, session);
  const done = state.items.filter((item) => item.status === 'COMPLETED').length;
  const pending = state.items.length - done;

  return (
    <ProductShell testId="replanificar">
      <Wordmark />
      <SystemVoice>Replanificar</SystemVoice>
      <PageTitle testId="replanificar-titulo">¿Replanificamos lo que queda?</PageTitle>

      <DecisionSurface testId="replanificar-confirmacion">
        <ActionTitle>Lo que ya hiciste se queda como está.</ActionTitle>
        <Secondary testId="replanificar-detalle">
          Los {done} {done === 1 ? 'paso completado' : 'pasos completados'} cuentan igual.{' '}
          {pending === 1 ? 'El paso pendiente vuelve' : `Los ${pending} pasos pendientes vuelven`} a
          estar por hacer.
        </Secondary>
        <Secondary testId="replanificar-aviso">
          Si no ha cambiado nada desde que empezaste, el plan nuevo será el mismo. Eso no es un
          fallo: significa que sigue siendo lo que te toca.
        </Secondary>

        <Actions>
          <PrimaryAction
            action={replanTodayAction}
            pendingLabel="Ajustando la sesión…"
            testId="replanificar-confirmar"
          >
            Replanificar
          </PrimaryAction>
          <a className="so-action" href="/hoy" data-testid="replanificar-seguir">
            Seguir con la sesión
          </a>
        </Actions>
      </DecisionSurface>
    </ProductShell>
  );
}
