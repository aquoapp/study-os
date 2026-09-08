# STUDY OS · requirement-index.md

**Fase:** −1 · Specification Compilation
**Versión:** 1.2 · patch correctivo (IDs estabilizados; REQ-C15 recuperado)
**Estado:** PROPUESTO

**Recuento verificado programáticamente:** **123 requisitos** (A:9 · B:15 · **C:16** · D:11 · E:13 · F:15 · G:9 · H:8 · I:12 · J:9 · K:6).

Reconciliación de cifras entre versiones:

| Versión | Total | Motivo del cambio |
|---|---|---|
| v1.0 | 122 | El resumen declaraba 96 por error de recuento manual; las filas eran 122 |
| v1.1 | 122 | Se añadió idempotencia como `REQ-C08` (renumerando C08…C14) y **se eliminó en silencio** el `REQ-C15` de la v1.0 (`devices`+`sync_state`) |
| **v1.2** | **123** | Se restauran los IDs de la v1.0, se **recupera** `REQ-C15` y la idempotencia pasa a `REQ-C16`: 122 + 1 requisito recuperado |

**Los identificadores quedan congelados desde v1.2.** Un requisito nuevo recibe siempre el siguiente ID libre de su bloque; ningún ID se reutiliza ni se desplaza.

**Campo `Auth`** (nivel de autoridad de la fuente, según `authority-map.md` §0):
`1` Master Product Specification · `2` Engineering Constitution · `3` especialista FROZEN/v1.0 · `4` Builder Handoff Manifest · `5` Hi-Fi aprobado · `6` especialista v0.x.
Con varias fuentes se indica la **más alta**.

**Prueba:** U=unit · I=integración/DB · E=E2E · S=estático/CI · SEC=seguridad/RLS · M=migración.
**Estado:** OK=sin conflicto · CONF=afectado por contradicción registrada · BLOQ=depende de decisión abierta o de entrada ausente.

---

## A · Fundación y plataforma (Phase 0) — 9

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-A01 | Monorepo apps/packages/supabase/tests/docs | Manifest §8 | 4 | 0 | repo | S | La estructura existe y CI la valida | OK |
| REQ-A02 | Next.js + TypeScript, App Router, PWA responsive | Master §39; TA §3 | 1 | 0 | web | S,E | Arranca; manifest PWA válido e instalable | OK |
| REQ-A03 | Entornos local/staging/producción con secretos separados | Master §45; TA §13 | 1 | 0 | infra | S | Configuración distinta por entorno; producción no comparte datos | OK |
| REQ-A04 | Migraciones versionadas en repositorio | EC-011; TA §5.1 | 2 | 0 | supabase | S,M | Check de deriva de esquema en verde | OK |
| REQ-A05 | Sin secretos de servicio/proveedor en el bundle | EC-010 | 2 | 0 | web/CI | S | Escáner sin hallazgos; solo `NEXT_PUBLIC_` en allowlist | OK |
| REQ-A06 | Tokens del Design System (color, espaciado, radio, tipografía, 44px) | Design System §2; Screen Design 09 | 3 | 0 | design-system | U,S | Tokens conformes; contraste AA verificado | OK |
| REQ-A07 | Auth con perfil separado de la identidad de auth | TA §5.2; CDEM §3 | 3 | 0–2 | web/db | I,E | Alta y login funcionan; `profiles` 1:1 con `auth.users` | OK |
| REQ-A08 | El cliente no persiste Mastery/Readiness/Planner | INV-113 (revisado); TA §3.3 | 3 | 0 | web/CI | S,I | Ninguna ruta cliente escribe proyecciones autoritativas | OK |
| REQ-A09 | Constante única de espacios primarios (5) | Master §4; EC-015 | 1 | 0 | design-system | U | Igualdad con la lista congelada | OK |

