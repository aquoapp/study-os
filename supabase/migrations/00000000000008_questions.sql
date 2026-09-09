-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 8 · Identidad de pregunta, representaciones inmutables y opciones (N5)
--
-- SD-021 · ACCEPTED · `canonical_questions` es la identidad semántica estable;
--   `question_representations` es el contenido publicado inmutable, enlazado por
--   supersesión; las opciones pertenecen a una representación.
-- CDEM §6 · Master §17–§18 · EC-007 · REQ-B03 · DI-1A-4 · DI-1A-5 · SI-1A-5 · PI-1A-1/2
-- Rollback: supabase/migrations/down/00000000000008_questions.down.sql
-- ---------------------------------------------------------------------------

create table if not exists public.canonical_questions (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs (id),
  question_type text not null,
  status public.content_status not null default 'DRAFT',
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint canonical_questions_id_pack_unique unique (id, exam_pack_id),
  constraint canonical_questions_type_format check (question_type ~ '^[A-Z_]{2,40}$')
);

comment on table public.canonical_questions is
  'SD-021 · identidad semántica estable de una pregunta, con ámbito de pack. Sin contenido: '
  'el enunciado y las opciones viven en question_representations.';

create table if not exists public.question_representations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.canonical_questions (id),
  representation_no integer not null,
  stem text not null,
  official_reference text,
  presentation_json jsonb not null default '{}'::jsonb,
  provenance_class public.provenance_class not null,
  source_version_id uuid references public.source_versions (id),
  status public.content_status not null default 'DRAFT',
  supersedes_representation_id uuid references public.question_representations (id),
  superseded_by_representation_id uuid references public.question_representations (id),
  published_at timestamptz,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint question_representations_no_unique unique (question_id, representation_no),
  constraint question_representations_id_question_unique unique (id, question_id),
  constraint question_representations_no_positive check (representation_no >= 1),
  constraint question_representations_stem_length check (char_length(stem) between 1 and 4000),
  constraint question_representations_not_self
    check (supersedes_representation_id is null or supersedes_representation_id <> id),
  constraint question_representations_not_self_superseded
    check (superseded_by_representation_id is null or superseded_by_representation_id <> id),
  -- INV-110 · una representación OFFICIAL exige versión de fuente.
  constraint question_representations_official_requires_source
    check (provenance_class <> 'OFFICIAL' or source_version_id is not null),
  -- CDEM §23 · el contenido canónico nunca es PERSONAL.
  constraint question_representations_not_personal check (provenance_class <> 'PERSONAL'),
  -- SI-1A-5 · la presentación no puede llevar marcadores de corrección.
  constraint question_representations_presentation_no_markers
    check (not (presentation_json ?| array['correct', 'correct_option', 'correct_option_id', 'answer', 'answer_key', 'is_correct', 'solution']))
);

comment on table public.question_representations is
  'SD-021 · contenido publicado inmutable de una pregunta. Una corrección crea una '
  'representación nueva enlazada por supersesión; nada publicado se reescribe.';

-- DI-1A-4 · exactamente una representación publicada vigente por pregunta.
create unique index if not exists question_representations_one_current
  on public.question_representations (question_id)
  where status = 'PUBLISHED' and superseded_by_representation_id is null;

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.question_representations (id),
  option_key text not null,
  body text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),

  constraint question_options_key_unique unique (representation_id, option_key),
  constraint question_options_sort_unique unique (representation_id, sort_order),
  constraint question_options_id_representation_unique unique (id, representation_id),
  constraint question_options_key_format check (option_key ~ '^[A-Z0-9]{1,4}$'),
  constraint question_options_body_length check (char_length(body) between 1 and 4000)
);

comment on table public.question_options is
  'CDEM §6 · REQ-B03 · opciones de una representación. La corrección NO vive aquí: ninguna '
  'columna de esta tabla puede indicar la opción correcta (SI-1A-5, ADR-006).';

-- Inmutabilidad (SD-021, L) ----------------------------------------------------
-- Una representación PUBLISHED solo admite dos cambios: pasar a RETIRED y recibir el
-- enlace superseded_by, una sola vez. Sus opciones no se tocan.

