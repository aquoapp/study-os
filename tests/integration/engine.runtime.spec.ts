import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// El módulo de servidor empieza con `import 'server-only'`, que lanza fuera de un bundle de
// React Server Components. Se neutraliza SOLO ese marcador y SOLO en este fichero: todo lo
// demás —el módulo, su cliente, sus llamadas a PostgREST— es el código real de producción.
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
  presentAndAnswer,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import {
  computeFor,
  evidenceSnapshot,
  expectedProjection,
  isStale,
  persistedProjection,
  sqlText,
  watermarkOf,
} from '../support/engine-fixtures';
import { query } from '../support/sql';
import {
  adminClient,
  anonClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';
import {
  ENGINE_RPC,
  computeProjection,
  projectionSignature,
  runEngineForUser,
} from '../../apps/web/src/server/engine/run';

/**
 * `engine.runtime.spec` · Phase 3.1 · D-26 · gates P3.1-G1, G2, G3, G5, G6, G7 y G8.
 *
 * **La prueba que faltaba en Phase 3.** Las suites del motor demostraban el contrato durable
 * por SQL directo y nunca ejecutaron el módulo que usa la aplicación. Ese módulo llamaba a
 * `supabase.schema('engine')`, que el Data API rechaza con `PGRST106` incluso al rol de
 * servicio, y nadie lo vio.
 *
 * Aquí se importa **`apps/web/src/server/engine/run.ts` tal cual** y se ejecuta contra
 * PostgREST real. Las dos invariantes conviven y se prueban juntas:
 *
 *   ACCESO DIRECTO A ESQUEMA PRIVADO  = DENEGADO (las llamadas exactas de `phase-3-v1.0`)
 *   INVOCACIÓN GOBERNADA DE SERVIDOR = FUNCIONA
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let alice: Learner;
let bob: Learner;
let aliceSession: CreatedSession;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p31run');
  alice = await createLearner(env, 'p31-alice', pack);
  bob = await createLearner(env, 'p31-bob', pack);
  aliceSession = await createSession(alice, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
    { item_type: 'QUESTION', target_id: question(pack, 1).questionId },
    { item_type: 'QUESTION', target_id: question(pack, 2).questionId },
  ]);
  await accept(alice, eventFor(alice, aliceSession, 'SESSION_STARTED'));
}, 300_000);

afterAll(async () => {
  if (alice) await deleteTestUser(env, alice.id);
  if (bob) await deleteTestUser(env, bob.id);
  if (pack) await purgePack(admin, pack.packId);
  // Sin residuo del motor: el borrado de la cuenta arrastra proyección, historial y watermark.
  for (const learner of [alice, bob].filter(Boolean)) {
    const rows = query<{ n: number }>(
      `select (select count(*) from engine.concept_mastery where user_id = ${sqlText(learner.id)}::uuid)
            + (select count(*) from engine.mastery_history where user_id = ${sqlText(learner.id)}::uuid)
            + (select count(*) from engine.projection_watermarks where user_id = ${sqlText(learner.id)}::uuid)
            + (select count(*) from engine.error_patterns where user_id = ${sqlText(learner.id)}::uuid) as n`,
    );
    expect(Number(rows[0]?.n)).toBe(0);
  }
}, 180_000);

function wrongOptionFor(index: number): string {
  const correct = question(pack, index).correctOptionKey;
  const wrong = ['A', 'B', 'C', 'D'].find((key) => key !== correct);
  if (!wrong) throw new Error('el fixture no ofrece ninguna opción incorrecta');
  return wrong;
}

describe('P3.1-G1 · las llamadas exactas de phase-3-v1.0 siguen denegadas', () => {
  /** Reproducción literal de cada llamada que hacía el runtime congelado. */
  const frozenCalls: Array<
    [string, () => PromiseLike<{ error: { code?: string; message: string } | null }>]
  > = [
    [
      "schema('engine').from('engine_config')",
      () =>
        admin
          .schema('engine')
          .from('engine_config')
          .select('version')
          .eq('status', 'ACTIVE')
          .limit(1),
    ],
    [
      "schema('engine').rpc('evidence_snapshot')",
      () => admin.schema('engine').rpc('evidence_snapshot', { p_user_id: alice.id }),
    ],
    [
      "schema('ingest').rpc('attribution_snapshot')",
      () =>
        admin
          .schema('ingest')
          .rpc('attribution_snapshot', { p_exam_pack_version_id: pack.versionId }),
    ],
    [
      "schema('engine').rpc('rebuild_projections')",
      () =>
        admin
          .schema('engine')
          .rpc('rebuild_projections', { p_user_id: alice.id, p_payload: {}, p_reason: 'REBUILD' }),
    ],
    [
      "schema('engine').rpc('recalculate_mastery')",
      () =>
        admin.schema('engine').rpc('recalculate_mastery', {
          p_user_id: alice.id,
          p_from_position: 0,
          p_payload: {},
          p_reason: 'INCREMENTAL',
        }),
    ],
    [
      "schema('engine').rpc('stale_users')",
      () =>
        admin.schema('engine').rpc('stale_users', { p_projection: 'concept_mastery', p_limit: 1 }),
    ],
  ];

  for (const [label, call] of frozenCalls) {
    it(`${label} · rol de servicio · PGRST106`, async () => {
      const { error } = await call();
      expect(error, 'el Data API sirvió un esquema privado').not.toBeNull();
      expect(error?.code).toBe('PGRST106');
    });
  }
});

