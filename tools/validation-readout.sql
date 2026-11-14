-- ---------------------------------------------------------------------------
-- STUDY OS · Readout de validación de producto · Phase 4B
--
-- **Solo lectura.** Ninguna consulta de este fichero escribe, borra ni bloquea nada. Está pensado
-- para responder, sobre un Preview que alguien ha usado de verdad, las diez preguntas de la
-- autorización §22.
--
-- **No es un panel de analítica para el aprendiz** y no debe convertirse en uno: es una
-- herramienta de desarrollo, y lo que muestra —estados del motor, razones de composición,
-- identificadores de ejecución— es exactamente el nivel L3 que el contrato de producto prohíbe
-- que llegue a una superficie de aprendiz (§G).
--
-- **Ningún evento nuevo.** La autorización pide preferir los eventos canónicos duraderos que ya
-- responden la pregunta antes que inventar telemetría, y eso es lo que hace: todo sale de
-- `learning_events`, `question_attempts`, `study_sessions`, `session_items` y las tablas del
-- Planner. La única excepción documentada está al final.
--
-- **Sin vigilancia de comportamiento.** No hay grabación de sesión, ni rastreo de terceros, ni
-- huella digital, ni captura de texto libre. `response_ms` aparece como dato de producto y
-- **nunca** como autoridad pedagógica: no entra en ningún estado, en ninguna decisión ni en
-- ninguna proyección.
--
-- Uso:
--   node --env-file=.env.staging.local tools/validation-readout.mjs
--   node --env-file=.env.staging.local tools/validation-readout.mjs --email persona@ejemplo
-- ---------------------------------------------------------------------------

-- 1 · ¿Qué estados encontró el aprendiz? ------------------------------------------------------
--
-- Los tres estados vacíos y el plan salen del **resultado persistido** de cada ejecución. Un plan
-- reutilizado no escribe fila, de modo que este recuento son decisiones tomadas, no visitas.
--
-- :name estados
select
  r.plan_day,
  r.outcome,
  r.budget_minutes,
  r.budget_source,
  r.duration_provenance,
  count(*) as ejecuciones
from public.planner_runs r
where r.user_id = $1
group by 1, 2, 3, 4, 5
order by 1 desc, 2;

-- 2 · ¿Qué eligió el Planner, y por qué? ------------------------------------------------------
--
-- La composición por acción, con su razón. **L3**: nunca se muestra a un aprendiz.
--
-- :name decisiones
select
  r.plan_day,
  i.action_ordinal,
  i.action_kind,
  i.composition_reason,
  i.position,
  i.step,
  i.item_type,
  i.planned_minutes
from public.planner_items i
join public.planner_runs r on r.id = i.run_id
where i.user_id = $1
order by r.plan_day desc, r.created_at desc, i.position;

-- 3 · ¿Cuál era el presupuesto disponible, y de dónde salía? ----------------------------------
--
-- `budget_source` distingue las tres procedencias, que es justo lo que P4B-D3 exigía poder
-- distinguir: override del día, entrada del día de la semana, o valor por defecto.
--
-- :name presupuesto
select
  r.plan_day,
  r.budget_minutes,
  r.budget_source,
  r.planned_minutes,
  r.item_count,
  r.created_at
from public.planner_runs r
where r.user_id = $1
order by r.created_at desc;

-- 4 · ¿Qué acciones se arrancaron y se completaron de verdad? ---------------------------------
--
-- Un plan es una decisión, **no evidencia de ejecución** (IR-P4A-01). Esta consulta separa lo
-- planificado de lo hecho, que es la distinción que todo el modelo protege.
--
-- :name ejecucion
select
  s.id as session_id,
  s.session_type,
  s.status,
  s.started_at,
  s.completed_at,
  count(*) filter (where si.status = 'COMPLETED') as pasos_completados,
  count(*) as pasos_totales
from public.study_sessions s
left join public.session_items si on si.session_id = s.id
where s.user_id = $1
group by 1, 2, 3, 4, 5
order by s.created_at desc;

-- 5 · ¿Dónde se detuvo la sesión? --------------------------------------------------------------
--
-- El último evento de cada sesión dice dónde quedó. `SESSION_INTERRUPTED` es «lo dejó por ahora»
-- y la sesión sigue abierta; `SESSION_COMPLETED` es terminal y **consume la ejecución** (P4B-D2).
--
-- :name parada
select distinct on (e.session_id)
  e.session_id,
  e.event_type,
  e.stream_position,
  e.server_received_at
from public.learning_events e
where e.user_id = $1 and e.session_id is not null
order by e.session_id, e.stream_position desc;

-- 6 · ¿Qué evidencia se produjo? --------------------------------------------------------------
--
-- Los intentos son inmutables y llevan la versión de clave con la que se corrigieron. La clave
-- **nunca** se selecciona aquí: no hace falta para nada de esto.
--
-- :name evidencia
select
  a.session_id,
  a.question_id,
  a.attempt_number,
  a.answer_kind,
  a.is_correct_at_submission,
  a.confidence_value,
  -- Dato de producto, **nunca** autoridad pedagógica: no entra en ningún estado ni decisión.
  a.response_ms,
  a.answer_key_version_id is not null as tenia_clave,
  e.server_received_at
from public.question_attempts a
join public.learning_events e on e.event_id = a.submitted_event_id
where a.user_id = $1
order by e.server_received_at;

-- 7 · ¿Cómo cambió el estado del Learning Engine? ----------------------------------------------
--
-- El historial del motor, que es append-only. Cada fila lleva el vector antes y después. **L3**.
-- El esquema `engine` no está expuesto al Data API: esta consulta se ejecuta por SQL directo.
--
-- :name motor
select
  h.reason,
  h.from_position,
  h.to_position,
  h.engine_version,
  h.attribution_generation,
  h.created_at
