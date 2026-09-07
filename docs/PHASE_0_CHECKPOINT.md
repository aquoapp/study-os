# STUDY OS · Checkpoint de Phase 0 · octava reemisión

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 0 · Foundation
BRANCH: phase/0-foundation
COMMIT/TAG: ver «HEAD» en AUDIT_EVIDENCE.md (sin tag: se crea tras el merge aprobado)
STATUS: BLOCKED
```

**Octava reemisión.** La séptima (`a33ad27`) fue auditada y devolvió el falso
negativo que quedaba en `auth-authority-guard`: un método computado sobre una consulta
solo se denunciaba cuando el acceso era la llamada misma. Este informe la sustituye.

## Por qué sigue BLOCKED

Por cuatro cosas, y ninguna se resuelve con una corrección local:

| Motivo | Naturaleza |
| --- | --- |
| **P0-G4** · cuatro de los nueve checks no pueden ejecutarse | Infraestructura externa · MI-05a, sin Docker |
| **P0-G2** · la separación entre entornos reales no se ha comprobado | Ídem: exige que esos entornos existan |
| **SD-018** · contrato completo, **PROPOSED y sin aprobar** | Decisión humana |
| **BD-02 · BD-05 · SD-006 · SD-007** | Decisiones de dominio, pendientes antes del PASS final |

`Execution Plan §6` stop condition 1: «Phase 0 se detiene y se reporta BLOCKED si no
se dispone de credenciales o entornos (MI-05)».

**Lo que no bloquea.** `REQ-A06` y `P0-S7` quedan **satisfechos bajo las
restricciones de SD-019 opción A**; elegir entre B y C es una decisión **diferida
con plazo antes de Phase 5**. Esta ronda no reabre SD-019, SD-018, el aislamiento
E2E, la accesibilidad ni ningún contrato de dominio.

---

## 0. La ronda correctiva de esta reemisión

Esta ronda se limitó a **cerrar el sumidero computado extraído** de
`auth-authority-guard`. No toca infraestructura, migraciones, SD-018 ni decisiones de
dominio.

| # | Hallazgo de la auditoría | Estado | Evidencia |
| --- | --- | --- | --- |
| C1 | `scope.mjs` trataba `var` como si tuviera ámbito de bloque | **CERRADO** (ronda anterior) | `guards.closure.spec` C1 |
| C2 | Retornos, contenedores y llamadas no modeladas en el motor | **CERRADO** (ronda anterior) | `guards.closure.spec` C2, C3 |
| C3 | Método computado no resoluble sobre una consulta | **CERRADO** (ronda anterior) | `guards.closure.spec` C4 |
| C4 | La consulta se reconocía por el **nombre** `from`, no por su origen | **CERRADO** (ronda anterior) | `guards.postgrestProvenance.spec` · 13 casos |
| C5 | `q[method](...)` solo se denunciaba cuando el acceso era la llamada misma: `const sink = query[method]; sink('user_id', raw)` pasaba | **CERRADO** en esta ronda | `guards.computedSink.spec` · 10 casos |

**Qué estaba mal en C5.** La comprobación del método computado miraba el callee de la
`CallExpression`: si era un `ElementAccessExpression` no resoluble sobre una consulta,
hallazgo. Separar la lectura de la llamada la esquivaba entera. Ahora **leer** `q[m]`
no resoluble sobre un valor `postgrest-query` produce la capacidad
`postgrest-computed-sink`, que el motor propaga como una función-valor, y **invocar**
cualquier valor que la lleve es hallazgo, esté donde esté la llamada.

Hubo que acotar una regla del motor: un seed sobre `q[m]` no se guarda en ninguna
ubicación, porque la suya es el comodín `.*` que toda lectura de propiedad consulta, y
guardarlo ahí habría contaminado `query.select`. Un control positivo lo vigila.

Este informe sigue sin afirmar que todo `.from()` implique PostgREST.

Conservados sin regresión: independencia respecto a `_handoff`; SD-019 opción A y
sus pruebas renderizadas; el contrato corregido de SD-018, todavía PROPOSED; el
aislamiento E2E por ejecución, la enumeración completa antes del borrado, la
verificación sobre los IDs enviados a `deleteUser` y la conservación del marcador
ante cualquier fallo; el bundle exacto del commit y la evidencia externa.

---

## SPEC REFERENCES

- `STUDY_OS_Builder_Handoff_Manifest_v1.0` §5, §6, §7, §8, §9, §10 (Phase 0), §14, §20
- `STUDY_OS_Engineering_Constitution_v1.0` EC-008 … EC-020
- `STUDY_OS_Design_System_v1.0` §2, §3, §5, §6, §13, §14, §15
- `STUDY_OS_Technical_Architecture_v1.0` §1–§6, §5.2–§5.4
- `docs/PHASE_0_EXECUTION_PLAN.md` v1.2 · P0-S1 … P0-S10, §4, §5, §6
- `spec/requirement-index.md` REQ-A01 … REQ-A09, REQ-C13
- `docs/SPEC_DIFF_LOG.md` · adenda: ERRATA P0-IN-1, SD-016, SD-017, SD-018, SD-019

---

## DELIVERED

| Paso | Entregado | Estado |
| --- | --- | --- |
| **P0-S1** | Monorepo npm workspaces conforme a Manifest §8 | Completo |
| **P0-S2** | `@study-os/config`: tres entornos, políticas como dato compartido, allowlist pública, frontera `server-only`, guardas destructivas | Completo |
| **P0-S3** | Next.js 16.3.2 · TypeScript `strict` · PWA instalable · Node 24 | Completo |
| **P0-S4** | Migración 0 (extensiones + enum `provenance_class` + utilidad) con rollback | **Escrita · sin aplicar** |
| **P0-S5** | Migración 1: `profiles` 1:1, trigger idempotente, RLS `enable`+`force` | **Escrita · sin aplicar** |
| **P0-S6** | CI en dos jobs, CLI fijado, E2E estáticos separados de los de auth | **Escrito · nunca ejecutado** |
| **P0-S7** | Tokens con los valores de `STUDY_OS_Design_System_v1.0`, los defaults de implementación marcados aparte, y el contraste verificado en el navegador | **Satisfecho bajo SD-019 opción A** |
| **P0-S8** | Cinco guardas con propagación de capacidades y procedencia por punto fijo, y 169 pruebas que ejecutan las guardas reales | Completo |
| **P0-S9** | `/spec`, `/architecture`, `/docs` importados con SHA-256; registro versionado de documentos gobernantes | Completo |
| **P0-S10** | Este informe | Completo |

---

## Procedencia de consulta · tres capacidades encadenadas

Ninguna se reconoce por el nombre del receptor ni del método.

| Capacidad | Nace | Viaja |
| --- | --- | --- |
| `supabase-client` | Solo en una llamada a un **origen registrado** en `authority-registry.json`, resuelto por **módulo** y por **nombre exportado** | Como cualquier valor. No se hereda por llamada: un `.rpc()` sobre un cliente no devuelve otro cliente |
| `postgrest-from` | Al **acceder** a `.from` sobre un valor `supabase-client`, por propiedad o por desestructuración | Extracción directa, `bind`, `call`, `apply`, asignación posterior, desestructuración, propiedades, contenedores, parámetros y retornos |
| `postgrest-query` | Al **invocar** un valor `postgrest-from` | Se conserva por las operaciones encadenadas de consulta |
| `postgrest-computed-sink` | Al **leer** `q[m]` con `m` no resoluble sobre un `postgrest-query`, se invoque o no ahí | Como una función-valor: declaraciones, asignaciones posteriores, propiedades, contenedores, parámetros, retornos, `bind`/`call`/`apply` y alias. Invocarla es siempre hallazgo. Solo nace sobre `postgrest-query` |

**Orígenes registrados.** Internos, resueltos con los alias de `tsconfig`:
`apps/web/src/server/supabase/server-client.ts#createSupabaseServerClient` y su
equivalente de navegador. Externos, comparados por especificador:
`@supabase/ssr#createServerClient` y `@supabase/ssr#createBrowserClient`. Se compara
el nombre **exportado**: `import { createServerClient as mk }` sigue siendo el
origen, y una función local que se llame igual no lo es.

