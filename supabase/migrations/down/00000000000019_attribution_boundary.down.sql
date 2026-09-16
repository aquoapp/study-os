-- ---------------------------------------------------------------------------
-- Rollback de la migración 19 · frontera de mutación de mapeos y generación de atribución.
--
-- Devuelve el catálogo al estado de la 18: el rol de servicio recupera la escritura directa
-- sobre `public.question_concepts` (que es exactamente lo que D-21 describía como deuda) y
-- desaparecen la generación y su rastro.
-- ---------------------------------------------------------------------------

drop trigger if exists question_concepts_attribution_generation on public.question_concepts;
drop function if exists ingest.bump_attribution_generation();
drop function if exists ingest.attribution_snapshot(uuid);
drop function if exists ingest.set_question_concept_mapping_status(uuid, public.mapping_status, text, text);

drop table if exists ingest.mapping_transitions;
drop table if exists ingest.attribution_generations;

grant insert, update, delete on public.question_concepts to service_role;
