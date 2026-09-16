import type {
  AttemptOutcome,
  AttemptRow,
  ConceptVector,
  ConfidenceCells,
  EngineInput,
  ErrorPattern,
  ExposureRow,
} from './types';
import { CONFIDENCE_LEVELS, ERROR_PATTERN_RECURRENCE, MAX_CONFIDENCE_LEVEL } from './types';

/**
 * El pliegue de evidencia · contrato §5.
 *
 * Todo campo del vector es un **monoide conmutativo** sobre el conjunto de intentos
 * elegibles: suma, unión de conjuntos, mínimo, máximo y máximo-por-clave. De ahí se sigue
 * que el resultado no depende del orden de proceso ni del tamaño del lote, y por eso el
 * rebuild coincide con el incremental **por construcción**.
 *
 * Eso hace el gate de EC-006 **tratable**; no exime de probarlo, y no se ha eximido.
 */

/** Resultado de la elegibilidad de un intento (contrato §5.1). */
export type Eligibility =
  | { readonly kind: 'ELIGIBLE'; readonly conceptId: string }
  | { readonly kind: 'DIAGNOSTIC' }
  | { readonly kind: 'UNATTRIBUTED' }
  | { readonly kind: 'BEYOND_WATERMARK' };

/**
 * Las cuatro condiciones del contrato §5.1, en su orden literal.
 *
 * Ninguna rama descarta evidencia en silencio: quien no entra al vector se contabiliza.
 */
export function classifyAttempt(
  attempt: AttemptRow,
  input: Pick<EngineInput, 'eventWatermark' | 'attribution'>,
): Eligibility {
  if (attempt.diagnosticRunId !== null) return { kind: 'DIAGNOSTIC' };
  if (attempt.streamPosition > input.eventWatermark) return { kind: 'BEYOND_WATERMARK' };
  const conceptId = input.attribution.primaryConceptByQuestion.get(attempt.questionId);
  if (conceptId === undefined) return { kind: 'UNATTRIBUTED' };
  return { kind: 'ELIGIBLE', conceptId };
}

/**
 * Anomalía de reloj (contrato §8), con dos límites **derivables** y ninguna tolerancia
 * elegida:
 *
 *   - adelantado: el servidor no puede recibir un hecho antes de que ocurra;
 *   - anterior a la cuenta: no hay evidencia de un aprendiz antes de que exista.
 *
 * Una fecha simplemente vieja es evidencia offline legítima y se acepta sin juicio.
 */
export function isTemporallyAnomalous(attempt: AttemptRow, accountCreatedAt: string): boolean {
  const fact = Date.parse(attempt.clientCreatedAt);
  const received = Date.parse(attempt.serverReceivedAt);
  const account = Date.parse(accountCreatedAt);
  if (!Number.isFinite(fact)) return true;
  if (Number.isFinite(received) && fact > received) return true;
  if (Number.isFinite(account) && fact < account) return true;
  return false;
}

/** El resultado de un intento. El blanco nunca es correcto (restricción de esquema). */
export function outcomeOf(attempt: AttemptRow): AttemptOutcome {
  if (attempt.answerKind === 'BLANK') return 'BLANK';
  return attempt.isCorrect ? 'CORRECT' : 'INCORRECT';
}

/** Acumulador interno de un concepto. No se persiste: es el andamio del pliegue. */
interface ConceptAccumulator {
  eligibleAttemptCount: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  unratedCount: number;
  temporalAnomalyCount: number;
  exposureViewedCount: number;
  exposureCompletedCount: number;
  readonly questions: Set<string>;
  readonly representations: Set<string>;
  readonly sessions: Set<string>;
  readonly everCorrect: Set<string>;
  readonly everIncorrect: Set<string>;
  /** Último resultado por pregunta, resuelto por `stream_position` (orden total sin empates). */
  readonly latest: Map<string, { position: number; outcome: AttemptOutcome }>;
  readonly correctCells: Map<number, number>;
  readonly incorrectCells: Map<number, number>;
  firstEvidenceAt: string | null;
  latestEvidenceAt: string | null;
}