**Frontera opaca.** Cuando el origen no se puede demostrar —un parámetro `any`, un
valor que llega de fuera del fichero— y la llamada puede llevar una columna o un
payload de identidad, se **falla cerrado** y el mensaje dice que la procedencia del
cliente es opaca. Un objeto construido en el fichero sí tiene origen demostrable, y
una llamada con solo primitivos inocuos no puede llevar una columna.

---

## SD-019 · satisfecho bajo restricción, con lo demás diferido

La paleta congelada de §2 tiene tres combinaciones que no alcanzan el 4.5:1 que §14
exige: `onDark` sobre `teal` (3.95), `onDark` sobre `amber` (4.42) y `slate` sobre
`canvas` (4.31). Ningún color se ha modificado.

**Opción A, autorizada por decisión humana y aplicada.** Bajo sus restricciones todo
texto renderizado alcanza el contraste que WCAG le exige, medido en el navegador
sobre el build de producción, con un fixture negativo automático. Ese es el criterio
de aceptación de `REQ-A06`: `REQ-A06` y `P0-S7` quedan **satisfechos para Phase 0**.
**Diferido, con plazo antes de Phase 5:** elegir entre B y C. Sin cambios en esta
ronda.

---

## SD-018 · técnicamente corregido, PROPOSED, **sin aprobar**

