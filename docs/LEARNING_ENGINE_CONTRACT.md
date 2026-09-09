# STUDY OS · Learning Engine Contract · v1.0

**Estado:** `ACCEPTED` · 2026-09-10 · Phase 3 Governance Landing Authorization ·
decisora **Ana Victoria** · copia aceptada del registro de decisión en
`docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md`.
**Naturaleza:** contrato semántico **autoritativo** del Learning Engine v1. Sustituye la
dependencia de `Learning System v0.4` —declarado **NO DISPONIBLE**— para todo lo que gobierna
Phase 3.
**Alcance:** semántica. **No autoriza BUILD**: ninguna tabla, migración, trigger, función,
grant, worker ni despliegue nace de este documento.

> **Regla de este contrato.** No contiene ninguna elección semántica sin resolver que pueda
> alterar una salida emitida por el motor v1. Donde una política queda **sin fijar**, el motor
> **no emite** ninguna salida que dependa de ella, y así consta en cada caso.

---

## 0 · De dónde sale este contrato

`Learning System v0.4` es la fuente citada de los seis estados internos, de las bandas de
puntuación y de los seis pesos. **No está en `_handoff/originals/`** —los catorce artefactos
presentes están registrados en `docs/PROVENANCE.md` §3— y la decisión humana H-P3-1 lo declara
no disponible. Tampoco lo está `Pre-Build Intelligence`, fuente citada de REQ-D07.

Este contrato se **deriva** de lo que sí es autoridad:

| Fuente | Qué aporta |
| --- | --- |
| Engineering Constitution EC-002, EC-004, EC-005, EC-006, EC-007 | motor determinista sin LLM; mastery ≠ readiness; evidencia inmutable; reconstruibilidad; el intento conserva su versión de clave |
| ADR-008 (`ACCEPTED`) | `stream_position` por usuario sin huecos; watermark por usuario y proyección; `client_created_at` como referencia temporal del hecho |
| ADR-009 (`ACCEPTED`) | identidad estable de concepto; mapeos con ámbito de versión de pack |
| ADR-002 punto 5 | `ANSWER_SUBMITTED` es la única evidencia autoritativa; `ANSWER_SELECTED` no alimenta el motor |
| ADR-003 (`ACCEPTED` v1.2) | separación mastery/readiness; gobierno de `engine_config`; vocabulario de estado v1 |
| SD-008 | escala de confianza `v1`, cuatro niveles, inmutable |
| SD-022 | forma canónica CJF-1: orden de claves, normalización, nulos, colecciones |
| SD-023 | `client_created_at` nunca elige representación ni clave |
| INV-111, INV-113 | sin precisión falsa; autoridad exclusiva del servidor |
| `spec/terminology.md` §9, §10, y las filas Mastery / Stability / Uncertainty / Exam Readiness | exposición ≠ dominio; la confianza calibra, no puntúa; las definiciones de una línea |
| `spec/requirement-index.md` §D y `spec/acceptance-matrix.md` §D | REQ-D01 … REQ-D11 y sus criterios de PASS |
| Migraciones 6, 8, 9, 15, 16, 17 y 18 | la forma real de la evidencia y del contenido: lo que existe, no lo que se planificó |

**La Master Product Specification v1.0 no es legible por máquina en este repositorio.** Su PDF
solo entrega flujos descomprimibles de programas de fuente tipográfica; no hay texto de página
recuperable. Sus §12, §13, §14 y §23 se citan a través de las compilaciones verificadas por
hash, tal como ya hacía la autorización de Phase 2.

---

## 1 · Entradas autoritativas

