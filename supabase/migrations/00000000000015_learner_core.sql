-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 15 · Núcleo de aprendiz (Phase 2 · slice S1 · nodos N15 y N20)
--
-- CDEM §3 «learner_settings», «devices»; §8 «learner_exam_goals»; §13 «diagnostic_runs»;
--   §21 «sync_state» (unicidad user + device); matriz RLS §22: «profile/settings/devices:
--   owner/owner», «learner goals: owner/owner».
-- Master §6, §7, §49 · REQ-C01, REQ-C03, REQ-C14, REQ-C15 · EC-009 (RLS + test de
--   aislamiento en la misma entrega) · EC-012 (contrato de sync; la cola es de Phase 9).
-- Manifest · líneas rojas: nunca se confía en un user_id del cliente; RLS nunca se
--   desactiva; INV-116.
-- Phase 2 Build Authorization (2026-09-09) · docs/PHASE_2_AUTHORIZATION_PACKET.md §K, §P, §Q.
--
-- Reglas de esta migración:
--   - toda tabla nace cerrada (revoke all a anon/authenticated) y con RLS forzado;
--   - el propietario es siempre auth.uid(): las políticas lo exigen en lectura y en
--     escritura, y un trigger impide cambiar de propietario;
--   - el rol de servicio solo lee: ninguna herramienta de servidor necesita escribir
--     aquí, y la limpieza de fixtures llega por la cascada del borrado de la cuenta;
--   - `sync_state` la escribe solo el servidor (EC-012: el estado de sincronización
--     deriva del ACK del servidor; la función de evidencia lo actualiza desde la 18);
--   - un objetivo activo por usuario (CDEM §8: «MVP UI exposes one active goal»);
--   - `diagnostic_runs` es dominio estructural: estados y marcas de tiempo coherentes,
--     sin ningún comportamiento de motor (REQ-C02 es de Phase 3).
-- Rollback: supabase/migrations/down/00000000000015_learner_core.down.sql
-- ---------------------------------------------------------------------------