## B · Contenido canónico y procedencia (Phase 1) — 15

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-B01 | Jerarquía pack→version→block→topic→concept con prerrequisitos | Master §11; CDEM §4 | 1 | 1 | content | I | Pack navegable; prerrequisito reflexivo rechazado | OK |
| REQ-B02 | `sources` + `source_versions` con autoridad, vigencia, checksum, supersesión | Master §31; CDEM §5 | 1 | 1 | content | I | Versión superseded direccionable y no vigente | OK |
| REQ-B03 | Preguntas y opciones sin corrección como booleano no versionado | CDEM §6 | 3 | 1 | content | I | El esquema no admite `is_correct` en la opción | OK |
| REQ-B04 | `answer_key_versions` PROVISIONAL→FINAL→AMENDED | Master §18; CDEM §6 | 1 | 1 | content | I | Transición registrada; clave anterior conservada | OK |
| REQ-B05 | La opción correcta pertenece a su pregunta | CDEM §23 | 3 | 1 | content | I | Constraint rechaza relación cruzada | OK |
| REQ-B06 | `question_concepts` con primario, secundarios y peso | Master §41; Intelligence 01 | 1 | 1 | content | I | Pregunta transversal conserva primario+secundario | CONF (C-07) |
| REQ-B07 | Pipeline con staging: lo parseado no entra directo en publicado | Master §31; TA §8 | 1 | 1 | ingestion | I | Import inválido queda en staging/cuarentena | OK |
| REQ-B08 | Contrato de ingestión con campos inmutables y acción de fallo | LS v0.4 Ingestion Contract | 6 | 1 | ingestion | U,I | Ítem de promoción interna en pipeline libre → rechazado | OK |
| REQ-B09 | Ningún ítem OFFICIAL sin fuente primaria verificable | LS v0.4; INV-110 | 6 | 1 | ingestion | I | Constraint + cuarentena | OK |
| REQ-B10 | El usuario normal no muta contenido canónico | Master §44; Closure 04 | 1 | 1 | db | SEC | Escritura denegada por política y grants | OK |
| REQ-B11 | Semilla del pack TAI (33 temas: I=9, II=5, III=9, IV=10) | Knowledge Engine v0.2 | 6 | 1 | seed | I | Recuento por bloque coincide con la fuente BOE | OK |
| REQ-B12 | Prácticos reutilizando la maquinaria canónica | Master §19; CDEM §7 | 1 | 1 | content | I | Los 4 prácticos oficiales encajan sin entidades nuevas | OK |
| REQ-B13 | Convocatoria, modelo y ocurrencia (A/B, display_no, reservas) | Corpus v1.0 05_DB_Schema | 6 | 1 | content | I | 405 ocurrencias cargan sin duplicar pregunta canónica | BLOQ (BD-05) |
| REQ-B14 | Identidad estable de concepto entre versiones de pack | EC-006; derivado C-03 | 2 | 1 | content | I | Tras publicar la versión siguiente, el mastery histórico resuelve | BLOQ (BD-02) |
| REQ-B15 | Textos de opción de las preguntas oficiales ingeridos | Master §17, §47 | 1 | 1 | ingestion | I | Toda pregunta OFFICIAL publicada tiene ≥2 opciones con texto | BLOQ (MI-01) |

## C · Aprendiz, sesiones y evidencia (Phase 2) — 16