| Entrada | Clasificación | Fundamento |
| --- | --- | --- |
| `question_attempts` procedentes de `ANSWER_SUBMITTED` | **AUTORITATIVA** | ADR-002 punto 5 |
| `is_correct_at_submission` | **AUTORITATIVA** | corrección resuelta en servidor contra la clave vigente al enviar |
| `answer_kind` (`OPTION` / `BLANK`) | **AUTORITATIVA** | el blanco es evidencia explícita, nunca ausencia |
| `confidence_value` + `confidence_scale_version` | **AUTORITATIVA como calibración** | REQ-D04; terminología §10 |
| `question_id`, `question_representation_id` | **AUTORITATIVAS** | atribución e identidad de lo presentado |
| `session_id` | **SOPORTE** | sustrato de estabilidad: dos sesiones distintas están separadas en el tiempo por construcción |
| `stream_position` | **AUTORITATIVA como orden y watermark** | ADR-008 puntos 1 y 10 |
| `client_created_at` | **AUTORITATIVA como tiempo del hecho** | ADR-008 punto 11 |
| `LEARNING_UNIT_VIEWED` / `_COMPLETED` | **SOPORTE como exposición** | terminología §9: ver una lección **no cambia mastery** |

## 2 · Entradas excluidas

| Entrada | Motivo |
| --- | --- |
| `ANSWER_SELECTED` | ADR-002 punto 5: no crea evidencia autoritativa **ni alimenta el Learning Engine** |
| `server_received_at` | ADR-008 punto 11: es auditoría; **no puede ordenar ni fechar el hecho** |
| `client_sequence` | orden local por dispositivo; no comparable entre dispositivos |
| `answer_key_version_id` | referencia opaca del servidor; sostiene EC-007, no puntúa |
| `response_ms` | **sin datos**: es opcional en el esquema y ninguna ruta de `apps/web/src` lo envía |
| `attempt_number` | contador derivado; la repetición se modela en §6, no por su valor |
| Eventos de sesión, `QUESTION_PRESENTED`, `FEEDBACK_VIEWED` | completar una sesión o ver un feedback no es demostración de conocimiento |
| `PRACTICAL_STARTED` / `_COMPLETED` | payload vacío; **no producen resultado alguno**. La evidencia práctica es de Phase 6 |
| **Intentos con `diagnostic_run_id` no nulo** | **H-P3-10**: no contribuyen al estado autoritativo en v1. Siguen siendo evidencia inmutable y se contabilizan aparte |
| Cualquier salida de IA | EC-002: un LLM no asigna mastery. La IA **ni siquiera es consultiva** dentro del motor |

## 3 · Identidad de la proyección

**`(user_id, concept_id)`**, con la identidad **estable** de concepto de ADR-009.

- El mastery pertenece a la identidad estable, no al concepto-versión, no a la pregunta, no al
  tema. Publicar una versión nueva de pack **no mueve** el mastery.
- Título, descripción y colocación viven en `concept_versions` y no afectan a la proyección.
- Un `split` o un `merge` de concepto exige política de recálculo declarada antes de publicar
  (ADR-009): este contrato no la altera y no la suple.

## 4 · Fuente de verdad de la proyección

`learning_events` y `question_attempts` son **inmutables** y son la verdad. `concept_mastery`
es **recalculable** y **nunca** se corrige editando evidencia. Es la regla de las cuatro capas y
la frase de terminología, sin cambio.

Ninguna clave foránea apunta a una fila de proyección: una proyección se reconstruye, y una FK
hacia ella se rompería en cada rebuild (ADR-007).

## 5 · Agregación de evidencia · el vector

### 5.1 · Elegibilidad

Un intento entra en el vector **si y solo si** se cumplen las cuatro condiciones:

1. es una fila de `public.question_attempts` del usuario;
2. `diagnostic_run_id` **es nulo** (H-P3-10);
3. la posición de stream de su `submitted_event_id` es **≤ el watermark declarado**;
4. su `question_id` tiene, en la **versión de pack declarada**, exactamente un mapeo con
   `relationship_type = 'PRIMARY'` **y** `mapping_status = 'VALIDATED'` (H-P3-3).

Si falla (4), el intento **no desaparece en silencio**: se contabiliza en
`unattributed_attempt_count`. Si falla (2), se contabiliza en `diagnostic_attempt_count`.
Perder evidencia sin declararlo sería una mentira por omisión.

Un intento **no deja de ser elegible** porque su representación se supere después ni porque la
clave se rectifique: el intento conserva lo que se le presentó y la clave que se usó (EC-007), y
superar contenido no retira una observación.

### 5.2 · Campos del vector

