import { redirect } from 'next/navigation';

import { getVerifiedIdentity } from '../../server/auth/identity';
import { recoverProjectionOnReturn } from '../../server/engine/schedule';
import { deriveStep, findOpenSession, loadSessionState } from '../../server/fps/session';
import { resolveToday, type TodayState } from '../../server/planner/today';
import { createSupabaseServerClient } from '../../server/supabase/server-client';
import { setTodayTimeAction, startTodayAction } from '../actions/planner';
import { PrimaryAction } from '../_components/product/primary-action';
import {
  ActivitySlot,
  Actions,
  ActionTitle,
  DecisionSurface,
  PageTitle,
  ProductShell,
  Secondary,
  SystemVoice,
  Wordmark,
} from '../_components/product/shell';
import { TodayTimeControl } from '../_components/product/today-time';

export const metadata = { title: 'Hoy · Study OS' };
export const dynamic = 'force-dynamic';

/**
 * HOY · **el único destino** · `docs/PRODUCT_UX_CONTRACT.md` §O.
 *
 * No se monta el shell de los cinco espacios: ENTRENAR es Phase 6, PROGRESO y PLAN son Phase 7, y
 * montar destinos para capacidades inexistentes es lo que EC-012 prohíbe.
 *
 * HOY dice **qué hacer ahora**, con verdad, y nada más. Lo que representa sale entero de las
 * salidas reales del servidor (§E), no de una lista de estados inventada:
 *
 *   S2 sin objetivo · S3 zona horaria · S4 disponibilidad · S5 plan · S6 tiempo cero ·
 *   S7 nada completo cabe · S8 nada que recomendar · S9 no podemos preparar tu plan ·
 *   S10 te quedaste aquí.
 *
 * **Q-5 · planificar al renderizar está permitido.** Crear o reutilizar una ejecución durante el
 * render de servidor es una decisión de planificación, distinta de emitir evidencia de aprendiz, y
 * sigue siendo idempotente para una ejecución no arrancada. **Ningún render emite evidencia**
 * (UX-INV-16): el evento de presentación lo emite la acción que navega, nunca esta página.
 *
 * **Nada de L3 llega al DOM** (§G, UX-INV-2): ni identificador de ejecución, ni hash, ni versión,
 * ni watermark, ni generación, ni estado del motor, ni razón de composición o exclusión, ni
 * identificador de representación, ni porcentaje. El resolutor de servidor ya las filtra.
 */
export default async function HoyPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/entrar?siguiente=/hoy');

  // Ruta B del Learning Engine (Phase 3.1 · D-26): el aprendiz verificado vuelve y el servidor
  // recupera **su** proyección si quedó atrasada. No cambia nada de lo que HOY muestra.
  recoverProjectionOnReturn(identity.userId);

  const { state } = await resolveToday(identity.userId);

  if (state.kind === 'RESUME_REQUIRED') {
    return <ResumeSurface />;
  }

  return (
    <ProductShell testId="hoy">
      <Wordmark />
      <SystemVoice testId="hoy-fecha">{todayLabel()}</SystemVoice>
      <PageTitle testId="hoy-titulo">Hoy</PageTitle>
      <ActivitySlot />
      <TodaySurface state={state} />
    </ProductShell>
  );
}

/** La fecha de hoy en voz de sistema. Un hecho (T2), no una exhortación. */
function todayLabel(): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

const NATURE_LABEL: Record<string, string> = {
  APRENDER: 'Aprender',
  COMPROBAR: 'Comprobar',
  REAPRENDER_Y_COMPROBAR: 'Reaprender y comprobar',
};

