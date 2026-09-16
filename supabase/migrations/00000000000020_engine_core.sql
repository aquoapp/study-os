-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 20 · Núcleo del Learning Engine (Phase 3)
--
-- `docs/LEARNING_ENGINE_CONTRACT.md` v1.0 `ACCEPTED` · ADR-003 v1.2 · SD-013 · SD-024 ·
-- SD-025 · SD-026 · ADR-008 (anexo de reconciliación de watermark) · ADR-011 (anexo v1.1:
-- alta del esquema `engine`, previsto en su punto 10).
--
-- Lo que esta migración materializa:
--
--   - `engine.concept_mastery`      · proyección autoritativa: **vector de evidencia** y
--                                     estado categórico derivado. Sin puntuación numérica.
--   - `engine.mastery_history`      · auditoría append-only con `reason_json` (CJF-1).
--   - `engine.error_patterns`       · patrones estructurales activos, derivados.
--   - `engine.projection_watermarks`· progreso del consumidor por usuario y proyección.
--   - `engine.engine_config`        · versionada, inmutable por versión publicada, con
--                                     promoción explícita y registrada. Cero parámetros
--                                     numéricos de aprendizaje.
--
-- Lo que **no** materializa, y no por olvido: `exam_readiness` (BD-04 · readiness es de
-- objetivo y es de Phase 6) e `intervention_outcomes` (REQ-D07 diferido · DEF-29 · los
-- eventos de intervención hoy se rechazan y no hay taxonomía). Una tabla sin escritor
-- posible no es sustrato: es decoración de esquema.
--
-- El motor **no vive aquí**: es TypeScript determinista y sin red (`packages/learning-engine`,
-- EC-002 · ADR-001). Estas funciones solo **persisten** su resultado de forma atómica junto
-- al watermark.
--
-- Rollback: supabase/migrations/down/00000000000020_engine_core.down.sql
-- ---------------------------------------------------------------------------

create schema if not exists engine;
comment on schema engine is
  'ADR-011 punto 10 (anexo v1.1) · configuración, proyecciones y funciones del Learning '
  'Engine. NO expuesto al Data API. Sin USAGE para anon ni authenticated: ninguna superficie '
  'de aprendiz alcanza el estado derivado en Phase 3.';
revoke all on schema engine from public, anon, authenticated;
grant usage on schema engine to service_role;

