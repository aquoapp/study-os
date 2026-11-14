import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { tryCreatePlannerClient } from './admin';
import { requestPlanForUser, type PlannerRequestOutcome } from './run';

/**
 * El estado de HOY, derivado de las salidas reales del servidor.
 *
 * `docs/PRODUCT_UX_CONTRACT.md` §E fija **veintiún estados**, y los deriva del conjunto real de
 * salidas —no de los recuentos históricos de estados vacíos—. Este módulo produce los que HOY
 * puede alcanzar, **S1 … S10**, y nada más: los de sesión los deriva `server/fps/session.ts` de la
 * evidencia, y las superposiciones S11 y S21 son interacción, no estado de servidor.
 *
 * Tres reglas que este módulo no puede romper:
 *
 *   - **nada de L3 sale de aquí** (§G, Q-4, UX-INV-2): ni identificador de ejecución, ni hash, ni
 *     versión, ni watermark, ni generación, ni estado del motor, ni razón de composición o de
 *     exclusión, ni identificador de representación. La presentación protegida se obtiene por la
 *     frontera autoritativa de servidor y **ninguna concesión de cliente se amplía**;
 *   - **planificar al renderizar está permitido** (Q-5): crear o reutilizar una ejecución durante
 *     el render de servidor es una decisión de planificación, distinta de emitir evidencia. Sigue
 *     siendo idempotente para una ejecución no arrancada;
 *   - **ningún render emite evidencia** (UX-INV-16). Aquí no se llama a `append_learning_event`.
 *
 * El identificador de ejecución **sí** vuelve al servidor de acciones —arrancar una sesión lo
 * necesita—, pero no viaja al DOM: la acción de arranque lo vuelve a resolver desde el estado
 * autoritativo en lugar de recibirlo del cliente.
 */

/** La naturaleza de la acción, en términos de la persona. Nunca un código interno. */
export type ActionNature = 'APRENDER' | 'COMPROBAR' | 'REAPRENDER_Y_COMPROBAR';

export interface PlannedActionView {
  /** Posición de la **acción** en el plan, desde 1. Nunca el ordinal de ruta (UX-INV-24). */
  readonly position: number;
  readonly nature: ActionNature;
  readonly minutes: number;
  /** Cuántos pasos tiene: 1 o 2. Una acción de un paso no muestra indicador de fase. */
  readonly steps: number;
}

export interface PlanView {
  /** Total de **acciones**, nunca `item_count` ni el número de pasos (UX-INV-24). */
  readonly actionCount: number;
  readonly plannedMinutes: number;
  readonly budgetMinutes: number;
  readonly next: PlannedActionView;
}

export type TodayState =
  /** S2 · no hay examen elegido. */
  | { readonly kind: 'NO_GOAL' }
  /** S3 · sin zona horaria declarada no existe «hoy». **La elige ella.** */
  | { readonly kind: 'TIMEZONE_REQUIRED' }
  /** S4 · falta la disponibilidad habitual. */
  | { readonly kind: 'SETTINGS_REQUIRED' }
  /** S5 · hay plan. Primaria: empezar. Secundaria: cambiar el tiempo de hoy. */
  | { readonly kind: 'PLAN'; readonly plan: PlanView; readonly budgetMinutes: number }
  /** S6 · la persona declaró cero. **Cero acciones primarias.** Ni culpa, ni empujón. */
  | { readonly kind: 'ZERO_TIME'; readonly budgetMinutes: number }
  /**
   * S7 · hay trabajo, pero nada completo cabe. **Cero acciones primarias.**
   *
   * `shortestMinutes` es la estimación **veraz** de la acción elegible más corta, que P4B-D1
   * autoriza a comunicar. No se ofrece esa acción como ejecutable: el tiempo declarado por la
   * persona es autoritativo y no se viola en silencio.
   */
  | {
      readonly kind: 'NOTHING_FITS';
      readonly budgetMinutes: number;
      readonly shortestMinutes: number | null;
    }
  /**
   * S8 · nada que recomendar. **Cero primarias y cero secundarias contextuales** (UX-INV-23).
   *
   * No implica preparada, lista, dominado, temario terminado ni que más tiempo ayudaría.
   */
  | { readonly kind: 'NOTHING_ELIGIBLE' }
  /** S9 · fallo veraz y temporal. No se produjo ningún plan. */
  | { readonly kind: 'CANNOT_PLAN'; readonly retryable: boolean }
  /** S10 · hay una sesión abierta. Nunca se le llama «el plan de hoy» (UX-INV-19). */
  | { readonly kind: 'RESUME_REQUIRED' };

const NATURE: Record<string, ActionNature> = {
  LEARN: 'APRENDER',
  CHECK: 'COMPROBAR',
  RELEARN_CHECK: 'REAPRENDER_Y_COMPROBAR',
};

/**
 * Traduce la decisión del Planner a lo que HOY puede decir.
 *
 * La reducción es deliberada y es donde vive la disciplina de frontera: de la decisión completa
 * —que lleva razones de composición, razones de exclusión y estados categóricos del motor— sale
 * un objeto que **solo** contiene naturaleza, posición, recuento, minutos y presupuesto.
 */
