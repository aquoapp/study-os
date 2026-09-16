import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  ACTIVE_DIMENSIONS,
  ENGINE_VERSION,
  EngineConfigError,
  INACTIVE_DIMENSIONS,
  UNSET_POLICY_SLOTS,
  assertEngineConfigV1,
  canonicalResult,
  runEngine,
  type AttemptRow,
  type EngineInput,
} from '@study-os/learning-engine';

/**
 * `engine.golden.spec` · REQ-D02 (dataset golden) · REQ-D08 (`engine_config`) · REQ-D09 (sin red).
 *
 * El dataset golden está escrito a mano y su huella también: si el motor cambia de resultado
 * sin que nadie cambie el contrato, esta prueba lo dice antes que ninguna otra. Cambiar la
 * huella exige cambiar la semántica **a propósito**, y eso deja rastro en el diff.
 */

const PACK_VERSION = 'cccccccc-0000-4000-8000-000000000001';
const CONCEPT_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const CONCEPT_B = 'aaaaaaaa-0000-4000-8000-000000000002';

const GOLDEN_INPUT: EngineInput = {
  userId: 'golden-learner',
  accountCreatedAt: '2026-01-01T00:00:00.000Z',
  eventWatermark: 9,
  attribution: {
    packVersionId: PACK_VERSION,
    generation: 3,
    primaryConceptByQuestion: new Map([
      ['q-1', CONCEPT_A],
      ['q-2', CONCEPT_A],
      ['q-3', CONCEPT_A],
      ['q-4', CONCEPT_B],
    ]),
  },
  engineConfigVersion: 'v1',
  exposures: [
    { conceptId: CONCEPT_B, eventType: 'LEARNING_UNIT_VIEWED', streamPosition: 1 },
    { conceptId: CONCEPT_B, eventType: 'LEARNING_UNIT_COMPLETED', streamPosition: 2 },
  ],
  attempts: [
    golden('a1', 'q-1', 3, { correct: true, confidence: 1 }),
    golden('a2', 'q-1', 4, { correct: false, confidence: 4 }),
    golden('a3', 'q-2', 5, { correct: true, confidence: 3 }),
    golden('a4', 'q-3', 6, { blank: true }),
    golden('a5', 'q-4', 7, { correct: true, confidence: 2, session: 'session-2' }),
    golden('a6', 'q-2', 8, { correct: true, confidence: 4, diagnostic: true }),
    golden('a7', 'q-unmapped', 9, { correct: false, confidence: 2 }),
  ],
};

function golden(
  id: string,
  questionId: string,
  position: number,
  options: {
    correct?: boolean;
    blank?: boolean;
    confidence?: number;
    session?: string;
    diagnostic?: boolean;
  },
): AttemptRow {
  return {
    attemptId: id,
    questionId,
    representationId: `rep-${questionId}`,
    sessionId: options.session ?? 'session-1',
    diagnosticRunId: options.diagnostic ? 'diagnostic-1' : null,
    streamPosition: position,
    isCorrect: options.correct === true,
    answerKind: options.blank === true ? 'BLANK' : 'OPTION',
    confidenceValue: options.blank === true ? null : (options.confidence ?? 3),
    clientCreatedAt: `2026-02-0${position}T09:00:00.000Z`,
    serverReceivedAt: '2026-03-01T09:00:00.000Z',
  };
}

/**
 * Huella del resultado canónico del dataset golden.
 *
 * Se calcula sobre la forma canónica CJF-1, de modo que no depende del orden de claves de
 * ningún objeto ni del entorno de ejecución.
 *
 * La huella **no** es la prueba: lo son las aserciones semánticas de más abajo, que dicen
 * qué debe salir y por qué. Esta línea fija ese resultado ya verificado para que un cambio
 * futuro de semántica tenga que ser deliberado y quede a la vista en el diff.
 */
const GOLDEN_SHA256 = 'd4da1253a34919cda4c98da2175ec1bccd1c1b7910269571014653974dba4efe';

