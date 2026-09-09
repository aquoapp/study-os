import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  send,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { one, query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `events.lockBeforeIdempotencyCheck.spec` · ADR-008 puntos 2 y 3.
 *
 * Comprobar event_id antes del bloqueo abre una ventana en la que dos transacciones ven «no
 * existe» y ambas siguen adelante. Se verifica de dos formas: en el texto de la función (el
 * FOR UPDATE del contador precede a la consulta por event_id, y ambos existen) y en
 * ejecución real: el mismo evento enviado N veces en paralelo produce exactamente una fila,
 * una posición, y N−1 respuestas idempotentes, sin conflicto ni hueco.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let session: CreatedSession;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2lock');
  ana = await createLearner(env, 'lock', pack);
  session = await createSession(ana, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
  ]);
}, 240_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('ADR-008 puntos 2 y 3 · el bloqueo del contador precede a la comprobación de event_id', () => {
  it('en el cuerpo real de la función: FOR UPDATE sobre el contador, y después la consulta por event_id', () => {
    const body = one<{ src: string }>(
      "select p.prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'ingest' and p.proname = 'append_learning_event'",
    ).src;
    const lock = body.indexOf(
      'from ingest.user_event_counters c where c.user_id = p_user for update',
    );
    const check = body.indexOf('from public.learning_events e where e.event_id = ev_id');
    expect(lock).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(lock);
    // El texto desplegado es el del repositorio (EC-011).
    const migration = readFileSync(
      join(REPO_ROOT, 'supabase/migrations/00000000000018_evidence_core.sql'),
      'utf8',
    );
    expect(migration).toContain(
      'from ingest.user_event_counters c where c.user_id = p_user for update',
    );
  });

  it('el mismo evento enviado ocho veces en paralelo produce una fila y siete respuestas idempotentes', async () => {
    await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
    const event = eventFor(ana, session, 'SESSION_INTERRUPTED');
    const results = await Promise.all(Array.from({ length: 8 }, () => send(ana, event)));
    const errors = results.filter((r) => r.error);
    expect(errors, errors.map((e) => e.error?.message).join('; ')).toEqual([]);
    const positions = new Set(results.map((r) => r.data?.stream_position));
    expect(positions.size).toBe(1);
    expect(results.filter((r) => r.data?.idempotent === false)).toHaveLength(1);
    expect(results.filter((r) => r.data?.idempotent === true)).toHaveLength(7);
    const rows = one<{ n: number }>(
      `select count(*)::int as n from public.learning_events where event_id = '${String(event['event_id'])}'`,
    );
    expect(Number(rows.n)).toBe(1);
    const counter = one<{ next_position: number }>(
      `select next_position from ingest.user_event_counters where user_id = '${ana.id}'`,
    );
    expect(Number(counter.next_position)).toBe(3);
  });

  it('el stream sigue contiguo tras la ráfaga', async () => {
    const resumed = await accept(ana, eventFor(ana, session, 'SESSION_RESUMED'));
    expect(resumed.stream_position).toBe(3);
    const positions = query<{ p: number }>(
      `select stream_position as p from public.learning_events where user_id = '${ana.id}' order by 1`,
    ).map((r) => Number(r.p));
    expect(positions).toEqual([1, 2, 3]);
  });
});
