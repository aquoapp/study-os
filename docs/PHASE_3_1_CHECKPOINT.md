# STUDY OS · Phase 3.1 · Learning Engine Runtime Invocation Corrective · CHECKPOINT

**Formato:** `Checkpoint Contract v1.0`.
**Alcance:** **candidato correctivo**. Sin merge, sin tag, sin congelación, sin `phase-3-v1.1`.
**Fecha:** 2026-09-16.
**Autorización:** `docs/PHASE_3_1_CORRECTIVE_AUTHORIZATION.md`.

`phase-3-v1.0` (`f5d0b101b58bae4d1003ea91f15ff0ecfe924f97`) es **inmutable** y conserva D-26 como
historia. Este checkpoint no la reescribe: registra el defecto, dónde se descubrió y el candidato
que lo corrige.

---

## A · Base exacta

| Campo | Valor |
| --- | --- |
| `main` congelada | `64158b5ad19e1edcc76c21f3dd50e86e884db058` |
| Implementación congelada con el defecto | `phase-3-v1.0` → `f5d0b10` |
| Rama | `phase/3.1-engine-runtime-corrective`, creada desde `64158b5` exacto |
| Candidato | la punta de la rama. El SHA no se escribe aquí: un documento no puede contener el hash del commit que lo contiene. Vive en el manifiesto del paquete y en el informe de cierre |

## B · D-26 · causa raíz

`apps/web/src/server/engine/run.ts` y `schedule.ts` seleccionaban los esquemas `engine` e
`ingest` en el cliente de PostgREST. Esos esquemas no están expuestos (ADR-011 anexo v1.1), y
PostgREST responde `PGRST106 · Invalid schema` **también al rol de servicio**:

- **ruta A** (tras aceptar una respuesta) fallaba siempre en la primera lectura; el fallo se
  capturaba y se registraba como aviso, de modo que la evidencia seguía aceptada y nada se
  veía roto;
- **ruta B** (`recoverStaleProjections`) **no tenía ningún llamador**.

**Por qué escapó a Phase 3.** Las suites del motor probaban el contrato durable por SQL directo
(`tests/support/engine-fixtures.ts`) y las pruebas de runtime solo miraban el **texto** de las
rutas. Ninguna prueba ejecutó el módulo real contra la frontera real. P3-G7 quedó en PASS en el
plano de la base de datos, no en el del runtime.

**Dónde se descubrió.** En la reconciliación de pre-autorización de Phase 4, al cruzar el runtime
con la afirmación del checkpoint de Phase 3 de que el Data API no sirve `engine` ni al rol de
servicio. STAGING lo confirmaba: evidencia de aprendiz y cero proyecciones.

## C · Arquitectura de invocación

| | `phase-3-v1.0` | Candidato Phase 3.1 |
| --- | --- | --- |
| Servidor → base | PostgREST con esquema `engine` / `ingest` → `PGRST106` | PostgREST con `public.engine_*` |
| Frontera | ninguna ejecutable | seis envoltorios en `public`, `SECURITY INVOKER`, `search_path` vacío, EXECUTE solo `service_role` |
| Esquemas privados | no expuestos | **no expuestos** · lista de exposición sin cambios |
| Ruta A | promesa suelta que fallaba | `after()` de Next tras aceptar la evidencia |
| Ruta B | sin llamador | `recoverProjectionOnReturn` en HOY, solo el aprendiz verificado |
| Semántica del motor | — | **sin cambios**: cada envoltorio delega sin transformar |

**Por qué `SECURITY INVOKER`.** El rol de servicio ya tenía USAGE sobre `engine` e `ingest` y
EXECUTE sobre cada función de destino. Un envoltorio con los privilegios de quien llama no
concede nada nuevo; es más restrictivo que el precedente `DEFINER` de la migración 13.

**Por qué `after()`.** Una promesa sin esperar no está garantizada una vez enviada la respuesta en
un runtime sin servidor; `after()` es el mecanismo de la plataforma para terminar trabajo
posterior a la respuesta, sin bloquearla.

## D · Ficheros

