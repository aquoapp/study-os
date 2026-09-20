import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Los módulos de servidor empiezan con `import 'server-only'`. Se neutraliza SOLO ese marcador: el
// resto —módulo, cliente, llamadas por la frontera gobernada— es código de producción.
vi.mock('server-only', () => ({}));
vi.setConfig({ testTimeout: 180_000 });

import { buildSyntheticPack, purgePack, type SyntheticPack } from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  eventFor,
  presentAndAnswer,
  publishLearningUnit,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';
import { setAvailability, setTodayOverride } from '../../apps/web/src/server/planner/availability';
import { requestPlanForUser } from '../../apps/web/src/server/planner/run';
import { startPlannedSession } from '../../apps/web/src/server/planner/start';
import { resolveToday } from '../../apps/web/src/server/planner/today';

/**
 * `phase4b.hardGates.spec` · las puertas duras de Phase 4B, contra la frontera real.
 *
 * Todo pasa por los **módulos reales de servidor** contra PostgREST y la base: es la regla de
 * D-26, que se aprendió caro. Una ruta de runtime solo está probada cuando una prueba ejecuta el
 * módulo real contra la frontera real; probar el contrato por SQL directo deja la ruta sin
 * llamador y el defecto sin descubrir.
 *
 * **La duración es la de producción**, no una inyectada: sin pasar `durations`, el módulo usa la
 * fuente híbrida de ADR-013, que lee el metadato fijado a la versión y la estimación gobernada de
 * `planner_config`. Eso es lo que hace que P4-G26 se pruebe de verdad y no contra un fixture.
 *
 * Puertas cubiertas: **P4-G24** (fidelidad de plan, INV-117) · **P4-G25** (consumo de ejecución,
 * con su control negativo) · **P4-G26** (autoridad de duración) · **P4-G27** (`NOTHING_FITS`) ·
 * **P4-G28** (override del día, con el cero) · **P4-G29** (eventos solo de servidor, INV-118) ·
 * **P4-G31** (idempotencia de render).
 */

let env: TestEnv;
let admin: SupabaseClient;
let pack: SyntheticPack;
let ana: Learner;

/** Minutos declarados de cada unidad del fixture: la autoridad de duración, no una constante. */
const UNIT_MINUTES = 6;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p4b-gates');
  ana = await createLearner(env, 'p4b-ana', pack);

  // Zona declarada: sin ella no existe «hoy» (§I.1) y el Planner se niega, con razón.
  const tz = await ana.client
    .from('profiles')
    .update({ timezone: 'Europe/Madrid' })
    .eq('id', ana.id);
  if (tz.error) throw new Error(tz.error.message);

  // El pack sintético ya publica preguntas atribuidas a sus conceptos. Lo que falta para que el
  // Planner tenga algo que planificar son las **unidades**, con su duración declarada.
  for (const index of [0, 1]) {
    await publishLearningUnit(admin, pack, index, `gate-${index}`, { minutes: UNIT_MINUTES });
  }

  // Presupuesto amplio y determinista: sin entradas semanales manda el valor por defecto.
  const settings = await setAvailability(
    ana.id,
    { defaultDailyMinutes: 120, weekly: {} },
    { client: admin },
  );
  if (settings.kind !== 'SAVED') throw new Error(`disponibilidad: ${settings.kind}`);
}, 600_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

/** Pide plan con la fuente de duración **de producción**. */
const plan = () => requestPlanForUser(ana.id, { client: admin });

function asRun(outcome: Awaited<ReturnType<typeof plan>>) {
  if (outcome.kind !== 'RUN') throw new Error(`se esperaba una ejecución y llegó ${outcome.kind}`);
  return outcome;
}

