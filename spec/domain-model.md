# STUDY OS · domain-model.md

**Fase:** −1 · Specification Compilation
**Versión:** 1.2 · patch correctivo (orden total de eventos y watermark operativo)
**Alcance:** mapa de implementación del modelo canónico. **No rediseña** el `Canonical Data & Event Model v1.0`. Donde el modelo tiene un hueco declarado, se marca como `[GAP]` con referencia a la contradicción, sin resolverlo unilateralmente.

---

## 0. Las cuatro capas de datos (regla que gobierna todo lo demás)

```
1 · CANONICAL CONTENT   lo que dice el examen y la fuente     escritura: servidor/admin
2 · USER EVIDENCE       lo que la persona hizo                 escritura: usuario (insert), append-only
3 · DERIVED PROJECTIONS lo que el motor infiere                escritura: motor/servidor, reconstruible
4 · PERSONAL/GENERATED  apoyo útil, nunca verdad canónica      escritura: usuario / capa IA
```

Nunca se colapsan en una tabla ni en un "score".

---

## 1. Identidad

| Tabla | Claves | Notas de implementación |
|---|---|---|
| `profiles` | PK/FK `user_id` → `auth.users.id` | Perfil de aplicación separado de la identidad de auth. RLS: propio. |
| `learner_settings` | PK `user_id` | `default_daily_minutes`, `weekly_availability_json`, `diagnostic_preference`, `reduced_motion`. **El override de hoy no vive aquí** (INV-106). |
| `devices` | PK `id`, FK `user_id` | `installation_id` estable por instalación; base de `sync_state`. |

## 2. Jerarquía de contenido

```
exam_packs
  └── exam_pack_versions (vigencia, estado, change_summary)
        └── syllabus_blocks (I, II, III, IV)
              └── topics (33 en TAI)
                    └── concepts ──< concept_prerequisites
```

- `concept_prerequisites` con unicidad compuesta y CHECK `concept_id <> prerequisite_concept_id`.
- **`[GAP-1]`** identidad estable del concepto entre versiones de pack → **C-03 / BD-02**. Bloquea la primera migración de contenido.
- `[GAP-2]` `canonical_questions.exam_pack_id` cuelga del pack, no de la versión; la relación con conceptos versionados queda indefinida → C-03.
- Convención de `code`: pendiente de decisión, cuatro esquemas en conflicto → C-08.

## 3. Fuentes y procedencia

```
sources ──< source_versions ──< source_chunks (embedding, provenance, topic/concept)
```

- La autoridad es de la **versión**, no de la fuente. Toda recuperación sensible a autoridad filtra `status` y vigencia **antes** de la similitud (TA §7.3).
- `supersedes_version_id` permite mantener direccionable la versión antigua (DI-07).
- `source_chunks` y pgvector: recomendados como **diferidos** hasta que exista corpus normativo ingerido (C-21, ADR-001).

## 4. Contenido de aprendizaje y modelo de pregunta

```
learning_units (concept_id, source_version_id, provenance_class, content_version, status)

canonical_questions ──< question_options
        │                     ▲
        ├──< question_concepts (primary/secondary, weight)
        └──< answer_key_versions (key_status, correct_option_id, effective_from/to, supersedes)
```

Reglas duras:
- La corrección **no** vive como booleano no versionado en la opción.
- `answer_key_versions.correct_option_id` debe pertenecer a la misma pregunta (constraint, CDEM §23).
- **`answer_key_versions` no se expone al Data API.** La corrección ocurre en servidor (INV-101, C-13).
- **`[GAP-3]`** entidades de convocatoria/modelo/ocurrencia ausentes → C-02 / BD-05.
- **`[GAP-4]`** los textos de opción no existen en el corpus → C-01 / **MI-01** (entrada ausente, no decisión).

## 5. Prácticos

```
practicals (scenario, source_version_id, provenance_class)
    └──< practical_questions ──> canonical_questions
```

- Reutiliza la maquinaria canónica: validado contra 4 prácticos oficiales reales (Mapping F-02).
- `[GAP-5]` elección de track III|IV y preguntas de reserva no modeladas → C-02/C-04.
- Semántica de envío: selección mutable vs envío inmutable → C-16.

