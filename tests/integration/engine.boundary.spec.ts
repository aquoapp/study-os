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
  attributionSnapshot,
  computeFor,
  expectedProjection,
  persistedProjection,
  runCycle,
  sqlText,
} from '../support/engine-fixtures';
import { attack, one, query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `engine.boundary.spec` · D-21 y semántica histórica de atribución · SD-025.
 *
 * Lo que aquí se prueba es que **una mutación de mapeo no puede pasar desapercibida**: no se
 * puede hacer por la puerta de atrás, deja rastro, avanza la generación, y a partir de ese
 * momento continuar incrementalmente sobre la proyección anterior es imposible.
 *
 * Sin esto, el gate duro de EC-006 sería inestable sin que nada estuviera roto.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let learner: Learner;
let session: CreatedSession;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p3bnd');
  learner = await createLearner(env, 'engine-boundary', pack);
  session = await createSession(learner, [
    { item_type: 'QUESTION', target_id: question(pack, 0).questionId },
  ]);
  await accept(learner, eventFor(learner, session, 'SESSION_STARTED'));
  await presentAndAnswer(learner, session, itemAt(session, 0), question(pack, 0).representationId, {
    option_key: question(pack, 0).correctOptionKey,
    confidence: 3,
  });
  runCycle(learner.id);
}, 300_000);

afterAll(async () => {
  if (learner) await deleteTestUser(env, learner.id);
  if (pack) await purgePack(admin, pack.packId);
}, 180_000);

function primaryMappingId(): string {
  return one<{ id: string }>(
    `select id::text from public.question_concepts
     where question_id = ${sqlText(question(pack, 0).questionId)}::uuid
       and relationship_type = 'PRIMARY'`,
  ).id;
}

function generation(): number {
  return Number(
    one<{ generation: number }>(
      `select coalesce((select generation from ingest.attribution_generations
        where exam_pack_version_id = ${sqlText(pack.versionId)}::uuid), 1)::int as generation`,
    ).generation,
  );
}

