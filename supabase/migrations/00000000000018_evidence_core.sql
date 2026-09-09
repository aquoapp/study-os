-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 18 · Núcleo de evidencia (Phase 2 · slices S4 y S5 · nodos N18 y N19)
--
-- ADR-008 (ACCEPTED · implementación autorizada 2026-09-09): stream_position por usuario,
--   monotónica y sin huecos; contador bloqueado con SELECT … FOR UPDATE antes de comprobar
--   event_id; idempotencia solo si coinciden usuario y hash canónico; conflicto → rollback
--   entero, sin posición consumida; sin ON CONFLICT DO NOTHING; mismo orden y triple
--   coincidencia en question_attempts; client_created_at conserva la semántica temporal.
-- SD-022 · contrato de canonicalización v1 (forma canónica CJF-1, conjuntos exactos de
--   campos, SHA-256 hex, versión por fila).
-- SD-023 · autoridad de representación y de tiempo: la representación es la presentada y
--   verificada; la clave la resuelve el servidor para esa representación; campos
--   autoritativos del cliente rechazados; intento inmutable.
-- SD-008 · escala de confianza v1 (cuatro niveles), antes del feedback.
-- CDEM §10 (append-only, idempotente por event_id, payload validado por esquema, nunca se
--   edita), §11 (taxonomía P0), §12 (question_attempts), reglas de integridad («un evento no
--   referencia sesión/dispositivo de otro usuario»; «un intento referencia la clave usada»).
-- EC-005, EC-007, EC-009, EC-012, EC-013 · INV-101 (la clave nunca llega antes del envío;
--   la corrección ocurre en servidor y devuelve resultado + explicación) · INV-102 · Manifest
--   §14 (nunca un user_id del cliente).
-- H-P2-3 · `append_learning_event` es la primera RPC invocable por cliente: única vía de
--   escritura de evidencia, SECURITY DEFINER endurecida, identidad exclusivamente de
--   auth.uid(), registrada en authority-registry.json (clientInvokableRpcs).
-- Rollback: supabase/migrations/down/00000000000018_evidence_core.down.sql
-- ---------------------------------------------------------------------------

-- Tipos ----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'learning_event_type' and n.nspname = 'public') then
    create type public.learning_event_type as enum (
      'SESSION_STARTED', 'SESSION_INTERRUPTED', 'SESSION_RESUMED', 'SESSION_COMPLETED',
      'SESSION_ITEM_STARTED', 'SESSION_ITEM_COMPLETED',
      'LEARNING_UNIT_VIEWED', 'LEARNING_UNIT_COMPLETED', 'HELP_REQUESTED',
      'ALREADY_KNOW_CLAIMED', 'ALREADY_KNOW_CHECKED', 'INTERVENTION_SHOWN', 'INTERVENTION_COMPLETED',
      'QUESTION_PRESENTED', 'ANSWER_SELECTED', 'ANSWER_SUBMITTED', 'CONFIDENCE_RECORDED', 'FEEDBACK_VIEWED',
      'PRACTICAL_STARTED', 'PRACTICAL_COMPLETED', 'SIMULATION_STARTED', 'SIMULATION_COMPLETED',
      'AVAILABILITY_CHANGED', 'TODAY_OVERRIDE_SET', 'RESCUE_MODE_ENTERED', 'REPLAN_CONFIRMED', 'RECOVERY_STARTED',
      'NOTE_CREATED', 'NOTE_UPDATED', 'NOTE_REMEMBER_FLAGGED', 'PERSONAL_MATERIAL_APPROVED',
      'SYNC_PENDING', 'SYNC_CONFIRMED', 'SOURCE_UPDATE_ACKNOWLEDGED'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'answer_kind' and n.nspname = 'public') then
    create type public.answer_kind as enum ('OPTION', 'BLANK');
  end if;
end
$$;
-- Los comentarios de los objetos de `public` los publica PostgREST como descripciones del
-- OpenAPI: no nombran ningún objeto de los esquemas no expuestos (ADR-011).
comment on type public.learning_event_type is
  'CDEM §11 · taxonomía P0 completa. Phase 2 acepta los tipos con esquema de payload '
  'declarado en la frontera de ingestión; el resto se rechaza hasta que su fase los produzca.';
comment on type public.answer_kind is
  'SD-022 · SD-023 · una respuesta es una opción elegida o un blanco explícito (REQ-C08).';

-- Contadores (ADR-008 puntos 2 y «mismo orden») · en ingest: nunca visibles al cliente -----
create table if not exists ingest.user_event_counters (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  next_position bigint not null default 1,
  constraint user_event_counters_positive check (next_position >= 1)
);
comment on table ingest.user_event_counters is
  'ADR-008 · siguiente stream_position por usuario. Se bloquea con SELECT … FOR UPDATE en la '
  'transacción que acepta el evento; solo avanza cuando el evento se inserta.';
alter table ingest.user_event_counters enable row level security;
alter table ingest.user_event_counters force row level security;
revoke all on ingest.user_event_counters from public, anon, authenticated;
grant select on ingest.user_event_counters to service_role;

create table if not exists ingest.user_question_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.canonical_questions (id) on delete restrict,
  next_attempt_number integer not null default 1,
  primary key (user_id, question_id),
  constraint user_question_counters_positive check (next_attempt_number >= 1)
);
comment on table ingest.user_question_counters is
  'ADR-008 · siguiente attempt_number por (usuario, pregunta). Mismo orden que el stream: '
  'bloqueo, comprobación de submitted_event_id, triple coincidencia, y solo entonces número.';
alter table ingest.user_question_counters enable row level security;
alter table ingest.user_question_counters force row level security;
revoke all on ingest.user_question_counters from public, anon, authenticated;
grant select on ingest.user_question_counters to service_role;

-- Escala de confianza (SD-008 · BD-03) ------------------------------------------------------
create table if not exists public.confidence_scales (
  version text primary key,
  levels smallint not null,
  labels jsonb not null,
  status text not null default 'ACTIVE',
  activated_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint confidence_scales_version_format check (version ~ '^v[0-9]{1,3}$'),
  constraint confidence_scales_levels_range check (levels between 2 and 10),
  constraint confidence_scales_labels_shape check (jsonb_typeof(labels) = 'array' and jsonb_array_length(labels) = levels),
  constraint confidence_scales_status check (status in ('ACTIVE', 'RETIRED')),
  constraint confidence_scales_retired_consistency check ((status = 'RETIRED') = (retired_at is not null))
);
comment on table public.confidence_scales is
  'SD-008 · registro versionado de la escala de confianza. Una escala nunca se edita: cambiarla '
  'es publicar otra versión y retirar la anterior, porque la calibración acumulada depende de ella.';
create unique index if not exists confidence_scales_one_active
  on public.confidence_scales (status) where status = 'ACTIVE';

create or replace function public.reject_confidence_scale_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'SD-008 · una escala de confianza no se borra' using errcode = 'restrict_violation';
  end if;
  if new.version is distinct from old.version or new.levels is distinct from old.levels
     or new.labels is distinct from old.labels or new.activated_at is distinct from old.activated_at then
    raise exception 'SD-008 · una escala de confianza es inmutable: publica una versión nueva'
      using errcode = 'restrict_violation';
  end if;
  if new.status is distinct from old.status and not (old.status = 'ACTIVE' and new.status = 'RETIRED') then
    raise exception 'SD-008 · una escala solo pasa de ACTIVE a RETIRED' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_confidence_scale_mutation() from public, anon, authenticated, service_role;
drop trigger if exists confidence_scales_immutable on public.confidence_scales;
create trigger confidence_scales_immutable
  before update or delete on public.confidence_scales
  for each row execute function public.reject_confidence_scale_mutation();