describe('P3.1-G2 · el módulo real de servidor invoca el motor', () => {
  it('la primera ejecución proyecta la evidencia aceptada (REBUILD, watermark = stream)', async () => {
    await presentAndAnswer(
      alice,
      aliceSession,
      itemAt(aliceSession, 0),
      question(pack, 0).representationId,
      {
        option_key: question(pack, 0).correctOptionKey,
        confidence: 3,
      },
    );
    expect(isStale(alice.id)).toBe(true);

    const outcome = await runEngineForUser(alice.id, { client: admin });
    expect(outcome.kind).toBe('APPLIED');
    if (outcome.kind !== 'APPLIED') return;
    expect(outcome.rebuilt).toBe(true);

    const snapshot = evidenceSnapshot(alice.id);
    expect(outcome.watermark).toBe(Number(snapshot.maxPosition));
    expect(watermarkOf(alice.id)).toBe(Number(snapshot.maxPosition));
    expect(isStale(alice.id)).toBe(false);

    const state = query<{
      mastery_state: string;
      uncertainty: string;
      next_review_at: string | null;
    }>(
      `select mastery_state::text, uncertainty::text, next_review_at
       from engine.concept_mastery where user_id = ${sqlText(alice.id)}::uuid`,
    );
    expect(state).toHaveLength(1);
    expect(state[0]).toEqual({
      mastery_state: 'EVIDENCE_POSITIVE',
      uncertainty: 'SINGLE_OBSERVATION',
      next_review_at: null,
    });
  }, 120_000);

  it('sin cliente explícito, el módulo construye el suyo desde la configuración de servidor', async () => {
    // Es la ruta exacta de la aplicación: `tryCreateEngineClient()` → `readServerConfig()`.
    const outcome = await runEngineForUser(alice.id);
    expect(outcome).toEqual({ kind: 'UP_TO_DATE', watermark: watermarkOf(alice.id) });
  }, 60_000);
});

