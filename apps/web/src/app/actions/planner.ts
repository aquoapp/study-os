'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { requireVerifiedIdentity } from '../../server/auth/identity';
import { createSupabaseServerClient } from '../../server/supabase/server-client';
import { appendEvent, buildEnvelope, derivedEventId } from '../../server/fps/events';
import { findOpenSession } from '../../server/fps/session';
import { setAvailability, setTimezone, setTodayOverride } from '../../server/planner/availability';
import { startPlannedSession } from '../../server/planner/start';
import { resolveToday } from '../../server/planner/today';
import { advanceToCurrentStep } from '../../server/session/flow';

/**
 * Acciones de HOY · Phase 4B · el Planner sustituye a `fps-fixed-v1`.
 *
 * Lo que cambia respecto al First Product Slice es **la selección**, no el vertical: el bucle
 * APRENDER → COMPROBAR → CORRECCIÓN → FIN ya operaba sobre evidencia real y sigue igual. Lo que
 * desaparece es la asignación fija y determinista para todo el mundo, que deja de ser alcanzable
 * desde cualquier camino de aprendiz (UX-INV-9, P4-G34). Las sesiones históricas `FPS_FIXED` y su
 * evidencia siguen siendo legibles y válidas: no se reescribe historia.
 *
 * Reglas que estas acciones no pueden romper:
 *
 *   - **ninguna interacción fabrica evidencia** (§P, UX-INV-16). Pintar una página nunca produce
 *     evidencia; todo acto que la produce es una acción explícita, y son estas;
 *   - **el identificador de ejecución no viaja al cliente** (§G nivel L3, Q-4, UX-INV-2). Arrancar
 *     necesita uno, así que la acción lo **vuelve a resolver** desde el estado autoritativo en
 *     lugar de recibirlo de un formulario. El cliente no puede nombrar qué plan arranca;
 *   - **la identidad es del JWT verificado** (INV-116, Manifest §14): sale de `auth.uid()` dentro
 *     de cada función de servidor, nunca de un campo.
 */

export interface PlannerActionState {
  readonly error: string | null;
}

const GENERIC_ERROR = 'Algo no ha ido bien. Vuelve a Hoy y vuelve a intentarlo.';

/**
 * S20 · el plan está desactualizado y hay uno nuevo a un toque.
 *
 * Los cinco rechazos —caducada, destino retirado, superseded, consumida y cambio de día— se
 * funden en un solo estado porque **la acción de la persona es idéntica en los cinco**, y
 * separarlos por causa le daría una distinción que no puede usar. No dice que algo se rompió ni
 * que se perdió trabajo, y nunca nombra una versión.
 */
const STALE_PLAN = 'Tu plan de hoy ha cambiado. Vuelve a Hoy para ver el plan actual.';

async function context() {
  const identity = await requireVerifiedIdentity('/hoy');
  const supabase = await createSupabaseServerClient();
  return { identity, supabase };
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

/**
 * Empezar la sesión de hoy (S5 → primer paso).
 *
 * Resuelve el plan otra vez en servidor —es idempotente para una ejecución no arrancada (Q-5)— y
 * arranca esa ejecución. Si la base rechaza el arranque, el rechazo se traduce a S20 y **no** se
 * reintenta en bucle: la persona vuelve a HOY y ve el plan que de verdad existe.
 */
export async function startTodayAction(): Promise<PlannerActionState> {
  let destination = '/hoy';
  try {
    const { identity, supabase } = await context();

    // Si ya hay una sesión abierta, esto es S10 y no se crea nada: se continúa la que existe.
    const open = await findOpenSession(supabase);
    if (!open) {
      const { state, runId } = await resolveToday(identity.userId);
      if (state.kind !== 'PLAN' || !runId) {
        // No hay nada que arrancar, y decirlo es más honesto que fabricar una sesión.
        revalidatePath('/hoy');
        return { error: null };
      }
      const started = await startPlannedSession(identity.userId, runId);
      if (started.kind !== 'STARTED') {
        revalidatePath('/hoy');
        return {
          error:
            started.kind === 'OPEN_SESSION'
              ? null // Otra petición ganó la carrera: HOY ofrecerá continuar esa.
              : STALE_PLAN,
        };
      }
    }

    const session = await findOpenSession(supabase);
    if (!session) return { error: GENERIC_ERROR };

    // §P · el evento de arranque lo emite **esta acción**, nunca el render.
    if (session.status === 'PLANNED') {
      await appendEvent(
        supabase,
        buildEnvelope({
          eventId: derivedEventId(`start:${session.id}`),
          type: 'SESSION_STARTED',
          sessionId: session.id,
        }),
      );
    } else if (session.status === 'INTERRUPTED') {
      await appendEvent(
        supabase,
        buildEnvelope({
          eventId: derivedEventId(`resume:${session.id}:${Date.now()}`),
          type: 'SESSION_RESUMED',
          sessionId: session.id,
        }),
      );
    }

    destination = await advanceToCurrentStep(supabase);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: GENERIC_ERROR };
  }
  redirect(destination);
}

