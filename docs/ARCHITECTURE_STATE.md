# STUDY OS · ARCHITECTURE_STATE.md

**Propósito:** describir la **realidad** del repositorio, no la intención. Si este
documento describe algo que no existe en el código, el documento está mal.

**Versión:** 2.0 · copia viva
**Última actualización:** 2026-08-23 · ronda correctiva de Phase 0
**Fase actual:** 0 · Foundation
**Estado global:** **BLOCKED** · ver `docs/PHASE_0_CHECKPOINT.md`

---

## 0. Divergencia respecto al artefacto congelado

Este fichero es la **copia viva**. Su versión congelada, importada del paquete de
Phase −1, era:

| Campo | Valor |
| --- | --- |
| Versión base | 1.2 · patch correctivo · 2026-08-22 |
| SHA-256 base | `595437cca7ed13d09f78a0544fa26a8ad034d28b0cb8ecd97a71e08aff6b7fa1` |
| Paquete de origen | `STUDY_OS_Phase_Minus_1_v1_2.zip` · `8193934333099c0af331acbb12f590af8dc9b6d9026436f585265a87f763814a` |

El **ZIP congelado no se ha tocado** y sigue fuera del control de versiones en
`_handoff/`. Los otros 17 artefactos importados conservan su hash original; la lista
completa está en `docs/PROVENANCE.md` §2.

Este documento diverge de su versión base **a propósito y por su propia regla de
mantenimiento**: «este documento se actualiza en cada checkpoint; si describe estado
futuro o intenciones, se está usando mal». La versión 1.2 describía un repositorio
que no existía —«Repositorio de aplicación: **NO EXISTE**»— y mantenerla intacta la
habría convertido en lo contrario de lo que dice ser.

`docs/SPEC_DIFF_LOG.md` conserva su cuerpo congelado v1.2 intacto y solo crece por
adenda; ahí la regla es la opuesta, y por eso se trata distinto.

---

## 1. Qué existe hoy

| Elemento | Estado | Nota |
| --- | --- | --- |
| Repositorio de aplicación | **EXISTE · local** | `main` + `phase/0-foundation`. Sin remoto: MI-05a sigue abierto |
| Aplicación Next.js | **EXISTE** | Next 16.3.2 · App Router · TypeScript `strict` · PWA instalable · 8 rutas |
| Proyecto Supabase | **NO EXISTE** | Ninguno de los tres entornos creado. MI-05a |
| Migraciones | **2 escritas, 0 aplicadas** | `0000_init` (extensiones + enum `provenance_class`) y `0001_profiles`. Con rollback. Nunca ejecutadas: no hay base de datos |
| Políticas RLS | **Escritas, sin verificar en ejecución** | `profiles` con `enable` + `force` y políticas de solo-propio. `test:rls` no se ha podido ejecutar |
| `packages/design-system` | **EXISTE · BLOQUEADO** | Tokens con los valores literales de `STUDY_OS_Design_System_v1.0`. REQ-A06 no cierra por SD-019 |
| `packages/config` | **EXISTE** | Tres entornos, políticas, allowlist pública, frontera `server-only`, guardas destructivas |
| `packages/domain` | **EXISTE** | `Projection<T>` (INV-113), `VerifiedIdentity` (INV-116), registro de autoridad |
| `packages/learning-engine` | NO EXISTE | Phase 3 |
| `packages/planner-engine` | NO EXISTE | Phase 4 |
| Capa de IA | NO EXISTE | Phase 8. MI-05b no se ha solicitado |
| Tests | **281 escritos · 256 ejecutables aquí** | 256 unitarios en verde; 10 de integración, 12 de RLS y 3 E2E de auth bloqueados por falta de Supabase |
| CI | **EXISTE · nunca ejecutado** | `.github/workflows/ci.yml`, dos jobs, nueve checks. Sin remoto no ha corrido |
| Guardas de invariante | **5 activas, con prueba negativa** | import · tai-literal · secret-scan · client-authority · auth-authority |
| Contenido ingerido | NINGUNO | Ni siquiera de prueba. Execution Plan §9 |
| Tablas de dominio | **NINGUNA** | Verificado por test: ninguna migración crea `learning_events`, `question_attempts`, `concept_mastery`, `exam_readiness`, `planner_*`, `canonical_questions`, `answer_key_versions`, `learning_units`, `sessions` ni `session_items` |
| Artefactos de Phase −1 | **IMPORTADOS** | 19 ficheros, byte a byte, con SHA-256 en `docs/PROVENANCE.md` |
| Documentos gobernantes | **8 de 8 disponibles y verificados** | Ver `docs/GOVERNING_DOCUMENTS.md`. AMB-01 resuelto |

