# STUDY OS · SPEC_DIFF_LOG.md

**Propósito:** registrar los cambios que la implementación exige sobre las especificaciones gobernantes. Nada evoluciona en silencio.
**Regla:** un cambio que contradiga una especificación gobernante requiere ADR **y** cambio de especificación versionado, con aprobación humana.

**Versión:** 1.2 · patch correctivo (añadida SD-015)
**Estado de todas las entradas:** `PROPOSED` · ninguna aplicada.

---

## SD-001 · Entidades de convocatoria, modelo y ocurrencia

**Documento afectado:** `Canonical Data & Event Model v1.0` §6
**Origen:** C-02 · BD-05 · ADR-005
**Cambio propuesto:** añadir `exam_sittings` y `exam_occurrences`; `answer_key_versions` incorpora `model` como metadato de procedencia.
**Justificación:** el corpus oficial (270 preguntas canónicas, 405 ocurrencias, 30 preguntas de reserva) no es representable con el modelo actual, y la decisión CORP-001 (FROZEN) exige explícitamente una entidad de ocurrencia.
**Evidencia:** verificado que la letra correcta no diverge entre modelos A y B en ninguna de las 270 preguntas.
**Impacto:** migración 5. Debe aplicarse **antes** de la primera carga de corpus.
**Aprobación:** pendiente.

## SD-002 · Identidad estable de concepto entre versiones de pack

**Documento afectado:** `Canonical Data & Event Model v1.0` §4, §14
**Origen:** C-03 · BD-02
**Cambio propuesto:** separar identidad pedagógica estable (`concept_key` por linaje de pack) de la fila versionada del sílabo; `concept_mastery` se indexa por la identidad estable.
**Justificación:** con conceptos por versión, la publicación de una nueva convocatoria deja huérfano el historial de dominio, contradiciendo EC-006 y el gate "actualizar contenido no destruye historial".
**Impacto:** migración 3. Es la decisión de esquema más difícil de revertir del proyecto.
**Aprobación:** pendiente.

## SD-003 · Respuesta en blanco y política de puntuación oficial

**Documentos afectados:** `Canonical Data & Event Model v1.0` §12; `Master Product Specification` §20
**Origen:** C-04 · BD-06
**Cambio propuesto:** (a) declarar `selected_option_id NULL` como intento válido y explícito (blanco); (b) añadir `simulation_runs`; (c) añadir `scoring_policy` versionada por `exam_pack_version` (formato 80+20, 120 min, 0–50 por parte con mínimo 25, error −1/3, blanco 0).
**Justificación:** el formato oficial está verificado contra el BOE en `Knowledge Engine v0.2`, es P0 según Master §20 y §47, y no tiene representación en el modelo. Sin él, el simulacro degenera en un test largo y la evidencia de readiness se calcula sobre un examen que no es el real.
**Impacto:** Phase 6. Prerrequisito del Risk Engine (diferido a P1).
**Aprobación:** pendiente.

## SD-004 · Eventos adicionales en la taxonomía P0

**Documento afectado:** `Canonical Data & Event Model v1.0` §11
**Origen:** C-11 · ADR-002
**Cambio propuesto:** añadir `REVIEW_COMPLETED`, `SESSION_IDLE_PAUSED`, `ERROR_REASON_CORRECTED_BY_USER`.
**Justificación:** son requeridos por `Pre-Build Closure v0.6` (SC-08, AT-04, AT-14) y por el cálculo de retención/estabilidad. Cambio aditivo y compatible mediante `schema_version`.
**Impacto:** Phases 2–3. Bajo.
**Aprobación:** pendiente.

## SD-005 · Enlace de intentos de diagnóstico

**Documento afectado:** `Canonical Data & Event Model v1.0` §12–§13
**Origen:** C-14
**Cambio propuesto:** `question_attempts.diagnostic_run_id` nullable con FK.
**Justificación:** §13 afirma que el diagnóstico usa `question_attempts` "con contexto de diagnóstico", contexto que no está definido en ningún campo.
**Impacto:** migración 9. Trivial.
**Aprobación:** pendiente.

## SD-006 · Integridad de referencias polimórficas

**Documento afectado:** `Canonical Data & Event Model v1.0` §9, §17, §23
**Origen:** C-15 · ADR-002
**Cambio propuesto:** sustituir `item_ref_id` polimórfico por columnas nullable con FK real y CHECK de exclusividad en `session_items` y `planner_items`.
**Justificación:** §23 exige que la base garantice el invariante "un planner item referencia un objetivo válido"; con una referencia polimórfica no es posible.
**Impacto:** migraciones 7 y 11. Debe decidirse antes de la primera carga real.
**Aprobación:** pendiente.

## SD-007 · Exclusión explícita de las claves de respuesta del Data API

