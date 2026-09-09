-- Rollback de 00000000000014_phase1a_hardening.sql
--
-- Restaura el estado anterior de objetos y grants creados por las migraciones del
-- repositorio. Los privilegios por defecto NO se restauran: su estado previo era de
-- plataforma (distinto en el stack local y en el proyecto gestionado), no de migración,
-- y una guarda prohíbe conceder privilegios por defecto a roles de cliente.

drop trigger if exists answer_key_versions_immutable on content.answer_key_versions;
drop function if exists content.reject_answer_key_mutation();

drop trigger if exists question_representations_links on public.question_representations;
drop function if exists public.check_representation_links();

drop trigger if exists exam_packs_slug_immutable on public.exam_packs;
drop function if exists public.reject_pack_slug_change();

drop trigger if exists canonical_questions_pack_immutable on public.canonical_questions;
drop function if exists public.reject_question_pack_change();

drop trigger if exists practicals_provenance_immutable on public.practicals;
drop trigger if exists exam_occurrences_provenance_immutable on public.exam_occurrences;
drop trigger if exists question_representations_provenance_immutable on public.question_representations;
drop trigger if exists sources_provenance_immutable on public.sources;
drop function if exists public.reject_provenance_class_change();

drop trigger if exists promotions_immutable on ingest.promotions;
drop function if exists ingest.reject_closed_promotion_change();

alter table ingest.staged_items alter column received_by set default current_user;
alter table ingest.promotions alter column promoted_by set default current_user;
drop function if exists ingest.actor();

grant insert, update, delete on content.answer_key_versions to service_role;
grant insert, update on ingest.staged_items to service_role;
grant insert, update on ingest.promotions to service_role;

grant execute on function public.set_updated_at() to authenticated, service_role;
