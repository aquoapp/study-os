# PHASE 1A · CANONICAL DOMAIN FOUNDATION · IMPLEMENTATION AUTHORIZATION PACKET

**ACEPTADO · 2026-09-09 · Ana Victoria · Phase 1A Build Authorization.**
Fichero de origen: `STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4` (fuera del repositorio, en la
carpeta STUDY_OS del escritorio). El cuerpo que sigue es el paquete tal como se propuso; las
decisiones C-1 … C-8 quedaron resueltas así: C-1, C-2, C-3, C-4 y C-5 **aceptadas**; C-6
**aprobada como disposición gobernante de Phase 1A** (ADR-005 sigue `PROPOSED`); C-7
**autorizado**; C-8 aprobado **conceptualmente** como hito, sin colocación ni cambios de
frontera. Las líneas «PROPOSED», «NOT AUTHORIZED» y «remaining decisions» del cuerpo son
cronología de la propuesta.

---

STATUS: PROPOSED · governance only · 2026-09-09
PHASE 1A IS NOT AUTHORIZED. Nothing in this packet is accepted until Ana Victoria accepts it explicitly after independent review.
No repository file, branch, tag, migration, Supabase project, Vercel setting, GitHub setting or private content infrastructure was created or modified while producing it.

---

## A · CANONICAL BASELINE

| Item | Verified value (2026-09-09) |
| --- | --- |
| Frozen Phase 0 implementation | tag `phase-0-v1.0` → `5d8296c1776be778b075d9e239b383a0476a6514` |
| `main` | `a263ec184f62ef0e4d82a90722d65e6229323dff` (local = remote); differs from the tag only by `CLAUDE.md`, `docs/ARCHITECTURE_STATE.md`, `docs/PHASE_0_CHECKPOINT.md` |
| Working tree | clean |
| Repository | `aquoapp/study-os` · PUBLIC · ruleset 22557790 active, 0 bypass actors |
| Branches | `main`, `phase/0-foundation`, `phase/0-freeze`; no Phase 1 branch |
| Migrations | 0 init, 1 profiles, 2 profiles_service_role; no domain table |
| Data API exposure | `supabase/config.toml` `[api] schemas = ["public"]`, `extra_search_path = ["public", "extensions"]`; automatic exposure disabled on STAGING and PRODUCTION |
| Supabase | STAGING `xzcrqsolxarutlvvkzfp` only mutable environment; PRODUCTION `nzcgufeycvehczroryoe` 0 tables, non-mutable |
| Governing inputs present | 8 governing documents + control layer verified by hash (`docs/GOVERNING_DOCUMENTS.md`); TAI corpus and Knowledge Engine files NOT in the build environment |
| Phase 0 status | PASS WITH DEBT · debt D-04, D-05, D-06, D-07, D-09, D-10, D-11, D-12, D-13, D-16 |

---

## B · RESOLVED HUMAN DECISIONS (Phase 1A Authorization Packet, architecture only)

| Ref | Decision by Ana Victoria | Effect on this packet |
| --- | --- | --- |
| Split | Phase 1 → **1A Canonical Domain Foundation** and **1B Official Corpus Integration**; 1A must be able to PASS on its own; no renumbering of later phases | G, R, T, F (SD-020) |
| M-1 | Public code repository ≠ private official content source; no corpus, questions, options, keys, practical content or PDFs in the public repository; 1A uses explicitly GENERATED synthetic fixtures; custody mechanism decided before 1B; no private repo or bucket now | G, K, Q, T |
| M-2 | Gates needing real corpus totals, official occurrences, bank completeness, MI-01 or MI-04 move to 1B | R, T |
| M-3 | No topology from a PROPOSED ADR; prepare **ADR-011** with the stated invariants; present for acceptance before any dependent migration | D, J, P |
| M-4 | Published canonical question representations are immutable; corrections create a new representation linked by supersession; evidence resolves to the representation that existed; reconcile with ADR-008 by clarification if possible | L, F (SD-021) |
| M-5 | Stable concept identity exam-neutral and independent of programme numbering; official codes are versioned placement metadata; propose a deterministic convention | M |
| M-6 | Mappings version-scoped to `exam_pack_version`, with explicit copy-forward/revalidation; prerequisites on stable identity; placement separate from identity | N |
| M-7 | Section/model/reserve never global core enums; pack-defined data; minimal model | O |
| M-8 | BD-03 and BD-06 do not gate 1A; prepare the minimum SPEC_DIFF reconciling the Execution Plan with the contradiction register | F (SD-020) |
| M-9 | No wholesale acceptance of ADR-005; point-by-point necessity review; smallest package | E |
| learning_units | not in 1A unless an independently authorized 1A invariant requires it | G (deferred) |
| FPS | define First Product Sight as a planning milestone; recommendation only | U |

---

## C · REMAINING DECISIONS BEFORE BUILD

Minimized to acceptance of governance artifacts drafted in this packet. No technical detail below requires Ana to choose between alternatives; each item is accept / reject / amend.

| # | Decision | Where drafted | Blocks |
| --- | --- | --- | --- |
| C-1 | Accept **ADR-011** (schema topology and exposure boundary) | D | DAG node N0 and every node below it |
| C-2 | Accept **ADR-009 v1.1 annex** (concept-key convention, mapping and prerequisite invariants) | M, N | N3, N6 |
| C-3 | Accept **ADR-010 v1.1 annex** (exam-neutral occurrence dimensions, uniqueness, reserve) | O | N8 |
| C-4 | Accept **SD-020** (Phase 1 split, gate reassignment, BD-03/BD-06/MI-01/MI-04 placement) | F | Phase 1A checkpoint semantics |
| C-5 | Accept **SD-021** (immutable question representations; ADR-008 clarification of "versión del ítem") | F, L | N5, N7 |
| C-6 | Acknowledge the **ADR-005 disposition note** (no acceptance; points subsumed or deferred to 1B) | E | N4, N10 |
| C-7 | Authorize the **governance landing commit**: the accepted artifacts, the revision of the Phase 0 negative tests that encode "not implemented" (`adr.acceptedDecisions.spec` "aceptar no es implementar"), and the seed allowlist of the `tai-literal` guard, landed by PR to `main` before the Phase 1A branch starts | Q | build start |
| C-8 | Separate, non-blocking for 1A: FPS placement recommendation (U) | U | roadmap only |

Required inputs for 1A: none. Required inputs for 1B: MI-01, MI-04, corpus files, custody mechanism (T).

---

## D · ADR-011 PROPOSAL

