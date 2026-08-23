# STUDY OS · Checkpoint de Phase 0

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 0 · Foundation
BRANCH: phase/0-foundation
COMMIT/TAG: f84b0f4 (sin tag: el tag se crea tras el merge a main aprobado)
STATUS: BLOCKED
```

**Por qué BLOCKED y no PASS WITH DEBT.** Todo el trabajo local autorizado está hecho
y verificado, pero **cuatro de los nueve checks bloqueantes no pueden ejecutarse en
esta máquina** y el gate P0-G4 exige los nueve en verde. `Execution Plan §6` stop
condition 1 es literal: «Phase 0 se detiene y se reporta BLOCKED si no se dispone de
credenciales o entornos (MI-05)». Declarar PASS WITH DEBT con `test:rls` sin ejecutar
convertiría un fallo duro del Checkpoint Contract —«failing RLS isolation test»— en
deuda administrativa, que es exactamente la erosión que EC-019 prohíbe.

El bloqueo es de **entorno**, no de trabajo pendiente: los tests están escritos y son
ejecutables en cuanto haya una instancia de Supabase alcanzable. En CI (GitHub
Actions, con Docker disponible) el pipeline los ejecuta sin cambios.

---

## SPEC REFERENCES

- `STUDY_OS_Builder_Handoff_Manifest_v1.0` §5, §7, §8, §9, §10 (Phase 0), §14, §20
- `STUDY_OS_Engineering_Constitution_v1.0` EC-008 … EC-020
- `STUDY_OS_Technical_Architecture_v1.0` §1–§6, §5.2–§5.4
- `docs/PHASE_0_EXECUTION_PLAN.md` v1.2 · P0-S1 … P0-S10, §4, §5, §6
- `spec/requirement-index.md` REQ-A01 … REQ-A09, REQ-C13
- `spec/invariant-register.md` EC-009, EC-010, EC-011, EC-015, EC-017, EC-018, INV-104, INV-105, INV-107, INV-113
- `architecture/ADR-001-stack-and-boundaries.md` (PROPOSED v1.1)
- `docs/SPEC_DIFF_LOG.md` · adenda: SD-016, SD-017, ERRATA P0-IN-1

---

## DELIVERED

| Paso | Entregado | Estado |
| --- | --- | --- |
| **P0-S1** | Monorepo con npm workspaces: `/apps/web`, `/packages/{design-system,config,domain}`, `/supabase/{migrations,functions,seed}`, `/tests/{unit,integration,rls,e2e}`, `/tools/guards`, `/spec`, `/architecture`, `/docs`, `CLAUDE.md` | Completo |
| **P0-S2** | `@study-os/config` con tres entornos, política por entorno, allowlist pública y frontera `server-only` | Completo |
| **P0-S3** | Next.js 16.3.2 + TypeScript `strict` (con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`) + PWA instalable: manifest, service worker acotado, iconos 192/512/maskable | Completo |
| **P0-S4** | Framework de migraciones + migración 0 (extensiones, enum `provenance_class`, utilidad `set_updated_at`) con script de rollback | Escrito · **sin aplicar** |
| **P0-S5** | Migración 1: `profiles` 1:1 con `auth.users`, trigger de alta idempotente, RLS `enable` + `force`, políticas de solo-propio, grants mínimos | Escrito · **sin aplicar** |
| **P0-S6** | CI en `.github/workflows/ci.yml` con los nueve checks, en dos jobs (estático y base de datos) | Completo · sin ejecutar (no hay remoto) |
| **P0-S7** | `@study-os/design-system` con los valores literales de `STUDY_OS_Design_System_v1.0` §2, §3 y §13 | **BLOQUEADO** · ver SD-019 |
| **P0-S8** | Cinco guardas ejecutables, todas con prueba negativa: `import-guard`, `tai-literal`, `secret-scan`, `client-authority-guard`, `auth-authority-guard` | Completo |
| **P0-S9** | `/spec`, `/architecture`, `/docs` importados **byte a byte** con SHA-256 registrados; `CLAUDE.md` con el orden de autoridad enmendado por SD-009 | Completo |
| **P0-S10** | Este informe | Completo |

