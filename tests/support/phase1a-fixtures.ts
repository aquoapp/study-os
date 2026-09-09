import type { SupabaseClient } from '@supabase/supabase-js';

import { currentRunId } from './supabase-test-env';

/**
 * Fixtures sintéticos de Phase 1A · dos packs GENERATED que ejercitan la arquitectura.
 *
 * ---------------------------------------------------------------------------
 * Reglas (Phase 1A Authorization Packet · PI-1A-5 · decisión M-1)
 *
 *   - Todo es `GENERATED`, con una fuente `GENERATED` propia, y se ve sintético: los
 *     títulos llevan el prefijo `fixture:` y el pack lleva el identificador de la
 *     ejecución que lo creó.
 *   - Nada reproduce ni imita contenido oficial de ningún examen. Los textos son
 *     deliberadamente triviales.
 *   - Todo entra por la frontera de ingestión (stage → validate → publish), como haría
 *     cualquier servidor. Ninguna prueba inserta en una tabla canónica por otra vía.
 *   - Cada ejecución purga su pack al terminar (`purge_generated_pack`), que solo admite
 *     packs íntegramente GENERATED.
 * ---------------------------------------------------------------------------
 */

type Json = Record<string, unknown>;

export interface PublishResult {
  readonly stagedId: string;
  readonly targetId: string;
}

export async function stage(admin: SupabaseClient, kind: string, payload: Json): Promise<string> {
  const { data, error } = await admin.rpc('stage_item', { p_kind: kind, p_payload: payload });
  if (error) throw new Error(`stage_item(${kind}) falló: ${error.message}`);
  return data as string;
}

export async function validate(admin: SupabaseClient, stagedId: string): Promise<string> {
  const { data, error } = await admin.rpc('validate_staged_item', { p_id: stagedId });
  if (error) throw new Error(`validate_staged_item falló: ${error.message}`);
  return data as string;
}

export async function publishStaged(admin: SupabaseClient, stagedId: string): Promise<string> {
  const { data, error } = await admin.rpc('publish_staged_item', { p_id: stagedId });
  if (error) throw new Error(`publish_staged_item falló: ${error.message}`);
  return data as string;
}

/** stage → validate → publish. Falla si la validación no devuelve VALIDATED. */
export async function publish(
  admin: SupabaseClient,
  kind: string,
  payload: Json,
): Promise<PublishResult> {
  const stagedId = await stage(admin, kind, payload);
  const outcome = await validate(admin, stagedId);
  if (outcome !== 'VALIDATED') {
    throw new Error(`el ítem ${kind} no validó: ${outcome}`);
  }
  const targetId = await publishStaged(admin, stagedId);
  return { stagedId, targetId };
}

export interface SyntheticQuestion {
  readonly questionId: string;
  readonly representationId: string;
  readonly keyId: string;
  readonly correctOptionKey: string;
}

export interface SyntheticPack {
  readonly label: string;
  readonly slug: string;
  readonly packId: string;
  readonly versionId: string;
  readonly blockIds: string[];
  readonly topicIds: string[];
  readonly conceptIds: string[];
  readonly sourceId: string;
  readonly sourceVersionId: string;
  readonly questions: SyntheticQuestion[];
  readonly sectionIds: string[];
  readonly sittingId: string;
  readonly modelIds: string[];
  readonly occurrenceIds: string[];
  readonly practicalId: string;
}

export function fixtureSlug(label: string): string {
  return `fixture-${currentRunId()}-${label}`;
}

/**
 * Construye un pack sintético completo a través de la frontera.
 *
 * `sectionCodes` y `modelCodes` se parametrizan para demostrar que dos packs pueden
 * tener secciones y modelos distintos sin que exista ningún enum global (ADR-010 v1.1).
 */