## 6. Objetivo del aprendiz

`learner_exam_goals` (user, exam_pack, target_date, starting_level, status). MVP expone un objetivo TAI activo; la arquitectura admite varios.

## 7. Sesiones y evidencia

```
study_sessions (status, planned_minutes, resume_cursor_json, planner_run_id)
    └──< session_items (item_type, item_ref_id, planned_minutes, status)

learning_events  ← APPEND-ONLY, idempotente por event_id
    └── normaliza en → question_attempts ──> answer_key_versions
                              └──< attempt_recalculations
```

- `learning_events`: PK `event_id` (cliente), `schema_version`, `client_created_at`, `client_sequence`, `server_received_at`, `created_offline`.
- Sin políticas RLS de UPDATE/DELETE para el usuario (EC-005).
- **Idempotencia del intento (corregido en v1.1):** el mecanismo principal es `question_attempts.submitted_event_id` **NOT NULL, UNIQUE y FK a `learning_events.event_id`**. Un intento no existe sin el evento que lo originó, y un evento no puede producir dos intentos.
  `attempt_number` es un **contador derivado y de presentación** («tercer intento sobre esta pregunta»), no una clave de deduplicación: en un reintento de red el cliente no sabe qué número le corresponde, y en un replay multidispositivo dos clientes podrían calcular el mismo número para eventos distintos. Usarlo como clave de idempotencia produce falsos positivos (bloquear un reintento legítimo) y falsos negativos (aceptar un duplicado con numeración distinta).
  `(user_id, question_id, attempt_number)` puede mantenerse como índice UNIQUE **derivado**, asignado por el servidor dentro de la misma transacción que inserta el intento, nunca por el cliente.

**Concurrencia y replay multidispositivo:**
1. La ingestión de eventos usa `INSERT ... ON CONFLICT (event_id) DO NOTHING`; el segundo intento de inserción devuelve éxito idempotente, no error.
2. La normalización a `question_attempts` ocurre en la **misma transacción** que acepta el evento, con `ON CONFLICT (submitted_event_id) DO NOTHING`. Si dos dispositivos reenvían el mismo evento simultáneamente, uno gana la fila y el otro no crea nada.
3. `attempt_number` se calcula bajo bloqueo por fila del par (user, question) o mediante secuencia por par, evitando la carrera clásica de dos `SELECT MAX()+1` concurrentes.
4. Eventos distintos del mismo dispositivo sobre la misma pregunta (reintento legítimo del usuario) tienen `event_id` distintos y **sí** crean intentos distintos: es evidencia real, no duplicación.
5. **Orden total y watermark (corregido en v1.2 · ver C-26 y SD-015).** `server_received_at` es un **timestamp de auditoría**, no una clave de orden: no resuelve empates, no es monótono ante ajustes de reloj y confunde orden de llegada con orden del hecho.

**Contrato de orden:**

| Elemento | Papel | Qué NO es |
|---|---|---|
| `event_id` (UUID de cliente) | Clave de **idempotencia** | No ordena |
| `client_sequence` | Orden **local por dispositivo**; desempata dentro del mismo dispositivo | No es comparable entre dispositivos |
| `client_created_at` | Momento en que ocurrió el hecho; lo usa la lógica temporal del motor (espaciado, retención) | No ordena la ingesta; el cliente puede tener el reloj mal |
| `server_received_at` | Timestamp de **auditoría** | No es clave de orden |
| **`server_sequence` BIGINT** | **Clave de orden total**, asignada por una secuencia de base de datos al aceptar el evento | No es un timestamp |

