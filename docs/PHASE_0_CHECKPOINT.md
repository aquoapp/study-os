# STUDY OS · Checkpoint de Phase 0 · tercera reemisión

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 0 · Foundation
BRANCH: phase/0-foundation
COMMIT/TAG: ver «HEAD» en AUDIT_EVIDENCE.md (sin tag: se crea tras el merge aprobado)
STATUS: BLOCKED
```

**Tercera reemisión.** La segunda (`2c03ecb`) fue auditada y devolvió una ronda de
correcciones exclusivamente estáticas. Este informe la sustituye.

## Por qué sigue BLOCKED, y por qué solo por eso

Por **dos gates que necesitan infraestructura externa**, y por nada más:

- **P0-G4** exige los nueve checks en verde. Cuatro no pueden ejecutarse sin una
  instancia de Supabase alcanzable (**MI-05a**, y ausencia de Docker en la máquina
  de desarrollo).
- **P0-G2** exige comprobar la separación entre entornos reales. El código lo
  impide y está probado; entre entornos reales exige que esos entornos existan.

`Execution Plan §6` stop condition 1: «Phase 0 se detiene y se reporta BLOCKED si no
se dispone de credenciales o entornos (MI-05)».

**Lo que ya no bloquea.** `REQ-A06` y `P0-S7` estaban declarados bloqueados por
SD-019. Era una descripción equivocada del estado: la opción A está autorizada,
aplicada y **verificada en el navegador**, y el criterio de aceptación de `REQ-A06`
—«Tokens conformes; contraste AA verificado»— se cumple bajo sus restricciones.
Elegir entre las opciones B y C es una decisión **diferida**, con plazo antes de
Phase 5, que no condiciona ningún entregable de Phase 0. Ver la sección SD-019.

---

## 0. La ronda correctiva de esta reemisión

| # | Hallazgo de la auditoría | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | C1 y SD-019 opción A debían conservarse | **CONSERVADOS** | 19 casos de registro · 44 casos de accesibilidad renderizada |
| 2 | Guardas evadibles por alias, desestructuración y sombreado | **CERRADO** | `guards.laundering.spec` · 27 casos con las guardas reales |
| 3 | SD-018 sin la triple coincidencia del intento | **CERRADO** | `sd018.contract.spec` · 37 casos · sin implementar |
| 4 | La limpieza E2E borraba usuarios de otras ejecuciones | **CERRADO** | `e2eCleanupScope.spec` · 25 casos, preservación y concurrencia |
| 5 | SD-019 mal descrito como bloqueo de Phase 0 | **CERRADO** | Estado, tests y documentos reemitidos |
| 6 | La prueba negativa de accesibilidad era manual | **CERRADO** | Fixture automático en cada pasada |
| 7 | Evidencia y bundle | **CERRADO** | `AUDIT_EVIDENCE.md` |

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
| **P0-S8** | Cinco guardas con política conservadora, procedencia positiva y 76 pruebas de evasión y bypass | Completo |
| **P0-S9** | `/spec`, `/architecture`, `/docs` importados con SHA-256; registro versionado de documentos gobernantes | Completo |
| **P0-S10** | Este informe | Completo |

---

## SD-019 · de bloqueo a restricción verificada

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
Eso es el criterio de aceptación de `REQ-A06`, así que `REQ-A06` y `P0-S7` quedan
**satisfechos para Phase 0**.

Las restricciones no son deuda oculta: las hace cumplir la prueba de accesibilidad en
cada ejecución, y el **fixture negativo** del mismo fichero demuestra en cada pasada
que la medición detecta lo que dice detectar —`slate` sobre `canvas` a 4.31:1, texto
sobre `teal` y sobre `amber`, y un control de 24×24—, con su propio control de que no
salta con cualquier entrada.

**Diferido:** elegir entre B (oscurecer los tres colores) y C (modificar §14) para
usar la paleta sin restricciones. Lo necesitan las 18 familias de componentes de §16,
que empiezan en Phase 5. Diferido no es bloqueado, y nada de Phase 0 lo espera.

**Corrección adicional.** El requisito de contraste 3:1 se justificaba en los tokens
como «borde y metadato». «Metadato» es texto —un dato secundario se lee—, y leerlo
exige 4.5:1. Esa palabra autorizaba de hecho `slate` sobre `canvas` para texto de
apoyo. El 3:1 queda acotado a elementos **no textuales**: bordes, contornos de foco e
indicadores gráficos. La única rebaja admitida para texto es el **tamaño**, según
WCAG, nunca el rol.

---

## FILES CHANGED

Rondas anteriores: siete commits correctivos más `3872a84` (primera reemisión); siete
más `2c03ecb` (segunda). Esta ronda produce cinco, uno por preocupación más la
reemisión:

| Commit | Alcance |
| --- | --- |
| `593d72f` | Guardas: alias, desestructuración, sombreado, procedencia por módulo, payloads opacos |
| `aa0b2aa` | SD-018 · triple coincidencia del intento · sin implementar |
| `9b82cc2` | Limpieza E2E acotada a la ejecución |
| `9a76c4e` | Fixture negativo de accesibilidad, automático |
| (este) | SD-019 deja de presentarse como bloqueo · umbral 3:1 sin texto · reemisión |

Ficheros nuevos de esta ronda:

| Ruta | Propósito |
| --- | --- |
| `tests/unit/guards.laundering.spec.ts` | Las seis evasiones obligatorias y diez controles legítimos |
| `tests/unit/e2eCleanupScope.spec.ts` | Preservación y concurrencia de la limpieza |

---

## TESTS

### Recuento verificable

Obtenido con `vitest run --project unit --reporter=json`, no a mano.

| Fichero | Casos |
| --- | --- |
| `operational-security.spec.ts` | 60 |
| `sd018.contract.spec.ts` | 37 |
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
| `bundle.secret-scan.spec.ts` | 7 |
| `client.no-authoritative-write.spec.ts` | 7 |
| `primarySpaces.frozen.spec.ts` | 6 |
| `importGuard.spec.ts` | 4 |
| `taiLiteral.guard.spec.ts` | 3 |
| **Total** | **432 en 22 ficheros** |

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
| `npm run test:unit` | **PASS** · **432/432** en 22 ficheros |
| `npm run guards` | **PASS** · las cuatro sin hallazgos |
| `npm run secret-scan` | **PASS** · construye por sí mismo · centinela de servidor |
| `npm run test:e2e:static` | **PASS** · **70/70** (35 casos × 2 proyectos) |
| Pruebas negativas nuevas | **PASS** · 52 casos (27 de blanqueo + 25 de alcance de limpieza) |

Y fuera del checkout limpio, en el árbol de trabajo:

| Comando | Resultado |
| --- | --- |
| `npm run verify:originals` | **PASS** · 14/14 artefactos |
| `npm run verify:originals` sin originales | **FALLA con código 1** y dice qué falta |

`npm run build` exige las tres variables `NEXT_PUBLIC_*`. No son secretos —viajan al
navegador por definición— y la aplicación se niega a asumir un entorno en su lugar.
El README lo documenta.

### Escrito · **no ejecutado**

Sin mezclar con lo anterior: escrito no es ejecutado.

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

### P0-G5 · por qué PASS, con la lista de lo que falla

No se declara PASS por haberlo declarado antes. Se declara porque **las seis
evasiones que la auditoría nombró fallan de verdad** contra las guardas reales, y
están en `guards.laundering.spec`:

| # | Evasión | Detección |
| --- | --- | --- |
| 1 | Alias de `.update` | «Alias de ".update" en superficie de cliente» |
| 2 | Alias de `.rpc` por desestructuración | «Desestructuración de ".rpc"» + «como función suelta» |
| 3 | `caches` sombreado como parámetro | La excepción de navegador no se aplica · «Escritura .delete()» |
| 4 | Factory falso con el nombre del verificador | «"user_id" recibe …» · la procedencia se resuelve por módulo |
| 5 | Payload variable en `.insert()` | «no se resuelve a un literal» |
| 6 | Lista variable en `.in()` | «.in("user_id") … no se resuelve a un literal» |

Más once casos adicionales de la misma familia —alias renombrado, método computado no
resoluble, helper transitivo a dos saltos, `localStorage` y `window` sombreados,
espacio de nombres falso, verificador importado de otro módulo, argumentos variables
de RPC, clave computada en el payload, elemento sin verificar dentro de una lista
literal— y **diez controles legítimos** que deben seguir pasando: el global `caches`
sin sombrear, `.select()` de cliente, la identidad importada del módulo canónico
—directa, renombrada y por espacio de nombres—, un payload en variable construido a
partir de la identidad, `String.prototype.match` con una expresión regular en
variable, y una columna que no designa propietario.

A eso se suman los 26 bypasses operacionales y las 28 evasiones de la ronda anterior:
**76 casos que ejecutan las guardas reales**, no un doble.

---

## MIGRATIONS

| Migración | Propósito | ¿Reversible? | ¿Aplicada? |
| --- | --- | --- | --- |
| `00000000000000_init.sql` | `pgcrypto`; enum `provenance_class`; `set_updated_at` | Sí | **No** |
| `00000000000001_profiles.sql` | `profiles` 1:1; trigger idempotente; RLS `enable`+`force`; grants mínimos | Sí (destructiva) | **No** |

**Verificado por test:** ninguna migración menciona `learning_events`,
`user_event_counters`, `projection_watermarks`, `stream_position`,
`question_attempts` ni `server_sequence`; no hay bloqueo de fila, ni secuencia
global, ni `ON CONFLICT DO NOTHING` fuera del alta de perfil. Y ninguna de las tres
suites que SD-018 declara para `question_attempts` existe en `tests/**`: declarar una
prueba en un contrato no es escribirla.

`db:reset` está forzado a `--local` y rechaza `--db-url`, `--linked`,
`--project-ref`, `--remote` y cualquier cadena de conexión, incluidos los argumentos
que lleguen después de `--`. Seis bypasses probados ejecutando el comando real.

---

## SECURITY

**RLS.** `public.profiles` con `enable` + `force` en la misma migración que la crea
(EC-009), políticas de solo-propio con `with check`, sin `insert` ni `delete` para
`authenticated`.

**Auth · procedencia positiva por módulo.** Un valor usado como `user_id`, `owner_id`
o `profile_id` solo es válido si deriva de `getVerifiedIdentity()` o
`requireVerifiedIdentity()` **importadas y resueltas desde
`apps/web/src/server/auth/identity.ts`**. Llamarse así no basta: la guarda resuelve
la importación, admite el renombrado y el espacio de nombres, y rechaza un objeto
local con el mismo nombre de método. Se rechazan además `as VerifiedIdentity`,
`satisfies VerifiedIdentity`, el doble cast por `unknown` y la construcción manual de
la marca.

Y lo que no se puede ver, no se acepta: un payload, una lista o unos argumentos de
RPC que no se resuelvan a un literal en el mismo fichero son un hallazgo. Dos
declaraciones con el mismo nombre tampoco resuelven: la ambigüedad se trata como
falta de prueba, no como permiso.

**Cliente · política conservadora.** En superficie de cliente no se permite ninguna
escritura, ninguna `.rpc()` fuera de una allowlist explícita de solo lectura —hoy
vacía—, ningún alias o desestructuración de esos métodos, y ningún método computado
que no se resuelva. La excepción de las APIs del navegador vale solo para el símbolo
global real: si el fichero declara en cualquier parte un enlace con ese nombre, la
exención desaparece en todo el fichero.

**Secretos.** Centinela único por ejecución inyectado como **valor** de las variables
de servidor. Comprobado que no aparece en `.next/static`, ni en el HTML renderizado,
ni en los recursos `/_next/*` que ese HTML referencia. Y demostrado que la fuga se
detectaría.

**Tests con privilegios.** Producción denegada sin excepción; staging exige
autorización explícita; se comprueban la etiqueta del entorno y el host real. Los
E2E de auth exigen credenciales de limpieza **antes** de crear ningún usuario, marcan
cada correo con el identificador de la ejecución, borran solo lo suyo, y fallan tanto
si queda algún usuario propio como si ha desaparecido alguno ajeno.

---

## INVARIANTS VERIFIED

| ID | Resultado |
| --- | --- |
| EC-008 · EC-009 (estático) · EC-010 · EC-011 (nivel A) · EC-012 · EC-015 · EC-017 · EC-018 · EC-019 · EC-020 | **PASS** |
| INV-104 · INV-105 · INV-107 | **PASS** |
| INV-113 · REQ-A08 | **PASS** · política conservadora; alias y sombreado cubiertos |
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
| D-08 | Los E2E de auth no se han ejecutado nunca | Al disponer de instancia |

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
| **SD-018 · aprobar el contrato** | Cualquier migración de eventos. **No implementado** |
| **BD-02 · BD-05 · SD-006 · SD-007** | Primeras migraciones de dominio |

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
git reset --hard 2c03ecb
```

Devuelve la rama al estado de la segunda reemisión. `main` conserva su commit raíz
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