-- Tipos ----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'goal_status' and n.nspname = 'public') then
    create type public.goal_status as enum ('ACTIVE', 'PAUSED', 'ARCHIVED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'diagnostic_run_status' and n.nspname = 'public') then
    create type public.diagnostic_run_status as enum ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');
  end if;
end
$$;

comment on type public.goal_status is
  'CDEM §8 · estado del objetivo de examen del aprendiz. Exactamente uno ACTIVE por usuario.';
comment on type public.diagnostic_run_status is
  'CDEM §13 · ciclo estructural del diagnóstico: PENDING → IN_PROGRESS → COMPLETED, o PENDING → SKIPPED (REQ-C02).';

-- Utilidades de propiedad ----------------------------------------------------------
-- El propietario de una fila de aprendiz no cambia nunca. Las políticas RLS ya lo
-- impiden para los roles de cliente; el trigger lo impide también para cualquier otro
-- camino (funciones definer, rol de servicio con SELECT únicamente, propietario de la
-- base). SECURITY DEFINER para que la cascada del borrado de cuenta —que ejecuta el rol
-- de auth— pueda disparar los triggers de estas tablas sin privilegios propios.
create or replace function public.reject_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Manifest §14 · el propietario de %.% es inmutable', tg_table_schema, tg_table_name
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
comment on function public.reject_owner_change() is
  'Phase 2 · una fila de aprendiz no cambia de propietario por ningún camino.';
revoke all on function public.reject_owner_change() from public, anon, authenticated, service_role;

-- Disponibilidad semanal: objeto {mon..sun: minutos 0..600}. Master §7: la
-- disponibilidad es editable sin reiniciar nada (REQ-C03): aquí solo se valida la forma.
create or replace function public.weekly_availability_is_valid(p jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
     and not exists (
       select 1 from jsonb_each(p) e
       where e.key not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
          or jsonb_typeof(e.value) <> 'number'
          or (e.value)::text !~ '^[0-9]{1,3}$'
          or (e.value)::text::integer > 600
     );
$$;
comment on function public.weekly_availability_is_valid(jsonb) is
  'Master §7 · disponibilidad por día de la semana en minutos (0–600). Solo forma; ningún cálculo.';
revoke all on function public.weekly_availability_is_valid(jsonb) from public, anon, authenticated, service_role;

-- learner_settings -----------------------------------------------------------------
create table if not exists public.learner_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  default_daily_minutes smallint not null default 30,
  weekly_availability_json jsonb not null default '{}'::jsonb,
  diagnostic_preference text,
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_settings_daily_minutes_range check (default_daily_minutes between 5 and 600),
  constraint learner_settings_diagnostic_preference
    check (diagnostic_preference is null or diagnostic_preference in ('TAKE', 'SKIP'))
);
comment on table public.learner_settings is
  'CDEM §3 · preferencias y disponibilidad del aprendiz (Master §6, §7, §49). Fila propia; '
  'cambiarla nunca borra evidencia (REQ-C03).';

-- La forma de la disponibilidad se valida por trigger definer, no por CHECK con función: un
-- CHECK ejecuta la función como el rol que escribe, y ninguna función de public es
-- ejecutable por roles de cliente (D-19 cerrada en la migración 14).
create or replace function public.check_learner_settings_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.weekly_availability_is_valid(new.weekly_availability_json) then
    raise exception 'Master §7 · weekly_availability_json debe ser {mon..sun: minutos 0–600}'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.check_learner_settings_shape() from public, anon, authenticated, service_role;
drop trigger if exists learner_settings_availability_shape on public.learner_settings;
create trigger learner_settings_availability_shape
  before insert or update on public.learner_settings
  for each row execute function public.check_learner_settings_shape();
drop trigger if exists learner_settings_set_updated_at on public.learner_settings;
create trigger learner_settings_set_updated_at
  before update on public.learner_settings
  for each row execute function public.set_updated_at();
drop trigger if exists learner_settings_owner_immutable on public.learner_settings;
create trigger learner_settings_owner_immutable
  before update on public.learner_settings
  for each row execute function public.reject_owner_change();

alter table public.learner_settings enable row level security;
alter table public.learner_settings force row level security;
revoke all on public.learner_settings from public, anon, authenticated;
drop policy if exists learner_settings_select_own on public.learner_settings;
create policy learner_settings_select_own
  on public.learner_settings for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists learner_settings_insert_own on public.learner_settings;
create policy learner_settings_insert_own
  on public.learner_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists learner_settings_update_own on public.learner_settings;
create policy learner_settings_update_own
  on public.learner_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update on public.learner_settings to authenticated;
grant select on public.learner_settings to service_role;

-- learner_exam_goals ---------------------------------------------------------------
create table if not exists public.learner_exam_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exam_pack_id uuid not null references public.exam_packs (id),
  target_date date,
  starting_level text,
  status public.goal_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_exam_goals_id_user_unique unique (id, user_id),
  constraint learner_exam_goals_starting_level_format
    check (starting_level is null or starting_level ~ '^[A-Z_]{2,40}$')
);
comment on table public.learner_exam_goals is
  'CDEM §8 · objetivo de examen del aprendiz. Exam-neutral: apunta a un pack publicado, '
  'nunca a un examen concreto (EC-018). Exactamente un objetivo ACTIVE por usuario.';
create unique index if not exists learner_exam_goals_one_active
  on public.learner_exam_goals (user_id)
  where status = 'ACTIVE';

-- Un objetivo solo puede apuntar a un pack publicado (los DRAFT no son visibles).
create or replace function public.check_goal_pack_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.exam_pack_id is distinct from coalesce(old.exam_pack_id, new.exam_pack_id) and tg_op = 'UPDATE' then
    raise exception 'CDEM §8 · un objetivo no cambia de pack: se archiva y se crea otro'
      using errcode = 'restrict_violation';
  end if;
  if not exists (select 1 from public.exam_packs p where p.id = new.exam_pack_id and p.status = 'PUBLISHED') then
    raise exception 'CDEM §8 · el objetivo exige un pack publicado' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.check_goal_pack_published() from public, anon, authenticated, service_role;
