-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 1 · profiles + RLS
--
-- P0-S5  · «Esqueleto de auth + tabla profiles (identidad, sin dominio)»
-- REQ-A07 · «Auth con perfil separado de la identidad de auth» · `profiles` 1:1 con `auth.users`
-- REQ-C13 · «RLS con test de aislamiento por tabla»
-- EC-009  · «Política RLS por tabla + test de aislamiento obligatorio en la misma migración»
--
-- Rollback: supabase/migrations/down/00000000000001_profiles.down.sql
-- Test de aislamiento: tests/integration/rls.userIsolation.profiles.spec.ts
--
-- `profiles` NO es una tabla de dominio: no contiene evidencia, ni proyecciones,
-- ni contenido. Solo separa el perfil de aplicación de la identidad de auth, que es
-- justamente lo que exige REQ-A07 (Technical Architecture §5.2, CDEM §3).
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  -- La clave primaria **es** el id de auth. Eso hace la relación 1:1 estructural:
  -- no puede haber dos perfiles para un usuario ni un perfil huérfano.
  id uuid primary key references auth.users (id) on delete cascade,

  display_name text,
  locale text not null default 'es',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 80),

  constraint profiles_locale_format
    check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

comment on table public.profiles is
  'REQ-A07 · perfil de aplicación, 1:1 con auth.users. Sin datos de dominio.';

comment on column public.profiles.id is
  'Igual a auth.users.id. La igualdad es la que garantiza la relación 1:1.';

-- updated_at ----------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Alta automática del perfil -------------------------------------------------

-- `security definer` porque debe escribir en `public.profiles` desde el contexto de
-- `auth.users`, donde el usuario todavía no tiene rol de aplicación. `search_path`
-- vacío y nombres cualificados: sin eso, una función definer es una vía de escalada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea el perfil 1:1 al darse de alta un usuario. ON CONFLICT DO NOTHING para que '
  'un reintento no falle: el alta debe ser idempotente.';

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- RLS ------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- `force` hace que la política se aplique también al propietario de la tabla.
-- Sin esto, una conexión con privilegios elevados atraviesa RLS sin avisar.
alter table public.profiles force row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

-- Lectura: solo el propio perfil.
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Escritura: solo el propio perfil, y sin poder reasignarlo a otra persona.
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Deliberadamente NO hay política de INSERT ni de DELETE para `authenticated`:
--   - el INSERT lo hace el trigger de alta, no el usuario;
--   - el DELETE cascada desde `auth.users`. La política de borrado de cuenta es
--     OBS-03 y se decide antes de producción (Phase 11), no aquí.

-- Grants ---------------------------------------------------------------------

revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

-- `anon` no tiene ningún acceso: un perfil no es información pública.