/**
 * S11 · el tiempo de **hoy**.
 *
 * Cambiarlo cambia la entrada del Planner, de modo que la ejecución vigente queda superseded por
 * la semántica de frescura aceptada y se calcula un plan nuevo. **Cero es un valor legítimo** y
 * produce `ZERO_TIME`: no es una deuda, ni un día perdido, ni una racha rota.
 *
 * No reescribe una sesión ya abierta (§N): si la hay, la declaración queda guardada y se aplica
 * cuando esa sesión termine.
 */
export async function setTodayTimeAction(minutes: number): Promise<PlannerActionState> {
  try {
    const { identity } = await context();
    const result = await setTodayOverride(identity.userId, minutes);
    if (result.kind === 'TIMEZONE_REQUIRED') {
      revalidatePath('/hoy');
      return { error: null };
    }
    if (result.kind !== 'SAVED') return { error: GENERIC_ERROR };
    revalidatePath('/hoy');
    return { error: null };
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: GENERIC_ERROR };
  }
}

/**
 * S21 · replanificar lo que queda.
 *
 * Es irreversible, de modo que nunca ocurre de un toque: la confirmación enuncia la consecuencia
 * antes (§P). Termina la sesión abierta y pide plan.
 *
 * **P4B-D2 · B2-a.** Terminar antes **no fabrica evidencia**: `SESSION_COMPLETED` es de ámbito
 * sesión y carga vacía, no crea intentos ni eventos de ítem, y los ítems no completados quedan
 * `PENDING`. La evidencia ya producida sigue siendo válida e independiente del linaje. La
 * ejecución queda **consumida**, así que la petición siguiente escribe una **sucesora** aunque la
 * entrada canónica no haya cambiado, y por eso el plan nuevo puede ser el mismo: si nada cambió,
 * nada tiene por qué cambiar, y eso se le dice antes de confirmar.
 */
export async function replanTodayAction(): Promise<PlannerActionState> {
  try {
    const { supabase } = await context();
    const session = await findOpenSession(supabase);
    if (session && session.status !== 'PLANNED') {
      await appendEvent(
        supabase,
        buildEnvelope({
          eventId: derivedEventId(`complete:${session.id}`),
          type: 'SESSION_COMPLETED',
          sessionId: session.id,
        }),
      );
    }
    revalidatePath('/hoy');
    return { error: null };
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: GENERIC_ERROR };
  }
}

/** S3 · la zona horaria, que **elige la persona**. Nunca se deduce ni se rellena con UTC. */
export async function setTimezoneAction(timezone: string): Promise<PlannerActionState> {
  try {
    const { identity } = await context();
    const result = await setTimezone(identity.userId, timezone);
    if (result.kind !== 'SAVED') return { error: 'Esa zona horaria no es válida.' };
    revalidatePath('/hoy');
    return { error: null };
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: GENERIC_ERROR };
  }
}

/** S12 · la disponibilidad **habitual**, con el cero admitido por día. */
export async function setAvailabilityAction(input: {
  readonly defaultDailyMinutes: number;
  readonly weekly: Readonly<Record<string, number>>;
}): Promise<PlannerActionState> {
  try {
    const { identity } = await context();
    const result = await setAvailability(identity.userId, input);
    if (result.kind !== 'SAVED') return { error: 'Revisa los minutos: van de 5 a 600.' };
    revalidatePath('/hoy');
    revalidatePath('/ajustes');
    return { error: null };
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: GENERIC_ERROR };
  }
}
