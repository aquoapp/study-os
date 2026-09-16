import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSyntheticPack,
  purgePack,
  question,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  eventFor,
  itemAt,
  presentAndAnswer,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import {
  applyPayload,
  computeFor,
  evidenceSnapshot,
  expectedProjection,
  isStale,
  payloadOf,
  persistedProjection,
  runCycle,
  sqlText,
  watermarkOf,
} from '../support/engine-fixtures';
import { query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `engine.projection.spec` · el Learning Engine contra una base real.
 *
 * Aquí no se prueba la aritmética —eso es `engine.contract.spec`, sin base de datos— sino el
 * **contrato durable**: qué se persiste, cuándo avanza el watermark, qué pasa si el motor no
 * llega a correr, y si un rebuild coincide con lo que dejó una serie de incrementos.
 *
 * Todo lo del esquema `engine` se consulta por SQL directo: no está expuesto al Data API, y
 * esa negativa es el invariante (`engine.security.spec` la prueba de frente).
 *
 * `docs/LEARNING_ENGINE_CONTRACT.md` §5, §14, §15 · EC-006 · REQ-D01 … REQ-D03.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let learner: Learner;
let session: CreatedSession;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p3proj');
  learner = await createLearner(env, 'engine-alice', pack);

  session = await createSession(learner, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
    { item_type: 'QUESTION', target_id: question(pack, 1).questionId },
    { item_type: 'QUESTION', target_id: question(pack, 2).questionId },
  ]);
  await accept(learner, eventFor(learner, session, 'SESSION_STARTED'));
}, 300_000);

afterAll(async () => {
  if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
}, 180_000);

/** Una opción válida pero incorrecta: fallar exige elegir mal, no elegir algo inexistente. */
function wrongOptionFor(index: number): string {
  const correct = question(pack, index).correctOptionKey;
  const wrong = ['A', 'B', 'C', 'D'].find((key) => key !== correct);
  if (!wrong) throw new Error('el fixture no ofrece ninguna opción incorrecta');
  return wrong;
}

function masteryRows(): Array<Record<string, unknown>> {
  return query<Record<string, unknown>>(
    `select concept_id::text, mastery_state::text, uncertainty::text, next_review_at,
            engine_version, engine_config_version, attribution_generation::int as attribution_generation,
            event_watermark::int as event_watermark, vector
     from engine.concept_mastery where user_id = ${sqlText(learner.id)}::uuid order by concept_id`,
  );
}

describe('REQ-D01 · la proyección persistida es un vector, no una puntuación', () => {
  it('un acierto produce una fila por concepto con estado, incertidumbre y procedencia', async () => {
    await presentAndAnswer(
      learner,
      session,
      itemAt(session, 0),
      question(pack, 0).representationId,
      { option_key: question(pack, 0).correctOptionKey, confidence: 3 },
    );

    const run = runCycle(learner.id);
    expect(run.mode).toBe('REBUILD'); // primera ejecución: no hay nada sobre lo que continuar
    expect(run.watermark).toBeGreaterThan(0);

    const rows = masteryRows();
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row['mastery_state']).toBe('EVIDENCE_POSITIVE');
    expect(row['uncertainty']).toBe('SINGLE_OBSERVATION');
    expect(row['next_review_at']).toBeNull();
    expect(row['engine_version']).toBe('concept-evidence-1.0.0');
    expect(row['engine_config_version']).toBe('v1');
    expect(Number(row['attribution_generation'])).toBeGreaterThanOrEqual(1);
    expect(Number(row['event_watermark'])).toBe(run.watermark);

    // Ninguna columna ni clave del vector se parece a una puntuación.
    const vector = row['vector'] as Record<string, unknown>;
    for (const key of [...Object.keys(row), ...Object.keys(vector)]) {
      expect(key.toLowerCase()).not.toContain('score');
      expect(key.toLowerCase()).not.toContain('readiness');
    }
    expect(vector['eligibleAttemptCount']).toBe(1);
  }, 180_000);

  it('el mapeo SECONDARY no aporta evidencia autoritativa', () => {
    // El pack sintético mapea cada pregunta a un concepto PRIMARY y todas a un mismo
    // SECONDARY. Si el SECONDARY contribuyera, aparecería un concepto de más.
    const conceptIds = masteryRows().map((row) => row['concept_id'] as string);
    expect(conceptIds).toEqual([pack.conceptIds[0]]);
    expect(conceptIds).not.toContain(pack.conceptIds[3]);
  });

  it('el historial registra la ejecución con su tupla semántica y sus recuentos', () => {
    const history = query<{ reason: string; reason_json: Record<string, unknown> }>(
      `select reason::text, reason_json from engine.mastery_history
       where user_id = ${sqlText(learner.id)}::uuid order by created_at asc`,
    );
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]?.reason).toBe('REBUILD');
    for (const key of [
      'vectorBefore',
      'vectorAfter',
      'consumedPositions',
      'attemptsFolded',
      'unattributedSkipped',
      'diagnosticSkipped',
    ]) {
      expect(Object.keys(history[0]?.reason_json ?? {})).toContain(key);
    }
  });
});

