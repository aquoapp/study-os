-- ---------------------------------------------------------------------------
-- Rollback de la migración 20 · núcleo del Learning Engine.
--
-- Devuelve el catálogo al estado de la 19: desaparecen el esquema `engine`, sus tipos, sus
-- tablas y sus funciones. La evidencia de `public` no se toca: la proyección es derivada, y
-- perderla no pierde nada que no se pueda reconstruir.
-- ---------------------------------------------------------------------------

drop function if exists engine.promote_engine_config(text, text, jsonb);
drop function if exists engine.rebuild_projections(uuid, jsonb, engine.projection_reason);
drop function if exists engine.recalculate_mastery(uuid, bigint, jsonb, engine.projection_reason);
drop function if exists engine.apply_projection(uuid, jsonb, engine.projection_reason, bigint, boolean);
drop function if exists engine.stale_users(text, integer);
drop function if exists engine.evidence_snapshot(uuid);

drop trigger if exists mastery_history_append_only on engine.mastery_history;
drop function if exists engine.reject_history_mutation();
drop trigger if exists engine_config_immutable on engine.engine_config;
drop function if exists engine.reject_config_mutation();

drop table if exists engine.projection_watermarks;
drop table if exists engine.error_patterns;
drop table if exists engine.mastery_history;
drop table if exists engine.concept_mastery;
drop table if exists engine.engine_config;

drop type if exists engine.projection_reason;
drop type if exists engine.config_status;
drop type if exists engine.error_pattern_type;
drop type if exists engine.uncertainty;
drop type if exists engine.mastery_state;

drop schema if exists engine;
