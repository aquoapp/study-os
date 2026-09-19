-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 23 · Planner Domain / Decision Engine (Phase 4A)
--
-- `docs/PLANNER_CONTRACT.md` v1.4 `ACCEPTED` · ADR-012 (anexos v1.1 … v1.4) · P4-D1, P4-D3,
-- P4-D4, P4-D5, P4-D6 `ACCEPTED` · P4-D2 **diferida** · CDEM §3 (`profiles.timezone`) ·
-- INV-101, INV-106, INV-109, INV-113, INV-116 · EC-003, EC-009.
--
-- Lo que esta migración materializa:
--
--   - `profiles.timezone`         · la zona horaria **declarada** por la persona (CDEM §3). Sin
--                                   ella no existe «hoy» (§I.1). Nula mientras no se declare:
--                                   nunca se deduce del servidor, de la IP ni del navegador, y
--                                   nunca se rellena con UTC.
--   - `planner_config`            · política de producto versionada, con promoción humana (§T).
--                                   Una lista blanca de claves impide pesos, ratios, cuotas,
--                                   umbrales y duraciones.
--   - `planner_runs`              · registro de decisión append-only (§Q). Cadena por objetivo:
--                                   cada ejecución sustituye a la anterior, nunca la edita.
--   - `planner_items`             · pasos inmutables, exactamente un destino tipado y la versión
--                                   de contenido fijada (P4-G6).
--   - `planner_run_audit`         · instantánea canónica de entrada y de decisión (§R, §S). Sin
--                                   ninguna concesión a roles de cliente: contiene estados del
--                                   motor.
--   - `study_sessions`            · `planner_run_id` pasa a referenciar una ejecución real
--                                   (`ON DELETE RESTRICT`, §V), una sesión por ejecución y **una
--                                   sola sesión abierta por persona** (§U.1, P4-G10).
--   - funciones de servidor       · lectura de contexto, lectura del motor, persistencia con
--                                   revalidación en la misma transacción (§U.1) y arranque de
--                                   sesión planificada idempotente por ejecución (§U.6).
--                                   **Solo rol de servicio**: un plan es una decisión que el
--                                   cliente no puede redactar (§U.4). La superficie invocable por
--                                   cliente sigue siendo exactamente dos RPC.
--
-- Lo que **no** materializa, y no por olvido: ninguna duración ni metadato de duración (P4-D2,
-- §I.3); ningún almacenamiento del override del día (4B); ningún esquema privado nuevo (§U.8);
-- ningún evento de Planner (`TODAY_OVERRIDE_SET` y los demás siguen sin contrato de campos,
-- P4-G17); ningún número salvo posiciones y minutos (§Y).
--
-- Rollback: supabase/migrations/down/00000000000023_planner_domain.down.sql
-- ---------------------------------------------------------------------------

-- 1 · Zona horaria declarada ----------------------------------------------------------------

alter table public.profiles add column if not exists timezone text;
comment on column public.profiles.timezone is
  'CDEM §3 · zona horaria IANA declarada por la persona. Nula = no declarada: el Planner no '
  'planifica y no la deduce. Nunca se rellena por defecto.';

create or replace function public.timezone_is_declarable(p_timezone text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_timezone is not null
     and p_timezone ~ '^(UTC|[A-Z][A-Za-z_]+(/[A-Za-z0-9_+-]+)+)$'
     and exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p_timezone);
$$;
comment on function public.timezone_is_declarable(text) is
  'Phase 4A · un nombre IANA de zona que la base conoce. Sin abreviaturas ni desplazamientos '
  'sueltos: una zona declarada tiene que poder resolver «hoy» sin ambigüedad.';
revoke all on function public.timezone_is_declarable(text) from public, anon, authenticated, service_role;

create or replace function public.check_profile_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.timezone is not null and not public.timezone_is_declarable(new.timezone) then
    raise exception 'STUDY_OS_PROFILE · TIMEZONE_NOT_IANA' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.check_profile_timezone() from public, anon, authenticated, service_role;
drop trigger if exists profiles_timezone_declared on public.profiles;
create trigger profiles_timezone_declared
  before insert or update of timezone on public.profiles
  for each row execute function public.check_profile_timezone();

-- La persona declara su propia zona (CDEM §3 «user reads/updates own row»). La política de
-- actualización ya limita la fila a la propia.
grant update (timezone) on public.profiles to authenticated;

-- 2 · planner_config ------------------------------------------------------------------------

create table if not exists public.planner_config (
  version text primary key,
  status text not null default 'DRAFT',
  document jsonb not null,
  author text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  promoted_at timestamptz,
  promoted_by text,
  promotion_evidence jsonb,
  superseded_at timestamptz,
  constraint planner_config_version_format check (version ~ '^v[0-9]{1,3}$'),
  constraint planner_config_status check (status in ('DRAFT', 'ACTIVE', 'SUPERSEDED')),
  constraint planner_config_document_object check (jsonb_typeof(document) = 'object'),
  -- §T · lista blanca: solo vocabularios cerrados y la política de día de plan. Cualquier otra
  -- clave —un peso, un ratio, una cuota, un umbral, una duración— es rechazada por construcción.
  constraint planner_config_document_whitelist check (
    (document - array['outcomes', 'composition_reasons', 'exclusion_reasons', 'plan_day_policy'])
      = '{}'::jsonb
  ),
  constraint planner_config_document_complete check (
    document ?& array['outcomes', 'composition_reasons', 'exclusion_reasons', 'plan_day_policy']
    and jsonb_typeof(document -> 'outcomes') = 'array'
    and jsonb_typeof(document -> 'composition_reasons') = 'array'
    and jsonb_typeof(document -> 'exclusion_reasons') = 'array'
    and document ->> 'plan_day_policy' = 'LEARNER_DECLARED_TIMEZONE'
  ),
  constraint planner_config_author_format check (author ~ '^[A-Za-z0-9_.:-]{2,80}$'),
  constraint planner_config_reason_length check (char_length(reason) between 3 and 500),
  constraint planner_config_promotion_pair check ((promoted_at is null) = (promoted_by is null)),
  constraint planner_config_promotion_evidence check (
    (status = 'DRAFT' and promoted_at is null)
    or (status <> 'DRAFT' and promoted_at is not null and promotion_evidence is not null)
  ),
  constraint planner_config_superseded_consistency check (
    (status = 'SUPERSEDED') = (superseded_at is not null)
  )
);
comment on table public.planner_config is
  'Planner Contract §T · política de producto versionada y promovida por decisión humana: los '
  'vocabularios cerrados de razones y la política de día de plan. Ningún parámetro de ciencia '
  'del aprendizaje, ninguna duración, ningún peso.';
