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
**Estado:** **`ACCEPTED · NOT IMPLEMENTED`** · propietario normativo **ADR-008** · aprobado
por Ana Victoria el 2026-09-07 (`STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md`). Esta
redacción vale en su estructura; sus puntos 2 y 4 quedan sustituidos por la corrección de
más abajo, y ADR-008 consolida el contrato final. No existe ninguna migración de eventos
ni ninguna tabla `learning_events` en el repositorio, y la aceptación no autoriza ninguna.

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

**Aprobación:** `ACCEPTED` · 2026-09-07 · Ana Victoria · propietario normativo ADR-008 ·
**no implementado** y sin migración autorizada.

---

## SD-019 · La paleta congelada no alcanza el AA que el propio documento exige

**Documento afectado:** `STUDY_OS_Design_System_v1.0` §2 (Core tokens · Colour) frente a
§14 (Accessibility).
**Origen:** verificación de contraste al incorporar el Design System, ronda correctiva.
**Estado:** **PROPOSED en cuanto al cambio de especificación** · la **opción A queda
AUTORIZADA para Phase 0** por decisión humana de 2026-08-23, y **aplicada y verificada en
el navegador**. Ningún color se ha modificado. Bajo las restricciones de la opción A,
`REQ-A06` y `P0-S7` **quedan satisfechos para Phase 0**; elegir entre B y C es una
decisión **diferida**, con plazo antes de Phase 5.

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
- bajo esas restricciones, **todo texto renderizado alcanza el contraste que WCAG le
  exige**, que es exactamente lo que pide el criterio de aceptación de `REQ-A06`.

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

**Resultado: 44/44 en verde**, 22 casos × 2 proyectos.

Y demuestra por sí sola que detecta lo que dice detectar. La primera versión de esa
prueba se comprobó a mano —reintroducir el defecto, ver el fallo, restaurar el fichero—,
lo cual demuestra algo una vez y nada la siguiente. Ahora el propio fichero incluye un
**fixture negativo** que se ejecuta en cada pasada: construye una página con `slate`
sobre `canvas`, texto sobre `teal` y sobre `amber` y un control de 24×24, y exige que
las mismas funciones de auditoría encuentren exactamente esos defectos —incluido que el
contraste medido sea 4.31:1, por encima de 3 y por debajo de 4.5—. Lleva además su propio
control: la misma auditoría sobre una página correcta no encuentra nada.

### Qué queda diferido, y por qué no bloquea Phase 0

La opción A **acota el uso**; no resuelve la contradicción entre §2 y §14. Elegir entre
**B** (oscurecer los tres colores, con ADR y v1.1 del Design System) y **C** (declarar en
§14 que el AA aplica al texto y que estos tres son colores de indicador) sigue pendiente y
debe decidirse **antes de Phase 5**, que es cuando existirán componentes que usen estos
colores con texto encima.

**Diferido no es bloqueado, y la distinción no es cosmética.** El criterio de aceptación
de `REQ-A06` es «Tokens conformes; contraste AA verificado». Bajo la opción A los tokens
son los del documento, sin alterar, y el contraste está verificado en el navegador sobre
el build de producción, en móvil y escritorio, con un fixture negativo que demuestra que
la medición no está vacía. El criterio se cumple.

Lo que no se cumple es una propiedad **más fuerte** que nadie exigió en Phase 0: que la
paleta pueda usarse sin restricciones. Esa propiedad la necesitan las 18 familias de
componentes de §16, que empiezan en Phase 5. Presentarla como bloqueo de Phase 0
confundía «hay una decisión pendiente» con «hay un entregable sin hacer», y esa confusión
tiene coste: obliga a repetir en cada checkpoint que algo está bloqueado cuando no lo
está, y desgasta la palabra para cuando haga falta de verdad.

Por eso **`REQ-A06` y `P0-S7` quedan satisfechos para Phase 0 bajo las restricciones de
la opción A**, y la elección entre B y C queda registrada como decisión diferida con
plazo antes de Phase 5.

Las restricciones no son deuda oculta: las hace cumplir la prueba de accesibilidad
renderizada en cada ejecución. Si alguien vuelve a poner `slate` sobre `canvas` o texto
sobre `teal`, la suite falla.

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

**Estado:** **`ACCEPTED · NOT IMPLEMENTED`** · propietario normativo **ADR-008**. No existe
ninguna migración de eventos, ninguna tabla `learning_events`, ningún contador y ninguna
función. La decisión humana explícita llegó el 2026-09-07 con el Human Decision Packet
v1.0; la aceptación **no autoriza** ninguna implementación.

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
3. si existe, aplicar la **triple coincidencia** de la sección siguiente antes de devolver
   nada, **sin asignar `attempt_number` nuevo**;
4. si no existe, asignar `attempt_number` e insertar, en la misma transacción;
5. sin `ON CONFLICT DO NOTHING` después de asignar.

Asignar `attempt_number` antes de comprobar la idempotencia produce el mismo hueco, y
además hace que un reintento consuma un número de intento que nadie usó — un dato que el
usuario acabaría viendo.

### Triple coincidencia · qué convierte un `submitted_event_id` repetido en idempotencia

**Corrige** el punto 3 tal y como estaba redactado más arriba, que solo exigía «mismo
usuario y misma pregunta». Es insuficiente, y de una forma concreta: dos envíos con el
mismo `submitted_event_id`, el mismo usuario y la misma pregunta **pueden llevar respuestas
distintas**. Aceptar el segundo como idempotente devuelve el intento antiguo y descarta en
silencio la respuesta nueva; o, según qué lado se conserve, sobrescribe la evidencia
original. Las dos lecturas son corrupción de evidencia, y ninguna de las dos deja rastro.

