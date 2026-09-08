-- Rollback de 00000000000001_profiles.sql
--
-- ATENCIÓN · DESTRUCTIVO. `drop table public.profiles` elimina los perfiles.
-- La Engineering Constitution exige aprobación humana explícita para migraciones
-- destructivas: este script no debe ejecutarse en un entorno con datos reales sin
-- esa aprobación. `packages/config` bloquea la operación en producción
-- (`allowsDestructiveReset = false`).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

drop trigger if exists profiles_set_updated_at on public.profiles;

drop table if exists public.profiles;