> **Corrección de estabilidad de IDs (v1.2).** La v1.1 insertó el requisito de idempotencia en `REQ-C08` y desplazó C08…C14 una posición, además de **eliminar en silencio** el `REQ-C15` de la v1.0 (`devices` + `sync_state`). Renumerar identificadores rompe la trazabilidad y el borrado silencioso es exactamente la erosión que EC-019 prohíbe. En v1.2 se restauran los IDs de la v1.0, se recupera `REQ-C15` y el requisito nuevo recibe un ID nuevo al final del bloque (`REQ-C16`). **Los IDs son inmutables a partir de aquí.**
> Con ello, **RLS vuelve a ser `REQ-C13`**, como indicaba la revisión.

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-C01 | Onboarding mínimo: objetivo, nivel, disponibilidad, diagnóstico opcional | Master §6; OB-02…05 | 1 | 2 | web | E | Llega al primer plan sin ajustes avanzados | OK |
| REQ-C02 | Diagnóstico omitido ⇒ estimaciones conservadoras con incertidumbre explícita | Master §6; WF-D02 | 1 | 2–3 | engine/web | U,E | Existe plan inicial y la UI declara incertidumbre | OK |
| REQ-C03 | Disponibilidad editable sin reiniciar progreso | Master §7, §49 | 1 | 2 | db/web | I,E | Cambiarla no borra evidencia | OK |
| REQ-C04 | Estados de sesión y `resume_cursor_json` | CDEM §9 | 3 | 2 | db | I | Transiciones válidas; ABANDONED nunca visible | OK |
| REQ-C05 | `learning_events` append-only e idempotente por `event_id` | CDEM §10; EC-005 | 2 | 2 | db | I,SEC | Mismo `event_id` dos veces ⇒ una evidencia; sin UPDATE/DELETE de usuario | OK |
| REQ-C06 | Taxonomía P0 validada por esquema de evento | CDEM §11 | 3 | 2 | domain | U,I | Payload inválido rechazado por `schema_version` | CONF (C-11) |
| REQ-C07 | `question_attempts` con clave usada, confianza, tiempo y evento origen | CDEM §12 | 3 | 2 | db | I | `answer_key_version_id` y `submitted_event_id` NOT NULL | OK |
| REQ-C08 | Respuesta en blanco como intento válido | Knowledge Engine v0.2 | 6 | 2 | db | I | `selected_option_id NULL` válido, puntúa 0, no penaliza | CONF (C-04) |
| REQ-C09 | Autoguardado granular sin acción del usuario | Closure D-001; UX-005 | 6 | 2 | web | E | Cierre abrupto en Q7/15 conserva Q1–Q7 y reanuda en Q8 | OK |
| REQ-C10 | Reanudación en el cursor exacto | Master §10; CDEM §29.10 | 1 | 2 | web/db | E | Cae en el ítem exacto | OK |
| REQ-C11 | Recuperación entre dispositivos con el último estado confirmado | Closure SC-06 | 6 | 2 | db | I,E | El dispositivo obsoleto no sobrescribe historial más nuevo | OK |
| REQ-C12 | El trabajo completado cuenta; lo no terminado vuelve al planner | Closure D-003 | 6 | 2–4 | engine | U,E | Sin etiqueta de sesión fallida | OK |
| REQ-C13 | RLS con test de aislamiento por tabla | EC-009 | 2 | 2 | db | SEC | Lectura y escritura cruzada denegadas | OK |
| REQ-C14 | `diagnostic_runs` enlazado con sus intentos | CDEM §13 | 3 | 2 | db | I | Los intentos de diagnóstico se distinguen | CONF (C-14) |
| REQ-C15 | `devices` y `sync_state` por usuario+dispositivo | CDEM §3, §21 | 3 | 2 | db | I | Unicidad user+device garantizada | OK |
| REQ-C16 | Idempotencia del intento por `submitted_event_id` UNIQUE + FK al evento | CDEM §10, §12; EC-013 | 2 | 2 | db | I | Reintento del mismo evento ⇒ un solo intento, sin depender de `attempt_number` | OK |

