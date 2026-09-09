-- Rollback de 00000000000018_evidence_core.sql · Phase 2 · slices S4 y S5.
-- Orden inverso de dependencias. Las filas son evidencia sintética de STAGING y de CI.
drop function if exists public.append_learning_event(jsonb);
drop function if exists ingest.append_learning_event(uuid, jsonb);
drop function if exists ingest.compute_resume_cursor(uuid);
drop function if exists ingest.normalize_attempt(uuid, uuid, uuid, uuid, jsonb, timestamptz);
drop function if exists ingest.attempt_outcome(uuid);
drop function if exists ingest.validate_confidence(integer, text);
drop function if exists ingest.resolve_answer_key(uuid);
drop function if exists ingest.normalize_event_payload(text, integer, jsonb);
drop function if exists ingest.jsonb_has_type(jsonb, text);
drop function if exists ingest.event_field_types(text);
drop function if exists ingest.canonical_timestamp(timestamptz);
drop function if exists ingest.canonical_hash(jsonb);
drop function if exists ingest.canonical_text(jsonb);
drop function if exists ingest.canonical_string(text);
drop table if exists public.question_attempts;
drop function if exists public.reject_attempt_mutation();
alter table if exists public.sync_state drop constraint if exists sync_state_last_event_fk;
drop table if exists public.learning_events;
drop function if exists public.reject_event_mutation();
drop table if exists public.confidence_scales;
drop function if exists public.reject_confidence_scale_mutation();
drop table if exists ingest.user_question_counters;
drop table if exists ingest.user_event_counters;
drop type if exists public.answer_kind;
drop type if exists public.learning_event_type;
