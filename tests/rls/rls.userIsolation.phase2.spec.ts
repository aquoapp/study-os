import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Solo se neutraliza el marcador `server-only` del módulo real del Planner.
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
  publishLearningUnit,
  type Learner,
} from '../support/phase2-fixtures';
import { query } from '../support/sql';
import {
  adminClient,
  anonClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';
import { requestPlanForUser, type DurationSource } from '../../apps/web/src/server/planner/run';

/**
 * `rls.userIsolation.phase2.spec` · EC-009 · REQ-C13 · gate P2-G6 · fallo duro.
 *
 * «Toda tabla expuesta con `user_id` lleva RLS y su test de aislamiento.» Dirigida por el
 * catálogo: la lista de tablas con propietario se lee de `information_schema`, de modo que
 * una tabla de usuario nueva queda cubierta sin que nadie tenga que acordarse de añadirla.
 *
 * Dos aprendices reales, con datos reales en **todas** las tablas con propietario, creados
 * por las mismas rutas que usaría el producto: preferencias y objetivo por PostgREST,
 * sesiones por `create_study_session`, evidencia e intentos por `append_learning_event`.
 *
 * Para cada tabla se exige:
 *   1. cada aprendiz ve sus filas (si no hubiera ninguna, «cero filas ajenas» sería trivial);
 *   2. A no ve ninguna fila de B, ni pidiéndolas por su `user_id`;
 *   3. A no puede robar una fila de B (`update … set user_id = A where user_id = B`);
 *   4. A no puede borrar filas de B;
 *   5. A no puede insertar una fila a nombre de B;
 *   6. `anon` no lee nada.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let alice: Learner;
let bob: Learner;

/** Tablas con propietario, leídas del catálogo. */
const ownedTables = query<{ table: string }>(
  "select table_name as table from information_schema.columns where table_schema = 'public' and column_name = 'user_id' order by 1",
).map((row) => row.table);

/**
 * Phase 4A (2026-09-19) · tablas con propietario que **no** están expuestas a la persona: sin
 * ninguna concesión de columna a `authenticated`. Hoy es solo la auditoría del Planner (Planner
 * Contract §S, §U.5). Se leen del catálogo, y para ellas el aislamiento se prueba como denegación
 * total: ni la persona ni `anon` leen, y nadie de cliente escribe.
 */
const serverOnlyTables = new Set(
  query<{ table: string }>(
    // Por OID y no por nombre: el optimizador puede evaluar la función antes que el filtro de
    // esquema, y un nombre calificado a mano fallaría sobre tablas de otros esquemas.
    'select c.relname as table from pg_class c join pg_namespace n on n.oid = c.relnamespace ' +
      "where n.nspname = 'public' and c.relkind = 'r' " +
      "and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped) " +
      "and not has_any_column_privilege('authenticated', c.oid, 'SELECT') order by 1",
  ).map((row) => row.table),
);

/** Duraciones de fixture para sembrar el Planner: datos de prueba (P4-D2 diferida). */
const FIXTURE_DURATIONS: DurationSource = {
  provenance: 'FIXTURE',
  minutesFor: ({ learningUnitIds, questionIds }) => ({
    units: new Map(learningUnitIds.map((id) => [id, 5])),
    questions: new Map(questionIds.map((id) => [id, 3])),
  }),
};

/** Una ejecución real del Planner, por el módulo real, antes de abrir ninguna sesión. */
async function seedPlanner(learner: Learner): Promise<void> {
  const tz = await learner.client
    .from('profiles')
    .update({ timezone: 'Europe/Madrid' })
    .eq('id', learner.id);
  if (tz.error) throw new Error(`timezone: ${tz.error.message}`);
  const outcome = await requestPlanForUser(learner.id, {
    client: admin,
    durations: FIXTURE_DURATIONS,
  });
  if (outcome.kind !== 'RUN' || outcome.outcome !== 'PLANNED') {
    throw new Error(`planner: ${outcome.kind === 'RUN' ? outcome.outcome : outcome.kind}`);
  }
}

/** Datos completos del aprendiz: preferencias, objetivo, dispositivo, diagnóstico, sesión, evidencia e intento. */
async function seedEverything(learner: Learner): Promise<void> {
  const goal = await learner.client
    .from('diagnostic_runs')
    .insert({
      user_id: learner.id,
      learner_exam_goal_id: learner.goalId,
      diagnostic_version: 'v1',
    })
    .select('id')
    .single();
  if (goal.error) throw new Error(`diagnostic_runs: ${goal.error.message}`);

  const session = await createSession(learner, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
  ]);
  await accept(learner, eventFor(learner, session, 'SESSION_STARTED'));
  await presentAndAnswer(learner, session, itemAt(session, 0), question(pack, 0).representationId, {
    option_key: 'A',
    confidence: 3,
  });
}

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2rls');
  // Una unidad publicada para que el Planner tenga algo que planificar (Phase 4A).
  await publishLearningUnit(admin, pack, 0, 'p2rls-u0');
  alice = await createLearner(env, 'rls-alice', pack);
  bob = await createLearner(env, 'rls-bob', pack);
  await seedPlanner(alice);
  await seedPlanner(bob);
  await seedEverything(alice);
  await seedEverything(bob);
}, 300_000);