describe('D-21 · la escritura directa deja de ser el camino ordinario', () => {
  it('el rol de servicio no tiene INSERT, UPDATE ni DELETE sobre los mapeos', () => {
    const grants = query<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'question_concepts'
         and grantee = 'service_role'`,
    ).map((row) => row.privilege_type);
    expect(grants).toContain('SELECT');
    for (const forbidden of ['INSERT', 'UPDATE', 'DELETE']) {
      expect(grants, `service_role conserva ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('ningún rol de cliente alcanza los mapeos para escribir', () => {
    const grants = query<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'question_concepts'
         and grantee in ('anon', 'authenticated')
         and privilege_type in ('INSERT', 'UPDATE', 'DELETE')`,
    );
    expect(grants).toEqual([]);
  });
});

describe('D-21 · la frontera valida la transición, la atribuye y deja rastro', () => {
  it('una transición vacía se rechaza', () => {
    const outcome = attack(
      `perform ingest.set_question_concept_mapping_status(
         ${sqlText(primaryMappingId())}::uuid, 'VALIDATED', 'test-suite', 'transición vacía');`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('transición vacía');
  });

  it('una transición no admitida se rechaza', () => {
    const outcome = attack(
      `perform ingest.set_question_concept_mapping_status(
         ${sqlText(primaryMappingId())}::uuid, 'PENDING_REVALIDATION', 'test-suite', 'degradar');`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('transición no admitida');
  });

  it('exige actor y motivo', () => {
    const outcome = attack(
      `perform ingest.set_question_concept_mapping_status(
         ${sqlText(primaryMappingId())}::uuid, 'REJECTED', null, 'sin actor');`,
    );
    expect(outcome.rejected).toBe(true);
  });

  it('un mapeo inexistente se rechaza', () => {
    const outcome = attack(
      `perform ingest.set_question_concept_mapping_status(
         '00000000-0000-4000-8000-000000000000'::uuid, 'REJECTED', 'test-suite', 'inexistente');`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('no existe');
  });
});

describe('SD-025 · una mutación semántica avanza la generación y obliga a recalcular', () => {
  it('la línea base existe y es explícita, no un `coalesce` implícito', () => {
    const rows = query<{ generation: number }>(
      `select generation::int as generation from ingest.attribution_generations
       where exam_pack_version_id = ${sqlText(pack.versionId)}::uuid`,
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.generation)).toBeGreaterThanOrEqual(1);
  });

  it('retirar el mapeo PRIMARY avanza la generación y deja auditoría', () => {
    const before = generation();
    const mappingId = primaryMappingId();

    const returned = one<{ set_question_concept_mapping_status: number }>(
      `select ingest.set_question_concept_mapping_status(
         ${sqlText(mappingId)}::uuid, 'REJECTED', 'test-suite', 'retirada de fixture')`,
    );
    expect(Number(returned.set_question_concept_mapping_status)).toBe(before + 1);
    expect(generation()).toBe(before + 1);

    const audit = query<{
      from_status: string;
      to_status: string;
      actor: string;
      reason: string;
      generation_after: number;
    }>(
      `select from_status::text, to_status::text, actor, reason, generation_after::int as generation_after
       from ingest.mapping_transitions where mapping_id = ${sqlText(mappingId)}::uuid`,
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]?.from_status).toBe('VALIDATED');
    expect(audit[0]?.to_status).toBe('REJECTED');
    expect(audit[0]?.actor).toBe('test-suite');
    expect(Number(audit[0]?.generation_after)).toBe(before + 1);
  });

  it('la semántica declarada deja de atribuir esa pregunta', () => {
    const snapshot = attributionSnapshot(pack.versionId);
    expect(snapshot.primaryConceptByQuestion.has(question(pack, 0).questionId)).toBe(false);
    expect(snapshot.generation).toBe(generation());
  });

  it('el ciclo siguiente **no** continúa incrementalmente: recalcula y lo registra', () => {
    const run = runCycle(learner.id);
    expect(run.mode).toBe('RECALCULATION');

    const last = one<{ reason: string }>(
      `select reason::text from engine.mastery_history
       where user_id = ${sqlText(learner.id)}::uuid order by created_at desc limit 1`,
    );
    expect(last.reason).toBe('RECALCULATION_ATTRIBUTION_CHANGED');
  }, 120_000);

  it('la evidencia deja de estar atribuida, se contabiliza y no desaparece', () => {
    const result = computeFor(learner.id);
    expect(result.unattributedAttemptCount).toBe(1);
    expect(result.concepts).toHaveLength(0);
    expect(persistedProjection(learner.id)).toBe(expectedProjection(result));

    const counters = one<{ unattributed: number }>(
      `select unattributed_attempt_count::int as unattributed from engine.projection_watermarks
       where user_id = ${sqlText(learner.id)}::uuid and projection_name = 'concept_mastery'`,
    );
    expect(Number(counters.unattributed)).toBe(1);

    // Y la evidencia sigue intacta: lo que cambió fue la atribución, no el hecho.
    const attempts = one<{ total: number }>(
      `select count(*)::int as total from public.question_attempts
       where user_id = ${sqlText(learner.id)}::uuid`,
    );
    expect(Number(attempts.total)).toBe(1);
  }, 120_000);
});

describe('el esquema no admite dos PRIMARY para la misma pregunta y versión', () => {
  it('un segundo PRIMARY se rechaza por índice único', () => {
    const outcome = attack(
      `insert into public.question_concepts
        (question_id, concept_id, exam_pack_id, exam_pack_version_id, relationship_type, weight,
         mapping_status, promotion_id)
       select ${sqlText(question(pack, 1).questionId)}::uuid, ${sqlText(pack.conceptIds[2] as string)}::uuid,
              ${sqlText(pack.packId)}::uuid, ${sqlText(pack.versionId)}::uuid, 'PRIMARY', 1,
              'VALIDATED', (select id from ingest.promotions limit 1);`,
    );
    expect(outcome.rejected).toBe(true);
  });
});