-- Tipos -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'mastery_state' and n.nspname = 'engine') then
    -- Los cinco estados de v1 y **solo** los cinco. `LEARNING`, `CONSOLIDATING`, `MASTERED`
    -- y `STRONG` quedan RESERVED/FUTURE (contrato §9.2): mantenerlos fuera del tipo hace la
    -- prohibición estructural en lugar de documental.
    create type engine.mastery_state as enum (
      'NEW', 'EXPOSED', 'EVIDENCE_POSITIVE', 'EVIDENCE_NEGATIVE', 'EVIDENCE_CONFLICTING'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'uncertainty' and n.nspname = 'engine') then
    create type engine.uncertainty as enum (
      'NO_EVIDENCE', 'SINGLE_OBSERVATION', 'REPEATED_SAME_QUESTION', 'MULTIPLE_QUESTIONS'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'error_pattern_type' and n.nspname = 'engine') then
    create type engine.error_pattern_type as enum (
      'RECURRENT_INCORRECT', 'RECURRENT_BLANK', 'MAX_CONFIDENCE_INCORRECT'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'config_status' and n.nspname = 'engine') then
    create type engine.config_status as enum ('DRAFT', 'ACTIVE', 'SUPERSEDED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'projection_reason' and n.nspname = 'engine') then
    create type engine.projection_reason as enum (
      'INCREMENTAL', 'REBUILD', 'RECALCULATION_ATTRIBUTION_CHANGED', 'RECALCULATION_ENGINE_CHANGED'
    );
  end if;
end
$$;

-- engine_config ----------------------------------------------------------------------
create table if not exists engine.engine_config (
  version text primary key,
  status engine.config_status not null default 'DRAFT',
  document jsonb not null,
  author text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  promoted_at timestamptz,
  promoted_by text,
  promotion_evidence jsonb,
  superseded_at timestamptz,
  constraint engine_config_version_format check (version ~ '^v[0-9]{1,3}$'),
  constraint engine_config_document_object check (jsonb_typeof(document) = 'object'),
  constraint engine_config_author_format check (author ~ '^[A-Za-z0-9_.:-]{2,80}$'),
  constraint engine_config_reason_length check (char_length(reason) between 3 and 500),
  -- Sin parámetros numéricos de aprendizaje: la ausencia es la garantía (contrato §16).
  constraint engine_config_no_weights check (
    not (document ? 'weights') and not (document ? 'weight')
    and not (document ? 'thresholds') and not (document ? 'bands')
    and not (document ? 'decay') and not (document ? 'half_life')
  ),
  -- Una ranura sin fijar no puede llevar valor: así ninguna salida puede consumirla.
  constraint engine_config_unset_slots_have_no_value check (
    not (document ? 'mastery_sufficiency') and not (document ? 'review_intervals')
  ),
  constraint engine_config_declares_unset_slots check (
    document -> 'unset_policy_slots' @> '["mastery_sufficiency", "review_intervals"]'::jsonb
  ),
  constraint engine_config_promotion_pair check ((promoted_at is null) = (promoted_by is null)),
  constraint engine_config_promotion_evidence check (
    (status = 'DRAFT' and promoted_at is null) or (status <> 'DRAFT' and promoted_at is not null
      and promotion_evidence is not null)
  ),
  constraint engine_config_superseded_consistency check (
    (status = 'SUPERSEDED') = (superseded_at is not null)
  )
);
comment on table engine.engine_config is
  'SD-013 · ADR-003 v1.2 punto 5 · configuración versionada del motor. Una versión publicada '
  'no se edita: cambiarla es publicar otra. v1 contiene cero parámetros numéricos de '
  'aprendizaje, y sus dos ranuras de política quedan explícitamente sin fijar.';
create unique index if not exists engine_config_one_active
  on engine.engine_config (status) where status = 'ACTIVE';

create or replace function engine.reject_config_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'DRAFT' then return old; end if;
    raise exception 'SD-013 · una versión publicada de engine_config no se borra'
      using errcode = 'restrict_violation';
  end if;
  if old.status <> 'DRAFT' then
    -- Publicada: solo se admite retirarla, y sin tocar su contenido.
    if new.document is distinct from old.document
       or new.version is distinct from old.version
       or new.author is distinct from old.author
       or new.reason is distinct from old.reason
       or new.created_at is distinct from old.created_at
       or new.promoted_at is distinct from old.promoted_at
       or new.promoted_by is distinct from old.promoted_by
       or new.promotion_evidence is distinct from old.promotion_evidence then
      raise exception 'SD-013 · una versión publicada de engine_config es inmutable: publica otra'
        using errcode = 'restrict_violation';
    end if;
    if not (old.status = 'ACTIVE' and new.status = 'SUPERSEDED') then
      raise exception 'SD-013 · una versión publicada solo pasa de ACTIVE a SUPERSEDED'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function engine.reject_config_mutation() from public, anon, authenticated, service_role;
drop trigger if exists engine_config_immutable on engine.engine_config;
create trigger engine_config_immutable
  before update or delete on engine.engine_config
  for each row execute function engine.reject_config_mutation();

alter table engine.engine_config enable row level security;
alter table engine.engine_config force row level security;
revoke all on engine.engine_config from public, anon, authenticated;
grant select on engine.engine_config to service_role;

-- concept_mastery ---------------------------------------------------------------------
create table if not exists engine.concept_mastery (
  user_id uuid not null references public.profiles (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  mastery_state engine.mastery_state not null,
  uncertainty engine.uncertainty not null,
  vector jsonb not null,
  next_review_at timestamptz,
  engine_version text not null,
  engine_config_version text not null references engine.engine_config (version),
  attribution_pack_version_id uuid not null references public.exam_pack_versions (id),
  attribution_generation bigint not null,
  event_watermark bigint not null,
  calculated_at timestamptz not null default now(),
  primary key (user_id, concept_id),
  constraint concept_mastery_vector_object check (jsonb_typeof(vector) = 'object'),
  -- El vector declara exactamente los campos aprobados por el contrato §5.2.
  constraint concept_mastery_vector_shape check (
    vector ?& array[
      'eligibleAttemptCount', 'distinctQuestionCount', 'distinctRepresentationCount',
      'distinctSessionCount', 'correctCount', 'incorrectCount', 'blankCount',
      'distinctQuestionsEverCorrect', 'distinctQuestionsEverIncorrect',
      'distinctQuestionsLatestCorrect', 'distinctQuestionsLatestIncorrect',
      'confidenceCells', 'unratedCount', 'firstEvidenceAt', 'latestEvidenceAt',
      'temporalAnomalyCount', 'exposureViewedCount', 'exposureCompletedCount'
    ]
  ),
  -- Ninguna puntuación, ni con otro nombre (contrato §10 · H-P3-8).
  constraint concept_mastery_no_score check (
    not (vector ? 'masteryScore') and not (vector ? 'stabilityScore')
    and not (vector ? 'score') and not (vector ? 'readiness')
  ),
  -- `review_intervals` está sin fijar: no se programa ningún repaso (contrato §8).
  constraint concept_mastery_no_review_scheduled check (next_review_at is null),
  constraint concept_mastery_watermark_positive check (event_watermark >= 0),
  constraint concept_mastery_generation_positive check (attribution_generation >= 1)
);
comment on table engine.concept_mastery is
  'REQ-D01 · contrato §5 y §9 · proyección autoritativa por (aprendiz, concepto): vector de '
  'evidencia observada y estado categórico derivado. Reconstruible; nunca se corrige editando '
  'evidencia. No existe ninguna puntuación numérica de dominio.';
create index if not exists concept_mastery_user_state on engine.concept_mastery (user_id, mastery_state);
alter table engine.concept_mastery enable row level security;
alter table engine.concept_mastery force row level security;
revoke all on engine.concept_mastery from public, anon, authenticated;
grant select on engine.concept_mastery to service_role;

-- mastery_history ---------------------------------------------------------------------
create table if not exists engine.mastery_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason engine.projection_reason not null,
  reason_json jsonb not null,
  from_position bigint not null,
  to_position bigint not null,
  engine_version text not null,
  engine_config_version text not null,
  attribution_pack_version_id uuid not null,
  attribution_generation bigint not null,
  created_at timestamptz not null default now(),
  constraint mastery_history_reason_object check (jsonb_typeof(reason_json) = 'object'),
  constraint mastery_history_positions check (to_position >= from_position and from_position >= 0),
  constraint mastery_history_reason_shape check (
    reason_json ?& array[
      'vectorBefore', 'vectorAfter', 'consumedPositions', 'attemptsFolded',
      'unattributedSkipped', 'diagnosticSkipped'
    ]
  )
);
comment on table engine.mastery_history is
  'Contrato §20 · auditoría append-only de cada ejecución: qué evidencia entró, cuál no y por '
  'qué, con qué versión de motor, de configuración y de atribución. Registra **ejecuciones**: '
  'un rebuild es una ejecución distinta de la serie de incrementos que llega al mismo '
  'watermark, y por eso el gate de EC-006 compara proyección, no historial.';
create index if not exists mastery_history_user_time on engine.mastery_history (user_id, created_at);
alter table engine.mastery_history enable row level security;
alter table engine.mastery_history force row level security;
revoke all on engine.mastery_history from public, anon, authenticated;
grant select on engine.mastery_history to service_role;

create or replace function engine.reject_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'EC-005 · el historial del motor no se edita' using errcode = 'restrict_violation';
  end if;
  if exists (select 1 from public.profiles p where p.id = old.user_id) then
    raise exception 'EC-005 · el historial del motor no se borra mientras exista el aprendiz'
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;
revoke all on function engine.reject_history_mutation() from public, anon, authenticated, service_role;
drop trigger if exists mastery_history_append_only on engine.mastery_history;
create trigger mastery_history_append_only
  before update or delete on engine.mastery_history
  for each row execute function engine.reject_history_mutation();

-- error_patterns ----------------------------------------------------------------------
create table if not exists engine.error_patterns (
  user_id uuid not null references public.profiles (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  pattern_type engine.error_pattern_type not null,
  status text not null default 'ACTIVE',
  evidence_count integer not null,
  engine_version text not null,
  engine_config_version text not null,
  attribution_generation bigint not null,
  calculated_at timestamptz not null default now(),
  primary key (user_id, concept_id, pattern_type),
  -- `RESOLVED` queda reservado y **no alcanzable** en v1: la resolución se expresa por
  -- ausencia de la fila, porque persistirla haría la proyección dependiente del camino y
  -- rompería EC-006.
  constraint error_patterns_status check (status in ('ACTIVE', 'RESOLVED')),
  constraint error_patterns_v1_only_active check (status = 'ACTIVE'),
  constraint error_patterns_evidence_count check (evidence_count >= 3)
);
comment on table engine.error_patterns is
  'REQ-D06 · contrato §17 · patrones estructurales activos, derivados del mismo pliegue que el '
  'vector. Tres tipos, sin ninguna clasificación semántica de concepciones erróneas. El '
  'recuento 3 procede de spec/acceptance-matrix.md §D (REQ-D06) y es una regla de producto, '
  'no una constante científica.';
alter table engine.error_patterns enable row level security;
alter table engine.error_patterns force row level security;
revoke all on engine.error_patterns from public, anon, authenticated;
grant select on engine.error_patterns to service_role;

-- projection_watermarks ----------------------------------------------------------------
create table if not exists engine.projection_watermarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  projection_name text not null,
  consumed_position bigint not null default 0,
  engine_version text,
  engine_config_version text,
  attribution_pack_version_id uuid,
  attribution_generation bigint,
  unattributed_attempt_count integer not null default 0,
  diagnostic_attempt_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, projection_name),
  constraint projection_watermarks_position check (consumed_position >= 0),
  constraint projection_watermarks_name_format check (projection_name ~ '^[a-z][a-z0-9_]{2,40}$')
);
comment on table engine.projection_watermarks is
  'ADR-008 punto 10 · anexo de reconciliación · **progreso del consumidor**: hasta qué '
  'posición del stream de un usuario ha consumido una proyección. Distinto de '
  'concept_mastery.event_watermark, que es la procedencia del cálculo de esa fila. Guarda '
  'además la tupla semántica declarada: si cambia, la continuación incremental deja de ser '
  'legítima. `projection_name` identifica la proyección, no la tabla.';