create unique index if not exists planner_config_one_active
  on public.planner_config (status) where status = 'ACTIVE';

create or replace function public.reject_planner_config_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'DRAFT' then return old; end if;
    raise exception 'Planner §T · una versión publicada de planner_config no se borra'
      using errcode = 'restrict_violation';
  end if;
  if old.status <> 'DRAFT' then
    if new.document is distinct from old.document
       or new.version is distinct from old.version
       or new.author is distinct from old.author
       or new.reason is distinct from old.reason
       or new.created_at is distinct from old.created_at
       or new.promoted_at is distinct from old.promoted_at
       or new.promoted_by is distinct from old.promoted_by
       or new.promotion_evidence is distinct from old.promotion_evidence then
      raise exception 'Planner §T · una versión publicada de planner_config es inmutable: publica otra'
        using errcode = 'restrict_violation';
    end if;
    if new.status is distinct from old.status
       and not (old.status = 'ACTIVE' and new.status = 'SUPERSEDED') then
      raise exception 'Planner §T · una versión publicada solo pasa de ACTIVE a SUPERSEDED'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.reject_planner_config_mutation() from public, anon, authenticated, service_role;
drop trigger if exists planner_config_immutable on public.planner_config;
create trigger planner_config_immutable
  before update or delete on public.planner_config
  for each row execute function public.reject_planner_config_mutation();

alter table public.planner_config enable row level security;
alter table public.planner_config force row level security;
revoke all on public.planner_config from public, anon, authenticated, service_role;
grant select on public.planner_config to service_role;

insert into public.planner_config (
  version, status, document, author, reason, promoted_at, promoted_by, promotion_evidence
)
select 'v1', 'ACTIVE',
  jsonb_build_object(
    'outcomes', jsonb_build_array('PLANNED', 'NOTHING_FITS', 'NOTHING_ELIGIBLE', 'ZERO_TIME'),
    'composition_reasons',
      jsonb_build_array('REMEDIATION_GUARANTEE', 'COVERAGE', 'REMEDIATION_OVERFLOW'),
    'exclusion_reasons', jsonb_build_array(
      'TARGET_RETIRED', 'NO_ATTRIBUTED_QUESTION', 'NO_PUBLISHED_UNIT', 'SOURCE_STATUS_EXCLUDED',
      'COMPLETED_TODAY', 'POSITIVE_NO_REVIEW_POLICY', 'OVER_BUDGET'
    ),
    'plan_day_policy', 'LEARNER_DECLARED_TIMEZONE'
  ),
  'phase-4a-build-authorization',
  'Planner Contract v1.4: vocabularios cerrados y dia de plan en la zona declarada',
  now(),
  'phase-4a-build-authorization',
  jsonb_build_object(
    'contract', 'docs/PLANNER_CONTRACT.md v1.4',
    'adr', 'ADR-012',
    'decisions', jsonb_build_array('P4-D1', 'P4-D3', 'P4-D4', 'P4-D5', 'P4-D6'),
    'pending_ratification', jsonb_build_array('NO_PUBLISHED_UNIT')
  )
where not exists (select 1 from public.planner_config where version = 'v1');

-- 3 · planner_runs --------------------------------------------------------------------------

create table if not exists public.planner_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  learner_exam_goal_id uuid not null,
  exam_pack_version_id uuid not null references public.exam_pack_versions (id),
  plan_day date not null,
  timezone text not null,
  outcome text not null,
  budget_minutes smallint not null,
  budget_source text not null,
  planned_minutes smallint not null,
  item_count integer not null,
  planner_version text not null,
  planner_config_version text not null references public.planner_config (version),
  engine_version text not null,
  engine_config_version text not null,
  attribution_pack_version_id uuid not null,
  attribution_generation bigint not null,
  consumed_position bigint not null,
  duration_provenance text not null,
  input_hash text not null,
  supersedes_run_id uuid,
  created_at timestamptz not null default now(),
  constraint planner_runs_id_user_unique unique (id, user_id),
  constraint planner_runs_goal_fk
    foreign key (learner_exam_goal_id, user_id)
    references public.learner_exam_goals (id, user_id) on delete cascade,
  constraint planner_runs_supersedes_fk
    foreign key (supersedes_run_id, user_id) references public.planner_runs (id, user_id),
  constraint planner_runs_not_self check (supersedes_run_id is distinct from id),
  constraint planner_runs_outcome check (
    outcome in ('PLANNED', 'NOTHING_FITS', 'NOTHING_ELIGIBLE', 'ZERO_TIME')
  ),
  constraint planner_runs_budget_range check (budget_minutes between 0 and 600),
  -- El override del día no tiene almacenamiento en 4A: ninguna ejecución puede declararlo.
  constraint planner_runs_budget_source check (budget_source in ('WEEKLY_ENTRY', 'DEFAULT_DAILY')),
  constraint planner_runs_fits_budget check (
    planned_minutes >= 0 and planned_minutes <= budget_minutes
  ),
  constraint planner_runs_outcome_coherent check (
    ((outcome = 'PLANNED') = (item_count > 0))
    and ((outcome = 'PLANNED') = (planned_minutes > 0))
    and ((outcome = 'ZERO_TIME') = (budget_minutes = 0))
  ),
  constraint planner_runs_item_count check (item_count between 0 and 200),
  constraint planner_runs_version_format check (planner_version ~ '^planner-v[0-9]{1,3}$'),
  constraint planner_runs_generation check (attribution_generation >= 1),
  constraint planner_runs_consumed check (consumed_position >= 0),
  -- P4-D2 diferida: ninguna duración de producción existe. Solo fixtures.
  constraint planner_runs_duration_provenance check (duration_provenance = 'FIXTURE'),
  constraint planner_runs_hash_format check (input_hash ~ '^[0-9a-f]{64}$'),
  -- La zona se validó contra el catálogo al declararla; aquí basta la forma, sin depender de
  -- una función estable en un CHECK.
  constraint planner_runs_timezone_format check (
    timezone ~ '^(UTC|[A-Z][A-Za-z_]+(/[A-Za-z0-9_+-]+)+)$'
  )
);
comment on table public.planner_runs is
  'Planner Contract §Q · registro histórico de decisión, append-only. Un plan es un registro de '
  'decisión, no evidencia de ejecución. «El plan actual» es la última ejecución del objetivo sin '
  'sucesora.';