| Campo | Definición |
| --- | --- |
| `eligible_attempt_count` | número de intentos elegibles |
| `distinct_question_count` | preguntas distintas con al menos un intento elegible |
| `distinct_representation_count` | representaciones distintas presentadas |
| `distinct_session_count` | sesiones distintas con evidencia elegible |
| `correct_count` · `incorrect_count` · `blank_count` | recuentos por resultado; el blanco nunca es correcto |
| `distinct_questions_ever_correct` | preguntas distintas con **algún** acierto |
| `distinct_questions_ever_incorrect` | preguntas distintas con **algún** fallo **o** blanco |
| `distinct_questions_latest_correct` | preguntas distintas cuyo **último** intento fue correcto |
| `distinct_questions_latest_incorrect` | preguntas distintas cuyo **último** intento no fue correcto |
| `confidence_cells` | ocho recuentos: `{correct,incorrect} × niveles 1…4` de la escala `v1` |
| `unrated_count` | intentos elegibles sin confianza registrada |
| `first_evidence_at` · `latest_evidence_at` | mínimo y máximo de `client_created_at` **no anómalo**; `NULL` si toda la evidencia es anómala |
| `temporal_anomaly_count` | intentos con marca temporal anómala según §8 |
| `exposure_viewed_count` · `exposure_completed_count` | eventos de unidad de aprendizaje del concepto |
| `diagnostic_attempt_count` | intentos de diagnóstico, **excluidos** del resto del vector |
| `unattributed_attempt_count` | por usuario, en la fila de watermark: intentos sin mapeo elegible |

«Último» se resuelve **por `stream_position`**, que es un orden total sin empates dentro del
stream de un usuario.

### 5.3 · Propiedad estructural

Todos los campos son **monoides conmutativos** sobre el conjunto de intentos elegibles: suma,
unión de conjuntos, mínimo, máximo y máximo-por-clave. De ahí se sigue que el resultado no
depende del orden de proceso ni del tamaño del lote.

**Esta propiedad hace tratable el gate de EC-006. No lo sustituye.** `rebuild == incremental`
sigue siendo un **gate mecánico duro** y se prueba adversarialmente según §15.3.

## 6 · Semántica de repetición

> **La repetición aumenta el recuento de observaciones; no aumenta la diversidad.**
> Toda afirmación que dependa de diversidad lee `distinct_question_count`, nunca
> `eligible_attempt_count`.

Sin coeficientes, sin factores de descuento y sin ventanas temporales.

| Caso | Efecto |
| --- | --- |
| misma pregunta repetida de inmediato | `eligible +1`; `distinct_question` **igual** |
| misma pregunta repetida más tarde | igual, más `distinct_session_count +1` si es otra sesión |
| otra representación de la misma pregunta | `distinct_representation +1`; la pregunta sigue siendo la misma |
| preguntas distintas del mismo concepto | `distinct_question +1`: **única vía de ganancia cualitativa** |
| acierto → acierto | `correct +2`; `ever_correct` y `latest_correct` |
| fallo → acierto | `ever_incorrect` y `ever_correct`; `latest_correct`: recuperación legible |
| acierto → fallo | los mismos conjuntos; `latest_incorrect`: regresión legible |
| blanco → respuesta | el blanco cuenta como observación y como `ever_incorrect` |

## 7 · Calibración de confianza

Escala `v1`, cuatro niveles (`Nada segura · Dudosa · Bastante · Segura`), inmutable y
versionada (SD-008). La versión se conserva con la evidencia.

**Representación: vectorial por recuentos. No numérica, no psicológica.** Las ocho celdas
evitan elegir un punto de corte entre «alta» y «baja» que ninguna fuente declara.

La confianza **no participa en el estado de conocimiento** (§9) y **no puede convertirse en
mastery**: no aparece en ninguna condición de la función de estado. Es un eje propio, tal como
exige terminología §10.

REQ-D04, comprobable con los **extremos declarados de la propia escala**:

- acierto con nivel 1 → `correct_count` sube y la pregunta entra en `ever_correct`
  (**el conocimiento sube**), y crece `confidence_cells.correct[1]` (**la calibración empeora**);
- fallo con nivel 4 → crece `confidence_cells.incorrect[4]` y se marca `ever_incorrect`; el
  estado solo puede ir a `EVIDENCE_NEGATIVE` o `EVIDENCE_CONFLICTING`. **Es imposible por
  construcción que el estado mejore.**