Un `submitted_event_id` ya presente **solo** es idempotente si coinciden **las tres** cosas:

1. **el mismo `user_id`**;
2. **la misma `question_id`**;
3. **el mismo payload canónico completo de la respuesta**, comparado por hash canónico
   —`answer_payload_hash`— calculado sobre la forma canonicalizada de todo el payload de
   respuesta, no sobre un resumen ni sobre un subconjunto de campos.

«Completo» significa completo: la opción u opciones elegidas, el texto libre si lo hay, el
orden presentado si la pregunta lo usa, la versión del ítem, la versión de la clave de
respuesta vigente en el envío (EC-007) y cualquier otro campo que forme parte de la
respuesta. Un hash sobre un subconjunto reintroduce el mismo defecto en pequeño: dos
respuestas distintas que coinciden en los campos elegidos volverían a confundirse.

La canonicalización debe estar fijada —orden de claves, normalización de cadenas, tratamiento
de nulos y de colecciones— antes de la primera migración de eventos. Un hash canónico sin
canonicalización fijada no es determinista, y entonces la comparación falla de forma
intermitente en lugar de fallar siempre.

**Si las tres coinciden:** se devuelve el intento existente, con su `attempt_number`
original. No se asigna número nuevo, no se incrementa el contador, no se inserta nada.

**Si difiere cualquiera de las tres:** es un **conflicto de integridad**. La transacción
**aborta y revierte por completo**, incluido el bloqueo y cualquier reserva de
`attempt_number`. El reintento **no consume número de intento**: el siguiente intento
legítimo de ese par usuario/pregunta recibe el número que le tocaba, como si el envío en
conflicto no hubiera existido. Nunca se reporta como éxito idempotente, nunca se devuelve
el intento antiguo como si fuera la respuesta al envío nuevo, y nunca se sobrescribe el
intento original con el payload nuevo.

El error debe distinguir el caso —usuario distinto, pregunta distinta o payload distinto—
porque las consecuencias operativas no son las mismas: un usuario distinto con el mismo
`submitted_event_id` apunta a suplantación o a colisión de identificadores; un payload
distinto apunta a un cliente que reutiliza el identificador entre envíos, que es un defecto
del cliente y hay que corregirlo ahí.

**Simetría con `learning_events`.** Es la misma regla del paso 3 de la sección anterior,
con una columna más: allí se comparan `user_id` y `payload_hash`; aquí, `user_id`,
`question_id` y `answer_payload_hash`. Que las dos reglas sean la misma no es estética:
si divergen, el mismo reenvío puede ser idempotente en un nivel y conflictivo en el otro,
y el estado resultante depende del orden en que se evalúen.

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
- `attempts.tripleMatchRequired.spec` · un `submitted_event_id` repetido solo es idempotente
  si coinciden usuario, pregunta y payload canónico completo
- `attempts.conflictDoesNotConsumeAttemptNumber.spec` · tras un conflicto de integridad, el
  siguiente intento legítimo recibe el número que le tocaba
- `attempts.canonicalHashIsDeterministic.spec` · la canonicalización produce el mismo hash
  para el mismo payload escrito de dos formas equivalentes

### Qué NO se ha hecho

No se ha creado ninguna migración, ninguna tabla, ninguna función ni ningún índice. SD-018
es un contrato **aceptado y no implementado**: la decisión humana explícita consta en el
Human Decision Packet v1.0 y en ADR-008, y **no autoriza ninguna migración**. Antes de la
primera migración de eventos deben existir el contrato de canonicalización versionado y las
suites declaradas arriba.

**Aprobación:** `ACCEPTED` · 2026-09-07 · Ana Victoria · propietario normativo ADR-008 ·
**no implementado** y sin migración autorizada.

---


## Estado de la adenda · tras el Human Decision Packet v1.0 · 2026-09-07

Sustituye a los resúmenes anteriores. Los tres primeros —«Resumen de la adenda»,
«Resumen de la adenda · actualizado» y «Estado de la adenda · al cierre de la ronda
correctiva final»— describen la cronología y ya no gobiernan: son texto histórico.

### Registro de aceptación · decisiones aprobadas el 2026-09-07

**Registro de decisión:** `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · SHA-256
`6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · baseline auditado
`8823c2bdf2d31ec01a2f15b1566a94c1ad0eb04a` · decisora Ana Victoria · revisión técnica
ChatGPT / Codex · **alcance: gobernanza únicamente.** No autoriza migraciones,
implementación de dominio, infraestructura ni Phase 1.

| Entrada | Estado operativo | Propietario normativo | Efecto sobre lo ya escrito |
| --- | --- | --- | --- |
| **SD-001** · BD-05 | `ACCEPTED · NOT IMPLEMENTED` | **ADR-010** | La línea «Aprobación: pendiente» de SD-001 en el cuerpo congelado es histórica · ADR-005 punto 5 superseded |
| **SD-002** · BD-02 | `ACCEPTED · NOT IMPLEMENTED` · modelo de dos capas | **ADR-009** | Ídem para SD-002 |
| **SD-006** | `ACCEPTED · NOT IMPLEMENTED` · aceptado según aclaración | **ADR-007** | Ídem para SD-006 · ADR-002 punto 6 superseded |
| **SD-007** | `ACCEPTED · NOT IMPLEMENTED` · ratifica INV-101 | **ADR-006** | Ídem para SD-007 · ADR-001 punto 3 y ADR-005 punto 4 subordinados |
| **SD-015** | `SUPERSEDED BY SD-018 / ADR-008` · no operativo | — | Su `server_sequence` global y su watermark «sin huecos» no se implementan; ADR-002 punto 10 superseded |
| **SD-018** · con su corrección | `ACCEPTED · NOT IMPLEMENTED` · contrato final corregido | **ADR-008** | Las líneas «Aprobación: pendiente» de SD-018 se han sustituido en esta adenda |

