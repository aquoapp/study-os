-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 17 · Sesiones de estudio e ítems tipados (Phase 2 · slice S3 · nodo N17)
--
-- CDEM §9 «study_sessions» (status PLANNED · ACTIVE · INTERRUPTED · COMPLETED · ABANDONED;
--   resume_cursor_json; «ABANDONED is a technical status, not user-facing»), «session_items»;
--   matriz RLS §22 «study sessions/items: owner read, owner via validated app flow»;
--   regla de integridad «a session item cannot belong to a different user's session».
-- ADR-007 v1.1 (ACCEPTED · anexo 2026-09-09): una columna FK tipada y nullable por destino,
--   CHECK de exactamente un destino coherente con item_type, sin item_ref_id, ON DELETE
--   RESTRICT, tests negativos por combinación inválida.
-- SD-023 · el ítem registra la representación (o versión de unidad) exactamente presentada,
--   fijada por el servidor una sola vez.
-- Master §10 (continuidad con cursor válido) · REQ-C04 · INV-107 · EC-005 · EC-009.
-- H-P2-3 · `create_study_session` es la función de flujo de sesión declarada en el registro:
--   única vía de creación; el cliente no tiene INSERT sobre sesiones ni ítems.
-- Ningún concepto de Planner: `planner_run_id` es nullable y sin semántica (Phase 4).
-- Rollback: supabase/migrations/down/00000000000017_sessions.down.sql
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'session_status' and n.nspname = 'public') then
    create type public.session_status as enum ('PLANNED', 'ACTIVE', 'INTERRUPTED', 'COMPLETED', 'ABANDONED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'session_item_type' and n.nspname = 'public') then
    create type public.session_item_type as enum ('LEARNING_UNIT', 'QUESTION', 'PRACTICAL', 'CONCEPT_REVIEW');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'session_item_status' and n.nspname = 'public') then
    create type public.session_item_status as enum ('PENDING', 'ACTIVE', 'COMPLETED');
  end if;
end
$$;
comment on type public.session_status is
  'CDEM §9 · estados de sesión. ABANDONED es técnico y nunca copy de usuario (INV-107).';
comment on type public.session_item_type is
  'ADR-007 v1.1 §A · exactamente cuatro destinos. Añadir uno exige migración, matriz y tests.';
comment on type public.session_item_status is
  'CDEM §9 · progreso de un ítem dentro de la sesión, derivado de los eventos aceptados.';

-- study_sessions --------------------------------------------------------------------
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  learner_exam_goal_id uuid not null,
  planner_run_id uuid,
  session_type text not null,
  status public.session_status not null default 'PLANNED',
  planned_minutes integer,
  started_at timestamptz,
  last_activity_at timestamptz,
  completed_at timestamptz,
  resume_cursor_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_id_user_unique unique (id, user_id),
  constraint study_sessions_goal_fk
    foreign key (learner_exam_goal_id, user_id) references public.learner_exam_goals (id, user_id) on delete cascade,
  constraint study_sessions_type_format check (session_type ~ '^[A-Z_]{2,40}$'),
  constraint study_sessions_planned_minutes_range check (planned_minutes is null or planned_minutes between 1 and 600),
  constraint study_sessions_timestamps_match_status check (
    (status = 'PLANNED' and started_at is null and completed_at is null)
    or (status in ('ACTIVE', 'INTERRUPTED', 'ABANDONED') and started_at is not null and completed_at is null)
    or (status = 'COMPLETED' and started_at is not null and completed_at is not null)
  ),
  constraint study_sessions_cursor_shape check (resume_cursor_json is null or jsonb_typeof(resume_cursor_json) = 'object')
);
comment on table public.study_sessions is
  'CDEM §9 · Master §10 · sesión de estudio del aprendiz. El estado es una proyección de los '
  'eventos aceptados, materializada para la continuidad; solo el servidor la escribe.';

create or replace function public.check_session_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.learner_exam_goal_id is distinct from old.learner_exam_goal_id
     or new.session_type is distinct from old.session_type
     or new.created_at is distinct from old.created_at
     or (old.planner_run_id is not null and new.planner_run_id is distinct from old.planner_run_id) then
    raise exception 'CDEM §9 · identidad, objetivo, tipo y run de una sesión son inmutables'
      using errcode = 'restrict_violation';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if old.status in ('COMPLETED', 'ABANDONED') then
    raise exception 'CDEM §9 · una sesión % es terminal', old.status using errcode = 'restrict_violation';
  end if;
  if old.status = 'PLANNED' and new.status = 'ACTIVE' then return new; end if;
  if old.status = 'ACTIVE' and new.status in ('INTERRUPTED', 'COMPLETED', 'ABANDONED') then return new; end if;
  if old.status = 'INTERRUPTED' and new.status in ('ACTIVE', 'COMPLETED', 'ABANDONED') then return new; end if;
  raise exception 'CDEM §9 · transición de sesión no admitida: % → %', old.status, new.status
    using errcode = 'restrict_violation';