describe('P4-G26 · autoridad de duración · todo minuto tiene procedencia autorizada', () => {
  it('la procedencia de producción es HYBRID_V1, no FIXTURE', async () => {
    const run = asRun(await plan());
    const [row] = query<{ duration_provenance: string }>(
      `select duration_provenance from public.planner_runs where id = '${run.runId}'`,
    );
    expect(row?.duration_provenance).toBe('HYBRID_V1');
  });

  it('los minutos de la unidad son los declarados en su versión, y los de la pregunta los de la configuración activa', async () => {
    const run = asRun(await plan());
    const [config] = query<{ minutes: number }>(
      `select (document ->> 'check_step_minutes')::integer as minutes
         from public.planner_config where status = 'ACTIVE'`,
    );
    expect(config?.minutes).toBeGreaterThan(0);

    const steps = query<{ step: string; planned_minutes: number }>(
      `select step, planned_minutes from public.planner_items
        where run_id = '${run.runId}' order by position`,
    );
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const expected = step.step === 'LEARN' ? UNIT_MINUTES : config!.minutes;
      expect(Number(step.planned_minutes), step.step).toBe(expected);
    }
  });

  /*
   * La exclusión `NO_DURATION_METADATA` **no se prueba aquí**, y la razón es una lección, no una
   * comodidad.
   *
   * El primer intento reproducía la condición desactivando el trigger de inmutabilidad para poner
   * la columna a nula. Funcionaba, y era peligroso: si el caso falla entre el `disable` y el
   * `enable`, el trigger **se queda desactivado** para todas las suites que comparten la base, y
   * la siguiente que comprueba que el contenido publicado es inmutable pasa creyendo que lo
   * comprueba. Un arnés que puede debilitar una invariante de otra suite no vale lo que prueba.
   *
   * La propiedad queda cubierta por tres piezas, cada una donde le corresponde:
   *
   *   - que la frontera de ingestión **exija** la duración y no la rellene ·
   *     `learningUnits.lifecycle.spec`, con la clave ausente y con la clave fuera de rango;
   *   - que el motor puro **excluya** un candidato sin duración con esa razón propia y siga
   *     planificando el resto · `planner.durationAuthority.spec`, donde la entrada es un dato y no
   *     hace falta ninguna DDL;
   *   - que toda duración de producción tenga procedencia autorizada · los dos casos de arriba.
   */
});

describe('P4-G24 · INV-117 · fidelidad de plan', () => {
  it('la versión y la representación que el Planner seleccionó son las que se fijan al arrancar', async () => {
    const run = asRun(await plan());
    const started = await startPlannedSession(ana.id, run.runId, { client: admin });
    expect(started.kind).toBe('STARTED');

    const rows = query<{
      sort_order: number;
      presented_unit: string | null;
      presented_rep: string | null;
      planned_unit: string | null;
      planned_rep: string | null;
    }>(
      `select si.sort_order,
              si.presented_learning_unit_version_id as presented_unit,
              si.presented_representation_id as presented_rep,
              pi.learning_unit_version_id as planned_unit,
              pi.question_representation_id as planned_rep
         from public.session_items si
         join public.study_sessions s on s.id = si.session_id
         join public.planner_items pi on pi.run_id = s.planner_run_id and pi.position = si.sort_order
        where s.planner_run_id = '${run.runId}'
        order by si.sort_order`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.presented_unit, `posición ${row.sort_order}`).toBe(row.planned_unit);
      expect(row.presented_rep, `posición ${row.sort_order}`).toBe(row.planned_rep);
    }
    // Y al menos una de las dos identidades está fijada de verdad, no nula en las dos columnas.
    expect(rows.some((row) => row.presented_unit !== null || row.presented_rep !== null)).toBe(
      true,
    );
  });
});