**Añadido sobre el plan, por decisión humana de arranque:** enforcement de
**INV-116** (SD-016) — tipo `VerifiedIdentity` con marca de origen único, verificador
de servidor, regla de ESLint, guarda de repositorio y tests.

---

## FILES CHANGED

108 ficheros · 12 317 inserciones.

| Área | Propósito |
| --- | --- |
| `apps/web/src/app/**` | Superficie mínima: raíz, `/entrar`, `/registro`, `/cuenta` (protegida), `/offline`, manifest PWA. **Ninguna pantalla de producto** |
| `apps/web/src/proxy.ts` | Refresco de sesión y protección de rutas sobre identidad verificada (convención `proxy` de Next 16) |
| `apps/web/src/server/auth/identity.ts` | **Único** constructor de identidad verificada. `getClaims()` con reserva en `getUser()` |
| `apps/web/src/server/supabase/server-client.ts` | Cliente de servidor, solo clave anónima |
| `apps/web/src/lib/supabase/browser-client.ts` | Cliente de navegador, solo clave anónima |
| `apps/web/public/sw.js` | Service worker de alcance mínimo: no cachea HTML autenticado, `/auth` ni `/api` |
| `packages/config/**` | Entornos, políticas, allowlist pública, guarda de operación destructiva |
| `packages/design-system/**` | Tokens, contraste WCAG, `PRIMARY_SPACES` |
| `packages/domain/**` | `Projection<T>` (INV-113) y `VerifiedIdentity` (INV-116) |
| `supabase/migrations/**` | Migraciones 0 y 1 + rollbacks + registro de huellas |
| `tools/guards/**` | Cinco guardas + `schema-drift` + biblioteca de recorrido |
| `tools/verify.mjs` | Ejecuta los nueve checks y reporta PASS / FAIL / **BLOQUEADO** |
| `tests/**` | 110 unitarios, 10 de integración, 12 de RLS, 26 E2E |
| `docs/PROVENANCE.md` | Origen y hash de cada artefacto |
| `docs/DEPENDENCY_PROPOSAL.md` | Manifest §7 para cada dependencia, y las descartadas |
| `.github/**` | CI y plantilla de PR |

---

## TESTS

### Ejecutados

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** · 0 errores |
| `npm run lint` (`eslint .`) | **PASS** · 0 errores |
| `npm run format` (`prettier --check .`) | **PASS** |
| `npm run build` (`next build`) | **PASS** · 8 rutas, 0 avisos |
| `npm run test:unit` | **PASS** · 110/110 en 10 ficheros |
| `npm run secret-scan` | **PASS** · 14 ficheros estáticos analizados, 0 hallazgos |
| `npm run guard:import` | **PASS** |
| `npm run guard:tai-literal` | **PASS** |
| `npm run guard:auth-authority` | **PASS** |
| `npm run client-authority-guard` | **PASS** |
| `npx playwright test app.boot.e2e pwa.manifest.spec` | **PASS** · 13/13 en `desktop-chromium` y 13/13 en `mobile-chromium` |

Desglose de los unitarios por fichero:

| Fichero | Qué prueba |
| --- | --- |
| `primarySpaces.frozen.spec` | EC-015 · lista congelada comparada contra copia literal, no contra sí misma |
| `tokens.contract.spec` | REQ-A06 · valores del documento, 44px, anti-patrones §15, espejo CSS |
| `tokens.contrast.spec` | REQ-A06 · 16 pares declarados, más las tres combinaciones de SD-019 que no alcanzan AA |
| `env.separation.spec` | REQ-A03 · gate P0-G2 a nivel de código |
| `auth.serverVerifiedIdentity.spec` | **INV-116** · métodos aceptados, verificador, superficies protegidas, 3 pruebas negativas |
| `client.no-authoritative-write.spec` | INV-113 · REQ-A08 · 2 pruebas negativas |
| `importGuard.spec` | ADR-001 · 2 pruebas negativas + 1 caso legítimo que **no** debe saltar |
| `taiLiteral.guard.spec` | EC-018 · prueba negativa + falsos positivos (`retain`, `TAIL`, `MOUNTAIN`) |
| `schema.drift.spec` | REQ-A04 · EC-011 · forma de las migraciones, RLS en la misma migración, ausencia de tablas de dominio |
| `bundle.secret-scan.spec` | EC-010 · 3 pruebas negativas + el bundle real |

