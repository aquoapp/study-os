import { describe, expect, it } from 'vitest';

import {
  canonicalProjection,
  canonicalResult,
  runEngine,
  type AttemptRow,
  type AttributionSnapshot,
  type EngineInput,
  type ExposureRow,
} from '@study-os/learning-engine';

/**
 * `engine.rebuildEquivalence.spec` · EC-006 · REQ-D02 y REQ-D03 · **gate mecánico duro**.
 *
 * El pliegue está diseñado como monoide conmutativo, de modo que la igualdad
 * `rebuild == incremental` es *tratable*. **No exime de probarla**, y aquí se prueba
 * adversarialmente sobre los veintiún escenarios que exige la autorización de BUILD §16,
 * variando además el orden de proceso y el tamaño del lote.
 *
 * Que el diseño «no pueda» fallar es precisamente la razón por la que un fallo aquí sería
 * grave: significaría que el diseño no es lo que se afirma.
 */

const CONCEPT_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const CONCEPT_B = 'aaaaaaaa-0000-4000-8000-000000000002';
const Q = Array.from(
  { length: 6 },
  (_, index) => `bbbbbbbb-0000-4000-8000-00000000000${index + 1}`,
);
const UNMAPPED = 'bbbbbbbb-0000-4000-8000-0000000000ff';
const PACK_VERSION = 'cccccccc-0000-4000-8000-000000000001';
const ACCOUNT_CREATED = '2026-01-01T00:00:00.000Z';

function attributionFor(generation: number): AttributionSnapshot {
  return {
    packVersionId: PACK_VERSION,
    generation,
    primaryConceptByQuestion: new Map([
      [Q[0] as string, CONCEPT_A],
      [Q[1] as string, CONCEPT_A],
      [Q[2] as string, CONCEPT_A],
      [Q[3] as string, CONCEPT_B],
      [Q[4] as string, CONCEPT_B],
      [Q[5] as string, CONCEPT_B],
    ]),
  };
}

interface AttemptSpec {
  readonly q: string;
  readonly correct?: boolean;
  readonly blank?: boolean;
  readonly confidence?: number | null;
  readonly session?: string;
  readonly representation?: string;
  readonly diagnostic?: boolean;
  readonly clientCreatedAt?: string;
  readonly serverReceivedAt?: string;
}

/** Construye el stream: la posición es el índice, que es el orden total del usuario. */
function streamOf(specs: readonly AttemptSpec[]): AttemptRow[] {
  return specs.map((spec, index) => ({
    attemptId: `attempt-${index + 1}`,
    questionId: spec.q,
    representationId: spec.representation ?? `rep-${spec.q}`,
    sessionId: spec.session ?? 'session-1',
    diagnosticRunId: spec.diagnostic ? 'diagnostic-1' : null,
    streamPosition: index + 1,
    isCorrect: spec.correct === true,
    answerKind: spec.blank === true ? 'BLANK' : 'OPTION',
    confidenceValue: spec.confidence === undefined ? 3 : spec.confidence,
    clientCreatedAt:
      spec.clientCreatedAt ?? `2026-02-01T10:${String(index).padStart(2, '0')}:00.000Z`,
    serverReceivedAt: spec.serverReceivedAt ?? '2026-03-01T10:00:00.000Z',
  }));
}

function inputFor(
  attempts: readonly AttemptRow[],
  watermark: number,
  generation = 1,
  exposures: readonly ExposureRow[] = [],
): EngineInput {
  return {
    userId: 'learner-1',
    accountCreatedAt: ACCOUNT_CREATED,
    eventWatermark: watermark,
    attempts,
    exposures,
    attribution: attributionFor(generation),
    engineConfigVersion: 'v1',
  };
}

/**
 * Simula el camino **incremental**: procesar por lotes hasta un watermark, empezando cada vez
 * desde la evidencia completa acotada por el watermark alcanzado. Es exactamente lo que hace el
 * servidor, que no guarda estado intermedio: el vector se recalcula desde la evidencia elegible.
 */
function incrementalProjection(
  attempts: readonly AttemptRow[],
  batches: readonly number[],
  generation = 1,
  exposures: readonly ExposureRow[] = [],
): string {
  let signature = '';
  for (const watermark of batches) {
    signature = canonicalProjection(
      runEngine(inputFor(attempts, watermark, generation, exposures)),
    );
  }
  return signature;
}