Contrato completo —orden de las operaciones dentro de la transacción y triple
coincidencia de usuario, pregunta y payload canónico—, **no implementado**, y lo
comprueba `sd018.contract.spec`. Sigue **PROPOSED y pendiente de aprobación humana
explícita**. Sin cambios en esta ronda.

---

## FILES CHANGED

Rondas anteriores: siete commits correctivos más `3872a84`; siete más `2c03ecb`;
cinco más `d848f1a`; tres más `6ec13e5`; dos más `85bdf99`; tres más `b606e0d`;
dos más `a33ad27`. Esta ronda produce uno, más la reemisión:

| Commit | Alcance |
| --- | --- |
| `52ceb88` | Capacidad `postgrest-computed-sink` · seeds no guardados en el comodín `.*` · 10 fixtures |
| (este) | Documentación viva y reemisión |

Ficheros nuevos de esta ronda:

| Ruta | Propósito |
| --- | --- |
| `tests/unit/guards.computedSink.spec.ts` | Los cuatro fixtures obligatorios, los demás caminos y tres controles positivos |

---

## TESTS

### Recuento verificable

Obtenido con `vitest run --project unit --reporter=json`, no a mano.

| Fichero | Casos |
| --- | --- |
| `operational-security.spec.ts` | 60 |
| `sd018.contract.spec.ts` | 37 |
| `guards.symbolScope.spec.ts` | 30 |
| `tokens.contrast.spec.ts` | 29 |
| `guards.evasion.spec.ts` | 28 |
| `tokens.contract.spec.ts` | 28 |
| `guards.laundering.spec.ts` | 27 |
| `operational-bypasses.spec.ts` | 26 |
| `e2eCleanupScope.spec.ts` | 25 |
| `guards.adversarial.spec.ts` | 21 |
| `guards.propagation.spec.ts` | 21 |
| `governingDocuments.registry.spec.ts` | 19 |
| `guards.closure.spec.ts` | 19 |
| `toolchain.pinning.spec.ts` | 18 |
| `env.separation.spec.ts` | 16 |
| `auth.serverVerifiedIdentity.spec.ts` | 15 |
| `designSystem.blocked.spec.ts` | 15 |
| `schema.drift.spec.ts` | 14 |
| `tokens.provenance.spec.ts` | 14 |
| `guards.postgrestProvenance.spec.ts` | 13 |
| `offline.copy.spec.ts` | 13 |
| `e2eConcurrentRuns.spec.ts` | 11 |
| `guards.computedSink.spec.ts` | 10 |
| `bundle.secret-scan.spec.ts` | 7 |
| `client.no-authoritative-write.spec.ts` | 7 |
| `primarySpaces.frozen.spec.ts` | 6 |
| `importGuard.spec.ts` | 4 |
| `taiLiteral.guard.spec.ts` | 3 |
| **Total** | **536 en 28 ficheros** |

