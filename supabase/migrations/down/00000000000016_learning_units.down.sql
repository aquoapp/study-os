-- Rollback de 00000000000016_learning_units.sql · Phase 2 · slice S2.
-- Devuelve la frontera de ingestión a su definición de Phase 1A (migración 13): las
-- funciones se restauran byte a byte y el tipo `staged_item_kind` vuelve a sus diecinueve
-- valores. PostgreSQL no retira valores de un enum: se reconstruye el tipo, y para eso no
-- puede quedar ninguna fila con los dos valores de Phase 2.
--
-- Esas filas están entretejidas con la auditoría: `promotions.staged_item_id` apunta al
-- ítem y `staged_items.promotion_id` apunta a la promoción, y la promoción cerrada es
-- inmutable (PI-1A-6). La inmutabilidad de la auditoría es un invariante de **operación**:
-- protege el historial mientras el objeto publicado existe. Aquí el objeto se está
-- eliminando con su tabla, de modo que conservar su promoción dejaría auditoría colgando de
-- algo que ya no está. Se levanta el trigger lo justo, se desenlaza y se borra en el orden
-- que ambas claves foráneas admiten, y se restaura el trigger: la firma del catálogo tras
-- reaplicar lo comprueba (`tgenabled` forma parte de ella).
drop table if exists public.learning_unit_versions;
drop function if exists public.check_unit_version_links();
drop function if exists public.reject_published_unit_version_mutation();
drop table if exists public.learning_units;

alter table ingest.promotions disable trigger promotions_immutable;
update ingest.promotions set staged_item_id = null
 where staged_item_id in (
   select id from ingest.staged_items where kind::text in ('learning_unit', 'learning_unit_version')
 );
delete from ingest.staged_items where kind::text in ('learning_unit', 'learning_unit_version');
delete from ingest.promotions
 where target_table in ('public.learning_units', 'public.learning_unit_versions');
alter table ingest.promotions enable trigger promotions_immutable;

drop function if exists ingest.stage_item(ingest.staged_item_kind, jsonb);
alter type ingest.staged_item_kind rename to staged_item_kind_phase2;
create type ingest.staged_item_kind as enum (
  'exam_pack', 'exam_pack_version', 'syllabus_block', 'topic',
  'concept', 'concept_version', 'concept_prerequisite',
  'source', 'source_version',
  'question', 'question_representation', 'question_concept', 'answer_key_version',
  'exam_section', 'exam_sitting', 'exam_sitting_model', 'exam_occurrence',
  'practical', 'practical_question'
);
alter table ingest.staged_items
  alter column kind type ingest.staged_item_kind using kind::text::ingest.staged_item_kind;
drop type ingest.staged_item_kind_phase2;