**Documentos afectados:** `Canonical Data & Event Model v1.0` §22; `Technical Architecture v1.0` §5.3–§5.4
**Origen:** C-13 · INV-101 · ADR-001
**Cambio propuesto:** la matriz RLS debe distinguir "contenido canónico legible" de "clave de corrección no expuesta". `answer_key_versions` y cualquier marca de corrección salen del esquema expuesto; la corrección ocurre en servidor.
**Justificación:** la lectura literal de la matriz actual permitiría a un cliente autenticado leer la respuesta correcta antes de responder, invalidando CHECK, PRÁCTICO y simulacro sin producir ningún error visible.
**Impacto:** Phases 1, 2, 5, 6. Alto si se descubre tarde.
**Aprobación:** pendiente. **Recomendación: prioritaria.**

## SD-008 · Escala de confianza

**Documentos afectados:** `Design System v1.0` §6; Hi-Fi LEARN/CHECK y PRÁCTICO
**Origen:** C-05 · BD-03
**Cambio propuesto:** fijar **4 niveles** con las etiquetas de `Screen Design Spec` 04_CHECK; persistir `confidence_scale_version`. Corregir los Hi-Fi que muestran 1–5.
**Justificación:** el Design System es ambiguo en su propio texto ("cuatro/cinco"); todos los contratos de dominio usan 1–4; la escala alimenta calibración y no puede cambiarse tras acumular evidencia.
**Impacto:** Phases 3 y 5.
**Aprobación:** pendiente.

## SD-009 · Alineación del orden de autoridad en CLAUDE.md

**Documento afectado:** `CLAUDE.md`
**Origen:** C-18
**Cambio propuesto:** actualizar la sección "Authority order" para incluir la Engineering Constitution en el nivel 2 y el Builder Handoff Manifest en el nivel 4, conforme al `Source of Truth Index v1.1` §1.
**Justificación:** el agente y el índice de fuentes discrepan hoy sobre quién manda. Es un defecto de gobierno, no de producto.
**Impacto:** documental. Inmediato.
**Aprobación:** pendiente.

## SD-010 · Correcciones de referencias visuales aprobadas

**Documentos afectados:** Hi-Fi HOY, SESSION END/PROGRESS/PLAN, LEARN/CHECK, PRÁCTICO
**Origen:** C-06
**Cambio propuesto:** eliminar confeti y trofeo de SESSION END; reducir HOY a jerarquía SD-01; etiquetar o retirar el "nivel global"; eliminar la tarjeta motivacional; sustituir el icono de robot del Tutor; retirar el acceso "Resúmenes"; sustituir porcentajes exactos por bandas bajo umbral de evidencia.
**Justificación:** son violaciones directas de Master §22, §37 y Design System §15, resueltas de forma inequívoca por la jerarquía de autoridad (Manifest §C).
**Impacto:** Phases 5 y 7. Conviene decidirlo antes de implementar, no después.
**Aprobación:** pendiente.

## SD-011 · Renombrado del Source of Truth Index

**Documento afectado:** `STUDY_OS___Source_of_Truth_Index_v1_0.pdf`
**Origen:** C-20
**Cambio propuesto:** renombrar a `STUDY_OS_Source_of_Truth_Index_v1.1.pdf` conforme a la política de nombrado del Manifest §21.
**Impacto:** documental.
**Aprobación:** pendiente.

## SD-012 · Estado del mapping concepto↔pregunta

**Documento afectado:** `TAI_STUDY_OS_Official_Mapping_Practical_v1.1` 00_Overview
**Origen:** C-07
**Cambio propuesto:** cambiar `Concept mapping` de `PEDAGOGICAL v1 · validated` a `PENDING_REVALIDATION`, y registrar en `07_Findings` la evidencia de 40 asignaciones erróneas verificadas.
**Justificación:** el estado declarado no se corresponde con el contenido del fichero. Mantenerlo como validado llevaría a sembrar `question_concepts` con datos incorrectos (R-01).
**Impacto:** Phase 1 (contenido). Alto.
**Aprobación:** pendiente.

---

## SD-013 · Gobierno de `engine_config`

**Documentos afectados:** `Technical Architecture v1.0` §6.1; `Canonical Data & Event Model v1.0` §14
**Origen:** ADR-003 v1.1; OBS-01; revisión de Product/Architecture punto 13
**Cambio propuesto:** añadir `engine_config` como entidad de primer nivel con: versión identificable, **inmutabilidad por versión publicada** (trigger que rechaza UPDATE/DELETE), validación de esquema y rangos antes de aceptar, estados `DRAFT → ACTIVE → SUPERSEDED` con promoción explícita y registrada, aprobación humana obligatoria cuando cambia semántica de motor, y ausencia de grants de escritura para el rol de aplicación.
**Justificación:** la v1.0 decía «recalibrar no exige despliegue» sin definir control, lo que habilita *tuning* silencioso en producción y rompe de facto EC-006, porque dos proyecciones idénticas podrían proceder de parámetros distintos sin traza.
**Impacto:** Phase 3. Medio.
**Aprobación:** pendiente.

## SD-014 · Separación formal entre validation slice y alcance del MVP

