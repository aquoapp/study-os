-- Rollback de 00000000000009_question_concepts.sql

drop function if exists ingest.copy_forward_question_concepts(uuid, uuid);
drop index if exists public.question_concepts_one_primary;
drop table if exists public.question_concepts;
