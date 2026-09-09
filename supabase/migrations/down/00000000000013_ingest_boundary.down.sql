-- Rollback de 00000000000013_ingest_boundary.sql

drop function if exists public.purge_generated_pack(uuid);
drop function if exists public.copy_forward_question_concepts(uuid, uuid);
drop function if exists public.publish_staged_item(uuid);
drop function if exists public.validate_staged_item(uuid);
drop function if exists public.stage_item(text, jsonb);
drop function if exists ingest.purge_generated_pack(uuid);
drop function if exists ingest.publish_staged_item(uuid);
drop function if exists ingest.validate_staged_item(uuid);
drop function if exists ingest.stage_item(ingest.staged_item_kind, jsonb);
drop function if exists ingest.source_version_is_official(uuid);
drop function if exists ingest.concept_key(text, text);
drop function if exists ingest.require_keys(jsonb, text[]);
alter table if exists ingest.promotions drop column if exists staged_item_id;
drop table if exists ingest.staged_items;