## 2. Decisiones arquitectónicas vigentes

| ADR | Título | Estado |
| --- | --- | --- |
| ADR-001 | Stack y fronteras de autoridad | PROPOSED · v1.1 |
| ADR-002 | Eventos de evidencia canónica | PROPOSED · v1.2 · **su punto 10 queda superseded por SD-018** |
| ADR-003 | Mastery, Readiness y configuración de motor | PROPOSED · v1.1 |
| ADR-004 | Reconciliación offline y continuidad | PROPOSED · v1.1 |
| ADR-005 | Procedencia y versionado oficial | PROPOSED |

**Ninguna decisión está ACCEPTED.** Según la ADR Policy, ninguna autoriza todavía
cambio arquitectónico alguno. Por eso las migraciones **no** crean los esquemas
`content` / `engine` / `audit` que propone ADR-001 ni habilitan `pgvector`.

## 3. Invariantes con enforcement activo

Ya no es «ninguno». Lo que sigue está **ejecutándose**, no solo escrito:

| Invariante | Mecanismo | Estado |
| --- | --- | --- |
| EC-008 | Enum `provenance_class` con lista cerrada | Escrito · sin aplicar |
| EC-009 · REQ-C13 | RLS `enable` + `force` en la misma migración; `schema.drift.spec` lo verifica estáticamente | Estático **activo** · aislamiento en ejecución **bloqueado** |
| EC-010 · REQ-A05 | `secret-scan` con centinela de servidor: construye, inyecta el valor y comprueba que no aparece ni en `.next/static` ni en la salida renderizada | **Activo** |
| EC-011 · REQ-A04 | `schema-drift`: nombres, rollback obligatorio, huellas de migración, CLI de versión fijada | Estático **activo** · diff contra base **bloqueado** |
| EC-012 | Service worker acotado + `offline.copy.spec` prohíbe afirmar persistencia o sincronización | **Activo** |
| EC-015 · REQ-A09 | `PRIMARY_SPACES` comparado contra copia literal congelada | **Activo** |
| EC-017 | Tokens de gamificación y anti-patrones de §15 prohibidos por test | **Activo** |
| EC-018 | `tai-literal` insensible a mayúsculas sobre `apps`, `packages`, `tools`, `tests`, `supabase` | **Activo** |
| EC-019 | Artefactos congelados sin modificar; adenda por adición; hashes verificados en test | **Activo** |
| EC-020 | `verify` cuenta un check bloqueado como fallo, nunca como omisión | **Activo** |
| INV-104 · INV-105 · INV-107 | Una acción primaria por vista; error con texto y `role="alert"`; copy sin atribución de fracaso | **Activo** |
| INV-113 · REQ-A08 | `client-authority-guard` sobre AST, superficie de cliente transitiva en `apps/**` y `packages/**`, registro explícito de proyecciones y RPC | **Activo** |
| INV-116 · REQ-A07 | Verificador único de identidad, ESLint, guarda con propagación de contaminación para `user_id` | **Activo** (estático) · rechazo de cookie forjada **bloqueado** |
| INV-101 | **Aprobado por Ana.** Sin superficie que pueda violarlo todavía | N/A en Phase 0 |

Lo que la Engineering Constitution advertía —«los documentos por sí solos no son
control suficiente»— deja de aplicarse a estos catorce. Sigue aplicándose al resto.

## 4. Decisiones pendientes que bloquean estructura

