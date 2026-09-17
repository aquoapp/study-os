import 'server-only';

import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { tryCreateEngineClient } from './admin';
import { ENGINE_RPC, runEngineForUser } from './run';

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
 *   canónica y el watermark**, sin ningún registro auxiliar. Cuando el aprendiz vuelve a una
 *   frontera de servidor natural —HOY—, el servidor recupera **su** proyección y llega **al
 *   mismo resultado que un rebuild**, porque el pliegue es conmutativo y el watermark acota lo
 *   procesado.
 *
 * Lo que deliberadamente **no** se hace: ninguna cola gestionada, ningún cron, ningún servicio
 * de pago, ninguna responsabilidad de recuperación en el cliente y ningún comando de
 * mantenimiento humano.
 *
 * **Phase 3.1 · D-26.** En `phase-3-v1.0` las dos rutas existían en el código y ninguna
 * funcionaba en la aplicación: la A llamaba al motor por esquemas privados que el Data API no
 * sirve, y la B no tenía ningún llamador. Ahora las dos pasan por `ENGINE_RPC`, y el trabajo
 * se entrega a `after()` de Next: una promesa suelta no está garantizada una vez enviada la
 * respuesta en un runtime sin servidor, y `after()` es el mecanismo de la plataforma para
 * terminar trabajo posterior a la respuesta.
 */

function logDeferred(route: 'A' | 'B', userId: string, error: unknown): void {
  // Un fallo aquí no puede alterar nada: la evidencia ya está aceptada y el atraso queda
  // registrado en el propio watermark, que es lo que la ruta B vuelve a mirar.
  console.warn(
    `learning-engine · ruta ${route} · proyección aplazada para ${userId}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

/** Ruta A · tras aceptar evidencia, calcula sin bloquear la respuesta ni propagar su fallo. */
export function scheduleProjection(userId: string): void {
  after(async () => {
    try {
      await runEngineForUser(userId);
    } catch (error) {
      logDeferred('A', userId, error);
    }
  });
}

/**
 * Ruta B · recuperación del aprendiz verificado que vuelve.
 *
 * Solo para **su** identidad, ya verificada por quien llama. No crea plan, no elige contenido
 * y no cambia nada de lo que el aprendiz ve: si la proyección está al día, `runEngineForUser`
 * devuelve `UP_TO_DATE` sin escribir; si está atrasada o es incoherente, la recupera. Es
 * seguro repetirla tantas veces como se quiera.
 */
export function recoverProjectionOnReturn(userId: string): void {
  after(async () => {
    try {
      await runEngineForUser(userId);
    } catch (error) {
      logDeferred('B', userId, error);
    }
  });
}

export interface RecoveryReport {
  readonly inspected: number;
  readonly recovered: number;
  readonly skipped: number;
  readonly failed: number;
}

/**
 * Barrido de recuperación de servidor, para todos los aprendices atrasados.
 *
 * Herramienta operativa con rol de servicio: **no** es la ruta B de la aplicación, que es
 * `recoverProjectionOnReturn`. Se apoya solo en evidencia y watermark, de modo que recupera
 * aunque todas las invocaciones normales se hayan perdido.
 */
export async function recoverStaleProjections(
  limit = 50,
  client?: SupabaseClient,
): Promise<RecoveryReport> {
  const supabase = client ?? tryCreateEngineClient();
  if (!supabase) return { inspected: 0, recovered: 0, skipped: 0, failed: 0 };

  const stale = await supabase.rpc(ENGINE_RPC.staleUsers, {
    p_projection: 'concept_mastery',
    p_limit: limit,
  });
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
