-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 4 · Packs de examen y versiones (N1)
--
-- CDEM §4 · Master §11 · EC-018 («el primer pack es una fila; el shell es exam-neutral»)
-- DI-1A-1 · toda fila canónica pertenece a un pack · DI-1A-3 · sin borrado en caliente
-- CDEM §22 · contenido canónico: lectura authenticated · escritura admin/servidor
--
-- Rollback: supabase/migrations/down/00000000000004_exam_packs.down.sql
-- Pruebas: tests/integration/phase1a.foundation.spec.ts ·
--          tests/rls/rls.canonicalContent.userWrite.deny.spec.ts
-- ---------------------------------------------------------------------------

create table if not exists public.exam_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  short_name text,
  jurisdiction text,
  status public.content_status not null default 'DRAFT',
  current_version_id uuid,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exam_packs_slug_unique unique (slug),
  constraint exam_packs_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 64),
  constraint exam_packs_name_length check (char_length(name) between 1 and 200)
);

comment on table public.exam_packs is
  'CDEM §4 · contenedor exam-neutral de un examen. El primer pack es una fila, no una '
  'identidad del producto (EC-018).';

create table if not exists public.exam_pack_versions (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs (id),
  version_label text not null,
  effective_from date not null,
  effective_to date,
  status public.content_status not null default 'DRAFT',
  change_summary text,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exam_pack_versions_label_unique unique (exam_pack_id, version_label),
  -- Par (id, pack) referenciable: permite claves foráneas compuestas «mismo pack».
  constraint exam_pack_versions_id_pack_unique unique (id, exam_pack_id),
  constraint exam_pack_versions_interval check (effective_to is null or effective_to > effective_from),
  constraint exam_pack_versions_label_length check (char_length(version_label) between 1 and 64)
);

comment on table public.exam_pack_versions is
  'CDEM §4 · estado versionado del sílabo con vigencia. Todo contenido colocado cuelga de '
  'una versión (ADR-009 v1.1 §C).';

-- La versión vigente del pack: relación circular resuelta con ALTER TABLE.
alter table public.exam_packs
  drop constraint if exists exam_packs_current_version_fk;
alter table public.exam_packs
  add constraint exam_packs_current_version_fk
  foreign key (current_version_id, id) references public.exam_pack_versions (id, exam_pack_id);

-- updated_at ----------------------------------------------------------------

drop trigger if exists exam_packs_set_updated_at on public.exam_packs;
create trigger exam_packs_set_updated_at
  before update on public.exam_packs
  for each row execute function public.set_updated_at();

drop trigger if exists exam_pack_versions_set_updated_at on public.exam_pack_versions;
create trigger exam_pack_versions_set_updated_at
  before update on public.exam_pack_versions
  for each row execute function public.set_updated_at();

-- DI-1A-3 · una fila publicada no se borra en caliente ------------------------
-- Función compartida por las tablas canónicas con `status`. La purga de un pack
-- GENERATED sintético (ingest.purge_generated_pack) es la única excepción, y solo
-- dentro de su propia transacción.

create or replace function public.reject_delete_of_published()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'PUBLISHED' and not ingest.purge_in_progress() then
    raise exception 'DI-1A-3 · una fila publicada de %.% no se borra: se retira (RETIRED)',
      tg_table_schema, tg_table_name
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

comment on function public.reject_delete_of_published() is
  'DI-1A-3 · el borrado de una fila canónica PUBLISHED es un error; la retirada es un estado.';

revoke all on function public.reject_delete_of_published() from public;

drop trigger if exists exam_packs_no_delete_published on public.exam_packs;
create trigger exam_packs_no_delete_published
  before delete on public.exam_packs
  for each row execute function public.reject_delete_of_published();

drop trigger if exists exam_pack_versions_no_delete_published on public.exam_pack_versions;
create trigger exam_pack_versions_no_delete_published
  before delete on public.exam_pack_versions
  for each row execute function public.reject_delete_of_published();

-- RLS y grants (CDEM §22 · SI-1A-4) -------------------------------------------
-- Lectura para authenticated solo de lo publicado; ninguna escritura de cliente;
-- anon sin acceso; el rol de servicio (funciones de publicación, CI) con DML.

alter table public.exam_packs enable row level security;
alter table public.exam_packs force row level security;
drop policy if exists exam_packs_select_published on public.exam_packs;
create policy exam_packs_select_published
  on public.exam_packs for select to authenticated
  using (status = 'PUBLISHED');
revoke all on public.exam_packs from public, anon, authenticated;
grant select on public.exam_packs to authenticated;
grant select, insert, update, delete on public.exam_packs to service_role;

alter table public.exam_pack_versions enable row level security;
alter table public.exam_pack_versions force row level security;
drop policy if exists exam_pack_versions_select_published on public.exam_pack_versions;
create policy exam_pack_versions_select_published
  on public.exam_pack_versions for select to authenticated
  using (status = 'PUBLISHED');
revoke all on public.exam_pack_versions from public, anon, authenticated;
grant select on public.exam_pack_versions to authenticated;
grant select, insert, update, delete on public.exam_pack_versions to service_role;