-- La cadena por objetivo es lineal: una sola raíz y un solo sucesor por ejecución. Dos peticiones
-- simultáneas no pueden producir dos ejecuciones actuales (§U.1).
create unique index if not exists planner_runs_one_root_per_goal
  on public.planner_runs (learner_exam_goal_id) where supersedes_run_id is null;
create unique index if not exists planner_runs_one_successor
  on public.planner_runs (supersedes_run_id) where supersedes_run_id is not null;
-- §U.1 · idempotencia por (persona, día de plan, hash de entrada), dentro de la misma posición
-- de la cadena.
create unique index if not exists planner_runs_idempotency
  on public.planner_runs (user_id, plan_day, input_hash, supersedes_run_id) nulls not distinct;
create index if not exists planner_runs_user_day on public.planner_runs (user_id, plan_day);

create or replace function public.reject_planner_history_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Planner §Q · %.% es historia inmutable', tg_table_schema, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;
revoke all on function public.reject_planner_history_update() from public, anon, authenticated, service_role;

drop trigger if exists planner_runs_append_only on public.planner_runs;
create trigger planner_runs_append_only
  before update on public.planner_runs
  for each row execute function public.reject_planner_history_update();
drop trigger if exists planner_runs_no_delete on public.planner_runs;
create trigger planner_runs_no_delete
  before delete on public.planner_runs
  for each row execute function public.reject_delete_while_account_exists();

alter table public.planner_runs enable row level security;
alter table public.planner_runs force row level security;
revoke all on public.planner_runs from public, anon, authenticated, service_role;
drop policy if exists planner_runs_select_own on public.planner_runs;
create policy planner_runs_select_own
  on public.planner_runs for select to authenticated
  using (user_id = (select auth.uid()));
-- §U.5 · la persona lee sus ejecuciones, solo en columnas seguras: ni versiones, ni tupla del
-- motor, ni hash.
grant select (
  id, learner_exam_goal_id, plan_day, outcome, budget_minutes, planned_minutes, item_count,
  supersedes_run_id, created_at
) on public.planner_runs to authenticated;
grant select on public.planner_runs to service_role;

-- 4 · planner_items -------------------------------------------------------------------------

create table if not exists public.planner_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  position integer not null,
  action_ordinal integer not null,
  action_kind text not null,
  step text not null,
  composition_reason text not null,
  concept_id uuid not null references public.concepts (id) on delete restrict,
  item_type public.session_item_type not null,
  learning_unit_id uuid references public.learning_units (id) on delete restrict,
  learning_unit_version_id uuid,
  question_id uuid references public.canonical_questions (id) on delete restrict,
  question_representation_id uuid,
  planned_minutes integer not null,
  created_at timestamptz not null default now(),
  constraint planner_items_run_fk
    foreign key (run_id, user_id) references public.planner_runs (id, user_id) on delete cascade,
  constraint planner_items_position_unique unique (run_id, position),
  constraint planner_items_position_positive check (position >= 1 and action_ordinal >= 1),
  constraint planner_items_action_kind check (action_kind in ('LEARN', 'CHECK', 'RELEARN_CHECK')),
  constraint planner_items_step check (
    (action_kind = 'LEARN' and step = 'LEARN')
    or (action_kind = 'CHECK' and step = 'CHECK')
    or (action_kind = 'RELEARN_CHECK' and step in ('LEARN', 'CHECK'))
  ),
  constraint planner_items_reason check (
    composition_reason in ('REMEDIATION_GUARANTEE', 'COVERAGE', 'REMEDIATION_OVERFLOW')
  ),
  constraint planner_items_reason_matches_kind check (
    (action_kind = 'RELEARN_CHECK') = (composition_reason <> 'COVERAGE')
  ),
  -- P4-G6 · ADR-007 · exactamente un destino tipado, coherente con el paso, con versión fijada.
  constraint planner_items_exactly_one_target check (
    (item_type = 'LEARNING_UNIT' and step = 'LEARN'
      and learning_unit_id is not null and learning_unit_version_id is not null
      and question_id is null and question_representation_id is null)
    or (item_type = 'QUESTION' and step = 'CHECK'
      and question_id is not null and question_representation_id is not null
      and learning_unit_id is null and learning_unit_version_id is null)
  ),
  constraint planner_items_unit_version_fk
    foreign key (learning_unit_version_id, learning_unit_id)
    references public.learning_unit_versions (id, learning_unit_id) on delete restrict,
  constraint planner_items_representation_fk
    foreign key (question_representation_id, question_id)
    references public.question_representations (id, question_id) on delete restrict,
  constraint planner_items_minutes check (planned_minutes between 1 and 600)
);
comment on table public.planner_items is
  'Planner Contract §Q · pasos inmutables de una ejecución. El progreso vive en session_items, '
  'nunca aquí.';

drop trigger if exists planner_items_immutable on public.planner_items;
create trigger planner_items_immutable
  before update on public.planner_items
  for each row execute function public.reject_planner_history_update();
drop trigger if exists planner_items_no_delete on public.planner_items;
create trigger planner_items_no_delete
  before delete on public.planner_items
  for each row execute function public.reject_delete_while_account_exists();

alter table public.planner_items enable row level security;
alter table public.planner_items force row level security;
revoke all on public.planner_items from public, anon, authenticated, service_role;
drop policy if exists planner_items_select_own on public.planner_items;
create policy planner_items_select_own
  on public.planner_items for select to authenticated
  using (user_id = (select auth.uid()));
