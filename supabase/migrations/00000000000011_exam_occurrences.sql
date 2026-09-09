-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 11 · Secciones, convocatorias, modelos y ocurrencias (N8)
--
-- ADR-010 v1.1 · ACCEPTED · modelo mínimo exam-neutral: secciones y modelos son datos
--   del pack, nunca un enum global; reserva explícita; posiciones oficiales únicas;
--   una pregunta por modelo; procedencia obligatoria.
-- EC-018 · INV-110 · REQ-B13 (la carga oficial es de Phase 1B)
-- Rollback: supabase/migrations/down/00000000000011_exam_occurrences.down.sql
-- ---------------------------------------------------------------------------

create table if not exists public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs (id),
  code text not null,
  title text not null,
  sort_order integer not null,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint exam_sections_code_unique unique (exam_pack_id, code),
  constraint exam_sections_sort_unique unique (exam_pack_id, sort_order),
  constraint exam_sections_id_pack_unique unique (id, exam_pack_id),
  constraint exam_sections_code_format check (code ~ '^[A-Z0-9_]{1,32}$'),
  constraint exam_sections_title_length check (char_length(title) between 1 and 200)
);

comment on table public.exam_sections is
  'ADR-010 v1.1 · partes del examen definidas por el pack. Los códigos son datos del pack: '
  'un segundo pack trae los suyos sin cambio de esquema (EC-018).';

create table if not exists public.exam_sittings (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs (id),
  sitting_date date not null,
  call_label text not null,
  source_version_id uuid not null references public.source_versions (id),
  notes text,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint exam_sittings_unique unique (exam_pack_id, sitting_date, call_label),
  constraint exam_sittings_id_pack_unique unique (id, exam_pack_id),
  constraint exam_sittings_call_format check (call_label ~ '^[A-Za-z0-9._-]{1,40}$')
);

comment on table public.exam_sittings is
  'ADR-010 · convocatoria o sesión oficial con su procedencia (versión de fuente obligatoria).';

create table if not exists public.exam_sitting_models (
  id uuid primary key default gen_random_uuid(),
  sitting_id uuid not null,
  exam_pack_id uuid not null,
  model_code text not null,
  source_version_id uuid not null references public.source_versions (id),
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint exam_sitting_models_sitting_fk
    foreign key (sitting_id, exam_pack_id) references public.exam_sittings (id, exam_pack_id),
  constraint exam_sitting_models_unique unique (sitting_id, model_code),
  constraint exam_sitting_models_id_pack_unique unique (id, exam_pack_id),
  constraint exam_sitting_models_code_format check (model_code ~ '^[A-Z0-9_]{1,16}$')
);

comment on table public.exam_sitting_models is
  'ADR-010 v1.1 · variante (modelo) de una convocatoria. Filas, nunca un enum: A y B son '
  'datos de la convocatoria.';

create table if not exists public.exam_occurrences (
  id uuid primary key default gen_random_uuid(),
  sitting_model_id uuid not null,
  section_id uuid not null,
  question_id uuid not null,
  exam_pack_id uuid not null,
  display_no integer not null,
  is_reserve boolean not null default false,
  provenance_class public.provenance_class not null,
  source_version_id uuid not null references public.source_versions (id),
  source_file_ref text,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  -- Mismo pack en las tres direcciones (DI-1A-1).
  constraint exam_occurrences_model_fk
    foreign key (sitting_model_id, exam_pack_id) references public.exam_sitting_models (id, exam_pack_id),
  constraint exam_occurrences_section_fk
    foreign key (section_id, exam_pack_id) references public.exam_sections (id, exam_pack_id),
  constraint exam_occurrences_question_fk
    foreign key (question_id, exam_pack_id) references public.canonical_questions (id, exam_pack_id),
  -- Sin posiciones oficiales duplicadas; una pregunta por modelo.
  constraint exam_occurrences_position_unique unique (sitting_model_id, section_id, display_no),
  constraint exam_occurrences_question_unique unique (sitting_model_id, question_id),
  constraint exam_occurrences_display_positive check (display_no >= 1),
  constraint exam_occurrences_not_personal check (provenance_class <> 'PERSONAL')
);

comment on table public.exam_occurrences is
  'ADR-010 v1.1 · aparición de una pregunta canónica en (convocatoria, modelo, sección, '
  'posición) con reserva explícita y procedencia obligatoria. La clave sigue por pregunta.';

-- INV-110 · una ocurrencia OFFICIAL exige fuente OFFICIAL.
create or replace function public.check_occurrence_provenance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.provenance_class = 'OFFICIAL' and not exists (
    select 1 from public.source_versions sv
    join public.sources s on s.id = sv.source_id
    where sv.id = new.source_version_id and s.provenance_class = 'OFFICIAL'
  ) then
    raise exception 'INV-110 · una ocurrencia OFFICIAL exige una versión de fuente OFFICIAL'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.check_occurrence_provenance() from public;

drop trigger if exists exam_occurrences_provenance on public.exam_occurrences;
create trigger exam_occurrences_provenance
  before insert or update on public.exam_occurrences
  for each row execute function public.check_occurrence_provenance();

-- RLS y grants ----------------------------------------------------------------
-- Legibles por authenticated cuando su pack está publicado. Ninguna columna de estas
-- tablas revela corrección (SI-1A-5).

alter table public.exam_sections enable row level security;
alter table public.exam_sections force row level security;
drop policy if exists exam_sections_select_published on public.exam_sections;
create policy exam_sections_select_published
  on public.exam_sections for select to authenticated
  using (exists (select 1 from public.exam_packs p where p.id = exam_sections.exam_pack_id and p.status = 'PUBLISHED'));
revoke all on public.exam_sections from public, anon, authenticated;
grant select on public.exam_sections to authenticated;
grant select, insert, update, delete on public.exam_sections to service_role;

alter table public.exam_sittings enable row level security;
alter table public.exam_sittings force row level security;
drop policy if exists exam_sittings_select_published on public.exam_sittings;
create policy exam_sittings_select_published
  on public.exam_sittings for select to authenticated
  using (exists (select 1 from public.exam_packs p where p.id = exam_sittings.exam_pack_id and p.status = 'PUBLISHED'));
revoke all on public.exam_sittings from public, anon, authenticated;
grant select on public.exam_sittings to authenticated;
grant select, insert, update, delete on public.exam_sittings to service_role;

alter table public.exam_sitting_models enable row level security;
alter table public.exam_sitting_models force row level security;
drop policy if exists exam_sitting_models_select_published on public.exam_sitting_models;
create policy exam_sitting_models_select_published
  on public.exam_sitting_models for select to authenticated
  using (exists (select 1 from public.exam_packs p where p.id = exam_sitting_models.exam_pack_id and p.status = 'PUBLISHED'));
revoke all on public.exam_sitting_models from public, anon, authenticated;
grant select on public.exam_sitting_models to authenticated;
grant select, insert, update, delete on public.exam_sitting_models to service_role;

alter table public.exam_occurrences enable row level security;
alter table public.exam_occurrences force row level security;
drop policy if exists exam_occurrences_select_published on public.exam_occurrences;
create policy exam_occurrences_select_published
  on public.exam_occurrences for select to authenticated
  using (exists (select 1 from public.canonical_questions q where q.id = exam_occurrences.question_id and q.status = 'PUBLISHED'));
revoke all on public.exam_occurrences from public, anon, authenticated;
grant select on public.exam_occurrences to authenticated;
grant select, insert, update, delete on public.exam_occurrences to service_role;