describe('P3.1-G3 / G5 / G6 · incremental, repetición y rebuild', () => {
  it('evidencia nueva ⇒ continuación INCREMENTAL, idéntica a lo que un rebuild calcula', async () => {
    await presentAndAnswer(
      alice,
      aliceSession,
      itemAt(aliceSession, 1),
      question(pack, 1).representationId,
      {
        option_key: wrongOptionFor(1),
        confidence: 4,
      },
    );
    const outcome = await runEngineForUser(alice.id, { client: admin });
    expect(outcome.kind).toBe('APPLIED');
    if (outcome.kind === 'APPLIED') expect(outcome.rebuilt).toBe(false);

    // EC-006 en los dos planos: lo persistido == pliegue completo por el arnés SQL == pliegue
    // completo por el propio módulo de servidor.
    const persisted = persistedProjection(alice.id);
    expect(persisted).toBe(expectedProjection(computeFor(alice.id)));
    const fromModule = await computeProjection(alice.id, admin);
    expect(fromModule).not.toBeNull();
    if (fromModule) expect(persisted).toBe(expectedProjection(fromModule));
  }, 120_000);

  it('repetir la invocación no escribe nada y devuelve lo mismo', async () => {
    const before = persistedProjection(alice.id);
    const historyBefore = query<{ n: number }>(
      `select count(*)::int as n from engine.mastery_history where user_id = ${sqlText(alice.id)}::uuid`,
    )[0]?.n;
    for (let i = 0; i < 3; i += 1) {
      const outcome = await runEngineForUser(alice.id, { client: admin });
      expect(outcome.kind).toBe('UP_TO_DATE');
    }
    expect(persistedProjection(alice.id)).toBe(before);
    const historyAfter = query<{ n: number }>(
      `select count(*)::int as n from engine.mastery_history where user_id = ${sqlText(alice.id)}::uuid`,
    )[0]?.n;
    expect(historyAfter).toBe(historyBefore);
  }, 120_000);

  it('un rebuild forzado desde el módulo deja exactamente la misma proyección', async () => {
    const incremental = persistedProjection(alice.id);
    const signatureBefore = projectionSignature((await computeProjection(alice.id, admin))!);
    const outcome = await runEngineForUser(alice.id, { client: admin, forceRebuild: true });
    expect(outcome.kind).toBe('APPLIED');
    if (outcome.kind === 'APPLIED') expect(outcome.rebuilt).toBe(true);
    expect(persistedProjection(alice.id)).toBe(incremental);
    expect(projectionSignature((await computeProjection(alice.id, admin))!)).toBe(signatureBefore);
  }, 120_000);

  it('una proyección atrasada (invocación perdida) se recupera y converge con el rebuild', async () => {
    // La ruta A "se pierde": la evidencia se acepta y nadie invoca el motor.
    await presentAndAnswer(
      alice,
      aliceSession,
      itemAt(aliceSession, 2),
      question(pack, 2).representationId,
      { blank: true },
    );
    expect(isStale(alice.id)).toBe(true);

    const stale = await admin.rpc(ENGINE_RPC.staleUsers, {
      p_projection: 'concept_mastery',
      p_limit: 1000,
    });
    expect(stale.error).toBeNull();
    const listed = (stale.data as Array<{ user_id: string; reason: string }>).find(
      (row) => row.user_id === alice.id,
    );
    expect(listed?.reason).toBe('BEHIND');

    const outcome = await runEngineForUser(alice.id, { client: admin });
    expect(outcome.kind).toBe('APPLIED');
    expect(isStale(alice.id)).toBe(false);
    expect(persistedProjection(alice.id)).toBe(expectedProjection(computeFor(alice.id)));
  }, 120_000);
});

