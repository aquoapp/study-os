-- Rollback de 00000000000015_learner_core.sql · Phase 2 · slice S1.
-- Borra las tablas del núcleo de aprendiz (con sus filas: son datos de STAGING y de CI,
-- nunca de PRODUCTION), sus funciones de apoyo y sus tipos. Orden inverso de dependencias.
drop table if exists public.diagnostic_runs;
drop function if exists public.check_diagnostic_run_transition();
drop table if exists public.sync_state;
drop table if exists public.devices;
drop table if exists public.learner_exam_goals;
drop function if exists public.check_goal_pack_published();
drop table if exists public.learner_settings;
drop function if exists public.check_learner_settings_shape();
drop function if exists public.weekly_availability_is_valid(jsonb);
drop function if exists public.reject_owner_change();
drop type if exists public.diagnostic_run_status;
drop type if exists public.goal_status;
