# STUDY OS · Checkpoint de Phase 0 · cuarta reemisión

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 0 · Foundation
BRANCH: phase/0-foundation
COMMIT/TAG: ver «HEAD» en AUDIT_EVIDENCE.md (sin tag: se crea tras el merge aprobado)
STATUS: BLOCKED
```

**Cuarta reemisión.** La tercera (`d848f1a`) fue auditada y devolvió una ronda de
correcciones exclusivamente locales. Este informe la sustituye.

## Por qué sigue BLOCKED

Por cuatro cosas, todas fuera del alcance de una corrección local:

| Motivo | Naturaleza |
| --- | --- |
| **P0-G4** · cuatro de los nueve checks no pueden ejecutarse | Infraestructura externa · MI-05a, sin Docker |
| **P0-G2** · la separación entre entornos reales no se ha comprobado | Ídem: exige que esos entornos existan |
| **SD-018** · el contrato está completo, pero **sin aprobar** | Decisión humana |
| **BD-02 · BD-05 · SD-006 · SD-007** | Decisiones de dominio |

`Execution Plan §6` stop condition 1: «Phase 0 se detiene y se reporta BLOCKED si no
se dispone de credenciales o entornos (MI-05)».

**Lo que no bloquea.** `REQ-A06` y `P0-S7` quedan **satisfechos bajo las
restricciones de SD-019 opción A**, autorizada, aplicada y verificada en el
navegador. Elegir entre las opciones B y C es una decisión **diferida con plazo
antes de Phase 5**. Ver la sección SD-019.

---

## 0. La ronda correctiva de esta reemisión

| # | Hallazgo de la auditoría | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | `client-authority-guard` razonaba sobre formas, no sobre símbolos | **CERRADO** | `guards.symbolScope.spec` · 30 casos |
| 2 | `auth-authority-guard` se dejaba sombrear y no invalidaba reasignaciones | **CERRADO** | Ídem |
| 3 | El aislamiento E2E concurrente acusaba a quien no había hecho nada | **CERRADO** | `e2eConcurrentRuns.spec` · 11 casos |
| 4 | Documentación viva desactualizada | **CERRADO** | Esta reemisión · `GOVERNING_DOCUMENTS` · `tokens.ts` · `ARCHITECTURE_STATE` |
| 5 | Ejecución desde un checkout limpio | **HECHO** | `AUDIT_EVIDENCE.md` |
| 6 | Bundle determinista con la verificación dentro | **HECHO** | `AUDIT_EVIDENCE.md` |

Conservados sin tocar: **C1** —ningún test versionado lee `_handoff`— y la
aplicación visual de **SD-019 opción A**.

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
| **P0-S8** | Cinco guardas con análisis por símbolo y ámbito, y 106 pruebas de evasión y bypass | Completo |
| **P0-S9** | `/spec`, `/architecture`, `/docs` importados con SHA-256; registro versionado de documentos gobernantes | Completo |
| **P0-S10** | Este informe | Completo |

---

## SD-019 · satisfecho bajo restricción, con lo demás diferido

La paleta congelada de §2 tiene tres combinaciones que no alcanzan el 4.5:1 que §14
exige: `onDark` sobre `teal` (3.95), `onDark` sobre `amber` (4.42) y `slate` sobre
`canvas` (4.31). Ningún color se ha modificado: hacerlo sin ADR es lo que EC-019
prohíbe.

**Opción A, autorizada por decisión humana y aplicada:**

- `teal` y `amber` no llevan texto normal encima;
- `slate` solo como texto normal sobre `surface`;
- sobre `canvas`, `ink`, o el texto dentro de una superficie válida.

Bajo esas restricciones **todo texto renderizado alcanza el contraste que WCAG le
exige**, medido en el navegador sobre el build de producción, en móvil y escritorio.
Ese es el criterio de aceptación de `REQ-A06`, así que `REQ-A06` y `P0-S7` quedan
**satisfechos para Phase 0**.

Las restricciones no son deuda oculta: las hace cumplir la prueba de accesibilidad en
cada ejecución, y el **fixture negativo** del mismo fichero demuestra en cada pasada
que la medición detecta lo que dice detectar —`slate` sobre `canvas` a 4.31:1, texto
sobre `teal` y sobre `amber`, y un control de 24×24—, con su propio control de que no
salta con cualquier entrada.

**Diferido, con plazo antes de Phase 5:** elegir entre B (oscurecer los tres colores)
y C (modificar §14) para usar la paleta sin restricciones. Lo necesitan las 18
familias de componentes de §16. Nada de Phase 0 lo espera.

El umbral de 3:1 queda acotado a elementos **no textuales**: bordes, contornos de foco
e indicadores gráficos. La única rebaja admitida para texto es el **tamaño**, según
WCAG, nunca el rol.

---

## SD-018 · técnicamente corregido, PROPOSED, **sin aprobar**

El contrato de orden e idempotencia del stream de eventos está completo. Se ha
corregido dos veces:

1. **el orden de las operaciones dentro de la transacción** —bloquear el contador,
   después comprobar `event_id`, y solo entonces reservar posición—, porque
   comprobar antes del bloqueo abre una ventana y reservar antes de comprobar deja
   huecos;
2. **la triple coincidencia**: un `submitted_event_id` repetido solo es idempotente
   si coinciden usuario, pregunta y **payload canónico completo de la respuesta**.
   Cualquier diferencia es conflicto de integridad, revierte por completo y **no
   consume `attempt_number`**.

**No está implementado.** No existe ninguna migración de eventos, ninguna tabla,
ningún contador y ninguna función; y ninguna de las suites que el contrato declara
existe en `tests/**`. Ambas cosas las comprueba `sd018.contract.spec`.

**Sigue PROPOSED y pendiente de aprobación humana explícita.** Nada de esta ronda lo
da por aprobado.

---

## FILES CHANGED

Rondas anteriores: siete commits correctivos más `3872a84`; siete más `2c03ecb`;
cinco más `d848f1a`. Esta ronda produce cuatro, uno por preocupación más la
reemisión:

| Commit | Alcance |
| --- | --- |
| `7572401` | Guardas por símbolo y ámbito · `tools/guards/lib/scope.mjs` |
| `1d31d2d` | Aislamiento E2E concurrente por peticiones reales de borrado |
| (este) | Documentación viva y reemisión |

Ficheros nuevos de esta ronda:

| Ruta | Propósito |
| --- | --- |
| `tools/guards/lib/scope.mjs` | Cadena de ámbitos léxicos y resolución de identificadores |
| `tests/unit/guards.symbolScope.spec.ts` | Las nueve evasiones obligatorias y ocho controles legítimos |
| `tests/unit/e2eConcurrentRuns.spec.ts` | Ciclo entrelazado de dos ejecuciones |

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
| `governingDocuments.registry.spec.ts` | 19 |
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
| **Total** | **473 en 24 ficheros** |

### Ejecutado · en verde

Todo lo que sigue se ejecutó sobre `git archive HEAD` extraído en una carpeta vacía,
**sin `_handoff`**, sin `node_modules` y sin ningún `.env`. La salida íntegra está en
`AUDIT_EVIDENCE.md`.

| Comando | Resultado |
| --- | --- |
| `npm ci` | **PASS** · 0 vulnerabilidades |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run format` | **PASS** |
| `npm run build` | **PASS** · 8 rutas |
| `npm run test:unit` | **PASS** · **473/473** en 24 ficheros |
| `npm run guards` | **PASS** · las cuatro sin hallazgos |
| `npm run secret-scan` | **PASS** · construye por sí mismo · centinela de servidor |
| `npm run test:e2e:static` | **PASS** · **70/70** (35 casos × 2 proyectos) |

Y fuera del checkout limpio, en el árbol de trabajo:

| Comando | Resultado |
| --- | --- |
| `npm run verify:originals` | **PASS** · 14/14 artefactos |
| `npm run verify:originals` sin originales | **FALLA con código 1** y dice qué falta |

`npm run build` exige las tres variables `NEXT_PUBLIC_*`. No son secretos —viajan al
navegador por definición— y la aplicación se niega a asumir un entorno en su lugar.

### No ejecutado · y no contabilizado

Los cuatro checks que necesitan infraestructura externa **no se han simulado ni se
cuentan** en ninguna cifra de este informe.

| Suite | Casos escritos | Motivo |
| --- | --- | --- |
| `test:integration` · `profile.oneToOne.spec` | 10 | Requiere instancia de Supabase |
| `test:rls` · `rls.userIsolation.profiles.spec` | 11 | Requiere instancia de Supabase |
| `test:e2e:auth` · `auth.signup-login.e2e` | 5 | Requiere servidor de Auth y credenciales de limpieza |
| `test:e2e:auth` · `auth.forgedCookieRejected.e2e` | 3 | Ídem |
| `schema-drift` nivel B | — | Requiere `SUPABASE_DB_URL`. El nivel A sí se ejecuta |

**Total escrito y no ejecutado: 29 casos.** Ninguno se ha desactivado: fallan con un
mensaje que dice qué falta, y `verify` los cuenta como fallo.

---

## ACCEPTANCE GATES

| Gate | Condición | Resultado |
| --- | --- | --- |
| **P0-G1** · La app arranca | `app.boot` y `pwa.manifest` en verde | **PASS** · 26/26 |
| **P0-G2** · Separación de entornos | Producción no accesible desde staging | **BLOQUEADO** · el código lo impide y está probado; entre entornos reales exige MI-05a |
| **P0-G3** · Sin secretos en cliente | Escaneo sin hallazgos | **PASS** · centinela de servidor inyectado en el build, comprobado en `.next/static`, en el HTML renderizado y en los recursos referenciados; y demostrado que la fuga se detecta |
| **P0-G4** · Baseline lint/type/test | Los nueve checks en verde | **FAIL** · 5 verdes, 0 rojos, 4 bloqueados |
| **P0-G5** · Guardas de invariante activas | Fallan ante una violación deliberada | **PASS** · ver abajo |

### P0-G5 · las nueve evasiones de esta ronda, con su detección

`guards.symbolScope.spec` ejecuta las guardas reales contra ficheros que se escriben
y se borran. Las nueve que la auditoría nombró:

| # | Evasión | Detección |
| --- | --- | --- |
| 1 | `w = query.update` | «El miembro ".update" se asigna a una variable» |
| 2 | `query.update.bind(query)` | «se enlaza con .bind()» |
| 3 | `({ update: w } = query)` | «Asignación destructurada de ".update"» |
| 4 | `registrar(query.update)` | «se pasa como argumento» |
| 5 | Import canónico sombreado por un parámetro | «"user_id" recibe…» · y la función legítima del mismo fichero **no** produce hallazgo |
| 6 | Identidad verificada y después reasignada | «"user_id" recibe…» · también si la reasignación va después del uso |
| 7 | `query['eq'](...)` | «"user_id" recibe…» |
| 8 | `const column = 'user_id'; query.eq(column, …)` | Ídem |
| 9 | Alias de `.eq` | Ídem · y con `.bind()` |

Más `.call()`, `.apply()`, retorno, almacenamiento en otra estructura, acceso
computado literal, constante y no resoluble, constante reasignada, extracción y
enlace de `caches.delete`, `caches` que resuelve a una variable local, sombreado por
variable de bloque, y columnas opacas en `.neq`, `.is`, `.filter` y `.in`.

Y **ocho controles legítimos** que deben seguir pasando: el repositorio real,
`caches.delete(k)` invocado directamente sobre el global, indexar un registro con
clave variable —`tabla[clave]`—, `.select().eq('locale', …)` de cliente, la identidad
canónica directa/renombrada/por espacio de nombres, una columna constante que no
designa propietario, `Array.prototype.filter` con uno o dos argumentos, y una
variable verificada reasignada desde otra verificada.

Los dos últimos importan especialmente: la primera versión conservadora de estas
reglas los rompía, y una guarda que falla con cualquier código no protege, estorba.

**Total acumulado: 106 casos que ejecutan las guardas reales** —30 de símbolo y
ámbito, 27 de blanqueo, 28 de evasión y 21 adversariales— más 26 bypasses
operacionales.

---

## MIGRATIONS

| Migración | Propósito | ¿Reversible? | ¿Aplicada? |
| --- | --- | --- | --- |
| `00000000000000_init.sql` | `pgcrypto`; enum `provenance_class`; `set_updated_at` | Sí | **No** |
| `00000000000001_profiles.sql` | `profiles` 1:1; trigger idempotente; RLS `enable`+`force`; grants mínimos | Sí (destructiva) | **No** |

**Verificado por test:** ninguna migración menciona `learning_events`,
`user_event_counters`, `projection_watermarks`, `stream_position`,
`question_attempts` ni `server_sequence`; no hay bloqueo de fila, ni secuencia
global, ni `ON CONFLICT DO NOTHING` fuera del alta de perfil.

`db:reset` está forzado a `--local` y rechaza `--db-url`, `--linked`,
`--project-ref`, `--remote` y cualquier cadena de conexión, incluidos los argumentos
que lleguen después de `--`. Seis bypasses probados ejecutando el comando real.

---

## SECURITY

**RLS.** `public.profiles` con `enable` + `force` en la misma migración que la crea
(EC-009), políticas de solo-propio con `with check`, sin `insert` ni `delete` para
`authenticated`.

**Auth · procedencia por símbolo.** El verificador vale solo si el identificador
invocado **resuelve** al especificador de importación del módulo canónico
`apps/web/src/server/auth/identity.ts` con el nombre exportado correcto, o a las
funciones del propio módulo canónico. Un parámetro, una variable o una función local
que se llamen igual resuelven a otra declaración y no valen. La confianza se guarda
por declaración: reasignar una variable verificada desde algo no demostrable la
envenena, y envenenar gana siempre —también si la reasignación aparece después del
uso—, porque el orden textual no puede decidir la seguridad.

Cubre `.eq`, `.neq`, `.is`, `.filter`, `.in`, `.match`, `.insert`, `.update`,
`.upsert` y `.rpc`, invocados directamente, por acceso computado que resuelva a
literal, o extraídos en una variable con o sin `.bind()`. Una columna de filtro que
no se resuelva a un literal es un hallazgo: si no se sabe qué columna es, no se puede
descartar que sea de identidad.

**Cliente · por símbolo y ámbito.** Cualquier acceso a un miembro llamado `insert`,
`update`, `upsert`, `delete` o `rpc` es un hallazgo, se invoque o no: eso cierra de
una vez la asignación posterior, la asignación destructurada, `.bind`/`.call`/
`.apply`, el paso como argumento, el retorno, el almacenamiento y los tres tipos de
acceso computado. La excepción de la Cache API exige las tres cosas a la vez —el
receptor resuelve al global real, el nombre está en el registro, y el acceso es la
llamada—: sombrearlo no la hereda y extraerlo tampoco.

**Secretos.** Centinela único por ejecución inyectado como **valor** de las variables
de servidor. Comprobado que no aparece en `.next/static`, ni en el HTML renderizado,
ni en los recursos `/_next/*` que ese HTML referencia. Y demostrado que la fuga se
detectaría.

**Tests con privilegios.** Producción denegada sin excepción; staging exige
autorización explícita; se comprueban la etiqueta del entorno y el host real. Los
E2E de auth exigen credenciales de limpieza **antes** de crear ningún usuario, marcan
cada correo con el identificador de la ejecución, listan entero antes de borrar,
borran solo lo suyo, y verifican «nada ajeno» sobre las **peticiones reales de
borrado**, no sobre una instantánea global que otra ejecución legítima puede hacer
fallar. El marcador se conserva mientras algo pueda ir mal.

---

## INVARIANTS VERIFIED

| ID | Resultado |
| --- | --- |
| EC-008 · EC-009 (estático) · EC-010 · EC-011 (nivel A) · EC-012 · EC-015 · EC-017 · EC-018 · EC-019 · EC-020 | **PASS** |
| INV-104 · INV-105 · INV-107 | **PASS** |
| INV-113 · REQ-A08 | **PASS** · análisis por símbolo y ámbito |
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
| D-09 | La resolución de ámbitos de las guardas trata `var` como si tuviera ámbito de bloque | Aceptable · produce más sombreado detectado, no menos |

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
git reset --hard d848f1a
```

Devuelve la rama al estado de la tercera reemisión. `main` conserva su commit raíz
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