end;
$$;
revoke all on function public.check_session_transition() from public, anon, authenticated, service_role;
drop trigger if exists study_sessions_transition on public.study_sessions;
create trigger study_sessions_transition
  before update on public.study_sessions
  for each row execute function public.check_session_transition();
drop trigger if exists study_sessions_set_updated_at on public.study_sessions;
create trigger study_sessions_set_updated_at
  before update on public.study_sessions
  for each row execute function public.set_updated_at();

-- Una sesión solo desaparece con la cuenta (CDEM §24): nunca por un camino de aplicación.
create or replace function public.reject_delete_while_account_exists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles p where p.id = old.user_id) then
    raise exception 'EC-005 · %.% solo se borra con la cuenta de su propietario', tg_table_schema, tg_table_name
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;
comment on function public.reject_delete_while_account_exists() is
  'Phase 2 · evidencia y sesiones no se borran mientras exista la cuenta; la cascada del '
  'borrado de cuenta (CDEM §24) es el único camino.';
revoke all on function public.reject_delete_while_account_exists() from public, anon, authenticated, service_role;
drop trigger if exists study_sessions_no_delete on public.study_sessions;
create trigger study_sessions_no_delete
  before delete on public.study_sessions
  for each row execute function public.reject_delete_while_account_exists();

alter table public.study_sessions enable row level security;
alter table public.study_sessions force row level security;
revoke all on public.study_sessions from public, anon, authenticated;
drop policy if exists study_sessions_select_own on public.study_sessions;
create policy study_sessions_select_own
  on public.study_sessions for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.study_sessions to authenticated;
grant select on public.study_sessions to service_role;

-- session_items ---------------------------------------------------------------------
create table if not exists public.session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_type public.session_item_type not null,
  learning_unit_id uuid references public.learning_units (id) on delete restrict,
  question_id uuid references public.canonical_questions (id) on delete restrict,
  practical_id uuid references public.practicals (id) on delete restrict,
  concept_id uuid references public.concepts (id) on delete restrict,
  sort_order integer not null,
  planned_minutes integer,
  status public.session_item_status not null default 'PENDING',
  started_at timestamptz,
  completed_at timestamptz,
  presented_representation_id uuid,
  presented_learning_unit_version_id uuid,
  created_at timestamptz not null default now(),
  constraint session_items_session_fk
    foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete cascade,
  constraint session_items_id_session_unique unique (id, session_id),
  constraint session_items_id_user_unique unique (id, user_id),
  constraint session_items_sort_unique unique (session_id, sort_order),
  constraint session_items_sort_positive check (sort_order >= 1),
  constraint session_items_planned_minutes_range check (planned_minutes is null or planned_minutes between 1 and 600),
  -- ADR-007 puntos 1–3: exactamente un destino, y el poblado es el del item_type declarado.
  constraint session_items_exactly_one_target check (
    (item_type = 'LEARNING_UNIT' and learning_unit_id is not null and question_id is null and practical_id is null and concept_id is null)
    or (item_type = 'QUESTION' and question_id is not null and learning_unit_id is null and practical_id is null and concept_id is null)
    or (item_type = 'PRACTICAL' and practical_id is not null and learning_unit_id is null and question_id is null and concept_id is null)
    or (item_type = 'CONCEPT_REVIEW' and concept_id is not null and learning_unit_id is null and question_id is null and practical_id is null)
  ),
  -- SD-023: lo presentado pertenece al destino del ítem y solo existe para su tipo.
  constraint session_items_presented_representation_fk
    foreign key (presented_representation_id, question_id) references public.question_representations (id, question_id),
  constraint session_items_presented_unit_version_fk
    foreign key (presented_learning_unit_version_id, learning_unit_id) references public.learning_unit_versions (id, learning_unit_id),
  constraint session_items_presented_matches_type check (
    (presented_representation_id is null or item_type = 'QUESTION')
    and (presented_learning_unit_version_id is null or item_type = 'LEARNING_UNIT')
  ),
  constraint session_items_timestamps_match_status check (
    (status = 'PENDING' and started_at is null and completed_at is null)
    or (status = 'ACTIVE' and started_at is not null and completed_at is null)
    or (status = 'COMPLETED' and started_at is not null and completed_at is not null)
  )
);
comment on table public.session_items is
  'CDEM §9 · ADR-007 v1.1 · ítem de sesión con destino tipado verificable (RESTRICT) y '
  'registro de lo exactamente presentado (SD-023). Sin item_ref_id polimórfico.';
