# PHASE 2 · LEARNER & EVIDENCE CORE · BUILD AUTHORIZATION PACKET

**ACEPTADO · 2026-09-09 · Ana Victoria · Phase 2 Build Authorization.**
Fichero de origen: `STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md` · SHA-256 `da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67` (fuera del repositorio, en la
carpeta STUDY_OS del escritorio). El cuerpo que sigue es el paquete tal como se propuso; las
decisiones quedaron resueltas así: **H-P2-1** aceptada (ADR-007 v1.1: exactamente
`LEARNING_UNIT`, `QUESTION`, `PRACTICAL`, `CONCEPT_REVIEW`; `ON DELETE RESTRICT`); **H-P2-2**
aceptada (SD-022, canonicalización v1); **H-P2-3** aceptada (corrección dentro de la
normalización del intento; `append_learning_event` primera RPC invocable por cliente con su
contrato de seguridad completo); **H-FPS-1** opción A aceptada (`learning_units` en Phase 2 como
adenda de contenido canónico a través de la frontera `ingest` de Phase 1A, identidad estable +
contenido versionado inmutable, solo GENERATED); **BD-03** resuelta (SD-008 aceptada: cuatro
niveles, escala `v1`, etiquetas del material de pantalla, `confidence_value` +
`confidence_scale_version`, antes del feedback).

**Corrección obligatoria (§2 de la autorización), que prevalece sobre cualquier frase del cuerpo:**
`client_created_at` **nunca** es autoridad para elegir la representación ni la versión de clave.
La cadena es ítem de sesión → `QUESTION_PRESENTED` con el `question_representation_id` exacto
presentado → `ANSWER_SUBMITTED` verificado por el servidor contra la representación presentada →
versión de clave resuelta por el servidor para esa representación → intento inmutable. Durante el
aterrizaje de gobernanza se comprobó que la corrección está implicada por ADR-008, SD-021, EC-007
y el CDEM y se registró como **SD-023** (aclaración, no enmienda). La fila «Question-version
mismatch» de la sección P, que hablaba de «la representación vigente en `client_created_at`»,
es cronología de la propuesta y **no** gobierna.

**Alcance:** BUILD autorizado en `phase/2-learner-evidence-core` tras el aterrizaje de gobernanza;
STAGING autorizado; PRODUCTION no autorizado; merge final, tag, Release, FPS, Phase 1B y Phase 3
no autorizados. Las líneas «PROPOSED», «NOT AUTHORIZED» y «readiness only» del cuerpo son
cronología de la propuesta.

---
# STUDY OS · PHASE 2 · LEARNER & EVIDENCE CORE · PRE-AUTHORIZATION PACKET

STATUS: PROPOSED · architecture / governance / readiness only · 2026-09-09
Freeze reasoned about: `phase-1a-v1.0` → `be5a26ade5ac384a572d62568d7ac29fd2a568f6` (main, tree = accepted `c663afc`); documentary freeze `995fd71`.
PHASE 2 IS NOT AUTHORIZED TO BUILD. Nothing here creates a branch, a migration, a function, a table or a Preview. Ana Victoria and ChatGPT remain the acceptance and architecture authority.

Sources read fresh for this packet (originals where mechanically readable, hash-verified compilations otherwise): Builder Handoff Manifest v1.0 (original; §Build phases «PHASE 2 · Learner & evidence core», §Data implementation rules, §Security red lines, §Content implementation rules), Canonical Data & Event Model v1.0 (original; §§ identity, study sessions, immutable learning event stream, event taxonomy, assessment attempts, diagnostic, RLS ownership matrix, referential integrity rules, rebuildability, event-processing contract, acceptance tests), Engineering Constitution v1.0 (original; EC-005, EC-006, EC-007, EC-009, EC-012, EC-013, EC-014), Checkpoint Contract v1.0, ADR Policy v1.0, ADR-007 and ADR-008 (ACCEPTED · NOT IMPLEMENTED), ADR-002 and ADR-003 (PROPOSED, with their supersession notes), ADR-006/009/010/011 (ACCEPTED, implemented in 1A), SD-003, SD-004, SD-005, SD-008 (PROPOSED), SD-021 (ACCEPTED), `spec/requirement-index.md` §C (REQ-C01…C16) and §F, `spec/acceptance-matrix.md` §C, `spec/contradiction-register.md` (C-04, C-05, C-11, C-12, C-14, C-15, C-16, C-22, C-26; BD-03, BD-04, BD-06), `spec/invariant-register.md` (INV-101…INV-113, INV-116), `spec/domain-model.md`, `spec/terminology.md`, `docs/ARCHITECTURE_STATE.md` v11.7, `docs/PHASE_1A_CHECKPOINT.md`. The Master Product Specification PDF cannot be text-extracted on this machine (font without a Unicode map); its paragraphs are cited through the compiled outputs, which carry section numbers and were hash-verified at import.

---

## I · PHASE 2 CANONICAL AUTHORITY MAP