function TodaySurface({ state }: { readonly state: TodayState }) {
  switch (state.kind) {
    // S2 · no hay examen elegido. No se implica que el sistema sepa nada de ella.
    case 'NO_GOAL':
      return (
        <DecisionSurface testId="hoy-sin-objetivo">
          <ActionTitle>Todavía no has elegido qué examen preparas.</ActionTitle>
          <Actions>
            <a className="so-action" href="/onboarding" data-testid="hoy-primaria">
              Elegir examen
            </a>
          </Actions>
        </DecisionSurface>
      );

    // S3 · sin zona horaria no existe «hoy», y **la elige ella**: nunca se deduce (UX-INV-21).
    case 'TIMEZONE_REQUIRED':
      return (
        <DecisionSurface testId="hoy-zona-horaria">
          <ActionTitle>Dinos en qué zona horaria estudias.</ActionTitle>
          <Secondary>
            Sin ella no podemos saber cuándo empieza y acaba tu día. La eliges tú.
          </Secondary>
          <Actions>
            <a className="so-action" href="/ajustes" data-testid="hoy-primaria">
              Elegir mi zona horaria
            </a>
          </Actions>
        </DecisionSurface>
      );

    // S4 · falta la disponibilidad habitual. Ni compromiso, ni objetivo.
    case 'SETTINGS_REQUIRED':
      return (
        <DecisionSurface testId="hoy-sin-disponibilidad">
          <ActionTitle>¿Cuánto tiempo sueles tener?</ActionTitle>
          <Secondary>Lo puedes cambiar cuando quieras, y cualquier cantidad vale.</Secondary>
          <Actions>
            <a className="so-action" href="/ajustes" data-testid="hoy-primaria">
              Declarar disponibilidad
            </a>
          </Actions>
        </DecisionSurface>
      );

    // S5 · hay plan. Una sola primaria (UX-INV-1) y el control de tiempo como secundaria.
    case 'PLAN': {
      const { plan } = state;
      return (
        <DecisionSurface testId="hoy-plan">
          <SystemVoice testId="hoy-forma-sesion">
            {plan.actionCount} {plan.actionCount === 1 ? 'acción' : 'acciones'} ·{' '}
            {plan.plannedMinutes} min · hoy tienes {plan.budgetMinutes} min
          </SystemVoice>
          <ActionTitle testId="hoy-siguiente">
            {NATURE_LABEL[plan.next.nature]} · {plan.next.minutes} min
          </ActionTitle>
          <Secondary testId="hoy-razon">{reasonFor(plan.next.nature)}</Secondary>
          <Actions>
            <PrimaryAction
              action={startTodayAction}
              pendingLabel="Abriendo la sesión…"
              testId="hoy-primaria"
            >
              Empezar
            </PrimaryAction>
            <TodayTimeControl currentMinutes={plan.budgetMinutes} onSave={setTodayTimeAction} />
          </Actions>
        </DecisionSurface>
      );
    }

    /*
     * S6 · la persona declaró cero. **Cero acciones primarias** (UX-INV-1).
     *
     * UX-INV-22 · aquí no hay ningún gesto, sugerencia, destacado ni valor por defecto cuyo
     * significado sea que debería tener más tiempo. Su declaración es autoritativa y se respeta:
     * ni día perdido, ni deuda, ni racha rota, ni culpa.
     */
    case 'ZERO_TIME':
      return (
        <DecisionSurface testId="hoy-tiempo-cero">
          <ActionTitle>Hoy no tienes tiempo.</ActionTitle>
          <Secondary>Lo dijiste tú, y está bien. Aquí seguimos mañana.</Secondary>
          <Actions>
            <TodayTimeControl
              currentMinutes={state.budgetMinutes}
              onSave={setTodayTimeAction}
              label="Cambiar el tiempo de hoy"
            />
          </Actions>
        </DecisionSurface>
      );

    /*
     * S7 · hay trabajo, pero nada completo cabe. **Cero primarias.**
     *
     * P4B-D1 · el tiempo que declaró es autoritativo: no se crea ni se ofrece una acción fuera de
     * presupuesto, no se trunca nada y no se viola el presupuesto en silencio. Lo que sí se puede
     * decir con verdad es cuánto necesita la acción elegible más corta.
     */
    case 'NOTHING_FITS':
      return (
        <DecisionSurface testId="hoy-nada-cabe">
          <ActionTitle>Con {state.budgetMinutes} min no cabe ninguna acción completa.</ActionTitle>
          {state.shortestMinutes !== null ? (
            <Secondary testId="hoy-mas-corta">
              La más corta que te toca necesita {state.shortestMinutes} min.
            </Secondary>
          ) : null}
          <Actions>
            <TodayTimeControl currentMinutes={state.budgetMinutes} onSave={setTodayTimeAction} />
          </Actions>
        </DecisionSurface>
      );

    /*
     * S8 · nada que recomendar. **Cero primarias y cero secundarias contextuales** (UX-INV-23).
     *
     * No hay control de tiempo aquí, y su ausencia es deliberada (UX-INV-8): ofrecerlo insinuaría
     * que con más minutos habría algo, y no lo hay. Es vacío veraz e intencionado, no una CTA que
     * falta.
     *
     * No implica preparada, lista, dominado, temario terminado ni preparación de ningún tipo.
     */
    case 'NOTHING_ELIGIBLE':
      return (
        <DecisionSurface testId="hoy-nada-elegible">
          <ActionTitle>Hoy no tenemos nada que recomendarte.</ActionTitle>
          <Secondary>
            No es que hayas terminado: es que con lo que sabemos ahora mismo no podemos justificar
            ninguna acción.
          </Secondary>
        </DecisionSurface>
      );

    // S9 · fallo veraz. No se dice que se produjo un plan, y no se muestra texto de proveedor.
    case 'CANNOT_PLAN':
      return (
        <DecisionSurface testId="hoy-sin-plan">
          <ActionTitle>No hemos podido preparar tu plan.</ActionTitle>
          {/*
           * S9 debe transmitir tres cosas: que es temporal, que no es culpa suya y que no hay
           * nada que recuperar. Lo tercero **no** se dice como promesa de persistencia: la
           * guarda de copy de Phase 0 prohíbe esa forma, y con razón, porque no distingue
           * «aquí no llegó a haber nada» de «lo tuyo está a salvo», y la segunda sería una
           * promesa que ninguna cola local sostiene. Se dice por lo que de verdad ocurrió:
           * no hizo nada que pudiera perderse.
           */}
          <Secondary>No es cosa tuya y no hace falta que hagas nada.</Secondary>
          {state.retryable ? (
            <Actions>
              <PrimaryAction
                action={startTodayAction}
                pendingLabel="Reintentando…"
                testId="hoy-primaria"
              >
                Reintentar
              </PrimaryAction>
            </Actions>
          ) : null}
        </DecisionSurface>
      );

    default:
      return null;
  }
}

