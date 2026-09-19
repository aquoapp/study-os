import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Los módulos de servidor empiezan con `import 'server-only'`. Se neutraliza SOLO ese marcador: el
// resto —módulo, cliente, llamadas por la frontera gobernada— es código de producción.
vi.mock('server-only', () => ({}));
// Cada caso recorre el módulo real y la puesta al día del motor por la red: margen explícito.
vi.setConfig({ testTimeout: 180_000 });

import { resolveBudget } from '@study-os/planner-engine';

import {
  buildSyntheticPack,
  publish,
  purgePack,
  question,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  envelope,
  eventFor,
  itemEvent,
  presentAndAnswer,
  publishLearningUnit,
  rpc,
  type CreatedSession,
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
import {
  requestPlanForUser,
  type DurationSource,
  type PlannerRequestOutcome,
} from '../../apps/web/src/server/planner/run';
import { explainRun, startPlannedSession } from '../../apps/web/src/server/planner/start';

/**
 * `planner.runtime.spec` · Phase 4A · la frontera real de runtime (P4-G16).
 *
 * Todo pasa por el **módulo real de servidor** del Planner (`requestPlanForUser`,
 * `startPlannedSession`, `explainRun`) contra PostgREST y la base de STAGING, con un pack
 * `GENERATED` y aprendices sintéticos. Ninguna capacidad se da por probada con SQL directo: el
 * SQL solo **observa** lo que el módulo dejó escrito.
 *
 * Duraciones: **fixture** inyectada (P4-D2 diferida). Sin fuente, el módulo se niega.
 *
 * El paso de un día se simula para el aprendiz sintético retrasando dos días el `completed_at` de
 * sus ítems de sesión completados. Es estado de sesión, no evidencia: ningún evento ni intento se
 * toca, y por eso las preguntas respondidas hoy siguen contando como respondidas hoy (§H).
 */

let env: TestEnv;
let admin: SupabaseClient;
let pack: SyntheticPack;
let ana: Learner;
let bruno: Learner;
const unitIds: string[] = [];
const unitVersionIds: string[] = [];

/** Duraciones de fixture: datos de prueba, jamás constantes de runtime (§I.3). */
const FIXTURE: DurationSource = {
  provenance: 'FIXTURE',
  minutesFor: ({ learningUnitIds, questionIds }) => ({
    units: new Map(learningUnitIds.map((id) => [id, 5])),
    questions: new Map(questionIds.map((id) => [id, 3])),
  }),
};

const request = (learner: Learner, options: Parameters<typeof requestPlanForUser>[1] = {}) =>
  requestPlanForUser(learner.id, { client: admin, durations: FIXTURE, ...options });

function asRun(outcome: PlannerRequestOutcome) {
  if (outcome.kind !== 'RUN') throw new Error(`se esperaba una ejecución y llegó ${outcome.kind}`);
  return outcome;
}

const runCount = (userId: string) =>
  Number(
    query<{ n: number }>(
      `select count(*)::int as n from public.planner_runs where user_id = '${userId}'`,
    )[0]?.n,
  );

/** Un día más para el aprendiz sintético: solo estado de sesión, nunca evidencia. */
function nextDay(learner: Learner): void {
  query(
    `update public.session_items
        set started_at = started_at - interval '2 days', completed_at = completed_at - interval '2 days'
      where user_id = '${learner.id}' and status = 'COMPLETED' returning id`,
  );
}

async function sessionOf(learner: Learner, sessionId: string): Promise<CreatedSession> {
  const items = await learner.client
    .from('session_items')
    .select('id, sort_order, item_type, learning_unit_id, question_id')
    .eq('session_id', sessionId)
    .order('sort_order');
  if (items.error) throw new Error(items.error.message);
  return {
    session_id: sessionId,
    status: 'PLANNED',
    items: (items.data ?? []).map((row) => ({
      session_item_id: row.id as string,
      sort_order: row.sort_order as number,
      item_type: row.item_type as string,
      target_id: (row.learning_unit_id ?? row.question_id) as string,
    })),
  } as CreatedSession;
}

function representationOf(questionId: string): string {
  const row = query<{ id: string }>(
    `select id::text from public.question_representations
      where question_id = '${questionId}' and status = 'PUBLISHED' and superseded_by_representation_id is null`,
  )[0];
  if (!row) throw new Error(`sin representación publicada para ${questionId}`);
  return row.id;
}

function correctKeyOf(questionId: string): string {
  const found = pack.questions.find((q) => q.questionId === questionId);
  if (found) return found.correctOptionKey;
  return extraKeys.get(questionId) ?? 'A';
}
const wrongKeyOf = (questionId: string) =>
  ['A', 'B', 'C'].find((key) => key !== correctKeyOf(questionId))!;

const extraKeys = new Map<string, string>();

/** Una segunda pregunta PRIMARY VALIDATED para un concepto, por la frontera de ingestión. */
async function addPrimaryQuestion(conceptIndex: number, label: string): Promise<string> {
  const { targetId: questionId } = await publish(admin, 'question', {
    exam_pack_id: pack.packId,
    question_type: 'SINGLE_CHOICE',
  });
  await publish(admin, 'question_representation', {
    question_id: questionId,
    stem: `fixture: enunciado sintético ${label}`,
    provenance_class: 'GENERATED',
    source_version_id: pack.sourceVersionId,
    options: ['A', 'B', 'C'].map((key, i) => ({
      option_key: key,
      body: `fixture: opción ${key}`,
      sort_order: i + 1,
    })),
  });
  await publish(admin, 'answer_key_version', {
    question_id: questionId,
    correct_option_key: 'B',
    key_status: 'FINAL',
    source_version_id: pack.sourceVersionId,
    effective_from: '2026-01-01',
    explanation: 'fixture: explicación sintética',
  });
  await publish(admin, 'question_concept', {
    question_id: questionId,
    concept_id: pack.conceptIds[conceptIndex],
    exam_pack_version_id: pack.versionId,
    relationship_type: 'PRIMARY',
    weight: 1,
  });
  extraKeys.set(questionId, 'B');
  return questionId;
}

/** Ejecuta la sesión planificada entera: lee y termina las unidades, responde las preguntas. */
async function runSession(
  learner: Learner,
  session: CreatedSession,
  answers: (questionId: string) => 'RIGHT' | 'WRONG' | 'SKIP',
  unitMode: 'COMPLETE' | 'VIEW_ONLY' = 'COMPLETE',
): Promise<Map<string, number>> {
  const positions = new Map<string, number>();
  await accept(learner, eventFor(learner, session, 'SESSION_STARTED'));
  for (const item of session.items) {
    if (item.item_type === 'LEARNING_UNIT') {
      const index = unitIds.indexOf(item.target_id);
      await accept(
        learner,
        itemEvent(learner, session, item, 'LEARNING_UNIT_VIEWED', {
          learning_unit_version_id: unitVersionIds[index],
        }),
      );
      if (unitMode === 'COMPLETE') {
        await accept(learner, itemEvent(learner, session, item, 'LEARNING_UNIT_COMPLETED', {}));
      }
    } else {
      const choice = answers(item.target_id);
      if (choice === 'SKIP') continue;
      const key = choice === 'RIGHT' ? correctKeyOf(item.target_id) : wrongKeyOf(item.target_id);
      const submitted = await presentAndAnswer(
        learner,
        session,
        item,
        representationOf(item.target_id),
        { option_key: key },
      );
      positions.set(item.target_id, Number(submitted.stream_position));
    }
  }
  await accept(learner, eventFor(learner, session, 'SESSION_COMPLETED'));
  return positions;
}

async function planAndStart(learner: Learner) {
  const run = asRun(await request(learner));
  const started = await startPlannedSession(learner.id, run.runId, { client: admin });
  if (started.kind !== 'STARTED') throw new Error(`arranque rechazado: ${started.kind}`);
  return { run, session: await sessionOf(learner, started.sessionId) };
}

const conceptOf = (index: number) => pack.conceptIds[index]!;

let q0b = '';
let q1b = '';
let q0c = '';

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p4a');
  for (const index of [0, 1, 2]) {
    const unit = await publishLearningUnit(admin, pack, index, `p4a-u${index}`);
    unitIds.push(unit.unitId);
    unitVersionIds.push(unit.versionId);
  }
  q0b = await addPrimaryQuestion(0, 'p4a-q0b');
  q1b = await addPrimaryQuestion(1, 'p4a-q1b');
  // Tres preguntas para el concepto 0: el recorrido lo comprueba tres veces en el mismo día real.
  q0c = await addPrimaryQuestion(0, 'p4a-q0c');
  ana = await createLearner(env, 'p4a-ana', pack);
  bruno = await createLearner(env, 'p4a-bruno', pack);
  // Presupuesto determinista: sin entradas semanales manda el valor por defecto (§I.2).
  for (const learner of [ana, bruno]) {
    const reset = await learner.client
      .from('learner_settings')
      .update({ weekly_availability_json: {}, default_daily_minutes: 40 })
      .eq('user_id', learner.id);
    if (reset.error) throw new Error(reset.error.message);
  }
}, 600_000);

