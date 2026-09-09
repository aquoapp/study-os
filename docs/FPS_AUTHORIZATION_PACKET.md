# STUDY OS · First Product Slice · paquete de autorización aceptado

**Estado:** `ACCEPTED` · 2026-09-09 · Ana Victoria
**Base congelada:** Phase 2 · `phase-2-v1.0` → `46b8fcd705e32c86ed6ddac225cd50f80e4faca9`
**Reconciliación previa:** `STUDY_OS_FPS_Pre_Build_Reconciliation_Packet_0678e08`
(fuera del repositorio, entregada con el veredicto `FPS · READY WITH HUMAN DECISIONS`)

Este fichero es la **copia aceptada** de la autorización del First Product Slice. Registra las
decisiones humanas resueltas, la semántica aceptada y los gates. Es el registro vivo que
`fps.governance.spec` vigila.

---

## 1. Qué se autoriza

El vertical de producto **HOY → APRENDER → COMPROBAR → FEEDBACK → FIN** sobre la base
congelada de Phase 2, con autenticación real, persistencia real, evidencia real, corrección en
servidor, autoridad de representación, interrupción y reanudación exacta, **solo con contenido
sintético GENERATED**, en STAGING y en Preview.

## 2. Qué NO se autoriza

Phase 1B, Phase 3, motores, planificador, dominio, preparación, proyecciones, puntuación,
simulación, corpus oficial, custodia privada, dependencia externa nueva, recurso de pago,
migración de esquema, merge final de FPS, tag, congelación, Release, y cualquier mutación o
despliegue de PRODUCTION.

---

## 3. Decisiones humanas resueltas

### H-FPS-A · SD-010 · **APROBADA**

Se aceptan SD-010 y las correcciones de C-06 tal como están redactadas, bajo la jerarquía de
autoridad vigente (Builder Handoff Manifest §C y Master §48: si una referencia visual
contradice una regla funcional congelada, gana la regla). La aceptación queda registrada en
`docs/SPEC_DIFF_LOG.md`, entrada «SD-010 · aceptación».

Disposición de los siete elementos de C-06 en el alcance de FPS:

| C-06 | Elemento | En FPS |
| --- | --- | --- |
| a | confeti y trofeo en FIN | **prohibición aplicada**; el sustituto positivo se aplica solo en lo que la evidencia sostiene (recuentos), y «próximo repaso» queda diferido con el programador |
| b | HOY como panel de módulos | **aplicada**: tarjeta de sesión dominante, razón provisional, previsualización |
| c | anillo de «nivel global» | **no construible**: ni dominio ni preparación existen. Sigue vigente para Phase 5 |
| d | tarjeta motivacional con trofeo | **aplicada**: no se construye |
| e | icono de robot o mascota del Tutor | **fuera de alcance**: no hay Tutor en FPS |
| f | acceso rápido «Resúmenes» | **fuera de alcance**: no está en el vertical |
| g | porcentajes exactos | **aplicada**: FPS no muestra ningún porcentaje proyectado; solo recuentos de hechos |

### H-FPS-B · Contrato de pantalla · **DIRECCIÓN APROBADA**

El contrato autoritativo de FPS v1 es `docs/FPS_SCREEN_CONTRACT.md`, derivado de los
requisitos canónicos, los invariantes, la terminología, los tokens, la accesibilidad, C-06, la
autoridad UX existente, CALM INTELLIGENCE y el paquete de reconciliación.

Es el contrato **de FPS v1**, no una congelación permanente del diseño visual futuro. Los
hallazgos de UX del recorrido manual de Ana se clasifican durante la aceptación; no se ocultan
ni se incorporan sin registro.

### H-FPS-C · Disposición REQ-F · **APROBADA**

