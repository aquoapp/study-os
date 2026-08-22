# STUDY OS · contradiction-register.md

**Fase:** −1 · Specification Compilation
**Versión:** 1.1 · revisión correctiva
**Estado:** PROPUESTO · **25 contradicciones registradas (C-01…C-25)**, 5 `BLOCKED_DECISION` que requieren criterio humano y 1 `MISSING_INPUT` que no es una decisión sino una entrada que falta.
**Regla aplicada:** ninguna contradicción se ha parafraseado hasta hacerla compatible. Cuando la jerarquía de autoridad resuelve de forma inequívoca, se indica la resolución y el documento perdedor. Cuando no, se bloquea el slice afectado.

---

## BLOCKED_DECISIONS (resumen ejecutivo)

**Corrección de la v1.0:** BD-01 estaba mal clasificada. La ausencia de los PDF oficiales **no es una decisión de producto**: el banco oficial es P0 en el Master §47 y sustituirlo exigiría un cambio versionado del Master, no una elección implícita del builder. Se reclasifica como `MISSING_INPUT` **MI-01**.

| ID | Tipo | Asunto | Bloquea |
|---|---|---|---|
| **MI-01** | MISSING_INPUT | 6 PDF oficiales (cuestionarios y plantillas) | **PASS de Phase 1**. No bloquea Phase 0 |
| **BD-02** | BLOCKED_DECISION | Identidad estable de concepto entre versiones de exam pack | Phase 1 esquema, Phase 3, Phase 10 |
| **BD-03** | BLOCKED_DECISION | Escala de confianza: 4 o 5 niveles | Phase 5 (CHECK), Phase 3 (calibración) |
| **BD-04** | BLOCKED_DECISION | ¿"Preparado para examen" existe como estado de concepto? | Phase 3, Phase 7 |
| **BD-05** | BLOCKED_DECISION | Entidades de convocatoria/modelo/ocurrencia en el modelo canónico | Phase 1 esquema |
| **BD-06** | BLOCKED_DECISION | Puntuación oficial versionada y respuesta en blanco | Phase 6 |

---

> **Recuento verificado programaticamente (v1.2):** **26 contradicciones (C-01 a C-26)**. La v1.2 añade C-26, detectada durante la revisión del contrato de eventos. Historial: la v1.0 declaraba 24 en su resumen y 25 en el registro (el registro era correcto); la v1.1 confirmó 25. El resumen narrativo de la v1.0 decía 24; el registro decía 25. El registro era el correcto.

## C-01 · El corpus oficial no contiene los textos de las opciones · **BLOQUEANTE (MISSING_INPUT)**

**Fuentes en conflicto**
- `TAI_STUDY_OS_Official_Exam_Corpus_v1.0` · 00_Overview: "270 registros de pregunta canónica", "6 PDFs oficiales suministrados"; 06_Integrity_Checks C-01…C-07 en PASS.
- `Master Product Specification §17` y `Canonical Data & Event Model §6`: la pregunta requiere `question_options` con `body` para poder ser respondida.
- `Technical_Vertical_Slice_IV7_v0.1` · Official Ingestion: los cuatro assets oficiales figuran como `LOCATED_403_IN_TOOL` / `PENDING`.

**Proposiciones exactamente contradictorias**
1. "El corpus oficial v1.0 está ingerido y validado (integridad PASS)."
2. Verificación directa: las hojas `01_Canonical_Questions`, `02_Exam_Occurrences`, `03_Answer_Key_Versions` y `03_Practical_Questions` contienen enunciado, bloque, letra correcta y procedencia, **pero ninguna columna con el texto de las opciones A/B/C/D**.

**Impacto**
Sin textos de opción no existe CHECK, ENTRENAR, PRÁCTICO ni simulacro con procedencia OFFICIAL. Es decir: el banco oficial —una de las dos ventajas defendibles del producto— no es utilizable. Phase 1 podría "pasar" técnicamente con datos de fixture y descubrirse en Phase 5.