/** Los veintiún escenarios de la autorización §16, cada uno como un stream completo. */
const SCENARIOS: ReadonlyArray<{ name: string; specs: AttemptSpec[]; exposures?: ExposureRow[] }> =
  [
    { name: '1 · un acierto', specs: [{ q: Q[0] as string, correct: true }] },
    { name: '2 · un fallo', specs: [{ q: Q[0] as string, correct: false }] },
    { name: '3 · un blanco', specs: [{ q: Q[0] as string, blank: true, confidence: null }] },
    {
      name: '4 · acierto con confianza baja',
      specs: [{ q: Q[0] as string, correct: true, confidence: 1 }],
    },
    {
      name: '5 · fallo con confianza máxima',
      specs: [{ q: Q[0] as string, correct: false, confidence: 4 }],
    },
    {
      name: '6 · misma pregunta repetida',
      specs: [
        { q: Q[0] as string, correct: true },
        { q: Q[0] as string, correct: true },
        { q: Q[0] as string, correct: false },
      ],
    },
    {
      name: '7 · varias preguntas del mismo concepto',
      specs: [
        { q: Q[0] as string, correct: true },
        { q: Q[1] as string, correct: true },
        { q: Q[2] as string, correct: false },
      ],
    },
    {
      name: '8 · acierto → fallo',
      specs: [
        { q: Q[0] as string, correct: true },
        { q: Q[0] as string, correct: false },
      ],
    },
    {
      name: '9 · fallo → acierto',
      specs: [
        { q: Q[0] as string, correct: false },
        { q: Q[0] as string, correct: true },
      ],
    },
    {
      name: '10 · sesión repetida',
      specs: [
        { q: Q[0] as string, correct: true, session: 'session-1' },
        { q: Q[0] as string, correct: true, session: 'session-2' },
        { q: Q[1] as string, correct: false, session: 'session-2' },
      ],
    },
    {
      name: '11 · otra representación de la misma pregunta',
      specs: [
        { q: Q[0] as string, correct: true, representation: 'rep-a' },
        { q: Q[0] as string, correct: false, representation: 'rep-b' },
      ],
    },
    {
      name: '12 · diagnóstico mezclado con evidencia ordinaria',
      specs: [
        { q: Q[0] as string, correct: true },
        { q: Q[1] as string, correct: false, diagnostic: true },
        { q: Q[2] as string, blank: true, confidence: null, diagnostic: true },
      ],
    },
    {
      name: '13 · evidencia sin atribuir',
      specs: [
        { q: Q[0] as string, correct: true },
        { q: UNMAPPED, correct: false },
      ],
    },
    {
      name: '14 · evidencia tardía con fecha vieja',
      specs: [
        { q: Q[0] as string, correct: true, clientCreatedAt: '2026-02-10T10:00:00.000Z' },
        { q: Q[1] as string, correct: false, clientCreatedAt: '2026-01-15T10:00:00.000Z' },
      ],
    },
    {
      name: '15 · reloj patológico adelantado',
      specs: [
        { q: Q[0] as string, correct: true, clientCreatedAt: '2031-01-01T10:00:00.000Z' },
        { q: Q[1] as string, correct: true },
      ],
    },
    {
      name: '15b · reloj anterior a la cuenta',
      specs: [{ q: Q[0] as string, correct: true, clientCreatedAt: '2019-01-01T10:00:00.000Z' }],
    },
    {
      name: '16 · evidencia de dos dispositivos con relojes divergentes',
      specs: [
        { q: Q[0] as string, correct: true, clientCreatedAt: '2026-02-20T10:00:00.000Z' },
        { q: Q[1] as string, correct: false, clientCreatedAt: '2026-02-02T10:00:00.000Z' },
        { q: Q[2] as string, correct: true, clientCreatedAt: '2026-02-11T10:00:00.000Z' },
      ],
    },
    {
      name: '20 · evidencia contradictoria en dos conceptos',
      specs: [
        { q: Q[0] as string, correct: true },
        { q: Q[1] as string, correct: false },
        { q: Q[3] as string, correct: false },
        { q: Q[4] as string, correct: true },
      ],
    },
    {
      name: '21 · patrón de error activo y resuelto en el mismo stream',
      specs: [
        { q: Q[0] as string, correct: false },
        { q: Q[1] as string, correct: false },
        { q: Q[2] as string, correct: false },
        { q: Q[0] as string, correct: true },
      ],
    },
    {
      name: '22 · exposición sin evidencia autoritativa',
      specs: [],
      exposures: [
        { conceptId: CONCEPT_A, eventType: 'LEARNING_UNIT_VIEWED', streamPosition: 1 },
        { conceptId: CONCEPT_A, eventType: 'LEARNING_UNIT_COMPLETED', streamPosition: 2 },
      ],
    },
    { name: '23 · sin evidencia alguna', specs: [] },
  ];

