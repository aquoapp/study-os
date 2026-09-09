-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 12 · Supuestos prácticos (N9)
--
-- CDEM §7 · Master §19 · REQ-B12 (estructura; el encaje de los prácticos oficiales es
--   de Phase 1B) · INV-110 · DI-1A-1
-- Rollback: supabase/migrations/down/00000000000012_practicals.down.sql
-- ---------------------------------------------------------------------------

create table if not exists public.practicals (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs (id),
  title text not null,
  scenario text not null,
  provenance_class public.provenance_class not null,
  source_version_id uuid references public.source_versions (id),
  status public.content_status not null default 'DRAFT',
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint practicals_id_pack_unique unique (id, exam_pack_id),
  constraint practicals_title_length check (char_length(title) between 1 and 200),
  constraint practicals_scenario_length check (char_length(scenario) between 1 and 20000),
  constraint practicals_official_requires_source
    check (provenance_class <> 'OFFICIAL' or source_version_id is not null),
  constraint practicals_not_personal check (provenance_class <> 'PERSONAL')
);

comment on table public.practicals is
  'CDEM §7 · escenario común de un supuesto práctico. Reutiliza la maquinaria canónica de '
  'preguntas a través de practical_questions.';

create table if not exists public.practical_questions (
  id uuid primary key default gen_random_uuid(),
  practical_id uuid not null,
  question_id uuid not null,
  exam_pack_id uuid not null,
  sort_order integer not null,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint practical_questions_practical_fk
    foreign key (practical_id, exam_pack_id) references public.practicals (id, exam_pack_id),
  constraint practical_questions_question_fk
    foreign key (question_id, exam_pack_id) references public.canonical_questions (id, exam_pack_id),
  constraint practical_questions_sort_unique unique (practical_id, sort_order),
  constraint practical_questions_question_unique unique (practical_id, question_id)
);

comment on table public.practical_questions is
  'CDEM §7 · preguntas canónicas encadenadas de un práctico, ordenadas, del mismo pack.';

drop trigger if exists practicals_set_updated_at on public.practicals;
create trigger practicals_set_updated_at
  before update on public.practicals
  for each row execute function public.set_updated_at();

drop trigger if exists practicals_no_delete_published on public.practicals;
create trigger practicals_no_delete_published
  before delete on public.practicals
  for each row execute function public.reject_delete_of_published();

-- INV-110 · un práctico OFFICIAL exige fuente OFFICIAL.
create or replace function public.check_practical_provenance()
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
    raise exception 'INV-110 · un práctico OFFICIAL exige una versión de fuente OFFICIAL'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.check_practical_provenance() from public;

drop trigger if exists practicals_provenance on public.practicals;
create trigger practicals_provenance
  before insert or update on public.practicals
  for each row execute function public.check_practical_provenance();

-- RLS y grants ----------------------------------------------------------------

alter table public.practicals enable row level security;
alter table public.practicals force row level security;
drop policy if exists practicals_select_published on public.practicals;
create policy practicals_select_published
  on public.practicals for select to authenticated
  using (status = 'PUBLISHED');
revoke all on public.practicals from public, anon, authenticated;
grant select on public.practicals to authenticated;
grant select, insert, update, delete on public.practicals to service_role;

alter table public.practical_questions enable row level security;
alter table public.practical_questions force row level security;
drop policy if exists practical_questions_select_published on public.practical_questions;
create policy practical_questions_select_published
  on public.practical_questions for select to authenticated
  using (exists (select 1 from public.practicals p where p.id = practical_questions.practical_id and p.status = 'PUBLISHED'));
revoke all on public.practical_questions from public, anon, authenticated;
grant select on public.practical_questions to authenticated;
grant select, insert, update, delete on public.practical_questions to service_role;