**Resolución por autoridad:** no procede. Es un hueco de contenido, no un conflicto normativo.

**Clasificación: `MISSING_INPUT` MI-01, no decisión de producto.**
El banco oficial de preguntas es P0 explícito (`Master §47`, IN·P0 "official question bank"). Sustituirlo por contenido generado sería un cambio de alcance del Master y exigiría un `SPEC_DIFF` aprobado, no una elección del builder.

**Consecuencias operativas:**
1. Los 6 PDF primarios son **requisito de entrada para el PASS de Phase 1**. Sin ellos, `official.hasOptions.spec` (REQ-B15) falla y Phase 1 se reporta **BLOCKED**, no PASS WITH DEBT.
2. El material GENERATED puede usarse en Phases 0–5 **únicamente** como *fixture* de desarrollo o como vertical provisional, siempre con `provenance_class = GENERATED` visible y nunca contabilizado como cobertura de banco oficial (Manifest §17).
3. Phase 0 **no** queda bloqueada por MI-01.

**Acción requerida de Ana:** aportar los 6 ficheros primarios antes del cierre de Phase 1.

---

## C-02 · El modelo de datos no representa convocatoria, modelo A/B ni ocurrencia · **BLOQUEANTE**

**Fuentes en conflicto**
- `Official_Exam_Corpus_v1.0` · 05_DB_Schema: `exam`, `exam_model`, `exam_occurrence` (con `display_no`), `practical_case`, `topic_mapping`, `concept_mapping`; decisiones CORP-001…CORP-003 FROZEN.
- `Canonical Data & Event Model v1.0` §6–§7: solo `canonical_questions`, `question_options`, `question_concepts`, `answer_key_versions`, `practicals`, `practical_questions`.

**Proposiciones contradictorias**
1. CDEM §31: "el builder no puede alterar en silencio el modelo canónico"; el modelo no contempla sittings ni ocurrencias.
2. Corpus CORP-001 (FROZEN): "A y B son permutaciones de display, no bancos semánticos distintos" — lo que exige explícitamente una entidad de ocurrencia.
3. Mapping v1.1 · F-07: "ningún ítem oficial requiere una entidad de primer nivel nueva" — afirmación que la propia hoja 05_DB_Schema del corpus desmiente.

**Evidencia adicional verificada:** en las 270 preguntas canónicas la **letra correcta nunca diverge entre modelo A y B** (0 divergencias sobre 270). La permutación afecta al orden de presentación, no a la letra.

**Impacto**
Sin ocurrencia no se puede: preservar el orden real del examen, distinguir preguntas de reserva (`THEORY_RESERVE`, `PRACTICAL_I_RESERVE`, `PRACTICAL_II_RESERVE` — 30 ítems), ni calcular Exam Intelligence sin doble conteo. Añadirlo después obliga a migrar contenido ya publicado.

**Recomendación:** añadir en Phase 1 `exam_sittings` (convocatoria/sesión ordinaria|extraordinaria) y `exam_occurrences` (pregunta canónica × modelo × sección × `display_no` × fichero fuente). Mantener `answer_key_versions` por pregunta canónica dado que la letra no diverge, añadiendo `model` como metadato de procedencia. Requiere ADR + entrada en `SPEC_DIFF_LOG`.

**BLOCKED_DECISION BD-05.**

---

## C-03 · Identidad del concepto entre versiones de exam pack · **BLOQUEANTE**

**Fuentes en conflicto**
- `CDEM §4`: `syllabus_blocks.exam_pack_version_id` → `topics.block_id` → `concepts.topic_id`. Los conceptos cuelgan de una **versión** de pack.
- `CDEM §14`: `concept_mastery` con unicidad (user, concept) y reconstruibilidad exigida por EC-006.
- `CDEM §6`: `canonical_questions.exam_pack_id` — la pregunta cuelga del **pack**, no de la versión.
- `Pre-Build Closure` gate "Separación contenido/progreso · GREEN · actualizar contenido no destruye historial".
- `CDEM §29.11`: "TAI puede sustituirse por un segundo pack sin rediseño de esquema".