**Qué significa `ACCEPTED · NOT IMPLEMENTED`.** La decisión está tomada y tiene un único
propietario normativo. **Ninguna migración, tabla, función, política ni test de dominio
existe** para ninguna de las cinco, y **ninguna queda autorizada por la aceptación**. La
implementación exige su propio plan y las precondiciones que cada ADR marca como
prerrequisito (contrato de canonicalización versionado para ADR-008; matriz de destinos
completada para ADR-007).

**El cuerpo congelado v1.2 no se edita.** Es texto histórico: sus líneas «pendiente» —SD-001,
SD-002, SD-006, SD-007— y su SD-015 son cronología del paquete importado, igual que su
cabecera «Estado de todas las entradas: `PROPOSED`», y su hash se conserva:

```bash
head -174 docs/SPEC_DIFF_LOG.md | sha256sum
# 4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3
```

Este registro de aceptación, junto con los ADR aceptados, es lo que gobierna el estado
operativo de esas entradas.

### Estado de todas las entradas de la adenda

| Entrada | Tipo | Estado |
| --- | --- | --- |
| **ERRATA P0-IN-1** | Errata documental | PROPOSED · el fichero congelado no se ha editado |
| **SD-016** · INV-116 | Alta de invariante | Contenido aprobado por Ana · **implementado y verificado** |
| **SD-017** · naturaleza real de los documentos gobernantes | Corrección documental | PROPOSED · `authority-map.md` no se ha editado |
| **SD-018** · orden e idempotencia del stream de eventos | Sustituye a SD-015 | **`ACCEPTED · NOT IMPLEMENTED`** · ADR-008 · 2026-09-07 |
| **SD-019** · la paleta no alcanza el AA que exige §14 | Contradicción entre §2 y §14 | **Opción A autorizada e implementada** · el cambio de especificación (B o C) sigue PROPOSED · diferido antes de Phase 5 |

**Total: 19 entradas SPEC_DIFF** (15 congeladas + SD-016 … SD-019) **y 1 errata.** Cinco
en `ACCEPTED · NOT IMPLEMENTED` —SD-001, SD-002, SD-006, SD-007 y SD-018—; una
`SUPERSEDED` —SD-015—; una implementada por decisión humana de arranque —SD-016—; el
resto `PROPOSED`.

### Qué sigue necesitando decisión humana

| Decisión | Qué desbloquea |
| --- | --- |
| **SD-019 · elegir entre B y C** | El uso de la paleta **sin restricciones**, que necesitan las 18 familias de componentes de §16. No condiciona ningún entregable de Phase 0. Antes de Phase 5 |
| **SD-017 · ERRATA P0-IN-1** | La auditoría de Drive y la corrección de `authority-map.md` |
| **SD-003 · SD-004 · SD-005 · SD-008 … SD-014** | Sin cambios: fuera del alcance del packet |

**Lo que ya no necesita decisión humana:** SD-018, SD-006, SD-007, BD-02 y BD-05. Lo que
necesitan ahora es un plan de implementación con sus prerrequisitos, y eso no es Phase 0.

---

## SD-020 · División de Phase 1 en 1A y 1B; asignación de decisiones a la fase que gobiernan

**Documentos afectados:** `docs/PHASE_0_EXECUTION_PLAN.md` §7 (congelado; no se edita); Builder
Handoff Manifest v1.0 §10 · Phase 1 (congelado; no se edita); `spec/contradiction-register.md`
(congelado; no se edita). Esta entrada vive en la adenda y gobierna operativamente.
**Origen:** contradicciones B-6 y B-7 de la Phase 1 Pre-Authorization Review (2026-09-09);
decisiones humanas «Split», M-2 y M-8 del Phase 1A Authorization Packet.
**Estado:** **`ACCEPTED`** · 2026-09-09 · Ana Victoria · decisión C-4 ·
`STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4`.

**Cambio:**

1. Phase 1 se divide en **Phase 1A · Canonical Domain Foundation** y **Phase 1B · Official
   Corpus Integration**. Phase 1A debe poder cerrar en `PASS` por sí misma y **no** reporta
   `BLOCKED` por la ausencia deliberada de entradas de corpus, que pertenecen a 1B. Las fases
   posteriores no se renumeran.
2. Los tres gates del Manifest §10 para Phase 1 se asignan así: «invalid answer-key relation
   rejected» y «normal user cannot mutate canonical content» → **1A**; «sample TAI content
   traceable to source/version» → **1A** en cuanto al mecanismo (con fixtures GENERATED
   sintéticos) y **1B** con contenido oficial.
3. Entradas y requisitos que gobierna **1B**: MI-01, MI-04, REQ-B11, REQ-B12, REQ-B13,
   REQ-B15, los totales oficiales 270 / 405 / 30 y la completitud del banco oficial.
