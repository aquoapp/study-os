# STUDY OS · ARCHITECTURE_STATE.md

**Propósito:** describir la **realidad** del repositorio, no la intención. Si este
documento describe algo que no existe en el código, el documento está mal.

**Versión:** 11.1 · copia viva
**Última actualización:** 2026-09-08 · cierre de D-14 (token temporal revocado por Ana)
**Fase actual:** 0 · Foundation
**Estado global:** **PASS WITH DEBT** · ver `docs/PHASE_0_CHECKPOINT.md`

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
`_handoff/`. Catorce artefactos importados conservan su hash original; los otros cuatro
son `docs/SPEC_DIFF_LOG.md` (crece por adenda) y los tres ADR anotados por decisión
humana el 2026-09-07 (`docs/PROVENANCE.md` §2.1).

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
| Repositorio de aplicación | **EXISTE · remoto · público** | `aquoapp/study-os`, **PUBLIC** desde el 2026-09-08, `origin`, `main` por defecto. `main` **protegida por ruleset** (PR obligatorio, tres checks de estado estrictos, sin force-push, sin borrado, sin bypass) y demostrada con cuatro rechazos. Historia canónica: 47 commits; `main` = `6086537`. El repositorio privado anterior es `aquoapp/study-os-archive-private` (archivo, nunca público) |
| Aplicación Next.js | **EXISTE** | Next 16.3.2 · App Router · TypeScript `strict` · PWA instalable · 8 rutas |
| Proyecto Supabase | **EXISTE · organización dedicada `STUDY_OS`** | `STUDY_OS_STAGING` (`xzcrqsolxarutlvvkzfp`, eu-west-1) es el **único entorno mutable**; `STUDY_OS_PRODUCTION` (`nzcgufeycvehczroryoe`, eu-central-1) existe como frontera real y **no se ha mutado**. Plan Free. Data API con exposición automática desactivada: los grants los dan las migraciones |
| Migraciones | **3 escritas · 3 aplicadas en STAGING · 0 en PRODUCTION** | `0000_init`, `0001_profiles` y `0002_profiles_service_role` (grants DML al rol de servicio, autorizada el 2026-09-08 tras la primera evidencia real). Con rollback y huellas en `.lock.json`; las de 0 y 1 intactas. Aplicadas también desde cero en CI en cada run |
| Políticas RLS | **Verificadas en ejecución** | `profiles` con `enable` + `force`, solo-propio. `test:rls` 11/11 contra STAGING y en CI: User A no lee ni muta a User B; `anon` sin acceso |
| `packages/design-system` | **EXISTE · satisfecho bajo SD-019 opción A** | Valores literales de `STUDY_OS_Design_System_v1.0` y defaults de implementación, separados en `TOKEN_PROVENANCE`. REQ-A06 se cumple bajo las restricciones de la opción A, verificadas en el navegador |
| `packages/config` | **EXISTE** | Tres entornos, políticas, allowlist pública, frontera `server-only`, guardas destructivas |
| `packages/domain` | **EXISTE** | `Projection<T>` (INV-113), `VerifiedIdentity` (INV-116), registro de autoridad |
| `packages/learning-engine` | NO EXISTE | Phase 3 |
| `packages/planner-engine` | NO EXISTE | Phase 4 |
| Capa de IA | NO EXISTE | Phase 8. MI-05b no se ha solicitado |
| Tests unitarios | **643 · todos ejecutados y en verde** | 30 ficheros. Recuento verificable con `vitest --reporter=json`. La ronda anterior contó 641; esta añade dos casos a `auth.serverVerifiedIdentity.spec` que **ejecutan** el constructor de identidad verificada |
| E2E estáticos | **70 · ejecutados y en verde** | arranque, PWA, accesibilidad renderizada y su fixture negativo · 35 casos × 2 proyectos. No tocan Supabase |
| E2E de auth | **16 ejecutados y en verde** | 8 casos × 2 proyectos, alta y login reales por formulario, cookie forjada rechazada. Contra STAGING y en CI (stack local). Limpieza por ejecución verificada: 6 usuarios creados, 6 borrados, 0 restantes |
| Tests de integración | **10 ejecutados y en verde** | `profiles` 1:1 contra STAGING y en CI |
| Tests de RLS | **11 ejecutados y en verde** | Contra STAGING y en CI |
| CI | **EXISTE · ejecutado · en verde** | `.github/workflows/ci.yml`, tres jobs: estático, base de datos (stack local migrado desde cero) y **deriva de esquema contra STAGING real** con guarda fail-closed. Run `34234262313` sobre `253e9c1`: los nueve checks en verde. Seis runs anteriores con fallos reales, corregidos y registrados |
| Proyecto Vercel | **EXISTE · vinculado al repositorio público** | Equipo `STUDY_OS`, proyecto `study-os` revinculado el 2026-09-08 al nuevo `aquoapp/study-os` (protección de forks activa), `apps/web`, Next.js, Node 24. Variables públicas separadas: Preview → STAGING, Production → PRODUCTION; ningún secreto de servidor. **Preview real desde `phase/0-foundation`: READY** (`study-os-git-phase-0-foundation-study-os6.vercel.app`, protegido por Vercel Authentication). Un alta real por formulario a través del Preview aterrizó en STAGING con perfil 1:1 y PRODUCTION siguió en 0 usuarios; el fixture se borró. Los dos intentos anteriores fallaron por el correo del autor de los commits (asociado por Ana) y por instalar solo las dependencias de `apps/web` (corregido con `installCommand: cd ../.. && npm ci`). Producción de Vercel sin desplegar: `main` sigue en su commit raíz |
| Guardas de invariante | **5 activas, por propagación de punto fijo** | import · tai-literal · secret-scan · client-authority (capacidades) · auth-authority (procedencia). **169 casos de guardas** que ejecutan las guardas reales —10 de sumidero computado extraído, 13 de procedencia PostgREST, 19 de cierre transitivo, 21 de propagación, 30 de símbolo y ámbito, 27 de blanqueo, 28 de evasión, 21 adversariales— **más 26 bypasses operacionales**. Sin cambios en esta ronda |
| Contenido ingerido | NINGUNO | Ni siquiera de prueba. Execution Plan §9 |
| Tablas de dominio | **NINGUNA** | Verificado por test: ninguna migración crea `learning_events`, `question_attempts`, `concept_mastery`, `exam_readiness`, `planner_*`, `canonical_questions`, `answer_key_versions`, `learning_units`, `sessions`, `session_items`, `planner_items`, `user_event_counters`, `projection_watermarks`, `concept_versions`, `exam_sittings` ni `exam_occurrences`. **Aceptar cinco decisiones no ha creado ninguna** |
| Artefactos de Phase −1 | **IMPORTADOS** | 19 ficheros, byte a byte, con SHA-256 en `docs/PROVENANCE.md` · tres ADR anotados el 2026-09-07 (§2.1) |
| Documentos gobernantes | **8 de 8 disponibles y verificados** | Ver `docs/GOVERNING_DOCUMENTS.md`. AMB-01 resuelto |
| Registro de decisión humana | **Recibido y verificado por hash** | `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · no versionado, citado en cada ADR aceptado |

## 2. Decisiones arquitectónicas vigentes

| ADR | Título | Estado |
| --- | --- | --- |
| ADR-001 | Stack y fronteras de autoridad | PROPOSED · v1.1 · punto 3 subordinado a ADR-006 |
| ADR-002 | Eventos de evidencia canónica | PROPOSED · v1.2 · punto 6 superseded por ADR-007; puntos 4 y 10 superseded por ADR-008; SD-015 superseded |
| ADR-003 | Mastery, Readiness y configuración de motor | PROPOSED · v1.1 · intacto |
| ADR-004 | Reconciliación offline y continuidad | PROPOSED · v1.1 · intacto |
| ADR-005 | Procedencia y versionado oficial | PROPOSED · punto 4 subordinado a ADR-006; punto 5 superseded por ADR-010 |
| ADR-006 | Frontera del Data API para las claves de respuesta · **SD-007** | **ACCEPTED** · v1.0 · 2026-09-07 · Ana Victoria · **NOT IMPLEMENTED** |
| ADR-007 | Destinos verificables de ítems de sesión y de planner · **SD-006** | **ACCEPTED** · v1.0 · 2026-09-07 · Ana Victoria · **NOT IMPLEMENTED** · matriz con celdas marcadas como prerrequisito |
| ADR-008 | Orden de eventos por usuario e idempotencia · **SD-018** · supersede a SD-015 | **ACCEPTED** · v1.0 · 2026-09-07 · Ana Victoria · **NOT IMPLEMENTED** · exige contrato de canonicalización antes de migrar |
| ADR-009 | Identidad estable de concepto · **BD-02** / SD-002 | **ACCEPTED** · v1.0 · 2026-09-07 · Ana Victoria · **NOT IMPLEMENTED** |
| ADR-010 | Convocatorias y ocurrencias oficiales · **BD-05** / SD-001 | **ACCEPTED** · v1.0 · 2026-09-07 · Ana Victoria · **NOT IMPLEMENTED** |

**Cinco decisiones están ACCEPTED y ninguna está implementada.** Cada una en
`ACCEPTED · NOT IMPLEMENTED`, con un único propietario normativo, aprobada mediante el
registro de decisión de §1. La aceptación **no autoriza ninguna migración**: las
migraciones **no** crean los esquemas `content` / `engine` / `audit` que propone ADR-001
—que sigue PROPOSED— ni ninguna tabla de dominio, y `adr.acceptedDecisions.spec` lo
verifica. ADR-001 … ADR-005 siguen `PROPOSED`; solo sus puntos solapados apuntan al ADR
que los sustituye.

## 3. Invariantes con enforcement activo

Ya no es «ninguno». Lo que sigue está **ejecutándose**, no solo escrito:

| Invariante | Mecanismo | Estado |
| --- | --- | --- |
| EC-008 | Enum `provenance_class` con lista cerrada | Escrito · sin aplicar |
| EC-009 · REQ-C13 | RLS `enable` + `force` en la misma migración; `schema.drift.spec` lo verifica estáticamente; `test:rls` lo ejecuta contra STAGING y en CI | **Activo** · aislamiento en ejecución **verificado** (11/11) |
| EC-010 · REQ-A05 | `secret-scan` con centinela de servidor: construye, inyecta el valor y comprueba que no aparece ni en `.next/static` ni en la salida renderizada | **Activo** |
| EC-011 · REQ-A04 | `schema-drift`: nombres, rollback obligatorio, huellas de migración, CLI de versión fijada; nivel B (`supabase db diff`) en CI contra el stack local migrado desde cero **y** contra STAGING real | **Activo** · diff contra base **verificado en CI** (sin deriva). En local exige Docker: `npm run verify` da 8/9 en una máquina sin él, y eso se documenta, no se oculta |
| EC-012 | Service worker acotado + `offline.copy.spec` prohíbe afirmar persistencia o sincronización | **Activo** |
| EC-015 · REQ-A09 | `PRIMARY_SPACES` comparado contra copia literal congelada | **Activo** |
| EC-017 | Tokens de gamificación y anti-patrones de §15 prohibidos por test | **Activo** |
| EC-018 | `tai-literal` insensible a mayúsculas sobre `apps`, `packages`, `tools`, `tests`, `supabase` | **Activo** |
| EC-019 | Artefactos congelados sin modificar; adenda por adición; hashes verificados en test; los ADR anotados se anotan solo en los puntos aprobados y `adr.acceptedDecisions.spec` fija el resto | **Activo** |
| EC-020 | `verify` cuenta un check bloqueado como fallo, nunca como omisión | **Activo** |
| ADR Policy · «solo ACCEPTED autoriza» | `decisionRegister.spec`: ningún registro vivo afirma un estado caducado; `server_sequence` solo como diseño superseded; los importados de Phase −1 se leen como cronología y su hash lo demuestra | **Activo** |
| INV-104 · INV-105 · INV-107 | Una acción primaria por vista; error con texto y `role="alert"`; copy sin atribución de fracaso | **Activo** |
| INV-113 · REQ-A08 | `client-authority-guard` **por propagación**: `tools/guards/lib/dataflow.mjs` sigue cada valor por asignaciones, desestructuración, propiedades, contenedores, `bind`/`call`/`apply`, retornos y argumentos hasta el punto fijo; invocar algo que lleve una capacidad de escritura, de RPC extraída o de miembro no demostrable es hallazgo. Lo que `guards.closure.spec` demuestra: retornos de IIFE, función expresión, método y alias tardío; recuperación desde contenedor por índice, desestructuración, `at`, `pop`, `shift`, `find`, `Map.get` y métodos no modelados; `var` izado; y la cadena contenedor → extracción → retorno → alias → llamada. Excepción de navegador: el par exacto `caches.delete` sobre el global no sombreado, en invocación directa | **Activo** |
| INV-116 · REQ-A07 | Verificador único de identidad, ESLint, y guarda de **procedencia por propagación**: `derived` nace solo en el export de nivel superior del módulo canónico; cualquier unión con un valor crudo o transformación no modelada envenena, y cualquier mutación —`+=`, `++`, escritura de propiedad, `Object.assign`, `Reflect.set`, `defineProperty`— invalida el valor y sus propiedades. Un método computado no resoluble es hallazgo si el receptor es una consulta de **procedencia demostrada**, y también si su procedencia es **opaca** y la llamada puede llevar identidad; sobre un objeto construido en el fichero, no | **Activo** (estático) · rechazo de cookie forjada **verificado** en E2E contra STAGING y en CI |
| Procedencia de consulta (INV-116) | Tres capacidades encadenadas: `supabase-client` nace solo en un origen registrado en `authority-registry.json`, resuelto por módulo y export; `postgrest-from` nace al acceder a `.from` sobre un cliente; `postgrest-query` nace al invocarlo y se conserva por la cadena. Llamarse `from` no implica PostgREST: `Array.from` y un objeto local con `from()` no son consultas. Leer `q[m]` no resoluble sobre una consulta produce `postgrest-computed-sink`, que viaja como una función-valor y falla cerrado al invocarse, esté donde esté la llamada | **Activo** |
| INV-101 | **Aprobado por Ana.** Ratificado como cambio de especificación por SD-007 / ADR-006. Sin superficie que pueda violarlo todavía | N/A en Phase 0 |

Lo que la Engineering Constitution advertía —«los documentos por sí solos no son
control suficiente»— deja de aplicarse a estos quince. Sigue aplicándose al resto.

## 4. Decisiones aceptadas · no implementadas

Las cinco decisiones humanas que bloqueaban el cierre de Phase 0 **quedaron cerradas el
2026-09-07**. Ninguna está implementada; ninguna implementación queda autorizada por
la aceptación. Lo que necesitan ahora es un plan de implementación, y eso no es Phase 0.

| Decisión | Resultado | Propietario normativo | Determina | Prerrequisitos antes de migrar |
| --- | --- | --- | --- | --- |
| **SD-007** | `ACCEPTED · NOT IMPLEMENTED` · ratifica INV-101 | ADR-006 | Separación de esquemas desde la primera migración de contenido (5, 9) | Pruebas de fuga sobre respuestas y bundles |
| **SD-006** | `ACCEPTED · NOT IMPLEMENTED` · aceptado según aclaración | ADR-007 | `session_items` y `planner_items` (7, 11) | Completar la matriz: `ON DELETE` y enumeración cerrada de `item_type` (v1.1 del ADR) |
| **SD-018** | `ACCEPTED · NOT IMPLEMENTED` · contrato final corregido · SD-015 superseded | ADR-008 | Stream de eventos e intentos (8, 9, 16) | Contrato de canonicalización versionado; las catorce suites declaradas |
| **BD-02** / SD-002 | `ACCEPTED · NOT IMPLEMENTED` · modelo de dos capas | ADR-009 | Jerarquía de contenido (3) y mapeos (5) | Forma de los mapeos versionados; política de recálculo |
| **BD-05** / SD-001 | `ACCEPTED · NOT IMPLEMENTED` | ADR-010 | Preguntas, claves, ocurrencias (5) | Columnas de unicidad y estado de reserva |

## 5. Decisiones pendientes que bloquean estructura

| ID | Tipo | Asunto | Bloquea |
| --- | --- | --- | --- |
| MI-05a · **resuelto** | ~~MISSING_INPUT~~ | Repositorio remoto público, `main` protegida por ruleset y demostrada, CI en verde, Supabase y Vercel con Preview real (2026-09-08, coste 0 €) | Nada |
| **SD-019** | Opción A **autorizada, implementada y verificada** · el cambio de especificación (B o C) sigue PROPOSED y **diferido** | La paleta congelada no alcanza el AA que exige §14 | **Nada de Phase 0.** El uso sin restricciones de la paleta, que necesitan los componentes de §16 · antes de Phase 5 |
| MI-01 | MISSING_INPUT | 6 PDF oficiales | PASS de **Phase 1** |
| BD-03 | BLOCKED_DECISION | Escala de confianza 4 o 5 | Confirmada por el propio Design System §6 · Phases 3 y 5 |
| BD-04 · BD-06 | BLOCKED_DECISION | Readiness por concepto · puntuación oficial | Phases 6 y 7 |
| SD-017 · ERRATA P0-IN-1 | SPEC_DIFF PROPOSED | Naturaleza real de los documentos gobernantes; versión citada en P0-IN-1 | La auditoría de Drive · no bloquea Phase 0 |

**Ya no figuran aquí:** INV-101 (aprobado en la autorización de arranque), y SD-018,
SD-006, SD-007, BD-02 y BD-05 (aceptados el 2026-09-07, §4).

## 6. Deuda técnica

| # | Deuda | Motivo | Resolver en |
| --- | --- | --- | --- |
| D-01 | ~~`main` no está protegida mecánicamente~~ **Cerrada el 2026-09-08**: el repositorio se hizo público tras tres preflights de publicación y `main` tiene un ruleset activo sin bypass (push directo, force-push, sobrescritura y borrado rechazados) | — | — |
| D-16 | La historia original vive en `aquoapp/study-os-archive-private` (privado); el público nació del estado saneado con los mismos 47 commits salvo los dos de punta rehechos | Higiene de publicación: los dos commits de punta originales describían un proyecto ajeno con identificadores que no se publican | Aceptada · trazabilidad preservada en privado |
| D-02 | ~~Las migraciones nunca se han aplicado~~ **Cerrada el 2026-09-08**: aplicadas en STAGING y desde cero en cada run de CI | — | — |
| D-03 | ~~CI nunca se ha ejecutado~~ **Cerrada el 2026-09-08**: run `34234262313` en verde | — | — |
| D-04 | La familia tipográfica es de sistema | §2 da dirección, no nombre | Al decidirla |
| D-05 | `next-env.d.ts` versionado y en `.prettierignore` | Lo regenera cada build; Next lo requiere para el typecheck | — |
| D-06 | Listas espejo entre TypeScript y las herramientas `.mjs` | Las herramientas no pueden importar TS. Hay tests que comparan ambas | Aceptable |
| D-07 | `teal` y `amber` no pueden llevar texto normal, y `slate` solo sobre `surface` | Restricciones de SD-019 opción A. No son deuda oculta: la prueba de accesibilidad renderizada las hace cumplir en cada ejecución | Al elegir entre B y C · antes de Phase 5 |
| D-08 | ~~Los E2E de auth no se han ejecutado nunca~~ **Cerrada el 2026-09-08**: 16/16 contra STAGING y en CI, con limpieza verificada | — | — |
| D-09 | La resolución de ámbitos no sigue tipos ni `export *`, y trata las declaraciones de función como de bloque | Aceptable · cuando no resuelve devuelve `null`, y `null` es «no demostrado» | — |
| D-10 | El motor de propagación es insensible al flujo, sigue un nivel de propiedades y no distingue instancias de una declaración entre llamadas | Aceptable · cada simplificación produce más hechos, no menos | — |
| D-11 | Un cliente Supabase que cruce la frontera del fichero sin tipo demostrable cae en «procedencia opaca» y falla cerrado en los métodos computados | Aceptable mientras no haya superficie de dominio | Cuando la haya |
| D-12 | ADR-007 deja `ON DELETE` y la enumeración cerrada de `item_type` como prerrequisito; ADR-008 exige un contrato de canonicalización que no está redactado | Los documentos gobernantes no los determinan y la regla de no invención impide fijarlos aquí | Antes de las migraciones 7, 8 y 11 · fuera de Phase 0 |
| D-13 | `schema-drift` nivel B no puede ejecutarse en la máquina de desarrollo | `supabase db diff` construye una base sombra con Docker, que no está instalado (decisión humana: no instalarlo). El control corre en CI contra el stack local y contra STAGING | Aceptable · la evidencia es la de CI |
| D-14 | ~~Token de acceso personal de Supabase `STUDY_OS Phase 0` (30 días) en un fichero local ignorado por Git~~ **Cerrada el 2026-09-08**: Ana lo revocó tras la entrega de la undécima reemisión. Fue necesario para la Management API (configuración de Auth de STAGING, rotación de claves); ninguna herramienta del repositorio ni de CI lo usa | — | — |
| D-15 | ~~La `service_role` legacy de STAGING quedó expuesta en un mensaje de error de shell~~ **Cerrada el 2026-09-08**: clave `sb_secret` `phase0_tests` nueva, claves legacy de STAGING desactivadas (Management API: `enabled: false`), checks reejecutados; PRODUCTION no afectado | — | — |

**Deuda documental heredada:** 26 contradicciones registradas (C-01…C-26). SD-019
añade una vigesimoséptima, detectada al incorporar el Design System. `spec/contradiction-register.md`
no se edita: donde dice que BD-02, BD-05 o C-15 esperan decisión describe la cronología
de la entrega; las resoluciones aceptadas constan en `docs/SPEC_DIFF_LOG.md` (registro de
aceptación) y en los ADR.

## 7. Entradas ausentes

| Entrada | Impacto | Responsable |
| --- | --- | --- |
| ~~**MI-05a**~~ | Resuelto el 2026-09-08: repositorio público con `main` protegida | — |
| ~~Docker o WSL2~~ | Ya no es entrada: los cuatro checks que lo necesitaban corren contra STAGING y en CI. Solo `schema-drift` nivel B sigue exigiendo Docker en local (D-13) | — |
| MI-01 · 6 PDF oficiales | Bloquea el PASS de Phase 1 | Ana |
| MI-02 · contenido didáctico | Limita LEARN | Producción de contenido |
| MI-03 · corpus normativo | Limita el Tutor | Producción de contenido |
| MI-04 · mapping revalidado | Bloquea la siembra de `question_concepts` | Contenido |
| MI-05b · proveedor de IA | **Entrada de Phase 8.** No se ha solicitado ni configurado | Ana |

Ya **no** están ausentes: `STUDY_OS_Design_System_v1.0`,
`STUDY_OS_Functional_Closure_MVP_Scope_v0.1` y
`STUDY_OS_Onboarding_Edge_States_Visual_Spec_v1.0`, que llegaron durante la ronda
correctiva y están verificados por hash; ni el registro de decisión humana del
2026-09-07.

## 8. Próxima transición

**De:** Phase 0 · Foundation — **PASS WITH DEBT**.
**A:** Phase 1 · Domain Foundation, **solo con autorización humana explícita**. La fase
para en su checkpoint aunque los gates estén en verde.

Los cuatro checks que exigían infraestructura se ejecutan de verdad —contra STAGING y en
CI—, el repositorio es público con `main` protegida mecánicamente, el Preview de Vercel
existe y ninguna decisión humana de dominio queda abierta. La deuda que impide el `PASS`
limpio es la de §6, encabezada por D-13; D-14 quedó cerrada el 2026-09-08. Antes de
Phase 1: revisión humana y merge de `phase/0-foundation` por PR, tag.
Detalle en `docs/PHASE_0_CHECKPOINT.md`.

---

**Regla de mantenimiento:** este documento se actualiza en cada checkpoint. Si
describe estado futuro o intenciones, se está usando mal.