## D · Learning Engine (Phase 3) — 11

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-D01 | `concept_mastery` con estado, estabilidad, incertidumbre, versión, watermark | Master §13; CDEM §14 | 1 | 3 | learning-engine | U,I | Fila única (user, concept) con control de versión | OK |
| REQ-D02 | Determinismo del motor | EC-002 | 2 | 3 | learning-engine | U | Misma evidencia + misma versión ⇒ misma proyección | OK |
| REQ-D03 | Reconstrucción completa desde evidencia | EC-006; CDEM §25 | 2 | 3 | learning-engine | I | Rebuild reproduce la proyección incremental | OK |
| REQ-D04 | Confianza como calibración, no como dominio | Master §14 | 1 | 3 | learning-engine | U | Acierto con confianza baja sube conocimiento y baja calibración | OK |
| REQ-D05 | Repaso espaciado con `next_review_at` | Master §13; LS v0.4 | 1 | 3 | learning-engine | U | Aciertos separados en el tiempo espacian el repaso | OK |
| REQ-D06 | `error_patterns` con estado y evidencia | Master §13; CDEM §15 | 1 | 3 | learning-engine | U,I | Tres fallos del mismo tipo producen patrón | OK |
| REQ-D07 | `intervention_outcomes` con eficacia medida | Intelligence 04; CDEM §15 | 3 | 3 | learning-engine | U | Ante recurrencia, intervención distinta | OK |
| REQ-D08 | `engine_config` versionada, inmutable por versión y promocionada con control | ADR-003; EC-006 | 2 | 3 | learning-engine | U,I,S | Una versión publicada no se edita; el cambio semántico exige aprobación | OK |
| REQ-D09 | El motor no requiere LLM | EC-002; Manifest gate 3 | 2 | 3 | learning-engine | U | Suite pasa sin red | OK |
| REQ-D10 | `exam_readiness` separada por objetivo | Master §23; CDEM §16 | 1 | 3–6 | learning-engine | U,I | Mastery alto con práctico lento mantiene readiness baja | OK |
| REQ-D11 | Estado interno → estado visible como función pura | EC-004; derivado C-09 | 2 | 3 | domain | U | Tests por combinación (mastery, error, repaso) | BLOQ (BD-04) |

## E · Planner Engine (Phase 4) — 13

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-E01 | `planner_runs` auditable con tipo, versión, watermark y reason_codes | CDEM §17 | 3 | 4 | planner-engine | I | Todo run conserva historial | OK |
| REQ-E02 | `planner_items` con prioridad, minutos, orden y reason_codes | CDEM §17 | 3 | 4 | planner-engine | U,I | Los reason_codes reproducen la selección | OK |
| REQ-E03 | Modelo de prioridad de 7 factores | LS v0.4 Priority Model | 6 | 4 | planner-engine | U | `priority_score` reproducible | OK |
| REQ-E04 | Asignación por disponibilidad como defaults dinámicos | LS v0.4 Session Allocator | 6 | 4 | planner-engine | U | Con revisiones críticas, Review desplaza Learn | OK |
| REQ-E05 | Cambio de default replanifica el futuro sin reescribir el pasado | Master §49; INV-106 | 1 | 4 | planner-engine | U,E | Plan futuro cambia; eventos pasados intactos | OK |
| REQ-E06 | El override de hoy no altera el default | Master §7 | 1 | 4 | planner-engine | U,E | `default_daily_minutes` intacto | OK |
| REQ-E07 | Rescue 0/5/10/20/30/personalizado preservando lo de mayor valor | Master §8; ED-01 | 1 | 4 | planner-engine | U,E | Con 20 min se conserva la revisión crítica | OK |
| REQ-E08 | Ruta de 0 minutos sin penalización ni deuda | Master §8; ED-02 | 1 | 4 | planner-engine | U,E | Sin backlog ni marca de fracaso | OK |
| REQ-E09 | Momentum Recovery en tres bloques | Master §9; ED-04 | 1 | 4 | planner-engine | U,E | Cinco días de ausencia no producen muro | OK |
| REQ-E10 | Prerrequisito flexible con microlección | LS v0.4 | 6 | 4 | planner-engine | U | Sin bloqueo duro salvo validez/seguridad | OK |
| REQ-E11 | Ninguna revisión vencida se elimina en silencio | LS v0.4 P01; INV-108 | 6 | 4 | planner-engine | U | Se conserva o se explica vía reason_codes | OK |
| REQ-E12 | El planner no requiere LLM | Master §46 | 1 | 4 | planner-engine | U | Suite sin red | OK |
| REQ-E13 | El replan crea versión nueva; no edita historia | Closure DI-05 | 6 | 4 | planner-engine | I | Runs anteriores consultables | OK |

