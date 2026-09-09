-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 5 · Bloques y temas del sílabo (N2)
--
-- CDEM §4 · Master §11 «Exam Pack → Version → Block → Topic → Concept»
-- DI-1A-2 · jerarquía con ámbito de versión y códigos únicos por padre
-- Rollback: supabase/migrations/down/00000000000005_syllabus_hierarchy.down.sql
-- ---------------------------------------------------------------------------

create table if not exists public.syllabus_blocks (
  id uuid primary key default gen_random_uuid(),
  exam_pack_version_id uuid not null references public.exam_pack_versions (id),
  code text not null,
  title text not null,
  sort_order integer not null,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint syllabus_blocks_code_unique unique (exam_pack_version_id, code),
  constraint syllabus_blocks_sort_unique unique (exam_pack_version_id, sort_order),
  constraint syllabus_blocks_id_version_unique unique (id, exam_pack_version_id),
  constraint syllabus_blocks_code_format check (code ~ '^[A-Za-z0-9._-]{1,32}$'),
  constraint syllabus_blocks_title_length check (char_length(title) between 1 and 200)
);

comment on table public.syllabus_blocks is
  'CDEM §4 · bloque del sílabo de una versión de pack. El código es dato del pack, no '
  'un enum del shell (EC-018).';

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null,
  -- Desnormalizado a propósito: permite exigir que la colocación de un concepto
  -- (concept_versions) apunte a un tema de SU versión de pack (DI-1A-2).
  exam_pack_version_id uuid not null,
  code text not null,
  title text not null,
  sort_order integer not null,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint topics_block_fk
    foreign key (block_id, exam_pack_version_id)
    references public.syllabus_blocks (id, exam_pack_version_id),
  constraint topics_code_unique unique (block_id, code),
  constraint topics_sort_unique unique (block_id, sort_order),
  constraint topics_id_version_unique unique (id, exam_pack_version_id),
  constraint topics_code_format check (code ~ '^[A-Za-z0-9._-]{1,32}$'),
  constraint topics_title_length check (char_length(title) between 1 and 200)
);

comment on table public.topics is
  'CDEM §4 · tema de un bloque. `exam_pack_version_id` repite la versión del bloque para '
  'que las claves foráneas compuestas garanticen la coherencia de versión.';

-- RLS y grants ----------------------------------------------------------------
-- Bloques y temas no tienen estado propio: son legibles cuando su versión de pack
-- está publicada.

alter table public.syllabus_blocks enable row level security;
alter table public.syllabus_blocks force row level security;
drop policy if exists syllabus_blocks_select_published on public.syllabus_blocks;
create policy syllabus_blocks_select_published
  on public.syllabus_blocks for select to authenticated
  using (exists (
    select 1 from public.exam_pack_versions v
    where v.id = syllabus_blocks.exam_pack_version_id and v.status = 'PUBLISHED'
  ));
revoke all on public.syllabus_blocks from public, anon, authenticated;
grant select on public.syllabus_blocks to authenticated;
grant select, insert, update, delete on public.syllabus_blocks to service_role;

alter table public.topics enable row level security;
alter table public.topics force row level security;
drop policy if exists topics_select_published on public.topics;
create policy topics_select_published
  on public.topics for select to authenticated
  using (exists (
    select 1 from public.exam_pack_versions v
    where v.id = topics.exam_pack_version_id and v.status = 'PUBLISHED'
  ));
revoke all on public.topics from public, anon, authenticated;
grant select on public.topics to authenticated;
grant select, insert, update, delete on public.topics to service_role;
