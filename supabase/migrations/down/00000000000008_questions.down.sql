-- Rollback de 00000000000008_questions.sql

drop table if exists public.question_options;
drop index if exists public.question_representations_one_current;
drop table if exists public.question_representations;
drop table if exists public.canonical_questions;
drop function if exists public.reject_option_insert_on_published();
drop function if exists public.reject_published_option_mutation();
drop function if exists public.reject_published_representation_mutation();