**Reglas:**
- Todo replay y todo rebuild recorren la evidencia **ordenada por `server_sequence` ascendente**. Dos rebuilds sobre el mismo conjunto aceptado producen, por construcción, el mismo orden y el mismo resultado (EC-006 verificable).
- **`event_watermark` = valor de `server_sequence`** hasta el cual la proyección ha consumido evidencia. Deja de ser un campo sin semántica.
- **Avance sin huecos.** Una secuencia de PostgreSQL puede confirmarse fuera de orden: la transacción que obtuvo el número 100 puede hacer commit después que la del 101. Por tanto el watermark **solo avanza hasta el mayor `server_sequence` contiguo y confirmado**; los valores por encima de un hueco pendiente no se consumen hasta que el hueco se resuelve o se declara abandonado por timeout. Sin esta regla, un evento confirmado tarde quedaría por debajo del watermark y nunca se procesaría — pérdida silenciosa de evidencia.
- **Evento offline antiguo recibido tarde:** obtiene un `server_sequence` alto (llega tarde) pero conserva su `client_created_at` real. No borra ni reordena nada: se **añade**, y las proyecciones afectadas se recalculan desde el watermark del concepto implicado usando `client_created_at` para la semántica temporal. El orden de ingesta permanece determinista; la cronología del hecho permanece fiel.
- **Dispositivo obsoleto:** sus eventos se fusionan como cualquier otro. Nunca eliminan evidencia más nueva aceptada.
- `[GAP-6]` `item_ref_id` polimórfico sin FK posible → C-15 / ADR-002.
- `[GAP-7]` sin `diagnostic_run_id` en el intento → C-14.
- `[GAP-8]` blanco (`selected_option_id NULL`) no declarado como semántica válida → C-04.

**Semantica de `ANSWER_SELECTED` (aclarado en v1.1):**
- Cada `ANSWER_SELECTED` aceptado es **append-only e inmutable**, igual que cualquier otro evento. Cambiar de opción **no edita ni borra** el evento anterior: emite uno nuevo.
- Lo que cambia es la **proyección de UI «selección actual»**, definida como el último `ANSWER_SELECTED` aceptado para ese `session_item`. Es una proyección reconstruible, no un campo mutable.
- `ANSWER_SELECTED` **no crea evidencia autoritativa**: no produce `question_attempts` ni alimenta el Learning Engine.
- **`ANSWER_SUBMITTED` es el único evento que crea evidencia autoritativa**, y lo hace exactamente una vez por `event_id`.
- En PRÁCTICO y simulacro pueden existir muchos `ANSWER_SELECTED` y un solo `ANSWER_SUBMITTED` por ítem al cerrar el caso o el ejercicio. La confianza se captura antes del envío (INV-102).
- Coste asumido: el volumen de `ANSWER_SELECTED` es mayor que el de intentos. Se acota emitiendo el evento con *debounce* al estabilizarse la selección, no en cada pulsación.

**Taxonomía de eventos P0** (CDEM §11): sesión · unidad de aprendizaje · ayuda/intervención · presentación y envío de pregunta · confianza · práctico/simulacro · disponibilidad/rescue/replan/recovery · notas · sync/fuente.
Faltantes identificados: `REVIEW_COMPLETED`, pausa por inactividad, corrección de diagnóstico por el usuario → C-11, SPEC_DIFF SD-004.

## 8. Proyecciones del Learning Engine

| Tabla | Unicidad | Campos de control |
|---|---|---|
| `concept_mastery` | (user, concept) | `mastery_state`, `mastery_score_internal`, `stability_score`, `uncertainty`, `evidence_count`, `next_review_at`, `engine_version`, `event_watermark`, `calculated_at` |
| `mastery_history` | — | snapshots auditables con `reason_json` |
| `error_patterns` | — | `pattern_type`, `status`, `evidence_count`, `confidence`, ventanas temporales |
| `intervention_outcomes` | — | `intervention_type`, `trigger_event_id`, `effectiveness_score` |

- Dimensiones y pesos: `Learning System v0.4` (accuracy .30 / retention .20 / transfer .20 / stability .10 / calibration .10 / speed .10), **como configuración versionada**, no constantes (C-10, OBS-01).
- Estados internos: `NEW · EXPOSED · LEARNING · CONSOLIDATING · MASTERED · STRONG`. El estado visible es función derivada → C-09 / BD-04.

## 9. Exam Readiness

