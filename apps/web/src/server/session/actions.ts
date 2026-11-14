import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { tryCreatePlannerClient } from '../planner/admin';
import type { SessionRow } from '../fps/session';

/**
 * La **agrupación de acciones** de una sesión planificada · UX-INV-24.
 *
 * El contrato de producto es tajante aquí, y por una razón concreta: la unidad que la persona
 * percibe es **la acción**, no el paso (§B, §D). Una reparación es una sola acción con dos pasos,
 * y presentarla como «paso 3 de 7» la convierte en dos cosas distintas que no lo son.
 *
 * Por eso **ninguna posición o total visible se deriva del ordinal de ruta ni de
 * `planner_runs.item_count`**. Las dos cifras salen de la agrupación autoritativa del Planner:
 * `planner_items.action_ordinal` y su máximo, obtenidas en servidor.
 *
 * `planner_items.position` y `session_items.sort_order` son la misma posición por construcción:
 * `start_planned_session` copia los ítems en ese orden. Ese es el puente, y no hace falta ninguna
 * columna nueva.
 *
 * **Q-4 · disciplina de frontera.** `planner_items` no tiene concesión de lectura de cliente para
 * `action_kind` ni `composition_reason`, así que esta lectura va por el rol de servicio y solo
 * devuelve lo que §G permite que llegue a la superficie: naturaleza, posición y total. La razón de
 * composición **no sale de aquí**.
 */

/** La naturaleza de una acción, en términos de la persona. Nunca un código interno. */
export type ActionNature = 'APRENDER' | 'COMPROBAR' | 'REAPRENDER_Y_COMPROBAR';

export interface ActionPlacement {
  /** Posición de la **acción** en el plan, desde 1. */
  readonly position: number;
  /** Total de **acciones** del plan. */
  readonly total: number;
  readonly nature: ActionNature;
  /** Cuántos pasos tiene la acción: 1 o 2. */
  readonly steps: number;
  /** Cuál de ellos es este, desde 1. Solo significa algo si `steps` es 2. */
  readonly stepIndex: number;
}

const NATURE: Record<string, ActionNature> = {
  LEARN: 'APRENDER',
  CHECK: 'COMPROBAR',
  RELEARN_CHECK: 'REAPRENDER_Y_COMPROBAR',
};

interface PlannerItemRow {
  readonly position: number;
  readonly action_ordinal: number;
  readonly action_kind: string;
}

/**
 * Mapa `sort_order` del ítem de sesión → su sitio en la agrupación de acciones.
 *
 * Devuelve `null` cuando la sesión no procede de una ejecución del Planner. Las sesiones
 * históricas `FPS_FIXED` no tienen agrupación de acciones, y **no se les inventa una**: sus
 * superficies muestran el paso sin cabecera de acción, que es lo que siempre mostraron.
 */
export async function loadActionPlacements(
  session: SessionRow & { readonly planner_run_id?: string | null },
  options: { readonly client?: SupabaseClient } = {},
): Promise<ReadonlyMap<number, ActionPlacement> | null> {
  const runId = session.planner_run_id;
  if (!runId) return null;

  const client = options.client ?? tryCreatePlannerClient();
  if (!client) return null;

  const { data, error } = await client
    .from('planner_items')
    .select('position, action_ordinal, action_kind')
    .eq('run_id', runId)
    .order('position');
  if (error) throw new Error(`agrupación de acciones: ${error.message}`);

  const rows = (data ?? []) as PlannerItemRow[];
  if (rows.length === 0) return null;

  // El total es el número de **acciones distintas**, no el de ítems.
  const ordinals = new Set(rows.map((row) => Number(row.action_ordinal)));
  const total = ordinals.size;

  const byOrdinal = new Map<number, PlannerItemRow[]>();
  for (const row of rows) {
    const ordinal = Number(row.action_ordinal);
    const list = byOrdinal.get(ordinal) ?? [];
    list.push(row);
    byOrdinal.set(ordinal, list);
  }

  const out = new Map<number, ActionPlacement>();
  for (const [ordinal, items] of byOrdinal) {
    const ordered = [...items].sort((a, b) => Number(a.position) - Number(b.position));
    ordered.forEach((row, index) => {
      out.set(Number(row.position), {
        position: ordinal,
        total,
        nature: NATURE[row.action_kind] ?? 'APRENDER',
        steps: ordered.length,
        stepIndex: index + 1,
      });
    });
  }
  return out;
}

export const NATURE_LABEL: Record<ActionNature, string> = {
  APRENDER: 'Aprender',
  COMPROBAR: 'Comprobar',
  REAPRENDER_Y_COMPROBAR: 'Reaprender y comprobar',
};

/**
 * La etiqueta de fase de un paso dentro de su acción.
 *
 * **UX-INV-17** · una acción de un solo paso **no muestra indicador de fase**: ponerlo insinuaría
 * una segunda mitad que no existe. Y completar la fase 1 de una reparación **no** afirma que la
 * reparación esté completa: la acción sigue incompleta hasta que COMPROBAR se completa, y eso lo
 * garantiza el motor —el estado categórico solo cambia con evidencia nueva—, no esta etiqueta.
 */
export function phaseLabel(placement: ActionPlacement): string | undefined {
  if (placement.steps < 2) return undefined;
  return placement.stepIndex === 1 ? 'Primero, reaprender' : 'Ahora, comprobar';
}
