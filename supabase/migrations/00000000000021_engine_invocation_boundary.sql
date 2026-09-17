-- =============================================================================
-- 00000000000021 · Phase 3.1 · frontera de invocación del Learning Engine (D-26)
-- =============================================================================
--
-- **Defecto D-26.** El runtime de servidor de `phase-3-v1.0` invocaba el motor con
-- `supabase.schema('engine')` y `supabase.schema('ingest')` a través del Data API. Esos
-- esquemas no están expuestos (ADR-011 anexo v1.1), de modo que PostgREST responde `PGRST106`
-- incluso al rol de servicio: la ruta de la aplicación no podía ejecutarse. Las pruebas de
-- Phase 3 demostraban el contrato por SQL directo y nunca ejercitaron el módulo real.
--
-- **Corrección.** Envoltorios en `public`, la superficie gobernada, con el mismo patrón que
-- ya usa la frontera de ingestión (migración 13, ADR-011 punto 8): `search_path` vacío,
-- nombres cualificados, sin EXECUTE para public, anon ni authenticated, y EXECUTE solo para
-- el rol de servicio. Ningún esquema privado pasa a estar expuesto.
--
-- **`SECURITY INVOKER`, no `DEFINER`, y es deliberado.** El rol de servicio ya tiene USAGE
-- sobre `engine` e `ingest`, EXECUTE sobre cada función de destino y SELECT sobre
-- `engine.engine_config`. Un envoltorio que se ejecuta con los privilegios de quien llama no
-- concede nada que no existiera: si algún día un grant equivocado alcanzara a un rol de
-- cliente, ese rol seguiría sin USAGE sobre los esquemas privados y la llamada fallaría
-- igual. Es estrictamente más restrictivo que el precedente `DEFINER` de la migración 13.
--
-- **Los comentarios de función no nombran objetos privados**: PostgREST los publica en el
-- OpenAPI que sirve al rol de servicio, y las guardas de descubrimiento lo vigilan.
--
-- **No cambia ninguna semántica.** Cada envoltorio delega sin transformar nada en una
-- función ya aceptada en Phase 3. Ni tablas, ni columnas, ni enums, ni planner.
-- =============================================================================

create or replace function public.engine_active_config_version()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select c.version from engine.engine_config c where c.status = 'ACTIVE' limit 1;
$$;

comment on function public.engine_active_config_version() is
  'D-26 · Learning Engine · versión de configuración activa. Solo rol de servicio.';

create or replace function public.engine_evidence_snapshot(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select engine.evidence_snapshot(p_user_id);
$$;

comment on function public.engine_evidence_snapshot(uuid) is
  'D-26 · Learning Engine · instantánea de evidencia de un aprendiz. Solo rol de servicio; la identidad la verifica el servidor.';

create or replace function public.engine_attribution_snapshot(p_exam_pack_version_id uuid)
returns table (generation bigint, question_id uuid, concept_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.generation, s.question_id, s.concept_id
  from ingest.attribution_snapshot(p_exam_pack_version_id) s;
$$;

comment on function public.engine_attribution_snapshot(uuid) is
  'D-26 · Learning Engine · semántica de atribución declarada y su generación. Solo rol de servicio.';

create or replace function public.engine_recalculate_mastery(
  p_user_id uuid, p_from_position bigint, p_payload jsonb, p_reason text
)
returns bigint
language sql
volatile
security invoker
set search_path = ''
as $$
  select engine.recalculate_mastery(
    p_user_id, p_from_position, p_payload, p_reason::engine.projection_reason
  );
$$;

comment on function public.engine_recalculate_mastery(uuid, bigint, jsonb, text) is
  'D-26 · Learning Engine · aplicación incremental atómica. Solo rol de servicio.';

create or replace function public.engine_rebuild_projections(
  p_user_id uuid, p_payload jsonb, p_reason text
)
returns bigint
language sql
volatile
security invoker
set search_path = ''
as $$
  select engine.rebuild_projections(p_user_id, p_payload, p_reason::engine.projection_reason);
$$;

comment on function public.engine_rebuild_projections(uuid, jsonb, text) is
  'D-26 · Learning Engine · reconstrucción desde la evidencia (EC-006). Solo rol de servicio.';

create or replace function public.engine_stale_users(p_projection text, p_limit integer default 100)
returns table (user_id uuid, max_position bigint, consumed_position bigint, reason text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.user_id, s.max_position, s.consumed_position, s.reason
  from engine.stale_users(p_projection, p_limit) s;
$$;

comment on function public.engine_stale_users(text, integer) is
  'D-26 · Learning Engine · detección de proyecciones atrasadas o incoherentes. Solo rol de servicio.';

revoke all on function public.engine_active_config_version() from public, anon, authenticated;
revoke all on function public.engine_evidence_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.engine_attribution_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.engine_recalculate_mastery(uuid, bigint, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.engine_rebuild_projections(uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.engine_stale_users(text, integer) from public, anon, authenticated;

grant execute on function public.engine_active_config_version() to service_role;
grant execute on function public.engine_evidence_snapshot(uuid) to service_role;
grant execute on function public.engine_attribution_snapshot(uuid) to service_role;
grant execute on function public.engine_recalculate_mastery(uuid, bigint, jsonb, text) to service_role;
grant execute on function public.engine_rebuild_projections(uuid, jsonb, text) to service_role;
grant execute on function public.engine_stale_users(text, integer) to service_role;