| Tipo | Ficheros |
| --- | --- |
| Migración | `supabase/migrations/00000000000021_engine_invocation_boundary.sql` · `down/…021….down.sql` · `.lock.json` (22 entradas) |
| Runtime | `apps/web/src/server/engine/run.ts` · `schedule.ts` · `apps/web/src/app/hoy/page.tsx` (una llamada, ningún cambio visible) |
| Registro | `packages/domain/src/authority-registry.json` · seis RPC reservadas de servidor ancladas en D-26 |
| Pruebas nuevas | `tests/integration/engine.runtime.spec.ts` (módulo real contra PostgREST) · `tests/e2e/auth/engine.runtime.e2e.ts` (aplicación construida) · `tests/unit/engine.invocationBoundary.spec.ts` |
| Pruebas ajustadas | `secret.redaction.spec` (extracción limpia, OBS-3.1-03) · `phase3.build.spec` y `phase3.governance.spec` (§L) · `phase1a.redteam` y `phase2.redteam` (`engine.` entra en las palabras privadas del OpenAPI) · `tests/support/sql.ts` (raíz sin `import.meta`, para poder usarse desde un E2E) |
| Gobernanza | `docs/PHASE_3_1_CORRECTIVE_AUTHORIZATION.md` · este checkpoint · `docs/ARCHITECTURE_STATE.md` §15 · `CLAUDE.md` §9 |

## E · Prueba antes/después del módulo real, en STAGING

Mismo aprendiz sintético, misma evidencia, misma configuración de servidor; solo cambia
`run.ts`:

| `run.ts` | Blob | Resultado de `runEngineForUser` |
| --- | --- | --- |
| `phase-3-v1.0` | `e013af97145f145fc6be51d4b62aff39222fe2fe` (idéntico al tag) | **falla** · `engine_config: Invalid schema: engine` |
| Phase 3.1 | `0fea74633415675e7efa72c21c2b38c8b7c343a3` | **APPLIED** · watermark 3 · rebuild |

## F · Ruta A en la aplicación real

`engine.runtime.e2e`, aplicación construida con `next build` y arrancada con `next start` contra
STAGING, móvil y escritorio: alta, onboarding, dos unidades y una respuesta **desde el
navegador**. Sin que la prueba invoque el motor, el watermark alcanza la posición máxima del
stream y la proyección persistida es **idéntica al pliegue completo** (CJF-1).

## G · Ruta B en la aplicación real

Mismo E2E: se acepta evidencia por la RPC de la aplicación sin pasar por la acción de servidor
—una invocación perdida a propósito—, la proyección queda atrasada, y basta con volver a HOY para
que el servidor la recupere hasta la posición máxima con proyección idéntica al pliegue completo.
HOY sigue mostrando exactamente lo mismo («Te quedaste aquí», «Sesión fija»), y una segunda
visita no escribe historial nuevo.

## H · Seguridad

| Ataque | Resultado |
| --- | --- |
| Las seis llamadas literales de `phase-3-v1.0` con rol de servicio | `PGRST106` las seis |
| Cada envoltorio como `anon` | denegado |
| Cada envoltorio como aprendiz autenticado, sobre otra persona y sobre sí mismo | `42501` |
| Un aprendiz intenta proyectar a otro | sin watermark ni fila creada |
| Catálogo | los seis `prosecdef = false`, `search_path=""`, EXECUTE solo `service_role` |
| Claves de respuesta | ni la instantánea de evidencia ni la de atribución las contienen |
| Estado del motor desde un aprendiz | `PGRST106` en las cuatro tablas |
| OpenAPI de servicio | no nombra ningún objeto de `content`, `ingest` ni `engine` |
| Registro | seis nombres en `rpcs`, ninguno en `clientInvokableRpcs` ni `readOnlyRpcs` |
| Exposición | `public` sigue siendo el único esquema expuesto |

Hallazgo durante la corrección: la primera redacción de los comentarios de función nombraba las
funciones privadas, y el OpenAPI que PostgREST sirve al rol de servicio los publica. Las guardas
de descubrimiento de Phase 1A y Phase 2 lo detectaron. Se reescribieron los comentarios y se
añadió `engine.` a las palabras privadas vigiladas, que faltaba desde el anexo v1.1.

## I · STAGING

- migración 21 aplicada; **roundtrip acotado**: 1 098 entradas de firma → down → 1 092 (solo los
  seis envoltorios retirados) → up → 1 098 con **firma idéntica**
  (`007c0014f3ff4c1a9535a525444f38533f9eb9f85ec2774b762f602fe0a2a091`);
