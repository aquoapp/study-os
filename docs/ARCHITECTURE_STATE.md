# STUDY OS · ARCHITECTURE_STATE.md

**Propósito:** describir la **realidad** del repositorio, no la intención. Si este
documento describe algo que no existe en el código, el documento está mal.

**Versión:** 11.27 · copia viva
**Última actualización:** 2026-09-20 · **Product UX · Waves 1–3 `ACCEPTED`** y **decisiones de pre-autorización de Phase 4B resueltas** (§18): `docs/PRODUCT_UX_CONTRACT.md` v1.0, `docs/PHASE_4B_PREAUTHORIZATION.md`, **ADR-013**, ADR-012 anexo v1.5, SD-033 … SD-039, aceptación de SD-019 opción C con AA-1, errata E-P4B-1, **INV-117** e **INV-118**. Aterrizaje **documental**: ningún esquema, ninguna migración, ningún runtime; **el BUILD de Phase 4B sigue sin autorizar** · 2026-09-19 · **Phase 4A · FROZEN · PASS WITH DEBT**: PR #19 integrado en `main` (`5a8f603`, árbol idéntico al candidato aceptado `120d166`), tag anotado `phase-4a-v1.0`; Phase 4B no autorizada (§17) · 2026-09-19 · **Phase 4A · P4-D6 `ACCEPTED`** (opción A): el motor proyecta `last_negative_position`, contrato del Learning Engine **v1.1** por anexo §25, contrato del Planner **v1.4**, ADR-012 anexo v1.4, SD-032 (§16); la gobernanza de Phase 4A ya está en `main` (PR #17 → `3a8025f`) · 2026-09-19 · **Phase 4A · P4-D5 `ACCEPTED`** (última evidencia negativa): contrato del Planner **v1.3 `ACCEPTED` en candidato**, **Gate A = PASS**; **Gate B no se abre** hasta integrar la gobernanza en `main` (CLAUDE.md §3); nada construido (§16) · 2026-09-18 · **Phase 4A · Gate A**: **P4-D3** (granularidad híbrida) y **P4-D4** (`EXPOSED` primero) `ACCEPTED`; prueba residual B cerrada; **la prueba residual A no cierra** y abre **P4-D5**; contrato v1.2 sigue `PROPOSED · BLOQUEADO`; **Gate A = FAIL, no se construye** (§16) · 2026-09-17 · **Phase 4A · validación adversarial**: IR-P4A-01 e IR-P4A-02 aceptados; el contrato del Planner pasa a **`PROPOSED · BLOQUEADO`** por **P4-D3** y **P4-D4**; ADR-012 gana el anexo v1.1 y sigue `ACCEPTED`; SD-031 corregida; gates P4-G21 y P4-G22 (§16) · 2026-09-17 · **Phase 4A · Planner Domain / Decision Engine · aterrizaje de gobernanza**: contrato del Planner y **ADR-012**, P4-D1 aceptada con modificación, P4-D2 diferida, SD-030 y SD-031 por adenda (§16). **El BUILD de Phase 4A no está autorizado.** La tabla viva de §1 queda reconciliada con la línea base congelada · 2026-09-17 · **Phase 3.1 · FROZEN · PASS WITH DEBT**: PR #15 integrado en `main` (`577cc71`, árbol idéntico al candidato aceptado `04d4669`), tag anotado `phase-3-v1.1`; **D-26 cerrada** (§15.3) · 2026-09-16 · Phase 3.1 · corrección D-26 construida como candidato: `phase-3-v1.0` contiene un defecto de invocación del motor en runtime, descubierto en la pre-autorización de Phase 4 · **Phase 3 · FROZEN · PASS WITH DEBT**: PR #13 integrado en `main` (`f5d0b10`, árbol idéntico al candidato aceptado `2ea5038`), tag anotado `phase-3-v1.0` (§14.8) · 2026-09-16 · **D-25 cerrada**: contraseña de STAGING rotada por Ana, credencial vieja rechazada y `STAGING_DB_URL` reemplazado (§14.7). PRODUCTION pausado e intacto · 2026-09-11 · **Phase 3 Acceptance Review**: candidato técnicamente aceptado sujeto a D-24 y D-25. **D-24 cerrada** (ADR-011 anexo v1.1 firmado). Sin merge, sin tag y sin congelación · 2026-09-10 · BUILD de Phase 3 construido: migraciones 19 y 20, esquema `engine` no expuesto, `packages/learning-engine` y la doble ruta de invocación; D-21 cerrada. Candidato en `docs/PHASE_3_CHECKPOINT.md`
**Fase actual:** **Phase 4A · Planner Domain / Decision Engine · FROZEN · PASS WITH DEBT** (`phase-4a-v1.0` → `5a8f603`, §17), sobre **Phase 3.1 · Learning Engine Runtime Corrective · FROZEN · PASS WITH DEBT** (`phase-3-v1.1` → `577cc71`), P3.1-G1 … P3.1-G12 en PASS, sobre **Phase 3 · FROZEN · PASS WITH DEBT** (`phase-3-v1.0` → `f5d0b10`, que contiene D-26 como historia) · ninguna fase posterior autorizada · First Product Slice `FROZEN · HUMAN ACCEPTED`, Phase 2 `FROZEN · PASS WITH DEBT`, Phase 0 y Phase 1A congeladas e intactas · **Product UX · Waves 1–3 `ACCEPTED` el 2026-09-20** y las decisiones de pre-autorización de Phase 4B resueltas (§18), sin que ninguna autorice implementación · Phase 1B, Phase 4B, Phase 5 y PRODUCTION no autorizados
**Estado global:** **PASS WITH DEBT** · línea base congelada `main` = `109ca86c6a5430d26b96bbc098ef6f151fa33baa` (congelación documental de Phase 4A, PR #20) · tag anotado `phase-4a-v1.0` → merge de implementación `5a8f6038537fc8fce5dc092ec472ec4b2a418f91` (Phase 3.1: `577cc71…`, `phase-3-v1.1`; Phase 3: `f5d0b10…`, `phase-3-v1.0`; FPS: `6bde0a0…`, `fps-v1.0`; Phase 2: `46b8fcd…`, `phase-2-v1.0`; Phase 1A: `be5a26a…`, `phase-1a-v1.0`; Phase 0: `5d8296c…`, `phase-0-v1.0`) · ver `docs/PHASE_4A_CHECKPOINT.md`, `docs/PHASE_3_1_CHECKPOINT.md` y `docs/PHASE_3_CHECKPOINT.md`

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
`_handoff/`. Trece artefactos importados conservan su hash original; los otros cinco son
`docs/SPEC_DIFF_LOG.md` (crece por adenda), los tres ADR anotados por decisión humana el
2026-09-07 (`docs/PROVENANCE.md` §2.1) y **ADR-003, enmendado y aceptado como v1.2 el
2026-09-10** (`docs/PROVENANCE.md` §2.2). Los nueve ficheros de `spec/` siguen intactos
byte a byte, y `phase3.governance.spec` lo comprueba por hash.

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
| Repositorio de aplicación | **EXISTE · remoto · público** | `aquoapp/study-os`, **PUBLIC** desde el 2026-09-08, `origin`, `main` por defecto. `main` **protegida por ruleset** (PR obligatorio, tres checks de estado estrictos, sin force-push, sin borrado, sin bypass) y demostrada con cuatro rechazos. Historia canónica: **122 commits**; `main` = **`7cf9190`** (Phase 4A · aterrizaje de gobernanza · corregido el 2026-09-17; antes decía `6086537`, valor de la ronda de Phase 0). El repositorio privado anterior es `aquoapp/study-os-archive-private` (archivo, nunca público) |
| Aplicación Next.js | **EXISTE** | Next 16.3.2 · App Router · TypeScript `strict` · PWA instalable · **10 rutas**: `/`, `/entrar`, `/registro`, `/cuenta`, `/offline`, `/onboarding`, `/hoy`, `/aprender/[ordinal]`, `/comprobar/[ordinal]`, `/fin` |
| Proyecto Supabase | **EXISTE · organización dedicada `STUDY_OS`** | `STUDY_OS_STAGING` (`xzcrqsolxarutlvvkzfp`, eu-west-1) es el **único entorno mutable**; `STUDY_OS_PRODUCTION` (`nzcgufeycvehczroryoe`, eu-central-1) existe como frontera real y **no se ha mutado**. Plan Free. Data API con exposición automática desactivada: los grants los dan las migraciones |
| Migraciones | **24 escritas · 24 aplicadas en STAGING · 0 en PRODUCTION** | Phase 0: `0000_init`, `0001_profiles`, `0002_profiles_service_role`, intactas. Phase 1A: `0003_schema_topology` … `0014_phase1a_hardening`. Phase 2: `0015_learner_core` … `0018_evidence_core`. Phase 3: `0019_attribution_boundary` y `0020_engine_core`. Phase 3.1: `0021_engine_invocation_boundary`. Phase 4A: `0022_engine_last_negative_position` y `0023_planner_domain`. Todas con rollback en `down/`, registradas en `.lock.json` y **revertidas y reaplicadas de verdad** por `db:roundtrip`, que compara la firma semántica del catálogo antes y después (en CI sobre el stack local y contra STAGING). Ninguna edita una migración aplicada |
| Políticas RLS | **Verificadas en ejecución** | `profiles` con `enable` + `force`, solo-propio. `test:rls` 11/11 contra STAGING y en CI: User A no lee ni muta a User B; `anon` sin acceso |
| `packages/design-system` | **EXISTE · satisfecho bajo SD-019 opción A** | Valores literales de `STUDY_OS_Design_System_v1.0` y defaults de implementación, separados en `TOKEN_PROVENANCE`. REQ-A06 se cumple bajo las restricciones de la opción A, verificadas en el navegador |
| `packages/config` | **EXISTE** | Tres entornos, políticas, allowlist pública, frontera `server-only`, guardas destructivas |
| `packages/domain` | **EXISTE** | `Projection<T>` (INV-113), `VerifiedIdentity` (INV-116), registro de autoridad |
| `packages/learning-engine` | **EXISTE** | Phase 3 · motor determinista, sin red y sin dependencias; calcula, y la persistencia la hace una función de rol de servicio |
| `packages/planner-engine` | **EXISTE · congelado** (`phase-4a-v1.0`) | Phase 4A · Planner v1 puro y determinista, sin red y sin dependencias; persistencia por funciones de rol de servicio (migración 23). **Integrado y congelado en Phase 4A**: candidato aceptado `120d166ecd5928445e773bc141ee04f8a0ed7c6f`, merge `5a8f603` (PR #19), tag `phase-4a-v1.0` (`docs/PHASE_4A_CHECKPOINT.md` §P) |
| Capa de IA | NO EXISTE | Phase 8. MI-05b no se ha solicitado |
| Tests unitarios | **1086 · todos ejecutados y en verde** | 50 ficheros, incluidos el vigilante `phase4a.governance.spec` y los tres ficheros de validación adversarial de `tests/governance/`. Recuento verificable con `vitest --reporter=json`. Incluye las guardas de Phase 1A, la vigilancia documental de cada checkpoint, la frontera de invocación de Phase 3.1 y el vigilante de congelación `phase3_1.freeze.spec` |
| E2E estáticos | **ejecutados y en verde** | arranque, PWA, accesibilidad renderizada y su fixture negativo. No tocan Supabase |
| E2E de auth | **ejecutados y en verde** | alta y login reales por formulario, cookie forjada rechazada, onboarding mínimo, vertical del FPS y **runtime del motor** (`engine.runtime.e2e`, Phase 3.1: la aplicación construida con `next build`, sin ningún módulo simulado). Contra STAGING y en CI. Limpieza por ejecución verificada, residuo cero |
| Tests de integración y RLS | **797 ejecutados y en verde** (serie completa) | `profiles` 1:1; exposición del Data API; catálogo con matriz rol × privilegio; fundación de Phase 1A con packs sintéticos; **red team** sin residuo; ciclo de vida de una pregunta; núcleo de evidencia de Phase 2; contrato del motor y su frontera de invocación. Desglose por suite en `docs/PHASE_3_1_CHECKPOINT.md`. Contra STAGING y en CI |
| CI | **EXISTE · ejecutado · en verde** | `.github/workflows/ci.yml`, tres jobs: estático, base de datos (stack local migrado desde cero) y **deriva de esquema contra STAGING real** con guarda fail-closed. Último run registrado sobre `main`: `35215058227` (congelación documental de Phase 3.1), tres jobs en verde; el PR de implementación de Phase 3.1 fue el run `35213354273`. `main` está protegida por el ruleset 22557790: activo, sin actores de bypass, tres checks exigidos, estricto |
| Proyecto Vercel | **EXISTE · vinculado al repositorio público** | Equipo `STUDY_OS`, proyecto `study-os` revinculado el 2026-09-08 al nuevo `aquoapp/study-os` (protección de forks activa), `apps/web`, Next.js, Node 24. Variables públicas separadas: Preview → STAGING, Production → PRODUCTION; ningún secreto de servidor. **Preview real desde `phase/0-foundation`: READY** (`study-os-git-phase-0-foundation-study-os6.vercel.app`, protegido por Vercel Authentication). Un alta real por formulario a través del Preview aterrizó en STAGING con perfil 1:1 y PRODUCTION siguió en 0 usuarios; el fixture se borró. Los dos intentos anteriores fallaron por el correo del autor de los commits (asociado por Ana) y por instalar solo las dependencias de `apps/web` (corregido con `installCommand: cd ../.. && npm ci`). Production de Vercel: el merge del PR #1 en `main` (`5d8296c`) provocó un **despliegue automático de Production** por la integración Git de Vercel, sin acción manual; Ana lo aceptó el 2026-09-08 como desviación no destructiva de Phase 0 (solo la aplicación de Phase 0, solo variables públicas de PRODUCTION, protegido por Vercel Authentication, sin dominio propio, sin migraciones, Supabase PRODUCTION sin mutar) y se conserva como evidencia. Desde entonces el proyecto lleva un *Ignored Build Step* (`commandForIgnoringBuildStep`, ajuste del proyecto, no del repositorio) que cancela toda construcción con `VERCEL_ENV=production` o rama `main`: **ningún push o merge a `main` despliega Production automáticamente**; los Preview siguen construyéndose. Un despliegue de Production exige una decisión humana explícita (por ejemplo `vercel deploy --prod --force` o «Redeploy» en el panel). Asignaciones de entorno, Vercel Authentication y raíz `apps/web` sin cambios |
| Guardas de invariante | **6 activas** (5 de Phase 0 por propagación de punto fijo + `private-schema-grant-guard` de Phase 1A, estática sobre las migraciones y `config.toml`) | import · tai-literal · secret-scan · client-authority (capacidades) · auth-authority (procedencia). **169 casos de guardas** que ejecutan las guardas reales —10 de sumidero computado extraído, 13 de procedencia PostgREST, 19 de cierre transitivo, 21 de propagación, 30 de símbolo y ámbito, 27 de blanqueo, 28 de evasión, 21 adversariales— **más 26 bypasses operacionales**. Sin cambios en esta ronda |
| Contenido ingerido | **NINGUNO OFICIAL** | En STAGING vive un solo pack de demostración **`GENERATED`** y visiblemente sintético, `demo-estudio-eficaz`, sembrado de forma idempotente por la frontera de ingestión para el FPS. Corpus oficial: Phase 1B, no autorizada. D-20 y H-1 intactas |
| Contenido canónico (Phase 1A) | **19 tablas en `public`, 1 en `content`, 2 en `ingest`** · sin contenido oficial | `public`: `exam_packs`, `exam_pack_versions`, `syllabus_blocks`, `topics`, `concepts`, `concept_versions`, `concept_prerequisites`, `sources`, `source_versions`, `canonical_questions`, `question_representations`, `question_options`, `question_concepts`, `exam_sections`, `exam_sittings`, `exam_sitting_models`, `exam_occurrences`, `practicals`, `practical_questions`. `content`: `answer_key_versions` (no expuesto). `ingest`: `promotions`, `staged_items` (no expuesto) más las funciones `stage_item`, `validate_staged_item`, `publish_staged_item`, `copy_forward_question_concepts`, `purge_generated_pack` y `concept_key`. Todas con RLS habilitado y **forzado**; lectura de lo publicado para `authenticated`; ninguna escritura de cliente; `anon` sin acceso. Solo fixtures GENERATED sintéticos, purgados al terminar cada ejecución |
| Núcleo de aprendiz y evidencia (Phase 2) | **12 tablas en `public`, 2 en `ingest`** · construidas y probadas | `public`: `learner_settings`, `learner_exam_goals`, `devices`, `sync_state`, `diagnostic_runs`, `learning_units`, `learning_unit_versions`, `study_sessions`, `session_items`, `learning_events`, `question_attempts`, `confidence_scales`. `ingest`: `user_event_counters`, `user_question_counters` (no expuestos). RLS habilitado y **forzado** en todas; la evidencia y las sesiones solo se escriben por función. Dos RPC invocables por cliente: `append_learning_event` y `create_study_session` |
| Learning Engine (Phase 3 y 3.1) | **5 tablas en el esquema no expuesto `engine`** · construidas, probadas y en runtime | `engine`: `concept_mastery`, `mastery_history`, `error_patterns`, `projection_watermarks`, `engine_config`. No se sirven por el Data API **ni siquiera al rol de servicio** (`PGRST106`). La aplicación las alcanza solo por los seis envoltorios `public.engine_*` de la migración 21, ejecutables únicamente con rol de servicio (ADR-011 anexo v1.1; D-26 cerrada) |
| Tablas del Planner (Phase 4A) | **4 tablas en `public`** · integradas y congeladas (`phase-4a-v1.0`) | `planner_config`, `planner_runs`, `planner_items`, `planner_run_audit`, creadas solo por la migración 23 |
| Tablas posteriores a Phase 4A | **NINGUNA** | Verificado por test: ninguna migración crea `exam_readiness`, `attempt_recalculations`, `notes` ni `ai_interactions`, y `planner_*` solo existe en la migración 23 |
| Artefactos de Phase −1 | **IMPORTADOS** | 19 ficheros, byte a byte, con SHA-256 en `docs/PROVENANCE.md` · tres ADR anotados el 2026-09-07 (§2.1) |
| Documentos gobernantes | **8 de 8 disponibles y verificados** | Ver `docs/GOVERNING_DOCUMENTS.md`. AMB-01 resuelto |
| Registro de decisión humana | **Recibido y verificado por hash** | `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · no versionado, citado en cada ADR aceptado |

## 2. Decisiones arquitectónicas vigentes

| ADR | Título | Estado |
| --- | --- | --- |
| ADR-001 | Stack y fronteras de autoridad | PROPOSED · v1.1 · punto 3 subordinado a ADR-006 |
| ADR-002 | Eventos de evidencia canónica | PROPOSED · v1.2 · punto 6 superseded por ADR-007; puntos 4 y 10 superseded por ADR-008; SD-015 superseded |
| ADR-003 | Mastery, Readiness y configuración de motor | **ACCEPTED** · v1.2 · 2026-09-10 · Ana Victoria · punto 1 superseded y punto 6 no operativo en v1; el anexo §C prohíbe toda pseudopuntuación y el §E mantiene readiness en Phase 6 |
| ADR-004 | Reconciliación offline y continuidad | PROPOSED · v1.1 · intacto |
| ADR-005 | Procedencia y versionado oficial | PROPOSED · punto 4 subordinado a ADR-006; punto 5 superseded por ADR-010 · **disposición punto por punto para Phase 1A aprobada el 2026-09-09** (puntos 1, 2, 3, 6-frontera, 8 y 9 subsumidos por fuentes superiores; 6-lista de campos y 7-`mapping_confidence` siguen PROPOSED hacia Phase 1B) |
| ADR-006 | Frontera del Data API para las claves de respuesta · **SD-007** | **ACCEPTED** · v1.0 · 2026-09-07 · Ana Victoria · **implementación de la frontera autorizada en Phase 1A** (la corrección en servidor es de fases posteriores) |
| ADR-007 | Destinos verificables de ítems de sesión y de planner · **SD-006** | **ACCEPTED** · v1.1 · 2026-09-07 (v1.0) y 2026-09-09 (anexo: cuatro `item_type`, `ON DELETE RESTRICT`) · Ana Victoria · **implementación de `session_items` autorizada en Phase 2**; `planner_items` en Phase 4 |
| ADR-008 | Orden de eventos por usuario e idempotencia · **SD-018** · supersede a SD-015 | **ACCEPTED** · v1.0 · 2026-09-07 · Ana Victoria · **implementación autorizada en Phase 2** (2026-09-09) con SD-022 (canonicalización v1) y SD-023 (autoridad de representación y de tiempo) aceptadas; watermarks por proyección en Phase 3 |
| ADR-009 | Identidad estable de concepto · **BD-02** / SD-002 | **ACCEPTED** · v1.1 · 2026-09-07 (v1.0) y 2026-09-09 (anexo) · Ana Victoria · **implementación autorizada en Phase 1A** |
| ADR-010 | Convocatorias y ocurrencias oficiales · **BD-05** / SD-001 | **ACCEPTED** · v1.1 · 2026-09-07 (v1.0) y 2026-09-09 (anexo) · Ana Victoria · **implementación de la estructura autorizada en Phase 1A** (carga oficial en Phase 1B) |
| ADR-011 | Topología de esquemas y frontera de exposición del Data API | **ACCEPTED** · v1.1 · 2026-09-09 (v1.0) y 2026-09-11 (anexo v1.1 · D-24 · alta del esquema no expuesto `engine`, **y ningún otro**) · Ana Victoria · **implementación autorizada en Phase 1A**; el esquema `engine`, en Phase 3 |
| ADR-012 | Autoridad de decisión del Planner | **ACCEPTED** · v1.0 · 2026-09-17 · Ana Victoria · **`IMPLEMENTED`**: Phase 4A integrada y congelada (`phase-4a-v1.0`); antes `AUTHORIZED` y, hasta el 2026-09-19, `NOT IMPLEMENTED`. Propietario normativo de `docs/PLANNER_CONTRACT.md` v1.4 |

**Las cinco decisiones del 2026-09-07 están ACCEPTED.** Cada una nació en
`ACCEPTED · NOT IMPLEMENTED`, con un único propietario normativo, aprobada mediante el
registro de decisión de §1; Phase 1A autorizó ADR-006, ADR-009 y ADR-010, y la Phase 2
Build Authorization (2026-09-09) autorizó ADR-007 y ADR-008. La aceptación **no autoriza ninguna migración**: las
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

| ADR-011 · SI-1A-1…3 | Lista de exposición = `public`, declarada en `authority-registry.json` y en `config.toml`; `content` e `ingest` sin USAGE ni grants ni políticas para roles de cliente; guarda estática sobre las migraciones; prueba contra PostgREST (ni el rol de servicio los alcanza por el Data API) | **Activo** (rama Phase 1A) |
| INV-101 · ADR-006 · SI-1A-5 | `content.answer_key_versions` fuera de todo esquema expuesto; ninguna columna de `public` nombra corrección; la opción correcta pertenece a la representación y esta a la pregunta (FK compuestas) | **Activo** · frontera de esquema verificada |
| REQ-B10 · SI-1A-4 | Toda tabla de `public` con RLS forzado; `authenticated` solo SELECT (salvo su perfil); `anon` sin grants; prueba dirigida por el catálogo, no por una lista manual | **Activo** |
| ADR-009 v1.1 · DI-1A-1/2/6 | `concept_key` con convención `<slug>-<hash8>`, única por pack, inmutable por trigger; colocación en `concept_versions` por versión; prerrequisitos sobre identidad estable, sin autorreferencia, mismo pack por FK compuestas; mapeos por versión con un PRIMARY y copy-forward `PENDING_REVALIDATION` | **Activo** |
| SD-021 · DI-1A-4/5 | Representaciones publicadas inmutables (trigger), una vigente por pregunta (índice único parcial), opciones inmutables con ella, supersesión fijada una sola vez | **Activo** |
| ADR-010 v1.1 · EC-018 | Secciones y modelos como datos del pack (sin enum global); posiciones oficiales únicas; una pregunta por modelo; reserva explícita; procedencia obligatoria; dos packs sintéticos con dimensiones disjuntas sin cambio de esquema | **Activo** |
| INV-110 · EC-008 · PI-1A-1…6 | `provenance_class` NOT NULL; OFFICIAL exige fuente OFFICIAL o queda en QUARANTINE; el contenido parseado solo entra en tablas canónicas por `ingest.publish_staged_item`; sin ruta GENERATED → VERIFIED; toda fila publicada enlaza su promoción | **Activo** |
| DI-1A-3 | Una fila canónica PUBLISHED no se borra: se retira; solo la purga de un pack íntegramente GENERATED (higiene de fixtures) puede eliminarla | **Activo** |
| EC-011 · reversibilidad | `db:roundtrip`: firma semántica del catálogo → down en orden inverso → solo Phase 0 (verificado por firma) → up → firma idéntica; en CI y contra STAGING | **Activo** |
| PI-1A-4 · PI-1A-6 · EC-007 (migración 14) | Clase de procedencia inmutable en toda tabla con procedencia; promociones cerradas inmutables con actor real; versiones de clave inmutables salvo cierre; pack de la pregunta y slug del pack inmutables; supersesión de representaciones estrictamente creciente en la misma pregunta; rol de servicio con el DML exacto declarado; ninguna función de `public` ejecutable por clientes; guarda «toda tabla nace cerrada». Probado por `phase1a.redteam.spec` y `phase1a.lifecycle.spec` con ataques sin residuo | **Activo** |

Lo que la Engineering Constitution advertía —«los documentos por sí solos no son
control suficiente»— deja de aplicarse a estos veinticuatro. Sigue aplicándose al resto.

## 4. Decisiones aceptadas · estado de implementación tras Phase 1A

Las cinco decisiones humanas que bloqueaban el cierre de Phase 0 **quedaron cerradas el
2026-09-07**; la Phase 1A Build Authorization (2026-09-09) autorizó implementar ADR-006 (frontera),
ADR-009 y ADR-010 (con sus anexos v1.1) y ADR-011. En la rama de Phase 1A: **ADR-006, ADR-009,
ADR-010 y ADR-011 implementados** en el alcance de 1A; **ADR-007 y ADR-008 pasan a
implementación autorizada** con la Phase 2 Build Authorization del 2026-09-09 (`session_items`,
stream, contadores e intentos; `planner_items` y watermarks esperan a Phase 4 y Phase 3).

| Decisión | Resultado | Propietario normativo | Determina | Prerrequisitos antes de migrar |
| --- | --- | --- | --- | --- |
| **SD-007** | `ACCEPTED · NOT IMPLEMENTED` · ratifica INV-101 | ADR-006 | Separación de esquemas desde la primera migración de contenido (5, 9) | Pruebas de fuga sobre respuestas y bundles |
| **SD-006** | `ACCEPTED` · **implementación autorizada en Phase 2** (2026-09-09) · hasta entonces `ACCEPTED · NOT IMPLEMENTED` | ADR-007 | `session_items` y `planner_items` (7, 11) | Completar la matriz: `ON DELETE` y enumeración cerrada de `item_type` (v1.1 del ADR) |
| **SD-018** | `ACCEPTED` · **implementación autorizada en Phase 2** (2026-09-09) · contrato final corregido · SD-015 superseded · hasta entonces `ACCEPTED · NOT IMPLEMENTED` | ADR-008 | Stream de eventos e intentos (8, 9, 16) | Contrato de canonicalización versionado; las catorce suites declaradas |
| **BD-02** / SD-002 | `ACCEPTED · NOT IMPLEMENTED` · modelo de dos capas | ADR-009 | Jerarquía de contenido (3) y mapeos (5) | Forma de los mapeos versionados; política de recálculo |
| **BD-05** / SD-001 | `ACCEPTED · NOT IMPLEMENTED` | ADR-010 | Preguntas, claves, ocurrencias (5) | Columnas de unicidad y estado de reserva |

## 5. Decisiones pendientes que bloquean estructura

| ID | Tipo | Asunto | Bloquea |
| --- | --- | --- | --- |
| MI-05a · **resuelto** | ~~MISSING_INPUT~~ | Repositorio remoto público, `main` protegida por ruleset y demostrada, CI en verde, Supabase y Vercel con Preview real (2026-09-08, coste 0 €) | Nada |
| **SD-019** | Opción A **autorizada, implementada y verificada** · el cambio de especificación (B o C) sigue PROPOSED y **diferido** | La paleta congelada no alcanza el AA que exige §14 | **Nada de Phase 0.** El uso sin restricciones de la paleta, que necesitan los componentes de §16 · antes de Phase 5 |
| MI-01 | MISSING_INPUT | 6 PDF oficiales | PASS de **Phase 1** |
| BD-03 · **resuelto** | ~~BLOCKED_DECISION~~ | Escala de confianza: **cuatro niveles**, `v1`, SD-008 `ACCEPTED` el 2026-09-09 | Nada · los Hi-Fi con 1–5 se corrigen en Phase 5 |
| BD-04 · **resuelta** | ~~BLOCKED_DECISION~~ | Readiness **solo a nivel de objetivo**; `◆ Preparado para examen` no se emite por concepto. Cerrada el 2026-09-10 por ADR-003 Anexo v1.2 §E | Nada · REQ-D11 deja de estar `BLOQ` |
| BD-06 | BLOCKED_DECISION | Puntuación oficial | Phase 6 |
| **Y·4** | ARCHITECTURE_DECISION · direccional aceptada | Mecanismo exacto de invocación diferida del motor, sin recursos de pago y sin autoridad nueva | El BUILD de Phase 3 · si la plataforma no ofrece un mecanismo recuperable de coste cero, **STOP** |
| DEF-28 · DEF-29 · DEF-30 | Políticas diferidas con propietario | Intervalos de repaso · sustrato de intervención · suficiencia de mastery | Nada de v1: el motor **no emite** ninguna salida que dependa de ellas |
| SD-017 · ERRATA P0-IN-1 | SPEC_DIFF PROPOSED | Naturaleza real de los documentos gobernantes; versión citada en P0-IN-1 | La auditoría de Drive · no bloquea Phase 0 |

**Ya no figuran aquí:** INV-101 (aprobado en la autorización de arranque), SD-018,
SD-006, SD-007, BD-02 y BD-05 (aceptados el 2026-09-07, §4), y BD-03 (resuelto el
2026-09-09, SD-008 `ACCEPTED`, §11).

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
| D-07 | `teal` y `amber` no pueden llevar texto normal, y `slate` solo sobre `surface`; desde el 2026-09-20 se añade `magenta` sobre `canvas` (**AA-1**, 4.47) | **Cambia de naturaleza el 2026-09-20**: SD-019 queda aceptada en **opción C** y estas restricciones dejan de ser deuda diferida para ser **regla permanente y exigible**. La prueba de accesibilidad renderizada las hace cumplir en cada ejecución | **Resuelto como decisión** · queda **OBS-4B-03**: el reflejo en código (`status.ts`, `tokens.ts` y su prueba siguen diciendo «diferido antes de Phase 5») se corrige en el primer acto de implementación autorizado |
| D-08 | ~~Los E2E de auth no se han ejecutado nunca~~ **Cerrada el 2026-09-08**: 16/16 contra STAGING y en CI, con limpieza verificada | — | — |
| D-09 | La resolución de ámbitos no sigue tipos ni `export *`, y trata las declaraciones de función como de bloque | Aceptable · cuando no resuelve devuelve `null`, y `null` es «no demostrado» | — |
| D-10 | El motor de propagación es insensible al flujo, sigue un nivel de propiedades y no distingue instancias de una declaración entre llamadas | Aceptable · cada simplificación produce más hechos, no menos | — |
| D-11 | Un cliente Supabase que cruce la frontera del fichero sin tipo demostrable cae en «procedencia opaca» y falla cerrado en los métodos computados | Aceptable mientras no haya superficie de dominio | Cuando la haya |
| D-12 | ~~ADR-007 deja `ON DELETE` y la enumeración cerrada de `item_type` como prerrequisito; ADR-008 exige un contrato de canonicalización que no está redactado~~ **Cerrada el 2026-09-09**: anexo v1.1 de ADR-007 (cuatro `item_type`, `ON DELETE RESTRICT`) y SD-022 (canonicalización v1) aceptados en la Phase 2 Build Authorization | — | — |
| D-13 | `schema-drift` nivel B no puede ejecutarse en la máquina de desarrollo | `supabase db diff` construye una base sombra con Docker, que no está instalado (decisión humana: no instalarlo). El control corre en CI contra el stack local y contra STAGING | Aceptable · la evidencia es la de CI |
| D-14 | ~~Token de acceso personal de Supabase `STUDY_OS Phase 0` (30 días) en un fichero local ignorado por Git~~ **Cerrada el 2026-09-08**: Ana lo revocó tras la entrega de la undécima reemisión. Fue necesario para la Management API (configuración de Auth de STAGING, rotación de claves); ninguna herramienta del repositorio ni de CI lo usa | — | — |
| D-15 | ~~La `service_role` legacy de STAGING quedó expuesta en un mensaje de error de shell~~ **Cerrada el 2026-09-08**: clave `sb_secret` `phase0_tests` nueva, claves legacy de STAGING desactivadas (Management API: `enabled: false`), checks reejecutados; PRODUCTION no afectado | — | — |
| D-17 | ~~Las filas de auditoría de pruebas negativas (OFFICIAL/VERIFIED) sobrevivían en STAGING a la purga~~ **Cerrada el 2026-09-09**: las pruebas negativas atacan dentro de transacciones que siempre se revierten (`attack()`); solo queda auditoría GENERATED veraz de packs purgados, que el roundtrip de cierre elimina; la suite detecta residuo engañoso | — | — |
| D-18 | Las pruebas de catálogo lanzan el CLI fijado de Supabase por consulta (≈1,7 s cada una; integración ≈4 min contra STAGING); el proceso del CLI puede caerse antes de hablar con la base (una vez en ≈900 lanzamientos) y el arnés lo reintenta solo en ese caso | No añadir un driver de PostgreSQL (Manifest §7) | Revisar en Phase 2 si el volumen crece |
| D-19 | ~~`public.set_updated_at` con `EXECUTE` para `authenticated`~~ **Cerrada el 2026-09-09** (migración 14): ninguna función de `public` es ejecutable por roles de cliente | — | — |
| D-20 | `source_versions.storage_path`, `checksum` y `retrieved_at` son legibles por `authenticated` (política `status <> 'DRAFT'`, CDEM §22) | Hoy no hay fuentes oficiales; la ruta de custodia privada de Phase 1B no debe salir por el Data API | Antes de la primera fuente OFFICIAL (Phase 1B): privilegio de columna o tabla privada de custodia |
| D-22 | El arnés de pruebas reintenta de forma acotada un transitorio de validación de token del borde gestionado, y distingue un fallo de transporte de un rechazo de la base | Los patrones son cerrados: un rechazo de PostgreSQL nunca se reintenta, de modo que un ataque no puede quedar «rechazado» por la red | Revisar en Phase 3 |
| D-23 | El rollback de la migración 16 restaura funciones enteras de Phase 1A y ronda los 33 KB | El roundtrip ya no depende del límite de línea de comandos de Windows (pasa por fichero); el tamaño solo incomoda la lectura | Al dividir la frontera de ingestión, si se divide |
| D-21 | Borrador → vigente de una representación, revalidación de un mapeo, retirada y `WITHDRAWN` no tienen función de frontera: son escrituras directas del rol de servicio, acotadas por triggers pero sin promoción auditada | Phase 1A solo necesitaba la creación; 1B necesita el ciclo de vida completo. **Desde el 2026-09-10 también lo necesita Phase 3**: sin frontera auditada, un mapeo puede mutar entre el cálculo incremental y el rebuild y romper el gate duro de EC-006 sin que nada esté roto (SD-025) | **CERRADA el 2026-09-10** por la migración 19: transición por función auditada, con actor, motivo y rastro |

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
limpio es la de §6, encabezada por D-13; D-14 quedó cerrada el 2026-09-08.

**Congelación (2026-09-08).** Tras la revisión humana independiente, Ana aceptó Phase 0
(`PASS WITH DEBT`) y autorizó el merge: PR #1 integrado en `main` por el flujo protegido
con un merge commit, `5d8296c1776be778b075d9e239b383a0476a6514`, cuyo árbol es idéntico al
de `f4cdda4` (línea base auditada `94bd6c4` más el cierre documental de D-14). Tag anotado
`phase-0-v1.0` sobre ese commit. La deuda aceptada permanece tal cual: D-13, D-04, D-05,
D-06, D-07, D-09, D-10, D-11, D-12 y D-16. La rama `phase/0-foundation` se conserva como
histórica. Los commits posteriores a la etiqueta son exclusivamente documentales y no
mueven la línea base congelada. Phase 1 exige una decisión humana separada.
Detalle en `docs/PHASE_0_CHECKPOINT.md`.

## 12. First Product Slice · autorización de BUILD · 2026-09-09

**Registro de decisión:** FPS Build Authorization · Ana Victoria · revisión independiente
previa (`STUDY_OS_FPS_Pre_Build_Reconciliation_Packet_0678e08`, veredicto
`FPS · READY WITH HUMAN DECISIONS`) · copia aceptada en
`docs/FPS_AUTHORIZATION_PACKET.md`.

**Decisiones aceptadas:** **H-FPS-A** (SD-010 y las correcciones de C-06, aprobadas tal como
estaban redactadas; la resolución ya era inequívoca por autoridad y lo que faltaba era el
registro), **H-FPS-B** (contrato de pantalla de FPS v1 en `docs/FPS_SCREEN_CONTRACT.md`,
derivado de los requisitos, los invariantes, la terminología, los tokens, la accesibilidad y
C-06; autoridad de FPS v1, no congelación del diseño futuro) y **H-FPS-C** (disposición
explícita de REQ-F01 … REQ-F15: nueve satisfechos, dos parcialmente satisfechos, cuatro
diferidos, sin debilitar ningún requisito canónico de Phase 5).

**Semántica aceptada:** `fps-fixed-v1` es un algoritmo de asignación **determinista**, función
pura sobre el contenido publicado del pack del objetivo, derivado y no almacenado; el marcador
persistido de la sesión es `session_type = 'FPS_FIXED'` con `planner_run_id IS NULL`, sin
columna de metadatos nueva; una sesión abierta gana siempre sobre crear otra; una corrección
pendiente se muestra antes de seguir el cursor del servidor.

**Superficie autorizada:** `/hoy`, `/aprender/[ordinal]`, `/comprobar/[ordinal]` y `/fin`.
FEEDBACK es un estado de `/comprobar`, no una ruta. El ordinal es el orden del ítem dentro de
la sesión del aprendiz, nunca un identificador. No se monta la navegación de los cinco
espacios primarios.

**Qué se autoriza:** el vertical de producto sobre la base congelada de Phase 2, con contenido
sintético `GENERATED` únicamente, en STAGING y en Preview, con sembrado idempotente de un pack
de demostración estable.

**Qué no se autoriza:** Phase 1B, Phase 3, motores, planificador, dominio, preparación,
proyecciones, puntuación, simulación, corpus oficial, custodia privada, dependencia nueva,
recurso de pago, **migración de esquema**, merge final del FPS, tag, congelación, Release y
cualquier mutación o despliegue de PRODUCTION.

**Deuda y vigilancia heredadas:** **WATCH-P2-1** viaja sin cambios y **no se mitiga** en el
FPS; ninguna mitigación futura puede comprometer la retroalimentación pedagógica veraz
posterior al envío. **D-20** queda como vigilancia del FPS, ni cerrada ni ampliada: el FPS usa
solo contenido `GENERATED` y no selecciona `source_versions.storage_path`, `checksum` ni
`retrieved_at`.

**Construido el 2026-09-09** en `milestone/fps-first-product-slice`, sobre `main` = `e32727c`: cuatro rutas protegidas, la primera capa de componentes de producto, `fps-fixed-v1` en `@study-os/domain`, tres módulos de servidor y las acciones que envían la evidencia por las dos RPC ya declaradas. **Sin migración, sin RPC nueva, sin grant nuevo y sin exposición nueva.** Un pack de demostración sintético y estable en STAGING, sembrado de forma idempotente por la frontera de ingestión. Checkpoint `docs/FPS_CHECKPOINT.md`.

**Aceptado y congelado el 2026-09-09.** `FPS · HUMAN WALKTHROUGH: PASS`: Ana completó el recorrido en el Preview desplegado, a través de la interfaz real. Integrado en `main` por el PR #10 con las tres comprobaciones exigidas en verde (CI `34400908876`): commit de merge `6bde0a045532c8ffb2769c0a24d4bbb94958dd57`, padres `e32727c` y `d3f1086`, árbol idéntico al HEAD aceptado; tag anotado `fps-v1.0` sobre ese merge. **FPS-G1 … FPS-G10 en PASS**, y lo que cierra G10 es el recorrido humano, no una suite. El sub-gate de interrupción manual **no se observó** en la evidencia humana y queda probado mecánicamente por FPS-G6.

La reconciliación de solo lectura entre lo que el producto mostró y lo que STAGING guarda cuadra entera: dos sesiones `FPS_FIXED` con `planner_run_id` nulo y ambas COMPLETED, 7 ítems completados por sesión, 5 intentos con 4 aciertos y 1 fallo en cada una, 62 eventos en posiciones 1 … 62 sin huecos, ningún intento duplicado y ninguna anomalía de autoridad.

**Cuatro observaciones de producto, no bloqueantes y sin corregir:** FPS-OBS-01 planitud visual (producto y UX, **no deuda técnica**), FPS-OBS-02 copy de calibración de poco valor en algunas combinaciones, FPS-OBS-03 doble final de sesión, FPS-OBS-04 disponibilidad declarada frente a duración de la sesión, que es el hueco de capacidad esperado y pertenece al Planner. La aceptación **no** aprueba el diseño visual definitivo de STUDY OS. El FPS **no añade deuda**: WATCH-P2-1 sigue heredado y sin mitigar, y D-20 sigue como vigilancia sin ampliar.

**Aterrizaje de gobernanza (rama `milestone/fps-governance`):** aceptación de SD-010 en el
`SPEC_DIFF_LOG`; paquete aceptado; contrato de pantalla; registro de alcance actualizado en
`phase2.scopeNegative.spec` para autorizar exactamente cuatro rutas; vigilancia documental
nueva en `fps.governance.spec`. **Ningún objeto de runtime** se crea en este aterrizaje.

---

## 11. Phase 2 · autorización de BUILD · 2026-09-09

**Registro de decisión:** `STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md` · SHA-256 `da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67` · Phase 2 Build
Authorization · Ana Victoria · revisión independiente previa · copia aceptada en
`docs/PHASE_2_AUTHORIZATION_PACKET.md`.

**Decisiones aceptadas:** H-P2-1 (ADR-007 v1.1: `item_type` exactamente `LEARNING_UNIT`,
`QUESTION`, `PRACTICAL`, `CONCEPT_REVIEW`; `ON DELETE RESTRICT`), H-P2-2 (SD-022,
canonicalización v1), H-P2-3 (corrección dentro de la normalización del intento;
`append_learning_event` primera RPC invocable por cliente, `create_study_session` como
función de flujo de sesión, ambas declaradas en `authority-registry.json` con contrato de
seguridad), H-FPS-1 opción A (`learning_units` como adenda de contenido canónico a través de
la frontera `ingest` de Phase 1A; identidad estable + versiones inmutables; solo GENERATED),
BD-03 (SD-008: cuatro niveles, escala `v1`, etiquetas del material de pantalla). La
corrección obligatoria §2 quedó registrada como **SD-023**: `client_created_at` nunca elige
representación ni clave; la representación es la presentada y verificada; la clave la
resuelve el servidor para esa representación; el intento nace inmutable. Se comprobó que
está implicada por ADR-008, SD-021, EC-007 y el CDEM: aclaración, no enmienda.

**Qué se autoriza:** el alcance del paquete aceptado, en STAGING: núcleo de aprendiz
(`learner_settings`, `learner_exam_goals`, `devices`, `sync_state`, `diagnostic_runs`),
`learning_units` con versiones, sesiones e ítems tipados, stream de eventos con orden e
idempotencia de ADR-008, intentos con corrección en servidor, confianza v1, respuesta en
blanco como evidencia, autoguardado y reanudación exacta, onboarding mínimo, matrices de RLS
e inmutabilidad, pruebas adversariales, reversibilidad y checkpoint.

**Qué no se autoriza:** merge final, tag, Release, congelación, FPS, Phase 1B, Phase 3,
motores, proyecciones, planner, watermarks, custodia privada, corpus oficial, pgvector, IA,
cola offline y cualquier mutación de PRODUCTION.

**Construida el 2026-09-09** en `phase/2-learner-evidence-core`: cuatro migraciones (15–18)
con rollback y registro de huellas, 12 tablas de `public` y 2 de `ingest` con RLS forzado,
canonicalización v1 en SQL y en `@study-os/domain`, `append_learning_event` y
`create_study_session` como únicas RPC de cliente, onboarding mínimo en `/onboarding`, y una
campaña adversarial que no encontró ninguna fuga de clave ni ningún acceso cruzado. Roundtrip
semántico contra STAGING: 944 entradas → catálogo limpio → 944 idénticas. Checkpoint
`PASS WITH DEBT` en `docs/PHASE_2_CHECKPOINT.md`.

**Aceptada y congelada el 2026-09-09.** `PHASE 2 HUMAN ACCEPTANCE: APPROVED` (Ana Victoria,
sobre revisión independiente de arquitectura y aceptación), candidato aceptado
`2658608faba2f5a793680200590603bb633f44ce`. Integrada en `main` por el PR #7 con las tres
comprobaciones exigidas en verde (CI `34373601082`): commit de merge
`46b8fcd705e32c86ed6ddac225cd50f80e4faca9`, padres `0cf7467` y `2658608`, árbol idéntico al
HEAD aceptado; tag anotado `phase-2-v1.0` sobre ese merge. Sin Release y sin despliegue de
Production: el Ignored Build Step canceló el despliegue con destino Production del merge.
Deuda abierta y aceptada D-13, D-18, D-22 (solo arnés de pruebas) y D-23 (solo rollback);
D-12 cerrada. **WATCH-P2-1** queda registrado como vigilancia y **no** como deuda: la
corrección posterior al envío es enumerable mediante intentos registrados, el comportamiento
actual está aceptado, y ninguna mitigación futura puede comprometer la retroalimentación
pedagógica veraz posterior al envío.

**Relevo de modelo durante el BUILD.** Fable 5.1 agotó su límite de uso con la
implementación entera sin confirmar en el árbol de trabajo; Opus 5 reconstruyó el estado de
forma forense, verificó lo heredado, reparó cinco defectos que la interrupción dejó abiertos
—`typecheck` en rojo, registro de huellas desfasado, una suite en rollo dada por verde,
cuatro suites nunca ejecutadas y un usuario de prueba huérfano— y completó el resto. El
registro de la recuperación vive fuera del repositorio
(`STUDY_OS_Phase_2_MODEL_HANDOFF_RECOVERY_58c21a7.md`).

**Aterrizaje de gobernanza (rama `phase/2-governance`):** anexo v1.1 de ADR-007; cabeceras
de ADR-007 y ADR-008 en `AUTHORIZED · Phase 2`; SD-008, SD-022 y SD-023 en la adenda del
`SPEC_DIFF_LOG`; paquete aceptado; registro de RPC invocables por cliente y guarda
correspondiente; revisión mínima de las pruebas negativas (`sd018.contract.spec` pasa a
vigilar la correspondencia contrato ↔ migración ↔ suites; `adr.acceptedDecisions.spec` y
`schema.drift.spec` prohíben ahora lo de Phase 3 en adelante); vigilancia documental nueva
en `phase2.governance.spec`. **Ningún objeto de runtime de Phase 2** se crea en este
aterrizaje.

---

**Regla de mantenimiento:** este documento se actualiza en cada checkpoint. Si
describe estado futuro o intenciones, se está usando mal.

## 9. Phase 1A · autorización de BUILD · 2026-09-09

**Registro de decisión:** `STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4` · Phase 1A Build
Authorization · Ana Victoria · revisión independiente previa (Phase 1 Pre-Authorization Review
del 2026-09-09).

**Qué se autoriza:** únicamente el alcance del Phase 1A Authorization Packet aceptado
(`docs/PHASE_1A_AUTHORIZATION_PACKET.md`): topología ADR-011, jerarquía de contenido,
identidad y versiones de concepto, fuentes, identidad y representaciones inmutables de
pregunta, mapeos versionados, claves en `content`, modelo exam-neutral de ocurrencias,
prácticos (estructura), frontera `ingest`, procedencia, RLS y grants, fixtures GENERATED
sintéticos, pruebas, reversibilidad, deriva y checkpoint.

**Qué no se autoriza:** Phase 1B (corpus oficial, MI-01, MI-04, custodia privada), Phase 2
(sesiones, eventos, intentos), motores, proyecciones, corrección, RPC invocable por cliente,
UI, `learning_units`, FPS (aprobado solo como hito conceptual), pgvector, IA, offline y
cualquier mutación de PRODUCTION.

**Auditado adversarialmente el mismo día:** la migración 14 (aditiva, con rollback) hace
inmutables la clase de procedencia, las promociones cerradas, las versiones de clave, el
pack de una pregunta y el slug de un pack; acota la supersesión de representaciones; registra
el actor real de cada promoción; deja al rol de servicio exactamente el DML declarado (sin
TRUNCATE ni escritura en `ingest`/`content`); revoca privilegios por defecto y D-19. Las
pruebas `phase1a.redteam.spec` y `phase1a.lifecycle.spec` atacan cada invariante sin residuo;
`db:roundtrip` compara la firma semántica del catálogo tras up → down → up.

**Construido el 2026-09-09** en `phase/1a-canonical-domain-foundation`: doce migraciones
(3–14) con rollback, 23 tablas con RLS forzado, frontera `ingest`/`content`, seis guardas,
`db:roundtrip`, pruebas de exposición, catálogo, frontera de claves, identidad de concepto,
representaciones, mapeos, ocurrencias, procedencia y purga; todo verificado contra STAGING
y en CI. Inventario y evidencia en `docs/PHASE_1A_CHECKPOINT.md`.

**Congelación (2026-09-09).** Tras la revisión humana independiente de la auditoría
adversarial, Ana aceptó Phase 1A (`PASS WITH DEBT`) sobre el HEAD `c663afc` y autorizó el
aterrizaje protegido: PR #4 integrado en `main` con un merge commit,
`be5a26ade5ac384a572d62568d7ac29fd2a568f6` (padres `e5fc785` y `c663afc`, árbol idéntico al
HEAD aceptado); tag anotado `phase-1a-v1.0` sobre ese commit. Deuda dispuesta: D-13 y D-18
abiertas y aceptadas; D-17 y D-19 cerradas; D-20 y D-21 abiertas con cierre obligatorio antes
de la operación de Phase 1B. PRODUCTION sin mutar (0 tablas, 0 migraciones); el merge a
`main` produjo un despliegue de Production CANCELED por el Ignored Build Step. La rama
`phase/1a-canonical-domain-foundation` se conserva como histórica. Los commits posteriores
al tag son exclusivamente documentales y no mueven la línea base congelada.

## 10. Decisiones humanas registradas tras la aceptación · 2026-09-09

Registro para la planificación; **ninguna autoriza construir**. Phase 1B, Phase 2 y FPS
siguen sin autorización de BUILD; no se crea custodia privada ni se ingiere corpus.

| ID | Decisión | Efecto |
| --- | --- | --- |
| H-2 · custodia del contenido privado | **Git privado** como arquitectura de custodia de Phase 1B: repositorio PRIVADO separado + manifiesto de fuentes + verificación SHA-256 + identidad de versión inmutable por commit + checkout local como copia de trabajo autorizada. El almacenamiento de objetos queda como alternativa, no como opción por defecto. Sin solución de pago | Cuando Phase 1B se autorice, el repositorio se crea y configura de forma autónoma si los permisos lo permiten, se verifica mecánicamente PRIVADO antes de que entre corpus alguno, y Ana solo interviene ante una acción humana genuina |
| H-3 · mapeo de campos del contrato de ingestión | Mapear los campos del contrato a las primitivas de Phase 1A cuando haya equivalencia semántica; no duplicar esquema por el hecho de que una hoja lo contenga; no crear vertederos JSON genéricos. Si un campo exige semántica nueva no representable: STOP en la autorización o build de 1B con el desajuste exacto | Guía de diseño de Phase 1B |
| H-4 · D-20 | Solución mínima robusta de mínimo privilegio: evaluar primero privilegios de columna, mecánicamente, contra `SELECT *`, selección explícita, embeds, OpenAPI/descubrimiento, metadatos y comportamiento de PostgREST; si resulta frágil o ambigua, tabla privada de custodia. Resoluble experimentalmente sin nueva decisión humana. Debe cerrarse antes de ingerir contenido oficial | Cierre de D-20 en Phase 1B |
| H-1 · base de derechos/reutilización | **NO resuelta.** Una declaración humana sin soporte no es evidencia legal. Antes de ingerir corpus oficial literal hacen falta evidencias de las condiciones de la fuente suficientes para el almacenamiento privado, la transformación, la extracción estructurada, la reproducción literal, la redistribución si aplica y la atribución si se exige | Bloqueo de Phase 1B para contenido oficial literal |
| H-FPS-2 · contenido de FPS | FPS **no depende de Phase 1B**: el primer vertical visible usa contenido de desarrollo GENERATED claramente etiquetado, nunca presentado como material oficial del primer pack. FPS prueba el vertical del producto, no la completitud del corpus | Dirección de planificación de FPS |

## 13. Phase 3 · Learning Engine · aterrizaje de gobernanza · 2026-09-10

**Registro de decisión:** Phase 3 Governance Landing Authorization · Ana Victoria · revisión
independiente · copia aceptada en `docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md` · propuesta de
entrada `STUDY_OS_Learning_Engine_Contract_v1.0_Proposal_d3581ba.md` · SHA-256
`cfb07a1ed05602b74daacb742472e21a94c7b602c6bbae634d9d2df42b33f6c7`.

**Alcance: gobernanza únicamente. El BUILD de runtime de Phase 3 NO está autorizado.**

### 13.1 Qué se ha aterrizado

| Artefacto | Estado |
| --- | --- |
| `docs/LEARNING_ENGINE_CONTRACT.md` v1.0 | **`ACCEPTED`** · contrato semántico autoritativo del motor v1 |
| ADR-003 | **`ACCEPTED · v1.2`** · punto 1 superseded, punto 6 no operativo en v1, Anexo v1.2, `OWNS: BD-04` |
| SD-013 | **`ACCEPTED`** · gobierno de `engine_config` · deja de estar pendiente |
| BD-04 | **CERRADA** · readiness solo por objetivo · REQ-D11 desbloqueado |
| ADR-008 | **anexo de reconciliación de watermark**, sin enmendar ninguno de sus once puntos |
| SD-024 … SD-029 | **`ACCEPTED`** · contrato, atribución, watermark, disposición REQ-D, contradicciones, requisitos diferidos |
| `authority-registry.json` | `error_patterns`, `projection_watermarks` y `engine_config` pasan a proyecciones de escritura exclusiva del servidor |
| `tests/unit/phase3.governance.spec.ts` | prueba documental · 55 casos · convierte el contrato en mecánico |

### 13.2 El modelo, en cuatro frases

1. La proyección autoritativa es un **vector de evidencia** —recuentos, conjuntos, mínimos y
   máximos sobre intentos reales—, no una puntuación.
2. El estado es una **función pura y total** del vector, sin ningún parámetro libre:
   `NEW · EXPOSED · EVIDENCE_POSITIVE · EVIDENCE_NEGATIVE · EVIDENCE_CONFLICTING`.
3. **No hay puntuación numérica autoritativa** en v1, luego tampoco pesos: `engine_config v1`
   contiene **cero parámetros numéricos de aprendizaje**.
4. Lo que no se puede afirmar **no se emite**: `✓ Dominado` y `⟳ Repaso pendiente` son
   inalcanzables mientras sus políticas estén sin fijar, y `◆ Preparado para examen` no se
   emite nunca a nivel de concepto.

### 13.3 Lo que este aterrizaje NO hace

Ninguna tabla, ninguna migración —siguen siendo 19—, ningún trigger, ninguna función de
frontera, ningún grant, ningún worker, ninguna dependencia, ningún despliegue y ninguna
mutación de STAGING ni de PRODUCTION. `packages/learning-engine` no existe. El registro de
alcance negativo (`phase2.scopeNegative.spec`, `schema.drift.spec`) **no se ha relajado**: su
actualización es prerrequisito del BUILD, porque mientras nada exista la prohibición es la
única garantía de que nada existe.

### 13.4 Prerrequisitos del BUILD de Phase 3

| # | Prerrequisito | Origen |
| --- | --- | --- |
| 1 | **D-21** · función de frontera auditada para las transiciones de `question_concepts` | SD-025 · sin ella el gate duro de EC-006 es inestable |
| 2 | Generación de atribución (`attribution_pack_version_id`, `attribution_generation`) especificada en migración, con recálculo registrado | SD-025 |
| 3 | Mecanismo de invocación diferida recuperable, de coste cero y sin autoridad nueva | H-P3-9 · si no existe, **STOP como ARCHITECTURE DECISION REQUIRED** |
| 4 | Actualización del registro de alcance negativo para autorizar exactamente las tablas del contrato §Z.1 y ninguna más | este aterrizaje lo deja sin tocar a propósito |
| 5 | Autorización humana independiente de BUILD | Checkpoint Contract · CLAUDE.md §3 |

### 13.5 Condiciones de parada declaradas

- Si el diseño de implementación de la atribución **no preserva los invariantes congelados de
  Phase 1A** o introduce una frontera de autoridad de cliente nueva: **STOP**.
- Si la plataforma no ofrece un mecanismo de invocación recuperable y fiable de **coste cero**
  dentro de la autoridad vigente: **STOP**. No se disimula la fiabilidad con comportamiento
  «best-effort» en el cliente.

## 14. Phase 3 · Learning Engine · BUILD · 2026-09-10 · FROZEN · PASS WITH DEBT el 2026-09-16

**Registro de decisión:** Phase 3 Build Authorization · Ana Victoria · sobre `main`
`8a21fc29ca4f43a470b91d2b53ac81626042f66e`. **Alcance: implementación, validación y
preparación de un candidato de aceptación.** No autoriza merge, tag, congelación, Phase 4,
Phase 1B ni ninguna mutación de PRODUCTION.

**Rama:** `phase/3-learning-engine`. **Checkpoint:** `docs/PHASE_3_CHECKPOINT.md`.

### 14.1 Qué existe ahora que antes no existía

| Elemento | Nota |
| --- | --- |
| `packages/learning-engine` | motor determinista y sin red: pliegue de evidencia, función de estado total, incertidumbre categórica, patrones estructurales y decisión de modo. **Sin ninguna dependencia externa** |
| Migración 19 · frontera de atribución | cierra **D-21**: el rol de servicio pierde la escritura directa sobre `question_concepts`; toda transición pasa por función auditada; toda mutación semántica avanza la generación |
| Migración 20 · núcleo del motor | esquema `engine` **no expuesto** con `concept_mastery`, `mastery_history`, `error_patterns`, `projection_watermarks` y `engine_config` |
| `apps/web/src/server/engine` | lectura por función de servidor, cálculo puro, persistencia atómica, y las dos rutas de invocación |
| Una llamada en el FPS | `scheduleProjection`, no bloqueante. **Es el único cambio del vertical congelado** |

### 14.2 El modelo, tal como quedó construido

La proyección autoritativa es un **vector de evidencia**; el estado es una función pura y total
de ese vector, con cinco valores; **no hay puntuación numérica** y por tanto tampoco pesos;
`engine_config v1` contiene **cero parámetros numéricos de aprendizaje** y sus dos ranuras de
política quedan sin fijar, con restricciones de tabla que impiden darles valor. La evidencia de
diagnóstico queda excluida del estado autoritativo y se contabiliza aparte.

### 14.3 Lo que sigue sin existir

`exam_readiness`, `intervention_outcomes`, planner, puntuación, readiness, decaimiento, repaso
programado, IA, dependencia nueva, recurso de pago y cualquier superficie de aprendiz del
estado derivado. Comprobado en el árbol y en el catálogo.

### 14.4 Estado de los entornos

**STAGING:** 21 migraciones, esquema `engine` con RLS forzada y cero privilegios de cliente.
La **evidencia de aceptación de Ana está intacta** (62 eventos, 10 intentos, 2 sesiones) y no
queda **ningún residuo automatizado** de Phase 3.

**PRODUCTION:** sin migraciones, sin tablas y sin mutación. Ninguna credencial local la
alcanza.

### 14.5 Deuda nueva

| # | Deuda |
| --- | --- |
| **D-24** | **CERRADA el 2026-09-11.** ADR-011 anexo v1.1 —alta del esquema `engine`, previsto en su punto 10— firmado por Ana en la Phase 3 Acceptance Review, sin ampliarlo |
| **D-25** | Una credencial de STAGING quedó impresa en la transcripción de trabajo por el camino de error del CLI de Supabase. **CERRADA el 2026-09-16.** Vector cerrado en el repositorio, contraseña rotada en el panel por Ana, credencial vieja rechazada en los dos puertos del pooler y `STAGING_DB_URL` reemplazado (§14.7) |

**D-21 pasa a CERRADA**, con prueba mecánica.

### 14.7 Phase 3 Acceptance Review · 2026-09-11

Registro: `docs/PHASE_3_ACCEPTANCE_REVIEW.md`. El candidato revisado queda **técnicamente
aceptado, sujeto al cierre de D-24 y D-25**; el merge final no está autorizado.

**Vector de D-25, cerrado en el repositorio.** `runSupabase` (`tools/supabase-cli.mjs`) ya no
propaga el error de `execFileSync`, cuyo mensaje contiene la línea de comandos con `--db-url`:
construye uno nuevo con el código y la salida del CLI, redactados, y redacta también la salida
correcta. `db-roundtrip` y el arnés SQL redactan cualquier cadena de conexión y no solo la
conocida. `secret-scan` detecta cadenas de conexión con contraseña embebida.
`secret.redaction.spec` provoca un fallo real del CLI con una contraseña centinela y comprueba
que no aparece, y fija la lista revisada de herramientas que hablan con una base remota.

**Cobertura que faltaba.** `schema-drift` comparaba solo `public`, `content` e `ingest`, y la
firma semántica del roundtrip tampoco miraba `engine`. Ambos cubren ya el esquema del motor.

**Rotación.** Se intentó por la vía programática autorizada, generando la contraseña dentro
del proceso y enviando solo su verificador SCRAM: la plataforma respondió `permission denied
to alter role`, porque el rol `postgres` no puede cambiar su propia contraseña. El conector de
Supabase ejecuta como ese mismo rol, y el token de la Management API está revocado por decisión
humana (D-14). No se mutó nada. La rotación fue, por tanto, **una acción humana en el panel**.

**Cierre de D-25 · 2026-09-16.** Ana restableció la contraseña de `STUDY_OS_STAGING` en el
panel y ejecutó la herramienta de aplicación: credencial nueva `OK` y vieja `AUTH_REJECTED` en
los puertos 5432 y 6543, fichero local actualizado. El reemplazo del secreto de GitHub falló en
su terminal y se completó después desde el fichero local por entrada estándar (`updatedAt`
2026-09-08 → 2026-09-16). CI autentica con el secreto nuevo. STAGING conserva 21 migraciones y
la evidencia de Ana (62 eventos, 10 intentos, 2 sesiones), sin residuo. **PRODUCTION está
pausado** por ser un proyecto Free sin uso; no se reactivó ni se mutó.

### 14.6 Condición de parada, declarada

La detección de proyección incoherente compara la proyección con su watermark; **no** pretende
cazar cualquier falsificación. La verificación completa es el rebuild, que es lo que EC-006
exige y lo que el ciclo ejecuta en cuanto detecta la incoherencia. Se declara aquí para que
nadie lea de más en la palabra «detectable».

### 14.8 Aceptación final y congelación · 2026-09-16

**PHASE 3 · FROZEN · PASS WITH DEBT.** Phase 3 Final Acceptance + Landing / Freeze
Authorization, Ana Victoria.

| Papel | SHA |
| --- | --- |
| Candidato aceptado | `2ea50383067c833cd0cd790120c16ad04705b99d` · árbol `6779e6517faadb9273f62aa1cc4b97d77fcf7685` |
| Merge de implementación (PR #13) | `f5d0b101b58bae4d1003ea91f15ff0ecfe924f97` · padres `8a21fc2` y `2ea5038` · árbol idéntico al candidato |
| Tag canónico | `phase-3-v1.0` · objeto `fbd9530ec548db6f16958955f05337a2b3d87e2c` · pela al merge de implementación |
| Congelación documental | PR aparte y exclusivamente documental; no mueve la línea base |

CI exigida sobre el PR #13: `35088822749`, tres jobs en verde. Deuda cerrada: D-21, D-24,
D-25. Deuda aceptada y sin cambio: D-13, D-18, D-20, D-22, D-23; WATCH-P2-1 heredado. STAGING
comprobado en solo lectura, sin reconstruir ni resembrar. PRODUCTION **pausado** y sin tocar; el
despliegue de Production que inició la actividad de `main` quedó **cancelado** por el control
de release. Phase 4, Phase 1B, Planner, superficie de aprendiz de mastery, corpus oficial y
PRODUCTION **siguen sin autorizar**.

## 15. Phase 3.1 · corrección de la invocación del motor en runtime · D-26 · 2026-09-16

**Registro de decisión:** `docs/PHASE_3_1_CORRECTIVE_AUTHORIZATION.md`. **Alcance:** gobernanza y
candidato correctivo únicamente. Sin merge, sin tag, sin congelación y sin `phase-3-v1.1`.

### 15.1 El defecto

`phase-3-v1.0` —congelado e **inmutable**— contiene D-26. El módulo de servidor
`apps/web/src/server/engine/run.ts` pedía los esquemas `engine` e `ingest` al Data API; esos
esquemas no están expuestos (ADR-011 anexo v1.1) y PostgREST respondía `PGRST106` también al rol
de servicio. La ruta A fallaba siempre, capturada y registrada como aviso, y la ruta B no tenía
ningún llamador. Las suites de Phase 3 probaban el contrato durable por SQL directo y ninguna
ejecutó el módulo real, así que P3-G7 quedó en PASS en el plano de la base de datos y no en el del
runtime. Se descubrió en la reconciliación de pre-autorización de Phase 4, no en producción.

### 15.2 La corrección (candidato)

| Elemento | Nota |
| --- | --- |
| Migración 21 | seis envoltorios `public.engine_*`, `SECURITY INVOKER`, `search_path` vacío, EXECUTE solo para el rol de servicio; ningún esquema privado expuesto; rollback en `down/` |
| `run.ts` | todo pasa por `ENGINE_RPC`; ninguna llamada a esquemas privados |
| Ruta A | `scheduleProjection` entrega el cálculo a `after()` tras aceptar la evidencia |
| Ruta B | `recoverProjectionOnReturn` en HOY, solo para el aprendiz verificado, sin cambiar lo que HOY muestra |
| Pruebas | `engine.runtime.spec` (módulo real contra PostgREST), `engine.runtime.e2e` (aplicación construida), `engine.invocationBoundary.spec` |

Checkpoint en `docs/PHASE_3_1_CHECKPOINT.md`. Mientras fue candidato, D-26 permaneció abierta.

### 15.3 Aceptación humana y congelación · 2026-09-17

**PHASE 3.1 · FROZEN · PASS WITH DEBT.** Ana aprobó el candidato exacto tras revisión independiente
del paquete de evidencia.

| Papel | SHA |
| --- | --- |
| Candidato aceptado | `04d4669719e75ab172e80da712ea7e155b3352bd` · árbol `bd1c9c5c3e6a553f52f312de8de81cf21b5d5f30` |
| Merge de implementación (PR #15) | `577cc711e017f1fb48ba881ea34288d865317429` · padres `64158b5` y `04d4669` · árbol idéntico al candidato |
| Tag canónico | `phase-3-v1.1` · objeto `284ba3e01d3f025b56223f29e0bccfaa459ef040` · pela al merge de implementación |
| Tag previo | `phase-3-v1.0` → `f5d0b10`, sin mover; contiene D-26 como historia |

**D-26 cerrada.** CI exigida sobre el PR #15: `35213354273`, tres jobs en verde. Deuda sin cambio:
D-13, D-18, D-20, D-22, D-23; WATCH-P2-1 heredado. Observaciones OBS-3.1-01 (Vercel sin clave de
servidor), OBS-3.1-02 y OBS-3.1-03. PRODUCTION **pausado** y sin tocar; el despliegue de
Production que inició el merge quedó **cancelado**. Phase 4 y las decisiones H-P4-1 … H-P4-7
**siguen sin autorizar**.


---

## 16. Phase 4A · Planner Domain / Decision Engine · aterrizaje de gobernanza · 2026-09-17

**Solo gobernanza. El BUILD de Phase 4A no está autorizado.** Ninguna tabla, ninguna migración,
ninguna función, ningún grant, ningún paquete y ninguna ruta cambian con este aterrizaje. La
selección visible para la persona sigue siendo `fps-fixed-v1`.

Línea base: `main` = `7cf9190726f9f4edd8f41998acc6fee8792a2d3a`, sobre `phase-3-v1.1` →
`577cc711e017f1fb48ba881ea34288d865317429`.

### 16.1 · Qué queda aceptado

> **Aterrizaje y P4-D6 · 2026-09-19.** La gobernanza de Phase 4A se integró en `main` (PR #17 →
> `3a8025f`, árbol idéntico al candidato aceptado `8653663`). Al abrir el BUILD, antes de escribir
> código, se comprobó que la clave de P4-D5 no existía en ninguna fuente que el Planner pudiera
> leer. **P4-D6 · opción A**: el Learning Engine la proyecta como `last_negative_position` —posición
> de stream del intento elegible no correcto más reciente—, definida en el anexo v1.1 §25 de su
> contrato. Hay un solo pliegue autoritativo de evidencia; el Planner nunca lo reimplementa.

> **P4-D5 · 2026-09-19.** Ana eligió la **última evidencia negativa** como clave de orden de la
> reparación: solo la evidencia mueve la clave, y leer una reparación sin comprobarla no la rebaja.
> Con P4-D3, P4-D4 y P4-D5 tomadas, el algoritmo queda completamente determinado y el contrato pasa
> a **v1.3 `ACCEPTED`** dentro del candidato. **Gate A = PASS.** **Gate B no se abre**: el
> repositorio exige que la gobernanza se integre en `main` antes de que la rama de BUILD parta de
> `main`, como en Phase 2 (PR #6), FPS (PR #9) y Phase 3 (PR #12). Nueva observación **OBS-4A-05**:
> quien abandona repetidamente una reparación la verá otra vez; si eso es un problema, se resuelve
> en la experiencia de 4B, no en la clave.

> **Gate A · 2026-09-18.** **P4-D3** queda `ACCEPTED` como **granularidad híbrida** —`APRENDER`
> puede planificarse solo para `NEW`, porque `EXPOSED` ya representa el bucle abierto; la
> reparación sigue siendo atómica y **no se inventa** ningún estado intermedio— y **P4-D4** queda
> `ACCEPTED` como **`EXPOSED` primero**, precedencia categórica sin pesos ni cuotas. La prueba
> residual B **cierra**: `skip-non-fitting` es única. La prueba residual A **no cierra**: ampliada
> la familia de políticas, la vivacidad elimina cinco y deja **dos** no equivalentes —última
> evidencia negativa frente a último contacto real—, que divergen ante contacto sin verificación.
> Se abre **P4-D5**, el contrato pasa a **v1.2** y sigue `PROPOSED · BLOQUEADO`. **Gate A = FAIL:
> no se ha construido nada.**

> **Corrección del 2026-09-17 · validación adversarial.** La revisión independiente encontró dos
> defectos reales en el candidato v1: **IR-P4A-01** —una recomendación emitida contaba como
> respuesta a la reparación, de modo que cerrar la aplicación sin hacer nada retiraba evidencia
> negativa de la presión del Planner— e **IR-P4A-02** —la atomicidad de la acción estaba
> sobreafirmada—. Los dos se aceptan. La validación demuestra además que **las siete cláusulas de
> P4-D1 no determinan un algoritmo único**: quedan abiertas **P4-D3** (granularidad de la acción) y
> **P4-D4** (orden entre `EXPOSED` y `NEW`). El contrato pasa a
> **`PROPOSED · BLOQUEADO POR DECISIÓN HUMANA`** y **ninguna Build Authorization de Phase 4A puede
> emitirse** hasta resolverlas.

| Artefacto | Estado |
| --- | --- |
| `docs/PLANNER_CONTRACT.md` v1.3 | **`ACCEPTED`** en candidato · P4-D3, P4-D4 y P4-D5 cerradas · pendiente de aceptación independiente e integración en `main` |
| ADR-012 · autoridad de decisión del Planner | **`ACCEPTED · v1.0`** · **`IMPLEMENTED`** (congelada en `phase-4a-v1.0`; antes `AUTHORIZED` y `NOT IMPLEMENTED`) |
| `docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md` | copia aceptada de la autorización |
| SD-030 y SD-031 | adenda del `SPEC_DIFF_LOG` |
| P4-D1 | **aprobada con modificación** · composición categórica equilibrada |
| P4-D2 · origen de los minutos planificados | **diferida** a una decisión previa a Phase 4B |
| H-P4-0 | **resuelta por Phase 3.1** |

### 16.2 · El modelo aceptado

La selección es **categórica y determinista**, nunca numérica: no hay puntuación de dominio, ni
`priority_score`, ni pesos, ni proxy de readiness. Las necesidades se derivan del vocabulario del
Learning Engine y se componen con **una garantía existencial de reparación** en la cabeza del
plan y **continuidad de cobertura** en el resto; la reparación solo desborda una vez agotada la
cobertura. El desempate es lexicográfico sobre datos estables de contenido, comparados por punto
de código.

La única cantidad que aparece —una acción de reparación— es la **aridad de una garantía
existencial**, no una proporción elegida: no hay ratio, porcentaje, cuota, longitud de ciclo,
constante de alternancia ni azar, y `planner_config` tiene prohibido contenerlos. La derivación
completa, con su red team de quince escenarios, está en
`docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md` §6.

`EVIDENCE_POSITIVE` **no es elegible** en v1 y no se recicla: sin modelo de retención,
decaimiento, espaciado o estabilidad, el Planner carece de autoridad para programar su revisión.
El agotamiento honesto se expresa como `NOTHING_ELIGIBLE`, que **nunca** significa preparación,
dominio permanente ni fin del aprendizaje. Y el Planner **no fabrica actividad** para evitar un
plan vacío: un plan no vacío no es un invariante de producto.

### 16.3 · Fronteras que este aterrizaje fija

- **Frescura del motor:** una petición de plan no planifica desde una proyección que se sabe
  atrasada. Puesta al día **bloqueante** por la frontera gobernada de Phase 3.1 y, si falla,
  `PLAN_UNAVAILABLE_ENGINE` sin escribir ejecución. Sin degradación silenciosa a `fps-fixed-v1`.
- **Seguridad:** el cálculo vive en un paquete puro de servidor y la persistencia en una función
  de rol de servicio. **Un plan es una decisión que el cliente no puede redactar**, así que la
  superficie de RPC invocable por el cliente **permanece en dos**. Tablas en `public` con RLS
  forzado más una tabla de auditoría sin concesión a roles de cliente: **ningún esquema privado
  nuevo**, y ADR-011 no se amplía.
- **Prueba en la frontera real de runtime (P4-G16):** consecuencia directa de D-26. Un arnés SQL
  equivalente es complementario y no suficiente.

### 16.4 · Observaciones y vigilancia nuevas

| ID | Contenido |
| --- | --- |
| **OBS-4A-01** | Con un presupuesto que solo admite una acción muy corta, una disponibilidad declarada permanentemente mínima avanza poco o nada. Consecuencia veraz de las invariantes aceptadas; su severidad depende de **P4-D3** y de **P4-D2**. Se registra, no se resuelve inventando |
| **OBS-4A-03** | El Planner deja minutos sin usar cuando la acción más prioritaria no cabe y las siguientes tampoco. Es el precio de no optimizar, y es deliberado (gate P4-G22) |
| **OBS-4A-05** | Con P4-D5, quien abre una reparación, la lee y la abandona sin comprobar la verá ofrecida otra vez, porque leer no mueve la evidencia. Es la consecuencia deliberada de que la presentación no cuente como progreso. Si resulta un problema de producto, se resuelve en la experiencia de 4B, **no** cambiando la clave de orden |
| **OBS-4A-02** | Con `EVIDENCE_POSITIVE` excluida y sin política de repaso, una persona con evidencia positiva en todo su pack alcanza `NOTHING_ELIGIBLE` de forma permanente. Consecuencia aceptada de P4-D1.4 y DEF-28 |
| **WATCH-4A-1** | Contenido retirado dentro de una sesión ya abierta falla hoy en silencio. **No es asunto de Phase 4A**: es consumo de sesión, y corresponde a Phase 4B. Phase 4A no toca la semántica de sesión de Phase 2 |

Los cuatro tipos de evento del enum sin contrato de campos quedan dispuestos:
`TODAY_OVERRIDE_SET` **diferido a 4B**; `RESCUE_MODE_ENTERED`, `REPLAN_CONFIRMED` y
`RECOVERY_STARTED` **no se emiten**, porque su criterio no existe en Phase 4A. No se inventa
ningún contrato por el mero hecho de que el enum exista (gate P4-G17).

**OBS-3.1-01** pasa de observación a **prerrequisito con milestone nombrado**: el BUILD de
Phase 4A en local, CI y STAGING no necesita ningún cambio en Vercel, pero un recorrido humano
sobre un Preview desplegado de Phase 4B sí exigirá autorización humana explícita para la
credencial de servidor. Este aterrizaje **no** la concede, no cambia Vercel y no pide ni imprime
ninguna credencial.

### 16.5 · Estructura de entrega

`PHASE 4A` → congelación → **milestone de Producto · UX / Diseño visual** → autorización
explícita de credencial en Preview cuando haga falta → `PHASE 4B`. La congelación de 4A produce
**cero cambio visible de selección**, y el milestone de UX diseña contra estados congelados y
reales del Planner en vez de inventar semántica.

### 16.6 · Lo que sigue sin autorizar

BUILD de Phase 4A · esquema · migraciones · dependencias · mutación de STAGING · cambios en
Vercel · credenciales · Phase 4B · ejecución del milestone de UX · la decisión P4-D2 · Phase 1B ·
corpus oficial · readiness · PRODUCTION · AQUO.

## 17. Phase 4A · BUILD · FROZEN · PASS WITH DEBT · 2026-09-19

**PHASE 4A · FROZEN · PASS WITH DEBT.** Aceptada por Ana tras revisión independiente del candidato
`120d166` (árbol `ea6a228a45d661ca1e89bdf8afee37dd8907c5b6`); integrada por el PR #19 (merge
`5a8f6038537fc8fce5dc092ec472ec4b2a418f91`, árbol idéntico) y etiquetada con el tag anotado
`phase-4a-v1.0` (objeto `dd78090f586caef15b196d5a5ec3faf9af650592`). OBS-4A-B1, B2 y B4 cerradas;
OBS-4A-B3, B5 y B6 viajan; D-13, D-18, D-20, D-22, D-23, WATCH-P2-1 y OBS-3.1-01 heredadas sin cambio.
P4-D2 sigue diferida. **Phase 4B no está autorizada.** Registro completo en el checkpoint §P.


Construido en `phase/4a-planner-domain` desde `a96cafc` por la autorización de P4-D6 y del BUILD
completo de Phase 4A. Como candidato no tuvo merge, tag ni congelación; los tres llegaron el
2026-09-19 (párrafo anterior). Detalle y gates en
`docs/PHASE_4A_CHECKPOINT.md`.

| Pieza | Estado |
| --- | --- |
| Migración 22 · `last_negative_position` (P4-D6) | aplicada en STAGING · rollback · EC-006 probado en la frontera real |
| `packages/planner-engine` | Planner v1 puro, determinista, sin red ni dependencias |
| Migración 23 · dominio del Planner | aplicada en STAGING · rollback · roundtrip acotado |
| `apps/web/src/server/planner` | módulo real; ninguna ruta lo consume; la selección visible sigue siendo `fps-fixed-v1` |
| P4-D2 | diferida: sin fuente de duración, `DURATION_SOURCE_UNDECIDED` y ninguna escritura |
| Zona horaria | `profiles.timezone` declarada por la persona (CDEM §3), IANA, nunca deducida ni rellenada |

Decisiones humanas del 2026-09-19, aplicadas: **OBS-4A-B1** (`NO_PUBLISHED_UNIT` ratificado),
**OBS-4A-B2** (como mucho una sesión abierta por persona, global, tras el análisis EC-019 en
`docs/PHASE_4A_EC019_SESSION_INVARIANT.md`) y **OBS-4A-B4** (errata E-P4A-1 del contrato del
Planner). OBS-4A-B3, B5 y B6 siguen como vigilancia u observación.
Lo que sigue sin autorizar: Phase 4B, P4-D2, Phase 1B, corpus oficial, readiness, PRODUCTION,
Vercel Production y AQUO.

## 18. Product UX · Waves 1–3 · y pre-autorización de Phase 4B · 2026-09-20

**Aterrizaje documental. El BUILD de Phase 4B sigue sin autorizar.** Nada de esta sección crea
esquema, migraciones, runtime ni dependencias, y nada muta STAGING, PRODUCTION ni Vercel.

### 18.1 · Qué queda aceptado

| Decisión | Estado |
| --- | --- |
| **Product UX · Waves 1–2 (Revisión 1) y Wave 3** | **`ACCEPTED`** · revisión independiente sobre los artboards renderizados · `docs/PRODUCT_UX_CONTRACT.md` v1.0 |
| **P4-D2** · origen de la duración | **`ACCEPTED`** · híbrida · propietario normativo **ADR-013** |
| **P4B-D1** · `NOTHING_FITS` | **`ACCEPTED`** · no se ofrece la acción fuera de presupuesto |
| **P4B-D2** · salida anticipada y consumo de ejecución | **`ACCEPTED`** · B2-a · enmienda acotada de §O |
| **P4B-D3** · override del mismo día | **`ACCEPTED`** · tabla canónica más evento, escritura solo de servidor |
| **R-8** · `AVAILABILITY_CHANGED` | **cerrada** en semántica de gobernanza |
| **SD-019** | **`ACCEPTED`** · opción C, con **AA-1** registrada |
| **Q-1 … Q-6** | dispuestos: Q-1 cerrado por P4B-D2; Q-3 pasa a **INV-117** |
| **R-1 … R-6** | reconciliados; CDEM §17 deja de tener campos sin disposición (SD-038) |

Registro completo en `docs/PHASE_4B_PREAUTHORIZATION.md`; entradas SD-033 … SD-039, la aceptación
de SD-019 y la errata **E-P4B-1** en `docs/SPEC_DIFF_LOG.md`.

### 18.2 · El modelo de producto, en cinco frases

HOY es **la decisión de hoy** y el único destino: no se monta el shell de los cinco espacios porque
tres de ellos no tienen capacidad, y afirmarlos sería lo que EC-012 prohíbe. La unidad de trabajo
que percibe la persona es **la acción**, no el ítem, de modo que una reparación atómica es una sola
acción repartida en dos rutas. El inventario de estados no se copia de ningún recuento histórico:
se **deriva** de las salidas reales del servidor, y son **21**. Cada frase de la interfaz es
atribuible a exactamente uno de **cinco niveles de verdad**, y lo que el sistema infiere solo puede
aflorar como **acción más razón**, nunca como afirmación sobre la persona. El vacío veraz —
`ZERO_TIME`, `NOTHING_FITS`, `NOTHING_ELIGIBLE` — se dibuja como producto y no como error, y
`NOTHING_ELIGIBLE` **no lleva ninguna acción**.

### 18.3 · El sistema visual, y por qué es apropiable

Dirección **L2 · System Intelligence**, derivada de B+. Principio normativo: **cuando el aprendiz
estudia, STUDY OS se retira; cuando STUDY OS decide o adapta, se hace perceptible.**

Lo propio no es la paleta ni el logotipo: es la gramática. Una **espina de sistema** neutra en
reposo que ancla lo que el sistema decide y da continuidad entre estados; una **superficie de
decisión anclada** a ella, con radio solo a la derecha, que dice que el objeto lo produjo el
sistema; **dos voces tipográficas** que hacen visible la autoría en un fotograma quieto; y una
**actividad adaptativa temporal**, que es la parte más fuerte y la que menos dura.

**Firma adaptativa AS-2 · solo activo**, con una consecuencia de gobernanza que vale la pena
registrar: al hacer el teal **raro** se volvió innecesaria la ampliación semántica que se había
propuesto para él. El teal conserva **un solo significado** —STUDY OS está actuando— y la
existencia de una decisión válida se comunica **estructuralmente**. Un gesto de diseño cerró a la
vez un problema de diseño y uno de gobernanza.

**L3 · Frontier no se selecciona.** Su valor es haber fijado la frontera, que quedó enunciada:
STUDY OS deja de ser Calm Intelligence en cuanto una señal del sistema permanece cuando el sistema
no hace nada, ocupa espacio que pertenece a la lectura, o empieza a medir algo.

Tipografía **IBM Plex Sans**, una sola familia, sin serif para LEER. **Wordmark de producto v1:
W1**, y **la identidad externa definitiva queda explícitamente diferida y no bloquea Phase 4B**.

### 18.4 · Invariantes y gates nuevos

**INV-117** · la versión de unidad y la representación de pregunta que el Planner selecciona son
las que se presentan. **INV-118** · un tipo de evento cuya autoridad de producción es el servidor
no es emitible por un cliente. **UX-INV-1 … UX-INV-24** como criterio de aceptación mecánico de la
experiencia. **P4-G24 … P4-G38**, con P4-G18 heredado y **P4-G35** como QA de diseño y
accesibilidad, que incorpora la validación de **presencia en escritorio**: el objeto de producto no
puede leerse como una aplicación de tamaño móvil flotando en un monitor grande.

### 18.5 · Observaciones nuevas

| Id | Contenido |
| --- | --- |
| **OBS-4B-01** | Arrancar y terminar repetidamente genera una sucesora por ciclo. Cada ciclo exige dos actos deliberados y cada ejecución es historia inmutable. No se inventa caducidad temporal, que §Q.2 prohíbe |
| **OBS-4B-02** | Corregir una duración equivocada acuña una versión nueva de unidad, porque una versión publicada es inmutable. Coste directo de «fijada a la versión exacta»; acotado, porque las ejecuciones pasadas conservan sus minutos congelados |
| **OBS-4B-03** | SD-019 opción C es autoridad desde hoy, pero `packages/design-system/src/status.ts`, `tokens.ts` y `designSystem.blocked.spec.ts` siguen diciendo que B y C están diferidas. Un aterrizaje documental no muta en silencio código que vigila una fase congelada: se corrige en el primer acto de implementación autorizado, con su prueba, en el mismo commit |

### 18.6 · Dos hallazgos mecánicos que conviene no perder

**La reproducibilidad de las duraciones ya estaba garantizada.** Los minutos de cada candidato son
campos de `PlannerInput`, y la entrada canónica de cada ejecución los congela con su hash. Ninguna
reproducción consulta jamás una fuente de duración, así que cualquier mecanismo futuro —incluida
una fuente aprendida— es aditivo por construcción. Se verificó en vez de diseñarse.

**La consecuencia de INV-117 es minúscula.** Basta con que el arranque de sesión copie las dos
identidades que hoy descarta: el trigger de fijación única ya las congela y **las comprobaciones de
igualdad que la frontera de eventos ya tiene se convierten en la guarda**, sin escribir ninguna
comprobación nueva.

### 18.7 · Lo que sigue sin autorizar

BUILD de Phase 4B · esquema · migraciones · dependencias · mutación de STAGING · cambios en Vercel ·
credenciales · el prerrequisito OBS-3.1-01 · Phase 1B · corpus oficial · readiness · PRODUCTION ·
infraestructura de pago · AQUO · y la identidad externa de marca, que queda diferida y **no
bloquea** Phase 4B.
