-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 0 · Extensiones, enums constitucionales y utilidades
--
-- P0-S4 · «Framework de migraciones y migración 0 (extensiones/enums)»
-- EC-011 · migraciones versionadas en el repositorio
--
-- Rollback: supabase/migrations/down/00000000000000_init.down.sql
--
-- ---------------------------------------------------------------------------
-- QUÉ NO CONTIENE ESTA MIGRACIÓN, Y POR QUÉ
--
-- No crea ninguna tabla de dominio ni de contenido: está fuera del alcance de
-- Phase 0 (Execution Plan §9).
--
-- No crea los esquemas `content`, `engine` y `audit` que propone ADR-001. Ese ADR
-- está en **PROPOSED**, y la ADR Policy v1.0 es explícita: «Only ACCEPTED ADRs may
-- authorize architectural change». Crear la separación de esquemas ahora sería
-- ejecutar una decisión arquitectónica que nadie ha aprobado todavía.
--
-- No habilita `pgvector`: ADR-001 punto 4 lo difiere a Phase 8 y solo si existe
-- corpus ingerido que lo justifique.
--
-- No declara los enums de dominio (estado de contenido, escala de confianza, tipo
-- de ítem de sesión, estado de sincronización). Todos dependen de decisiones
-- abiertas —BD-02, BD-03, BD-05, SD-006, SD-015— y congelarlos aquí obligaría a
-- migrarlos dos veces. El único enum que se declara es el que ya está congelado
-- por la Engineering Constitution.
-- ---------------------------------------------------------------------------

-- Extensiones ---------------------------------------------------------------

-- `gen_random_uuid()` y funciones criptográficas. Requerido por `profiles`.
create extension if not exists "pgcrypto" with schema extensions;

-- Enums congelados por la Constitution ---------------------------------------

-- EC-008 · «OFFICIAL / VERIFIED / GENERATED / PERSONAL must remain distinguishable
-- at data and UI levels». Manifest §5 lo repite como invariante no negociable.
-- La lista es cerrada y no depende de ninguna decisión abierta.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'provenance_class') then
    create type public.provenance_class as enum ('OFFICIAL', 'VERIFIED', 'GENERATED', 'PERSONAL');
  end if;
end
$$;

comment on type public.provenance_class is
  'EC-008 · procedencia del contenido. Lista cerrada por la Engineering Constitution; '
  'ampliarla exige ADR aceptado y aprobación humana (EC-019).';

-- Utilidades ----------------------------------------------------------------

-- Mantiene `updated_at` sin depender de que la aplicación se acuerde de ponerlo.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger de utilidad: fija updated_at en cada UPDATE. security invoker y '
  'search_path vacío para que no pueda usarse como vía de escalada de privilegios.';

revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to authenticated, service_role;
