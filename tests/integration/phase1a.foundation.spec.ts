import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSyntheticPack,
  fixtureSlug,
  publish,
  publishStaged,
  idAt,
  purgePack,
  question,
  stage,
  validate,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import { one, query } from '../support/sql';
import { adminClient, readTestEnv, type TestEnv } from '../support/supabase-test-env';

/**
 * `phase1a.foundation.spec` · la arquitectura de Phase 1A ejercitada de extremo a extremo
 * con dos packs GENERATED sintéticos, a través de la frontera de ingestión.
 *
 * Gates: P1A-G2 (claves), P1A-G4 (identidad de concepto), P1A-G5 (representaciones),
 * P1A-G6 (mapeos y prerrequisitos), P1A-G7 (ocurrencias exam-neutral), P1A-G8
 * (procedencia e ingest), P1A-G9 (segundo pack sin cambio de esquema).
 *
 * Nada de lo que se escribe aquí es contenido real: todo lleva el prefijo `fixture:` y
 * se purga al terminar. Las claves de respuesta se verifican por catálogo (SQL de solo
 * lectura), nunca por el Data API, porque el Data API no las sirve (ADR-011).
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let packA: SyntheticPack;
let packB: SyntheticPack;

/** Cuenta claves de una pregunta leyendo `content` por catálogo, nunca por el Data API. */
function keyRows(questionId: string): Array<{
  id: string;
  effective_to: string | null;
  supersedes_key_id: string | null;
  key_status: string;
}> {
  return query(
    `select id, effective_to::text, supersedes_key_id, key_status::text from content.answer_key_versions where question_id = '${questionId}' order by created_at`,
  );
}

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  packA = await buildSyntheticPack(admin, 'a');
  packB = await buildSyntheticPack(admin, 'b', {
    sectionCodes: ['THEORY_X', 'PRACTICE_Y', 'EXTRA_Z'],
    modelCodes: ['A', 'B', 'C'],
  });
}, 120_000);

afterAll(async () => {
  for (const pack of [packA, packB]) {
    if (!pack) continue;
    const deleted = await purgePack(admin, pack.packId);
    expect(deleted['exam_packs']).toBe(1);
  }
  const { data } = await admin
    .from('exam_packs')
    .select('id')
    .like('slug', `${fixtureSlug('')}%`);
  expect(data ?? []).toHaveLength(0);
}, 120_000);

