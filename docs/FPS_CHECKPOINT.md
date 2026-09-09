# STUDY OS · Checkpoint del First Product Slice

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
MILESTONE: First Product Slice · HOY → APRENDER → COMPROBAR → FEEDBACK → FIN
BRANCH: milestone/fps-first-product-slice (parte de main = e32727c3f40c5534632d675d6def5afd70b9cfc4)
STATUS: PASS WITH OBSERVATIONS · HUMAN ACCEPTED
FPS-G10: PASS · recorrido manual humano · 2026-09-09
```

**FPS · HUMAN WALKTHROUGH: PASS** · 2026-09-09 · Ana Victoria, sobre el Preview desplegado.
La aceptación es **PASS WITH OBSERVATIONS**: cuatro observaciones de producto registradas,
ninguna bloqueante, ninguna corregida durante la congelación.

**FPS · FROZEN · HUMAN ACCEPTED · PASS WITH OBSERVATIONS.** La implementación quedó integrada
en `main` por el PR #10 (commit de merge `6bde0a045532c8ffb2769c0a24d4bbb94958dd57`, padres
`e32727c` y `d3f1086`, árbol idéntico al HEAD aceptado) y etiquetada con el tag anotado
`fps-v1.0`. Las tres comprobaciones exigidas pasaron en verde sobre el PR (CI `34400908876`).
Phase 0, Phase 1A y Phase 2 siguen congeladas y sus tags no se han movido.

## AUTHORITY

FPS Build Authorization del 2026-09-09, sobre el veredicto
`FPS · READY WITH HUMAN DECISIONS` de la reconciliación previa
(`STUDY_OS_FPS_Pre_Build_Reconciliation_Packet_0678e08`). Copia aceptada en
`docs/FPS_AUTHORIZATION_PACKET.md`. Autoriza el vertical sobre STAGING y Preview; **no**
autoriza merge final, tag, congelación, Release, Phase 1B, Phase 3 ni ninguna mutación o
despliegue de PRODUCTION.

## FROZEN BASE

| Elemento | Valor |
| --- | --- |
| Phase 2 | `FROZEN · PASS WITH DEBT · HUMAN ACCEPTED` |
| Merge de implementación | `46b8fcd705e32c86ed6ddac225cd50f80e4faca9` |
| Tag canónico | `phase-2-v1.0` |
| `main` al empezar | `0678e084c2ca4da547ef3599f29219fdb423b6c9` |

**Nada de Phase 2 se ha tocado.** El FPS no añade ninguna migración, ninguna RPC, ningún
grant, ninguna exposición de esquema y ninguna función `SECURITY DEFINER`: cabe entero dentro
de la frontera congelada.

## GOVERNANCE LANDING

`milestone/fps-governance` → PR #9 → `main` **`e32727c3f40c5534632d675d6def5afd70b9cfc4`**,
con las tres comprobaciones exigidas en verde. Aterrizaje exclusivamente documental y de
registro de pruebas, sin ningún objeto de runtime.

| Decisión | Registro |
| --- | --- |
| H-FPS-A · SD-010 y las correcciones de C-06 | `ACCEPTED` en la adenda del `SPEC_DIFF_LOG`, sin editar la entrada congelada |
| H-FPS-B · contrato de pantalla de FPS v1 | `docs/FPS_SCREEN_CONTRACT.md` |
| H-FPS-C · disposición REQ-F01 … REQ-F15 | `docs/FPS_AUTHORIZATION_PACKET.md` §3 |

## GIT

| Elemento | Valor |
| --- | --- |
| Rama de implementación | `milestone/fps-first-product-slice` |
| Base | `main` = `e32727c` |
| Commits | siete slices coherentes |
| Merge / tag | PR #10 integrado en `main` (`6bde0a045532c8ffb2769c0a24d4bbb94958dd57`) · tag anotado `fps-v1.0` |
| Phase 0, 1A y 2 | congeladas e intactas; sus tags no se han movido |

## IMPLEMENTATION HEAD

| Elemento | Valor |
| --- | --- |
| Línea base verificada | `b7e85d6378f7907e4521a54bacfb99a36bd4e1f6` · CI `34394932956` en verde en sus tres jobs, extracción limpia y cadena completa contra STAGING |
| HEAD candidato | difiere de esa línea base **solo** en este checkpoint y en los registros vivos, sin ningún cambio de implementación |

El vertical añade **cero** migraciones, de modo que el roundtrip semántico de Phase 2 sigue
siendo el vigente y no cambia.

## SYNTHETIC PACK

`tools/seed-fps-demo.mjs` publica **un** pack de demostración estable por la frontera de
ingestión (`stage_item` → `validate_staged_item` → `publish_staged_item`), con la misma ruta
que los fixtures: sin escrituras directas y sin saltarse ninguna validación.

| Elemento | Cantidad |
| --- | --- |
| pack, versión, bloque, tema | 1 de cada |
| conceptos con versión | 3 |
| unidades de aprendizaje con versión publicada | 2 |
| preguntas con representación y cuatro opciones | 5 |
| versiones de clave con explicación real | 5 |
| fuente y versión de fuente, `GENERATED` | 1 de cada |

Toda fila es `provenance_class = 'GENERATED'`. No hay contenido oficial, ni pregunta copiada,
ni fuente externa con derechos, ni custodia privada. El texto está escrito para leerse como
producto —el FPS es una rebanada de producto, no una demostración de base de datos— y trata
de método de estudio, que es contenido genérico y verificable.

El sembrado es **idempotente**: detecta el pack por su slug y no duplica nada al repetirse.
Tiene salida deliberada (`--purge`), que la evidencia bloquea mientras algún aprendiz tenga un
objetivo sobre el pack, exactamente la misma protección que impide borrar contenido que el
intento de alguien todavía resuelve. Nunca se ejecuta contra PRODUCTION: comprueba la etiqueta
del entorno **y** el host real.

## ROUTES

`/hoy` · `/aprender/[ordinal]` · `/comprobar/[ordinal]` · `/fin`

FEEDBACK es un **estado** de `/comprobar/[ordinal]`, no una ruta: el resultado llega en la
misma respuesta del envío, y separarlo obligaría a recuperarlo dos veces sin ganar nada de
producto. El ordinal es el orden del ítem dentro de la sesión del propio aprendiz; **no hay
identificadores en la barra de direcciones**. Las cuatro rutas están protegidas por el proxy
con identidad verificada en servidor, y cada pantalla la verifica otra vez (INV-116).

No se monta la navegación de los cinco espacios primarios: el FPS es un vertical, y montarla
sería empezar Phase 5.

## SCREEN CONTRACT

`docs/FPS_SCREEN_CONTRACT.md`, aceptado como autoridad **de FPS v1** y no como congelación del
diseño visual futuro. Declara por superficie propósito, jerarquía, acción primaria y
secundarias, estados, interrupción y reanudación, copy exacto, accesibilidad, prohibiciones y
comportamiento en móvil y escritorio, además de la capa mínima de componentes.

## HOY

Precedencia determinista: si existe una sesión `PLANNED`, `ACTIVE` o `INTERRUPTED`, **gana** y
se ofrece continuar; solo si no hay ninguna se ofrece crear una. La RPC de creación no es
idempotente, así que ofrecer «empezar» con una sesión viva sería fabricar duplicados. Una
sesión `COMPLETED` es terminal y no reanuda.

La sesión nace con `session_type = 'FPS_FIXED'` y `planner_run_id` nulo. La selección es
`fps-fixed-v1`: unidades del pack por `(concept_key, id)` y después preguntas por `id`. Es una
función pura, sin aleatoriedad y sin personalización, y por eso la razón que HOY muestra —«la
selección es la misma para todo el mundo y no está personalizada»— es verdad.

Sin panel de módulos, sin «nivel global», sin tarjeta motivacional, sin trofeo y sin ningún
porcentaje proyectado (C-06 b, c, d, g).

## LEARN

La unidad se presenta desde `learning_unit_versions` y queda **vinculada** al ítem en la
primera presentación. A partir de ahí siempre se muestra la versión vinculada, nunca «la
vigente ahora»: una versión posterior de la misma unidad se rechaza con
`REPRESENTATION_MISMATCH`, comprobado contra una instancia real.

No se ofrece «no entiendo nada» ni «esto ya me lo sé»: sus capacidades no existen y un botón
que promete lo que el sistema no puede dar es exactamente lo que EC-012 prohíbe.

## CHECK

Cadena verificada, en orden de `stream_position`:

`QUESTION_PRESENTED` → `ANSWER_SELECTED` (autoguardado, opcional) → `CONFIDENCE_RECORDED` →
`ANSWER_SUBMITTED` → `FEEDBACK_VIEWED`.

- La selección se ve con **énfasis neutral** y `aria-checked`, sin ninguna señal de corrección
  y sin reordenar (INV-103). Ninguna tabla legible por el aprendiz lleva marca de opción
  correcta, así que la ausencia no depende de la interfaz.
- La confianza se lee de `public.confidence_scales`, **no** se escribe a mano en el código, y
  es obligatoria antes de comprobar (INV-102). La pantalla dice por qué mientras falta.
- El blanco es una respuesta legítima: produce intento, corrección y evidencia.
- El identificador del envío se **deriva del ítem**, de modo que un reintento repite el mismo
  evento en lugar de crear otro. Si el envío anterior se aceptó y su respuesta se perdió, se
  repite el sobre almacenado en lugar de crear un segundo intento.

## FEEDBACK

Todo lo que se muestra viene del **resultado devuelto por la RPC**: resultado, respuesta del
aprendiz, respuesta correcta, explicación y calibración. No se consulta la clave por separado,
no se muestra el identificador de la versión de clave y el color nunca es el único portador
del resultado.

REQ-F10 queda **parcialmente satisfecho**, como se registró: cinco de los siete bloques. El
análisis del distractor no tiene modelo de datos y la ayuda del Tutor no existe; **no se
fabrican**.

**Recuperación tras una recarga.** `question_attempts` no guarda la opción correcta ni la
explicación, así que la única vía dentro del contrato congelado es repetir el mismo sobre. La
propiedad de la que eso depende —que el payload normalizado almacenado normaliza a sí mismo—
se **comprueba antes de confiar en ella**: la repetición devuelve `idempotent: true`, la misma
posición, el mismo intento y la misma explicación, sin crear nada.

**La corrección pendiente precede al cursor.** Tras el envío el ítem queda `COMPLETED` y el
cursor del servidor avanza; quien se fuera entre el envío y la corrección volvería a la
pregunta siguiente sin haber visto nunca la respuesta que se ganó. La interfaz lo deriva de
evidencia legible —un envío sin `FEEDBACK_VIEWED` posterior— y muestra la corrección primero.

## SESSION END

Solo hechos contados a partir de la evidencia del propio aprendiz: unidades leídas, preguntas
respondidas, aciertos, fallos, sin responder y tiempo de la sesión. Sin puntuación, XP, racha,
insignia, trofeo, confeti, dominio, preparación, proyección ni recomendación.

De la sustitución que pide C-06 a se entrega lo que la evidencia sostiene. «Errores reparados»
y «próximo repaso» **no se fabrican**: exigen un bucle de reparación y un programador que no
existen. La acción primaria es volver a Hoy, donde se ofrece una sesión nueva.

## CONTINUITY

Probado en navegador real, en móvil y en escritorio:

| Escenario | Resultado |
| --- | --- |
| dejarlo durante APRENDER, volver | mismo ítem y **misma versión vinculada** |
| recargar durante APRENDER | misma versión, sin evento duplicado |
| dejarlo durante COMPROBAR antes de enviar, volver | misma representación y **selección restaurada** |
| irse entre el envío y la corrección, volver | la corrección pendiente se muestra **antes** de seguir el cursor, recuperada por repetición idempotente, sin intento duplicado |
| botón atrás sobre una pantalla ya superada | repetir la acción **avanza al paso real** y no deja error a la vista |
| sesión terminada | no reanuda; HOY ofrece empezar de nuevo |

El cursor es estado derivado. Ningún estado local es autoridad en ningún punto.

## AUTH

`/registro` o `/entrar` → `/onboarding` → **`/hoy`**. El onboarding ofrece la salida al
vertical, que antes no tenía ninguna. Las cuatro rutas nuevas entran en
`PROTECTED_PREFIXES` y cada pantalla vuelve a verificar identidad en servidor.

La autenticación no se debilita en ningún punto, y no hace falta ninguna operación manual: sin
SQL, sin identificadores, sin panel de Supabase y sin invocar ninguna RPC a mano.

## SECURITY

| Comprobación | Resultado |
| --- | --- |
| Migraciones nuevas | **0** |
| RPC nuevas | **0** · solo `create_study_session` y `append_learning_event`, ya declaradas |
| Grants nuevos | **0** |
| Esquemas expuestos nuevos | **0** |
| Funciones `SECURITY DEFINER` nuevas | **0** |
| Mutación directa privilegiada nueva | **0** |
| Guardas | las seis, sin hallazgos |
| Aislamiento entre aprendices | sesión, ítems y eventos ajenos no se leen; un evento sobre un ítem ajeno se rechaza aunque se conozca su identificador |

Las dos RPC se invocan **solo desde acciones de servidor**, que es la opción más estricta: el
módulo no entra en la superficie de cliente ni por resolución de importaciones.

## WATCH-P2-1

Heredado **sin cambios y sin mitigar**. La corrección posterior al envío sigue siendo
enumerable mediante intentos registrados. El FPS no introduce limitación de frecuencia,
puntuación, penalizaciones, intentos ocultos, retroalimentación falsa, retención tras un envío
honesto, reglas de simulación ni restricciones de planificador.

Consecuencia visible del vertical, que conviene no confundir con un defecto: como la sesión es
fija, una sesión nueva contiene los mismos ítems, y el número de intento crece. Es enumeración
por diseño de una sesión fija, queda registrada entera, y mitigarla exigiría exactamente las
capacidades que la restricción protege.

## D-20

**Vigilancia, ni cerrada ni ampliada.** El FPS usa solo contenido `GENERATED` y **no selecciona
ni expone** `source_versions.storage_path`, `checksum` ni `retrieved_at`. Su cierre sigue
siendo la primera fuente OFFICIAL de Phase 1B.

## TESTS

Recuentos verificados sobre la línea base, todos en verde:

| Suite | Casos |
| --- | --- |
| unitarias | **775** (770 en la línea base, más los cinco de la vigilancia de este checkpoint) |
| integración | **494** · 25 ficheros |
| RLS | **192** · 3 ficheros |
| E2E estáticos | **70** |
| E2E de autenticación | **30** · 15 casos × 2 proyectos |

Del total, el FPS aporta 12 unitarias, 19 de integración y 8 E2E de autenticación. El resto es
regresión heredada de Phase 0, Phase 1A y Phase 2, que se ejecuta entera en cada pasada.

Cobertura nueva, deliberadamente centrada en lo que el producto añade sobre Phase 2, sin
duplicar lo que las suites heredadas ya prueban:

- `fps.assignment.spec` · las dos reglas puras: asignación reproducible con la entrada
  desordenada, el marcador que cabe en la restricción de la columna y el literal que no, la
  corrección pendiente por delante del cursor, la sesión terminal que no reanuda y las rutas
  sin identificador.
- `fps.vertical.spec` · contra una instancia real: semántica de la sesión, destinos publicados,
  vinculación de la versión presentada, ausencia de material de corrección antes del envío,
  **punto fijo de normalización y repetición idempotente**, acierto, fallo y blanco, y
  aislamiento entre aprendices.
- `fps.redteam.spec` · ataques al sobre exacto de la aplicación, cada uno sin residuo.
- `fps.vertical.e2e` · el recorrido completo con dos interrupciones, los ataques desde el
  navegador y la accesibilidad **medida** en cada pantalla.

## RED TEAM

Ataques ejecutados y su resultado:

| Ataque | Resultado |
| --- | --- |
| campos autoritativos en el sobre (siete) y en el payload | rechazo, sin consumir posición |
| representación ajena, inventada o superada | rechazo |
| reloj del cliente tres años en el futuro | no elige contenido ni adelanta el stream |
| confianza 0, 5, 99, −1 y versión de escala inexistente | rechazo |
| opción de otra representación | rechazo |
| pregunta sin clave | no presentable, así que nunca se responde |
| envío duplicado con el mismo sobre | idempotente, un solo intento |
| envío nuevo sobre un ítem ya respondido | rechazo `ITEM_COMPLETED` |
| responder sin haber presentado | rechazo, sin intento ni posición |
| sesión terminada: reanudar o añadir evidencia | rechazo; la fila sigue terminal |
| adelantar el paso por la URL, ordinal inexistente, ordinal ajeno | corrige al paso real; el ordinal resuelve siempre dentro de la sesión propia |
| botón atrás y repetición desde una pantalla superada | avanza, no rompe |
| doble clic en la acción primaria | el control se bloquea mientras la acción está en curso |
| ruta del vertical sin sesión | redirección a `/entrar` |
| clave, corrección o explicación antes del envío | ausentes en la respuesta y en toda tabla legible |
| identificadores o términos internos a la vista | ninguno, comprobado sobre el texto renderizado |

**Defecto real encontrado y corregido.** El botón atrás del navegador podía devolver una
pantalla ya superada desde su caché, y desde ahí la acción principal reenviaba el evento del
paso anterior: el servidor lo rechazaba y el aprendiz veía un error por haber usado el botón
atrás. Las acciones de paso pasan a ser idempotentes en el nivel de producto.

## VISUAL REVIEW

Revisión en navegador real de cada estado, a anchura de móvil y de escritorio, con capturas.
Tres defectos encontrados y corregidos, todos determinados por el contrato de pantalla:

1. el cuerpo de las unidades llevaba saltos de línea duros y se renderizaba fragmentado a
   media frase;
2. la medida de lectura llegaba a unos 72 caracteres, por encima del rango de REQ-F04;
3. la acción primaria se deshabilitaba mientras el autoguardado estaba en vuelo y parpadeaba.

Lo medido, no lo opinado: contraste real de cada texto visible, prohibición de `slate` sobre
`canvas` y de texto sobre `teal` o `amber` (SD-019 opción A), diana táctil de 44×44 px tras el
layout y ausencia de desbordamiento horizontal, en cada pantalla del recorrido y en las dos
anchuras.

## CLEAN EXTRACTION

Extracción limpia con `git archive` del HEAD candidato, en un directorio fuera del
repositorio, sin ningún fichero local: `npm ci`, `typecheck`, `lint`, `format`, 770 unitarias,
las seis guardas, `secret-scan` con centinelas y 70 E2E estáticos, todo en verde. El script de
sembrado viaja en el árbol y **no embebe ninguna credencial**: el entorno se inyecta con
`--env-file`.

## CI

| Job | Resultado |
| --- | --- |
| Estático · typecheck, lint, unit, guardas | **verde** |
| Base de datos · migraciones, integración, RLS, E2E | **verde** |
| Deriva de esquema · STUDY_OS_STAGING (real) | **verde** |

El pipeline pasa a ejecutarse también sobre las ramas `milestone/**`: el First Product Slice
no es una fase, y sin ese disparador el candidato solo tendría CI creando el PR final a
`main`, que no está autorizado antes de la aceptación humana.

**Preview:** cada commit de la rama produce un despliegue Preview contra STAGING; el alias
estable de la rama es el que se entrega para el recorrido manual.

## STAGING

| Elemento | Valor |
| --- | --- |
| Migraciones | 19 · **sin cambios**, el FPS no añade ninguna |
| Pack publicado | solo `demo-estudio-eficaz`, el de demostración |
| Unidades / preguntas | 2 / 5 |
| Cuentas | **0** · todo residuo de prueba, limpiado |
| Sesiones / eventos / intentos | 0 / 0 / 0 |

El pack de demostración **permanece a propósito**: es lo que hace posible el recorrido manual.

## PRODUCTION

0 tablas, 0 migraciones, 0 datos, 0 despliegues. No se ha tocado en ningún momento.

## VERCEL

Cada commit de la rama produce un despliegue **Preview** (`target: null`) contra STAGING.
Ningún despliegue con destino Production procede de esta rama; el Ignored Build Step sigue
vigente y el último build con destino Production, el del merge de gobernanza en `main`, quedó
**CANCELED**.

El Preview está protegido por SSO de Vercel, que es configuración vigente del proyecto y **no
se ha modificado**: al abrir el enlace, Vercel pide iniciar sesión con la cuenta propietaria.

## DEBT

El FPS **no añade deuda nueva**. La heredada sigue como estaba:

| # | Estado |
| --- | --- |
| D-13, D-18, D-21, D-22, D-23 | abiertas y aceptadas, irrelevantes para el FPS |
| **D-20** | abierta · **vigilancia del FPS**, ni cerrada ni ampliada |
| D-12 | cerrada |
| **WATCH-P2-1** | vigilancia heredada, sin mitigar |

## SCOPE NEGATIVE

Ausentes y comprobados mecánicamente: Learning Engine, Planner Engine, dominio, preparación,
proyecciones, watermarks, puntuación, simulación, recomendación adaptativa, cola offline,
pgvector, IA en ejecución, corpus oficial, custodia privada, dependencia nueva, recurso de
pago y despliegue de Production. `packages/` sigue siendo `config`, `design-system` y
`domain`. Las rutas de la aplicación son las de Phase 0, el onboarding y las cuatro del
vertical; `entrenar`, `progreso`, `plan` y `feedback` no existen.

## HUMAN WALKTHROUGH

**Decisión: `FPS · HUMAN WALKTHROUGH: PASS`** · 2026-09-09 · Ana Victoria, a través de la
interfaz real del producto en el Preview desplegado.

Recorrido realizado: alta por el producto, onboarding, disponibilidad declarada, entrada al
estudio, las dos unidades de APRENDER, las cinco preguntas de COMPROBAR con confianza,
corrección veraz de un fallo y de los aciertos, cierre de sesión y FIN.

Evidencia final que el producto le mostró:

| Dato | Valor |
| --- | --- |
| Unidades leídas | 2 |
| Preguntas respondidas | 5 |
| Aciertos | 4 |
| Fallos | 1 |

**Valoración cualitativa:** el producto es funcional y se entiende. La experiencia visual
resulta algo plana, lo cual se acepta en esta etapa y **no bloquea el FPS**. Esa aceptación
**no** aprueba el diseño visual definitivo de STUDY OS, que sigue siendo trabajo de Phase 5.

## WALKTHROUGH EVIDENCE RECONCILIATION

Reconciliación **de solo lectura** entre lo que el producto mostró y lo que STAGING guarda.
No se ha borrado, reparado ni maquillado ninguna fila.

| Comprobación | Evidencia en STAGING |
| --- | --- |
| Cuenta creada por el producto | 1 cuenta, 1 perfil |
| Onboarding persistido | ajustes y objetivo guardados |
| Objetivo | `ACTIVE` sobre el pack `demo-estudio-eficaz` |
| Sesiones | **2**, ambas `FPS_FIXED` con `planner_run_id` nulo y ambas `COMPLETED` |
| Ítems por sesión | 7 · 2 de unidad y 5 de pregunta, **todos completados** |
| Intentos por sesión | 5 · **4 aciertos y 1 fallo**, coincide con lo mostrado |
| Confianza | los 10 intentos llevan valor y escala `v1` |
| Vinculación de contenido | 4 de 4 unidades y 10 de 10 preguntas con lo presentado vinculado |
| Clave y opción | 0 intentos con clave o con opción de otra representación |
| Orden del stream | 62 eventos, posiciones 1 … 62, **sin huecos y sin repetidas** |
| Orden de la corrección | 0 casos de `FEEDBACK_VIEWED` anterior a su envío |
| Intentos duplicados | **0** |
| Cursor tras terminar | nulo en las dos sesiones |
| Anomalías de autoridad | ninguna: 0 eventos o ítems de otro usuario, 0 hashes malformados, canonicalización `v1` en todos |

**Tres precisiones, ninguna contradictoria con lo que el producto mostró:**

1. **Dos sesiones, no una.** Ana completó el recorrido **dos veces**. Es el comportamiento
   diseñado: al terminar, HOY vuelve a ofrecer una sesión, y como la asignación es fija
   contiene los mismos ítems. Cada sesión muestra exactamente 2 unidades, 5 preguntas, 4
   aciertos y 1 fallo, que es lo que ella reportó. El número de intento llegó a 2 en las
   preguntas repetidas, que es la enumeración registrada de WATCH-P2-1 funcionando a la vista.
2. **Disponibilidad.** El registro guarda `default_daily_minutes = 30` —el valor por defecto
   del formulario— y una disponibilidad semanal de **20 minutos en seis días y 30 el lunes**.
   Los «20 minutos al día» del acta corresponden a la disponibilidad por día que ella
   introdujo, no al valor por defecto diario.
3. **Sin respuesta en blanco.** Los 10 intentos son de tipo `OPTION`. El guion ofrecía dejar
   alguna sin responder y no se hizo; el blanco sigue probado mecánicamente.

## MANUAL INTERRUPTION SUB-GATE

**NOT OBSERVED IN HUMAN EVIDENCE · MECHANICALLY PROVEN BY FPS-G6.**

La evidencia contiene **0 eventos** `SESSION_INTERRUPTED` y **0** `SESSION_RESUMED`: el paso
de interrupción deliberada del guion no se ejecutó. No se inventa evidencia de algo que no
ocurrió.

FPS-G10 sigue en PASS porque lo que ese gate mide es que **una persona use el producto de
principio a fin**, y eso ocurrió. La continuidad ya está probada mecánicamente en FPS-G6, con
las tres interrupciones que importan —durante APRENDER, durante COMPROBAR antes de enviar y
entre el envío y la corrección— en navegador real, en móvil y en escritorio.

## PRODUCT OBSERVATIONS

Cuatro observaciones de producto, **no bloqueantes** y **no corregidas** durante la
congelación. Ninguna es deuda técnica.

### FPS-OBS-01 · planitud visual

El vertical es funcional pero visualmente plano: se repite el patrón título → superficie con
borde → texto → botón a lo largo de casi todo el recorrido. La jerarquía es usable, pero
todavía no expresa la profundidad ni la inteligencia que STUDY OS quiere transmitir.

**Clasificación:** observación de producto y UX · no bloqueante · propietaria natural: la UX
de producto futura y la integración de Phase 5. **No es deuda técnica.**

### FPS-OBS-02 · copy de calibración

El copy de calibración es mecánicamente veraz pero de poco valor en algunas combinaciones,
por ejemplo «Segura. Acertaste y estabas segura», y su equivalente con fallo y confianza alta.
Es aceptable para el FPS: dice la verdad y no juzga.

La calibración futura debería ser más informativa **cuando exista evidencia suficiente e
inteligencia de aprendizaje** que la sostenga. Ahora mismo no existen, y fabricar una
interpretación más rica sería exactamente la mentira que EC-012 prohíbe.

**Clasificación:** observación de producto y UX de aprendizaje · no bloqueante.

### FPS-OBS-03 · doble final de sesión

El aprendiz ve primero un resumen previo, «Ya casi está» con la acción **Terminar la sesión**,
y después «Sesión terminada» con recuentos que se solapan en buena parte. Es comprensible
desde la transacción —el cierre es un evento que hay que emitir— pero duplica la experiencia.

**Clasificación:** observación de producto y de flujo · no bloqueante. No se colapsan los dos
estados en esta congelación: no hay ningún defecto de corrección detrás.

### FPS-OBS-04 · disponibilidad frente a duración de la sesión

Ana declaró 20 minutos al día y la sesión fija duró unos 3 minutos. **Es lo esperado.**
`fps-fixed-v1` es determinista y no es el Planner: no dimensiona la sesión según la
disponibilidad, y no pretende hacerlo.

**Clasificación:** hueco de capacidad esperado · propiedad del comportamiento futuro del
Planner. No se implementa planificación por tiempo ahora.

## FPS GATES

| Gate | Resultado |
| --- | --- |
| **FPS-G1** autoridad y alcance | **PASS** |
| **FPS-G2** contenido sintético | **PASS** |
| **FPS-G3** HOY | **PASS** |
| **FPS-G4** APRENDER | **PASS** |
| **FPS-G5** COMPROBAR y FEEDBACK | **PASS** |
| **FPS-G6** continuidad | **PASS** |
| **FPS-G7** seguridad | **PASS** |
| **FPS-G8** calidad de producto | **PASS** |
| **FPS-G9** entorno | **PASS** |
| **FPS-G10** recorrido manual de Ana | **PASS** · recorrido humano real, 2026-09-09 |

FPS-G10 lo aporta **el recorrido humano**, no una prueba automática. Ninguna suite lo
sustituye ni lo declara: lo que lo cierra es que Ana usó el producto de principio a fin.

## ANA WALKTHROUGH INSTRUCTIONS

Doce pasos, sin nada técnico. No hay que abrir la consola del navegador, ni la red, ni la base
de datos, ni Supabase, ni GitHub, ni Vercel, ni mirar ningún identificador.

1. Abre el enlace del Preview. Si Vercel pide iniciar sesión, entra con la cuenta de siempre:
   el Preview es privado a propósito.
2. Crea una cuenta con un correo cualquiera y una contraseña. Es una cuenta de prueba en el
   entorno de pruebas.
3. Completa el onboarding: elige el examen **Demostración · Estudiar mejor**, pon los minutos
   al día que quieras y guarda.
4. Pulsa **Empezar a estudiar**. Deberías llegar a **Hoy**.
5. En Hoy, lee la tarjeta. Fíjate en si entiendes en menos de cinco segundos qué toca hacer, y
   en si la nota que dice que la sesión es fija te parece honesta o suena a excusa.
6. Pulsa **Empezar la sesión** y lee la primera unidad. Fíjate en si se lee cómodamente y en
   si el texto tiene el ancho adecuado.
7. Continúa hasta la primera pregunta. Antes de responder, mira si hay algo que insinúe cuál
   es la correcta. No debería haberlo.
8. Elige una respuesta y elige cómo de segura estás. Fíjate en si el orden de esas dos cosas
   te resulta natural.
9. Pulsa **Comprobar** y lee la corrección. Fíjate en si te dice claramente si acertaste, cuál
   era la respuesta y por qué, y en si la frase sobre tu confianza te parece útil o te juzga.
10. **Interrumpe a propósito**: en la pregunta siguiente, antes de comprobar, elige una opción
    y pulsa **Dejarlo por ahora**. Cierra la pestaña si quieres. Vuelve a abrir el enlace y
    pulsa **Retomamos desde aquí**. Comprueba que vuelves exactamente a esa pregunta y que tu
    elección sigue marcada.
11. Termina el resto de preguntas. Puedes dejar alguna sin responder a propósito: es una
    respuesta válida y debería tratarte igual de bien.
12. Al final, mira la pantalla de **Sesión terminada**. Fíjate en si los números coinciden con
    lo que hiciste y en si el cierre te parece honesto o te promete algo que no existe.

Lo que interesa de ti no es si funciona —eso ya está comprobado— sino si **se entiende, se lee
y se siente bien**. Anota cualquier cosa que te chirríe, por pequeña que sea: cada hallazgo se
clasifica en la aceptación como defecto de implementación, decisión de producto nueva o
trabajo de Phase 5. Ninguno se descarta y ninguno se incorpora sin registro.

## NEXT AUTHORITY

El First Product Slice queda **aceptado y congelado**: `PASS WITH OBSERVATIONS`. La
congelación **no autoriza nada más**.

Siguen **sin autorizar**, y cada uno exige una autorización humana nueva y explícita:
Phase 1B, Phase 3, Phase 4 y Phase 5; Learning Engine y Planner; la integración del corpus
oficial y la custodia privada; Release; y cualquier mutación o despliegue de PRODUCTION.

Las cuatro observaciones viajan con la fase, sin corregir y sin caducar. **FPS-OBS-01** y
**FPS-OBS-03** pertenecen a la UX de producto y a la integración de Phase 5; **FPS-OBS-02**
espera a que exista evidencia e inteligencia que sostengan una calibración más informativa;
**FPS-OBS-04** pertenece al Planner. Ninguna se resuelve de forma oportunista.

**WATCH-P2-1** sigue heredado y sin mitigar, con su restricción vinculante intacta: ninguna
mitigación futura puede comprometer la retroalimentación pedagógica veraz posterior al envío.
