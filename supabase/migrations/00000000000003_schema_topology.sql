-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 3 · Topología de esquemas y frontera de exposición (N0)
--
-- ADR-011 · ACCEPTED · 2026-09-09 · `public` es la única superficie expuesta;
--            `content` (material de corrección) e `ingest` (frontera de ingestión)
--            son esquemas NO expuestos y sin acceso para los roles de cliente.
-- ADR-006 · INV-101 · las claves de respuesta viven fuera de todo esquema expuesto.
-- EC-010 · EC-011 · EC-019 · Phase 1A Authorization Packet §D, §I (DI-1A-9)
--
-- Rollback: supabase/migrations/down/00000000000003_schema_topology.down.sql
-- Pruebas: tests/integration/dataApi.exposure.spec.ts ·
--          tests/integration/catalog.security.spec.ts ·
--          guarda tools/guards/private-schema-grant-guard.mjs
--
-- QUÉ NO HACE
-- No crea `engine` ni `audit` (ADR-011 punto 10: Phase 3 y Phase 10).
-- No añade ningún esquema a la lista de exposición: `supabase/config.toml` sigue
-- exponiendo únicamente `public`, y el registro de autoridad lo declara igual.
-- ---------------------------------------------------------------------------

-- Esquemas no expuestos ------------------------------------------------------

create schema if not exists content;
create schema if not exists ingest;

comment on schema content is
  'ADR-011 · material de corrección (claves de respuesta). NO expuesto al Data API. '
  'Sin USAGE para anon ni authenticated: la exposición es una frontera, no una política.';

comment on schema ingest is
  'ADR-011 · frontera de ingestión: staging, validación, cuarentena, auditoría de '
  'promoción y funciones de publicación. NO expuesto al Data API.';

-- Los roles de cliente no tienen USAGE. `public` (el pseudo-rol) tampoco, para que un
-- rol nuevo no lo herede por accidente. Solo el rol de servicio y el propietario.
revoke all on schema content from public, anon, authenticated;
revoke all on schema ingest from public, anon, authenticated;
grant usage on schema content to service_role;
grant usage on schema ingest to service_role;

-- Enums cerrados y exam-neutral (DI-1A-9) ------------------------------------
-- Cada valor procede de un documento gobernante o del paquete aceptado. Ninguno es
-- específico de un examen: lo que varía por pack va como dato (ADR-010 v1.1).

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'content_status' and n.nspname = 'public') then
    create type public.content_status as enum ('DRAFT', 'PUBLISHED', 'RETIRED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'key_status' and n.nspname = 'public') then
    create type public.key_status as enum ('PROVISIONAL', 'FINAL', 'AMENDED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'mapping_status' and n.nspname = 'public') then
    create type public.mapping_status as enum ('VALIDATED', 'PENDING_REVALIDATION', 'REJECTED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'mapping_relationship' and n.nspname = 'public') then
    create type public.mapping_relationship as enum ('PRIMARY', 'SECONDARY');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'source_version_status' and n.nspname = 'public') then
    create type public.source_version_status as enum ('DRAFT', 'CURRENT', 'SUPERSEDED', 'WITHDRAWN');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'staged_item_status' and n.nspname = 'ingest') then
    create type ingest.staged_item_status as enum ('RECEIVED', 'VALIDATED', 'REJECTED', 'QUARANTINE', 'PUBLISHED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'staged_item_kind' and n.nspname = 'ingest') then
    create type ingest.staged_item_kind as enum (
      'exam_pack', 'exam_pack_version', 'syllabus_block', 'topic',
      'concept', 'concept_version', 'concept_prerequisite',
      'source', 'source_version',
      'question', 'question_representation', 'question_concept', 'answer_key_version',
      'exam_section', 'exam_sitting', 'exam_sitting_model', 'exam_occurrence',
      'practical', 'practical_question'
    );
  end if;
end
$$;

comment on type public.content_status is
  'DI-1A-9 · ciclo de vida de una fila canónica. RETIRED es un estado: nunca se borra en '
  'caliente una fila publicada (DI-1A-3).';
comment on type public.key_status is
  'Master §18 · CDEM §6 · ciclo PROVISIONAL → FINAL → AMENDED de la clave oficial (EC-007).';
comment on type public.mapping_status is
  'ADR-009 v1.1 §B · un mapeo solo alimenta motores cuando está VALIDATED; el rechazo es '
  'un estado, no un borrado.';
comment on type public.mapping_relationship is
  'CDEM §6 · REQ-B06 · exactamente un PRIMARY por pregunta y versión de pack.';
comment on type public.source_version_status is
  'CDEM §5 · Master §31 · la autoridad la tiene la versión; SUPERSEDED sigue direccionable.';

-- Auditoría de promoción (PI-1A-6) --------------------------------------------
-- Toda fila publicada en una tabla canónica referencia la promoción que la creó.
-- Se crea aquí porque las tablas canónicas de las migraciones siguientes la
-- referencian; la tabla de staging llega en la migración de la frontera de
-- ingestión, que enlaza `staged_item_id` con ALTER TABLE.

create table if not exists ingest.promotions (
  id uuid primary key default gen_random_uuid(),
  target_table text not null,
  target_id uuid,
  -- Clase de procedencia solo para filas de contenido; nula en filas estructurales
  -- (packs, versiones, bloques, temas, mapeos, secciones…).
  provenance_class public.provenance_class,
  source_version_id uuid,
  promoted_at timestamptz not null default now(),
  promoted_by text not null default current_user,

  constraint promotions_target_table_format
    check (target_table ~ '^(public|content)\.[a-z_]+$')
);

comment on table ingest.promotions is
  'PI-1A-6 · auditoría de promoción: una fila por cada publicación en una tabla canónica. '
  'Escritura exclusiva de las funciones de publicación.';

alter table ingest.promotions enable row level security;
alter table ingest.promotions force row level security;
revoke all on ingest.promotions from public, anon, authenticated;
grant select, insert, update on ingest.promotions to service_role;

-- Bandera transaccional de purga de fixtures (ver ingest.purge_generated_pack en la
-- migración de la frontera). Los triggers de inmutabilidad la consultan; solo una
-- función definer de `ingest` la activa, y solo dentro de su transacción.
create or replace function ingest.purge_in_progress()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(current_setting('ingest.purge_generated_pack', true), '') = 'on';
$$;

comment on function ingest.purge_in_progress() is
  'Verdadero solo dentro de la transacción de ingest.purge_generated_pack. Los triggers '
  'de inmutabilidad la consultan para admitir la limpieza de packs GENERATED sintéticos.';

revoke all on function ingest.purge_in_progress() from public;
grant execute on function ingest.purge_in_progress() to service_role;
