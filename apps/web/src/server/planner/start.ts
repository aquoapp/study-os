import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { replayFromSnapshot } from '@study-os/planner-engine';

import { tryCreatePlannerClient } from './admin';
import { PLANNER_RPC } from './run';

/**
 * Arranque de una sesión planificada · Planner Contract §U.6 · §V.
 *
 * Recibe **solo** un identificador de ejecución. La función de servidor comprueba propiedad,
 * frescura de la entrada, disponibilidad de cada destino y ausencia de sesión abierta, copia los
 * ítems como instantánea y fija `planner_run_id`. Es idempotente por ejecución.
 *
 * Generación y arranque no son atómicos, y no deben serlo (§U.7): una ejecución sin sesión es
 * historia válida.
 *
 * En Phase 4A ninguna ruta de la aplicación lo invoca: la selección visible sigue siendo
 * `fps-fixed-v1` (P4-G15). Existe para que la frontera esté probada en runtime real antes de 4B.
 */

export type StartOutcome =
  | { readonly kind: 'STARTED'; readonly sessionId: string; readonly reused: boolean }
  | {
      readonly kind:
        | 'RUN_NOT_FOUND'
        | 'RUN_NOT_STARTABLE'
        | 'RUN_SUPERSEDED'
        | 'RUN_STALE'
        | 'TARGET_UNAVAILABLE'
        | 'OPEN_SESSION';
    }
  | { readonly kind: 'SKIPPED'; readonly reason: string };

const REFUSALS = [
  'RUN_NOT_FOUND',
  'RUN_NOT_STARTABLE',
  'RUN_SUPERSEDED',
  'RUN_STALE',
  'TARGET_UNAVAILABLE',
  'OPEN_SESSION',
] as const;

export async function startPlannedSession(
  userId: string,
  runId: string,
  options: { readonly client?: SupabaseClient } = {},
): Promise<StartOutcome> {
  const client = options.client ?? tryCreatePlannerClient();
  if (!client) return { kind: 'SKIPPED', reason: 'SIN_CONFIGURACION_DE_SERVIDOR' };
  const call = await client.rpc(PLANNER_RPC.startSession, { p_user: userId, p_run_id: runId });
  if (call.error) {
    const refusal = REFUSALS.find((code) =>
      call.error.message.includes(`STUDY_OS_PLANNER · ${code}`),
    );
    if (refusal) return { kind: refusal };
    throw new Error(`arranque de sesión planificada: ${call.error.message}`);
  }
  const data = call.data as { sessionId: string; reused: boolean };
  return { kind: 'STARTED', sessionId: data.sessionId, reused: data.reused };
}

/**
 * «¿Por qué STUDY OS recomendó esto a esta persona en aquel momento?» (§A, §R).
 *
 * Se responde **solo** desde la instantánea congelada de la ejecución, nunca desde estado actual:
 * la entrada canónica guardada vuelve a pasar por el Planner puro y la decisión debe coincidir
 * byte a byte con la guardada (P4-G4).
 */
export async function explainRun(
  runId: string,
  options: { readonly client?: SupabaseClient } = {},
): Promise<{ readonly identical: boolean; readonly decisionCanonical: string } | null> {
  const client = options.client ?? tryCreatePlannerClient();
  if (!client) return null;
  const audit = await client
    .from('planner_run_audit')
    .select('input_canonical, decision_canonical')
    .eq('run_id', runId)
    .maybeSingle();
  if (audit.error) throw new Error(`auditoría del plan: ${audit.error.message}`);
  if (!audit.data) return null;
  const row = audit.data as { input_canonical: string; decision_canonical: string };
  const replayed = replayFromSnapshot(row.input_canonical);
  return {
    identical: replayed === row.decision_canonical,
    decisionCanonical: row.decision_canonical,
  };
}