## 8 · Semántica temporal

**Sin decaimiento. Sin curva de retención. Sin semivida. Sin intervalo de repaso inventado.**
**El paso del tiempo por sí solo no puede bajar el estado autoritativo**: el tiempo no aparece
en ninguna condición de la función de estado de §9.

`client_created_at` es la referencia temporal del hecho y **nunca se reescribe**.
`server_received_at` es auditoría y no fecha el hecho.

**Anomalías de reloj**, con dos límites derivables y **ninguna tolerancia elegida**:

| Anomalía | Regla | Por qué no es una constante |
| --- | --- | --- |
| reloj adelantado | `client_created_at > server_received_at` | el servidor no puede recibir un hecho antes de que ocurra |
| reloj anterior a la cuenta | `client_created_at < profiles.created_at` | no hay evidencia de un aprendiz antes de que exista |

Una fecha simplemente vieja es **evidencia offline legítima** y se acepta sin juicio.
Comportamiento: el intento **cuenta siempre**; su marca se excluye de `first_evidence_at` y
`latest_evidence_at`; se incrementa `temporal_anomaly_count`.

Dos dispositivos con relojes divergentes no afectan al vector: el usuario tiene un solo stream y
la agregación es independiente del orden.

**Si en el futuro se necesitara una marca temporal efectiva distinta de `client_created_at`,
es una ARCHITECTURE / GOVERNANCE DECISION con enmienda a ADR-008.** En v1 no se necesita.

### `next_review_at`

El motor implementa `next_review_at = f(vector, engine_config.review_intervals)` y
**`review_intervals` queda sin fijar en v1**. Con la ranura vacía, `next_review_at` es `NULL` y
**no se programa ningún repaso**. REQ-D05 queda parcial y diferido (DEF-28). No se fabrica
calendario para poner un gate en verde.

## 9 · Representación del estado

### 9.1 · Vocabulario autoritativo v1

`NEW · EXPOSED · EVIDENCE_POSITIVE · EVIDENCE_NEGATIVE · EVIDENCE_CONFLICTING`

Función **total, exhaustiva, mutuamente excluyente y sin ningún parámetro libre**:

| Condición sobre el vector | Estado |
| --- | --- |
| `eligible = 0` y `exposure_completed = 0` | `NEW` |
| `eligible = 0` y `exposure_completed > 0` | `EXPOSED` |
| `eligible > 0`, `ever_incorrect = 0`, `ever_correct > 0` | `EVIDENCE_POSITIVE` |
| `eligible > 0`, `ever_correct = 0` | `EVIDENCE_NEGATIVE` |
| `eligible > 0`, `ever_correct > 0`, `ever_incorrect > 0` | `EVIDENCE_CONFLICTING` |

**No hay transiciones.** El estado es una función del vector y se recalcula; no es un autómata
con memoria. Por eso no existe ninguna transición que exija un umbral, y en este contrato no
aparece «evidencia suficiente», «buen rendimiento», «normalmente» ni «dominio alto».

### 9.2 · Vocabulario heredado · `RESERVED / FUTURE`

`LEARNING · CONSOLIDATING · MASTERED · STRONG` **no se emiten** como estado autoritativo de v1 y
**no se redefinen** para hacerlos encajar. Quedan reservados para una versión futura del motor.

**Motivo de la supersesión, registrado:** *la escalera monótona heredada no puede representar
evidencia contradictoria, mientras que el producto exige una condición veraz de fragilidad o
conflicto* (Master §12, `△ Frágil`). Auditoría por estado:

| Estado heredado | ¿Evidencia observable que lo distinga? | Veredicto v1 |
| --- | --- | --- |
| `NEW` | ausencia total de evidencia | conservado |
| `EXPOSED` | exposición sin evidencia autoritativa | conservado |
| `LEARNING` | «hay evidencia y todavía no basta»: umbral implícito no definido | no emitido |
| `CONSOLIDATING` | nada lo separa de sus vecinos sin bandas | no emitido |
| `MASTERED` | exige criterio de suficiencia, sin fijar | no emitido |
| `STRONG` | exige retención, transferencia o estabilidad, las tres inactivas | no emitido |