4. **BD-03** (escala de confianza) se decide **antes de la migración de intentos de Phase 2 y
   de la UI de CHECK**; **BD-06** (puntuación oficial y respuesta en blanco) se decide **antes
   de las tablas de simulacro de Phase 6**. Ninguna de las dos gobierna 1A ni 1B.
5. El repositorio público **no contiene** corpus oficial, preguntas, opciones, claves,
   prácticos ni PDF (decisión M-1); el mecanismo de custodia privada se decide antes de 1B.

**Impacto:** semántica de checkpoint de Phase 1A y 1B; ningún impacto de esquema.

---

## SD-021 · Representaciones inmutables de pregunta canónica; aclaración de «versión del ítem» en ADR-008

**Documentos afectados:** Canonical Data & Event Model v1.0 §6 (`canonical_questions` lleva
`stem`; congelado, no se edita); ADR-008 (`ACCEPTED`; **aclarado, no enmendado**).
**Origen:** contradicción B-9 de la Phase 1 Pre-Authorization Review; decisión humana M-4.
**Estado:** **`ACCEPTED`** · 2026-09-09 · Ana Victoria · decisión C-5 ·
`STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4`.

**Cambio:**

1. `canonical_questions` pasa a ser la **identidad semántica estable** (ámbito de pack, sin
   contenido visible por el aprendiz).
2. `question_representations` contiene el **contenido publicado inmutable** (`stem`,
   `official_reference`, `presentation_json`, procedencia, versión de fuente,
   `representation_no`, `supersedes_representation_id`, `superseded_by_representation_id`,
   estado). Exactamente una representación publicada vigente por pregunta.
3. `question_options` pertenecen a una representación y son inmutables con ella.
4. Una corrección o revisión crea una representación **nueva** enlazada por supersesión;
   nunca se reescribe contenido publicado.
5. La evidencia histórica (Phase 2+) referencia `question_representation_id` además de
   `question_id` y `answer_key_version_id`.
6. **Aclaración de ADR-008:** «la versión del ítem» del contrato de hash canónico **es
   `question_representation_id`**. El texto de ADR-008 se satisface sin cambios: exige una
   versión del ítem sin definirla, y esta entrada la define.

**Justificación:** EC-007 y M-4. Refinamiento permitido por CDEM §31 (no altera ninguno de
los nueve principios protegidos) y aclaración, no enmienda, de ADR-008.
**Impacto:** nodos N5 y N7 del DAG de Phase 1A; Phase 2 almacena `question_representation_id`
en los intentos.

---

## Estado de la adenda · tras la Phase 1A Build Authorization · 2026-09-09

Sustituye a «Estado de la adenda · tras el Human Decision Packet v1.0» como resumen
operativo; aquel texto y su registro de aceptación se conservan íntegros como cronología.

**Registro de decisión:** `STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4` · Phase 1A Build
Authorization · 2026-09-09 · decisora Ana Victoria · revisión independiente (ChatGPT) ·
**alcance: gobernanza e implementación de Phase 1A únicamente.** No autoriza Phase 1B, Phase
2, FPS ni ninguna mutación de PRODUCTION.

| Decisión | Artefacto | Estado |
| --- | --- | --- |
| C-1 | ADR-011 · topología de esquemas y frontera de exposición | **`ACCEPTED`** · implementación autorizada en Phase 1A |
| C-2 | ADR-009 v1.1 · anexo (clave de concepto, mapeos, prerrequisitos) | **`ACCEPTED`** · implementación autorizada en Phase 1A |
| C-3 | ADR-010 v1.1 · anexo (dimensiones exam-neutral, unicidad, reserva) | **`ACCEPTED`** · implementación autorizada en Phase 1A |
| C-4 | SD-020 · división 1A/1B y asignación de decisiones | **`ACCEPTED`** |
| C-5 | SD-021 · representaciones inmutables; aclaración de ADR-008 | **`ACCEPTED`** |
| C-6 | ADR-005 · disposición punto por punto | **aprobada como disposición gobernante de Phase 1A** · el ADR sigue `PROPOSED` |
| C-7 | Aterrizaje de gobernanza y revisión de las pruebas negativas de Phase 0 | **autorizado** |
| C-8 | First Product Sight | aprobado **conceptualmente** como hito; colocación y cambios de frontera **no autorizados**; decisión separada antes de Phase 2 |

**Qué pasa a estar implementándose:** ADR-006, ADR-009 (v1.1) y ADR-010 (v1.1) en cuanto
Phase 1A los requiere; ADR-011. ADR-007 y ADR-008 siguen `ACCEPTED · NOT IMPLEMENTED`:
sus migraciones son de Phase 2 y Phase 4.

**Total tras esta adenda: 21 entradas SPEC_DIFF** (15 congeladas + SD-016 … SD-021) **y 1
errata.** SD-020 y SD-021 `ACCEPTED`; SD-018 `ACCEPTED · NOT IMPLEMENTED`; SD-001, SD-002,
SD-006 y SD-007 `ACCEPTED` y en implementación parcial en Phase 1A (solo lo que sus ADR
autorizan para esta fase); SD-015 `SUPERSEDED`; SD-016 implementada; el resto `PROPOSED`.

---

## SD-008 · **aceptación** · escala de confianza v1 · BD-03 resuelta