**Documentos afectados:** `Functional Closure & MVP Scope v0.1` §10; `Master Product Specification v1.0` §47
**Origen:** revisión de Product/Architecture punto 15; C-01, C-22
**Cambio propuesto:** declarar explícitamente que (a) el *validation slice* IV.7/I.7 acota **contenido**, no requisitos; (b) el banco oficial de preguntas es P0 no diferible; (c) el material GENERATED solo puede usarse como *fixture* o vertical provisional etiquetado y no cuenta como cobertura de banco oficial; (d) sacar un requisito P0 del MVP exige `SPEC_DIFF` aprobado sobre el Master.
**Justificación:** la v1.0 de `deferred-requirements.md` difería de hecho ENTRENAR con banco oficial (DEF-18), que es P0. Un diferimiento implícito de alcance es exactamente el tipo de erosión silenciosa que EC-019 prohíbe.
**Impacto:** documental y de alcance. Alto en gobierno.
**Aprobación:** pendiente.

---

## SD-015 · Orden total de eventos y watermark operativo

**Documentos afectados:** `Canonical Data & Event Model v1.0` §10, §14, §16, §25, §27
**Origen:** C-26; ADR-002 v1.2; revisión de Product/Architecture punto 8
**Cambio propuesto:**
1. añadir `learning_events.server_sequence BIGINT NOT NULL`, asignado por secuencia de base de datos al aceptar el evento, como clave de **orden total**;
2. definir **`event_watermark` = valor de `server_sequence`** consumido por la proyección, con regla de **avance sin huecos** (solo hasta el mayor `server_sequence` contiguo confirmado);
3. reclasificar `server_received_at` como timestamp de auditoría, no como clave de orden;
4. añadir índice `learning_events(server_sequence)` y, para proyecciones por usuario, `learning_events(user_id, server_sequence)`.

**Justificación:** `server_received_at` no produce un orden total determinista (empates, ajustes de reloj, llegada tardía de eventos offline) y `event_watermark` no tenía definición operativa. Sin ambas cosas, **EC-006 (reconstruibilidad) no es verificable**: dos rebuilds podrían diferir sin que nadie pudiera demostrarlo.

**Riesgo cubierto explícitamente:** una secuencia de PostgreSQL puede confirmarse fuera de orden; sin la regla de avance sin huecos, un evento confirmado tarde quedaría por debajo del watermark y no se procesaría nunca (pérdida silenciosa de evidencia).

**Impacto:** migración 8 (event stream) y 16 (índices). Debe aplicarse **antes** de ingerir evidencia real.
**Pruebas asociadas:** `rebuild.deterministicOrder.spec`, `watermark.noGapSkip.spec`.
**Estado:** **PROPOSED · no aplicado.**
**Aprobación:** pendiente.

---

## Resumen

| Prioridad | Entradas |
|---|---|
| Antes de ingerir evidencia real | **SD-015** |
| Antes de la primera migración de contenido | SD-001, SD-002, SD-006, SD-007 |
| Antes de Phase 3 | SD-013 |
| Antes de Phase 5 | SD-008, SD-010 |
| Antes de Phase 6 | SD-003 |
| Aditivas, bajo riesgo | SD-004, SD-005 |
| Documentales y de gobierno | SD-009, SD-011, SD-012, SD-014 |

**Total: 15 entradas.**

---

# Adenda de Phase 0 · entradas añadidas tras el congelado de v1.2

**Regla de esta adenda.** El cuerpo v1.2 de arriba queda **intacto**. Las entradas nuevas se
**añaden** aquí, sin renumerar ni desplazar nada existente, y sin reescribir el paquete
congelado. `SD-016` recoge una decisión humana explícita de arranque de Phase 0; `SD-017`
recoge un hallazgo del preflight. Ambas conservan el estado `PROPOSED` que rige en este log:
**ninguna entrada de este documento está aplicada por el hecho de estar escrita**.

**Fecha de la adenda:** 2026-08-23 · **Rama:** `phase/0-foundation`

---

## ERRATA · P0-IN-1 cita la versión equivocada

**Documento afectado:** `docs/PHASE_0_EXECUTION_PLAN.md` §1, fila `P0-IN-1`.
**Texto congelado:** «Aprobación humana de los outputs de Phase −1 (**v1.1**)».
**Hecho:** la versión aprobada por Ana y efectivamente entregada como entrada de Phase 0 es
**v1.2** (`STUDY_OS_Phase_Minus_1_v1_2`, 123 requisitos, `REQ-C15` restaurado, `REQ-C16`
aceptado). La referencia a v1.1 es un residuo del patch anterior.

**Consecuencia si no se corrige:** la precondición de entrada de Phase 0 apuntaría a un
paquete que la propia v1.2 declara defectuoso —es la versión que eliminó en silencio
`REQ-C15`—, lo que reintroduciría por la puerta de atrás justo el defecto que v1.2 reparó.

**Corrección propuesta:** `P0-IN-1` debe leer «Aprobación humana de los outputs de Phase −1
(**v1.2**)».
**Impacto:** documental. Nulo sobre esquema, código o tests.
**Estado:** **PROPOSED · no aplicado.** El fichero congelado no se ha editado.
**Aprobación:** pendiente.

---

## SD-016 · Identidad verificada en servidor como única autoridad de auth (INV-116)