describe('§14 · el watermark es progreso del consumidor, y solo avanza con la proyección', () => {
  it('sin evidencia nueva no se vuelve a escribir nada', () => {
    const before = watermarkOf(learner.id);
    const run = runCycle(learner.id);
    expect(run.mode).toBe('UP_TO_DATE');
    expect(watermarkOf(learner.id)).toBe(before);
  });

  it('una transacción de proyección fallida no avanza el watermark', () => {
    const before = watermarkOf(learner.id);
    const projectionBefore = persistedProjection(learner.id);

    // Versión de configuración que no está ACTIVE: la función lo rechaza y **nada** se
    // escribe. Es la prueba de que el avance del watermark es atómico con la proyección.
    const broken = { ...payloadOf(computeFor(learner.id)), engineConfigVersion: 'v999' };
    const applied = applyPayload(learner.id, broken, { rebuild: true });
    expect(applied.ok).toBe(false);

    expect(watermarkOf(learner.id)).toBe(before);
    expect(persistedProjection(learner.id)).toBe(projectionBefore);
  });

  it('un watermark nunca retrocede', () => {
    const backwards = { ...payloadOf(computeFor(learner.id)), eventWatermark: 0 };
    const applied = applyPayload(learner.id, backwards, { rebuild: true });
    expect(applied.ok).toBe(false);
    expect(applied.message).toContain('nunca retrocede');
  });

  it('una continuación incremental desde un watermark equivocado se rechaza', () => {
    const applied = applyPayload(learner.id, payloadOf(computeFor(learner.id)), {
      fromPosition: 99_999,
    });
    expect(applied.ok).toBe(false);
    expect(applied.message).toContain('watermark');
  });
});

describe('§7 de la autorización · el motor puede no llegar a correr, y nada se pierde', () => {
  it('evidencia aceptada sin proyección: el atraso es detectable y el watermark no miente', async () => {
    const watermarkBefore = watermarkOf(learner.id);
    const projectionBefore = persistedProjection(learner.id);

    // Se acepta evidencia y **no** se ejecuta el motor: el modo de fallo que hay que
    // sobrevivir, trasladado al producto.
    await presentAndAnswer(
      learner,
      session,
      itemAt(session, 1),
      question(pack, 1).representationId,
      { option_key: wrongOptionFor(1), confidence: 4 },
    );

    // 1 · la evidencia canónica está intacta y va por delante del watermark.
    expect(Number(evidenceSnapshot(learner.id).maxPosition)).toBeGreaterThan(
      Number(watermarkBefore),
    );
    // 2 · el atraso se detecta solo desde evidencia y watermark.
    expect(isStale(learner.id)).toBe(true);
    // 3 · el watermark no ha avanzado y la proyección sigue siendo la anterior.
    expect(watermarkOf(learner.id)).toBe(watermarkBefore);
    expect(persistedProjection(learner.id)).toBe(projectionBefore);
  }, 180_000);

  it('una ejecución posterior recupera y converge exactamente con el rebuild', () => {
    const run = runCycle(learner.id);
    expect(run.mode).toBe('INCREMENTAL');
    expect(isStale(learner.id)).toBe(false);
    expect(persistedProjection(learner.id)).toBe(expectedProjection(computeFor(learner.id)));
  });

  it('varias invocaciones perdidas seguidas también convergen', async () => {
    await presentAndAnswer(
      learner,
      session,
      itemAt(session, 2),
      question(pack, 2).representationId,
      { blank: true },
    );
    await accept(learner, eventFor(learner, session, 'SESSION_INTERRUPTED', { reason: 'fixture' }));
    await accept(learner, eventFor(learner, session, 'SESSION_RESUMED'));

    expect(isStale(learner.id)).toBe(true);
    runCycle(learner.id);
    expect(isStale(learner.id)).toBe(false);
    expect(persistedProjection(learner.id)).toBe(expectedProjection(computeFor(learner.id)));
  }, 240_000);
});

describe('EC-006 · lo persistido por incrementos coincide con el rebuild · fallo duro', () => {
  it('un rebuild forzado deja exactamente la misma proyección', () => {
    const afterIncrements = persistedProjection(learner.id);
    const run = runCycle(learner.id, { forceRebuild: true });
    expect(run.mode).toBe('REBUILD');
    expect(persistedProjection(learner.id)).toBe(afterIncrements);
  });

  it('el rebuild reemplaza la proyección entera, no la fusiona', () => {
    const result = computeFor(learner.id);
    const base = payloadOf(result);
    const injected = applyPayload(
      learner.id,
      {
        ...base,
        concepts: [
          ...(base['concepts'] as unknown[]),
          {
            conceptId: pack.conceptIds[3],
            masteryState: 'NEW',
            uncertainty: 'NO_EVIDENCE',
            vector: (result.concepts[0] as { vector: unknown }).vector,
          },
        ],
      },
      { rebuild: true },
    );
    expect(injected.ok).toBe(true);
    expect(masteryRows()).toHaveLength(result.concepts.length + 1);

    // El siguiente ciclo real la retira: la proyección es una función de la evidencia.
    runCycle(learner.id, { forceRebuild: true });
    expect(persistedProjection(learner.id)).toBe(expectedProjection(result));
  }, 180_000);
});

describe('la evidencia sobrevive a todo lo anterior', () => {
  it('ningún ciclo del motor ha alterado un solo evento ni un solo intento', () => {
    const counts = query<{ events: number; attempts: number }>(
      `select (select count(*)::int from public.learning_events where user_id = ${sqlText(learner.id)}::uuid) as events,
              (select count(*)::int from public.question_attempts where user_id = ${sqlText(learner.id)}::uuid) as attempts`,
    );
    expect(Number(counts[0]?.events ?? 0)).toBeGreaterThan(0);
    expect(Number(counts[0]?.attempts ?? 0)).toBe(3);
  });
});
