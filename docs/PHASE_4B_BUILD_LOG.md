# STUDY OS · Phase 4B · Build Log

**Naturaleza:** estado de recuperación para otro agente de ingeniería. **No es documentación
narrativa.** Nunca contiene secretos.

**Autorización:** Phase 4B Build Authorization · 2026-09-20 · Ana Victoria.
**Autoridad derivada de:** `docs/PRODUCT_UX_CONTRACT.md` v1.0 · `docs/PHASE_4B_PREAUTHORIZATION.md`
· `architecture/ADR-013` · `architecture/ADR-012` anexo v1.5 · `docs/PLANNER_CONTRACT.md` v1.4
superseded en §C §I.2 §I.3 §J §O §T §V §Z · `docs/LEARNING_ENGINE_CONTRACT.md` v1.1 · ADR-011.

---

## 0 · Fronteras prohibidas · vigentes en todo momento

PRODUCTION · AQUO · Phase 1B · corpus oficial TAI · infraestructura de pago · mastery numérica ·
retención/decaimiento/intervalos de repaso · autoridad de IA · PLAN · PROGRESO · ENTRENAR ·
Rescue como modo · notas/tutor/sync · marca externa · prototipo paralelo desechable.

`engine`, `content` e `ingest` siguen **sin exponer** (ADR-011). La superficie de RPC invocable por
cliente sigue en **dos**: `append_learning_event`, `create_study_session`.

STAGING solo se muta tras revisión de migración y pruebas en verde. PRODUCTION nunca.

---

## 1 · Estado actual

