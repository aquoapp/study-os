-- Rollback de 00000000000011_exam_occurrences.sql

drop table if exists public.exam_occurrences;
drop table if exists public.exam_sitting_models;
drop table if exists public.exam_sittings;
drop table if exists public.exam_sections;
drop function if exists public.check_occurrence_provenance();
