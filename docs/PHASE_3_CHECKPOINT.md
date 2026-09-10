# STUDY OS · Phase 3 · Learning Engine · BUILD CHECKPOINT

**Formato:** `Checkpoint Contract v1.0`.
**Alcance:** candidato de aceptación. **No fusionado, sin tag, sin congelación.**
**Fecha:** 2026-09-10.

> Este checkpoint incluye una sección **SERVER INTERRUPTION RECOVERY** (§AJ). La
> interrupción no se oculta: es procedencia.

---

## A · Base exacta

| Campo | Valor |
| --- | --- |
| `main` protegida | `8a21fc29ca4f43a470b91d2b53ac81626042f66e` |
| Autoridad de gobernanza | `docs/LEARNING_ENGINE_CONTRACT.md` v1.0 `ACCEPTED` · `docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md` |
| `merge-base` de la rama | `8a21fc2` · la rama es descendiente limpio de `main` |

## B · Rama

`phase/3-learning-engine`, creada desde `8a21fc2` exacto.

## C · Candidato

**HEAD:** _(se fija al cierre; ver §AJ.7)_

## D · Commits de implementación

| Commit | Contenido |
| --- | --- |
| `c0138ea` | motor determinista, frontera de atribución (D-21) y núcleo del engine |
| `5e35c8d` | invocación diferida con recuperación duradera y lectura de evidencia por servidor |
| `42eee87` | **recuperación**: las tres suites del motor interrumpidas por la caída |
| `171c58b` | contrato durable contra base real y decisión de modo |
| `20d5136` | frontera D-21 y seguridad del motor contra base real |
| `9fb9972` | detección de proyección incoherente, red team y disposición de suites heredadas |

## E · Inventario de migraciones

| Migración | Rollback | Aplicada en STAGING |
| --- | --- | --- |
| `00000000000019_attribution_boundary.sql` | sí | sí |
| `00000000000020_engine_core.sql` | sí | sí |

**21 migraciones** en total; `.lock.json` con 21 entradas, coherente con el disco.
Ninguna migración anterior se ha editado.

## F · Delta de esquema

**Esquema `engine`** (no expuesto · ADR-011 anexo v1.1, **pendiente de firma**, §AH):

| Objeto | Nota |
| --- | --- |
| `engine.concept_mastery` | proyección autoritativa: vector de evidencia + estado categórico. RLS forzada |
| `engine.mastery_history` | auditoría append-only con `reason_json` (CJF-1) |
| `engine.error_patterns` | patrones estructurales activos, derivados |
| `engine.projection_watermarks` | progreso del consumidor por usuario y proyección |
| `engine.engine_config` | versionada, inmutable por versión publicada, promoción registrada |
| 5 tipos enumerados | `mastery_state` con **solo** los cinco estados de v1 |
| 8 funciones | `evidence_snapshot`, `stale_users`, `apply_projection`, `recalculate_mastery`, `rebuild_projections`, `promote_engine_config` y los dos triggers |

**Esquema `ingest`** (frontera de atribución · SD-025):
`attribution_generations`, `mapping_transitions`, `bump_attribution_generation`,
`set_question_concept_mapping_status`, `attribution_snapshot`.

**No creado, y no por olvido:** `exam_readiness` (BD-04, Phase 6), `intervention_outcomes`
(REQ-D07 diferido, DEF-29), nada de Phase 4.

## G · Cierre de D-21 · evidencia

| Comprobación | Resultado |
| --- | --- |
| Privilegios de `service_role` sobre `public.question_concepts` | **`SELECT` únicamente** (antes `SELECT, INSERT, UPDATE, DELETE`) |
| `UPDATE` directo del rol de servicio | **denegado** |
| Transición por la frontera | validada, con actor y motivo obligatorios, y rastro en `ingest.mapping_transitions` |
| Transición vacía / no admitida / sin actor / mapeo inexistente | **rechazadas**, cada una con su mensaje |
| Publicación y copy-forward | **intactas**: son `SECURITY DEFINER` y corren como su propietario |
| Prueba que documentaba la deuda | `phase1a.lifecycle.spec` reescrita **con traza a SD-025**: afirma el cierre |