**Corrige el estado de:** la entrada SD-008 del cuerpo congelado, que quedó con
«**Aprobación:** pendiente» en la ronda de Phase −1 (histórica: se conserva sin editar).
**Documentos afectados:** `Design System v1.0` §6 («cuatro/cinco niveles», ambiguo); Hi-Fi
LEARN/CHECK/PRÁCTICO (muestran 1–5; corrección de diseño pendiente de Phase 5 bajo Master
§48); `Canonical Data & Event Model v1.0` §12 (`question_attempts.confidence_value`).
**Origen:** C-05 · BD-03 · decisión humana en la Phase 2 Build Authorization.
**Estado:** **`ACCEPTED`** · 2026-09-09 · Ana Victoria · `STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md` · SHA-256 `da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67`.

**Cambio aceptado:**

1. **Cuatro niveles**, versión de escala **`v1`**, etiquetas canónicas tomadas del material de
   pantalla y de dominio (`Screen Design Spec v0.1` · 04_CHECK; `Learning System v0.4` y
   `Pre-Build Intelligence v0.5` usan 1–4):

   | `confidence_value` | Etiqueta |
   | --- | --- |
   | 1 | Nada segura |
   | 2 | Dudosa |
   | 3 | Bastante |
   | 4 | Segura |

2. La escala es un **registro versionado en base de datos** (`confidence_scales`: versión,
   número de niveles, etiquetas, estado `ACTIVE`/`RETIRED`), sembrado por migración con `v1`
   activa. Todo intento persiste **`confidence_value` y `confidence_scale_version`**; el
   servidor rechaza un valor fuera de la escala y cualquier versión que no esté `ACTIVE`.
   Una escala nunca se edita: cambiarla es publicar `v2` y retirar `v1`, porque la
   calibración acumulada depende de la escala con la que se recogió.
3. **Antes del feedback** (Master §14, INV-102): la confianza se fija en el envío
   (`ANSWER_SUBMITTED` con `answer_kind = OPTION` la exige; una respuesta en blanco no la
   exige) y `FEEDBACK_VIEWED` solo se acepta para un ítem con intento ya normalizado.
   `CONFIDENCE_RECORDED` sigue siendo evento de evidencia (CDEM §11) con la misma validación.
4. La misma constante vive en `@study-os/domain` (`CONFIDENCE_SCALE_V1`) para la UI de Phase 5
   y FPS, con un test que la compara con la fila sembrada.

**Justificación:** todos los contratos de dominio usan 1–4; la escala alimenta la calibración
y no puede cambiar tras acumular evidencia; el Design System es ambiguo en su propio texto.
**Impacto:** Phase 2 (columna, registro y validación); Phase 5 y FPS (captura en pantalla;
corrección de los Hi-Fi que muestran 1–5).

---

## SD-022 · Contrato de canonicalización v1 · hash canónico de eventos y respuestas

**Documentos afectados:** ADR-008 («Contrato de canonicalización · prerrequisito de la
migración»); `Canonical Data & Event Model v1.0` §10 y §12.
**Origen:** deuda D-12 (b); decisión H-P2-2 de la Phase 2 Build Authorization.
**Estado:** **`ACCEPTED`** · 2026-09-09 · Ana Victoria · `STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md` · SHA-256 `da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67`.
Satisface el prerrequisito de ADR-008 **sin enmendarlo**.

### Forma canónica (CJF-1)

1. **Objetos:** claves ordenadas por **punto de código Unicode** de la clave normalizada
   (equivale al orden de bytes UTF-8); sin espacios ni saltos de línea insignificantes;
   `{"a":1,"b":[2,3]}`.
2. **Cadenas:** normalizadas a **NFC** antes de serializar; escapes mínimos y fijos: `\"`,
   `\\`, `\n`, `\r`, `\t`, `\b`, `\f`; cualquier otro carácter de control U+0000–U+001F como
   `\u00xx` con hexadecimal en minúsculas; todo lo demás, incluido lo no ASCII, se emite tal
   cual en UTF-8. No se recortan espacios ni se alteran mayúsculas: una diferencia de
   contenido es una diferencia de hecho.
3. **Ausente ≠ nulo:** una clave ausente no se serializa; una clave presente con valor nulo
   se serializa como `"clave":null`. Dos payloads que difieren solo en eso tienen hashes
   distintos.
4. **Colecciones:** los arrays conservan el orden recibido; el orden es semántico (por
   ejemplo, el orden presentado de las opciones).
5. **Numéricos deterministas:** en los payloads que entran en el hash solo se admiten
   **enteros** en el rango seguro (|n| ≤ 2⁵³ − 1), serializados en decimal sin signo para el
   cero, sin ceros a la izquierda y sin exponente. Un numérico no entero se **rechaza** en la
   validación, no se canonicaliza.
6. **Booleanos** `true`/`false`; **nulo** `null`.
7. **Tipos con forma fija:** los UUID se serializan en minúsculas con la forma
   8-4-4-4-12; los instantes (`client_created_at`) se serializan por el servidor en UTC con
   milisegundos, `AAAA-MM-DDTHH:MM:SS.sssZ`, tras interpretar el valor recibido. Dos
   codificaciones equivalentes del mismo instante producen el mismo hash.
8. **Algoritmo:** SHA-256 sobre los bytes UTF-8 del texto canónico; hexadecimal en minúsculas
   (64 caracteres).
9. **Versión almacenada por fila:** `canonicalization_version` (`'v1'`) en `learning_events`
   y en `question_attempts`. Un cambio de cualquier regla o de cualquier conjunto de campos
   es `v2`, con entrada nueva en este registro; los hashes históricos siguen siendo
   interpretables porque cada fila declara con qué versión se calculó.

### Conjunto de campos del hash de evento (`learning_events.payload_hash`)