alter table engine.projection_watermarks enable row level security;
alter table engine.projection_watermarks force row level security;
revoke all on engine.projection_watermarks from public, anon, authenticated;
grant select on engine.projection_watermarks to service_role;

-- Detección de proyección atrasada -----------------------------------------------------
--
-- Solo desde evidencia canónica y watermark: sin esto, una invocación perdida sería
-- indetectable y la recuperación dependería de que alguien se acordara.
create or replace function engine.stale_users(p_projection text, p_limit integer default 100)
returns table (user_id uuid, max_position bigint, consumed_position bigint, reason text)
language sql
security definer
set search_path = ''
stable
as $$
  -- Atrasada: hay evidencia por delante del progreso del consumidor.
  select e.user_id,
         max(e.stream_position) as max_position,
         coalesce(w.consumed_position, 0) as consumed_position,
         'BEHIND'::text as reason
  from public.learning_events e
  left join engine.projection_watermarks w
    on w.user_id = e.user_id and w.projection_name = p_projection
  group by e.user_id, w.consumed_position
  having max(e.stream_position) > coalesce(w.consumed_position, 0)
  union
  -- Incoherente: hay filas de proyección que no proceden del punto que el watermark declara.
  -- Sin esta rama, una proyección escrita por algo que no fuera una ejecución fiel del motor
  -- sería indistinguible de una al día, y «detectable mecánicamente» dejaría de ser cierto.
  select w.user_id,
         coalesce((select max(e2.stream_position) from public.learning_events e2
                   where e2.user_id = w.user_id), 0) as max_position,
         w.consumed_position,
         'INCOHERENT'::text as reason
  from engine.projection_watermarks w
  where w.projection_name = p_projection
    and exists (
      select 1 from engine.concept_mastery m
      where m.user_id = w.user_id
        and (m.event_watermark is distinct from w.consumed_position
             or w.consumed_position = 0)
    )
  order by 1
  limit p_limit;
