import { redirect } from 'next/navigation';

import { getVerifiedIdentity } from '../../server/auth/identity';
import {
  deriveStep,
  findLatestSession,
  findOpenSession,
  loadSessionState,
  pathForStep,
  summarize,
} from '../../server/fps/session';
import { createSupabaseServerClient } from '../../server/supabase/server-client';
import {
  ActionTitle,
  Actions,
  DecisionSurface,
  PageTitle,
  ProductShell,
  Secondary,
  SystemVoice,
  Wordmark,
  productStyles,
} from '../_components/product/shell';

export const metadata = { title: 'Sesión cerrada · Study OS' };

/**
 * S16 · **Sesión cerrada** · `docs/PRODUCT_UX_CONTRACT.md` §E, §O, §L.
 *
 * Comunica **consecuencia, no celebración** (Master §22, EC-017): sin confeti, sin trofeo, sin
 * puntuación, sin racha, sin insignia, sin proyección y sin promesa de mañana. Lo que se muestra
 * son hechos contados a partir de la evidencia del propio aprendiz, nunca porcentajes proyectados
 * (INV-111). «Errores reparados» y «próximo repaso» **no se fabrican**: exigirían un programador de
 * repasos que no existe, y afirmarlos sería la mentira que EC-012 prohíbe.
 *
 * ---------------------------------------------------------------------------
 * **Dos correcciones de Phase 4B, las dos por autoridad aceptada**
 *
 * **UX-INV-18 · desaparece la pantalla previa al cierre.** Había dos finales: una pantalla «Ya casi
 * está» que pedía cerrar, y luego el resumen. Era el defecto **FPS-OBS-03**, registrado y sin
 * corregir desde el First Product Slice, y §O lo cierra: `/fin` queda «simplificada», alcanzable
 * **solo** para una sesión ya cerrada. Al completar el último paso, **la acción** cierra la sesión y
 * aterriza aquí; el cierre no lo hace esta pantalla, porque un render no emite evidencia.
 *
 * **El cierre ya no dice que no hay plan.** Decía «Todavía no hay un plan que decida lo siguiente:
 * la planificación llega más adelante», que era cierto en el FPS y es **falso** desde que el
 * Planner decide. Lo que lo sustituye no promete nada de mañana: dice que lo hecho cuenta, y que
 * HOY es donde se ve lo siguiente cuando lo haya.
 * ---------------------------------------------------------------------------
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
    /*
     * UX-INV-18 · aquí **no se cierra nada**, y la tentación de hacerlo es justo el error.
     *
     * Cerrar la sesión al renderizar esta página habría hecho desaparecer la pantalla previa con
     * dos líneas, pero `SESSION_COMPLETED` es un evento y **ningún render emite evidencia**
     * (UX-INV-16). El cierre vive en `advanceToCurrentStep`, que lo ejecuta la acción que la
     * persona pulsa en el último paso.
     *
     * Llegar aquí con una sesión abierta y sin pasos pendientes significa, entonces, que alguien
     * escribió la URL a mano antes de pulsar. No se le cierra la sesión por haber navegado: vuelve
     * a HOY, que ofrecerá continuar.
     */
    redirect('/hoy');
  }

  const session = await findLatestSession(supabase);
  if (!session || session.status !== 'COMPLETED') redirect('/hoy');

  const state = await loadSessionState(supabase, session);
  const summary = await summarize(supabase, state);

  return (
    <ProductShell testId="fin">
      <Wordmark />
      <SystemVoice>Sesión cerrada</SystemVoice>
      <PageTitle testId="fin-titulo">Sesión terminada</PageTitle>

      <DecisionSurface testId="fin-resumen">
        <ActionTitle>Esto es lo que hiciste.</ActionTitle>
        <dl className={productStyles.measure} data-testid="resumen">
          {rowsFor(summary).map((row) => (
            <div key={row.label}>
              <dt className={productStyles.systemVoice}>{row.label}</dt>
              <dd className={`${productStyles.numeric} ${productStyles.measure}`}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <Secondary testId="fin-cierre">
          Lo que hiciste cuenta. Cuando vuelvas a Hoy verás qué toca, si toca algo.
        </Secondary>
        <Actions>
          {/* Una navegación es un enlace. No se disfraza de acción para tener estado ocupado. */}
          <a className="so-action" href="/hoy" data-testid="fin-volver">
            Volver a Hoy
          </a>
        </Actions>
      </DecisionSurface>
    </ProductShell>
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