afterAll(async () => {
  // El borrado de cuenta arrastra ejecuciones, ítems y auditoría, y la FK RESTRICT de
  // `study_sessions.planner_run_id` no lo impide (§V).
  for (const learner of [ana, bruno]) if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
  for (const learner of [ana, bruno]) {
    if (!learner) continue;
    const residue = query<{ n: number }>(
      `select (select count(*) from public.planner_runs where user_id = '${learner.id}')
            + (select count(*) from public.planner_items where user_id = '${learner.id}')
            + (select count(*) from public.planner_run_audit where user_id = '${learner.id}')
            + (select count(*) from public.study_sessions where user_id = '${learner.id}')
            + (select count(*) from engine.concept_mastery where user_id = '${learner.id}') as n`,
    );
    expect(Number(residue[0]?.n)).toBe(0);
  }
}, 300_000);

describe('§I.1 · la zona horaria se declara, no se deduce', () => {
  it('sin zona declarada no hay «hoy» y no se escribe nada', async () => {
    expect((await request(ana)).kind).toBe('TIMEZONE_REQUIRED');
    expect(runCount(ana.id)).toBe(0);
  });

  it('solo se aceptan nombres IANA que la base conoce', async () => {
    for (const bad of ['Mars/Olympus', 'CET', '+02:00', 'europe/madrid', '']) {
      const attempt = await ana.client.from('profiles').update({ timezone: bad }).eq('id', ana.id);
      expect(attempt.error, `aceptó ${bad}`).not.toBeNull();
    }
    const ok = await ana.client
      .from('profiles')
      .update({ timezone: 'Europe/Madrid' })
      .eq('id', ana.id);
    expect(ok.error).toBeNull();
    const okBruno = await bruno.client
      .from('profiles')
      .update({ timezone: 'America/Mexico_City' })
      .eq('id', bruno.id);
    expect(okBruno.error).toBeNull();
  });

  it('nadie declara la zona de otra persona', async () => {
    const hijack = await bruno.client
      .from('profiles')
      .update({ timezone: 'Asia/Tokyo' })
      .eq('id', ana.id)
      .select('id');
    expect(hijack.data ?? []).toEqual([]);
    const tz = query<{ timezone: string }>(
      `select timezone from public.profiles where id = '${ana.id}'`,
    );
    expect(tz[0]?.timezone).toBe('Europe/Madrid');
  });
});