-- §R · los códigos de razón no se exponen: la redacción visible es de Phase 5.
grant select (
  id, run_id, position, item_type, learning_unit_id, question_id, planned_minutes, created_at
) on public.planner_items to authenticated;
grant select on public.planner_items to service_role;

-- 5 · planner_run_audit ---------------------------------------------------------------------

create table if not exists public.planner_run_audit (
  run_id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  input_canonical text not null,
  decision_canonical text not null,
  input_hash text not null,
  created_at timestamptz not null default now(),
  constraint planner_run_audit_run_fk
    foreign key (run_id, user_id) references public.planner_runs (id, user_id) on delete cascade,
  -- La base recalcula el hash sobre el texto guardado: la instantánea no puede mentir sobre sí.
  constraint planner_run_audit_hash_matches check (
    input_hash = encode(pg_catalog.sha256(convert_to(input_canonical, 'UTF8')), 'hex')
  ),
  constraint planner_run_audit_canonical_json check (
    jsonb_typeof(input_canonical::jsonb) = 'object'
    and jsonb_typeof(decision_canonical::jsonb) = 'object'
  )
);
comment on table public.planner_run_audit is
  'Planner Contract §R · §S · instantánea canónica de entrada y de decisión: lo elegido y lo no '
  'elegido con su razón. Material de servicio: ninguna concesión a roles de cliente.';

drop trigger if exists planner_run_audit_immutable on public.planner_run_audit;
create trigger planner_run_audit_immutable
  before update on public.planner_run_audit
  for each row execute function public.reject_planner_history_update();
drop trigger if exists planner_run_audit_no_delete on public.planner_run_audit;
create trigger planner_run_audit_no_delete
  before delete on public.planner_run_audit
  for each row execute function public.reject_delete_while_account_exists();

alter table public.planner_run_audit enable row level security;
alter table public.planner_run_audit force row level security;
revoke all on public.planner_run_audit from public, anon, authenticated, service_role;
grant select on public.planner_run_audit to service_role;

-- 6 · study_sessions ------------------------------------------------------------------------

-- §V · `planner_run_id` deja de ser una columna sin semántica.
alter table public.study_sessions
  add constraint study_sessions_planner_run_fk
  foreign key (planner_run_id, user_id) references public.planner_runs (id, user_id)
  on delete restrict;

-- Una sesión planificada se reconoce por su tipo, y solo ella lleva ejecución: el cliente no
-- puede crear una sesión que aparente venir del Planner.
alter table public.study_sessions
  add constraint study_sessions_planner_run_type
  check ((planner_run_id is null) = (session_type <> 'PLANNER_RUN'));

create unique index if not exists study_sessions_one_per_run
  on public.study_sessions (planner_run_id) where planner_run_id is not null;

-- §U.1 · P4-G10 · una sola sesión abierta por persona, impuesta por la base de datos.
--
-- Es una restricción de exclusión **diferida** y no un índice único parcial, y es deliberado:
-- `create_study_session` (Phase 2, congelada) inserta la sesión antes de validar sus ítems. Con
-- una comprobación inmediata, una petición inválida hecha con una sesión ya abierta respondería
-- «sesión duplicada» en lugar de su error real (`TARGET_NOT_FOUND`, `ITEMS_MALFORMED`…), y el
-- orden de errores de la frontera congelada cambiaría. Diferida al final de la transacción, la
-- garantía es la misma —ninguna transacción confirma dos sesiones abiertas— y el orden de
-- errores de Phase 2 no se toca.
alter table public.study_sessions
  add constraint study_sessions_one_open_per_user
  exclude using btree (user_id with =)
  where (status in ('PLANNED', 'ACTIVE', 'INTERRUPTED'))
  deferrable initially deferred;

-- 7 · Lectura del motor para el Planner -------------------------------------------------------

-- §W.1 · el Planner lee categorías y la posición proyectada; nunca el vector.
create or replace function engine.planner_snapshot(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'maxPosition', coalesce(
      (select max(e.stream_position) from public.learning_events e where e.user_id = p_user_id), 0),
    'watermark', (
      select jsonb_build_object(
        'consumedPosition', w.consumed_position,
        'engineVersion', w.engine_version,
        'engineConfigVersion', w.engine_config_version,
        'attributionPackVersionId', w.attribution_pack_version_id,
        'attributionGeneration', w.attribution_generation,
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
    'concepts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conceptId', m.concept_id,
        'masteryState', m.mastery_state,
        'uncertainty', m.uncertainty,
        'lastNegativePosition', m.last_negative_position,
        'activeErrorPattern', exists (
          select 1 from engine.error_patterns p
          where p.user_id = m.user_id and p.concept_id = m.concept_id and p.status = 'ACTIVE'
        )
      ) order by m.concept_id)
      from engine.concept_mastery m
      where m.user_id = p_user_id
    ), '[]'::jsonb)
  );
$$;
comment on function engine.planner_snapshot(uuid) is
  'Planner Contract §W.1 · P4-D6 · estado categórico, incertidumbre, patrones activos y posición '
  'de la última evidencia negativa, con la tupla de frescura. Nunca el vector.';
revoke all on function engine.planner_snapshot(uuid) from public, anon, authenticated;
grant execute on function engine.planner_snapshot(uuid) to service_role;