**Proposición contradictoria**
Si los conceptos son por versión, al publicar la convocatoria 2026 se crean conceptos nuevos y el `concept_mastery` histórico apunta a conceptos de la versión anterior: el historial de dominio queda huérfano y la promesa "actualizar contenido no destruye historial" deja de cumplirse. Simultáneamente, las preguntas cuelgan del pack y no de la versión, con lo que la relación pregunta↔concepto cruza fronteras de versión de forma no definida.

**Impacto:** afecta a EC-006 (reconstruibilidad), a Phase 10 completa y a la propuesta de valor a medio plazo (segundo pack, segunda convocatoria).

**Recomendación:** introducir identidad pedagógica estable (`concept_key` único por linaje de pack) separada de la fila versionada del sílabo; `concept_mastery` se indexa por la identidad estable. Alternativa más simple: conceptos a nivel de `exam_pack` y versionar únicamente el mapeo sílabo↔concepto. Requiere ADR antes de la primera migración de contenido.

**BLOCKED_DECISION BD-02.**

---

## C-04 · Simulacro es P0 pero no existe en el modelo de datos ni la puntuación oficial · **BLOQUEANTE**

**Fuentes en conflicto**
- `Master §20` y `§47`: simulación básica está IN · P0, con temporización, persistencia, resumen de finalización y aporte a Exam Readiness.
- `Knowledge Engine v0.2` · OFFICIAL_STRUCTURE (VERIFIED contra BOE): 80 teóricas + 20 prácticas, 120 min, dos partes eliminatorias 0–50 con mínimo 25, **error = −1/3 del acierto, blanco = 0**.
- `CDEM` completo: no existe entidad de simulacro, ni política de puntuación, ni semántica declarada de respuesta en blanco, ni preguntas de reserva. La taxonomía §11 sí tiene `SIMULATION_STARTED/COMPLETED`, sin destino de datos.

**Impacto**
Sin política de puntuación versionada, "simulacro" degenera en un test largo. Sin representación del blanco, todo el Risk Engine y AT-31 quedan sin base, y la evidencia de readiness se calcula sobre un modelo de examen que no es el real.

**Recomendación:** en Phase 6, `simulation_runs` (parte, track III|IV, tiempo, estado, puntuación por parte) + `scoring_policy` versionada por `exam_pack_version` (no cablear −1/3) + `question_attempts.selected_option_id NULL` como blanco válido y explícito. ADR + SPEC_DIFF.

**BLOCKED_DECISION BD-06.**

---

## C-05 · La escala de confianza difiere en cuatro documentos · **BLOQUEANTE**

| Fuente | Escala |
|---|---|
| `Screen Design Spec v0.1` · 04_CHECK | **4 pasos etiquetados**: Nada segura / Dudosa / Bastante / Segura |
| `Learning System v0.4` · Practical Engine; `Pre-Build Intelligence v0.5` · 01 | `confidence 1-4` |
| `Design System v1.0` §6 | "cuatro/cinco niveles semánticos" (**ambiguo en el propio documento congelado**) |
| Hi-Fi LEARN/CHECK y PRÁCTICO (aprobados) | **1–5** |
| `Knowledge Engine v0.2` · Practical Engine | "0–100 o escala discreta" |

**Impacto:** la confianza alimenta calibración, `error_patterns` de alta confianza, Risk Engine y AT-11/AT-12. Cambiarla después del primer usuario invalida evidencia acumulada y rompe la comparabilidad histórica.

**Resolución por autoridad:** insuficiente. El Design System (nivel 3) es ambiguo y el Hi-Fi (nivel 5) no puede resolver por sí solo.

