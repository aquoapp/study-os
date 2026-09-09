-- ---------------------------------------------------------------------------
-- STUDY OS · Migración 19 · Frontera de mutación de mapeos y generación de atribución
--
-- Phase 3 Build Authorization (2026-09-10) §5 y §6 · SD-025 ·
--   `docs/LEARNING_ENGINE_CONTRACT.md` §13.
--
-- Cierra **D-21** y hace exigible el gate duro de EC-006:
--
--   - `public.question_concepts` deja de ser mutable en sitio por el rol de servicio: la
--     transición de estado de un mapeo pasa por una función de frontera auditada;
--   - toda mutación **semántica** de un mapeo avanza la generación de atribución de su
--     versión de pack;
--   - la generación viaja con la proyección, de modo que un rebuild reproduce exactamente
--     la atribución con la que se calculó y una mutación nunca se confunde con una
--     continuación incremental ordinaria.
--
-- Lo que NO hace: no cambia el significado del ciclo de vida de contenido de Phase 1A. Las
-- transiciones admitidas son las que ya permitía el esquema; lo que cambia es **quién** las
-- ejecuta y qué rastro dejan. `publish_staged_item` y `copy_forward_question_concepts`
-- siguen funcionando sin tocarse: son SECURITY DEFINER y se ejecutan con los privilegios de
-- su propietario, no con los del rol de servicio.
--
-- Rollback: supabase/migrations/down/00000000000019_attribution_boundary.down.sql
-- ---------------------------------------------------------------------------

-- Generación de atribución por versión de pack ---------------------------------------
create table if not exists ingest.attribution_generations (
  exam_pack_version_id uuid primary key references public.exam_pack_versions (id) on delete cascade,
  generation bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint attribution_generations_positive check (generation >= 1)
);
comment on table ingest.attribution_generations is
  'SD-025 · contador monótono por versión de pack. Avanza ante toda mutación semántica de '
  'question_concepts. La proyección persiste la generación con la que se calculó: sin ella, '
  'dos rebuilds legítimos podrían diferir y el gate de EC-006 sería inestable.';
alter table ingest.attribution_generations enable row level security;
alter table ingest.attribution_generations force row level security;
revoke all on ingest.attribution_generations from public, anon, authenticated;
grant select on ingest.attribution_generations to service_role;

-- Auditoría de transiciones de mapeo --------------------------------------------------
create table if not exists ingest.mapping_transitions (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references public.question_concepts (id) on delete cascade,
  exam_pack_version_id uuid not null references public.exam_pack_versions (id) on delete cascade,
  from_status public.mapping_status not null,
  to_status public.mapping_status not null,
  actor text not null,
  reason text not null,
  generation_after bigint not null,
  occurred_at timestamptz not null default now(),
  constraint mapping_transitions_actor_format check (actor ~ '^[A-Za-z0-9_.:-]{2,80}$'),
  constraint mapping_transitions_reason_length check (char_length(reason) between 3 and 500),
  constraint mapping_transitions_changes_status check (from_status <> to_status)
);
comment on table ingest.mapping_transitions is
  'D-21 · rastro auditable de cada transición de estado de un mapeo: quién, desde dónde, '
  'hacia dónde, por qué y con qué generación resultante. Sin esta tabla la frontera sería '
  'una convención.';
create index if not exists mapping_transitions_mapping on ingest.mapping_transitions (mapping_id, occurred_at);
alter table ingest.mapping_transitions enable row level security;
alter table ingest.mapping_transitions force row level security;
revoke all on ingest.mapping_transitions from public, anon, authenticated;
grant select on ingest.mapping_transitions to service_role;

-- Avance de generación ante mutación semántica ---------------------------------------
create or replace function ingest.bump_attribution_generation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected uuid;
  semantic boolean;
begin
  if tg_op = 'DELETE' then
    affected := old.exam_pack_version_id;
    semantic := true;
  elsif tg_op = 'INSERT' then
    affected := new.exam_pack_version_id;
    semantic := true;
  else
    affected := new.exam_pack_version_id;
    -- Solo lo que cambia el significado de la atribución avanza la generación. Tocar
    -- `created_at` o el linaje no reinterpreta ninguna evidencia.
    semantic := new.concept_id is distinct from old.concept_id
      or new.relationship_type is distinct from old.relationship_type
      or new.weight is distinct from old.weight
      or new.mapping_status is distinct from old.mapping_status
      or new.exam_pack_version_id is distinct from old.exam_pack_version_id;
    if new.exam_pack_version_id is distinct from old.exam_pack_version_id then
      insert into ingest.attribution_generations (exam_pack_version_id, generation)
      values (old.exam_pack_version_id, 2)
      on conflict (exam_pack_version_id)
        do update set generation = ingest.attribution_generations.generation + 1, updated_at = now();
    end if;
  end if;

  if semantic then
    insert into ingest.attribution_generations (exam_pack_version_id, generation)
    values (affected, 2)
    on conflict (exam_pack_version_id)
      do update set generation = ingest.attribution_generations.generation + 1, updated_at = now();
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function ingest.bump_attribution_generation() from public, anon, authenticated, service_role;
comment on function ingest.bump_attribution_generation() is
  'SD-025 · avanza la generación de atribución de la versión afectada. La generación 1 es la '
  '**línea base**: la semántica de atribución que existía cuando aterrizó esta frontera. Toda '
  'mutación semántica posterior lleva a 2 y siguientes, de modo que una proyección calculada '
  'antes del cambio nunca se confunde con una calculada después.';

