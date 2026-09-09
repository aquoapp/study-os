-- Rollback de 00000000000017_sessions.sql · Phase 2 · slice S3.
drop function if exists public.create_study_session(uuid, text, integer, jsonb);
drop function if exists ingest.create_study_session(uuid, uuid, text, integer, jsonb);
drop table if exists public.session_items;
drop function if exists public.check_session_item_mutation();
drop table if exists public.study_sessions;
drop function if exists public.reject_delete_while_account_exists();
drop function if exists public.check_session_transition();
drop type if exists public.session_item_status;
drop type if exists public.session_item_type;
drop type if exists public.session_status;
