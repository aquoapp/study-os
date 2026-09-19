import { canonicalText } from '@study-os/domain';

import { compareCodePoints } from './plan';
import type { PlanDecision, PlannerInput } from './types';

/**
 * Forma canónica de la entrada. El orden de filas de la base no entra en ella: conceptos,
 * unidades y preguntas se ordenan por identidad y por punto de código, de modo que la misma
 * realidad da el mismo texto y el mismo hash (P4-G5).
 */
export function canonicalInput(input: PlannerInput): string {
  return canonicalText({
    ...input,
    concepts: [...input.concepts]
      .sort((a, b) => compareCodePoints(a.conceptId, b.conceptId))
      .map((concept) => ({
        ...concept,
        units: [...concept.units].sort((a, b) =>
          compareCodePoints(a.learningUnitId, b.learningUnitId),
        ),
        questions: [...concept.questions].sort((a, b) =>
          compareCodePoints(a.questionId, b.questionId),
        ),
      })),
  });
}

/** Forma canónica de la decisión: lo que la reproducción debe devolver byte a byte (P4-G4). */
export function canonicalDecision(decision: PlanDecision): string {
  return canonicalText(decision);
}

/** SHA-256 hex de los bytes UTF-8 de un texto canónico. */
export async function sha256OfText(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 del texto canónico de la entrada: identidad de idempotencia (§O). La base de datos
 * recalcula el mismo hash sobre el mismo texto y rechaza la fila si no coincide.
 */
export async function inputHash(input: PlannerInput): Promise<string> {
  return sha256OfText(canonicalInput(input));
}
