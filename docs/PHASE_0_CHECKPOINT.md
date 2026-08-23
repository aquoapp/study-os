# STUDY OS · Checkpoint de Phase 0 · segunda reemisión

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 0 · Foundation
BRANCH: phase/0-foundation
COMMIT/TAG: ver «HEAD» en AUDIT_EVIDENCE.md (sin tag: se crea tras el merge aprobado)
STATUS: BLOCKED
```

**Segunda reemisión.** La primera reemisión (`3872a84`) fue auditada y devolvió diez
hallazgos. Este informe la sustituye. El estado sigue siendo **BLOCKED**.

**Por qué BLOCKED.** El gate P0-G4 exige los nueve checks en verde. Cuatro no pueden
ejecutarse sin una instancia de Supabase alcanzable (**MI-05a** + ausencia de Docker
en la máquina de desarrollo). `Execution Plan §6` stop condition 1: «Phase 0 se
detiene y se reporta BLOCKED si no se dispone de credenciales o entornos (MI-05)».

Y **SD-019**: la paleta congelada del Design System no alcanza el AA que el propio
documento exige como P0. La opción A está autorizada e implementada, pero acota el
uso sin resolver la contradicción, así que `REQ-A06` y `P0-S7` siguen bloqueados.

---

## 0. Los diez hallazgos de la auditoría

| # | Hallazgo | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | `test:unit` dependía de `_handoff/originals/` | **CERRADO** | Registro versionado + `verify:originals` separado · 19 casos |
| 2 | SD-019 sin evidencia renderizada | **CERRADO** | 60 casos E2E miden color computado y `boundingBox()` |
| 3 | Guardas evadibles | **CERRADO** | Política conservadora + procedencia positiva · 49 casos de evasión |
| 4 | SD-018 con contrato incorrecto | **CERRADO** | Orden corregido · 24 casos · sin implementar |
| 5 | Seguridad operacional | **CERRADO** | Suites separadas, reset local, lock de solo lectura · 26 casos |
| 6 | Veracidad documental | **CERRADO** | Recuentos verificables · procedencia de tokens · 14 casos |
| 7 | Recuento de commits erróneo | **CERRADO** | Ver §«FILES CHANGED» |
| 8 | «Todos los valores proceden del documento» | **CERRADO** | `TOKEN_PROVENANCE` separa DOCUMENT de PROVISIONAL |
| 9 | Comentarios obsoletos de SD-015 | **CERRADO** | Sustituidos por SD-018 |
| 10 | P0-G3 y P0-G5 sin pruebas que los sostuvieran | **CERRADO** | Las pruebas están y se ejecutan · ver ACCEPTANCE GATES |

### Corrección del recuento de commits

El informe anterior decía «seis commits correctivos». Eran **siete** antes de la
reemisión, y **ocho** contando `3872a84`, que es el commit de la propia reemisión.

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
| **P0-S7** | Tokens con los valores de `STUDY_OS_Design_System_v1.0` §2, §3, §13, y los defaults de implementación marcados aparte | **BLOQUEADO** · SD-019 |
| **P0-S8** | Cinco guardas con política conservadora y 49 pruebas de evasión | Completo |
| **P0-S9** | `/spec`, `/architecture`, `/docs` importados con SHA-256; registro versionado de documentos gobernantes | Completo |
| **P0-S10** | Este informe | Completo |

---

## FILES CHANGED

La ronda correctiva anterior produjo **siete** commits —`ad03070`, `fff6d3e`,
`d9c7d58`, `d592809`, `1f265a9`, `7dbb444`, `0e80c25`— y **ocho** contando
`3872a84`, que es el commit de la propia reemisión.

Esta ronda final produce ocho, uno por preocupación más la reemisión:

| Commit | Alcance |
| --- | --- |
| `6117cf1` | `_handoff` fuera de `test:unit` · `verify:originals` |
| `62d0c41` | SD-019 opción A aplicada y verificada en el navegador |
| `2058d93` | Guardas conservadoras y procedencia positiva |
| `9d5bc36` | Contrato de SD-018 corregido |
| `0c62f06` | Seguridad operacional · suites separadas, reset local, lock read-only |
| `d6b01be` | Veracidad documental · recuentos verificables y procedencia de tokens |
| `576d48c` | Cómo reproducir los checks desde un checkout limpio |
| (este) | Reemisión con la evidencia ya ejecutada |

Ficheros nuevos de esta ronda:

| Ruta | Propósito |
| --- | --- |
| `docs/governing-documents.json` | Registro versionado de nombres y hashes |
| `tools/verify-originals.mjs` | Comprobación local, fuera de los nueve checks |
| `tools/guards/schema-drift-lock.mjs` | Generación explícita del lock |
| `playwright.base.ts` · `.static.config.ts` · `.auth.config.ts` | Suites separadas |
| `tests/e2e/static/accessibility.a11y.spec.ts` | Contraste y diana táctil medidos |
| `tests/unit/guards.evasion.spec.ts` | Las evasiones denunciadas |
| `tests/unit/operational-bypasses.spec.ts` | Los bypasses, ejecutados de verdad |
| `tests/unit/sd018.contract.spec.ts` | El contrato dice lo que debe, y nada está implementado |
| `tests/unit/tokens.provenance.spec.ts` | DOCUMENT frente a PROVISIONAL |
| `tests/unit/governingDocuments.registry.spec.ts` | Contrato del registro, sin `_handoff` |

---

## TESTS

### Recuento verificable

Obtenido con `vitest run --project unit --reporter=json`, no a mano.

| Fichero | Casos |
| --- | --- |
| `operational-security.spec.ts` | 60 |
| `tokens.contrast.spec.ts` | 29 |
| `guards.evasion.spec.ts` | 28 |
| `tokens.contract.spec.ts` | 28 |
| `operational-bypasses.spec.ts` | 26 |
| `sd018.contract.spec.ts` | 24 |
| `guards.adversarial.spec.ts` | 21 |
| `governingDocuments.registry.spec.ts` | 19 |
| `toolchain.pinning.spec.ts` | 18 |
| `env.separation.spec.ts` | 16 |
| `auth.serverVerifiedIdentity.spec.ts` | 15 |
| `schema.drift.spec.ts` | 14 |
| `tokens.provenance.spec.ts` | 14 |
| `offline.copy.spec.ts` | 13 |
| `designSystem.blocked.spec.ts` | 12 |
| `bundle.secret-scan.spec.ts` | 7 |
| `client.no-authoritative-write.spec.ts` | 7 |
| `primarySpaces.frozen.spec.ts` | 6 |
| `importGuard.spec.ts` | 4 |
| `taiLiteral.guard.spec.ts` | 3 |
| **Total** | **364 en 20 ficheros** |

### Ejecutado · en verde

Todo lo que sigue se ejecutó sobre `git archive HEAD` extraído en una carpeta vacía,
**sin `_handoff`**, sin `node_modules` y sin ningún `.env`. La salida íntegra está en
`AUDIT_EVIDENCE.md`.

| Comando | Resultado |
| --- | --- |
| `npm ci` | **PASS** · 201 paquetes auditados, 0 vulnerabilidades |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run format` | **PASS** |
| `npm run build` | **PASS** · 8 rutas |
| `npm run test:unit` | **PASS** · **364/364** en 20 ficheros |
| `npm run guards` | **PASS** · las cuatro sin hallazgos |
| `npm run secret-scan` | **PASS** · construye por sí mismo · 14 ficheros estáticos, 7 rutas, 10 recursos |
| `npm run test:e2e:static` | **PASS** · **60/60** (30 casos × 2 proyectos) |
| Fixtures adversariales | **PASS** · **132/132** en 6 ficheros |

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
| **P0-G1** · La app arranca | `app.boot` y `pwa.manifest` en verde | **PASS** · 34/34 |
| **P0-G2** · Separación de entornos | Producción no accesible desde staging | **PARCIAL** · el código lo impide y está probado; entre entornos reales exige MI-05a |
| **P0-G3** · Sin secretos en cliente | Escaneo sin hallazgos | **PASS** · centinela de servidor inyectado en el build, comprobado en `.next/static`, en el HTML de 7 rutas y en 10 recursos; y demostrado que la fuga se detecta |
| **P0-G4** · Baseline lint/type/test | Los nueve checks en verde | **FAIL** · 5 verdes, 0 rojos, 4 bloqueados |
| **P0-G5** · Guardas de invariante activas | Fallan ante una violación deliberada | **PASS** · 49 casos de evasión + 26 de bypass operacional, todos ejecutando las guardas reales |

