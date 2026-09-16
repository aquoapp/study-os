-- Rollback de 00000000000021 · retira los envoltorios de invocación del Learning Engine.
-- No toca ningún objeto de `engine` ni de `ingest`: solo lo que la migración añadió en `public`.
drop function if exists public.engine_stale_users(text, integer);
drop function if exists public.engine_rebuild_projections(uuid, jsonb, text);
drop function if exists public.engine_recalculate_mastery(uuid, bigint, jsonb, text);
drop function if exists public.engine_attribution_snapshot(uuid);
drop function if exists public.engine_evidence_snapshot(uuid);
drop function if exists public.engine_active_config_version();