$$;
comment on function engine.stale_users(text, integer) is
  'Contrato §14 · §18 de la autorización de BUILD · detecta proyecciones que no están al día: '
  'las **atrasadas**, con evidencia por delante del consumidor, y las **incoherentes**, cuyas '
  'filas no proceden del punto que el watermark declara. Es la prueba de que una invocación '
  'perdida —o una escritura que no fue una ejecución fiel— es recuperable sin intervención '
  'humana.';
revoke all on function engine.stale_users(text, integer) from public, anon, authenticated;
grant execute on function engine.stale_users(text, integer) to service_role;

-- Lectura de la evidencia de un aprendiz ---------------------------------------------------
--
-- Una sola función, y por una razón de seguridad además de eficiencia: si el motor leyera la
-- evidencia con consultas sueltas filtrando por `user_id`, la aplicación estaría decidiendo a
-- quién pertenece qué a partir de una variable, que es exactamente lo que Manifest §14 y la
-- guarda de autoridad prohíben. Aquí la pertenencia la resuelve el servidor, en un esquema no
-- expuesto y sin ningún grant de cliente.
create or replace function engine.evidence_snapshot(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'accountCreatedAt', (select p.created_at from public.profiles p where p.id = p_user_id),
    'maxPosition', coalesce(
      (select max(e.stream_position) from public.learning_events e where e.user_id = p_user_id), 0),
    'packVersionId', (
      select v.id
      from public.learner_exam_goals g
      join public.exam_pack_versions v on v.exam_pack_id = g.exam_pack_id
      where g.user_id = p_user_id and g.status = 'ACTIVE' and v.status = 'PUBLISHED'
      order by v.created_at desc
      limit 1
    ),
    'watermark', (
      select jsonb_build_object(
        'consumedPosition', w.consumed_position,
        'engineVersion', w.engine_version,
        'engineConfigVersion', w.engine_config_version,
        'attributionPackVersionId', w.attribution_pack_version_id,
        'attributionGeneration', w.attribution_generation,
        -- Coherencia: toda fila de proyección procede del punto que el watermark declara.
        -- Si no, la proyección no es una función de la evidencia y hay que rehacerla.
        'projectionCoherent', not exists (
          select 1 from engine.concept_mastery m
          where m.user_id = p_user_id
            and (m.event_watermark is distinct from w.consumed_position
                 or w.consumed_position = 0)
        )
      )
      from engine.projection_watermarks w
      where w.user_id = p_user_id and w.projection_name = 'concept_mastery'
    ),
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attemptId', a.id,
        'questionId', a.question_id,
        'representationId', a.question_representation_id,
        'sessionId', a.session_id,
        'diagnosticRunId', a.diagnostic_run_id,
        'streamPosition', e.stream_position,
        'isCorrect', a.is_correct_at_submission,
        'answerKind', a.answer_kind,
        'confidenceValue', a.confidence_value,
        'clientCreatedAt', e.client_created_at,
        'serverReceivedAt', e.server_received_at
      ) order by e.stream_position)
      from public.question_attempts a
      join public.learning_events e on e.event_id = a.submitted_event_id
      where a.user_id = p_user_id
    ), '[]'::jsonb),
    'exposures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conceptId', u.concept_id,
        'eventType', e.event_type,
        'streamPosition', e.stream_position
      ) order by e.stream_position)
      from public.learning_events e
      join public.session_items i on i.id = e.session_item_id
      join public.learning_units u on u.id = i.learning_unit_id
      where e.user_id = p_user_id
        and e.event_type in ('LEARNING_UNIT_VIEWED', 'LEARNING_UNIT_COMPLETED')
    ), '[]'::jsonb)
  );