function emptyAccumulator(): ConceptAccumulator {
  return {
    eligibleAttemptCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    blankCount: 0,
    unratedCount: 0,
    temporalAnomalyCount: 0,
    exposureViewedCount: 0,
    exposureCompletedCount: 0,
    questions: new Set(),
    representations: new Set(),
    sessions: new Set(),
    everCorrect: new Set(),
    everIncorrect: new Set(),
    latest: new Map(),
    correctCells: new Map(),
    incorrectCells: new Map(),
    firstEvidenceAt: null,
    latestEvidenceAt: null,
  };
}

function accumulate(
  accumulator: ConceptAccumulator,
  attempt: AttemptRow,
  accountCreatedAt: string,
): void {
  const outcome = outcomeOf(attempt);
  accumulator.eligibleAttemptCount += 1;
  accumulator.questions.add(attempt.questionId);
  accumulator.representations.add(attempt.representationId);
  accumulator.sessions.add(attempt.sessionId);

  if (outcome === 'CORRECT') {
    accumulator.correctCount += 1;
    accumulator.everCorrect.add(attempt.questionId);
  } else {
    // El blanco es evidencia explícita y nunca es correcto; entra en «alguna vez incorrecta»
    // junto al fallo, tal como define el contrato §5.2.
    if (outcome === 'BLANK') accumulator.blankCount += 1;
    else accumulator.incorrectCount += 1;
    accumulator.everIncorrect.add(attempt.questionId);
  }

  const previous = accumulator.latest.get(attempt.questionId);
  if (previous === undefined || attempt.streamPosition > previous.position) {
    accumulator.latest.set(attempt.questionId, { position: attempt.streamPosition, outcome });
  }

  const level = attempt.confidenceValue;
  if (level === null || !CONFIDENCE_LEVELS.includes(level as (typeof CONFIDENCE_LEVELS)[number])) {
    accumulator.unratedCount += 1;
  } else {
    const cells = outcome === 'CORRECT' ? accumulator.correctCells : accumulator.incorrectCells;
    cells.set(level, (cells.get(level) ?? 0) + 1);
  }

  if (isTemporallyAnomalous(attempt, accountCreatedAt)) {
    accumulator.temporalAnomalyCount += 1;
    return;
  }
  // Solo la evidencia con reloj no anómalo define el primero y el último hecho conocido.
  const fact = attempt.clientCreatedAt;
  if (accumulator.firstEvidenceAt === null || fact < accumulator.firstEvidenceAt) {
    accumulator.firstEvidenceAt = fact;
  }
  if (accumulator.latestEvidenceAt === null || fact > accumulator.latestEvidenceAt) {
    accumulator.latestEvidenceAt = fact;
  }
}

function cellsOf(counts: ReadonlyMap<number, number>): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const level of CONFIDENCE_LEVELS) result[String(level)] = counts.get(level) ?? 0;
  return result;
}

function vectorOf(accumulator: ConceptAccumulator): ConceptVector {
  let latestCorrect = 0;
  let latestIncorrect = 0;
  for (const { outcome } of accumulator.latest.values()) {
    if (outcome === 'CORRECT') latestCorrect += 1;
    else latestIncorrect += 1;
  }

  return {
    eligibleAttemptCount: accumulator.eligibleAttemptCount,
    distinctQuestionCount: accumulator.questions.size,
    distinctRepresentationCount: accumulator.representations.size,
    distinctSessionCount: accumulator.sessions.size,
    correctCount: accumulator.correctCount,
    incorrectCount: accumulator.incorrectCount,
    blankCount: accumulator.blankCount,
    distinctQuestionsEverCorrect: accumulator.everCorrect.size,
    distinctQuestionsEverIncorrect: accumulator.everIncorrect.size,
    distinctQuestionsLatestCorrect: latestCorrect,
    distinctQuestionsLatestIncorrect: latestIncorrect,
    confidenceCells: {
      correct: cellsOf(accumulator.correctCells),
      incorrect: cellsOf(accumulator.incorrectCells),
    } as ConfidenceCells,
    unratedCount: accumulator.unratedCount,
    firstEvidenceAt: accumulator.firstEvidenceAt,
    latestEvidenceAt: accumulator.latestEvidenceAt,
    temporalAnomalyCount: accumulator.temporalAnomalyCount,
    exposureViewedCount: accumulator.exposureViewedCount,
    exposureCompletedCount: accumulator.exposureCompletedCount,
  };
}

