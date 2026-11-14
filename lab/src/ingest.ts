/**
 * Instalación real del corpus por la frontera de ingestión · CP4.
 *
 * `stage_item → validate_staged_item → publish_staged_item`, exactamente la misma frontera que
 * usan el sembrado del producto y los fixtures de prueba. El laboratorio **no escribe en las
 * tablas de contenido**: si pudiera, demostraría que tiene privilegios, no que el contenido es
 * publicable.
 *
 * ---------------------------------------------------------------------------------------
 * `validate_staged_item` **devuelve un estado, no lanza**
 *
 * Un ítem rechazado vuelve como dato (`REJECTED`), con `error` a nulo. Comprobar solo `error`
 * daría por validado lo que la frontera rechazó. Por eso se exige el literal `VALIDATED`.
 * ---------------------------------------------------------------------------------------
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CONCEPTS,
  CORPUS_SLUG,
  OPTION_KEYS,
  QUESTIONS,
  UNITS,
  assertCorpusWellFormed,
  corpusManifest,
  type CorpusManifest,
} from './corpus';
import { assertInstallableTarget } from './corpus-install';
import type { SubstrateIdentity } from './substrate';

export class IngestFailed extends Error {
  constructor(label: string, message: string) {
    super(`ingestión · ${label}: ${message}`);
    this.name = 'IngestFailed';
  }
}

/** Estado que la frontera devuelve cuando un ítem queda validado. Cualquier otro es rechazo. */
export const VALIDATED = 'VALIDATED';

async function publish(
  admin: SupabaseClient,
  kind: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const staged = await admin.rpc('stage_item', { p_kind: kind, p_payload: payload });
  if (staged.error) throw new IngestFailed(`stage_item(${kind})`, staged.error.message);
  const stagedId = staged.data as string;

  const validated = await admin.rpc('validate_staged_item', { p_id: stagedId });
  if (validated.error) throw new IngestFailed(`validate(${kind})`, validated.error.message);
  if (validated.data !== VALIDATED) {
    throw new IngestFailed(`validate(${kind})`, `la frontera devolvió «${String(validated.data)}»`);
  }

  const published = await admin.rpc('publish_staged_item', { p_id: stagedId });
  if (published.error) throw new IngestFailed(`publish(${kind})`, published.error.message);
  return published.data as string;
}

export interface InstalledCorpus {
  readonly manifest: CorpusManifest;
  readonly packId: string;
  readonly packVersionId: string;
  readonly conceptIds: ReadonlyMap<string, string>;
  readonly published: number;
  /**
   * Secuencia de `kind` realmente publicada, en orden.
   *
   * Existe para que la prueba de sustrato pueda compararla con `publicationPlan()` contra una
   * base de datos real: es la atadura que impide que el plan declarado y la frontera divergan.
   */
  readonly publishedKinds: readonly string[];
}

/** Instala el corpus en la instancia efímera. Harness only: exige el cliente privilegiado. */
export async function installLabCorpus(
  admin: SupabaseClient,
  identity: SubstrateIdentity,
): Promise<InstalledCorpus> {
  assertCorpusWellFormed();
  assertInstallableTarget(identity);

  const publishedKinds: string[] = [];
  const emit = async (kind: string, payload: Record<string, unknown>): Promise<string> => {
    const id = await publish(admin, kind, payload);
    publishedKinds.push(kind);
    return id;
  };

  const packId = await emit('exam_pack', {
    slug: CORPUS_SLUG,
    name: 'Laboratorio · corpus sintetico controlado',
    short_name: 'Laboratorio',
    jurisdiction: 'lab',
  });
  const packVersionId = await emit('exam_pack_version', {
    exam_pack_id: packId,
    version_label: 'v1',
    effective_from: '2026-01-01',
    change_summary: 'Corpus sintetico del Synthetic Learner Lab.',
    set_current: true,
  });

  // `concept_version.topic_id` exige un **topic**, que cuelga de un bloque. Dos niveles, no uno.
  const blockId = await emit('syllabus_block', {
    exam_pack_version_id: packVersionId,
    code: 'L1',
    title: 'Bloque sintetico del laboratorio',
    sort_order: 1,
  });
  const topicId = await emit('topic', {
    block_id: blockId,
    code: 'L1.T1',
    title: 'Tema sintetico del laboratorio',
    sort_order: 1,
  });

  const conceptIds = new Map<string, string>();
  for (const [index, concept] of CONCEPTS.entries()) {
    const conceptId = await emit('concept', { exam_pack_id: packId, title: concept.title });
    conceptIds.set(concept.key, conceptId);
    await emit('concept_version', {
      concept_id: conceptId,
      exam_pack_version_id: packVersionId,
      topic_id: topicId,
      title: concept.title,
      description: `Contenido sintetico del laboratorio: ${concept.title.toLowerCase()}.`,
      official_code: `L.${index + 1}`,
      sort_order: index + 1,
    });
  }

  const sourceId = await emit('source', {
    title: 'Material sintetico del laboratorio · STUDY OS',
    authority: 'STUDY OS LAB',
    source_type: 'DEMO',
    provenance_class: 'GENERATED',
  });
  const sourceVersionId = await emit('source_version', {
    source_id: sourceId,
    version_label: 'v1',
    effective_from: '2026-01-01',
    status: 'CURRENT',
  });

  for (const unit of UNITS) {
    const unitId = await emit('learning_unit', {
      exam_pack_id: packId,
      concept_id: conceptIds.get(unit.concept),
      unit_type: 'LESSON',
    });
    // ADR-013 · la frontera **exige** `estimated_minutes`: la duración no se rellena en silencio.
    await emit('learning_unit_version', {
      learning_unit_id: unitId,
      title: unit.title,
      body: unit.body,
      provenance_class: 'GENERATED',
      source_version_id: sourceVersionId,
      estimated_minutes: unit.minutes,
    });
  }

  for (const question of QUESTIONS) {
    const questionId = await emit('question', {
      exam_pack_id: packId,
      question_type: 'SINGLE_CHOICE',
    });
    await emit('question_representation', {
      question_id: questionId,
      stem: question.stem,
      provenance_class: 'GENERATED',
      source_version_id: sourceVersionId,
      options: question.options.map((body, i) => ({
        option_key: OPTION_KEYS[i],
        body,
        sort_order: i + 1,
      })),
    });
    await emit('answer_key_version', {
      question_id: questionId,
      correct_option_key: OPTION_KEYS[question.correct],
      key_status: 'FINAL',
      source_version_id: sourceVersionId,
      effective_from: '2026-01-01',
      explanation: question.explanation,
    });
    await emit('question_concept', {
      question_id: questionId,
      concept_id: conceptIds.get(question.concept),
      exam_pack_version_id: packVersionId,
      relationship_type: 'PRIMARY',
      weight: 1,
    });
  }

  return {
    manifest: corpusManifest(),
    packId,
    packVersionId,
    conceptIds,
    published: publishedKinds.length,
    publishedKinds,
  };
}

/** Verifica lo instalado contra el manifiesto. Diverger es `INVALID_RUN`. */
export async function verifyInstalled(
  admin: SupabaseClient,
  packId: string,
): Promise<{ concepts: number; units: number; questions: number }> {
  const count = async (table: string): Promise<number> => {
    const { count: n, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('exam_pack_id', packId);
    if (error) throw new IngestFailed(`recuento de ${table}`, error.message);
    return n ?? -1;
  };
  return {
    concepts: await count('concepts'),
    units: await count('learning_units'),
    questions: await count('canonical_questions'),
  };
}
