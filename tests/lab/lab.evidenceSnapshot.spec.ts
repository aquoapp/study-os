import { describe, expect, it } from 'vitest';

import { EvidenceReadIncomplete, assertUuid, readEvidenceSnapshot } from '../../lab/src/evidence';
import { assertReadOnly, type ObservationContext } from '../../lab/src/observation';
import type { ActorTestimony } from '../../lab/src/oracle';
import type { SubstrateIdentity } from '../../lab/src/substrate';

/**
 * Lectura del snapshot · CP4 · §9.
 *
 * Lo que esta suite protege es una sola frase: **un fallo de lectura no es una ausencia**. Si
 * una consulta no sale, el snapshot tiene que decir que está incompleto, porque de lo contrario
 * el oráculo podría aprobar una aserción negativa sobre una lista vacía que nadie leyó.
 */

const IDENTITY: SubstrateIdentity = {
  kind: 'ephemeral-ci',
  apiUrl: 'http://127.0.0.1:54321',
  databaseHost: '127.0.0.1',
  databasePort: '54322',
  fingerprint: '0123456789abcdef',
  observedAt: '2026-11-14T00:00:00Z',
};

const SUBJECT = '11111111-2222-3333-4444-555555555555';
const CONCEPT_C1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const CONCEPT_C4 = 'aaaaaaaa-0000-0000-0000-000000000004';

const ACTOR: ActorTestimony = {
  confidenceByItem: new Map([['item-1', 3]]),
  presentedRepresentationByItem: new Map([['item-1', 'rep-1']]),
  abandonedWithoutSubmit: [],
  answerKeyVisibleBeforeSubmit: false,
  submitsByItem: new Map([['item-1', 1]]),
};

const CONCEPT_KEYS = new Map([
  [CONCEPT_C1, 'c1'],
  [CONCEPT_C4, 'c4'],
]);

/** Ejecutor de consultas que responde por reconocimiento de la sentencia. */
function runner(
  overrides: Partial<
    Record<
      'events' | 'attempts' | 'items' | 'planned' | 'audit' | 'barrier',
      string | Error | { readonly raw: string }
    >
  > = {},
) {
  const statements: string[] = [];
  const run = (_url: string, statement: string): string => {
    statements.push(statement);
    const pick = (key: keyof typeof overrides, fallback: string): string => {
      const override = overrides[key];
      if (override instanceof Error) throw override;
      if (override && typeof override === 'object') return fallback;
      return override ?? fallback;
    };
    /**
     * `observeSet` envuelve la consulta en un `json_agg`, de modo que el CLI devuelve siempre
     * **una** fila con un array dentro. El doble imita esa forma: si devolviera arrays desnudos
     * estaría probando un contrato que la consulta real no tiene.
     */
    const wrapped = (key: keyof typeof overrides, fallback: string): string => {
      const override = overrides[key];
      // Un override `{ raw }` es la salida **literal** del CLI, para poder ejercitar los
      // caminos en los que no llega ni el envoltorio.
      if (override && typeof override === 'object' && 'raw' in override) return override.raw;
      return JSON.stringify([{ rows: pick(key, fallback) }]);
    };
    // La barrera se reconoce primero: su sentencia **también** menciona `learning_events`,
    // porque lee el máximo del stream como subconsulta.
    if (statement.includes('engine.projection_watermarks')) {
      return pick('barrier', JSON.stringify([{ max_position: 2, consumed_position: 2 }]));
    }
    if (statement.includes('from public.learning_events where')) {
      return wrapped(
        'events',
        JSON.stringify([
          { stream_position: 1, event_type: 'SESSION_STARTED', session_item_id: null },
          { stream_position: 2, event_type: 'ANSWER_SUBMITTED', session_item_id: 'item-1' },
        ]),
      );
    }
    if (statement.includes('from public.question_attempts')) {
      return wrapped(
        'attempts',
        JSON.stringify([
          {
            session_item_id: 'item-1',
            question_id: 'q-1',
            question_representation_id: 'rep-1',
            submitted_event_id: 'evt-2',
            answer_kind: 'OPTION',
            selected_option_key: 'A',
            is_correct_at_submission: true,
            confidence_value: 3,
            confidence_scale_version: 'v1',
            attempt_number: 1,
            server_correct_option_key: 'A',
          },
        ]),
      );
    }
    if (statement.includes('from public.session_items')) {
      return wrapped(
        'items',
        JSON.stringify([
          {
            session_item_id: 'item-1',
            item_type: 'QUESTION',
            presented_representation_id: 'rep-1',
            presented_learning_unit_version_id: null,
            status: 'COMPLETED',
          },
        ]),
      );
    }
    if (statement.includes('from public.planner_items')) {
      return wrapped('planned', JSON.stringify([{ concept_id: CONCEPT_C1 }]));
    }
    if (statement.includes('from public.planner_run_audit')) {
      return wrapped(
        'audit',
        JSON.stringify([
          {
            decision_canonical: JSON.stringify({
              candidates: [
                { conceptId: CONCEPT_C1, exclusion: null },
                { conceptId: CONCEPT_C4, exclusion: 'NO_PUBLISHED_UNIT' },
              ],
            }),
          },
        ]),
      );
    }
    return pick('barrier', JSON.stringify([{ max_position: 2, consumed_position: 2 }]));
  };
  return {
    statements,
    context: {
      credentials: { databaseUrl: 'x' },
      identity: IDENTITY,
      runQuery: run,
    } as ObservationContext,
  };
}