### No ejecutados · **BLOQUEADOS**

| Comando | Motivo |
| --- | --- |
| `npm run test:integration` (`profile.oneToOne.spec`) | Requiere instancia de Supabase |
| `npm run test:rls` (`rls.userIsolation.profiles.spec`) | Requiere instancia de Supabase |
| `npm run schema-drift` (nivel B, `supabase db diff`) | Requiere `SUPABASE_DB_URL`. El **nivel A** sí pasa |
| `npx playwright test auth.signup-login.e2e auth.forgedCookieRejected.e2e` | Requieren servidor de Auth real |

Ninguno se ha desactivado ni marcado como omitido: fallan con un mensaje que dice
qué falta. Un test que se auto-exime produce un verde que no demuestra nada.

---

## ACCEPTANCE GATES

| Gate | Condición | Resultado |
| --- | --- | --- |
| **P0-G1** · La app arranca | `app.boot.e2e` y `pwa.manifest.spec` en verde | **PASS** · 26/26 en móvil y escritorio |
| **P0-G2** · Separación de entornos | `env.separation.spec` en verde; producción no accesible desde staging | **PARCIAL** · la parte de código pasa; la comprobación entre entornos reales exige MI-05a |
| **P0-G3** · Sin secretos en cliente | `bundle.secret-scan.spec` sin hallazgos; `client.no-authoritative-write.spec` en verde | **PASS** |
| **P0-G4** · Baseline lint/type/test | Los nueve checks en verde | **FAIL** · 5 verdes, 4 bloqueados |
| **P0-G5** · Guardas de invariante activas | Las guardas fallan ante una violación deliberada | **PASS** · 8 pruebas negativas, todas rojas cuando deben serlo |

---

## MIGRATIONS

| Migración | Propósito | ¿Reversible? | ¿Aplicada? |
| --- | --- | --- | --- |
| `00000000000000_init.sql` | Extensión `pgcrypto`; enum `provenance_class` (EC-008); función `set_updated_at` | **Sí** · `down/00000000000000_init.down.sql` | **No** |
| `00000000000001_profiles.sql` | `profiles` 1:1 con `auth.users`; trigger de alta idempotente; RLS `enable` + `force`; políticas de solo-propio; grants mínimos | **Sí** · `down/00000000000001_profiles.down.sql` (destructiva: exige aprobación humana) | **No** |

**Lo que estas migraciones deliberadamente NO hacen**, y por qué:

- **no crean los esquemas `content` / `engine` / `audit`** que propone `ADR-001` ·
  ese ADR está en `PROPOSED`, y la ADR Policy es literal: «Only ACCEPTED ADRs may
  authorize architectural change»;
- **no habilitan `pgvector`** · `ADR-001` punto 4 lo difiere a Phase 8;
- **no declaran enums de dominio** salvo `provenance_class`, que está congelado por
  EC-008 · el resto depende de BD-02, BD-03, BD-05, SD-006 y SD-015;
- **no crean ninguna tabla de dominio ni de eventos** · verificado por test.

---

## SECURITY

**Cambios de RLS.** `public.profiles` nace con `enable row level security` **y**
`force row level security` en la misma migración que la crea (EC-009). `force` no es
un detalle: sin él, una conexión con privilegios de propietario atraviesa las
políticas sin avisar. Políticas: `select` y `update` restringidos a
`(select auth.uid()) = id`, con `with check` en el `update` para que nadie pueda
reasignar su perfil. **No hay política de `insert` ni de `delete`** para
`authenticated`: el alta la hace el trigger y el borrado cascada desde `auth.users`.
La política de borrado de cuenta es **OBS-03** y se decide antes de producción.

**Cambios de auth.** Esqueleto completo con `@supabase/ssr`. La identidad de toda
superficie protegida se obtiene **solo** en
`apps/web/src/server/auth/identity.ts`, mediante `auth.getClaims()` —con reserva en
`auth.getUser()`— conforme a **INV-116**. `getSession()` no aparece en ninguna ruta
de decisión y está prohibido por dos mecanismos independientes: regla de ESLint
(`no-restricted-syntax`) y `tools/guards/auth-authority-guard.mjs`.