describe('P4-D2 · sin fuente de duración no se planifica', () => {
  it('el módulo real responde DURATION_SOURCE_UNDECIDED y no escribe ninguna ejecución', async () => {
    const outcome = await requestPlanForUser(ana.id, { client: admin });
    expect(outcome.kind).toBe('DURATION_SOURCE_UNDECIDED');
    expect(runCount(ana.id)).toBe(0);
  });
});

let firstRunId = '';

describe('primera ejecución · persistencia, auditoría y reproducción', () => {
  it('planifica cobertura en orden de sílabo y registra cada exclusión', async () => {
    const run = asRun(await request(ana));
    firstRunId = run.runId;
    expect(run.reused).toBe(false);
    expect(run.outcome).toBe('PLANNED');
    expect(run.decision.actions.map((a) => [a.conceptId, a.kind, a.reason])).toEqual([
      [conceptOf(0), 'LEARN', 'COVERAGE'],
      [conceptOf(1), 'LEARN', 'COVERAGE'],
      [conceptOf(2), 'LEARN', 'COVERAGE'],
    ]);
    const excluded = run.decision.candidates.find((c) => c.conceptId === conceptOf(3));
    expect(excluded?.exclusion).toBe('NO_ATTRIBUTED_QUESTION');
  });

  it('la fila persistida es la decisión: presupuesto con procedencia, tupla del motor y FIXTURE', () => {
    const [row] = query<Record<string, unknown>>(
      `select outcome, budget_minutes, budget_source, planned_minutes, item_count, planner_version,
              planner_config_version, consumed_position::int as consumed, duration_provenance,
              timezone, supersedes_run_id
         from public.planner_runs where id = '${firstRunId}'`,
    );
    expect(row).toMatchObject({
      outcome: 'PLANNED',
      budget_minutes: 40,
      budget_source: 'DEFAULT_DAILY',
      planned_minutes: 15,
      item_count: 3,
      planner_version: 'planner-v1',
      planner_config_version: 'v1',
      consumed: 0,
      duration_provenance: 'FIXTURE',
      timezone: 'Europe/Madrid',
      supersedes_run_id: null,
    });
    const items = query<{ learning_unit_id: string; learning_unit_version_id: string }>(
      `select learning_unit_id::text, learning_unit_version_id::text from public.planner_items
        where run_id = '${firstRunId}' order by position`,
    );
    expect(items.map((i) => i.learning_unit_id)).toEqual(unitIds);
    expect(items.map((i) => i.learning_unit_version_id)).toEqual(unitVersionIds);
  });

  it('P4-G4 · la instantánea se reproduce byte a byte y su hash lo recalcula la base', async () => {
    const [audit] = query<{ input_canonical: string; input_hash: string }>(
      `select input_canonical, input_hash from public.planner_run_audit where run_id = '${firstRunId}'`,
    );
    expect(createHash('sha256').update(audit!.input_canonical, 'utf8').digest('hex')).toBe(
      audit!.input_hash,
    );
    const explained = await explainRun(firstRunId, { client: admin });
    expect(explained?.identical).toBe(true);
  });

  it('P4-G5 · §O · pedir otra vez, o tres a la vez, reutiliza la misma ejecución', async () => {
    const again = asRun(await request(ana));
    expect(again).toMatchObject({ runId: firstRunId, reused: true });
    const concurrent = await Promise.all([request(ana), request(ana), request(ana)]);
    for (const outcome of concurrent) expect(asRun(outcome).runId).toBe(firstRunId);
    expect(runCount(ana.id)).toBe(1);
  });
});