afterAll(async () => {
  for (const learner of [alice, bob]) if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('el catálogo aporta las tablas con propietario', () => {
  it('están las nueve de Phase 2 y el perfil queda fuera (su clave es id, no user_id)', () => {
    for (const expected of [
      'learner_settings',
      'learner_exam_goals',
      'devices',
      'sync_state',
      'diagnostic_runs',
      'study_sessions',
      'session_items',
      'learning_events',
      'question_attempts',
    ]) {
      expect(ownedTables, `falta ${expected}`).toContain(expected);
    }
    expect(ownedTables.length).toBeGreaterThanOrEqual(9);
  });
});

describe('Phase 4A · la auditoría del Planner no está expuesta', () => {
  it('el catálogo la identifica como tabla de solo servidor, y es la única', () => {
    expect([...serverOnlyTables]).toEqual(['planner_run_audit']);
  });

  for (const table of ['planner_run_audit']) {
    it(`public.${table} · ni la persona ni anon leen ni escriben, aunque existan filas`, async () => {
      const rows = query<{ n: number }>(
        `select count(*)::int as n from public.${table} where user_id in ('${alice.id}', '${bob.id}')`,
      );
      expect(Number(rows[0]?.n)).toBe(2);
      for (const client of [alice.client, bob.client, anonClient(env)]) {
        const { error } = await client.from(table).select('user_id').limit(1);
        expect(error?.code).toBe('42501');
      }
      const insert = await alice.client.from(table).insert({ user_id: bob.id });
      expect(insert.error?.code).toBe('42501');
      const remove = await alice.client.from(table).delete().eq('user_id', bob.id);
      expect(remove.error?.code).toBe('42501');
    });
  }
});

for (const table of ownedTables.filter((name) => !serverOnlyTables.has(name))) {
  describe(`public.${table} · aislamiento entre usuarios`, () => {
    it('cada aprendiz ve sus propias filas', async () => {
      for (const learner of [alice, bob]) {
        const { data, error } = await learner.client.from(table).select('user_id');
        expect(error, `${table}: ${error?.message}`).toBeNull();
        expect(data?.length ?? 0, `${table}: el aprendiz no tiene filas propias`).toBeGreaterThan(
          0,
        );
        expect(
          (data ?? []).every((row) => (row as { user_id: string }).user_id === learner.id),
          `${table}: se coló una fila ajena`,
        ).toBe(true);
      }
    });

    it('Alice no lee las filas de Bob, ni pidiéndolas por su user_id', async () => {
      const { data, error } = await alice.client
        .from(table)
        .select('user_id')
        .eq('user_id', bob.id);
      // RLS no produce error: filtra. El conjunto vacío ES la denegación.
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('Alice no puede robar una fila de Bob', async () => {
      const { data, error } = await alice.client
        .from(table)
        .update({ user_id: alice.id })
        .eq('user_id', bob.id)
        .select('user_id');
      // O bien no tiene UPDATE (42501), o bien RLS no le deja ver ninguna fila que tocar.
      if (error) expect(error.code, `${table}: ${error.message}`).toBe('42501');
      else expect(data).toHaveLength(0);
      // Y las filas de Bob siguen siendo de Bob.
      const { data: bobRows } = await bob.client.from(table).select('user_id');
      expect((bobRows ?? []).length).toBeGreaterThan(0);
      expect((bobRows ?? []).every((row) => (row as { user_id: string }).user_id === bob.id)).toBe(
        true,
      );
    });

    it('Alice no puede borrar filas de Bob', async () => {
      const { data, error } = await alice.client
        .from(table)
        .delete()
        .eq('user_id', bob.id)
        .select('user_id');
      if (error) expect(error.code, `${table}: ${error.message}`).toBe('42501');
      else expect(data).toHaveLength(0);
      const { data: bobRows } = await bob.client.from(table).select('user_id');
      expect((bobRows ?? []).length).toBeGreaterThan(0);
    });

    it('Alice no puede insertar una fila a nombre de Bob', async () => {
      const { error } = await alice.client.from(table).insert({ user_id: bob.id });
      expect(
        error,
        `${table}: la inserción a nombre de otro usuario no fue rechazada`,
      ).not.toBeNull();
      // 42501 = sin privilegio o violación de WITH CHECK; 23xxx = restricción de integridad
      // alcanzada antes. Lo que no puede ocurrir es que la fila entre.
      expect(error?.code ?? '').toMatch(/^(42501|23\d{3}|PGRST\d+)$/);
      const { data: bobRows } = await bob.client.from(table).select('user_id');
      expect((bobRows ?? []).every((row) => (row as { user_id: string }).user_id === bob.id)).toBe(
        true,
      );
    });

    it('anon no lee nada', async () => {
      const { data, error } = await anonClient(env).from(table).select('user_id').limit(1);
      expect(data ?? []).toHaveLength(0);
      if (error) expect(error.message).toBeTruthy();
    });
  });
}

describe('la evidencia y las sesiones no se escriben por vía directa', () => {
  // CDEM §22 · «study sessions/items: owner via validated app flow»; «learning events: owner
  // insert, no normal update/delete»; «attempts: trusted ingestion path». En Phase 2 eso se
  // concreta en: ninguna tabla de evidencia acepta INSERT de cliente, ni siquiera propio.
  for (const table of [
    'study_sessions',
    'session_items',
    'learning_events',
    'question_attempts',
    'sync_state',
  ]) {
    it(`${table} rechaza un INSERT del propio dueño`, async () => {
      const { error } = await alice.client.from(table).insert({ user_id: alice.id });
      expect(error, `${table}: aceptó una escritura directa de cliente`).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it(`${table} rechaza un UPDATE del propio dueño`, async () => {
      const { error } = await alice.client
        .from(table)
        .update({ user_id: alice.id })
        .eq('user_id', alice.id);
      expect(error, `${table}: aceptó una modificación directa de cliente`).not.toBeNull();
      expect(error?.code).toBe('42501');
    });
  }
});

describe('las preferencias del aprendiz se escriben solas y solo las propias', () => {
  it('Alice actualiza su fila de preferencias', async () => {
    const { error } = await alice.client
      .from('learner_settings')
      .update({ default_daily_minutes: 45 })
      .eq('user_id', alice.id);
    expect(error).toBeNull();
    const { data } = await alice.client
      .from('learner_settings')
      .select('default_daily_minutes')
      .single();
    expect(data?.default_daily_minutes).toBe(45);
  });

  it('cambiar la disponibilidad no borra evidencia (REQ-C03)', async () => {
    const before = await alice.client.from('learning_events').select('event_id');
    const { error } = await alice.client
      .from('learner_settings')
      .update({ weekly_availability_json: { mon: 90, tue: 30 }, default_daily_minutes: 60 })
      .eq('user_id', alice.id);
    expect(error).toBeNull();
    const after = await alice.client.from('learning_events').select('event_id');
    expect(after.data?.length).toBe(before.data?.length);
    expect((after.data?.length ?? 0) > 0).toBe(true);
  });

  it('una disponibilidad malformada se rechaza sin tocar la fila', async () => {
    const { error } = await alice.client
      .from('learner_settings')
      .update({ weekly_availability_json: { lunes: 30 } })
      .eq('user_id', alice.id);
    expect(error).not.toBeNull();
    const { data } = await alice.client
      .from('learner_settings')
      .select('default_daily_minutes')
      .single();
    expect(data?.default_daily_minutes).toBe(60);
  });

  it('un segundo objetivo ACTIVE del mismo aprendiz se rechaza (CDEM §8)', async () => {
    const { error } = await alice.client
      .from('learner_exam_goals')
      .insert({ user_id: alice.id, exam_pack_id: pack.packId, status: 'ACTIVE' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('un dispositivo con el mismo installation_id del mismo aprendiz se rechaza; el de otro aprendiz no colisiona', async () => {
    const installation = `inst-${randomUUID()}`;
    const first = await alice.client
      .from('devices')
      .insert({ user_id: alice.id, installation_id: installation });
    expect(first.error).toBeNull();
    const duplicate = await alice.client
      .from('devices')
      .insert({ user_id: alice.id, installation_id: installation });
    expect(duplicate.error?.code).toBe('23505');
    // La unicidad es por (usuario, instalación): otro aprendiz puede repetirla.
    const other = await bob.client
      .from('devices')
      .insert({ user_id: bob.id, installation_id: installation });
    expect(other.error).toBeNull();
  });
});