The Manifest defines Phase 2 verbatim: **«Learner & evidence core — Deliver: profile/settings/goal; onboarding; availability; sessions/items; immutable event ingestion; attempts/confidence; autosave/resume. Gate: duplicate event is idempotent; interrupted session resumes exactly; cross-user RLS tests pass.»**

| Capability | Source → requirement / invariant | Dependency | Expected artifact | Test | Gate |
| --- | --- | --- | --- | --- | --- |
| Learner settings and availability | Master §6, §7, §49 · CDEM «learner_settings» · REQ-C01, C03 · INV-106 | profiles (1A) | `learner_settings` (own row) | availability change preserves events | P2-G2, P2-G5 |
| Learner goal | CDEM «learner_exam_goals» · Master §6 | exam_packs (1A) | `learner_exam_goals` (own; one active goal per pack) | goal isolation | P2-G2 |
| Devices | CDEM «devices», «sync_state» · REQ-C15 · EC-012 (contract now, implementation Phase 9) | profiles | `devices`, `sync_state` (unique user+device) | uniqueness, isolation | P2-G2 |
| Sessions and items | CDEM «study_sessions», «session_items» · Master §10 · REQ-C04, C09, C10, C11 · ADR-007 (typed targets) | canonical content (1A), learning_units (see H-FPS-1) | `study_sessions` (state machine, resume cursor), `session_items` (typed FKs + CHECK) | state machine, exact resume, ADR-007 negatives | P2-G4 |
| Immutable event stream | CDEM «learning_events», taxonomy · EC-005, EC-013 · ADR-008 · REQ-C05, C06, C16 | sessions, devices | `learning_events`, `user_event_counters`, `append_learning_event` RPC, canonicalization contract | ADR-008 suites | P2-G3 |
| Attempts and confidence | CDEM «question_attempts» · EC-007 · Master §14, §17, §18 · INV-101, INV-102 · REQ-C07, C08 · ADR-008 «same order for attempts» | events, 1A representations/options/keys | `question_attempts` normalized inside the event transaction, server-side correctness, `confidence_value` + `confidence_scale_version` | idempotent attempts, key binding, privacy | P2-G3, P2-G6 |
| Diagnostic link | CDEM «diagnostic_runs» · REQ-C02, C14 · SD-005 | goals, attempts | `diagnostic_runs`, `question_attempts.diagnostic_run_id` nullable | link test | P2-G4 |
| Onboarding | Master §6 · REQ-C01 · Onboarding & Edge States | settings, goal | minimal onboarding surface (settings + goal + optional diagnostic skip) | E2E onboarding | P2-G7 |
| Autosave / resume | Master §10 · Closure D-001, AT-01 · REQ-C09, C10 | sessions, events | autosave through events; `resume_cursor_json` derived from accepted events | E2E abrupt exit | P2-G4 |
| RLS per user table with isolation test in the same migration | EC-009 · REQ-C13 · R-03 | — | policies + tests per table | matrix | P2-G6 |

What the Manifest **does not** put in Phase 2: Learning Engine (Phase 3), Planner (Phase 4), the five screens as product surfaces (Phase 5), practical/simulation (Phase 6), notes/Tutor (Phase 8), offline queue (Phase 9), official update lifecycle and `attempt_recalculations` (Phase 10).

Contradictions touched, none resolved silently: C-05 (confidence scale) → BD-03 stays a human decision; C-04/BD-06 (scoring) → Phase 6, Phase 2 only stores the blank as evidence; C-11 (taxonomy) → CDEM wins, SD-004 additions stay PROPOSED and are not required by Phase 2 MUST scope; C-22 (no `learning_units` content) → H-FPS-1; C-26 → resolved by ADR-008.

---

## J · D-12 / BD-03 / BD-06 · RECONSTRUCTED

### D-12 (a) · ADR-007 prerequisites: `item_type` enumeration and `ON DELETE`

- Canonical requirement: ADR-007 points 1–7 bind the pattern (typed nullable FK per target, CHECK exactly one, no polymorphic id, no cross-user targets, explicit deletion behaviour, negative tests). The matrix leaves `ON DELETE` and the closed list of `item_type` as **implementation prerequisites** to be fixed «from the governing documents» and published as an ADR-007 v1.1 annex.
- Status: OPEN debt (D-12), carried since Phase 0.
- Why Phase 2 needs it: `session_items` is a Phase 2 table.
- Entry gate, not build responsibility: the annex must exist before the migration is written (ADR-007 «Data/migration impact»).
- Closure evidence: ADR-007 v1.1 annex text + `session_items` migration with the CHECK and FKs + negative tests.
- Human decision: **no options remain**. Both cells are determined by authority: (1) `item_type` = the four recommended names `LEARNING_UNIT`, `QUESTION`, `PRACTICAL`, `CONCEPT_REVIEW` (ADR-007 matrix; the three non-members stay excluded); (2) `ON DELETE RESTRICT` for every canonical target, because Phase 1A made «published canonical rows are never deleted, they are retired» a database rule (DI-1A-3, migration 04 and 14) and ADR-007 point 5 forbids silent orphans; a retired target keeps the item resolvable (history) and the UI decides how to present it. The annex is governance (ADR amendment by annex, as ADR-009/010 v1.1) → **acceptance of the annex is required, but it is not a choice**.

