# STUDY OS · Phase 3 · Learning Engine · Governance Landing Authorization

**Estado:** `ACCEPTED` · 2026-09-10 · decisora **Ana Victoria** · revisión independiente.
**Alcance:** **aterrizaje de gobernanza únicamente.** No autoriza el BUILD de runtime de
Phase 3, ni migraciones, ni triggers, ni funciones, ni grants, ni despliegue, ni mutación de
STAGING o de PRODUCTION.

**Registros de decisión de entrada** (material de entrada, no versionado):

| Artefacto | SHA-256 |
| --- | --- |
| `STUDY_OS_Phase_3_Learning_Engine_Pre_Authorization_Packet_d3581ba.md` | `2528852ad7f99fce81f33cea89ad3c355565f984bf96229ab00e3c68443eb3b9` |
| `STUDY_OS_Learning_Engine_Contract_v1.0_Proposal_d3581ba.md` | `cfb07a1ed05602b74daacb742472e21a94c7b602c6bbae634d9d2df42b33f6c7` |

Base auditada: `main` `d3581bac758b369250fba3a4d400453cf252f5ff`.

---

## 0. Qué autoriza y qué no

| | |
| --- | --- |
| **Autoriza** | crear el contrato canónico `docs/LEARNING_ENGINE_CONTRACT.md`; enmendar ADR-003 y aceptarla; aceptar SD-013; cerrar BD-04; anexar la reconciliación de watermark a ADR-008; registrar la semántica histórica de atribución; disponer REQ-D01 … REQ-D11; actualizar el registro de autoridad y los registros vivos; añadir las pruebas documentales que hagan exigible todo lo anterior |
| **No autoriza** | ninguna tabla, migración, trigger, función de frontera, grant, worker, planificador de repaso, siembra de datos, despliegue, Phase 1B, corpus oficial, IA, infraestructura de pago, ni modificación retroactiva del FPS congelado |

---

## 1. Decisiones humanas resueltas

### H-P3-1 · `Learning System v0.4` · **NO DISPONIBLE**

Se declara no disponible y deja de ser prerrequisito. No se sigue buscando, no se inventa su
contenido y no se afirma haberlo recuperado. En su lugar se crea un contrato canónico nuevo
derivado únicamente de autoridad vigente, semántica de evidencia congelada, invariantes
constitucionales, ADR y SD aceptadas, e inferencias veraces que no requieren ninguna constante
científica arbitraria.

### H-P3-2 · Primer modelo de mastery · **REDUCIDO Y HONESTO**

Solo participan las dimensiones con sustrato de evidencia defendible: **exactitud** y
**calibración de confianza**. **Retención, transferencia, estabilidad y velocidad no
contribuyen numéricamente** hasta que existan sus contratos semánticos y de evidencia. No se
fabrican medidas por aproximación, no se infieren de sustitutos débiles, **no se redistribuyen
sus pesos** y no se normaliza el resto para producir una puntuación. Su estado inactivo y el
motivo constan de forma explícita y auditable en `engine_config`.

Quedan prohibidos: coeficientes, bandas, umbrales de dominio, decaimiento, semividas, recuentos
de intento y ventanas temporales arbitrarios.

### H-P3-3 · Atribución pregunta→concepto · **SOLO PRIMARY VALIDATED**

Para el primer modelo autoritativo, solo el mapeo `PRIMARY` con `mapping_status = 'VALIDATED'`
aporta evidencia de aprendizaje. Los `SECONDARY` siguen siendo metadatos de contenido canónico
y podrán convertirse en evidencia en una versión futura del motor tras decisión explícita.

La identidad de versión y de generación usada para atribuir evidencia histórica debe
registrarse lo suficiente para que el rebuild sea determinista. **El problema de mutabilidad de
`question_concepts` debe resolverse antes del BUILD de Phase 3** si puede romper el
determinismo del rebuild. No se parchea ahora.