drop trigger if exists learner_exam_goals_pack_published on public.learner_exam_goals;
create trigger learner_exam_goals_pack_published
  before insert or update on public.learner_exam_goals
  for each row execute function public.check_goal_pack_published();
drop trigger if exists learner_exam_goals_set_updated_at on public.learner_exam_goals;
create trigger learner_exam_goals_set_updated_at
  before update on public.learner_exam_goals
  for each row execute function public.set_updated_at();
drop trigger if exists learner_exam_goals_owner_immutable on public.learner_exam_goals;
create trigger learner_exam_goals_owner_immutable
  before update on public.learner_exam_goals
  for each row execute function public.reject_owner_change();

alter table public.learner_exam_goals enable row level security;
alter table public.learner_exam_goals force row level security;
revoke all on public.learner_exam_goals from public, anon, authenticated;
drop policy if exists learner_exam_goals_select_own on public.learner_exam_goals;
create policy learner_exam_goals_select_own
  on public.learner_exam_goals for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists learner_exam_goals_insert_own on public.learner_exam_goals;
create policy learner_exam_goals_insert_own
  on public.learner_exam_goals for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists learner_exam_goals_update_own on public.learner_exam_goals;
create policy learner_exam_goals_update_own
  on public.learner_exam_goals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update on public.learner_exam_goals to authenticated;
grant select on public.learner_exam_goals to service_role;

-- devices --------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_label text,
  installation_id text not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint devices_id_user_unique unique (id, user_id),
  constraint devices_installation_unique unique (user_id, installation_id),
  constraint devices_installation_format check (installation_id ~ '^[A-Za-z0-9._-]{8,128}$'),
  constraint devices_label_length check (device_label is null or char_length(device_label) between 1 and 120)
);
comment on table public.devices is
  'CDEM §3 · dispositivos del aprendiz (REQ-C15). Un installation_id por usuario; la '
  'evidencia referencia el dispositivo que la produjo.';
drop trigger if exists devices_owner_immutable on public.devices;
create trigger devices_owner_immutable
  before update on public.devices
  for each row execute function public.reject_owner_change();

alter table public.devices enable row level security;
alter table public.devices force row level security;
revoke all on public.devices from public, anon, authenticated;
drop policy if exists devices_select_own on public.devices;
create policy devices_select_own
  on public.devices for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists devices_insert_own on public.devices;
create policy devices_insert_own
  on public.devices for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists devices_update_own on public.devices;
create policy devices_update_own
  on public.devices for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update on public.devices to authenticated;
grant select on public.devices to service_role;

-- sync_state -----------------------------------------------------------------------
create table if not exists public.sync_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid not null,
  last_server_event_id uuid,
  last_client_sequence bigint,
  pending_event_count integer not null default 0,
  last_sync_at timestamptz,
  conflict_state text not null default 'NONE',
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id),
  constraint sync_state_device_fk
    foreign key (device_id, user_id) references public.devices (id, user_id) on delete cascade,
  constraint sync_state_pending_non_negative check (pending_event_count >= 0),
  constraint sync_state_conflict_state check (conflict_state in ('NONE', 'CONFLICT'))
);
comment on table public.sync_state is
  'CDEM §21 · EC-012 · estado de sincronización por usuario y dispositivo. Solo el servidor '
  'lo escribe, y solo tras aceptar evidencia: la UI nunca afirma «sincronizado» sin ACK.';
drop trigger if exists sync_state_set_updated_at on public.sync_state;
create trigger sync_state_set_updated_at
  before update on public.sync_state
  for each row execute function public.set_updated_at();
drop trigger if exists sync_state_owner_immutable on public.sync_state;
create trigger sync_state_owner_immutable
  before update on public.sync_state
  for each row execute function public.reject_owner_change();