describe('P1A-G9 · dos packs sintéticos con secciones y modelos distintos, sin cambio de esquema', () => {
  it('ambos packs existen, publicados y con su versión vigente', async () => {
    const { data, error } = await admin
      .from('exam_packs')
      .select('id, slug, status, current_version_id')
      .in('id', [packA.packId, packB.packId]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    for (const row of data ?? []) {
      expect(row.status).toBe('PUBLISHED');
      expect(row.current_version_id).toBeTruthy();
    }
  });

  it('las secciones y los modelos son datos del pack, disjuntos entre packs', async () => {
    const { data: sections } = await admin
      .from('exam_sections')
      .select('exam_pack_id, code')
      .in('exam_pack_id', [packA.packId, packB.packId]);
    const codesA = (sections ?? [])
      .filter((s) => s.exam_pack_id === packA.packId)
      .map((s) => s.code)
      .sort();
    const codesB = (sections ?? [])
      .filter((s) => s.exam_pack_id === packB.packId)
      .map((s) => s.code)
      .sort();
    expect(codesA).toEqual(['PART_ONE', 'PART_TWO']);
    expect(codesB).toEqual(['EXTRA_Z', 'PRACTICE_Y', 'THEORY_X']);

    const { data: models } = await admin
      .from('exam_sitting_models')
      .select('exam_pack_id, model_code')
      .in('exam_pack_id', [packA.packId, packB.packId]);
    expect(
      (models ?? [])
        .filter((m) => m.exam_pack_id === packB.packId)
        .map((m) => m.model_code)
        .sort(),
    ).toEqual(['A', 'B', 'C']);
  });

  it('ningún enum global conoce esos códigos', () => {
    const enums = query<{ value: string }>(
      "select e.enumlabel as value from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname in ('public','ingest')",
    ).map((r) => r.value);
    for (const code of ['THEORY_X', 'PART_ONE', 'A', 'B', 'M1']) expect(enums).not.toContain(code);
  });
});

describe('P1A-G4 · identidad de concepto', () => {
  it('las claves cumplen la convención y son únicas dentro del pack', async () => {
    const { data } = await admin
      .from('concepts')
      .select('concept_key')
      .eq('exam_pack_id', packA.packId);
    expect(data).toHaveLength(4);
    for (const row of data ?? []) {
      expect(row.concept_key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$/);
      expect(row.concept_key).not.toMatch(/^x\./);
    }
    expect(new Set((data ?? []).map((r) => r.concept_key)).size).toBe(4);
  });

  it('el mismo título en el mismo pack es el mismo concepto: la clave choca', async () => {
    const stagedId = await stage(admin, 'concept', {
      exam_pack_id: packA.packId,
      title: 'fixture: concepto alfa',
    });
    expect(await validate(admin, stagedId)).toBe('VALIDATED');
    await expect(publishStaged(admin, stagedId)).rejects.toThrow(/concepts_key_unique|duplicate/);
  });

  it('el mismo título en otro pack produce otra clave', async () => {
    const { data: a } = await admin
      .from('concepts')
      .select('concept_key')
      .eq('exam_pack_id', packA.packId)
      .order('concept_key');
    const { data: b } = await admin
      .from('concepts')
      .select('concept_key')
      .eq('exam_pack_id', packB.packId)
      .order('concept_key');
    const keysA = (a ?? []).map((r) => r.concept_key);
    const keysB = (b ?? []).map((r) => r.concept_key);
    expect(keysA.some((k) => keysB.includes(k))).toBe(false);
    expect(keysA.map((k) => k.slice(0, -9)).sort()).toEqual(
      keysB.map((k) => k.slice(0, -9)).sort(),
    );
  });

  it('la clave es inmutable una vez publicada', async () => {
    const { error } = await admin
      .from('concepts')
      .update({ concept_key: 'otra-clave-00000000' })
      .eq('id', idAt(packA.conceptIds, 0));
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/inmutable/);
  });

  it('el código oficial vive en la representación versionada, no en la identidad', async () => {
    const { data } = await admin
      .from('concept_versions')
      .select('official_code, topic_id, exam_pack_version_id')
      .eq('concept_id', idAt(packA.conceptIds, 0))
      .single();
    expect(data?.official_code).toBe('X.1');
    expect(data?.exam_pack_version_id).toBe(packA.versionId);
  });

  it('un prerrequisito no puede apuntar a sí mismo ni cruzar packs', async () => {
    await expect(
      publish(admin, 'concept_prerequisite', {
        concept_id: idAt(packA.conceptIds, 2),
        prerequisite_concept_id: idAt(packA.conceptIds, 2),
      }),
    ).rejects.toThrow(/not_self|check/);
    await expect(
      publish(admin, 'concept_prerequisite', {
        concept_id: idAt(packA.conceptIds, 2),
        prerequisite_concept_id: idAt(packB.conceptIds, 0),
      }),
    ).rejects.toThrow(/foreign key|prerequisite_fk/);
  });

  it('un concepto publicado no se borra', async () => {
    const { error } = await admin.from('concepts').delete().eq('id', idAt(packA.conceptIds, 3));
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/DI-1A-3|no se borra/);
  });
});

