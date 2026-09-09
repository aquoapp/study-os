import { randomUUID } from 'node:crypto';

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
  envelope,
  eventFor,
  itemAt,
  itemEvent,
  presentAndAnswer,
  reject,
  rpc,
  send,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { attack, one, query } from '../support/sql';
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `phase2.redteam.spec` · auditoría adversarial del núcleo de evidencia · gate P2-G6.
 *
 * Cada prueba intenta romper una frontera de Phase 2 y exige que el sistema la rechace.
 * Superficies atacadas: descubrimiento del Data API, embeds, RPC, rol de servicio,
 * funciones `SECURITY DEFINER`, validación de esquema de evento, inmutabilidad de la
 * evidencia y el flujo validado de creación de sesión.
 *
 * Un ataque que prospera es un fallo duro del checkpoint, nunca deuda. Los ataques contra
 * la base usan `attack()`: bloques que siempre revierten, ejecutados como propietario, de
 * modo que lo único que puede detenerlos son triggers, restricciones y privilegios.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let session: CreatedSession;
let userToken = '';
let attemptId = '';

/**
 * Palabras que el Data API no puede describir jamás.
 *
 * `answer_key_versions` es la tabla de claves y vive en `content`; `correct_option` y
 * `explanation` son el material de corrección. Lo que sí aparece —y debe aparecer— es
 * `question_attempts.answer_key_version_id`: una referencia opaca a una fila que el cliente
 * no puede leer, exigida por EC-007 para que el intento conserve con qué versión se evaluó.
 * Por eso el patrón nombra la tabla y no el prefijo: un patrón que confundiera las dos cosas
 * obligaría a relajar la prueba en la primera columna legítima, y ahí es donde se pierden.
 */
const PRIVATE_WORDS =
  /answer_key_versions|correct_option|explanation|staged_items|promotions|content\.|ingest\./i;

async function rest(path: string, headers: Record<string, string>, method = 'GET') {
  const response = await fetch(`${env.url}/rest/v1${path}`, {
    method,
    headers: { apikey: env.anonKey, ...headers },
  });
  return { status: response.status, body: await response.text() };
}

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2red');
  ana = await createLearner(env, 'red', pack);
  const { data } = await ana.client.auth.getSession();
  userToken = data.session?.access_token ?? '';
  expect(userToken).not.toBe('');
  session = await createSession(ana, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
  ]);
  await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
  const answered = await presentAndAnswer(
    ana,
    session,
    itemAt(session, 0),
    question(pack, 0).representationId,
    {
      option_key: 'A',
      confidence: 3,
    },
  );
  attemptId = String(answered.attempt?.['attempt_id']);
}, 300_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

