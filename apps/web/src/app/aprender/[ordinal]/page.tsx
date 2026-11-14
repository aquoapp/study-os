import { redirect } from 'next/navigation';

import { getVerifiedIdentity } from '../../../server/auth/identity';
import { loadUnitContent } from '../../../server/fps/content';
import {
  deriveStep,
  findOpenSession,
  loadSessionState,
  pathForStep,
} from '../../../server/fps/session';
import { NATURE_LABEL, loadActionPlacements, phaseLabel } from '../../../server/session/actions';
import { createSupabaseServerClient } from '../../../server/supabase/server-client';
import { completeUnitAction, interruptSessionAction } from '../../actions/fps';
import { PrimaryAction } from '../../_components/product/primary-action';
import {
  ActionHeader,
  ActionTitle,
  Actions,
  ProductShell,
  productStyles,
} from '../../_components/product/shell';

export const metadata = { title: 'Aprender · Study OS' };

/**
 * LEER · **el estado de control de contención visual** · `docs/PRODUCT_UX_CONTRACT.md` §S.9.
 *
 * La norma de esta pantalla es la **retirada**: durante el aprendizaje enfocado no hay teal
 * activo, ni teatro adaptativo, ni campo de sistema innecesario, ni tecnología decorativa, ni
 * tarjetas alrededor del texto por riqueza visual, ni señal computacional persistente. **El
 * contenido domina.** Queda solo la traza estructural neutra de la espina, que da continuidad
 * entre rutas sin degradar la medida de lectura ni la atención.
 *
 * Y no se ensancha en escritorio (§Q): sobra sitio, y aun así la medida se mantiene entre 45 y 70
 * caracteres, porque la medida es una propiedad de la lectura, no del monitor.
 *
 * **INV-117 · fidelidad de plan.** Se presenta **la versión que el Planner seleccionó**, que el
 * arranque fijó en el ítem. Una publicación posterior no la sustituye. Esta página no vincula
 * nada: eso lo hace la acción que trae hasta aquí, porque una página es una lectura y emitir
 * evidencia al renderizar la duplicaría en cada recarga (UX-INV-16).
 *
 * El ordinal de la URL es el orden del **ítem** dentro de la sesión; la posición que se muestra es
 * la de la **acción** (UX-INV-24), y las dos no tienen por qué coincidir.
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

  const placements = await loadActionPlacements(session);
  const placement = placements?.get(step.item.sort_order) ?? null;

  return (
    <ProductShell testId="aprender">
      {placement ? (
        <ActionHeader
          nature={NATURE_LABEL[placement.nature]}
          position={placement.position}
          total={placement.total}
          phase={phaseLabel(placement)}
        />
      ) : null}

      {/* §S.9 · superficie de lectura continua, nunca una tarjeta por párrafo. */}
      <article className={productStyles.readingSurface} data-testid="aprender-cuerpo">
        <ActionTitle testId="aprender-titulo">{unit.title}</ActionTitle>
        <div className={productStyles.reading}>
          {unit.body.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>

      <div className={productStyles.readingSurface}>
        <Actions>
          <PrimaryAction
            action={completeUnitAction.bind(null, step.item.id)}
            pendingLabel="Guardando…"
            testId="aprender-continuar"
          >
            {/*
             * UX-INV-17 · en una reparación atómica esto lleva a COMPROBAR, y la etiqueta lo dice.
             * Completar la lectura **no** afirma que la reparación esté hecha: la acción sigue
             * incompleta hasta que se comprueba.
             */}
            {placement && placement.steps === 2 ? 'Comprobar' : 'Continuar'}
          </PrimaryAction>
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