/**
 * Patrones de error de un concepto · contrato §17.
 *
 * Se derivan del **mismo pliegue** que el vector, no de un estado acumulado aparte: por eso
 * un patrón se cierra solo cuando el aprendiz vuelve a acertar, sin ninguna regla de
 * caducidad inventada. La resolución se expresa por **ausencia** de la fila; persistir un
 * `RESOLVED` haría la proyección dependiente del camino y rompería EC-006.
 */
function patternsOf(conceptId: string, accumulator: ConceptAccumulator): ErrorPattern[] {
  let latestIncorrect = 0;
  let latestBlank = 0;
  for (const { outcome } of accumulator.latest.values()) {
    if (outcome === 'INCORRECT') latestIncorrect += 1;
    else if (outcome === 'BLANK') latestBlank += 1;
  }
  const maxConfidenceIncorrect = accumulator.incorrectCells.get(MAX_CONFIDENCE_LEVEL) ?? 0;

  const patterns: ErrorPattern[] = [];
  if (latestIncorrect >= ERROR_PATTERN_RECURRENCE) {
    patterns.push({
      conceptId,
      patternType: 'RECURRENT_INCORRECT',
      evidenceCount: latestIncorrect,
    });
  }
  if (latestBlank >= ERROR_PATTERN_RECURRENCE) {
    patterns.push({ conceptId, patternType: 'RECURRENT_BLANK', evidenceCount: latestBlank });
  }
  if (maxConfidenceIncorrect >= ERROR_PATTERN_RECURRENCE) {
    patterns.push({
      conceptId,
      patternType: 'MAX_CONFIDENCE_INCORRECT',
      evidenceCount: maxConfidenceIncorrect,
    });
  }
  return patterns;
}

export interface FoldOutcome {
  readonly vectors: ReadonlyMap<string, ConceptVector>;
  readonly patterns: readonly ErrorPattern[];
  readonly unattributedAttemptCount: number;
  readonly diagnosticAttemptCount: number;
  readonly attemptsFolded: number;
}

/** Pliega toda la evidencia elegible de un aprendiz en vectores por concepto. */
export function foldEvidence(input: EngineInput): FoldOutcome {
  const accumulators = new Map<string, ConceptAccumulator>();
  const of = (conceptId: string): ConceptAccumulator => {
    let accumulator = accumulators.get(conceptId);
    if (accumulator === undefined) {
      accumulator = emptyAccumulator();
      accumulators.set(conceptId, accumulator);
    }
    return accumulator;
  };

  let unattributed = 0;
  let diagnostic = 0;
  let folded = 0;

  for (const attempt of input.attempts) {
    const eligibility = classifyAttempt(attempt, input);
    switch (eligibility.kind) {
      case 'DIAGNOSTIC':
        diagnostic += 1;
        break;
      case 'UNATTRIBUTED':
        unattributed += 1;
        break;
      case 'BEYOND_WATERMARK':
        break;
      case 'ELIGIBLE':
        folded += 1;
        accumulate(of(eligibility.conceptId), attempt, input.accountCreatedAt);
        break;
    }
  }

  for (const exposure of input.exposures) {
    if (exposure.streamPosition > input.eventWatermark) continue;
    const accumulator = of(exposure.conceptId);
    if (exposure.eventType === 'LEARNING_UNIT_COMPLETED') accumulator.exposureCompletedCount += 1;
    else accumulator.exposureViewedCount += 1;
  }

  const vectors = new Map<string, ConceptVector>();
  const patterns: ErrorPattern[] = [];
  for (const conceptId of [...accumulators.keys()].sort()) {
    const accumulator = accumulators.get(conceptId) as ConceptAccumulator;
    vectors.set(conceptId, vectorOf(accumulator));
    patterns.push(...patternsOf(conceptId, accumulator));
  }
  patterns.sort(
    (a, b) => a.conceptId.localeCompare(b.conceptId) || a.patternType.localeCompare(b.patternType),
  );

  return {
    vectors,
    patterns,
    unattributedAttemptCount: unattributed,
    diagnosticAttemptCount: diagnostic,
    attemptsFolded: folded,
  };
}

/** Reexportado para las pruebas: el pliegue de exposición ignora lo posterior al watermark. */
export type { ExposureRow };