## H · Generación de atribución · evidencia

Línea base **explícita** en generación 1 para toda versión de pack con mapeos; toda mutación
semántica la avanza por trigger; la proyección persiste
`attribution_pack_version_id` y `attribution_generation`; una generación distinta a la vigente
**impide continuar incrementalmente** y produce
`RECALCULATION_ATTRIBUTION_CHANGED` en el historial. Comprobado de extremo a extremo:
retirar el mapeo `PRIMARY` deja la evidencia **no atribuida y contabilizada**, no perdida.

## I · Elegibilidad de la evidencia

Las cuatro condiciones del contrato §5.1, en su orden literal, probadas sin base de datos y
contra base real. Nada se descarta en silencio: lo no atribuible entra en
`unattributed_attempt_count`.

## J · Exclusión del diagnóstico

`diagnostic_run_id is not null` ⇒ fuera del estado autoritativo, contabilizado en
`diagnostic_attempt_count`. Ni su corrección ni su confianza alteran el vector. Probado con
evidencia mezclada.

## K · Vector de evidencia

Exactamente los campos aprobados por el contrato §5.2. Ningún nombre contiene `score`,
`readiness` ni `probability`, y una restricción de la tabla lo impide también en el `jsonb`.

## L · Función de estado · prueba

Total, exhaustiva y mutuamente excluyente sobre todo vector válido: los cinco estados se
alcanzan y ninguno más. La confianza, el tiempo, los pesos y la evidencia de diagnóstico
**no aparecen** en ninguna condición, y se comprueba estructuralmente, no de palabra.

## M · Calibración de confianza

Ocho celdas, cuatro niveles conservados, sin punto de corte inventado. Los cuatro cuadrantes
se observan por separado; cambiar el nivel de confianza no mueve el estado.

## N · Semántica temporal

Sin decaimiento, sin curva, sin intervalo. `next_review_at` es `NULL` y una restricción de
tabla lo impone. Las dos anomalías de reloj son límites lógicos, no tolerancias elegidas: la
evidencia anómala **cuenta** y **no** define el primer ni el último hecho conocido.

## O · Patrones de error

Tres tipos estructurales; el recuento **3** conserva su autoridad citada
(`spec/acceptance-matrix.md` §D · REQ-D06) en el código, en la configuración y en la
migración. Activación y resolución probadas: la resolución es la **ausencia** de la fila.

## P · `engine_config`

Cero parámetros numéricos de aprendizaje. Las dos ranuras de política se declaran sin fijar y
**no pueden llevar valor** (restricción de tabla). Versión publicada inmutable; promoción solo
desde `DRAFT`, con aprobación y evidencia registradas; una sola versión `ACTIVE`.

## Q · Semántica del watermark

Progreso del consumidor y procedencia de la fila, separados. Avance **atómico** con la
proyección: un rechazo no deja ni fila ni avance. Un watermark nunca retrocede; una
continuación desde un watermark equivocado se rechaza.

## R · Arquitectura de invocación diferida

**Ruta A** · tras aceptar evidencia, `scheduleProjection` lanza el cálculo sin esperarlo y sin
propagar su fallo.
**Ruta B** · `engine.stale_users` detecta, **solo desde evidencia y watermark**, las
proyecciones atrasadas *y* las incoherentes; `recoverStaleProjections` las recupera con rol de
servidor. Sin cola de pago, sin responsabilidad del cliente y sin comando de mantenimiento
humano.

**Límite declarado, no disimulado:** la detección de incoherencia compara la proyección con su
watermark; **no** pretende cazar cualquier falsificación. La verificación completa es el
rebuild, que es exactamente lo que EC-006 exige y lo que el ciclo ejecuta al detectarla.

## S · Fallo y recuperación · evidencia

Las siete propiedades exigidas por §18, probadas contra base real:

1. la evidencia se acepta aunque el motor no corra;
2. el atraso es **mecánicamente detectable**;
3. una ejecución posterior lo recupera;
4. repetir no duplica;
5. un fallo antes del commit no deja ni proyección parcial ni watermark adelantado;
6. una caída tras aceptar evidencia deja trabajo recuperable;
7. varias invocaciones perdidas seguidas convergen **al mismo resultado que el rebuild**.