create or replace function public.engine_planner_snapshot(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select engine.planner_snapshot(p_user_id);
$$;
comment on function public.engine_planner_snapshot(uuid) is
  'Phase 4A · Learning Engine · lectura categórica para el Planner, sin vector. Solo rol de '
  'servicio; la identidad la verifica el servidor.';
revoke all on function public.engine_planner_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.engine_planner_snapshot(uuid) to service_role;

-- 8 · Contexto del Planner ------------------------------------------------------------------

-- Día de plan: fecha de calendario en la zona **declarada**. Nula si no hay zona.
create or replace function public.planner_plan_day(p_timezone text)
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select case when public.timezone_is_declarable(p_timezone)
              then (now() at time zone p_timezone)::date end;
$$;
revoke all on function public.planner_plan_day(text) from public, anon, authenticated, service_role;

-- La versión de pack resuelta: la **misma** regla que la instantánea de evidencia del motor
-- (§W.6). Si una cambiara sin la otra, se planificaría sobre un pack que el motor no plegó.
create or replace function public.planner_resolved_pack_version(p_user uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id
  from public.learner_exam_goals g
  join public.exam_pack_versions v on v.exam_pack_id = g.exam_pack_id
  where g.user_id = p_user and g.status = 'ACTIVE' and v.status = 'PUBLISHED'
  order by v.created_at desc
  limit 1;
$$;
revoke all on function public.planner_resolved_pack_version(uuid) from public, anon, authenticated, service_role;

-- §I.2 · presupuesto desde las declaraciones de la persona. Sin override: no tiene almacenamiento
-- en 4A. Devuelve (minutos, procedencia) o nada si no hay ajustes.
create or replace function public.planner_budget(p_user uuid, p_plan_day date)
returns table (minutes integer, source text)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case when s.weekly_availability_json ? k.key
         then (s.weekly_availability_json ->> k.key)::integer
         else s.default_daily_minutes::integer end,
    case when s.weekly_availability_json ? k.key then 'WEEKLY_ENTRY' else 'DEFAULT_DAILY' end
  from public.learner_settings s
  cross join lateral (
    select (array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
      [extract(isodow from p_plan_day)::integer] as key
  ) k
  where s.user_id = p_user and p_plan_day is not null;
$$;
revoke all on function public.planner_budget(uuid, date) from public, anon, authenticated, service_role;

-- Todo lo que el Planner lee de `public` en una sola instantánea consistente.
create or replace function public.planner_context(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  day date;
  goal record;
  pack_version uuid;
  generation bigint;
  budget record;
begin
  select p.timezone into tz from public.profiles p where p.id = p_user;
  if not found then
    return jsonb_build_object('profile', false);
  end if;
  day := public.planner_plan_day(tz);
  select g.id, g.exam_pack_id into goal
    from public.learner_exam_goals g where g.user_id = p_user and g.status = 'ACTIVE';
  pack_version := public.planner_resolved_pack_version(p_user);
  select coalesce((select ag.generation from ingest.attribution_generations ag
                   where ag.exam_pack_version_id = pack_version), 1) into generation;
  select b.minutes, b.source into budget from public.planner_budget(p_user, day) b;

  return jsonb_build_object(
    'profile', true,
    'timezone', tz,
    'planDay', day,
    'goalId', goal.id,
    'packVersionId', pack_version,
    'attributionGeneration', generation,
    'budget', case when budget.minutes is null then null
                   else jsonb_build_object('minutes', budget.minutes, 'source', budget.source) end,
    'openSession', exists (
      select 1 from public.study_sessions s
      where s.user_id = p_user and s.status in ('PLANNED', 'ACTIVE', 'INTERRUPTED')
    ),
    'plannerConfigVersion', (select c.version from public.planner_config c where c.status = 'ACTIVE'),
    'concepts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conceptId', c.id,
        'conceptKey', c.concept_key,
        'conceptStatus', c.status,
        'blockSortOrder', b.sort_order,
        'topicSortOrder', t.sort_order,
        'conceptSortOrder', cv.sort_order
      ) order by c.id)
      from public.concept_versions cv
      join public.concepts c on c.id = cv.concept_id
      join public.topics t on t.id = cv.topic_id
      join public.syllabus_blocks b on b.id = t.block_id
      where cv.exam_pack_version_id = pack_version and c.status <> 'DRAFT'
    ), '[]'::jsonb),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'learningUnitId', u.id,
        'conceptId', u.concept_id,
        'learningUnitVersionId', uv.id,
        'sourceExcluded', coalesce(sv.status <> 'CURRENT', false)
      ) order by u.id)
      from public.learning_units u
      join public.learning_unit_versions uv
        on uv.learning_unit_id = u.id and uv.status = 'PUBLISHED'
       and uv.superseded_by_version_id is null
      left join public.source_versions sv on sv.id = uv.source_version_id
      where u.status = 'PUBLISHED' and u.exam_pack_id = goal.exam_pack_id
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', q.id,
        'conceptId', qc.concept_id,
        'representationId', r.id,
        'sourceExcluded', coalesce(sv.status <> 'CURRENT', false),
        'answeredToday', exists (
          select 1 from public.question_attempts a
          join public.learning_events e on e.event_id = a.submitted_event_id
          where a.user_id = p_user and a.question_id = q.id
            and (e.server_received_at at time zone tz)::date = day
        )
      ) order by q.id)
      from public.question_concepts qc
      join public.canonical_questions q on q.id = qc.question_id and q.status = 'PUBLISHED'
      join public.question_representations r
        on r.question_id = q.id and r.status = 'PUBLISHED'
       and r.superseded_by_representation_id is null
      left join public.source_versions sv on sv.id = r.source_version_id
      where qc.exam_pack_version_id = pack_version
        and qc.relationship_type = 'PRIMARY'
        and qc.mapping_status = 'VALIDATED'
    ), '[]'::jsonb),
    -- §E.5 · conceptos con algún ítem de sesión completado en el día de plan.
    'completedToday', coalesce((
      select jsonb_agg(distinct x.concept_id order by x.concept_id)
      from (
        select u.concept_id
        from public.session_items si
        join public.learning_units u on u.id = si.learning_unit_id
        where si.user_id = p_user and si.status = 'COMPLETED'
          and (si.completed_at at time zone tz)::date = day
        union
        select qc.concept_id
        from public.session_items si
        join public.question_concepts qc
          on qc.question_id = si.question_id and qc.exam_pack_version_id = pack_version
         and qc.relationship_type = 'PRIMARY' and qc.mapping_status = 'VALIDATED'
        where si.user_id = p_user and si.status = 'COMPLETED'
          and (si.completed_at at time zone tz)::date = day
      ) x
    ), '[]'::jsonb)
  );
end;
$$;
comment on function public.planner_context(uuid) is
  'Planner Contract §C · entradas autoritativas del Planner en una sola lectura: objetivo, versión '
  'de pack resuelta, día de plan en la zona declarada, presupuesto declarado, contenido elegible '
  'y ítems completados hoy. Solo rol de servicio; la identidad la verifica el servidor.';
