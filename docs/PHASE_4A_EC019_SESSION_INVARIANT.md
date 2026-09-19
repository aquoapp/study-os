# STUDY OS · Phase 4A · EC-019 · invariante de una sola sesión abierta por persona

**Fecha:** 2026-09-19.
**Origen:** decisión humana del 2026-09-19 sobre **OBS-4A-B2** (P4-G10): **opción B, condicionada a
EC-019**. Invariante objetivo: **como mucho una sesión de estudio abierta por persona**, global, no
específica del Planner, impuesta por la base de datos para todo origen.
**Regla aplicada:** EC-019 — cambiar un invariante congelado exige análisis de impacto, plan de
migración y pruebas, y aprobación humana. La aprobación humana del objetivo existe; este documento
es el análisis que la condiciona.

## Resultado

**No hay contradicción con ninguna autoridad aceptada.** Ninguna establece varias sesiones abiertas
simultáneas como comportamiento del producto. Todas las pruebas congeladas afectadas son de **clase
A** (conveniencia del arnés). El invariante se implementa en base de datos y la regresión congelada
queda en verde sin debilitar ninguna aserción ajena a la concurrencia de sesiones.

## 1 · Autoridades inspeccionadas

| Autoridad | Nivel | Qué dice |
| --- | --- | --- |
| Master Product Specification §10 y estados vacíos | 1 | continuidad con cursor exacto; el estado vacío habla de «no active session», en singular |
| Canonical Data & Event Model §9 | 3 | `study_sessions` con `PLANNED · ACTIVE · INTERRUPTED · COMPLETED · ABANDONED`; no define concurrencia de sesiones |
| `docs/FPS_SCREEN_CONTRACT.md` (H-FPS-B) | FPS v1 | «Una sesión abierta **siempre gana**: nunca se ofrece crear otra mientras exista» |
| `docs/FPS_AUTHORIZATION_PACKET.md` · FPS-G3 | FPS v1 | con sesión abierta, HOY ofrece continuar y **no se crea nada** |
| `docs/PLANNER_CONTRACT.md` §N, §U.1, §V | Phase 4A | la sesión abierta gana; la unicidad se respalda en base de datos |
| `docs/PHASE_2_AUTHORIZATION_PACKET.md`, `docs/PHASE_2_CHECKPOINT.md` | Phase 2 | ninguna mención de sesiones abiertas simultáneas como comportamiento deseado |
| `docs/FPS_CHECKPOINT.md` | FPS | las dos sesiones de Ana son **sucesivas** (la segunda nace tras terminar la primera) |

«Abierta» es la familia autoritativa existente, sin cambios: `PLANNED`, `ACTIVE`, `INTERRUPTED`
(la que usa `findOpenSession` del FPS y el contexto del Planner).

## 2 · Superficies afectadas

| Superficie | Efecto |
| --- | --- |
| RPC `create_study_session` (Phase 2, congelada) | una petición **válida** hecha con otra sesión abierta del mismo aprendiz falla **al confirmar** con `23P01` (`study_sessions_one_open_per_user`). Antes creaba una segunda sesión. Validación, propiedad, ítems, semántica de eventos y forma de retorno **no cambian** |
| Orden de errores de `create_study_session` | **se conserva**: la restricción es diferida, así que `GOAL_NOT_FOUND`, `TARGET_NOT_FOUND`, `ITEMS_MALFORMED`, `SESSION_TYPE_MALFORMED`… siguen ganando (prueba `session.oneOpenPerLearner.spec`) |
| RPC `append_learning_event` | sin cambio. `SESSION_RESUMED` de una sesión `INTERRUPTED` no crea otra fila |
| Migraciones | solo la 23 (no integrada). Ninguna migración congelada se edita |
| Acción del FPS en HOY | una línea: si pierde la carrera contra otra creación simultánea (doble toque, otra pestaña), **continúa la sesión que ganó** en vez de mostrar un error. Antes esa carrera producía dos sesiones abiertas |
| Reanudación | sin cambio: la misma sesión, los mismos ítems, el mismo cursor; `INTERRUPTED` sigue contando como abierta |
| Arranque planificado | sin cambio de contrato: comprobación previa con el contador bloqueado y, si pierde una carrera, `OPEN_SESSION`; idempotente por ejecución |

## 3 · Concurrencia