```text
# ADR-011 · Topología de esquemas y frontera de exposición del Data API

STATUS: PROPOSED · v1.0 (borrador para aceptación humana)
DATE: 2026-09-09
DECISION OWNER: Ana Victoria
SPEC REFERENCES: Technical Architecture v1.0 §5.3, §5.4, §5.5, §10; Canonical Data & Event Model v1.0 §22, §23, §29 (P0-15); Master Product Specification v1.0 §44; Engineering Constitution EC-009, EC-010, EC-011, EC-019; ADR-006 (frontera de claves); INV-101, INV-116; Phase 1A Authorization Packet §4 (M-3)
OWNS: topología de esquemas · lista de exposición del Data API · frontera de ingestión
IMPLEMENTATION STATUS: NOT IMPLEMENTED · no autoriza ninguna migración hasta su aceptación y la autorización de Phase 1A

## Context
ADR-006 exige que las claves de respuesta vivan «fuera de todo esquema expuesto» pero no
fija dónde. TA §5.4 recomienda esquemas lógicos y deja la exposición exacta a la
implementación; ADR-001 (PROPOSED) la fija sin estar aceptado. La lista de exposición es
una frontera de seguridad y hoy solo existe como configuración (`schemas = ["public"]`).
Decisión humana M-3: no implementar topología desde un ADR PROPOSED.

## Decision
1. **`public` es la única superficie expuesta** en Phase 1A y se declara como superficie
   gobernada: contiene los recursos de aplicación (`profiles`) y el contenido canónico
   legible por `authenticated` en solo lectura.
2. **`content` es un esquema no expuesto** para material de corrección: `answer_key_versions`
   y cualquier marcador equivalente de corrección, presente o futuro. Ningún objeto de
   `content` es alcanzable por `anon` ni por `authenticated`.
3. **`ingest` es un esquema no expuesto** para la frontera de ingestión: tablas de staging,
   estado de validación y cuarentena, y las funciones de publicación. Ningún objeto de
   `ingest` es alcanzable por `anon` ni por `authenticated`.
4. **La lista de exposición es explícita, gobernada y probada.** Vive en
   `supabase/config.toml` (`[api].schemas`, `extra_search_path`) para el stack local y en
   la configuración de cada proyecto para STAGING y PRODUCTION. Un test compara la lista
   con la declarada en `packages/domain/src/authority-registry.json` (`dataApi.exposedSchemas`,
   `dataApi.nonExposedSchemas`), y una prueba contra PostgREST verifica que los esquemas no
   expuestos responden con «no existe» o denegación para ambos roles de cliente.
5. **La exposición automática permanece desactivada** en todos los proyectos; los grants
   los dan exclusivamente las migraciones. Ningún `ALTER DEFAULT PRIVILEGES` concede nada a
   `anon` ni a `authenticated`.
6. **Los roles de cliente no tienen `USAGE` sobre `content` ni `ingest`.** `REVOKE ALL` en
   la migración que crea cada esquema; RLS habilitado y forzado en cada tabla de esos
   esquemas como segunda capa; sin políticas para roles de cliente.
7. **El acceso a `content` e `ingest` ocurre solo en contexto de servidor confiable**:
   `service_role` desde herramientas de servidor y CI, o funciones `SECURITY DEFINER` con
   `search_path` vacío, nombres cualificados y `REVOKE ALL … FROM public`, creadas por
   migración y listadas en el registro de autoridad como RPC reservadas cuando sean
   invocables.
8. **Ninguna vista, función o política de `public` puede leer `content` ni `ingest`** salvo
   las funciones de corrección o publicación autorizadas por un ADR aceptado y registradas.
9. **Añadir un esquema a la lista de exposición, o mover un objeto entre esquemas, es un
   cambio de frontera de seguridad** que exige ADR de supersesión o enmienda aceptada
   (EC-019) y actualización del registro y de sus pruebas.
10. **Esquemas futuros previstos y no creados aquí**: `engine` (configuración y funciones de
    motor, Phase 3) y `audit` (registros restringidos de cambio, Phase 10). Su creación
    exige enmienda de este ADR.

### Condiciones de aceptación vinculantes
- la lista de exposición efectiva es exactamente la declarada en el registro;
- `anon` y `authenticated` no alcanzan ningún objeto de `content` ni de `ingest` ni por
  PostgREST ni por RPC;
- ninguna migración concede privilegios sobre `content` o `ingest` a roles de cliente
  (guarda estática sobre el texto de las migraciones);
- ninguna tabla nueva de `public` queda expuesta sin política y grants explícitos;
- la prueba de exposición se ejecuta contra el stack local en CI y contra STAGING.

## Alternatives considered
- Aceptar ADR-001 (content/public/engine/audit) tal cual: rechazado por decisión humana;
  mezcla stack ya vigente por TA v1.0 con topología no aprobada.
- Un solo esquema `public` con RLS de denegación para las claves: rechazado; la exposición
  seguiría siendo una política y no una frontera; un `GRANT` accidental la desharía.
- Tres esquemas no expuestos desde ahora (`content`, `ingest`, `engine`): rechazado;
  `engine` no tiene objeto en Phase 1A y crearlo sería abstracción prematura.

## Consequences
Positivas: INV-101 es una frontera de esquema verificable; la ingestión no puede publicar
por accidente; la lista de exposición pasa a ser código revisado.
Negativas: dos esquemas más y funciones de publicación explícitas; el contenido legible y
sus claves viven en esquemas distintos y la corrección exige una función de servidor.

## Product impact
INV-101, EC-010, Master §44. Afecta a toda superficie futura de CHECK, PRÁCTICO y simulacro.

## Data/migration impact
Primera migración de Phase 1A: `create schema content; create schema ingest;` con
`REVOKE ALL`, sin `default privileges` para roles de cliente; registro actualizado. Sin
backfill.

## Security impact
Cierra la ambigüedad de «fuera de todo esquema expuesto». Mantiene los secretos en
servidor. Una función definer mal escrita sigue siendo el riesgo residual: se exige
`search_path` vacío y revisión.

## Test/acceptance impact
`dataApi.exposureList.spec`, `dataApi.nonExposedSchemas.postgrest.spec`,
`migrations.noClientGrantsOnPrivateSchemas.spec`, `rls.canonicalContent.userWrite.deny.spec`.
Gate P1A-G1.

## Rollback
Reversible mientras `content` e `ingest` estén vacíos (drop schema). Después, exige ADR.

## Human approval
Approved by:
Date:
```

---

## E · ADR-005 POINT-BY-POINT DISPOSITION