## T · `incremental == rebuild` · gate duro

Probado en dos planos.

**Sin base de datos:** los escenarios de §16, cada uno con orden directo, invertido y
barajado, y con cuatro troceados por escenario —todo de una vez, uno a uno, por mitades y
asimétrico—.

**Contra base real:** una serie de incrementos y un rebuild forzado dejan la **misma**
proyección persistida; el rebuild reemplaza la proyección entera y no la fusiona.

La comparación se hace en forma canónica **CJF-1 en los dos lados**: `jsonb` no conserva el
orden de claves, y sin canonicalizar «idéntica byte a byte» no significaría nada.

## U · Historial y explicabilidad

Toda ejecución deja fila con `vectorBefore`, `vectorAfter`, `consumedPositions`,
`attemptsFolded`, `unattributedSkipped`, `diagnosticSkipped`, versión de motor, de
configuración, de pack y generación. Append-only por trigger.

## V · Seguridad y RLS

`engine` no se sirve por el Data API **ni siquiera al rol de servicio** (`PGRST106`): lo
impide la lista de exposición, no el grant. RLS habilitada y forzada en las cinco tablas; cero
privilegios de cliente; `search_path` vacío en toda función `SECURITY DEFINER`;
`apply_projection` sin ningún grant fuera del propietario; aislamiento entre aprendices
comprobado.

## W · Red team

Nueve ataques de contrato, más los de frontera y configuración. **Un hallazgo real**: una
proyección escrita por algo que no fuera una ejecución fiel del motor era indistinguible de
una al día. Reparado en la misma fase (§R) y cubierto por prueba.

## X · Recuentos de prueba

Todos ejecutados por **CI sobre el HEAD del candidato**, no sobre un árbol de trabajo.

| Suite | Ficheros | Casos |
| --- | --- | --- |
| Unitarias | 43 | **962** |
| Integración (base real) | 29 | **577** |
| RLS | 3 | **192** |
| E2E estáticos | — | **70** |
| E2E de auth | — | **30** |
| **Total automatizado** | | **1831** |

De ellos, **nuevos de Phase 3**: 92 unitarios —contrato del motor, equivalencia
rebuild/incremental, dataset golden, modo de ejecución y alcance de BUILD— y 75 de
integración contra base real: proyección 13, frontera 12, seguridad 41 y red team 9.

Además, ejecución local completa contra **STAGING real**, serializada para no competir por el
pooler: **32 ficheros · 769 casos**, todos en verde.

## Y · Roundtrip de migración

Roundtrip semántico **contra STAGING**, preservando la evidencia:

| Paso | Resultado |
| --- | --- |
| Firma antes | `b89e51a219588c0f81f501298e5ce18e` · 228 objetos |
| Revertir 20 y 19 | esquema `engine` y tablas de atribución desaparecen; el rol de servicio **recupera** la escritura sobre los mapeos; 19 migraciones |
| Evidencia tras revertir | **intacta**: 62 eventos, 10 intentos |
| Reaplicar | 21 migraciones |
| Firma después | `b89e51a219588c0f81f501298e5ce18e` · 228 objetos · **idéntica** |

La firma cubre tablas, columnas, restricciones, enums, funciones con su seguridad y su
`search_path`, triggers, privilegios de tabla y de ejecución, e índices.

## Z · Estado final de STAGING

| Elemento | Valor |
| --- | --- |
| Migraciones aplicadas | **21** · última `00000000000020` |
| Esquema `engine` | 5 tablas, 8 funciones, RLS forzada, cero privilegios de cliente |
| **Datos estables del FPS** | 1 pack `demo-estudio-eficaz`, según la regla del FPS, sin cambio |
| **Evidencia de aceptación de Ana** | **intacta**: 1 perfil, 2 sesiones, 62 eventos, 10 intentos |
| **Residuo automatizado de Phase 3** | **cero**: 0 filas en las cinco tablas del motor y 0 transiciones de mapeo |