**Comprobación de exposición de secretos.** `secret-scan` recorre la fuente
(claves PEM, JWT de rol de servicio, tokens de proveedor, claves de AWS, asignaciones
literales) y `apps/web/.next/static` (valores de variables de servidor, menciones de
claves de servidor, variables `NEXT_PUBLIC_*` fuera de la allowlist). **0 hallazgos.**
Si no existe build, el check **falla**; no se omite. `.gitignore` excluye `.env*`
salvo el ejemplo, y `.env.example` no contiene ningún valor: hay un test que lo
comprueba línea a línea.

**Rutas privilegiadas.** Ninguna en Phase 0. `SUPABASE_SERVICE_ROLE_KEY` solo se lee
desde `@study-os/config/server`, marcado `import 'server-only'`, que hace **fallar el
build** si entra en un Client Component. Ninguna consulta filtra por un `user_id`
recibido de la petición; hay una guarda que lo comprueba.

**Cabeceras.** `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy` sin cámara, micrófono ni geolocalización.

**Observación favorable.** Con Supabase inalcanzable, `/cuenta` **redirige a
`/entrar`** en lugar de abrirse o de romper: el diseño falla cerrado. Verificado en
los E2E ejecutados.

---

## INVARIANTS VERIFIED

| ID | Verificación | Resultado |
| --- | --- | --- |
| EC-008 | Enum `provenance_class` con lista cerrada | **PASS** |
| EC-009 | RLS `enable` + `force` en la misma migración · `schema.drift.spec` | **PASS** (estático) · test de aislamiento **BLOQUEADO** |
| EC-010 | `secret-scan` sobre fuente y bundle · `server-only` · allowlist | **PASS** |
| EC-011 | `schema-drift` nivel A: nombres, rollback obligatorio, huellas | **PASS** · nivel B **BLOQUEADO** |
| EC-012 | Service worker acotado; `/offline` no promete sincronización | **PASS** |
| EC-015 | `primarySpaces.frozen.spec` contra copia literal | **PASS** |
| EC-017 | Tokens de gamificación prohibidos en TS y en CSS | **PASS** |
| EC-018 | `tai-literal` sobre `apps`, `packages`, `tools`, `tests`, `supabase` | **PASS** |
| EC-019 | Ningún artefacto congelado modificado; adenda por adición | **PASS** |
| EC-020 | Este informe no declara PASS con checks sin ejecutar | **PASS** |
| INV-104 | Una sola acción primaria por vista (E2E) | **PASS** |
| INV-105 | El error se comunica con texto y `role="alert"`, no solo con color | **PASS** |
| INV-107 | Copy de `/offline` sin atribución de fracaso | **PASS** |
| INV-113 | `client-authority-guard` + tipo `Projection<T>` | **PASS** |
| **INV-116** | Verificador único, ESLint, guarda, 3 pruebas negativas | **PASS** (estático) · rechazo de cookie forjada **BLOQUEADO** |
| INV-101 | Aprobado por Ana. Sin superficie que lo pueda violar todavía | **N/A en Phase 0** |

---

## KNOWN DEBT

| # | Deuda | Motivo | Resolver en |
| --- | --- | --- | --- |
| D-01 | `main` no está protegida mecánicamente | La protección de rama es una función de la *forge*. No hay remoto (MI-05a). Hoy es una política escrita en `README.md` y `CLAUDE.md` | Al crear el repositorio remoto |
| D-02 | Las migraciones nunca se han aplicado | Sin Docker no hay Supabase local | Al disponer de instancia |
| D-03 | CI nunca se ha ejecutado | No hay remoto | Al primer *push* |
| D-04 | Los valores cromáticos del Design System son provisionales | `STUDY_OS_Design_System_v1.0` no está en el material de origen. La **estructura** de tokens sí es contractual y está verificada | Al recibir el Design System |
| D-05 | `next-env.d.ts` versionado | Es generado, pero Next lo requiere para el typecheck y su convención es versionarlo | — |
| D-06 | La allowlist pública está duplicada en `packages/config` y en `secret-scan.mjs` | La guarda es un script de Node sin resolutor de TypeScript. Hay un test que comprueba que ambas coinciden | Aceptable |