| ID | Tipo | Asunto | Bloquea |
| --- | --- | --- | --- |
| MI-05a | MISSING_INPUT | Repositorio remoto · proyecto Supabase · Vercel | **4 de los 9 checks** y el cierre de Phase 0 |
| BD-02 | BLOCKED_DECISION | Identidad estable de concepto | Migración 3 · PASS de Phase 0 |
| BD-05 | BLOCKED_DECISION | Convocatoria/modelo/ocurrencia | Migración 5 · PASS de Phase 0 |
| SD-006 | SPEC_DIFF PROPOSED | Integridad de referencias polimórficas | `session_items` y `planner_items` |
| SD-007 | SPEC_DIFF PROPOSED | Claves de respuesta fuera del Data API | Separación de esquemas |
| **SD-018** | SPEC_DIFF PROPOSED | Orden de eventos por usuario · **sustituye a SD-015** | Migración 8 · antes de ingerir evidencia real |
| **SD-019** | SPEC_DIFF PROPOSED | La paleta congelada no alcanza el AA que exige §14 | **P0-S7 y REQ-A06** |
| MI-01 | MISSING_INPUT | 6 PDF oficiales | PASS de **Phase 1** |
| BD-03 | BLOCKED_DECISION | Escala de confianza 4 o 5 | Confirmada por el propio Design System §6 · Phases 3 y 5 |
| BD-04 · BD-06 | BLOCKED_DECISION | Readiness por concepto · puntuación oficial | Phases 6 y 7 |

**INV-101 ya no figura aquí:** aprobado en la autorización de arranque de Phase 0.

## 5. Deuda técnica

| # | Deuda | Motivo | Resolver en |
| --- | --- | --- | --- |
| D-01 | `main` no está protegida mecánicamente | La protección de rama es función de la *forge*, y no hay remoto | Al crear el remoto |
| D-02 | Las migraciones nunca se han aplicado | Sin Docker no hay Supabase local | Al disponer de instancia |
| D-03 | CI nunca se ha ejecutado | No hay remoto | Al primer *push* |
| D-04 | La familia tipográfica es de sistema | §2 da dirección, no nombre | Al decidirla |
| D-05 | `next-env.d.ts` versionado y en `.prettierignore` | Lo regenera cada build; Next lo requiere para el typecheck | — |
| D-06 | Listas espejo entre TypeScript y las herramientas `.mjs` | Las herramientas no pueden importar TS. Hay tests que comparan ambas | Aceptable |

**Deuda documental heredada:** 26 contradicciones registradas (C-01…C-26). SD-019
añade una vigesimoséptima, detectada al incorporar el Design System.

## 6. Entradas ausentes

| Entrada | Impacto | Responsable |
| --- | --- | --- |
| **MI-05a** · repositorio remoto, Supabase, Vercel | Bloquea el cierre de Phase 0 | Ana |
| **Docker o WSL2** en la máquina de desarrollo | Bloquea `test:integration`, `test:rls`, `schema-drift` nivel B y los E2E de auth en local | Ana |
| MI-01 · 6 PDF oficiales | Bloquea el PASS de Phase 1 | Ana |
| MI-02 · contenido didáctico | Limita LEARN | Producción de contenido |
| MI-03 · corpus normativo | Limita el Tutor | Producción de contenido |
| MI-04 · mapping revalidado | Bloquea la siembra de `question_concepts` | Contenido |
| MI-05b · proveedor de IA | **Entrada de Phase 8.** No se ha solicitado ni configurado | Ana |

Ya **no** están ausentes: `STUDY_OS_Design_System_v1.0`,
`STUDY_OS_Functional_Closure_MVP_Scope_v0.1` y
`STUDY_OS_Onboarding_Edge_States_Visual_Spec_v1.0`, que llegaron durante la ronda
correctiva y están verificados por hash.

## 7. Próxima transición

**De:** Phase 0 · Foundation — **BLOCKED**.
**A:** ninguna. Phase 1 no arranca.

Condición para reevaluar: MI-05a, entorno con Docker, y las decisiones SD-018,
SD-019, BD-02, BD-05, SD-006 y SD-007. Con eso resuelto, el estado esperado es
**PASS WITH DEBT**. Detalle en `docs/PHASE_0_CHECKPOINT.md`.

---

**Regla de mantenimiento:** este documento se actualiza en cada checkpoint. Si
describe estado futuro o intenciones, se está usando mal.
