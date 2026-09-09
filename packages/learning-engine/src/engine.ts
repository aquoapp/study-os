import { canonicalText } from '@study-os/domain';

import { ENGINE_VERSION } from './config';
import { foldEvidence } from './fold';
import { deriveMasteryState, deriveUncertainty } from './state';
import type { ConceptProjection, EngineInput, EngineResult } from './types';

/**
 * Ejecución del motor para **un** aprendiz · contrato §5, §9, §17.
 *
 * Determinista y sin red: solo aritmética sobre la evidencia recibida. La misma entrada
 * semántica declarada produce la misma salida, byte a byte, en cualquier máquina.
 */
export function runEngine(input: EngineInput): EngineResult {
  const folded = foldEvidence(input);

  const concepts: ConceptProjection[] = [];
  for (const [conceptId, vector] of folded.vectors) {
    concepts.push({
      conceptId,
      masteryState: deriveMasteryState(vector),
      uncertainty: deriveUncertainty(vector),
      vector,
      // `review_intervals` está sin fijar: no se programa ningún repaso (contrato §8).
      nextReviewAt: null,
    });
  }
  concepts.sort((a, b) => a.conceptId.localeCompare(b.conceptId));

  return {
    userId: input.userId,
    engineVersion: ENGINE_VERSION,
    engineConfigVersion: input.engineConfigVersion,
    attributionPackVersionId: input.attribution.packVersionId,
    attributionGeneration: input.attribution.generation,
    eventWatermark: input.eventWatermark,
    concepts,
    errorPatterns: folded.patterns,
    unattributedAttemptCount: folded.unattributedAttemptCount,
    diagnosticAttemptCount: folded.diagnosticAttemptCount,
    attemptsFolded: folded.attemptsFolded,
  };
}

/**
 * Forma canónica del resultado · SD-022 / CJF-1.
 *
 * Sin ella, «idéntica byte a byte» no significaría nada: dos motores correctos podrían
 * diferir solo en el orden de las claves de un objeto.
 */
export function canonicalResult(result: EngineResult): string {
  return canonicalText({
    userId: result.userId,
    engineVersion: result.engineVersion,
    engineConfigVersion: result.engineConfigVersion,
    attributionPackVersionId: result.attributionPackVersionId,
    attributionGeneration: result.attributionGeneration,
    eventWatermark: result.eventWatermark,
    unattributedAttemptCount: result.unattributedAttemptCount,
    diagnosticAttemptCount: result.diagnosticAttemptCount,
    concepts: result.concepts.map((concept) => ({
      conceptId: concept.conceptId,
      masteryState: concept.masteryState,
      uncertainty: concept.uncertainty,
      nextReviewAt: concept.nextReviewAt,
      vector: concept.vector,
    })),
    errorPatterns: result.errorPatterns,
  });
}

/**
 * La proyección canónica que el gate de EC-006 compara.
 *
 * **No incluye el historial**: `mastery_history` registra *ejecuciones*, y un rebuild es una
 * ejecución distinta de la serie de incrementos que llega al mismo watermark. Lo que debe
 * coincidir es el estado derivado, y es lo que se compara.
 */
export function canonicalProjection(result: EngineResult): string {
  return canonicalText({
    concepts: result.concepts.map((concept) => ({
      conceptId: concept.conceptId,
      masteryState: concept.masteryState,
      uncertainty: concept.uncertainty,
      nextReviewAt: concept.nextReviewAt,
      vector: concept.vector,
    })),
    errorPatterns: result.errorPatterns,
    unattributedAttemptCount: result.unattributedAttemptCount,
    diagnosticAttemptCount: result.diagnosticAttemptCount,
  });
}
