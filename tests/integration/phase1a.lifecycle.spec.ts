import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSyntheticPack,
  idAt,
  publish,
  purgePack,
  question,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import { attack, one, query } from '../support/sql';
import { adminClient, readTestEnv, type TestEnv } from '../support/supabase-test-env';

/**
 * `phase1a.lifecycle.spec` · el ciclo de vida completo de una pregunta (SD-021 · ADR-008
 * aclaración · ADR-009 v1.1 · ADR-010 v1.1 · EC-007).
 *
 * pregunta canónica → representación v1 → opciones → mapeo → clave privada K1 → ocurrencia
 * → corrección → representación v2 → clave K2 → copy-forward y revalidación → supersesión
 * → consulta histórica.
 *
 * Lo que se demuestra: la historia sigue siendo direccionable después de la corrección;
 * la «versión de ítem» de ADR-008 es `question_representation_id` (SD-021) y nada la
 * sustituye; las ocurrencias y los mapeos siguen a la pregunta, no a la representación,
 * y por tanto una corrección no los reescribe ni los pierde.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let v1 = '';
let v2 = '';
let k1 = '';
let k2 = '';
let secondVersion = '';

interface RepresentationRow {
  id: string;
  representation_no: number;
  status: string;
  supersedes_representation_id: string | null;
  superseded_by_representation_id: string | null;
  published_at: string;
}

interface KeyRow {
  id: string;
  representation_id: string;
  correct_option_id: string;
  effective_from: string;
  effective_to: string | null;
  supersedes_key_id: string | null;
  key_status: string;
}

function representations(questionId: string): RepresentationRow[] {
  return query<RepresentationRow>(
    `select id, representation_no, status::text, supersedes_representation_id, superseded_by_representation_id, published_at::text from public.question_representations where question_id = '${questionId}' order by representation_no`,
  );
}

function keys(questionId: string): KeyRow[] {
  return query<KeyRow>(
    `select id, representation_id, correct_option_id, effective_from::text, effective_to::text, supersedes_key_id, key_status::text from content.answer_key_versions where question_id = '${questionId}' order by created_at`,
  );
}

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'l');
  v1 = question(pack, 0).representationId;
  k1 = question(pack, 0).keyId;
}, 120_000);

afterAll(async () => {
  if (pack) {
    const deleted = await purgePack(admin, pack.packId);
    expect(deleted['exam_packs']).toBe(1);
  }
}, 120_000);

describe('estado inicial: una pregunta con su historia mínima', () => {
  it('v1 vigente, K1 vigente sobre v1, una ocurrencia por modelo y un PRIMARY validado', async () => {
    const q = question(pack, 0);
    const reps = representations(q.questionId);
    expect(reps).toHaveLength(1);
    expect(reps[0]?.status).toBe('PUBLISHED');
    const ks = keys(q.questionId);
    expect(ks).toHaveLength(1);
    expect(ks[0]?.representation_id).toBe(v1);
    expect(ks[0]?.effective_to).toBeNull();
    const { data: occurrences } = await admin
      .from('exam_occurrences')
      .select('id, sitting_model_id')
      .eq('question_id', q.questionId);
    expect(occurrences).toHaveLength(pack.modelIds.length);
    const { data: mappings } = await admin
      .from('question_concepts')
      .select('relationship_type, mapping_status')
      .eq('question_id', q.questionId)
      .eq('exam_pack_version_id', pack.versionId);
    expect(mappings?.filter((m) => m.relationship_type === 'PRIMARY')).toHaveLength(1);
  });

  it('la versión de ítem es la representación: la clave la referencia y nada más lo hace', () => {
    const fks = query<{ name: string; def: string }>(
      "select c.conname as name, pg_get_constraintdef(c.oid) as def from pg_constraint c where c.conrelid = 'content.answer_key_versions'::regclass and c.contype = 'f' order by 1",
    );
    const defs = fks.map((f) => f.def).join(' ');
    expect(defs).toMatch(
      /\(representation_id, question_id\) REFERENCES question_representations\(id, question_id\)/,
    );
    expect(defs).toMatch(
      /\(correct_option_id, representation_id\) REFERENCES question_options\(id, representation_id\)/,
    );
    const nullable = one<{ n: string }>(
      "select is_nullable as n from information_schema.columns where table_schema = 'content' and table_name = 'answer_key_versions' and column_name = 'representation_id'",
    );
    expect(nullable.n).toBe('NO');
    // Mapeos y ocurrencias siguen a la pregunta, no a la representación.
    for (const table of ['question_concepts', 'exam_occurrences', 'practical_questions']) {
      const columns = query<{ c: string }>(
        `select column_name as c from information_schema.columns where table_schema = 'public' and table_name = '${table}'`,
      ).map((r) => r.c);
      expect(columns, table).toContain('question_id');
      expect(columns, table).not.toContain('representation_id');
    }
  });
});

describe('corrección: v2 y K2', () => {
  it('publica v2 por la frontera y v1 queda superseded pero direccionable', async () => {
    const q = question(pack, 0);
    const before = representations(q.questionId)[0]?.published_at ?? '';
    const { targetId } = await publish(admin, 'question_representation', {
      question_id: q.questionId,
      stem: 'fixture: enunciado corregido (v2)',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
      options: ['A', 'B', 'C', 'D'].map((k, i) => ({
        option_key: k,
        body: `fixture: opción v2 ${k}`,
        sort_order: i + 1,
      })),
    });
    v2 = targetId;
    const reps = representations(q.questionId);
    expect(reps).toHaveLength(2);
    expect(reps[0]?.id).toBe(v1);
    expect(reps[0]?.status).toBe('PUBLISHED');
    expect(reps[0]?.superseded_by_representation_id).toBe(v2);
    expect(reps[1]?.supersedes_representation_id).toBe(v1);
    expect(reps[1]?.superseded_by_representation_id).toBeNull();
    expect(reps[1]?.published_at ?? '').not.toBe('');
    expect((reps[1]?.published_at ?? '') >= before).toBe(true);
    // Un usuario sigue leyendo v1 (publicada, superseded) y sus opciones: la historia se ve.
    const { data: v1Options } = await admin
      .from('question_options')
      .select('option_key')
      .eq('representation_id', v1);
    expect(v1Options).toHaveLength(3);
  });

  it('K2 se ata a v2; K1 se cierra sobre v1 y sigue resolviendo la opción histórica', async () => {
    const q = question(pack, 0);
    const { targetId } = await publish(admin, 'answer_key_version', {
      question_id: q.questionId,
      correct_option_key: 'D',
      key_status: 'AMENDED',
      source_version_id: pack.sourceVersionId,
      effective_from: '2026-06-15',
    });
    k2 = targetId;
    const ks = keys(q.questionId);
    expect(ks).toHaveLength(2);
    expect(ks[0]?.id).toBe(k1);
    expect(ks[0]?.representation_id).toBe(v1);
    expect(ks[0]?.effective_to).not.toBeNull();
    expect(ks[1]?.id).toBe(k2);
    expect(ks[1]?.representation_id).toBe(v2);
    expect(ks[1]?.supersedes_key_id).toBe(k1);
    expect(ks[1]?.effective_to).toBeNull();
    const historic = one<{ option_key: string; representation_id: string }>(
      `select o.option_key, o.representation_id from content.answer_key_versions k join public.question_options o on o.id = k.correct_option_id where k.id = '${k1}'`,
    );
    expect(historic.representation_id).toBe(v1);
    expect(historic.option_key).toBe(q.correctOptionKey);
    const current = one<{ option_key: string }>(
      `select o.option_key from content.answer_key_versions k join public.question_options o on o.id = k.correct_option_id where k.id = '${k2}'`,
    );
    expect(current.option_key).toBe('D');
  });

  it('las ocurrencias y los mapeos no cambian con la corrección', async () => {
    const q = question(pack, 0);
    const { data: occurrences } = await admin
      .from('exam_occurrences')
      .select('id')
      .eq('question_id', q.questionId);
    expect(occurrences).toHaveLength(pack.modelIds.length);
    const { data: mappings } = await admin
      .from('question_concepts')
      .select('id, mapping_status')
      .eq('question_id', q.questionId)
      .eq('exam_pack_version_id', pack.versionId);
    expect(mappings).toHaveLength(2);
    expect(mappings?.every((m) => m.mapping_status === 'VALIDATED')).toBe(true);
  });

  it('consulta histórica: la representación vigente en una fecha se resuelve por la cadena', () => {
    const q = question(pack, 0);
    const reps = representations(q.questionId);
    const v2PublishedAt = reps[1]?.published_at ?? '';
    // Justo antes de publicar v2, la vigente era v1; después, v2.
    const asOf = (ts: string) =>
      one<{ id: string }>(
        `select r.id from public.question_representations r where r.question_id = '${q.questionId}' and r.status = 'PUBLISHED' and r.published_at <= '${ts}'::timestamptz order by r.representation_no desc limit 1`,
      ).id;
    expect(asOf(v2PublishedAt)).toBe(v2);
    const beforeV2 = one<{ ts: string }>(
      `select (('${v2PublishedAt}'::timestamptz) - interval '1 microsecond')::text as ts`,
    ).ts;
    expect(asOf(beforeV2)).toBe(v1);
    // Y la clave vigente en una fecha se resuelve por effective_from/effective_to.
    const keyOn = (day: string) =>
      one<{ id: string }>(
        `select k.id from content.answer_key_versions k where k.question_id = '${q.questionId}' and k.effective_from <= '${day}'::date and (k.effective_to is null or k.effective_to > '${day}'::date)`,
      ).id;
    expect(keyOn('2026-03-01')).toBe(k1);
    expect(keyOn('2026-07-01')).toBe(k2);
  });
});

describe('ataques sobre la historia (sin residuo)', () => {
  it('v1 no se reescribe, no se borra y no cambia de pregunta; K1 no se reabre', () => {
    for (const statements of [
      `update public.question_representations set stem = 'fixture: reescrito' where id = '${v1}';`,
      `delete from public.question_representations where id = '${v1}';`,
      `update public.question_representations set question_id = '${question(pack, 1).questionId}' where id = '${v1}';`,
      `update public.question_representations set superseded_by_representation_id = null where id = '${v1}';`,
      `update content.answer_key_versions set effective_to = null where id = '${k1}';`,
      `update content.answer_key_versions set representation_id = '${v2}' where id = '${k1}';`,
    ]) {
      const outcome = attack(statements);
      expect(outcome.rejected, statements).toBe(true);
      expect(outcome.message).toMatch(/SD-021|DI-1A-3|EC-007|foreign key/);
    }
  });

  it('una clave no puede atarse a la representación equivocada de la misma pregunta', () => {
    const q = question(pack, 0);
    // Opción de v1 con representación v2: la FK compuesta lo impide.
    const outcome = attack(
      `declare promo uuid; begin insert into ingest.promotions (target_table) values ('content.answer_key_versions') returning id into promo; insert into content.answer_key_versions (question_id, representation_id, correct_option_id, key_status, source_version_id, effective_from, effective_to, promotion_id) values ('${q.questionId}', '${v2}', (select id from public.question_options where representation_id = '${v1}' limit 1), 'FINAL', '${pack.sourceVersionId}', '2027-01-01', '2027-02-01', promo); end;`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toMatch(/option_fk|foreign key/);
  });

  it('una ocurrencia no puede apuntar a una representación: apunta a la pregunta y la fecha decide', () => {
    const columns = query<{ c: string }>(
      "select column_name as c from information_schema.columns where table_schema = 'public' and table_name = 'exam_occurrences'",
    ).map((r) => r.c);
    expect(columns).not.toContain('representation_id');
    expect(columns).toContain('question_id');
  });
});

describe('versión de pack nueva: copy-forward y revalidación', () => {
  it('los mapeos copiados quedan PENDING_REVALIDATION con linaje y los de v1 no se tocan', async () => {
    const { targetId } = await publish(admin, 'exam_pack_version', {
      exam_pack_id: pack.packId,
      version_label: 'v2',
      effective_from: '2027-01-01',
      set_current: false,
    });
    secondVersion = targetId;
    const { data: copied, error } = await admin.rpc('copy_forward_question_concepts', {
      p_from_version: pack.versionId,
      p_to_version: secondVersion,
    });
    expect(error).toBeNull();
    expect(copied).toBe(6);
    const rows = query<{ v: string; status: string; lineage: number }>(
      `select exam_pack_version_id as v, mapping_status::text as status, (copied_from_mapping_id is not null)::int as lineage from public.question_concepts where exam_pack_id = '${pack.packId}'`,
    );
    expect(rows.filter((r) => r.v === pack.versionId).every((r) => r.status === 'VALIDATED')).toBe(
      true,
    );
    const next = rows.filter((r) => r.v === secondVersion);
    expect(next).toHaveLength(6);
    expect(next.every((r) => r.status === 'PENDING_REVALIDATION' && r.lineage === 1)).toBe(true);
  });

  it('el concepto conserva su identidad a través de las versiones aunque cambie su código oficial (REQ-B14)', async () => {
    const concept = idAt(pack.conceptIds, 0);
    const { data: before } = await admin
      .from('concepts')
      .select('concept_key')
      .eq('id', concept)
      .single();
    // Colocación en la versión nueva con otro código oficial y otro tema.
    const { targetId: block } = await publish(admin, 'syllabus_block', {
      exam_pack_version_id: secondVersion,
      code: 'B9',
      title: 'fixture: bloque reordenado',
      sort_order: 1,
    });
    const { targetId: topic } = await publish(admin, 'topic', {
      block_id: block,
      code: 'B9.T1',
      title: 'fixture: tema reordenado',
      sort_order: 1,
    });
    await publish(admin, 'concept_version', {
      concept_id: concept,
      exam_pack_version_id: secondVersion,
      topic_id: topic,
      title: 'fixture: concepto alfa (renumerado)',
      official_code: 'Y.9',
      sort_order: 1,
    });
    const { data: after } = await admin
      .from('concepts')
      .select('concept_key')
      .eq('id', concept)
      .single();
    expect(after?.concept_key).toBe(before?.concept_key);
    const placements = query<{ v: string; code: string }>(
      `select exam_pack_version_id as v, official_code as code from public.concept_versions where concept_id = '${concept}' order by created_at`,
    );
    expect(placements.map((p) => p.code)).toEqual(['X.1', 'Y.9']);
  });

  it('la revalidación de un mapeo copiado pasa por la frontera auditada (D-21 cerrada)', async () => {
    /*
     * **Actualizado el 2026-09-10 · SD-025 · Phase 3 Build Authorization §5.**
     *
     * Hasta esta fecha este caso documentaba **D-21 como deuda abierta**: no existía función
     * de frontera y el rol de servicio podía fijar `VALIDATED` con un `UPDATE` directo. La
     * migración 19 cierra la deuda, de modo que la afirmación se invierte: lo que antes era
     * el camino ordinario ahora está prohibido, y el camino ordinario es la función.
     *
     * El motivo no es de higiene: sin frontera auditada, un mapeo puede cambiar entre el
     * cálculo incremental y el rebuild, y el gate duro de EC-006 se vuelve inestable sin que
     * nada esté roto.
     */
    const { data } = await admin
      .from('question_concepts')
      .select('id')
      .eq('exam_pack_version_id', secondVersion)
      .limit(1);
    const id = data?.[0]?.id;
    expect(id).toBeTruthy();

    // La escritura directa ya no es posible: el rol de servicio perdió el privilegio.
    const { error: denied } = await admin
      .from('question_concepts')
      .update({ mapping_status: 'VALIDATED', validated_at: new Date().toISOString() })
      .eq('id', id ?? '');
    expect(denied).not.toBeNull();

    // La frontera sí la ejecuta, atribuyendo actor y motivo, y devuelve la generación.
    // Se invoca por SQL: `ingest` tampoco está expuesto al Data API, y esa es justamente la
    // razón por la que la función es el camino de servidor y no una RPC de cliente.
    const promoted = one<{ generation: number }>(
      `select ingest.set_question_concept_mapping_status(
         '${id ?? ''}'::uuid, 'VALIDATED', 'phase1a-lifecycle-spec',
         'revalidación del mapeo copiado') as generation`,
    );
    expect(Number(promoted.generation)).toBeGreaterThanOrEqual(1);

    const audit = one<{ total: number }>(
      `select count(*)::int as total from ingest.mapping_transitions
       where mapping_id = '${id ?? ''}'::uuid and to_status = 'VALIDATED'`,
    );
    expect(Number(audit.total)).toBe(1);
  });
});