Exactamente estos, y solo estos, tal como los declara el cliente:
`event_type`, `schema_version`, `session_id`, `session_item_id`, `device_id`,
`client_created_at`, `client_sequence`, `created_offline`, `source_event_id`, `payload`.
Los opcionales ausentes se omiten (regla 3). Quedan **fuera** por ser competencia del
servidor: `user_id` (se compara aparte, ADR-008 punto 4), `event_id` (es la clave),
`stream_position`, `server_received_at`, `engine_processed_at`, el propio hash y la versión.

### Conjunto de campos del hash de respuesta (`question_attempts.answer_payload_hash`)

Exactamente estos: `question_id`, `question_representation_id`, `answer_kind`
(`OPTION` | `BLANK`), `selected_option_id` (nulo si `BLANK`), `presented_option_order`
(array de identificadores de opción, si el cliente lo declara), `confidence_value`,
`confidence_scale_version`, `response_ms`, `answer_key_version_id`. Es el «payload canónico
completo de la respuesta» de ADR-008: incluye la versión del ítem (la representación
presentada, SD-021 y SD-023) y la versión de clave usada (EC-007), que el servidor resuelve
antes de calcular el hash. No hay texto libre en Phase 2: si una fase posterior lo
incorpora, el conjunto pasa a `v2`. Quedan fuera `user_id` (se compara aparte),
`attempt_number`, `is_correct_at_submission`, `correct_option_id` y `submitted_event_id`
(es la clave).

**Nota de alcance de la triple coincidencia.** Un reenvío del mismo `ANSWER_SUBMITTED` se
resuelve primero en el nivel de evento (mismo `event_id`, mismo usuario, mismo hash de
evento → se devuelve el evento y su intento sin recorrer de nuevo la normalización), de modo
que una enmienda de clave entre dos reenvíos no convierte un reintento legítimo en conflicto.
La triple coincidencia del intento se conserva íntegra como defensa en profundidad y se
ejercita directamente sobre la función de normalización.

### Pruebas asociadas

- `canonical.hashIsDeterministic.spec` · dos codificaciones equivalentes (orden de claves,
  espacios, NFD frente a NFC, desplazamiento horario, UUID en mayúsculas) → mismo hash;
  ausente frente a nulo → hashes distintos; cualquier diferencia semántica → hash distinto.
- `canonical.crossImplementation.spec` · la implementación SQL del servidor y la de
  `@study-os/domain` producen el mismo hash para un conjunto fijo de vectores.
- `attempts.canonicalHashIsDeterministic.spec` (declarada en ADR-008) · sobre el conjunto de
  campos de respuesta.

**Impacto:** migraciones de eventos e intentos de Phase 2; ninguna tabla de Phase 1A.

---

## SD-023 · Autoridad de representación y de tiempo en la evidencia de respuesta · aclaración de ADR-008, SD-021 y EC-007

**Documentos afectados:** ADR-008 (punto 11 y «El mismo orden para `question_attempts`»;
**aclarado, no enmendado**); SD-021 (puntos 2 y 5); Engineering Constitution EC-005 y
EC-007; `Canonical Data & Event Model v1.0` §12 y reglas de integridad («un intento debe
referenciar la versión de clave usada para evaluarlo»); Builder Handoff Manifest, líneas
rojas de seguridad («nunca confiar en un `user_id` suministrado por el usuario»).
**Origen:** corrección obligatoria §2 de la Phase 2 Build Authorization.
**Estado:** **`ACCEPTED`** · 2026-09-09 · Ana Victoria · `STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md` · SHA-256 `da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67`.

### Comprobación de implicación (por qué es aclaración y no enmienda)

- ADR-008 punto 11 define `client_created_at` como «la referencia temporal del hecho para el
  motor» y `server_received_at` como auditoría. Ningún punto de ADR-008 le asigna la elección
  de la versión del ítem ni de la clave.
- SD-021 punto 5 exige que la evidencia referencie `question_representation_id`; el punto 2
  hace inmutable la representación publicada. La representación que la evidencia debe
  referenciar es, por EC-005 («la evidencia referencia lo que realmente se estudió», citada
  por ADR-007), la que se presentó.
- EC-007 y la regla de integridad del CDEM exigen que el intento conserve «la versión de
  clave usada para evaluarlo»: la evaluación ocurre en el servidor (INV-101), luego la
  elección de clave es del servidor.
- La línea roja del Manifest prohíbe confiar en identidad suministrada por el cliente; por
  el mismo principio, ningún campo autoritativo del intento puede venir del cliente.

Ninguna de estas fuentes queda contradicha; el contrato de abajo las hace ejecutables.
**No se activa STOP.**

### Contrato

1. **`client_created_at` nunca es autoridad** para elegir representación ni versión de
   clave. Se conserva tal como lo declara el cliente, solo como referencia temporal del hecho
   (ADR-008 punto 11). Un reloj manipulado, futuro o atrasado cambia ese dato y **nada
   más**.
2. **Cadena de autoridad de la representación:**
   `session_items` (destino `QUESTION`, ADR-007 v1.1) → `QUESTION_PRESENTED` declara el
   `question_representation_id` **exacto** que se mostró → el servidor verifica que es una
   representación de la pregunta del ítem que ha estado publicada (`PUBLISHED`, o publicada
   y después superseded o retirada) y la fija en `session_items.presented_representation_id`
   → una presentación posterior del mismo ítem debe repetir la misma representación, y en
   caso contrario se rechaza (`REPRESENTATION_MISMATCH`) → `ANSWER_SUBMITTED` debe referenciar
   la representación presentada, y la opción elegida debe pertenecer a ella; cualquier
   discrepancia se rechaza y **nunca** se reata a otra representación → el servidor resuelve
   la versión de clave (punto 3) → el intento nace inmutable con ambas referencias.
   Un `ANSWER_SUBMITTED` sin `QUESTION_PRESENTED` previo aceptado para el ítem se rechaza
   (`NOT_PRESENTED`).