## 10 · Puntuación

**No hay ninguna puntuación numérica autoritativa de mastery en v1** (H-P3-8).

`mastery_score_internal` y `stability_score` numérico **quedan superseded** del contrato
autoritativo de proyección de Phase 3. **No** se admite porcentaje sustituto, puntuación
normalizada, probabilidad ni pseudopuntuación oculta, ni bajo otro nombre.

REQ-D01 exige «estado, estabilidad, incertidumbre, versión, watermark» y **no exige número**.
Toda puntuación futura exige gobernanza nueva y explícita.

**Sin puntuación no hay pesos.** Los seis pesos de la hipótesis heredada
(accuracy .30 · retention .20 · transfer .20 · stability .10 · confidence_calibration .10 ·
speed .10) **no se usan y no se redistribuyen** en v1; quedan como material de una versión
futura. DEF-14 y OBS-01 siguen vigentes sin cambio.

## 11 · Evidencia insuficiente

`uncertainty` es **categórica** en v1 y se muestra, no se oculta:

| Valor | Condición | Por qué no es un umbral |
| --- | --- | --- |
| `NO_EVIDENCE` | `eligible = 0` | cero es cero |
| `SINGLE_OBSERVATION` | `eligible = 1` | con una sola observación **no se puede** observar consistencia |
| `REPEATED_SAME_QUESTION` | `eligible > 1` y `distinct_question = 1` | con una sola pregunta **no se puede** observar transferencia |
| `MULTIPLE_QUESTIONS` | `distinct_question > 1` | primer punto en que esas afirmaciones son posibles |

Las cinco distinciones exigidas quedan representadas: **sin evidencia** (`NEW`/`EXPOSED`),
**insuficiente** (`SINGLE_OBSERVATION` o `REPEATED_SAME_QUESTION`), **positiva consistente**,
**negativa consistente** y **conflictiva**.

**El cero nunca significa desconocido**, y en v1 lo garantiza la estructura: no existe ninguna
columna de puntuación que pueda valer cero. `evidence_count = 0` significa literalmente cero
observaciones.

`uncertainty` es **ortogonal** al estado: `EVIDENCE_POSITIVE` con `SINGLE_OBSERVATION` y
`EVIDENCE_POSITIVE` con `MULTIPLE_QUESTIONS` son el mismo estado con desconocimiento distinto, y
colapsarlos repetiría en otro plano el error que EC-004 prohíbe.

## 12 · Atribución

**Solo el mapeo `PRIMARY` con `mapping_status = 'VALIDATED'`** de la versión de pack declarada
(H-P3-3). Los `SECONDARY` no aportan evidencia autoritativa en v1 y siguen siendo metadatos
canónicos. El `weight` de `question_concepts` **no se aplica** en v1: con un solo mapeo
contribuyente no hay reparto, y los pesos no están normalizados.

La exposición se atribuye por `learning_units.concept_id`, que **no** tiene ámbito de versión y
por tanto no presenta esta ambigüedad.

## 13 · Autoridad de versión de mapeo

La tupla de determinismo de EC-006 se hace **explícita**, no más laxa:

```
(engine_version, engine_config_version, attribution_pack_version_id,
 attribution_generation, event_watermark)  ⟹  proyección idéntica byte a byte
```

- **`attribution_pack_version_id`** — versión de pack cuyos mapeos gobiernan la atribución.
  Es un **input declarado de la ejecución**, se persiste en cada fila y el rebuild lo recibe
  explícitamente. Deja de depender de «la versión publicada en su momento», que no es
  reconstruible.
- **`attribution_generation`** — contador monótono por versión de pack que avanza ante **toda
  mutación semántica** de `question_concepts` de esa versión. Se persiste con la proyección.

Reglas:

1. El motor **se niega a mezclar generaciones**: una fila con generación distinta de la
   declarada está **obsoleta**, y **no** se continúa incrementalmente sobre ella. Una mutación
   de atribución **nunca** es continuación incremental ordinaria.