### H-P3-4 · BD-04 · **READINESS SOLO POR OBJETIVO**

Exam Readiness existe a nivel de objetivo, no de concepto. `◆ Preparado para examen` **no se
emite** como estado de mastery de concepto. Mastery y Exam Readiness siguen
constitucionalmente separadas. REQ-D11 mapea el estado de aprendizaje de concepto sin
introducir readiness de concepto. En Phase 3 no se deriva probabilidad de aprobar, porcentaje
de preparación ni equivalente.

### H-P3-5 · Y·1 · Suficiencia de mastery · **SIN FIJAR EN v1**

No se inventa umbral numérico de suficiencia, no se elige un mínimo de preguntas y no se deriva
de conveniencia ni de fixtures. Consecuencias: `✓ Dominado` es **inalcanzable** en v1; INV-111
queda protegido estructuralmente; la ranura de política puede existir pero **debe estar
explícitamente sin fijar**; **ninguna salida autoritativa emitida puede depender de ella**. No
bloquea Phase 3. Se registra propietario diferido y prerrequisito de activación futura.

### H-P3-6 · Y·2 · Generación de atribución · **APROBADA EN PRINCIPIO**

Aprobada exactamente para el propósito semántico descrito en el contrato. Se gobiernan
`attribution_pack_version_id`, `attribution_generation`, el avance de generación ante mutación
semántica de `question_concepts`, la frontera de mutación auditada, el rebuild determinista
contra la semántica de atribución declarada y el recálculo registrado ante cambio de
generación. **D-21 pasa a ser prerrequisito de Phase 3.**

El aterrizaje **especifica** el contrato. **No se implementan** esquema, trigger, función ni
grants. Si el diseño detallado de implementación revelara que el mecanismo mínimo propuesto no
preserva los invariantes congelados de Phase 1A o introduce una frontera de autoridad de
cliente nueva: **STOP**.

### H-P3-7 · Y·3 · Vocabulario de estado de aprendizaje · **APROBADO**

Estados categóricos autoritativos del Learning Engine v1:

`NEW · EXPOSED · EVIDENCE_POSITIVE · EVIDENCE_NEGATIVE · EVIDENCE_CONFLICTING`

La progresión heredada `LEARNING · CONSOLIDATING · MASTERED · STRONG` **no se emite** como
estado autoritativo de v1. Puede permanecer documentada como vocabulario `RESERVED / FUTURE`
solo donde la trazabilidad histórica lo exija. **No se redefinen en silencio** esos términos
heredados para que encajen en v1.

Motivo de la supersesión, que debe quedar registrado: *la escalera monótona heredada no puede
representar evidencia contradictoria, mientras que el producto exige una condición veraz de
fragilidad o conflicto.*

### H-P3-8 · Mastery numérica · **NINGUNA EN v1**

No hay puntuación numérica autoritativa de mastery en v1. Se aprueba la retirada o supersesión
de `mastery_score_internal` y de `stability_score` numérico del contrato autoritativo de
proyección de Phase 3. **No** puede introducirse porcentaje sustituto, puntuación normalizada,
probabilidad ni pseudopuntuación oculta. La proyección autoritativa es el **vector de
evidencia**; el estado categórico se deriva de ese vector. Toda puntuación futura exige
gobernanza nueva y explícita.

### H-P3-9 · Y·4 · Invocación del motor · **APROBADA DIRECCIONALMENTE**

**Evidencia duradera primero. Procesamiento del motor después.** La aceptación y la durabilidad
de la evidencia del aprendiz **no pueden depender** de que el Learning Engine termine con
éxito. Se usará el mecanismo diferido recuperable más pequeño compatible con la arquitectura
actual y con la restricción de cero infraestructura de pago.

