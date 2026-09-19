import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Solo se neutraliza el marcador `server-only` de los módulos reales del Planner.
vi.mock('server-only', () => ({}));
vi.setConfig({ testTimeout: 180_000 });

import {
  buildSyntheticPack,
  purgePack,
  question,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import {
  accept,
  closeOpenSessions,
  createLearner,
  eventFor,
  publishLearningUnit,
  rpc,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { attack, query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';
import { requestPlanForUser, type DurationSource } from '../../apps/web/src/server/planner/run';
import { startPlannedSession } from '../../apps/web/src/server/planner/start';

/**
 * `session.oneOpenPerLearner.spec` · P4-G10 · EC-019 · decisión humana del 2026-09-19 (OBS-4A-B2,
 * opción B).
 *
 * **Como mucho una sesión abierta por persona**, impuesta por la base de datos para todo origen:
 * la RPC congelada de Phase 2 (`create_study_session`, que usa el FPS) y el arranque planificado
 * del Planner. «Abierta» es la familia autoritativa existente: `PLANNED`, `ACTIVE`, `INTERRUPTED`
 * (CDEM §9; el FPS la usa en `findOpenSession`).
 *
 * Todo pasa por las fronteras reales —PostgREST con el token de la persona, el módulo real del
 * Planner— salvo el caso 5b, que ataca la base **por debajo** de las funciones para probar que la
 * garantía no depende de ellas.
 */

let env: TestEnv;
let admin: SupabaseClient;
let pack: SyntheticPack;
let lia: Learner;
let max: Learner;

const FIXTURE: DurationSource = {
  provenance: 'FIXTURE',
  minutesFor: ({ learningUnitIds, questionIds }) => ({
    units: new Map(learningUnitIds.map((id) => [id, 5])),
    questions: new Map(questionIds.map((id) => [id, 3])),
  }),
};

const OPEN = "('PLANNED', 'ACTIVE', 'INTERRUPTED')";
const openCount = (learner: Learner) =>
  Number(
    query<{ n: number }>(
      `select count(*)::int as n from public.study_sessions
        where user_id = '${learner.id}' and status in ${OPEN}`,
    )[0]?.n,
  );

/** La RPC congelada de Phase 2, tal como la invoca el FPS: sin cerrar nada antes. */
const fpsCreate = (learner: Learner) =>
  rpc<CreatedSession>(learner.client, 'create_study_session', {
    p_goal_id: learner.goalId,
    p_session_type: 'FPS_FIXED',
    p_items: [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }],
  });

const EXCLUSION = 'study_sessions_one_open_per_user';

async function currentRun(learner: Learner): Promise<string> {
  const outcome = await requestPlanForUser(learner.id, { client: admin, durations: FIXTURE });
  if (outcome.kind !== 'RUN' || outcome.outcome !== 'PLANNED') {
    throw new Error(`plan: ${outcome.kind === 'RUN' ? outcome.outcome : outcome.kind}`);
  }
  return outcome.runId;
}

/** Nueva ejecución distinta de la actual: cambia la disponibilidad declarada. */
async function supersedingRun(learner: Learner, minutes: number): Promise<string> {
  const update = await learner.client
    .from('learner_settings')
    .update({ default_daily_minutes: minutes })
    .eq('user_id', learner.id);
  if (update.error) throw new Error(update.error.message);
  return currentRun(learner);
}

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p4g10');
  // Unidades solo para los conceptos 0 y 1: el concepto 2 tiene pregunta PRIMARY y ninguna unidad,
  // que es el caso de `NO_PUBLISHED_UNIT` (OBS-4A-B1).
  for (const index of [0, 1]) await publishLearningUnit(admin, pack, index, `p4g10-u${index}`);
  lia = await createLearner(env, 'p4g10-lia', pack);
  max = await createLearner(env, 'p4g10-max', pack);
  for (const learner of [lia, max]) {
    const tz = await learner.client
      .from('profiles')
      .update({ timezone: 'Europe/Madrid' })
      .eq('id', learner.id);
    if (tz.error) throw new Error(tz.error.message);
    const settings = await learner.client
      .from('learner_settings')
      .update({ weekly_availability_json: {}, default_daily_minutes: 40 })
      .eq('user_id', learner.id);
    if (settings.error) throw new Error(settings.error.message);
  }
}, 600_000);

