import type { ConceptVector, MasteryState, Uncertainty } from './types';

/**
 * La función de estado · contrato §9.1.
 *
 * **Total, exhaustiva, mutuamente excluyente y sin ningún parámetro libre.** No hay
 * transiciones: el estado es una función del vector y se recalcula, no se transita. Por eso
 * no aparece aquí «evidencia suficiente», «buen rendimiento» ni «dominio alto», y por eso
 * dos implementaciones independientes coinciden.
 *
 * Lo que esta función **no** puede leer, y no lee:
 *
 *   - confianza · la confianza calibra, no puntúa (terminología §10);
 *   - tiempo · el paso del tiempo por sí solo no baja el estado (contrato §8);
 *   - pesos ni umbrales · no existen en v1 (contrato §10);
 *   - evidencia de diagnóstico · excluida antes de llegar al vector (H-P3-10).
 */
export function deriveMasteryState(vector: ConceptVector): MasteryState {
  const eligible = vector.eligibleAttemptCount;
  const everCorrect = vector.distinctQuestionsEverCorrect;
  const everIncorrect = vector.distinctQuestionsEverIncorrect;

  if (eligible === 0) {
    return vector.exposureCompletedCount === 0 ? 'NEW' : 'EXPOSED';
  }
  if (everIncorrect === 0 && everCorrect > 0) return 'EVIDENCE_POSITIVE';
  if (everCorrect === 0) return 'EVIDENCE_NEGATIVE';
  return 'EVIDENCE_CONFLICTING';
}

/**
 * Incertidumbre categórica · contrato §11.
 *
 * Las cuatro distinciones son **límites de lo observable**, no umbrales elegidos: con una
 * sola observación no se puede observar consistencia, y con una sola pregunta no se puede
 * observar transferencia. Nunca se convierten en porcentaje.
 */
export function deriveUncertainty(vector: ConceptVector): Uncertainty {
  if (vector.eligibleAttemptCount === 0) return 'NO_EVIDENCE';
  if (vector.eligibleAttemptCount === 1) return 'SINGLE_OBSERVATION';
  if (vector.distinctQuestionCount === 1) return 'REPEATED_SAME_QUESTION';
  return 'MULTIPLE_QUESTIONS';
}