| Requisito | Disposición en FPS |
| --- | --- |
| REQ-F01 · la sesión interrumpida domina HOY | **SATISFECHO** |
| REQ-F02 · HOY no es un panel de mando | **SATISFECHO** |
| REQ-F03 · «por qué esto hoy» desde `reason_codes` | **DIFERIDO** · los códigos los produce el Planner (Phase 4). FPS muestra una razón provisional verdadera |
| REQ-F04 · medida de lectura y cuerpo | **SATISFECHO** |
| REQ-F05 · «no entiendo nada» cambia de estrategia | **DIFERIDO** · la capacidad no existe |
| REQ-F06 · «esto ya me lo sé» exige comprobación | **DIFERIDO** · la capacidad no existe |
| REQ-F07 · selección visible sin señal de corrección | **SATISFECHO** |
| REQ-F08 · confianza antes del feedback | **SATISFECHO** |
| REQ-F09 · corrección en servidor sin exponer la clave | **SATISFECHO** |
| REQ-F10 · siete bloques de FEEDBACK | **PARCIALMENTE SATISFECHO** · resultado, porqué, calibración, procedencia y siguiente. **No se fabrica** el análisis del distractor (sin modelo de datos) ni la ayuda del Tutor (sin capacidad) |
| REQ-F11 · procedencia alcanzable desde el feedback | **SATISFECHO** bajo la autoridad de servidor y de clave vigente: la procedencia se muestra, el identificador de la versión de clave no |
| REQ-F12 · FIN comunica consecuencia, no celebración | **PARCIALMENTE SATISFECHO** · sin celebración ni gamificación, con recuentos de evidencia directa. **No se fabrica** semántica de errores reparados ni próximo repaso ni salida de programador |
| REQ-F13 · la navegación global se repliega | **SATISFECHO en el vertical**: FPS no monta navegación global |
| REQ-F14 · siete estados vacíos | **DIFERIDO** · nunca están enumerados en el repositorio; pertenecen a la incorporación de Onboarding & Edge States en Phase 5 |
| REQ-F15 · accesibilidad P0 en superficies de estudio | **SATISFECHO** extendiendo el arnés existente |

Los requisitos canónicos de Phase 5 **no se debilitan**: diferido significa pendiente en su
fase, no rebajado.

---

## 4. Semántica aceptada

### 4.1 `fps-fixed-v1`

Algoritmo de asignación **determinista** del FPS. Es una función pura sobre el contenido
publicado del pack del objetivo del aprendiz:

1. unidades de aprendizaje `PUBLISHED` del pack, ordenadas por `(concept_key, id)`;
2. después, preguntas canónicas `PUBLISHED` del pack, ordenadas por `id`;
3. `sort_order` correlativo desde 1.

Sin aleatoriedad, sin personalización, sin planificador, sin dominio ni preparación. Se
**deriva**, no se almacena: lo que persiste son las filas de `session_items` que produce.

`fps-fixed-v1` es el **nombre del algoritmo** en el dominio y en la documentación. No se añade
ninguna columna de metadatos para persistir ese literal.

### 4.2 Marcador persistido de la sesión

| Campo | Valor |
| --- | --- |
| `study_sessions.session_type` | `FPS_FIXED` |
| `study_sessions.planner_run_id` | `NULL` |

`session_type` está restringido a `^[A-Z_]{2,40}$`, de modo que `FPS_FIXED` es la forma
canónica del marcador y `planner_run_id IS NULL` es la afirmación de que ningún planificador
intervino.

### 4.3 Precedencia de sesión en HOY

1. Se leen las sesiones propias con estado `PLANNED`, `ACTIVE` o `INTERRUPTED`.
2. Si existe alguna, **gana**: se ofrece continuar y no se crea nada.
3. Solo si no existe ninguna se ofrece crear **una** sesión fija.
4. Una sesión `COMPLETED` es terminal y nunca se reanuda.

### 4.4 Corrección pendiente por encima del cursor

Tras `ANSWER_SUBMITTED` el ítem queda `COMPLETED` y el cursor del servidor avanza. Si existe
un `ANSWER_SUBMITTED` sin un `FEEDBACK_VIEWED` posterior para el mismo ítem, la interfaz
**muestra primero esa corrección**, recuperada por repetición idempotente del mismo sobre, y
solo después sigue el cursor. `FEEDBACK_VIEWED` siempre precede a `SESSION_COMPLETED`.

### 4.5 Rutas autorizadas

`/hoy` · `/aprender/[ordinal]` · `/comprobar/[ordinal]` · `/fin`

FEEDBACK es un **estado** de `/comprobar/[ordinal]`, no una ruta. El ordinal es el orden del
ítem dentro de la sesión del aprendiz autenticado; nunca un identificador. No se monta la
navegación de los cinco espacios primarios.

---

## 5. Gates de FPS