**Recomendación:** **4 niveles**, por coherencia con la spec de pantalla y con todos los contratos de dominio. Persistir `confidence_value` (int) + `confidence_scale_version` en el evento para permitir recalibración futura sin reinterpretar la historia. Los Hi-Fi de LEARN/CHECK y PRÁCTICO deben corregirse.

**BLOCKED_DECISION BD-03.**

---

## C-06 · Los Hi-Fi aprobados contradicen reglas funcionales congeladas

**Resolución por autoridad: INEQUÍVOCA.** `Builder Handoff Manifest §C` y `Master §48`: si una referencia visual contradice una regla funcional congelada, **gana la regla y la pantalla debe corregirse**. Se registra por su impacto en Phase 5 y 7.

| # | Elemento visual | Regla violada | Corrección requerida |
|---|---|---|---|
| a | SESSION END Hi-Fi: **confeti + trofeo** ("¡Práctico completado!") | Master §22 "No confetti economy"; Design System §15; EC-017 | Sustituir por delta de aprendizaje, errores reparados y próximo repaso |
| b | HOY Hi-Fi: ~10 módulos simultáneos (plan, nivel global, apuntes, accesos rápidos, tutor, progreso, próximamente, motivación) | Master §37 "dashboard-first HOY" prohibido; Screen Design SD-01 (tarjeta de sesión 38%) | Reducir a: resume/recomendada dominante + por qué + preview + readiness secundaria |
| c | HOY Hi-Fi: anillo **"Tu nivel global 68% · Objetivo 80%"** sin declarar proyección | EC-004; UX-007 | Etiquetar explícitamente Mastery o Readiness, o retirar de HOY |
| d | HOY Hi-Fi: tarjeta **"Tú puedes / Paso a paso, lo vas a conseguir"** con trofeo | Master §37 (sin teatro de engagement); Design System §15 | Eliminar o convertir en contexto de plan |
| e | Tutor con **icono de robot/mascota** (HOY y PRÁCTICO) | Design System §15: sin mascotas ni lenguaje visual genérico de IA | Icono neutro, sin antropomorfismo |
| f | Acceso rápido **"Resúmenes"** | Capacidad no especificada en el alcance MVP | Retirar o llevar a backlog P1 |
| g | Porcentajes exactos (68/71/62/72) | Master §6, OB-07: sin precisión falsa sin evidencia suficiente | Banda + interpretación textual bajo umbral (INV-111) |

**Nota:** el resto de los Hi-Fi es coherente y valioso; PRÁCTICO y PROGRESS respetan 42/58 y la separación Dominio/Preparación.

---

## C-07 · El mapping concepto↔pregunta contiene errores verificables pese a declararse validado

**Fuentes**
- `Official_Mapping_Practical_v1.1` · 00_Overview: `Topic mapping: MANUAL_VALIDATED`; `Concept mapping: PEDAGOGICAL v1 · validated against stems`.
- Verificación directa sobre el propio fichero.

**Evidencia**
- **26 preguntas de teoría** con `PRIMARY_CONCEPT = "ENS / ENI / NTI"` y `TOPIC_ID` de I.9, II.2, II.4, II.5, III.1… (p. ej. `TAI25-ORD-THEORY-038`, tema III.1).
- **14 preguntas de práctico** con el mismo patrón (p. ej. `TAI25-ORD-PRACTICAL_I-001`, una pregunta de `CREATE UNIQUE INDEX` en Oracle, tema III.1, etiquetada como ENS/ENI/NTI).
- `PRIMARY_CONCEPT` es **texto libre** (44 etiquetas distintas en teoría), con duplicados semánticos ("Java / .NET" vs "Java EE/Jakarta EE y .NET"), no un `concept_id` resoluble.

**Impacto**
Si `question_concepts` se siembra desde este fichero, el Learning Engine atribuye evidencia a conceptos equivocados. El resultado es un mastery con aspecto de dato y significado nulo — el modo de fallo más caro del producto, porque no produce ningún error visible.