2. Un cambio de generación **obliga a recálculo completo** de los usuarios afectados, con
   registro en `mastery_history` (`RECALCULATION_ATTRIBUTION_CHANGED`). Es EC-007 aplicado a la
   atribución: la rectificación crea registro de recálculo y **nunca** reinterpreta la historia
   en silencio.
3. El determinismo se exige **dentro** de una generación.

**Prerrequisito de BUILD.** Las transiciones de estado de mapeo pasan por una **función de
frontera auditada** en lugar de `UPDATE` directo del rol de servicio: es exactamente **D-21**,
que deja de ser deuda diferida y pasa a prerrequisito de Phase 3. **Nada de esto se implementa
en el aterrizaje de gobernanza.**

Descartado explícitamente: convertir `question_concepts` en append-only. Permitiría reconstruir
generaciones antiguas —capacidad que nadie ha pedido— a cambio de rehacer el modelo de mapeos
de Phase 1A.

## 14 · Semántica del watermark

| Elemento | Contrato |
| --- | --- |
| Orden | `stream_position` por usuario, monótona y sin huecos. **Sin orden global y sin necesidad de él** |
| Progreso del consumidor | `projection_watermarks(user_id, projection_name, consumed_position)` · ADR-008 punto 10 |
| Procedencia de la fila | `concept_mastery.event_watermark` · hasta dónde se calculó **esa fila** |
| Valor inicial | `0`: ninguna posición consumida |
| `projection_name` | identificador estable de proyección, no de tabla |
| Avance | **atómico con la mutación de la proyección**, en la misma transacción |
| Fallo | una transacción de proyección fallida **no avanza el watermark**; no queda estado parcial presentado como actualizado |
| Exactamente una vez | **obligatorio**: contar no es idempotente bajo reproceso. La transacción única lo garantiza |
| Evidencia tardía | obtiene la siguiente posición del stream y por tanto va siempre por delante del watermark: se pliega sin rebobinar y **conserva su `client_created_at`** |

## 15 · Semántica de reconstrucción

1. **Rebuild** = plegar todos los intentos elegibles del usuario con posición ≤ W, en cualquier
   orden, con los mismos inputs semánticos declarados.
2. **EC-006 sigue siendo un gate mecánico duro.** La conmutatividad del pliegue lo hace
   tratable; **no exime de probarlo**.
3. **Prueba adversarial mínima exigida** —cada punto es una condición de PASS, no una
   sugerencia—: órdenes de proceso distintos donde sea semánticamente admisible; tamaños de
   lote distintos; interrupción y reinicio en varios watermarks; intentos repetidos; evidencia
   contradictoria; evidencia tardía; evidencia de diagnóstico; evidencia no mapeada; cambios de
   generación de mapeo; cambios de versión de motor o de configuración cuando proceda; rebuild
   desde cero; incremental desde watermarks intermedios.
4. **Serialización canónica:** todo campo `jsonb` del motor y `reason_json` se serializan con la
   forma **CJF-1 de SD-022**. Sin ella, «idéntica byte a byte» no significa nada.

## 16 · Versionado del motor

`engine_config v1` · **cero parámetros numéricos de aprendizaje**:

| Bloque | Contenido |
| --- | --- |
| Identidad | `algorithm_id = 'concept-evidence'` · `algorithm_version = '1.0.0'` |
| Dimensiones activas | `accuracy_observations`, `confidence_calibration_observations`. **Son observaciones, no dimensiones ponderadas: no llevan peso porque no hay puntuación** |
| Dimensiones inactivas, con motivo auditable | `retention` — sin modelo temporal gobernado · `transfer` — sin contrato semántico ni parámetro de dificultad en ninguna tabla · `stability` — definición canónica sí, contrato de evidencia no · `speed` — **sin datos**: `response_ms` no se envía en ninguna ruta |
| Ranuras de política **sin fijar** | `mastery_sufficiency` (DEF-30) · `review_intervals` (DEF-28) |
| Taxonomía de patrones de error | §17, con la autoridad de su recuento citada |
| Ciclo de vida | `DRAFT → ACTIVE → SUPERSEDED`; promoción explícita y registrada contra dataset golden; **aprobación humana registrada** para todo cambio semántico |
| Validación | esquema tipado; enumeración cerrada de dimensiones; **ninguna salida emitida puede referenciar una ranura sin fijar**; la suma de pesos se valida **cuando existan pesos** |
| Trazabilidad | toda proyección persiste `engine_version` y `engine_config_version` |

