import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { tryCreatePlannerClient } from './admin';

/**
 * Declaraciones de tiempo de la persona · P4B-D3 · R-8.
 *
 * Dos objetos **distintos**, y el contrato de producto insiste en que no se colapsen (§H):
 *
 *   - **el tiempo de hoy**: un override de un solo día, que el Planner lee con precedencia sobre
 *     todo lo demás. Su cero es dato;
 *   - **la disponibilidad habitual**: el patrón por día de la semana más el valor por defecto.
 *
 * Los dos son **declaraciones de la persona** (T1 de la jerarquía de verdad): autoritativas, nunca
 * contradichas y nunca juzgadas. Ninguno es evidencia de aprendizaje, y por eso ninguno toca el
 * Learning Engine.
 *
 * Los dos caminos escriben **estado canónico más evento duradero en la misma transacción**, dentro
 * de una función `SECURITY DEFINER` de solo rol de servicio. El evento es autoritativo de servidor
 * (INV-118): un cliente no puede emitirlo por su cuenta, de modo que la historia no puede decir
 * algo distinto del estado. **La superficie de RPC invocable por cliente sigue siendo dos.**
 *
 * El día de plan lo deriva **el servidor** desde `profiles.timezone`. El cliente nunca nombra la
 * fecha, por la misma autoridad que impide que `client_created_at` elija representación o clave
 * (SD-023).
 */

export const AVAILABILITY_RPC = {
  todayOverride: 'set_today_override',
  availability: 'set_availability',
} as const;

export type AvailabilityOutcome =
  | { readonly kind: 'SAVED'; readonly planDay?: string; readonly minutes?: number }
  /** §I.1 · sin zona horaria declarada no existe «hoy», y no se deduce. */
  | { readonly kind: 'TIMEZONE_REQUIRED' }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'SKIPPED'; readonly reason: string };

function refusalOf(message: string): AvailabilityOutcome | null {
  if (message.includes('TIMEZONE_REQUIRED')) return { kind: 'TIMEZONE_REQUIRED' };
  if (
    message.includes('MINUTES_OUT_OF_RANGE') ||
    message.includes('PAYLOAD_MALFORMED') ||
    message.includes('WEEKLY_MALFORMED') ||
    message.includes('DIAGNOSTIC_PREFERENCE_INVALID') ||
    message.includes('TODAY_OVERRIDE_MALFORMED') ||
    message.includes('TODAY_OVERRIDE_DAY_MISMATCH')
  ) {
    return { kind: 'INVALID' };
  }
  return null;
}

/**
 * El tiempo de **hoy**, y solo de hoy.
 *
 * Cambiarlo cambia la entrada del Planner y por tanto dispara recomputación y supersesión
 * gobernadas. **No reescribe una sesión ya abierta** (§N): si la hay, la petición de plan
 * siguiente devuelve `RESUME_REQUIRED` y la declaración queda guardada para cuando esa sesión
 * termine.
 *
 * `minutes = 0` es válido y produce `ZERO_TIME`. No es una deuda ni un día perdido: es lo que la
 * persona dijo.
 */
export async function setTodayOverride(
  userId: string,
  minutes: number,
  options: { readonly client?: SupabaseClient } = {},
): Promise<AvailabilityOutcome> {
  const client = options.client ?? tryCreatePlannerClient();
  if (!client) return { kind: 'SKIPPED', reason: 'SIN_CONFIGURACION_DE_SERVIDOR' };
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 600) return { kind: 'INVALID' };

  const call = await client.rpc(AVAILABILITY_RPC.todayOverride, {
    p_user: userId,
    p_minutes: minutes,
  });
  if (call.error) {
    const refusal = refusalOf(call.error.message);
    if (refusal) return refusal;
    throw new Error(`override del día: ${call.error.message}`);
  }
  const data = call.data as { planDay: string; minutes: number };
  return { kind: 'SAVED', planDay: data.planDay, minutes: Number(data.minutes) };
}

/** La disponibilidad **habitual**: patrón por día de la semana, con el cero admitido, y defecto. */
export async function setAvailability(
  userId: string,
  input: {
    readonly defaultDailyMinutes: number;
    readonly weekly: Readonly<Record<string, number>>;
    readonly diagnosticPreference?: 'TAKE' | 'SKIP' | null;
    readonly reducedMotion?: boolean | null;
  },
  options: { readonly client?: SupabaseClient } = {},
): Promise<AvailabilityOutcome> {
  const client = options.client ?? tryCreatePlannerClient();
  if (!client) return { kind: 'SKIPPED', reason: 'SIN_CONFIGURACION_DE_SERVIDOR' };

  const call = await client.rpc(AVAILABILITY_RPC.availability, {
    p_user: userId,
    p_default_daily_minutes: input.defaultDailyMinutes,
    p_weekly: input.weekly,
    p_diagnostic_preference: input.diagnosticPreference ?? null,
    p_reduced_motion: input.reducedMotion ?? null,
  });
  if (call.error) {
    const refusal = refusalOf(call.error.message);
    if (refusal) return refusal;
    throw new Error(`disponibilidad: ${call.error.message}`);
  }
  return { kind: 'SAVED' };
}

/**
 * La zona horaria declarada. **La elige la persona** (S3): nunca se deduce del servidor, de la IP
 * ni del navegador, y nunca se rellena con UTC.
 *
 * Es la única de las tres declaraciones que la persona escribe directamente sobre su propia fila,
 * porque `profiles` ya le concede esa columna y no lleva evento asociado: no es una declaración de
 * tiempo disponible, es la referencia que hace que «hoy» exista.
 */
export async function setTimezone(
  userId: string,
  timezone: string,
  options: { readonly client?: SupabaseClient } = {},
): Promise<AvailabilityOutcome> {
  const client = options.client ?? tryCreatePlannerClient();
  if (!client) return { kind: 'SKIPPED', reason: 'SIN_CONFIGURACION_DE_SERVIDOR' };
  if (!timezone || timezone.length > 64) return { kind: 'INVALID' };

  const call = await client.from('profiles').update({ timezone }).eq('id', userId);
  if (call.error) {
    // El trigger del perfil valida la zona contra el catálogo real al declararla.
    if (call.error.message.includes('zona horaria')) return { kind: 'INVALID' };
    throw new Error(`zona horaria: ${call.error.message}`);
  }
  return { kind: 'SAVED' };
}
