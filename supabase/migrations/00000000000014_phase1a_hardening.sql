-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 14 · Endurecimiento de Phase 1A tras la auditoría adversarial (N11)
--
-- Aditiva. No edita ninguna migración aplicada: cierra, con objetos nuevos y revocaciones,
-- los huecos de enforcement que la auditoría adversarial del 2026-09-09 encontró entre lo
-- que la arquitectura aceptada afirma y lo que la base de datos hacía cumplir.
--
-- PI-1A-4 · «no existe ruta GENERATED → VERIFIED/OFFICIAL»: la clase de procedencia de
--            una fila canónica es inmutable (antes solo lo era en representaciones
--            publicadas; una fuente GENERATED podía reclasificarse a OFFICIAL por UPDATE).
-- PI-1A-6 · la auditoría de promoción registra al actor real, no al propietario de la
--            función definer; una promoción cerrada no se reescribe.
-- SD-021 · DI-1A-4/5 · los enlaces de supersesión de una representación apuntan a la
--            misma pregunta y avanzan estrictamente (sin ciclos, sin retroceso).
-- EC-007 · INV-101 · una versión de clave es inmutable salvo su cierre (effective_to) y
--            solo la purga de fixtures la borra; el rol de servicio no la escribe: solo la
--            frontera de ingestión (definer) lo hace.
-- ADR-009 v1.1 · el slug del pack entra en la derivación de concept_key: es inmutable
--            desde que existe un concepto; una pregunta no cambia de pack (DI-1A-1).
-- SI-1A-4 · D-19 · mínimo privilegio: ninguna función de `public` es ejecutable por
--            roles de cliente (los triggers no necesitan EXECUTE para dispararse); los
--            privilegios por defecto de `postgres` en `public` no conceden nada a roles de
--            cliente; el rol de servicio no escribe directamente en `ingest` ni `content`.
--
-- Rollback: supabase/migrations/down/00000000000014_phase1a_hardening.down.sql
-- Pruebas: tests/integration/phase1a.redteam.spec.ts · tests/integration/catalog.security.spec.ts
-- ---------------------------------------------------------------------------

-- D-19 · trigger functions: sin EXECUTE para nadie salvo el propietario -----------------
-- Un trigger se dispara con independencia de los privilegios EXECUTE del rol que ejecuta
-- el DML (los demás trigger functions de Phase 1A ya funcionan así).

revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;

-- Privilegios por defecto (SI-1A-4) ----------------------------------------------------
-- Una tabla futura creada por `postgres` en `public` no hereda nada para los roles de
-- cliente ni para el rol de servicio: cada migración concede lo suyo explícitamente.
-- Converge desde cualquier estado previo de plataforma (local o proyecto gestionado).

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated, service_role;

-- Ingest y content: solo lectura para el rol de servicio -------------------------------
-- Las funciones de la frontera son SECURITY DEFINER (propietario `postgres`): el rol de
-- servicio no necesita DML directo. Quitárselo hace que la auditoría y las claves solo se
-- escriban por la frontera.

revoke insert, update, delete on ingest.promotions from service_role;
revoke insert, update, delete on ingest.staged_items from service_role;
revoke insert, update, delete on content.answer_key_versions from service_role;

-- El rol de servicio conserva exactamente el DML que las migraciones le concedieron.
-- Los privilegios por defecto de la plataforma le habían añadido TRUNCATE, REFERENCES y
-- TRIGGER sobre cada tabla creada: TRUNCATE no dispara los triggers de fila y habría sido
-- una vía de borrado masivo de contenido publicado ajena a DI-1A-3. Se retira todo y se
-- vuelve a conceder solo lo declarado.
revoke all on all tables in schema public from service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on all tables in schema content from service_role;
revoke all on all tables in schema ingest from service_role;
grant select on all tables in schema content to service_role;
grant select on all tables in schema ingest to service_role;

-- Actor real en la auditoría (PI-1A-6) ---------------------------------------------------
-- Dentro de una función definer `current_user` es el propietario. El actor es el rol del
-- JWT con el que PostgREST atiende la petición; fuera de PostgREST, el usuario de sesión.

create or replace function ingest.actor()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    session_user::text
  );
$$;

comment on function ingest.actor() is
  'PI-1A-6 · actor de una promoción o recepción: rol del JWT de la petición o, sin JWT, '
  'el usuario de sesión. Nunca el propietario de la función definer.';

revoke all on function ingest.actor() from public;

alter table ingest.promotions alter column promoted_by set default ingest.actor();
alter table ingest.staged_items alter column received_by set default ingest.actor();

-- Una promoción cerrada no se reescribe --------------------------------------------------
-- publish_staged_item la crea con destino provisional ('public.pending') y la cierra una
-- sola vez con la tabla y la fila destino. Después, nada la cambia.

create or replace function ingest.reject_closed_promotion_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'PI-1A-6 · la auditoría de promoción no se borra'
      using errcode = 'restrict_violation';
  end if;
  if old.target_table <> 'public.pending' then
    raise exception 'PI-1A-6 · una promoción cerrada es inmutable (%)', old.id
      using errcode = 'restrict_violation';
  end if;
  if new.id is distinct from old.id
     or new.provenance_class is distinct from old.provenance_class
     or new.source_version_id is distinct from old.source_version_id
     or new.promoted_at is distinct from old.promoted_at
     or new.promoted_by is distinct from old.promoted_by
     or new.staged_item_id is distinct from old.staged_item_id then
    raise exception 'PI-1A-6 · al cerrar una promoción solo se fija su destino'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function ingest.reject_closed_promotion_change() from public;

drop trigger if exists promotions_immutable on ingest.promotions;
create trigger promotions_immutable
  before update or delete on ingest.promotions
  for each row execute function ingest.reject_closed_promotion_change();