| Pt | Content | Required by 1A | Authorized by higher source | Genuinely new | Recommendation | Consequence of not accepting now |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Provenance classes NOT NULL + CHECK; OFFICIAL requires `source_version_id`; quarantine otherwise | YES | YES · EC-001, EC-008, Master §30, INV-110 (approved register), enum already frozen in migration 0 | NO (only the word «cuarentena» as a state name) | implement under EC/INV authority; mark point 1 «subsumido» | none |
| 2 | Authority belongs to the source version; retrieval filters status/vigencia before similarity | partial (status and effective dates on `source_versions`) | YES · Master §30–§31, TA §7.3/§9, CDEM §5, INV-109 | NO | implement the columns under CDEM; retrieval rule is Phase 8 | none |
| 3 | Key lifecycle PROVISIONAL→FINAL→AMENDED; attempt keeps version; amendment creates `attempt_recalculations` | lifecycle YES; attempts/recalculation NO (Phases 2, 10) | YES · Master §18, CDEM §6/§12, EC-007 | NO | implement lifecycle in 1A under EC-007; rest later | none |
| 4 | Keys outside the Data API | — | subordinated to ADR-006 (ACCEPTED) | — | no action | — |
| 5 | `exam_sittings`/`exam_occurrences` | — | superseded by ADR-010 (ACCEPTED) | — | no action | — |
| 6 | Pipeline SOURCE→version→parse→staging→normalize→validate→publish→audit; parsed content never enters published tables; immutable contract fields (`body_code`, `access_type`, `call_id`, `exam_date`, `model`, `part`, `question_number`, `source_url`, `source_hash`) | boundary YES; field list NO | boundary YES · Master §31, TA §8, REQ-B07 (approved); field list only level 6 (LS v0.4) | field list as constraint: YES | 1A builds the boundary under Master/TA; the TAI field list is decided in 1B with the corpus | 1B needs a decision on the field list |
| 7 | Mapping v1.1 marked `PENDING_REVALIDATION`; every published mapping carries `mapping_confidence` and status | status YES (M-6 revalidation state); `mapping_confidence` NO | status: YES · decision M-6 of this packet; `mapping_confidence`: no higher source | `mapping_confidence`: YES | implement `mapping_status` under M-6; leave `mapping_confidence` PROPOSED for 1B | 1B decides whether a confidence value is needed |
| 8 | GENERATED never promotes to VERIFIED in MVP; no promotion route | YES as absence + negative test | partial · Master §29 («invent source authority»), EC-008, AT-17 (level 6) | modest | enforce as «no existe ruta» with a test; no ADR needed | none |
| 9 | Source change → `content_change_events`, `user_recalculation_jobs`, notify only affected | NO (Phase 10) | YES · Master §18/§31, CDEM §20, TA §9 | NO | defer | none |

Smallest package for 1A: **no acceptance of ADR-005**. Add a «Nota de disposición · 2026-09-09» to ADR-005 (same annotation pattern as the 2026-09-07 notes, history preserved): points 1, 2, 3, 6 (boundary), 8 and 9 are implemented only insofar as their higher sources require; point 6 (field list) and point 7 (`mapping_confidence`) remain PROPOSED and are re-examined in the Phase 1B packet. ADR-005 stays `PROPOSED`.

---

## F · REQUIRED SPEC_DIFF PROPOSALS

**SD-020 · División de Phase 1 en 1A y 1B; asignación de decisiones a la fase que gobiernan** (PROPOSED)
- Documents affected: `docs/PHASE_0_EXECUTION_PLAN.md` §7 (frozen; not edited), Manifest §10 Phase 1 (frozen; not edited), `spec/contradiction-register.md` (frozen; not edited). The entry lives in the SPEC_DIFF_LOG adenda and governs operationally.
- Change: Phase 1 = 1A (canonical domain foundation) + 1B (official corpus integration). Manifest Phase 1 gates map as: «invalid answer-key relation rejected» and «normal user cannot mutate canonical content» → 1A; «sample TAI content traceable to source/version» → 1A with GENERATED fixtures for the traceability mechanism, 1B with official content. Decisions and inputs: MI-01, MI-04, REQ-B11/B12/B13/B15 → 1B; BD-03 (confidence scale) → before the attempt migration of Phase 2 and the CHECK UI; BD-06 (official scoring, blank) → before the simulation tables of Phase 6; neither gates 1A or 1B.
- Justification: B-6 and B-7 of the pre-authorization review; decisions Split, M-2, M-8.
- Impact: checkpoint semantics of Phase 1A and 1B; no schema impact.

**SD-021 · Representaciones inmutables de pregunta canónica; aclaración de «versión del ítem» en ADR-008** (PROPOSED)
- Documents affected: CDEM v1.0 §6 (`canonical_questions` carries `stem`; frozen; not edited); ADR-008 (ACCEPTED; clarified, not amended).
- Change: `canonical_questions` becomes the stable semantic identity (pack-scoped, no content); `question_representations` holds the immutable published content (stem, presentation metadata, `representation_no`, `supersedes_representation_id`, `status`); `question_options` belong to a representation. «Versión del ítem» in the ADR-008 hash contract is defined as `question_representation_id`. Historical evidence references the representation shown.
- Justification: decision M-4; EC-007; B-9 of the review. This is a refinement permitted by CDEM §31 (it alters none of the nine protected principles) and a clarification of ADR-008, whose contract requires an item version without defining it. No ADR-008 amendment is needed.
- Impact: nodes N5 and N7 of the DAG; Phase 2 attempts store `question_representation_id`.

No other SPEC_DIFF is required for 1A. The ADR-009 and ADR-010 annexes (M, N, O) are ADR amendments v1.1, not spec changes, because both ADRs reserve those cells as implementation prerequisites.

---

## G · EXACT PHASE 1A SCOPE

MUST BUILD
1. ADR-011 topology: schemas `content` and `ingest`, grants baseline, exposure registry and tests (N0).
2. Pack layer: `exam_packs`, `exam_pack_versions` (N1); a synthetic GENERATED pack pair is the fixture, never TAI data.
3. Versioned hierarchy: `syllabus_blocks`, `topics` (N2).
4. Concept identity: `concepts` (stable, key convention M), `concept_versions` (placement and representation), `concept_prerequisites` (stable ids) (N3).
5. Sources: `sources`, `source_versions` with status, effective dates, checksum, supersession (N4).
6. Question model: `canonical_questions` (identity), `question_representations` (immutable), `question_options` (per representation) (N5).
7. Mappings: `question_concepts` version-scoped with `mapping_status` and copy-forward function (N6).
8. Answer keys in `content`: `answer_key_versions` with lifecycle, same-representation constraint, deny policies (N7).
9. Exam-neutral occurrence model: `exam_sections`, `exam_sittings`, `exam_sitting_models`, `exam_occurrences` (structure only, no official rows) (N8).
10. Practicals: `practicals`, `practical_questions` (structure only) (N9).
11. Ingest boundary in `ingest`: staging tables, validation and quarantine states, publish functions that are the only write path into published tables, promotion audit rows (N10).
12. Security posture on every exposed canonical table: `SELECT` for `authenticated` where the CDEM §22 matrix allows, no writes, `anon` denied; RLS enabled and forced everywhere; explicit grants only.
13. Provenance enforcement: `provenance_class` NOT NULL on every content table; OFFICIAL requires `source_version_id`; no GENERATED→VERIFIED route.
14. Test contract Q; documentary updates (living registers, checkpoint); migration hygiene (reverse scripts, lock, drift on STAGING).