P0-G3 y P0-G5 se declaran PASS porque **esta ronda aporta las pruebas**: el centinela
con su prueba de fuga, las 28 evasiones de guardas y los 26 bypasses operacionales.
No se declaran por haberlo declarado antes.

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

**Auth · procedencia positiva.** Un valor usado como `user_id`, `owner_id` o
`profile_id` solo es válido si se demuestra que deriva de `getVerifiedIdentity()` o
`requireVerifiedIdentity()`. Todo lo demás se rechaza, incluido lo que la guarda no
sabe interpretar. Se rechazan también `as VerifiedIdentity`, `satisfies
VerifiedIdentity`, el doble cast por `unknown` y la construcción manual de la marca.

**Cliente · política conservadora.** En superficie de cliente no se permite ninguna
escritura ni ninguna `.rpc()` que no esté en una allowlist explícita de solo lectura,
hoy vacía. Cubre cadenas partidas, alias, nombres en constantes, métodos computados
y helpers transitivos en `apps/**` y `packages/**`.

**Secretos.** Centinela único por ejecución inyectado como **valor** de las variables
de servidor. Comprobado que no aparece en `.next/static`, ni en el HTML de siete
rutas, ni en los diez recursos `/_next/*` que ese HTML referencia. Y demostrado que
la fuga se detectaría.