**Documentos afectados:** `spec/invariant-register.md` §2 (alta de `INV-116`);
`Technical Architecture v1.0` §5.2–§5.4; `spec/requirement-index.md` (`REQ-A07`, por
vinculación, **sin renumerar ni desplazar ningún requisito**).
**Origen:** decisión humana explícita en la autorización de Phase 0 (2026-08-23).
**Relación:** refuerza `EC-009`, `EC-010` e `INV-113`; ancla de enforcement en `REQ-A07`.

### Invariante propuesto

> **INV-116.** Las decisiones de autenticación y autorización en rutas, Server Actions y Route
> Handlers protegidos deben basarse en una identidad verificada en servidor. Con Supabase SSR
> se utilizará `auth.getClaims()` para validar el token y proteger páginas/datos, o
> `auth.getUser()` cuando sea necesaria una consulta actualizada al servidor de Auth.
> `getSession()`, una cookie o una sesión local sin verificación nunca constituyen autoridad
> suficiente.

**Justificación.** `getSession()` devuelve lo que hay en el almacenamiento del cliente o en la
cookie **sin comprobar la firma del token**. Un atacante que controle la cookie puede fabricar
un objeto de sesión con el `user_id` que quiera. Si una ruta protegida decide en función de ese
valor, la frontera de autorización se evalúa sobre un dato suministrado por el atacante — que es
exactamente la línea roja de `Manifest §14` («trust user-supplied `user_id` without auth
context»). RLS sigue protegiendo la base de datos, pero la capa de aplicación dejaría de ser un
control y pasaría a ser decoración, y cualquier lógica de servidor que no atraviese RLS
—Edge Functions, Route Handlers con rol de servicio, la futura frontera de corrección de
`INV-101`— quedaría sin defensa.

### Enforcement mínimo exigido

| # | Control | Mecanismo |
|---|---|---|
| 1 | `test auth.serverVerifiedIdentity.spec` | Toda superficie protegida deriva la identidad de una verificación en servidor |
| 2 | Rechazo de cookie o sesión manipulada | Test negativo: cookie de sesión forjada/alterada ⇒ acceso denegado, nunca identidad aceptada |
| 3 | Prohibición de `getSession()` como única autorización | Regla de lint/guarda de repositorio que falla si `getSession()` decide acceso sin verificación adyacente |
| 4 | Vinculación con `REQ-A07` | `REQ-A07` («Auth con perfil separado de la identidad de auth») incorpora `INV-116` como condición de aceptación |
| 5 | Estabilidad de IDs | **Sin renumerar ni desplazar requisitos existentes.** `INV-116` es alta en el registro de invariantes; `REQ-A07` conserva su ID y su posición |

**Impacto:** Phase 0 (esqueleto de auth) y todas las fases posteriores con superficie
protegida. No toca esquema de dominio. No introduce dependencia nueva.
**Pruebas asociadas:** `auth.serverVerifiedIdentity.spec`, `auth.forgedCookieRejected.spec`,
guarda `no-getsession-authority`.
**Estado:** **PROPOSED · registrado por decisión humana; enforcement implementado en Phase 0.**
**Aprobación:** aprobado por Ana en la autorización de Phase 0 en cuanto a *contenido*;
la promoción formal del registro de invariantes se consolida al cerrar el checkpoint.

---

## SD-017 · Corrección de la naturaleza real de los documentos gobernantes (AMB-01)

**Documento afectado:** `spec/authority-map.md` §0a y §2.
**Origen:** preflight de Phase 0 sobre `_handoff/originals/`.

**Texto congelado:** «Los ocho documentos gobernantes llegan al entorno de proyecto con
extensión `.pdf`, pero su contenido real es un **archivo ZIP de imágenes de página**
(`1.jpeg`, `2.jpeg`, …), no un PDF ni un OOXML».

**Hecho verificado.** Contra los originales disponibles, esa afirmación es falsa para los cinco
documentos presentes:

| Documento | Extensión de origen | Contenido real |
|---|---|---|
| Master Product Specification v1.0 | `.pdf` | PDF 1.4 · 31 págs · texto con `ToUnicode` · 0 `/Subtype /Image` · 0 `/DCTDecode` |
| Canonical Data & Event Model v1.0 | `.pdf` | PDF 1.4 · 25 págs · texto · 0 imágenes |
| Builder Handoff Manifest v1.0 | `.pdf` | PDF 1.4 · 19 págs · texto · 0 imágenes |
| Technical Architecture v1.0 | `.docx` | OOXML · `word/document.xml` (177 KB) |
| Source of Truth Index v1.0 | `.docx` | OOXML · `word/document.xml` (65 KB) |

Método: inspección de cabeceras (`%PDF-1.4`, `PK\x03\x04`), recuento de objetos de página y de
imagen, y extracción efectiva de texto. Hashes en `docs/PROVENANCE.md` §3.

**Cambio propuesto:**
1. sustituir la afirmación «ZIP de imágenes de página» por la naturaleza verificada de cada
   documento;
2. pasar `original_filename` de `UNVERIFIED` a confirmado en las cinco filas correspondientes;
3. reducir el alcance de **AMB-01** a los **tres** documentos que siguen sin verificar por
   estar ausentes de los originales: `Functional Closure / MVP Scope v0.1`,
   `Design System v1.0`, `Onboarding & Edge States Visual Spec v1.0`;