**Recomendación:** marcar el mapping como `PENDING_REVALIDATION`; no sembrar `question_concepts` en Phase 1 salvo para el subconjunto revalidado (IV.7 e I.7). Añadir `mapping_confidence` y umbral de revisión humana (previsto en el Ingestion Contract v0.4 como TBD).

---

## C-08 · Cuatro convenciones incompatibles de `concept_id`

| Fuente | Convención |
|---|---|
| `Learning System v0.4` · Knowledge Graph | `B4_T7_TCP` |
| `Technical_Vertical_Slice_IV7_v0.1` | `IV7-050` |
| `Knowledge_Engine_v0.2` · KG I.7 | `I7_RGPD` |
| `Pre-Build Intelligence v0.5` | `IV.7.TCP` |
| `Official_Mapping_Practical_v1.1` | etiqueta de texto libre |

**Resolución:** ninguna de las cuatro tiene autoridad superior. **Recomendación:** UUID como PK + `code` legible único por `exam_pack_version`, adoptando el formato del programa oficial (`IV.7.TCP`) por ser el más trazable a la fuente BOE. Todas las tablas de mapping se regeneran contra esa clave en Phase 1.

---

## C-09 · Los estados de aprendizaje mezclan mastery, repaso, error y readiness

**Fuentes**
- `Master §12` / `Design System §7`: siete estados de usuario — `○ Aún sin evidencia`, `◔ Aprendiendo`, `△ Frágil`, `✓ Dominado`, `↺ Confusión detectada`, `⟳ Repaso pendiente`, `◆ Preparado para examen`.
- `Learning System v0.4` · Mastery Engine: seis estados internos — `NEW`, `EXPOSED`, `LEARNING`, `CONSOLIDATING`, `MASTERED`, `STRONG` con bandas de score.
- `CDEM §14`: `concept_mastery.mastery_state` (una sola columna).

**Proposiciones contradictorias**
1. La lista de usuario contiene elementos que **no son estados de mastery**: `↺ Confusión detectada` es un `error_pattern`, `⟳ Repaso pendiente` es `next_review_at`, y `◆ Preparado para examen` es **readiness, que en CDEM §16 es por objetivo, no por concepto**.
2. Guardar los siete en `mastery_state` colapsa Mastery, error y Readiness en una sola columna, rozando EC-004.

**Recomendación:** `concept_mastery.mastery_state` = enum del motor (6 valores). El estado visible es una **función pura de presentación** de (mastery_state, error_pattern activo, next_review_at). Sobre `◆ Preparado para examen` a nivel de concepto: decisión de producto pendiente.

**BLOCKED_DECISION BD-04.**

---

## C-10 · Dos modelos de pesos de Mastery

| Fuente | Dimensiones y pesos |
|---|---|
| `Learning System v0.4` · Mastery Engine | accuracy .30 · retention .20 · transfer .20 · stability .10 · confidence_calibration .10 · speed .10 |
| `Technical_Vertical_Slice_IV7_v0.1` · Mastery & Planner | knowledge_accuracy .30 · retention .20 · application .20 · error_recurrence .15 · response_efficiency .05 · confidence_calibration .10 |

**Resolución por autoridad: INEQUÍVOCA.** Gana `Learning System v0.4` (versión superior y rol de contrato de motor). La hoja del Vertical Slice queda como material superseded.
**Nota obligatoria:** ambos documentos declaran los pesos como **hipótesis** (`PROVISIONAL`, "no son reglas oficiales"). Deben vivir en `engine_config` versionada (OBS-01, ADR-003) y no presentarse al usuario como precisión.

---

## C-11 · Taxonomías de evento divergentes

