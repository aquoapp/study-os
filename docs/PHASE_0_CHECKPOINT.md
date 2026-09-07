# STUDY OS · Checkpoint de Phase 0 · sexta reemisión

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 0 · Foundation
BRANCH: phase/0-foundation
COMMIT/TAG: ver «HEAD» en AUDIT_EVIDENCE.md (sin tag: se crea tras el merge aprobado)
STATUS: BLOCKED
```

**Sexta reemisión.** La quinta (`85bdf99`) fue auditada y devolvió cuatro agujeros en el
motor de propagación. Este informe la sustituye.

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
restricciones de SD-019 opción A**, autorizada, aplicada y verificada en el
navegador. Elegir entre las opciones B y C es una decisión **diferida con plazo
antes de Phase 5**. Ninguna de las dos cosas se reabre en esta ronda, ni tampoco el
contrato corregido de SD-018 ni el aislamiento E2E.

---

## 0. La ronda correctiva de esta reemisión

| # | Hallazgo de la auditoría | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | `scope.mjs` trataba `var` como si tuviera ámbito de bloque | **CERRADO** | `var` se iza a la función · `guards.closure.spec` C1 |
| 2 | `dataflow.mjs` solo resolvía retornos de un identificador ligado a una declaración; los contenedores no llegaban a `pop`, `at`, `find`, `Map.get`; una llamada no modelada vaciaba los hechos | **CERRADO** | Funciones como valores, recuperación desde contenedor por cualquier vía, llamadas no modeladas con veneno · C2, C3 |
| 3 | `auth-authority-guard` dejaba pasar un método computado no resoluble sobre una consulta PostgREST | **CERRADO** | Procedencia `postgrest` del receptor · C4 |
| 4 | Fixtures que compilen, ejecuten las guardas reales y compongan varias transformaciones | **HECHO** | 19 casos con `assertCompiles` · cadena compuesta en C5 |
| 5 | Documentación viva: D-09 afirmaba que el tratamiento de `var` solo sobredetectaba; se afirmaban coberturas no demostradas | **CERRADO** | Esta reemisión · `ARCHITECTURE_STATE` v6.0 |
| 6 | Verificación desde un checkout limpio y bundle con evidencia externa | **HECHO** | `AUDIT_EVIDENCE.md` |

**Sobre D-09.** La quinta reemisión decía que tratar `var` como de bloque «produce más
sombreado detectado, no menos». Era falso: un `var caches` dentro de un `{}` se
resolvía a ese bloque, y el uso de `caches` fuera del bloque caía en el global, que
es exactamente **sub**detectar. Se corrige el motor y se retira la afirmación.

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
| **P0-S8** | Cinco guardas con propagación de capacidades y procedencia por punto fijo, y 146 pruebas que ejecutan las guardas reales | Completo |
| **P0-S9** | `/spec`, `/architecture`, `/docs` importados con SHA-256; registro versionado de documentos gobernantes | Completo |
| **P0-S10** | Este informe | Completo |

---

## SD-019 · satisfecho bajo restricción, con lo demás diferido

La paleta congelada de §2 tiene tres combinaciones que no alcanzan el 4.5:1 que §14
exige: `onDark` sobre `teal` (3.95), `onDark` sobre `amber` (4.42) y `slate` sobre
`canvas` (4.31). Ningún color se ha modificado.

**Opción A, autorizada por decisión humana y aplicada:** `teal` y `amber` no llevan
texto normal; `slate` solo como texto normal sobre `surface`; sobre `canvas`, `ink` o
el texto dentro de una superficie válida. Bajo esas restricciones **todo texto
renderizado alcanza el contraste que WCAG le exige**, medido en el navegador sobre el
build de producción, en móvil y escritorio, con un fixture negativo automático. Ese
es el criterio de aceptación de `REQ-A06`: `REQ-A06` y `P0-S7` quedan **satisfechos
para Phase 0**.

**Diferido, con plazo antes de Phase 5:** elegir entre B y C para usar la paleta sin
restricciones. Nada de Phase 0 lo espera.

---

## SD-018 · técnicamente corregido, PROPOSED, **sin aprobar**

El contrato de orden e idempotencia del stream de eventos está completo: el orden de
las operaciones dentro de la transacción y la triple coincidencia —usuario, pregunta
y payload canónico completo— que convierte un `submitted_event_id` repetido en
idempotencia. **No está implementado**, y lo comprueba `sd018.contract.spec`. **Sigue
PROPOSED y pendiente de aprobación humana explícita.** Nada de esta ronda lo da por
aprobado.

---

## FILES CHANGED

Rondas anteriores: siete commits correctivos más `3872a84`; siete más `2c03ecb`;
cinco más `d848f1a`; tres más `6ec13e5`; dos más `85bdf99`. Esta ronda produce uno,
más la reemisión:

| Commit | Alcance |
| --- | --- |
| `86ff125` | `var` izado · funciones como valores · contenedores · llamadas no modeladas · veneno en dos fases · procedencia PostgREST · 19 fixtures |
| (este) | Documentación viva y reemisión |

Ficheros nuevos de esta ronda:

| Ruta | Propósito |
| --- | --- |
| `tests/unit/guards.closure.spec.ts` | Las cuatro evasiones por varios caminos, la cadena compuesta y siete controles positivos |

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
| `offline.copy.spec.ts` | 13 |
| `e2eConcurrentRuns.spec.ts` | 11 |
| `bundle.secret-scan.spec.ts` | 7 |
| `client.no-authoritative-write.spec.ts` | 7 |
| `primarySpaces.frozen.spec.ts` | 6 |
| `importGuard.spec.ts` | 4 |
| `taiLiteral.guard.spec.ts` | 3 |
| **Total** | **513 en 26 ficheros** |

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
| `npm run test:unit` | **PASS** · **513/513** en 26 ficheros |
| `npm run guards` | **PASS** · las cuatro sin hallazgos |
| `npm run secret-scan` | **PASS** · construye por sí mismo · centinela de servidor |
| `npm run test:e2e:static` | **PASS** · **70/70** (35 casos × 2 proyectos) |
| Fixtures nuevos, ejecutados de forma visible | **PASS** · 19/19 |

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

### P0-G5 · PASS porque las cuatro evasiones producen código distinto de cero

La auditoría exigió que P0-G5 siguiera en FAIL hasta que estas cuatro fallaran de
verdad. Fallan, y cada fixture cumple las cuatro condiciones: compila con el
`tsconfig.json` real, ejecuta la guarda como proceso hijo, termina con código
distinto de cero y produce el hallazgo concreto. Y cada una se prueba por varios
caminos, para que no sea un `if` disfrazado.

| # | Evasión | Caminos probados | Detección |
| --- | --- | --- | --- |
| 1 | `var caches` en `{}` sombrea al global | bloque, `if`, cabecera de `for` | «El miembro ".delete" se invoca» |
| 2 | Retornos de funciones-valor | IIFE, función expresión, método de objeto, alias tardío; y los argumentos por alias e IIFE | «lleva el método … por propagación» · «"user_id" recibe `valor`» |
| 3 | Recuperación desde contenedor | índice, desestructuración, `at`, `pop`, `shift`, `find`, `Map.get`, y `reduce`/`slice` no modelados | «nombre computado no demostrable» · «lleva el método ".update" por propagación» |
| 4 | Método computado sobre PostgREST | directo, por alias de la consulta, tras `.limit()` | «método con nombre computado … sobre una consulta PostgREST» |

**Cierre transitivo.** La cadena contenedor → extracción → retorno → alias → llamada
falla en la guarda de cliente (miembro opaco) y en la de identidad (`.eq` al final,
con `"profile_id" recibe \`raw\``). La misma cadena con una función inocua no produce
hallazgos.

