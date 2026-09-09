-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 10 · Claves de respuesta versionadas en `content` (N7)
--
-- ADR-006 · ACCEPTED · INV-101 · las claves y todo marcador de corrección viven fuera de
--   todo esquema expuesto; ningún cliente ordinario las lee ni las muta.
-- ADR-011 · el esquema es `content` (no expuesto, sin USAGE para roles de cliente).
-- Master §18 · CDEM §6 · EC-007 · REQ-B04 · REQ-B05 · SD-021 (la opción correcta pertenece
--   a la representación, que pertenece a la pregunta)
-- Rollback: supabase/migrations/down/00000000000010_answer_keys.down.sql
-- ---------------------------------------------------------------------------

create table if not exists content.answer_key_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  representation_id uuid not null,
  correct_option_id uuid not null,
  key_status public.key_status not null,
  source_version_id uuid not null references public.source_versions (id),
  explanation text,
  effective_from date not null,
  effective_to date,
  supersedes_key_id uuid references content.answer_key_versions (id),
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  -- CDEM §23 · REQ-B05 · la opción correcta pertenece a la misma pregunta: por la
  -- representación, que a su vez pertenece a la pregunta.
  constraint answer_key_versions_representation_fk
    foreign key (representation_id, question_id)
    references public.question_representations (id, question_id),
  constraint answer_key_versions_option_fk
    foreign key (correct_option_id, representation_id)
    references public.question_options (id, representation_id),
  constraint answer_key_versions_interval
    check (effective_to is null or effective_to > effective_from),
  constraint answer_key_versions_not_self
    check (supersedes_key_id is null or supersedes_key_id <> id)
);

comment on table content.answer_key_versions is
  'ADR-006 · INV-101 · clave oficial versionada PROVISIONAL → FINAL → AMENDED (EC-007). Fuera '
  'de todo esquema expuesto; solo funciones de servidor la leen.';

-- Una sola clave vigente por pregunta.
create unique index if not exists answer_key_versions_one_current
  on content.answer_key_versions (question_id)
  where effective_to is null;

-- La cadena de supersesión es de la misma pregunta.
create or replace function content.check_answer_key_chain()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.supersedes_key_id is not null and not exists (
    select 1 from content.answer_key_versions k
    where k.id = new.supersedes_key_id and k.question_id = new.question_id
  ) then
    raise exception 'EC-007 · una clave solo puede suceder a otra de la misma pregunta'
      using errcode = 'foreign_key_violation';
  end if;
  -- INV-110 · la fuente de una clave es OFFICIAL o VERIFIED; nunca GENERATED ni PERSONAL
  -- salvo en un pack de fixtures GENERATED, donde la representación también lo es.
  if exists (
    select 1
    from public.source_versions sv
    join public.sources s on s.id = sv.source_id
    join public.question_representations r on r.id = new.representation_id
    where sv.id = new.source_version_id
      and r.provenance_class = 'OFFICIAL'
      and s.provenance_class <> 'OFFICIAL'
  ) then
    raise exception 'INV-110 · la clave de una representación OFFICIAL exige una fuente OFFICIAL'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function content.check_answer_key_chain() from public;

drop trigger if exists answer_key_versions_chain on content.answer_key_versions;
create trigger answer_key_versions_chain
  before insert or update on content.answer_key_versions
  for each row execute function content.check_answer_key_chain();

-- Frontera (ADR-006 · ADR-011 · SI-1A-2) ------------------------------------------
-- Sin USAGE de esquema para los roles de cliente (migración 3), sin grants sobre la
-- tabla, RLS forzado sin políticas: tres capas, y ninguna es la única.

alter table content.answer_key_versions enable row level security;
alter table content.answer_key_versions force row level security;
revoke all on content.answer_key_versions from public, anon, authenticated;
grant select, insert, update, delete on content.answer_key_versions to service_role;