| Campo | Valor |
| --- | --- |
| Rama | `phase/4b-product-integration` |
| Base | `852a9c99e4eb60c3debee0f2e3fd215d2cceb735` (`main`, PR #22 integrado) |
| HEAD | `7da5377` |
| Último commit verde conocido | **`7da5377` · CI completo en verde** (árbol `e00853d398faa2440a5872911a94745eac513084`): typecheck, lint, format, 1241 unitarias, guardas, secret-scan, db:roundtrip, integración 696/696, RLS 218/218, E2E 36/36. La deriva de esquema falla solo porque STAGING va por detrás |
| Árbol local | limpio |
| STAGING | **Migrado a 24** (25 migraciones en el ledger) el 2026-09-21 con `tools/db.mjs push` por el pooler de sesión `aws-1-eu-west-1`; catálogo verificado. **Corpus `preview-4b-fundamentos` sembrado**: 8 conceptos, 7 unidades con duración, 18 preguntas, todo GENERATED |
| Preview | **Funcional y navegable.** `dpl_PLtrT6rfxFcwphu5fTxkqnx4PQj4` (commit `aa21cf3`), URL `study-a6xnjrkpo-study-os6.vercel.app`. **Smoke completo: 45 pasos, todos en OK**, y el camino de una cuenta nueva verificado en navegador real sin teclear ninguna ruta, hasta HOY con plan (5 acciones · 26 min) |
| Credencial de servicio de Preview | **Corregida.** `SUPABASE_SERVICE_ROLE_KEY` existe (id `7GH5THmlKE1oeEkL`), Sensitive, `target: ["preview"]`, editada `2026-11-12T15:50:33Z`. La variable mal nombrada `service_role_key` (que además estaba en Production) fue eliminada. Production no contiene ninguna credencial de STAGING |

---

## 2 · Bloques

| # | Bloque | Estado | Commit |
| --- | --- | --- | --- |
| 0 | Línea base y log de continuación | **HECHO** | `ee496b5` |
| 1 | Migración 24 · esquema y fronteras (§11 completa, más R-8) | **HECHO** | `65e2499` |
| 2 | Dominio, registro de autoridad y cierre de OBS-4B-03 | **HECHO** | `b4a2472` |
| 3 | Runtime del Planner, HOY real y sistema visual L2 | **HECHO** | `5c256aa` |
| 4 | Superficies de sesión, /ajustes, replanificar, tipografía | **HECHO** | `8344172` |
| 5 | Corpus sintético de Preview | **HECHO** | `6a567b7` |
| 6 | Readout de validación de producto | **HECHO** | `228087d` |
| 7 | Puertas duras contra la frontera real | **HECHO** | `55a2e11` |
| 8 | Zona horaria en el onboarding, /fin sin doble final, E2E al bucle real | **HECHO** | `3a89abf` |
| 9 | Convergencia de CI · arnés y guardas | **EN CURSO** | `8a639b6` |
| 10 | STAGING migrado y corpus sembrado | **BLOQUEADO** · espera el job de base de datos en verde | — |
| 11 | Recorrido humano en Preview (P4-G18) | **BLOQUEADO** · espera OBS-3.1-01 | — |

---

## 3 · Tarea siguiente exacta

1. **Esperar el job «Base de datos» de CI** sobre `55a2e11`. Es la prueba desde cero, el
   roundtrip y las suites de integración, RLS y E2E. Docker no está instalado en la máquina de
   desarrollo, de modo que CI **es** la prueba local: su stack es el mismo.
2. Con ese job en verde, **migrar STAGING** y sembrar el corpus. Solo entonces, y no antes:

   ```bash
   node --env-file=.env.staging.local tools/db.mjs push
   node --env-file=.env.staging.local tools/seed-preview-corpus.mjs
   ```

   Eso pone en verde el job de deriva de esquema, que **falla a propósito** mientras STAGING esté
   por detrás del repositorio.
3. Pedir a Ana la única acción humana que queda (§4) y, al confirmarla, provocar un redespliegue
   de Preview para que el runtime la recoja.
4. Recorrido humano de Ana sobre el Preview (P4-G18) y checkpoint.

---

## 4 · Acciones humanas pendientes

### OBS-3.1-01 · la credencial de rol de servicio del entorno Preview

**Investigado antes de preguntar, como exige la autorización §24. Estos son los hechos:**

| Pregunta | Respuesta verificada |
| --- | --- |
| ¿La necesita el runtime de Preview? | **Sí, y sin ella el bucle de Phase 4B no funciona.** `tryCreatePlannerClient` y el cliente del motor leen `readServerConfig()`, que la exige. Sin ella `requestPlanForUser` devuelve `SKIPPED · SIN_CONFIGURACION_DE_SERVIDOR`, y HOY muestra `CANNOT_PLAN`: no hay plan, no hay sesión y no hay evidencia. |
| Alcance exacto | **Solo `Preview`.** No `Production`, que sigue sin desplegarse. |
| Nombre exacto de la variable | **`SUPABASE_SERVICE_ROLE_KEY`**, declarada en `packages/config/src/server-env-keys.ts`. |
| ¿Puede configurarla un conector autorizado **sin exponer el valor**? | **No.** Se consultó el proyecto de Vercel: la variable **no existe en ningún entorno**; solo están las tres públicas, en `Production` y en `Preview`. No hay ningún valor que reapuntar de un entorno a otro, que habría sido la única vía de configurarla sin manejar el secreto. Crearla exige aportarlo, y eso significaría que un agente maneje una clave de rol de servicio: EC-010 y §7 lo prohíben. |
| ¿Configurarla provoca un redespliegue? | **No automáticamente.** Vercel aplica las variables a los despliegues **nuevos**; el Preview ya desplegado conserva el entorno con el que se construyó. Hace falta un redespliegue después, y lo puedo provocar yo. |
| ¿Hay alguna alternativa que no debilite la arquitectura? | **No, y las tres que existen la debilitan.** Exponer `engine` o `ingest` al Data API rompería ADR-011. Hacer el Planner invocable por el cliente rompería §U.4 e INV-113. La clave anónima no atraviesa RLS y no puede hacerlo. **Ninguna se implementa.** |

**La acción, y es solo una:** en el panel de Vercel del proyecto `study-os`, añadir la variable
`SUPABASE_SERVICE_ROLE_KEY` con alcance **Preview**, y como valor la clave `service_role` de
**STAGING** — la que ya está en `.env.staging.local`.

**Lo que no se hace:** no se pega el valor en la conversación ni en el repositorio; no se usa la
clave de PRODUCTION; y no se añade al alcance `Production`.

**Cómo se confirma:** basta con decir «hecho». La comprobación real es que HOY deje de mostrar
«No hemos podido preparar tu plan» y muestre una acción, lo que además demuestra que el runtime la
está leyendo de verdad y no solo que existe la variable.

### OBS-4B-04 · `CANNOT_PLAN` no es observable

Registrada, **no resuelta**. Los otros tres estados vacíos son resultados persistidos de una
ejecución; `CANNOT_PLAN` significa que **no se escribió ninguna**, así que por construcción no hay
fila que contar. Registrarlo exigiría un tipo de evento nuevo en la taxonomía del CDEM, que esta
fase no autoriza. Si el recorrido humano lo encuentra a menudo, esa observación es la que abre la
decisión.

---

## 5 · Bitácora

### 2026-09-20 · bloque 0

Línea base reconstruida del repositorio, no de memoria. Verificado: migraciones 0–23, cinco
paquetes, `apps/web` con el vertical del FPS vivo y `apps/web/src/server/planner` construido pero
**sin consumidor de ruta**. `start_planned_session` no copia `presented_*` (Q-3 pendiente).
`create_planner_run` reutiliza sin predicado de consumo (P4B-D2 pendiente). `planner_budget` no
conoce el override (P4B-D3 pendiente). `DURATION_PROVENANCES = ['FIXTURE']`.

### 2026-09-20 · bloques 1–3

**Hecho.** Migración 24 con su `down/` (§11 completa, más R-8). Dominio y registro de autoridad.
OBS-4B-03 cerrada. Runtime del Planner con duración `HYBRID_V1`. HOY real con S2 … S10. Sistema
visual L2. Retirada de la selección fija del camino de aprendiz.

**Guardas de alcance negativo retiradas por autorización (P4-G36),** ninguna en silencio y cada una
con su sustituta nombrada en el mismo bloque: duración, sustrato del Planner, override del día,
P4-D2 diferida, consumo del Planner por una ruta, espejo de esquemas de evento, inventario de
migraciones de Phase 3, matriz de privilegios de `catalog.security`, lista de superficies vigiladas.

**Descubierto en CI, y es correcto:** el job de deriva de esquema **falla a propósito** mientras
STAGING esté por detrás del repositorio. El diff que reporta es exactamente el contenido de la
migración 24 y nada más, lo que además demuestra que la base sombra se construye desde cero sin
error. Se pondrá en verde al migrar STAGING, y no antes.

**Docker no está instalado en esta máquina.** La prueba desde cero, el roundtrip y las suites de
integración, RLS y E2E las ejecuta CI sobre su stack local, que es el mismo. STAGING no se muta
hasta que ese job esté en verde.

**Siguiente:** `/ajustes` (S12), `/hoy/replanificar` (S21), las tres superficies de sesión con
cabecera de acción, tipografía IBM Plex Sans, corpus sintético, telemetría y readout.

### 2026-09-21 · convergencia de CI y reescritura de los E2E

**Lo que CI enseñó, en tres rondas.** Docker no está en la máquina de desarrollo, de modo que las
suites con base de datos solo se ven en CI. Cada ronda descubrió una clase distinta de consecuencia
de las decisiones de Phase 4B, y ninguna era un fallo de las decisiones: eran lugares del arnés que
todavía describían el mundo anterior.

**Ronda 1 · R-8 rompió el fixture compartido.** `createLearner` pasaba por `set_availability`, que
emite `AVAILABILITY_CHANGED`, y ese evento **consume la posición 1 del stream**. Una decena de
pruebas de ADR-008 afirman, con razón, que el primer evento de una persona recibe la posición 1. El
fixture vuelve a escribir la fila con el rol de servicio y sin emitir la declaración; el camino real
se prueba en `rls.userIsolation.phase2` y en `phase4b.hardGates`, que es donde le toca.

**Ronda 2 · dos defectos míos.**

1. `RUN_ALREADY_CONSUMED` no estaba en la lista de rechazos de `startPlannedSession`, así que
   lanzaba en vez de devolverlo: un identificador caducado producía un error en lugar del estado
   S20.
2. Mi prueba de `NO_DURATION_METADATA` **desactivaba un trigger** para poner la columna a nula. Si
   el caso falla entre el `disable` y el `enable`, el trigger se queda desactivado para todas las
   suites que comparten la base, y la siguiente que comprueba que el contenido publicado es
   inmutable **pasa creyendo que lo comprueba**. Ocurrió. Se retiró, y la propiedad se cubre en tres
   piezas: la ingestión exige la duración, el motor puro excluye sin ella (`planner.durationAuthority`,
   sin DDL) y la ejecución declara su procedencia.

**Ronda 3 · una lección de arnés y una de concurrencia.** Puse la sustituta de una guarda retirada
al principio de `planner.runtime`, y pedir un plan **escribe** una ejecución: esa suite cuenta
ejecuciones, y cuatro casos que seguían siendo ciertos se rompieron. Se movió a donde no molesta. Y
la exclusión diferida de sesión única puede rechazar nombrándose o por abrazo mortal: se admiten las
dos formas, sin relajar la invariante, que sigue siendo «exactamente una abierta».

**Lo que faltaba de verdad, y se implementó al mirar los E2E:**

- **§O · el onboarding declara la zona horaria**, y es obligatoria: sin ella no existe «hoy» y
  terminar sin declararla dejaba a la persona en un estado que no puede hacer nada.
- **UX-INV-18 · `/fin` pierde la pantalla previa** · **FPS-OBS-03 cerrada**. El cierre pasa a la
  acción que la persona pulsa. Hacerlo al renderizar habría sido más corto y estaba mal:
  `SESSION_COMPLETED` es un evento y ningún render emite evidencia.
- **Dos frases que dejaron de ser ciertas**: `/fin` y el onboarding decían que no había plan. Era
  exacto en el FPS y es falso desde que el Planner decide; dejarlo sería EC-012 al revés.

**Los E2E se reescribieron al bucle que el Planner produce de verdad.** Asumían la sesión fija de
cinco pasos. Con granularidad híbrida, un concepto `NEW` recibe **solo APRENDER**; COMPROBAR llega
cuando está `EXPOSED`, y para estarlo hay que haber completado su lectura. Por eso el recorrido tiene
dos días, y **que haya que escribirlo así es la prueba** de que el plan responde a la evidencia y no
a un guion. El paso del día se simula retrasando los `completed_at` de los ítems completados: es
estado de sesión, no evidencia, y ningún evento se toca.

**OBS-4B-04 registrada:** `CANNOT_PLAN` no deja rastro consultable, porque por construcción no
escribe ejecución.

### 2026-09-21 · verde completo

CI en verde sobre `7da5377`. Lo que la última ronda encontró, y dos eran defectos de producto reales: la cabecera de acción no se pintaba nunca (`findOpenSession` no seleccionaba `planner_run_id`), y dos textos en `slate` sobre canvas a 4.31:1 (wordmark y superficie de decisión con fondo semitransparente). Lo midieron los E2E con la auditoría renderizada.

**Siguiente:** `STUDY_OS_DESTRUCTIVE_AUTHORIZATION=staging:db-push node --env-file=.env.staging.local tools/db.mjs push`, verificación del catálogo, `tools/seed-preview-corpus.mjs`, redespliegue de Preview.

### 2026-09-21 · STAGING migrado y corpus sembrado

La URL directa `db.<ref>` es solo IPv6 y no resuelve desde la máquina de desarrollo; se usó el pooler en modo sesión, **`aws-1`** (el `aws-0` no conoce el tenant), derivado en memoria de las credenciales existentes sin imprimirlas. Verificado después: ledger en 24, `planner_config` v1 SUPERSEDED y v2 ACTIVE, RLS forzado en `learner_day_overrides`, ninguna concesión de cliente en las nuevas vías de escritura, esquemas privados intactos.

**Aviso de uso:** el pack antiguo `demo-estudio-eficaz` se publicó antes de la migración 24 y sus unidades no tienen duración: con él el Planner excluye todo por `NO_DURATION_METADATA` y HOY dice con verdad que no hay nada que recomendar. Para probar hay que elegir el pack de Preview.

### 2026-09-21 · smoke test en Preview

Sin autenticar, `/hoy` redirige a `/entrar` ✔. Con una cuenta sintética creada y borrada por la API de administración, HOY responde **500**. Logs de Vercel: `contexto del Planner: Legacy API keys are disabled`. La identidad sí se verificó —la petición llegó al Planner—, así que la clave anónima funciona; falla solo la de servicio. En local funciona porque `.env.staging.local` usa las claves nuevas (`sb_secret_` / `sb_publishable_`). No hay fuga: ninguna `sb_secret_` en el bundle de cliente.

**Continuación exacta:** cuando Ana sustituya el valor, provocar un redespliegue de Preview (un commit en la rama basta) y volver a ejecutar el smoke test (`scratchpad/smoke.mjs`, copiado a `test-results/`, con `SHARE_TOKEN` de `get_access_to_vercel_url`).

### 2026-11-12 · STAGING despausado y segundo intento de Preview

**STAGING estaba `INACTIVE`**: Supabase pausó el proyecto tras ~2 meses sin uso, y el primer intento de smoke falló con `fetch failed` antes de la primera llamada. Restaurado con el conector oficial (`restore_project`, sin coste, solo STAGING). Verificado después: migración 24 intacta, `planner_config` v1 SUPERSEDED y v2 ACTIVE, corpus completo (8 conceptos, 7 unidades con duración, 18 preguntas).

**La credencial de Preview no cambió.** La API de Vercel da `updatedAt = 2026-09-21T07:43:42Z` para `SUPABASE_SERVICE_ROLE_KEY`, anterior al despliegue de hoy (14:47:58Z): la edición no llegó a guardarse. El runtime sigue rechazando con `Legacy API keys are disabled`, de modo que el valor es todavía la `service_role` heredada.

**Continuación exacta:** cuando el `updatedAt` de esa variable sea posterior, provocar un redespliegue (un commit en la rama basta) y volver a ejecutar el smoke test, que ya cubre el bucle completo.

### 2026-11-12 · la credencial de Preview, corregida al tercer intento

La primera edición no se guardó. La segunda creó la variable con el nombre `service_role_key`
y adscrita a **Production**, borrando la única que el runtime sabe leer: el contrato canónico es
`SUPABASE_SERVICE_ROLE_KEY` y lo fijan `packages/config/src/server.ts`,
`server-env-keys.ts`, `serviceRoleMarkers` del registro de autoridad y tres guardas bloqueantes.
No se renombró nada en el código: habría sido una enmienda de EC-010, no un ajuste de
configuración.

Estado verificado en la API de Vercel, sin leer ningún valor (las variables Sensitive devuelven
`value: ""` también al conector): la variable correcta existe solo en Preview, la incorrecta ya no
existe, y los únicos valores de Production siguen siendo los tres `NEXT_PUBLIC_*` de septiembre.

Lección operativa: **el nombre de una variable de entorno es parte del contrato**, y una
credencial adscrita al entorno equivocado es un defecto de seguridad aunque nadie la consuma.

### 2026-11-12 · Preview funcional · smoke completo de Phase 4B en verde

El despliegue `dpl_6DHNUf8XMRK6hBKkXbA7KpD6cYHT` quedó `READY` en 86 segundos. El bucle de
espera que lo vigilaba no terminó nunca por un defecto propio: esperaba `200|401|307|404` y la
raíz devuelve **302**. El estado real se obtuvo de la API, no del bucle.

**Smoke completo: 45 pasos, todos en OK.** Cubre onboarding por los caminos reales, HOY con plan
del Planner (`PLANNED · HYBRID_V1 · config v2`), reutilización de la ejecución en un render
repetido, INV-117, APRENDER con evidencia, FIN, proyección `EXPOSED` del motor, sucesora de
P4B-D2, día 2 con COMPROBAR, INV-103 antes del envío, INV-102, corrección devuelta por el
servidor (INV-101), pliegue de la evidencia nueva, override de disponibilidad a cero y vuelta,
y las comprobaciones de seguridad: `anon` no lee `planner_runs`, INV-118 rechaza
`TODAY_OVERRIDE_SET` emitido por cliente, `/hoy` sin sesión no sirve contenido y la clave de
servicio no aparece en el DOM.

Tres correcciones **del arnés**, ninguna del producto:

1. **El arnés escribía evidencia por el Data API.** `permission denied for table session_items`.
   El catálogo lo confirma: `service_role` tiene **solo `SELECT`** sobre `session_items`,
   `study_sessions` y `learning_events`. La frontera de Phase 2 está cerrada y el fallo era la
   prueba de que funciona. El único atajo legítimo del arnés es mover el reloj, y eso se hace
   ahora por SQL directo con el CLI fijado.
2. **La conexión directa no resuelve.** `db.<ref>.supabase.co` publica solo `AAAA`, y una máquina
   sin IPv6 da `getaddrinfo ENOTFOUND`. El arnés reescribe la URL hacia el pooler de sesión
   (`aws-1-eu-west-1`) sin leer ni imprimir la contraseña. **Afecta también a
   `tests/support/sql.ts`**, que lee `SUPABASE_DB_URL` tal cual: queda como OBS-4B-S2.
3. **Una aserción más fuerte que el contrato.** El arnés exigía que la sesión de día 2 fuera toda
   de preguntas. La composición real es **5 preguntas y 1 lectura**, que es exactamente P4-D1:
   garantía existencial de reparación en la cabeza, continuidad de cobertura en el resto.

**Lo que este smoke no prueba, y hay que decirlo.** El envío de respuesta va por RPC, así que la
**ruta A del motor —`after()` dentro de la server action— no tiene llamador aquí**: lo que se
ejerce es la ruta B de Phase 3.1, el motor al volver a HOY. Es la misma lección de D-26, y se
aplica a sí misma: una ruta solo está probada cuando una prueba ejecuta el módulo real contra la
frontera real. La ruta A la cierra el recorrido humano, no esta suite.

**OBS-4B-S1 · la portada niega lo que ya existe.** `/` sigue anunciando «Phase 0 · Foundation ·
Todavía no existe contenido, ni motores, ni espacios de estudio». Es el mismo defecto que el
aviso de onboarding corrigió en esta fase, al revés: negar una capacidad que sí existe. No
bloquea el recorrido y **no se corrige sin autorización**.

### 2026-11-12 · el walkthrough humano se bloqueó, y OBS-4B-S1 era causal

Ana creó una cuenta y quedó atrapada en «Mi cuenta»: ninguna navegación llevaba al onboarding
ni a HOY. **El smoke en verde y el producto inalcanzable, a la vez.**

**Causa raíz · tres eslabones, todos de navegación.** Ninguno es de Planner, de motor, de
esquema ni de contrato académico.

1. **El destino de la entrada era de Phase 0.** `signUpAction`, `signInAction` y el proxy
   mandaban a `/cuenta`, que era el único destino autenticado que existía cuando se escribieron
   y que nunca se revisó al aparecer `/hoy`. El Product UX Contract §O dice «ENTRADA └─ HOY ·
   único destino» y sitúa `/cuenta` **fuera del vertical**. La implementación contradecía al
   contrato aprobado.
2. **La portada era la otra mitad del callejón.** Su única navegación autenticada era «Ir a mi
   cuenta». **OBS-4B-S1 no era una observación aparte: era causal.** Se corrige, y el copy que
   negaba el producto desaparece con ella.
3. **`/ajustes` no tenía vuelta a HOY.** Y una cuenta nueva pasa por ahí **a la fuerza**: el
   Planner resuelve la zona horaria **antes** que el objetivo, de modo que S3 manda a `/ajustes`
   antes que a ningún otro sitio. Declarabas la zona y te quedabas sin salida salvo el botón
   atrás. `/fin` y la confirmación de replanificar ya tenían la suya; esta se quedó sin ella.

**Por qué ninguna prueba lo vio, que es lo que importa.** Todas las E2E abrían `/onboarding`
**tecleando la ruta**. La suite ejercitaba las pantallas y nunca el grafo que las une, así que
1241 unitarias, 36 E2E y 45 pasos de smoke podían estar en verde con el producto inalcanzable.
Es la lección de D-26 un nivel más arriba: entonces una ruta de runtime sin llamador, ahora una
ruta de navegación sin recorrido. Se añade un caso que va de la portada a HOY **sin escribir
ninguna ruta salvo la portada**; si vuelve a aparecer un callejón, falla ahí.

**Ficheros.** `apps/web/src/app/actions/auth.ts`, `apps/web/src/proxy.ts`,
`apps/web/src/app/page.tsx`, `apps/web/src/app/cuenta/page.tsx`,
`apps/web/src/app/ajustes/page.tsx`, y cinco de pruebas.

**`engine.runtime` pasa a `test.slow()`, y está medido.** En el árbol **anterior** ese caso
tardaba 56,7 s y 56,2 s contra un límite de 60 s: el margen era de tres segundos. Al pasar la
entrada por HOY, el alta resuelve un plan y ese margen desaparece. No se acelera el sondeo ni se
afloja ninguna aserción: se corrige un límite que estaba calibrado al segundo contra una
duración ajena a la prueba.

**OBS-4B-S3 · el selector de examen mostraba los packs de fixture.** Las suites que agotaron el
tiempo no llegaron a su purga y dejaron siete `fixture: pack sintético …` en el selector de
onboarding, delante del pack de Preview. Se purgaron **uno a uno, por identificador**, tras
comprobar que los siete eran del día y que ninguno tenía objetivos asociados; la FK `RESTRICT`
habría impedido borrar contenido que la evidencia de alguien todavía resuelve. STAGING queda con
dos packs, las dos cuentas de Ana y ninguna cuenta sintética.

**Verificación del recorrido, en navegador real.** Portada → «Crear cuenta» → alta → **HOY**
(pide la zona) → «Elegir mi zona horaria» → `/ajustes` → confirmar → «Volver a Hoy» → **HOY**
(pide el examen) → «Elegir examen» → `/onboarding` → guardar → «Empezar a estudiar» → **HOY con
plan**: «5 ACCIONES · 26 MIN · HOY TIENES 30 MIN · Aprender · 5 min · Esto es nuevo para ti».
Ninguna ruta tecleada. La cuenta sintética se borró al terminar.

**Lo que estas comprobaciones no cierran.** La **ruta A** del motor —`after()` dentro de la
server action— sigue sin ejercerse por el smoke, que envía por RPC. La cierra el recorrido
humano al responder una pregunta desde la interfaz, y sigue pendiente.

**Estado de los controles.** typecheck, lint, format, las seis guardas y `secret-scan` en verde;
1241 unitarias; 70 E2E estáticas; **38 E2E de auth, todas en OK**; RLS 218/218. La integración
da fallos **no deterministas** (8 en una ejecución, 17 en otra, con conjuntos distintos) cuyo
mensaje es `canceling statement due to statement timeout`: es saturación de STAGING bajo carga
concurrente, no regresión. Ejecutados en aislamiento, `engine.projection` y `planner.runtime`
pasan 43/43. Ningún fichero de esquema, dominio o servidor de Planner o motor se ha tocado.

### 2026-11-12 · segundo bloqueo del walkthrough · `NO_DURATION_METADATA`

El bloqueo de navegación quedó superado. El segundo bloqueo **no es un defecto de runtime**: HOY,
el Planner y el motor hicieron exactamente lo que el contrato manda. Lo demuestra la auditoría
del propio Planner, no una inferencia.

**La cuenta.** El recorrido se hizo con la cuenta **de septiembre**, no con la creada hoy. Tiene
un objetivo **`ACTIVE` desde el 2026-09-09 sobre `demo-estudio-eficaz`**, el pack del
FPS: 3 conceptos, 2 unidades, 5 preguntas, ya recorrido entonces (2 sesiones, 63 eventos). Zona
`Europe/Madrid` y disponibilidad quedaron declaradas hoy; antes faltaban, de ahí S3.

**Por qué ganó S8 y no S2.** El orden de precondiciones es zona → objetivo → presupuesto. Su
objetivo **existe**, así que `NO_ACTIVE_GOAL` no podía dispararse: la precedencia funcionó.
Declarada la zona, el Planner corrió y devolvió `RUN{NOTHING_ELIGIBLE}` → **S8**.

**Por qué nada fue elegible.** `planner_run_audit` del run de hoy (`plan_day` 2026-11-12,
presupuesto 20 min, `consumed_position` 63) registra la exclusión concepto a concepto:

| Estado | Exclusión registrada |
| --- | --- |
| `EVIDENCE_POSITIVE` | `POSITIVE_NO_REVIEW_POLICY` · correcto: no es elegible en v1 y no se recicla |
| `EVIDENCE_CONFLICTING` | **`NO_DURATION_METADATA`** |
| `EVIDENCE_CONFLICTING` | **`NO_DURATION_METADATA`** |

Los dos conceptos **sí eran reparables** —`EVIDENCE_CONFLICTING` lo es por contrato, con
`REAPRENDER + COMPROBAR` atómico— y cada uno tenía su unidad publicada y dos preguntas sin
responder. Se excluyeron porque su unidad llega con `minutes: null`: ADR-013 §2.5 excluye con
razón propia lo que no tiene duración, en lugar de inventarse un número.

**El dato de fondo.** Ninguna unidad del pack de septiembre tiene duración declarada:

| Pack | Versiones de unidad | Con duración |
| --- | --- | --- |
| `demo-estudio-eficaz` | 2 | **0** |
| `preview-4b-fundamentos` | 7 | **7** |

El pack del FPS se sembró antes de que la duración fuese exigible (P4-D2 se resolvió el
2026-11-12 con ADR-013) y nunca se le añadió. **Diferencia con la cuenta sintética:** aquélla
eligió `preview-4b-fundamentos`, con duraciones y contenido sin tocar, y obtuvo plan.
Clasificación: **datos de contenido parciales** sobre un objetivo legado, no bug de precedencia,
no onboarding mal marcado, no CTA ausente en HOY.

**OBS-4B-H01 · no hay camino de recuperación, y no se puede inventar.** Desde S8 no se puede
ofrecer nada: el Product UX Contract da a S8 «primaria **ninguna**, secundaria **ninguna**», y
UX-INV-8 dice que **S8 no presenta ninguna acción contextual**. El cambio de objetivo tampoco
existe en ninguna otra superficie, y §O no define ninguna donde pudiera vivir. A la vez,
`/onboarding` **afirma** «Tu objetivo y tu disponibilidad están guardados. Puedes cambiarlos
cuando quieras» sin ofrecer cómo: eso sí es EC-012. Construir esa superficie es diseño nuevo,
así que queda **`BLOCKED_DECISION`**: tres salidas posibles, ninguna aplicada.

1. **Dar duración al pack legado por supersesión** (SD-021 por analogía; el contenido publicado
   no se edita). Devuelve a la cuenta de septiembre un plan de reparación real con sus dos
   conceptos. Corrige contenido, no producto.
2. **Definir dónde se cambia de objetivo** y construirlo. Es la salida completa y la única que
   cierra la afirmación falsa de `/onboarding`, pero es diseño que §O no cubre.
3. **No hacer nada en la cuenta de septiembre** y continuar el walkthrough con la cuenta que Ana
   creó hoy, que está limpia y puede elegir `preview-4b-fundamentos`.

Para desbloquear hoy basta la 3, que no toca ni un dato ni una línea. **Recomendada**, dejando 1
y 2 como decisión aparte.

**OBS-4B-HVIS-01** · la línea vertical del sistema aparece pegada o superpuesta al bloque de
identidad en el viewport del walkthrough. Registrada, **sin corregir**: no es causal de nada de
lo anterior. Revisión visual posterior.

**OBS-4B-HUX-01** · en `/ajustes`, tras guardar, la continuación es «Volver a Hoy». Es el enlace
que se añadió hoy para que la pantalla dejara de ser un callejón. Queda **registrada para
revisión contra el Product UX Contract**, sin cambiarla por preferencia.

**Nada que desplegar.** Ningún cambio de runtime: el Preview vigente sigue siendo
`study-a6xnjrkpo-study-os6.vercel.app` (`aa21cf3`). La cuenta de Ana, su objetivo y sus 63
eventos quedan **intactos**: este diagnóstico fue de solo lectura.

### 2026-11-13 · reconciliación del LEARN + CHECK humanos · todo cuadra

Walkthrough humano sobre `preview-4b-fundamentos`, dos días reales, sin manipular el reloj.
Reconciliación **de solo lectura**: no se tocó un dato. Los conceptos se nombran C1…C8, sin
identificadores.

**Secuencia reconstruida.** Cinco ejecuciones del Planner, tres sesiones, 43 eventos.

| Día | Run | Resultado | Presupuesto | Sesión |
| --- | --- | --- | --- | --- |
| 12 | 1 | `PLANNED` 6 acciones · 36 min | 40 (jueves) | 6 unidades, 2 completadas · interrumpida |
| 12 | 2 | `PLANNED` 5 acciones · 39 min | 40 | 5 unidades, 5 completadas |
| 12 | 3 | `NOTHING_ELIGIBLE` | 40 | — |
| 13 | 4 | `PLANNED` 6 acciones · 18 min | 20 (viernes) | **6 preguntas, 6 completadas** |
| 13 | 5 | `PLANNED` 1 acción · 3 min | 20 | sin arrancar |

El presupuesto cambia 40 → 20 porque la disponibilidad declarada tiene jueves 40 y viernes 20,
con `budget_source = WEEKLY_ENTRY`. El `plan_day` avanza solo, derivado de `Europe/Madrid`.

**Ruta A · demostrada, no inferida.** `engine.mastery_history` registra **un pliegue
`INCREMENTAL` por cada envío**, entre 1,8 y 2,8 s después, y antes de volver a HOY:

| `ANSWER_SUBMITTED` | pliegue hasta | Δ |
| --- | --- | --- |
| 11:01:41,59 → 21 | 11:01:44,39 · `17→21` | +2,8 s |
| 11:03:46,67 → 25 | 11:03:49,52 · `21→25` | +2,8 s |
| 11:04:56,94 → 29 | 11:04:59,35 · `25→29` | +2,4 s |
| 11:05:31,22 → 33 | 11:05:32,99 · `29→33` | +1,8 s |
| 11:06:11,44 → 37 | 11:06:13,25 · `33→37` | +1,8 s |
| 11:06:47,07 → 41 | 11:06:49,71 · `37→41` | +2,6 s |

Eso es `after()` dentro de la server action, seis veces. **La ruta A queda ejercitada y D-26
cerrado también por el camino humano.** El séptimo pliegue, `41→43`, ocurre a las 11:07:23,58 —
21 s después del cierre de sesión y 0,67 s antes de la quinta ejecución del Planner—: es la
**ruta B**, al volver a HOY. Watermark final **43**, igual al último evento: sin atraso.

**Pliegue por concepto.** Seis preguntas, seis conceptos distintos, sin atribución cruzada. En
los cinco fallos `last_negative_position` coincide exactamente con la posición del envío.

| Concepto | Resultado · confianza | Estado | `last_negative_position` |
| --- | --- | --- | --- |
| C1 | incorrecta · 4 | `EVIDENCE_NEGATIVE` | 21 |
| C2 | incorrecta · 3 | `EVIDENCE_NEGATIVE` | 25 |
| C3 | **correcta** · 2 | `EVIDENCE_POSITIVE` | — |
| C4 | incorrecta · 4 | `EVIDENCE_NEGATIVE` | 33 |
| C5 | incorrecta · 3 | `EVIDENCE_NEGATIVE` | 37 |
| C6 | incorrecta · 4 | `EVIDENCE_NEGATIVE` | 41 |
| C7 | leído, nunca comprobado | `EXPOSED` | — |
| C8 | — | `NEW` · sin unidad publicada | — |

La confianza viaja a su celda del vector (`incorrect[4]`, `incorrect[3]`, `correct[2]`), con
`temporalAnomalyCount` 0 y `unratedCount` 0. Ninguna puntuación numérica: solo el vector y el
estado categórico.

**Integridad.** 6 intentos y 6 items: ningún item con más de un intento, `attempt_number` 1 en
todos. 43 eventos, posición máxima 43, 43 posiciones distintas: **stream contiguo, sin huecos ni
duplicados**, ningún `payload_hash` repetido. Cero intentos sin confianza, cero sin clave de
respuesta fijada, **cero discrepancias entre la representación presentada y la del intento**.
`CONFIDENCE_RECORDED` precede a `ANSWER_SUBMITTED` en los seis (INV-102), y la corrección la
fija el servidor en `graded_at`, entre 0,07 y 0,28 s después del envío (INV-101).

**Por qué HOY ofrece ahora 1 acción · COMPROBAR · 3 min.** La auditoría del quinto run lo dice
concepto a concepto: los seis trabajados hoy salen por **`COMPLETED_TODAY`**, C8 por
`NO_PUBLISHED_UNIT`, y **C7 queda sin exclusión**. El ítem planificado es `CHECK` con
`composition_reason = COVERAGE`, sobre una pregunta **que nunca se ha respondido**. Es el
concepto que se leyó ayer y no se comprobó hoy: **comportamiento correcto y pregunta distinta
pendiente**, no repetición ni defecto de consumo.

**Y por qué el día 1 terminó en `NOTHING_ELIGIBLE`.** La auditoría de aquel run: siete conceptos
`EXPOSED` excluidos por `COMPLETED_TODAY` y uno `NEW` por `NO_PUBLISHED_UNIT`. Al cambiar el día
esa exclusión decae y los mismos conceptos pasan a ser elegibles para comprobar. **El cambio
natural de `plan_day` explica legítimamente la aparición del CHECK**, sin tocar el reloj.

**Ningún defecto encontrado.** Tres observaciones menores, ninguna causal:

- **OBS-4B-H02** · el pack de Preview tiene 8 conceptos y 7 unidades: C8 no tiene unidad
  publicada y por tanto **nunca será planificable**. Es `NO_PUBLISHED_UNIT` funcionando
  (OBS-4A-B1), pero el corpus sembrado deja un concepto inalcanzable.
- **OBS-4B-H03** · `question_attempts.response_ms` llega nulo: el cliente no lo envía. No afecta
  a ninguna invariante y el Planner no lo usa por diseño; es un hueco de telemetría.
- **OBS-4B-H04** · `learning_events.engine_processed_at` queda nulo: la autoridad de avance es
  `projection_watermarks` (ADR-008), así que el campo no se rellena. Coherente con el diseño, pero
  invita a leerlo como atraso cuando no lo hay.

Siguen abiertas **OBS-4B-HVIS-01** (línea del sistema junto al bloque de identidad) y
**OBS-4B-HUX-01** (continuación desde `/ajustes`), **sin corregir**.