describe('P1A-G5 · representaciones inmutables con supersesión', () => {
  it('cada pregunta tiene exactamente una representación vigente con sus opciones', async () => {
    for (const q of packA.questions) {
      const { data } = await admin
        .from('question_representations')
        .select('id, status, superseded_by_representation_id, question_options(option_key)')
        .eq('question_id', q.questionId);
      const current = (data ?? []).filter(
        (r) => r.status === 'PUBLISHED' && r.superseded_by_representation_id === null,
      );
      expect(current).toHaveLength(1);
      expect(current[0]?.question_options).toHaveLength(3);
    }
  });

  it('el contenido publicado no se reescribe', async () => {
    const rep = question(packA, 0).representationId;
    const { error } = await admin
      .from('question_representations')
      .update({ stem: 'fixture: reescrito' })
      .eq('id', rep);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/inmutable/);
    const { error: optionError } = await admin
      .from('question_options')
      .update({ body: 'x' })
      .eq('representation_id', rep);
    expect(optionError).not.toBeNull();
    const { error: insertError } = await admin.from('question_options').insert({
      representation_id: rep,
      option_key: 'D',
      body: 'fixture: opción tardía',
      sort_order: 4,
    });
    expect(insertError).not.toBeNull();
    const { error: deleteError } = await admin
      .from('question_representations')
      .delete()
      .eq('id', rep);
    expect(deleteError).not.toBeNull();
  });

  it('una corrección crea una representación nueva y enlaza la anterior', async () => {
    const q = question(packA, 1);
    const { targetId: newRep } = await publish(admin, 'question_representation', {
      question_id: q.questionId,
      stem: 'fixture: enunciado corregido',
      provenance_class: 'GENERATED',
      source_version_id: packA.sourceVersionId,
      options: ['A', 'B', 'C'].map((k, i) => ({
        option_key: k,
        body: `fixture: opción corregida ${k}`,
        sort_order: i + 1,
      })),
    });
    const { data } = await admin
      .from('question_representations')
      .select(
        'id, representation_no, status, supersedes_representation_id, superseded_by_representation_id',
      )
      .eq('question_id', q.questionId)
      .order('representation_no');
    expect(data).toHaveLength(2);
    expect(data?.[0]?.superseded_by_representation_id).toBe(newRep);
    expect(data?.[1]?.supersedes_representation_id).toBe(q.representationId);
    expect(data?.[1]?.representation_no).toBe(2);
    expect(data?.[1]?.status).toBe('PUBLISHED');
    const current = (data ?? []).filter(
      (r) => r.status === 'PUBLISHED' && r.superseded_by_representation_id === null,
    );
    expect(current.map((r) => r.id)).toEqual([newRep]);
  });

  it('el enlace de supersesión se fija una sola vez', async () => {
    const { error } = await admin
      .from('question_representations')
      .update({ superseded_by_representation_id: question(packA, 2).representationId })
      .eq('id', question(packA, 1).representationId);
    expect(error).not.toBeNull();
  });

  it('las opciones no tienen columna de corrección', () => {
    const columns = query<{ column: string }>(
      "select column_name as column from information_schema.columns where table_schema = 'public' and table_name = 'question_options'",
    ).map((c) => c.column);
    expect(columns.sort()).toEqual([
      'body',
      'created_at',
      'id',
      'option_key',
      'representation_id',
      'sort_order',
    ]);
  });
});

