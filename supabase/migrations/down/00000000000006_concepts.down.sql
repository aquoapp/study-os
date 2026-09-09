-- Rollback de 00000000000006_concepts.sql

drop table if exists public.concept_prerequisites;
drop table if exists public.concept_versions;
drop table if exists public.concepts;
drop function if exists public.reject_concept_key_change();
