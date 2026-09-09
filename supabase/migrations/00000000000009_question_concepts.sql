-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 9 · Mapeos pregunta→concepto versionados (N6)
--
-- ADR-009 v1.1 §B · ACCEPTED · mapeos con ámbito de exam_pack_version, un PRIMARY por
--   (pregunta, versión), mismo pack por claves foráneas compuestas, copy-forward con
--   PENDING_REVALIDATION.
-- CDEM §6 · REQ-B06 · ADR-005 punto 7 (solo el estado de revalidación; disposición 1A)
-- Rollback: supabase/migrations/down/00000000000009_question_concepts.down.sql
-- ---------------------------------------------------------------------------

create table if not exists public.question_concepts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  concept_id uuid not null,
  exam_pack_id uuid not null,
  exam_pack_version_id uuid not null,
  relationship_type public.mapping_relationship not null,
  weight numeric(4, 3) not null,
  mapping_status public.mapping_status not null default 'PENDING_REVALIDATION',
  copied_from_mapping_id uuid references public.question_concepts (id),
  validated_at timestamptz,
  promotion_id uuid not null references ingest.promotions (id),
  created_at timestamptz not null default now(),

  constraint question_concepts_unique unique (question_id, concept_id, exam_pack_version_id),
  constraint question_concepts_question_fk
    foreign key (question_id, exam_pack_id) references public.canonical_questions (id, exam_pack_id),
  constraint question_concepts_concept_fk
    foreign key (concept_id, exam_pack_id) references public.concepts (id, exam_pack_id),
  constraint question_concepts_version_fk
    foreign key (exam_pack_version_id, exam_pack_id) references public.exam_pack_versions (id, exam_pack_id),
  constraint question_concepts_weight_range check (weight > 0 and weight <= 1),
  constraint question_concepts_not_self_copy
    check (copied_from_mapping_id is null or copied_from_mapping_id <> id),
  constraint question_concepts_validated_consistency
    check ((mapping_status = 'VALIDATED') = (validated_at is not null))
);

comment on table public.question_concepts is
  'ADR-009 v1.1 §B · mapeo pregunta→concepto con ámbito de versión de pack. Solo VALIDATED '
  'alimenta motores; el copy-forward crea filas PENDING_REVALIDATION con linaje.';

-- Exactamente un PRIMARY por (pregunta, versión).
create unique index if not exists question_concepts_one_primary
  on public.question_concepts (question_id, exam_pack_version_id)
  where relationship_type = 'PRIMARY';

-- Copy-forward (ADR-009 v1.1 §B.4) ----------------------------------------------
-- Copia los mapeos de una versión de pack a otra del mismo pack, en estado
-- PENDING_REVALIDATION y con linaje. Idempotente: los pares ya presentes en la
-- versión destino no se duplican ni se reescriben.

create or replace function ingest.copy_forward_question_concepts(
  p_from_version uuid,
  p_to_version uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  from_pack uuid;
  to_pack uuid;
  copied integer;
  p_promotion_id uuid;
begin
  select v.exam_pack_id into from_pack from public.exam_pack_versions v where v.id = p_from_version;
  select v.exam_pack_id into to_pack from public.exam_pack_versions v where v.id = p_to_version;
  if from_pack is null or to_pack is null then
    raise exception 'copy-forward · versión de pack inexistente' using errcode = 'foreign_key_violation';
  end if;
  if from_pack <> to_pack then
    raise exception 'copy-forward · las dos versiones deben ser del mismo pack' using errcode = 'check_violation';
  end if;
  if p_from_version = p_to_version then
    raise exception 'copy-forward · origen y destino no pueden ser la misma versión' using errcode = 'check_violation';
  end if;
  -- Cada copy-forward es una promoción auditable por sí misma (PI-1A-6).
  insert into ingest.promotions (target_table)
  values ('public.question_concepts')
  returning id into p_promotion_id;

  insert into public.question_concepts (
    question_id, concept_id, exam_pack_id, exam_pack_version_id, relationship_type, weight,
    mapping_status, copied_from_mapping_id, validated_at, promotion_id
  )
  select
    qc.question_id, qc.concept_id, qc.exam_pack_id, p_to_version, qc.relationship_type, qc.weight,
    'PENDING_REVALIDATION', qc.id, null, p_promotion_id
  from public.question_concepts qc
  where qc.exam_pack_version_id = p_from_version
    and qc.mapping_status <> 'REJECTED'
    and not exists (
      select 1 from public.question_concepts existing
      where existing.question_id = qc.question_id
        and existing.concept_id = qc.concept_id
        and existing.exam_pack_version_id = p_to_version
    );

  get diagnostics copied = row_count;
  return copied;
end;
$$;

comment on function ingest.copy_forward_question_concepts(uuid, uuid) is
  'ADR-009 v1.1 §B.4 · copia mapeos entre versiones del mismo pack como PENDING_REVALIDATION '
  'con linaje (copied_from_mapping_id). Solo servidor.';

revoke all on function ingest.copy_forward_question_concepts(uuid, uuid) from public;
grant execute on function ingest.copy_forward_question_concepts(uuid, uuid) to service_role;

-- RLS y grants ----------------------------------------------------------------

alter table public.question_concepts enable row level security;
alter table public.question_concepts force row level security;
drop policy if exists question_concepts_select_validated on public.question_concepts;
create policy question_concepts_select_validated
  on public.question_concepts for select to authenticated
  using (mapping_status = 'VALIDATED' and exists (
    select 1 from public.canonical_questions q
    where q.id = question_concepts.question_id and q.status = 'PUBLISHED'
  ));
revoke all on public.question_concepts from public, anon, authenticated;
grant select on public.question_concepts to authenticated;
grant select, insert, update, delete on public.question_concepts to service_role;
