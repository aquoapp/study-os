import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ItemRow } from './session';

/**
 * Lectura del contenido canónico para el vertical.
 *
 * Todo pasa por el token del propio aprendiz: las políticas de `public` solo dejan ver lo
 * **publicado**, y la clave de respuesta vive en un esquema no expuesto. Aquí no se resuelve
 * ninguna corrección, no se consulta ninguna clave y no se calcula nada: eso es del servidor
 * de base de datos, dentro de `append_learning_event` (INV-101, REQ-F09).
 *
 * Regla de identidad histórica, en las dos superficies: **si el ítem ya tiene vinculado lo
 * presentado, se muestra eso**, no «lo vigente ahora». Una versión posterior no reescribe lo
 * que alguien ya vio (SD-021, SD-023).
 */

export interface UnitContent {
  readonly versionId: string;
  readonly title: string;
  readonly body: string;
}

export interface QuestionOption {
  readonly id: string;
  readonly key: string;
  readonly body: string;
}

export interface QuestionContent {
  readonly representationId: string;
  readonly stem: string;
  readonly reference: string | null;
  readonly options: readonly QuestionOption[];
}

export async function loadUnitContent(
  supabase: SupabaseClient,
  item: ItemRow,
): Promise<UnitContent | null> {
  if (!item.learning_unit_id) return null;

  if (item.presented_learning_unit_version_id) {
    const { data, error } = await supabase
      .from('learning_unit_versions')
      .select('id, title, body')
      .eq('id', item.presented_learning_unit_version_id)
      .maybeSingle();
    if (error) throw new Error(`versión vinculada: ${error.message}`);
    if (!data) return null;
    const row = data as { id: string; title: string; body: string };
    return { versionId: row.id, title: row.title, body: row.body };
  }

  // Vigente: publicada y no superada. `version_no` desempata si hubiera varias.
  const { data, error } = await supabase
    .from('learning_unit_versions')
    .select('id, title, body, version_no')
    .eq('learning_unit_id', item.learning_unit_id)
    .eq('status', 'PUBLISHED')
    .is('superseded_by_version_id', null)
    .not('published_at', 'is', null)
    .order('version_no', { ascending: false })
    .limit(1);
  if (error) throw new Error(`versión vigente: ${error.message}`);
  const row = data?.[0] as { id: string; title: string; body: string } | undefined;
  return row ? { versionId: row.id, title: row.title, body: row.body } : null;
}

export async function loadQuestionContent(
  supabase: SupabaseClient,
  item: ItemRow,
): Promise<QuestionContent | null> {
  if (!item.question_id) return null;

  const representation = item.presented_representation_id
    ? await supabase
        .from('question_representations')
        .select('id, stem, official_reference')
        .eq('id', item.presented_representation_id)
        .maybeSingle()
    : await supabase
        .from('question_representations')
        .select('id, stem, official_reference, representation_no')
        .eq('question_id', item.question_id)
        .eq('status', 'PUBLISHED')
        .is('superseded_by_representation_id', null)
        .not('published_at', 'is', null)
        .order('representation_no', { ascending: false })
        .limit(1)
        .maybeSingle();

  if (representation.error) throw new Error(`representación: ${representation.error.message}`);
  const row = representation.data as {
    id: string;
    stem: string;
    official_reference: string | null;
  } | null;
  if (!row) return null;

  const options = await supabase
    .from('question_options')
    .select('id, option_key, body')
    .eq('representation_id', row.id)
    .order('sort_order');
  if (options.error) throw new Error(`opciones: ${options.error.message}`);

  return {
    representationId: row.id,
    stem: row.stem,
    reference: row.official_reference,
    options: ((options.data ?? []) as Array<{ id: string; option_key: string; body: string }>).map(
      (option) => ({ id: option.id, key: option.option_key, body: option.body }),
    ),
  };
}

/** Escala de confianza vigente, leída de la tabla gobernada. Nunca se escribe a mano. */
export interface ConfidenceScale {
  readonly version: string;
  readonly labels: readonly string[];
}

export async function loadConfidenceScale(
  supabase: SupabaseClient,
): Promise<ConfidenceScale | null> {
  const { data, error } = await supabase
    .from('confidence_scales')
    .select('version, labels')
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (error) throw new Error(`escala de confianza: ${error.message}`);
  if (!data) return null;
  const row = data as { version: string; labels: unknown };
  const labels = Array.isArray(row.labels) ? row.labels.map(String) : [];
  return { version: row.version, labels };
}

/** Procedencia mostrable de una unidad o representación: título de la fuente, nada más. */
export async function loadSourceTitle(
  supabase: SupabaseClient,
  sourceVersionId: string | null,
): Promise<string | null> {
  if (!sourceVersionId) return null;
  // D-20 · nunca se seleccionan `storage_path`, `checksum` ni `retrieved_at`.
  const { data, error } = await supabase
    .from('source_versions')
    .select('source_id, version_label')
    .eq('id', sourceVersionId)
    .maybeSingle();
  if (error || !data) return null;
  const version = data as { source_id: string; version_label: string };
  const source = await supabase
    .from('sources')
    .select('title')
    .eq('id', version.source_id)
    .maybeSingle();
  if (source.error || !source.data) return null;
  return (source.data as { title: string }).title;
}