| Concepto | `Pre-Build Closure v0.6` | `CDEM v1.0` |
|---|---|---|
| Respuesta enviada | `QUESTION_ANSWERED` | `ANSWER_SUBMITTED` |
| Pausa/salida | `SESSION_PAUSED` | `SESSION_INTERRUPTED` |
| Cierre | `SESSION_ENDED` | `SESSION_COMPLETED` |
| Apertura de contenido | `CONTENT_OPENED` | `LEARNING_UNIT_VIEWED` |
| Repaso completado | `REVIEW_COMPLETED` | **no existe** |
| Cambio de clave oficial | `ANSWER_KEY_UPDATED` | `SOURCE_UPDATE_ACKNOWLEDGED` (semántica distinta: es el ack del usuario) |

**Resolución por autoridad: INEQUÍVOCA.** Gana `CDEM v1.0` (nivel 3, v1.0). v0.6 queda como fuente de **tests**, no de nombres.

**Hueco derivado (no contradicción):** el modelo v1.0 no cubre tres eventos que el producto sí requiere:
1. `REVIEW_COMPLETED` — necesario para retención/estabilidad (AT-, DI-06).
2. Pausa por inactividad (SC-08 / AT-04: "no inflar el tiempo de estudio").
3. Corrección del usuario sobre el diagnóstico de error del sistema (AT-14: guardar inferencia **y** corrección).
→ Adición aditiva vía `SPEC_DIFF_LOG` SD-004, sin romper la taxonomía existente.

---

## C-12 · Dos definiciones de idempotencia

- `Pre-Build Closure v0.6` · 02_Event_Model: claves compuestas (`session_id:concept_id:complete`, `attempt_id:question_id`).
- `CDEM v1.0` §10 y TA §4.3: `event_id` UUID generado en cliente, idempotencia del servidor sobre esa clave.

**Resolución: INEQUÍVOCA.** Gana `CDEM v1.0`. Las claves compuestas de v0.6 se conservan como **aserciones de deduplicación semántica** en los tests (evitar dos `SESSION_ITEM_COMPLETED` del mismo ítem), no como clave primaria.

---

## C-13 · La matriz RLS expone la clave de respuesta al cliente

**Fuentes**
- `CDEM §22`: "canonical exam/content → Read: authenticated/read policy".
- `answer_key_versions` está definida en §6 dentro del contenido canónico.
- `Master §17`: "la selección previa al envío nunca debe revelar corrección"; `Master §20`: "sin filtración de respuestas antes del envío según el modo".

**Contradicción:** aplicada literalmente, la política permite que cualquier cliente autenticado lea `correct_option_id` antes de responder. Rompe CHECK, PRÁCTICO y simulacro simultáneamente, y no produce ningún error visible.

**Resolución:** el `Master` gana sobre la lectura literal de la matriz. **Requiere control explícito:** `answer_key_versions` fuera del esquema expuesto al Data API; corrección mediante Edge Function/RPC que devuelve resultado + explicación. Nuevo invariante **INV-101** y test de red en E2E.

---

## C-14 · Los intentos de diagnóstico no tienen enlace declarado

`CDEM §13`: "las respuestas del diagnóstico usan `question_attempts` con contexto de diagnóstico", pero `question_attempts` (§12) no tiene `diagnostic_run_id` ni ningún campo de contexto.
**Recomendación:** `diagnostic_run_id` nullable en `question_attempts`. Cambio menor, aditivo. SPEC_DIFF SD-005.

---

## C-15 · Referencias polimórficas sin integridad referencial posible

`session_items.item_ref_id` y `planner_items.item_ref_id` son polimórficos (`item_type` + id), pero `CDEM §23` exige que "un planner item referencie un objetivo de contenido/repaso válido" y que se usen constraints "siempre que la base pueda garantizar el invariante".
**Contradicción práctica:** una FK simple no puede garantizarlo.
**Recomendación:** columnas nullable por tipo con FK real y CHECK de exclusividad (`exactly one non-null`), o tabla puente por tipo. Decisión en **ADR-002**.

---

## C-16 · Semántica de envío en PRÁCTICO

