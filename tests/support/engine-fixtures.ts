import { canonicalText } from '@study-os/domain';
import {
  canonicalProjection,
  decideRunMode,
  historyReasonOf,
  runEngine,
  type AttemptRow,
  type AttributionSnapshot,
  type EngineResult,
  type ExposureRow,
} from '@study-os/learning-engine';

import { one, query } from './sql';

/**
 * Arnés del Learning Engine contra una base real.
 *
 * **Por SQL directo, y no por el Data API.** El esquema `engine` no está expuesto
 * (ADR-011 anexo v1.1), de modo que PostgREST responde `PGRST106 · Invalid schema` a
 * cualquier intento —incluido el del rol de servicio—. Esa negativa es el invariante, no un
 * obstáculo: la misma disciplina que ya usan las pruebas de `content` e `ingest`.
 *
 * Reproduce lo que hace el servidor —leer con `engine.evidence_snapshot`, calcular con el
 * paquete puro, persistir con la RPC atómica— sin importar el módulo de `apps/web`, que es
 * `server-only` y no debe cargarse en un proceso de pruebas.
 */

/** Literal SQL de una cadena. Duplicar la comilla es el escape del propio SQL. */
export function sqlText(value: string): string {
  return `'${value.split("'").join("''")}'`;
}

/** Literal SQL de un documento JSON. */
export function sqlJson(value: unknown): string {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

export interface EvidenceSnapshot {
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

export function evidenceSnapshot(userId: string): EvidenceSnapshot {
  const row = one<{ snapshot: EvidenceSnapshot }>(
    `select engine.evidence_snapshot(${sqlText(userId)}::uuid) as snapshot`,
  );
  return row.snapshot;
}

export function attributionSnapshot(packVersionId: string): AttributionSnapshot {
  const rows = query<{ generation: number; question_id: string; concept_id: string }>(
    `select * from ingest.attribution_snapshot(${sqlText(packVersionId)}::uuid)`,
  );
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.question_id, row.concept_id);
  return {
    packVersionId,
    generation: Number(rows[0]?.generation ?? 1),
    primaryConceptByQuestion: map,
  };
}

export function activeConfigVersion(): string {
  return one<{ version: string }>(
    "select version from engine.engine_config where status = 'ACTIVE' limit 1",
  ).version;
}

/** Calcula la proyección que debería existir, sin escribir nada. */
export function computeFor(userId: string, watermarkOverride?: number): EngineResult {
  const snapshot = evidenceSnapshot(userId);
  if (!snapshot.packVersionId) throw new Error('el aprendiz no tiene objetivo activo');
  return runEngine({
    userId,
    accountCreatedAt: snapshot.accountCreatedAt ?? new Date(0).toISOString(),
    eventWatermark: watermarkOverride ?? Number(snapshot.maxPosition ?? 0),
    attempts: snapshot.attempts,
    exposures: snapshot.exposures,
    attribution: attributionSnapshot(snapshot.packVersionId),
    engineConfigVersion: activeConfigVersion(),
  });
}

export function payloadOf(result: EngineResult): Record<string, unknown> {
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

export interface ApplyOutcome {
  readonly ok: boolean;
  readonly message: string;
}

/** Aplica un payload arbitrario, devolviendo el rechazo en vez de lanzarlo. */
export function applyPayload(
  userId: string,
  payload: Record<string, unknown>,
  options: { rebuild?: boolean; fromPosition?: number; reason?: string } = {},
): ApplyOutcome {
  const reason = options.reason ?? (options.rebuild ? 'REBUILD' : 'INCREMENTAL');
  const call = options.rebuild
    ? `select engine.rebuild_projections(${sqlText(userId)}::uuid, ${sqlJson(payload)}, ${sqlText(reason)}::engine.projection_reason) as watermark`
    : `select engine.recalculate_mastery(${sqlText(userId)}::uuid, ${options.fromPosition ?? 0}, ${sqlJson(payload)}, ${sqlText(reason)}::engine.projection_reason) as watermark`;
  try {
    query(call);
    return { ok: true, message: '' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export interface AppliedRun {
  readonly mode: string;
  readonly watermark: number;
  readonly result: EngineResult;
}

/**
 * Un ciclo completo del motor, exactamente como lo haría el servidor.
 *
 * Devuelve también el modo elegido, porque distinguir «continuó» de «reconstruyó» es parte
 * de lo que hay que probar: una mutación de atribución no puede colarse como continuación.
 */
export function runCycle(userId: string, options: { forceRebuild?: boolean } = {}): AppliedRun {
  const snapshot = evidenceSnapshot(userId);
  if (!snapshot.packVersionId) throw new Error('el aprendiz no tiene objetivo activo');
  const attribution = attributionSnapshot(snapshot.packVersionId);
  const configVersion = activeConfigVersion();
  const consumed = Number(snapshot.watermark?.consumedPosition ?? 0);

  const mode = decideRunMode({
    stored:
      snapshot.watermark === null
        ? null
        : {
            consumedPosition: consumed,
            engineConfigVersion: snapshot.watermark.engineConfigVersion,
            attributionPackVersionId: snapshot.watermark.attributionPackVersionId,
            attributionGeneration: snapshot.watermark.attributionGeneration,
          },
    currentConfigVersion: configVersion,
    currentPackVersionId: snapshot.packVersionId,
    currentGeneration: attribution.generation,
    maxPosition: Number(snapshot.maxPosition ?? 0),
    forceRebuild: options.forceRebuild,
  });

  const result = runEngine({
    userId,
    accountCreatedAt: snapshot.accountCreatedAt ?? new Date(0).toISOString(),
    eventWatermark: Number(snapshot.maxPosition ?? 0),
    attempts: snapshot.attempts,
    exposures: snapshot.exposures,
    attribution,
    engineConfigVersion: configVersion,
  });

  if (mode.kind === 'UP_TO_DATE') {
    return { mode: 'UP_TO_DATE', watermark: mode.consumedPosition, result };
  }

  const applied = applyPayload(userId, payloadOf(result), {
    rebuild: mode.kind !== 'INCREMENTAL',
    fromPosition: mode.kind === 'INCREMENTAL' ? mode.fromPosition : 0,
    reason: historyReasonOf(mode),
  });
  if (!applied.ok) throw new Error(`persistencia: ${applied.message}`);
  return { mode: mode.kind, watermark: Number(result.eventWatermark), result };
}

/** La proyección **persistida**, en forma comparable con la calculada. */
export function persistedProjection(userId: string): string {
  const concepts = query<{
    concept_id: string;
    mastery_state: string;
    uncertainty: string;
    next_review_at: string | null;
    vector: Record<string, unknown>;
  }>(
    `select concept_id, mastery_state::text, uncertainty::text, next_review_at, vector
     from engine.concept_mastery where user_id = ${sqlText(userId)}::uuid order by concept_id`,
  );
  const patterns = query<{ concept_id: string; pattern_type: string; evidence_count: number }>(
    `select concept_id, pattern_type::text, evidence_count
     from engine.error_patterns where user_id = ${sqlText(userId)}::uuid
     order by concept_id, pattern_type`,
  );
  const counters = query<{ unattributed: number; diagnostic: number }>(
    `select unattributed_attempt_count as unattributed, diagnostic_attempt_count as diagnostic
     from engine.projection_watermarks
     where user_id = ${sqlText(userId)}::uuid and projection_name = 'concept_mastery'`,
  );

  // **Forma canónica CJF-1 en los dos lados.** `jsonb` no conserva el orden de claves: lo
  // reordena por longitud y bytes. Comparar con `JSON.stringify` haría fallar una igualdad
  // que sí se cumple, y esa es precisamente la razón por la que el contrato §15.4 exige
  // canonicalizar antes de afirmar «idéntica byte a byte».
  return canonicalText({
    concepts: concepts.map((row) => ({
      conceptId: row.concept_id,
      masteryState: row.mastery_state,
      uncertainty: row.uncertainty,
      nextReviewAt: row.next_review_at,
      vector: row.vector,
    })),
    errorPatterns: patterns.map((row) => ({
      conceptId: row.concept_id,
      patternType: row.pattern_type,
      evidenceCount: Number(row.evidence_count),
    })),
    unattributedAttemptCount: Number(counters[0]?.unattributed ?? 0),
    diagnosticAttemptCount: Number(counters[0]?.diagnostic ?? 0),
  });
}

/** La misma forma, calculada desde la evidencia: lo que el rebuild debería persistir. */
export function expectedProjection(result: EngineResult): string {
  return canonicalText({
    concepts: result.concepts.map((concept) => ({
      conceptId: concept.conceptId,
      masteryState: concept.masteryState,
      uncertainty: concept.uncertainty,
      nextReviewAt: concept.nextReviewAt,
      vector: concept.vector as unknown as Record<string, unknown>,
    })),
    errorPatterns: result.errorPatterns.map((pattern) => ({
      conceptId: pattern.conceptId,
      patternType: pattern.patternType,
      evidenceCount: pattern.evidenceCount,
    })),
    unattributedAttemptCount: result.unattributedAttemptCount,
    diagnosticAttemptCount: result.diagnosticAttemptCount,
  });
}

/** ¿Está la proyección de este aprendiz por detrás de su evidencia? */
export function isStale(userId: string): boolean {
  const rows = query<{ user_id: string }>(
    "select user_id from engine.stale_users('concept_mastery', 500)",
  );
  return rows.some((row) => row.user_id === userId);
}

export function watermarkOf(userId: string): number | null {
  const rows = query<{ consumed_position: number }>(
    `select consumed_position from engine.projection_watermarks
     where user_id = ${sqlText(userId)}::uuid and projection_name = 'concept_mastery'`,
  );
  const row = rows[0];
  return row ? Number(row.consumed_position) : null;
}

export { canonicalProjection };