MAY BUILD
- `concept_lineage` (predecessor/successor with relation type), empty, for ADR-009 point 7; additive later is equally safe.
- Synthetic fixture generator for tests (two GENERATED packs, a few concepts, questions, representations, keys, sittings) living in `tests/support`, clearly labelled, never resembling official content.

OUT OF SCOPE
- Learning Engine, Planner Engine, mastery/readiness projections, evidence stream, sessions, attempts, grading behaviour, client content surface, product UI, admin UI, PRODUCTION mutation, private content infrastructure, `learning_units`, AI, offline, `source_chunks`.

DEFERRED TO 1B
- TAI pack, version, blocks, topics, sections and models seed; official questions, representations, options, keys, sittings, occurrences, practicals; ingestion contract field list (ADR-005 pt 6); `mapping_confidence` (pt 7); MI-01, MI-04; REQ-B11, B12, B13, B15; content custody mechanism; official-count gates.

DEFERRED TO LATER PHASES
- `learning_units` (first needed by FPS/Phase 2 session items), `attempt_recalculations` (Phase 2/10), `content_change_events` and `user_recalculation_jobs` (Phase 10), `engine` and `audit` schemas (Phases 3, 10), `source_chunks`/pgvector (Phase 8), BD-03 (Phase 2 attempts), BD-06 (Phase 6).

---

## H · EXPLICIT PROHIBITIONS (Phase 1A)

- No official TAI corpus, questions, options, keys, practical content, syllabus seed or PDFs in the repository, in fixtures, in CI artifacts or in evidence.
- No table, function or column of Phases 2–11 (the `sd018.contract.spec` prohibitions remain and are extended to `study_sessions`, `session_items`, `learning_units`, `concept_mastery`, `exam_readiness`, `planner_*`).
- No grading function, no client-callable RPC, no read surface, no UI, no admin route.
- No write to PRODUCTION; no Vercel Production deploy; no change to the ruleset, the nine checks or the guards beyond the authorized revisions of C-7.
- No new dependency with architectural impact without a Manifest §7 report.
- No edit of an applied migration; no lock rewrite other than adding new units through `schema-drift:lock` with a reviewed diff.
- No global enum with pack-specific values; no `TAI` literal outside data.
- No schema added to the exposure list; no grant to client roles on `content` or `ingest`.
- No mutation of frozen `spec/` files or frozen bodies; all changes by adenda or by new artifacts.
- No AQUO access of any kind.

---

## I · DOMAIN INVARIANTS

| ID | Invariant | Enforcement |
| --- | --- | --- |
| DI-1A-1 | Every canonical row belongs to exactly one exam pack; cross-pack references are impossible | composite FKs `(id, exam_pack_id)` on `concepts`, `canonical_questions`, `exam_pack_versions`; CHECK-backed |
| DI-1A-2 | Hierarchy is version-scoped: block → version, topic → block, concept placement → topic through `concept_versions` | FKs; `(exam_pack_version_id, code)` unique for blocks; `(block_id, code)` unique for topics |
| DI-1A-3 | Canonical content is never hard-deleted once published; retirement is a state | `status` with closed values; trigger rejecting DELETE on published rows; no DELETE policy |
| DI-1A-4 | Exactly one current published representation per question | partial unique index on `question_representations(question_id) where status = 'PUBLISHED' and superseded_by_representation_id is null` |
| DI-1A-5 | Options belong to their representation; option keys unique within it | FK; unique `(representation_id, option_key)`; unique `(representation_id, sort_order)` |
| DI-1A-6 | A concept prerequisite cannot point to itself and stays within the pack | CHECK `concept_id <> prerequisite_concept_id`; composite FK on pack; unique pair |
| DI-1A-7 | Source authority is the version: supersession chain acyclic, effective interval valid | FK `supersedes_version_id`; CHECK `effective_to is null or effective_to > effective_from`; trigger against cycles |
| DI-1A-8 | A second pack loads without schema change | `secondPack.noSchemaChange.spec` with two synthetic packs |
| DI-1A-9 | Status enumerations are closed and pack-neutral | Postgres enums for `content_status` (`DRAFT`, `PUBLISHED`, `RETIRED`), `key_status` (`PROVISIONAL`, `FINAL`, `AMENDED`), `mapping_status` (`VALIDATED`, `PENDING_REVALIDATION`, `REJECTED`), `source_version_status` (`DRAFT`, `CURRENT`, `SUPERSEDED`, `WITHDRAWN`); each value referenced by a governing document or this packet, none exam-specific |

---

## J · SECURITY INVARIANTS

| ID | Invariant | Enforcement |
| --- | --- | --- |
| SI-1A-1 | Exposure list = `public` only; declared in the registry; equal in config and in every project | `dataApi.exposureList.spec`; STAGING check in the checkpoint |
| SI-1A-2 | `content` and `ingest` unreachable by `anon` and `authenticated` | no `USAGE`, RLS forced, no policies; `dataApi.nonExposedSchemas.postgrest.spec` against local stack and STAGING |
| SI-1A-3 | No migration grants anything on `content`/`ingest` to client roles; no `ALTER DEFAULT PRIVILEGES` for them | static guard over migration text |
| SI-1A-4 | Canonical tables in `public`: `SELECT` for `authenticated` only where CDEM §22 allows; no INSERT/UPDATE/DELETE policy or grant; `anon` denied | `rls.canonicalContent.userWrite.deny.spec` per table (generated from the catalog so a new table cannot be forgotten) |
| SI-1A-5 | No exposed column encodes correctness (options, representations, occurrences, `official_reference`) | column-level scan test + review checklist |
| SI-1A-6 | Publish path only through `ingest` functions in server context; functions are `SECURITY DEFINER`, empty `search_path`, `REVOKE ALL FROM public`, not granted to client roles | migration review + `ingest.publishOnlyViaFunction.spec` |
| SI-1A-7 | Service role only in server tooling and CI; never in `apps/web` | existing guards (`secret-scan`, `client-authority`, `auth-authority`) |
| SI-1A-8 | Any table with `user_id` carries RLS + isolation test in the same migration (none expected in 1A; assert absence) | EC-009 test + catalog assertion |
| SI-1A-9 | Security-boundary failure is a hard failure of the checkpoint | Checkpoint Contract |