- Hi-Fi PRÁCTICO: "Puedes cambiar tu respuesta más adelante antes de enviar el práctico" + navegación con estados "Respondidas / Actual / Pendientes" + temporizador 28:47.
- `CDEM §12` y DI-01: el intento enviado es evidencia inmutable.

**Resolución:** compatible mediante la taxonomía existente: `ANSWER_SELECTED` (mutable, no evidencia de mastery) vs `ANSWER_SUBMITTED` (inmutable, al cierre del caso). **Debe escribirse explícitamente** porque determina cuándo se captura la confianza (INV-102), cuándo se corrige y qué se reanuda tras interrupción. Además, `Master §19` no especifica temporizador en PRÁCTICO fuera del modo examen: decidir si el temporizador es informativo o vinculante.

---

## C-17 · Valores de Rescue Mode

- `Master §8`, `Design System §8`, `Edge States ED-01`: 0 · 5 · 10 · 20 · 30 · personalizado.
- `Pre-Build Intelligence v0.5` · 05_UX_CONTRACT y `Closure` SC-10: 0 / 10 / 20 / 30.

**Resolución: INEQUÍVOCA.** Gana el Master. Se incluye el escalón de 5 minutos y la opción personalizada.

---

## C-18 · Orden de autoridad divergente entre documentos de gobierno

- `CLAUDE.md`: 6 niveles, **sin** Engineering Constitution.
- `Source of Truth Index v1.1` §1: 8 niveles, Constitution en #2, Manifest en #4.
- `Master §0`: otra lista de 6, con el Manifest ausente.

**Resolución:** gana `Source of Truth Index v1.1` por ser el documento de control más reciente y por declarar explícitamente cómo integra la Constitution, con el Master siempre en cabecera.
**Acción:** enmienda mínima a `CLAUDE.md` (SPEC_DIFF SD-009) para alinear la lista. Sin esta corrección, el agente y el índice discrepan sobre quién manda.

---

## C-19 · Orden de lectura divergente

`Manifest §4` (Pass 1–4, 15 pasos) vs `Source of Truth Index v1.1 §9` (23 pasos, empezando por CLAUDE.md y la Constitution).
**Resolución:** gana el SoT Index v1.1. Es una discrepancia de proceso, sin impacto en implementación.

---

## C-20 · Nombre de fichero frente a versión de contenido

El fichero `STUDY_OS___Source_of_Truth_Index_v1_0.pdf` contiene un documento titulado **v1.1** que declara "Supersedes: v1.0". El brief inicial pide subir "Source_of_Truth_Index_v1.0".
**Resolución:** el contenido manda. **Acción:** renombrar a `STUDY_OS_Source_of_Truth_Index_v1.1.pdf` conforme a `Manifest §21`.

---

## C-21 · El Tutor debe citar normativa vigente pero no hay corpus normativo ingerido

- `Pre-Build Closure` · 03_AI_RAG_Contract, capacidad "Explain law": *AI MUST* usar la versión legal validada y vigente; *MUST NOT* declarar vigencia desde memoria. AT-15 es P0.
- Contenido disponible: URLs del BOE/EUR-Lex y un grafo de 12 conceptos de I.7, 8 de ellos en `TO_VALIDATE_DETAIL`. **Ningún `source_chunk` ingerido.**

**Impacto:** la primera pregunta de tipo "¿esto sigue vigente?" produce, o bien un rechazo, o bien una alucinación con apariencia oficial. Agravante real: el propio KG advierte que la versión consolidada de la LOPDGDD se actualizó el 27/12/2025.

**Recomendación:** en MVP, restringir el Tutor a *grounding* sobre `learning_units` y feedback de pregunta mapeada, y **desactivar explícitamente** la capacidad `LEGAL_EXPLANATION` hasta que exista corpus normativo versionado. Registrar en `deferred-requirements.md`.

---

## C-22 · No existe contenido didáctico (`learning_units`)

`Master §11`, `§47` y Phase 5 requieren LEARN con superficie editorial. En todo el paquete hay: grafo de conceptos (IV.7 e I.7), 28 preguntas GENERATED y corpus oficial sin opciones. **No hay un solo cuerpo de lección.**