from engine.mastery_history h
where h.user_id = $1
order by h.created_at desc
limit 50;

-- 7b · El estado categórico vigente por concepto. Cinco estados, **ninguna puntuación numérica**.
--
-- :name estado_motor
select
  c.title as concepto,
  m.mastery_state,
  m.uncertainty,
  m.last_negative_position,
  m.event_watermark
from engine.concept_mastery m
join public.concepts c on c.id = m.concept_id
where m.user_id = $1
order by c.title;

-- 8 · ¿Qué eligió la ejecución siguiente? ------------------------------------------------------
--
-- El linaje. `supersedes_run_id` hace explícita la cadena, y una **sucesora** aparece cuando la
-- anterior quedó consumida, aunque la entrada canónica no haya cambiado (P4B-D2, OBS-4B-01).
--
-- :name linaje
select
  r.created_at,
  r.plan_day,
  r.outcome,
  r.item_count,
  r.supersedes_run_id is not null as es_sucesora,
  exists (
    select 1 from public.study_sessions s
    where s.planner_run_id = r.id and s.status in ('COMPLETED', 'ABANDONED')
  ) as consumida,
  r.input_hash = lag(r.input_hash) over (order by r.created_at) as misma_entrada_que_la_anterior
from public.planner_runs r
where r.user_id = $1
order by r.created_at;

-- 9 · ¿Cambió la disponibilidad el plan? -------------------------------------------------------
--
-- R-8 y P4B-D3 · las dos declaraciones de tiempo son eventos duraderos, de modo que la pregunta
-- se responde cruzándolos con las ejecuciones por tiempo. **Sin evento nuevo.**
--
-- :name declaraciones
select
  e.event_type,
  e.payload,
  e.server_received_at,
  (
    select r.outcome from public.planner_runs r
    where r.user_id = e.user_id and r.created_at > e.server_received_at
    order by r.created_at limit 1
  ) as resultado_de_la_ejecucion_siguiente
from public.learning_events e
where e.user_id = $1
  and e.event_type in ('TODAY_OVERRIDE_SET', 'AVAILABILITY_CHANGED')
order by e.server_received_at;

-- 10 · ¿Parece roto algún invariante? ----------------------------------------------------------
--
-- Comprobaciones baratas que deberían devolver **cero filas**. No sustituyen a las suites: son un
-- semáforo sobre datos reales de uso, que es donde aparecen las combinaciones que nadie escribió.
--
-- :name invariantes
select 'INV-117 · una versión presentada distinta de la planificada' as invariante, count(*) as filas
from public.session_items si
join public.study_sessions s on s.id = si.session_id
join public.planner_items pi on pi.run_id = s.planner_run_id and pi.position = si.sort_order
where si.user_id = $1
  and s.planner_run_id is not null
  and (
    si.presented_learning_unit_version_id is distinct from pi.learning_unit_version_id
    or si.presented_representation_id is distinct from pi.question_representation_id
  )
union all
select 'EC-019 · más de una sesión abierta a la vez', count(*)
from public.study_sessions s
where s.user_id = $1 and s.status in ('PLANNED', 'ACTIVE', 'INTERRUPTED')
having count(*) > 1
union all
select 'P4B-D2 · dos sesiones sobre la misma ejecución', count(*)
from (
  select s.planner_run_id
  from public.study_sessions s
  where s.user_id = $1 and s.planner_run_id is not null
  group by 1 having count(*) > 1
) x
union all
select 'ADR-012 · una acción planificada fuera del presupuesto', count(*)
from public.planner_runs r
where r.user_id = $1 and r.planned_minutes > r.budget_minutes
union all
select 'P4-D2 · un minuto planificado sin procedencia autorizada', count(*)
from public.planner_runs r
where r.user_id = $1 and r.duration_provenance not in ('FIXTURE', 'HYBRID_V1')
union all
select 'INV-118 · una declaración de tiempo sin fila canónica', count(*)
from public.learning_events e
where e.user_id = $1
  and e.event_type = 'TODAY_OVERRIDE_SET'
  and not exists (
    select 1 from public.learner_day_overrides o
    where o.user_id = e.user_id and o.plan_day = (e.payload ->> 'plan_day')::date
  );

-- ---------------------------------------------------------------------------
-- Lo que este readout **no** puede responder, y por qué · OBS-4B-04
--
-- **`CANNOT_PLAN` no deja rastro consultable.** Los otros tres estados vacíos —`ZERO_TIME`,
-- `NOTHING_FITS` y `NOTHING_ELIGIBLE`— son **resultados de una ejecución** y quedan persistidos
-- en `planner_runs.outcome`. `CANNOT_PLAN` es lo contrario: significa que **no se escribió
-- ninguna ejecución**, porque el motor estaba atrasado, hubo contención o faltaba configuración.
-- Por construcción no hay fila que contar.
--
-- Registrarlo exigiría un tipo de evento nuevo en la taxonomía del CDEM, y eso es una ampliación
-- de la frontera de eventos que **no** está autorizada en esta fase. Queda registrado como
-- **OBS-4B-04** en vez de resolverse inventando un tipo: si el recorrido humano encuentra
-- `CANNOT_PLAN` con frecuencia, esa observación es la que abre la decisión.
--
-- Mientras tanto se detecta indirectamente: una sesión de uso sin ninguna fila de `planner_runs`
-- en un día en que la persona sí abrió HOY es el patrón, y el informe lo señala.
-- ---------------------------------------------------------------------------