describe('P4-G11 · el cliente no redacta ni lee la decisión interna', () => {
  it('ninguna función del Planner es invocable por la persona ni por anon', async () => {
    for (const client of [ana.client, anonClient(env)]) {
      for (const [fn, args] of [
        ['create_planner_run', { p_user: ana.id, p_payload: {} }],
        ['start_planned_session', { p_user: ana.id, p_run_id: firstRunId }],
        ['planner_context', { p_user: ana.id }],
        ['engine_planner_snapshot', { p_user_id: ana.id }],
      ] as const) {
        const result = await rpc(client, fn, args);
        expect(result.error, `${fn} fue invocable`).not.toBeNull();
      }
    }
  });

  it('la persona lee sus ejecuciones en columnas seguras, y nada más', async () => {
    const safe = await ana.client.from('planner_runs').select('id, outcome, planned_minutes');
    expect(safe.error).toBeNull();
    expect(safe.data?.map((r) => r.id)).toEqual([firstRunId]);
    for (const column of [
      'engine_version',
      'input_hash',
      'consumed_position',
      'duration_provenance',
    ]) {
      const hidden = await ana.client.from('planner_runs').select(column);
      expect(hidden.error, `${column} es legible por la persona`).not.toBeNull();
    }
    const reasons = await ana.client.from('planner_items').select('composition_reason');
    expect(reasons.error).not.toBeNull();
    const audit = await ana.client.from('planner_run_audit').select('run_id');
    expect(audit.error ?? (audit.data?.length === 0 ? null : 'visible')).not.toBeNull();
    const config = await ana.client.from('planner_config').select('version');
    expect(config.error ?? (config.data?.length === 0 ? null : 'visible')).not.toBeNull();
  });

  it('RLS · otra persona no ve nada ajeno', async () => {
    const foreign = await bruno.client.from('planner_runs').select('id').eq('id', firstRunId);
    expect(foreign.data ?? []).toEqual([]);
    const items = await bruno.client.from('planner_items').select('id').eq('run_id', firstRunId);
    expect(items.data ?? []).toEqual([]);
  });

  it('la persona no puede escribir ejecuciones ni ítems directamente', async () => {
    const insert = await ana.client.from('planner_runs').insert({ user_id: ana.id });
    expect(insert.error).not.toBeNull();
    const update = await ana.client
      .from('planner_runs')
      .update({ outcome: 'ZERO_TIME' })
      .eq('id', firstRunId);
    expect(update.error ?? 'sin error').not.toBe('sin error');
  });
});