insert into public.confidence_scales (version, levels, labels, status)
select 'v1', 4, '["Nada segura", "Dudosa", "Bastante", "Segura"]'::jsonb, 'ACTIVE'
where not exists (select 1 from public.confidence_scales where version = 'v1');

alter table public.confidence_scales enable row level security;
alter table public.confidence_scales force row level security;
revoke all on public.confidence_scales from public, anon, authenticated;
drop policy if exists confidence_scales_select_authenticated on public.confidence_scales;
create policy confidence_scales_select_authenticated
  on public.confidence_scales for select to authenticated
  using (true);
grant select on public.confidence_scales to authenticated;
grant select on public.confidence_scales to service_role;

-- learning_events -------------------------------------------------------------------
create table if not exists public.learning_events (
  event_id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid,
  session_id uuid,
  session_item_id uuid,
  event_type public.learning_event_type not null,
  schema_version integer not null,
  payload jsonb not null,
  client_created_at timestamptz not null,
  client_sequence bigint,
  server_received_at timestamptz not null default now(),
  engine_processed_at timestamptz,
  created_offline boolean not null default false,
  source_event_id uuid references public.learning_events (event_id),
  stream_position bigint not null,
  payload_hash text not null,
  canonicalization_version text not null,
  constraint learning_events_stream_unique unique (user_id, stream_position),
  constraint learning_events_id_user_unique unique (event_id, user_id),
  constraint learning_events_device_fk
    foreign key (device_id, user_id) references public.devices (id, user_id) on delete cascade,
  constraint learning_events_session_fk
    foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete cascade,
  constraint learning_events_item_fk
    foreign key (session_item_id, session_id) references public.session_items (id, session_id) on delete cascade,
  constraint learning_events_item_requires_session check (session_item_id is null or session_id is not null),
  constraint learning_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint learning_events_hash_format check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint learning_events_position_positive check (stream_position >= 1),
  constraint learning_events_schema_version_positive check (schema_version >= 1),
  constraint learning_events_canonicalization_version check (canonicalization_version = 'v1'),
  constraint learning_events_client_sequence_non_negative check (client_sequence is null or client_sequence >= 0)
);
comment on table public.learning_events is
  'CDEM §10 · ADR-008 · registro canónico de evidencia conductual: append-only, idempotente '
  'por event_id, posición por usuario sin huecos, hash canónico (SD-022). La escribe solo la '
  'función de ingestión de evidencia.';
create index if not exists learning_events_user_received on public.learning_events (user_id, server_received_at);
create index if not exists learning_events_session_position on public.learning_events (session_id, stream_position);

create or replace function public.reject_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'EC-005 · un evento de aprendizaje nunca se edita' using errcode = 'restrict_violation';
  end if;
  if exists (select 1 from public.profiles p where p.id = old.user_id) then
    raise exception 'EC-005 · un evento de aprendizaje solo desaparece con la cuenta' using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;
revoke all on function public.reject_event_mutation() from public, anon, authenticated, service_role;
drop trigger if exists learning_events_append_only on public.learning_events;
create trigger learning_events_append_only
  before update or delete on public.learning_events
  for each row execute function public.reject_event_mutation();

alter table public.learning_events enable row level security;
alter table public.learning_events force row level security;
revoke all on public.learning_events from public, anon, authenticated;
drop policy if exists learning_events_select_own on public.learning_events;
create policy learning_events_select_own
  on public.learning_events for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.learning_events to authenticated;
grant select on public.learning_events to service_role;

alter table public.sync_state
  drop constraint if exists sync_state_last_event_fk;
alter table public.sync_state
  add constraint sync_state_last_event_fk
  foreign key (last_server_event_id) references public.learning_events (event_id) on delete set null;

-- question_attempts -----------------------------------------------------------------
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.canonical_questions (id) on delete restrict,
  question_representation_id uuid not null,
  answer_key_version_id uuid not null references content.answer_key_versions (id) on delete restrict,
  session_id uuid not null,
  session_item_id uuid not null,
  diagnostic_run_id uuid,
  submitted_event_id uuid not null,
  answer_kind public.answer_kind not null,
  selected_option_id uuid,
  is_correct_at_submission boolean not null,
  confidence_value smallint,
  confidence_scale_version text references public.confidence_scales (version),
  response_ms integer,
  presented_option_order uuid[],
  attempt_number integer not null,
  answer_payload_hash text not null,
  canonicalization_version text not null,
  submitted_at timestamptz not null,
  graded_at timestamptz not null default now(),
  constraint question_attempts_submitted_event_unique unique (submitted_event_id),
  constraint question_attempts_number_unique unique (user_id, question_id, attempt_number),
  constraint question_attempts_representation_fk
    foreign key (question_representation_id, question_id) references public.question_representations (id, question_id),
  constraint question_attempts_option_fk
    foreign key (selected_option_id, question_representation_id) references public.question_options (id, representation_id),
  constraint question_attempts_session_fk
    foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete cascade,
  constraint question_attempts_item_fk
    foreign key (session_item_id, session_id) references public.session_items (id, session_id) on delete cascade,
  constraint question_attempts_event_fk
    foreign key (submitted_event_id, user_id) references public.learning_events (event_id, user_id) on delete cascade,
  constraint question_attempts_diagnostic_fk
    foreign key (diagnostic_run_id, user_id) references public.diagnostic_runs (id, user_id),
  constraint question_attempts_blank_means_no_option check ((answer_kind = 'BLANK') = (selected_option_id is null)),
  constraint question_attempts_blank_never_correct check (answer_kind = 'OPTION' or is_correct_at_submission = false),
  constraint question_attempts_option_requires_confidence check (answer_kind = 'BLANK' or confidence_value is not null),
  constraint question_attempts_confidence_pair check ((confidence_value is null) = (confidence_scale_version is null)),
  constraint question_attempts_confidence_range check (confidence_value is null or confidence_value between 1 and 10),
  constraint question_attempts_response_ms_range check (response_ms is null or response_ms between 0 and 86400000),
  constraint question_attempts_number_positive check (attempt_number >= 1),
  constraint question_attempts_hash_format check (answer_payload_hash ~ '^[0-9a-f]{64}$'),
  constraint question_attempts_canonicalization_version check (canonicalization_version = 'v1')
);
comment on table public.question_attempts is
  'CDEM §12 · EC-007 · SD-021 · SD-023 · evidencia normalizada de una respuesta: representación '
  'presentada, versión de clave usada (resuelta en servidor), corrección en el envío, confianza '
  'con versión de escala, blanco explícito. Inmutable; el recálculo es un registro aparte (Phase 10).';
create index if not exists question_attempts_user_question_time
  on public.question_attempts (user_id, question_id, submitted_at);
create index if not exists question_attempts_item on public.question_attempts (session_item_id);

create or replace function public.reject_attempt_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'EC-007 · un intento nunca se reescribe: la rectificación crea recálculo'
      using errcode = 'restrict_violation';
  end if;
  if exists (select 1 from public.profiles p where p.id = old.user_id) then
    raise exception 'EC-007 · un intento solo desaparece con la cuenta' using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;
revoke all on function public.reject_attempt_mutation() from public, anon, authenticated, service_role;
drop trigger if exists question_attempts_immutable on public.question_attempts;
create trigger question_attempts_immutable
  before update or delete on public.question_attempts
  for each row execute function public.reject_attempt_mutation();

alter table public.question_attempts enable row level security;
alter table public.question_attempts force row level security;
revoke all on public.question_attempts from public, anon, authenticated;
drop policy if exists question_attempts_select_own on public.question_attempts;
create policy question_attempts_select_own
  on public.question_attempts for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.question_attempts to authenticated;
grant select on public.question_attempts to service_role;

