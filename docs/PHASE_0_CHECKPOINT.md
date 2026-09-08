# STUDY OS · Checkpoint de Phase 0 · décima reemisión

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 0 · Foundation
BRANCH: phase/0-foundation
COMMIT/TAG: ver «HEAD» en AUDIT_EVIDENCE.md (sin tag: se crea tras el merge aprobado)
STATUS: BLOCKED
```

**Décima reemisión.** La novena (`84d3b8b`) fue auditada como `PASS WITH DEBT` en
gobernanza, con Phase 0 `BLOCKED` por la evidencia de infraestructura que faltaba. Esta
ronda es la **ronda de infraestructura** autorizada por Ana Victoria el 2026-09-08: por
primera vez los cuatro checks que exigían base de datos y servidor de Auth se han
ejecutado de verdad —contra un proyecto Supabase dedicado y en CI remoto—, y el
repositorio, el pipeline y el proyecto de despliegue existen. Este informe sustituye a la
novena.

## Por qué sigue BLOCKED

Ya no por evidencia de checks: los nueve checks bloqueantes están en verde en CI remoto y
ocho de nueve en local. Sigue `BLOCKED` por un único resto de **MI-05a**:

| Motivo | Naturaleza |
| --- | --- |
| **Protección mecánica de `main`** · GitHub Free devuelve 403 a reglas de protección y rulesets en un repositorio **privado** | Externo · plan de la *forge* · decisión humana con coste |

`Execution Plan §3` output 1 exige «ramas protegidas». No se declara `PASS` mientras
falte, y no se sustituye por una convención documental.

**Lo que ya no bloquea.** Las cinco decisiones humanas quedaron cerradas el 2026-09-07
(ronda anterior) y ninguna se ha implementado en esta ronda:

| Decisión | Estado | Propietario normativo |
| --- | --- | --- |
| SD-007 | `ACCEPTED · NOT IMPLEMENTED` | ADR-006 |
| SD-006 | `ACCEPTED · NOT IMPLEMENTED` | ADR-007 |
| SD-018 · SD-015 superseded | `ACCEPTED · NOT IMPLEMENTED` | ADR-008 |
| BD-02 / SD-002 | `ACCEPTED · NOT IMPLEMENTED` | ADR-009 |
| BD-05 / SD-001 | `ACCEPTED · NOT IMPLEMENTED` | ADR-010 |

P0-G2 y P0-G4 tienen evidencia real. `REQ-A06` y `P0-S7` siguen satisfechos bajo SD-019
opción A.

---

## 0. La ronda de infraestructura de esta reemisión

### Preflight y contradicción resuelta

El primer preflight encontró que el proyecto Supabase preexistente llamado `STUDY_OS`
pertenecía a **otro producto** y contenía su esquema y usuarios reales; la ronda se detuvo
sin mutar nada. Ana resolvió con una organización Supabase dedicada `STUDY_OS`
(`vvtcqkszlhjvtbbxqstn`, plan Free) y dos proyectos nuevos. Los proyectos de ese otro
producto quedan **prohibidos** y no se han vuelto a tocar.

| Entorno | Proyecto | ref | Región | Papel en Phase 0 |
| --- | --- | --- | --- | --- |
| STAGING | `STUDY_OS_STAGING` | `xzcrqsolxarutlvvkzfp` | eu-west-1 | **Único entorno mutable**: migraciones, fixtures, cleanup |
| PRODUCTION | `STUDY_OS_PRODUCTION` | `nzcgufeycvehczroryoe` | eu-central-1 | Frontera real · **solo lectura** · 0 mutaciones en toda la ronda |

Ambos nacieron vacíos (0 tablas, 0 usuarios, 0 buckets, sin tabla de migraciones) y con
la exposición automática del Data API desactivada.

### Lo que la infraestructura real destapó, y cómo se corrigió

Cada defecto salió de una ejecución real, no de una revisión, y cada corrección tiene su
commit y su evidencia en CI:

| # | Hallazgo | Causa | Corrección |
| --- | --- | --- | --- |
| I1 | `test:unit` agotaba 30 s en CI en `operational-bypasses.spec` | `SUPABASE_DB_URL` a nivel de workflow llegaba al job estático y la guarda `schema-drift` entraba en su nivel B sin base ni Docker | `SUPABASE_DB_URL` solo en el job `database`; la prueba del lock vacía la URL a propósito (`694cd68`). Un primer diagnóstico erróneo (`126a7dc`, precalentar el CLI) se corrigió en el siguiente commit y consta en el historial |
| I2 | `test:integration` 4/10 en rojo con `42501 permission denied` | Con la exposición automática desactivada, los privilegios por defecto ya no conceden DML a `service_role`, y la migración 1 nunca se lo dio | **Migración 2** `00000000000002_profiles_service_role.sql`, autorizada por Ana: `grant select, insert, update, delete … to service_role`, con reversa y lock (`d942faa`) |
| I3 | `ReferenceError: serverVerified is not defined` al renderizar `/cuenta` tras un alta real | La marca de `VerifiedIdentity` era `declare const … unique symbol`: existía para el tipo y no para el runtime, y ninguna prueba construía la identidad | Símbolo real no exportado y dos pruebas que ejecutan el constructor (`de38df9`) |
| I4 | En CI, E2E de auth 8/8 en móvil y los dos tests de alta en rojo en escritorio | El ordinal del correo de fixture vivía en el worker de Playwright; el segundo proyecto repetía el correo del primero | El correo incluye proyecto e índice de worker (`5162c9e`) |
| I5 | Contra STAGING, el alta por formulario fallaba: `Email address … is invalid` y después `email rate limit exceeded` | El Auth alojado tenía la confirmación por correo activa; al enviar el correo rechaza el dominio reservado `example.test` y agota la cuota SMTP | `mailer_autoconfirm = true` **solo en STAGING**, por Management API, autorizado por Ana. Con ello `example.test` se acepta (sonda de un usuario por dominio, borrados al instante): **no hace falta cambiar el fixture** |
| I6 | `schema-drift` nivel B no puede ejecutarse en la máquina de desarrollo | `supabase db diff` construye una base sombra con Docker | Opción B autorizada: job `drift-staging` en CI contra el STAGING real, con secreto `STAGING_DB_URL` y guarda fail-closed que rechaza cualquier cadena que no contenga el ref de STAGING o contenga el de PRODUCTION (`253e9c1`) |

### Incidente de seguridad · D-15

Al cargar `.env.staging.local` por primera vez, un valor pegado con un espacio tras el
`=` hizo que bash intentara ejecutarlo y lo imprimiera en su mensaje de error. La
`service_role` legacy de STAGING quedó así en el contexto de la sesión. No entró en
ningún commit, evidencia, artefacto ni variable de Vercel. Se trató como comprometida y
se corrigió con la opción de menor impacto: Ana creó una clave `sb_secret` nueva
(`phase0_tests`) y **desactivó las claves legacy de STAGING**; la Management API confirma
`{"enabled": false}` para las legacy, la clave nueva se cargó en el fichero local sin
pasar por el chat, y los checks de integración, RLS y E2E se reejecutaron con ella.
PRODUCTION no se tocó. La credencial expuesta queda revocada de facto. El token de
acceso personal `STUDY_OS Phase 0` (30 días) es una credencial temporal a revocar al
terminar la ronda (D-14).

---

## SPEC REFERENCES

- `STUDY_OS_Builder_Handoff_Manifest_v1.0` §5, §6, §7, §8, §9, §10 (Phase 0), §14, §20
- `STUDY_OS_Engineering_Constitution_v1.0` EC-008 … EC-020
- `STUDY_OS_Technical_Architecture_v1.0` §1–§6, §5.2–§5.4
- `docs/PHASE_0_EXECUTION_PLAN.md` v1.2 · P0-S1 … P0-S10, §3, §4, §5, §6
- `spec/requirement-index.md` REQ-A01 … REQ-A09, REQ-C13
- `docs/SPEC_DIFF_LOG.md` · adenda: ERRATA P0-IN-1, SD-016, SD-017, SD-018, SD-019 y el
  registro de aceptación del 2026-09-07
- `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · SHA-256
  `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · no versionado
- `architecture/ADR-006` … `ADR-010` · `ACCEPTED · NOT IMPLEMENTED`

---

## DELIVERED

| Paso | Entregado | Estado |
| --- | --- | --- |
| **P0-S1** | Monorepo npm workspaces conforme a Manifest §8 | Completo |
| **P0-S2** | `@study-os/config`: tres entornos, políticas como dato compartido, allowlist pública, frontera `server-only`, guardas destructivas · **entornos reales**: STAGING y PRODUCTION separados en Supabase y en Vercel | Completo |
| **P0-S3** | Next.js 16.3.2 · TypeScript `strict` · PWA instalable · Node 24 | Completo |
| **P0-S4** | Migración 0 con rollback | **Aplicada en STAGING y en CI** |
| **P0-S5** | Migración 1 (`profiles` 1:1, trigger idempotente, RLS `enable`+`force`) y migración 2 (grants del rol de servicio) con rollback | **Aplicadas en STAGING y en CI** · alta y login reales verificados |
| **P0-S6** | CI en tres jobs, CLI fijado, E2E estáticos separados de los de auth, deriva contra STAGING real | **Ejecutado · en verde** (run `34234262313`) |
| **P0-S7** | Tokens del Design System y contraste verificado en el navegador | **Satisfecho bajo SD-019 opción A** |
| **P0-S8** | Cinco guardas por propagación de punto fijo y 169 pruebas que ejecutan las guardas reales | Completo |
| **P0-S9** | `/spec`, `/architecture`, `/docs` importados con SHA-256; ADR-006 … ADR-010 aceptados | Completo |
| **P0-S10** | Este informe | Completo |

---

## FILES CHANGED

Rondas anteriores: siete commits correctivos más `3872a84`; siete más `2c03ecb`; cinco
más `d848f1a`; tres más `6ec13e5`; dos más `85bdf99`; tres más `b606e0d`; dos más
`a33ad27`; dos más `8823c2b`; dos más `84d3b8b` (`7344f00` y `84d3b8b`; una reemisión
anterior citó por error `c660389`, corregido aquí como **D-GOV-01 cerrada**). Esta ronda:

| Commit | Alcance |
| --- | --- |
| `126a7dc` | CI: precalentar el CLI · diagnóstico incorrecto, conservado como historia |
| `694cd68` | CI: `SUPABASE_DB_URL` solo en el job de base de datos · la prueba del lock no hereda la URL |
| `d942faa` | Migración 2 · grants DML del rol de servicio sobre `profiles` · lock · test |
| `de38df9` | `VerifiedIdentity`: marca real en runtime · dos pruebas que la ejecutan |
| `5162c9e` | E2E de auth: correos únicos por proyecto y worker |
| `253e9c1` | CI: job `drift-staging` contra STAGING real con guarda fail-closed |
| (este) | `ARCHITECTURE_STATE` v10.0 · `CLAUDE.md` §9 · esta reemisión · tests documentales |

Ficheros nuevos: `supabase/migrations/00000000000002_profiles_service_role.sql` y su
reversa. Modificados: `.github/workflows/ci.yml`, `supabase/migrations/.lock.json`,
`packages/domain/src/identity.ts`, `tests/unit/operational-bypasses.spec.ts`,
`tests/unit/auth.serverVerifiedIdentity.spec.ts`, `tests/e2e/auth/*.e2e.ts`. Las
migraciones 0 y 1 **no se han modificado** (huellas intactas en el lock).

**Fuera del repositorio, y por diseño:** `.env.staging.local` y
`.env.supabase-admin.local` (ignorados por Git; nunca leídos ni impresos), el secreto
`STAGING_DB_URL` en GitHub Actions y las seis variables públicas de Vercel.

---

## TESTS

### Recuento verificable

`vitest run --project unit --reporter=json`: **643 casos en 30 ficheros** (641 de la
ronda anterior + 2 en `auth.serverVerifiedIdentity.spec`).

### Ejecutado contra STAGING · en verde

Con `.env.staging.local` cargado en el proceso (valores no impresos), autorización
explícita `staging:automated-tests`, ref `xzcrqsolxarutlvvkzfp`:

| Comando | Resultado |
| --- | --- |
| `npm run test:integration` | **PASS** · 10/10 · `profiles` 1:1, defaults, `updated_at`, CHECK de `locale`, sin reasignación |
| `npm run test:rls` | **PASS** · 11/11 · User A no lee ni muta a User B; `anon` sin acceso; el filtro no cambia lo que RLS permite |
| `npm run test:e2e` | **PASS** · 70/70 estáticos + **16/16 de auth**: alta y login reales por formulario, identidad verificada en servidor, cookie forjada e inventada rechazadas |
| Limpieza | 6 usuarios creados · 6 borrados · **0 restantes** · 0 perfiles residuales (verificado por SQL) |
| `npm run schema-drift` | **FAIL en local** · `Creating shadow database…` exige Docker (D-13) · **PASS en CI** contra STAGING real |
| `npm run verify` | **8 en verde · 1 en rojo · 0 bloqueados** · el rojo es `schema-drift` por Docker |

### Ejecutado en CI remoto · en verde

Run `34234262313` sobre `253e9c1`, tres jobs:

| Job | Resultado |
| --- | --- |
| Estático | typecheck · lint · format · guardas · secret-scan · 643 unit · 70 E2E estáticos |
| Base de datos | `db:reset` con las 3 migraciones · `schema-drift` sin deriva · integración 10/10 · RLS 11/11 · E2E de auth 16/16, 6 usuarios borrados, 0 restantes |
| Deriva · STAGING real | guarda fail-closed: la cadena contiene el ref de STAGING y no el de PRODUCTION · `schema-drift: sin deriva` |

**Los nueve checks bloqueantes en verde en CI.** Ningún check simulado. Runs anteriores
`34158674892`, `34159396745`, `34159878155`, `34229491576` y `34230693848` fallaron por
I1–I4 y quedan en la evidencia con sus causas.

---

## ACCEPTANCE GATES

| Gate | Condición | Resultado |
| --- | --- | --- |
| **P0-G1** · La app arranca | `app.boot` y `pwa.manifest` en verde | **PASS** · en CI y contra el build con variables de STAGING |
| **P0-G2** · Separación de entornos | Producción no accesible desde staging | **PASS** · evidencia real: refs, URLs, hosts, regiones y claves distintos; PRODUCTION vacío y sin mutar; Preview → STAGING y Production → PRODUCTION en Vercel; cuatro configuraciones cruzadas fallan cerradas antes de tocar la red |
| **P0-G3** · Sin secretos en cliente | Escaneo sin hallazgos | **PASS** · centinela de servidor; ningún secreto en Vercel ni en el bundle |
| **P0-G4** · Baseline lint/type/test | Los nueve checks en verde | **PASS** en CI remoto (run `34234262313`) · en local 8/9 sin Docker, documentado como D-13 |
| **P0-G5** · Guardas de invariante activas | Fallan ante una violación deliberada | **PASS** · 169 + 26 casos |

Los cinco gates de aceptación están en PASS. El `STATUS: BLOCKED` no procede de un gate:
procede de los outputs de Phase 0 que MI-05a todavía no cubre (rama protegida, Preview
desplegado) y del incidente D-15.

### P0-G2 · evidencia de separación real

| Dimensión | STAGING | PRODUCTION | Distintos |
| --- | --- | --- | --- |
| project_ref | `xzcrqsolxarutlvvkzfp` | `nzcgufeycvehczroryoe` | Sí |
| URL API | `https://xzcrqsolxarutlvvkzfp.supabase.co` | `https://nzcgufeycvehczroryoe.supabase.co` | Sí |
| DB host | `db.xzcrqsolxarutlvvkzfp.supabase.co` | `db.nzcgufeycvehczroryoe.supabase.co` | Sí |
| Región | eu-west-1 | eu-central-1 | Sí |
| Clave publishable (SHA-256, 16 hex) | distinta | distinta | Sí |
| Vercel | Preview | Production | Variables separadas; ningún secreto de servidor |
| Fixtures | creados y borrados | **0** · nunca escritos | PRODUCTION solo lectura |

Configuraciones cruzadas que fallan cerradas: `production` con URL de PRODUCTION
(`Los tests automatizados están prohibidos en "production"`), `local` con URL de STAGING
(`no es loopback`), `staging` sin `STUDY_OS_DESTRUCTIVE_AUTHORIZATION`, y `db:reset` en
`production`. Ninguna llegó a abrir una conexión.

---

## MIGRATIONS

| Migración | Propósito | ¿Reversible? | STAGING | CI | PRODUCTION |
| --- | --- | --- | --- | --- | --- |
| `00000000000000_init.sql` | `pgcrypto`; enum `provenance_class`; `set_updated_at` | Sí | `20260907202149` | cada run | **No** |
| `00000000000001_profiles.sql` | `profiles` 1:1; trigger idempotente; RLS `enable`+`force`; grants mínimos | Sí (destructiva) | `20260907202245` | cada run | **No** |
| `00000000000002_profiles_service_role.sql` | `select/insert/update/delete` a `service_role` | Sí | `20260908130034` | cada run | **No** |

Grants verificados en STAGING: `authenticated:SELECT` + `UPDATE(display_name, locale)`;
`service_role` DML completo; `anon` nada. **Verificado por test:** ninguna migración
menciona `learning_events`, `user_event_counters`, `projection_watermarks`,
`stream_position`, `question_attempts` ni `server_sequence` (diseño superseded); tampoco
`answer_key_versions`, `session_items`, `planner_items`, `answer_payload_hash`,
`concept_versions`, `concept_key`, `exam_sittings` ni `exam_occurrences`. Ninguna tabla
de dominio existe en ningún entorno.

Advisors de Supabase sobre STAGING tras las pruebas: **0 hallazgos** de seguridad, **0**
de rendimiento. Ningún `SECURITY DEFINER` nuevo; RLS sin debilitar.

---

## SECURITY

**RLS.** Verificada en ejecución, no solo escrita: 11/11 contra STAGING y en CI.

**Auth · identidad verificada en servidor.** El E2E real demuestra INV-116: alta por
formulario, `/cuenta` con `getClaims`/`getUser`, cookie alterada y cookie inventada
rechazadas. El defecto I3 se detectó precisamente porque la identidad se construyó de
verdad por primera vez.

**Secretos.** Ninguno en chat, commits, evidencia, bundle ni Vercel. Los ficheros locales
están ignorados por Git y se cargan solo en el proceso de cada comando; la evidencia se
filtra automáticamente contra los valores cargados. Excepción registrada: D-15.

**Privilegios.** El rol de servicio no llega al cliente. Solo se usa en tests
(preparación y limpieza) y su clave vive únicamente en el fichero local.

**Producción.** Ninguna operación mutante en toda la ronda; verificado por lectura al
final: 0 usuarios, 0 tablas, 0 buckets, configuración de Auth y claves sin cambios.

---

## INVARIANTS VERIFIED

| ID | Resultado |
| --- | --- |
| EC-008 · EC-009 · EC-010 · EC-011 · EC-012 · EC-015 · EC-017 · EC-018 · EC-019 · EC-020 | **PASS** · EC-009 y EC-011 ahora en ejecución, no solo estáticos |
| INV-104 · INV-105 · INV-107 | **PASS** |
| INV-113 · REQ-A08 | **PASS** |
| INV-116 · REQ-A07 | **PASS** · estático **y** E2E real (cookie forjada rechazada) |
| REQ-A06 | **PASS** bajo las restricciones de SD-019 opción A |
| REQ-C13 · EC-009 en ejecución | **PASS** · `test:rls` contra STAGING y en CI |
| INV-101 | Aprobado por Ana · ratificado por SD-007 / ADR-006 · N/A en Phase 0 |
| ADR Policy · «solo ACCEPTED autoriza» | **PASS** · migración 2 es de grants, no de dominio; ninguna tabla de dominio creada |

---

## KNOWN DEBT

| # | Deuda | Resolver en |
| --- | --- | --- |
| D-01 | `main` sin protección mecánica: GitHub Free, repositorio privado, 403 verificado | Plan de GitHub que lo admita, con autorización humana · **blocker de MI-05a** |
| D-02 · D-03 · D-08 | **Cerradas** el 2026-09-08: migraciones aplicadas, CI ejecutado, E2E de auth ejecutados | — |
| D-04 | La familia tipográfica es un default provisional | Al decidirla |
| D-05 | `next-env.d.ts` versionado y en `.prettierignore` | — |
| D-06 | Listas espejo entre TypeScript y las herramientas `.mjs` | Aceptable |
| D-07 | Restricciones de SD-019 opción A | Al elegir entre B y C · antes de Phase 5 |
| D-09 · D-10 · D-11 | Límites documentados de las guardas | Aceptables |
| D-12 | Prerrequisitos de ADR-007 y ADR-008 | Antes de las migraciones 7, 8 y 11 · fuera de Phase 0 |
| D-13 | `schema-drift` nivel B exige Docker en local; corre en CI contra el stack local y contra STAGING | Aceptable · la evidencia es la de CI |
| D-14 | Token de acceso personal `STUDY_OS Phase 0` (30 días), fichero local ignorado | **Revocar al cerrar la ronda** |
| D-15 | `service_role` legacy de STAGING expuesta en un error de shell | **Cerrada** el 2026-09-08: clave `sb_secret` nueva, legacy desactivadas, checks reejecutados |
| D-GOV-01 | La novena reemisión citaba `c660389` en lugar de `7344f00` | **Cerrada** en esta reemisión |

---

## BLOCKED DECISIONS

| ID | Impacto |
| --- | --- |
| **MI-05a · resto** · protección mecánica de `main` (GitHub Free, repositorio privado) | Impide declarar `PASS` |

Decisiones **diferidas**, que no bloquean Phase 0: **SD-019** (B o C, antes de Phase 5).
`MI-05b` (proveedor de IA) no se ha solicitado: es entrada de Phase 8.

---

## ROLLBACK

Repositorio: `git reset --hard 84d3b8b` devuelve la rama al estado de la novena reemisión;
`main` conserva `6086537`. Remoto: las ramas se publicaron sin reescritura; nada que
deshacer con `--force`.

STAGING: `supabase/migrations/down/*.down.sql` en orden inverso (la de `profiles` es
destructiva y está autorizada solo en STAGING); `mailer_autoconfirm` vuelve a `false` con
un `PATCH` de la Management API. PRODUCTION: nada que revertir.

Vercel: el proyecto puede eliminarse desde el panel; no hay dominios ni despliegues
listos.

---

## NEXT RECOMMENDED PHASE

**Ninguna.** Phase 0 no cierra y Phase 1 no debe arrancar.

1. Decidir la protección mecánica de `main` (D-01): plan de GitHub o alternativa gobernada.
2. Revocar el token temporal `STUDY_OS Phase 0` (D-14) al cerrar la ronda.
3. Reemitir el checkpoint. Con 1 resuelto el estado esperado es **PASS WITH DEBT**, y
   solo entonces procede autorizar Phase 1.

ADR-001 … ADR-005 siguen en `PROPOSED`. ADR-006 … ADR-010 están `ACCEPTED` y sin
implementar. **Phase 0 sigue BLOCKED; Phase 1 no está autorizada.**
