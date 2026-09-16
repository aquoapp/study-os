/**
 * Tipos del Learning Engine v1 · `docs/LEARNING_ENGINE_CONTRACT.md`.
 *
 * Todo lo que aquí se declara es **observación**, nunca estimación. No existe ninguna
 * puntuación numérica de dominio, ningún peso y ningún parámetro temporal: si un campo
 * pareciera admitirlos, el contrato está mal leído.
 */

/** Estados categóricos autoritativos de v1 (contrato §9.1). */
export const V1_MASTERY_STATES = [
  'NEW',
  'EXPOSED',
  'EVIDENCE_POSITIVE',
  'EVIDENCE_NEGATIVE',
  'EVIDENCE_CONFLICTING',
] as const;
export type MasteryState = (typeof V1_MASTERY_STATES)[number];

/**
 * Vocabulario heredado, **reservado y no alcanzable** en v1 (contrato §9.2).
 * Se declara para que la prohibición sea comprobable, no para usarlo.
 */
export const RESERVED_MASTERY_STATES = ['LEARNING', 'CONSOLIDATING', 'MASTERED', 'STRONG'] as const;
export type ReservedMasteryState = (typeof RESERVED_MASTERY_STATES)[number];

/** Incertidumbre categórica (contrato §11). Ninguna de las cuatro es un umbral elegido. */
export const V1_UNCERTAINTY = [
  'NO_EVIDENCE',
  'SINGLE_OBSERVATION',
  'REPEATED_SAME_QUESTION',
  'MULTIPLE_QUESTIONS',
] as const;
export type Uncertainty = (typeof V1_UNCERTAINTY)[number];

/** Taxonomía estructural de patrones de error (contrato §17). Sin semántica de concepción errónea. */
export const V1_ERROR_PATTERN_TYPES = [
  'RECURRENT_INCORRECT',
  'RECURRENT_BLANK',
  'MAX_CONFIDENCE_INCORRECT',
] as const;
export type ErrorPatternType = (typeof V1_ERROR_PATTERN_TYPES)[number];

/**
 * Recuento de recurrencia.
 *
 * **Autoridad citada, no elegida:** `spec/acceptance-matrix.md` §D, fila REQ-D06 —
 * «Tres fallos del mismo tipo crean un `error_pattern` activo»— artefacto aceptado de
 * Phase −1, importado sin editar y verificado por hash en `docs/PROVENANCE.md` §2.
 * Es una **regla de producto de activación de patrón**, no una constante científica del
 * aprendizaje, y no se generaliza a ningún otro uso.
 */
export const ERROR_PATTERN_RECURRENCE = 3;

/** Nivel máximo de la escala de confianza `v1` (SD-008). Extremo declarado, no punto de corte. */
export const MAX_CONFIDENCE_LEVEL = 4;

/** Niveles de la escala de confianza `v1`. */
export const CONFIDENCE_LEVELS = [1, 2, 3, 4] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Resultado de un intento. Tres salidas mutuamente excluyentes; el blanco nunca es correcto. */
export type AttemptOutcome = 'CORRECT' | 'INCORRECT' | 'BLANK';

/**
 * Una fila de `public.question_attempts` tal como la lee el motor.
 *
 * Se pasa **sin filtrar**: la elegibilidad es parte del contrato y por tanto del motor,
 * no de la consulta, para que se pueda probar sin base de datos.
 */
export interface AttemptRow {
  readonly attemptId: string;
  readonly questionId: string;
  readonly representationId: string;
  readonly sessionId: string;
  readonly diagnosticRunId: string | null;
  readonly streamPosition: number;
  readonly isCorrect: boolean;
  readonly answerKind: 'OPTION' | 'BLANK';
  readonly confidenceValue: number | null;
  readonly clientCreatedAt: string;
  readonly serverReceivedAt: string;
}