4. registrar `STUDY_OS_Founder_Portfolio_Master_Context_v0.1.md`, presente en los originales y
   **ausente del authority-map**, asignándole nivel de autoridad (propuesta: 7 · material
   exploratorio, salvo criterio contrario de Ana).

**Justificación.** La afirmación congelada motivó una convención de tres columnas construida
sobre una premisa incorrecta y sostiene doce pasos de la auditoría de Drive (`Manifest §23`).
Mantenerla haría planificar una reconversión de imágenes que no hace falta, y dejaría marcados
como no verificables documentos que sí lo son.

**Impacto:** documental y de auditoría. Nulo sobre esquema, código o tests.
**Estado:** **PROPOSED · no aplicado.** `spec/authority-map.md` se ha importado byte a byte
y no se ha editado.
**Aprobación:** pendiente.

---

## Resumen de la adenda

| Prioridad | Entradas |
|---|---|
| Enforcement en Phase 0 | **SD-016** (`INV-116`) |
| Documentales · antes de la auditoría de Drive | SD-017, ERRATA P0-IN-1 |

**Total tras la adenda: 17 entradas SPEC_DIFF (15 congeladas + SD-016 + SD-017) y 1 errata.**

> El «Total: 15 entradas» de la sección anterior es correcto **para el cuerpo congelado v1.2** y
> se conserva sin tocar deliberadamente: renumerarlo sería justamente la reescritura silenciosa
> que `EC-019` prohíbe.

---

## SD-018 · Orden total de eventos por usuario · **sustituye a SD-015**

**Documentos afectados:** `Canonical Data & Event Model v1.0` §10, §14, §16, §25, §27.
**Sustituye a:** `SD-015`, que queda **superseded** y no debe implementarse en su forma
anterior. SD-015 permanece en el cuerpo congelado sin tocar; esta entrada es la que
gobierna a partir de ahora.
**Origen:** revisión humana de la autorización de Phase 0 y auditoría externa del
checkpoint.
**Estado:** **PROPOSED · no implementado.** No existe ninguna migración de eventos ni
ninguna tabla `learning_events` en el repositorio.

### Por qué SD-015 no sirve

SD-015 proponía una **secuencia global** (`learning_events.server_sequence` asignada por
una secuencia de PostgreSQL) más una regla de «avance sin huecos» del watermark. Tiene dos
defectos que no se arreglan ajustando la redacción:

1. **Una secuencia de PostgreSQL no es transaccional.** `nextval()` no se revierte con la
   transacción y las confirmaciones pueden ocurrir fuera de orden. La propia SD-015 lo
   reconocía e intentaba compensarlo con la regla de avance sin huecos, que convierte cada
   hueco temporal en un bloqueo del avance de **todas** las proyecciones.
2. **El orden global es la unidad equivocada.** La evidencia de una persona no tiene por
   qué esperar a la de otra. Un orden global acopla usuarios que no comparten nada y
   convierte un hueco de cualquiera en una parada de todos.

### Cambio propuesto

1. **Posición monotónica por usuario/stream.** `learning_events.stream_position BIGINT NOT
   NULL`, monotónica y sin huecos **dentro del stream de cada usuario**. No hay orden
   global y no se necesita.
2. **Asignación bajo bloqueo transaccional, en la misma transacción que inserta el
   evento.** Un contador por usuario (`user_event_counters(user_id, next_position)`) se
   bloquea con `SELECT ... FOR UPDATE`, se incrementa y se usa, todo dentro de la
   transacción que hace el `INSERT`. Si la transacción se revierte, la posición se
   revierte con ella. Esto elimina por construcción los huecos que SD-015 tenía que
   gestionar a posteriori.
3. **`unique(user_id, stream_position)`.** La unicidad la garantiza la base de datos, no
   una convención.
4. **`event_id` sigue siendo la única clave de idempotencia.** UUID generado en cliente,
   `UNIQUE`, con `ON CONFLICT DO NOTHING`. Reenviar el mismo evento no crea una posición
   nueva. Orden e idempotencia son problemas distintos y se resuelven con claves distintas.
5. **Watermark por usuario y por proyección.** `projection_watermarks(user_id,
   projection_name, consumed_position)`. Cada proyección avanza al ritmo de cada usuario.
   Un usuario con evidencia pendiente no detiene las proyecciones de los demás, y una
   proyección lenta no detiene a las otras.
6. **`client_created_at` conserva la semántica temporal del hecho.** Es la referencia que
   usa la lógica del motor —cuándo ocurrió— frente a `stream_position`, que solo ordena.
   `server_received_at` queda como dato de auditoría.
7. **Ninguna inferencia de ausencia definitiva mediante *timeout*.** Que un evento no haya
   llegado no permite concluir que no existe. Un dispositivo sin conexión puede entregar
   evidencia días después: se acepta, obtiene la siguiente posición de su stream, conserva
   su `client_created_at` y dispara recálculo desde el watermark afectado. **Nada se marca
   como definitivamente ausente porque haya pasado un tiempo.**

### Consecuencias

