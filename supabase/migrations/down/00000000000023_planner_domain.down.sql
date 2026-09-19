-- Rollback de 00000000000023_planner_domain.sql · Phase 4A.
--
-- Deshace exactamente lo que la migración crea, en orden inverso. No toca evidencia, sesiones
-- anteriores ni la proyección del motor. Una ejecución del Planner es historia: si existe alguna,
-- el rollback la pierde con sus tablas, y por eso solo se ejecuta en entornos que lo admiten
-- (`tools/db.mjs` deniega la operación destructiva donde no).

drop function if exists public.start_planned_session(uuid, uuid);
drop function if exists public.create_planner_run(uuid, jsonb);
drop function if exists public.planner_target_is_available(uuid, uuid, uuid, public.session_item_type, uuid, uuid, uuid, uuid);
drop function if exists public.planner_engine_tuple_is_current(uuid, text, text, uuid, bigint, bigint);
drop function if exists public.planner_lock_user(uuid);
drop function if exists public.planner_context(uuid);
drop function if exists public.planner_budget(uuid, date);
drop function if exists public.planner_resolved_pack_version(uuid);
drop function if exists public.planner_plan_day(text);
drop function if exists public.engine_planner_snapshot(uuid);
drop function if exists engine.planner_snapshot(uuid);

drop trigger if exists study_sessions_planned_exclusive on public.study_sessions;
drop function if exists public.check_planned_session_exclusive();
drop index if exists public.study_sessions_one_per_run;
alter table public.study_sessions drop constraint if exists study_sessions_planner_run_type;
alter table public.study_sessions drop constraint if exists study_sessions_planner_run_fk;

-- Las tablas del Planner rechazan el borrado de filas mientras exista la cuenta; `drop table` no
-- dispara esos triggers.
drop table if exists public.planner_run_audit;
drop table if exists public.planner_items;
drop table if exists public.planner_runs;
drop function if exists public.reject_planner_history_update();
drop table if exists public.planner_config;
drop function if exists public.reject_planner_config_mutation();

revoke update (timezone) on public.profiles from authenticated;
drop trigger if exists profiles_timezone_declared on public.profiles;
drop function if exists public.check_profile_timezone();
drop function if exists public.timezone_is_declarable(text);
alter table public.profiles drop column if exists timezone;
