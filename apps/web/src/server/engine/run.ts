import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canonicalProjection,
  runEngine,
  type AttemptRow,
  type AttributionSnapshot,
  type EngineResult,
  type ExposureRow,
} from '@study-os/learning-engine';

import { tryCreateEngineClient } from './admin';

/**
 * Ejecución del Learning Engine para un aprendiz.
 *
 * Reparto de responsabilidades, y es deliberado:
 *
 *   - **leer** evidencia y semántica de atribución: una sola función de servidor
 *     (`engine.evidence_snapshot`), en un esquema no expuesto. La aplicación **no** decide a
 *     quién pertenece qué con un filtro por `user_id`: eso lo resuelve el servidor;
 *   - **calcular**: `@study-os/learning-engine`, determinista y sin red;
 *   - **persistir**: una función `SECURITY DEFINER` que escribe proyección, historial y
 *     watermark en la misma transacción.
 *
 * Ninguna de las tres puede corromper la evidencia: es inmutable y ya está aceptada.
 */

export type EngineOutcome =
  | { readonly kind: 'APPLIED'; readonly watermark: number; readonly rebuilt: boolean }
  | { readonly kind: 'UP_TO_DATE'; readonly watermark: number }
  | { readonly kind: 'SKIPPED'; readonly reason: string };

interface EvidenceSnapshot {
  readonly accountCreatedAt: string | null;
  readonly maxPosition: number;
  readonly packVersionId: string | null;
  readonly watermark: {
    readonly consumedPosition: number;
    readonly engineVersion: string | null;
    readonly engineConfigVersion: string | null;
    readonly attributionPackVersionId: string | null;
    readonly attributionGeneration: number | null;
  } | null;
  readonly attempts: readonly AttemptRow[];
  readonly exposures: readonly ExposureRow[];
}

/** La semántica de atribución **declarada**: solo `PRIMARY` `VALIDATED`, con su generación. */
async function readAttribution(
  supabase: SupabaseClient,
  packVersionId: string,
): Promise<AttributionSnapshot> {
  const snapshot = await supabase
    .schema('ingest')
    .rpc('attribution_snapshot', { p_exam_pack_version_id: packVersionId });
  if (snapshot.error) throw new Error(`semántica de atribución: ${snapshot.error.message}`);
  const rows = (snapshot.data ?? []) as Array<{
    generation: number;
    question_id: string;
    concept_id: string;
  }>;
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.question_id, row.concept_id);
  return {
    packVersionId,
    generation: Number(rows[0]?.generation ?? 1),
    primaryConceptByQuestion: map,
  };
}

function payloadOf(result: EngineResult): Record<string, unknown> {
  return {
    engineVersion: result.engineVersion,
    engineConfigVersion: result.engineConfigVersion,
    attributionPackVersionId: result.attributionPackVersionId,
    attributionGeneration: result.attributionGeneration,
    eventWatermark: result.eventWatermark,
    unattributedAttemptCount: result.unattributedAttemptCount,
    diagnosticAttemptCount: result.diagnosticAttemptCount,
    attemptsFolded: result.attemptsFolded,
    concepts: result.concepts.map((concept) => ({
      conceptId: concept.conceptId,
      masteryState: concept.masteryState,
      uncertainty: concept.uncertainty,
      vector: concept.vector,
    })),
    errorPatterns: result.errorPatterns.map((pattern) => ({
      conceptId: pattern.conceptId,
      patternType: pattern.patternType,
      evidenceCount: pattern.evidenceCount,
    })),
  };
}

/**
 * Calcula y persiste la proyección de un aprendiz hasta la última evidencia aceptada.
 *
 * Elige entre incremental y rebuild por una regla mecánica: si la **tupla semántica
 * declarada** que guarda el watermark difiere de la actual —versión de motor, de
 * configuración, de pack o generación de atribución—, la fila está obsoleta y no se continúa
 * sobre ella. Una mutación de atribución nunca es una continuación incremental ordinaria.
 */