describe('§U.6 · §N · P4-G10 · arranque, reanudación y una sola sesión abierta', () => {
  let sessionId = '';

  it('arranca la sesión planificada y es idempotente por ejecución', async () => {
    const first = await startPlannedSession(ana.id, firstRunId, { client: admin });
    expect(first.kind).toBe('STARTED');
    if (first.kind !== 'STARTED') return;
    sessionId = first.sessionId;
    const again = await startPlannedSession(ana.id, firstRunId, { client: admin });
    expect(again).toMatchObject({ kind: 'STARTED', sessionId, reused: true });
    const [row] = query<{ session_type: string; planner_run_id: string; items: number }>(
      `select s.session_type, s.planner_run_id::text,
              (select count(*)::int from public.session_items i where i.session_id = s.id) as items
         from public.study_sessions s where s.id = '${sessionId}'`,
    );
    expect(row).toEqual({ session_type: 'PLANNER_RUN', planner_run_id: firstRunId, items: 3 });
  });

  it('con la sesión abierta, pedir un plan devuelve RESUME_REQUIRED y no escribe', async () => {
    expect((await request(ana)).kind).toBe('RESUME_REQUIRED');
    expect(runCount(ana.id)).toBe(1);
  });

  it('la base impide una segunda sesión abierta, también por la RPC del cliente', async () => {
    const second = await rpc(ana.client, 'create_study_session', {
      p_goal_id: ana.goalId,
      p_session_type: 'FPS_FIXED',
      p_items: [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }],
    });
    expect(second.error).not.toBeNull();
    const open = query<{ n: number }>(
      `select count(*)::int as n from public.study_sessions
        where user_id = '${ana.id}' and status in ('PLANNED', 'ACTIVE', 'INTERRUPTED')`,
    );
    expect(Number(open[0]?.n)).toBe(1);
  });

  it('una persona no arranca la ejecución de otra', async () => {
    expect((await startPlannedSession(bruno.id, firstRunId, { client: admin })).kind).toBe(
      'RUN_NOT_FOUND',
    );
  });

  it('se ejecuta la sesión: leer y terminar las unidades', async () => {
    await runSession(ana, await sessionOf(ana, sessionId), () => 'SKIP');
    const status = query<{ status: string }>(
      `select status::text from public.study_sessions where id = '${sessionId}'`,
    );
    expect(status[0]?.status).toBe('COMPLETED');
    // Idempotente también después: la misma ejecución devuelve la misma sesión.
    expect(await startPlannedSession(ana.id, firstRunId, { client: admin })).toMatchObject({
      kind: 'STARTED',
      sessionId,
      reused: true,
    });
  });
});

