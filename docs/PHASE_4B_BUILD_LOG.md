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
| Preview | despliegue automático de Vercel por rama; sin configuración nueva |
| Credencial de servicio de Preview | **Configurada por Ana** · `SUPABASE_SERVICE_ROLE_KEY`, tipo sensitive, alcance solo Preview (verificado sin leer el valor) |

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