Requisitos: la evidencia aceptada sigue aceptada aunque falle la proyección; el watermark
permite recuperación; el proceso se puede reintentar; sin Redis; sin Kafka; sin cola gestionada
de pago; sin infraestructura de pago nueva; sin autoridad de invocación desde el cliente; sin
acoplamiento síncrono que haga depender la durabilidad de la evidencia del éxito de la
proyección.

El mecanismo exacto puede elegirse en el diseño técnico **solo si no introduce ninguna
autoridad de arquitectura nueva**. Si la plataforma no puede ofrecer un mecanismo recuperable
fiable de coste cero dentro de la autoridad vigente: **STOP como ARCHITECTURE DECISION
REQUIRED**. No se disimula la fiabilidad con comportamiento «best-effort» en el cliente.

### H-P3-10 · Y·5 · Evidencia de diagnóstico · **EXCLUIDA DE v1**

**Sustituye a la recomendación provisional de la propuesta, que era contarla.** Los intentos de
diagnóstico **no contribuyen al estado de aprendizaje autoritativo** en el motor v1. Siguen
siendo evidencia inmutable. Deben registrarse y contabilizarse **por separado** para que una
política futura pueda incluirlos sin pérdida de datos ni reescritura histórica.

Por tanto: `diagnostic_attempt_count` puede proyectarse y auditarse; los intentos de
diagnóstico quedan **excluidos** de la agregación de evidencia autoritativa de mastery en v1;
su corrección y su confianza **no alteran** el estado de concepto de v1; no se borra ni se muta
evidencia de diagnóstico; incluirlos en el futuro exige una versión nueva de motor o de
configuración. El contrato de elegibilidad se actualiza en consecuencia.

---

## 2. Correcciones a la propuesta

### §7 · `rebuild == incremental` · **EC-006 NO SE DEBILITA**

El diseño conmutativo del vector de evidencia hace **tratable** la equivalencia
rebuild/incremental y elimina la dependencia del orden. **No exime de EC-006.**

`rebuild == incremental` sigue siendo un **gate mecánico de aceptación duro**, y debe probarse
**adversarialmente** al menos sobre: órdenes de proceso distintos donde sea semánticamente
admisible; tamaños de lote distintos; interrupción y reinicio en varios watermarks; intentos
repetidos; evidencia contradictoria; evidencia tardía; evidencia de diagnóstico; evidencia no
mapeada; cambios de generación de mapeo; cambios de versión de motor o de configuración cuando
proceda; rebuild desde cero; e incremental desde watermarks intermedios.

Los mismos inputs semánticos declarados deben producir la misma salida canónica de proyección.
**El gate no se debilita porque el pliegue esté diseñado para ser conmutativo.**

### §10 · Patrones de error · **TRAZABILIDAD DE LA FUENTE**

La taxonomía estructural gobierna v1 **solo donde sus condiciones estén mecánicamente
soportadas por la evidencia existente**. El recuento de recurrencia `3` puede usarse **solo si
la gobernanza registra la autoridad aceptada exacta de la que procede ese número**. No se
generaliza a constante científica del aprendizaje: es una **regla de producto** de activación
de patrón de error. Sin clasificación semántica de concepciones erróneas.

---

## 3. Aprobaciones ratificadas sin cambio

