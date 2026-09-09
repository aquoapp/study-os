-- Rollback de 00000000000003_schema_topology.sql
--
-- Reversible mientras `content` e `ingest` solo contengan lo que esta migración creó
-- (las migraciones posteriores se revierten antes, en orden inverso).

drop function if exists ingest.purge_in_progress();
drop table if exists ingest.promotions;

drop type if exists ingest.staged_item_kind;
drop type if exists ingest.staged_item_status;
drop type if exists public.source_version_status;
drop type if exists public.mapping_relationship;
drop type if exists public.mapping_status;
drop type if exists public.key_status;
drop type if exists public.content_status;

drop schema if exists ingest;
drop schema if exists content;