Una dimensión se activa **publicando una versión nueva** con su contrato declarado y aprobado,
nunca editando la versión activa. El vector no cambia de significado al activarlas: solo se le
añaden campos.

## 17 · Semántica de patrones de error

Taxonomía estructural v1, **sin ninguna clasificación semántica de concepciones erróneas** y
solo donde la condición está mecánicamente soportada por la evidencia existente:

| `pattern_type` | Condición | Sustrato |
| --- | --- | --- |
| `RECURRENT_INCORRECT` | **3** o más preguntas distintas del concepto cuyo último resultado es incorrecto | `distinct_questions_latest_incorrect` |
| `RECURRENT_BLANK` | **3** o más preguntas distintas del concepto cuyo último resultado es blanco | `answer_kind = 'BLANK'` |
| `MAX_CONFIDENCE_INCORRECT` | **3** o más observaciones incorrectas en el **nivel máximo** de la escala | `confidence_cells.incorrect[4]` |

**Autoridad del recuento `3`, citada exactamente como exige la aceptación:**
`spec/acceptance-matrix.md` §D, fila REQ-D06 — «**Tres fallos del mismo tipo crean un
`error_pattern` activo**» — artefacto aceptado de Phase −1, importado sin editar y verificado
por hash en `docs/PROVENANCE.md` §2. **Es una regla de producto de activación de patrón, no una
constante científica del aprendizaje, y no se generaliza a ningún otro uso.**

El nivel máximo tampoco se elige: es el extremo declarado de la escala `v1` (SD-008).

**Los patrones son derivados, no acumulados.** Se recalculan desde el vector, y su condición se
apoya en el **último** resultado: por eso un patrón se cierra solo cuando el aprendiz vuelve a
acertar, sin ninguna regla de caducidad inventada.

Evaluado y **no incluido**: `RECURRENT_DISTRACTOR` (elegir repetidamente la misma opción
incorrecta). `question_options` es **por representación**, de modo que al cambiar de
representación los identificadores cambian y el patrón se rompería en silencio. Requiere una
identidad de opción estable entre representaciones, que no existe.

## 18 · Semántica de intervenciones

**REQ-D07 diferido** (DEF-29). No se crea `intervention_outcomes` en Phase 3.

Comprobación mecánica, no lectura de planificación: `INTERVENTION_SHOWN` e
`INTERVENTION_COMPLETED` existen en el enum de tipos de evento pero **no tienen esquema de
payload declarado** en la frontera de ingestión, y la frontera solo acepta tipos con esquema
declarado; **hoy esos eventos se rechazan**. No hay taxonomía canónica de `intervention_type` en
ningún artefacto disponible, no hay superficie de producto que entregue una intervención, y la
fuente citada por REQ-D07 tampoco está en `_handoff/originals/`.

Satisfacerlo en Phase 3 exigiría tres invenciones para poner un gate en verde. **Una tabla sin
escritor posible no es sustrato: es decoración de esquema.**

## 19 · Frontera de readiness

Exam Readiness es **de nivel objetivo** (BD-04 · H-P3-4).

- **No se crea `exam_readiness` en Phase 3** y no se calcula readiness.
- `◆ Preparado para examen` **no se emite** a nivel de concepto.
- Prohibidos: probabilidad de aprobar, porcentaje de preparación, puntuación global, predicción
  de examen y proyecciones tipo «llegarás al 75 % en 23 días» (INV-111, C-24, DEF-27).
- Phase 3 entrega la **frontera**, verificable **por ausencia**.
- AT-32 («mastery alto + práctico lento ⇒ readiness no sube») **no es ejecutable con verdad**
  en Phase 3: el práctico no registra ningún resultado en la base congelada. Pertenece a
  Phase 6.

**Una tabla llena de nulos no es útil y además invita a rellenarla.**

## 20 · Explicabilidad