### D-12 (b) · ADR-008 canonicalization contract

- Canonical requirement: ADR-008 «Contrato de canonicalización · prerrequisito de la migración»: key order, string normalization, nulls/absent fields, collection order, the complete field set for events and for answers, algorithm and contract version stored or recoverable.
- Status: OPEN (D-12).
- Why Phase 2 needs it: `event_id` idempotency by payload hash and attempt triple-match require a deterministic hash.
- Entry gate: yes (before the events migration).
- Closure evidence: SD-022 «Contrato de canonicalización v1» accepted + unit tests (`attempts.canonicalHashIsDeterministic.spec`, two equivalent encodings → same hash) + column `canonicalization_version` on events and attempts.
- Human decision: **none**; the contract is technical and fully determined once written. Proposed v1: JSON canonical form = keys sorted by Unicode code point, no insignificant whitespace, strings NFC, integers without exponent, decimals as shortest round-trip, booleans and `null` literal, absent keys omitted (absent ≠ null), arrays in given order (order is semantic: presented option order), SHA-256 hex; event hash over `{event_type, schema_version, session_id, session_item_id, device_id, client_created_at, client_sequence, payload_json}`; answer hash over `{question_id, representation_id, selected_option_id | null, presented_option_order?, answer_key_version_id, confidence_value | null, confidence_scale_version | null, free_text? }`; `canonicalization_version = 'v1'` stored per row. This is the SD-022 text; accepting it is the governance act.

### BD-03 · confidence scale

- Canonical requirement: Master §14 (confidence before feedback, calibration evidence), INV-102; C-05 records four conflicting scales (4 labelled steps in Screen Design; 1–4 in Learning System / Intelligence; «four/five» in Design System §6; 1–5 in Hi-Fi).
- Status: BLOCKED_DECISION (product), SD-008 PROPOSED.
- Why Phase 2 needs it: `question_attempts.confidence_value` semantics; changing the scale after evidence exists invalidates calibration history.
- Entry gate for **capturing** confidence (FPS/Phase 5), not for the Phase 2 schema: Phase 2 stores `confidence_value` + `confidence_scale_version` and refuses a value outside the scale registered for the version. BUILD of Phase 2 can proceed with the column and versioning; **no real confidence may be captured until BD-03 is decided** (gate P2-G3 negative: confidence rejected while no scale version is ACTIVE).
- Closure evidence: SD-008 accepted with the scale; `confidence_scales` registry row (or a CHECK) with version `v1`.
- Human decision: **yes (product)**. Recommendation: 4 levels (C-05 reasoning: coherent with the screen spec and all domain contracts; the Hi-Fi must be corrected under Master §48).

### BD-06 · official scoring and blank answers

- Canonical requirement: Master §20, Knowledge Engine (error −1/3, blank 0, two eliminatory parts), C-04.
- Status: BLOCKED_DECISION, Phase 6 (SD-003 PROPOSED).
- Why Phase 2 touches it: `selected_option_id NULL` must be a valid attempt (ADR-002 pt 9, SD-003) so the evidence exists later; scoring is not computed in Phase 2.
- Entry gate: **no** for Phase 2; Phase 6.
- Closure evidence: `scoring_policy` versioned per pack version (Phase 6).
- Human decision: yes, but **can wait until Phase 6**. Phase 2 stores the blank (`selected_option_id NULL`, `is_correct_at_submission = false`) without scoring.

---

## K · PHASE 2 EXACT SCOPE (domain boundary)