-- Línea base explícita: toda versión de pack con mapeos entra en la generación 1. Sin este
-- asiento, la línea base sería un `coalesce` implícito, y una semántica implícita es
-- exactamente lo que el gate de EC-006 no puede permitirse.
insert into ingest.attribution_generations (exam_pack_version_id, generation)
select distinct qc.exam_pack_version_id, 1
from public.question_concepts qc
where not exists (
  select 1 from ingest.attribution_generations g
  where g.exam_pack_version_id = qc.exam_pack_version_id
);

drop trigger if exists question_concepts_attribution_generation on public.question_concepts;
create trigger question_concepts_attribution_generation
  after insert or update or delete on public.question_concepts
  for each row execute function ingest.bump_attribution_generation();

-- D-21 · frontera de mutación auditada -------------------------------------------------
--
-- El rol de servicio conserva la lectura y pierde la escritura directa. La publicación y el
-- copy-forward no se ven afectados: son SECURITY DEFINER y corren como su propietario.
revoke insert, update, delete, truncate on public.question_concepts from service_role;

create or replace function ingest.set_question_concept_mapping_status(
  p_mapping_id uuid,
  p_to_status public.mapping_status,
  p_actor text,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.mapping_status;
  version_id uuid;
  next_generation bigint;
begin
  if p_actor is null or p_reason is null then
    raise exception 'D-21 · una transición de mapeo exige actor y motivo'
      using errcode = 'null_value_not_allowed';
  end if;

  select qc.mapping_status, qc.exam_pack_version_id
    into current_status, version_id
  from public.question_concepts qc
  where qc.id = p_mapping_id
  for update;

  if not found then
    raise exception 'D-21 · el mapeo no existe' using errcode = 'no_data_found';
  end if;

  if current_status = p_to_status then
    raise exception 'D-21 · transición vacía: el mapeo ya está en %', p_to_status
      using errcode = 'check_violation';
  end if;

  -- Las transiciones admitidas son las que el ciclo de vida de Phase 1A ya permitía. Esta
  -- función las gobierna; no las redefine.
  if not (
    (current_status = 'PENDING_REVALIDATION' and p_to_status in ('VALIDATED', 'REJECTED'))
    or (current_status = 'VALIDATED' and p_to_status = 'REJECTED')
  ) then
    raise exception 'D-21 · transición no admitida: % → %', current_status, p_to_status
      using errcode = 'check_violation';
  end if;

  update public.question_concepts
     set mapping_status = p_to_status,
         validated_at = case when p_to_status = 'VALIDATED' then now() else null end
   where id = p_mapping_id;

  select g.generation into next_generation
  from ingest.attribution_generations g
  where g.exam_pack_version_id = version_id;

  insert into ingest.mapping_transitions (
    mapping_id, exam_pack_version_id, from_status, to_status, actor, reason, generation_after
  )
  values (
    p_mapping_id, version_id, current_status, p_to_status, p_actor, p_reason,
    coalesce(next_generation, 1)
  );

  return coalesce(next_generation, 1);
end;
$$;
comment on function ingest.set_question_concept_mapping_status(uuid, public.mapping_status, text, text) is
  'D-21 · única vía ordinaria de transición de estado de un mapeo. Valida la transición, '
  'atribuye actor y motivo, deja rastro y devuelve la generación resultante. Solo servidor.';
revoke all on function ingest.set_question_concept_mapping_status(uuid, public.mapping_status, text, text)
  from public, anon, authenticated;
grant execute on function ingest.set_question_concept_mapping_status(uuid, public.mapping_status, text, text)
  to service_role;

-- Lectura de la semántica de atribución declarada --------------------------------------
create or replace function ingest.attribution_snapshot(p_exam_pack_version_id uuid)
returns table (generation bigint, question_id uuid, concept_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select
    coalesce((select g.generation from ingest.attribution_generations g
              where g.exam_pack_version_id = p_exam_pack_version_id), 1) as generation,
    qc.question_id,
    qc.concept_id
  from public.question_concepts qc
  where qc.exam_pack_version_id = p_exam_pack_version_id
    and qc.relationship_type = 'PRIMARY'
    and qc.mapping_status = 'VALIDATED'
  order by qc.question_id;
$$;
comment on function ingest.attribution_snapshot(uuid) is
  'SD-025 · H-P3-3 · la semántica de atribución declarada: un solo concepto por pregunta, el '
  'PRIMARY VALIDATED de esa versión. Devuelve también la generación, que es parte de la '
  'entrada de la computación y no «lo que haya ahora».';
revoke all on function ingest.attribution_snapshot(uuid) from public, anon, authenticated;
grant execute on function ingest.attribution_snapshot(uuid) to service_role;