describe('REQ-D02 · dataset golden', () => {
  const result = runEngine(GOLDEN_INPUT);

  it('la evidencia se reparte exactamente como el contrato manda', () => {
    expect(result.attemptsFolded).toBe(5);
    expect(result.diagnosticAttemptCount).toBe(1);
    expect(result.unattributedAttemptCount).toBe(1);
    expect(result.concepts.map((concept) => concept.conceptId)).toEqual([CONCEPT_A, CONCEPT_B]);
  });

  it('el concepto con evidencia mezclada queda en conflicto y con diversidad real', () => {
    const concept = result.concepts[0];
    expect(concept?.masteryState).toBe('EVIDENCE_CONFLICTING');
    expect(concept?.uncertainty).toBe('MULTIPLE_QUESTIONS');
    expect(concept?.vector.eligibleAttemptCount).toBe(4);
    expect(concept?.vector.distinctQuestionCount).toBe(3);
    expect(concept?.vector.correctCount).toBe(2);
    expect(concept?.vector.incorrectCount).toBe(1);
    expect(concept?.vector.blankCount).toBe(1);
    expect(concept?.vector.unratedCount).toBe(1);
    expect(concept?.vector.confidenceCells.correct['1']).toBe(1);
    expect(concept?.vector.confidenceCells.incorrect['4']).toBe(1);
  });

  it('el concepto con exposición y un acierto no hereda nada del diagnóstico', () => {
    const concept = result.concepts[1];
    expect(concept?.masteryState).toBe('EVIDENCE_POSITIVE');
    expect(concept?.uncertainty).toBe('SINGLE_OBSERVATION');
    expect(concept?.vector.exposureViewedCount).toBe(1);
    expect(concept?.vector.exposureCompletedCount).toBe(1);
    expect(concept?.vector.distinctSessionCount).toBe(1);
  });

  it('ningún patrón se activa por debajo del recuento gobernado', () => {
    expect(result.errorPatterns).toEqual([]);
  });

  it('la huella canónica no ha cambiado', () => {
    const digest = createHash('sha256').update(canonicalResult(result), 'utf8').digest('hex');
    expect(digest).toBe(GOLDEN_SHA256);
  });

  it('la salida es idéntica byte a byte entre ejecuciones', () => {
    expect(canonicalResult(runEngine(GOLDEN_INPUT))).toBe(canonicalResult(result));
  });
});

describe('REQ-D08 · `engine_config v1` no admite ciencia inventada', () => {
  const valid = {
    algorithm_id: 'concept-evidence',
    algorithm_version: '1.0.0',
    active_dimensions: [...ACTIVE_DIMENSIONS],
    inactive_dimensions: { ...INACTIVE_DIMENSIONS },
    unset_policy_slots: [...UNSET_POLICY_SLOTS],
  };

  it('acepta la configuración de v1', () => {
    expect(() => assertEngineConfigV1(valid)).not.toThrow();
  });

  it('rechaza cualquier peso, banda, umbral o decaimiento', () => {
    for (const forbidden of ['weights', 'weight', 'thresholds', 'bands', 'decay', 'half_life']) {
      expect(() => assertEngineConfigV1({ ...valid, [forbidden]: 0.3 })).toThrow(EngineConfigError);
    }
  });

  it('rechaza que una ranura sin fijar lleve valor', () => {
    expect(() => assertEngineConfigV1({ ...valid, mastery_sufficiency: 3 })).toThrow(
      EngineConfigError,
    );
    expect(() => assertEngineConfigV1({ ...valid, review_intervals: [1, 3, 7] })).toThrow(
      EngineConfigError,
    );
  });

  it('exige declarar ambas ranuras como sin fijar', () => {
    expect(() =>
      assertEngineConfigV1({ ...valid, unset_policy_slots: ['mastery_sufficiency'] }),
    ).toThrow(EngineConfigError);
  });

  it('exige motivo auditable para cada dimensión inactiva', () => {
    expect(() =>
      assertEngineConfigV1({ ...valid, inactive_dimensions: { retention: '' } }),
    ).toThrow(EngineConfigError);
  });

  it('rechaza activar una dimensión sin sustrato', () => {
    expect(() =>
      assertEngineConfigV1({ ...valid, active_dimensions: [...ACTIVE_DIMENSIONS, 'speed'] }),
    ).toThrow(EngineConfigError);
  });

  it('la versión del motor es la del algoritmo, y no una fecha ni un hash', () => {
    expect(ENGINE_VERSION).toBe('concept-evidence-1.0.0');
  });
});

describe('REQ-D09 · el motor no necesita red', () => {
  it('el paquete no importa nada que salga de la máquina', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { REPO_ROOT } = await import('./lib/run-guard');
    const dir = join(REPO_ROOT, 'packages', 'learning-engine', 'src');
    for (const file of readdirSync(dir)) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const forbidden of ['fetch(', 'node:http', 'node:https', 'XMLHttpRequest', 'openai']) {
        expect(source, `${file} alcanza la red con ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