| Item | Classification | Note |
| --- | --- | --- |
| user context (auth, profiles) | PREREQUISITE (Phase 0) | exists |
| learner profile / study preferences / availability | IN PHASE 2 | `learner_settings`; override of today is a Planner concern (INV-106) but the *field* for a today override is not created in Phase 2 |
| session domain | IN PHASE 2 | `study_sessions` + state machine + `resume_cursor_json`; `planner_run_id` nullable until Phase 4 |
| session items with typed targets | IN PHASE 2 | ADR-007; `LEARNING_UNIT` column requires the table (H-FPS-1) |
| attempts / responses / blank | IN PHASE 2 | normalized in the event transaction |
| confidence | IN PHASE 2 (storage + scale version) · capture gated by BD-03 | |
| evidence / learning events / ordering / idempotency | IN PHASE 2 | ADR-008 |
| item version references | IN PHASE 2 | `session_items.question_id` + `question_attempts.representation_id` = `question_representation_id` (SD-021) |
| question representation references | IN PHASE 2 | attempt stores the representation graded |
| answer-key version references | IN PHASE 2 | `answer_key_version_id` NOT NULL (EC-007) |
| calibration evidence · raw performance evidence | IN PHASE 2 (raw only) | correctness, confidence, response_ms, blank |
| interruption / resume state | IN PHASE 2 | events + cursor projection |
| learning_units | **H-FPS-1** (recommended: canonical content addendum built in the first Phase 2 slice through the 1A ingest boundary) | CDEM layer 1; ADR-007 target; C-22 |
| grading boundary | IN PHASE 2 | intrinsic to attempt normalization (EC-007, CDEM §attempts); see M |
| projections / mastery / readiness / planner decisions | LATER ENGINE (Phases 3, 4) | tests assert absence |
| diagnostic runs | IN PHASE 2 (table + link) · behaviour Phase 2–3 | REQ-C02, C14 |
| devices / sync_state | IN PHASE 2 (contract) · Phase 9 (queue) | EC-012 |
| onboarding minimal surface | IN PHASE 2 (per Manifest) · screens minimal, not the Phase 5 product surface | REQ-C01 |
| attempt_recalculations, content_change_events | DEFERRED (Phase 10) | |
| notes, Tutor, offline queue, simulation, practical workspace | NOT REQUIRED | |

---

## L · PHASE 2 EXPLICIT NON-SCOPE

No `concept_mastery`, `exam_readiness`, `error_patterns`, `intervention_outcomes`, `planner_runs`, `planner_items`, `projection_watermarks` (ADR-008 pt 10 belongs with the first projection, Phase 3), `engine_config`, `attempt_recalculations`, `notes`, `source_chunks`, `ai_interactions`; no Learning/Planner package; no scoring policy; no Risk Engine; no client-side correctness; no official content; no PRODUCTION mutation; no change to any 1A table's semantics (only FKs into them).

---

## M · PHASE 2 EVENT MODEL (reconstructed, ADR-008 unamended)