create index if not exists session_items_session_order on public.session_items (session_id, sort_order);

create or replace function public.check_session_item_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.session_id is distinct from old.session_id
     or new.user_id is distinct from old.user_id
     or new.item_type is distinct from old.item_type
     or new.learning_unit_id is distinct from old.learning_unit_id
     or new.question_id is distinct from old.question_id
     or new.practical_id is distinct from old.practical_id
     or new.concept_id is distinct from old.concept_id
     or new.sort_order is distinct from old.sort_order
     or new.planned_minutes is distinct from old.planned_minutes
     or new.created_at is distinct from old.created_at then
    raise exception 'ADR-007 · el destino y la posición de un ítem de sesión son inmutables'
      using errcode = 'restrict_violation';
  end if;
  if old.presented_representation_id is not null
     and new.presented_representation_id is distinct from old.presented_representation_id then
    raise exception 'SD-023 · la representación presentada se fija una sola vez'
      using errcode = 'restrict_violation';
  end if;
  if old.presented_learning_unit_version_id is not null
     and new.presented_learning_unit_version_id is distinct from old.presented_learning_unit_version_id then
    raise exception 'SD-023 · la versión de unidad presentada se fija una sola vez'
      using errcode = 'restrict_violation';
  end if;
  if new.status <> old.status then
    if old.status = 'COMPLETED' then
      raise exception 'CDEM §9 · un ítem completado no cambia de estado' using errcode = 'restrict_violation';
    end if;
    if not ((old.status = 'PENDING' and new.status in ('ACTIVE', 'COMPLETED'))
            or (old.status = 'ACTIVE' and new.status = 'COMPLETED')) then
      raise exception 'CDEM §9 · transición de ítem no admitida: % → %', old.status, new.status
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.check_session_item_mutation() from public, anon, authenticated, service_role;
drop trigger if exists session_items_mutation on public.session_items;
create trigger session_items_mutation
  before update on public.session_items
  for each row execute function public.check_session_item_mutation();
drop trigger if exists session_items_no_delete on public.session_items;
create trigger session_items_no_delete
  before delete on public.session_items
  for each row execute function public.reject_delete_while_account_exists();

alter table public.session_items enable row level security;
alter table public.session_items force row level security;
revoke all on public.session_items from public, anon, authenticated;
drop policy if exists session_items_select_own on public.session_items;
create policy session_items_select_own
  on public.session_items for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.session_items to authenticated;
grant select on public.session_items to service_role;