## F · UX de aprendizaje (Phase 5) — 15

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-F01 | La sesión interrumpida domina HOY con continuación exacta | Master §10; ED-03; SD-01 | 1 | 5 | web | E | Resume es superficie y CTA dominantes | OK |
| REQ-F02 | HOY no es un dashboard | Master §37; SD-01 | 1 | 5 | web | E | Jerarquía SD-01; tarea principal clara en <5s | CONF (C-06) |
| REQ-F03 | "Por qué esto hoy" derivado de reason_codes | UX PL4; WF-06 | 6 | 5 | web | E | Explicación verificable, no generada libremente | OK |
| REQ-F04 | LEARN con medida 45–70 caracteres y cuerpo 16–18px | Design System §6; Screen Design 03 | 3 | 5 | web | E | Sin fragmentación en tarjetas por párrafo | OK |
| REQ-F05 | "No entiendo nada" cambia de estrategia | Master §15; X01 | 1 | 5 | web/AI | E | Nunca repite el mismo texto | OK |
| REQ-F06 | "Esto ya me lo sé" exige comprobación breve | Master §16; X02 | 1 | 5 | web/engine | E | Si supera acelera; si falla refuerza sin castigo | OK |
| REQ-F07 | Selección visible sin señal de corrección antes del envío | Master §17; INV-103 | 1 | 5 | web | E | La opción seleccionada se distingue con énfasis neutral y `aria-checked/aria-selected`; ningún token, icono, texto ni atributo de correcto/incorrecto; sin cambio de orden ni revelación de la clave | OK |
| REQ-F08 | Confianza capturada antes del feedback | Master §14; INV-102 | 1 | 5 | web | E | El evento de confianza precede al de feedback | BLOQ escala (BD-03) |
| REQ-F09 | Corrección en servidor sin exponer la clave | Master §17; INV-101 | 1 | 5 | web/functions | SEC,E | El payload de CHECK no contiene la respuesta correcta | OK |
| REQ-F10 | Orden de FEEDBACK en 7 pasos | Master §21; Design System §6 | 1 | 5 | web | E | Resultado→por qué→distractor→calibración→fuente→ayuda→siguiente | OK |
| REQ-F11 | Acceso a fuente y versión de clave desde feedback | Closure AT-41; X10 | 6 | 5 | web | E | Procedencia alcanzable sin salir del contexto | OK |
| REQ-F12 | SESSION END comunica consecuencia, no celebración | Master §22; SD-06 | 1 | 5 | web | E | Sin confeti, XP ni rachas | CONF (C-06) |
| REQ-F13 | La navegación global se repliega durante LEARN/CHECK | Design System §4 | 3 | 5 | web | E | La barra inferior no compite durante la respuesta | OK |
| REQ-F14 | Siete estados vacíos con una sola acción útil | Master §32; Edge States §7 | 1 | 5 | web | E | Existen y explican utilidad futura | OK |
| REQ-F15 | Accesibilidad P0 en superficies de estudio | Master §35 | 1 | 5–11 | web | E,S | Contraste, foco, 44px, etiquetas, movimiento reducido | OK |

## G · Práctico y simulacro (Phase 6) — 9

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-G01 | Workspace 42/58 con scroll independiente | Master §19; Design System §6 | 1 | 6 | web | E | Ambos paneles usables a la vez | OK |
| REQ-G02 | Escenario a un toque en móvil, con posición restaurada | Master §19 | 1 | 6 | web | E | Scroll exacto recuperado | OK |
| REQ-G03 | Selección mutable vs envío inmutable | ADR-002; derivado C-16 | 3 | 6 | domain/web | U,E | Cambiar respuesta antes del envío no crea evidencia autoritativa duplicada | CONF (C-16) |
| REQ-G04 | La evidencia práctica alimenta transferencia/readiness | Master §19 | 1 | 6 | learning-engine | U | Readiness se mueve; el mastery no la sustituye | OK |
| REQ-G05 | Simulacro sin filtración y con feedback diferido | Master §20; WF-D05 | 1 | 6 | web/functions | E,SEC | Ninguna respuesta accesible antes del cierre | OK |
| REQ-G06 | Persistencia y reanudación del simulacro | Master §20 | 1 | 6 | web/db | E | Interrumpir no pierde respuestas enviadas | OK |
| REQ-G07 | Puntuación oficial versionada (80+20, 0–50/parte, mín. 25, −1/3, blanco 0) | Knowledge Engine v0.2 | 6 | 6 | domain | U,I | El resumen reproduce la puntuación oficial | BLOQ (BD-06) |
| REQ-G08 | El simulacro aporta evidencia, no escribe mastery | Master §20 | 1 | 6 | learning-engine | U | Sin escritura directa sobre mastery | OK |
| REQ-G09 | Elección de track práctico III o IV | Knowledge Engine; Practical Engine | 6 | 6 | domain | I | La readiness práctica se calcula sobre el track elegido | CONF (C-02) |