- integración y RLS completas en serie: **797 pruebas en verde**;
- estado final: 22 migraciones, pack `demo-estudio-eficaz`, **cero filas del motor de pruebas**.

## J · Evidencia de aceptación de Ana

Intacta y comprobada por huella antes y después: 1 cuenta, 1 perfil, 2 sesiones, **62 eventos**
(`a4c11c4ec04d05c5c595a3cf54d6544c`) y **10 intentos** (`aeb10bc3be5843c596914e510ba0e372`).
Ninguna prueba la usa. Su proyección todavía no existe: se producirá, por la ruta B, la próxima
vez que vuelva a HOY con la aplicación corregida desplegada.

## K · Gates P3.1-G1 … P3.1-G12

| Gate | Resultado | Evidencia |
| --- | --- | --- |
| G1 acceso directo denegado | **PASS** | §H · seis `PGRST106` |
| G2 el módulo real invoca | **PASS** | §E · `engine.runtime.spec` |
| G3 ruta A sin acoplar la aceptación | **PASS** | §F · la evidencia se acepta antes; el fallo del motor no la toca |
| G4 ruta B con llamador real | **PASS** | §G |
| G5 repetición segura | **PASS** | tres invocaciones `UP_TO_DATE` sin escritura; segunda visita a HOY sin historial nuevo |
| G6 incremental == rebuild | **PASS** | integración y E2E contra el pliegue completo; rebuild forzado idéntico |
| G7 frontera de seguridad | **PASS** | §H |
| G8 sin fugas | **PASS** | §H |
| G9 STAGING extremo a extremo | **PASS** | §F · §G · §I · §J |
| G10 up/down/up | **PASS** en STAGING (§I); en CI lo cierra `db:roundtrip` sobre el candidato | |
| G11 regresión y CI | se cierra con la CI del candidato exacto, citada en el informe de cierre | |
| G12 alcance negativo | **PASS** | sin tablas, tipos, esquemas ni Planner; sin Phase 1B, readiness ni semántica nueva; PRODUCTION pausado; sin pago; sin AQUO |

## L · Vigilancias ajustadas, y por qué

- `phase3.build.spec` vigilaba el **texto** `void runEngineForUser(userId).catch(` y
  `rpc('stale_users'`: pasaba con ambas rutas rotas. Ahora vigila la forma sobre la frontera
  corregida, y la ejecución la prueban `engine.runtime.spec` y `engine.runtime.e2e`.
- `phase3.governance.spec` fijaba 21 migraciones. Ahora exige 22, con la 19 y la 20 como las de
  Phase 3 y la 21 como la única de Phase 3.1.

Ninguna vigilancia se debilitó: las dos siguen fallando ante cualquier cambio de alcance.

## M · Deuda y observaciones

| # | Disposición |
| --- | --- |
| **D-26** | **ABIERTA** hasta la aceptación humana del candidato |
| D-13 · D-18 · D-20 · D-22 · D-23 | sin cambio. D-22: `sql.ts` solo cambia cómo resuelve la raíz; D-23: el rollback nuevo es de seis `drop function` |
| WATCH-P2-1 | sin cambio; la corrección no toca la calificación ni `ANSWER_SUBMITTED` |
| **OBS-3.1-01** | Vercel no tiene configurada la clave de servicio del servidor. En el Preview desplegado el motor devuelve `SKIPPED` por diseño hasta que exista esa configuración, que es una decisión humana y no está autorizada aquí |
| **OBS-3.1-02** | `recoverStaleProjections` (barrido de todos los atrasados) queda como utilidad operativa sin llamador; la ruta B de la aplicación es la recuperación al volver |
| **OBS-3.1-03** | La extracción limpia de este candidato (`git archive`, `npm ci`, pruebas unitarias sin `.git`) destapó un defecto de reproducibilidad heredado de `phase-3-v1.0`: una prueba de D-25 (`secret.redaction.spec`) llamaba a `git ls-files` y fallaba fuera de un checkout. Se corrige de forma acotada —en una extracción recorre el árbol real, que es lo que el paquete contiene— y se comprueba con control negativo: un `.env.*` sembrado en la extracción la hace fallar. No cambia runtime ni migraciones |

## N · Recomendación

Candidato correctivo completo y listo para revisión independiente. Nada fusionado, sin tag, sin
`phase-3-v1.1`, ninguna decisión H-P4 aceptada salvo H-P4-0, y ninguna fase posterior iniciada.