describe('REQ-D02 · determinismo byte a byte', () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.name} · dos ejecuciones idénticas`, () => {
      const attempts = streamOf(scenario.specs);
      const watermark = Math.max(
        attempts.length,
        ...(scenario.exposures ?? []).map((e) => e.streamPosition),
        0,
      );
      const once = canonicalResult(runEngine(inputFor(attempts, watermark, 1, scenario.exposures)));
      const twice = canonicalResult(
        runEngine(inputFor(attempts, watermark, 1, scenario.exposures)),
      );
      expect(once).toBe(twice);
    });
  }

  it('el orden de llegada de las filas no cambia el resultado', () => {
    const attempts = streamOf(SCENARIOS[16]?.specs ?? []);
    const forward = canonicalProjection(runEngine(inputFor(attempts, attempts.length)));
    const backward = canonicalProjection(
      runEngine(inputFor([...attempts].reverse(), attempts.length)),
    );
    const shuffled = canonicalProjection(
      runEngine(
        inputFor(
          [...attempts].sort((a, b) => a.attemptId.localeCompare(b.attemptId)),
          attempts.length,
        ),
      ),
    );
    expect(backward).toBe(forward);
    expect(shuffled).toBe(forward);
  });
});

describe('REQ-D03 · rebuild == incremental · fallo duro', () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.name} · el rebuild coincide con cualquier troceado`, () => {
      const attempts = streamOf(scenario.specs);
      const total = Math.max(
        attempts.length,
        ...(scenario.exposures ?? []).map((e) => e.streamPosition),
        0,
      );
      const rebuild = canonicalProjection(
        runEngine(inputFor(attempts, total, 1, scenario.exposures)),
      );

      // 17 · parada y reinicio en varios watermarks · 18 · tamaños de lote distintos.
      // Con evidencia vacía el único troceado posible es el watermark cero: un stream sin
      // posiciones no admite lotes, y exigirle uno probaría el arnés, no el motor.
      const batchings: number[][] = [
        [total],
        total >= 1 ? Array.from({ length: total }, (_, index) => index + 1) : [total],
        total >= 2 ? [Math.ceil(total / 2), total] : [total],
        total >= 3 ? [1, total - 1, total] : [total],
      ];
      for (const batches of batchings) {
        expect(
          incrementalProjection(attempts, batches, 1, scenario.exposures),
          `troceado ${batches.join('→')}`,
        ).toBe(rebuild);
      }
    });
  }

  it('19 · un fallo antes de avanzar el watermark no deja rastro: el reintento coincide', () => {
    const attempts = streamOf(SCENARIOS[6]?.specs ?? []);
    // El intento fallido no persiste nada, de modo que el estado de partida es el anterior.
    const afterFailure = incrementalProjection(attempts, [1]);
    const retried = incrementalProjection(attempts, [1, attempts.length]);
    const rebuild = canonicalProjection(runEngine(inputFor(attempts, attempts.length)));
    expect(afterFailure).not.toBe(retried);
    expect(retried).toBe(rebuild);
  });

  it('20 · un cambio de generación produce una proyección distinta y declarada', () => {
    const attempts = streamOf([{ q: Q[0] as string, correct: true }]);
    const first = runEngine(inputFor(attempts, attempts.length, 1));
    const second = runEngine(inputFor(attempts, attempts.length, 2));
    // La proyección de estado no cambia porque la evidencia no ha cambiado…
    expect(canonicalProjection(second)).toBe(canonicalProjection(first));
    // …pero la tupla semántica declarada sí, y es la que impide continuar incrementalmente.
    expect(second.attributionGeneration).toBe(2);
    expect(canonicalResult(second)).not.toBe(canonicalResult(first));
  });

  it('21 · rebuild desde cero sobre evidencia vacía es estable', () => {
    const empty = canonicalProjection(runEngine(inputFor([], 0)));
    expect(empty).toBe(canonicalProjection(runEngine(inputFor([], 0))));
    expect(empty).toContain('"concepts"');
  });

  it('un watermark intermedio nunca ve evidencia futura', () => {
    const attempts = streamOf([
      { q: Q[0] as string, correct: true },
      { q: Q[1] as string, correct: false },
      { q: Q[2] as string, correct: false },
    ]);
    const atOne = runEngine(inputFor(attempts, 1));
    expect(atOne.concepts[0]?.vector.eligibleAttemptCount).toBe(1);
    expect(atOne.concepts[0]?.masteryState).toBe('EVIDENCE_POSITIVE');
  });
});