`exam_readiness` — una fila por objetivo activo: `coverage`, `retention`, `exam_transfer`, `practical_readiness`, `simulation_evidence`, `uncertainty`, `engine_version`, `event_watermark`.
Regla de oro: **nunca derivada como media de mastery**. Debe poder bajar con mastery alto (AT-32).

## 10. Planner

```
planner_runs (planner_version, input_watermark, available_minutes, run_type, reason_codes_json)
    └──< planner_items (item_type, item_ref_id, priority_score, planned_minutes, scheduled_date, reason_codes_json, status)
```

- `run_type`: `DAILY | REPLAN | RESCUE | RECOVERY`.
- Inputs (LS v0.4 Planner Contract): `available_minutes`, `exam_date`, `concept_mastery`, `review_due`, `syllabus_coverage`, `error_backlog`, `practice_readiness`, `recent_load`, `user_override`.
- Invariantes de planner P01–P08, elevados a INV-108/INV-109/INV-106.
- Los runs antiguos permanecen: el plan es proyección con historial (DI-05).

## 11. Notas y material personal

```
notes (note_type FREE|CONTEXTUAL, remember_flag, sync_version, deleted_at)
  └── note_context (exam_pack, topic, concept, question, practical, learning_unit, source_version, snapshot)
personal_review_material (source_note_id, approval_status, provenance_class = PERSONAL)
```

- Las notas son **documentos mutables**: requieren versión/conflicto (`sync_version`), a diferencia de la evidencia.
- Borrar una nota no borra contenido canónico ni su contexto histórico (CDEM §29.12).

## 12. Capa de IA y auditoría

```
ai_interactions (interaction_type, context_refs, provider, model, prompt_template_version,
                 tokens in/out, latency_ms, status, provenance_refs)
generated_artifacts (interaction_id, artifact_type, content, status)
content_change_events ──< user_recalculation_jobs
```

- Sin grants de escritura de la capa IA sobre proyecciones ni contenido canónico (EC-002/003).
- Minimizar texto libre personal en telemetría (Master §44).

## 13. Sync

`sync_state` (user, device, `last_server_event_id`, `last_client_sequence`, `pending_event_count`, `conflict_state`), unicidad user+device.
Principio: **los eventos se fusionan; el historial no es last-write-wins.** Las notas, por ser mutables, sí requieren resolución de conflicto explícita.

---

## 14. Contrato de procesamiento de evento

```
acción de usuario
  → evento local (event_id, client_sequence)
  → proyección local segura (optimista, no autoritativa)
  → ingestión idempotente en servidor
  → validación de esquema y propiedad
  → persistencia inmutable
  → normalización de intento/sesión
  → proyección del Learning Engine afectada
  → marcar planner como sucio si procede
  → replan ahora o en el límite definido
  → devolver proyección autoritativa
```

**No todo evento dispara un planner run.**

---

## 15. Índices mínimos (CDEM §27)

`learning_events(user_id, server_received_at)` · `learning_events(session_id, server_received_at)` · `question_attempts(user_id, question_id, submitted_at)` · `concept_mastery(user_id, next_review_at)` · `planner_items(planner_run_id, sort_order)` · `notes(user_id, updated_at)` · `source_chunks(source_version_id)` · FKs de navegación de jerarquía.
Validar contra planes de ejecución reales antes de darlos por buenos.

---

## 16. Orden de migración (CDEM §28, con los huecos señalados)

1. extensiones/enums → 2. identidad → 3. jerarquía de contenido `[GAP-1]` → 4. fuentes/versionado → 5. preguntas/claves/prácticos `[GAP-3, GAP-4]` → 6. objetivos → 7. sesiones/ítems → 8. eventos → 9. intentos/diagnóstico `[GAP-7, GAP-8]` → 10. proyecciones → 11. planner → 12. notas → 13. metadatos IA → 14. auditoría de cambio → 15. sync → 16. índices → 17. **políticas RLS** → 18. seed TAI → 19. tests de política e invariantes.

**Nota de secuencia:** las políticas RLS aparecen en el paso 17, pero `EC-009` exige test de aislamiento **en la misma migración que expone la tabla**. Recomendación: política + test acompañan a cada tabla, no al final.