function viewOf(decision: {
  readonly actions: ReadonlyArray<{
    readonly ordinal: number;
    readonly kind: string;
    readonly minutes: number;
    readonly steps: readonly unknown[];
  }>;
  readonly plannedMinutes: number;
}): Omit<PlanView, 'budgetMinutes'> | null {
  const first = [...decision.actions].sort((a, b) => a.ordinal - b.ordinal)[0];
  if (!first) return null;
  return {
    actionCount: decision.actions.length,
    plannedMinutes: decision.plannedMinutes,
    next: {
      position: first.ordinal,
      nature: NATURE[first.kind] ?? 'APRENDER',
      minutes: first.minutes,
      steps: first.steps.length,
    },
  };
}

/**
 * La estimación de la acción elegible más corta bajo `NOTHING_FITS`.
 *
 * P4B-D1 autoriza comunicarla **con verdad**, y la verdad está en la instantánea de la ejecución:
 * todo elegible no colocado lleva razón `OVER_BUDGET` (§J, BF-2). Como la decisión no persiste los
 * minutos de cada candidato excluido, se recomputa aquí desde la misma decisión que acaba de
 * producirse, que es la única fuente honesta: **no se consulta ninguna fuente de duración aparte**.
 */
function shortestOverBudget(decision: {
  readonly candidates: ReadonlyArray<{ readonly exclusion: string | null }>;
  readonly overBudgetMinutes?: readonly number[];
}): number | null {
  const minutes = decision.overBudgetMinutes ?? [];
  if (minutes.length === 0) return null;
  return Math.min(...minutes);
}

export interface TodayOptions {
  readonly client?: SupabaseClient;
  /** Solo pruebas: sustituye la petición de plan por una salida fija. */
  readonly planner?: (userId: string) => Promise<PlannerRequestOutcome>;
}

/**
 * Resuelve el estado de HOY para una persona con identidad ya verificada en servidor (INV-116).
 *
 * **Q-6 · cambio de día.** No hace falta ninguna comprobación aquí: el día de plan lo deriva el
 * servidor en cada llamada desde la zona declarada, de modo que una ejecución de ayer nunca se
 * reutiliza —su `plan_day` no coincide— y se escribe una sucesora con verdad. Arrancar una
 * ejecución caducada lo rechaza `start_planned_session` con `RUN_STALE`.
 */
export async function resolveToday(
  userId: string,
  options: TodayOptions = {},
): Promise<{ readonly state: TodayState; readonly runId: string | null }> {
  const client = options.client ?? tryCreatePlannerClient();
  if (!client) return { state: { kind: 'CANNOT_PLAN', retryable: true }, runId: null };

  const outcome = options.planner
    ? await options.planner(userId)
    : await requestPlanForUser(userId, { client });

  switch (outcome.kind) {
    case 'RESUME_REQUIRED':
      return { state: { kind: 'RESUME_REQUIRED' }, runId: null };
    case 'TIMEZONE_REQUIRED':
      return { state: { kind: 'TIMEZONE_REQUIRED' }, runId: null };
    case 'NO_ACTIVE_GOAL':
      return { state: { kind: 'NO_GOAL' }, runId: null };
    case 'SETTINGS_REQUIRED':
      return { state: { kind: 'SETTINGS_REQUIRED' }, runId: null };
    case 'RUN': {
      const budgetMinutes = budgetOf(outcome);
      if (outcome.outcome === 'ZERO_TIME') {
        return { state: { kind: 'ZERO_TIME', budgetMinutes }, runId: outcome.runId };
      }
      if (outcome.outcome === 'NOTHING_ELIGIBLE') {
        return { state: { kind: 'NOTHING_ELIGIBLE' }, runId: outcome.runId };
      }
      if (outcome.outcome === 'NOTHING_FITS') {
        return {
          state: {
            kind: 'NOTHING_FITS',
            budgetMinutes,
            shortestMinutes: shortestOverBudget({
              candidates: outcome.decision.candidates,
              overBudgetMinutes: outcome.shortestOverBudgetMinutes,
            }),
          },
          runId: outcome.runId,
        };
      }
      const view = viewOf(outcome.decision);
      if (!view) return { state: { kind: 'CANNOT_PLAN', retryable: true }, runId: null };
      return {
        state: { kind: 'PLAN', plan: { ...view, budgetMinutes }, budgetMinutes },
        runId: outcome.runId,
      };
    }
    // §M · el motor atrasado, la contención y la ausencia de configuración son el mismo estado
    // para la persona: temporal, no es culpa suya, no se ha perdido nada. Se separan por
    // **recuperabilidad**, que sí es accionable, no por causa, que no lo es.
    case 'PLAN_UNAVAILABLE_ENGINE':
    case 'CONTENTION':
      return { state: { kind: 'CANNOT_PLAN', retryable: true }, runId: null };
    case 'DURATION_POLICY_MISSING':
    case 'SKIPPED':
    default:
      return { state: { kind: 'CANNOT_PLAN', retryable: false }, runId: null };
  }
}

function budgetOf(outcome: Extract<PlannerRequestOutcome, { kind: 'RUN' }>): number {
  return outcome.budgetMinutes ?? 0;
}
