-- Rollback de 00000000000004_exam_packs.sql

alter table if exists public.exam_packs drop constraint if exists exam_packs_current_version_fk;
drop table if exists public.exam_pack_versions;
drop table if exists public.exam_packs;
drop function if exists public.reject_delete_of_published();
