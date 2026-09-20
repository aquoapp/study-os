-- Rollback de 00000000000024_phase4b_product_integration.sql · Phase 4B.
--
-- Restaura cada función **exactamente** como la dejaron las migraciones 16, 18 y 23 —copiadas de
-- esos ficheros por script, no transcritas—, y elimina lo que la migración 24 crea. No toca
-- evidencia, ni sesiones, ni la proyección del motor, ni contenido publicado.
--
-- Lo único que se pierde son las declaraciones de override del día. Su historia **permanece**: el
-- evento TODAY_OVERRIDE_SET ya está en learning_events, y un rollback no borra historia.
--
-- Nota de orden: las ejecuciones que declaren HYBRID_V1 o TODAY_OVERRIDE quedarían fuera de los
-- CHECK restaurados. El rollback las borra primero, por la misma razón por la que el de la
-- migración 23 borra las tablas del Planner: solo se ejecuta en entornos que lo admiten
-- (`tools/db.mjs` deniega la operación destructiva donde no).

delete from public.planner_run_audit a
 where exists (select 1 from public.planner_runs r
               where r.id = a.run_id
                 and (r.duration_provenance = 'HYBRID_V1' or r.budget_source = 'TODAY_OVERRIDE'));
delete from public.planner_items i
 where exists (select 1 from public.planner_runs r
               where r.id = i.run_id
                 and (r.duration_provenance = 'HYBRID_V1' or r.budget_source = 'TODAY_OVERRIDE'));
update public.planner_runs set supersedes_run_id = null
 where supersedes_run_id in (select id from public.planner_runs
                             where duration_provenance = 'HYBRID_V1' or budget_source = 'TODAY_OVERRIDE');
delete from public.planner_runs
 where duration_provenance = 'HYBRID_V1' or budget_source = 'TODAY_OVERRIDE';

-- 1 · Frontera del override -------------------------------------------------------------------

drop function if exists public.set_today_override(uuid, integer);
drop function if exists ingest.validate_today_override_payload(uuid, jsonb);
drop table if exists public.learner_day_overrides;

-- 2 · Frontera de eventos · vuelve a la migración 18 -------------------------------------------

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

drop function if exists ingest.event_type_is_server_only(text);

-- 3 · Planner · vuelve a la migración 23 -------------------------------------------------------

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
    raise exception 'STUDY_OS_PLANNER · STALE_INPUT' using errcode = 'object_not_in_prerequisite_state';
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
      raise exception 'STUDY_OS_PLANNER · STALE_INPUT' using errcode = 'object_not_in_prerequisite_state';
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
    raise exception 'STUDY_OS_PLANNER · STALE_INPUT' using errcode = 'object_not_in_prerequisite_state';
end;
$$;
comment on function public.create_planner_run(uuid, jsonb) is
  'Planner Contract §U.3 · §U.1 · persistencia autoritativa de una ejecución con revalidación de '
  'su entrada en la misma transacción. Solo rol de servicio: un plan es una decisión que el '
  'cliente no puede redactar.';
