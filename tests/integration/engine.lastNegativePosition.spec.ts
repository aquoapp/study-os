import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// El módulo de servidor empieza con `import 'server-only'`. Se neutraliza SOLO ese marcador: el
// resto —el módulo, su cliente, sus llamadas por la frontera gobernada— es código de producción.
vi.mock('server-only', () => ({}));

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
  itemEvent,
  presentAndAnswer,
  publishLearningUnit,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import {
  applyPayload,
  computeFor,
  expectedProjection,
  payloadOf,
  persistedProjection,
  sqlText,
} from '../support/engine-fixtures';
import { query } from '../support/sql';
import {
  adminClient,
  anonClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';
import { runEngineForUser } from '../../apps/web/src/server/engine/run';

/**
 * `engine.lastNegativePosition.spec` · P4-D6 · contrato del motor v1.1 §25, en la frontera real.
 *
 * El hecho lo calcula el pliegue de TypeScript y lo persiste la función de servidor, **a través del
 * módulo real** (`runEngineForUser`), contra PostgREST y la base reales. Se prueba lo que el
 * contrato exige y lo que el BUILD de Phase 4A necesita de él:
 *
 *   - la posición persistida es la del último intento elegible no correcto, por concepto;
 *   - `rebuild == incremental` también para este campo (EC-006);
 *   - la base rechaza una proyección que viole la invariante del anexo §25.2;
 *   - leer, abrir y terminar una unidad **no** mueve la posición;
 *   - un fallo nuevo la mueve exactamente a su posición de stream;
 *   - ningún cliente puede leerla ni escribirla.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let alice: Learner;
let unitVersionId: string;
let first: CreatedSession;

interface Row {
  concept_id: string;
  mastery_state: string;
  last_negative_position: string | number | null;
}

function projectionRows(userId: string): Map<string, Row> {
  const rows = query<Row>(
    `select concept_id::text, mastery_state::text, last_negative_position
       from engine.concept_mastery where user_id = ${sqlText(userId)}::uuid`,
  );
  return new Map(rows.map((row) => [row.concept_id, row]));
}

const positionOf = (userId: string, conceptId: string): number | null => {
  const row = projectionRows(userId).get(conceptId);
  if (!row) throw new Error(`sin fila de proyección para ${conceptId}`);
  return row.last_negative_position === null ? null : Number(row.last_negative_position);
};

function wrongOptionFor(index: number): string {
  const correct = question(pack, index).correctOptionKey;
  const wrong = ['A', 'B', 'C', 'D'].find((key) => key !== correct);
  if (!wrong) throw new Error('el fixture no ofrece ninguna opción incorrecta');
  return wrong;
}

let q0WrongPosition = 0;
let q1WrongPosition = 0;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p4d6');
  ({ versionId: unitVersionId } = await publishLearningUnit(admin, pack, 0, 'p4d6-unidad'));
  const units = query<{ id: string }>(
    `select learning_unit_id::text as id from public.learning_unit_versions
       where id = ${sqlText(unitVersionId)}::uuid`,
  );
  const unitId = units[0]?.id;
  if (!unitId) throw new Error('no se publicó la unidad');
  alice = await createLearner(env, 'p4d6-alice', pack);

  first = await createSession(alice, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
    { item_type: 'QUESTION', target_id: question(pack, 1).questionId },
    { item_type: 'QUESTION', target_id: question(pack, 2).questionId },
    { item_type: 'LEARNING_UNIT', target_id: unitId },
  ]);
  await accept(alice, eventFor(alice, first, 'SESSION_STARTED'));
  const q0 = await presentAndAnswer(
    alice,
    first,
    itemAt(first, 0),
    question(pack, 0).representationId,
    {
      option_key: wrongOptionFor(0),
    },
  );
  const q1 = await presentAndAnswer(
    alice,
    first,
    itemAt(first, 1),
    question(pack, 1).representationId,
    {
      option_key: wrongOptionFor(1),
    },
  );
  await presentAndAnswer(alice, first, itemAt(first, 2), question(pack, 2).representationId, {
    option_key: question(pack, 2).correctOptionKey,
  });
  q0WrongPosition = Number(q0.stream_position);
  q1WrongPosition = Number(q1.stream_position);
}, 300_000);

afterAll(async () => {
  if (alice) await deleteTestUser(env, alice.id);
  if (pack) await purgePack(admin, pack.packId);
  if (alice) {
    const rows = query<{ n: number }>(
      `select (select count(*) from engine.concept_mastery where user_id = ${sqlText(alice.id)}::uuid)
            + (select count(*) from engine.projection_watermarks where user_id = ${sqlText(alice.id)}::uuid)
            + (select count(*) from engine.mastery_history where user_id = ${sqlText(alice.id)}::uuid) as n`,
    );
    expect(Number(rows[0]?.n)).toBe(0);
  }
}, 180_000);

describe('P4-D6 · el módulo real persiste la posición', () => {
  it('cada concepto guarda la posición de su último fallo, y el positivo guarda null', async () => {
    const outcome = await runEngineForUser(alice.id);
    expect(outcome.kind).toBe('APPLIED');

    expect(positionOf(alice.id, pack.conceptIds[0]!)).toBe(q0WrongPosition);
    expect(positionOf(alice.id, pack.conceptIds[1]!)).toBe(q1WrongPosition);
    expect(positionOf(alice.id, pack.conceptIds[2]!)).toBeNull();

    const rows = projectionRows(alice.id);
    expect(rows.get(pack.conceptIds[0]!)?.mastery_state).toBe('EVIDENCE_NEGATIVE');
    expect(rows.get(pack.conceptIds[2]!)?.mastery_state).toBe('EVIDENCE_POSITIVE');
  });

  it('EC-006 · lo persistido es el pliegue completo, y un rebuild forzado lo deja idéntico', async () => {
    const incremental = persistedProjection(alice.id);
    expect(incremental).toBe(expectedProjection(computeFor(alice.id)));
    expect(incremental).toContain('"lastNegativePosition":');

    const rebuilt = await runEngineForUser(alice.id, { forceRebuild: true });
    expect(rebuilt.kind).toBe('APPLIED');
    expect(persistedProjection(alice.id)).toBe(incremental);
  });
});

describe('P4-D6 · la base impone la invariante del anexo §25.2', () => {
  it('rechaza un concepto en reparación sin posición', () => {
    const result = computeFor(alice.id);
    const payload = payloadOf(result) as { concepts: Array<Record<string, unknown>> };
    const tampered = {
      ...payload,
      concepts: payload.concepts.map((concept) =>
        concept['masteryState'] === 'EVIDENCE_NEGATIVE'
          ? { ...concept, lastNegativePosition: null }
          : concept,
      ),
    };
    const outcome = applyPayload(alice.id, tampered, { rebuild: true });
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('concept_mastery_last_negative_iff_remediation');
  });

  it('rechaza una posición en un concepto positivo', () => {
    const payload = payloadOf(computeFor(alice.id)) as { concepts: Array<Record<string, unknown>> };
    const tampered = {
      ...payload,
      concepts: payload.concepts.map((concept) =>
        concept['masteryState'] === 'EVIDENCE_POSITIVE'
          ? { ...concept, lastNegativePosition: 1 }
          : concept,
      ),
    };
    expect(applyPayload(alice.id, tampered, { rebuild: true }).ok).toBe(false);
  });

  it('rechaza una posición posterior al watermark', () => {
    const result = computeFor(alice.id);
    const payload = payloadOf(result) as { concepts: Array<Record<string, unknown>> };
    const tampered = {
      ...payload,
      concepts: payload.concepts.map((concept) =>
        concept['lastNegativePosition'] === null
          ? concept
          : { ...concept, lastNegativePosition: Number(result.eventWatermark) + 1000 },
      ),
    };
    const outcome = applyPayload(alice.id, tampered, { rebuild: true });
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('concept_mastery_last_negative_within_watermark');
  });

  it('tras los rechazos, la proyección persistida sigue siendo la del pliegue', () => {
    expect(persistedProjection(alice.id)).toBe(expectedProjection(computeFor(alice.id)));
  });
});

describe('P4-D5 + P4-D6 · solo la evidencia mueve la clave', () => {
  it('leer y terminar una unidad del concepto no la mueve', async () => {
    const before = positionOf(alice.id, pack.conceptIds[0]!);
    const unitItem = itemAt(first, 3);
    await accept(
      alice,
      itemEvent(alice, first, unitItem, 'LEARNING_UNIT_VIEWED', {
        learning_unit_version_id: unitVersionId,
      }),
    );
    await accept(alice, itemEvent(alice, first, unitItem, 'LEARNING_UNIT_COMPLETED', {}));
    const outcome = await runEngineForUser(alice.id);
    expect(outcome.kind).toBe('APPLIED');
    // La exposición sí se registra en el vector …
    const vector = query<{ completed: number }>(
      `select (vector ->> 'exposureCompletedCount')::int as completed from engine.concept_mastery
         where user_id = ${sqlText(alice.id)}::uuid and concept_id = ${sqlText(pack.conceptIds[0]!)}::uuid`,
    );
    expect(Number(vector[0]?.completed)).toBe(1);
    // … y la clave no se mueve.
    expect(positionOf(alice.id, pack.conceptIds[0]!)).toBe(before);
  });

  it('un fallo nuevo la mueve exactamente a su posición de stream', async () => {
    await accept(alice, eventFor(alice, first, 'SESSION_COMPLETED'));
    const second = await createSession(alice, [
      { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
    ]);
    await accept(alice, eventFor(alice, second, 'SESSION_STARTED'));
    const again = await presentAndAnswer(
      alice,
      second,
      itemAt(second, 0),
      question(pack, 0).representationId,
      { option_key: wrongOptionFor(0) },
    );
    const outcome = await runEngineForUser(alice.id);
    expect(outcome.kind).toBe('APPLIED');
    expect(positionOf(alice.id, pack.conceptIds[0]!)).toBe(Number(again.stream_position));
    expect(Number(again.stream_position)).toBeGreaterThan(q0WrongPosition);
    // Los demás conceptos no cambian.
    expect(positionOf(alice.id, pack.conceptIds[1]!)).toBe(q1WrongPosition);
    expect(positionOf(alice.id, pack.conceptIds[2]!)).toBeNull();
    // Y sigue siendo el pliegue completo.
    expect(persistedProjection(alice.id)).toBe(expectedProjection(computeFor(alice.id)));
  });
});

describe('P4-D6 · frontera · ningún cliente alcanza el hecho', () => {
  it('anon y la persona autenticada no leen el esquema del motor', async () => {
    for (const client of [anonClient(env), alice.client]) {
      const { error } = await client
        .schema('engine')
        .from('concept_mastery')
        .select('last_negative_position')
        .limit(1);
      expect(error, 'el esquema engine no debe servirse').not.toBeNull();
    }
  });

  it('ni la persona ni anon pueden invocar la persistencia del motor', async () => {
    for (const client of [anonClient(env), alice.client]) {
      const { error } = await client.rpc('engine_rebuild_projections', {
        p_user_id: alice.id,
        p_payload: {},
        p_reason: 'REBUILD',
      });
      expect(error).not.toBeNull();
    }
  });
});