$$;
comment on function engine.evidence_snapshot(uuid) is
  'Contrato §5.1 · toda la evidencia de un aprendiz y su semántica declarada en una sola '
  'lectura consistente. La pertenencia la decide el servidor, nunca un filtro de aplicación.';
revoke all on function engine.evidence_snapshot(uuid) from public, anon, authenticated;
grant execute on function engine.evidence_snapshot(uuid) to service_role;

-- Persistencia atómica del resultado del motor -------------------------------------------
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
             'uncertainty', m.uncertainty, 'vector', m.vector) as x
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
    engine_version, engine_config_version, attribution_pack_version_id,
    attribution_generation, event_watermark, calculated_at
  )
  select
    p_user_id,
    (c ->> 'conceptId')::uuid,
    (c ->> 'masteryState')::engine.mastery_state,
    (c ->> 'uncertainty')::engine.uncertainty,
    c -> 'vector',
    null,
    v_engine_version, v_config_version, v_pack_version, v_generation, v_to_position, now()
  from jsonb_array_elements(p_payload -> 'concepts') c
  on conflict (user_id, concept_id) do update set
    mastery_state = excluded.mastery_state,
    uncertainty = excluded.uncertainty,
    vector = excluded.vector,
    next_review_at = null,
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
             'uncertainty', m.uncertainty, 'vector', m.vector) as x
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