3. **Resolución de clave, en servidor y para la representación presentada** (semántica de
   Phase 1A: `content.answer_key_versions` está ligada a una representación y su opción
   correcta pertenece a esa representación):
   a. el conjunto candidato son las claves de la representación presentada;
   b. se elige la **vigente en la aceptación** por fechas de vigencia del servidor
      (`effective_from ≤ hoy` y `effective_to` nula o posterior);
   c. si ninguna está vigente porque la representación fue superseded —la única forma en que
      Phase 1A cierra la clave de una representación sin publicarle otra, ya que solo liga
      claves nuevas a la representación vigente—, se usa la **última clave de esa
      representación** (mayor `effective_from`), que es la que estaba vigente para ella en
      el momento de la supersesión. No es un «último valor» arbitrario: es determinista y
      es la única clave que evaluó alguna vez esa representación;
   d. si la representación **no tiene clave**, la pregunta no es respondible: se rechaza
      `QUESTION_PRESENTED` (`NO_ANSWER_KEY`) y, defensivamente, `ANSWER_SUBMITTED`. Nunca
      nace un intento sin `answer_key_version_id` (EC-007, invariant register).
   Queda **prohibido** cualquier retroceso a «la clave más reciente de la pregunta»: la
   clave vigente de la pregunta puede pertenecer a una representación distinta de la
   presentada y evaluaría opciones que el aprendiz nunca vio.
4. **Campos autoritativos rechazados en el payload del cliente:** `user_id`,
   `stream_position`, `server_received_at`, `engine_processed_at`, `attempt_number`,
   `is_correct_at_submission`, `correct_option_id`, `answer_key_version_id`. Su presencia
   hace **malformado** el payload y el evento se rechaza; por tanto nunca influyen.
5. **Inmutabilidad del intento:** una representación posterior de la misma pregunta no
   cambia el intento; una clave `AMENDED` posterior no reescribe `answer_key_version_id` ni
   `is_correct_at_submission` (EC-007; el recálculo es un registro aparte, Phase 10). Un
   trigger rechaza `UPDATE` y `DELETE` sobre `question_attempts` fuera de la purga de
   fixtures.

### Pruebas de regresión exigidas

- `attempt.representationAuthority.presentedWins.spec` · A presentada, B publicada después,
  respuesta aceptada → intento ligado a A y a la clave de A; B no sustituye a A.
- `attempt.representationAuthority.mismatchRejected.spec` · `ANSWER_SUBMITTED` con otra
  representación u opción ajena → rechazado; sin intento; sin posición consumida.
- `attempt.clockManipulation.spec` · `client_created_at` futuro, atrasado y obsoleto → misma
  representación y misma clave que con el reloj correcto; solo cambia el dato conservado.
- `attempt.clientAuthoritativeFields.rejected.spec` · cada campo del punto 4 → rechazo.
- `attempt.keyAmendmentDoesNotRewrite.spec` · clave `AMENDED` tras el intento → fila intacta.
- `attempt.notPresented.rejected.spec` · respuesta sin presentación previa → rechazo.
- `attempt.noAnswerKey.rejected.spec` · representación sin clave → presentación rechazada.

**Impacto:** función `append_learning_event` y migraciones de ítems, eventos e intentos de
Phase 2; ninguna tabla de Phase 1A cambia de semántica.

---

## Estado de la adenda · tras la Phase 2 Build Authorization · 2026-09-09

Sustituye a «Estado de la adenda · tras la Phase 1A Build Authorization» como resumen
operativo; aquel texto se conserva íntegro como cronología.

**Registro de decisión:** `STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md` · SHA-256 `da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67` · Phase 2 Build
Authorization · 2026-09-09 · decisora Ana Victoria · revisión independiente (ChatGPT) ·
copia aceptada en `docs/PHASE_2_AUTHORIZATION_PACKET.md` · **alcance: gobernanza e
implementación de Phase 2 únicamente, en STAGING.** No autoriza Phase 1B, Phase 3, FPS,
merge final, tag, Release, custodia privada ni ninguna mutación de PRODUCTION.

| Decisión | Artefacto | Estado |
| --- | --- | --- |
| H-P2-1 | ADR-007 v1.1 · anexo (cuatro `item_type`; `ON DELETE RESTRICT`) | **`ACCEPTED`** · implementación de `session_items` autorizada en Phase 2 |
| H-P2-2 | SD-022 · contrato de canonicalización v1 | **`ACCEPTED`** |
| H-P2-3 | Corrección dentro de la normalización del intento; `append_learning_event` primera RPC invocable por cliente, con `create_study_session` como función de flujo de sesión declarada en el registro | **`ACCEPTED`** · ADR-008 pasa a implementación autorizada sin enmienda |
| H-FPS-1 | `learning_units` como adenda de contenido canónico de Phase 2 (opción A) a través de la frontera `ingest` de Phase 1A; identidad estable + versiones inmutables; solo GENERATED | **`ACCEPTED`** |
| BD-03 | SD-008 · escala de confianza v1 (cuatro niveles) | **`ACCEPTED`** · `SD-008` deja de estar pendiente |
| §2 | SD-023 · autoridad de representación y de tiempo | **`ACCEPTED`** · aclaración; no exige enmienda de ADR-008 |