// ---------------------------------------------------------------------------
describe('descubrimiento y metadatos: la frontera de Phase 1A sigue cerrada con Phase 2 encima', () => {
  it('el OpenAPI no describe nada privado para ningún rol', async () => {
    for (const headers of [{}, { Authorization: `Bearer ${userToken}` }]) {
      const { status, body } = await rest('/', headers);
      expect([200, 401]).toContain(status);
      expect(body).not.toMatch(PRIVATE_WORDS);
    }
    const withService = await rest('/', {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    });
    expect(withService.status).toBe(200);
    expect(withService.body).not.toMatch(PRIVATE_WORDS);
    // Y sí describe lo que el cliente puede usar en Phase 2.
    expect(withService.body).toMatch(/learning_events/);
    expect(withService.body).toMatch(/append_learning_event/);
  });

  it('Accept-Profile con un esquema privado se rechaza también para las tablas de Phase 2', async () => {
    for (const bearer of [null, userToken, env.serviceRoleKey]) {
      for (const [schema, table] of [
        ['ingest', 'user_event_counters'],
        ['ingest', 'user_question_counters'],
        ['content', 'answer_key_versions'],
      ] as const) {
        const { status, body } = await rest(`/${table}?select=*`, {
          'Accept-Profile': schema,
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        });
        expect(status, `${schema}.${table}`).toBeGreaterThanOrEqual(400);
        expect(body).not.toMatch(/correct_option_id|next_position|next_attempt_number/);
      }
    }
  });

  it('un embed no alcanza la clave desde el intento propio', async () => {
    const { error } = await ana.client
      .from('question_attempts')
      .select('id, answer_key_versions(*)')
      .limit(1);
    expect(error).not.toBeNull();
    expect(JSON.stringify(error)).not.toMatch(/correct_option_id/);
  });

  it('los contadores de la frontera no son legibles por ningún rol de cliente', async () => {
    for (const client of [ana.client, anonClient(env)]) {
      const { data, error } = await client.from('user_event_counters').select('*').limit(1);
      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
describe('RPC: solo dos son invocables por el cliente, y ninguna corrige por su cuenta', () => {
  const reserved = [
    'grade_attempt',
    'submit_attempt',
    'recalculate_attempts',
    'apply_answer_key_amendment',
    'rebuild_projections',
    'recalculate_mastery',
    'advance_event_watermark',
    'promote_engine_config',
    'run_planner',
    'stage_item',
    'validate_staged_item',
    'publish_staged_item',
    'copy_forward_question_concepts',
    'purge_generated_pack',
  ];

  for (const name of reserved) {
    it(`${name} · el aprendiz autenticado recibe denegación`, async () => {
      const { error } = await ana.client.rpc(name, {});
      expect(error, `${name} respondió sin error`).not.toBeNull();
      expect(JSON.stringify(error)).not.toMatch(/correct_option_id|explanation/);
    });
  }

  it('las funciones internas de `ingest` no son invocables desde el Data API', async () => {
    for (const name of [
      'append_learning_event',
      'create_study_session',
      'normalize_attempt',
      'resolve_answer_key',
    ]) {
      const { status } = await rest(
        `/rpc/${name}`,
        {
          Authorization: `Bearer ${userToken}`,
          'Content-Profile': 'ingest',
          'Content-Type': 'application/json',
        },
        'POST',
      );
      expect(status, `ingest.${name}`).toBeGreaterThanOrEqual(400);
    }
  });

  it('anon no puede invocar las dos RPC de cliente', async () => {
    const anon = anonClient(env);
    for (const [name, args] of [
      ['append_learning_event', { p_event: {} }],
      ['create_study_session', { p_goal_id: randomUUID(), p_session_type: 'X' }],
    ] as const) {
      const { error } = await anon.rpc(name, args);
      expect(error, `${name} aceptó a anon`).not.toBeNull();
    }
  });

  it('el catálogo confirma que solo esas dos son ejecutables por authenticated', () => {
    const fns = query<{ name: string }>(
      "select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE') order by 1",
    );
    expect(fns.map((f) => f.name)).toEqual(['append_learning_event', 'create_study_session']);
    const anonFns = query<{ name: string }>(
      "select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','content','ingest') and has_function_privilege('anon', p.oid, 'EXECUTE')",
    );
    expect(anonFns).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('rol de servicio: lee la evidencia, no la fabrica', () => {
  it('no puede insertar eventos ni intentos por el Data API', async () => {
    for (const table of [
      'learning_events',
      'question_attempts',
      'study_sessions',
      'session_items',
    ]) {
      const { error } = await admin.from(table).insert({ user_id: ana.id });
      expect(error, `${table}: el rol de servicio insertó`).not.toBeNull();
      expect(error?.code).toBe('42501');
    }
  });

  it('no puede borrar ni modificar evidencia por el Data API', async () => {
    const del = await admin.from('learning_events').delete().eq('user_id', ana.id);
    expect(del.error?.code).toBe('42501');
    const upd = await admin
      .from('question_attempts')
      .update({ response_ms: 1 })
      .eq('user_id', ana.id);
    expect(upd.error?.code).toBe('42501');
  });

  it('tampoco puede tocar los contadores de la frontera', () => {
    // Solo los roles de la API: el propietario de la base aparece siempre con sus propios
    // privilegios sobre sus tablas, y eso no es una concesión que nadie haya hecho.
    const grants = query<{ grantee: string; privilege: string }>(
      'select grantee, privilege_type as privilege from information_schema.role_table_grants ' +
        "where table_schema = 'ingest' and table_name in ('user_event_counters','user_question_counters') " +
        "and grantee in ('anon','authenticated','service_role') order by 1, 2",
    );
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant.grantee, `un rol de cliente alcanza los contadores: ${grant.grantee}`).toBe(
        'service_role',
      );
      expect(grant.privilege, 'el rol de servicio escribe en los contadores').toBe('SELECT');
    }
  });
});

// ---------------------------------------------------------------------------
describe('validación de esquema de evento (REQ-C06 · CDEM §10)', () => {
  const malformed: Array<[string, Record<string, unknown>, string]> = [
    ['tipo de evento inexistente', { event_type: 'NO_EXISTE' }, 'EVENT_TYPE_UNKNOWN'],
    ['schema_version no soportada', { schema_version: 2 }, 'SCHEMA_VERSION_UNSUPPORTED'],
    ['clave desconocida en el sobre', { intruso: 1 }, 'ENVELOPE_UNKNOWN_KEY'],
    ['event_id que no es UUID', { event_id: 'no-es-uuid' }, 'ENVELOPE_TYPE'],
    ['client_created_at que no es instante', { client_created_at: 'ayer' }, 'ENVELOPE_TYPE'],
    ['payload que no es objeto', { payload: [] }, 'ENVELOPE_TYPE'],
  ];

  for (const [nombre, override, code] of malformed) {
    it(`rechaza ${nombre}`, async () => {
      const base = eventFor(ana, session, 'SESSION_INTERRUPTED');
      await reject(ana, { ...base, ...override }, code);
    });
  }

  it('rechaza un tipo de la taxonomía que Phase 2 no acepta todavía', async () => {
    // `NOTE_CREATED` está en la taxonomía P0 del CDEM pero su fase productora es la 8: sin
    // esquema declarado, aceptarlo sería admitir evidencia que nadie sabe validar.
    await reject(ana, envelope(ana, 'NOTE_CREATED', {}), 'EVENT_TYPE_NOT_ACCEPTED');
    await reject(ana, envelope(ana, 'SYNC_PENDING', {}), 'EVENT_TYPE_NOT_ACCEPTED');
  });

  it('rechaza una clave desconocida y un tipo equivocado dentro del payload', async () => {
    await reject(
      ana,
      eventFor(ana, session, 'SESSION_INTERRUPTED', { motivo: 'x' }),
      'PAYLOAD_UNKNOWN_KEY',
    );
    await reject(ana, eventFor(ana, session, 'SESSION_INTERRUPTED', { reason: 5 }), 'PAYLOAD_TYPE');
  });

  it('exige las claves obligatorias del tipo', async () => {
    const item = itemAt(session, 0);
    await reject(ana, itemEvent(ana, session, item, 'QUESTION_PRESENTED', {}), 'PAYLOAD_MISSING');
    await reject(
      ana,
      itemEvent(ana, session, item, 'CONFIDENCE_RECORDED', { confidence_value: 2 }),
      'PAYLOAD_MISSING',
    );
  });

  it('exige el ámbito correcto: sesión, ítem o usuario', async () => {
    await reject(ana, envelope(ana, 'SESSION_INTERRUPTED', {}), 'SESSION_REQUIRED');
    await reject(
      ana,
      eventFor(ana, session, 'QUESTION_PRESENTED', { question_representation_id: randomUUID() }),
      'ITEM_REQUIRED',
    );
    await reject(
      ana,
      eventFor(ana, session, 'AVAILABILITY_CHANGED', {
        default_daily_minutes: 30,
        weekly_availability_json: { mon: 30 },
      }),
      'SESSION_NOT_ALLOWED',
    );
  });

  it('exige que el tipo de ítem case con el tipo de evento', async () => {
    const review = await createSession(ana, [
      { item_type: 'CONCEPT_REVIEW', target_id: pack.conceptIds[0] ?? '' },
    ]);
    await accept(ana, eventFor(ana, review, 'SESSION_STARTED'));
    await reject(
      ana,
      itemEvent(ana, review, itemAt(review, 0), 'QUESTION_PRESENTED', {
        question_representation_id: question(pack, 0).representationId,
      }),
      'ITEM_TYPE_MISMATCH',
    );
  });

  it('un dispositivo o un evento de origen ajenos se rechazan', async () => {
    const otro = await createTestUser(env, 'red-otro');
    try {
      const foreignDevice = await otro.client
        .from('devices')
        .insert({ user_id: otro.id, installation_id: `inst-${randomUUID()}` })
        .select('id')
        .single();
      await reject(
        ana,
        eventFor(
          ana,
          session,
          'SESSION_INTERRUPTED',
          {},
          { device_id: String(foreignDevice.data?.id) },
        ),
        'DEVICE_NOT_OWNED',
      );
    } finally {
      await deleteTestUser(env, otro.id);
    }
  });
});

// ---------------------------------------------------------------------------
describe('flujo validado de creación de sesión', () => {
  it('no se puede crear una sesión sobre el objetivo de otro aprendiz', async () => {
    const otro = await createLearner(env, 'red-goal', pack);
    try {
      const result = await rpc(ana.client, 'create_study_session', {
        p_goal_id: otro.goalId,
        p_session_type: 'FIXTURE',
        p_items: [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }],
      });
      expect(result.error?.message).toContain('GOAL_NOT_FOUND');
      const leaked = query<{ n: number }>(
        `select count(*)::int as n from public.study_sessions where learner_exam_goal_id = '${otro.goalId}' and user_id = '${ana.id}'`,
      );
      expect(Number(leaked[0]?.n)).toBe(0);
    } finally {
      await deleteTestUser(env, otro.id);
    }
  });

  it('un destino que no existe, o de otro pack, se rechaza', async () => {
    const inexistente = await rpc(ana.client, 'create_study_session', {
      p_goal_id: ana.goalId,
      p_session_type: 'FIXTURE',
      p_items: [{ item_type: 'QUESTION', target_id: randomUUID() }],
    });
    expect(inexistente.error?.message).toContain('TARGET_NOT_FOUND');

    const otroPack = await buildSyntheticPack(admin, 'p2red2');
    try {
      const fuera = await rpc(ana.client, 'create_study_session', {
        p_goal_id: ana.goalId,
        p_session_type: 'FIXTURE',
        p_items: [{ item_type: 'QUESTION', target_id: question(otroPack, 0).questionId }],
      });
      expect(fuera.error?.message).toContain('TARGET_OUTSIDE_GOAL_PACK');
    } finally {
      await purgePack(admin, otroPack.packId);
    }
  });

  it('un tipo de ítem que no existe en ADR-007 v1.1 se rechaza', async () => {
    const result = await rpc(ana.client, 'create_study_session', {
      p_goal_id: ana.goalId,
      p_session_type: 'FIXTURE',
      p_items: [{ item_type: 'SIMULATION', target_id: question(pack, 0).questionId }],
    });
    expect(result.error?.message).toContain('ITEM_MALFORMED');
  });

  it('una sesión sin ítems, o con un tipo de sesión malformado, se rechaza', async () => {
    const vacia = await rpc(ana.client, 'create_study_session', {
      p_goal_id: ana.goalId,
      p_session_type: 'FIXTURE',
      p_items: [],
    });
    expect(vacia.error?.message).toContain('ITEMS_MALFORMED');
    const tipo = await rpc(ana.client, 'create_study_session', {
      p_goal_id: ana.goalId,
      p_session_type: 'no vale',
      p_items: [{ item_type: 'QUESTION', target_id: question(pack, 0).questionId }],
    });
    expect(tipo.error?.message).toContain('SESSION_TYPE_MALFORMED');
  });
});

// ---------------------------------------------------------------------------
describe('integridad de la evidencia frente al propietario de la base', () => {
  it('el destino y la posición de un ítem de sesión son inmutables (ADR-007)', () => {
    const item = one<{ id: string }>(
      `select id from public.session_items where session_id = '${session.session_id}' limit 1`,
    );
    const retargeted = attack(
      `update public.session_items set question_id = null, item_type = 'CONCEPT_REVIEW', concept_id = '${pack.conceptIds[0]}' where id = '${item.id}';`,
    );
    expect(retargeted.rejected, retargeted.message).toBe(true);
    const reordered = attack(
      `update public.session_items set sort_order = 99 where id = '${item.id}';`,
    );
    expect(reordered.rejected, reordered.message).toBe(true);
  });

  it('un ítem no puede quedarse sin destino ni con dos (ADR-007 CHECK)', () => {
    const sinDestino = attack(
      `insert into public.session_items (session_id, user_id, item_type, sort_order) values ('${session.session_id}', '${ana.id}', 'QUESTION', 50);`,
    );
    expect(sinDestino.rejected, sinDestino.message).toBe(true);
    const dosDestinos = attack(
      `insert into public.session_items (session_id, user_id, item_type, question_id, concept_id, sort_order) values ('${session.session_id}', '${ana.id}', 'QUESTION', '${question(pack, 0).questionId}', '${pack.conceptIds[0]}', 51);`,
    );
    expect(dosDestinos.rejected, dosDestinos.message).toBe(true);
    const tipoQueNoCasa = attack(
      `insert into public.session_items (session_id, user_id, item_type, concept_id, sort_order) values ('${session.session_id}', '${ana.id}', 'QUESTION', '${pack.conceptIds[0]}', 52);`,
    );
    expect(tipoQueNoCasa.rejected, tipoQueNoCasa.message).toBe(true);
  });

  it('un ítem de sesión no puede pertenecer a la sesión de otro usuario (CDEM §23)', () => {
    const cruzado = attack(
      `insert into public.session_items (session_id, user_id, item_type, question_id, sort_order) values ('${session.session_id}', gen_random_uuid(), 'QUESTION', '${question(pack, 0).questionId}', 53);`,
    );
    expect(cruzado.rejected, cruzado.message).toBe(true);
  });

  it('un destino canónico referenciado no se puede borrar (ON DELETE RESTRICT)', () => {
    const borrado = attack(
      `delete from public.canonical_questions where id = '${question(pack, 0).questionId}';`,
    );
    expect(borrado.rejected, borrado.message).toBe(true);
  });

  it('un evento no puede referenciar la sesión de otro usuario', () => {
    const cruzado = attack(
      `insert into public.learning_events (event_id, user_id, session_id, event_type, schema_version, payload, client_created_at, stream_position, payload_hash, canonicalization_version)
       values (gen_random_uuid(), gen_random_uuid(), '${session.session_id}', 'SESSION_STARTED', 1, '{}'::jsonb, now(), 1, repeat('a', 64), 'v1');`,
    );
    expect(cruzado.rejected, cruzado.message).toBe(true);
  });

  it('dos eventos del mismo usuario no pueden compartir posición', () => {
    const duplicada = attack(
      `insert into public.learning_events (event_id, user_id, event_type, schema_version, payload, client_created_at, stream_position, payload_hash, canonicalization_version)
       select gen_random_uuid(), e.user_id, 'SESSION_STARTED', 1, '{}'::jsonb, now(), e.stream_position, repeat('b', 64), 'v1' from public.learning_events e where e.user_id = '${ana.id}' limit 1;`,
    );
    expect(duplicada.rejected, duplicada.message).toBe(true);
  });

  it('un intento no puede nacer sin versión de clave ni con una versión de otra representación', () => {
    const sinClave = attack(
      `insert into public.question_attempts (user_id, question_id, question_representation_id, answer_key_version_id, session_id, session_item_id, submitted_event_id, answer_kind, is_correct_at_submission, attempt_number, answer_payload_hash, canonicalization_version, submitted_at)
       select a.user_id, a.question_id, a.question_representation_id, null, a.session_id, a.session_item_id, gen_random_uuid(), 'BLANK', false, 9, a.answer_payload_hash, 'v1', now() from public.question_attempts a where a.id = '${attemptId}';`,
    );
    expect(sinClave.rejected, sinClave.message).toBe(true);
    const claveAjena = attack(
      `insert into public.question_attempts (user_id, question_id, question_representation_id, answer_key_version_id, session_id, session_item_id, submitted_event_id, answer_kind, is_correct_at_submission, attempt_number, answer_payload_hash, canonicalization_version, submitted_at)
       select a.user_id, a.question_id, '${question(pack, 1).representationId}', a.answer_key_version_id, a.session_id, a.session_item_id, gen_random_uuid(), 'BLANK', false, 10, a.answer_payload_hash, 'v1', now() from public.question_attempts a where a.id = '${attemptId}';`,
    );
    expect(claveAjena.rejected, claveAjena.message).toBe(true);
  });

  it('un blanco no puede declararse correcto', () => {
    const blancoCorrecto = attack(
      `insert into public.question_attempts (user_id, question_id, question_representation_id, answer_key_version_id, session_id, session_item_id, submitted_event_id, answer_kind, selected_option_id, is_correct_at_submission, attempt_number, answer_payload_hash, canonicalization_version, submitted_at)
       select a.user_id, a.question_id, a.question_representation_id, a.answer_key_version_id, a.session_id, a.session_item_id, gen_random_uuid(), 'BLANK', null, true, 11, a.answer_payload_hash, 'v1', now() from public.question_attempts a where a.id = '${attemptId}';`,
    );
    expect(blancoCorrecto.rejected, blancoCorrecto.message).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('la evidencia no se escribe por ninguna vía que no sea la función', () => {
  it('un evento con posición inventada por el cliente no llega: la asigna el servidor', async () => {
    const result = await send(ana, {
      ...eventFor(ana, session, 'SESSION_INTERRUPTED'),
      stream_position: 999,
    });
    expect(result.error?.message).toContain('AUTHORITATIVE_FIELD_REJECTED');
    const max = one<{ p: number }>(
      `select max(stream_position) as p from public.learning_events where user_id = '${ana.id}'`,
    );
    expect(Number(max.p)).toBeLessThan(999);
  });

  it('el aprendiz no puede marcar su propio intento como correcto por ninguna ruta', async () => {
    const upd = await ana.client
      .from('question_attempts')
      .update({ is_correct_at_submission: true })
      .eq('id', attemptId);
    expect(upd.error?.code).toBe('42501');
    const row = one<{ c: boolean }>(
      `select is_correct_at_submission as c from public.question_attempts where id = '${attemptId}'`,
    );
    expect(row.c).toBe(false);
  });
});