/** Exposición a una unidad de aprendizaje, atribuida por `learning_units.concept_id`. */
export interface ExposureRow {
  readonly conceptId: string;
  readonly eventType: 'LEARNING_UNIT_VIEWED' | 'LEARNING_UNIT_COMPLETED';
  readonly streamPosition: number;
}

/**
 * Semántica de atribución **declarada** (contrato §13). No se infiere de «lo que hay ahora»:
 * es una entrada de la computación y viaja con la proyección.
 */
export interface AttributionSnapshot {
  readonly packVersionId: string;
  readonly generation: number;
  /** `question_id` → `concept_id` del único mapeo `PRIMARY` + `VALIDATED` de esa versión. */
  readonly primaryConceptByQuestion: ReadonlyMap<string, string>;
}

/** Entrada completa de una ejecución del motor para **un** aprendiz. */
export interface EngineInput {
  readonly userId: string;
  /** Momento de creación de la cuenta: límite inferior lógico del tiempo del hecho. */
  readonly accountCreatedAt: string;
  /** Hasta qué posición del stream se declara procesada la evidencia. */
  readonly eventWatermark: number;
  readonly attempts: readonly AttemptRow[];
  readonly exposures: readonly ExposureRow[];
  readonly attribution: AttributionSnapshot;
  readonly engineConfigVersion: string;
}

/** Ocho celdas de calibración: correcto/incorrecto × niveles 1…4. Sin punto de corte. */
export interface ConfidenceCells {
  readonly correct: Readonly<Record<`${ConfidenceLevel}`, number>>;
  readonly incorrect: Readonly<Record<`${ConfidenceLevel}`, number>>;
}

/**
 * Vector de evidencia de un concepto (contrato §5.2).
 *
 * **Exactamente** los campos aprobados. Añadir uno sería ampliar la autoridad del motor
 * sin gobernanza; quitarlo, perder evidencia.
 */
export interface ConceptVector {
  readonly eligibleAttemptCount: number;
  readonly distinctQuestionCount: number;
  readonly distinctRepresentationCount: number;
  readonly distinctSessionCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly blankCount: number;
  readonly distinctQuestionsEverCorrect: number;
  readonly distinctQuestionsEverIncorrect: number;
  readonly distinctQuestionsLatestCorrect: number;
  readonly distinctQuestionsLatestIncorrect: number;
  readonly confidenceCells: ConfidenceCells;
  readonly unratedCount: number;
  readonly firstEvidenceAt: string | null;
  readonly latestEvidenceAt: string | null;
  readonly temporalAnomalyCount: number;
  readonly exposureViewedCount: number;
  readonly exposureCompletedCount: number;
}

/** Proyección de un concepto: vector + estado derivado. */
export interface ConceptProjection {
  readonly conceptId: string;
  readonly masteryState: MasteryState;
  readonly uncertainty: Uncertainty;
  readonly vector: ConceptVector;
  /** `NULL` mientras `review_intervals` esté sin fijar (contrato §8). */
  readonly nextReviewAt: null;
}

/** Patrón de error activo. Derivado, no acumulado: se recalcula desde la evidencia. */
export interface ErrorPattern {
  readonly conceptId: string;
  readonly patternType: ErrorPatternType;
  readonly evidenceCount: number;
}

/** Resultado completo de una ejecución. Determinista y ordenado. */
export interface EngineResult {
  readonly userId: string;
  readonly engineVersion: string;
  readonly engineConfigVersion: string;
  readonly attributionPackVersionId: string;
  readonly attributionGeneration: number;
  readonly eventWatermark: number;
  readonly concepts: readonly ConceptProjection[];
  readonly errorPatterns: readonly ErrorPattern[];
  /** Evidencia elegible por lo demás que ningún mapeo `PRIMARY` `VALIDATED` atribuye. */
  readonly unattributedAttemptCount: number;
  /** Intentos de diagnóstico: evidencia inmutable, **excluida** del estado autoritativo (H-P3-10). */
  readonly diagnosticAttemptCount: number;
  /** Intentos elegibles plegados, para auditoría. */
  readonly attemptsFolded: number;
}