| Gate | Condición de PASS, binaria |
| --- | --- |
| **FPS-G1** autoridad y alcance | Aterrizaje de gobernanza integrado: SD-010 aceptada, contrato de pantalla aceptado, disposición REQ-F registrada, `fps-fixed-v1` y el marcador declarados, registro de alcance actualizado. Ningún motor, planificador, dominio, preparación, puntuación, simulación, corpus oficial ni custodia privada existe en el árbol |
| **FPS-G2** contenido sintético | El pack de demostración se publica por la frontera `ingest`, toda fila es `GENERATED`, contiene al menos 2 unidades y 5 preguntas con clave y explicación, y el sembrado es idempotente |
| **FPS-G3** HOY | Sin sesión abierta, una única acción primaria crea una sesión `FPS_FIXED` con `planner_run_id IS NULL`; con sesión abierta se ofrece continuar y no se crea nada. Sin panel, sin proyección, sin porcentaje, sin tarjeta motivacional |
| **FPS-G4** APRENDER | La unidad se presenta desde la versión vinculada, los eventos se aceptan en orden, el ítem llega a `COMPLETED` y una recarga vuelve a mostrar exactamente la misma versión |
| **FPS-G5** COMPROBAR y FEEDBACK | La cadena `QUESTION_PRESENTED → ANSWER_SELECTED? → CONFIDENCE_RECORDED → ANSWER_SUBMITTED → FEEDBACK_VIEWED` se acepta en orden de `stream_position` para acierto, fallo y blanco; ninguna respuesta previa al envío contiene material de corrección; el feedback muestra resultado, explicación, respuesta del aprendiz y su confianza, todo desde el resultado de la RPC |
| **FPS-G6** continuidad | Interrumpir y volver en APRENDER, en COMPROBAR antes de enviar y entre el envío y la corrección reanuda en el paso exacto, sin intento duplicado y sin evidencia perdida, incluso desde otro dispositivo |
| **FPS-G7** seguridad | Ninguna RPC, grant, exposición de esquema, mutación directa privilegiada, función `SECURITY DEFINER` ni migración nuevas. Las guardas y las suites de seguridad heredadas pasan sin cambios y el aislamiento entre aprendices se mantiene |
| **FPS-G8** calidad de producto | Ninguna pantalla muestra UUID, JSON, término de base de datos, nombre de evento interno, etiqueta de depuración ni texto literal de un error de proveedor. Las guardas de copy y el arnés de accesibilidad pasan en las pantallas nuevas. Ningún token de gamificación aparece en el DOM |
| **FPS-G9** entorno | CI en verde en sus tres jobs; sin migración nueva, de modo que el roundtrip semántico no cambia; PRODUCTION sigue con 0 tablas y 0 migraciones; el despliegue de `main` con destino Production sigue cancelado por el Ignored Build Step |
| **FPS-G10** recorrido manual de Ana | Ana completa el guion de once pasos de principio a fin en el Preview, sin ayuda, sin SQL y sin panel, y lo confirma |

FPS-G10 **no puede** marcarlo Claude. Antes del recorrido su estado es
`PENDING HUMAN WALKTHROUGH`.

---

## 6. Deuda y vigilancia heredadas

| # | Estado en FPS |
| --- | --- |
| **WATCH-P2-1** | **heredado sin cambios**. La corrección posterior al envío es enumerable mediante intentos registrados. El comportamiento actual está aceptado, **no se mitiga en FPS**, y ninguna mitigación futura puede comprometer la retroalimentación pedagógica veraz posterior al envío. FPS no introduce limitación de frecuencia, puntuación, penalizaciones, intentos ocultos, retroalimentación falsa, retención tras un envío honesto, reglas de simulación ni restricciones de planificador |
| **D-20** | **WATCH para FPS**, ni cerrada ni ampliada. Su cierre sigue siendo la primera fuente OFFICIAL de Phase 1B. FPS usa solo contenido `GENERATED` y **no selecciona ni expone** `source_versions.storage_path`, `checksum` ni `retrieved_at` |
| D-13, D-18, D-21, D-22, D-23 | irrelevantes para FPS, sin cambio |

---

## 7. Condiciones de parada del BUILD

Se detiene y se devuelve a Ana y ChatGPT si: haría falta una RPC, grant, esquema expuesto,
mutación directa o frontera `SECURITY DEFINER` nuevos; habría que editar una migración
congelada; aparece un defecto real de la base congelada; el vertical no puede construirse sin
afirmar una capacidad inexistente; haría falta corpus oficial, custodia privada o una decisión
de Phase 1B; haría falta una proyección o salida de motor; habría que mutar PRODUCTION o el
control de releases fallaría; haría falta un recurso de pago; o mitigar WATCH-P2-1 resultara
necesario para publicar, que no lo es.