**Recomendación:** acotar formalmente la validación del MVP a **dos verticales: IV.7 (técnico) e I.7 (normativo)**, que es la intención original del diseño, y declararlo en el alcance para no descubrirlo en Phase 5. La producción de contenido didáctico es una línea de trabajo paralela, no un subproducto de la implementación.

---

## C-23 · Offline es P0 pero se implementa en Phase 9

No es contradicción normativa (`Master §47` lo lista en P0; `Manifest §10` lo sitúa en Phase 9), sino **riesgo de secuencia**: si Phases 2–8 se construyen sin el contrato de evento offline (event_id de cliente, `client_sequence`, ingestión idempotente), Phase 9 obliga a refactorizar seis fases.
**Recomendación:** el **contrato** entra en Phase 2; la **cola IndexedDB** en Phase 9. Registrado como riesgo R-09.

---

## C-24 · Precisión numérica no sostenida por evidencia

- `Master §6` y `Edge States OB-07`: sin porcentajes exactos falsos cuando la evidencia es insuficiente.
- Hi-Fi: "68%", "71%", "62%", "72%", "Objetivo 80%", "+6% esta semana", "llegarás al 75% en 23 días".
- `Learning System v0.4`: los pesos son hipótesis sin calibrar.

**Resolución:** gana el Master. **Recomendación:** función de presentación con umbral de evidencia (INV-111); la proyección "llegarás al 75% en 23 días" no debe mostrarse en MVP salvo que exista modelo validado — es exactamente el tipo de afirmación que el Evidence Ledger existe para impedir.

---

## C-25 · No está declarado dónde se ejecutan los motores deterministas

`TA §6` los define como paquetes TypeScript; `TA §3.3` prohíbe calcular mastery autoritativo en el navegador, pero ninguna sección declara el límite de ejecución.
**Recomendación:** ejecución exclusivamente en servidor (Edge Function / RPC), con regla de import y check de bundle. Es la diferencia entre un principio y un control. **ADR-001** + invariante **INV-113**.


---

## C-26 · El modelo no define un orden total determinista de eventos ni un watermark operativo · **NUEVA en v1.2**

**Fuentes**
- `Canonical Data & Event Model v1.0` §10: `server_received_at` como marca de ingesta; §14 y §16: `event_watermark` en las proyecciones; §25: reconstruibilidad exigida.
- `ADR-002 v1.1` y `domain-model v1.1` (redactados por mí): afirmaban que "el orden autoritativo lo fija `server_received_at`".

**Proposición contradictoria**
`server_received_at` **no** define un orden total determinista:
1. dos eventos ingeridos concurrentemente pueden compartir timestamp;
2. el reloj del servidor puede retroceder o ajustarse;
3. un evento offline antiguo recibido más tarde obtiene un `server_received_at` posterior, mezclando orden de llegada con orden temporal del hecho;
4. `event_watermark` se persiste en cada proyección pero **ningún documento define qué valor contiene ni cómo avanza**.

Sin orden total ni watermark operativo, **EC-006 no es verificable**: dos reconstrucciones pueden producir resultados distintos y nadie podría demostrarlo.

**Impacto:** Learning Engine, Planner, rebuild, sync y toda la promesa de reproducibilidad. Detección difícil: el sistema parece funcionar.

**Resolución propuesta (ADR-002 v1.2 · SD-015):** `learning_events.server_sequence BIGINT`, asignado por una secuencia de base de datos en el momento de aceptar el evento, como **clave de orden total**; `event_watermark` pasa a ser un valor de `server_sequence` con regla de avance sin huecos. Detalle completo en ADR-002 §Decision y en `domain-model` §7.

**Estado:** resuelto por diseño, **pendiente de aprobación**. Requiere ampliar el CDEM → **SD-015 PROPOSED**, no aplicado.