-- Canonicalización v1 (SD-022) --------------------------------------------------------------
create or replace function ingest.canonical_string(p text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  s text := normalize(p, NFC);
  i integer;
begin
  s := replace(s, '\', '\\');
  s := replace(s, '"', '\"');
  s := replace(s, E'\n', '\n');
  s := replace(s, E'\r', '\r');
  s := replace(s, E'\t', '\t');
  s := replace(s, E'\b', '\b');
  s := replace(s, E'\f', '\f');
  for i in 1..31 loop
    if i not in (8, 9, 10, 12, 13) then
      s := replace(s, chr(i), '\u00' || lpad(to_hex(i), 2, '0'));
    end if;
  end loop;
  return '"' || s || '"';
end;
$$;
revoke all on function ingest.canonical_string(text) from public, anon, authenticated, service_role;

create or replace function ingest.canonical_text(p jsonb)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  kind text := jsonb_typeof(p);
  out text;
  first boolean := true;
  e jsonb;
  k text;
  s text;
  keys text[];
begin
  if p is null or kind = 'null' then
    return 'null';
  elsif kind = 'boolean' then
    return case when p = 'true'::jsonb then 'true' else 'false' end;
  elsif kind = 'number' then
    s := p::text;
    if s !~ '^-?[0-9]+$' then
      raise exception 'SD-022 · solo se admiten enteros en un payload con hash: %', s
        using errcode = 'invalid_parameter_value';
    end if;
    if abs(s::numeric) > 9007199254740991 then
      raise exception 'SD-022 · entero fuera del rango seguro: %', s using errcode = 'invalid_parameter_value';
    end if;
    return case when s = '-0' then '0' else s end;
  elsif kind = 'string' then
    return ingest.canonical_string(p #>> '{}');
  elsif kind = 'array' then
    out := '[';
    for e in select value from jsonb_array_elements(p) loop
      if not first then out := out || ','; end if;
      first := false;
      out := out || ingest.canonical_text(e);
    end loop;
    return out || ']';
  end if;
  -- Objeto: claves normalizadas a NFC y ordenadas por punto de código (orden de bytes UTF-8).
  select array_agg(normalize(key, NFC) order by normalize(key, NFC) collate "C") into keys from jsonb_object_keys(p) as key;
  if keys is not null and (select count(distinct k2) from unnest(keys) k2) <> array_length(keys, 1) then
    raise exception 'SD-022 · dos claves distintas coinciden tras NFC' using errcode = 'invalid_parameter_value';
  end if;
  out := '{';
  for k, e in select normalize(key, NFC), value from jsonb_each(p) order by normalize(key, NFC) collate "C" loop
    if not first then out := out || ','; end if;
    first := false;
    out := out || ingest.canonical_string(k) || ':' || ingest.canonical_text(e);
  end loop;
  return out || '}';
end;
$$;
comment on function ingest.canonical_text(jsonb) is
  'SD-022 · forma canónica CJF-1: claves NFC ordenadas por punto de código, cadenas NFC con '
  'escapes fijos, solo enteros, arrays en orden, ausente ≠ nulo.';
revoke all on function ingest.canonical_text(jsonb) from public, anon, authenticated, service_role;
grant execute on function ingest.canonical_text(jsonb) to service_role;

create or replace function ingest.canonical_hash(p jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(ingest.canonical_text(p), 'UTF8'), 'sha256'), 'hex');
$$;
comment on function ingest.canonical_hash(jsonb) is
  'SD-022 · SHA-256 (hex minúsculas) sobre los bytes UTF-8 del texto canónico. Versión v1.';
revoke all on function ingest.canonical_hash(jsonb) from public, anon, authenticated, service_role;
grant execute on function ingest.canonical_hash(jsonb) to service_role;

create or replace function ingest.canonical_timestamp(p timestamptz)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;
revoke all on function ingest.canonical_timestamp(timestamptz) from public, anon, authenticated, service_role;
grant execute on function ingest.canonical_timestamp(timestamptz) to service_role;

-- Esquemas de evento v1 (CDEM §10 «payload validated by event schema» · REQ-C06) ---------------
-- Cada tipo aceptado declara sus claves obligatorias y opcionales con su tipo. Los tipos sin
-- esquema se rechazan: su fase productora no existe todavía y aceptarlos sin validación
-- abriría un hueco de evidencia no verificable. Se refleja en @study-os/domain (EVENT_SCHEMAS_V1).
create or replace function ingest.event_field_types(p_type text)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_type
    when 'SESSION_STARTED' then '{"scope":"session","required":{},"optional":{}}'::jsonb
    when 'SESSION_INTERRUPTED' then '{"scope":"session","required":{},"optional":{"reason":"string"}}'::jsonb
    when 'SESSION_RESUMED' then '{"scope":"session","required":{},"optional":{}}'::jsonb
    when 'SESSION_COMPLETED' then '{"scope":"session","required":{},"optional":{}}'::jsonb
    when 'SESSION_ITEM_STARTED' then '{"scope":"item","required":{},"optional":{}}'::jsonb
    when 'SESSION_ITEM_COMPLETED' then '{"scope":"item","required":{},"optional":{}}'::jsonb
    when 'LEARNING_UNIT_VIEWED' then '{"scope":"item","item_type":"LEARNING_UNIT","required":{"learning_unit_version_id":"uuid"},"optional":{}}'::jsonb
    when 'LEARNING_UNIT_COMPLETED' then '{"scope":"item","item_type":"LEARNING_UNIT","required":{},"optional":{}}'::jsonb
    when 'HELP_REQUESTED' then '{"scope":"item","required":{},"optional":{"topic":"string"}}'::jsonb
    when 'ALREADY_KNOW_CLAIMED' then '{"scope":"item","required":{},"optional":{}}'::jsonb
    when 'QUESTION_PRESENTED' then '{"scope":"item","item_type":"QUESTION","required":{"question_representation_id":"uuid"},"optional":{"presented_option_order":"uuid_array"}}'::jsonb
    when 'ANSWER_SELECTED' then '{"scope":"item","item_type":"QUESTION","required":{"question_representation_id":"uuid","selected_option_id":"uuid"},"optional":{}}'::jsonb
    when 'CONFIDENCE_RECORDED' then '{"scope":"item","item_type":"QUESTION","required":{"confidence_value":"integer","confidence_scale_version":"string"},"optional":{}}'::jsonb
    when 'ANSWER_SUBMITTED' then '{"scope":"item","item_type":"QUESTION","required":{"question_representation_id":"uuid","answer_kind":"string"},"optional":{"selected_option_id":"uuid","presented_option_order":"uuid_array","confidence_value":"integer","confidence_scale_version":"string","response_ms":"integer"}}'::jsonb
    when 'FEEDBACK_VIEWED' then '{"scope":"item","item_type":"QUESTION","required":{},"optional":{}}'::jsonb
    when 'PRACTICAL_STARTED' then '{"scope":"item","item_type":"PRACTICAL","required":{},"optional":{}}'::jsonb
    when 'PRACTICAL_COMPLETED' then '{"scope":"item","item_type":"PRACTICAL","required":{},"optional":{}}'::jsonb
    when 'AVAILABILITY_CHANGED' then '{"scope":"user","required":{"default_daily_minutes":"integer","weekly_availability_json":"object"},"optional":{}}'::jsonb
    else null
  end;
$$;
revoke all on function ingest.event_field_types(text) from public, anon, authenticated, service_role;
grant execute on function ingest.event_field_types(text) to service_role;

create or replace function ingest.jsonb_has_type(p_value jsonb, p_type text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_type
    when 'uuid' then jsonb_typeof(p_value) = 'string'
      and (p_value #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    when 'string' then jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') between 1 and 4000
    when 'integer' then jsonb_typeof(p_value) = 'number' and p_value::text ~ '^-?[0-9]{1,15}$'
    when 'boolean' then jsonb_typeof(p_value) = 'boolean'
    when 'object' then jsonb_typeof(p_value) = 'object'
    when 'uuid_array' then jsonb_typeof(p_value) = 'array'
      and jsonb_array_length(p_value) between 1 and 64
      and not exists (select 1 from jsonb_array_elements(p_value) e
                      where jsonb_typeof(e) <> 'string'
                         or (e #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    else false
  end;
$$;
revoke all on function ingest.jsonb_has_type(jsonb, text) from public, anon, authenticated, service_role;

-- Valida el payload contra el esquema del tipo y devuelve el payload normalizado
-- (UUID en minúsculas, SD-022 regla 7). Claves autoritativas del cliente: rechazo (SD-023 §4).
create or replace function ingest.normalize_event_payload(p_type text, p_schema_version integer, p_payload jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  schema jsonb := ingest.event_field_types(p_type);
  forbidden text[] := array['user_id', 'stream_position', 'server_received_at', 'engine_processed_at',
                            'attempt_number', 'is_correct_at_submission', 'correct_option_id', 'answer_key_version_id',
                            'payload_hash', 'canonicalization_version'];
  k text;
  declared text;
  out jsonb := '{}'::jsonb;
  v jsonb;
begin
  if schema is null then
    raise exception 'STUDY_OS_EVENT · EVENT_TYPE_NOT_ACCEPTED · %', p_type using errcode = 'invalid_parameter_value';
  end if;
  if p_schema_version <> 1 then
    raise exception 'STUDY_OS_EVENT · SCHEMA_VERSION_UNSUPPORTED · %', p_schema_version using errcode = 'invalid_parameter_value';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'STUDY_OS_EVENT · PAYLOAD_MALFORMED' using errcode = 'invalid_parameter_value';
  end if;
  for k in select jsonb_object_keys(p_payload) loop
    if k = any (forbidden) then
      raise exception 'STUDY_OS_EVENT · AUTHORITATIVE_FIELD_REJECTED · %', k using errcode = 'invalid_parameter_value';
    end if;
    declared := coalesce(schema->'required'->>k, schema->'optional'->>k);
    if declared is null then
      raise exception 'STUDY_OS_EVENT · PAYLOAD_UNKNOWN_KEY · %', k using errcode = 'invalid_parameter_value';
    end if;
    v := p_payload->k;
    if not ingest.jsonb_has_type(v, declared) then
      raise exception 'STUDY_OS_EVENT · PAYLOAD_TYPE · % (%)', k, declared using errcode = 'invalid_parameter_value';
    end if;
    if declared = 'uuid' then
      out := out || jsonb_build_object(k, lower(v #>> '{}'));
    elsif declared = 'uuid_array' then
      out := out || jsonb_build_object(k, (select jsonb_agg(lower(e #>> '{}')) from jsonb_array_elements(v) e));
    else
      out := out || jsonb_build_object(k, v);
    end if;
  end loop;
  for k in select jsonb_object_keys(schema->'required') loop
    if not (p_payload ? k) then
      raise exception 'STUDY_OS_EVENT · PAYLOAD_MISSING · %', k using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  return out;
end;
$$;
revoke all on function ingest.normalize_event_payload(text, integer, jsonb) from public, anon, authenticated, service_role;
grant execute on function ingest.normalize_event_payload(text, integer, jsonb) to service_role;

-- Resolución de clave (SD-023 §3) ----------------------------------------------------------
create or replace function ingest.resolve_answer_key(p_representation_id uuid)
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  key_id uuid;
  rep record;
begin
  -- a + b · claves de la representación presentada, vigente por fechas del servidor.
  select k.id into key_id
    from content.answer_key_versions k
   where k.representation_id = p_representation_id
     and k.effective_from <= current_date
     and (k.effective_to is null or k.effective_to > current_date)
   order by k.effective_from desc, k.created_at desc
   limit 1;
  if key_id is not null then
    return key_id;
  end if;
  -- c · representación superseded o retirada: la última clave que la evaluó.
  select r.status, r.superseded_by_representation_id into rep
    from public.question_representations r where r.id = p_representation_id;
  if rep.superseded_by_representation_id is not null or rep.status = 'RETIRED' then
    select k.id into key_id
      from content.answer_key_versions k
     where k.representation_id = p_representation_id
     order by k.effective_from desc, k.created_at desc
     limit 1;
  end if;
  -- d · sin clave: null; quien llama rechaza (NO_ANSWER_KEY). Nunca «la clave más reciente de la pregunta».
  return key_id;
end;
$$;
comment on function ingest.resolve_answer_key(uuid) is
  'SD-023 §3 · clave para la representación presentada: vigente por fechas del servidor; si la '
  'representación fue superseded, la última que la evaluó; nunca la clave vigente de otra representación.';
revoke all on function ingest.resolve_answer_key(uuid) from public, anon, authenticated, service_role;

create or replace function ingest.validate_confidence(p_value integer, p_version text)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  scale record;
begin
  select s.levels, s.status into scale from public.confidence_scales s where s.version = p_version;
  if scale.levels is null or scale.status <> 'ACTIVE' then
    raise exception 'STUDY_OS_EVENT · CONFIDENCE_SCALE_INACTIVE · %', coalesce(p_version, '(null)')
      using errcode = 'invalid_parameter_value';
  end if;
  if p_value is null or p_value < 1 or p_value > scale.levels then
    raise exception 'STUDY_OS_EVENT · CONFIDENCE_OUT_OF_RANGE · %', coalesce(p_value::text, '(null)')
      using errcode = 'invalid_parameter_value';
  end if;
end;
$$;
revoke all on function ingest.validate_confidence(integer, text) from public, anon, authenticated, service_role;

-- Resultado de un intento tal como se devuelve al cliente tras existir la fila (INV-101):
-- resultado + explicación + opción correcta de la representación presentada. Nunca antes.
create or replace function ingest.attempt_outcome(p_attempt_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'attempt_number', a.attempt_number,
    'question_id', a.question_id,
    'question_representation_id', a.question_representation_id,
    'answer_kind', a.answer_kind::text,
    'selected_option_id', a.selected_option_id,
    'is_correct', a.is_correct_at_submission,
    'correct_option_id', k.correct_option_id,
    'explanation', k.explanation,
    'confidence_value', a.confidence_value,
    'confidence_scale_version', a.confidence_scale_version,
    'submitted_at', ingest.canonical_timestamp(a.submitted_at)
  )
  from public.question_attempts a
  join content.answer_key_versions k on k.id = a.answer_key_version_id
  where a.id = p_attempt_id;
$$;
revoke all on function ingest.attempt_outcome(uuid) from public, anon, authenticated, service_role;

-- Normalización del intento (ADR-008 «mismo orden» · SD-022 · SD-023 · EC-007) ----------------
create or replace function ingest.normalize_attempt(
  p_user uuid,
  p_event_id uuid,
  p_session_id uuid,
  p_item_id uuid,
  p_payload jsonb,
  p_client_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  it record;
  existing record;
  n integer;
  kind public.answer_kind;
  rep uuid;
  option_id uuid;
  order_ids uuid[];
  conf integer;
  conf_version text;
  rms integer;
  key_id uuid;
  correct uuid;
  is_correct boolean;
  hash_input jsonb;
  answer_hash text;
  attempt_id uuid;
begin
  select i.id, i.question_id, i.presented_representation_id, i.item_type, i.status into it
    from public.session_items i where i.id = p_item_id and i.session_id = p_session_id and i.user_id = p_user;
  if it.id is null then
    raise exception 'STUDY_OS_EVENT · ITEM_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  if it.item_type <> 'QUESTION' then
    raise exception 'STUDY_OS_EVENT · ITEM_TYPE_MISMATCH · QUESTION' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- 1 · bloquear el contador del par (usuario, pregunta).
  select c.next_attempt_number into n from ingest.user_question_counters c
   where c.user_id = p_user and c.question_id = it.question_id for update;
  if n is null then
    begin
      insert into ingest.user_question_counters (user_id, question_id) values (p_user, it.question_id);
    exception when unique_violation then
      null;
    end;
    select c.next_attempt_number into n from ingest.user_question_counters c
     where c.user_id = p_user and c.question_id = it.question_id for update;
  end if;

  -- SD-023 §2 · representación presentada y verificada; la respuesta la referencia exactamente.
  if it.presented_representation_id is null then
    raise exception 'STUDY_OS_EVENT · NOT_PRESENTED' using errcode = 'object_not_in_prerequisite_state';
  end if;
  rep := (p_payload->>'question_representation_id')::uuid;
  if rep is distinct from it.presented_representation_id then
    raise exception 'STUDY_OS_EVENT · REPRESENTATION_MISMATCH' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- Respuesta: opción de la representación presentada o blanco explícito (REQ-C08).
  begin
    kind := (p_payload->>'answer_kind')::public.answer_kind;
  exception when invalid_text_representation then
    raise exception 'STUDY_OS_EVENT · ANSWER_KIND_MALFORMED' using errcode = 'invalid_parameter_value';
  end;
  option_id := (p_payload->>'selected_option_id')::uuid;
  if kind = 'OPTION' then
    if option_id is null then
      raise exception 'STUDY_OS_EVENT · OPTION_REQUIRED' using errcode = 'invalid_parameter_value';
    end if;
    if not exists (select 1 from public.question_options o where o.id = option_id and o.representation_id = rep) then
      raise exception 'STUDY_OS_EVENT · OPTION_NOT_IN_REPRESENTATION' using errcode = 'object_not_in_prerequisite_state';
    end if;
  elsif option_id is not null then
    raise exception 'STUDY_OS_EVENT · BLANK_WITH_OPTION' using errcode = 'invalid_parameter_value';
  end if;
  if p_payload ? 'presented_option_order' then
    select array_agg((e #>> '{}')::uuid) into order_ids from jsonb_array_elements(p_payload->'presented_option_order') e;
    if (select count(*) from unnest(order_ids) x) <> (select count(distinct x) from unnest(order_ids) x)
       or (select count(*) from public.question_options o where o.representation_id = rep) <> array_length(order_ids, 1)
       or exists (select 1 from unnest(order_ids) x
                  where not exists (select 1 from public.question_options o where o.id = x and o.representation_id = rep)) then
      raise exception 'STUDY_OS_EVENT · PRESENTED_ORDER_NOT_A_PERMUTATION' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  -- SD-008 · confianza antes del feedback: obligatoria con opción, validada contra la escala activa.
  conf := (p_payload->>'confidence_value')::integer;
  conf_version := p_payload->>'confidence_scale_version';
  if conf is not null or conf_version is not null then
    perform ingest.validate_confidence(conf, conf_version);
  elsif kind = 'OPTION' then
    raise exception 'STUDY_OS_EVENT · CONFIDENCE_REQUIRED' using errcode = 'invalid_parameter_value';
  end if;
  rms := (p_payload->>'response_ms')::integer;
  if rms is not null and (rms < 0 or rms > 86400000) then
    raise exception 'STUDY_OS_EVENT · RESPONSE_MS_OUT_OF_RANGE' using errcode = 'invalid_parameter_value';
  end if;

  -- SD-023 §3 · clave resuelta en servidor para la representación presentada.
  key_id := ingest.resolve_answer_key(rep);
  if key_id is null then
    raise exception 'STUDY_OS_EVENT · NO_ANSWER_KEY' using errcode = 'object_not_in_prerequisite_state';
  end if;
  select k.correct_option_id into correct from content.answer_key_versions k where k.id = key_id;
  is_correct := kind = 'OPTION' and option_id = correct;

  -- SD-022 · hash canónico del payload completo de la respuesta.
  hash_input := jsonb_build_object(
    'question_id', it.question_id,
    'question_representation_id', rep,
    'answer_kind', kind::text,
    'selected_option_id', option_id,
    'confidence_value', conf,
    'confidence_scale_version', conf_version,
    'response_ms', rms,
    'answer_key_version_id', key_id
  );
  if order_ids is not null then
    hash_input := hash_input || jsonb_build_object('presented_option_order', to_jsonb(order_ids));
  end if;
  answer_hash := ingest.canonical_hash(hash_input);

  -- 2 y 3 · tras el bloqueo, comprobar submitted_event_id y exigir la triple coincidencia.
  select a.id, a.user_id, a.question_id, a.answer_payload_hash into existing
    from public.question_attempts a where a.submitted_event_id = p_event_id;
  if existing.id is not null then
    if existing.user_id <> p_user then
      raise exception 'STUDY_OS_EVENT · ATTEMPT_CONFLICT_OWNER' using errcode = 'integrity_constraint_violation';
    end if;
    if existing.question_id <> it.question_id then
      raise exception 'STUDY_OS_EVENT · ATTEMPT_CONFLICT_QUESTION' using errcode = 'integrity_constraint_violation';
    end if;
    if existing.answer_payload_hash <> answer_hash then
      raise exception 'STUDY_OS_EVENT · ATTEMPT_CONFLICT_PAYLOAD' using errcode = 'integrity_constraint_violation';
    end if;
    return ingest.attempt_outcome(existing.id);
  end if;

  -- 5 · solo para un intento nuevo: número e inserción en la misma transacción.
  update ingest.user_question_counters set next_attempt_number = n + 1
   where user_id = p_user and question_id = it.question_id;
  insert into public.question_attempts (
    user_id, question_id, question_representation_id, answer_key_version_id, session_id, session_item_id,
    submitted_event_id, answer_kind, selected_option_id, is_correct_at_submission,
    confidence_value, confidence_scale_version, response_ms, presented_option_order,
    attempt_number, answer_payload_hash, canonicalization_version, submitted_at
  ) values (
    p_user, it.question_id, rep, key_id, p_session_id, p_item_id,
    p_event_id, kind, option_id, is_correct,
    conf, conf_version, rms, order_ids,
    n, answer_hash, 'v1', p_client_created_at
  ) returning id into attempt_id;
  return ingest.attempt_outcome(attempt_id);
end;
$$;
comment on function ingest.normalize_attempt(uuid, uuid, uuid, uuid, jsonb, timestamptz) is
  'ADR-008 «mismo orden» · SD-023 · normaliza ANSWER_SUBMITTED en un intento inmutable: bloqueo '
  'del contador, representación presentada, clave resuelta en servidor, hash canónico, triple '
  'coincidencia, número de intento solo para un intento nuevo. Solo la invoca append_learning_event.';
revoke all on function ingest.normalize_attempt(uuid, uuid, uuid, uuid, jsonb, timestamptz) from public, anon, authenticated, service_role;

-- Cursor de reanudación materializado (Master §10 · REQ-C10) ----------------------------------
-- Regla: el ítem del último evento de ítem aceptado si no está completado; si lo está, el
-- siguiente no completado por sort_order; si no hay, el primero no completado; si no, nulo.
create or replace function ingest.compute_resume_cursor(p_session_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  last_item record;
  target record;
begin
  select i.id, i.sort_order, i.status, e.event_id, e.stream_position into last_item
    from public.learning_events e
    join public.session_items i on i.id = e.session_item_id
   where e.session_id = p_session_id and e.session_item_id is not null
   order by e.stream_position desc
   limit 1;
  if last_item.id is not null and last_item.status <> 'COMPLETED' then
    return jsonb_build_object('session_item_id', last_item.id, 'sort_order', last_item.sort_order,
                              'after_event_id', last_item.event_id, 'stream_position', last_item.stream_position);
  end if;
  select i.id, i.sort_order into target
    from public.session_items i
   where i.session_id = p_session_id and i.status <> 'COMPLETED'
     and (last_item.id is null or i.sort_order > last_item.sort_order)
   order by i.sort_order
   limit 1;
  if target.id is null then
    select i.id, i.sort_order into target
      from public.session_items i
     where i.session_id = p_session_id and i.status <> 'COMPLETED'
     order by i.sort_order
     limit 1;
  end if;
  if target.id is null then
    return null;
  end if;
  return jsonb_build_object('session_item_id', target.id, 'sort_order', target.sort_order,
                            'after_event_id', last_item.event_id, 'stream_position', last_item.stream_position);
end;
$$;
revoke all on function ingest.compute_resume_cursor(uuid) from public, anon, authenticated, service_role;
grant execute on function ingest.compute_resume_cursor(uuid) to service_role;

-- Aceptación de eventos (ADR-008 puntos 1–9 y 11 · CDEM §26) -----------------------------------
create or replace function ingest.append_learning_event(p_user uuid, p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_envelope text[] := array['event_id', 'event_type', 'schema_version', 'client_created_at', 'payload',
                                   'session_id', 'session_item_id', 'device_id', 'client_sequence',
                                   'created_offline', 'source_event_id'];
  forbidden text[] := array['user_id', 'stream_position', 'server_received_at', 'engine_processed_at',
                            'payload_hash', 'canonicalization_version', 'attempt_number',
                            'is_correct_at_submission', 'correct_option_id', 'answer_key_version_id'];
  k text;
  ev_id uuid;
  ev_type_text text;
  ev_type public.learning_event_type;
  sv integer;
  payload jsonb;
  session uuid;
  item uuid;
  device uuid;
  cseq bigint;
  offline boolean;
  source uuid;
  cca timestamptz;
  schema jsonb;
  pos bigint;
  existing record;
  hash_input jsonb;
  ev_hash text;
  s record;
  it record;
  now_ts timestamptz := clock_timestamp();
  attempt_out jsonb := null;
  rep uuid;
  unit_version uuid;
  order_ids uuid[];
  new_item_status public.session_item_status;
  cursor_out jsonb;
  session_out jsonb := null;
begin
  if p_user is null then
    raise exception 'INV-116 · sin identidad verificada' using errcode = 'insufficient_privilege';
  end if;
  -- Sobre: forma, claves autoritativas rechazadas, claves desconocidas rechazadas.
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'STUDY_OS_EVENT · ENVELOPE_MALFORMED' using errcode = 'invalid_parameter_value';
  end if;
  for k in select jsonb_object_keys(p_event) loop
    if k = any (forbidden) then
      raise exception 'STUDY_OS_EVENT · AUTHORITATIVE_FIELD_REJECTED · %', k using errcode = 'invalid_parameter_value';
    end if;
    if not (k = any (allowed_envelope)) then
      raise exception 'STUDY_OS_EVENT · ENVELOPE_UNKNOWN_KEY · %', k using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  for k in select unnest(array['event_id', 'event_type', 'schema_version', 'client_created_at', 'payload']) loop
    if not (p_event ? k) or p_event->k = 'null'::jsonb then
      raise exception 'STUDY_OS_EVENT · ENVELOPE_MISSING · %', k using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if not ingest.jsonb_has_type(p_event->'event_id', 'uuid')
     or not ingest.jsonb_has_type(p_event->'event_type', 'string')
     or not ingest.jsonb_has_type(p_event->'schema_version', 'integer')
     or not ingest.jsonb_has_type(p_event->'client_created_at', 'string')
     or jsonb_typeof(p_event->'payload') <> 'object'
     or (p_event ? 'session_id' and not ingest.jsonb_has_type(p_event->'session_id', 'uuid'))
     or (p_event ? 'session_item_id' and not ingest.jsonb_has_type(p_event->'session_item_id', 'uuid'))
     or (p_event ? 'device_id' and not ingest.jsonb_has_type(p_event->'device_id', 'uuid'))
     or (p_event ? 'client_sequence' and not ingest.jsonb_has_type(p_event->'client_sequence', 'integer'))
     or (p_event ? 'created_offline' and not ingest.jsonb_has_type(p_event->'created_offline', 'boolean'))
     or (p_event ? 'source_event_id' and not ingest.jsonb_has_type(p_event->'source_event_id', 'uuid')) then
    raise exception 'STUDY_OS_EVENT · ENVELOPE_TYPE' using errcode = 'invalid_parameter_value';
  end if;
  ev_id := (p_event->>'event_id')::uuid;
  ev_type_text := p_event->>'event_type';
  sv := (p_event->>'schema_version')::integer;
  begin
    cca := (p_event->>'client_created_at')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then
    raise exception 'STUDY_OS_EVENT · ENVELOPE_TYPE · client_created_at' using errcode = 'invalid_parameter_value';
  end;
  begin
    ev_type := ev_type_text::public.learning_event_type;
  exception when invalid_text_representation then
    raise exception 'STUDY_OS_EVENT · EVENT_TYPE_UNKNOWN · %', ev_type_text using errcode = 'invalid_parameter_value';
  end;
  session := (p_event->>'session_id')::uuid;
  item := (p_event->>'session_item_id')::uuid;
  device := (p_event->>'device_id')::uuid;
  cseq := (p_event->>'client_sequence')::bigint;
  offline := coalesce((p_event->>'created_offline')::boolean, false);
  source := (p_event->>'source_event_id')::uuid;
  if cseq is not null and cseq < 0 then
    raise exception 'STUDY_OS_EVENT · ENVELOPE_TYPE · client_sequence' using errcode = 'invalid_parameter_value';
  end if;
  payload := ingest.normalize_event_payload(ev_type_text, sv, p_event->'payload');
  schema := ingest.event_field_types(ev_type_text);

  -- ADR-008 punto 2 · bloquear el contador del usuario ANTES de comprobar event_id.
  select c.next_position into pos from ingest.user_event_counters c where c.user_id = p_user for update;
  if pos is null then
    begin
      insert into ingest.user_event_counters (user_id) values (p_user);
    exception when unique_violation then
      null;
    end;
    select c.next_position into pos from ingest.user_event_counters c where c.user_id = p_user for update;
  end if;

  -- SD-022 · hash canónico del sobre y del payload normalizados (ausentes omitidos).
  hash_input := jsonb_build_object(
    'event_type', ev_type_text,
    'schema_version', sv,
    'client_created_at', ingest.canonical_timestamp(cca),
    'payload', payload
  );
  if session is not null then hash_input := hash_input || jsonb_build_object('session_id', session); end if;
  if item is not null then hash_input := hash_input || jsonb_build_object('session_item_id', item); end if;
  if device is not null then hash_input := hash_input || jsonb_build_object('device_id', device); end if;
  if cseq is not null then hash_input := hash_input || jsonb_build_object('client_sequence', cseq); end if;
  if p_event ? 'created_offline' then hash_input := hash_input || jsonb_build_object('created_offline', offline); end if;
  if source is not null then hash_input := hash_input || jsonb_build_object('source_event_id', source); end if;
  ev_hash := ingest.canonical_hash(hash_input);

  -- ADR-008 puntos 3–5 · tras el bloqueo, comprobar event_id.
  select e.user_id, e.payload_hash, e.stream_position, e.server_received_at, e.session_id into existing
    from public.learning_events e where e.event_id = ev_id;
  if existing.user_id is not null then
    if existing.user_id <> p_user then
      raise exception 'STUDY_OS_EVENT · EVENT_ID_CONFLICT_OWNER' using errcode = 'integrity_constraint_violation';
    end if;
    if existing.payload_hash <> ev_hash then
      raise exception 'STUDY_OS_EVENT · EVENT_ID_CONFLICT_PAYLOAD' using errcode = 'integrity_constraint_violation';
    end if;
    if existing.session_id is not null then
      select jsonb_build_object('session_id', ss.id, 'status', ss.status::text, 'resume_cursor', ss.resume_cursor_json)
        into session_out from public.study_sessions ss where ss.id = existing.session_id;
    end if;
    return jsonb_build_object(
      'event_id', ev_id,
      'stream_position', existing.stream_position,
      'payload_hash', ev_hash,
      'canonicalization_version', 'v1',
      'server_received_at', ingest.canonical_timestamp(existing.server_received_at),
      'idempotent', true,
      'session', session_out,
      'attempt', (select ingest.attempt_outcome(a.id) from public.question_attempts a where a.submitted_event_id = ev_id)
    );
  end if;

  -- Propiedad y ámbito (CDEM §23 · Manifest §14). Los mensajes no distinguen «no existe» de «ajeno».
  if device is not null and not exists (select 1 from public.devices d where d.id = device and d.user_id = p_user) then
    raise exception 'STUDY_OS_EVENT · DEVICE_NOT_OWNED' using errcode = 'insufficient_privilege';
  end if;
  if source is not null and not exists (select 1 from public.learning_events e where e.event_id = source and e.user_id = p_user) then
    raise exception 'STUDY_OS_EVENT · SOURCE_EVENT_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  if schema->>'scope' in ('session', 'item') and session is null then
    raise exception 'STUDY_OS_EVENT · SESSION_REQUIRED · %', ev_type_text using errcode = 'invalid_parameter_value';
  end if;
  if schema->>'scope' = 'item' and item is null then
    raise exception 'STUDY_OS_EVENT · ITEM_REQUIRED · %', ev_type_text using errcode = 'invalid_parameter_value';
  end if;
  if schema->>'scope' = 'user' and (session is not null or item is not null) then
    raise exception 'STUDY_OS_EVENT · SESSION_NOT_ALLOWED · %', ev_type_text using errcode = 'invalid_parameter_value';
  end if;
  if item is not null and session is null then
    raise exception 'STUDY_OS_EVENT · ITEM_REQUIRES_SESSION' using errcode = 'invalid_parameter_value';
  end if;
  if session is not null then
    -- El contador del usuario ya serializa todos sus eventos (punto 2): no hace falta bloquear la sesión.
    select ss.* into s from public.study_sessions ss where ss.id = session and ss.user_id = p_user;
    if s.id is null then
      raise exception 'STUDY_OS_EVENT · SESSION_NOT_FOUND' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if item is not null then
    select i.* into it from public.session_items i where i.id = item and i.session_id = session and i.user_id = p_user;
    if it.id is null then
      raise exception 'STUDY_OS_EVENT · ITEM_NOT_FOUND' using errcode = 'insufficient_privilege';
    end if;
    if schema ? 'item_type' and it.item_type::text <> schema->>'item_type' then
      raise exception 'STUDY_OS_EVENT · ITEM_TYPE_MISMATCH · %', schema->>'item_type' using errcode = 'object_not_in_prerequisite_state';
    end if;
  end if;

  -- Reglas de estado por tipo (antes de escribir nada).
  case ev_type
    when 'SESSION_STARTED' then
      if s.status <> 'PLANNED' then
        raise exception 'STUDY_OS_EVENT · SESSION_STATE · expected PLANNED, was %', s.status using errcode = 'object_not_in_prerequisite_state';
      end if;
    when 'SESSION_INTERRUPTED' then
      if s.status <> 'ACTIVE' then
        raise exception 'STUDY_OS_EVENT · SESSION_STATE · expected ACTIVE, was %', s.status using errcode = 'object_not_in_prerequisite_state';
      end if;
    when 'SESSION_RESUMED', 'SESSION_COMPLETED' then
      if s.status not in ('ACTIVE', 'INTERRUPTED') then
        raise exception 'STUDY_OS_EVENT · SESSION_STATE · expected ACTIVE or INTERRUPTED, was %', s.status using errcode = 'object_not_in_prerequisite_state';
      end if;
    when 'AVAILABILITY_CHANGED' then
      if not public.weekly_availability_is_valid(payload->'weekly_availability_json')
         or (payload->>'default_daily_minutes')::integer not between 5 and 600 then
        raise exception 'STUDY_OS_EVENT · AVAILABILITY_MALFORMED' using errcode = 'invalid_parameter_value';
      end if;
    else
      -- Eventos de ítem: la sesión debe estar ACTIVE.
      if s.status <> 'ACTIVE' then
        raise exception 'STUDY_OS_EVENT · SESSION_NOT_ACTIVE · %', s.status using errcode = 'object_not_in_prerequisite_state';
      end if;
  end case;

  new_item_status := null;
  if item is not null then
    case ev_type
      when 'SESSION_ITEM_STARTED', 'PRACTICAL_STARTED', 'HELP_REQUESTED', 'ALREADY_KNOW_CLAIMED', 'ANSWER_SELECTED', 'CONFIDENCE_RECORDED' then
        if it.status = 'COMPLETED' then
          raise exception 'STUDY_OS_EVENT · ITEM_COMPLETED' using errcode = 'object_not_in_prerequisite_state';
        end if;
        new_item_status := 'ACTIVE';
      when 'SESSION_ITEM_COMPLETED', 'PRACTICAL_COMPLETED', 'LEARNING_UNIT_COMPLETED' then
        if ev_type = 'LEARNING_UNIT_COMPLETED' and it.presented_learning_unit_version_id is null then
          raise exception 'STUDY_OS_EVENT · NOT_PRESENTED' using errcode = 'object_not_in_prerequisite_state';
        end if;
        new_item_status := 'COMPLETED';
      when 'LEARNING_UNIT_VIEWED' then
        if it.status = 'COMPLETED' then
          raise exception 'STUDY_OS_EVENT · ITEM_COMPLETED' using errcode = 'object_not_in_prerequisite_state';
        end if;
        unit_version := (payload->>'learning_unit_version_id')::uuid;
        if not exists (select 1 from public.learning_unit_versions v
                       where v.id = unit_version and v.learning_unit_id = it.learning_unit_id
                         and v.published_at is not null and v.status in ('PUBLISHED', 'RETIRED')) then
          raise exception 'STUDY_OS_EVENT · UNIT_VERSION_NOT_PUBLISHED' using errcode = 'object_not_in_prerequisite_state';
        end if;
        if it.presented_learning_unit_version_id is not null and it.presented_learning_unit_version_id <> unit_version then
          raise exception 'STUDY_OS_EVENT · REPRESENTATION_MISMATCH' using errcode = 'object_not_in_prerequisite_state';
        end if;
        new_item_status := 'ACTIVE';
      when 'QUESTION_PRESENTED' then
        if it.status = 'COMPLETED' then
          raise exception 'STUDY_OS_EVENT · ITEM_COMPLETED' using errcode = 'object_not_in_prerequisite_state';
        end if;
        rep := (payload->>'question_representation_id')::uuid;
        -- SD-023 §2 · una representación de la pregunta del ítem que ha estado publicada.
        if not exists (select 1 from public.question_representations r
                       where r.id = rep and r.question_id = it.question_id
                         and r.published_at is not null and r.status in ('PUBLISHED', 'RETIRED')) then
          raise exception 'STUDY_OS_EVENT · REPRESENTATION_NOT_PUBLISHED' using errcode = 'object_not_in_prerequisite_state';
        end if;
        if it.presented_representation_id is not null and it.presented_representation_id <> rep then
          raise exception 'STUDY_OS_EVENT · REPRESENTATION_MISMATCH' using errcode = 'object_not_in_prerequisite_state';
        end if;
        -- SD-023 §3d · sin clave para esa representación la pregunta no es respondible.
        if ingest.resolve_answer_key(rep) is null then
          raise exception 'STUDY_OS_EVENT · NO_ANSWER_KEY' using errcode = 'object_not_in_prerequisite_state';
        end if;
        if payload ? 'presented_option_order' then
          select array_agg((e #>> '{}')::uuid) into order_ids from jsonb_array_elements(payload->'presented_option_order') e;
          if (select count(*) from unnest(order_ids) x) <> (select count(distinct x) from unnest(order_ids) x)
             or (select count(*) from public.question_options o where o.representation_id = rep) <> array_length(order_ids, 1)
             or exists (select 1 from unnest(order_ids) x
                        where not exists (select 1 from public.question_options o where o.id = x and o.representation_id = rep)) then
            raise exception 'STUDY_OS_EVENT · PRESENTED_ORDER_NOT_A_PERMUTATION' using errcode = 'invalid_parameter_value';
          end if;
        end if;
        new_item_status := 'ACTIVE';
      when 'ANSWER_SUBMITTED' then
        if it.status = 'COMPLETED' then
          raise exception 'STUDY_OS_EVENT · ITEM_COMPLETED' using errcode = 'object_not_in_prerequisite_state';
        end if;
        new_item_status := 'COMPLETED';
      when 'FEEDBACK_VIEWED' then
        if not exists (select 1 from public.question_attempts a where a.session_item_id = it.id) then
          raise exception 'STUDY_OS_EVENT · FEEDBACK_BEFORE_ATTEMPT' using errcode = 'object_not_in_prerequisite_state';
        end if;
      else
        null;
    end case;
    if ev_type in ('ANSWER_SELECTED', 'ANSWER_SUBMITTED') then
      if it.presented_representation_id is null then
        raise exception 'STUDY_OS_EVENT · NOT_PRESENTED' using errcode = 'object_not_in_prerequisite_state';
      end if;
      if (payload->>'question_representation_id')::uuid <> it.presented_representation_id then
        raise exception 'STUDY_OS_EVENT · REPRESENTATION_MISMATCH' using errcode = 'object_not_in_prerequisite_state';
      end if;
      if ev_type = 'ANSWER_SELECTED' and not exists (
        select 1 from public.question_options o
        where o.id = (payload->>'selected_option_id')::uuid and o.representation_id = it.presented_representation_id) then
        raise exception 'STUDY_OS_EVENT · OPTION_NOT_IN_REPRESENTATION' using errcode = 'object_not_in_prerequisite_state';
      end if;
    end if;
    if ev_type = 'CONFIDENCE_RECORDED' then
      perform ingest.validate_confidence((payload->>'confidence_value')::integer, payload->>'confidence_scale_version');
    end if;
  end if;

  -- ADR-008 punto 6 · solo para un evento nuevo: reservar la posición e insertar, misma transacción.
  update ingest.user_event_counters set next_position = pos + 1 where user_id = p_user;
  insert into public.learning_events (
    event_id, user_id, device_id, session_id, session_item_id, event_type, schema_version, payload,
    client_created_at, client_sequence, server_received_at, created_offline, source_event_id,
    stream_position, payload_hash, canonicalization_version
  ) values (
    ev_id, p_user, device, session, item, ev_type, sv, payload,
    cca, cseq, now_ts, offline, source,
    pos, ev_hash, 'v1'
  );

  -- Efectos derivados: ítem, intento, sesión, cursor, sync. Todo en la misma transacción.
  if item is not null then
    if ev_type = 'QUESTION_PRESENTED' and it.presented_representation_id is null then
      update public.session_items set presented_representation_id = rep where id = it.id;
    end if;
    if ev_type = 'LEARNING_UNIT_VIEWED' and it.presented_learning_unit_version_id is null then
      update public.session_items set presented_learning_unit_version_id = unit_version where id = it.id;
    end if;
    if ev_type = 'ANSWER_SUBMITTED' then
      attempt_out := ingest.normalize_attempt(p_user, ev_id, session, item, payload, cca);
    end if;
    if new_item_status = 'ACTIVE' and it.status = 'PENDING' then
      update public.session_items set status = 'ACTIVE', started_at = now_ts where id = it.id;
    elsif new_item_status = 'COMPLETED' and it.status <> 'COMPLETED' then
      update public.session_items set status = 'COMPLETED', started_at = coalesce(started_at, now_ts), completed_at = now_ts where id = it.id;
    end if;
  end if;
  if session is not null then
    case ev_type
      when 'SESSION_STARTED' then
        update public.study_sessions set status = 'ACTIVE', started_at = now_ts, last_activity_at = now_ts where id = session;
      when 'SESSION_INTERRUPTED' then
        update public.study_sessions set status = 'INTERRUPTED', last_activity_at = now_ts where id = session;
      when 'SESSION_RESUMED' then
        update public.study_sessions set status = 'ACTIVE', last_activity_at = now_ts where id = session;
      when 'SESSION_COMPLETED' then
        update public.study_sessions set status = 'COMPLETED', completed_at = now_ts, last_activity_at = now_ts where id = session;
      else
        update public.study_sessions set last_activity_at = now_ts where id = session;
    end case;
    cursor_out := case when ev_type = 'SESSION_COMPLETED' then null else ingest.compute_resume_cursor(session) end;
    update public.study_sessions set resume_cursor_json = cursor_out where id = session;
    select jsonb_build_object('session_id', ss.id, 'status', ss.status::text, 'resume_cursor', ss.resume_cursor_json)
      into session_out from public.study_sessions ss where ss.id = session;
  end if;
  if device is not null then
    -- EC-012 · el estado de sincronización deriva del ACK del servidor: se actualiza al aceptar.
    insert into public.sync_state (user_id, device_id, last_server_event_id, last_client_sequence, last_sync_at)
    values (p_user, device, ev_id, cseq, now_ts)
    on conflict (user_id, device_id) do update
      set last_server_event_id = excluded.last_server_event_id,
          last_client_sequence = greatest(coalesce(public.sync_state.last_client_sequence, 0), coalesce(excluded.last_client_sequence, 0)),
          last_sync_at = excluded.last_sync_at;
    update public.devices set last_seen_at = now_ts where id = device and user_id = p_user;
  end if;

  return jsonb_build_object(
    'event_id', ev_id,
    'stream_position', pos,
    'payload_hash', ev_hash,
    'canonicalization_version', 'v1',
    'server_received_at', ingest.canonical_timestamp(now_ts),
    'idempotent', false,
    'session', session_out,
    'attempt', attempt_out
  );
end;
$$;
comment on function ingest.append_learning_event(uuid, jsonb) is
  'ADR-008 · SD-022 · SD-023 · H-P2-3 · única vía de escritura de evidencia. Orden: validar → '
  'bloquear contador → hash → comprobar event_id → propiedad y estado → posición + inserción → '
  'efectos (ítem, intento, sesión, cursor, sync). Cualquier rechazo revierte todo sin consumir posición.';
revoke all on function ingest.append_learning_event(uuid, jsonb) from public, anon, authenticated, service_role;

create or replace function public.append_learning_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Manifest §14 · la identidad es la del JWT verificado; el sobre no puede aportarla.
  return ingest.append_learning_event((select auth.uid()), p_event);
end;
$$;
comment on function public.append_learning_event(jsonb) is
  'H-P2-3 · primera RPC invocable por cliente (authority-registry.json · clientInvokableRpcs). '
  'Acepta un evento del usuario autenticado y devuelve posición, hash y, tras existir el intento, '
  'su resultado (INV-101: nunca antes del envío).';
revoke all on function public.append_learning_event(jsonb) from public, anon, service_role;
grant execute on function public.append_learning_event(jsonb) to authenticated;