**Positivas:** el orden es reconstruible y verificable por usuario, sin huecos por
construcción; EC-006 pasa a ser demostrable; el aislamiento entre usuarios que RLS ya da a
nivel de fila se extiende al procesamiento.

**Negativas:** el contador por usuario es un punto de serialización por usuario. Es
aceptable: la evidencia de una persona es intrínsecamente secuencial y su volumen es bajo.
A cambio desaparece la serialización global que SD-015 imponía.

**Lo que ya no se puede hacer:** ordenar entre sí los eventos de dos usuarios distintos sin
un criterio adicional explícito. Ninguna proyección de Phase 0 a Phase 9 lo necesita; si
alguna lo necesitara, exigiría su propio ADR.

### Pruebas asociadas

- `events.streamPositionMonotonic.spec` · las posiciones de un usuario son consecutivas
- `events.noGapsUnderRollback.spec` · una transacción revertida no deja hueco
- `events.idempotentByEventId.spec` · el mismo `event_id` no crea posición nueva
- `events.concurrentInsertSerialized.spec` · dos inserciones simultáneas del mismo usuario
  no comparten posición
- `watermark.perUserPerProjection.spec` · un usuario atrasado no bloquea a otro
- `events.lateArrivalNoTimeout.spec` · un evento antiguo recibido tarde se acepta y no
  reordena la historia
- `rebuild.deterministicOrder.spec` · dos reconstrucciones producen el mismo orden

### Impacto

Migración 8 (stream de eventos) y 16 (índices). Debe aplicarse **antes de ingerir
cualquier evidencia real**.

**Aprobación:** pendiente.

---

## SD-019 · La paleta congelada no alcanza el AA que el propio documento exige

**Documento afectado:** `STUDY_OS_Design_System_v1.0` §2 (Core tokens · Colour) frente a
§14 (Accessibility).
**Origen:** verificación de contraste al incorporar el Design System, ronda correctiva.
**Estado:** **PROPOSED en cuanto al cambio de especificación** · la **opción A queda
AUTORIZADA para Phase 0** por decisión humana de 2026-08-23. Ningún color se ha
modificado.

### El conflicto

§14 exige «WCAG-minded AA contrast» como requisito **P0**. El criterio de aceptación de
`REQ-A06` lo repite: «Tokens conformes; **contraste AA verificado**».

Tres combinaciones de la paleta de §2 no alcanzan el 4.5:1 de texto normal. Medido sobre
los valores literales del documento:

| Combinación | Ratio | Falta |
| --- | --- | --- |
| Soft White `#FFFDF9` sobre Adaptive/Teal `#2B8C8C` | **3.95** | −0.55 |
| Soft White `#FFFDF9` sobre Warning/Amber `#A56A18` | **4.42** | −0.08 |
| Muted/Slate `#66757C` sobre Canvas/Warm Ivory `#F7F3EA` | **4.31** | −0.19 |

Las tres superan el 3:1 que WCAG 1.4.11 pide para componentes de interfaz y contornos, así
que sirven como indicador, borde o icono. Ninguna sirve para texto normal.

El tercer caso es el más incómodo en la práctica: `Muted / Slate` es el color de texto
secundario y `Canvas / Warm Ivory` es el fondo de página. Sobre `Surface / Soft White` sí
llega (4.70), de modo que la restricción es de superficie, no del color.

### Qué se ha hecho mientras tanto

**No se ha retocado ningún color.** Alterar un valor de un documento FROZEN sin ADR es
exactamente lo que EC-019 prohíbe.

- `teal` y `amber` se declaran en `NON_TEXT_BACKGROUNDS`: su uso queda acotado a
  superficies no textuales;
- el texto secundario se sitúa sobre `surface`, no sobre `canvas`;
- `tokens.contrast.spec` fija los tres números medidos, de modo que si alguien cambia un
  color la contradicción no cambia de forma en silencio;
- **`REQ-A06` y `P0-S7` quedan BLOQUEADOS**, porque el criterio de aceptación no se cumple
  entero.

### Opciones para la decisión humana

| Opción | Qué implica |
| --- | --- |
| **A · Acotar el uso** (lo implementado) | `teal` y `amber` nunca llevan texto; el texto secundario vive sobre `surface`. Cero cambios en el documento. Limita las composiciones disponibles |
| **B · Oscurecer los tres colores** lo justo para alcanzar 4.5 | Exige ADR y una v1.1 del Design System. Cambia la identidad visual, poco pero la cambia |
| **C · Declarar en §14 que AA aplica al texto** y que estos tres son colores de indicador | Exige cambio de especificación. Es la opción que menos toca, si la intención original era esa |

### Decisión: **opción A, autorizada para Phase 0**

Términos exactos de la autorización:

- no modificar ningún color congelado;
- `teal` y `amber` no pueden contener texto normal;
- `slate` solo puede utilizarse como texto normal sobre `surface`;
- sobre `canvas`, utilizar `ink` o colocar el texto dentro de una superficie válida.

### Qué se implementó