alter table public.sync_state enable row level security;
alter table public.sync_state force row level security;
revoke all on public.sync_state from public, anon, authenticated;
drop policy if exists sync_state_select_own on public.sync_state;
create policy sync_state_select_own
  on public.sync_state for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.sync_state to authenticated;
grant select on public.sync_state to service_role;

-- diagnostic_runs ------------------------------------------------------------------
create table if not exists public.diagnostic_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  learner_exam_goal_id uuid not null,
  status public.diagnostic_run_status not null default 'PENDING',
  started_at timestamptz,
  completed_at timestamptz,
  skipped_at timestamptz,
  diagnostic_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnostic_runs_id_user_unique unique (id, user_id),
  constraint diagnostic_runs_goal_fk
    foreign key (learner_exam_goal_id, user_id) references public.learner_exam_goals (id, user_id) on delete cascade,
  constraint diagnostic_runs_version_format check (diagnostic_version ~ '^[a-z0-9][a-z0-9._-]{0,31}$'),
  constraint diagnostic_runs_timestamps_match_status check (
    (status = 'PENDING' and started_at is null and completed_at is null and skipped_at is null)
    or (status = 'IN_PROGRESS' and started_at is not null and completed_at is null and skipped_at is null)
    or (status = 'COMPLETED' and started_at is not null and completed_at is not null and skipped_at is null)
    or (status = 'SKIPPED' and completed_at is null and skipped_at is not null)
  )
);
comment on table public.diagnostic_runs is
  'CDEM §13 · REQ-C14 · ejecución de diagnóstico enlazada al objetivo. Estructural en Phase 2: '
  'los intentos de diagnóstico se distinguen por diagnostic_run_id; ninguna estimación (Phase 3).';

create or replace function public.check_diagnostic_run_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.learner_exam_goal_id is distinct from old.learner_exam_goal_id
     or new.diagnostic_version is distinct from old.diagnostic_version then
    raise exception 'CDEM §13 · objetivo y versión del diagnóstico son inmutables'
      using errcode = 'restrict_violation';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if old.status in ('COMPLETED', 'SKIPPED') then
    raise exception 'CDEM §13 · un diagnóstico % no cambia de estado', old.status
      using errcode = 'restrict_violation';
  end if;
  if old.status = 'PENDING' and new.status in ('IN_PROGRESS', 'SKIPPED') then
    return new;
  end if;
  if old.status = 'IN_PROGRESS' and new.status = 'COMPLETED' then
    return new;
  end if;
  raise exception 'CDEM §13 · transición de diagnóstico no admitida: % → %', old.status, new.status
    using errcode = 'restrict_violation';
end;
$$;
revoke all on function public.check_diagnostic_run_transition() from public, anon, authenticated, service_role;
drop trigger if exists diagnostic_runs_transition on public.diagnostic_runs;
create trigger diagnostic_runs_transition
  before update on public.diagnostic_runs
  for each row execute function public.check_diagnostic_run_transition();
drop trigger if exists diagnostic_runs_set_updated_at on public.diagnostic_runs;
create trigger diagnostic_runs_set_updated_at
  before update on public.diagnostic_runs
  for each row execute function public.set_updated_at();
drop trigger if exists diagnostic_runs_owner_immutable on public.diagnostic_runs;
create trigger diagnostic_runs_owner_immutable
  before update on public.diagnostic_runs
  for each row execute function public.reject_owner_change();

alter table public.diagnostic_runs enable row level security;
alter table public.diagnostic_runs force row level security;
revoke all on public.diagnostic_runs from public, anon, authenticated;
drop policy if exists diagnostic_runs_select_own on public.diagnostic_runs;
create policy diagnostic_runs_select_own
  on public.diagnostic_runs for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists diagnostic_runs_insert_own on public.diagnostic_runs;
create policy diagnostic_runs_insert_own
  on public.diagnostic_runs for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists diagnostic_runs_update_own on public.diagnostic_runs;
create policy diagnostic_runs_update_own
  on public.diagnostic_runs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update on public.diagnostic_runs to authenticated;
grant select on public.diagnostic_runs to service_role;