**Auditoría interna** · `mastery_history`, con conjunto mínimo obligatorio en `reason_json`
para que dos auditorías sean comparables: `vector_before`, `vector_after`,
`consumed_positions` (desde, hasta), `attempts_folded`, `unattributed_skipped`,
`diagnostic_skipped`, `engine_version`, `engine_config_version`,
`attribution_pack_version_id`, `attribution_generation` y `reason`
(`INCREMENTAL` · `REBUILD` · `RECALCULATION_ATTRIBUTION_CHANGED` ·
`RECALCULATION_ENGINE_CHANGED`).

**Explicación al aprendiz** (Phase 7, no Phase 3): solo hechos del vector y la incertidumbre
categórica. Nunca internos de base de datos, nunca versiones, nunca watermark.

**INV-111 es inviolable por construcción en v1**: no existe ningún porcentaje que mostrar.

## 21 · Puntos de extensión futura

| Dimensión | Qué falta | Sustrato ya registrado en v1 |
| --- | --- | --- |
| `retention` | modelo temporal gobernado | `first_evidence_at`, `latest_evidence_at`, `distinct_session_count` |
| `transfer` | contrato semántico; **no existe ninguna noción de dificultad ni parámetro de ítem en ninguna tabla** | `distinct_question_count`, `distinct_representation_count` |
| `stability` | contrato de evidencia de «separadas en el tiempo» | `distinct_session_count` |
| `speed` | **datos**: `response_ms` no se envía. Y después, qué significa: rápido puede ser dominio o adivinar | ninguno, y es honesto decirlo |
| `SECONDARY` en la atribución | decisión de modelo de producto | los mapeos existen y no se pierden |
| Puntuación numérica | gobernanza nueva y explícita (§10) | el vector, del que cualquier puntuación futura sería derivable **sin backfill** |

Ninguna extensión reinterpreta la historia: el vector es libre de modelo, y añadir dimensiones
añade campos, no significado nuevo a los existentes.

---

## 22 · Políticas explícitamente sin fijar

| Política | Estado | Salida dependiente | ¿Emite v1? |
| --- | --- | --- | --- |
| `mastery_sufficiency` | **sin fijar** · DEF-30 | `✓ Dominado`; umbral de INV-111 | **No** |
| `review_intervals` | **sin fijar** · DEF-28 | `next_review_at`; `⟳ Repaso pendiente` | **No** |
| Sustrato de intervención | **diferido** · DEF-29 | `intervention_outcomes` | **No** |
| Modelo de retención/olvido | **sin asignar a fase** | decaimiento, curvas | **No** |

**Ninguna salida emitida por el motor v1 depende de una política sin fijar.** Esa es la
condición que permite que este contrato sea canónico sin ser una promesa.

## 23 · Estados visibles · función de presentación (REQ-D11)

| Estado visible (Master §12) | Origen | v1 |
| --- | --- | --- |
| `○ Aún sin evidencia` | `NEW` o `EXPOSED` | **alcanzable** |
| `◔ Aprendiendo` | `EVIDENCE_POSITIVE` sin suficiencia · `EVIDENCE_NEGATIVE` | **alcanzable** |
| `△ Frágil` | `EVIDENCE_CONFLICTING` | **alcanzable** |
| `✓ Dominado` | `EVIDENCE_POSITIVE` con suficiencia | **no alcanzable** · `mastery_sufficiency` sin fijar |
| `↺ Confusión detectada` | superposición: patrón de error activo | **alcanzable** |
| `⟳ Repaso pendiente` | superposición: `next_review_at` vencido | **no alcanzable** · `review_intervals` sin fijar |
| `◆ Preparado para examen` | — | **nunca a nivel de concepto** · BD-04 |

Precedencia en v1: un patrón de error activo gana sobre el estado base. Con `⟳` no alcanzable no
existe ninguna otra concurrencia posible, de modo que la función es **total y sin ambigüedad**.

---

## 24 · Lo que este contrato no autoriza

Ninguna tabla, migración, trigger, función de frontera, grant, worker, cron, cola, dependencia,
despliegue ni siembra. No autoriza Phase 4, Phase 1B, corpus oficial, IA, infraestructura de
pago ni ninguna mutación de PRODUCTION. No modifica el FPS congelado.

El BUILD de Phase 3 exige una autorización humana independiente y posterior.