describe('§M · P4-G7 · frescura del motor y puesta al día bloqueante', () => {
  it('si la puesta al día falla, PLAN_UNAVAILABLE_ENGINE y ninguna ejecución escrita', async () => {
    const failing = new Proxy(admin, {
      get(target, property, receiver) {
        if (property === 'rpc') {
          return (fn: string, args?: Record<string, unknown>) =>
            fn === 'engine_rebuild_projections' || fn === 'engine_recalculate_mastery'
              ? Promise.resolve({
                  data: null,
                  error: { message: 'fallo inyectado en la frontera' },
                })
              : target.rpc(fn, args);
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const before = runCount(ana.id);
    const outcome = await requestPlanForUser(ana.id, { client: failing, durations: FIXTURE });
    expect(outcome.kind).toBe('PLAN_UNAVAILABLE_ENGINE');
    expect(runCount(ana.id)).toBe(before);
  });

  it('con el motor atrasado, el Planner lo pone al día y registra la tupla consumida', async () => {
    const run = asRun(await request(ana));
    const [tuple] = query<{ consumed: number; max: number; watermark: number }>(
      `select r.consumed_position::int as consumed,
              (select max(stream_position)::int from public.learning_events where user_id = '${ana.id}') as max,
              (select consumed_position::int from engine.projection_watermarks
                where user_id = '${ana.id}' and projection_name = 'concept_mastery') as watermark
         from public.planner_runs r where r.id = '${run.runId}'`,
    );
    expect(tuple!.consumed).toBe(tuple!.max);
    expect(tuple!.watermark).toBe(tuple!.max);
    // Lo trabajado hoy no se vuelve a planificar hoy, y el positivo no existe aún: nada elegible.
    expect(run.outcome).toBe('NOTHING_ELIGIBLE');
    expect(
      run.decision.candidates
        .filter((c) => c.conceptId !== conceptOf(3))
        .map((c) => [c.masteryState, c.exclusion]),
    ).toEqual([
      ['EXPOSED', 'COMPLETED_TODAY'],
      ['EXPOSED', 'COMPLETED_TODAY'],
      ['EXPOSED', 'COMPLETED_TODAY'],
    ]);
  });
});

let p0 = 0;
let p1 = 0;

describe('P4-D4 · P4-D5 · P4-D6 · de la evidencia al orden, de punta a punta', () => {
  it('al día siguiente, lo expuesto se comprueba antes que nada', async () => {
    nextDay(ana);
    const { run, session } = await planAndStart(ana);
    expect(run.decision.actions.map((a) => [a.conceptId, a.kind])).toEqual([
      [conceptOf(0), 'CHECK'],
      [conceptOf(1), 'CHECK'],
      [conceptOf(2), 'CHECK'],
    ]);
    const positions = await runSession(ana, session, (questionId) =>
      questionId === question(pack, 2).questionId ? 'RIGHT' : 'WRONG',
    );
    p0 = [...positions.entries()].find(([q]) =>
      [question(pack, 0).questionId, q0b, q0c].includes(q),
    )![1];
    p1 = [...positions.entries()].find(([q]) =>
      [question(pack, 1).questionId, q1b].includes(q),
    )![1];
    expect(p0).toBeLessThan(p1);
  });

  it('la reparación más antigua va en la cabeza, con la posición exacta del motor', async () => {
    nextDay(ana);
    const run = asRun(await request(ana));
    expect(run.decision.actions.map((a) => [a.conceptId, a.kind, a.reason])).toEqual([
      [conceptOf(0), 'RELEARN_CHECK', 'REMEDIATION_GUARANTEE'],
      [conceptOf(1), 'RELEARN_CHECK', 'REMEDIATION_OVERFLOW'],
    ]);
    const byConcept = new Map(run.decision.candidates.map((c) => [c.conceptId, c]));
    expect(byConcept.get(conceptOf(0))?.lastNegativePosition).toBe(p0);
    expect(byConcept.get(conceptOf(1))?.lastNegativePosition).toBe(p1);
    expect(byConcept.get(conceptOf(2))?.exclusion).toBe('POSITIVE_NO_REVIEW_POLICY');
    // P4-G23 · la auditoría guarda la posición que ordenó la reparación.
    const [audit] = query<{ input_canonical: string }>(
      `select input_canonical from public.planner_run_audit where run_id = '${run.runId}'`,
    );
    expect(audit!.input_canonical).toContain(`"lastNegativePosition":${p0}`);
    // El Planner no la calculó: es la del motor.
    const engine = query<{ concept_id: string; last_negative_position: number }>(
      `select concept_id::text, last_negative_position::int from engine.concept_mastery
        where user_id = '${ana.id}' and last_negative_position is not null order by 2`,
    );
    expect(engine).toEqual([
      { concept_id: conceptOf(0), last_negative_position: p0 },
      { concept_id: conceptOf(1), last_negative_position: p1 },
    ]);
  });

  it('leer la reparación sin comprobarla no mueve la clave: se vuelve a ofrecer la misma', async () => {
    const run = asRun(await request(ana));
    const started = await startPlannedSession(ana.id, run.runId, { client: admin });
    if (started.kind !== 'STARTED') throw new Error(started.kind);
    const session = await sessionOf(ana, started.sessionId);
    // Solo la unidad de la primera reparación, vista y sin terminar; ninguna pregunta.
    await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
    const unitItem = session.items[0]!;
    await accept(
      ana,
      itemEvent(ana, session, unitItem, 'LEARNING_UNIT_VIEWED', {
        learning_unit_version_id: unitVersionIds[0],
      }),
    );
    await accept(ana, eventFor(ana, session, 'SESSION_COMPLETED'));
    const again = asRun(await request(ana));
    expect(again.decision.actions[0]).toMatchObject({
      conceptId: conceptOf(0),
      reason: 'REMEDIATION_GUARANTEE',
    });
    const byConcept = new Map(again.decision.candidates.map((c) => [c.conceptId, c]));
    expect(byConcept.get(conceptOf(0))?.lastNegativePosition).toBe(p0);
  });

  it('un fallo nuevo mueve la clave exactamente, y la otra reparación pasa a la cabeza', async () => {
    const { session } = await planAndStart(ana);
    // Solo la primera acción: reaprender y fallar de nuevo el concepto 0.
    const firstTwo = { ...session, items: session.items.slice(0, 2) };
    const positions = await runSession(ana, firstTwo, () => 'WRONG');
    const p2 = [...positions.values()][0]!;
    expect(p2).toBeGreaterThan(p1);
    nextDay(ana);
    const run = asRun(await request(ana));
    expect(run.decision.actions.map((a) => [a.conceptId, a.reason])).toEqual([
      [conceptOf(1), 'REMEDIATION_GUARANTEE'],
      [conceptOf(0), 'REMEDIATION_OVERFLOW'],
    ]);
    const byConcept = new Map(run.decision.candidates.map((c) => [c.conceptId, c]));
    expect(byConcept.get(conceptOf(0))?.lastNegativePosition).toBe(p2);
    expect(byConcept.get(conceptOf(1))?.lastNegativePosition).toBe(p1);
  });
});

describe('§U.1 · TOCTOU · la entrada se revalida en la transacción que escribe', () => {
  it('evidencia nueva entre el cálculo y la escritura: no se escribe lo viejo, se recalcula', async () => {
    let injected = false;
    const before = runCount(ana.id);
    const outcome = await request(ana, {
      beforePersist: async () => {
        if (injected) return;
        injected = true;
        await accept(
          ana,
          envelope(ana, 'AVAILABILITY_CHANGED', {
            default_daily_minutes: 40,
            weekly_availability_json: {},
          }),
        );
      },
    });
    const run = asRun(outcome);
    expect(injected).toBe(true);
    const [row] = query<{ consumed: number; max: number }>(
      `select consumed_position::int as consumed,
              (select max(stream_position)::int from public.learning_events where user_id = '${ana.id}') as max
         from public.planner_runs where id = '${run.runId}'`,
    );
    expect(row!.consumed).toBe(row!.max);
    expect(runCount(ana.id)).toBe(before + 1);
  });
});

describe('§I.2 · §L · P4-G1 · P4-G3 · presupuesto', () => {
  it('cambiar el valor por defecto replanifica hacia delante y no reescribe el pasado', async () => {
    const [pastBefore] = query<Record<string, unknown>>(
      `select to_jsonb(r) as row from public.planner_runs r where r.id = '${firstRunId}'`,
    );
    const update = await ana.client
      .from('learner_settings')
      .update({ default_daily_minutes: 8 })
      .eq('user_id', ana.id);
    expect(update.error).toBeNull();
    const run = asRun(await request(ana));
    const [row] = query<{ budget_minutes: number; budget_source: string }>(
      `select budget_minutes, budget_source from public.planner_runs where id = '${run.runId}'`,
    );
    expect(row).toEqual({ budget_minutes: 8, budget_source: 'DEFAULT_DAILY' });
    // Una sola acción de 8 minutos cabe: la garantía de reparación.
    expect(run.decision.actions.map((a) => a.reason)).toEqual(['REMEDIATION_GUARANTEE']);
    const [pastAfter] = query<Record<string, unknown>>(
      `select to_jsonb(r) as row from public.planner_runs r where r.id = '${firstRunId}'`,
    );
    expect(pastAfter).toEqual(pastBefore);
  });

  it('un cero declarado para hoy es ZERO_TIME: cero ítems, sin deuda', async () => {
    const [day] = query<{ plan_day: string }>(
      `select (now() at time zone 'Europe/Madrid')::date::text as plan_day`,
    );
    const weekday = resolveBudget({
      planDay: day!.plan_day,
      defaultDailyMinutes: 8,
      weeklyAvailability: {},
      todayOverride: null,
    });
    expect(weekday.source).toBe('DEFAULT_DAILY');
    const key = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][
      (new Date(`${day!.plan_day}T00:00:00Z`).getUTCDay() + 6) % 7
    ]!;
    const update = await ana.client
      .from('learner_settings')
      .update({ weekly_availability_json: { [key]: 0 } })
      .eq('user_id', ana.id);
    expect(update.error).toBeNull();
    const run = asRun(await request(ana));
    expect(run.outcome).toBe('ZERO_TIME');
    const [row] = query<{ item_count: number; budget_source: string }>(
      `select item_count, budget_source from public.planner_runs where id = '${run.runId}'`,
    );
    expect(row).toEqual({ item_count: 0, budget_source: 'WEEKLY_ENTRY' });
  });

  it('la cadena es lineal: cada ejecución sustituye a la anterior y ninguna se edita', () => {
    const chain = query<{ n: number; roots: number; forks: number }>(
      `select count(*)::int as n,
              count(*) filter (where supersedes_run_id is null)::int as roots,
              (select count(*)::int from (select supersedes_run_id from public.planner_runs
                 where user_id = '${ana.id}' and supersedes_run_id is not null
                 group by 1 having count(*) > 1) f) as forks
         from public.planner_runs where user_id = '${ana.id}'`,
    );
    expect(chain[0]!.roots).toBe(1);
    expect(chain[0]!.forks).toBe(0);
    expect(chain[0]!.n).toBeGreaterThan(5);
  });
});

describe('§P · un destino retirado o una ejecución sustituida no arrancan', () => {
  it('una ejecución sustituida no arranca', async () => {
    const reset = await ana.client
      .from('learner_settings')
      .update({ weekly_availability_json: {}, default_daily_minutes: 40 })
      .eq('user_id', ana.id);
    expect(reset.error).toBeNull();
    const [old] = query<{ id: string }>(
      `select id::text from public.planner_runs r where user_id = '${ana.id}' and outcome = 'PLANNED'
          and exists (select 1 from public.planner_runs s where s.supersedes_run_id = r.id)
          and not exists (select 1 from public.study_sessions s where s.planner_run_id = r.id)
        order by created_at desc limit 1`,
    );
    expect((await startPlannedSession(ana.id, old!.id, { client: admin })).kind).toBe(
      'RUN_SUPERSEDED',
    );
  });

  it('una ejecución atrasada por evidencia nueva no arranca: RUN_STALE', async () => {
    const run = asRun(await request(ana));
    await accept(
      ana,
      envelope(ana, 'AVAILABILITY_CHANGED', {
        default_daily_minutes: 40,
        weekly_availability_json: {},
      }),
    );
    expect((await startPlannedSession(ana.id, run.runId, { client: admin })).kind).toBe(
      'RUN_STALE',
    );
  });
});

describe('P4-G10 · una sola sesión abierta por persona, para todo origen (EC-019)', () => {
  const fpsSession = () =>
    rpc(bruno.client, 'create_study_session', {
      p_goal_id: bruno.goalId,
      p_session_type: 'FPS_FIXED',
      p_items: [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }],
    });

  it('con una sesión ajena al Planner abierta, la planificada no arranca y el plan cede', async () => {
    const run = asRun(await request(bruno));
    expect((await fpsSession()).error).toBeNull();
    expect((await startPlannedSession(bruno.id, run.runId, { client: admin })).kind).toBe(
      'OPEN_SESSION',
    );
    expect((await request(bruno)).kind).toBe('RESUME_REQUIRED');
  });

  it('una segunda sesión ajena al Planner tampoco se abre: el invariante es global', async () => {
    const second = await fpsSession();
    expect(second.error?.message).toContain('study_sessions_one_open_per_user');
  });
});