revoke all on function public.planner_context(uuid) from public, anon, authenticated;
grant execute on function public.planner_context(uuid) to service_role;

-- 9 · Revalidación compartida -----------------------------------------------------------------

-- Serializa con la frontera de eventos: bloquea el contador del usuario, que es lo mismo que
-- hace `append_learning_event` antes de asignar posición (§U.1), y es el único bloqueo de fila
-- que SD-018 admite. Las carreras de sesión y de cadena no necesitan bloqueo: las resuelven los
-- índices únicos. Queda una ventana, y se dice: si la persona aún no tiene ningún evento, no hay
-- contador que bloquear, y un primer evento concurrente puede confirmarse después de esta
-- comprobación. La ejecución resultante declara `consumed_position = 0` y el arranque la
-- rechaza por atrasada (`RUN_STALE`), porque vuelve a comprobar la tupla bajo el mismo bloqueo.
create or replace function public.planner_lock_user(p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'STUDY_OS_PLANNER · PROFILE_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from ingest.user_event_counters c where c.user_id = p_user for update;
end;
$$;
revoke all on function public.planner_lock_user(uuid) from public, anon, authenticated, service_role;

-- ¿La tupla del motor declarada sigue siendo la autoritativa **y** está al día? Sin evidencia
-- todavía, la tupla es la de «nada consumido» bajo la configuración y atribución vigentes.
create or replace function public.planner_engine_tuple_is_current(
  p_user uuid,
  p_engine_version text,
  p_engine_config_version text,
  p_attribution_pack_version_id uuid,
  p_attribution_generation bigint,
  p_consumed_position bigint
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  w record;
  max_position bigint;
  active_config text;
  pack_version uuid := public.planner_resolved_pack_version(p_user);
  generation bigint;
begin
  select coalesce(max(e.stream_position), 0) into max_position
    from public.learning_events e where e.user_id = p_user;
  select c.version into active_config from engine.engine_config c where c.status = 'ACTIVE';
  select coalesce((select ag.generation from ingest.attribution_generations ag
                   where ag.exam_pack_version_id = pack_version), 1) into generation;
  if p_consumed_position is distinct from max_position
     or p_engine_config_version is distinct from active_config
     or p_attribution_pack_version_id is distinct from pack_version
     or p_attribution_generation is distinct from generation then
    return false;
  end if;
  select * into w from engine.projection_watermarks x
    where x.user_id = p_user and x.projection_name = 'concept_mastery';
  if not found then
    return max_position = 0;
  end if;
  return w.consumed_position = p_consumed_position
     and w.engine_version is not distinct from p_engine_version
     and w.engine_config_version is not distinct from p_engine_config_version
     and w.attribution_pack_version_id is not distinct from p_attribution_pack_version_id
     and w.attribution_generation is not distinct from p_attribution_generation
     and not exists (
       select 1 from engine.concept_mastery m
       where m.user_id = p_user
         and (m.event_watermark is distinct from w.consumed_position or w.consumed_position = 0)
     );
end;
$$;
revoke all on function public.planner_engine_tuple_is_current(uuid, text, text, uuid, bigint, bigint)
  from public, anon, authenticated, service_role;

-- ¿Un destino sigue disponible con la versión fijada, en el pack del objetivo?
create or replace function public.planner_target_is_available(
  p_exam_pack_id uuid,
  p_pack_version uuid,
  p_concept_id uuid,
  p_item_type public.session_item_type,
  p_learning_unit_id uuid,
  p_learning_unit_version_id uuid,
  p_question_id uuid,
  p_representation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.concepts c
      join public.concept_versions cv
        on cv.concept_id = c.id and cv.exam_pack_version_id = p_pack_version
      where c.id = p_concept_id and c.status = 'PUBLISHED'
    )
    and case p_item_type
      when 'LEARNING_UNIT' then exists (
        select 1 from public.learning_units u
        join public.learning_unit_versions uv on uv.learning_unit_id = u.id
        left join public.source_versions sv on sv.id = uv.source_version_id
        where u.id = p_learning_unit_id and u.status = 'PUBLISHED'
          and u.exam_pack_id = p_exam_pack_id and u.concept_id = p_concept_id
          and uv.id = p_learning_unit_version_id and uv.status = 'PUBLISHED'
          and uv.superseded_by_version_id is null
          and coalesce(sv.status = 'CURRENT', true)
      )
      when 'QUESTION' then exists (
        select 1 from public.canonical_questions q
        join public.question_representations r on r.question_id = q.id
        join public.question_concepts qc
          on qc.question_id = q.id and qc.exam_pack_version_id = p_pack_version
         and qc.relationship_type = 'PRIMARY' and qc.mapping_status = 'VALIDATED'
         and qc.concept_id = p_concept_id
        left join public.source_versions sv on sv.id = r.source_version_id
        where q.id = p_question_id and q.status = 'PUBLISHED'
          and q.exam_pack_id = p_exam_pack_id
          and r.id = p_representation_id and r.status = 'PUBLISHED'
          and r.superseded_by_representation_id is null
          and coalesce(sv.status = 'CURRENT', true)
      )
      else false
    end;
$$;
revoke all on function public.planner_target_is_available(uuid, uuid, uuid, public.session_item_type, uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- 10 · Persistencia de una ejecución --------------------------------------------------------

create or replace function public.create_planner_run(p_user uuid, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  tz text;
  day date;
  goal record;
  pack_version uuid;
  budget record;
  canonical jsonb;
  current_run record;
  run_id uuid;
  item jsonb;
  items jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  expected_position integer := 0;
  minutes_sum integer := 0;
  outcome text := p_payload ->> 'outcome';
  engine jsonb := p_payload -> 'engine';
begin
  if p_user is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(items) <> 'array' or jsonb_typeof(engine) <> 'object' then
    raise exception 'STUDY_OS_PLANNER · PAYLOAD_MALFORMED' using errcode = 'invalid_parameter_value';
  end if;

  perform public.planner_lock_user(p_user);

  -- §N · la sesión abierta gana: no se escribe ninguna ejecución.
  if exists (select 1 from public.study_sessions s
             where s.user_id = p_user and s.status in ('PLANNED', 'ACTIVE', 'INTERRUPTED')) then
    raise exception 'STUDY_OS_PLANNER · OPEN_SESSION' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- §U.1 · la tupla que la ejecución dice haber consumido se revalida aquí, en la transacción
  -- que la escribe. Si ha cambiado, no se escribe: el servidor recalcula.
  select p.timezone into tz from public.profiles p where p.id = p_user;
  day := public.planner_plan_day(tz);
  select g.id, g.exam_pack_id into goal
    from public.learner_exam_goals g where g.user_id = p_user and g.status = 'ACTIVE';
  pack_version := public.planner_resolved_pack_version(p_user);
  select b.minutes, b.source into budget from public.planner_budget(p_user, day) b;

  if tz is null or day is null
     or tz is distinct from p_payload ->> 'timezone'
     or day::text is distinct from p_payload ->> 'planDay'
     or goal.id is null
     or goal.id::text is distinct from p_payload ->> 'goalId'
     or pack_version::text is distinct from p_payload ->> 'packVersionId'
     or budget.minutes is null
     or budget.minutes is distinct from (p_payload #>> '{budget,minutes}')::integer
     or budget.source is distinct from p_payload #>> '{budget,source}'
     or (select c.version from public.planner_config c where c.status = 'ACTIVE')
          is distinct from p_payload ->> 'plannerConfigVersion'
     or not public.planner_engine_tuple_is_current(
          p_user,
          engine ->> 'engineVersion',
          engine ->> 'engineConfigVersion',
          (engine ->> 'attributionPackVersionId')::uuid,
          (engine ->> 'attributionGeneration')::bigint,
          (engine ->> 'consumedPosition')::bigint
        ) then
    raise exception 'STUDY_OS_PLANNER · STALE_INPUT' using errcode = 'serialization_failure';
  end if;

  -- La instantánea canónica dice lo mismo que la fila: no hay dos versiones de la entrada.
  begin
    canonical := (p_payload ->> 'inputCanonical')::jsonb;
  exception when others then
    raise exception 'STUDY_OS_PLANNER · SNAPSHOT_MALFORMED' using errcode = 'invalid_parameter_value';
  end;
  if canonical ->> 'userId' is distinct from p_user::text
     or canonical ->> 'goalId' is distinct from p_payload ->> 'goalId'
     or canonical ->> 'packVersionId' is distinct from p_payload ->> 'packVersionId'
     or canonical ->> 'planDay' is distinct from p_payload ->> 'planDay'
     or canonical ->> 'timezone' is distinct from p_payload ->> 'timezone'
     or canonical -> 'budget' is distinct from p_payload -> 'budget'
     or canonical -> 'engine' is distinct from engine
     or canonical ->> 'plannerVersion' is distinct from p_payload ->> 'plannerVersion'
     or canonical ->> 'plannerConfigVersion' is distinct from p_payload ->> 'plannerConfigVersion'
     or canonical ->> 'durationProvenance' is distinct from p_payload ->> 'durationProvenance' then
    raise exception 'STUDY_OS_PLANNER · SNAPSHOT_MISMATCH' using errcode = 'invalid_parameter_value';
  end if;

  -- Coherencia de los ítems y disponibilidad de cada destino seleccionado (§U.1).
  for item in select * from jsonb_array_elements(items) loop
    expected_position := expected_position + 1;
    if (item ->> 'position')::integer is distinct from expected_position then
      raise exception 'STUDY_OS_PLANNER · ITEMS_MALFORMED' using errcode = 'invalid_parameter_value';
    end if;
    minutes_sum := minutes_sum + (item ->> 'plannedMinutes')::integer;
    if not public.planner_target_is_available(
         goal.exam_pack_id, pack_version,
         (item ->> 'conceptId')::uuid,
         (item ->> 'itemType')::public.session_item_type,
         (item ->> 'learningUnitId')::uuid,
         (item ->> 'learningUnitVersionId')::uuid,
         (item ->> 'questionId')::uuid,
         (item ->> 'questionRepresentationId')::uuid) then
      raise exception 'STUDY_OS_PLANNER · STALE_INPUT' using errcode = 'serialization_failure';
    end if;
  end loop;
  if minutes_sum is distinct from (p_payload ->> 'plannedMinutes')::integer then
    raise exception 'STUDY_OS_PLANNER · ITEMS_MALFORMED' using errcode = 'invalid_parameter_value';
  end if;

  -- §O · reutilización: si la ejecución actual del objetivo es del mismo día y con el mismo hash,
  -- se devuelve esa y no se escribe otra.
  select r.id, r.plan_day, r.input_hash into current_run
    from public.planner_runs r
    where r.learner_exam_goal_id = goal.id
      and not exists (select 1 from public.planner_runs s where s.supersedes_run_id = r.id);
  if current_run.id is not null
     and current_run.plan_day = day
     and current_run.input_hash = p_payload ->> 'inputHash' then
    return jsonb_build_object('runId', current_run.id, 'reused', true);
  end if;

  insert into public.planner_runs (
    user_id, learner_exam_goal_id, exam_pack_version_id, plan_day, timezone, outcome,
    budget_minutes, budget_source, planned_minutes, item_count, planner_version,
    planner_config_version, engine_version, engine_config_version, attribution_pack_version_id,
    attribution_generation, consumed_position, duration_provenance, input_hash, supersedes_run_id
  ) values (
    p_user, goal.id, pack_version, day, tz, outcome,
    budget.minutes, budget.source, minutes_sum, expected_position, p_payload ->> 'plannerVersion',
    p_payload ->> 'plannerConfigVersion', engine ->> 'engineVersion',
    engine ->> 'engineConfigVersion', (engine ->> 'attributionPackVersionId')::uuid,
    (engine ->> 'attributionGeneration')::bigint, (engine ->> 'consumedPosition')::bigint,
    p_payload ->> 'durationProvenance', p_payload ->> 'inputHash', current_run.id
  )
  returning id into run_id;

  for item in select * from jsonb_array_elements(items) loop
    insert into public.planner_items (
      run_id, user_id, position, action_ordinal, action_kind, step, composition_reason,
      concept_id, item_type, learning_unit_id, learning_unit_version_id, question_id,
      question_representation_id, planned_minutes
    ) values (
      run_id, p_user, (item ->> 'position')::integer, (item ->> 'actionOrdinal')::integer,
      item ->> 'actionKind', item ->> 'step', item ->> 'compositionReason',
      (item ->> 'conceptId')::uuid, (item ->> 'itemType')::public.session_item_type,
      (item ->> 'learningUnitId')::uuid, (item ->> 'learningUnitVersionId')::uuid,
      (item ->> 'questionId')::uuid, (item ->> 'questionRepresentationId')::uuid,
      (item ->> 'plannedMinutes')::integer
    );
  end loop;

  insert into public.planner_run_audit (run_id, user_id, input_canonical, decision_canonical, input_hash)
  values (run_id, p_user, p_payload ->> 'inputCanonical', p_payload ->> 'decisionCanonical',
          p_payload ->> 'inputHash');

  return jsonb_build_object('runId', run_id, 'reused', false);
exception
  -- Una carrera perdida contra otra ejecución del mismo objetivo: el servidor recalcula.
  when unique_violation then
    raise exception 'STUDY_OS_PLANNER · STALE_INPUT' using errcode = 'serialization_failure';
end;
$$;
comment on function public.create_planner_run(uuid, jsonb) is
  'Planner Contract §U.3 · §U.1 · persistencia autoritativa de una ejecución con revalidación de '
  'su entrada en la misma transacción. Solo rol de servicio: un plan es una decisión que el '
  'cliente no puede redactar.';
revoke all on function public.create_planner_run(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_planner_run(uuid, jsonb) to service_role;

-- 11 · Arranque de sesión planificada -------------------------------------------------------

create or replace function public.start_planned_session(p_user uuid, p_run_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  run record;
  existing record;
  goal record;
  session_id uuid;
  it record;
  items_out jsonb := '[]'::jsonb;
  new_item_id uuid;
  tz text;
begin
  if p_user is null or p_run_id is null then
    raise exception 'STUDY_OS_PLANNER · RUN_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  perform public.planner_lock_user(p_user);

  select * into run from public.planner_runs r where r.id = p_run_id and r.user_id = p_user;
  if run.id is null then
    raise exception 'STUDY_OS_PLANNER · RUN_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;

  -- §U.6 · idempotente por ejecución: la misma ejecución devuelve la misma sesión.
  select s.id, s.status into existing from public.study_sessions s where s.planner_run_id = run.id;
  if existing.id is not null then
    return jsonb_build_object('sessionId', existing.id, 'status', existing.status, 'reused', true);
  end if;

  if run.outcome <> 'PLANNED' then
    raise exception 'STUDY_OS_PLANNER · RUN_NOT_STARTABLE' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if exists (select 1 from public.planner_runs s where s.supersedes_run_id = run.id) then
    raise exception 'STUDY_OS_PLANNER · RUN_SUPERSEDED' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if exists (select 1 from public.study_sessions s
             where s.user_id = p_user and s.status in ('PLANNED', 'ACTIVE', 'INTERRUPTED')) then
    raise exception 'STUDY_OS_PLANNER · OPEN_SESSION' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- Frescura de la entrada: el día, la zona, el objetivo, el pack y la tupla del motor.
  select p.timezone into tz from public.profiles p where p.id = p_user;
  select g.id, g.exam_pack_id into goal
    from public.learner_exam_goals g where g.user_id = p_user and g.status = 'ACTIVE';
  if tz is distinct from run.timezone
     or public.planner_plan_day(tz) is distinct from run.plan_day
     or goal.id is distinct from run.learner_exam_goal_id
     or public.planner_resolved_pack_version(p_user) is distinct from run.exam_pack_version_id
     or not public.planner_engine_tuple_is_current(
          p_user, run.engine_version, run.engine_config_version, run.attribution_pack_version_id,
          run.attribution_generation, run.consumed_position) then
    raise exception 'STUDY_OS_PLANNER · RUN_STALE' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- §P · un destino retirado antes de arrancar: no se arranca y se replanifica.
  for it in select * from public.planner_items i where i.run_id = run.id order by i.position loop
    if not public.planner_target_is_available(
         goal.exam_pack_id, run.exam_pack_version_id, it.concept_id, it.item_type,
         it.learning_unit_id, it.learning_unit_version_id, it.question_id,
         it.question_representation_id) then
      raise exception 'STUDY_OS_PLANNER · TARGET_UNAVAILABLE' using errcode = 'object_not_in_prerequisite_state';
    end if;
  end loop;

  insert into public.study_sessions (
    user_id, learner_exam_goal_id, planner_run_id, session_type, planned_minutes
  ) values (p_user, run.learner_exam_goal_id, run.id, 'PLANNER_RUN', run.planned_minutes)
  returning id into session_id;

  -- Los ítems se copian como instantánea: el plan no se vuelve a consultar al reanudar (§N).
  for it in select * from public.planner_items i where i.run_id = run.id order by i.position loop
    insert into public.session_items (
      session_id, user_id, item_type, learning_unit_id, question_id, sort_order, planned_minutes
    ) values (
      session_id, p_user, it.item_type, it.learning_unit_id, it.question_id, it.position,
      it.planned_minutes
    )
    returning id into new_item_id;
    items_out := items_out || jsonb_build_object(
      'session_item_id', new_item_id, 'sort_order', it.position, 'item_type', it.item_type::text,
      'target_id', coalesce(it.learning_unit_id, it.question_id));
  end loop;

  return jsonb_build_object(
    'sessionId', session_id, 'status', 'PLANNED', 'reused', false, 'items', items_out);
exception
  when unique_violation then
    raise exception 'STUDY_OS_PLANNER · OPEN_SESSION' using errcode = 'object_not_in_prerequisite_state';
end;
$$;
comment on function public.start_planned_session(uuid, uuid) is
  'Planner Contract §U.6 · arranque de una sesión planificada: recibe solo una ejecución, '
  'comprueba propiedad, frescura, disponibilidad y ausencia de sesión abierta, y copia los '
  'ítems como instantánea. Idempotente por ejecución. Solo rol de servicio.';
revoke all on function public.start_planned_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_planned_session(uuid, uuid) to service_role;
