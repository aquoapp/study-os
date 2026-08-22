# STUDY OS · terminology.md

**Fase:** −1 · Specification Compilation
**Regla de nombrado:** identificadores de base de datos y código en **inglés `snake_case`**; copy de usuario en **español de España** (CDEM §30; CLAUDE.md).
**Regla anti-ambigüedad:** un concepto, un término. Si dos documentos usan nombres distintos, aquí se fija el ganador y el perdedor queda marcado como prohibido en código y esquema.

---

## 1. Vocabulario canónico

| Término (código) | Término UI (es-ES) | Definición operativa | Entidad |
|---|---|---|---|
| **Exam Pack** | Convocatoria / oposición | Contenedor exam-neutral de un examen. TAI es la primera fila, **no** la identidad del producto. | `exam_packs` |
| **Exam Pack Version** | Versión del temario | Estado versionado del sílabo con vigencia. Todo contenido publicado cuelga de una versión. | `exam_pack_versions` |
| **Syllabus Block / Topic / Concept** | Bloque / Tema / Concepto | Jerarquía oficial (TAI: 4 bloques, 33 temas) y unidad mínima de dominio. | `syllabus_blocks`, `topics`, `concepts` |
| **Source** | Fuente | Familia lógica de documento con autoridad. | `sources` |
| **Source Version** | Versión de la fuente | Instancia fechada, con vigencia, checksum y supersesión. **La autoridad la tiene la versión, no la fuente.** | `source_versions` |
| **Provenance class** | Procedencia | `OFFICIAL` (fuente primaria verificable) · `VERIFIED` (validado por proceso) · `GENERATED` (producido por IA) · `PERSONAL` (del usuario). | enum |
| **Learning Unit** | Lección / contenido | Unidad didáctica ligada a un concepto, con procedencia y versión. | `learning_units` |
| **Canonical Question** | Pregunta | Pregunta semántica única. A y B son ocurrencias de la misma pregunta canónica. | `canonical_questions` |
| **Answer Key Version** | Plantilla de respuestas | Clave oficial versionada `PROVISIONAL → FINAL → AMENDED`. | `answer_key_versions` |
| **Attempt** | Intento / respuesta | Evidencia normalizada de una respuesta enviada, con la versión de clave usada. | `question_attempts` |
| **Learning Event** | (no se muestra) | Evidencia conductual inmutable e idempotente. Fuente de verdad del comportamiento. | `learning_events` |
| **Session / Session Item** | Sesión / bloque de sesión | Unidad de estudio planificada y su contenido ordenado. | `study_sessions`, `session_items` |
| **Mastery** | Dominio | Proyección determinista del conocimiento de un concepto. **Responde: ¿lo sabe?** | `concept_mastery` |
| **Stability** | Estabilidad | Consistencia del rendimiento entre sesiones separadas en el tiempo. | campo |
| **Uncertainty** | Incertidumbre | Cuánta confianza tiene el sistema en su propia estimación. Se muestra, no se oculta. | campo |
| **Exam Readiness** | Preparación para el examen | Proyección separada por objetivo. **Responde: ¿rendiría hoy?** Nunca se fusiona con Dominio. | `exam_readiness` |
| **Planner Run / Planner Item** | Plan de hoy | Ejecución auditable del planner y sus ítems seleccionados. | `planner_runs`, `planner_items` |
| **reason_codes** | "Por qué esto hoy" | Códigos deterministas que explican la selección. La IA los traduce; no los inventa. | campo JSON |
| **Rescue Mode** | Tengo menos tiempo hoy | Adaptación a disponibilidad reducida (0/5/10/20/30/personalizado). **No es un fallo.** | `planner_runs.run_type = RESCUE` |
| **Momentum Recovery** | Retomar tras una ausencia | Replanificación desde el estado actual, sin backlog cronológico. | `run_type = RECOVERY` |
| **Today override** | Tiempo de hoy | Disponibilidad puntual. **No modifica** la disponibilidad por defecto. | evento + planner |
| **Default availability** | Tu disponibilidad habitual | Patrón normal. Cambiarlo **sí** replanifica el futuro. | `learner_settings` |
| **Diagnostic** | Diagnóstico inicial | Evaluación breve y opcional que siembra las estimaciones iniciales. | `diagnostic_runs` |
| **Practical** | Supuesto práctico | Escenario común + preguntas encadenadas. Bloque III o IV. Vale el 50% del examen. | `practicals` |
| **Simulation** | Simulacro | Ejercicio en condiciones de examen, con temporización y feedback diferido. | (pendiente, C-04) |
| **Note** | Apunte | Objeto personal, libre o contextual. Transversal, **nunca** sexta sección. | `notes` |
| **Personal Review Material** | Mi repaso | Material derivado de un apunte, aprobado explícitamente. Procedencia PERSONAL. | `personal_review_material` |
| **Intervention** | (no se nombra así en UI) | Estrategia pedagógica aplicada tras un error, con resultado medido. | `intervention_outcomes` |
| **Error pattern** | Confusión detectada | Error recurrente identificado con evidencia suficiente. | `error_patterns` |
| **Confidence** | Seguridad en tu respuesta | Declarada **antes** del feedback. Es evidencia de calibración, no de dominio. | `question_attempts.confidence_value` |
| **Engine version / watermark** | (interno) | Versión del motor y marca de evidencia procesada. Requisito de reconstruibilidad. | campos |