afterAll(async () => {
  // La cuenta arrastra sesiones abiertas, ejecuciones e ítems: la FK RESTRICT de la sesión
  // hacia su ejecución no impide el borrado de cuenta.
  for (const learner of [lia, max]) if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
  for (const learner of [lia, max]) {
    if (!learner) continue;
    const residue = query<{ n: number }>(
      `select (select count(*) from public.study_sessions where user_id = '${learner.id}')
            + (select count(*) from public.planner_runs where user_id = '${learner.id}') as n`,
    );
    expect(Number(residue[0]?.n)).toBe(0);
  }
}, 300_000);

describe('P4-G10 · los diez casos', () => {
  it('1 · sin sesión abierta, crear una sesión funciona', async () => {
    expect((await fpsCreate(lia)).error).toBeNull();
    expect(openCount(lia)).toBe(1);
  });

  it('2 · con una sesión ajena al Planner abierta, otra ajena al Planner se rechaza', async () => {
    const second = await fpsCreate(lia);
    expect(second.error?.message).toContain(EXCLUSION);
    expect(openCount(lia)).toBe(1);
  });

  it('3 · con una sesión ajena al Planner abierta, la planificada no arranca', async () => {
    await closeOpenSessions(lia);
    const run = await currentRun(lia);
    expect((await fpsCreate(lia)).error).toBeNull();
    expect((await startPlannedSession(lia.id, run, { client: admin })).kind).toBe('OPEN_SESSION');
    expect(openCount(lia)).toBe(1);
  });

  it('4 · con una sesión planificada abierta, una ajena al Planner se rechaza', async () => {
    await closeOpenSessions(lia);
    const run = await currentRun(lia);
    expect((await startPlannedSession(lia.id, run, { client: admin })).kind).toBe('STARTED');
    const fps = await fpsCreate(lia);
    expect(fps.error?.message).toContain(EXCLUSION);
    expect(openCount(lia)).toBe(1);
  });

  it('5 · con una sesión planificada abierta, otra planificada no arranca', async () => {
    // La ejecución de la sesión abierta es la actual; otra ejecución no puede nacer mientras la
    // sesión abierta gane (§N), así que la única candidata es la sustituida.
    const [older] = query<{ id: string }>(
      `select r.id::text from public.planner_runs r where r.user_id = '${lia.id}'
          and r.outcome = 'PLANNED'
          and not exists (select 1 from public.study_sessions s where s.planner_run_id = r.id)
        order by r.created_at limit 1`,
    );
    expect(older).toBeDefined();
    const refused = await startPlannedSession(lia.id, older!.id, { client: admin });
    expect(['OPEN_SESSION', 'RUN_SUPERSEDED']).toContain(refused.kind);
    expect(openCount(lia)).toBe(1);
  });

  it('5b · la base lo impide aunque se salten las funciones: una segunda planificada no entra', () => {
    const [older] = query<{ id: string; goal: string }>(
      `select r.id::text, r.learner_exam_goal_id::text as goal from public.planner_runs r
        where r.user_id = '${lia.id}'
          and not exists (select 1 from public.study_sessions s where s.planner_run_id = r.id)
        order by r.created_at limit 1`,
    );
    const outcome = attack(
      `set constraints public.study_sessions_one_open_per_user immediate;
       insert into public.study_sessions (user_id, learner_exam_goal_id, planner_run_id, session_type)
       values ('${lia.id}', '${older!.goal}', '${older!.id}', 'PLANNER_RUN');`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain(EXCLUSION);
  });

  it('6 · terminada la sesión, abrir otra funciona', async () => {
    await closeOpenSessions(lia);
    expect(openCount(lia)).toBe(0);
    expect((await fpsCreate(lia)).error).toBeNull();
    expect(openCount(lia)).toBe(1);
  });

  it('7 · INTERRUPTED sigue abierta: no deja abrir otra, y se reanuda la misma', async () => {
    const [row] = query<{ id: string }>(
      `select id::text from public.study_sessions where user_id = '${lia.id}' and status in ${OPEN}`,
    );
    const ref: CreatedSession = { session_id: row!.id, status: 'PLANNED', items: [] };
    await accept(lia, eventFor(lia, ref, 'SESSION_STARTED'));
    await accept(lia, eventFor(lia, ref, 'SESSION_INTERRUPTED'));
    expect((await fpsCreate(lia)).error?.message).toContain(EXCLUSION);
    await accept(lia, eventFor(lia, ref, 'SESSION_RESUMED'));
    expect(openCount(lia)).toBe(1);
  });

  it('8 · arrancar dos veces la misma ejecución devuelve la misma sesión, también tras cerrarla', async () => {
    await closeOpenSessions(lia);
    const run = await supersedingRun(lia, 35);
    const first = await startPlannedSession(lia.id, run, { client: admin });
    const again = await startPlannedSession(lia.id, run, { client: admin });
    expect(first.kind).toBe('STARTED');
    expect(again).toMatchObject({ kind: 'STARTED', reused: true });
    if (first.kind === 'STARTED' && again.kind === 'STARTED') {
      expect(again.sessionId).toBe(first.sessionId);
    }
    await closeOpenSessions(lia);
    const closed = await startPlannedSession(lia.id, run, { client: admin });
    expect(closed).toMatchObject({ kind: 'STARTED', reused: true });
    expect(openCount(lia)).toBe(0);
  });

  it('9 · la concurrencia no produce dos sesiones abiertas', async () => {
    await closeOpenSessions(lia);
    // Cinco creaciones simultáneas por la RPC congelada.
    const creates = await Promise.all(Array.from({ length: 5 }, () => fpsCreate(lia)));
    expect(creates.filter((r) => r.error === null)).toHaveLength(1);
    for (const r of creates.filter((x) => x.error !== null)) {
      expect(r.error?.message).toContain(EXCLUSION);
    }
    expect(openCount(lia)).toBe(1);

    // Planificada contra ajena al Planner, a la vez.
    await closeOpenSessions(lia);
    const run = await supersedingRun(lia, 30);
    const [planned, fps] = await Promise.all([
      startPlannedSession(lia.id, run, { client: admin }),
      fpsCreate(lia),
    ]);
    const wins = [planned.kind === 'STARTED', fps.error === null].filter(Boolean);
    expect(wins).toHaveLength(1);
    expect(openCount(lia)).toBe(1);

    // La misma ejecución arrancada a la vez tres veces: una sesión, idempotente.
    await closeOpenSessions(lia);
    const next = await supersedingRun(lia, 25);
    const same = await Promise.all(
      Array.from({ length: 3 }, () => startPlannedSession(lia.id, next, { client: admin })),
    );
    const sessions = new Set(same.flatMap((s) => (s.kind === 'STARTED' ? [s.sessionId] : [])));
    expect(sessions.size).toBe(1);
    expect(openCount(lia)).toBe(1);

    // Ejecuciones distintas a la vez: la sustituida y la vigente.
    await closeOpenSessions(lia);
    const older = await supersedingRun(lia, 20);
    const newer = await supersedingRun(lia, 15);
    const pair = await Promise.all([
      startPlannedSession(lia.id, older, { client: admin }),
      startPlannedSession(lia.id, newer, { client: admin }),
    ]);
    expect(pair.filter((s) => s.kind === 'STARTED')).toHaveLength(1);
    expect(openCount(lia)).toBe(1);

    // Terminar la sesión abierta mientras se abre otra: nunca quedan dos.
    const [open] = query<{ id: string }>(
      `select id::text from public.study_sessions where user_id = '${lia.id}' and status in ${OPEN}`,
    );
    const ref: CreatedSession = { session_id: open!.id, status: 'PLANNED', items: [] };
    await accept(lia, eventFor(lia, ref, 'SESSION_STARTED'));
    await Promise.allSettled([
      accept(lia, eventFor(lia, ref, 'SESSION_COMPLETED')),
      fpsCreate(lia),
    ]);
    expect(openCount(lia)).toBeLessThanOrEqual(1);
  });

  it('10 · personas distintas no interfieren', async () => {
    await closeOpenSessions(lia);
    await closeOpenSessions(max);
    const [a, b] = await Promise.all([fpsCreate(lia), fpsCreate(max)]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(openCount(lia)).toBe(1);
    expect(openCount(max)).toBe(1);
  });
});

describe('P4-G10 · el orden de errores congelado de create_study_session se conserva', () => {
  it('con una sesión abierta, una petición inválida responde con su propio error', async () => {
    expect(openCount(lia)).toBe(1);
    const invalid = await rpc(lia.client, 'create_study_session', {
      p_goal_id: lia.goalId,
      p_session_type: 'FPS_FIXED',
      p_items: [],
    });
    expect(invalid.error?.message).toContain('ITEMS_MALFORMED');
    const malformed = await rpc(lia.client, 'create_study_session', {
      p_goal_id: lia.goalId,
      p_session_type: 'no vale',
      p_items: [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }],
    });
    expect(malformed.error?.message).toContain('SESSION_TYPE_MALFORMED');
  });
});

describe('red team final · Phase 4A', () => {
  it('una ejecución del Planner no se borra mientras exista la cuenta, ni referenciada ni suelta', () => {
    const [run] = query<{ id: string }>(
      `select id::text from public.planner_runs where user_id = '${lia.id}' order by created_at limit 1`,
    );
    const outcome = attack(`delete from public.planner_runs where id = '${run!.id}';`);
    expect(outcome.rejected).toBe(true);
  });

  it('la auditoría es inmutable: ni se edita ni se borra', () => {
    const [row] = query<{ id: string }>(
      `select run_id::text as id from public.planner_run_audit where user_id = '${lia.id}' limit 1`,
    );
    expect(
      attack(
        `update public.planner_run_audit set decision_canonical = '{}' where run_id = '${row!.id}';`,
      ).rejected,
    ).toBe(true);
    expect(
      attack(`delete from public.planner_run_audit where run_id = '${row!.id}';`).rejected,
    ).toBe(true);
  });

  it('NO_PUBLISHED_UNIT · un concepto con pregunta y sin unidad queda excluido con su razón', async () => {
    await closeOpenSessions(max);
    const outcome = await requestPlanForUser(max.id, { client: admin, durations: FIXTURE });
    if (outcome.kind !== 'RUN') throw new Error(outcome.kind);
    const byConcept = new Map(outcome.decision.candidates.map((c) => [c.conceptId, c]));
    expect(byConcept.get(pack.conceptIds[2]!)?.exclusion).toBe('NO_PUBLISHED_UNIT');
    // No se sustituye APRENDER por una pregunta ni se fabrica nada para ese concepto.
    expect(outcome.decision.actions.map((a) => a.conceptId)).not.toContain(pack.conceptIds[2]);
  });

  it('ninguna instantánea del Planner contiene clave de respuesta, opción correcta ni explicación', () => {
    const texts = query<{ t: string }>(
      `select input_canonical || decision_canonical as t from public.planner_run_audit
        where user_id in ('${lia.id}', '${max.id}')`,
    );
    expect(texts.length).toBeGreaterThan(0);
    for (const { t } of texts) {
      expect(t).not.toMatch(
        /correct_option|correctOption|answer_key|answerKey|explanation|is_correct/,
      );
    }
  });
});