-- Flujo validado de creación (CDEM §22 «owner via validated app flow») -------------------
-- Núcleo de servidor en `ingest` (no expuesto) y envoltorio en `public` para el usuario
-- autenticado, que solo puede crear sesiones para sí mismo (auth.uid()).
create or replace function ingest.create_study_session(
  p_user uuid,
  p_goal_id uuid,
  p_session_type text,
  p_planned_minutes integer,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  goal record;
  session_id uuid;
  item jsonb;
  idx integer := 0;
  kind public.session_item_type;
  target uuid;
  target_pack uuid;
  minutes integer;
  items_out jsonb := '[]'::jsonb;
  new_item_id uuid;
begin
  if p_user is null then
    raise exception 'INV-116 · sin identidad verificada' using errcode = 'insufficient_privilege';
  end if;
  select g.id, g.exam_pack_id, g.status into goal
    from public.learner_exam_goals g where g.id = p_goal_id and g.user_id = p_user;
  if goal.id is null then
    raise exception 'STUDY_OS_SESSION · GOAL_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  if goal.status <> 'ACTIVE' then
    raise exception 'STUDY_OS_SESSION · GOAL_NOT_ACTIVE' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_session_type is null or p_session_type !~ '^[A-Z_]{2,40}$' then
    raise exception 'STUDY_OS_SESSION · SESSION_TYPE_MALFORMED' using errcode = 'invalid_parameter_value';
  end if;
  if p_planned_minutes is not null and (p_planned_minutes < 1 or p_planned_minutes > 600) then
    raise exception 'STUDY_OS_SESSION · PLANNED_MINUTES_OUT_OF_RANGE' using errcode = 'invalid_parameter_value';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'STUDY_OS_SESSION · ITEMS_MALFORMED' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.study_sessions (user_id, learner_exam_goal_id, session_type, planned_minutes)
  values (p_user, p_goal_id, p_session_type, p_planned_minutes)
  returning id into session_id;

  for item in select * from jsonb_array_elements(p_items) loop
    idx := idx + 1;
    if jsonb_typeof(item) <> 'object' or not (item ? 'item_type') or not (item ? 'target_id') then
      raise exception 'STUDY_OS_SESSION · ITEM_MALFORMED (%)', idx using errcode = 'invalid_parameter_value';
    end if;
    begin
      kind := (item->>'item_type')::public.session_item_type;
      target := (item->>'target_id')::uuid;
      minutes := (item->>'planned_minutes')::integer;
    exception when invalid_text_representation or invalid_parameter_value then
      raise exception 'STUDY_OS_SESSION · ITEM_MALFORMED (%)', idx using errcode = 'invalid_parameter_value';
    end;
    -- ADR-007: cada destino existe, está publicado y pertenece al pack del objetivo.
    case kind
      when 'LEARNING_UNIT' then
        select u.exam_pack_id into target_pack from public.learning_units u where u.id = target and u.status = 'PUBLISHED';
      when 'QUESTION' then
        select q.exam_pack_id into target_pack from public.canonical_questions q where q.id = target and q.status = 'PUBLISHED';
      when 'PRACTICAL' then
        select pr.exam_pack_id into target_pack from public.practicals pr where pr.id = target and pr.status = 'PUBLISHED';
      when 'CONCEPT_REVIEW' then
        select c.exam_pack_id into target_pack from public.concepts c where c.id = target and c.status = 'PUBLISHED';
    end case;
    if target_pack is null then
      raise exception 'STUDY_OS_SESSION · TARGET_NOT_FOUND (%)', idx using errcode = 'foreign_key_violation';
    end if;
    if target_pack <> goal.exam_pack_id then
      raise exception 'STUDY_OS_SESSION · TARGET_OUTSIDE_GOAL_PACK (%)', idx using errcode = 'foreign_key_violation';
    end if;
    insert into public.session_items (session_id, user_id, item_type, learning_unit_id, question_id, practical_id, concept_id,
                                      sort_order, planned_minutes)
    values (session_id, p_user, kind,
            case when kind = 'LEARNING_UNIT' then target end,
            case when kind = 'QUESTION' then target end,
            case when kind = 'PRACTICAL' then target end,
            case when kind = 'CONCEPT_REVIEW' then target end,
            idx, minutes)
    returning id into new_item_id;
    items_out := items_out || jsonb_build_object(
      'session_item_id', new_item_id, 'sort_order', idx, 'item_type', kind::text, 'target_id', target);
  end loop;

  return jsonb_build_object('session_id', session_id, 'status', 'PLANNED', 'items', items_out);
end;
$$;
comment on function ingest.create_study_session(uuid, uuid, text, integer, jsonb) is
  'CDEM §22 · flujo validado de creación de sesión: objetivo propio y ACTIVE, destinos '
  'publicados del pack del objetivo (ADR-007 v1.1). Sin semántica de Planner (Phase 4).';
revoke all on function ingest.create_study_session(uuid, uuid, text, integer, jsonb) from public, anon, authenticated, service_role;

create or replace function public.create_study_session(
  p_goal_id uuid,
  p_session_type text,
  p_planned_minutes integer default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Manifest §14 · la identidad es la del JWT verificado; ningún parámetro la sustituye.
  return ingest.create_study_session((select auth.uid()), p_goal_id, p_session_type, p_planned_minutes, p_items);
end;
$$;
comment on function public.create_study_session(uuid, text, integer, jsonb) is
  'H-P2-3 · RPC invocable por cliente declarada en authority-registry.json (clientInvokableRpcs). '
  'Crea una sesión PLANNED con ítems tipados para el usuario autenticado.';
revoke all on function public.create_study_session(uuid, text, integer, jsonb) from public, anon, service_role;
grant execute on function public.create_study_session(uuid, text, integer, jsonb) to authenticated;
