import { describe, expect, it } from 'vitest';

import {
  ERROR_PATTERN_RECURRENCE,
  RESERVED_MASTERY_STATES,
  V1_MASTERY_STATES,
  classifyAttempt,
  deriveMasteryState,
  deriveUncertainty,
  isTemporallyAnomalous,
  runEngine,
  type AttemptRow,
  type AttributionSnapshot,
  type EngineInput,
  type ExposureRow,
} from '@study-os/learning-engine';

/**
 * `engine.contract.spec` · el Learning Engine v1 hace lo que el contrato dice.
 *
 * Determinista y sin base de datos por diseño: el motor es aritmética sobre evidencia, y una
 * prueba que necesitara una base para comprobar una regla semántica estaría probando otra cosa.
 *
 * `docs/LEARNING_ENGINE_CONTRACT.md` §5 (elegibilidad y vector), §6 (repetición), §7
 * (calibración), §8 (tiempo), §9 (estado), §11 (incertidumbre), §17 (patrones).
 */

const CONCEPT_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const CONCEPT_B = 'aaaaaaaa-0000-4000-8000-000000000002';
const QUESTION_1 = 'bbbbbbbb-0000-4000-8000-000000000001';
const QUESTION_2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const QUESTION_3 = 'bbbbbbbb-0000-4000-8000-000000000003';
const QUESTION_4 = 'bbbbbbbb-0000-4000-8000-000000000004';
const UNMAPPED = 'bbbbbbbb-0000-4000-8000-00000000dead';
const ACCOUNT_CREATED = '2026-01-01T00:00:00.000Z';

const attribution: AttributionSnapshot = {
  packVersionId: 'cccccccc-0000-4000-8000-000000000001',
  generation: 7,
  primaryConceptByQuestion: new Map([
    [QUESTION_1, CONCEPT_A],
    [QUESTION_2, CONCEPT_A],
    [QUESTION_3, CONCEPT_A],
    [QUESTION_4, CONCEPT_B],
  ]),
};

let position = 0;

function attempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  position += 1;
  return {
    attemptId: `attempt-${position}`,
    questionId: QUESTION_1,
    representationId: 'rep-1',
    sessionId: 'session-1',
    diagnosticRunId: null,
    streamPosition: position,
    isCorrect: true,
    answerKind: 'OPTION',
    confidenceValue: 3,
    clientCreatedAt: `2026-02-0${Math.min(9, position)}T10:00:00.000Z`,
    serverReceivedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

function input(attempts: AttemptRow[], exposures: ExposureRow[] = []): EngineInput {
  return {
    userId: 'learner-1',
    accountCreatedAt: ACCOUNT_CREATED,
    eventWatermark: Math.max(
      0,
      ...attempts.map((a) => a.streamPosition),
      ...exposures.map((e) => e.streamPosition),
    ),
    attempts,
    exposures,
    attribution,
    engineConfigVersion: 'v1',
  };
}

function conceptOf(result: ReturnType<typeof runEngine>, conceptId: string) {
  const concept = result.concepts.find((candidate) => candidate.conceptId === conceptId);
  if (!concept) throw new Error(`el concepto ${conceptId} no está en la proyección`);
  return concept;
}

describe('§5.1 · elegibilidad: nada se descarta en silencio', () => {
  it('un intento de diagnóstico no toca el estado autoritativo y se contabiliza aparte', () => {
    const ordinary = attempt({ questionId: QUESTION_1, isCorrect: true });
    const diagnostic = attempt({
      questionId: QUESTION_2,
      isCorrect: false,
      diagnosticRunId: 'diagnostic-1',
    });
    const result = runEngine(input([ordinary, diagnostic]));

    expect(result.diagnosticAttemptCount).toBe(1);
    expect(result.attemptsFolded).toBe(1);
    const concept = conceptOf(result, CONCEPT_A);
    // Ni su corrección ni su confianza alteran nada: el fallo del diagnóstico no aparece.
    expect(concept.masteryState).toBe('EVIDENCE_POSITIVE');
    expect(concept.vector.eligibleAttemptCount).toBe(1);
    expect(concept.vector.distinctQuestionsEverIncorrect).toBe(0);
  });

  it('la evidencia sin mapeo PRIMARY VALIDATED se cuenta, no desaparece', () => {
    const result = runEngine(input([attempt({ questionId: UNMAPPED })]));
    expect(result.unattributedAttemptCount).toBe(1);
    expect(result.attemptsFolded).toBe(0);
    expect(result.concepts).toHaveLength(0);
  });

  it('la evidencia posterior al watermark no entra', () => {
    const early = attempt({ questionId: QUESTION_1 });
    const late = attempt({ questionId: QUESTION_2 });
    const result = runEngine({ ...input([early, late]), eventWatermark: early.streamPosition });
    expect(conceptOf(result, CONCEPT_A).vector.eligibleAttemptCount).toBe(1);
  });

  it('las cuatro clasificaciones son exhaustivas y en el orden del contrato', () => {
    const base = { eventWatermark: 5, attribution };
    expect(classifyAttempt(attempt({ diagnosticRunId: 'd', streamPosition: 99 }), base).kind).toBe(
      'DIAGNOSTIC',
    );
    expect(classifyAttempt(attempt({ streamPosition: 99 }), base).kind).toBe('BEYOND_WATERMARK');
    expect(classifyAttempt(attempt({ questionId: UNMAPPED, streamPosition: 1 }), base).kind).toBe(
      'UNATTRIBUTED',
    );
    expect(classifyAttempt(attempt({ streamPosition: 1 }), base).kind).toBe('ELIGIBLE');
  });
});

describe('§5.2 · el blanco es evidencia y nunca es correcto', () => {
  it('cuenta como observación, como «alguna vez incorrecta» y no como fallo', () => {
    const result = runEngine(
      input([attempt({ answerKind: 'BLANK', isCorrect: false, confidenceValue: null })]),
    );
    const vector = conceptOf(result, CONCEPT_A).vector;
    expect(vector.eligibleAttemptCount).toBe(1);
    expect(vector.blankCount).toBe(1);
    expect(vector.incorrectCount).toBe(0);
    expect(vector.correctCount).toBe(0);
    expect(vector.distinctQuestionsEverIncorrect).toBe(1);
    expect(vector.unratedCount).toBe(1);
  });

  it('la ausencia de evidencia no se convierte en evidencia negativa', () => {
    const result = runEngine(input([]));
    expect(result.concepts).toHaveLength(0);
    // Sin observaciones no hay fila, y por tanto no hay nada que interpretar como negativo.
    expect(
      deriveMasteryState({
        ...conceptTemplate(),
        eligibleAttemptCount: 0,
      }),
    ).toBe('NEW');
  });
});

function conceptTemplate() {
  return {
    eligibleAttemptCount: 0,
    distinctQuestionCount: 0,
    distinctRepresentationCount: 0,
    distinctSessionCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    blankCount: 0,
    distinctQuestionsEverCorrect: 0,
    distinctQuestionsEverIncorrect: 0,
    distinctQuestionsLatestCorrect: 0,
    distinctQuestionsLatestIncorrect: 0,
    confidenceCells: {
      correct: { '1': 0, '2': 0, '3': 0, '4': 0 },
      incorrect: { '1': 0, '2': 0, '3': 0, '4': 0 },
    },
    unratedCount: 0,
    firstEvidenceAt: null,
    latestEvidenceAt: null,
    temporalAnomalyCount: 0,
    exposureViewedCount: 0,
    exposureCompletedCount: 0,
  } as const;
}

describe('§6 · la repetición aumenta la observación, no la diversidad', () => {
  it('la misma pregunta repetida no aumenta las preguntas distintas', () => {
    const result = runEngine(
      input([attempt({ questionId: QUESTION_1 }), attempt({ questionId: QUESTION_1 })]),
    );
    const vector = conceptOf(result, CONCEPT_A).vector;
    expect(vector.eligibleAttemptCount).toBe(2);
    expect(vector.distinctQuestionCount).toBe(1);
    expect(conceptOf(result, CONCEPT_A).uncertainty).toBe('REPEATED_SAME_QUESTION');
  });

  it('otra representación de la misma pregunta no la convierte en otra pregunta', () => {
    const result = runEngine(
      input([
        attempt({ questionId: QUESTION_1, representationId: 'rep-1' }),
        attempt({ questionId: QUESTION_1, representationId: 'rep-2' }),
      ]),
    );
    const vector = conceptOf(result, CONCEPT_A).vector;
    expect(vector.distinctQuestionCount).toBe(1);
    expect(vector.distinctRepresentationCount).toBe(2);
  });

  it('preguntas distintas del mismo concepto sí aumentan la diversidad', () => {
    const result = runEngine(
      input([attempt({ questionId: QUESTION_1 }), attempt({ questionId: QUESTION_2 })]),
    );
    expect(conceptOf(result, CONCEPT_A).vector.distinctQuestionCount).toBe(2);
    expect(conceptOf(result, CONCEPT_A).uncertainty).toBe('MULTIPLE_QUESTIONS');
  });

  it('fallo → acierto y acierto → fallo se distinguen por el último resultado', () => {
    const recovered = runEngine(
      input([
        attempt({ questionId: QUESTION_1, isCorrect: false }),
        attempt({ questionId: QUESTION_1, isCorrect: true }),
      ]),
    );
    const regressed = runEngine(
      input([
        attempt({ questionId: QUESTION_2, isCorrect: true }),
        attempt({ questionId: QUESTION_2, isCorrect: false }),
      ]),
    );

    for (const result of [recovered, regressed]) {
      expect(conceptOf(result, CONCEPT_A).masteryState).toBe('EVIDENCE_CONFLICTING');
    }
    expect(conceptOf(recovered, CONCEPT_A).vector.distinctQuestionsLatestCorrect).toBe(1);
    expect(conceptOf(regressed, CONCEPT_A).vector.distinctQuestionsLatestIncorrect).toBe(1);
  });

  it('las sesiones distintas se registran como sustrato, sin puntuarse', () => {
    const result = runEngine(
      input([
        attempt({ questionId: QUESTION_1, sessionId: 'session-1' }),
        attempt({ questionId: QUESTION_1, sessionId: 'session-2' }),
      ]),
    );
    expect(conceptOf(result, CONCEPT_A).vector.distinctSessionCount).toBe(2);
  });
});

describe('§7 · la confianza calibra y no puede convertirse en dominio', () => {
  it('los cuatro cuadrantes son observables por separado', () => {
    const result = runEngine(
      input([
        attempt({ questionId: QUESTION_1, isCorrect: true, confidenceValue: 1 }),
        attempt({ questionId: QUESTION_2, isCorrect: true, confidenceValue: 4 }),
        attempt({ questionId: QUESTION_3, isCorrect: false, confidenceValue: 1 }),
        attempt({ questionId: QUESTION_4, isCorrect: false, confidenceValue: 4 }),
      ]),
    );
    const a = conceptOf(result, CONCEPT_A).vector.confidenceCells;
    const b = conceptOf(result, CONCEPT_B).vector.confidenceCells;
    expect(a.correct['1']).toBe(1);
    expect(a.correct['4']).toBe(1);
    expect(a.incorrect['1']).toBe(1);
    expect(b.incorrect['4']).toBe(1);
  });

  it('acierto con «Nada segura»: el conocimiento sube y la calibración empeora', () => {
    const result = runEngine(
      input([attempt({ questionId: QUESTION_1, isCorrect: true, confidenceValue: 1 })]),
    );
    const concept = conceptOf(result, CONCEPT_A);
    expect(concept.masteryState).toBe('EVIDENCE_POSITIVE');
    expect(concept.vector.correctCount).toBe(1);
    expect(concept.vector.confidenceCells.correct['1']).toBe(1);
  });

  it('fallo con «Segura»: el estado no puede mejorar', () => {
    const result = runEngine(
      input([attempt({ questionId: QUESTION_1, isCorrect: false, confidenceValue: 4 })]),
    );
    expect(conceptOf(result, CONCEPT_A).masteryState).toBe('EVIDENCE_NEGATIVE');
  });

  it('la confianza no aparece en la función de estado: cambiarla no mueve el estado', () => {
    const states = new Set(
      [1, 2, 3, 4].map((level) => {
        const result = runEngine(
          input([attempt({ questionId: QUESTION_1, isCorrect: true, confidenceValue: level })]),
        );
        return conceptOf(result, CONCEPT_A).masteryState;
      }),
    );
    expect([...states]).toEqual(['EVIDENCE_POSITIVE']);
  });
});

describe('§8 · tiempo: sustrato sí, modelo no', () => {
  it('un reloj adelantado respecto al servidor es anómalo', () => {
    const anomalous = attempt({
      clientCreatedAt: '2026-04-01T10:00:00.000Z',
      serverReceivedAt: '2026-03-01T10:00:00.000Z',
    });
    expect(isTemporallyAnomalous(anomalous, ACCOUNT_CREATED)).toBe(true);
  });

  it('un reloj anterior a la cuenta es anómalo', () => {
    const anomalous = attempt({ clientCreatedAt: '2020-01-01T10:00:00.000Z' });
    expect(isTemporallyAnomalous(anomalous, ACCOUNT_CREATED)).toBe(true);
  });

  it('una fecha simplemente vieja es evidencia offline legítima', () => {
    const offline = attempt({
      clientCreatedAt: '2026-01-02T10:00:00.000Z',
      serverReceivedAt: '2026-03-01T10:00:00.000Z',
    });
    expect(isTemporallyAnomalous(offline, ACCOUNT_CREATED)).toBe(false);
  });

  it('la evidencia anómala cuenta, pero no define el primero ni el último hecho', () => {
    const result = runEngine(
      input([
        attempt({
          questionId: QUESTION_1,
          clientCreatedAt: '2026-02-05T10:00:00.000Z',
          serverReceivedAt: '2026-03-01T10:00:00.000Z',
        }),
        attempt({
          questionId: QUESTION_2,
          clientCreatedAt: '2030-01-01T10:00:00.000Z',
          serverReceivedAt: '2026-03-01T10:00:00.000Z',
        }),
      ]),
    );
    const vector = conceptOf(result, CONCEPT_A).vector;
    expect(vector.eligibleAttemptCount).toBe(2);
    expect(vector.temporalAnomalyCount).toBe(1);
    expect(vector.latestEvidenceAt).toBe('2026-02-05T10:00:00.000Z');
  });

  it('si toda la evidencia es anómala, no se inventa una fecha', () => {
    const result = runEngine(
      input([attempt({ questionId: QUESTION_1, clientCreatedAt: '2020-01-01T00:00:00.000Z' })]),
    );
    const vector = conceptOf(result, CONCEPT_A).vector;
    expect(vector.firstEvidenceAt).toBeNull();
    expect(vector.latestEvidenceAt).toBeNull();
  });

  it('nunca se programa un repaso mientras la política esté sin fijar', () => {
    const result = runEngine(input([attempt({ questionId: QUESTION_1 })]));
    for (const concept of result.concepts) expect(concept.nextReviewAt).toBeNull();
  });
});

describe('§9 · la función de estado es total y mutuamente excluyente', () => {
  it('los cinco estados son los del contrato y ninguno heredado es alcanzable', () => {
    expect([...V1_MASTERY_STATES]).toEqual([
      'NEW',
      'EXPOSED',
      'EVIDENCE_POSITIVE',
      'EVIDENCE_NEGATIVE',
      'EVIDENCE_CONFLICTING',
    ]);
    for (const reserved of RESERVED_MASTERY_STATES) {
      expect([...V1_MASTERY_STATES]).not.toContain(reserved);
    }
  });

  it('cubre todo vector válido con exactamente un estado', () => {
    const seen = new Set<string>();
    for (const eligible of [0, 1, 2, 5]) {
      for (const everCorrect of [0, 1, 2]) {
        for (const everIncorrect of [0, 1, 2]) {
          for (const exposure of [0, 1]) {
            if (eligible === 0 && (everCorrect > 0 || everIncorrect > 0)) continue;
            const state = deriveMasteryState({
              ...conceptTemplate(),
              eligibleAttemptCount: eligible,
              distinctQuestionsEverCorrect: everCorrect,
              distinctQuestionsEverIncorrect: everIncorrect,
              exposureCompletedCount: exposure,
            });
            expect(V1_MASTERY_STATES as readonly string[]).toContain(state);
            seen.add(state);
          }
        }
      }
    }
    expect(seen.size).toBe(5);
  });

  it('la exposición sostiene EXPOSED y jamás sube el dominio', () => {
    const result = runEngine(
      input(
        [],
        [
          { conceptId: CONCEPT_A, eventType: 'LEARNING_UNIT_VIEWED', streamPosition: 1 },
          { conceptId: CONCEPT_A, eventType: 'LEARNING_UNIT_COMPLETED', streamPosition: 2 },
        ],
      ),
    );
    const concept = conceptOf(result, CONCEPT_A);
    expect(concept.masteryState).toBe('EXPOSED');
    expect(concept.uncertainty).toBe('NO_EVIDENCE');
    expect(concept.vector.eligibleAttemptCount).toBe(0);
  });
});

describe('§11 · incertidumbre categórica, nunca porcentaje', () => {
  it('distingue cero, una, repetida y diversa', () => {
    expect(deriveUncertainty({ ...conceptTemplate() })).toBe('NO_EVIDENCE');
    expect(
      deriveUncertainty({
        ...conceptTemplate(),
        eligibleAttemptCount: 1,
        distinctQuestionCount: 1,
      }),
    ).toBe('SINGLE_OBSERVATION');
    expect(
      deriveUncertainty({
        ...conceptTemplate(),
        eligibleAttemptCount: 3,
        distinctQuestionCount: 1,
      }),
    ).toBe('REPEATED_SAME_QUESTION');
    expect(
      deriveUncertainty({
        ...conceptTemplate(),
        eligibleAttemptCount: 3,
        distinctQuestionCount: 2,
      }),
    ).toBe('MULTIPLE_QUESTIONS');
  });
});

describe('§17 · patrones de error estructurales', () => {
  it('tres preguntas distintas con último resultado incorrecto activan el patrón', () => {
    const result = runEngine(
      input([
        attempt({ questionId: QUESTION_1, isCorrect: false }),
        attempt({ questionId: QUESTION_2, isCorrect: false }),
        attempt({ questionId: QUESTION_3, isCorrect: false }),
      ]),
    );
    const pattern = result.errorPatterns.find((p) => p.patternType === 'RECURRENT_INCORRECT');
    expect(pattern?.evidenceCount).toBe(ERROR_PATTERN_RECURRENCE);
  });

  it('dos no bastan: el recuento es una regla, no una tendencia', () => {
    const result = runEngine(
      input([
        attempt({ questionId: QUESTION_1, isCorrect: false }),
        attempt({ questionId: QUESTION_2, isCorrect: false }),
      ]),
    );
    expect(result.errorPatterns).toHaveLength(0);
  });

  it('el patrón se resuelve por ausencia cuando el último resultado cambia', () => {
    const active = [
      attempt({ questionId: QUESTION_1, isCorrect: false }),
      attempt({ questionId: QUESTION_2, isCorrect: false }),
      attempt({ questionId: QUESTION_3, isCorrect: false }),
    ];
    expect(runEngine(input(active)).errorPatterns).toHaveLength(1);

    const recovered = [...active, attempt({ questionId: QUESTION_1, isCorrect: true })];
    expect(runEngine(input(recovered)).errorPatterns).toHaveLength(0);
  });

  it('tres blancos activan su propio patrón, distinto del fallo', () => {
    const result = runEngine(
      input(
        [QUESTION_1, QUESTION_2, QUESTION_3].map((questionId) =>
          attempt({ questionId, answerKind: 'BLANK', isCorrect: false, confidenceValue: null }),
        ),
      ),
    );
    // `RECURRENT_INCORRECT` y `RECURRENT_BLANK` son condiciones **disjuntas**: la primera mira
    // los últimos resultados incorrectos, la segunda los últimos en blanco. Dejar en blanco no
    // es lo mismo que fallar, y el patrón no las mezcla.
    expect(result.errorPatterns.map((p) => p.patternType)).toEqual(['RECURRENT_BLANK']);
  });

  it('tres fallos en el nivel máximo de confianza activan el patrón de calibración', () => {
    const result = runEngine(
      input([
        attempt({ questionId: QUESTION_1, isCorrect: false, confidenceValue: 4 }),
        attempt({ questionId: QUESTION_1, isCorrect: false, confidenceValue: 4 }),
        attempt({ questionId: QUESTION_1, isCorrect: false, confidenceValue: 4 }),
      ]),
    );
    expect(result.errorPatterns.map((p) => p.patternType)).toContain('MAX_CONFIDENCE_INCORRECT');
  });
});

describe('la proyección no contiene ninguna puntuación', () => {
  it('ningún campo del vector se parece a un score', () => {
    const result = runEngine(input([attempt({ questionId: QUESTION_1 })]));
    const keys = Object.keys(conceptOf(result, CONCEPT_A).vector);
    for (const key of keys) {
      expect(key.toLowerCase()).not.toContain('score');
      expect(key.toLowerCase()).not.toContain('readiness');
      expect(key.toLowerCase()).not.toContain('probability');
    }
  });

  it('la tupla semántica declarada viaja con el resultado', () => {
    const result = runEngine(input([attempt({ questionId: QUESTION_1 })]));
    expect(result.engineVersion).toBe('concept-evidence-1.0.0');
    expect(result.engineConfigVersion).toBe('v1');
    expect(result.attributionPackVersionId).toBe(attribution.packVersionId);
    expect(result.attributionGeneration).toBe(7);
  });
});