Restricción de exclusión `EXCLUDE USING btree (user_id WITH =) WHERE status IN (…)`, **diferida**:
la garantiza el propio índice de la base, sin bloqueos de aplicación. Dos transacciones que abren
sesión a la vez para la misma persona no pueden confirmar las dos. Personas distintas no interfieren.

## 4 · Reversibilidad y compatibilidad histórica

- El `down` de la 23 elimina la restricción; nada más depende de ella.
- Las sesiones terminadas no cuentan; ninguna fila histórica se toca.
- **Precomprobación de STAGING (solo lectura, 2026-09-19):** 0 personas con más de una sesión
  abierta; 0 sesiones abiertas; las 2 sesiones de Ana están `COMPLETED`. Ningún dato real viola el
  invariante y ninguna evidencia se ha mutado.

## 5 · Pruebas congeladas afectadas y clasificación

Con el invariante aplicado y el arnés sin adaptar, fallan 12 ficheros de integración (61 casos: 50
por la restricción y el resto en cascada). RLS y E2E no se ven afectados.

| Clase | Definición | Casos |
| --- | --- | --- |
| **A1** · homogénea | el arnés abre una sesión **nueva por caso** para el mismo aprendiz y dejaba la anterior abierta por conveniencia; ninguna aserción trata de dos sesiones abiertas | `attempts.canonicalHashIsDeterministic`, `attempts.confidenceAndBlank`, `attempts.conflictDoesNotConsumeAttemptNumber`, `attempts.idempotentBeforeAttemptNumber` (2.º caso), `attempts.representationAuthority` (resto), `attempts.tripleMatchRequired`, `fps.redteam`, `fps.vertical`, `learningUnits.lifecycle`, `phase2.redteam`, `session.continuity` |
| **A2** · sonda, una a una | una prueba **reutilizaba** una sesión anterior después de abrir otra, o abría una segunda como sonda | `attempts.idempotentBeforeAttemptNumber` · «no puede responderse dos veces el mismo ítem»; `attempts.representationAuthority` · sonda de «B no es presentable sin su clave» |
| B · comportamiento afirmado de Phase 2 | — | **ninguno** |
| C · accidente histórico | que `create_study_session` admitiera una segunda sesión abierta: nunca se afirmó, la regla vivía en HOY | la propia RPC (se corrige con el invariante) |
| D · contradicción con autoridad | — | **ninguno** |

### Cómo se adaptan, sin tocar aserciones

- **A1 · un cambio de fixture, mecánicamente homogéneo.** `createSession` del arnés de Phase 2
  (`tests/support/phase2-fixtures.ts`) llama antes a `closeOpenSessions`, que cierra la sesión que el
  arnés dejó abierta **por la frontera real de eventos, como lo haría la persona**:
  `SESSION_COMPLETED`, precedido de `SESSION_STARTED` (si estaba `PLANNED`) o `SESSION_RESUMED` (si
  estaba `INTERRUPTED`). Añade solo la evidencia del cierre; no toca ninguna existente.
- **A2 · idempotencia.** «Un ítem completado no admite otra respuesta» se comprueba sobre la sesión
  abierta vigente, cuyo ítem acaba de completarse, con el **mismo recuento esperado** (3). Antes se
  comprobaba sobre la sesión del primer caso, que ya no puede seguir abierta junto a la segunda.
- **A2 · representación.** La sonda de «B no es presentable sin su clave» la hace **otra persona
  sintética que empieza ahora**, que es lo que el escenario describe. La aserción (`NO_ANSWER_KEY`)
  no cambia; la persona original conserva A presentada en su única sesión abierta.

Ninguna aserción se ha debilitado, eliminado ni reescrito.

## 6 · Fixture frente a semántica congelada

| Cambia | Qué |
| --- | --- |
| **fixture** | `closeOpenSessions` y su llamada en `createSession`; dos casos A2 |
| **semántica congelada** | una sola: `create_study_session` deja de poder crear una segunda sesión abierta del mismo aprendiz. Es exactamente el invariante aprobado |
| **FPS** | una línea en HOY para tratar la carrera como «continuar», coherente con FPS-G3 |

## 7 · Prueba

`tests/integration/session.oneOpenPerLearner.spec.ts` recorre los diez casos de P4-G10 contra la
base real, con concurrencia real (cinco creaciones simultáneas, planificada contra ajena al Planner,
la misma ejecución tres veces, ejecuciones distintas a la vez, cierre contra apertura, personas
distintas), un ataque por debajo de las funciones con la restricción en modo inmediato y la
conservación del orden de errores.
