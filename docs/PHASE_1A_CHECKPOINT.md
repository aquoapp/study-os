# STUDY OS · Checkpoint de Phase 1A · Canonical Domain Foundation

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 1A · Canonical Domain Foundation
BRANCH: phase/1a-canonical-domain-foundation (parte de main = e5fc785f86470f0da6fc533b266ab5fba7d19ecd)
COMMIT/TAG: el HEAD de la rama es el commit que contiene este checkpoint, la migración 14 y las pruebas adversariales; el bundle de auditoría lo describe · SIN MERGE · SIN TAG
STATUS: PASS WITH DEBT
```

**Segunda emisión · 2026-09-09 · tras la auditoría adversarial.** La primera emisión
(`67fb950` … `4656652`) cerró el BUILD autorizado por Ana Victoria el 2026-09-09
(`STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md`, SHA-256
`806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4`, copiado con cabecera de
aceptación en `docs/PHASE_1A_AUTHORIZATION_PACKET.md`). Esta segunda emisión es el resultado
de la **Phase 1A Forensic Acceptance & Hardening** ordenada el mismo día: reconstrucción
independiente del estado, forense del catálogo real de STAGING, campaña de ataques contra
INV-101, la inmutabilidad, la procedencia y la frontera de ingestión, revisión de las
pruebas y de la deuda D-17/D-18/D-19. Encontró **defectos reales de enforcement** dentro de
la arquitectura aceptada; todos se repararon en la rama con una migración aditiva (14) y
pruebas de regresión que atacan, no que describen. Ningún hallazgo fue un fallo duro:
ninguna clave fue legible, ninguna ruta de cliente alcanzó `content` ni `ingest`, PRODUCTION
no se tocó. La rama **se detiene aquí**: sin merge, sin tag `phase-1a-v1.0`, sin Release;
Phase 1B, Phase 2 y FPS no han empezado. La aceptación es humana.

---

## Por qué PASS WITH DEBT

Los diez gates P1A-G1 … P1A-G10 están en **PASS**, reevaluados tras la auditoría con la
clasificación de prueba que exige la operación (mecánicamente probado, fuertemente
evidenciado, documental). Ningún gate está BLOCKED; no hubo fallo duro. El `WITH DEBT`
procede únicamente de deuda técnica registrada, nunca de una decisión de dominio pendiente:

| Deuda | Estado |
| --- | --- |
| **D-13** · `schema-drift` nivel B exige Docker en local; corre en CI contra el stack local migrado desde cero y contra STAGING real | Heredada · aceptada · evidencia en CI |
| **D-18** · Las pruebas de catálogo lanzan el CLI fijado de Supabase por consulta (≈1,7 s cada una; la suite de integración tarda ≈4 min contra STAGING) para no añadir un driver (Manifest §7) | Retenida con medida · revisar en Phase 2 |
| **D-20** · `source_versions.storage_path`, `checksum` y `retrieved_at` son legibles por `authenticated` (política `status <> 'DRAFT'`, CDEM §22): hoy no existe ninguna fuente oficial, pero en Phase 1B la ruta de custodia privada no debe salir por el Data API | Nueva · sin efecto en 1A · **bloquea la primera versión de fuente OFFICIAL de 1B** |
| **D-21** · Las transiciones de ciclo de vida (borrador → vigente de una representación, revalidación de un mapeo, retirada, `WITHDRAWN` de una versión de fuente) no tienen función de frontera: hoy son escrituras directas del rol de servicio, que los triggers acotan pero no auditan como promoción | Nueva · aceptable en 1A (no hay contenido real) · **decisión de Phase 1B** |
| **D-04 · D-05 · D-06 · D-07 · D-09 … D-12 · D-16** · sin cambios respecto a Phase 0 | Heredadas |

**Cerradas en esta emisión:** **D-17** (las pruebas negativas ya no dejan promociones
OFFICIAL/VERIFIED en la auditoría de STAGING: atacan dentro de transacciones que siempre se
revierten; queda solo la auditoría GENERATED de los packs purgados, que es veraz, y un
detector de residuo engañoso) y **D-19** (`set_updated_at` sin EXECUTE para roles de
cliente, migración 14).

---

## 0. Secuencia ejecutada

1. **Preflight**: `main` = `a263ec1` limpio, ruleset 22557790 activo sin bypass, PRODUCTION con
   0 tablas, PAT revocado sin sustituto, archivo privado intacto.
2. **Aterrizaje de gobernanza** (C-1 … C-7) en `phase/1a-governance` → CI en verde → PR #3 →
   merge por PR (`e5fc785`). ADR-011 `ACCEPTED v1.0`; anexos v1.1 de ADR-009 y ADR-010
   `ACCEPTED`; SD-020 y SD-021 `ACCEPTED`; ADR-005 con nota de disposición y aún `PROPOSED`.
3. **Rama de build** `phase/1a-canonical-domain-foundation` desde el nuevo `main`.
4. **Implementación** del alcance MUST (`8f130f3`, `394a157`, `e896702`), verificada contra
   STAGING y en CI remoto (run `34297084359`).
5. **Primera emisión del checkpoint** (`67fb950` … `4656652`; CI `34312180106`).
6. **Auditoría adversarial y endurecimiento** (esta emisión): migración 14 aditiva con
   rollback; `tests/integration/phase1a.redteam.spec.ts` y `phase1a.lifecycle.spec.ts`;
   arnés de ataque sin residuo (`attack()`); matriz rol × privilegio derivada del catálogo;
   roundtrip semántico (firma del catálogo idéntica tras up → down → up); regla de guarda
   «toda tabla nace cerrada»; disposición de D-17/D-18/D-19.
7. **Checkpoint** y bundle de auditoría. STOP.

---

## 1. Auditoría adversarial · qué se atacó y qué se encontró

### Superficies

- **Rutas de cliente** (PostgREST, `anon`, `authenticated`, rol de servicio): OpenAPI,
  `Accept-Profile`/`Content-Profile` con esquemas privados, tablas privadas nombradas en
  `public`, embeds hacia `content`, recuentos, filtros malformados, mensajes de error,
  `OPTIONS`, RPC con argumentos correctos, funciones internas de `ingest`.
- **Enforcement de la base** con `attack()`: bloques `DO` ejecutados como propietario
  (sin RLS, sin grants) que terminan siempre en excepción, de modo que solo triggers,
  restricciones e índices pueden detener el ataque y nada persiste.
- **Catálogo real de STAGING** volcado y comparado con la intención de las migraciones:
  esquemas, tablas, columnas, restricciones, índices, triggers, funciones (propietario,
  definer, `search_path`, ACL), políticas, privilegios de esquema y tabla, privilegios por
  defecto, tipos, roles.

### Defectos encontrados y reparados (clase A · dentro de la arquitectura aceptada)

| # | Defecto | Invariante | Reparación |
| --- | --- | --- | --- |
| A-1 | `provenance_class` era mutable por UPDATE en `sources`, `exam_occurrences` y `practicals` (y en representaciones no publicadas): una fuente GENERATED podía reclasificarse a OFFICIAL y arrastrar sus versiones | PI-1A-4 · EC-008 | Trigger `reject_provenance_class_change` en las cuatro tablas (migración 14) |
| A-2 | `ingest.promotions.promoted_by` e `ingest.staged_items.received_by` registraban `postgres` (propietario de la función definer) en todas las filas: la auditoría no decía quién promovía | PI-1A-6 | `ingest.actor()` (rol del JWT o usuario de sesión) como default; prueba: `service_role` |
| A-3 | Una promoción cerrada podía reescribirse o borrarse; el rol de servicio tenía INSERT/UPDATE en `ingest.*` sin necesitarlos (las funciones son definer) | PI-1A-6 | Trigger `promotions_immutable`; rol de servicio con SELECT únicamente en `ingest` y `content` |
| A-4 | Una versión de clave admitía UPDATE de `correct_option_id`, `key_status`, reapertura de `effective_to` y DELETE; el rol de servicio tenía DML en `content` | EC-007 · INV-101 | Trigger `answer_key_versions_immutable` (solo cierre; borrado solo en purga); SELECT únicamente |
| A-5 | Los enlaces de supersesión de representaciones admitían ciclos, retrocesos y cruce de preguntas | SD-021 · DI-1A-4 | Trigger `check_representation_links`: misma pregunta, número estrictamente creciente |
| A-6 | `canonical_questions.exam_pack_id` y `exam_packs.slug` (que deriva las `concept_key`) eran mutables | DI-1A-1 · ADR-009 v1.1 §A | Triggers `reject_question_pack_change` y `reject_pack_slug_change` |
| A-7 | El rol de servicio tenía TRUNCATE, REFERENCES y TRIGGER sobre las 23 tablas por los privilegios por defecto de la plataforma; TRUNCATE no dispara los triggers de fila y era una vía de borrado masivo ajena a DI-1A-3 | DI-1A-3 · SI-1A-4 | Revocación y reconcesión exacta del DML declarado; privilegios por defecto de `postgres` en `public` revocados para los tres roles de la API; regla de guarda: toda tabla creada queda con FORCE RLS y sin privilegios de cliente en su misma migración |
| A-8 | `public.set_updated_at` ejecutable por `authenticated` (D-19) | SI-1A-4 | Revocado; un trigger se dispara sin EXECUTE |
| A-9 | `db:roundtrip` definía «catálogo limpio» de forma gruesa (esquemas, tablas, enums) y no comparaba up → down → up | Packet §Q «schema identical» | Firma semántica del catálogo (551 entradas en STAGING) comparada byte a byte; tras revertir, solo las 18 entradas de Phase 0 |
| A-10 | La prueba de «no existe ruta de promoción» era una búsqueda de nombres de función | PI-1A-4 | Ataques de reclasificación por UPDATE en cada tabla con procedencia |
| A-11 | Dos pruebas negativas dejaban promociones OFFICIAL/VERIFIED con destino ya borrado en STAGING (D-17) | Higiene de fixtures | Reescritas como ataques sin residuo; detector de residuo engañoso |
| A-12 | El enlace fila → promoción se comprobaba solo en `concepts` | PI-1A-6 | Comprobación dirigida por el catálogo sobre toda tabla con `promotion_id` |
| A-13 | La denegación de RPC a clientes aceptaba «función no encontrada» por argumentos vacíos | SI-1A-6 | Llamadas con argumentos correctos: `42501` exacto para `anon` y `authenticated` |

### Hallazgos registrados sin reparar (clase B · decisión, o fuera de 1A)

| # | Hallazgo | Disposición |
| --- | --- | --- |
| B-1 | Metadatos de custodia (`storage_path`, `checksum`, `retrieved_at`) legibles por `authenticated` en `source_versions` | **D-20** · decisión de Phase 1B (privilegio de columna o tabla privada de custodia) antes de la primera fuente OFFICIAL |
| B-2 | Sin función de frontera para borrador → vigente, revalidación de mapeo, retirada, `WITHDRAWN` | **D-21** · Phase 1B define las funciones de ciclo de vida con auditoría de promoción |
| B-3 | El grafo de prerrequisitos no impide ciclos (solo autorreferencia y mismo pack); ninguna fuente canónica exige un DAG | Observación para los motores (Phase 3); no se inventa una regla |
| B-4 | `concept_key` exige al menos un carácter latino o dígito en el título: un título íntegramente en otro alfabeto se rechaza | Exam-neutral pero limitado por alfabeto; decisión si llega un pack no latino (DEF-07) |
| B-5 | La comprobación «pack íntegramente GENERATED» de la purga no cuenta las fuentes de las claves ni de las versiones de concepto | Caso límite de fixtures; documentado |
| B-6 | Los privilegios por defecto propiedad de `supabase_admin` en `public` conceden todo a los roles de la API para objetos creados por la plataforma (panel) | EC-011 prohíbe el panel; las migraciones corren como `postgres`; vigilado por la matriz del catálogo |
| B-7 | El OpenAPI de la raíz exige clave secreta en este proyecto (los clientes reciben 401) y, para el servidor, no menciona nada de `content`/`ingest` | Positivo; registrado en la prueba |
| B-8 | `concept_versions` es mutable por el rol de servicio (ninguna fuente exige su inmutabilidad) | Observación · WATCH |
| B-9 | La restricción de marcadores en `presentation_json` mira solo claves de primer nivel | Defensa en profundidad; la corrección nunca vive en `public` |

---

## SPEC REFERENCES

Master Product Specification §§ 6, 7, 9, 10, 17, 18, 30, 31 · Engineering Constitution
EC-001, EC-007, EC-008, EC-009, EC-010, EC-011, EC-018, EC-019, EC-020 · Canonical Data & Event
Model §§ 4, 5, 6, 22, 23 (REQ-B01…B10, REQ-B14, REQ-C13) · Technical Architecture §8 (frontera
del Data API y de ingestión) · ADR-006 · ADR-009 v1.1 · ADR-010 v1.1 · ADR-011 · SD-020 · SD-021 ·
ADR-005 (disposición punto por punto, sigue `PROPOSED`) · Phase 1A Authorization Packet §§ G, H,
I–O, Q, R, S, V.

---

## DELIVERED

| Área | Entregado |
| --- | --- |
| Topología (ADR-011) | Esquemas `content` e `ingest` sin `USAGE` para `anon`/`authenticated`; `public` único esquema expuesto (`config.toml` = registro); guarda estática `private-schema-grant-guard` (paridad de exposición, sin grants ni políticas ni privilegios por defecto para clientes en esquemas privados, y **toda tabla nace cerrada**) |
| Packs y versiones | `exam_packs` (slug inmutable con conceptos), `exam_pack_versions` |
| Jerarquía | `syllabus_blocks`, `topics` por versión de pack |
| Conceptos (ADR-009 v1.1) | `concepts` con `concept_key` `<slug>-<hash8>` única por pack e inmutable; `concept_versions` con `official_code`; `concept_prerequisites` sobre identidad estable, mismo pack, sin autorreferencia |
| Fuentes | `sources` (clase inmutable), `source_versions` con cadena de supersesión de la misma fuente y sin ciclos; OFFICIAL vigente exige checksum |
| Preguntas (SD-021) | `canonical_questions` (pack inmutable), `question_representations` inmutables una vez publicadas, una vigente por pregunta, supersesión fijada una vez y estrictamente creciente en la misma pregunta; `question_options` inmutables con su representación |
| Mapeos | `question_concepts` por versión de pack, un PRIMARY, `mapping_status`, `copy_forward_question_concepts` con promoción propia |
| Claves (ADR-006 · EC-007 · INV-101) | `content.answer_key_versions`: FK compuestas opción → representación → pregunta, una vigente por pregunta, versiones inmutables (solo cierre), sin DELETE salvo purga; rol de servicio solo SELECT |
| Modelo exam-neutral (ADR-010 v1.1) | `exam_sections`, `exam_sittings`, `exam_sitting_models`, `exam_occurrences` (posición única, una pregunta por modelo, reserva explícita, procedencia obligatoria e inmutable) |
| Prácticos | `practicals` (clase inmutable), `practical_questions` |
| Frontera de ingestión | `ingest.staged_items`, `ingest.promotions` (inmutables una vez cerradas; actor real), `stage_item`, `validate_staged_item` (INV-110 → QUARANTINE), `publish_staged_item` (única ruta de creación canónica), `purge_generated_pack`; wrappers `public.*` SECURITY DEFINER solo para `service_role`, reservados en el registro |
| RLS y grants | 23 tablas con RLS forzado; `authenticated` solo SELECT de lo publicado (+ dos columnas de su perfil); `anon` sin grants; `service_role` exactamente el DML declarado en `public` y SELECT en `content`/`ingest`; sin privilegios por defecto para roles de la API; ninguna función de `public` ejecutable por clientes |
| Reversibilidad | `down/*.down.sql` por migración; `npm run db:roundtrip`: down en orden inverso → catálogo Phase 0 verificado por firma → up → firma idéntica |
| Fixtures | Packs GENERATED sintéticos (`buildSyntheticPack`) construidos y purgados por la frontera; un pack deliberadamente incómodo (una sección, cuatro modelos, dos convocatorias, reservas, 2 y 5 opciones, prerrequisitos en cadena, títulos con acentos) sin cambio de esquema |
| Pruebas | Exposición, catálogo (incluida la matriz rol × privilegio), RLS dirigida por catálogo, fundación, **red team** (42 casos), **ciclo de vida** (12 casos), guarda de esquemas privados |
| Registros vivos | `ARCHITECTURE_STATE` v11.6, `CLAUDE.md`, `README`, `DEPENDENCY_PROPOSAL` (sin dependencias nuevas), este checkpoint |

---

## FILES CHANGED

Respecto a `main` (`e5fc785`):

- **Migraciones nuevas** (todas con rollback, registradas en `.lock.json`):
  `00000000000003_schema_topology` … `13_ingest_boundary` (primera emisión) y
  `00000000000014_phase1a_hardening` (esta emisión), con sus `down/`.
- **Migraciones de Phase 0 (0, 1, 2)**: intactas (`git diff phase-0-v1.0..HEAD` vacío sobre
  ellas y sus `down/`; huellas del lock sin cambio).
- **Herramientas**: `tools/db-roundtrip.mjs` (firma semántica), `tools/guards/private-schema-grant-guard.mjs`
  (regla «toda tabla nace cerrada»), `tools/guards/schema-drift.mjs`.
- **Pruebas**: `tests/integration/{dataApi.exposure, catalog.security, phase1a.foundation, phase1a.redteam, phase1a.lifecycle}.spec.ts`,
  `tests/rls/rls.canonicalContent.userWrite.deny.spec.ts`, `tests/unit/privateSchemaGrant.guard.spec.ts`,
  soportes `tests/support/sql.ts` (`query`, `one`, `attack`) y `tests/support/phase1a-fixtures.ts`.
- **CI**: `.github/workflows/ci.yml` (job de base de datos con `db:roundtrip` y segunda deriva).
- **Registro y configuración**: `packages/domain/src/authority-registry.json` (aterrizado en
  `main`), `package.json`, `supabase/migrations/.lock.json` (15 unidades).
- **Documentación**: `docs/ARCHITECTURE_STATE.md`, `CLAUDE.md`, `README.md`,
  `docs/DEPENDENCY_PROPOSAL.md`, `docs/PHASE_1A_CHECKPOINT.md`.

Sin cambios en `apps/`, `packages/design-system`, `spec/`, ADR ni en el `SPEC_DIFF_LOG`.

---

## MIGRATIONS

Inventario en el árbol (`sha256sum`, coincide con `supabase/migrations/.lock.json` y con
`supabase_migrations.schema_migrations` en STAGING, 15 versiones aplicadas):

| Versión | Fichero | Objetos principales |
| --- | --- | --- |
| 00 · 01 · 02 | `init` · `profiles` · `profiles_service_role` | Phase 0 · intactas |
| 03 | `schema_topology` | esquemas `content`, `ingest`; enums cerrados; `ingest.promotions`; `ingest.purge_in_progress()` |
| 04 | `exam_packs` | `exam_packs`, `exam_pack_versions`; `reject_delete_of_published()` |
| 05 | `syllabus_hierarchy` | `syllabus_blocks`, `topics` |
| 06 | `concepts` | `concepts`, `concept_versions`, `concept_prerequisites`; `reject_concept_key_change()` |
| 07 | `sources` | `sources`, `source_versions`; `check_source_version_chain()` |
| 08 | `questions` | `canonical_questions`, `question_representations`, `question_options`; triggers de inmutabilidad; índice `one_current` |
| 09 | `question_concepts` | `question_concepts`; `ingest.copy_forward_question_concepts` |
| 10 | `answer_keys` | `content.answer_key_versions`; `content.check_answer_key_chain()` |
| 11 | `exam_occurrences` | `exam_sections`, `exam_sittings`, `exam_sitting_models`, `exam_occurrences`; `check_occurrence_provenance()` |
| 12 | `practicals` | `practicals`, `practical_questions`; `check_practical_provenance()` |
| 13 | `ingest_boundary` | `ingest.staged_items`; `stage_item`, `validate_staged_item`, `publish_staged_item`, `purge_generated_pack`, `concept_key`; wrappers `public.*` |
| **14** | **`phase1a_hardening`** | `ingest.actor()`; triggers `promotions_immutable`, `*_provenance_immutable`, `canonical_questions_pack_immutable`, `exam_packs_slug_immutable`, `question_representations_links`, `answer_key_versions_immutable`; revocaciones (D-19, privilegios por defecto, DML del rol de servicio en `ingest`/`content`, extras de plataforma en `public`) |

Disciplina cumplida: aditivas; ninguna migración aplicada editada (la 14 reemplaza defaults
y añade objetos; no reescribe la 13); el lock solo añade unidades; RLS y grants en la misma
migración que cada tabla (ahora también exigido por la guarda); aplicación desde cero en CI
y en STAGING; roundtrip semántico verificado; deriva vacía.

Nota sobre el rollback de la 14: restaura los grants y objetos que las migraciones habían
creado; **no** restaura los privilegios por defecto ni los extras de plataforma
(TRUNCATE/REFERENCES/TRIGGER del rol de servicio), porque su estado previo era de plataforma
y no de migración, y una guarda prohíbe conceder privilegios por defecto a roles de cliente.
La firma semántica del roundtrip excluye por eso los privilegios por defecto y es idéntica
tras up → down → up.

---

## SCHEMA · EXPOSURE · PRIVILEGES

| Esquema | Expuesto | Tablas (RLS forzado) | `anon` | `authenticated` | `service_role` |
| --- | --- | --- | --- | --- | --- |
| `public` | **sí** (único) | 20 · `profiles` + 19 canónicas | nada | SELECT (políticas de publicado; `sources` sin condición por CDEM §22) · UPDATE de columna en `profiles` (`display_name`, `locale`) | SELECT, INSERT, UPDATE, DELETE (sin TRUNCATE ni REFERENCES ni TRIGGER) |
| `content` | **no** | 1 · `answer_key_versions` | sin USAGE | sin USAGE | SELECT |
| `ingest` | **no** | 2 · `staged_items`, `promotions` | sin USAGE | sin USAGE | SELECT |

Funciones de `public` ejecutables por `anon` o `authenticated`: **ninguna**. Las cinco RPC de
la frontera: solo `service_role`, SECURITY DEFINER, `search_path` vacío, reservadas en el
registro. Privilegios por defecto de `postgres` en `public`: ninguno para los roles de la API.
Extensiones: solo las de la plataforma; **sin pgvector**. Registro = `config.toml` = STAGING
(`has_schema_privilege` falso para los roles de cliente en `content` e `ingest`; PostgREST
responde «esquema no expuesto» incluso al rol de servicio).

---

## TESTS

### Recuento verificable

| Suite | Casos | Dónde |
| --- | --- | --- |
| `test:unit` | 663 (31 ficheros) | extracción limpia · CI |
| `test:integration` | 233 (6 ficheros: exposición 9, catálogo 91 incl. matriz 69, fundación 34, red team 42, ciclo de vida 12, perfil 1:1) | STAGING · CI |
| `test:rls` | 107 (perfiles 11; contenido canónico 96 = 1 + 5 × 19 tablas) | STAGING · CI |
| `test:e2e` | 70 estáticos + 16 de auth (limpieza verificada, 0 residuales) | STAGING · CI |
| `guards` | 6 (`import`, `tai-literal`, `client-authority`, `postgrest-provenance`, `schema-drift` nivel A, `private-schemas`) | extracción limpia · CI |
| `db:roundtrip` | 12 migraciones revertidas y reaplicadas con firma idéntica | STAGING · CI |

### Contrato de pruebas (packet §Q) → instancia real

| Categoría | Instancia |
| --- | --- |
| migration | CI `db:reset` desde cero; STAGING `db push`; `schema-drift` A+B |
| reverse migration | `tools/db-roundtrip.mjs` (firma semántica antes → down → solo Phase 0 → up → firma idéntica + historial idéntico) |
| exposure | `dataApi.exposure.spec`; `phase1a.redteam.spec` (descubrimiento, perfiles, embeds, RPC 42501); `privateSchemaGrant.guard.spec` |
| RLS / grants | `catalog.security.spec` (matriz rol × privilegio derivada del catálogo, columnas, políticas, privilegios por defecto, funciones), `rls.canonicalContent.userWrite.deny.spec` |
| constraints · immutability · versioning · provenance · exam-neutral · ingest boundary | `phase1a.foundation.spec`, `phase1a.redteam.spec` (ataques sin residuo por invariante), `phase1a.lifecycle.spec` (historia completa) |
| absence | `sd018.contract.spec`, `adr.acceptedDecisions.spec`, `schema.drift.spec` |
| guards, secrets, drift | sin cambios; `secret-scan` con centinela |
| documentary | `decisionRegister.spec` |

### Ejecutado contra STAGING · en verde (HEAD final)

`db:roundtrip` (semántico) → 0 · `test:integration` 233/233 · `test:rls` 107/107 ·
`test:e2e` 70 + 16 · `verify` 8/9 (el noveno, `schema-drift` nivel B, exige Docker: D-13; en
verde en CI).

### Ejecutado en CI remoto · en verde

Run del HEAD final (citado en la evidencia): **Estático** · **Base de datos** (migraciones
0–14 desde cero, roundtrip semántico, deriva, integración incl. red team, RLS, E2E) ·
**Deriva contra STUDY_OS_STAGING real**.

---

## ACCEPTANCE GATES · reevaluados tras la auditoría

Clasificación: **MP** = mecánicamente probado (prueba ejecutada contra STAGING y en CI) ·
**FE** = fuertemente evidenciado (catálogo o guarda estática) · **DOC** = solo documental.

| Gate | Resultado | Clase | Evidencia |
| --- | --- | --- | --- |
| **P1A-G1** · Topología y exposición | **PASS** | MP | `dataApi.exposure.spec` 9/9; red team: OpenAPI 401 a clientes y limpio para el servidor, `Accept-Profile`/`Content-Profile` privados rechazados, embeds inexistentes, RPC `42501`; `has_schema_privilege` falso; guarda en verde |
| **P1A-G2** · Frontera de claves | **PASS** | MP | Claves solo en `content`; FK compuestas; versiones inmutables (A-4); ninguna columna ni vista de `public` con corrección; opciones sin rastro; recuentos sin fuga; `secret-scan` y bundle limpios |
| **P1A-G3** · Contenido canónico de solo lectura | **PASS** | MP | Matriz rol × privilegio 69/69 desde el catálogo; RLS forzado 23/23; políticas SELECT permisivas a `authenticated`; `anon` sin nada; 96 casos de escritura denegada |
| **P1A-G4** · Identidad de concepto | **PASS** | MP | Convención, unicidad, inmutabilidad de clave, pack y slug (A-6); huella reproducida por una implementación independiente; NFC/NFD idénticos; REQ-B14 con dos versiones (`lifecycle`) |
| **P1A-G5** · Representaciones inmutables | **PASS** | MP | Reescritura por cualquier columna rechazada; opciones intactas; supersesión fijada una vez, sin ciclos ni retrocesos ni cruce (A-5); historia direccionable por fecha |
| **P1A-G6** · Mapeos y prerrequisitos | **PASS** | MP | Un PRIMARY, peso, consistencia de validación, mismo pack; copy-forward con linaje e idempotente; prerrequisitos sin autorreferencia ni cruce (acíclico: B-3, no exigido) |
| **P1A-G7** · Ocurrencias exam-neutral | **PASS** | MP | Posición única, una pregunta por modelo, reserva, procedencia obligatoria e inmutable (A-1), FK compuestas mismo pack; pack incómodo sin cambio de esquema |
| **P1A-G8** · Procedencia e ingest | **PASS** | MP | Clases inmutables (A-1); OFFICIAL exige fuente OFFICIAL (cuarentena y triggers); sin promoción sin ruta ni con promoción falsa; auditoría enlazada en toda tabla (A-12), inmutable (A-3), con actor real (A-2); purga rechazada ante una fila no GENERATED |
| **P1A-G9** · Shell exam-neutral | **PASS** | MP | Guarda `tai-literal`; tres packs sintéticos de estructura distinta sin cambio de esquema |
| **P1A-G10** · Controles de Phase 0 y ausencia de Phase 2+ | **PASS** | MP | Nueve checks (8 en local por D-13, 9 en CI), seis guardas, deriva local y STAGING, lock, roundtrip semántico, PRODUCTION 0 tablas / 0 migraciones, sin objeto de Phase 2+, sin RPC de cliente |

Ningún gate depende de MI-01, MI-04 ni del corpus oficial. Ninguno es solo documental.

---

## SECURITY

- **INV-101**: ninguna ruta de cliente lee, infiere ni descubre corrección: el esquema
  `content` no existe para PostgREST (ni para el rol de servicio por el Data API); las
  opciones no llevan más columnas que las seis declaradas; los recuentos coinciden con las
  opciones; los mensajes de error y el OpenAPI no nombran nada privado. **No hubo ninguna
  exposición, ni siquiera transitoria.**
- **Mínimo privilegio**: `anon` nada; `authenticated` SELECT (+ dos columnas de su perfil);
  `service_role` DML exacto en `public` y SELECT en privados; sin privilegios por defecto;
  ninguna función de `public` ejecutable por clientes.
- **Frontera de ingestión**: única ruta de creación canónica; promociones inmutables con
  actor real; `SECURITY DEFINER` solo en los wrappers y en las funciones de `ingest`, con
  `search_path` vacío.
- **EC-010**: ningún secreto en el repositorio, la conversación, la evidencia ni el bundle.
- **Sin nueva frontera**: ningún esquema añadido a la exposición; ninguna RPC de cliente; el
  registro sin cambios desde el aterrizaje de gobernanza.

---

## INVARIANTS VERIFIED

| Invariante | Cómo |
| --- | --- |
| EC-001 · EC-007 | Sin literal de pack en el shell; claves versionadas e inmutables; corrección = versión nueva |
| EC-008 · INV-110 | Clases NOT NULL e inmutables; OFFICIAL exige fuente OFFICIAL; cuarentena; sin ruta GENERATED → VERIFIED/OFFICIAL (ataques) |
| EC-009 · REQ-C13 · REQ-B10 | RLS forzado 23/23; matriz derivada del catálogo; 96 denegaciones de escritura |
| EC-010 | `secret-scan`, escaneo del bundle, redacción en la evidencia |
| EC-011 | Migraciones con lock, rollback, roundtrip semántico, deriva A+B |
| EC-018 | `tai-literal`; tres packs de estructura distinta sin cambio de esquema |
| EC-019 | Artefactos congelados intactos; ADR sin reescritura; pruebas negativas reforzadas, ninguna debilitada |
| EC-020 | `verify` cuenta el check bloqueado como fallo |
| INV-101 · ADR-006 | Frontera verificada por PostgREST, catálogo y ataques |
| INV-116 | Sin cambios; E2E de auth en verde |
| SI-1A-1 … 6 | Exposición gobernada; esquemas privados inalcanzables; guarda; claves fuera de `public`; RLS forzado; frontera única de creación |
| DI-1A-1 … 7 | Pack estable (pregunta, concepto, slug); prerrequisitos estables; publicado no se borra; representaciones inmutables; una vigente; mapeos por versión; cadena de fuentes de la misma fuente sin ciclos |
| PI-1A-1 … 6 | Clases cerradas e inmutables; fuente OFFICIAL obligatoria; escritura solo por `publish_staged_item`; sin promoción de clase; fixtures GENERATED; auditoría enlazada, inmutable, con actor |
| REQ-B14 | Identidad de concepto estable a través de dos versiones con código oficial distinto |
| SD-021 · ADR-008 (aclaración) | La versión de ítem es `question_representation_id`: la clave la referencia por FK compuesta y nada más lo hace; ocurrencias y mapeos siguen a la pregunta |

---

## SYNTHETIC FIXTURES

| Fixture | Naturaleza | Ciclo |
| --- | --- | --- |
| Packs `fixture-<run>-{a,b,r,s,l}` | GENERATED; fuente GENERATED propia; bloques, temas, conceptos, preguntas, opciones, claves sintéticas, ocurrencias, prácticos | `stage` → `validate` → `publish` por RPC de servicio; `purge_generated_pack` al terminar |
| Pack incómodo `fixture-<run>-r-awk` | GENERATED; una sección, cuatro modelos, dos convocatorias, reservas, 2/5/4 opciones, prerrequisitos en cadena, títulos con acentos y símbolos, sin prácticos | ídem; purgado |
| Filas de pruebas negativas | Existen solo dentro de transacciones que se revierten (`attack()`): fuente que «se declara oficial», borrador VERIFIED, promociones provisionales | **Nunca persisten** |

Todo se ve sintético (`fixture`), no existe `supabase/seed/` con contenido y ningún revisor
podría confundirlo con contenido oficial. Tras la ronda final STAGING contiene 0 packs,
0 fuentes, 0 preguntas, 0 claves y 0 perfiles; y, tras el roundtrip que cierra cada ronda,
0 filas de auditoría.

---

## KNOWN DEBT

| # | Deuda | Resolver en |
| --- | --- | --- |
| D-04 | Familia tipográfica provisional | Al decidirla |
| D-05 | `next-env.d.ts` versionado | — |
| D-06 | Listas espejo TS / `.mjs` | Aceptable |
| D-07 | Restricciones de SD-019 opción A | Antes de Phase 5 |
| D-09 · D-10 · D-11 | Límites documentados de las guardas | Aceptables |
| D-12 | Prerrequisitos de ADR-007 y contrato de canonicalización de ADR-008 | Antes de las tablas de Phase 2 |
| D-13 | `schema-drift` nivel B exige Docker en local | Aceptable · evidencia en CI |
| D-16 | Historia original en el archivo privado | Aceptada |
| D-17 | ~~Filas de auditoría no GENERATED de pruebas negativas en STAGING~~ **Cerrada** en esta emisión: ataques sin residuo; solo queda auditoría GENERATED veraz de packs purgados, que el roundtrip de cierre elimina; detector de residuo engañoso en la suite | — |
| D-18 | Consultas de catálogo por proceso del CLI (≈1,7 s cada una) | Revisar en Phase 2 si el volumen crece; un driver sería una dependencia (Manifest §7) |
| D-19 | ~~`public.set_updated_at` con `EXECUTE` para `authenticated`~~ **Cerrada** (migración 14) | — |
| **D-20** | Metadatos de custodia de `source_versions` legibles por `authenticated` | Antes de la primera fuente OFFICIAL (Phase 1B) |
| **D-21** | Transiciones de ciclo de vida sin función de frontera (borrador → vigente, revalidación, retirada, `WITHDRAWN`) | Phase 1B |

---

## BLOCKED DECISIONS

| ID | Impacto |
| --- | --- |
| Ninguna en Phase 1A | — |

Entradas que solo Phase 1B necesita: el corpus y las claves oficiales, la custodia privada
del contenido (M-1), la lista de campos del contrato de ingestión (ADR-005 pt 6),
`mapping_confidence` (pt 7), D-20 y D-21. Diferidas sin bloquear: SD-019 (antes de Phase 5),
BD-03 y BD-06 (antes de los intentos de Phase 2), la colocación de FPS (hito conceptual).

---

## STOP CONDITIONS · revisión (packet §S y orden de auditoría)

| # | Condición | Resultado |
| --- | --- | --- |
| 1 | Contradicción no registrada | No apareció |
| 2 | Enmienda de ADR ACCEPTED más allá de los anexos v1.1; apoyo en punto PROPOSED | No · ADR-005 solo por su disposición aprobada |
| 3 | Coste, plan, servicio o dependencia nuevos | No · 0 dependencias nuevas |
| 4 | Operación sobre PRODUCTION o despliegue de Production | No |
| 5 | Nueva frontera de seguridad | No · la migración 14 **estrecha** la existente (revocaciones y triggers); exposición y registro sin cambios |
| 6 | Migración destructiva, edición de aplicada, lock alterado | No · aditiva con rollback; lock solo añade |
| 7 | Contenido oficial a punto de entrar | No |
| 8 | Clave legible por un rol de cliente | No, ni transitoriamente |
| 9 | Cambio de semántica de eventos (ADR-008) | No |
| 10 | Cambio de identidad de concepto | No · solo se hace inmutable lo que la derivaba (slug) |
| 11 | Expansión más allá de 1A | No |
| 12 | Guarda o prueba debilitada | No · reforzadas |
| 13 | Prueba que solo pasa saltando | No |
| 14 | Fixture confundible con contenido oficial | No |

---

## ENVIRONMENTS

### STAGING · `xzcrqsolxarutlvvkzfp` · único entorno mutable

15 migraciones aplicadas (`00000000000000` … `14`); 23 tablas con RLS forzado; catálogo
volcado y verificado; 0 contenido canónico tras la purga; al cierre de la ronda, tras el
roundtrip, 0 filas de auditoría; Auth con los usuarios E2E borrados. Todas las operaciones
pasaron por `db push`, `migration repair` y `db:roundtrip` con autorización explícita
`staging:db-roundtrip`. La migración 14 se aplicó, se revirtió con su `down` y se reaplicó
en su forma final antes de la ronda de evidencia.

### PRODUCTION · `nzcgufeycvehczroryoe` · no mutado

Verificado en solo lectura por el conector oficial de Supabase al inicio y al cierre:
`list_tables` → `[]`, `list_migrations` → `[]`, `ACTIVE_HEALTHY`. Ninguna herramienta de la
rama ni de CI conoce su cadena de conexión; `attack()` se niega fuera de local/staging.

### Vercel · proyecto `study-os` · control de releases vigente

Los merges a `main` producen despliegues de Production **CANCELED** por el Ignored Build
Step; el último Production READY es `5d8296c` (Phase 0). Los commits de la rama generan solo
Preview. Sin dominios personalizados; `live: false`.

### GitHub · `aquoapp/study-os` · público

Ruleset `22557790` activo sin bypass (`pull_request`, `required_status_checks`,
`non_fast_forward`, `deletion`). Sin PR abierto. Tag: solo `phase-0-v1.0`. Sin Release.
`aquoapp/study-os-archive-private` privado e intacto. PAT revocado sin sustituto.

---

## REPO HYGIENE · verificación negativa de alcance

| Comprobación | Resultado |
| --- | --- |
| Identificadores de proyectos ajenos en el árbol público | 0 |
| Literal del primer pack en `apps`, `packages`, `tools`, `tests`, `supabase` | 0 (guarda) |
| `OFFICIAL` en migraciones y pruebas | solo como clase de procedencia; ningún contenido |
| `supabase/seed/` | sin semillas |
| Tablas de Phase 2+ | ausentes (`schema.drift.spec`, `adr.acceptedDecisions.spec`, catálogo de STAGING) |
| RPC invocable por cliente · UI · motor · proyección · pgvector · IA · offline/sync | ausentes |
| Secretos en árbol, evidencia y bundle | 0 |
| `.env.example` | todas las claves vacías |

---

## ROLLBACK

Repositorio: la rama puede descartarse sin efecto sobre `main` (`e5fc785`), protegida.

STAGING: `npm run db:roundtrip` con `STUDY_OS_DESTRUCTIVE_AUTHORIZATION=staging:db-roundtrip`
revierte 14 → 3 verificando por firma que solo queda Phase 0 y reaplica; para dejar STAGING
en Phase 0 basta con revertir y `migration repair --status reverted` de 03 … 14. El
rollback de la 14 no restaura extras de plataforma ni privilegios por defecto (ver
MIGRATIONS). PRODUCTION: nada que revertir. Vercel: nada que revertir.

---

## AUDIT BUNDLE

`STUDY_OS_Phase_1A_Audit_Bundle_<HEAD>.zip` = `git archive HEAD` del commit que contiene este
checkpoint, construido dos veces de forma determinista y comparado byte a byte, con
comprobación blob a blob contra `HEAD` y escaneo independiente del contenido extraído. Su
SHA-256 y la salida íntegra de cada comando (extracción limpia, STAGING, CI, PRODUCTION,
Vercel, forense del catálogo) están en `STUDY_OS_Phase_1A_Audit_Bundle_<HEAD>_AUDIT_EVIDENCE.md`,
**fuera del repositorio**, en la carpeta STUDY_OS del escritorio de Ana. El bundle de la
primera emisión (`4656652`) queda obsoleto.

---

## NEXT RECOMMENDED PHASE

**Ninguna se inicia.** El siguiente paso es humano: la aceptación independiente de este
checkpoint por Ana Victoria (y la auditoría cruzada anunciada), y solo después PR → merge →
tag `phase-1a-v1.0`. Phase 1B (corpus oficial), Phase 2 y el hito FPS siguen **no
autorizados**; la arquitectura y el contrato de Phase 1B se proponen fuera del repositorio.

```text
PHASE 1A BUILD COMPLETE · PASS WITH DEBT · READY FOR HUMAN ACCEPTANCE
PHASE 1A ADVERSARIAL AUDIT · PASS WITH DEBT · READY FOR HUMAN ACCEPTANCE
```