/**
 * La razón, **en términos de la persona** (§G nivel L1).
 *
 * Es la única forma en que el nivel T4 —«el sistema infiere»— puede aflorar: como **acción más
 * razón**, nunca como afirmación sobre ella. Ninguna de estas frases dice que domine algo, que
 * esté preparada o que vaya bien o mal.
 */
function reasonFor(nature: string): string {
  switch (nature) {
    case 'REAPRENDER_Y_COMPROBAR':
      return 'Aquí fallaste, así que primero lo repasas y luego lo compruebas.';
    case 'COMPROBAR':
      return 'Esto ya lo has visto. Toca comprobar si te ha quedado.';
    default:
      return 'Esto es nuevo para ti.';
  }
}

/**
 * S10 · **te quedaste aquí**.
 *
 * UX-INV-19 · nunca se refiere a la sesión abierta como «el plan de hoy»: puede ser de otro día, y
 * decir lo contrario sería falso. Parar no fue un fallo y no se le trata como tal.
 */
async function ResumeSurface() {
  const supabase = await createSupabaseServerClient();
  const session = await findOpenSession(supabase);
  if (!session) redirect('/hoy');
  const state = await loadSessionState(supabase, session);
  const step = deriveStep(state);
  const total = state.items.length;
  const done = state.items.filter((item) => item.status === 'COMPLETED').length;

  const where =
    step.kind === 'learn'
      ? 'en una lectura'
      : step.kind === 'check'
        ? 'en una pregunta'
        : step.kind === 'feedback'
          ? 'en la corrección de tu última respuesta'
          : 'al final de la sesión';

  return (
    <ProductShell testId="hoy">
      <Wordmark />
      <SystemVoice testId="hoy-fecha">{todayLabel()}</SystemVoice>
      <PageTitle testId="hoy-titulo">Hoy</PageTitle>
      <ActivitySlot />
      <DecisionSurface testId="hoy-retomar">
        <ActionTitle>Te quedaste {where}.</ActionTitle>
        <Secondary testId="hoy-restante">
          Llevas {done} de {total} pasos de esa sesión.
        </Secondary>
        <Actions>
          <PrimaryAction
            action={startTodayAction}
            pendingLabel="Abriendo la sesión…"
            testId="hoy-primaria"
          >
            Retomamos desde aquí
          </PrimaryAction>
          <a className="so-action" href="/hoy/replanificar" data-testid="hoy-replanificar">
            Replanificar lo que queda
          </a>
        </Actions>
      </DecisionSurface>
    </ProductShell>
  );
}