describe('P3.1-G7 / G8 · la frontera corregida no amplía ninguna autoridad', () => {
  const calls: Array<[string, (userId: string) => Record<string, unknown>]> = [
    [ENGINE_RPC.activeConfigVersion, () => ({})],
    [ENGINE_RPC.evidenceSnapshot, (userId) => ({ p_user_id: userId })],
    [ENGINE_RPC.attributionSnapshot, () => ({ p_exam_pack_version_id: pack.versionId })],
    [
      ENGINE_RPC.rebuildProjections,
      (userId) => ({ p_user_id: userId, p_payload: {}, p_reason: 'REBUILD' }),
    ],
    [
      ENGINE_RPC.recalculateMastery,
      (userId) => ({
        p_user_id: userId,
        p_from_position: 0,
        p_payload: {},
        p_reason: 'INCREMENTAL',
      }),
    ],
    [ENGINE_RPC.staleUsers, () => ({ p_projection: 'concept_mastery', p_limit: 5 })],
  ];

  for (const [name, args] of calls) {
    it(`${name} · anon · denegado`, async () => {
      const { data, error } = await anonClient(env).rpc(name, args(bob.id));
      expect(error, 'anon ejecutó un punto de entrada del motor').not.toBeNull();
      expect(data).toBeNull();
    });

    it(`${name} · aprendiz autenticado, sobre otra persona y sobre sí mismo · denegado`, async () => {
      for (const target of [bob.id, alice.id]) {
        const { data, error } = await alice.client.rpc(name, args(target));
        expect(
          error,
          'un cliente autenticado ejecutó un punto de entrada del motor',
        ).not.toBeNull();
        expect(error?.code).toBe('42501');
        expect(data).toBeNull();
      }
    });
  }

  it('un cliente no puede provocar la proyección de otra persona', async () => {
    expect(watermarkOf(bob.id)).toBeNull();
    await alice.client.rpc(ENGINE_RPC.rebuildProjections, {
      p_user_id: bob.id,
      p_payload: {},
      p_reason: 'REBUILD',
    });
    await alice.client.rpc(ENGINE_RPC.recalculateMastery, {
      p_user_id: bob.id,
      p_from_position: 0,
      p_payload: {},
      p_reason: 'INCREMENTAL',
    });
    const rows = query<{ n: number }>(
      `select count(*)::int as n from engine.projection_watermarks where user_id = ${sqlText(bob.id)}::uuid`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('el catálogo confirma: invoker, search_path vacío y EXECUTE solo para el rol de servicio', () => {
    const rows = query<{ proname: string; prosecdef: boolean; config: string; acl: string }>(
      `select p.proname, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') as config,
              coalesce(p.proacl::text, '') as acl
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'engine\\_%' order by p.proname`,
    );
    // Phase 4A (2026-09-19) añade `engine_planner_snapshot`, con la misma forma: invoker, search_path
    // vacío y EXECUTE solo para el rol de servicio. Es la única entrada nueva.
    expect(rows.map((row) => row.proname).sort()).toEqual(
      [...Object.values(ENGINE_RPC), 'engine_planner_snapshot'].sort(),
    );
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} es SECURITY DEFINER`).toBe(false);
      expect(row.config).toBe('search_path=""');
      const grantees = [...row.acl.matchAll(/([a-z_]*)=X/g)]
        .map((match) => match[1])
        .filter((role) => role !== 'postgres');
      expect(grantees, `${row.proname}: EXECUTE a ${grantees.join(',')}`).toEqual(['service_role']);
    }
  });

  it('ningún punto de entrada devuelve claves de respuesta', async () => {
    const snapshot = await admin.rpc(ENGINE_RPC.evidenceSnapshot, { p_user_id: alice.id });
    expect(snapshot.error).toBeNull();
    const text = JSON.stringify(snapshot.data);
    expect(text).not.toMatch(/correct_option|answer_key|correctOption|explanation/);
    const attribution = await admin.rpc(ENGINE_RPC.attributionSnapshot, {
      p_exam_pack_version_id: pack.versionId,
    });
    expect(attribution.error).toBeNull();
    for (const row of attribution.data as Array<Record<string, unknown>>) {
      expect(Object.keys(row).sort()).toEqual(['concept_id', 'generation', 'question_id']);
    }
  });

  it('el estado del motor sigue sin ser legible por el aprendiz', async () => {
    for (const table of [
      'concept_mastery',
      'projection_watermarks',
      'mastery_history',
      'error_patterns',
    ]) {
      const { error } = await alice.client.schema('engine').from(table).select('user_id');
      expect(error?.code).toBe('PGRST106');
    }
  });
});