## H · Progreso y plan (Phase 7) — 8

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-H01 | PROGRESO separa Mastery y Readiness | EC-004; Master §23 | 2 | 7 | web | E | Etiquetas, secciones y explicaciones distintas | OK |
| REQ-H02 | Mapa de dominio con estados semánticos | Master §25 | 1 | 7 | web | E | Etiqueta + icono + color contenido | OK |
| REQ-H03 | Áreas frágiles y confusiones con acción concreta | Master §25 | 1 | 7 | web | E | Cada área ofrece una siguiente acción | OK |
| REQ-H04 | Calibración de confianza visible y explicada | Master §25 | 1 | 7 | web | E | Se explica el significado, sin juicio | OK |
| REQ-H05 | Sin porcentajes exactos bajo umbral de evidencia | Master §6; INV-111 | 1 | 7 | web | U,E | Banda + interpretación textual | OK |
| REQ-H06 | PLAN con objetivo, default, override, carga y racional | Master §26 | 1 | 7 | web | E | Los cuatro bloques existen y son editables | OK |
| REQ-H07 | Previsualización de replanificación | Master §26; Design System §8 | 1 | 7 | web | E | Qué se mantiene, qué se mueve, qué se protege | OK |
| REQ-H08 | Sin muro rojo de vencidos | Master §26, §37 | 1 | 7 | web | E | No existe contador de deuda | OK |

## I · Notas y Tutor (Phase 8) — 12

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-I01 | Notas libres y contextuales con enlace automático | Master §27; CDEM §18 | 1 | 8 | web/db | I,E | `note_context` guarda contexto y snapshot | OK |
| REQ-I02 | Búsqueda, filtro, edición y borrado | Master §27 | 1 | 8 | web | E | Borrar nota no borra contenido canónico | OK |
| REQ-I03 | "Quiero recordar esto" | Master §27 | 1 | 8 | db | I | `remember_flag` persiste | OK |
| REQ-I04 | Transformación IA con previsualización y aprobación | Master §27; NOTE-01/02 | 1 | 8 | web/AI | E | Nada se añade al repaso sin aprobación | OK |
| REQ-I05 | El material personal nunca es canónico | EC-016 | 2 | 8 | db | SEC,I | La API de usuario no inserta en tablas canónicas | OK |
| REQ-I06 | Tutor contextual en cinco superficies | Master §28; UX 08 | 1 | 8 | web | E | No existe chatbot flotante global | OK |
| REQ-I07 | Salida generada distinguible de la canónica | Master §28; EC-008 | 1 | 8 | web | E | Nunca se presenta como oficial | OK |
| REQ-I08 | Proveedor abstraído con contrato por tarea | TA §7.1; Manifest §15 | 3 | 8 | ai | U | Cambiar proveedor no cambia la lógica de producto | OK |
| REQ-I09 | Telemetría de coste por endpoint | Master §46; CDEM §19 | 1 | 8 | ai | I | Proveedor, modelo, tokens, latencia y fallo registrados | OK |
| REQ-I10 | El documento recuperado es dato, nunca instrucción | Master §30; TA §7.4 | 1 | 8 | ai | U | Test de inyección con documento hostil | OK |
| REQ-I11 | La IA no muta estado protegido | EC-002/003; Master §29 | 2 | 8 | ai/db | SEC | Sin grants de escritura sobre proyecciones | OK |
| REQ-I12 | Sin afirmar vigencia normativa sin fuente validada | Closure AT-15 | 6 | 8 | ai | U,E | Capacidad legal desactivada o con `source_version` vigente | CONF (C-21) |