**Tests con privilegios.** Producción denegada sin excepción; staging exige
autorización explícita; se comprueban la etiqueta del entorno y el host real. Los
E2E de auth exigen credenciales de limpieza **antes** de crear ningún usuario,
comprueban que funcionan, y fallan si al terminar queda alguno.

---

## INVARIANTS VERIFIED

| ID | Resultado |
| --- | --- |
| EC-008 · EC-009 (estático) · EC-010 · EC-011 (nivel A) · EC-012 · EC-015 · EC-017 · EC-018 · EC-019 · EC-020 | **PASS** |
| INV-104 · INV-105 · INV-107 | **PASS** |
| INV-113 · REQ-A08 | **PASS** · política conservadora |
| INV-116 · REQ-A07 | **PASS** (estático) · cookie forjada **BLOQUEADO** |
| EC-009 en ejecución · REQ-C13 | **BLOQUEADO** · `test:rls` no ejecutable |
| REQ-A06 | **BLOQUEADO** · SD-019 |
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
| D-07 | `teal` y `amber` no pueden llevar texto normal | Al elegir entre SD-019 B y C |
| D-08 | Los E2E de auth no se han ejecutado nunca | Al disponer de instancia |

---

## DEFERRED REQUIREMENTS

| Requisito | Estado |
| --- | --- |
| REQ-A01 … REQ-A05, REQ-A08, REQ-A09 | Implementados y verificados |
| REQ-A06 | **BLOQUEADO** · SD-019 |
| REQ-A07 | Implementado · verificación E2E e integración **bloqueada** |
| REQ-C13 (parcial, sobre `profiles`) | Implementado · `test:rls` **bloqueado** |

---

## BLOCKED DECISIONS

| ID | Impacto |
| --- | --- |
| **MI-05a** · repositorio remoto, Supabase, Vercel | Impide P0-G4 y la protección de `main` |
| **Docker o WSL2** en la máquina | Impide `test:integration`, `test:rls`, `test:e2e:auth` y `schema-drift` nivel B |
| **SD-019 · elegir entre B y C** | Cierre de `REQ-A06` y `P0-S7`. Antes de Phase 5 |
| **SD-018 · aprobar el contrato** | Cualquier migración de eventos. **No implementado** |
| **BD-02 · BD-05 · SD-006 · SD-007** | Primeras migraciones de dominio |

`MI-05b` (proveedor de IA) no se ha solicitado: es entrada de Phase 8.

---

## ROLLBACK

Nada se ha aplicado fuera del repositorio local: ninguna migración ejecutada, ningún
entorno creado, ningún servicio externo tocado, ningún secreto escrito.

```bash
git reset --hard 3872a84
```

Devuelve la rama al estado de la primera reemisión. `main` conserva su commit raíz
`6086537`.

---

## NEXT RECOMMENDED PHASE

**Ninguna.** Phase 0 no cierra y Phase 1 no debe arrancar.

1. **MI-05a** · repositorio remoto con `main` protegida, proyecto Supabase, Vercel.
2. **Docker Desktop**, o aceptar que los cuatro checks bloqueados solo corran en CI.
3. `npm run db:start && npm run db:reset && npm run verify`.
4. **Decidir SD-019** entre B y C.
5. **Aprobar SD-018** antes de cualquier migración de eventos.
6. Cerrar **BD-02**, **BD-05**, **SD-006**, **SD-007**.
7. Aprobar la adenda del `SPEC_DIFF_LOG`.
8. Reemitir el checkpoint. Con 1–6 resueltos el estado esperado es **PASS WITH
   DEBT**, y solo entonces procede autorizar Phase 1.

Todos los ADR siguen en `PROPOSED`.