| § | Contenido |
| --- | --- |
| 8 · Modelo temporal | Sin decaimiento, sin curva de retención, sin semivida, sin intervalo de repaso inventado. `next_review_at` permanece `NULL` mientras `review_intervals` esté sin fijar. **El paso del tiempo por sí solo no puede bajar el estado autoritativo.** El sustrato temporal se conserva para modelos futuros gobernados. REQ-D05 queda explícitamente parcial/diferido |
| 9 · Confianza | Calibración representada como observaciones y datos vectoriales, **no** como puntuación psicológica numérica. La confianza no determina directamente el estado de conocimiento. Se conserva la versión declarada de la escala. **Sin punto de corte alto/bajo inventado** |
| 11 · Intervenciones | REQ-D07 **diferido**. No se crea `intervention_outcomes` en Phase 3. No se inventan esquemas de payload ni taxonomía. Se registra propiedad futura explícita |
| 12 · Exam Readiness | Solo por objetivo. **Sin tabla `exam_readiness` ni cálculo en Phase 3.** Sin readiness de concepto, sin probabilidad de aprobar, sin porcentaje, sin pseudomodelo de ceros o nulos. Phase 3 debe preservar la frontera **mecánicamente** |
| 13 · Watermark | `projection_watermarks` = progreso del consumidor · `event_watermark` = procedencia del cálculo de la fila. El avance del watermark es **atómico** con la mutación de la proyección; una transacción de proyección fallida **no** avanza el watermark. Sin requisito de orden global: `stream_position` por usuario sigue siendo la autoridad |
| 14 · Estado del contrato | El contrato canónico **no conserva estado `PROPOSAL`** tras la aceptación, y **no puede contener ninguna elección semántica sin resolver que altere una salida emitida por el motor v1**. Las políticas explícitamente sin fijar o diferidas se admiten **solo** donde v1 no emite ninguna salida dependiente |

---

## 4. Procedimiento exigido

Rama de gobernanza desde `main` protegida; cambios solo de gobernanza; pruebas documentales;
checks heredados afectados; revisión adversarial de alcance; PR; CI en verde; verificación de
que el diff es solo de gobernanza; merge por `main` protegida; verificación del árbol
fusionado; verificación de que no hay despliegue ni mutación de entorno.

**Sin implementación de runtime en este PR. Tras el merge de gobernanza, STOP.**

---

## 5. Red team de gobernanza exigido antes del PR

A · ninguna puntuación numérica de mastery sigue siendo autoritativa en v1 ·
B · ningún peso oculto influye en el estado emitido de v1 ·
C · los intentos de diagnóstico no pueden afectar al estado autoritativo de concepto de v1 ·
D · `✓ Dominado` no puede emitirse mientras la suficiencia esté sin fijar ·
E · `⟳ Repaso pendiente` no puede emitirse mientras los intervalos estén sin fijar ·
F · `◆ Preparado para examen` no puede emitirse a nivel de concepto ·
G · la evidencia contradictoria tiene un estado autoritativo explícito ·
H · la evidencia cero no se representa como mastery numérica cero ·
I · la confianza no puede convertirse silenciosamente en mastery ·
J · el tiempo por sí solo no puede degradar el estado ·
K · la evidencia no mapeada no puede desaparecer en silencio ·
L · la mutación de atribución no puede tratarse como continuación incremental ordinaria ·
M · EC-006 sigue siendo un gate mecánico duro ·
N · los requisitos diferidos no se marcan PASS ·
O · no se crea sustrato de intervención ni de readiness solo para satisfacer documentos de
planificación ·
P · no se filtra semántica del Planner de Phase 4 a Phase 3 ·
Q · no se introduce dependencia del corpus oficial de Phase 1B ·
R · no se implica ninguna mutación de PRODUCTION ·
S · no se introduce ninguna referencia a AQUO ni regresión de su frontera.

---

## 6. Frontera absoluta

Prohibido en este aterrizaje: implementar runtime de Phase 3; crear tablas de proyección;
crear migraciones; crear triggers; crear la función de frontera de D-21; cambiar grants;
mutar STAGING; mutar PRODUCTION; desplegar Phase 3; sembrar datos de aprendizaje; implementar
procesamiento de mastery; implementar invocación del motor; implementar workers de proyección;
implementar planificación de repaso; implementar Planner; iniciar Phase 1B; ingerir corpus
oficial; introducir IA; introducir infraestructura de pago; modificar o congelar el FPS
retroactivamente; tocar AQUO.

---

## Human approval

Approved by: Ana Victoria
Date: 2026-09-10
Scope: governance landing only · Phase 3 runtime BUILD **not** authorized