---

## 2. Sinónimos prohibidos en código y esquema

**No mezclar nunca dentro de identificadores, tablas, tipos o eventos:**

| Prohibido | Canónico | Motivo |
|---|---|---|
| `tema` | `topic` | CDEM §30 |
| `pregunta` | `question` | CDEM §30 |
| `usuario` | `user` | CDEM §30 |
| `apunte` | `note` | consistencia |
| `simulacro` | `simulation` | consistencia |
| `práctico` / `supuesto` | `practical` | consistencia |
| `dominio` | `mastery` | evitar colisión con "domain" del código |
| `nivel` / `nivel global` | `mastery` **o** `readiness`, explícito | "nivel" colapsa dos proyecciones distintas → EC-004 |
| `progreso` como métrica | `mastery` / `readiness` / `coverage` | "progreso" es una sección, no un número |
| `score` a secas | `mastery_score_internal`, `priority_score`, `readiness_score_internal` | tres cosas distintas |
| `quiz_attempt`, `user_answer` (Vertical Slice v0.1) | `question_attempts` | nombres superseded |
| `QUESTION_ANSWERED`, `SESSION_PAUSED`, `SESSION_ENDED`, `CONTENT_OPENED` (Closure v0.6) | `ANSWER_SUBMITTED`, `SESSION_INTERRUPTED`, `SESSION_COMPLETED`, `LEARNING_UNIT_VIEWED` | C-11: gana CDEM v1.0 |
| `plan_id` (Closure v0.6) | `planner_run_id` | C-11 |
| `review_schedule` como tabla | `concept_mastery.next_review_at` | CDEM no crea tabla separada |

---

## 3. Términos con carga semántica que la UI **no** debe usar

Derivado de EC-014, EC-017, INV-107 y Edge States §10:

`sesión fallida` · `has fallado` · `atrasado` · `vencido` (como deuda) · `racha` · `perdiste` · `recupera lo perdido` · `deberías haber` · `nivel bajo` · `abandonada` (estado técnico `ABANDONED`, nunca visible).

Alternativas canónicas ya definidas en Edge States: *"Te quedaste aquí"*, *"Hoy no tienes que recuperar nada"*, *"Retomamos desde aquí"*, *"Sigue válido / Conviene recuperar / Lo mejor para hoy"*.

---

## 4. Distinciones que provocan bugs si se difuminan

1. **Mastery vs Readiness** — saber vs rendir. Tablas, cálculo y presentación separados (EC-004).
2. **Evidencia vs proyección** — `learning_events` es inmutable; `concept_mastery` es recalculable. Nunca se corrige una proyección editando evidencia.
3. **Selección vs envío** — `ANSWER_SELECTED` registra que en un instante dado la selección visible era X. **El evento, una vez aceptado, es append-only como cualquier otro**; lo que cambia es la *proyección* «selección actual», que se recalcula como el último `ANSWER_SELECTED` aceptado del ítem. `ANSWER_SUBMITTED` es el único que crea evidencia autoritativa (`question_attempts`). Crítico en PRÁCTICO (C-16).
4. **Default availability vs today override** — el error clásico de planificación (INV-106).
5. **Planificado vs real** — `planned_minutes` vs tiempo efectivo. El planner aprende de lo real (Closure D-002).
6. **Pregunta canónica vs ocurrencia** — A y B no son dos preguntas (CORP-001).
7. **Fuente vs versión de fuente** — la vigencia es de la versión.
8. **GENERATED vs VERIFIED** — la promoción exige workflow y **no existe en MVP**.
9. **Exposición vs dominio** — ver una lección no cambia mastery (`CONCEPT_COMPLETED` ≠ evidencia de dominio).
10. **Confianza vs dominio** — la confianza calibra; no puntúa.