| Superficie | Antes | Ahora |
| --- | --- | --- |
| `/` | Texto secundario `slate` sobre `canvas` · 4.31:1 | Dentro de `.so-panel` (`surface`) · 4.70:1 |
| `/offline` | Ídem | Ídem |
| `/entrar` · `/registro` · `/cuenta` | Enlaces en línea sin diana táctil | `.so-action`, 44×44 px reales |
| Campos de formulario | Fondo y color heredados del navegador | `surface` e `ink` explícitos, medibles |

`slate` sigue usándose como **borde**, donde el mínimo es 3:1 y lo cumple sobradamente.

### Evidencia ejecutada, no declarada

`tests/e2e/static/accessibility.a11y.spec.ts` recorre el DOM del build de producción en
móvil y escritorio, lee el **color computado real** de cada texto visible y su **fondo
efectivo** —subiendo por los ancestros hasta el primero no transparente— y calcula el
contraste sobre esos valores. Exige 4.5:1, y 3:1 solo cuando el texto es grande según
WCAG (≥24px, o ≥18.66px en negrita). Las dianas táctiles se miden con `boundingBox()`.

**Resultado: 34/34 en verde**, 17 casos × 2 proyectos.

Y se comprobó que detecta la regresión que dice detectar: al reintroducir
deliberadamente `slate` sobre `canvas` y un enlace en línea, la prueba falló con
«4.31:1 · exigido 4.5:1» y «slate sobre canvas da 4.31:1 · SD-019 opción A lo prohíbe».
Una comprobación que solo pasa no demuestra nada.

### Qué sigue abierto

La opción A **acota el uso**; no resuelve la contradicción entre §2 y §14. Elegir entre
**B** (oscurecer los tres colores, con ADR y v1.1 del Design System) y **C** (declarar en
§14 que el AA aplica al texto y que estos tres son colores de indicador) sigue pendiente y
debe decidirse **antes de Phase 5**, que es cuando existirán componentes que usen estos
colores con texto encima.

Por eso **REQ-A06 y P0-S7 siguen BLOQUEADOS**: el criterio de aceptación dice «contraste
AA verificado», y lo verificado es que tres combinaciones de la paleta no lo alcanzan.

**Aprobación:** opción A autorizada para Phase 0. Cambio de especificación (B o C):
pendiente.

---

## Resumen de la adenda · actualizado

| Prioridad | Entradas |
| --- | --- |
| Enforcement en Phase 0 | **SD-016** (`INV-116`) |
| Antes de ingerir evidencia real | **SD-018** (sustituye a SD-015) |
| Antes de Phase 5 | **SD-019** (contraste de la paleta) |
| Documentales · antes de la auditoría de Drive | SD-017, ERRATA P0-IN-1 |

**Total tras la adenda: 19 entradas SPEC_DIFF (15 congeladas + SD-016 … SD-019) y 1
errata.** `SD-015` queda **superseded por SD-018** sin haberse modificado en el cuerpo
congelado.

---

## SD-018 · **corrección del contrato** · orden e idempotencia en la misma transacción

**Corrige a:** la redacción de SD-018 publicada arriba, que sigue siendo válida en su
estructura pero describía mal la interacción entre el contador de posición y la clave de
idempotencia. Esta sección **sustituye** los puntos 2 y 4 de aquella redacción.

**Estado:** **PROPOSED · NO IMPLEMENTADO.** No existe ninguna migración de eventos, ninguna
tabla `learning_events`, ningún contador y ninguna función. Nada de esto está cerrado ni
aprobado: exige decisión humana explícita.

### Qué estaba mal

La redacción anterior decía «`ON CONFLICT DO NOTHING` en ambos niveles». Combinado con un
contador que se incrementa antes de insertar, eso produce dos defectos:

1. **Huecos en el stream.** Si se reserva la posición y después el `INSERT` no hace nada
   por conflicto de `event_id`, el contador ya avanzó. La posición reservada se pierde y el
   stream deja de ser contiguo — justo la propiedad que SD-018 existe para garantizar, y de
   la que depende el avance del watermark.
2. **Éxito idempotente falso.** `ON CONFLICT DO NOTHING` no distingue «este evento ya
   estaba, idéntico» de «alguien reutilizó un `event_id` con otro usuario o con otro
   contenido». El segundo caso es un **conflicto de integridad** y debe fallar ruidosamente;
   tratarlo como idempotencia acepta en silencio una suplantación o una corrupción.

### Orden correcto de las operaciones

Todo dentro de **una sola transacción**:

1. **Bloquear el contador del usuario/stream.**
   `SELECT next_position FROM user_event_counters WHERE user_id = $1 FOR UPDATE`.
   Si no hay fila, se inserta con `next_position = 1` y se bloquea. Esto serializa las
   inserciones concurrentes de ese usuario, y solo de ese usuario.

2. **Después del bloqueo, comprobar `event_id`.**
   `SELECT user_id, payload_hash, stream_position FROM learning_events WHERE event_id = $2`.
   El orden importa: comprobar antes del bloqueo abre una ventana en la que dos
   transacciones concurrentes ven «no existe» y ambas siguen adelante.