## J · Offline, sync y ciclo oficial (Phases 9–10) — 9

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-J01 | Cola local con `event_id` de cliente y `client_sequence` | TA §4.3 | 3 | 9 (contrato en 2) | web | U,E | El reintento no duplica intento | OK |
| REQ-J02 | Cuatro estados de sync veraces | Master §34; ED-06…09 | 1 | 9 | web | E | Nunca "Sincronizado" sin ACK | OK |
| REQ-J03 | Reconciliación automática segura; interrupción solo por integridad | Master §34 | 1 | 9 | web/db | I,E | ED-08 y ED-09 conforme a spec | OK |
| REQ-J04 | El dispositivo obsoleto no borra historial aceptado | EC-005; DI-03 | 2 | 9 | db | I | Merge sin pérdida | OK |
| REQ-J05 | Alcance offline acotado y declarado | Master §33 | 1 | 9 | web | E | Lo no soportado se deshabilita con explicación | OK |
| REQ-J06 | Ciclo de actualización de fuente oficial completo | Master §18, §31; TA §9 | 1 | 10 | ingestion | I,E | Ingesta→comparación→publicación→recálculo→auditoría→aviso | OK |
| REQ-J07 | `attempt_recalculations` conserva corrección previa y nueva | CDEM §12 | 3 | 10 | db | I | Intento original intacto | OK |
| REQ-J08 | Aviso solo al usuario afectado | ED-10 | 3 | 10 | web | E | Sin lenguaje alarmista innecesario | OK |
| REQ-J09 | Recálculo dirigido, no global | CDEM §20 | 3 | 10 | engine | I | Solo se recalcula lo afectado | OK |

## K · Endurecimiento (Phase 11) — 6

| ID | Requisito | Fuente | Auth | Fase | Módulo | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|---|
| REQ-K01 | Accesibilidad P0 completa | Master §35; Manifest §20 | 1 | 11 | web | E,S | Checklist completo en verde | OK |
| REQ-K02 | Observabilidad separada operacional / aprendizaje | TA §11 | 3 | 11 | infra | S | Logs sin texto libre personal innecesario | OK |
| REQ-K03 | Rate limiting y anti-abuso | Master §44 | 1 | 11 | functions | SEC | Límite verificable por usuario | OK |
| REQ-K04 | Backup y restauración probada | TA §12 | 3 | 11 | infra | M | Restauración ejecutada antes de producción | OK |
| REQ-K05 | Política de borrado de cuenta | CDEM §24 | 3 | 11 | db | I | Cascada/anonimización documentada y aplicada | OK |
| REQ-K06 | Todos los gates del Master §49 en verde | Master §49 | 1 | 11 | todas | todas | Checkpoint final PASS | OK |

---

## Resumen de cobertura (recontado programáticamente)

| Métrica | Valor |
|---|---|
| Requisitos indexados | **123** |
| Con fase asignada | 123 / 123 |
| Con prueba de aceptación asignada | 123 / 123 |
| Con nivel de autoridad (`Auth`) | 123 / 123 |
| Bloqueados por decisión abierta | 5 · REQ-B13, B14, D11, F08, G07 |
| Bloqueados por entrada ausente | 1 · REQ-B15 → MI-01 |
| Afectados por contradicción, no bloqueados | 10 · B06, C06, C08, C14, F02, F12, G03, G09, I12, E07(resuelto por autoridad) |

**Nota de alcance (obligatoria):** ninguno de estos 123 requisitos es diferible. El *validation slice* IV.7/I.7 acota **sobre qué contenido** se ejercitan, no **qué requisitos** entran en el MVP TAI. Ver `deferred-requirements.md` §0.
