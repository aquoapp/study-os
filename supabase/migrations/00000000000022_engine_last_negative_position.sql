-- 00000000000022 · Learning Engine · posición de la última evidencia negativa · P4-D6
--
-- Contrato del Learning Engine v1.1, anexo §25 · decisión humana P4-D6 (2026-09-19).
--
-- La proyección emite, por (persona, concepto), la posición de stream del intento **elegible** más
-- reciente cuyo resultado es INCORRECT o BLANK, o NULL si no lo hay. La calcula el pliegue de
-- TypeScript en la misma rama que `ever_incorrect`; esta migración solo la persiste. Ningún
-- consumidor la recalcula: hay un solo pliegue autoritativo de evidencia.
--
-- Qué hace, y nada más:
--   1. invalida la proyección **materializada** existente —derivada y reconstruible desde la
--      evidencia (contrato §4 y §15)—, porque una fila calculada antes de este hecho no lo lleva y
--      `engine_version` no forma parte de la tupla que decide continuar o reconstruir. Nunca toca
--      evidencia: `learning_events`, `question_attempts` y `mastery_history` quedan intactos;
--   2. añade la columna, fuera del vector, con tres invariantes mecánicas;
--   3. reemplaza `engine.apply_projection` con la única diferencia de persistir el hecho.
--
-- No expone ningún esquema, no cambia ningún grant, no toca `engine_config` ni ningún otro campo.

-- 1 · Invalidación de lo derivado -------------------------------------------------------------
delete from engine.error_patterns;
delete from engine.concept_mastery;
delete from engine.projection_watermarks;

-- 2 · El hecho ---------------------------------------------------------------------------------
alter table engine.concept_mastery add column if not exists last_negative_position bigint;

alter table engine.concept_mastery
  add constraint concept_mastery_last_negative_positive
    check (last_negative_position is null or last_negative_position >= 1);

alter table engine.concept_mastery
  add constraint concept_mastery_last_negative_within_watermark
    check (last_negative_position is null or last_negative_position <= event_watermark);

-- Contrato §25.2 · no nulo **exactamente** cuando hay necesidad de reparación. Es una consecuencia
-- de la función de estado de §9.1 y de los patrones de §17, no una convención: si alguna vez
-- falla, el pliegue y la función de estado han divergido.
alter table engine.concept_mastery
  add constraint concept_mastery_last_negative_iff_remediation
    check (
      (mastery_state in ('EVIDENCE_NEGATIVE', 'EVIDENCE_CONFLICTING'))
      = (last_negative_position is not null)
    );

comment on column engine.concept_mastery.last_negative_position is
  'Contrato del Learning Engine v1.1 §25 · P4-D6 · posición de stream del intento elegible no '
  'correcto más reciente del concepto. Procedencia, no puntuación. Solo la mueve evidencia '
  'elegible nueva o una reconstrucción legítima.';

