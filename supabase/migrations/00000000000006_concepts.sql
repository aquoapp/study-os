-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 6 · Identidad estable de concepto, versiones y prerrequisitos (N3)
--
-- ADR-009 v1.1 · ACCEPTED · identidad estable por pack (`concept_key` inmutable,
--   convención <slug>-<hash8>), representación y colocación versionadas en
--   `concept_versions`, prerrequisitos sobre identidades estables.
-- REQ-B01 · REQ-B14 · EC-006 · DI-1A-1 · DI-1A-2 · DI-1A-6
-- Rollback: supabase/migrations/down/00000000000006_concepts.down.sql
-- ---------------------------------------------------------------------------

create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs (id),
  concept_key text not null,
  status public.content_status not null default 'DRAFT',
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint concepts_key_unique unique (exam_pack_id, concept_key),
  constraint concepts_id_pack_unique unique (id, exam_pack_id),
  -- ADR-009 v1.1 §A.1 · <slug>-<hash8>, ≤ 64 caracteres.
  constraint concepts_key_convention
    check (concept_key ~ '^[a-z0-9]+(-[a-z0-9]+)*-[0-9a-f]{8}$' and char_length(concept_key) <= 64)
);

comment on table public.concepts is
  'ADR-009 · identidad pedagógica estable dentro del linaje de un pack. Sin contenido '
  'visible: título, descripción y colocación viven en concept_versions.';
comment on column public.concepts.concept_key is
  'ADR-009 v1.1 §A · <slug>-<hash8>, derivada del slug del pack y del título de creación; '
  'exam-neutral, sin códigos de programa; inmutable una vez publicada o referenciada.';

create table if not exists public.concept_versions (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null,
  exam_pack_id uuid not null,
  exam_pack_version_id uuid not null,
  topic_id uuid not null,
  title text not null,
  description text,
  difficulty_hint text,
  official_code text,
  sort_order integer not null,
  source_version_id uuid,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  -- Mismo pack en las tres direcciones (DI-1A-1).
  constraint concept_versions_concept_fk
    foreign key (concept_id, exam_pack_id) references public.concepts (id, exam_pack_id),
  constraint concept_versions_version_fk
    foreign key (exam_pack_version_id, exam_pack_id) references public.exam_pack_versions (id, exam_pack_id),
  -- El tema pertenece a la misma versión de pack (DI-1A-2).
  constraint concept_versions_topic_fk
    foreign key (topic_id, exam_pack_version_id) references public.topics (id, exam_pack_version_id),
  constraint concept_versions_unique unique (concept_id, exam_pack_version_id),
  constraint concept_versions_sort_unique unique (topic_id, sort_order),
  constraint concept_versions_title_length check (char_length(title) between 1 and 200),
  constraint concept_versions_official_code_format
    check (official_code is null or official_code ~ '^[A-Za-z0-9._-]{1,32}$')
);

comment on table public.concept_versions is
  'ADR-009 v1.1 §C · representación y colocación de un concepto bajo el tema de una versión '
  'de pack. Aquí vive el código oficial del programa, nunca en la identidad.';

create table if not exists public.concept_prerequisites (
  concept_id uuid not null,
  prerequisite_concept_id uuid not null,
  exam_pack_id uuid not null,
  strength text,
  rationale text,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint concept_prerequisites_pk primary key (concept_id, prerequisite_concept_id),
  constraint concept_prerequisites_not_self check (concept_id <> prerequisite_concept_id),
  constraint concept_prerequisites_concept_fk
    foreign key (concept_id, exam_pack_id) references public.concepts (id, exam_pack_id),
  constraint concept_prerequisites_prerequisite_fk
    foreign key (prerequisite_concept_id, exam_pack_id) references public.concepts (id, exam_pack_id),
  constraint concept_prerequisites_strength
    check (strength is null or strength in ('WEAK', 'MEDIUM', 'STRONG'))
);

comment on table public.concept_prerequisites is
  'CDEM §4 · ADR-009 v1.1 §C · prerrequisitos sobre identidades estables, mismo pack, sin '
  'autorreferencia. Un prerrequisito específico de versión sería una decisión nueva (ADR).';

-- Inmutabilidad de la clave (ADR-009 v1.1 §A.5) ------------------------------

create or replace function public.reject_concept_key_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  mapped boolean := false;
begin
  if new.concept_key is distinct from old.concept_key then
    -- question_concepts llega en una migración posterior: se consulta solo si existe, para
    -- que esta migración y su rollback no dependan de aquella.
    -- Referencia estática, resuelta solo cuando la rama se ejecuta (la tabla ya existe).
    if to_regclass('public.question_concepts') is not null then
      mapped := exists (select 1 from public.question_concepts qc where qc.concept_id = old.id);
    end if;
    if old.status = 'PUBLISHED'
       or exists (select 1 from public.concept_versions cv where cv.concept_id = old.id)
       or exists (select 1 from public.concept_prerequisites cp
                  where cp.concept_id = old.id or cp.prerequisite_concept_id = old.id)
       or mapped then
      raise exception 'ADR-009 · concept_key es inmutable una vez publicada o referenciada (%)', old.concept_key
        using errcode = 'restrict_violation';
    end if;
  end if;
  if new.exam_pack_id is distinct from old.exam_pack_id then
    raise exception 'ADR-009 · un concepto no cambia de pack'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_concept_key_change() from public;

drop trigger if exists concepts_key_immutable on public.concepts;
create trigger concepts_key_immutable
  before update on public.concepts
  for each row execute function public.reject_concept_key_change();

drop trigger if exists concepts_set_updated_at on public.concepts;
create trigger concepts_set_updated_at
  before update on public.concepts
  for each row execute function public.set_updated_at();

drop trigger if exists concepts_no_delete_published on public.concepts;
create trigger concepts_no_delete_published
  before delete on public.concepts
  for each row execute function public.reject_delete_of_published();

-- RLS y grants ----------------------------------------------------------------

alter table public.concepts enable row level security;
alter table public.concepts force row level security;
drop policy if exists concepts_select_published on public.concepts;
create policy concepts_select_published
  on public.concepts for select to authenticated
  using (status = 'PUBLISHED');
revoke all on public.concepts from public, anon, authenticated;
grant select on public.concepts to authenticated;
grant select, insert, update, delete on public.concepts to service_role;

alter table public.concept_versions enable row level security;
alter table public.concept_versions force row level security;
drop policy if exists concept_versions_select_published on public.concept_versions;
create policy concept_versions_select_published
  on public.concept_versions for select to authenticated
  using (exists (
    select 1 from public.exam_pack_versions v
    where v.id = concept_versions.exam_pack_version_id and v.status = 'PUBLISHED'
  ));
revoke all on public.concept_versions from public, anon, authenticated;
grant select on public.concept_versions to authenticated;
grant select, insert, update, delete on public.concept_versions to service_role;

alter table public.concept_prerequisites enable row level security;
alter table public.concept_prerequisites force row level security;
drop policy if exists concept_prerequisites_select_published on public.concept_prerequisites;
create policy concept_prerequisites_select_published
  on public.concept_prerequisites for select to authenticated
  using (exists (
    select 1 from public.concepts c
    where c.id = concept_prerequisites.concept_id and c.status = 'PUBLISHED'
  ));
revoke all on public.concept_prerequisites from public, anon, authenticated;
grant select on public.concept_prerequisites to authenticated;
grant select, insert, update, delete on public.concept_prerequisites to service_role;