create or replace function public.reject_published_representation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'PUBLISHED' and not ingest.purge_in_progress() then
      raise exception 'DI-1A-3 · una representación publicada no se borra'
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  -- La purga de un pack GENERATED sintético deshace los enlaces antes de borrar.
  if ingest.purge_in_progress() then
    return new;
  end if;

  if old.status = 'PUBLISHED' then
    if new.question_id is distinct from old.question_id
       or new.representation_no is distinct from old.representation_no
       or new.stem is distinct from old.stem
       or new.official_reference is distinct from old.official_reference
       or new.presentation_json is distinct from old.presentation_json
       or new.provenance_class is distinct from old.provenance_class
       or new.source_version_id is distinct from old.source_version_id
       or new.supersedes_representation_id is distinct from old.supersedes_representation_id
       or new.published_at is distinct from old.published_at
       or new.promotion_id is distinct from old.promotion_id then
      raise exception 'SD-021 · el contenido publicado de una representación es inmutable'
        using errcode = 'restrict_violation';
    end if;
    if new.status not in ('PUBLISHED', 'RETIRED') then
      raise exception 'SD-021 · una representación publicada solo puede retirarse'
        using errcode = 'restrict_violation';
    end if;
    if old.superseded_by_representation_id is not null
       and new.superseded_by_representation_id is distinct from old.superseded_by_representation_id then
      raise exception 'SD-021 · el enlace de supersesión se fija una sola vez'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.reject_published_representation_mutation() from public;

drop trigger if exists question_representations_immutable on public.question_representations;
create trigger question_representations_immutable
  before update or delete on public.question_representations
  for each row execute function public.reject_published_representation_mutation();

create or replace function public.reject_published_option_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_id uuid := coalesce(new.representation_id, old.representation_id);
begin
  if ingest.purge_in_progress() then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.question_representations r
             where r.id = target_id and r.status = 'PUBLISHED') then
    raise exception 'SD-021 · las opciones de una representación publicada son inmutables'
      using errcode = 'restrict_violation';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.reject_published_option_mutation() from public;

drop trigger if exists question_options_immutable on public.question_options;
create trigger question_options_immutable
  before update or delete on public.question_options
  for each row execute function public.reject_published_option_mutation();

-- Una opción no puede añadirse a una representación ya publicada.
create or replace function public.reject_option_insert_on_published()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.question_representations r
             where r.id = new.representation_id and r.status = 'PUBLISHED') then
    raise exception 'SD-021 · no se añaden opciones a una representación publicada'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_option_insert_on_published() from public;

drop trigger if exists question_options_no_insert_on_published on public.question_options;
create trigger question_options_no_insert_on_published
  before insert on public.question_options
  for each row execute function public.reject_option_insert_on_published();

drop trigger if exists canonical_questions_set_updated_at on public.canonical_questions;
create trigger canonical_questions_set_updated_at
  before update on public.canonical_questions
  for each row execute function public.set_updated_at();

drop trigger if exists canonical_questions_no_delete_published on public.canonical_questions;
create trigger canonical_questions_no_delete_published
  before delete on public.canonical_questions
  for each row execute function public.reject_delete_of_published();

-- RLS y grants ----------------------------------------------------------------

alter table public.canonical_questions enable row level security;
alter table public.canonical_questions force row level security;
drop policy if exists canonical_questions_select_published on public.canonical_questions;
create policy canonical_questions_select_published
  on public.canonical_questions for select to authenticated
  using (status = 'PUBLISHED');
revoke all on public.canonical_questions from public, anon, authenticated;
grant select on public.canonical_questions to authenticated;
grant select, insert, update, delete on public.canonical_questions to service_role;

alter table public.question_representations enable row level security;
alter table public.question_representations force row level security;
drop policy if exists question_representations_select_published on public.question_representations;
create policy question_representations_select_published
  on public.question_representations for select to authenticated
  using (status = 'PUBLISHED');
revoke all on public.question_representations from public, anon, authenticated;
grant select on public.question_representations to authenticated;
grant select, insert, update, delete on public.question_representations to service_role;

alter table public.question_options enable row level security;
alter table public.question_options force row level security;
drop policy if exists question_options_select_published on public.question_options;
create policy question_options_select_published
  on public.question_options for select to authenticated
  using (exists (
    select 1 from public.question_representations r
    where r.id = question_options.representation_id and r.status = 'PUBLISHED'
  ));
revoke all on public.question_options from public, anon, authenticated;
grant select on public.question_options to authenticated;
grant select, insert, update, delete on public.question_options to service_role;
