import { describe, expect, it } from 'vitest';

import {
  canonicalProjection,
  runEngine,
  type AttemptRow,
  type AttributionSnapshot,
  type EngineInput,
  type ExposureRow,
} from '@study-os/learning-engine';

/**
 * `engine.lastNegativePosition.spec` · contrato del Learning Engine v1.1, anexo §25 · P4-D6.
 *
 * El motor proyecta, por concepto, la posición de stream del intento **elegible** no correcto más
 * reciente. Estas pruebas fijan la regla derivada y, sobre todo, la invariante que la justifica:
 * el hecho es no nulo **exactamente** cuando el estado es `EVIDENCE_NEGATIVE` o
 * `EVIDENCE_CONFLICTING`. Si el pliegue y la función de estado divergieran, fallaría aquí antes
 * que en la restricción de la base.
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

function attemptAt(streamPosition: number, overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    attemptId: `attempt-${streamPosition}`,
    questionId: QUESTION_1,
    representationId: 'rep-1',
    sessionId: 'session-1',
    diagnosticRunId: null,
    streamPosition,
    isCorrect: true,
    answerKind: 'OPTION',
    confidenceValue: 3,
    clientCreatedAt: '2026-02-01T10:00:00.000Z',
    serverReceivedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

const wrong = (position: number, questionId = QUESTION_1, extra: Partial<AttemptRow> = {}) =>
  attemptAt(position, { questionId, isCorrect: false, ...extra });
const right = (position: number, questionId = QUESTION_1, extra: Partial<AttemptRow> = {}) =>
  attemptAt(position, { questionId, isCorrect: true, ...extra });
const blank = (position: number, questionId = QUESTION_1) =>
  attemptAt(position, { questionId, isCorrect: false, answerKind: 'BLANK' });

function input(
  attempts: AttemptRow[],
  exposures: ExposureRow[] = [],
  eventWatermark?: number,
): EngineInput {
  return {
    userId: 'learner-1',
    accountCreatedAt: ACCOUNT_CREATED,
    eventWatermark:
      eventWatermark ??
      Math.max(
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

const positionOf = (attempts: AttemptRow[], conceptId = CONCEPT_A, exposures: ExposureRow[] = []) =>
  runEngine(input(attempts, exposures)).concepts.find((c) => c.conceptId === conceptId)
    ?.lastNegativePosition;

const stateOf = (attempts: AttemptRow[], conceptId = CONCEPT_A) =>
  runEngine(input(attempts)).concepts.find((c) => c.conceptId === conceptId)?.masteryState;

describe('§25.1 · la regla', () => {
  it('un solo fallo: su posición', () => {
    expect(positionOf([wrong(5)])).toBe(5);
  });

  it('varios fallos: la posición del más reciente, por stream y no por reloj', () => {
    // El reloj del cliente dice lo contrario: el último por stream es el 9.
    expect(
      positionOf([
        wrong(3, QUESTION_1, { clientCreatedAt: '2026-02-09T10:00:00.000Z' }),
        wrong(9, QUESTION_2, { clientCreatedAt: '2026-02-01T10:00:00.000Z' }),
      ]),
    ).toBe(9);
  });

  it('el blanco cuenta como evidencia negativa, igual que en `ever_incorrect`', () => {
    expect(positionOf([right(2), blank(6, QUESTION_2)])).toBe(6);
  });

  it('un acierto posterior no borra la evidencia negativa anterior', () => {
    // negativo → conflictivo: la clave sigue en el fallo.
    expect(positionOf([wrong(4), right(8)])).toBe(4);
    expect(stateOf([wrong(4), right(8)])).toBe('EVIDENCE_CONFLICTING');
  });

  it('un fallo repetido sobre una pregunta ya fallada refresca la clave (P4-D5)', () => {
    expect(positionOf([wrong(2), wrong(11)])).toBe(11);
  });

  it('solo aciertos: null, y el estado es positivo', () => {
    expect(positionOf([right(1), right(2, QUESTION_2)])).toBeNull();
    expect(stateOf([right(1), right(2, QUESTION_2)])).toBe('EVIDENCE_POSITIVE');
  });

  it('solo exposición: null, y el estado es EXPOSED', () => {
    const exposures: ExposureRow[] = [
      { conceptId: CONCEPT_A, eventType: 'LEARNING_UNIT_COMPLETED', streamPosition: 3 },
    ];
    const result = runEngine(input([], exposures));
    const concept = result.concepts.find((c) => c.conceptId === CONCEPT_A);
    expect(concept?.masteryState).toBe('EXPOSED');
    expect(concept?.lastNegativePosition).toBeNull();
  });

  it('los conceptos son independientes', () => {
    const attempts = [wrong(3, QUESTION_1), wrong(7, QUESTION_4), right(9, QUESTION_2)];
    expect(positionOf(attempts, CONCEPT_A)).toBe(3);
    expect(positionOf(attempts, CONCEPT_B)).toBe(7);
  });
});

describe('§25.2 · la elegibilidad es la misma que la del vector', () => {
  it('la evidencia de diagnóstico no cuenta', () => {
    expect(positionOf([right(1), wrong(9, QUESTION_2, { diagnosticRunId: 'dx-1' })])).toBeNull();
  });

  it('la evidencia no atribuida no cuenta, ni siquiera para otro concepto', () => {
    const result = runEngine(input([right(1), wrong(9, UNMAPPED)]));
    for (const concept of result.concepts) expect(concept.lastNegativePosition).toBeNull();
    expect(result.unattributedAttemptCount).toBe(1);
  });

  it('lo posterior al watermark no cuenta', () => {
    const result = runEngine(input([wrong(3), wrong(12)], [], 10));
    expect(result.concepts.find((c) => c.conceptId === CONCEPT_A)?.lastNegativePosition).toBe(3);
  });

  it('un reloj anómalo no saca el intento: la posición la asigna el servidor', () => {
    const anomalous = wrong(8, QUESTION_1, { clientCreatedAt: '2030-01-01T00:00:00.000Z' });
    expect(positionOf([right(1), anomalous])).toBe(8);
  });

  it('una generación de atribución distinta reatribuye y recalcula el hecho', () => {
    const moved: AttributionSnapshot = {
      ...attribution,
      generation: 8,
      primaryConceptByQuestion: new Map([
        [QUESTION_1, CONCEPT_B],
        [QUESTION_2, CONCEPT_A],
      ]),
    };
    const attempts = [wrong(5, QUESTION_1), right(6, QUESTION_2)];
    const before = runEngine(input(attempts));
    const after = runEngine({ ...input(attempts), attribution: moved });
    expect(before.concepts.find((c) => c.conceptId === CONCEPT_A)?.lastNegativePosition).toBe(5);
    expect(after.concepts.find((c) => c.conceptId === CONCEPT_A)?.lastNegativePosition).toBeNull();
    expect(after.concepts.find((c) => c.conceptId === CONCEPT_B)?.lastNegativePosition).toBe(5);
  });
});

describe('§25.2 · invariante · no nulo exactamente cuando hay necesidad de reparación', () => {
  /**
   * Enumeración exhaustiva de todas las secuencias de hasta 5 intentos sobre 2 preguntas del
   * mismo concepto, con resultado correcto, incorrecto o blanco: 3^k × 2^k combinaciones por
   * longitud. Espacio finito y acotado: Σ(6^k, k=1..5) = 9 330 secuencias.
   */
  const outcomes: Array<'R' | 'W' | 'B'> = ['R', 'W', 'B'];
  const questions = [QUESTION_1, QUESTION_2];

  function* sequences(length: number): Generator<AttemptRow[]> {
    const total = (outcomes.length * questions.length) ** length;
    for (let code = 0; code < total; code += 1) {
      const out: AttemptRow[] = [];
      let rest = code;
      for (let k = 0; k < length; k += 1) {
        const choice = rest % (outcomes.length * questions.length);
        rest = Math.floor(rest / (outcomes.length * questions.length));
        const outcome = outcomes[choice % outcomes.length]!;
        const questionId = questions[Math.floor(choice / outcomes.length)]!;
        const position = k + 1;
        out.push(
          outcome === 'R'
            ? right(position, questionId)
            : outcome === 'W'
              ? wrong(position, questionId)
              : blank(position, questionId),
        );
      }
      yield out;
    }
  }

  it('se cumple en todas las secuencias hasta longitud 5', () => {
    let checked = 0;
    for (let length = 1; length <= 5; length += 1) {
      for (const attempts of sequences(length)) {
        const concept = runEngine(input(attempts)).concepts.find((c) => c.conceptId === CONCEPT_A);
        if (!concept) throw new Error('falta el concepto');
        const remediation =
          concept.masteryState === 'EVIDENCE_NEGATIVE' ||
          concept.masteryState === 'EVIDENCE_CONFLICTING';
        expect(
          concept.lastNegativePosition !== null,
          JSON.stringify(attempts.map((a) => a.answerKind + a.isCorrect)),
        ).toBe(remediation);
        // Y cuando existe, es la posición del último intento no correcto.
        const expected = attempts
          .filter((a) => !(a.isCorrect && a.answerKind !== 'BLANK'))
          .reduce<number | null>(
            (max, a) => (max === null || a.streamPosition > max ? a.streamPosition : max),
            null,
          );
        expect(concept.lastNegativePosition).toBe(expected);
        checked += 1;
      }
    }
    expect(checked).toBe(9330);
  });

  it('ningún patrón activo aparece sobre un concepto sin evidencia negativa', () => {
    // Tres preguntas acertadas con confianza máxima: ningún patrón, ninguna posición.
    const attempts = [
      right(1, QUESTION_1, { confidenceValue: 4 }),
      right(2, QUESTION_2, { confidenceValue: 4 }),
      right(3, QUESTION_3, { confidenceValue: 4 }),
    ];
    const result = runEngine(input(attempts));
    expect(result.errorPatterns).toEqual([]);
    expect(result.concepts.find((c) => c.conceptId === CONCEPT_A)?.lastNegativePosition).toBeNull();
    // Y con tres fallos sí hay patrón, y la posición existe.
    const failing = runEngine(
      input([wrong(1, QUESTION_1), wrong(2, QUESTION_2), wrong(3, QUESTION_3)]),
    );
    expect(failing.errorPatterns.map((p) => p.patternType)).toContain('RECURRENT_INCORRECT');
    expect(failing.concepts.find((c) => c.conceptId === CONCEPT_A)?.lastNegativePosition).toBe(3);
  });
});