revoke all on function public.create_planner_run(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_planner_run(uuid, jsonb) to service_role;

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

-- 4 · planner_config · v2 fuera, v1 vuelve a ACTIVE --------------------------------------------

-- El trigger de inmutabilidad impide borrar una versión publicada y solo admite ACTIVE →
-- SUPERSEDED. El rollback se salta el trigger a propósito, igual que `drop table` en el de la
-- migración 23: deshacer una promoción no es una transición de producto.
alter table public.planner_config disable trigger planner_config_immutable;
delete from public.planner_config where version = 'v2';
update public.planner_config set status = 'ACTIVE', superseded_at = null where version = 'v1';
alter table public.planner_config enable trigger planner_config_immutable;

alter table public.planner_config drop constraint if exists planner_config_document_complete;
alter table public.planner_config
  add constraint planner_config_document_complete check (
    document ?& array['outcomes', 'composition_reasons', 'exclusion_reasons', 'plan_day_policy']
    and jsonb_typeof(document -> 'outcomes') = 'array'
    and jsonb_typeof(document -> 'composition_reasons') = 'array'
    and jsonb_typeof(document -> 'exclusion_reasons') = 'array'
    and document ->> 'plan_day_policy' = 'LEARNER_DECLARED_TIMEZONE'
  );
alter table public.planner_config drop constraint if exists planner_config_document_whitelist;
alter table public.planner_config
  add constraint planner_config_document_whitelist check (
    (document - array['outcomes', 'composition_reasons', 'exclusion_reasons', 'plan_day_policy'])
      = '{}'::jsonb
  );

-- 5 · Procedencias · vuelven a su forma de Phase 4A --------------------------------------------

alter table public.planner_runs drop constraint if exists planner_runs_duration_provenance;
alter table public.planner_runs
  add constraint planner_runs_duration_provenance check (duration_provenance = 'FIXTURE');
alter table public.planner_runs drop constraint if exists planner_runs_budget_source;
alter table public.planner_runs
  add constraint planner_runs_budget_source check (budget_source in ('WEEKLY_ENTRY', 'DEFAULT_DAILY'));

-- 6 · Frontera de ingestión · vuelve a la migración 16 -----------------------------------------

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

    when 'learning_unit' then
      dest_table := 'public.learning_units';
      select c.exam_pack_id into pack from public.concepts c where c.id = (p->>'concept_id')::uuid;
      if pack is null or pack <> (p->>'exam_pack_id')::uuid then
        raise exception 'learning_unit · el concepto no pertenece al pack' using errcode = 'foreign_key_violation';
      end if;
      insert into public.learning_units (exam_pack_id, concept_id, unit_type, status, promotion_id)
      values (pack, (p->>'concept_id')::uuid, p->>'unit_type',
              coalesce((p->>'status')::public.content_status, 'PUBLISHED'), promo)
      returning id into target;

    when 'learning_unit_version' then
      dest_table := 'public.learning_unit_versions';
      -- Mismo patrón que las representaciones (SD-021): versiones inmutables enlazadas por supersesión.
      perform pg_advisory_xact_lock(hashtext('learning_unit_versions:' || (p->>'learning_unit_id')));
      select coalesce(max(v.version_no), 0) + 1 into rep_no
        from public.learning_unit_versions v where v.learning_unit_id = (p->>'learning_unit_id')::uuid;
      select v.id into current_rep
        from public.learning_unit_versions v
       where v.learning_unit_id = (p->>'learning_unit_id')::uuid and v.status = 'PUBLISHED'
         and v.superseded_by_version_id is null;
      insert into public.learning_unit_versions (learning_unit_id, version_no, title, body, provenance_class,
                                                 source_version_id, status, supersedes_version_id, published_at, promotion_id)
      values ((p->>'learning_unit_id')::uuid, rep_no, p->>'title', p->>'body', klass,
              (p->>'source_version_id')::uuid, 'DRAFT', current_rep, now(), promo)
      returning id into target;
      if coalesce(p->>'status', 'PUBLISHED') = 'DRAFT' then
        update public.learning_unit_versions set supersedes_version_id = null where id = target;
      else
        if current_rep is not null then
          update public.learning_unit_versions set superseded_by_version_id = target where id = current_rep;
        end if;
        update public.learning_unit_versions set status = 'PUBLISHED' where id = target;
      end if;
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
      -- Phase 2 · H-FPS-1 (opción A) · unidades de aprendizaje como adenda de contenido canónico.
      when 'learning_unit' then perform ingest.require_keys(p, array['exam_pack_id', 'concept_id', 'unit_type']);
      when 'learning_unit_version' then perform ingest.require_keys(p, array['learning_unit_id', 'title', 'body', 'provenance_class']);
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

    -- Unidades de aprendizaje (Phase 2): título y cuerpo no vacíos; sin marcadores de corrección
    -- (una unidad nunca lleva clave: SI-1A-5 por construcción).
    if item.kind = 'learning_unit_version' then
      if coalesce(p->>'title', '') = '' or coalesce(p->>'body', '') = '' then
        raise exception 'una versión de unidad exige título y cuerpo' using errcode = 'invalid_parameter_value';
      end if;
      if p ?| array['correct', 'correct_option', 'correct_option_id', 'answer', 'answer_key', 'is_correct', 'solution'] then
        raise exception 'SI-1A-5 · una unidad de aprendizaje no puede llevar marcador de corrección' using errcode = 'invalid_parameter_value';
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

drop function if exists ingest.require_estimated_minutes(jsonb);

-- 7 · Duración de la unidad --------------------------------------------------------------------

create or replace function public.reject_published_unit_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'PUBLISHED' and not ingest.purge_in_progress() then
      raise exception 'DI-1A-3 · una versión de unidad publicada no se borra'
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;
  if ingest.purge_in_progress() then
    return new;
  end if;
  if old.status = 'PUBLISHED' then
    if new.learning_unit_id is distinct from old.learning_unit_id
       or new.version_no is distinct from old.version_no
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.provenance_class is distinct from old.provenance_class
       or new.source_version_id is distinct from old.source_version_id
       or new.supersedes_version_id is distinct from old.supersedes_version_id
       or new.published_at is distinct from old.published_at
       or new.promotion_id is distinct from old.promotion_id then
      raise exception 'H-FPS-1 · el contenido publicado de una versión de unidad es inmutable'
        using errcode = 'restrict_violation';
    end if;
    if new.status not in ('PUBLISHED', 'RETIRED') then
      raise exception 'H-FPS-1 · una versión publicada solo puede retirarse'
        using errcode = 'restrict_violation';
    end if;
    if old.superseded_by_version_id is not null
       and new.superseded_by_version_id is distinct from old.superseded_by_version_id then
      raise exception 'H-FPS-1 · el enlace de supersesión se fija una sola vez'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.reject_published_unit_version_mutation() from public;

alter table public.learning_unit_versions
  drop constraint if exists learning_unit_versions_estimated_minutes_range;
alter table public.learning_unit_versions drop column if exists estimated_minutes;

-- 8 · R-8 · devuelve la escritura directa de la disponibilidad al cliente ----------------------

drop function if exists public.set_availability(uuid, integer, jsonb, text, boolean);

drop policy if exists learner_settings_insert_own on public.learner_settings;
create policy learner_settings_insert_own
  on public.learner_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists learner_settings_update_own on public.learner_settings;
create policy learner_settings_update_own
  on public.learner_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update on public.learner_settings to authenticated;
revoke insert, update on public.learner_settings from service_role;
grant select on public.learner_settings to service_role;
