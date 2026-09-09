-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 7 · Fuentes y versiones de fuente (N4)
--
-- CDEM §5 · Master §30–§31 · TA §9 · EC-001 · EC-008 · INV-110
-- ADR-005 puntos 1 y 2: subsumidos por las fuentes anteriores (disposición de Phase 1A).
-- DI-1A-7 · la autoridad es de la versión; cadena de supersesión acíclica; intervalo válido
-- Rollback: supabase/migrations/down/00000000000007_sources.down.sql
-- ---------------------------------------------------------------------------

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authority text not null,
  source_type text not null,
  provenance_class public.provenance_class not null,
  canonical_url text,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint sources_title_length check (char_length(title) between 1 and 300),
  constraint sources_authority_length check (char_length(authority) between 1 and 200),
  constraint sources_type_format check (source_type ~ '^[A-Z_]{2,40}$'),
  -- CDEM §23 · una fuente PERSONAL no puede reclamar procedencia OFFICIAL: la clase es
  -- de la fuente, y una fuente canónica nunca es PERSONAL.
  constraint sources_not_personal check (provenance_class <> 'PERSONAL')
);

comment on table public.sources is
  'CDEM §5 · familia lógica de documento con autoridad y clase de procedencia. La '
  'autoridad operativa la tiene la versión (source_versions).';

create table if not exists public.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  version_label text not null,
  publication_date date,
  effective_from date not null,
  effective_to date,
  status public.source_version_status not null default 'DRAFT',
  checksum text,
  storage_path text,
  retrieved_at timestamptz,
  validated_at timestamptz,
  supersedes_version_id uuid references public.source_versions (id),
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint source_versions_label_unique unique (source_id, version_label),
  constraint source_versions_interval check (effective_to is null or effective_to > effective_from),
  constraint source_versions_not_self check (supersedes_version_id is null or supersedes_version_id <> id),
  constraint source_versions_checksum_format
    check (checksum is null or checksum ~ '^[0-9a-f]{64}$')
);

comment on table public.source_versions is
  'CDEM §5 · instancia fechada de una fuente, con vigencia, checksum y supersesión. '
  'SUPERSEDED sigue direccionable (DI-07); WITHDRAWN nunca es vigente.';

-- DI-1A-7 · la cadena de supersesión es de la misma fuente y no forma ciclos; una
-- versión OFFICIAL exige checksum.
create or replace function public.check_source_version_chain()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cursor_id uuid := new.supersedes_version_id;
  hops integer := 0;
  same_source uuid;
begin
  if new.supersedes_version_id is not null then
    select sv.source_id into same_source
      from public.source_versions sv where sv.id = new.supersedes_version_id;
    if same_source is null or same_source <> new.source_id then
      raise exception 'DI-1A-7 · una versión solo puede suceder a otra de la misma fuente'
        using errcode = 'foreign_key_violation';
    end if;
    while cursor_id is not null and hops < 1000 loop
      if cursor_id = new.id then
        raise exception 'DI-1A-7 · la cadena de supersesión no puede formar un ciclo'
          using errcode = 'check_violation';
      end if;
      select sv.supersedes_version_id into cursor_id
        from public.source_versions sv where sv.id = cursor_id;
      hops := hops + 1;
    end loop;
  end if;

  if new.status in ('CURRENT', 'SUPERSEDED')
     and exists (select 1 from public.sources s
                 where s.id = new.source_id and s.provenance_class = 'OFFICIAL')
     and new.checksum is null then
    raise exception 'INV-110 · una versión OFFICIAL vigente o superseded exige checksum'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.check_source_version_chain() from public;

drop trigger if exists source_versions_chain on public.source_versions;
create trigger source_versions_chain
  before insert or update on public.source_versions
  for each row execute function public.check_source_version_chain();

-- RLS y grants ----------------------------------------------------------------
-- CDEM §22 · «source versions · authenticated/read policy as needed». Se admite la
-- lectura de los metadatos de procedencia por usuarios autenticados; nunca la
-- escritura.

alter table public.sources enable row level security;
alter table public.sources force row level security;
drop policy if exists sources_select_authenticated on public.sources;
create policy sources_select_authenticated
  on public.sources for select to authenticated
  using (true);
revoke all on public.sources from public, anon, authenticated;
grant select on public.sources to authenticated;
grant select, insert, update, delete on public.sources to service_role;

alter table public.source_versions enable row level security;
alter table public.source_versions force row level security;
drop policy if exists source_versions_select_authenticated on public.source_versions;
create policy source_versions_select_authenticated
  on public.source_versions for select to authenticated
  using (status <> 'DRAFT');
revoke all on public.source_versions from public, anon, authenticated;
grant select on public.source_versions to authenticated;
grant select, insert, update, delete on public.source_versions to service_role;