| Aspect | Contract |
| --- | --- |
| Identity | `event_id` UUID generated by the client (CDEM); PK |
| Ordering | `stream_position` per user, monotonic, gapless (ADR-008 pt 1); `user_event_counters(user_id, next_position)` locked `FOR UPDATE` before the idempotency check (pts 2–3); no global order |
| Idempotency | same `event_id` + same `user_id` + same canonical payload hash → return existing, no counter advance (pt 4); otherwise integrity conflict, rollback, no gap (pts 5–9) |
| Actor | `user_id` = `auth.uid()` from the JWT, never from the client (Manifest §14); `device_id` must belong to the user (CDEM integrity rule) |
| Timestamps | `client_created_at` (fact time, engine semantics), `server_received_at` (audit), `engine_processed_at` (Phase 3) |
| Session relationship | `session_id`, `session_item_id` must belong to the same user (CDEM: «a user event cannot reference another user's session/device») — enforced by composite FKs `(session_id, user_id)` |
| Item identity / version | `session_items` carries the typed target; for questions the event payload and the attempt carry `representation_id` (= item version, SD-021) |
| Payload rules | validated against `event_type` + `schema_version` JSON schema in `packages/domain` (REQ-C06); markers of correctness forbidden in client payloads (server computes) |
| Append-only | no UPDATE/DELETE policy for users; trigger rejects UPDATE/DELETE in normal flow (EC-005) |
| Correction | never edits: a new event (ADR-002 pt 3, kept as PROPOSED but consistent with EC-005) |
| Replay | same event → same row (pt 4); late offline events take the next position and keep `client_created_at` (pt 11) |
| Duplicate submission | second `ANSWER_SUBMITTED` with the same `event_id` → same attempt; with a new `event_id` → a new attempt (legitimate evidence) |
| Offline compatibility | `created_offline`, `client_sequence`, `device_id` stored now; queue in Phase 9 |
| Audit | `promotion`-like audit is not needed: the event row is the audit; `canonicalization_version` and `payload_hash` stored |

Semantic hole found (not an amendment): ADR-008 defines the write path as «the transaction that accepts the event». The CDEM RLS matrix says «learning events: owner insert». Reconciliation without amending ADR-008: the insert is owner-authored but **function-mediated** (`append_learning_event`, SECURITY DEFINER with `auth.uid()` binding) so that the counter lock and the idempotency order hold; direct INSERT by `authenticated` is not granted. This is the first client-invokable RPC of the product and therefore a security-boundary review item (registered in `authority-registry.json`, negative tests, INV-113 unaffected because events are evidence, not projections). If Ana prefers direct INSERT with a BEFORE trigger doing the locking, the contract is the same; the RPC form is recommended because it can return the attempt outcome atomically (see N).

Compatibility with `item version = question_representation_id`: confirmed; nothing in the event contract references a mutable representation.

---

## N · PHASE 2 EVIDENCE MODEL

| Observation | Classification | Where | Note |
| --- | --- | --- | --- |
| item presented (`QUESTION_PRESENTED`, `LEARNING_UNIT_VIEWED`) | RAW EVIDENCE | learning_events | includes `representation_id`, presented option order if shuffled |
| selection changed (`ANSWER_SELECTED`) | RAW EVIDENCE (non-authoritative) | learning_events | debounced; never creates an attempt |
| answer submitted (`ANSWER_SUBMITTED`) | RAW EVIDENCE + normalized | learning_events → question_attempts | the only authoritative evidence of an answer |
| correctness result | DERIVED AT SUBMISSION, then immutable | question_attempts.is_correct_at_submission + answer_key_version_id | computed server-side against the key current at submission; recalculation is Phase 10 |
| response time | RAW EVIDENCE | question_attempts.response_ms (from presented→submitted client timestamps, capped) | INV-112 (idle) is Phase 5 |
| confidence (`CONFIDENCE_RECORDED`) | RAW EVIDENCE | learning_events + question_attempts.confidence_value/scale_version | must precede FEEDBACK (INV-102) |
| help / already-know | RAW EVIDENCE | learning_events (taxonomy) | Phase 5 emits them; Phase 2 accepts them |
| interruption / resume / completion | RAW EVIDENCE + PRODUCT STATE | learning_events + study_sessions.status | status is a projection of events but persisted for continuity |
| retry / duplicate | AUDIT STATE | idempotent return; conflicts logged as errors | |
| grading result shown (`FEEDBACK_VIEWED`) | RAW EVIDENCE | learning_events | |
| source / item version | RAW EVIDENCE | representation_id, answer_key_version_id | |
| timestamps / ordering | RAW + AUDIT | client_created_at, server_received_at, stream_position | |

Persisted now so engines never invent history: representation id, key version id, confidence with scale version, blank flag, response time, presented order, session and item linkage, device, stream position. Mastery and readiness are **not** computed; a scope-negative test asserts no projection table exists.

Mastery ≠ Exam Readiness (EC-004) is protected by absence: Phase 2 has no aggregate column («score», «level», «readiness») on any user table; gate P2-G8 asserts it by catalog.

---

## O · PHASE 2 SESSION MODEL

| Element | Contract (CDEM «study_sessions», Master §10, REQ-C04/C09/C10/C11, ADR-007) |
| --- | --- |
| Identity | `study_sessions.id`; owner `user_id`; `learner_exam_goal_id` |
| Start | `SESSION_STARTED` event; status PLANNED → ACTIVE; `started_at` |
| Intended plan reference | `planner_run_id` nullable (Phase 4); FPS uses NULL + `session_type` = deterministic assignment label |
| Item sequence | `session_items` ordered by `sort_order`, typed targets, `planned_minutes`, status per item |
| Item attempt | `ANSWER_SUBMITTED` → attempt linked to `session_id`/`session_item_id` |
| Interruption | `SESSION_INTERRUPTED` → INTERRUPTED; `last_activity_at`; cursor = last accepted item event |
| Resume | `SESSION_RESUMED` → ACTIVE at the **exact** `session_item_id` derived from events (REQ-C10), never «first item» |
| Abandon | ABANDONED is a technical status set by server policy (idle window, Phase 4 semantics), never user-facing copy (INV-107) |
| Completion / end | `SESSION_COMPLETED` → COMPLETED; `completed_at`; partial completion counts (REQ-C12: what was completed counts; the rest returns to the planner in Phase 4) |
| Multiple attempts | allowed as distinct events; `attempt_number` derived per (user, question) |
| Duplicate submit | idempotent by `event_id` |
| Crash / retry | events replayed idempotently; `resume_cursor_json` is a projection of accepted events, rebuilt on read if stale |
| Time | `planned_minutes`, elapsed from events; active-time exclusion of idle (INV-112) is Phase 5 |
| Continuity | state machine transitions enforced by a trigger (`session_status_transition`) with the allowed graph; no transition deletes evidence |

Nothing here invents Planner semantics; every field the Planner will need (`planner_run_id`, `planned_minutes`, `session_type`) exists as nullable or text.

---

## P · PHASE 2 SECURITY MODEL

| Threat | Control | Test | Gate | Failure class |
| --- | --- | --- | --- | --- |
| Cross-user evidence reads | RLS owner policies on every user table, FORCE RLS; composite FKs `(id, user_id)` for session/item/device references | isolation spec per table in the same migration (EC-009) | P2-G6 | HARD |
| Cross-user writes | no direct INSERT grants on events/attempts; RPC binds `auth.uid()`; sessions/items writable only through app flow functions | attacks with user B | P2-G6 | HARD |
| Forged attempts | attempts created only by the ingestion function from `ANSWER_SUBMITTED`; no INSERT grant to `authenticated` | attack | P2-G3 | HARD |
| Forged correctness | `is_correct_at_submission` computed in the definer function reading `content`; client payload markers rejected | negative payload test | P2-G3 | HARD |
| Answer-key leakage | 1A boundary unchanged; function returns outcome + explanation after the attempt row exists; never before | `phase1a.redteam` + Phase 2 leak test on the RPC response before/after | P2-G6 | HARD |
| Replayed / duplicate / reordered events | ADR-008 counter lock, hash equality, per-user positions | ADR-008 suites | P2-G3 | HARD |
| Event mutation / deletion | no UPDATE/DELETE policies; trigger rejects; service role SELECT only on events (same pattern as `ingest`) | attacks | P2-G3 | HARD |
| Session hijacking | session ownership FK + RLS; events must reference own session | attack | P2-G6 | HARD |
| Unauthorized grading | grading only inside the ingestion function; no separate client RPC | RPC discovery test | P2-G6 | HARD |
| Question-version mismatch | attempt stores `representation_id` and requires it to be the representation that was current at `client_created_at` or explicitly the presented one; mismatch → conflict | test with superseded representation | P2-G3 | HARD |
| Answer-key-version mismatch | key chosen server-side by `effective_from/to` at submission; stored; never client-supplied | test | P2-G3 | HARD |
| Service-role overreach | service role: SELECT only on events/attempts; no DML (1A pattern) | catalog matrix extended | P2-G6 | HARD |
| SECURITY DEFINER misuse | only `append_learning_event` (and session flow functions if any) are definer; empty `search_path`; EXECUTE only to `authenticated`; input validation first | catalog test | P2-G6 | HARD |
| Metadata leakage | RPC error messages never include key material; OpenAPI shows only public | red team | P2-G6 | HARD |
| RLS gaps | guard rule «every table born closed» (1A) + per-table isolation test | guard + matrix | P2-G6 | HARD |
| Privilege defaults | revoked in 14; re-asserted by test | catalog | P2-G6 | HARD |
| Client-provided authoritative fields | `user_id`, `stream_position`, `server_received_at`, `is_correct_at_submission`, `answer_key_version_id`, `attempt_number` are ignored or rejected if supplied | negative tests | P2-G3 | HARD |

Security, historical-evidence corruption and PRODUCTION mutation may not become ordinary debt.

---

## Q · PHASE 2 IMMUTABILITY / MUTABILITY MATRIX

| Entity | Class | Justification | Correction semantics |
| --- | --- | --- | --- |
| learning_events | APPEND-ONLY, IMMUTABLE rows | EC-005, ADR-008 | new event |
| user_event_counters | STATE-TRANSITIONED (server only) | ADR-008 | never manual |
| question_attempts | IMMUTABLE after insert (except Phase 10 recalculation records beside it) | EC-007, CDEM «preserve original submission truth» | `attempt_recalculations` (Phase 10) |
| study_sessions | STATE-TRANSITIONED (status graph), fields mutable by flow only | CDEM status list, REQ-C04 | new event drives transition |
| session_items | STATE-TRANSITIONED (status), targets IMMUTABLE after creation | ADR-007 | new item |
| learner_settings, learner_exam_goals | MUTABLE (own row, audited by events `AVAILABILITY_CHANGED`) | Master §7, §49; INV-106 | overwrite + event |
| devices, sync_state | MUTABLE (server-managed fields) | CDEM | |
| diagnostic_runs | STATE-TRANSITIONED | CDEM | |
| resume cursor | DERIVED (materialized for latency) | Master §10 | rebuilt from events |
| learning_units (if H-FPS-1 accepts) | IMMUTABLE when published (1A pattern: version + supersede) | EC-001, SD-021 by analogy | new content_version |

---

## Q-DAG · PHASE 2 MIGRATION DEPENDENCY DAG (logical; no SQL, no filenames)

```
N15 learner core:      learner_settings, learner_exam_goals, devices, sync_state (own-row RLS + isolation tests)
N16 learning_units:    canonical content addendum via ingest kind 'learning_unit' (only if H-FPS-1 = option A)  ──┐
N17 sessions:          study_sessions (status graph trigger), session_items (ADR-007 typed FKs + CHECK)  ← N15, N16(if A), 1A questions/practicals/concepts
N18 events:            user_event_counters, learning_events (per-user stream, payload_hash, canonicalization_version), append_learning_event RPC (definer), triggers no UPDATE/DELETE  ← N17, SD-022
N19 attempts:          question_attempts (representation_id, answer_key_version_id NOT NULL, submitted_event_id UNIQUE FK, confidence + scale version, diagnostic_run_id nullable), normalization inside N18's function  ← N18, 1A content/keys
N20 diagnostic:        diagnostic_runs  ← N15
N21 registry & guards: authority-registry (client RPC), sd018.contract.spec revised to assert the contract, scope-negative tests for Phase 3+ tables
```

Per node: responsibility, dependencies (arrows), entities, invariants (EC-005/006/007/009/013, ADR-007/008), grants/RLS (owner SELECT; writes only via functions; service role SELECT), functions (`append_learning_event`, `start_session`, `interrupt_session`, `resume_session`, `complete_session` or a single `apply_session_event`), tests (below), rollback (down scripts; the roundtrip signature grows), gate contribution (S).

---

## R · PHASE 2 TEST CONTRACT

| Test | Invariant proved |
| --- | --- |
| migration from zero (CI) · semantic roundtrip · drift | EC-011 |
| catalog matrix role × privilege (extended) | SI-1A-4, Phase 2 grants |
| `rls.userIsolation.<table>.spec` for every new table, in the same migration | EC-009, REQ-C13 |
| `events.lockBeforeIdempotencyCheck` · `duplicateEventIdReturnsExisting` · `conflictingEventIdAborts` · `noGapsUnderRollback` · `noOnConflictDoNothing` · `streamPositionMonotonic` · `concurrentInsertSerialized` · `lateArrivalNoTimeout` | ADR-008 pts 1–11 |
| `attempts.idempotentBeforeAttemptNumber` · `tripleMatchRequired` · `conflictDoesNotConsumeAttemptNumber` · `canonicalHashIsDeterministic` | ADR-008 attempts; SD-022 |
| `event.append-only` (UPDATE/DELETE rejected for user and service role) | EC-005 |
| `event.schemaValidation` | REQ-C06 |
| `attempt.requiredRefs` (`answer_key_version_id`, `submitted_event_id`, `representation_id` NOT NULL) | EC-007, SD-021 |
| `attempt.itemVersionPreserved` (a later representation does not change the stored one) | SD-021 |
| `answerKey.privacy.rpc` (response before attempt contains no key; error paths contain no key) | INV-101 |
| `grading.authorization` (no client RPC other than the ingestion function grades; service role cannot insert attempts) | INV-101, SI-1A-6 |
| `grading.historicalResolution` (key chosen by effective dates at submission; AMENDED key later does not rewrite) | EC-007 |
| `session.stateMachine` · `session.autosave.abruptExit.e2e` · `session.resumeCursor.exact.e2e` · `session.partialCounts` · `session.crossDevice.latestState` | REQ-C04, C09, C10, C11, C12 |
| `attempt.duplicateSubmit` (same event → one attempt; new event → new attempt) | EC-013 |
| `forgedAuthoritativeFields.reject` | Manifest §14 |
| `confidence.evidence` (recorded with scale version; rejected without an active scale) | INV-102, BD-03 gate |
| `attempt.blankAnswer` (NULL option valid, not correct, no score) | SD-003 |
| `no.mastery/readiness/planner/engine` (catalog absence; no package) | EC-004 boundary, scope |
| `phase1a.redteam` + `phase1a.lifecycle` unchanged and green | Phase 1A invariants preserved |
| PRODUCTION absence (connector read) | environment |

---

## S · P2 GATES

| Gate | Class | Objective | Prerequisites | Mechanical evidence | PASS | BLOCKED | FAIL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2-G1 | governance | ADR-007 v1.1 annex, SD-022 canonicalization, SD-008 (BD-03) or explicit «capture disabled», H-FPS-1 recorded; registry lists the client RPC | human decisions | documentary tests | all landed on main | any missing | — |
| P2-G2 | schema/data | learner tables with own-row RLS and isolation tests | G1 | catalog + isolation specs | green | — | red · hard |
| P2-G3 | evidence | ADR-008 suites, attempts normalization, key binding, blank, confidence gating | G2 | listed suites | all green | SD-022 missing | any red · hard |
| P2-G4 | session | state machine, exact resume, abrupt exit, partial completion | G3 | E2E + integration | green | — | red |
| P2-G5 | settings | availability change preserves evidence; goal isolation | G2 | tests | green | — | red |
| P2-G6 | security | matrix, no client route to keys, RPC hardened, service role SELECT only, forged fields rejected | G3 | red team extended | green | — | hard |
| P2-G7 | onboarding minimum | first plan reachable without advanced settings (REQ-C01) — «plan» here is the FPS assignment or a static placeholder, labelled | G2 | E2E | green | — | red |
| P2-G8 | scope-negative | no projection/planner/engine object; no scoring; no official content; Phase 1A suites green | — | catalog + static | green | — | hard |
| P2-G9 | environment | nine checks, guards, drift, semantic roundtrip, PRODUCTION 0 tables, Vercel control | — | CI + connector | green | — | hard |

---

## T · PHASE 2 STOP CONDITIONS

1. ADR-008 amendment required (any deviation from pts 1–11 or the attempts order).
2. Evidence semantics unresolved (payload schema for a P0 event cannot be derived from CDEM/Master).
3. `learning_units` ownership unresolved while `session_items` needs the `LEARNING_UNIT` target for the build (H-FPS-1).
4. Grading boundary contested (if Ana rejects «grading inside attempt normalization»).
5. Phase 3+ engine behaviour becoming necessary (any mastery/readiness/planner computation).
6. Answer-key exposure in any RPC response or error, even transient.
7. Destructive change to a Phase 1A table or migration.
8. Phase 1A stable identity semantics needing alteration.
9. Official corpus becoming required.
10. PRODUCTION mutation.
11. New cost.
12. Security-boundary expansion beyond the one registered client RPC (plus session flow functions declared in the registry).
13. Client trusted with any authoritative field.
14. A test that requires weakening an accepted invariant or a 1A guard.
15. BD-03 undecided while a slice tries to capture confidence.

---

## U · PHASE 2 IMPLEMENTATION SEQUENCE (future BUILD, for Claude Code)

| Slice | Objective | Authority | Prerequisites | Runtime | Tests | STAGING | Rollback | Gate | Stop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S0 governance landing | ADR-007 v1.1 annex; SD-022; SD-008 or capture-disabled note; H-FPS-1; registry entry for `append_learning_event`; revised negative tests | ADR Policy | decisions | none | documentary | none | revert docs | G1 | 1, 3, 4 |
| S1 learner core (N15, N20) | settings, goals, devices, sync_state, diagnostic_runs | CDEM, REQ-C01/C03/C14/C15 | S0 | tables + RLS | isolation | push + roundtrip | downs | G2, G5 | 7, 10 |
| S2 learning_units (N16, if A) | canonical table + ingest kind + tests + GENERATED fixture units | CDEM layer 1, EC-001 | S0 | table + publish kind | 1A-style attacks | push | down | G2 | 9 |
| S3 sessions (N17) | sessions, items with typed targets, status trigger, flow functions | ADR-007 v1.1, REQ-C04 | S1, S2 | tables + functions | state machine, ADR-007 negatives | push | downs | G4 | 1, 8 |
| S4 events (N18) | counters, events, RPC, canonicalization in `packages/domain`, schema validation | ADR-008, SD-022, REQ-C05/C06 | S3 | tables + RPC | ADR-008 suites | push | downs | G3 | 1, 2, 6 |
| S5 attempts (N19) | attempts inside the same transaction, correctness from `content`, confidence gating, blank | EC-007, INV-101, INV-102 | S4 | function extension | attempts suites, privacy | push | down | G3, G6 | 4, 6, 15 |
| S6 autosave/resume + minimal onboarding | resume cursor projection, abrupt exit, onboarding minimal | Master §10, REQ-C01/C09/C10 | S5 | server + minimal web | E2E | Preview | revert | G4, G7 | 5 |
| S7 checkpoint | evidence, bundle, catalog, PRODUCTION read | Checkpoint Contract | all | — | all | closing roundtrip | — | G8, G9 | 10 |

---

## V · PHASE 2 HUMAN DECISIONS

**Required before Phase 2 BUILD**

| ID | Question | Why human | Options | Recommendation | Consequences | Blocks | Latest safe point |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H-P2-1 | Accept ADR-007 v1.1 annex (four `item_type` values; `ON DELETE RESTRICT` everywhere) | ADR amendment is a governance act | accept · amend | accept | closes D-12(a) | S3 | before S0 lands |
| H-P2-2 | Accept SD-022 canonicalization contract v1 | versioned spec change required by ADR-008 | accept · amend | accept | closes D-12(b) | S4 | before S0 |
| H-FPS-1 | Ownership of `learning_units` (see FPS contract §Y) | SD-020 deferred it; CDEM assigns it to canonical content; no phase owns it | A build as canonical addendum in Phase 2 S2 · B Phase 1B · C Phase 5 | **A** | A: session items can target units; FPS possible after Phase 2. C: FPS slips to Phase 5 | S2, S3 | before S0 |
| H-P2-3 | Confirm the grading boundary lives in Phase 2 attempt normalization (function-mediated, atomic) and that `append_learning_event` is the first client-invokable RPC | first client RPC = security boundary (ADR Policy) | accept · prefer trigger-on-insert form | accept RPC form | registry entry; negative tests | S4, S5 | before S0 |

**Required before FPS BUILD (not before Phase 2 BUILD)**

| ID | Question | Recommendation |
| --- | --- | --- |
| BD-03 | Confidence scale | 4 levels (C-05); SD-008 accepted; Hi-Fi corrected |
| C-06 corrections for HOY and SESSION END | Required by Master §48 before those screens | accept the register's corrections |

**Can wait**

| ID | Question | When |
| --- | --- | --- |
| BD-06 | scoring policy and blank scoring | Phase 6 |
| BD-04 | readiness at concept level | Phase 3/7 |
| SD-019 B/C | full palette decision | before Phase 5 (FPS uses option A restrictions) |
| SD-004 additional events | when the Learning Engine needs `REVIEW_COMPLETED` (Phase 3) |

**Phase 1B only**: H-1, H-5…H-8, D-20, D-21.

---

## READINESS VERDICT (readiness only · not an authorization)

**PHASE 2 · READY WITH HUMAN DECISIONS**

Phase 1A supports Phase 2 without redesign. Four governance acts (H-P2-1, H-P2-2, H-P2-3, H-FPS-1) stand between this packet and a BUILD authorization; none is a technical unknown. BD-03 gates confidence capture, not the Phase 2 schema.