Las tres categorías se informan por separado y no se mezclan.

Se encontró y se retiró un residuo: un pack de fixture terminado en `p2red2`, que quedó de una
ejecución contendida de hoy. Se purgó **por la frontera gobernada**
(`ingest.purge_generated_pack`), no por SQL suelto, y solo ese pack.

## AA · PRODUCTION

Sin migraciones, sin tablas, sin mutación. **Ninguna credencial local alcanza PRODUCTION**: el
único lugar del árbol donde aparece su identificador es `tools/seed-fps-demo.mjs`, y es una
guarda que se niega a ejecutarse contra él.

## AB · Vercel y control de publicación

Los despliegues producidos por esta rama son **Preview**. El control de publicación no se ha
tocado.

## AC · Extracción limpia y reproducibilidad

`git archive HEAD` extraído en una carpeta vacía, sin `_handoff`, sin `node_modules` y sin
ningún `.env` salvo `.env.example`, que documenta la forma y jamás el valor. **292 ficheros.**

Sobre esa extracción: `npm ci`, `typecheck`, `lint`, `format`, `test:unit` (**962**), las
cinco guardas y `secret-scan`, todos en verde.

## AD · Deuda y vigilancia

| # | Disposición |
| --- | --- |
| **D-21** | **CERRADA** · frontera auditada, con prueba mecánica (§G) |
| D-13 | abierta · sin Docker no se puede ejecutar `schema-drift` nivel B en local; lo cubre CI |
| D-18 / D-22 | abiertas, **sin cambio**: Phase 3 no usa el arnés de catálogo |
| D-23 | **sin empeorar**: los dos rollback de Phase 3 son cortos y no tocan evidencia |
| D-20 | sin cambio: el motor no lee metadatos de custodia |
| WATCH-P2-1 | **sin mitigar**, tal como exige su disposición |
| **D-24 · nueva** | ADR-011 anexo v1.1 (alta del esquema `engine`) está **PROPUESTO y sin firma**. Es prerrequisito de aterrizaje, no de construcción (§AH) |
| **D-25 · nueva** | Una credencial de STAGING quedó impresa en la transcripción por el camino de error del CLI de Supabase (§AI). Exige rotación |

## AE · Alcance negativo

Sin `exam_readiness`, sin `intervention_outcomes`, sin planner, sin puntuación, sin readiness,
sin repaso programado, sin IA, sin dependencia nueva, sin recurso de pago, sin superficie de
aprendiz nueva y sin corpus oficial. Comprobado mecánicamente en el árbol y en el catálogo.

## AF · Paquete de aceptación

_(se fija al cierre)_

## AG · Gates P3-G1 … P3-G10

| Gate | Resultado | Evidencia |
| --- | --- | --- |
| **P3-G1** gobernanza y alcance | **PASS** | la implementación es exactamente el contrato aceptado; el alcance negativo sigue limpio y solo se relajó donde la migración autorizada aterrizó (§AE) |
| **P3-G2** elegibilidad de la evidencia | **PASS** | §I · §J · lo no atribuible se contabiliza, no desaparece |
| **P3-G3** semántica del estado | **PASS** | §K · §L · §M · §O · sin precisión falsa, y sin ninguna puntuación que pudiera producirla |
| **P3-G4** atribución y autoridad histórica | **PASS** | §G · §H · D-21 cierra sin debilitar ningún invariante de Phase 1A |
| **P3-G5** determinismo | **PASS** | dataset golden con huella fijada; misma entrada declarada, misma salida byte a byte |
| **P3-G6** incremental == rebuild | **PASS** | §T · adversarial en los dos planos, con orden y troceado variables |
| **P3-G7** watermark, fallo y recuperación | **PASS** | §Q · §S · las siete propiedades de §18, contra base real |
| **P3-G8** explicabilidad y versionado | **PASS** | §U · §P |
| **P3-G9** seguridad | **PASS** | §V · ningún cliente alcanza el motor; `PGRST106` incluso para el rol de servicio |
| **P3-G10** entorno, regresión y alcance negativo | **PASS** | CI en verde en sus tres jobs sobre el HEAD del candidato; roundtrip semántico idéntico; STAGING validado; PRODUCTION intacta; sin dependencias ni recursos de pago |