---

## K · PROVENANCE INVARIANTS

| ID | Invariant | Enforcement |
| --- | --- | --- |
| PI-1A-1 | `provenance_class` NOT NULL on `sources`, `question_representations`, `practicals`, `exam_occurrences`, staging rows | NOT NULL + enum (migration 0) |
| PI-1A-2 | OFFICIAL requires a `source_version_id` whose source is OFFICIAL; otherwise the row cannot be published and stays in `ingest` as `QUARANTINE` | CHECK on published tables; publish function refuses |
| PI-1A-3 | Parsed content never enters a published table except through the publish function | SI-1A-6 |
| PI-1A-4 | No route promotes GENERATED to VERIFIED or OFFICIAL | no function exists; `provenance.noPromotionRoute.spec` |
| PI-1A-5 | Synthetic fixtures are `GENERATED`, carry a `GENERATED` source, and are visibly synthetic (`fixture:` prefix in titles) | fixture generator contract + test |
| PI-1A-6 | Every published canonical row links to the promotion audit row that created it (`ingest.promotions`) | NOT NULL FK from published rows to promotion id, or audit table keyed by target |
| PI-1A-7 | Occurrences and keys carry `source_version_id` NOT NULL | schema |

---

## L · QUESTION-VERSIONING INVARIANT (decision M-4, SD-021)

- `canonical_questions(id, exam_pack_id, question_type, status, created_at)` is the stable semantic identity. It carries no learner-visible content.
- `question_representations(id, question_id, representation_no, stem, official_reference, presentation_json, provenance_class, source_version_id, status, supersedes_representation_id, superseded_by_representation_id, published_at, created_at)` is the immutable published content. `representation_no` increases per question; `supersedes_representation_id` forms an acyclic chain; exactly one current published representation (DI-1A-4).
- `question_options(id, representation_id, option_key, body, sort_order)`; options are part of the representation and immutable with it.
- Immutability: a trigger rejects UPDATE of content columns on rows with `status = 'PUBLISHED'`; only `status` (to `RETIRED`) and `superseded_by_representation_id` may change, and only once.
- Correction path: new representation row → new key version referencing an option of the new representation (same `key_status` unless the official key itself changed) → old representation marked superseded; nothing rewritten.
- Evidence (Phase 2): `question_attempts` stores `question_id`, `question_representation_id`, `answer_key_version_id`.
- ADR-008 reconciliation: «la versión del ítem» = `question_representation_id`; the canonical hash contract includes it by id. This is a clarification: ADR-008's text is satisfied without change. No amendment needed.
- Answer keys reference `(question_id, representation_id, correct_option_id)`; the same-question constraint becomes «the option belongs to the representation, which belongs to the question» (composite FK `question_options(id, representation_id)` + FK `question_representations(id, question_id)`).

---

## M · CONCEPT-IDENTITY INVARIANT (decision M-5, ADR-009 v1.1 annex)

Proposed deterministic convention for `concepts.concept_key`:

- Form: `<slug>-<hash8>`, regex `^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$`, total length ≤ 64.
- `slug`: the concept's creation title normalized (NFKD, diacritics removed, lowercase, ASCII letters and digits, runs of other characters collapsed to `-`), truncated to 40 characters at a word boundary. Human inspectable; never used for identity on its own.
- `hash8`: first 8 hexadecimal characters of SHA-256 over the UTF-8 string `<exam_pack.slug> "\n" <NFC(creation title)>`. Deterministic for the same pack and title; independent of programme codes and ordering.
- Pack scope: unique `(exam_pack_id, concept_key)`; collisions across packs are impossible by scope, and within a pack a same-title concept is by definition the same concept (a genuine duplicate title with different meaning is a content decision recorded in the lineage table, not a key change).
- Immutability: a trigger rejects UPDATE of `concept_key` once the row is `PUBLISHED` or referenced by any FK. `concepts.id` (UUID) is the FK target everywhere; the key is the human-stable identity.
- Exam-neutrality: no programme code enters the key. `concept_versions.official_code` (nullable text) and the topic placement carry the official numbering per pack version.
- Ingestion rule: an ingestion run matches existing concepts by `concept_key` (recomputed from the pack slug and the source title) or by an explicit lineage mapping; it never regenerates keys for existing concepts.
- Tests: `concept.keyConvention.spec` (regex, determinism, normalization cases), `concept.keyImmutable.spec`, `concept.identityAcrossVersions.spec` (REQ-B14 with synthetic packs).

---

## N · MAPPING / PREREQUISITE INVARIANT (decision M-6, ADR-009 v1.1 annex)

- `question_concepts(id, question_id, concept_id, exam_pack_version_id, relationship_type, weight, mapping_status, copied_from_mapping_id, validated_at, created_at)`.
- Uniqueness: `(question_id, concept_id, exam_pack_version_id)`; exactly one `relationship_type = 'PRIMARY'` per `(question_id, exam_pack_version_id)` (partial unique index); `weight` in `(0, 1]`.
- Same pack: composite FKs to `canonical_questions(id, exam_pack_id)`, `concepts(id, exam_pack_id)`, `exam_pack_versions(id, exam_pack_id)` sharing the pack column.
- Copy-forward: server function `copy_forward_question_concepts(from_version, to_version)` inserts rows with `mapping_status = 'PENDING_REVALIDATION'` and `copied_from_mapping_id`; a mapping is usable by later engines only when `VALIDATED`; rejection is a state, not a deletion.
- Resolution rule for evidence (Phase 2+): an attempt resolves its mappings through the `exam_pack_version` current at `client_created_at`, or through the version recorded on the session when sessions exist.
- Prerequisites: `concept_prerequisites(concept_id, prerequisite_concept_id, strength, rationale)` on stable ids, same pack, not self, unique pair. If a canonical source ever demonstrates a version-specific prerequisite, that is a new decision (ADR), not a column.
- Placement stays in `concept_versions(concept_id, exam_pack_version_id, topic_id, title, description, difficulty_hint, official_code, sort_order)` with unique `(concept_id, exam_pack_version_id)` and unique `(topic_id, sort_order)`.

---

## O · EXAM-NEUTRAL OCCURRENCE MODEL (decision M-7, ADR-010 v1.1 annex)

Minimal model, no global enum:

- `exam_sections(id, exam_pack_id, code, title, sort_order)` — pack-defined parts of the exam (TAI rows THEORY, PRACTICAL_I, PRACTICAL_II are 1B data). Unique `(exam_pack_id, code)`.
- `exam_sittings(id, exam_pack_id, sitting_date, call_label, source_version_id, notes, created_at)` — an official call/session. Unique `(exam_pack_id, sitting_date, call_label)`.
- `exam_sitting_models(id, sitting_id, model_code, source_version_id)` — variants of a sitting (A, B). Unique `(sitting_id, model_code)`. Models are rows, never an enum.
- `exam_occurrences(id, sitting_model_id, section_id, question_id, display_no, is_reserve, source_version_id, source_file_ref, created_at)`.
  - Unique `(sitting_model_id, section_id, display_no)` (no duplicate official positions).
  - Unique `(sitting_model_id, question_id)` (a question appears once per model).
  - Same pack: section, sitting and question must share `exam_pack_id` (composite FKs).
  - `is_reserve boolean NOT NULL`; the reserve pool is the section, so THEORY_RESERVE = (section THEORY, reserve true).
  - `source_version_id` NOT NULL (INV-110).
- Answer keys remain per canonical question (representation); the model is provenance metadata (ADR-010 pt 7).
- `practical_questions(practical_id, question_id, sort_order)` unchanged; practical occurrences use the PRACTICAL sections.
- Deliberately not modelled in 1A: per-model key divergence (new decision if evidence appears), scoring (BD-06), simulation (Phase 6).

---

## P · MIGRATION DEPENDENCY DAG (responsibilities; no filenames or numbers assigned)

```text
N0 schemas & exposure ──┬──► N1 packs & versions ──► N2 blocks & topics ──► N3 concepts, versions, prerequisites
                        │                                                              │
                        ├──► N4 sources & versions ──► N5 questions, representations, options ◄─┘
                        │                                   │
                        │                                   ├──► N6 question_concepts (+ copy-forward fn)
                        │                                   ├──► N7 answer_key_versions (content)
                        │                                   ├──► N8 sections, sittings, models, occurrences
                        │                                   └──► N9 practicals
                        └──► N10 ingest boundary (staging, quarantine, publish fns, promotions) ◄── N5…N9
N11 lock, drift, rollback roundtrip, catalog-driven tests, living docs  ◄── all
```

| Node | Why it exists | Authority | Prerequisites | Invariants introduced | Security boundary | Rollback | Tests | Depends on acceptance of |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N0 | non-exposed `content`/`ingest`, grants baseline, closed enums, registry entries | ADR-011; EC-010; TA §5.4 | none | SI-1A-1..3, DI-1A-9 | creates it | drop schemas/enums | exposure, PostgREST negative, static grant guard | **ADR-011** |
| N1 | `exam_packs`, `exam_pack_versions` | CDEM §4, EC-018 | N0 | DI-1A-1, DI-1A-3 | public read-only | drop | read-only tests, second pack | ADR-011 |
| N2 | `syllabus_blocks`, `topics` | CDEM §4, Master §11 | N1 | DI-1A-2 | public read-only | drop | hierarchy test | ADR-011 |
| N3 | `concepts`, `concept_versions`, `concept_prerequisites` (+ optional `concept_lineage`) | ADR-009 + v1.1 annex | N2 | key convention, immutability, placement separation, DI-1A-6 | public read-only | drop | key convention, immutability, REQ-B14, self-prereq | ADR-011, **ADR-009 v1.1** |
| N4 | `sources`, `source_versions` | CDEM §5, Master §31, EC-001; ADR-005 pts 1–2 subsumed | N0 | DI-1A-7, PI-1A-1 | public read-only | drop | supersession, provenance | ADR-011, **ADR-005 disposition** |
| N5 | `canonical_questions`, `question_representations`, `question_options` | CDEM §6 refined by SD-021; Master §17/§18 | N1, N4 | DI-1A-4, DI-1A-5, immutability, SI-1A-5 | public read-only | drop | immutability, single current, no-correctness column, marker scan | ADR-011, **SD-021** |
| N6 | `question_concepts` + `copy_forward_question_concepts` | ADR-009 v1.1 annex; REQ-B06; ADR-005 pt 7 (status only) | N3, N5 | N invariants | public read-only; function server-only | drop | uniqueness, one primary, same pack, copy-forward state | ADR-009 v1.1, ADR-005 disposition |
| N7 | `content.answer_key_versions` | ADR-006; ADR-011; EC-007; Master §18 | N0, N5 | lifecycle, representation-option constraint, deny both roles | content (non-exposed) | drop | cross-question/representation reject, lifecycle, RLS negatives, not-in-Data-API | ADR-011, SD-021 |
| N8 | `exam_sections`, `exam_sittings`, `exam_sitting_models`, `exam_occurrences` | ADR-010 + v1.1 annex | N1, N4, N5 | O invariants, PI-1A-7 | public read-only | drop | uniqueness, reserve, provenance, two-pack neutrality | ADR-011, **ADR-010 v1.1** |
| N9 | `practicals`, `practical_questions` | CDEM §7, Master §19 | N4, N5 | provenance, ordering uniqueness | public read-only | drop | structure tests (official fit → 1B) | ADR-011 |
| N10 | `ingest.*` staging, states, quarantine, publish functions, `ingest.promotions` | Master §31, TA §8, INV-110, ADR-011; ADR-005 pt 6 boundary subsumed | N5–N9 | PI-1A-2..6, SI-1A-6 | ingest (non-exposed); definer functions | drop | staging boundary, contract reject, quarantine, no-promotion route, publish-only-via-function | ADR-011, ADR-005 disposition |
| N11 | lock update per unit, drift on local + STAGING, rollback roundtrip, catalog-driven RLS/grant tests, living registers | EC-011, EC-019, EC-020 | all | — | — | — | Q | C-7 |

Every node ships its `down/` script, its RLS/grants and tests in the same migration (EC-009, B-5), and its lock entry through `schema-drift:lock` with a reviewed diff. All nodes are additive and reversible while `content` holds only synthetic fixtures.

---

## Q · TEST CONTRACT (Phase 1A)