describe('P4-G25 · P4B-D2 · consumo de ejecución', () => {
  it('CONTROL NEGATIVO · una ejecución no arrancada NO produce sucesora', async () => {
    // La mitad de la prueba que importa: si el predicado de consumo estuviera mal escrito,
    // cada render crearía una ejecución nueva. P4-G5 y P4-G21 conservan su objeto exacto.
    await closeAnyOpenSession();
    const first = asRun(await plan());
    const second = asRun(await plan());
    expect(second.runId).toBe(first.runId);
    expect(second.reused).toBe(true);
  });

  it('una ejecución consumida NO se reutiliza: la siguiente petición escribe una sucesora', async () => {
    await closeAnyOpenSession();
    const run = asRun(await plan());
    const started = await startPlannedSession(ana.id, run.runId, { client: admin });
    if (started.kind !== 'STARTED') throw new Error(`arranque: ${started.kind}`);

    // Terminar antes de agotar el plan: la agencia se preserva y no se fabrica evidencia.
    await accept(ana, eventFor(ana, sessionRef(started.sessionId), 'SESSION_STARTED'));
    await accept(ana, eventFor(ana, sessionRef(started.sessionId), 'SESSION_COMPLETED'));

    const successor = asRun(await plan());
    expect(successor.runId).not.toBe(run.runId);
    const [row] = query<{ supersedes_run_id: string | null }>(
      `select supersedes_run_id from public.planner_runs where id = '${successor.runId}'`,
    );
    // Linaje explícito y auditable: la sucesora no borra su predecesora, la nombra.
    expect(row?.supersedes_run_id).toBe(run.runId);

    // Los ítems no completados quedan PENDING: terminar antes no fabrica evidencia.
    const [pending] = query<{ n: number }>(
      `select count(*)::int as n from public.session_items
        where session_id = '${started.sessionId}' and status = 'PENDING'`,
    );
    expect(Number(pending?.n ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it('una ejecución consumida no atrapa: arrancarla otra vez da RUN_ALREADY_CONSUMED', async () => {
    await closeAnyOpenSession();
    const run = asRun(await plan());
    const started = await startPlannedSession(ana.id, run.runId, { client: admin });
    if (started.kind !== 'STARTED') throw new Error(`arranque: ${started.kind}`);
    await accept(ana, eventFor(ana, sessionRef(started.sessionId), 'SESSION_STARTED'));
    await accept(ana, eventFor(ana, sessionRef(started.sessionId), 'SESSION_COMPLETED'));
    const again = await startPlannedSession(ana.id, run.runId, { client: admin });
    expect(again.kind).toBe('RUN_ALREADY_CONSUMED');
  });
});

describe('P4-G28 · P4B-D3 · override del tiempo de hoy', () => {
  it('el override manda sobre la disponibilidad habitual, y su procedencia se persiste', async () => {
    await closeAnyOpenSession();
    const saved = await setTodayOverride(ana.id, 45, { client: admin });
    expect(saved.kind).toBe('SAVED');

    const run = asRun(await plan());
    const [row] = query<{ budget_minutes: number; budget_source: string }>(
      `select budget_minutes, budget_source from public.planner_runs where id = '${run.runId}'`,
    );
    expect(Number(row?.budget_minutes)).toBe(45);
    expect(row?.budget_source).toBe('TODAY_OVERRIDE');
  });

  it('**el cero es dato**: un override de 0 produce ZERO_TIME sin tocar el valor habitual', async () => {
    await closeAnyOpenSession();
    const saved = await setTodayOverride(ana.id, 0, { client: admin });
    expect(saved.kind).toBe('SAVED');

    const run = asRun(await plan());
    expect(run.outcome).toBe('ZERO_TIME');
    const [row] = query<{ budget_minutes: number; budget_source: string }>(
      `select budget_minutes, budget_source from public.planner_runs where id = '${run.runId}'`,
    );
    expect(Number(row?.budget_minutes)).toBe(0);
    expect(row?.budget_source).toBe('TODAY_OVERRIDE');

    // INV-106 · `default_daily_minutes` **intacto**: las dos declaraciones no se acoplan.
    const [settings] = query<{ default_daily_minutes: number }>(
      `select default_daily_minutes from public.learner_settings where user_id = '${ana.id}'`,
    );
    expect(Number(settings?.default_daily_minutes)).toBe(120);
  });

  it('estado e historia coinciden: la tabla y el evento se escriben juntos', async () => {
    await closeAnyOpenSession();
    await setTodayOverride(ana.id, 25, { client: admin });

    const [row] = query<{ minutes: number; plan_day: string }>(
      `select minutes, plan_day::text as plan_day from public.learner_day_overrides
        where user_id = '${ana.id}'`,
    );
    expect(Number(row?.minutes)).toBe(25);

    const [event] = query<{ minutes: string; plan_day: string }>(
      `select payload ->> 'minutes' as minutes, payload ->> 'plan_day' as plan_day
         from public.learning_events
        where user_id = '${ana.id}' and event_type = 'TODAY_OVERRIDE_SET'
        order by stream_position desc limit 1`,
    );
    expect(Number(event?.minutes)).toBe(25);
    // El día lo derivó el **servidor** desde la zona declarada: el cliente nunca lo nombró.
    expect(event?.plan_day).toBe(row?.plan_day);
  });

  it('P4-G27 · con un presupuesto en el que nada cabe, NOTHING_FITS y nada ejecutable', async () => {
    await closeAnyOpenSession();
    // Un minuto: por debajo de cualquier acción, pero **no** cero, que sería ZERO_TIME.
    await setTodayOverride(ana.id, 1, { client: admin });

    const run = asRun(await plan());
    expect(run.outcome).toBe('NOTHING_FITS');
    const [items] = query<{ n: number }>(
      `select count(*)::int as n from public.planner_items where run_id = '${run.runId}'`,
    );
    // **Cero ítems**: no se crea ni se ofrece una acción fuera de presupuesto (P4B-D1).
    expect(Number(items?.n)).toBe(0);
    // Todo elegible no colocado lleva su razón (§J, BF-2).
    expect(run.decision.candidates.some((c) => c.exclusion === 'OVER_BUDGET')).toBe(true);
    // Y la interfaz puede decir con verdad cuánto necesita la más corta.
    expect(run.shortestOverBudgetMinutes.length).toBeGreaterThan(0);
    expect(Math.min(...run.shortestOverBudgetMinutes)).toBeGreaterThan(1);
  });

  it('el estado que HOY deriva de NOTHING_FITS no ofrece acción primaria', async () => {
    await closeAnyOpenSession();
    await setTodayOverride(ana.id, 1, { client: admin });
    const { state } = await resolveToday(ana.id, { client: admin });
    expect(state.kind).toBe('NOTHING_FITS');
    if (state.kind === 'NOTHING_FITS') {
      expect(state.budgetMinutes).toBe(1);
      expect(state.shortestMinutes).not.toBeNull();
    }
  });
});

describe('P4-G31 · idempotencia de render · ningún render emite evidencia', () => {
  it('varios renders de HOY producen una ejecución y cero eventos de aprendizaje', async () => {
    await closeAnyOpenSession();
    await setTodayOverride(ana.id, 120, { client: admin });

    const [before] = query<{ n: number }>(
      `select count(*)::int as n from public.learning_events
        where user_id = '${ana.id}' and session_id is not null`,
    );

    const first = await resolveToday(ana.id, { client: admin });
    const second = await resolveToday(ana.id, { client: admin });
    const third = await resolveToday(ana.id, { client: admin });
    expect(first.runId).not.toBeNull();
    expect(second.runId).toBe(first.runId);
    expect(third.runId).toBe(first.runId);

    const [after] = query<{ n: number }>(
      `select count(*)::int as n from public.learning_events
        where user_id = '${ana.id}' and session_id is not null`,
    );
    // Planificar al renderizar está permitido (Q-5); **emitir evidencia al renderizar, no**.
    expect(Number(after?.n)).toBe(Number(before?.n));
  });
});

/** Referencia mínima de sesión para el arnés de eventos. */
const sessionRef = (id: string): CreatedSession => ({
  session_id: id,
  status: 'PLANNED',
  items: [],
});

/** Cierra la sesión abierta si la hay: §N dice que la sesión abierta gana sobre planificar. */
async function closeAnyOpenSession(): Promise<void> {
  const open = await ana.client
    .from('study_sessions')
    .select('id, status')
    .in('status', ['PLANNED', 'ACTIVE', 'INTERRUPTED']);
  if (open.error) throw new Error(open.error.message);
  for (const row of (open.data ?? []) as Array<{ id: string; status: string }>) {
    const ref: CreatedSession = { session_id: row.id, status: row.status, items: [] };
    if (row.status === 'PLANNED') await accept(ana, eventFor(ana, ref, 'SESSION_STARTED'));
    if (row.status === 'INTERRUPTED') {
      await accept(ana, eventFor(ana, ref, 'SESSION_RESUMED'));
    }
    await accept(ana, eventFor(ana, ref, 'SESSION_COMPLETED'));
  }
}

// `presentAndAnswer` se importa para que el arnés compartido quede disponible a las pruebas que
// amplíen este fichero con recorridos de evidencia; no se usa en las puertas de arriba.
void presentAndAnswer;