-- 3 · Persistencia ----------------------------------------------------------------------------
create or replace function engine.apply_projection(
  p_user_id uuid,
  p_payload jsonb,
  p_reason engine.projection_reason,
  p_from_position bigint,
  p_replace_all boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_projection constant text := 'concept_mastery';
  v_to_position bigint;
  v_engine_version text;
  v_config_version text;
  v_pack_version uuid;
  v_generation bigint;
  v_unattributed integer;
  v_diagnostic integer;
  v_attempts integer;
  v_before jsonb;
  v_after jsonb;
  v_current bigint;
begin
  v_to_position := (p_payload ->> 'eventWatermark')::bigint;
  v_engine_version := p_payload ->> 'engineVersion';
  v_config_version := p_payload ->> 'engineConfigVersion';
  v_pack_version := (p_payload ->> 'attributionPackVersionId')::uuid;
  v_generation := (p_payload ->> 'attributionGeneration')::bigint;
  v_unattributed := coalesce((p_payload ->> 'unattributedAttemptCount')::integer, 0);
  v_diagnostic := coalesce((p_payload ->> 'diagnosticAttemptCount')::integer, 0);
  v_attempts := coalesce((p_payload ->> 'attemptsFolded')::integer, 0);

  if v_to_position is null or v_engine_version is null or v_config_version is null
     or v_pack_version is null or v_generation is null then
    raise exception 'engine · la tupla semántica declarada está incompleta'
      using errcode = 'null_value_not_allowed';
  end if;

  if not exists (select 1 from engine.engine_config c
                 where c.version = v_config_version and c.status = 'ACTIVE') then
    raise exception 'engine · la versión de configuración % no está ACTIVE', v_config_version
      using errcode = 'foreign_key_violation';
  end if;

  -- El bloqueo precede a toda comprobación: dos ejecuciones concurrentes del mismo aprendiz
  -- se serializan, y la segunda ve el watermark ya avanzado.
  insert into engine.projection_watermarks (user_id, projection_name)
  values (p_user_id, v_projection)
  on conflict (user_id, projection_name) do nothing;

  select w.consumed_position into v_current
  from engine.projection_watermarks w
  where w.user_id = p_user_id and w.projection_name = v_projection
  for update;

  if not p_replace_all and v_current is distinct from p_from_position then
    raise exception 'engine · el watermark cambió bajo los pies: esperaba %, hay %',
      p_from_position, v_current using errcode = 'serialization_failure';
  end if;

  if v_to_position < v_current then
    raise exception 'engine · un watermark nunca retrocede: % < %', v_to_position, v_current
      using errcode = 'check_violation';
  end if;

  select coalesce(jsonb_agg(x order by x ->> 'conceptId'), '[]'::jsonb) into v_before
  from (
    select jsonb_build_object(
             'conceptId', m.concept_id, 'masteryState', m.mastery_state,
             'uncertainty', m.uncertainty, 'vector', m.vector,
             'lastNegativePosition', m.last_negative_position) as x
    from engine.concept_mastery m where m.user_id = p_user_id
  ) s;

  if p_replace_all then
    delete from engine.concept_mastery where user_id = p_user_id;
    delete from engine.error_patterns where user_id = p_user_id;
  end if;

  delete from engine.concept_mastery m
  where m.user_id = p_user_id
    and not exists (
      select 1 from jsonb_array_elements(p_payload -> 'concepts') c
      where (c ->> 'conceptId')::uuid = m.concept_id
    );

  insert into engine.concept_mastery (
    user_id, concept_id, mastery_state, uncertainty, vector, next_review_at,
    last_negative_position, engine_version, engine_config_version, attribution_pack_version_id,
    attribution_generation, event_watermark, calculated_at
  )
  select
    p_user_id,
    (c ->> 'conceptId')::uuid,
    (c ->> 'masteryState')::engine.mastery_state,
    (c ->> 'uncertainty')::engine.uncertainty,
    c -> 'vector',
    null,
    (c ->> 'lastNegativePosition')::bigint,
    v_engine_version, v_config_version, v_pack_version, v_generation, v_to_position, now()
  from jsonb_array_elements(p_payload -> 'concepts') c
  on conflict (user_id, concept_id) do update set
    mastery_state = excluded.mastery_state,
    uncertainty = excluded.uncertainty,
    vector = excluded.vector,
    next_review_at = null,
    last_negative_position = excluded.last_negative_position,
    engine_version = excluded.engine_version,
    engine_config_version = excluded.engine_config_version,
    attribution_pack_version_id = excluded.attribution_pack_version_id,
    attribution_generation = excluded.attribution_generation,
    event_watermark = excluded.event_watermark,
    calculated_at = excluded.calculated_at;

  -- Los patrones son derivados: se reemplazan enteros. La resolución es la ausencia.
  delete from engine.error_patterns where user_id = p_user_id;
  insert into engine.error_patterns (
    user_id, concept_id, pattern_type, status, evidence_count,
    engine_version, engine_config_version, attribution_generation, calculated_at
  )
  select
    p_user_id,
    (p ->> 'conceptId')::uuid,
    (p ->> 'patternType')::engine.error_pattern_type,
    'ACTIVE',
    (p ->> 'evidenceCount')::integer,
    v_engine_version, v_config_version, v_generation, now()
  from jsonb_array_elements(p_payload -> 'errorPatterns') p;

  select coalesce(jsonb_agg(x order by x ->> 'conceptId'), '[]'::jsonb) into v_after
  from (
    select jsonb_build_object(
             'conceptId', m.concept_id, 'masteryState', m.mastery_state,
             'uncertainty', m.uncertainty, 'vector', m.vector,
             'lastNegativePosition', m.last_negative_position) as x
    from engine.concept_mastery m where m.user_id = p_user_id
  ) s;

  insert into engine.mastery_history (
    user_id, reason, reason_json, from_position, to_position,
    engine_version, engine_config_version, attribution_pack_version_id, attribution_generation
  )
  values (
    p_user_id, p_reason,
    jsonb_build_object(
      'vectorBefore', v_before,
      'vectorAfter', v_after,
      'consumedPositions', jsonb_build_object('from', coalesce(v_current, 0), 'to', v_to_position),
      'attemptsFolded', v_attempts,
      'unattributedSkipped', v_unattributed,
      'diagnosticSkipped', v_diagnostic,
      'errorPatterns', coalesce(p_payload -> 'errorPatterns', '[]'::jsonb)
    ),
    coalesce(v_current, 0), v_to_position,
    v_engine_version, v_config_version, v_pack_version, v_generation
  );

  update engine.projection_watermarks
     set consumed_position = v_to_position,
         engine_version = v_engine_version,
         engine_config_version = v_config_version,
         attribution_pack_version_id = v_pack_version,
         attribution_generation = v_generation,
         unattributed_attempt_count = v_unattributed,
         diagnostic_attempt_count = v_diagnostic,
         updated_at = now()
   where user_id = p_user_id and projection_name = v_projection;

  return v_to_position;
end;
$$;
comment on function engine.apply_projection(uuid, jsonb, engine.projection_reason, bigint, boolean) is
  'Persistencia atómica del resultado del motor determinista de TypeScript. La proyección, el '
  'historial y el avance del watermark ocurren en la misma transacción: un fallo no deja ni '
  'proyección parcial ni watermark adelantado.';
revoke all on function engine.apply_projection(uuid, jsonb, engine.projection_reason, bigint, boolean)
  from public, anon, authenticated, service_role;