---

## DEFERRED REQUIREMENTS

Ninguno de Phase 0. Los nueve requisitos `REQ-A01 … REQ-A09` están implementados;
lo que falta es **ejecutar** la verificación de los que tocan base de datos.

| Requisito | Estado |
| --- | --- |
| REQ-A01 … REQ-A05, REQ-A08, REQ-A09 | Implementados y verificados |
| REQ-A06 | **BLOQUEADO** · los valores proceden del documento, pero tres pares de la paleta congelada no alcanzan el AA que exige su criterio de aceptación (SD-019) |
| REQ-A07 | Implementado · verificación E2E e integración **bloqueada** |
| REQ-C13 (parcial, sobre `profiles`) | Implementado · `test:rls` **bloqueado** |

---

## BLOCKED DECISIONS

### Bloqueos de entrada

| ID | Impacto | Recomendación |
| --- | --- | --- |
| **MI-05a** · repositorio Git remoto, organización/proyecto Supabase, cuenta Vercel | Impide P0-S2 completo, P0-S6, la protección de `main` y los cuatro checks bloqueados | Crear los tres. Ninguna credencial debe pasar por esta conversación: se configuran directamente en cada panel y en el gestor de secretos local |
| **Docker (o WSL2) en la máquina de desarrollo** | `supabase start` no puede ejecutarse: verificado que no hay Docker, ni Podman, ni WSL | Instalar Docker Desktop. Es la única vía para ejecutar `test:integration`, `test:rls` y los E2E de auth en local. En CI no hace falta: el runner ya tiene Docker |

`MI-05b` (proveedor de IA) **no se ha solicitado ni configurado**: es entrada de
Phase 8, no de Phase 0.

### Decisiones que impiden cerrar Phase 0 con PASS

`Execution Plan §7`. Ninguna impide el andamiaje ya hecho; todas determinan la
primera migración de dominio de Phase 1.

| Decisión | Estado | Por qué antes del cierre |
| --- | --- | --- |
| **BD-02** · identidad estable de concepto | Abierta | Migración 3. Después implicaría migrar contenido publicado |
| **BD-05** · convocatoria / modelo / ocurrencia | Abierta | Migración 5 |
| **SD-006** · integridad de referencias polimórficas | PROPOSED | Forma de `session_items` y `planner_items` |
| **SD-007** · claves de respuesta fuera del Data API | PROPOSED | Separación de esquemas desde la primera migración |
| **SD-015** · orden total de eventos y watermark | **PROPOSED · debe revisarse** | Migración 8. Ver abajo |
| **INV-101** | **APROBADO** por Ana en la autorización de arranque | Ya no bloquea |

### SD-015 · estado explícito

SD-015 **continúa PROPOSED y no puede implementarse en su forma anterior**. Debe
revisarse incorporando: posición monotónica transaccional por usuario/stream;
`unique(user_id, stream_position)`; asignación bajo bloqueo transaccional; watermark
por usuario y proyección; `event_id` como clave de idempotencia; `client_created_at`
para la semántica temporal; y ninguna inferencia de ausencia definitiva mediante
*timeout*.

**Cumplido en Phase 0:** no se ha creado ninguna migración de eventos y no existe
`learning_events`. El único andamiaje relacionado es el campo `watermark` del tipo
`Projection<T>` en `packages/domain/src/authority.ts`, que no se usa en ninguna ruta
y lleva la nota de que SD-015 sigue sin resolver.

---

## Registros nuevos en SPEC_DIFF_LOG

Añadidos **por adición**, en una adenda posterior al cuerpo v1.2. Las 174 primeras
líneas del fichero conservan su hash original
(`4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3`): el paquete
congelado no se ha reescrito.

