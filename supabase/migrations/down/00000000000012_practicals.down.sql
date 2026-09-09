-- Rollback de 00000000000012_practicals.sql

drop table if exists public.practical_questions;
drop table if exists public.practicals;
drop function if exists public.check_practical_provenance();