-- Definiciones de Phase 1A (migración 13), restauradas íntegras ------------------------
create or replace function ingest.stage_item(p_kind ingest.staged_item_kind, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'stage_item · el payload debe ser un objeto JSON' using errcode = 'invalid_parameter_value';
  end if;
  insert into ingest.staged_items (kind, payload) values (p_kind, p_payload) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function ingest.stage_item(ingest.staged_item_kind, jsonb) from public;
grant execute on function ingest.stage_item(ingest.staged_item_kind, jsonb) to service_role;

create or replace function ingest.validate_staged_item(p_id uuid)
returns ingest.staged_item_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  item ingest.staged_items%rowtype;
  p jsonb;
  klass text;
  outcome ingest.staged_item_status := 'VALIDATED';
  why text := null;
  n_options integer;
begin
  select * into item from ingest.staged_items where id = p_id;
  if item.id is null then
    raise exception 'validate_staged_item · no existe %', p_id using errcode = 'no_data_found';
  end if;
  if item.status = 'PUBLISHED' then
    raise exception 'validate_staged_item · el ítem % ya está publicado', p_id using errcode = 'object_in_use';
  end if;
  p := item.payload;

  begin
    case item.kind
      when 'exam_pack' then perform ingest.require_keys(p, array['slug', 'name']);
      when 'exam_pack_version' then perform ingest.require_keys(p, array['exam_pack_id', 'version_label', 'effective_from']);
      when 'syllabus_block' then perform ingest.require_keys(p, array['exam_pack_version_id', 'code', 'title', 'sort_order']);
      when 'topic' then perform ingest.require_keys(p, array['block_id', 'code', 'title', 'sort_order']);
      when 'concept' then perform ingest.require_keys(p, array['exam_pack_id', 'title']);
      when 'concept_version' then perform ingest.require_keys(p, array['concept_id', 'exam_pack_version_id', 'topic_id', 'title', 'sort_order']);
      when 'concept_prerequisite' then perform ingest.require_keys(p, array['concept_id', 'prerequisite_concept_id']);
      when 'source' then perform ingest.require_keys(p, array['title', 'authority', 'source_type', 'provenance_class']);
      when 'source_version' then perform ingest.require_keys(p, array['source_id', 'version_label', 'effective_from']);
      when 'question' then perform ingest.require_keys(p, array['exam_pack_id', 'question_type']);
      when 'question_representation' then perform ingest.require_keys(p, array['question_id', 'stem', 'provenance_class', 'options']);
      when 'question_concept' then perform ingest.require_keys(p, array['question_id', 'concept_id', 'exam_pack_version_id', 'relationship_type', 'weight']);
      when 'answer_key_version' then perform ingest.require_keys(p, array['question_id', 'correct_option_key', 'key_status', 'source_version_id', 'effective_from']);
      when 'exam_section' then perform ingest.require_keys(p, array['exam_pack_id', 'code', 'title', 'sort_order']);
      when 'exam_sitting' then perform ingest.require_keys(p, array['exam_pack_id', 'sitting_date', 'call_label', 'source_version_id']);
      when 'exam_sitting_model' then perform ingest.require_keys(p, array['sitting_id', 'model_code', 'source_version_id']);
      when 'exam_occurrence' then perform ingest.require_keys(p, array['sitting_model_id', 'section_id', 'question_id', 'display_no', 'provenance_class', 'source_version_id']);
      when 'practical' then perform ingest.require_keys(p, array['exam_pack_id', 'title', 'scenario', 'provenance_class']);
      when 'practical_question' then perform ingest.require_keys(p, array['practical_id', 'question_id', 'sort_order']);
    end case;

    -- Procedencia (EC-008 · INV-110 · CDEM §23).
    if p ? 'provenance_class' then
      klass := p->>'provenance_class';
      if klass not in ('OFFICIAL', 'VERIFIED', 'GENERATED') then
        raise exception 'procedencia inválida para contenido canónico: %', klass using errcode = 'invalid_parameter_value';
      end if;
      if klass = 'OFFICIAL' and item.kind <> 'source' then
        if not (p ? 'source_version_id') or p->>'source_version_id' is null
           or not ingest.source_version_is_official((p->>'source_version_id')::uuid) then
          outcome := 'QUARANTINE';
          why := 'INV-110 · contenido OFFICIAL sin versión de fuente primaria OFFICIAL verificable';
        end if;
      end if;
    end if;

    -- Representaciones: al menos dos opciones con clave y texto; sin marcadores.
    if item.kind = 'question_representation' then
      if jsonb_typeof(p->'options') <> 'array' then
        raise exception 'options debe ser un array' using errcode = 'invalid_parameter_value';
      end if;
      select count(*) into n_options
        from jsonb_array_elements(p->'options') o
        where o ? 'option_key' and o ? 'body' and coalesce(o->>'body', '') <> '';
      if n_options < 2 or n_options <> jsonb_array_length(p->'options') then
        raise exception 'una representación exige al menos dos opciones completas' using errcode = 'invalid_parameter_value';
      end if;
      if exists (
        select 1 from jsonb_array_elements(p->'options') o
        where o ?| array['correct', 'is_correct', 'correct_option', 'answer', 'solution']
      ) then
        raise exception 'SI-1A-5 · una opción no puede llevar marcador de corrección' using errcode = 'invalid_parameter_value';
      end if;
      if coalesce(p->'presentation_json', '{}'::jsonb) ?| array['correct', 'correct_option', 'correct_option_id', 'answer', 'answer_key', 'is_correct', 'solution'] then
        raise exception 'SI-1A-5 · presentation_json no puede llevar marcador de corrección' using errcode = 'invalid_parameter_value';
      end if;
    end if;

    -- Claves: la fuente de una clave OFFICIAL o de una representación OFFICIAL debe ser OFFICIAL.
    if item.kind = 'answer_key_version' then
      if not ingest.source_version_is_official((p->>'source_version_id')::uuid)
         and exists (
           select 1 from public.question_representations r
           where r.question_id = (p->>'question_id')::uuid
             and r.status = 'PUBLISHED' and r.superseded_by_representation_id is null
             and r.provenance_class = 'OFFICIAL'
         ) then
        outcome := 'QUARANTINE';
        why := 'INV-110 · la clave de una representación OFFICIAL exige una fuente OFFICIAL';
      end if;
    end if;
  exception
    when invalid_parameter_value or invalid_text_representation or datetime_field_overflow then
      outcome := 'REJECTED';
      why := sqlerrm;
  end;

  update ingest.staged_items
     set status = outcome, reason = why, validated_at = now()
   where id = p_id;
  return outcome;
end;
$$;

revoke all on function ingest.validate_staged_item(uuid) from public;
grant execute on function ingest.validate_staged_item(uuid) to service_role;

create or replace function ingest.publish_staged_item(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item ingest.staged_items%rowtype;
  p jsonb;
  promo uuid;
  target uuid;
  dest_table text;
  klass public.provenance_class;
  pack uuid;
  pack_slug text;
  ver uuid;
  rep_no integer;
  current_rep uuid;
  current_key uuid;
  opt jsonb;
  opt_idx integer := 0;
  rel public.mapping_relationship;
  mstatus public.mapping_status;
  rep_for_key uuid;
  option_for_key uuid;
begin
  select * into item from ingest.staged_items where id = p_id;
  if item.id is null then
    raise exception 'publish_staged_item · no existe %', p_id using errcode = 'no_data_found';
  end if;
  if item.status <> 'VALIDATED' then
    raise exception 'publish_staged_item · el ítem % está en estado %, no VALIDATED', p_id, item.status
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  p := item.payload;
  klass := (p->>'provenance_class')::public.provenance_class;

  insert into ingest.promotions (target_table, provenance_class, source_version_id, staged_item_id)
  values ('public.pending', klass, (p->>'source_version_id')::uuid, item.id)
  returning id into promo;

  case item.kind
    when 'exam_pack' then
      dest_table := 'public.exam_packs';
      insert into public.exam_packs (slug, name, short_name, jurisdiction, status, promotion_id)
      values (p->>'slug', p->>'name', p->>'short_name', p->>'jurisdiction',
              coalesce((p->>'status')::public.content_status, 'PUBLISHED'), promo)
      returning id into target;

    when 'exam_pack_version' then
      dest_table := 'public.exam_pack_versions';
      insert into public.exam_pack_versions (exam_pack_id, version_label, effective_from, effective_to, status, change_summary, promotion_id)
      values ((p->>'exam_pack_id')::uuid, p->>'version_label', (p->>'effective_from')::date, (p->>'effective_to')::date,
              coalesce((p->>'status')::public.content_status, 'PUBLISHED'), p->>'change_summary', promo)
      returning id into target;
      if coalesce((p->>'set_current')::boolean, false) then
        update public.exam_packs set current_version_id = target where id = (p->>'exam_pack_id')::uuid;
      end if;

    when 'syllabus_block' then
      dest_table := 'public.syllabus_blocks';
      insert into public.syllabus_blocks (exam_pack_version_id, code, title, sort_order, promotion_id)
      values ((p->>'exam_pack_version_id')::uuid, p->>'code', p->>'title', (p->>'sort_order')::integer, promo)
      returning id into target;

    when 'topic' then
      dest_table := 'public.topics';
      select b.exam_pack_version_id into ver from public.syllabus_blocks b where b.id = (p->>'block_id')::uuid;
      if ver is null then
        raise exception 'topic · bloque inexistente' using errcode = 'foreign_key_violation';
      end if;
      insert into public.topics (block_id, exam_pack_version_id, code, title, sort_order, promotion_id)
      values ((p->>'block_id')::uuid, ver, p->>'code', p->>'title', (p->>'sort_order')::integer, promo)
      returning id into target;

    when 'concept' then
      dest_table := 'public.concepts';
      pack := (p->>'exam_pack_id')::uuid;
      select ep.slug into pack_slug from public.exam_packs ep where ep.id = pack;
      if pack_slug is null then
        raise exception 'concept · pack inexistente' using errcode = 'foreign_key_violation';
      end if;
      insert into public.concepts (exam_pack_id, concept_key, status, promotion_id)
      values (pack, ingest.concept_key(pack_slug, p->>'title'),
              coalesce((p->>'status')::public.content_status, 'PUBLISHED'), promo)
      returning id into target;

    when 'concept_version' then
      dest_table := 'public.concept_versions';
      select c.exam_pack_id into pack from public.concepts c where c.id = (p->>'concept_id')::uuid;
      if pack is null then
        raise exception 'concept_version · concepto inexistente' using errcode = 'foreign_key_violation';
      end if;
      insert into public.concept_versions (concept_id, exam_pack_id, exam_pack_version_id, topic_id, title, description,
                                           difficulty_hint, official_code, sort_order, source_version_id, promotion_id)
      values ((p->>'concept_id')::uuid, pack, (p->>'exam_pack_version_id')::uuid, (p->>'topic_id')::uuid, p->>'title',
              p->>'description', p->>'difficulty_hint', p->>'official_code', (p->>'sort_order')::integer,
              (p->>'source_version_id')::uuid, promo)
      returning id into target;

    when 'concept_prerequisite' then
      dest_table := 'public.concept_prerequisites';
      select c.exam_pack_id into pack from public.concepts c where c.id = (p->>'concept_id')::uuid;
      if pack is null then
        raise exception 'concept_prerequisite · concepto inexistente' using errcode = 'foreign_key_violation';
      end if;
      insert into public.concept_prerequisites (concept_id, prerequisite_concept_id, exam_pack_id, strength, rationale, promotion_id)
      values ((p->>'concept_id')::uuid, (p->>'prerequisite_concept_id')::uuid, pack, p->>'strength', p->>'rationale', promo);
      target := (p->>'concept_id')::uuid;

    when 'source' then
      dest_table := 'public.sources';
      insert into public.sources (title, authority, source_type, provenance_class, canonical_url, promotion_id)
      values (p->>'title', p->>'authority', p->>'source_type', klass, p->>'canonical_url', promo)
      returning id into target;

    when 'source_version' then
      dest_table := 'public.source_versions';
      insert into public.source_versions (source_id, version_label, publication_date, effective_from, effective_to, status,
                                          checksum, storage_path, retrieved_at, validated_at, supersedes_version_id, promotion_id)
      values ((p->>'source_id')::uuid, p->>'version_label', (p->>'publication_date')::date, (p->>'effective_from')::date,
              (p->>'effective_to')::date, coalesce((p->>'status')::public.source_version_status, 'CURRENT'),
              p->>'checksum', p->>'storage_path', (p->>'retrieved_at')::timestamptz, (p->>'validated_at')::timestamptz,
              (p->>'supersedes_version_id')::uuid, promo)
      returning id into target;
      if (p->>'supersedes_version_id') is not null then
        update public.source_versions
           set status = 'SUPERSEDED',
               effective_to = coalesce(effective_to, (p->>'effective_from')::date)
         where id = (p->>'supersedes_version_id')::uuid and status = 'CURRENT';
      end if;

    when 'question' then
      dest_table := 'public.canonical_questions';
      insert into public.canonical_questions (exam_pack_id, question_type, status, promotion_id)
      values ((p->>'exam_pack_id')::uuid, p->>'question_type',
              coalesce((p->>'status')::public.content_status, 'PUBLISHED'), promo)
      returning id into target;

    when 'question_representation' then
      dest_table := 'public.question_representations';
      -- Serializa las publicaciones de la misma pregunta sin secuencias ni FOR UPDATE.
      perform pg_advisory_xact_lock(hashtext('question_representations:' || (p->>'question_id')));
      select coalesce(max(r.representation_no), 0) + 1 into rep_no
        from public.question_representations r where r.question_id = (p->>'question_id')::uuid;
      select r.id into current_rep
        from public.question_representations r
       where r.question_id = (p->>'question_id')::uuid and r.status = 'PUBLISHED'
         and r.superseded_by_representation_id is null;
      insert into public.question_representations (question_id, representation_no, stem, official_reference, presentation_json,
                                                   provenance_class, source_version_id, status, supersedes_representation_id,
                                                   published_at, promotion_id)
      values ((p->>'question_id')::uuid, rep_no, p->>'stem', p->>'official_reference',
              coalesce(p->'presentation_json', '{}'::jsonb), klass, (p->>'source_version_id')::uuid,
              'DRAFT', current_rep, now(), promo)
      returning id into target;
      for opt in select * from jsonb_array_elements(p->'options') loop
        opt_idx := opt_idx + 1;
        insert into public.question_options (representation_id, option_key, body, sort_order)
        values (target, opt->>'option_key', opt->>'body', coalesce((opt->>'sort_order')::integer, opt_idx));
      end loop;
      -- Una representación puede publicarse como DRAFT (no vigente, sin supersesión):
      -- es la forma de preparar una corrección antes de hacerla vigente.
      if coalesce(p->>'status', 'PUBLISHED') = 'DRAFT' then
        update public.question_representations set supersedes_representation_id = null where id = target;
      else
        -- Primero se enlaza la anterior (deja de ser vigente), después se publica la nueva:
        -- el índice único de «una vigente por pregunta» nunca ve dos a la vez.
        if current_rep is not null then
          update public.question_representations set superseded_by_representation_id = target where id = current_rep;
        end if;
        update public.question_representations set status = 'PUBLISHED' where id = target;
      end if;

    when 'question_concept' then
      dest_table := 'public.question_concepts';
      select q.exam_pack_id into pack from public.canonical_questions q where q.id = (p->>'question_id')::uuid;
      if pack is null then
        raise exception 'question_concept · pregunta inexistente' using errcode = 'foreign_key_violation';
      end if;
      rel := (p->>'relationship_type')::public.mapping_relationship;
      mstatus := coalesce((p->>'mapping_status')::public.mapping_status, 'VALIDATED');
      insert into public.question_concepts (question_id, concept_id, exam_pack_id, exam_pack_version_id, relationship_type,
                                            weight, mapping_status, validated_at, promotion_id)
      values ((p->>'question_id')::uuid, (p->>'concept_id')::uuid, pack, (p->>'exam_pack_version_id')::uuid, rel,
              (p->>'weight')::numeric, mstatus, case when mstatus = 'VALIDATED' then now() else null end, promo)
      returning id into target;

    when 'answer_key_version' then
      dest_table := 'content.answer_key_versions';
      perform pg_advisory_xact_lock(hashtext('answer_key_versions:' || (p->>'question_id')));
      if (p->>'representation_id') is not null then
        rep_for_key := (p->>'representation_id')::uuid;
      else
        select r.id into rep_for_key
          from public.question_representations r
         where r.question_id = (p->>'question_id')::uuid and r.status = 'PUBLISHED'
           and r.superseded_by_representation_id is null;
      end if;
      if rep_for_key is null then
        raise exception 'answer_key_version · la pregunta no tiene representación publicada vigente'
          using errcode = 'object_not_in_prerequisite_state';
      end if;
      select o.id into option_for_key
        from public.question_options o
       where o.representation_id = rep_for_key and o.option_key = p->>'correct_option_key';
      if option_for_key is null then
        raise exception 'answer_key_version · la opción % no pertenece a la representación', p->>'correct_option_key'
          using errcode = 'foreign_key_violation';
      end if;
      select k.id into current_key
        from content.answer_key_versions k
       where k.question_id = (p->>'question_id')::uuid and k.effective_to is null;
      if current_key is not null then
        update content.answer_key_versions
           set effective_to = greatest((p->>'effective_from')::date, effective_from + 1)
         where id = current_key;
      end if;
      insert into content.answer_key_versions (question_id, representation_id, correct_option_id, key_status, source_version_id,
                                               explanation, effective_from, supersedes_key_id, promotion_id)
      values ((p->>'question_id')::uuid, rep_for_key, option_for_key, (p->>'key_status')::public.key_status,
              (p->>'source_version_id')::uuid, p->>'explanation', (p->>'effective_from')::date, current_key, promo)
      returning id into target;

    when 'exam_section' then
      dest_table := 'public.exam_sections';
      insert into public.exam_sections (exam_pack_id, code, title, sort_order, promotion_id)
      values ((p->>'exam_pack_id')::uuid, p->>'code', p->>'title', (p->>'sort_order')::integer, promo)
      returning id into target;

    when 'exam_sitting' then
      dest_table := 'public.exam_sittings';
      insert into public.exam_sittings (exam_pack_id, sitting_date, call_label, source_version_id, notes, promotion_id)
      values ((p->>'exam_pack_id')::uuid, (p->>'sitting_date')::date, p->>'call_label', (p->>'source_version_id')::uuid, p->>'notes', promo)
      returning id into target;

    when 'exam_sitting_model' then
      dest_table := 'public.exam_sitting_models';
      select s.exam_pack_id into pack from public.exam_sittings s where s.id = (p->>'sitting_id')::uuid;
      if pack is null then
        raise exception 'exam_sitting_model · convocatoria inexistente' using errcode = 'foreign_key_violation';
      end if;
      insert into public.exam_sitting_models (sitting_id, exam_pack_id, model_code, source_version_id, promotion_id)
      values ((p->>'sitting_id')::uuid, pack, p->>'model_code', (p->>'source_version_id')::uuid, promo)
      returning id into target;

    when 'exam_occurrence' then
      dest_table := 'public.exam_occurrences';
      select m.exam_pack_id into pack from public.exam_sitting_models m where m.id = (p->>'sitting_model_id')::uuid;
      if pack is null then
        raise exception 'exam_occurrence · modelo inexistente' using errcode = 'foreign_key_violation';
      end if;
      insert into public.exam_occurrences (sitting_model_id, section_id, question_id, exam_pack_id, display_no, is_reserve,
                                           provenance_class, source_version_id, source_file_ref, promotion_id)
      values ((p->>'sitting_model_id')::uuid, (p->>'section_id')::uuid, (p->>'question_id')::uuid, pack,
              (p->>'display_no')::integer, coalesce((p->>'is_reserve')::boolean, false), klass,
              (p->>'source_version_id')::uuid, p->>'source_file_ref', promo)
      returning id into target;

    when 'practical' then
      dest_table := 'public.practicals';
      insert into public.practicals (exam_pack_id, title, scenario, provenance_class, source_version_id, status, promotion_id)
      values ((p->>'exam_pack_id')::uuid, p->>'title', p->>'scenario', klass, (p->>'source_version_id')::uuid,
              coalesce((p->>'status')::public.content_status, 'PUBLISHED'), promo)
      returning id into target;

    when 'practical_question' then
      dest_table := 'public.practical_questions';
      select pr.exam_pack_id into pack from public.practicals pr where pr.id = (p->>'practical_id')::uuid;
      if pack is null then
        raise exception 'practical_question · práctico inexistente' using errcode = 'foreign_key_violation';
      end if;
      insert into public.practical_questions (practical_id, question_id, exam_pack_id, sort_order, promotion_id)
      values ((p->>'practical_id')::uuid, (p->>'question_id')::uuid, pack, (p->>'sort_order')::integer, promo)
      returning id into target;
  end case;

  update ingest.promotions set target_table = dest_table, target_id = target where id = promo;
  update ingest.staged_items
     set status = 'PUBLISHED', published_at = now(), target_id = target, promotion_id = promo, reason = null
   where id = p_id;
  return target;
end;
$$;

comment on function ingest.publish_staged_item(uuid) is
  'SI-1A-6 · única vía de escritura en tablas canónicas. Exige VALIDATED, crea la promoción '
  '(PI-1A-6), inserta según el tipo y deja el ítem en PUBLISHED con su destino.';

revoke all on function ingest.publish_staged_item(uuid) from public;
grant execute on function ingest.publish_staged_item(uuid) to service_role;

create or replace function ingest.purge_generated_pack(p_pack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  non_generated integer;
  deleted jsonb := '{}'::jsonb;
  n integer;
  purge_versions uuid[];
  purge_sources uuid[];
  pass integer;
  pass_rows integer;
begin
  if not exists (select 1 from public.exam_packs where id = p_pack_id) then
    raise exception 'purge_generated_pack · pack inexistente' using errcode = 'no_data_found';
  end if;

  select
    (select count(*) from public.question_representations r
       join public.canonical_questions q on q.id = r.question_id
      where q.exam_pack_id = p_pack_id and r.provenance_class <> 'GENERATED')
    + (select count(*) from public.practicals pr where pr.exam_pack_id = p_pack_id and pr.provenance_class <> 'GENERATED')
    + (select count(*) from public.exam_occurrences o where o.exam_pack_id = p_pack_id and o.provenance_class <> 'GENERATED')
    + (select count(*) from public.sources s
        where s.provenance_class <> 'GENERATED'
          and s.id in (
            select sv.source_id from public.source_versions sv
            where sv.id in (
              select r.source_version_id from public.question_representations r
                join public.canonical_questions q on q.id = r.question_id where q.exam_pack_id = p_pack_id
              union select pr.source_version_id from public.practicals pr where pr.exam_pack_id = p_pack_id
              union select o.source_version_id from public.exam_occurrences o where o.exam_pack_id = p_pack_id
              union select st.source_version_id from public.exam_sittings st where st.exam_pack_id = p_pack_id
            )
          ))
  into non_generated;

  if non_generated > 0 then
    raise exception 'purge_generated_pack · el pack % contiene % fila(s) no GENERATED: no se purga', p_pack_id, non_generated
      using errcode = 'restrict_violation';
  end if;

  perform set_config('ingest.purge_generated_pack', 'on', true);

  select coalesce(array_agg(distinct sv.id), '{}'), coalesce(array_agg(distinct sv.source_id), '{}')
    into purge_versions, purge_sources
    from public.source_versions sv
    join public.sources s on s.id = sv.source_id
    where s.provenance_class = 'GENERATED'
      and sv.id in (
        select r.source_version_id from public.question_representations r
          join public.canonical_questions q on q.id = r.question_id where q.exam_pack_id = p_pack_id
        union select pr.source_version_id from public.practicals pr where pr.exam_pack_id = p_pack_id
        union select o.source_version_id from public.exam_occurrences o where o.exam_pack_id = p_pack_id
        union select st.source_version_id from public.exam_sittings st where st.exam_pack_id = p_pack_id
        union select m.source_version_id from public.exam_sitting_models m where m.exam_pack_id = p_pack_id
        union select cv.source_version_id from public.concept_versions cv where cv.exam_pack_id = p_pack_id
        union select k.source_version_id from content.answer_key_versions k
          join public.canonical_questions q on q.id = k.question_id where q.exam_pack_id = p_pack_id
      );

  delete from content.answer_key_versions k
    using public.canonical_questions q where k.question_id = q.id and q.exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('answer_key_versions', n);

  delete from public.exam_occurrences where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('exam_occurrences', n);
  delete from public.exam_sitting_models where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('exam_sitting_models', n);
  delete from public.exam_sittings where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('exam_sittings', n);
  delete from public.exam_sections where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('exam_sections', n);

  delete from public.practical_questions where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('practical_questions', n);
  delete from public.practicals where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('practicals', n);

  delete from public.question_concepts where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('question_concepts', n);
  delete from public.question_options o
    using public.question_representations r, public.canonical_questions q
   where o.representation_id = r.id and r.question_id = q.id and q.exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('question_options', n);
  -- Se retiran y se deshacen los enlaces en una sola sentencia: al dejar de estar
  -- PUBLISHED salen del índice «una vigente por pregunta» antes de que este se evalúe.
  update public.question_representations r
     set status = 'RETIRED', superseded_by_representation_id = null, supersedes_representation_id = null
    from public.canonical_questions q where r.question_id = q.id and q.exam_pack_id = p_pack_id;
  delete from public.question_representations r
    using public.canonical_questions q where r.question_id = q.id and q.exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('question_representations', n);
  delete from public.canonical_questions where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('canonical_questions', n);

  delete from public.concept_prerequisites where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('concept_prerequisites', n);
  delete from public.concept_versions where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('concept_versions', n);
  delete from public.concepts where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('concepts', n);

  delete from public.topics t using public.exam_pack_versions v
   where t.exam_pack_version_id = v.id and v.exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('topics', n);
  delete from public.syllabus_blocks b using public.exam_pack_versions v
   where b.exam_pack_version_id = v.id and v.exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('syllabus_blocks', n);

  update public.exam_packs set current_version_id = null where id = p_pack_id;
  delete from public.exam_pack_versions where exam_pack_id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('exam_pack_versions', n);
  delete from public.exam_packs where id = p_pack_id;
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('exam_packs', n);

  -- Fuentes GENERATED que solo este pack referenciaba: se limpian con él, con todas sus
  -- versiones, en pasadas sucesivas para respetar la cadena de supersesión.
  n := 0;
  for pass in 1..20 loop
    delete from public.source_versions sv
     where sv.source_id = any (purge_sources)
       and not exists (select 1 from public.question_representations r where r.source_version_id = sv.id)
     and not exists (select 1 from public.practicals pr where pr.source_version_id = sv.id)
     and not exists (select 1 from public.exam_occurrences o where o.source_version_id = sv.id)
     and not exists (select 1 from public.exam_sittings st where st.source_version_id = sv.id)
     and not exists (select 1 from public.exam_sitting_models m where m.source_version_id = sv.id)
     and not exists (select 1 from public.concept_versions cv where cv.source_version_id = sv.id)
     and not exists (select 1 from content.answer_key_versions k where k.source_version_id = sv.id)
       and not exists (select 1 from public.source_versions other where other.supersedes_version_id = sv.id);
    get diagnostics pass_rows = row_count;
    exit when pass_rows = 0;
    n := n + pass_rows;
  end loop;
  deleted := deleted || jsonb_build_object('source_versions', n);
  delete from public.sources s
   where s.provenance_class = 'GENERATED'
     and s.id = any (purge_sources)
     and not exists (select 1 from public.source_versions sv where sv.source_id = s.id);
  get diagnostics n = row_count; deleted := deleted || jsonb_build_object('sources', n);

  return deleted;
end;
$$;

comment on function ingest.purge_generated_pack(uuid) is
  'Higiene de fixtures: borra un pack cuyo contenido es íntegramente GENERATED. Se niega '
  'ante cualquier fila OFFICIAL o VERIFIED. No es ruta de promoción ni de borrado real.';

revoke all on function ingest.purge_generated_pack(uuid) from public;
grant execute on function ingest.purge_generated_pack(uuid) to service_role;