function snapshot(overrides: Parameters<typeof runner>[0] = {}) {
  const { statements, context } = runner(overrides);
  const outcome = readEvidenceSnapshot({
    context,
    subjectRef: SUBJECT,
    conceptKeyById: CONCEPT_KEYS,
    actor: ACTOR,
    structuralScarcityConcepts: ['c4'],
  });
  return { result: outcome.snapshot, failures: outcome.failures, statements };
}

describe('toda consulta del snapshot es una lectura', () => {
  it('las cinco sentencias emitidas pasan la comprobación de solo lectura', () => {
    const { statements } = snapshot();
    expect(statements.length).toBeGreaterThanOrEqual(5);
    for (const statement of statements) {
      expect(() => assertReadOnly(statement)).not.toThrow();
    }
  });

  it('un sujeto que no es un uuid no se interpola en ninguna consulta', () => {
    const { context } = runner();
    expect(() =>
      readEvidenceSnapshot({
        context,
        subjectRef: "' or true --",
        conceptKeyById: CONCEPT_KEYS,
        actor: ACTOR,
        structuralScarcityConcepts: [],
      }),
    ).toThrow(EvidenceReadIncomplete);
  });

  it('assertUuid acepta un uuid y rechaza cualquier otra cosa', () => {
    expect(() => assertUuid(SUBJECT, 'sujeto')).not.toThrow();
    expect(() => assertUuid('no-uuid', 'sujeto')).toThrow(/no es un uuid/);
  });
});

describe('el snapshot completo refleja lo leído', () => {
  it('eventos, intentos, ítems, plan y barrera', () => {
    const { result } = snapshot();
    expect(result.observationComplete).toBe(true);
    expect(result.events.map((event) => event.streamPosition)).toEqual([1, 2]);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.serverCorrectOptionKey).toBe('A');
    expect(result.presentedItems[0]?.presentedRepresentationId).toBe('rep-1');
    expect(result.barrier).toEqual({ maxPosition: 2, consumedPosition: 2, pending: false });
  });

  it('las exclusiones salen de la auditoría de la decisión, no de lo planificado', () => {
    const { result } = snapshot();
    expect(result.planner.plannedConceptKeys).toEqual(['c1']);
    expect(result.planner.exclusions).toEqual([{ conceptKey: 'c4', reason: 'NO_PUBLISHED_UNIT' }]);
  });

  it('un concepto ajeno al corpus no entra en el plan observado', () => {
    const { context } = runner({
      planned: JSON.stringify([{ concept_id: 'ffffffff-0000-0000-0000-000000000099' }]),
    });
    const { snapshot } = readEvidenceSnapshot({
      context,
      subjectRef: SUBJECT,
      conceptKeyById: CONCEPT_KEYS,
      actor: ACTOR,
      structuralScarcityConcepts: ['c4'],
    });
    expect(snapshot.planner.plannedConceptKeys).toEqual([]);
  });
});

describe('un fallo de lectura nunca se convierte en una ausencia', () => {
  it.each([
    ['events', 'eventos'],
    ['attempts', 'intentos'],
    ['items', 'ítems de sesión'],
    ['planned', 'plan'],
    ['audit', 'auditoría'],
  ] as const)('si fallan los %s, el snapshot queda incompleto', (key, _label) => {
    const { result } = snapshot({ [key]: new Error('la consulta falló') });
    expect(result.observationComplete).toBe(false);
  });

  it('si falla la barrera, el snapshot queda incompleto y sus posiciones son nulas', () => {
    const { result } = snapshot({ barrier: new Error('sin barrera') });
    expect(result.observationComplete).toBe(false);
    expect(result.barrier).toEqual({ maxPosition: null, consumedPosition: null, pending: null });
  });

  it('una salida sin JSON no es «cero filas»: es lectura fallida', () => {
    const { result } = snapshot({ events: 'ERROR: algo salió mal' });
    expect(result.observationComplete).toBe(false);
    expect(result.events).toEqual([]);
  });

  it('una decisión ilegible no se interpreta como «sin exclusiones»', () => {
    const { result } = snapshot({
      audit: JSON.stringify([{ decision_canonical: '{esto no es json' }]),
    });
    expect(result.observationComplete).toBe(false);
    expect(result.planner.exclusions).toEqual([]);
  });

  it('cada fallo queda **nombrado**: el informe puede decir qué lectura y por qué', () => {
    const { failures } = snapshot({ attempts: new Error('la consulta falló') });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^intentos · EJECUCION_FALLIDA$/);
  });

  it('una salida sin array se nombra SIN_SALIDA_JSON', () => {
    const { failures } = snapshot({ events: { raw: 'ERROR: el CLI no imprimió nada util' } });
    expect(failures[0]).toMatch(/eventos · SIN_SALIDA_JSON/);
  });

  it('un array cuyo contenido no es JSON se nombra JSON_ILEGIBLE', () => {
    expect(snapshot({ events: 'esto no es json' }).failures[0]).toMatch(/JSON_ILEGIBLE/);
  });

  it('ningún motivo arrastra el texto del error: podría llevar la cadena de conexión', () => {
    const { failures } = snapshot({
      events: new Error('postgresql://postgres:postgres@127.0.0.1:54322/postgres caído'),
    });
    expect(failures.join(' ')).not.toContain('postgres');
    expect(failures.join(' ')).toContain('EJECUCION_FALLIDA');
  });

  it('y cero filas de verdad sí es un dato: el snapshot sigue completo', () => {
    const { result } = snapshot({ attempts: '[]' });
    expect(result.observationComplete).toBe(true);
    expect(result.attempts).toEqual([]);
  });
});