-- Procedencia inmutable (PI-1A-4 · EC-008) ------------------------------------------------
-- La clase de procedencia se fija al publicar. Corregirla es retirar la fila y publicar
-- otra con su propia procedencia, nunca reclasificar.

create or replace function public.reject_provenance_class_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.provenance_class is distinct from old.provenance_class then
    raise exception 'PI-1A-4 · la clase de procedencia de %.% es inmutable: no existe ruta % → %',
      tg_table_schema, tg_table_name, old.provenance_class, new.provenance_class
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_provenance_class_change() from public;

drop trigger if exists sources_provenance_immutable on public.sources;
create trigger sources_provenance_immutable
  before update on public.sources
  for each row execute function public.reject_provenance_class_change();

drop trigger if exists question_representations_provenance_immutable on public.question_representations;
create trigger question_representations_provenance_immutable
  before update on public.question_representations
  for each row execute function public.reject_provenance_class_change();

drop trigger if exists exam_occurrences_provenance_immutable on public.exam_occurrences;
create trigger exam_occurrences_provenance_immutable
  before update on public.exam_occurrences
  for each row execute function public.reject_provenance_class_change();

drop trigger if exists practicals_provenance_immutable on public.practicals;
create trigger practicals_provenance_immutable
  before update on public.practicals
  for each row execute function public.reject_provenance_class_change();

-- Identidad estable: pack y slug (DI-1A-1 · ADR-009 v1.1 §A) ------------------------------

create or replace function public.reject_question_pack_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.exam_pack_id is distinct from old.exam_pack_id then
    raise exception 'DI-1A-1 · una pregunta canónica no cambia de pack'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_question_pack_change() from public;

drop trigger if exists canonical_questions_pack_immutable on public.canonical_questions;
create trigger canonical_questions_pack_immutable
  before update on public.canonical_questions
  for each row execute function public.reject_question_pack_change();

create or replace function public.reject_pack_slug_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug
     and exists (select 1 from public.concepts c where c.exam_pack_id = old.id) then
    raise exception 'ADR-009 · el slug del pack deriva las concept_key: es inmutable desde que existe un concepto'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_pack_slug_change() from public;

drop trigger if exists exam_packs_slug_immutable on public.exam_packs;
create trigger exam_packs_slug_immutable
  before update on public.exam_packs
  for each row execute function public.reject_pack_slug_change();

-- Enlaces de supersesión de representaciones (SD-021 · DI-1A-4) ----------------------------
-- `supersedes` apunta a una representación anterior de la misma pregunta; `superseded_by`
-- a una posterior. Sin ciclos por construcción: el número de representación avanza.

create or replace function public.check_representation_links()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  other_question uuid;
  other_no integer;
begin
  if ingest.purge_in_progress() then
    return new;
  end if;
  if new.supersedes_representation_id is not null then
    select r.question_id, r.representation_no into other_question, other_no
      from public.question_representations r where r.id = new.supersedes_representation_id;
    if other_question is null or other_question <> new.question_id then
      raise exception 'SD-021 · una representación solo supersede a otra de la misma pregunta'
        using errcode = 'foreign_key_violation';
    end if;
    if other_no >= new.representation_no then
      raise exception 'SD-021 · una representación solo supersede a una anterior (% ≥ %)', other_no, new.representation_no
        using errcode = 'check_violation';
    end if;
  end if;
  if new.superseded_by_representation_id is not null then
    select r.question_id, r.representation_no into other_question, other_no
      from public.question_representations r where r.id = new.superseded_by_representation_id;
    if other_question is null or other_question <> new.question_id then
      raise exception 'SD-021 · una representación solo es superseded por otra de la misma pregunta'
        using errcode = 'foreign_key_violation';
    end if;
    if other_no <= new.representation_no then
      raise exception 'SD-021 · una representación solo es superseded por una posterior (% ≤ %)', other_no, new.representation_no
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.check_representation_links() from public;

drop trigger if exists question_representations_links on public.question_representations;
create trigger question_representations_links
  before insert or update on public.question_representations
  for each row execute function public.check_representation_links();

-- Claves de respuesta: versiones inmutables (EC-007 · INV-101) --------------------------------
-- Una versión de clave solo admite su cierre (effective_to de nulo a fecha). Todo lo demás
-- es una versión nueva. Solo la purga de un pack GENERATED la borra.

create or replace function content.reject_answer_key_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if not ingest.purge_in_progress() then
      raise exception 'EC-007 · una versión de clave no se borra: se cierra y se supersede'
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;
  if new.id is distinct from old.id
     or new.question_id is distinct from old.question_id
     or new.representation_id is distinct from old.representation_id
     or new.correct_option_id is distinct from old.correct_option_id
     or new.key_status is distinct from old.key_status
     or new.source_version_id is distinct from old.source_version_id
     or new.explanation is distinct from old.explanation
     or new.effective_from is distinct from old.effective_from
     or new.supersedes_key_id is distinct from old.supersedes_key_id
     or new.promotion_id is distinct from old.promotion_id
     or new.created_at is distinct from old.created_at then
    raise exception 'EC-007 · una versión de clave es inmutable: la corrección es una versión nueva'
      using errcode = 'restrict_violation';
  end if;
  if old.effective_to is not null and new.effective_to is distinct from old.effective_to then
    raise exception 'EC-007 · una versión de clave cerrada no se reabre ni cambia su cierre'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function content.reject_answer_key_mutation() from public;

drop trigger if exists answer_key_versions_immutable on content.answer_key_versions;
create trigger answer_key_versions_immutable
  before update or delete on content.answer_key_versions
  for each row execute function content.reject_answer_key_mutation();