| Entrada | Contenido | Estado |
| --- | --- | --- |
| **ERRATA** | `P0-IN-1` cita los outputs de Phase −1 **v1.1**; la versión aprobada y de entrada es **v1.2**. Mantener la referencia apuntaría al paquete que eliminó en silencio `REQ-C15` | PROPOSED · el fichero congelado **no** se ha editado |
| **SD-016** | Alta de **INV-116** con su enforcement mínimo, vinculado a `REQ-A07`, **sin renumerar ni desplazar requisitos** | Contenido aprobado por Ana · implementado en Phase 0 |
| **SD-017** | Corrección de la naturaleza real de los documentos gobernantes; **AMB-01** pasa de 8 documentos sin verificar a 3 | PROPOSED · `spec/authority-map.md` **no** se ha editado |

### AMB-01 · resolución parcial

Contrastado contra `_handoff/originals/`, la afirmación de `authority-map.md` §0a de
que los documentos gobernantes son «un archivo ZIP de imágenes de página» **no se
sostiene** para los cinco presentes: los tres `.pdf` son PDF 1.4 auténticos con texto
y fuentes incrustadas (cero objetos de imagen), y los dos `.docx` son OOXML auténticos.

| Documento | Extensión de origen | AMB-01 |
| --- | --- | --- |
| Master Product Specification v1.0 | `.pdf` · 31 págs · texto | **RESUELTO** |
| Canonical Data & Event Model v1.0 | `.pdf` · 25 págs · texto | **RESUELTO** |
| Builder Handoff Manifest v1.0 | `.pdf` · 19 págs · texto | **RESUELTO** |
| Technical Architecture v1.0 | `.docx` · OOXML | **RESUELTO** |
| Source of Truth Index v1.0 | `.docx` · OOXML | **RESUELTO** |
| Functional Closure / MVP Scope v0.1 | — | **ABIERTO** · ausente |
| Design System v1.0 | — | **ABIERTO** · ausente |
| Onboarding & Edge States Visual Spec v1.0 | — | **ABIERTO** · ausente |

Hallazgo adicional: `STUDY_OS_Founder_Portfolio_Master_Context_v0.1.md` está en los
originales y **no figura en `authority-map.md`**. Propuesta en SD-017: nivel 7,
material exploratorio, salvo criterio contrario de Ana.

---

## ROLLBACK

Trivial. Nada se ha aplicado fuera del repositorio local: ninguna migración
ejecutada, ningún entorno creado, ningún servicio externo tocado, ningún secreto
escrito.

```bash
git checkout main
git branch -D phase/0-foundation
```

`main` conserva su commit raíz (`6086537`), que contiene únicamente `.gitignore` y
`README.md`. Si más adelante hubiera que revertir tras el merge, cada migración tiene
su script en `supabase/migrations/down/`; el de `profiles` es **destructivo** y exige
aprobación humana explícita.

---

## NEXT RECOMMENDED PHASE

**Ninguna.** Phase 0 no cierra y Phase 1 no debe arrancar.

Orden recomendado para desbloquear:

1. **MI-05a** · crear el repositorio remoto (con `main` protegida: PR obligatorio,
   CI en verde, revisión humana), el proyecto Supabase y la cuenta Vercel.
   Configurar los secretos en cada panel, **nunca en la conversación**.
2. **Docker Desktop** en la máquina de desarrollo, o aceptar que los cuatro checks
   bloqueados solo se ejecuten en CI.
3. Ejecutar `supabase db reset` y después `npm run verify`. Los nueve checks deben
   quedar en verde; con ello P0-G2 y P0-G4 pasan y el checkpoint puede reevaluarse.
4. **Resolver SD-015** en su forma revisada. Es condición previa a cualquier
   migración de eventos.
5. Cerrar **BD-02**, **BD-05**, **SD-006** y **SD-007**.
6. Aprobar formalmente la adenda del SPEC_DIFF_LOG (SD-016, SD-017, ERRATA) y
   decidir si `authority-map.md` se corrige en una v1.3.
7. Reemitir este checkpoint. Con 1–5 resueltos el estado esperado es
   **PASS WITH DEBT** (deuda: D-04, valores cromáticos provisionales) y solo entonces
   procede autorizar Phase 1.

Los ADR siguen todos en `PROPOSED`. Ninguno se ha marcado `ACCEPTED`, conforme a
`Execution Plan §9`.
