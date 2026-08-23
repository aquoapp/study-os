# STUDY OS · Checkpoint de Phase 0 · reemisión tras auditoría externa

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 0 · Foundation
BRANCH: phase/0-foundation
COMMIT/TAG: ver «HEAD» abajo (sin tag: el tag se crea tras el merge a main aprobado)
STATUS: BLOCKED
```

**Reemisión.** La auditoría externa del bundle `…_904cf87` confirmó su integridad y
**rechazó el checkpoint**. Este informe sustituye al anterior. Los diez puntos del
rechazo están cerrados o explicados; el estado sigue siendo **BLOCKED**, y ahora por
motivos verificados en lugar de supuestos.

**Por qué BLOCKED.** El gate P0-G4 exige los nueve checks en verde. Cuatro no pueden
ejecutarse sin una instancia de Supabase alcanzable (**MI-05a** + ausencia de Docker
en la máquina de desarrollo). `Execution Plan §6` stop condition 1 es literal:
«Phase 0 se detiene y se reporta BLOCKED si no se dispone de credenciales o entornos
(MI-05)». Declarar PASS WITH DEBT con `test:rls` sin ejecutar convertiría un fallo
duro del Checkpoint Contract —«failing RLS isolation test»— en deuda administrativa,
que es la erosión que EC-019 prohíbe.

A ello se suma **SD-019**: la paleta congelada del Design System no alcanza el AA que
el propio documento exige como P0, lo que mantiene `REQ-A06` y `P0-S7` bloqueados por
una contradicción **medida**, no por falta de trabajo.

---

## 0. Qué cambió respecto al informe rechazado

| # | Hallazgo de la auditoría | Estado |
| --- | --- | --- |
| 1 | Runtime no unificado | **CERRADO** · Node 24 en `package.json`, `.nvmrc`, `.node-version`, `.npmrc` y CI, con test que impide la deriva |
| 2 | Supabase CLI sin fijar | **CERRADO** · `devDependency` con versión exacta, resuelta desde el lockfile; sin `latest`, sin `npx --yes`, sin global |
| 3 | Guardas evadibles | **CERRADO** · reescritas sobre AST, alcance `apps/**` y `packages/**`, superficie de cliente transitiva, registro explícito de RPC · 21 pruebas adversariales |
| 4 | `ARCHITECTURE_STATE` desactualizado · INV-101 mal listado | **CERRADO** · copia viva v2.0 con divergencia registrada; `CLAUDE.md` corregido |
| 5 | Valores del Design System inventados | **RESUELTO DE OTRA FORMA** · el documento llegó durante la ronda; los tokens ya son suyos. P0-S7 y REQ-A06 **siguen bloqueados** por SD-019 |
| 6 | `verify` no reproducible · check duplicado en CI | **CERRADO** · `secret-scan` construye por sí mismo; paso duplicado eliminado |
| 7 | La pantalla offline prometía persistencia | **CERRADO** · texto corregido y test que impide reintroducirlo |
| 8 | Seguridad operacional | **CERRADO** · producción denegada, staging con autorización explícita, limpieza de usuarios E2E, guarda destructiva conectada |
| 9 | SD-015 debía sustituirse | **CERRADO** · `SD-018`, PROPOSED, no implementado |
| 10 | `secret-scan` limitado a `.next/static` | **CERRADO** · centinela de servidor + salida renderizada + prueba de que el detector funciona |

### Corrección de una afirmación falsa del informe anterior

El checkpoint rechazado decía, en su sección de seguridad, que los usuarios de prueba
se eliminaban. **Era falso para los E2E.** Los tests de integración y RLS sí borraban
los suyos, porque los crean con la API de administración; los E2E dan de alta a través
del formulario y el navegador no tiene rol de servicio con el que deshacerlo. Cada
ejecución dejaba cuentas huérfanas. Corregido con `globalTeardown` y `purgeTestUsers()`.

---

## SPEC REFERENCES

- `STUDY_OS_Builder_Handoff_Manifest_v1.0` §5, §6, §7, §8, §9, §10 (Phase 0), §14, §20
- `STUDY_OS_Engineering_Constitution_v1.0` EC-008 … EC-020
- `STUDY_OS_Design_System_v1.0` §2, §3, §13, §14, §15 — **incorporado en esta ronda**
- `STUDY_OS_Technical_Architecture_v1.0` §1–§6, §5.2–§5.4
- `docs/PHASE_0_EXECUTION_PLAN.md` v1.2 · P0-S1 … P0-S10, §4, §5, §6
- `spec/requirement-index.md` REQ-A01 … REQ-A09, REQ-C13
- `spec/invariant-register.md` EC-009, EC-010, EC-011, EC-012, EC-015, EC-017, EC-018, INV-104, INV-105, INV-107, INV-113
- `docs/SPEC_DIFF_LOG.md` · adenda: ERRATA P0-IN-1, SD-016, SD-017, **SD-018**, **SD-019**

---

## DELIVERED

| Paso | Entregado | Estado |
| --- | --- | --- |
| **P0-S1** | Monorepo npm workspaces conforme a Manifest §8 | Completo |
| **P0-S2** | `@study-os/config`: tres entornos, políticas como dato compartido, allowlist pública, frontera `server-only`, guardas destructivas | Completo |
| **P0-S3** | Next.js 16.3.2 · TypeScript `strict` · PWA instalable · Node 24 | Completo |
| **P0-S4** | Migración 0 (extensiones + enum `provenance_class` + utilidad) con rollback | **Escrita · sin aplicar** · no hay base de datos |
| **P0-S5** | Migración 1: `profiles` 1:1, trigger idempotente, RLS `enable`+`force`, políticas de solo-propio | **Escrita · sin aplicar** |
| **P0-S6** | CI en dos jobs con los nueve checks, CLI fijado, sin pasos duplicados | **Escrito · nunca ejecutado** · no hay remoto |
| **P0-S7** | Tokens con los valores literales de `STUDY_OS_Design_System_v1.0` §2, §3, §13 | **BLOQUEADO** · SD-019 |
| **P0-S8** | Cinco guardas sobre AST con 21 pruebas adversariales | Completo |
| **P0-S9** | `/spec`, `/architecture`, `/docs` importados con SHA-256; `CLAUDE.md` enmendado | Completo |
| **P0-S10** | Este informe | Completo |

**Sobre el plan, por decisión humana:** enforcement de **INV-116** (SD-016).

**Fuera de lo previsto, por llegada de material:** incorporación del Design System
v1.0, con la contradicción SD-019 que ello destapó.

---

## FILES CHANGED

Seis commits correctivos sobre `904cf87`:

| Commit | Alcance |
| --- | --- |
| `ad03070` | Node 24 + CLI de Supabase fijado · 11 ficheros |
| `fff6d3e` | Guardas sobre AST + adversariales · 21 ficheros |
| `d9c7d58` | `secret-scan` con centinela + `verify` reproducible · 7 ficheros |
| `d592809` | Seguridad operacional · 15 ficheros |
| `1f265a9` | Copy de offline sin garantías · 3 ficheros |
| `7dbb444` | Design System real + SD-018 + SD-019 · 17 ficheros |
| `0e80c25` | `ARCHITECTURE_STATE` viva + `CLAUDE.md` + procedencia · 3 ficheros |

Ficheros nuevos más relevantes:

| Ruta | Propósito |
| --- | --- |
| `tools/guards/lib/ast.mjs` | Análisis sintáctico con el compilador de TypeScript |
| `tools/guards/lib/client-surface.mjs` | Superficie de cliente transitiva; frontera `server-only` y `'use server'` |
| `tools/supabase-cli.mjs` · `tools/db.mjs` | CLI fijado y punto de entrada único con guarda destructiva |
| `tools/lib/environment-policy.mjs` | Gemelo en Node de la política de entornos |
| `packages/domain/src/authority-registry.json` | Registro explícito de proyecciones y RPC autoritativas |
| `packages/config/src/destructive.ts` | Decisión de operación destructiva, usada de verdad |
| `packages/config/src/server-env-keys.ts` | Claves de servidor fuera del grafo de cliente |
| `packages/design-system/src/status.ts` | Estado y procedencia del Design System |
| `tests/unit/guards.adversarial.spec.ts` | Las cinco evasiones denunciadas |
| `tests/unit/operational-security.spec.ts` | 60 casos de seguridad operacional |
| `tests/unit/toolchain.pinning.spec.ts` | Reproducibilidad del entorno |
| `tests/unit/offline.copy.spec.ts` | El copy no promete lo que no existe |
| `tests/e2e/global-setup.ts` · `global-teardown.ts` | Autorización y limpieza de los E2E |
| `docs/GOVERNING_DOCUMENTS.md` | Inventario de los ocho documentos con hash |

---

## TESTS

### Ejecutados · todos en verde

| Comando | Resultado |
| --- | --- |
| `npm ci` | **PASS** · 196 paquetes, **0 vulnerabilidades** |
| `npm run typecheck` | **PASS** · 0 errores |
| `npm run lint` | **PASS** · 0 errores |
| `npm run format` | **PASS** |
| `npm run build` | **PASS** · 8 rutas, 0 avisos |
| `npm run test:unit` | **PASS** · **256/256** en 15 ficheros |
| `npm run guards` | **PASS** · las cuatro sin hallazgos |
| `npm run secret-scan` | **PASS** · centinela inyectado, 14 estáticos + 7 rutas + 10 recursos, 0 hallazgos |
| `npx playwright test app.boot.e2e pwa.manifest.spec` | **PASS** · **26/26** (13 móvil + 13 escritorio) |

Desglose de los unitarios por fichero:

| Fichero | Casos | Qué prueba |
| --- | --- | --- |
| `toolchain.pinning.spec` | 18 | Node 24 coherente; CLI de Supabase exacto; sin `latest` ni `npx` |
| `guards.adversarial.spec` | 21 | Las cinco evasiones denunciadas por la auditoría |
| `operational-security.spec` | 60 | Producción denegada; staging con autorización; paridad TS/Node |
| `designSystem.blocked.spec` | 13 | Procedencia por hash; P0-S7 y REQ-A06 bloqueados por SD-019 |
| `tokens.contract.spec` | 22 | Valores literales del documento; sin tema oscuro inventado |
| `tokens.contrast.spec` | 35 | 16 pares declarados + las tres combinaciones de SD-019 |
| `offline.copy.spec` | 13 | Ninguna superficie promete persistencia ni sincronización |
| `auth.serverVerifiedIdentity.spec` | 16 | INV-116 · verificador, superficies, 3 negativas |
| `client.no-authoritative-write.spec` | 8 | INV-113 · registro compartido, 2 negativas |
| `bundle.secret-scan.spec` | 7 | EC-010 · incluida la prueba de fuga del centinela |
| `env.separation.spec` | 16 | REQ-A03 · gate P0-G2 a nivel de código |
| `schema.drift.spec` | 16 | REQ-A04 · EC-011 · forma de migraciones, RLS, sin dominio |
| `primarySpaces.frozen.spec` | 6 | EC-015 · contra copia literal |
| `importGuard.spec` | 4 | ADR-001 |
| `taiLiteral.guard.spec` | 3 | EC-018 |

### Las cinco pruebas adversariales · resultados explícitos

| # | Evasión | Casos | Resultado |
| --- | --- | --- | --- |
| **A1** | `'use client'` en `packages/**` con escritura autoritativa | 2 | **PASS** · rechazada directa y transitivamente, con la cadena de importación en el mensaje |
| **A2** | RPC autoritativa desde cliente | 2 | **PASS** · `recalculate_mastery` rechazada citando EC-002; una RPC fuera del registro no salta |
| **A3** | `tai`, `Tai` y otras cajas | 7 | **PASS** · las cinco variantes y `tai_pack_id` rechazadas; `retain`, `TAIL`, `Taiwan`, `captain`, `TAILWIND` no |
| **A4** | `user_id` del cuerpo por alias o desestructuración | 6 | **PASS** · alias, desestructuración, cadena de variables, cuerpo de `insert` y argumento de `rpc`; el filtro por identidad verificada no salta |
| **A5** | Importación prohibida desde un paquete de cliente | 4 | **PASS** · directa, transitiva y dinámica; el import desde servidor no salta |

Y la prueba que hace significativo el escaneo de secretos:

| Prueba | Resultado |
| --- | --- |
| Fuga deliberada del centinela en una ruta renderizada | **PASS** · detectada: «respuesta `/offline` · contiene el VALOR de `SUPABASE_SERVICE_ROLE_KEY` (centinela)» |

### No ejecutados · **BLOQUEADOS**

| Comando | Casos | Motivo |
| --- | --- | --- |
| `npm run test:integration` (`profile.oneToOne.spec`) | 10 | Requiere instancia de Supabase |
| `npm run test:rls` (`rls.userIsolation.profiles.spec`) | 12 | Requiere instancia de Supabase |
| `npx playwright test auth.signup-login.e2e` | 10 | Requiere servidor de Auth real |
| `npx playwright test auth.forgedCookieRejected.e2e` | 6 | Requiere servidor de Auth real |
| `npm run schema-drift` nivel B | — | Requiere `SUPABASE_DB_URL`. El nivel A sí pasa |

Ninguno se ha desactivado ni marcado como omitido: fallan con un mensaje que dice qué
falta. `verify` cuenta un check bloqueado como fallo.

---

## ACCEPTANCE GATES

| Gate | Condición | Resultado |
| --- | --- | --- |
| **P0-G1** · La app arranca | `app.boot.e2e` y `pwa.manifest.spec` en verde | **PASS** · 26/26 |
| **P0-G2** · Separación de entornos | Producción no accesible desde staging | **PARCIAL** · el código lo impide y está probado; la comprobación entre entornos reales exige MI-05a |
| **P0-G3** · Sin secretos en cliente | `bundle.secret-scan.spec` sin hallazgos; `client.no-authoritative-write.spec` en verde | **PASS** · con centinela de servidor y prueba de que la fuga se detectaría |
| **P0-G4** · Baseline lint/type/test | Los nueve checks en verde | **FAIL** · 5 verdes, 0 rojos, 4 bloqueados |
| **P0-G5** · Guardas de invariante activas | Fallan ante una violación deliberada | **PASS** · 21 pruebas adversariales + 12 negativas previas |

P0-G3 y P0-G5 se declaran PASS porque hay pruebas nuevas que lo demuestran, no por
haberlo declarado antes.

---

## MIGRATIONS

| Migración | Propósito | ¿Reversible? | ¿Aplicada? |
| --- | --- | --- | --- |
| `00000000000000_init.sql` | `pgcrypto`; enum `provenance_class` (EC-008); `set_updated_at` | Sí | **No** |
| `00000000000001_profiles.sql` | `profiles` 1:1; trigger idempotente; RLS `enable`+`force`; políticas de solo-propio; grants mínimos | Sí (destructiva) | **No** |

**Lo que deliberadamente NO hacen:** no crean los esquemas `content`/`engine`/`audit`
de ADR-001 —ese ADR está `PROPOSED` y la ADR Policy solo admite cambios arquitectónicos
desde ADR `ACCEPTED`—; no habilitan `pgvector` (Phase 8); no declaran enums de dominio
salvo el congelado por EC-008; **no crean ninguna tabla de dominio ni de eventos**,
verificado por test.

`db:reset` pasa por `tools/db.mjs`, que deniega la operación en producción sin
excepción y exige autorización explícita en staging.

---

## SECURITY

**RLS.** `public.profiles` con `enable` + `force` en la misma migración que la crea
(EC-009). `force` no es un detalle: sin él una conexión con privilegios de propietario
atraviesa las políticas. `select` y `update` restringidos a `(select auth.uid()) = id`,
con `with check` en el `update`. Sin política de `insert` ni de `delete` para
`authenticated`. La política de borrado de cuenta es OBS-03 (Phase 11).

**Auth.** La identidad de toda superficie protegida se obtiene **solo** en
`apps/web/src/server/auth/identity.ts`, con `getClaims()` y reserva en `getUser()`
(INV-116). `getSession()` está prohibido por ESLint **y** por guarda AST.

**`user_id` de la petición.** La guarda hace propagación de contaminación: marca los
valores que vienen de la petición y los sigue por asignaciones, desestructuraciones,
alias, accesos a propiedad y extractores (`request.json()`, `formData.get()`,
`searchParams.get()`) hasta `.eq/.filter/.match/.insert/.update/.upsert/.rpc`. Seis
pruebas adversariales lo confirman.

**Secretos.** `secret-scan` genera un centinela único por ejecución, construye con él
como **valor** de las variables de servidor, y comprueba que no aparece ni en
`.next/static` ni en el HTML de siete rutas ni en los diez recursos `/_next/*` que ese
HTML referencia. **0 hallazgos.** Y se demuestra que la fuga se detectaría.

**Defecto real corregido.** La guarda ampliada encontró que
`packages/config/src/environments.ts` exportaba `SERVER_ONLY_ENV_KEYS` y era alcanzable
desde el navegador vía el barril `@study-os/config`. Solo eran nombres y el
empaquetador los eliminaba por *tree-shaking*, pero eso convierte una garantía en una
consecuencia de la optimización. Trasladados fuera del grafo de cliente.

**Operaciones destructivas y tests con privilegios.** Producción denegada sin
excepción; staging exige `STUDY_OS_DESTRUCTIVE_AUTHORIZATION="staging:<operación>"`
exacto; entorno desconocido denegado; se comprueban la etiqueta del entorno **y** el
host real de la URL. Verificado a mano en cinco escenarios.

**Rutas privilegiadas.** Ninguna en Phase 0. `SUPABASE_SERVICE_ROLE_KEY` solo se lee
desde `@study-os/config/server`, marcado `server-only`, que hace fallar el build si
entra en un Client Component.

---

## INVARIANTS VERIFIED

| ID | Verificación | Resultado |
| --- | --- | --- |
| EC-008 | Enum `provenance_class` cerrado | **PASS** (estático) |
| EC-009 · REQ-C13 | RLS `enable`+`force` en la misma migración | **PASS** (estático) · aislamiento en ejecución **BLOQUEADO** |
| EC-010 · REQ-A05 | Centinela de servidor en bundle y renderizado | **PASS** |
| EC-011 · REQ-A04 | `schema-drift` nivel A + CLI fijado | **PASS** · nivel B **BLOQUEADO** |
| EC-012 | Service worker acotado + `offline.copy.spec` | **PASS** |
| EC-015 · REQ-A09 | `PRIMARY_SPACES` contra copia literal | **PASS** |
| EC-017 | Anti-patrones de §15 y gamificación prohibidos | **PASS** |
| EC-018 | `tai-literal` insensible a mayúsculas | **PASS** |
| EC-019 | Artefactos congelados sin modificar; hashes verificados en test | **PASS** |
| EC-020 | `verify` no omite ningún check | **PASS** |
| INV-104 · INV-105 · INV-107 | Una acción primaria; error con texto; copy sin culpa | **PASS** |
| INV-113 · REQ-A08 | Guarda AST, superficie transitiva, registro de RPC | **PASS** |
| INV-116 · REQ-A07 | Verificador único, ESLint, contaminación de `user_id` | **PASS** (estático) · cookie forjada **BLOQUEADO** |
| REQ-A06 | Valores del documento **sí**; contraste AA **no** | **BLOQUEADO** · SD-019 |
| INV-101 | Aprobado por Ana. Sin superficie que pueda violarlo | N/A en Phase 0 |

---

## KNOWN DEBT

| # | Deuda | Motivo | Resolver en |
| --- | --- | --- | --- |
| D-01 | `main` no está protegida mecánicamente | La protección de rama es función de la *forge*; no hay remoto | Al crear el remoto |
| D-02 | Las migraciones nunca se han aplicado | Sin Docker no hay Supabase local | Al disponer de instancia |
| D-03 | CI nunca se ha ejecutado | No hay remoto | Al primer *push* |
| D-04 | La familia tipográfica es de sistema | §2 da dirección, no nombre | Al decidirla |
| D-05 | `next-env.d.ts` versionado y en `.prettierignore` | Lo regenera cada build con otro estilo de comillas | — |
| D-06 | Listas espejo entre TypeScript y las herramientas `.mjs` | Las herramientas no pueden importar TS. Hay tests que comparan ambas | Aceptable |
| D-07 | `teal` y `amber` no pueden llevar texto | Consecuencia de SD-019 | Al decidir SD-019 |

---

## DEFERRED REQUIREMENTS

| Requisito | Estado |
| --- | --- |
| REQ-A01 … REQ-A05, REQ-A08, REQ-A09 | Implementados y verificados |
| REQ-A06 | **BLOQUEADO** · valores del documento correctos; el criterio «contraste AA verificado» no se cumple (SD-019) |
| REQ-A07 | Implementado · verificación E2E e integración **bloqueada** |
| REQ-C13 (parcial, sobre `profiles`) | Implementado · `test:rls` **bloqueado** |

---

## BLOCKED DECISIONS

### Bloqueos de entrada

| ID | Impacto | Recomendación |
| --- | --- | --- |
| **MI-05a** · repositorio remoto, proyecto Supabase, cuenta Vercel | Impide P0-G4, la protección de `main` y cuatro checks | Crear los tres. Ninguna credencial pasa por la conversación |
| **Docker (o WSL2)** en la máquina de desarrollo | `supabase start` no puede ejecutarse: verificado que no hay Docker, ni Podman, ni WSL | Instalar Docker Desktop. En CI no hace falta |

`MI-05b` (proveedor de IA) **no se ha solicitado**: es entrada de Phase 8.

### Decisiones que impiden cerrar Phase 0 con PASS

| Decisión | Estado | Por qué antes del cierre |
| --- | --- | --- |
| **SD-019** · la paleta no alcanza el AA que exige §14 | **PROPOSED · nueva** | Bloquea REQ-A06 y P0-S7. Tres opciones y recomendación en el log |
| **SD-018** · orden de eventos por usuario | **PROPOSED · sustituye a SD-015** | Migración 8. Antes de ingerir evidencia real |
| **BD-02** · identidad estable de concepto | Abierta | Migración 3 |
| **BD-05** · convocatoria / modelo / ocurrencia | Abierta | Migración 5 |
| **SD-006** · referencias polimórficas | PROPOSED | `session_items` y `planner_items` |
| **SD-007** · claves de respuesta fuera del Data API | PROPOSED | Separación de esquemas |
| **INV-101** | **APROBADO** | Ya no bloquea |

### SD-018 · estado explícito

**SD-015 queda superseded.** No debe implementarse en su forma anterior: una secuencia
de PostgreSQL no es transaccional y el orden global es la unidad equivocada.

SD-018 lo sustituye con posición monotónica por usuario/stream, contador bloqueado
dentro de la misma transacción que inserta el evento, `unique(user_id,
stream_position)`, `event_id` como única clave de idempotencia, watermark por usuario y
proyección, `client_created_at` para la semántica temporal, y **ninguna inferencia de
ausencia definitiva por timeout**.

**Cumplido:** no se ha creado ninguna migración de eventos ni existe `learning_events`.
El cuerpo congelado v1.2 del `SPEC_DIFF_LOG` no se ha tocado; su hash sigue siendo
`4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3`.

---

## Documentos gobernantes · 8 de 8

Los tres que faltaban llegaron durante esta ronda y se verificaron por nombre, SHA-256
y naturaleza real del contenido. **AMB-01 queda resuelto.** Detalle en
`docs/GOVERNING_DOCUMENTS.md`.

| Documento | SHA-256 | Verificado |
| --- | --- | --- |
| Design System v1.0 | `62a85885…8c357aa4` | PDF 1.4 · 11 págs · texto · 0 imágenes |
| Functional Closure / MVP Scope v0.1 | `6645bc17…18c07f3f` | PDF 1.4 · 4 págs · texto · 0 imágenes |
| Onboarding & Edge States Visual Spec v1.0 | `e7bb2e91…59ca9078` | PDF 1.4 · 12 págs · texto · 0 imágenes |

`STUDY_OS_Founder_Portfolio_Master_Context_v0.1.md` permanece como **nivel 7 · material
exploratorio: no gobierna**, y sigue ausente de `authority-map.md` (SD-017).

---

## ROLLBACK

Nada se ha aplicado fuera del repositorio local: ninguna migración ejecutada, ningún
entorno creado, ningún servicio externo tocado, ningún secreto escrito.

```bash
git reset --hard 904cf87
```

Devuelve la rama al estado auditado. `main` conserva su commit raíz `6086537`. Cada
migración tiene su script en `supabase/migrations/down/`; el de `profiles` es
destructivo y exige aprobación humana.

---

## NEXT RECOMMENDED PHASE

**Ninguna.** Phase 0 no cierra y Phase 1 no debe arrancar.

Orden recomendado para desbloquear:

1. **MI-05a** · crear el repositorio remoto con `main` protegida, el proyecto Supabase
   y la cuenta Vercel. Configurar los secretos en cada panel, **nunca en la
   conversación**.
2. **Docker Desktop** en la máquina de desarrollo, o aceptar que los cuatro checks
   bloqueados solo se ejecuten en CI.
3. `npm run db:start && npm run db:reset && npm run verify`. Los nueve checks deben
   quedar en verde; con ello P0-G2 y P0-G4 pasan.
4. **Decidir SD-019.** Recomendación: opción A ahora —acotar el uso, que es lo ya
   implementado— y elegir entre B y C antes de Phase 5.
5. **Aprobar SD-018** antes de cualquier migración de eventos.
6. Cerrar **BD-02**, **BD-05**, **SD-006** y **SD-007**.
7. Aprobar la adenda del `SPEC_DIFF_LOG` (ERRATA, SD-016, SD-017, SD-018, SD-019) y
   decidir si `authority-map.md` se corrige en una v1.3.
8. Reemitir este checkpoint. Con 1–6 resueltos el estado esperado es **PASS WITH
   DEBT** (deuda: D-04, D-07) y solo entonces procede autorizar Phase 1.

Todos los ADR siguen en `PROPOSED`. Ninguno se ha marcado `ACCEPTED`.