**Los diez en PASS.** No hay gate de recorrido humano en Phase 3: no se autorizó ninguna
superficie de aprendiz, y por tanto no hay nada que recorrer.

## AH · Decisiones humanas y bloqueos

**Ninguna decisión de producto ni de ciencia del aprendizaje quedó pendiente durante la
construcción.** Las diez de la autorización se implementaron tal como se decidieron.

Queda **una firma** pendiente, y es de aterrizaje, no de construcción:

> **D-24 · ADR-011 anexo v1.1 · `PROPUESTO · sin aprobar`.**
>
> El motor necesita un esquema no expuesto. ADR-011 punto 10 ya preveía `engine`
> —«configuración y funciones de motor, Phase 3»— y declaraba que **su creación exige enmienda
> de este ADR**. La autorización de BUILD ordena materializar las cinco tablas sin decir en qué
> esquema, de modo que la enmienda no estaba firmada cuando hizo falta.
>
> **Por qué no valía `public`:** toda tabla de `public` con `user_id` entra automáticamente en
> `rls.userIsolation.phase2.spec`, que es catálogo-dirigido a propósito y exige que **cada
> aprendiz lea sus propias filas**. Ponerla ahí obligaría a conceder lectura a `authenticated`
> —autoridad de cliente que §21 deja fuera— o a debilitar una prueba de aislamiento para que
> dejara de mirar. Ninguna de las dos es aceptable. `ingest` tampoco: una proyección derivada
> no es ingestión.
>
> El anexo está escrito, con su bloque de aprobación **vacío a propósito** y una prueba que
> vigila que siga vacío. **Firmarlo es prerrequisito de aterrizaje.**

**Condiciones de parada que no se activaron:** el mecanismo de atribución no debilitó ningún
invariante congelado de Phase 1A ni introdujo autoridad de cliente; la plataforma sí ofrece un
mecanismo de invocación recuperable de coste cero (§R), de modo que no procede
`ENGINE INVOCATION ARCHITECTURE REQUIRED`.

## AI · Incidente de seguridad operativa · **D-25**

**Qué pasó.** Al intentar ejecutar `schema-drift` contra STAGING desde esta máquina, el CLI de
Supabase falló —el nivel B necesita Docker, que aquí no existe: es D-13— y su mensaje de error
**reimprimió el comando completo, con la cadena de conexión y su contraseña**, en la
transcripción de la sesión.

**Qué no pasó.** No se escribió ningún secreto en el repositorio: `secret-scan` sigue en verde
y el árbol publicado no contiene ninguna credencial. La exposición es de la transcripción de
trabajo, no del código.

**Qué se hizo.** La herramienta local de STAGING se endureció en el momento: toda su salida
—éxito y error— pasa por una función de redacción, la cadena viaja **solo por el entorno** y ya
no se pasa como argumento de línea de comandos, que era el vector. Se verificó con una consulta
fallida a propósito.

**Qué queda por hacer, y es humano.** **Rotar la contraseña de la base de STAGING** y
actualizar `.env.staging.local` y el secreto `STAGING_DB_URL` del repositorio. Hasta entonces
la credencial debe considerarse comprometida.

Se registra como deuda **D-25** y no como observación: una credencial expuesta no es una nota.

## AJ · SERVER INTERRUPTION RECOVERY

Una caída del servidor interrumpió la construcción autorizada. No se reinició nada, no se
descartó nada y no se dio por terminada ninguna operación: primero se reconstruyó la realidad
desde el repositorio y desde el catálogo.

### AJ.1 · Punto de control observado

| Campo | Esperado | Verificado |
| --- | --- | --- |
| Rama | `phase/3-learning-engine` | ✔ |
| HEAD | `5e35c8df49521899fb29f3b98059e35e00adf96a` | ✔ |
| Commits durables | `c0138ea`, `5e35c8d` | ✔ |
| Sin cambios preparados ni sin preparar | — | ✔ |
| `merge-base` contra `main` | `8a21fc2` | ✔ · descendiente limpio |
| Migraciones y `.lock.json` | 21 entradas coherentes con el disco | ✔ |
| Espacio de trabajo npm | `learning-engine` enlazado, sin dependencia externa nueva | ✔ |