export async function runEngineForUser(
  userId: string,
  options: { readonly forceRebuild?: boolean; readonly client?: SupabaseClient } = {},
): Promise<EngineOutcome> {
  const supabase = options.client ?? tryCreateEngineClient();
  if (!supabase) return { kind: 'SKIPPED', reason: 'SIN_CONFIGURACION_DE_SERVIDOR' };

  const activeConfig = await supabase
    .schema('engine')
    .from('engine_config')
    .select('version')
    .eq('status', 'ACTIVE')
    .limit(1);
  if (activeConfig.error) throw new Error(`engine_config: ${activeConfig.error.message}`);
  const configVersion = (activeConfig.data?.[0] as { version: string } | undefined)?.version;
  if (!configVersion) return { kind: 'SKIPPED', reason: 'SIN_CONFIGURACION_ACTIVA' };

  const snapshotCall = await supabase
    .schema('engine')
    .rpc('evidence_snapshot', { p_user_id: userId });
  if (snapshotCall.error) throw new Error(`evidencia: ${snapshotCall.error.message}`);
  const snapshot = snapshotCall.data as EvidenceSnapshot;

  if (!snapshot.packVersionId) return { kind: 'SKIPPED', reason: 'SIN_OBJETIVO_ACTIVO' };
  if (!snapshot.accountCreatedAt) return { kind: 'SKIPPED', reason: 'SIN_PERFIL' };

  const attribution = await readAttribution(supabase, snapshot.packVersionId);
  const watermark = snapshot.watermark;
  const consumed = Number(watermark?.consumedPosition ?? 0);
  const maxPosition = Number(snapshot.maxPosition ?? 0);

  const semanticsChanged =
    watermark !== null &&
    (watermark.engineConfigVersion !== configVersion ||
      watermark.attributionPackVersionId !== snapshot.packVersionId ||
      Number(watermark.attributionGeneration) !== attribution.generation);

  if (!options.forceRebuild && !semanticsChanged && maxPosition <= consumed) {
    return { kind: 'UP_TO_DATE', watermark: consumed };
  }

  const result = runEngine({
    userId,
    accountCreatedAt: snapshot.accountCreatedAt,
    eventWatermark: maxPosition,
    attempts: snapshot.attempts,
    exposures: snapshot.exposures,
    attribution,
    engineConfigVersion: configVersion,
  });

  const rebuild = options.forceRebuild === true || semanticsChanged || watermark === null;
  const reason = semanticsChanged
    ? 'RECALCULATION_ATTRIBUTION_CHANGED'
    : rebuild
      ? 'REBUILD'
      : 'INCREMENTAL';

  const applied = rebuild
    ? await supabase.schema('engine').rpc('rebuild_projections', {
        p_user_id: userId,
        p_payload: payloadOf(result),
        p_reason: reason,
      })
    : await supabase.schema('engine').rpc('recalculate_mastery', {
        p_user_id: userId,
        p_from_position: consumed,
        p_payload: payloadOf(result),
        p_reason: reason,
      });
  if (applied.error) throw new Error(`persistencia de la proyección: ${applied.error.message}`);

  return { kind: 'APPLIED', watermark: Number(applied.data), rebuilt: rebuild };
}

/**
 * Calcula sin persistir: la proyección que **debería** existir para un aprendiz.
 *
 * Es la mitad honesta del gate de EC-006: permite comparar lo persistido tras una serie de
 * incrementos con lo que produce un pliegue completo, sin escribir nada por el camino.
 */
export async function computeProjection(
  userId: string,
  client: SupabaseClient,
  watermarkOverride?: number,
): Promise<EngineResult | null> {
  const activeConfig = await client
    .schema('engine')
    .from('engine_config')
    .select('version')
    .eq('status', 'ACTIVE')
    .limit(1);
  if (activeConfig.error) throw new Error(`engine_config: ${activeConfig.error.message}`);
  const configVersion = (activeConfig.data?.[0] as { version: string } | undefined)?.version;
  if (!configVersion) return null;

  const snapshotCall = await client
    .schema('engine')
    .rpc('evidence_snapshot', { p_user_id: userId });
  if (snapshotCall.error) throw new Error(`evidencia: ${snapshotCall.error.message}`);
  const snapshot = snapshotCall.data as EvidenceSnapshot;
  if (!snapshot.packVersionId || !snapshot.accountCreatedAt) return null;

  const attribution = await readAttribution(client, snapshot.packVersionId);
  return runEngine({
    userId,
    accountCreatedAt: snapshot.accountCreatedAt,
    eventWatermark: watermarkOverride ?? Number(snapshot.maxPosition ?? 0),
    attempts: snapshot.attempts,
    exposures: snapshot.exposures,
    attribution,
    engineConfigVersion: configVersion,
  });
}

/** La forma canónica de la proyección calculada, para comparar incremental contra rebuild. */
export function projectionSignature(result: EngineResult): string {
  return canonicalProjection(result);
}