-- RPC reservadas del motor (authority-registry.json) ---------------------------------------
create or replace function engine.recalculate_mastery(
  p_user_id uuid, p_from_position bigint, p_payload jsonb, p_reason engine.projection_reason
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select engine.apply_projection(p_user_id, p_payload, p_reason, p_from_position, false);
$$;
comment on function engine.recalculate_mastery(uuid, bigint, jsonb, engine.projection_reason) is
  'EC-002 · aplicación incremental. Exige que el watermark siga donde el motor lo leyó: una '
  'mutación de atribución no puede colarse como continuación ordinaria.';
revoke all on function engine.recalculate_mastery(uuid, bigint, jsonb, engine.projection_reason)
  from public, anon, authenticated;
grant execute on function engine.recalculate_mastery(uuid, bigint, jsonb, engine.projection_reason)
  to service_role;

create or replace function engine.rebuild_projections(
  p_user_id uuid, p_payload jsonb, p_reason engine.projection_reason
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select engine.apply_projection(p_user_id, p_payload, p_reason, null, true);
$$;
comment on function engine.rebuild_projections(uuid, jsonb, engine.projection_reason) is
  'EC-006 · reconstrucción total desde la evidencia. Reemplaza la proyección entera del '
  'aprendiz y deja registro del motivo.';
revoke all on function engine.rebuild_projections(uuid, jsonb, engine.projection_reason)
  from public, anon, authenticated;
grant execute on function engine.rebuild_projections(uuid, jsonb, engine.projection_reason)
  to service_role;

create or replace function engine.promote_engine_config(
  p_version text, p_approved_by text, p_evidence jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status engine.config_status;
begin
  if p_approved_by is null or p_evidence is null then
    raise exception 'SD-013 · la promoción exige aprobación registrada y evidencia'
      using errcode = 'null_value_not_allowed';
  end if;

  select c.status into v_status from engine.engine_config c where c.version = p_version for update;
  if not found then
    raise exception 'SD-013 · la versión % no existe', p_version using errcode = 'no_data_found';
  end if;
  if v_status <> 'DRAFT' then
    raise exception 'SD-013 · solo se promociona una versión DRAFT; % está en %', p_version, v_status
      using errcode = 'check_violation';
  end if;

  update engine.engine_config
     set status = 'SUPERSEDED', superseded_at = now()
   where status = 'ACTIVE';

  update engine.engine_config
     set status = 'ACTIVE', promoted_at = now(), promoted_by = p_approved_by,
         promotion_evidence = p_evidence
   where version = p_version;

  return p_version;
end;
$$;
comment on function engine.promote_engine_config(text, text, jsonb) is
  'SD-013 · ADR-003 v1.2 punto 5 · promoción explícita y registrada: DRAFT → ACTIVE con '
  'aprobación y evidencia. Nunca se edita el valor activo en caliente.';
revoke all on function engine.promote_engine_config(text, text, jsonb) from public, anon, authenticated;
grant execute on function engine.promote_engine_config(text, text, jsonb) to service_role;

-- Configuración v1 · nace DRAFT y se promociona por el paso gobernado ----------------------
insert into engine.engine_config (version, status, document, author, reason)
select 'v1', 'DRAFT',
  jsonb_build_object(
    'algorithm_id', 'concept-evidence',
    'algorithm_version', '1.0.0',
    'active_dimensions', jsonb_build_array('accuracy_observations', 'confidence_calibration_observations'),
    'inactive_dimensions', jsonb_build_object(
      'retention', 'sin modelo temporal gobernado',
      'transfer', 'sin contrato semántico ni parámetro de dificultad en ninguna tabla',
      'stability', 'definición canónica sí, contrato de evidencia de «separadas en el tiempo» no',
      'speed', 'sin datos: response_ms es opcional en el esquema y ninguna ruta lo envía'
    ),
    'unset_policy_slots', jsonb_build_array('mastery_sufficiency', 'review_intervals'),
    'error_pattern_taxonomy', jsonb_build_object(
      'types', jsonb_build_array('RECURRENT_INCORRECT', 'RECURRENT_BLANK', 'MAX_CONFIDENCE_INCORRECT'),
      'recurrence', 3,
      'recurrence_authority', 'spec/acceptance-matrix.md §D · REQ-D06 · regla de producto, no constante científica'
    )
  ),
  'phase-3-build-authorization',
  'Learning Engine Contract v1.0: vector de evidencia, sin puntuacion numerica ni pesos'
where not exists (select 1 from engine.engine_config where version = 'v1');

select engine.promote_engine_config(
  'v1',
  'phase-3-build-authorization',
  jsonb_build_object(
    'decision_record', 'docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md',
    'contract', 'docs/LEARNING_ENGINE_CONTRACT.md v1.0',
    'golden_dataset', 'tests/unit/engine.deterministic.golden.spec.ts'
  )
)
where exists (select 1 from engine.engine_config where version = 'v1' and status = 'DRAFT');
