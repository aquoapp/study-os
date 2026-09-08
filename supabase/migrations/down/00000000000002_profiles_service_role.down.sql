-- Rollback de 00000000000002_profiles_service_role.sql
--
-- Reversible sin pérdida de datos: solo retira privilegios.

revoke select, insert, update, delete on public.profiles from service_role;