| Category | Proves | Instances |
| --- | --- | --- |
| migration | each node applies from zero in CI and on STAGING | drift A+B, `db:reset` |
| reverse migration | up→down→up leaves the schema identical | `migration.reverse.roundtrip.spec` per node |
| exposure | registry = config = project; non-exposed schemas invisible to both roles | `dataApi.exposureList.spec`, `dataApi.nonExposedSchemas.postgrest.spec`, `migrations.noClientGrantsOnPrivateSchemas.spec` |
| RLS / grants | catalog-driven: every table in `public` has RLS forced, canonical tables read-only, `anon` denied; every `content`/`ingest` table denied; every `user_id` table isolated (assert none exist) | `rls.canonicalContent.userWrite.deny.spec`, `rls.catalogCoverage.spec` |
| constraints | self-prerequisite, same-pack composite FKs, option/representation/question chain, one current representation, one primary mapping, unique positions, reserve, interval validity | per node |
| immutability | published representations and concept keys reject content updates; deletes rejected on published rows | trigger tests |
| provenance | NOT NULL/valid classes, OFFICIAL requires OFFICIAL source version, quarantine, no promotion route, fixtures visibly GENERATED, promotion audit linkage | `provenance.*` specs |
| versioning | REQ-B14 across two synthetic versions; mapping copy-forward state; source supersession | `concept.identityAcrossVersions.spec`, `questionConcepts.copyForward.spec`, `sourceVersion.supersede.spec` |
| exam-neutral | two synthetic packs load with disjoint sections and models and no schema change; `TAI` literal absent everywhere | `secondPack.noSchemaChange.spec`, `tai-literal` guard |
| ingest boundary | parsed rows cannot reach published tables except via the publish function; invalid contract rows rejected and recorded | `ingestion.stagingBoundary.spec`, `ingestion.contract.reject.spec` |
| absence | no Phase 2+ structure; no client RPC; no `learning_units`, `sessions`, `attempts`, events, projections | extended `sd018.contract.spec`, revised `adr.acceptedDecisions.spec` |
| guards, secrets, drift | nine checks and five guards unchanged | existing |
| E2E | none new; static and auth E2E remain | existing |
| documentary | checkpoint, ARCHITECTURE_STATE, SPEC_DIFF adenda consistency | `decisionRegister.spec` extended |

Revisions authorized only through C-7: `adr.acceptedDecisions.spec` prohibits Phase 2+ structures instead of the Phase 1A tables; `tai-literal` guard keeps its allowlist for `supabase/seed/` (unused in 1A because no TAI seed exists).

---

## R · P1A GATES

| Gate | Objective | Evidence | PASS | BLOCKED | FAIL |
| --- | --- | --- | --- | --- | --- |
| P1A-G1 · Topología y exposición | ADR-011 implemented: exposure list governed; `content`/`ingest` unreachable by client roles; no client grants | exposure tests on local stack and STAGING; static grant guard | all green | ADR-011 not accepted | any red · **hard failure** |
| P1A-G2 · Frontera de claves | keys only in `content`; lifecycle; option belongs to representation of the question; no marker in exposed columns; bundle clean | N7 tests, marker scan, secret-scan | green | SD-021 not accepted | red · **hard failure** |
| P1A-G3 · Contenido canónico de solo lectura | every exposed canonical table readable by `authenticated` only where allowed, unwritable, `anon` denied; catalog coverage complete | catalog-driven RLS/grant suite | green on all tables | — | any table uncovered or red · **hard failure** |
| P1A-G4 · Identidad de concepto | key convention, immutability, pack scope, placement separation, REQ-B14 with synthetic versions | N3 tests | green | ADR-009 v1.1 not accepted | red |
| P1A-G5 · Representaciones inmutables | single current representation, supersession chain, immutability, options per representation | N5 tests | green | SD-021 not accepted | red |
| P1A-G6 · Mapeos y prerrequisitos | version scope, one primary, same pack, copy-forward state, prerequisites on stable ids | N6 tests | green | ADR-009 v1.1 not accepted | red |
| P1A-G7 · Modelo de ocurrencias exam-neutral | sections/models as pack data; uniqueness; reserve; provenance; two synthetic packs | N8 tests | green | ADR-010 v1.1 not accepted | red |
| P1A-G8 · Procedencia e ingest | NOT NULL classes, quarantine, publish-only-via-function, no promotion route, promotion audit, fixtures visibly GENERATED | N10 tests | green | — | red · provenance breach is a **hard failure** |
| P1A-G9 · Shell exam-neutral | no `TAI` literal; second pack without schema change | guard + spec | green | — | red |
| P1A-G10 · Controles de Phase 0 y ausencia de Phase 2+ | nine checks, five guards, drift local + STAGING, lock, rollback roundtrip, PRODUCTION 0 tables, no Phase 2+ object, no client RPC | CI on branch and PR; STAGING evidence; PRODUCTION table count | green | — | any red or any PRODUCTION change · **hard failure** |

No gate depends on MI-01, MI-04, official corpus completeness, official counts or bank completeness. BLOCKED can only arise from a governance artifact not yet accepted (C-1…C-5), never from content.

---

## S · STOP CONDITIONS (Phase 1A)

1. Unregistered contradiction between canonical specifications, or a registered one the slice cannot avoid.
2. Need to amend an ACCEPTED ADR beyond the v1.1 annexes accepted in this packet, or to rely on a PROPOSED ADR point that no higher source mandates.
3. Any new cost, plan, paid service or dependency with architectural impact.
4. Any operation that would touch PRODUCTION, including a Vercel Production deploy.
5. A new security boundary: schema added to exposure, client-callable RPC, service-role code path, registry change, RLS weakening, grant to client roles on `content`/`ingest`.
6. A destructive migration, an edit of an applied migration, or a lock change other than adding a unit.
7. Any official TAI content, syllabus seed, corpus file or PDF about to enter the repository, CI or evidence.
8. Any design in which a key or marker could be readable by a client role, even transiently.
9. Any change to canonical event semantics (ADR-008) beyond the SD-021 clarification.
10. Any change to concept identity semantics once the convention is accepted.
11. Architecture expansion beyond 1A: Phase 2+ table, engine package, UI, domain Edge Function, pgvector, `learning_units`.
12. A guard or negative test that would have to be weakened rather than revised under C-7.
13. A test that can only pass by skipping or by fixtures that resemble official content.
14. A synthetic fixture that a reviewer could mistake for official content.

---

## T · PHASE 1B BOUNDARY (preview only)