describe('P1A-G2 · claves de respuesta en content', () => {
  it('cada pregunta tiene una clave vigente que apunta a una opción de su representación', () => {
    for (const q of packA.questions.slice(2)) {
      const rows = keyRows(q.questionId);
      expect(rows.filter((r) => r.effective_to === null)).toHaveLength(1);
    }
    const check = one<{ ok: boolean }>(
      `select bool_and(o.representation_id = k.representation_id and r.question_id = k.question_id) as ok from content.answer_key_versions k join public.question_options o on o.id = k.correct_option_id join public.question_representations r on r.id = k.representation_id join public.canonical_questions q on q.id = k.question_id where q.exam_pack_id = '${packA.packId}'`,
    );
    expect(check.ok).toBe(true);
  });

  it('una opción que no pertenece a la representación se rechaza', async () => {
    const q = question(packA, 2);
    await expect(
      publish(admin, 'answer_key_version', {
        question_id: q.questionId,
        correct_option_key: 'Z',
        key_status: 'FINAL',
        source_version_id: packA.sourceVersionId,
        effective_from: '2026-02-01',
      }),
    ).rejects.toThrow(/no pertenece|foreign key/);
  });

  it('una clave nueva cierra la anterior y la supersede', async () => {
    const q = question(packA, 2);
    const before = keyRows(q.questionId);
    expect(before).toHaveLength(1);
    await publish(admin, 'answer_key_version', {
      question_id: q.questionId,
      correct_option_key: 'A',
      key_status: 'AMENDED',
      source_version_id: packA.sourceVersionId,
      effective_from: '2026-03-01',
      explanation: 'fixture: rectificación sintética',
    });
    const after = keyRows(q.questionId);
    expect(after).toHaveLength(2);
    expect(after[0]?.effective_to).not.toBeNull();
    expect(after[1]?.effective_to).toBeNull();
    expect(after[1]?.supersedes_key_id).toBe(after[0]?.id);
    expect(after[1]?.key_status).toBe('AMENDED');
  });

  it('la clave nunca sale por el Data API, ni para el rol de servicio', async () => {
    const { data, error } = await admin
      .schema('content')
      .from('answer_key_versions')
      .select('id')
      .limit(1);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

describe('P1A-G6 · mapeos versionados y copy-forward', () => {
  it('cada pregunta tiene un PRIMARY y un SECONDARY validados en la versión vigente', async () => {
    const { data } = await admin
      .from('question_concepts')
      .select('question_id, relationship_type, mapping_status, exam_pack_version_id')
      .eq('exam_pack_id', packA.packId);
    expect(data).toHaveLength(6);
    for (const row of data ?? []) {
      expect(row.mapping_status).toBe('VALIDATED');
      expect(row.exam_pack_version_id).toBe(packA.versionId);
    }
  });

  it('un segundo PRIMARY para la misma pregunta y versión se rechaza', async () => {
    await expect(
      publish(admin, 'question_concept', {
        question_id: question(packA, 0).questionId,
        concept_id: idAt(packA.conceptIds, 1),
        exam_pack_version_id: packA.versionId,
        relationship_type: 'PRIMARY',
        weight: 1,
      }),
    ).rejects.toThrow(/one_primary|duplicate/);
  });

  it('un concepto de otro pack no puede mapearse', async () => {
    await expect(
      publish(admin, 'question_concept', {
        question_id: question(packA, 0).questionId,
        concept_id: idAt(packB.conceptIds, 0),
        exam_pack_version_id: packA.versionId,
        relationship_type: 'SECONDARY',
        weight: 0.5,
      }),
    ).rejects.toThrow(/foreign key|concept_fk/);
  });

  it('el copy-forward a una versión nueva deja los mapeos PENDING_REVALIDATION con linaje', async () => {
    const { targetId: v2 } = await publish(admin, 'exam_pack_version', {
      exam_pack_id: packA.packId,
      version_label: 'v2',
      effective_from: '2027-01-01',
      set_current: false,
    });
    const { data: copied, error } = await admin.rpc('copy_forward_question_concepts', {
      p_from_version: packA.versionId,
      p_to_version: v2,
    });
    expect(error).toBeNull();
    expect(copied).toBe(6);
    const { data } = await admin
      .from('question_concepts')
      .select('mapping_status, copied_from_mapping_id, validated_at')
      .eq('exam_pack_version_id', v2);
    expect(data).toHaveLength(6);
    for (const row of data ?? []) {
      expect(row.mapping_status).toBe('PENDING_REVALIDATION');
      expect(row.copied_from_mapping_id).toBeTruthy();
      expect(row.validated_at).toBeNull();
    }
    // Idempotente: repetirlo no duplica.
    const { data: again } = await admin.rpc('copy_forward_question_concepts', {
      p_from_version: packA.versionId,
      p_to_version: v2,
    });
    expect(again).toBe(0);
    // Un pack distinto no admite copy-forward cruzado.
    const { error: crossError } = await admin.rpc('copy_forward_question_concepts', {
      p_from_version: packA.versionId,
      p_to_version: packB.versionId,
    });
    expect(crossError).not.toBeNull();
  });
});

describe('P1A-G7 · ocurrencias exam-neutral', () => {
  it('no admite posiciones oficiales duplicadas ni la misma pregunta dos veces por modelo', async () => {
    const occ = {
      sitting_model_id: idAt(packA.modelIds, 0),
      section_id: idAt(packA.sectionIds, 1),
      question_id: question(packA, 0).questionId,
      display_no: 1,
      provenance_class: 'GENERATED',
      source_version_id: packA.sourceVersionId,
    };
    // La misma pregunta ya aparece en ese modelo: una pregunta por modelo.
    await expect(publish(admin, 'exam_occurrence', occ)).rejects.toThrow(
      /question_unique|duplicate/,
    );
    // Una pregunta de otro pack: la clave foránea compuesta «mismo pack» la rechaza.
    await expect(
      publish(admin, 'exam_occurrence', {
        ...occ,
        display_no: 97,
        question_id: question(packB, 0).questionId,
      }),
    ).rejects.toThrow(/foreign key|question_fk/);
    // La misma posición oficial dos veces en (modelo, sección).
    const { targetId: extraQuestion } = await publish(admin, 'question', {
      exam_pack_id: packA.packId,
      question_type: 'SINGLE_CHOICE',
    });
    await expect(
      publish(admin, 'exam_occurrence', {
        ...occ,
        section_id: idAt(packA.sectionIds, 0),
        question_id: extraQuestion,
        display_no: 1,
      }),
    ).rejects.toThrow(/position_unique|duplicate/);
  });

  it('las permutaciones por modelo conservan posiciones independientes', async () => {
    const { data } = await admin
      .from('exam_occurrences')
      .select('sitting_model_id, question_id, display_no, is_reserve')
      .eq('exam_pack_id', packA.packId);
    expect(data).toHaveLength(6);
    const q0 = (data ?? [])
      .filter((o) => o.question_id === question(packA, 0).questionId)
      .map((o) => o.display_no)
      .sort();
    expect(q0).toEqual([1, 2]);
    expect((data ?? []).every((o) => o.is_reserve === false)).toBe(true);
  });

  it('una ocurrencia de reserva es explícita', async () => {
    // Las preguntas de reserva son preguntas propias de la bolsa de reserva de la sección.
    const { targetId: reserveQuestion } = await publish(admin, 'question', {
      exam_pack_id: packA.packId,
      question_type: 'SINGLE_CHOICE',
    });
    const { targetId } = await publish(admin, 'exam_occurrence', {
      sitting_model_id: idAt(packA.modelIds, 0),
      section_id: idAt(packA.sectionIds, 1),
      question_id: reserveQuestion,
      display_no: 1,
      is_reserve: true,
      provenance_class: 'GENERATED',
      source_version_id: packA.sourceVersionId,
    });
    const { data } = await admin
      .from('exam_occurrences')
      .select('is_reserve')
      .eq('id', targetId)
      .single();
    expect(data?.is_reserve).toBe(true);
  });
});

describe('P1A-G8 · procedencia e ingest', () => {
  it('OFFICIAL sin fuente OFFICIAL queda en QUARANTINE, no se publica', async () => {
    const stagedId = await stage(admin, 'question_representation', {
      question_id: question(packA, 0).questionId,
      stem: 'fixture: pretende ser oficial',
      provenance_class: 'OFFICIAL',
      source_version_id: packA.sourceVersionId,
      options: [
        { option_key: 'A', body: 'fixture: a' },
        { option_key: 'B', body: 'fixture: b' },
      ],
    });
    expect(await validate(admin, stagedId)).toBe('QUARANTINE');
    await expect(publishStaged(admin, stagedId)).rejects.toThrow(/QUARANTINE|no VALIDATED/);
  });

  it('OFFICIAL sin versión de fuente también queda en QUARANTINE', async () => {
    const stagedId = await stage(admin, 'practical', {
      exam_pack_id: packA.packId,
      title: 'fixture: práctico sin fuente',
      scenario: 'fixture',
      provenance_class: 'OFFICIAL',
    });
    expect(await validate(admin, stagedId)).toBe('QUARANTINE');
  });

  it('PERSONAL, opciones insuficientes y marcadores de corrección se rechazan', async () => {
    const personal = await stage(admin, 'practical', {
      exam_pack_id: packA.packId,
      title: 'fixture: personal',
      scenario: 'fixture',
      provenance_class: 'PERSONAL',
    });
    expect(await validate(admin, personal)).toBe('REJECTED');

    const single = await stage(admin, 'question_representation', {
      question_id: question(packA, 0).questionId,
      stem: 'fixture: una opción',
      provenance_class: 'GENERATED',
      options: [{ option_key: 'A', body: 'fixture: a' }],
    });
    expect(await validate(admin, single)).toBe('REJECTED');

    const marked = await stage(admin, 'question_representation', {
      question_id: question(packA, 0).questionId,
      stem: 'fixture: marcada',
      provenance_class: 'GENERATED',
      options: [
        { option_key: 'A', body: 'fixture: a', is_correct: true },
        { option_key: 'B', body: 'fixture: b' },
      ],
    });
    expect(await validate(admin, marked)).toBe('REJECTED');
  });

  it('un ítem RECEIVED o REJECTED no se publica', async () => {
    const received = await stage(admin, 'exam_section', {
      exam_pack_id: packA.packId,
      code: 'LATE',
      title: 'fixture',
      sort_order: 9,
    });
    await expect(publishStaged(admin, received)).rejects.toThrow(/RECEIVED|no VALIDATED/);
  });

  it('toda fila publicada enlaza su promoción y la promoción su destino', () => {
    const row = one<{ missing: number; dangling: number }>(
      `select (select count(*)::int from public.concepts c where c.exam_pack_id = '${packA.packId}' and not exists (select 1 from ingest.promotions p where p.id = c.promotion_id and p.target_id = c.id and p.target_table = 'public.concepts')) as missing, ` +
        `(select count(*)::int from ingest.promotions p where p.target_table = 'public.pending') as dangling`,
    );
    expect(row.missing).toBe(0);
    expect(row.dangling).toBe(0);
  });

  it('la purga se niega mientras el pack tenga una fila no GENERATED', async () => {
    const { targetId: draft } = await publish(admin, 'question_representation', {
      question_id: question(packB, 0).questionId,
      stem: 'fixture: borrador verificado',
      provenance_class: 'VERIFIED',
      source_version_id: packB.sourceVersionId,
      status: 'DRAFT',
      options: [
        { option_key: 'A', body: 'fixture: a' },
        { option_key: 'B', body: 'fixture: b' },
      ],
    });
    await expect(purgePack(admin, packB.packId)).rejects.toThrow(/no GENERATED|no se purga/);
    // Un borrador no publicado sí puede retirarse por el servidor: se limpia y la purga vuelve a ser posible.
    const { error: optionsError } = await admin
      .from('question_options')
      .delete()
      .eq('representation_id', draft);
    expect(optionsError).toBeNull();
    const { error } = await admin.from('question_representations').delete().eq('id', draft);
    expect(error).toBeNull();
  });
});

describe('fuentes y versiones', () => {
  it('una versión OFFICIAL vigente exige checksum y la cadena de supersesión es de la misma fuente', async () => {
    const { targetId: officialSource } = await publish(admin, 'source', {
      title: `fixture: fuente que se declara oficial ${fixtureSlug('src')}`,
      authority: 'fixture',
      source_type: 'FIXTURE',
      provenance_class: 'OFFICIAL',
    });
    await expect(
      publish(admin, 'source_version', {
        source_id: officialSource,
        version_label: 'v1',
        effective_from: '2026-01-01',
        status: 'CURRENT',
      }),
    ).rejects.toThrow(/checksum|INV-110/);
    const { targetId: v1 } = await publish(admin, 'source_version', {
      source_id: officialSource,
      version_label: 'v1',
      effective_from: '2026-01-01',
      status: 'CURRENT',
      checksum: 'a'.repeat(64),
    });
    await expect(
      publish(admin, 'source_version', {
        source_id: packA.sourceId,
        version_label: 'v9',
        effective_from: '2026-05-01',
        supersedes_version_id: v1,
      }),
    ).rejects.toThrow(/misma fuente|DI-1A-7/);
    // Limpieza: la fuente oficial sintética no pertenece a ningún pack y se retira por el servidor.
    const { error: e1 } = await admin.from('source_versions').delete().eq('id', v1);
    expect(e1).toBeNull();
    const { error: e2 } = await admin.from('sources').delete().eq('id', officialSource);
    expect(e2).toBeNull();
  });

  it('una versión nueva que supersede cierra la anterior', async () => {
    const { targetId: v2 } = await publish(admin, 'source_version', {
      source_id: packB.sourceId,
      version_label: 'v2',
      effective_from: '2026-04-01',
      supersedes_version_id: packB.sourceVersionId,
    });
    const { data } = await admin
      .from('source_versions')
      .select('id, status, effective_to')
      .in('id', [packB.sourceVersionId, v2]);
    const old = data?.find((r) => r.id === packB.sourceVersionId);
    const current = data?.find((r) => r.id === v2);
    expect(old?.status).toBe('SUPERSEDED');
    expect(old?.effective_to).toBe('2026-04-01');
    expect(current?.status).toBe('CURRENT');
  });
});
