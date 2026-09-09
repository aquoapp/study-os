import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { tryCreateEngineClient } from './admin';
import { runEngineForUser } from './run';

/**
 * Invocación diferida y recuperación · autorización de BUILD §18.
 *
 * **Invariante absoluto: la durabilidad de la evidencia no depende del éxito de la
 * proyección.** De ahí las dos rutas, y la segunda no es opcional:
 *
 *   **A · ruta normal, no bloqueante.** Tras aceptar evidencia se lanza el cálculo sin
 *   esperarlo y sin dejar que su fallo se propague. La respuesta al aprendiz no depende de
 *   que el motor termine, ni siquiera de que arranque.
 *
 *   **B · ruta de recuperación, duradera.** Un atraso es **detectable desde la evidencia
 *   canónica y el watermark**, sin ningún registro auxiliar: `engine.stale_users` compara la
 *   posición máxima del stream de cada aprendiz con lo que su consumidor declara consumido.
 *   Cualquier ejecución de servidor posterior —la siguiente acción del propio aprendiz o un
 *   barrido con rol de servicio— recupera el trabajo perdido y llega **al mismo resultado que
 *   un rebuild**, porque el pliegue es conmutativo y el watermark acota lo procesado.
 *
 * Lo que deliberadamente **no** se hace: ninguna cola gestionada, ningún servicio de pago,
 * ninguna responsabilidad de recuperación en el cliente y ningún comando de mantenimiento
 * humano. La recuperación es una propiedad del servidor y de los datos, no de una costumbre.
 */

/** Ruta A · lanza el cálculo sin bloquear y sin propagar su fallo. */
export function scheduleProjection(userId: string): void {
  void runEngineForUser(userId).catch((error: unknown) => {
    // Un fallo aquí no puede alterar nada: la evidencia ya está aceptada y el atraso queda
    // registrado en el propio watermark, que es lo que la ruta B vuelve a mirar.
    console.warn(
      `learning-engine · proyección aplazada para ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  });
}

export interface RecoveryReport {
  readonly inspected: number;
  readonly recovered: number;
  readonly skipped: number;
  readonly failed: number;
}

/**
 * Ruta B · barrido de recuperación.
 *
 * Se apoya solo en evidencia y watermark, de modo que recupera aunque **todas** las
 * invocaciones normales se hayan perdido.
 */
export async function recoverStaleProjections(
  limit = 50,
  client?: SupabaseClient,
): Promise<RecoveryReport> {
  const supabase = client ?? tryCreateEngineClient();
  if (!supabase) return { inspected: 0, recovered: 0, skipped: 0, failed: 0 };

  const stale = await supabase
    .schema('engine')
    .rpc('stale_users', { p_projection: 'concept_mastery', p_limit: limit });
  if (stale.error) throw new Error(`detección de atraso: ${stale.error.message}`);
  const rows = (stale.data ?? []) as Array<{ user_id: string }>;

  let recovered = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const outcome = await runEngineForUser(row.user_id, { client: supabase });
      if (outcome.kind === 'APPLIED') recovered += 1;
      else skipped += 1;
    } catch {
      // Un aprendiz que falla no detiene a los demás: es la misma regla que ADR-008 aplica al
      // watermark por usuario. El atraso sigue siendo detectable en el barrido siguiente.
      failed += 1;
    }
  }
  return { inspected: rows.length, recovered, skipped, failed };
}
