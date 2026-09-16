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
import { evidenceSnapshot, runCycle, sqlText } from '../support/engine-fixtures';
import { attack, one, query } from '../support/sql';
import {
  adminClient,
  anonClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `engine.security.spec` · INV-113 · EC-009 · ADR-011 anexo v1.1 · REQ-D08.
 *
 * El estado derivado no es alcanzable por ningún cliente, y no por convención: el esquema
 * `engine` no está en la lista de exposición, sus tablas nacen cerradas con RLS forzado y sus
 * funciones son `SECURITY DEFINER` con `search_path` vacío y sin `EXECUTE` para nadie que no
 * sea el rol de servicio.
 *
 * La configuración del motor, además, es inmutable por versión publicada: recalibrar exige
 * publicar otra y promocionarla con registro, nunca editar la activa en caliente.
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
  pack = await buildSyntheticPack(admin, 'p3sec');
  alice = await createLearner(env, 'engine-sec-alice', pack);
  bob = await createLearner(env, 'engine-sec-bob', pack);

  session = await createSession(alice, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
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

describe('ADR-011 anexo v1.1 · `engine` no se sirve por el Data API', () => {
  const tables = [
    'concept_mastery',
    'mastery_history',
    'error_patterns',
    'projection_watermarks',
    'engine_config',
  ];

  for (const table of tables) {
    it(`engine.${table} · anon`, async () => {
      const { data, error } = await anonClient(env).schema('engine').from(table).select('user_id');
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it(`engine.${table} · authenticated`, async () => {
      const { data, error } = await alice.client.schema('engine').from(table).select('user_id');
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it(`engine.${table} · ni siquiera el rol de servicio por el Data API`, async () => {
      // No lo impide el grant: lo impide la lista de exposición. Es la misma frontera que
      // protege `content` e `ingest`, y por eso el motor se prueba por SQL directo.
      const { data, error } = await admin.schema('engine').from(table).select('user_id');
      expect(error).not.toBeNull();
      expect(data).toBeNull();
      expect(error?.message ?? '').toMatch(/schema|exposed|not found|acceptable/i);
    });
  }

  it('ninguna RPC del motor es invocable por un cliente autenticado', async () => {
    for (const rpc of [
      'recalculate_mastery',
      'rebuild_projections',
      'evidence_snapshot',
      'stale_users',
    ]) {
      const { error } = await alice.client.schema('engine').rpc(rpc, {});
      expect(error, `${rpc} respondió sin error`).not.toBeNull();
    }
  });
});

describe('EC-009 · las tablas del motor nacen cerradas', () => {
  it('RLS habilitada y forzada en las cinco', () => {
    const rows = query<{ tablename: string; rls: boolean; forced: boolean }>(
      `select c.relname as tablename, c.relrowsecurity as rls, c.relforcerowsecurity as forced
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'engine' and c.relkind = 'r' order by c.relname`,
    );
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.rls, `${row.tablename} sin RLS`).toBe(true);
      expect(row.forced, `${row.tablename} sin FORCE`).toBe(true);
    }
  });

  it('ningún rol de cliente tiene USAGE sobre el esquema', () => {
    const row = one<{ anon: boolean; auth: boolean }>(
      `select has_schema_privilege('anon', 'engine', 'USAGE') as anon,
              has_schema_privilege('authenticated', 'engine', 'USAGE') as auth`,
    );
    expect(row.anon).toBe(false);
    expect(row.auth).toBe(false);
  });

  it('ningún rol de cliente tiene privilegios sobre ninguna tabla del motor', () => {
    const grants = query<{ grantee: string; table_name: string; privilege_type: string }>(
      `select grantee, table_name, privilege_type from information_schema.role_table_grants
       where table_schema = 'engine' and grantee in ('anon', 'authenticated', 'PUBLIC')`,
    );
    expect(grants).toEqual([]);
  });

  it('el rol de servicio solo lee: la escritura pasa por las funciones', () => {
    const grants = query<{ privilege_type: string }>(
      `select distinct privilege_type from information_schema.role_table_grants
       where table_schema = 'engine' and grantee = 'service_role' order by 1`,
    ).map((row) => row.privilege_type);
    expect(grants).toEqual(['SELECT']);
  });
});

describe('las funciones del motor son de servidor y están endurecidas', () => {
  it('toda función SECURITY DEFINER fija un `search_path` vacío', () => {
    // PostgreSQL guarda `set search_path = ''` como `search_path=""`: se compara contra el
    // literal que el catálogo escribe, no contra el que se escribió en la migración.
    const offenders = query<{ proname: string; config: string | null }>(
      `select p.proname, array_to_string(p.proconfig, ',') as config
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('engine', 'ingest') and p.prosecdef
         and (p.proconfig is null or not (p.proconfig @> array['search_path=""']))`,
    );
    expect(offenders.map((row) => row.proname)).toEqual([]);
  });

  it('ninguna función del motor la puede ejecutar `public`, `anon` ni `authenticated`', () => {
    const offenders = query<{ proname: string; grantee: string }>(
      `select p.proname, r.grantee
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join information_schema.role_routine_grants r
         on r.routine_schema = n.nspname and r.routine_name = p.proname
       where n.nspname = 'engine' and r.grantee in ('PUBLIC', 'anon', 'authenticated')`,
    );
    expect(offenders).toEqual([]);
  });

  it('`apply_projection` no es invocable ni por el rol de servicio: solo por sus dos envolturas', () => {
    // El propietario conserva su privilegio implícito, que no se puede revocar y que ningún
    // rol de aplicación posee. Lo que importa es que no lo tenga nadie más.
    const grants = query<{ grantee: string }>(
      `select r.grantee from information_schema.role_routine_grants r
       where r.routine_schema = 'engine' and r.routine_name = 'apply_projection'
         and r.grantee <> 'postgres'`,
    );
    expect(grants).toEqual([]);
  });
});

describe('aislamiento entre aprendices', () => {
  it('la evidencia de un aprendiz no contiene nada del otro', () => {
    const aliceSnapshot = evidenceSnapshot(alice.id);
    const bobSnapshot = evidenceSnapshot(bob.id);
    expect(aliceSnapshot.attempts.length).toBeGreaterThan(0);
    expect(bobSnapshot.attempts).toHaveLength(0);
    expect(Number(bobSnapshot.maxPosition)).toBe(0);
  });

  it('la proyección de un aprendiz no alcanza al otro', () => {
    const rows = query<{ user_id: string }>(
      `select user_id::text from engine.concept_mastery where user_id = ${sqlText(bob.id)}::uuid`,
    );
    expect(rows).toEqual([]);
  });
});

describe('REQ-D08 · `engine_config` es inmutable por versión publicada', () => {
  it('hay exactamente una versión ACTIVE', () => {
    const row = one<{ total: number }>(
      "select count(*)::int as total from engine.engine_config where status = 'ACTIVE'",
    );
    expect(Number(row.total)).toBe(1);
  });

  it('editar el documento de una versión publicada se rechaza', () => {
    const outcome = attack(
      `update engine.engine_config set document = '{"algorithm_id":"otro"}'::jsonb
       where status = 'ACTIVE';`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('inmutable');
  });

  it('borrar una versión publicada se rechaza', () => {
    const outcome = attack("delete from engine.engine_config where status = 'ACTIVE';");
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('no se borra');
  });

  it('la configuración activa no contiene ningún parámetro numérico de aprendizaje', () => {
    const row = one<{ document: Record<string, unknown> }>(
      "select document from engine.engine_config where status = 'ACTIVE'",
    );
    const keys = Object.keys(row.document);
    for (const forbidden of ['weights', 'weight', 'thresholds', 'bands', 'decay', 'half_life']) {
      expect(keys, `la configuración declara ${forbidden}`).not.toContain(forbidden);
    }
    expect(row.document['unset_policy_slots']).toEqual(['mastery_sufficiency', 'review_intervals']);
    expect(keys).not.toContain('mastery_sufficiency');
    expect(keys).not.toContain('review_intervals');
  });

  it('una versión con pesos no puede persistirse', () => {
    const outcome = attack(
      `insert into engine.engine_config (version, status, document, author, reason)
       values ('v99', 'DRAFT', '{"weights":{"accuracy":0.3},"unset_policy_slots":["mastery_sufficiency","review_intervals"]}'::jsonb,
               'test-suite', 'intento de introducir pesos');`,
    );
    expect(outcome.rejected).toBe(true);
  });

  it('una versión que fija una ranura declarada sin fijar no puede persistirse', () => {
    const outcome = attack(
      `insert into engine.engine_config (version, status, document, author, reason)
       values ('v98', 'DRAFT', '{"mastery_sufficiency":3,"unset_policy_slots":["mastery_sufficiency","review_intervals"]}'::jsonb,
               'test-suite', 'intento de fijar la suficiencia');`,
    );
    expect(outcome.rejected).toBe(true);
  });

  it('solo se promociona una versión DRAFT', () => {
    const outcome = attack(
      "perform engine.promote_engine_config('v1', 'test-suite', '{}'::jsonb);",
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('DRAFT');
  });

  it('la promoción exige aprobación registrada y evidencia', () => {
    const outcome = attack("perform engine.promote_engine_config('v1', null, null);");
    expect(outcome.rejected).toBe(true);
  });
});

describe('EC-005 · el historial del motor es append-only', () => {
  it('editar una fila del historial se rechaza', () => {
    const outcome = attack(
      `update engine.mastery_history set reason = 'REBUILD' where user_id = ${sqlText(alice.id)}::uuid;`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('no se edita');
  });

  it('borrar una fila del historial mientras exista el aprendiz se rechaza', () => {
    const outcome = attack(
      `delete from engine.mastery_history where user_id = ${sqlText(alice.id)}::uuid;`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('no se borra');
  });
});

describe('la proyección no admite precisión falsa ni por la puerta de atrás', () => {
  it('no se puede programar un repaso mientras la política esté sin fijar', () => {
    const outcome = attack(
      `update engine.concept_mastery set next_review_at = now() where user_id = ${sqlText(alice.id)}::uuid;`,
    );
    expect(outcome.rejected).toBe(true);
  });

  it('no se puede colar una puntuación dentro del vector', () => {
    const outcome = attack(
      `update engine.concept_mastery set vector = vector || '{"masteryScore":0.7}'::jsonb
       where user_id = ${sqlText(alice.id)}::uuid;`,
    );
    expect(outcome.rejected).toBe(true);
  });

  it('no se puede escribir un vector incompleto', () => {
    const outcome = attack(
      `update engine.concept_mastery set vector = '{"eligibleAttemptCount":1}'::jsonb
       where user_id = ${sqlText(alice.id)}::uuid;`,
    );
    expect(outcome.rejected).toBe(true);
  });

  it('un patrón de error no puede nacer RESOLVED ni por debajo del recuento gobernado', () => {
    const resolved = attack(
      `insert into engine.error_patterns
         (user_id, concept_id, pattern_type, status, evidence_count, engine_version,
          engine_config_version, attribution_generation)
       values (${sqlText(alice.id)}::uuid, ${sqlText(pack.conceptIds[0] as string)}::uuid,
               'RECURRENT_INCORRECT', 'RESOLVED', 3, 'concept-evidence-1.0.0', 'v1', 1);`,
    );
    expect(resolved.rejected).toBe(true);

    const tooFew = attack(
      `insert into engine.error_patterns
         (user_id, concept_id, pattern_type, status, evidence_count, engine_version,
          engine_config_version, attribution_generation)
       values (${sqlText(alice.id)}::uuid, ${sqlText(pack.conceptIds[0] as string)}::uuid,
               'RECURRENT_BLANK', 'ACTIVE', 2, 'concept-evidence-1.0.0', 'v1', 1);`,
    );
    expect(tooFew.rejected).toBe(true);
  });

  it('el enum de estado no contiene ningún término heredado', () => {
    const labels = query<{ label: string }>(
      `select e.enumlabel as label from pg_enum e
       join pg_type t on t.oid = e.enumtypid
       join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'engine' and t.typname = 'mastery_state' order by e.enumsortorder`,
    ).map((row) => row.label);
    expect(labels).toEqual([
      'NEW',
      'EXPOSED',
      'EVIDENCE_POSITIVE',
      'EVIDENCE_NEGATIVE',
      'EVIDENCE_CONFLICTING',
    ]);
    for (const reserved of ['LEARNING', 'CONSOLIDATING', 'MASTERED', 'STRONG']) {
      expect(labels, `${reserved} es alcanzable`).not.toContain(reserved);
    }
  });
});

describe('nada de Phase 4 ni de readiness ha llegado al catálogo', () => {
  it('no existe ninguna tabla de readiness, intervención ni planner', () => {
    const rows = query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_name in ('exam_readiness', 'intervention_outcomes', 'planner_runs',
                            'planner_items', 'review_schedule', 'simulation_runs')`,
    );
    expect(rows).toEqual([]);
  });
});