3. **Si ya existe:**
   - verificar que el `user_id` coincide **y** que el payload coincide por hash canónico;
   - si coinciden, **devolver el evento existente y no incrementar el contador**. Es el
     mismo hecho reenviado: idempotencia real;
   - si **no** coinciden, **abortar con conflicto de integridad**. Mismo `event_id` con
     distinto usuario o distinto contenido no es un reintento: es un error o un intento de
     suplantación. Nunca se reporta como éxito idempotente.

4. **Si no existe:** reservar la posición (`next_position`), incrementar el contador e
   insertar el evento con esa posición, **en la misma transacción**.

5. **Nada de `ON CONFLICT DO NOTHING` después de incrementar.** Ya no hace falta: el
   bloqueo del paso 1 y la comprobación del paso 2 cubren la concurrencia. Y si se dejara,
   volvería a producir el hueco del defecto 1.

6. **Cualquier conflicto único inesperado aborta y revierte la transacción entera**,
   incluido el incremento del contador. Es la propiedad que hace que no haya huecos: la
   posición vive y muere con la transacción que la usa.

7. **Tras el rollback puede recuperarse el evento existente y validarse** con el mismo
   criterio del paso 3, en una transacción nueva. Un reintento legítimo termina devolviendo
   el evento original; uno ilegítimo termina en conflicto de integridad.

### El mismo principio para `question_attempts`

`ADR-002` fija `submitted_event_id` como mecanismo principal de deduplicación del intento y
`attempt_number` como contador derivado del servidor. Se aplica el mismo orden:

1. bloquear el contador del par `(user_id, question_id)`;
2. comprobar si ya existe un intento con ese `submitted_event_id`;
3. si existe, validar que corresponde al mismo usuario y a la misma pregunta y devolverlo,
   **sin asignar `attempt_number` nuevo**;
4. si no existe, asignar `attempt_number` e insertar, en la misma transacción;
5. sin `ON CONFLICT DO NOTHING` después de asignar.

Asignar `attempt_number` antes de comprobar la idempotencia produce el mismo hueco, y
además hace que un reintento consuma un número de intento que nadie usó — un dato que el
usuario acabaría viendo.

### Pruebas asociadas · ninguna implementada todavía

- `events.lockBeforeIdempotencyCheck.spec` · el bloqueo precede a la comprobación
- `events.duplicateEventIdReturnsExisting.spec` · mismo `event_id` y mismo payload devuelve
  el existente y no incrementa el contador
- `events.conflictingEventIdAborts.spec` · mismo `event_id` con otro usuario o con otro
  payload aborta con conflicto de integridad, no con éxito
- `events.noGapsUnderRollback.spec` · una transacción revertida no deja hueco en el stream
- `events.noOnConflictDoNothing.spec` · la migración no contiene esa cláusula tras el
  incremento
- `attempts.idempotentBeforeAttemptNumber.spec` · el mismo principio en `question_attempts`

### Qué NO se ha hecho

No se ha creado ninguna migración, ninguna tabla, ninguna función ni ningún índice. SD-018
sigue siendo un contrato propuesto. **No debe darse por cerrada ni por aprobada sin decisión
humana explícita.**

**Aprobación:** pendiente.

---

## Estado de la adenda · al cierre de la ronda correctiva final

Sustituye a los dos resúmenes anteriores, que quedaron desfasados al añadirse
`SD-018` y `SD-019` y al autorizarse la opción A de esta última.

| Entrada | Tipo | Estado |
| --- | --- | --- |
| **ERRATA P0-IN-1** | Errata documental | PROPOSED · el fichero congelado no se ha editado |
| **SD-016** · INV-116 | Alta de invariante | Contenido aprobado por Ana · **implementado y verificado** |
| **SD-017** · naturaleza real de los documentos gobernantes | Corrección documental | PROPOSED · `authority-map.md` no se ha editado |
| **SD-018** · orden e idempotencia del stream de eventos | Sustituye a SD-015 | PROPOSED · **no implementado** · corregido en esta ronda |
| **SD-019** · la paleta no alcanza el AA que exige §14 | Contradicción entre §2 y §14 | **Opción A autorizada e implementada** · el cambio de especificación (B o C) sigue PROPOSED |

**Total: 19 entradas SPEC_DIFF** (15 congeladas + SD-016 … SD-019) **y 1 errata.**

`SD-015` queda **superseded por SD-018**. Ninguna de las dos está implementada: no
existe tabla de eventos, ni contador, ni watermark.

El cuerpo congelado v1.2 conserva su hash en las primeras 174 líneas:

```bash
head -174 docs/SPEC_DIFF_LOG.md | sha256sum
# 4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3
```

### Qué sigue necesitando decisión humana

| Decisión | Qué desbloquea |
| --- | --- |
| **SD-019 · elegir entre B y C** | El cierre de `REQ-A06` y `P0-S7`. La opción A acota el uso pero no resuelve la contradicción. Antes de Phase 5 |
| **SD-018 · aprobar el contrato** | Cualquier migración de eventos. Antes de ingerir evidencia real |
| **SD-006 · SD-007** | La forma de las primeras migraciones de dominio |
| **SD-017 · ERRATA** | La auditoría de Drive y la corrección de `authority-map.md` |
| **BD-02 · BD-05** | Migraciones 3 y 5 |
