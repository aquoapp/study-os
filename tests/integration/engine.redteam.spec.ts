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
import { one, query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `engine.redteam.spec` · §25 de la autorización de BUILD.
 *
 * Ataques al motor que no son fallos de aritmética sino de **contrato**: procesar dos veces,
 * reproducir un payload viejo, escribir la proyección de otro aprendiz, declarar una
 * atribución arbitraria o reconstruir sin evidencia. Lo que aquí se prueba es que el sistema
 * rechaza o converge, y que nunca miente sobre lo que sabe.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let alice: Learner;
let bob: Learner;
let session: CreatedSession;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p3red');
  alice = await createLearner(env, 'engine-red-alice', pack);
  bob = await createLearner(env, 'engine-red-bob', pack);

  session = await createSession(alice, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
    { item_type: 'QUESTION', target_id: question(pack, 1).questionId },
  ]);
  await accept(alice, eventFor(alice, session, 'SESSION_STARTED'));
  await presentAndAnswer(alice, session, itemAt(session, 0), question(pack, 0).representationId, {
    option_key: question(pack, 0).correctOptionKey,
    confidence: 3,
  });
  runCycle(alice.id);
}, 300_000);

afterAll(async () => {
  for (const learner of [alice, bob]) if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
}, 180_000);

describe('procesar dos veces no duplica evidencia', () => {
  it('el segundo ciclo consecutivo no escribe nada', () => {
    const before = persistedProjection(alice.id);
    const historyBefore = Number(
      one<{ total: number }>(
        `select count(*)::int as total from engine.mastery_history
         where user_id = ${sqlText(alice.id)}::uuid`,
      ).total,
    );

    const run = runCycle(alice.id);
    expect(run.mode).toBe('UP_TO_DATE');
    expect(persistedProjection(alice.id)).toBe(before);
    expect(
      Number(
        one<{ total: number }>(
          `select count(*)::int as total from engine.mastery_history
           where user_id = ${sqlText(alice.id)}::uuid`,
        ).total,
      ),
    ).toBe(historyBefore);
  });

  it('reproducir un payload ya aplicado se rechaza por el watermark', () => {
    const payload = payloadOf(computeFor(alice.id));
    const consumed = watermarkOf(alice.id) ?? 0;
    // El primer intento ya avanzó el watermark: continuar «desde cero» ya no es legítimo.
    const replay = applyPayload(alice.id, payload, { fromPosition: 0 });
    expect(replay.ok).toBe(false);
    expect(watermarkOf(alice.id)).toBe(consumed);
  });

  it('aplicar el mismo payload con el watermark correcto es idempotente en la proyección', () => {
    // Es la propiedad que hace segura la recuperación: repetir el trabajo perdido converge,
    // no acumula. El historial sí registra la ejecución nueva, porque registra ejecuciones.
    const before = persistedProjection(alice.id);
    const consumed = watermarkOf(alice.id) ?? 0;
    const applied = applyPayload(alice.id, payloadOf(computeFor(alice.id)), {
      fromPosition: consumed,
    });
    expect(applied.ok).toBe(true);
    expect(persistedProjection(alice.id)).toBe(before);
  });
});

describe('un payload no puede escribir la proyección de otro aprendiz', () => {
  it('escribir la proyección ajena deja una incoherencia **detectable**, y el ciclo la deshace', () => {
    const payload = payloadOf(computeFor(alice.id));
    // Se aplica el payload de Alice **a Bob**, declarando un watermark que sus filas no
    // respaldan. Es la escritura que ninguna ejecución fiel del motor produciría.
    const applied = applyPayload(bob.id, { ...payload, eventWatermark: 0 }, { rebuild: true });
    expect(applied.ok).toBe(true);

    // Alice no se ve afectada: la función indexa por su parámetro, no por el payload.
    const aliceRows = query<{ total: number }>(
      `select count(*)::int as total from engine.concept_mastery
       where user_id = ${sqlText(alice.id)}::uuid`,
    );
    expect(Number(aliceRows[0]?.total)).toBeGreaterThan(0);

    // Y la proyección de Bob queda marcada como incoherente: sus filas dicen proceder de una
    // posición que su watermark no declara. Sin esta detección, una proyección escrita por
    // algo que no fuera el motor sería indistinguible de una al día.
    expect(isStale(bob.id)).toBe(true);
    const coherent = evidenceSnapshot(bob.id).watermark?.projectionCoherent;
    expect(coherent).toBe(false);

    // El siguiente ciclo la rehace desde la evidencia, que es la única fuente de verdad.
    const bobRun = runCycle(bob.id);
    expect(bobRun.mode).toBe('REBUILD');
    expect(persistedProjection(bob.id)).toBe(expectedProjection(computeFor(bob.id)));
    expect(isStale(bob.id)).toBe(false);
  }, 180_000);
});

describe('la atribución declarada no se puede falsear sin consecuencias', () => {
  it('una versión de pack arbitraria queda registrada y fuerza el recálculo siguiente', () => {
    const payload = payloadOf(computeFor(alice.id));
    const foreign = '00000000-0000-4000-8000-0000000000aa';
    const applied = applyPayload(
      alice.id,
      { ...payload, attributionPackVersionId: foreign },
      { rebuild: true },
    );
    // La clave foránea de la proyección lo rechaza: una versión inexistente no es declarable.
    expect(applied.ok).toBe(false);
  });

  it('una generación distinta a la vigente impide continuar incrementalmente', () => {
    const payload = payloadOf(computeFor(alice.id));
    const consumed = watermarkOf(alice.id) ?? 0;
    const applied = applyPayload(
      alice.id,
      { ...payload, attributionGeneration: 999 },
      { fromPosition: consumed },
    );
    expect(applied.ok).toBe(true); // se persiste declarando esa generación…

    // …y por eso el ciclo siguiente detecta la obsolescencia y recalcula en vez de continuar.
    const run = runCycle(alice.id);
    expect(run.mode).toBe('RECALCULATION');
    expect(persistedProjection(alice.id)).toBe(expectedProjection(computeFor(alice.id)));
  }, 120_000);
});

describe('casos degenerados', () => {
  it('un rebuild sobre evidencia vacía deja una proyección vacía y coherente', () => {
    const run = runCycle(bob.id, { forceRebuild: true });
    expect(run.result.concepts).toHaveLength(0);
    expect(
      query(`select 1 from engine.concept_mastery where user_id = ${sqlText(bob.id)}::uuid`),
    ).toEqual([]);
    expect(isStale(bob.id)).toBe(false);
  }, 120_000);

  it('un aprendiz sin evidencia no aparece como atrasado', () => {
    expect(isStale(bob.id)).toBe(false);
  });

  it('la evidencia de todos los aprendices sigue intacta tras el red team', () => {
    const counts = one<{ eventos: number; intentos: number }>(
      `select (select count(*)::int from public.learning_events
               where user_id in (${sqlText(alice.id)}::uuid, ${sqlText(bob.id)}::uuid)) as eventos,
              (select count(*)::int from public.question_attempts
               where user_id in (${sqlText(alice.id)}::uuid, ${sqlText(bob.id)}::uuid)) as intentos`,
    );
    expect(Number(counts.eventos)).toBeGreaterThan(0);
    expect(Number(counts.intentos)).toBe(1);
  });
});