**Qué pasa a estar implementándose:** ADR-007 (v1.1, `session_items`) y ADR-008 (puntos 1–9
y 11; intentos) en Phase 2. ADR-006, ADR-009, ADR-010 y ADR-011 siguen implementados en el
alcance de Phase 1A. `planner_items` (ADR-007) y los watermarks (ADR-008 punto 10) esperan a
Phase 4 y Phase 3.

**Total tras esta adenda: 23 entradas SPEC_DIFF** (15 congeladas + SD-016 … SD-023) **y 1
errata.** SD-008, SD-020, SD-021, SD-022 y SD-023 `ACCEPTED`; SD-006 y SD-018 `ACCEPTED` con
implementación autorizada en Phase 2; SD-001, SD-002 y SD-007 `ACCEPTED` en implementación
parcial desde Phase 1A; SD-015 `SUPERSEDED`; SD-016 implementada; el resto `PROPOSED`.

---

## SD-010 · **aceptación** · correcciones de referencias visuales aprobadas · C-06 resuelta

**Corrige el estado de:** la entrada SD-010 del cuerpo congelado, que quedó con
«**Aprobación:** pendiente» en la ronda de Phase −1 (histórica: se conserva sin editar).
**Documentos afectados:** Hi-Fi HOY; Hi-Fi SESSION END / PROGRESS / PLAN; Hi-Fi
LEARN / CHECK / FEEDBACK; Hi-Fi PRÁCTICO.
**Origen:** C-06 · decisión humana H-FPS-A en la FPS Build Authorization.
**Estado:** **`ACCEPTED`** · 2026-09-09 · Ana Victoria · copia aceptada en
`docs/FPS_AUTHORIZATION_PACKET.md`.

**Por qué la resolución no estaba en duda y sí lo estaba el registro.** C-06 se resolvió en su
día «por autoridad: INEQUÍVOCA» (Builder Handoff Manifest §C y Master §48: si una referencia
visual contradice una regla funcional congelada, gana la regla y la pantalla se corrige). Lo
que faltaba era la línea de aprobación de esta entrada, que la Phase 2 Build Authorization
situó como requisito **antes del BUILD del FPS**, no antes del de Phase 2.

**Cambio aceptado, tal como estaba redactado:** eliminar confeti y trofeo de SESSION END;
reducir HOY a la jerarquía SD-01; etiquetar explícitamente o retirar el «nivel global»;
eliminar la tarjeta motivacional; sustituir el icono de robot del Tutor por uno neutro;
retirar el acceso rápido «Resúmenes»; sustituir los porcentajes exactos por banda e
interpretación textual bajo el umbral de evidencia (INV-111).

**Disposición en el alcance del FPS** (el detalle, en `docs/FPS_AUTHORIZATION_PACKET.md` §3):
a y d se aplican como prohibición; b se aplica como jerarquía; g se aplica porque FPS no
muestra ningún porcentaje proyectado; c no es construible, porque ni dominio ni preparación
existen; e y f quedan fuera del vertical. **Ninguna corrección se debilita:** las siete siguen
vigentes para Phase 5 y Phase 7.

**Qué no cambia:** las referencias visuales siguen en el nivel 5 de autoridad y siguen sin
invalidar ninguna regla funcional o de accesibilidad. Esta aceptación no aprueba ningún Hi-Fi:
aprueba sus correcciones.

---

## Estado de la adenda · tras la FPS Build Authorization · 2026-09-09

Sustituye a «Estado de la adenda · tras la Phase 2 Build Authorization» como resumen vigente.
Las entradas anteriores se conservan sin editar.

**Registro de decisión:** FPS Build Authorization · 2026-09-09 · decisora Ana Victoria ·
revisión independiente (ChatGPT) · copia aceptada en `docs/FPS_AUTHORIZATION_PACKET.md` ·
basada en `STUDY_OS_FPS_Pre_Build_Reconciliation_Packet_0678e08` · **alcance: gobernanza e
implementación del First Product Slice únicamente, en STAGING y en Preview.** No autoriza
Phase 1B, Phase 3, merge final de FPS, tag, congelación, Release, custodia privada ni ninguna
mutación de PRODUCTION.

| Decisión | Artefacto | Estado |
| --- | --- | --- |
| H-FPS-A | SD-010 · correcciones de C-06 | **`ACCEPTED`** · `SD-010` deja de estar pendiente |
| H-FPS-B | `docs/FPS_SCREEN_CONTRACT.md` · contrato de pantalla de FPS v1 | **`ACCEPTED`** · autoridad de FPS v1, no congelación del diseño futuro |
| H-FPS-C | Disposición REQ-F01 … REQ-F15 en el alcance del FPS | **`ACCEPTED`** · sin debilitar ningún requisito canónico de Phase 5 |

**Total tras esta adenda: 23 entradas SPEC_DIFF y 1 errata.** SD-008, SD-010, SD-020, SD-021,
SD-022 y SD-023 `ACCEPTED`; SD-006 y SD-018 `ACCEPTED` con implementación autorizada desde
Phase 2; SD-001, SD-002 y SD-007 `ACCEPTED` en implementación parcial desde Phase 1A;
SD-015 `SUPERSEDED`; SD-016 implementada; SD-019 diferida antes de Phase 5, con la **opción A
aplicada y suficiente** para el FPS; el resto `PROPOSED`.