**Siete controles positivos** siguen pasando: el repositorio real, `caches.delete(key)`
sobre el global, un `Map` de funciones inocuas recuperadas y llamadas, la identidad
canónica a través de un helper local, la identidad guardada en un contenedor y
recuperada, un método computado sobre un registro ajeno a datos, y la cadena compuesta
inocua.

Lo que este informe afirma sobre retornos, contenedores y alias es exactamente lo
que `guards.closure.spec` y `guards.propagation.spec` ejecutan. Nada más.

**Total acumulado: 146 casos que ejecutan las guardas reales** —19 de cierre
transitivo, 21 de propagación, 30 de símbolo y ámbito, 27 de blanqueo, 28 de evasión,
21 adversariales— más 26 bypasses operacionales.

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
de nivel superior de `apps/web/src/server/auth/identity.ts`, resuelto por símbolo. La
etiqueta hereda solo a `userId`, `email` y `method`. Cualquier unión con un valor
crudo envenena; cualquier transformación no modelada envenena; cualquier mutación
—`+=`, `++`, escritura de propiedad, `Object.assign`, `Reflect.set`,
`Object.defineProperty`— invalida el valor y sus propiedades. El veneno se emite con
los hechos convergidos, en una segunda fase, para no confundir «todavía no calculado»
con «desacuerdo». Un método computado no resoluble sobre una consulta PostgREST es
hallazgo.

**Cliente · capacidades por propagación.** Acceder a `insert/update/upsert/delete`
es hallazgo, se invoque o no. Invocar algo que lleve una capacidad de escritura, de
RPC extraída o de miembro no demostrable es hallazgo, y la capacidad viaja por alias,
contenedor —cualquier recuperación—, `bind`/`call`/`apply`, retorno de cualquier
función-valor y argumento. La excepción de navegador es el par exacto `caches.delete`
en invocación directa sobre el global no sombreado, con `var` izado a la función.

**Secretos.** Centinela único por ejecución inyectado como **valor** de las variables
de servidor. Comprobado que no aparece en `.next/static`, ni en el HTML renderizado,
ni en los recursos `/_next/*` referenciados. Y demostrado que la fuga se detectaría.

**Tests con privilegios.** Producción denegada sin excepción; staging exige
autorización explícita; se comprueban la etiqueta del entorno y el host real. Los
E2E de auth exigen credenciales de limpieza antes de crear ningún usuario, marcan
cada correo con el identificador de la ejecución, listan entero antes de borrar,
borran solo lo suyo, verifican «nada ajeno» sobre las peticiones reales de borrado y
conservan el marcador mientras algo pueda ir mal.

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
git reset --hard 85bdf99
```

Devuelve la rama al estado de la quinta reemisión. `main` conserva su commit raíz
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