export async function buildSyntheticPack(
  admin: SupabaseClient,
  label: string,
  options: { sectionCodes?: string[]; modelCodes?: string[] } = {},
): Promise<SyntheticPack> {
  const slug = fixtureSlug(label);
  const sectionCodes = options.sectionCodes ?? ['PART_ONE', 'PART_TWO'];
  const modelCodes = options.modelCodes ?? ['M1', 'M2'];

  const { targetId: packId } = await publish(admin, 'exam_pack', {
    slug,
    name: `fixture: pack sintético ${label}`,
    short_name: `fixture-${label}`,
    jurisdiction: 'fixture',
  });

  const { targetId: versionId } = await publish(admin, 'exam_pack_version', {
    exam_pack_id: packId,
    version_label: 'v1',
    effective_from: '2026-01-01',
    change_summary: 'fixture: versión inicial sintética',
    set_current: true,
  });

  const blockIds: string[] = [];
  const topicIds: string[] = [];
  for (const [b, blockCode] of ['B1', 'B2'].entries()) {
    const { targetId: blockId } = await publish(admin, 'syllabus_block', {
      exam_pack_version_id: versionId,
      code: blockCode,
      title: `fixture: bloque ${blockCode}`,
      sort_order: b + 1,
    });
    blockIds.push(blockId);
    for (const t of [1, 2]) {
      const { targetId: topicId } = await publish(admin, 'topic', {
        block_id: blockId,
        code: `${blockCode}.T${t}`,
        title: `fixture: tema ${blockCode}.${t}`,
        sort_order: t,
      });
      topicIds.push(topicId);
    }
  }

  const conceptIds: string[] = [];
  const conceptTitles = [
    'fixture: concepto alfa',
    'fixture: concepto beta',
    'fixture: concepto gamma',
    'fixture: concepto delta',
  ];
  for (const [i, title] of conceptTitles.entries()) {
    const { targetId: conceptId } = await publish(admin, 'concept', {
      exam_pack_id: packId,
      title,
    });
    conceptIds.push(conceptId);
    await publish(admin, 'concept_version', {
      concept_id: conceptId,
      exam_pack_version_id: versionId,
      topic_id: topicIds[i % topicIds.length],
      title,
      description: 'fixture: descripción sintética',
      official_code: `X.${i + 1}`,
      sort_order: Math.floor(i / topicIds.length) + 1,
    });
  }
  await publish(admin, 'concept_prerequisite', {
    concept_id: conceptIds[1],
    prerequisite_concept_id: conceptIds[0],
    strength: 'MEDIUM',
    rationale: 'fixture: beta requiere alfa',
  });

  const { targetId: sourceId } = await publish(admin, 'source', {
    title: `fixture: fuente sintética ${label}`,
    authority: 'fixture',
    source_type: 'FIXTURE',
    provenance_class: 'GENERATED',
  });
  const { targetId: sourceVersionId } = await publish(admin, 'source_version', {
    source_id: sourceId,
    version_label: 'v1',
    effective_from: '2026-01-01',
    status: 'CURRENT',
  });

  const questions: SyntheticQuestion[] = [];
  const letters = ['A', 'B', 'C'];
  for (const n of [1, 2, 3]) {
    const { targetId: questionId } = await publish(admin, 'question', {
      exam_pack_id: packId,
      question_type: 'SINGLE_CHOICE',
    });
    const { targetId: representationId } = await publish(admin, 'question_representation', {
      question_id: questionId,
      stem: `fixture: enunciado sintético ${n}`,
      provenance_class: 'GENERATED',
      source_version_id: sourceVersionId,
      options: letters.map((key, i) => ({
        option_key: key,
        body: `fixture: opción ${key}`,
        sort_order: i + 1,
      })),
    });
    const correctOptionKey = letters[n % letters.length] ?? 'A';
    const { targetId: keyId } = await publish(admin, 'answer_key_version', {
      question_id: questionId,
      correct_option_key: correctOptionKey,
      key_status: 'FINAL',
      source_version_id: sourceVersionId,
      effective_from: '2026-01-01',
      explanation: 'fixture: explicación sintética',
    });
    await publish(admin, 'question_concept', {
      question_id: questionId,
      concept_id: conceptIds[n - 1],
      exam_pack_version_id: versionId,
      relationship_type: 'PRIMARY',
      weight: 1,
    });
    await publish(admin, 'question_concept', {
      question_id: questionId,
      concept_id: conceptIds[3],
      exam_pack_version_id: versionId,
      relationship_type: 'SECONDARY',
      weight: 0.25,
    });
    questions.push({ questionId, representationId, keyId, correctOptionKey });
  }

  const sectionIds: string[] = [];
  for (const [i, code] of sectionCodes.entries()) {
    const { targetId } = await publish(admin, 'exam_section', {
      exam_pack_id: packId,
      code,
      title: `fixture: sección ${code}`,
      sort_order: i + 1,
    });
    sectionIds.push(targetId);
  }

  const { targetId: sittingId } = await publish(admin, 'exam_sitting', {
    exam_pack_id: packId,
    sitting_date: '2026-06-01',
    call_label: 'fixture-call',
    source_version_id: sourceVersionId,
  });
  const modelIds: string[] = [];
  for (const code of modelCodes) {
    const { targetId } = await publish(admin, 'exam_sitting_model', {
      sitting_id: sittingId,
      model_code: code,
      source_version_id: sourceVersionId,
    });
    modelIds.push(targetId);
  }

  const occurrenceIds: string[] = [];
  for (const [m, modelId] of modelIds.entries()) {
    for (const [q, question] of questions.entries()) {
      // Cada modelo muestra las mismas preguntas en orden distinto (permutación).
      const displayNo = ((q + m) % questions.length) + 1;
      const { targetId } = await publish(admin, 'exam_occurrence', {
        sitting_model_id: modelId,
        section_id: sectionIds[0],
        question_id: question.questionId,
        display_no: displayNo,
        is_reserve: false,
        provenance_class: 'GENERATED',
        source_version_id: sourceVersionId,
        source_file_ref: `fixture:${label}:${modelId}`,
      });
      occurrenceIds.push(targetId);
    }
  }

  const { targetId: practicalId } = await publish(admin, 'practical', {
    exam_pack_id: packId,
    title: `fixture: práctico sintético ${label}`,
    scenario: 'fixture: escenario sintético sin contenido real.',
    provenance_class: 'GENERATED',
    source_version_id: sourceVersionId,
  });
  for (const [i, question] of questions.slice(0, 2).entries()) {
    await publish(admin, 'practical_question', {
      practical_id: practicalId,
      question_id: question.questionId,
      sort_order: i + 1,
    });
  }

  return {
    label,
    slug,
    packId,
    versionId,
    blockIds,
    topicIds,
    conceptIds,
    sourceId,
    sourceVersionId,
    questions,
    sectionIds,
    sittingId,
    modelIds,
    occurrenceIds,
    practicalId,
  };
}

export async function purgePack(
  admin: SupabaseClient,
  packId: string,
): Promise<Record<string, number>> {
  const { data, error } = await admin.rpc('purge_generated_pack', { p_pack_id: packId });
  if (error) throw new Error(`purge_generated_pack falló: ${error.message}`);
  return data as Record<string, number>;
}

/** Pregunta i-ésima del pack; falla si no existe (los fixtures son deterministas). */
export function question(pack: SyntheticPack, index: number): SyntheticQuestion {
  const found = pack.questions[index];
  if (!found) throw new Error(`el pack ${pack.label} no tiene la pregunta ${index}`);
  return found;
}

/** Identificador i-ésimo de una lista de fixtures; falla si no existe. */
export function idAt(list: readonly string[], index: number): string {
  const found = list[index];
  if (!found) throw new Error(`no existe el identificador ${index}`);
  return found;
}