- Objective: integrate the official TAI corpus into the 1A structures with full provenance, through the private content path, and prove the official gates.
- Required inputs: MI-01 (six official PDFs with option texts), MI-04 (revalidated mapping or the IV.7/I.7 subset), the corpus files (`Official_Exam_Corpus_v1.0`, `Official_Mapping_Practical_v1.1`, `Knowledge_Engine_v0.2` structure), the custody mechanism decision (private repository, bucket or local path with a hash manifest), the ingestion contract field list (ADR-005 pt 6) and the `mapping_confidence` decision (pt 7).
- What migrates from 1A unchanged: every schema, constraint, security boundary, publish function and test; 1B adds data and corpus-specific validation, not structure. If a structural change proves necessary, it is a 1B decision with its own ADR annex.
- Official-content responsibilities: TAI pack, version, blocks, 33 topics (9/5/9/10), sections and models seed; 270 canonical questions with representations and options; keys as PROVISIONAL/FINAL per source version; 405 occurrences with 30 reserve; 4 practicals; validated mappings for the revalidated subset; promotion audit for every row; nothing in the public tree.
- Likely gates: P1B-G1 seed counts (REQ-B11); P1B-G2 bank with options (REQ-B15, MI-01); P1B-G3 occurrences 405/270/30 without double counting (REQ-B13); P1B-G4 practicals fit (REQ-B12); P1B-G5 mapping status honest (`PENDING_REVALIDATION` outside the revalidated subset, MI-04); P1B-G6 private custody proof (no official content in repository, CI logs or evidence; hash manifest matches); P1B-G7 STAGING drift and Phase 0 controls intact.
- Human decisions deferred to 1B: custody mechanism; contract field list; `mapping_confidence`; licensing statement for the corpus; whether syllabus metadata (topic titles) may be published.

---

## U · FIRST PRODUCT SIGHT (FPS) RECOMMENDATION (planning milestone, not a phase)

Target: Ana interacts with a real navigable vertical HOY → LEARN → CHECK → FEEDBACK → SESSION END, on real architecture and persistence, with real evidence, with synthetic content visibly marked, without the final Planner or the complete Learning Engine.

Earliest technically honest placement: **after the Phase 2 checkpoint, before Phase 3**, as an "FPS slice" that pulls a bounded subset of Phase 5 forward and replaces engine dependencies with versioned, explicitly primitive components.

Prerequisites (all must exist for the interaction to be honest):
1. Phase 1A structures; optionally 1B content, otherwise synthetic GENERATED learning content and questions, visibly labelled in the UI.
2. `learning_units` (deferred by decision; first genuinely required here, LEARN needs a lesson body).
3. Phase 2: `learner_settings`, `learner_exam_goals`, `study_sessions`, `session_items` (ADR-007 with its v1.1 matrix), `learning_events` and `question_attempts` under ADR-008 (needs the canonicalization contract, D-12, and the disposition of ADR-002's remaining points), `diagnostic_runs` optional.
4. BD-03 confidence scale: CHECK cannot capture confidence without it (INV-102); the packet's reasoning that BD-03 does not gate 1A stands, but it gates FPS.
5. The grading boundary (ADR-006): a server-side `grade_attempt`/`submit_attempt` RPC pair, reserved in the registry, returning outcome + explanation + key version. This is Phase 5 material moved to the FPS slice; it is the first client-invokable RPC and therefore a security-boundary review item.
6. A **session composer v0**: deterministic, versioned, auditable, emits `reason_codes` (for example `NEXT_UNVIEWED_UNIT`, `CHECK_AFTER_LEARN`), persisted as a `planner_run` with `planner_version = 'composer-v0'`. It satisfies EC-003 literally while being primitive; HOY shows it with an honest label («plan provisional»).
7. FEEDBACK and SESSION END without mastery: show outcome, why (key explanation), confidence calibration as raw evidence, provenance, next action; SESSION END shows what was completed and answered; no mastery state, no readiness, no false precision (INV-111). Learning states (Master §12) are not shown, or only «○ Aún sin evidencia».
8. Design System option A restrictions (SD-019) are enough for a limited surface; the B/C decision is still due before the full Phase 5.

Capabilities that can remain deliberately primitive: planner (composer v0), mastery (absent, labelled), readiness (absent), interventions ("No entiendo nada" reduced to showing the explanation and the source), offline (online only, honest sync states), Tutor (absent), notes (absent), PROGRESO and PLAN (not part of FPS).

Phase boundary impact: yes. FPS moves the LEARN/CHECK/FEEDBACK/SESSION END/HOY screens and the grading boundary ahead of Phases 3 and 4, and adds `learning_units` and the composer v0 to the Phase 2 checkpoint scope. Recommendation: do not renumber; define FPS as milestone "Phase 2 + FPS slice" with its own checkpoint (`FPS PASS` requires Phase 2 gates + a slice gate set: no pre-submit leak, confidence before feedback, exact resume, one dominant mobile CTA, evidence rows real and rebuildable later, synthetic content visibly labelled), and let Phases 3–4 replace the primitives in place. Risks: R-12 is mitigated (earlier real use); R-13 (visual drift) needs the C-06 corrections before FPS screens; scope creep into Phase 5 must be prevented by an explicit slice list.

Human review items for FPS (not blocking 1A): accept the milestone; decide BD-03 before Phase 2 attempts; decide whether FPS runs on synthetic content only (no 1B dependency) or requires 1B first.

---

## V · DEFINITION OF DONE (Phase 1A)

Phase 1A is done when all of the following hold on the phase branch, with CI green on the branch and on the PR, and without any change to `main` before human acceptance:

1. C-1…C-7 accepted and landed on `main` by a documentary PR before the build branch is created.
2. Nodes N0–N11 applied from zero in CI and on STAGING; drift empty against both; rollback roundtrip green for every node; lock updated per node with reviewed diffs.
3. P1A-G1…G10 PASS; no gate BLOCKED; no hard failure.
4. Two synthetic GENERATED packs exercised end to end through `ingest` publish functions; no official content anywhere.
5. PRODUCTION unchanged (0 tables); STAGING contains only synthetic fixtures after cleanup.
6. Checkpoint under the Checkpoint Contract with `INVARIANTS VERIFIED` for EC-001, EC-007, EC-008, EC-009, EC-010, EC-011, EC-018, EC-019, EC-020, INV-101, INV-110, INV-116 and the 1A invariants of I–O; KNOWN DEBT carried forward; BLOCKED DECISIONS naming only 1B inputs.
7. Audit bundle and evidence per the Phase 0 protocol; then human acceptance → PR → merge → tag `phase-1a-v1.0`; Phase 1B and FPS not started.

---

## W · READINESS VERDICT

**READY WITH REMAINING HUMAN DECISIONS**

The remaining decisions are exactly the acceptance of the governance artifacts drafted here (C-1 … C-7): ADR-011, the ADR-009 and ADR-010 v1.1 annexes, SD-020, SD-021, the ADR-005 disposition note, and the authorization to land them together with the revision of the Phase 0 negative tests. No technical choice is left to Ana; each item can be accepted, rejected or amended as written. Phase 1A needs no external input and no content to reach PASS. FPS (U) is a separate roadmap recommendation and does not block 1A.

STOP. Nothing has been built. Phase 1A remains NOT AUTHORIZED.