### Ejecutado · en verde

Todo lo que sigue se ejecutó sobre `git archive HEAD` extraído en un directorio
temporal ordinario y vacío, **sin `_handoff`**, sin `node_modules` y sin ningún `.env`.
La salida íntegra está en `AUDIT_EVIDENCE.md`, que se entrega fuera del ZIP.

| Comando | Resultado |
| --- | --- |
| `npm ci` | **PASS** · 0 vulnerabilidades |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run format` | **PASS** |
| `npm run build` | **PASS** · 8 rutas |
| `npm run test:unit` | **PASS** · **536/536** en 28 ficheros |
| `npm run guards` | **PASS** · las cuatro sin hallazgos |
| `npm run secret-scan` | **PASS** · construye por sí mismo · centinela de servidor |
| `npm run test:e2e:static` | **PASS** · **70/70** (35 casos × 2 proyectos) |
| Fixtures nuevos, ejecutados de forma visible | **PASS** · 10/10 |

Y fuera del checkout limpio, en el árbol de trabajo:

| Comando | Resultado |
| --- | --- |
| `npm run verify:originals` | **PASS** · 14/14 artefactos |
| `npm run verify:originals` sin originales | **FALLA con código 1** y dice qué falta |

### No ejecutado · y no contabilizado

Los cuatro checks que necesitan infraestructura externa **no se han simulado ni se
cuentan** en ninguna cifra de este informe: `test:integration` (10 casos escritos),
`test:rls` (11), `test:e2e:auth` (8) y `schema-drift` nivel B. **29 casos escritos y
no ejecutados.** Ninguno se ha desactivado: fallan con un mensaje que dice qué falta,
y `verify` los cuenta como fallo.

---

## ACCEPTANCE GATES

| Gate | Condición | Resultado |
| --- | --- | --- |
| **P0-G1** · La app arranca | `app.boot` y `pwa.manifest` en verde | **PASS** · 26/26 |
| **P0-G2** · Separación de entornos | Producción no accesible desde staging | **BLOQUEADO** · el código lo impide y está probado; entre entornos reales exige MI-05a |
| **P0-G3** · Sin secretos en cliente | Escaneo sin hallazgos | **PASS** · centinela de servidor inyectado en el build, comprobado en `.next/static`, en el HTML renderizado y en los recursos referenciados; y demostrado que la fuga se detecta |
| **P0-G4** · Baseline lint/type/test | Los nueve checks en verde | **FAIL** · 5 verdes, 0 rojos, 4 bloqueados |
| **P0-G5** · Guardas de invariante activas | Fallan ante una violación deliberada | **PASS** · ver abajo |

### P0-G5 · PASS porque los cuatro fixtures obligatorios fallan de verdad

P0-G5 estuvo en **FAIL** mientras C5 seguía abierto. Vuelve a PASS porque los cuatro
fixtures que la auditoría exigió producen código distinto de cero, cada uno
compilando con el `tsconfig.json` real y ejecutando la guarda como proceso hijo:

| # | Fixture | Detección |
| --- | --- | --- |
| 1 | `const sink = query[method]; sink('user_id', raw)` | «Invocación de `sink`, que es un método con nombre computado extraído de una consulta PostgREST» |
| 2 | Asignación posterior del mismo sumidero | Ídem |
| 3 | Paso por contenedor y retorno | Ídem |
| 4 | `.bind(query)` antes de invocarlo | Ídem |

Y además: propiedad, parámetro, `call`, `apply` y alias intermedio —cinco hallazgos—;
el acceso directo conserva su propio diagnóstico sin duplicarse; y tres controles
positivos en código cero: el repositorio real, `registry[method]` extraído de un
registro local y ejecutado con una columna de identidad como argumento, y
`query[method]` leído en el mismo fichero que `query.select()` sin contaminarlo.

Los cuatro de la ronda anterior —C4— siguen fallando: `guards.postgrestProvenance.spec`
se ejecuta entera en cada pasada.

**Total acumulado: 169 casos que ejecutan las guardas reales** —10 de sumidero
computado extraído, 13 de procedencia PostgREST, 19 de cierre transitivo, 21 de
propagación, 30 de símbolo y ámbito, 27 de blanqueo, 28 de evasión, 21
adversariales— más 26 bypasses operacionales.

---

## MIGRATIONS

| Migración | Propósito | ¿Reversible? | ¿Aplicada? |
| --- | --- | --- | --- |
| `00000000000000_init.sql` | `pgcrypto`; enum `provenance_class`; `set_updated_at` | Sí | **No** |
| `00000000000001_profiles.sql` | `profiles` 1:1; trigger idempotente; RLS `enable`+`force`; grants mínimos | Sí (destructiva) | **No** |

**Verificado por test:** ninguna migración menciona `learning_events`,
`user_event_counters`, `projection_watermarks`, `stream_position`,
`question_attempts` ni `server_sequence`; no hay bloqueo de fila, ni secuencia
global, ni `ON CONFLICT DO NOTHING` fuera del alta de perfil. `db:reset` está forzado
a `--local` y rechaza `--db-url`, `--linked`, `--project-ref`, `--remote` y cualquier
cadena de conexión, incluidos los argumentos que lleguen después de `--`.

---

## SECURITY

**RLS.** `public.profiles` con `enable` + `force` en la misma migración que la crea
(EC-009), políticas de solo-propio con `with check`, sin `insert` ni `delete` para
`authenticated`.

**Auth · procedencia por propagación.** `derived` nace solo en una llamada al export
de nivel superior de `apps/web/src/server/auth/identity.ts`, resuelto por símbolo.
La etiqueta hereda solo a `userId`, `email` y `method`. Cualquier unión con un valor
crudo o transformación no modelada envenena; cualquier mutación —`+=`, `++`,
escritura de propiedad, `Object.assign`, `Reflect.set`, `Object.defineProperty`—
invalida el valor y sus propiedades. El veneno se emite con los hechos convergidos,
en una segunda fase.

La **procedencia de consulta** es la de la tabla de arriba: origen registrado →
`.from` → invocación. Un método computado no resoluble es hallazgo sobre una
consulta demostrada, y también sobre un receptor de origen opaco cuando la llamada
puede llevar identidad. Y leerlo sin invocarlo produce `postgrest-computed-sink`, que
viaja con el valor y falla cerrado en cualquier invocación posterior.

**Cliente · capacidades por propagación.** Acceder a `insert/update/upsert/delete`
es hallazgo, se invoque o no. Invocar algo que lleve una capacidad de escritura, de
RPC extraída o de miembro no demostrable es hallazgo, y la capacidad viaja por alias,
contenedor, `bind`/`call`/`apply`, retorno de cualquier función-valor y argumento.
La excepción de navegador es el par exacto `caches.delete` en invocación directa
sobre el global no sombreado, con `var` izado a la función.

**Secretos.** Centinela único por ejecución inyectado como **valor** de las variables
de servidor. Comprobado que no aparece en `.next/static`, ni en el HTML renderizado,
ni en los recursos `/_next/*` referenciados. Y demostrado que la fuga se detectaría.

**Tests con privilegios.** Producción denegada sin excepción; staging exige
autorización explícita. Los E2E de auth exigen credenciales de limpieza antes de
crear ningún usuario, marcan cada correo con el identificador de la ejecución, listan
entero antes de borrar, borran solo lo suyo, verifican «nada ajeno» sobre las
peticiones reales de borrado y conservan el marcador mientras algo pueda ir mal.

---

## INVARIANTS VERIFIED

| ID | Resultado |
| --- | --- |
| EC-008 · EC-009 (estático) · EC-010 · EC-011 (nivel A) · EC-012 · EC-015 · EC-017 · EC-018 · EC-019 · EC-020 | **PASS** |
| INV-104 · INV-105 · INV-107 | **PASS** |
| INV-113 · REQ-A08 | **PASS** · propagación de capacidades con cierre transitivo probado |
| INV-116 · REQ-A07 | **PASS** (estático) · cookie forjada **BLOQUEADO** |
| REQ-A06 | **PASS** bajo las restricciones de SD-019 opción A |
| EC-009 en ejecución · REQ-C13 | **BLOQUEADO** · `test:rls` no ejecutable |
| INV-101 | Aprobado por Ana · N/A en Phase 0 |

---

## KNOWN DEBT

| # | Deuda | Resolver en |
| --- | --- | --- |
| D-01 | `main` no está protegida mecánicamente | Al crear el remoto |
| D-02 | Las migraciones nunca se han aplicado | Al disponer de instancia |
| D-03 | CI nunca se ha ejecutado | Al primer *push* |
| D-04 | La familia tipográfica es un default provisional | Al decidirla |
| D-05 | `next-env.d.ts` versionado y en `.prettierignore` | — |
| D-06 | Listas espejo entre TypeScript y las herramientas `.mjs` | Aceptable · hay tests que las comparan |
| D-07 | Las restricciones de SD-019 opción A acotan las composiciones disponibles | Al elegir entre B y C · antes de Phase 5 |
| D-08 | Los E2E de auth no se han ejecutado nunca. Su aislamiento concurrente está probado con un doble en memoria, no contra una instancia real | Al disponer de instancia |
| D-09 | La resolución de ámbitos no sigue tipos ni `export *`, y trata las declaraciones de función como de bloque (semántica de módulo estricto) | Aceptable · cuando no resuelve devuelve `null`, y `null` es «no demostrado» |
| D-10 | El motor de propagación es insensible al flujo, sigue un nivel de propiedades y no distingue instancias de una declaración entre llamadas | Aceptable · cada simplificación produce más hechos, no menos; verificado por los controles positivos |
| D-11 | Un cliente Supabase que cruce la frontera del fichero sin tipo demostrable cae en «procedencia opaca» y falla cerrado en los métodos computados | Aceptable mientras no haya superficie de dominio · se revisa cuando la haya |

---

## DEFERRED REQUIREMENTS

| Requisito | Estado |
| --- | --- |
| REQ-A01 … REQ-A06, REQ-A08, REQ-A09 | Implementados y verificados |
| REQ-A07 | Implementado · verificación E2E e integración **bloqueada** |
| REQ-C13 (parcial, sobre `profiles`) | Implementado · `test:rls` **bloqueado** |

---

## BLOCKED DECISIONS

| ID | Impacto |
| --- | --- |
| **MI-05a** · repositorio remoto, Supabase, Vercel | Impide P0-G2, P0-G4 y la protección de `main` |
| **Docker o WSL2** en la máquina | Impide `test:integration`, `test:rls`, `test:e2e:auth` y `schema-drift` nivel B |
| **SD-018 · aprobar el contrato** | Cualquier migración de eventos. Contrato completo, **PROPOSED y sin aprobar** |
| **BD-02 · BD-05 · SD-006 · SD-007** | Primeras migraciones de dominio. Pendientes antes del PASS final |

Decisiones **diferidas**, que no bloquean Phase 0:

| ID | Plazo |
| --- | --- |
| **SD-019 · elegir entre B y C** | Antes de Phase 5 |

`MI-05b` (proveedor de IA) no se ha solicitado: es entrada de Phase 8.

---

## ROLLBACK

Nada se ha aplicado fuera del repositorio local: ninguna migración ejecutada, ningún
entorno creado, ningún servicio externo tocado, ningún secreto escrito.

```bash
git reset --hard a33ad27
```

Devuelve la rama al estado de la séptima reemisión. `main` conserva su commit raíz
`6086537`.

---

## NEXT RECOMMENDED PHASE

**Ninguna.** Phase 0 no cierra y Phase 1 no debe arrancar.

1. **MI-05a** · repositorio remoto con `main` protegida, proyecto Supabase, Vercel.
2. **Docker Desktop**, o aceptar que los cuatro checks bloqueados solo corran en CI.
3. `npm run db:start && npm run db:reset && npm run verify`.
4. **Aprobar SD-018** antes de cualquier migración de eventos.
5. Cerrar **BD-02**, **BD-05**, **SD-006**, **SD-007**.
6. Aprobar la adenda del `SPEC_DIFF_LOG`.
7. Reemitir el checkpoint. Con 1–5 resueltos el estado esperado es **PASS WITH
   DEBT**, y solo entonces procede autorizar Phase 1.

Todos los ADR siguen en `PROPOSED`.
