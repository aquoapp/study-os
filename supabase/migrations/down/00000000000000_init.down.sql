-- Rollback de 00000000000000_init.sql
--
-- Reversible sin pérdida de datos: no crea tablas.
-- La extensión `pgcrypto` NO se elimina: otras partes de la plataforma pueden
-- depender de ella, y quitarla es más destructivo que dejarla.

drop function if exists public.set_updated_at();

drop type if exists public.provenance_class;