describe('§25.4 · qué no lo mueve', () => {
  it('la exposición —abrir, leer, abandonar— no mueve la clave', () => {
    const attempts = [wrong(4)];
    const reading: ExposureRow[] = [
      { conceptId: CONCEPT_A, eventType: 'LEARNING_UNIT_VIEWED', streamPosition: 10 },
      { conceptId: CONCEPT_A, eventType: 'LEARNING_UNIT_COMPLETED', streamPosition: 11 },
    ];
    expect(positionOf(attempts, CONCEPT_A, reading)).toBe(4);
  });

  it('el hecho vive fuera del vector: ninguna clave del vector lo contiene', () => {
    const concept = runEngine(input([wrong(4)])).concepts[0]!;
    expect(Object.keys(concept.vector)).not.toContain('lastNegativePosition');
  });
});

describe('§25.5 · EC-006 en el plano del pliegue', () => {
  it('plegar por tramos y plegar entero dan la misma proyección canónica', () => {
    // El motor pliega toda la evidencia hasta el watermark; el incremento es la misma función
    // sobre un watermark mayor. Se comprueba la forma canónica, que ahora incluye el hecho.
    const attempts = [wrong(2), right(5, QUESTION_2), wrong(7, QUESTION_3), right(9)];
    const staged = runEngine(input(attempts, [], 5));
    const complete = runEngine(input(attempts, [], 9));
    const fromScratch = runEngine(input(attempts, [], 9));
    expect(canonicalProjection(complete)).toBe(canonicalProjection(fromScratch));
    expect(staged.concepts[0]?.lastNegativePosition).toBe(2);
    expect(complete.concepts[0]?.lastNegativePosition).toBe(7);
  });

  it('la forma canónica incluye el hecho: dos posiciones distintas no comparan iguales', () => {
    const a = canonicalProjection(runEngine(input([wrong(3), wrong(4, QUESTION_2)])));
    const b = canonicalProjection(runEngine(input([wrong(3), right(4, QUESTION_2)])));
    expect(a).toContain('"lastNegativePosition":4');
    expect(b).toContain('"lastNegativePosition":3');
  });
});
