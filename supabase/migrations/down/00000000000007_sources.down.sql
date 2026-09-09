-- Rollback de 00000000000007_sources.sql

drop table if exists public.source_versions;
drop table if exists public.sources;
drop function if exists public.check_source_version_chain();