**El estado coincidió con el punto de control en todos los campos.** No hubo discrepancia que
reportar.

### AJ.2 · Commits durables recuperados

`c0138ea` y `5e35c8d`, íntegros. Sus diffs se revisaron contra el contrato aceptado antes de
seguir; nada se reescribió por el hecho de haberse interrumpido el proceso.

### AJ.3 · Ficheros sin seguimiento recuperados

Los tres observados, todos con llaves balanceadas y cierre correcto:

| Fichero | Estado | Reparación |
| --- | --- | --- |
| `tests/unit/engine.contract.spec.ts` | **COMPLETO** | ninguna |
| `tests/unit/engine.rebuildEquivalence.spec.ts` | **COMPLETO** | ninguna |
| `tests/unit/engine.golden.spec.ts` | **PARCIAL PERO RECUPERABLE** | la huella del dataset golden era un marcador de posición sin calcular, escrito justo en el instante de la caída. Se fijó al valor real; las aserciones semánticas del fichero —que son la prueba— ya pasaban |

**Ningún fichero estaba corrupto.** Ninguno se borró por estar sin seguimiento.

### AJ.4 · Consistencia tras la interrupción

Probada mecánicamente, no supuesta: `typecheck` limpio, **936 casos unitarios** en verde en el
primer intento salvo la huella del golden, `lint`, `format` y las cinco guardas sin hallazgos.
Los imports, los tipos y las suposiciones sobre SQL entre el paquete del motor, el runtime de
servidor, las migraciones, el `.lock.json` y el registro de autoridad quedaron alineados.

### AJ.5 · Estado de STAGING encontrado

**PHASE 3 FULLY APPLIED**, y coherente: 21 migraciones, esquema `engine` con sus 5 tablas y
sus funciones, configuración `v1` activa, línea base de atribución presente y **cero
privilegios de cliente**. No hubo aplicación parcial y no hizo falta remediación de entorno.

PRODUCTION se comprobó en modo lectura: sin migraciones, sin tablas, sin mutación, y sin
ninguna credencial local que la alcance.

### AJ.6 · Mutación remota parcial

**Ninguna.** La única anomalía de entorno hallada fue un pack de fixture de una ejecución de
pruebas contendida, retirado por la frontera gobernada (§Z).

### AJ.7 · Commit tras la recuperación

`42eee87` · «recupera las tres suites del motor interrumpidas por la caída del servidor».
A partir de ahí la construcción continuó desde la autorización original, sin abrir ninguna
ronda de diseño nueva.

### AJ.8 · El invariante de producto análogo

La interrupción tenía un equivalente exacto en el producto: **un proceso puede detenerse entre
dos operaciones durables**. No se escribió ninguna prueba sobre el agente; se escribió sobre el
producto, y está en §S: evidencia aceptada sin que el motor llegue a correr ⇒ evidencia
intacta, atraso detectable, watermark que no miente y recuperación posterior que converge
exactamente con el rebuild.

### AJ.9 · Correspondencia de la evidencia final

Todas las cifras de este checkpoint proceden de ejecuciones sobre el **HEAD del candidato ya
confirmado**, no sobre un árbol de trabajo intermedio: CI corrió sobre el commit empujado, y la
extracción limpia se hizo con `git archive HEAD`.

## AK · Recomendación

**Candidato completo y listo para revisión independiente.** Los diez gates en PASS, la
evidencia de aceptación de Ana intacta, PRODUCTION sin tocar y el alcance negativo limpio.

Dos cosas exigen decisión humana **antes del aterrizaje**, y ninguna es de construcción:

1. **firmar el anexo v1.1 de ADR-011** (D-24), que da de alta el esquema `engine` que su propio
   punto 10 ya preveía;
2. **rotar la credencial de STAGING** (D-25).

No se ha fusionado nada, no hay tag, no hay congelación y no se ha empezado ninguna fase
posterior.
