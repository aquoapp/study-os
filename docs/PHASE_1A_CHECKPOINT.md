# STUDY OS · Checkpoint de Phase 1A · Canonical Domain Foundation

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 1A · Canonical Domain Foundation
BRANCH: phase/1a-canonical-domain-foundation (parte de main = e5fc785f86470f0da6fc533b266ab5fba7d19ecd)
COMMIT/TAG: código, migraciones y pruebas auditados en e896702 · este checkpoint y los registros vivos van en el commit documental posterior, que es el HEAD de la rama y el que describe el bundle · SIN MERGE · SIN TAG
STATUS: PASS WITH DEBT
```

**Primera emisión · 2026-09-09.** La Phase 1A fue autorizada por Ana Victoria el 2026-09-09
(`STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md`, SHA-256
`806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4`, copiado con cabecera de
aceptación en `docs/PHASE_1A_AUTHORIZATION_PACKET.md`). El aterrizaje de gobernanza (C-7)
entró en `main` por el PR #3 (`e5fc785`) antes de crear la rama de build. Todo lo que sigue se
construyó sobre esa base y **se detiene aquí**: no hay merge, no hay tag `phase-1a-v1.0`, no
hay Release, y Phase 1B, Phase 2 y FPS no han empezado. La aceptación es humana.

---

## Por qué PASS WITH DEBT

Los diez gates P1A-G1 … P1A-G10 están en **PASS** con evidencia ejecutada contra STAGING y en
CI remoto; ningún gate está BLOCKED; no se produjo ningún fallo duro. El `WITH DEBT` procede
únicamente de deuda técnica registrada, nunca de una decisión de dominio pendiente:

| Deuda | Estado |
| --- | --- |
| **D-13** · `schema-drift` nivel B exige Docker en local; corre en CI contra el stack local migrado desde cero y contra STAGING real | Heredada · aceptada · evidencia en CI |
| **D-17** · Las filas de auditoría de `ingest.staged_items` e `ingest.promotions` sobreviven a la purga de los packs sintéticos en STAGING (por diseño: la purga elimina contenido, no auditoría). Cada roundtrip las elimina con el esquema y cada ronda de pruebas vuelve a crearlas; el recuento exacto al cierre consta en la evidencia (catálogo de STAGING), todas GENERATED y sin contenido canónico enlazado | Nueva · aceptable · política de retención de auditoría pendiente (entrada de Phase 1B / operación) |
| **D-18** · Las pruebas de catálogo consultan la base lanzando el CLI fijado de Supabase por consulta, para no añadir un driver (Manifest §7); la suite de integración tarda ~1 min contra STAGING | Nueva · aceptable · revisar si Phase 2 multiplica las consultas |
| **D-19** · `public.set_updated_at` (función de trigger de Phase 0) conserva `EXECUTE` para `authenticated`; PostgREST no expone funciones que devuelven `trigger`, así que no es una RPC invocable, pero la revocación explícita queda pendiente | Nueva · aceptable · revocar en la siguiente migración de Phase 0/1 que toque `profiles` |
| **D-04 · D-05 · D-06 · D-07 · D-09 … D-12 · D-16** · sin cambios respecto a Phase 0 | Heredadas |

---

## 0. Secuencia ejecutada

1. **Preflight**: `main` = `a263ec1` limpio, ruleset 22557790 activo sin bypass, PRODUCTION con
   0 tablas, PAT revocado sin sustituto, archivo privado intacto.
2. **Aterrizaje de gobernanza** (C-1 … C-7) en `phase/1a-governance` → CI en verde → PR #3 →
   merge por PR (`e5fc785`) → verificación. ADR-011 `ACCEPTED v1.0`; anexos v1.1 de ADR-009 y
   ADR-010 `ACCEPTED`; SD-020 y SD-021 `ACCEPTED`; ADR-005 con nota de disposición y aún
   `PROPOSED`; registro de autoridad con `dataApi` y las RPC de ingestión reservadas; pruebas
   negativas de Phase 0 revisadas para expresar la nueva frontera (Phase 2+ sigue prohibido).
3. **Rama de build** `phase/1a-canonical-domain-foundation` desde el nuevo `main`.
4. **Implementación** del alcance MUST en tres commits (`8f130f3` código; `394a157` y
   `e896702` correcciones de parseo del CLI para CI y registros vivos), verificada contra
   STAGING en cada paso y en CI remoto.
5. **Checkpoint** (este documento) y bundle de auditoría. STOP.

Los dos runs de CI en rojo previos al verde (`34295390163`, `34296522761`) fallaron solo en el
job de base de datos por la forma de la salida JSON del CLI en el runner (array desnudo en modo
normal frente a `{rows}` en modo agente); el código de migraciones y pruebas no cambió entre
ellos y el run final. El parseo acepta ambas formas y fija `--agent no`.

---

## SPEC REFERENCES

Master Product Specification §§ 6, 7, 9, 10 (contenido canónico, procedencia, claves) ·
Engineering Constitution EC-001, EC-007, EC-008, EC-009, EC-010, EC-011, EC-018, EC-019, EC-020 ·
Canonical Data & Event Model §§ B, C (REQ-B10, REQ-B14, REQ-C13) · Technical Architecture
(frontera del Data API) · ADR-006 (frontera de claves) · ADR-009 v1.1 (identidad de concepto,
mapeos, prerrequisitos) · ADR-010 v1.1 (ocurrencias exam-neutral) · ADR-011 (topología y
exposición) · SD-020 (división 1A/1B) · SD-021 (representaciones inmutables) · Phase 1A
Authorization Packet §§ G, H, I–O, Q, R, S, V.

---

## DELIVERED

| Área | Entregado |
| --- | --- |
| Topología (ADR-011) | Esquemas `content` e `ingest` creados sin `USAGE` para `anon`/`authenticated`; `public` es el único esquema expuesto (`config.toml` = registro); guarda estática `private-schema-grant-guard` sobre todas las migraciones, incluidas las de rollback |
| Packs y versiones | `exam_packs`, `exam_pack_versions` (estado, ventana de vigencia, procedencia) |
| Jerarquía | `syllabus_blocks`, `topics` por versión de pack |
| Conceptos (ADR-009 v1.1) | `concepts` con `concept_key` `<slug>-<hash8>` única por pack e inmutable por trigger; `concept_versions` por versión de pack con `official_code`; `concept_prerequisites` sobre identidad estable, sin autorreferencia, mismo pack por FK compuestas |
| Fuentes | `sources`, `source_versions` con cadena de supersesión verificada |
| Preguntas (SD-021) | `canonical_questions` (identidad estable), `question_representations` inmutables una vez publicadas con una sola vigente por pregunta y supersesión fijada una sola vez, `question_options` inmutables con su representación |
| Mapeos | `question_concepts` por versión de pack, un PRIMARY por pregunta y versión, `mapping_status`, `copy_forward_question_concepts` que deja `PENDING_REVALIDATION` y registra su promoción |
| Claves (ADR-006 · INV-101) | `content.answer_key_versions` con FK compuestas que atan opción → representación → pregunta; ciclo de vida por `key_status`; ninguna columna de `public` nombra corrección |
| Modelo exam-neutral (ADR-010 v1.1) | `exam_sections`, `exam_sittings`, `exam_sitting_models`, `exam_occurrences` con posición única por modelo y sección, una pregunta por modelo, `is_reserve`, procedencia obligatoria y coherente |
| Prácticos | `practicals`, `practical_questions` (estructura; sin contenido) |
| Frontera de ingestión | `ingest.staged_items` (RECEIVED → VALIDATED/REJECTED/QUARANTINE → PUBLISHED), `ingest.promotions`, funciones `stage_item`, `validate_staged_item` (INV-110 → QUARANTINE), `publish_staged_item` (única ruta de escritura canónica), `purge_generated_pack` (solo packs íntegramente GENERATED); wrappers `public.*` SECURITY DEFINER ejecutables solo por `service_role` y reservados en el registro |
| Procedencia | `provenance_class` NOT NULL en toda fila canónica; OFFICIAL exige fuente OFFICIAL; sin ruta GENERATED → VERIFIED; toda fila publicada enlaza su promoción |
| RLS y grants | 23 tablas con RLS habilitado **y forzado**; `authenticated` solo SELECT de lo publicado (y su perfil); `anon` sin grants; `service_role` con escritura; 0 grants de cliente en `content`/`ingest` |
| Reversibilidad | `down/*.down.sql` por migración; `npm run db:roundtrip` (down en orden inverso → catálogo limpio verificado → up) en local, en CI y contra STAGING |
| Fixtures | Dos packs GENERATED sintéticos (`buildSyntheticPack`) con secciones y modelos disjuntos, construidos y purgados a través de la frontera de ingestión; ningún contenido oficial, ninguna semilla |
| Pruebas | Exposición, catálogo, RLS dirigida por catálogo, fundación (34 casos por gate), guarda de esquemas privados; pruebas documentales revisadas |
| Registros vivos | `ARCHITECTURE_STATE` v11.5, `CLAUDE.md` §8/§9, `README`, `DEPENDENCY_PROPOSAL` (sin dependencias nuevas), este checkpoint |

---

## FILES CHANGED

Respecto a `main` (`e5fc785`): 41 ficheros (40 de código y registros, más este checkpoint).

- **Migraciones nuevas** (todas con rollback y registradas en `.lock.json`):
  `00000000000003_schema_topology` · `04_exam_packs` · `05_syllabus_hierarchy` · `06_concepts` ·
  `07_sources` · `08_questions` · `09_question_concepts` · `10_answer_keys` ·
  `11_exam_occurrences` · `12_practicals` · `13_ingest_boundary`, con sus `down/`.
- **Migraciones de Phase 0 (0, 1, 2)**: intactas · `git diff phase-0-v1.0..HEAD` vacío sobre
  ellas y sus `down/`; huellas del lock sin cambio.
- **Herramientas**: `tools/db-roundtrip.mjs` (nuevo), `tools/guards/private-schema-grant-guard.mjs`
  (nuevo, sexta guarda), `tools/guards/schema-drift.mjs` (diff sobre `public,content,ingest`).
- **Pruebas**: `tests/integration/dataApi.exposure.spec.ts`, `tests/integration/catalog.security.spec.ts`,
  `tests/integration/phase1a.foundation.spec.ts`, `tests/rls/rls.canonicalContent.userWrite.deny.spec.ts`,
  `tests/unit/privateSchemaGrant.guard.spec.ts`, soportes `tests/support/sql.ts` y
  `tests/support/phase1a-fixtures.ts`.
- **CI**: `.github/workflows/ci.yml` · el job de base de datos ejecuta `db:roundtrip` y vuelve a
  medir la deriva tras él.
- **Registro y configuración**: `packages/domain/src/authority-registry.json` (ya aterrizado en
  `main`; sin cambios en la rama), `package.json` (`guard:private-schemas`, `db:roundtrip`).
- **Documentación**: `docs/ARCHITECTURE_STATE.md`, `CLAUDE.md`, `README.md`,
  `docs/DEPENDENCY_PROPOSAL.md`, `docs/PHASE_1A_CHECKPOINT.md`.

Sin cambios en `apps/`, `packages/design-system`, `spec/`, ADR (ya aterrizados) ni en el
`SPEC_DIFF_LOG` (adenda cerrada en `main`).

---

## MIGRATIONS

Inventario en el árbol (`sha256sum`, coincide con `supabase/migrations/.lock.json` y con
`supabase_migrations.schema_migrations` en STAGING, 14 versiones aplicadas):

| Versión | Fichero | SHA-256 (8) | Objetos principales |
| --- | --- | --- | --- |
| 00 | `init` | `1fe71f33` | Phase 0 · intacta |
| 01 | `profiles` | `9c84b076` | Phase 0 · intacta |
| 02 | `profiles_service_role` | `2d8b97be` | Phase 0 · intacta |
| 03 | `schema_topology` | `08b40e11` | esquemas `content`, `ingest`; enums `provenance_class`, `content_status`, `key_status`, `mapping_status`, `mapping_relationship`, `source_version_status`, `ingest.staged_item_status`, `ingest.staged_item_kind`; `ingest.promotions`; `ingest.purge_in_progress()` |
| 04 | `exam_packs` | `4d7fd022` | `exam_packs`, `exam_pack_versions`; `reject_delete_of_published()` |
| 05 | `syllabus_hierarchy` | `13db9a14` | `syllabus_blocks`, `topics` |
| 06 | `concepts` | `ea2c2fbf` | `concepts`, `concept_versions`, `concept_prerequisites`; `reject_concept_key_change()` |
| 07 | `sources` | `51f2860d` | `sources`, `source_versions`; `check_source_version_chain()` |
| 08 | `questions` | `63596359` | `canonical_questions`, `question_representations`, `question_options`; triggers de inmutabilidad; índice parcial `question_representations_one_current` |
| 09 | `question_concepts` | `1cbf56d3` | `question_concepts`; `ingest.copy_forward_question_concepts` |
| 10 | `answer_keys` | `22ac2421` | `content.answer_key_versions`; `content.check_answer_key_chain()` |
| 11 | `exam_occurrences` | `db7820d1` | `exam_sections`, `exam_sittings`, `exam_sitting_models`, `exam_occurrences`; `check_occurrence_provenance()` |
| 12 | `practicals` | `38208180` | `practicals`, `practical_questions`; `check_practical_provenance()` |
| 13 | `ingest_boundary` | `b6ac3630` | `ingest.staged_items`; `stage_item`, `validate_staged_item`, `publish_staged_item`, `purge_generated_pack`, `concept_key`, `require_keys`, `source_version_is_official`; wrappers `public.*` para `service_role` |

Disciplina cumplida: aditivas; ninguna migración aplicada editada; el lock solo añade
unidades; RLS y grants en la misma migración que cada tabla; aplicación desde cero en CI
(`db:reset`) y en STAGING (`db push`); roundtrip de rollback verificado; deriva vacía.

Nota de historial: STAGING conservaba versiones con marca de tiempo de la aplicación de Phase 0
por conector. Antes del primer `db push` se reconciliaron con `migration repair` (`reverted`
las tres de marca de tiempo, `applied` las tres canónicas `00…00`, `01`, `02`) sin tocar el
esquema; la deriva posterior fue vacía y así consta en CI.

---

## SCHEMA INVENTORY

| Esquema | Expuesto | Tablas (RLS forzado) | Lectura `authenticated` | `anon` | `service_role` |
| --- | --- | --- | --- | --- | --- |
| `public` | **sí** (único) | 20 · `profiles` (Phase 0) + 19 canónicas | SELECT de filas publicadas (`*_select_published`, `question_concepts_select_validated`, `sources`/`source_versions` completas) · `profiles` propio | sin grants | CRUD |
| `content` | **no** | 1 · `answer_key_versions` | sin `USAGE`, sin grants, sin políticas | ídem | CRUD |
| `ingest` | **no** | 2 · `staged_items`, `promotions` | sin `USAGE`, sin grants, sin políticas | ídem | SELECT/INSERT/UPDATE |

Políticas en STAGING: 21 (20 SELECT de contenido canónico o perfil propio, 1 UPDATE del perfil
propio); ninguna sobre `content`/`ingest`. Extensiones: solo las de la plataforma
(`pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`, `plpgsql`); **sin pgvector**.

Funciones de `public` ejecutables por roles de cliente: ninguna de Phase 1A (`anon` 0,
`authenticated` 0 salvo D-19). Las cinco RPC de ingestión son ejecutables solo por
`service_role` y constan como reservadas en `authority-registry.json`.

---

## EXPOSURE INVENTORY (ADR-011)

| Fuente | Valor |
| --- | --- |
| `packages/domain/src/authority-registry.json` → `dataApi` | `exposedSchemas: ["public"]` · `nonExposedSchemas: ["content","ingest"]` |
| `supabase/config.toml` → `[api].schemas` | `["public"]` |
| STAGING (`has_schema_privilege`) | `content`: anon `false`, authenticated `false` · `ingest`: anon `false`, authenticated `false` |
| STAGING (`role_table_grants` de cliente en `content`/`ingest`) | 0 |
| PostgREST (prueba `dataApi.exposure.spec`) | `content.*` e `ingest.*` inalcanzables con `anon`, `authenticated` **y** `service_role` por el Data API (esquema no expuesto), en STAGING y en CI; las cinco RPC de la frontera devuelven denegación a `anon` y `authenticated` |
| Guarda estática | `private-schema-grant-guard`: paridad registro = `config.toml`; ningún GRANT, política ni privilegio por defecto a roles de cliente sobre esquemas privados, en migraciones y rollbacks |

---

## TESTS

### Recuento verificable

| Suite | Casos | Dónde |
| --- | --- | --- |
| `test:unit` | 662 (31 ficheros; incluye la vigilancia documental de este checkpoint) | extracción limpia · CI |
| `test:integration` | 107 (4 ficheros: exposición 9, catálogo 15, fundación 34 + fuentes, perfil 1:1) | STAGING · CI |
| `test:rls` | 107 (2 ficheros: aislamiento de perfiles 11; contenido canónico dirigido por catálogo 96 = 1 + 5 × 19 tablas) | STAGING · CI |
| `test:e2e` | 70 estáticos + 16 de auth (limpieza verificada, 0 residuales) | STAGING · CI |
| `guards` | 6 (`import`, `tai-literal`, `client-authority`, `postgrest-provenance`, `schema-drift` nivel A, `private-schemas`) | extracción limpia · CI |
| `db:roundtrip` | 11 migraciones revertidas y reaplicadas | STAGING · CI |

### Contrato de pruebas (packet §Q) → instancia real

| Categoría | Instancia |
| --- | --- |
| migration | CI `db:reset` desde cero; STAGING `db push`; `schema-drift` A+B |
| reverse migration | `tools/db-roundtrip.mjs` (down 13→3, catálogo limpio: `private_schemas = 0`, `public_tables = 'profiles'`, `phase1a_enums = 0`; up) |
| exposure | `dataApi.exposure.spec` (registro = config = proyecto; PostgREST negativo con tres roles); `privateSchemaGrant.guard.spec` |
| RLS / grants | `catalog.security.spec` (cobertura por catálogo: RLS forzado, grants, ejecución de funciones), `rls.canonicalContent.userWrite.deny.spec` (escritura denegada por tabla, `anon` denegado) |
| constraints · immutability · versioning · provenance · exam-neutral · ingest boundary | `phase1a.foundation.spec`, `describe` por gate (G2, G4–G9) más «fuentes y versiones» |
| absence | `sd018.contract.spec`, `adr.acceptedDecisions.spec`, `schema.drift.spec` (lista Phase 2+) |
| guards, secrets, drift | sin cambios; `secret-scan` con centinela |
| documentary | `decisionRegister.spec` (este checkpoint, registros vivos, adenda) |

### Ejecutado contra STAGING · en verde (HEAD final)

`db:roundtrip` → 0 · `test:integration` 107/107 · `test:rls` 107/107 · `test:e2e` 70 + 16 ·
`verify` 8/9 (el noveno, `schema-drift` nivel B, exige Docker: D-13; en verde en CI).

### Ejecutado en CI remoto · en verde

Run `34297084359` sobre `e896702`: **Estático** (typecheck, lint, unit, guardas) · **Base de
datos** (migraciones desde cero, `db:roundtrip`, deriva, integración, RLS, E2E) · **Deriva
contra STUDY_OS_STAGING real**. El run del commit documental se cita en la evidencia.

---

## ACCEPTANCE GATES

| Gate | Resultado | Evidencia |
| --- | --- | --- |
| **P1A-G1** · Topología y exposición | **PASS** | `dataApi.exposure.spec` 9/9 en STAGING y CI; guarda `private-schemas` en verde; `has_schema_privilege` falso para ambos roles de cliente; 0 grants de cliente |
| **P1A-G2** · Frontera de claves | **PASS** | `phase1a.foundation.spec` «claves de respuesta en content»: clave solo en `content`, FK compuestas opción → representación → pregunta, ciclo `key_status`; la ingestión rechaza marcadores de corrección en el contenido expuesto; `catalog.security.spec`: ninguna columna de `public` se llama como clave o marcador y ninguna vista de `public` lee `content`/`ingest`; `secret-scan` y bundle limpios |
| **P1A-G3** · Contenido canónico de solo lectura | **PASS** | `catalog.security.spec` (RLS forzado tabla a tabla en `public`, `content` e `ingest`; `anon` sin grants; `authenticated` solo SELECT salvo su perfil) y `rls.canonicalContent.userWrite.deny.spec` (5 casos × 19 tablas canónicas leídas del catálogo: lee, no inserta, no actualiza, no borra, `anon` no lee) |
| **P1A-G4** · Identidad de concepto | **PASS** | «identidad de concepto»: convención `<slug>-<hash8>`, unicidad por pack, inmutabilidad por trigger, colocación por versión, REQ-B14 con dos versiones sintéticas |
| **P1A-G5** · Representaciones inmutables | **PASS** | «representaciones inmutables con supersesión»: una vigente por pregunta, cadena de supersesión, mutación y borrado rechazados, opciones inmutables |
| **P1A-G6** · Mapeos y prerrequisitos | **PASS** | «mapeos versionados y copy-forward»: ámbito por versión, un PRIMARY, mismo pack, `PENDING_REVALIDATION` tras copy-forward con promoción propia, prerrequisitos sin autorreferencia |
| **P1A-G7** · Ocurrencias exam-neutral | **PASS** | «ocurrencias exam-neutral»: secciones y modelos como datos del pack, posición única, una pregunta por modelo, reserva, procedencia coherente |
| **P1A-G8** · Procedencia e ingest | **PASS** | «procedencia e ingest»: clase NOT NULL, OFFICIAL sin fuente OFFICIAL → QUARANTINE, escritura directa rechazada, sin ruta GENERATED → VERIFIED, promoción enlazada, fixtures visiblemente GENERATED |
| **P1A-G9** · Shell exam-neutral | **PASS** | guarda `tai-literal` en verde; «dos packs sintéticos con secciones y modelos distintos, sin cambio de esquema» |
| **P1A-G10** · Controles de Phase 0 y ausencia de Phase 2+ | **PASS** | nueve checks (8 en local por D-13, 9 en CI), seis guardas, deriva local y STAGING, lock, roundtrip, PRODUCTION 0 tablas / 0 migraciones, sin objeto de Phase 2+, sin RPC de cliente |

Ningún gate depende de MI-01, MI-04 ni del corpus oficial. Ninguno está BLOCKED.

---

## SECURITY

- **INV-101 · frontera de claves**: `content.answer_key_versions` vive en un esquema sin
  `USAGE` para roles de cliente y fuera de la lista de exposición; PostgREST no lo alcanza ni con
  `service_role`; ninguna columna de `public` nombra corrección; los fixtures llevan claves
  sintéticas que solo entran por `publish_staged_item` y se purgan; ni logs, ni evidencia, ni
  bundle contienen una clave. **No hubo ninguna exposición transitoria.**
- **EC-009**: RLS habilitado y forzado en las 23 tablas en la misma migración que cada una,
  verificado tabla a tabla desde el catálogo (`catalog.security.spec`); ninguna tabla nueva
  lleva `user_id`: el contenido canónico no pertenece a ningún usuario.
- **EC-010**: ningún secreto en el repositorio, la conversación, la evidencia ni el bundle;
  `.env.staging.local` se carga en el entorno y se redacta cualquier aparición; el pooler
  aparece solo como host.
- **INV-116**: sin cambios; los E2E de auth siguen en verde.
- **Sin nueva frontera**: ningún esquema añadido a la exposición; ninguna RPC invocable por
  cliente; el registro cambió solo en el aterrizaje de gobernanza aceptado (C-7).
- **`SECURITY DEFINER`**: solo los wrappers `public.stage_item`, `validate_staged_item`,
  `publish_staged_item`, `copy_forward_question_concepts`, `purge_generated_pack`, con
  `EXECUTE` revocado de `public`, `anon` y `authenticated` y concedido a `service_role`.

---

## INVARIANTS VERIFIED

| Invariante | Cómo |
| --- | --- |
| EC-001 · EC-007 | Ningún literal de pack en el shell; contenido solo por pack y versión |
| EC-008 · INV-110 | `provenance_class` NOT NULL; OFFICIAL exige fuente OFFICIAL; cuarentena; sin promoción GENERATED → VERIFIED |
| EC-009 · REQ-C13 · REQ-B10 | RLS forzado en 23/23; cobertura dirigida por catálogo |
| EC-010 | `secret-scan`, escaneo del bundle, redacción en la evidencia |
| EC-011 | Migraciones con lock, rollback, roundtrip, deriva A+B |
| EC-018 | `tai-literal` en verde; segundo pack sin cambio de esquema |
| EC-019 | Artefactos congelados sin tocar; ADR aceptados sin reescritura (anexos); pruebas negativas revisadas solo bajo C-7, ninguna debilitada |
| EC-020 | `verify` cuenta el check bloqueado como fallo (8/9 en local) |
| INV-101 · ADR-006 | Frontera de esquema verificada por PostgREST y por catálogo |
| INV-116 | Sin cambios; E2E de auth en verde |
| SI-1A-1 … 5 (packet §J) | Exposición gobernada; esquemas privados inalcanzables; guarda estática; claves fuera de `public`; RLS forzado con `anon` sin grants |
| DI-1A-1 … 6 (packet §I) | Identidad de concepto por pack; prerrequisitos sobre identidad estable; publicado no se borra (se retira); representaciones inmutables; una vigente; mapeos por versión |
| PI-1A-1 … 6 (packet §K) | Clases cerradas; fuente OFFICIAL obligatoria; escritura solo por `publish_staged_item`; auditoría de promoción; fixtures GENERATED |
| REQ-B14 | Identidad de concepto estable a través de dos versiones sintéticas |
| ADR-009 v1.1 · ADR-010 v1.1 · SD-021 | Cubiertos por P1A-G4 … G7 |

---

## SYNTHETIC FIXTURES

| Fixture | Naturaleza | Ciclo |
| --- | --- | --- |
| Pack `fixture-<label>-<run>` A | GENERATED; secciones y modelos propios; una fuente GENERATED; bloques, temas, conceptos con dos versiones, preguntas con representaciones, opciones y clave sintética; ocurrencias; prácticos | `stage` → `validate` → `publish` por RPC de servicio; `purge_generated_pack` al terminar |
| Pack B | GENERATED; dimensiones disjuntas de A | ídem |

Los fixtures se ven sintéticos (etiqueta `fixture-`, textos generados, procedencia
`GENERATED`) y ningún revisor podría confundirlos con contenido oficial. No existe
`supabase/seed/` con contenido. Tras la ronda final STAGING contiene **0** packs, **0** fuentes,
**0** preguntas, **0** claves y **0** perfiles; solo las filas de auditoría de `ingest` (D-17).

---

## KNOWN DEBT

| # | Deuda | Resolver en |
| --- | --- | --- |
| D-04 | Familia tipográfica provisional | Al decidirla |
| D-05 | `next-env.d.ts` versionado | — |
| D-06 | Listas espejo TS / `.mjs` | Aceptable |
| D-07 | Restricciones de SD-019 opción A | Antes de Phase 5 |
| D-09 · D-10 · D-11 | Límites documentados de las guardas | Aceptables |
| D-12 | Prerrequisitos de ADR-007 (`ON DELETE`, `item_type`) y contrato de canonicalización de ADR-008 | Antes de las tablas de Phase 2 · SD-021 aclaró la «versión de ítem», no el resto |
| D-13 | `schema-drift` nivel B exige Docker en local | Aceptable · evidencia en CI |
| D-16 | Historia original en el archivo privado | Aceptada |
| **D-17** | Filas de auditoría de `ingest` persistentes en STAGING tras la purga | Política de retención · Phase 1B / operación |
| **D-18** | Consultas de catálogo por proceso del CLI; suite de integración ~1 min | Revisar en Phase 2 |
| **D-19** | `public.set_updated_at` con `EXECUTE` para `authenticated` (función de trigger de Phase 0, no invocable por RPC) | Revocar en la próxima migración que toque `profiles` |

Deudas cerradas en Phase 0 (D-01, D-02, D-03, D-08, D-14, D-15, D-GOV-01) siguen cerradas.

---

## BLOCKED DECISIONS

| ID | Impacto |
| --- | --- |
| Ninguna en Phase 1A | — |

Entradas que solo Phase 1B necesita y que **no** bloquean este checkpoint: **MI-01** (corpus
oficial), **MI-04** (claves oficiales), la custodia privada del contenido (M-1) y la política de
retención de auditoría (D-17). Diferidas sin bloquear: **SD-019** (antes de Phase 5), **BD-03**
y **BD-06** (antes de los intentos de Phase 2), la decisión sobre FPS (hito conceptual).

---

## STOP CONDITIONS · revisión (packet §S)

| # | Condición | Resultado |
| --- | --- | --- |
| 1 | Contradicción no registrada | No apareció |
| 2 | Enmienda de ADR ACCEPTED más allá de los anexos v1.1; apoyo en punto PROPOSED | No · ADR-005 se usó solo por su disposición aprobada |
| 3 | Coste, plan, servicio o dependencia nuevos | No · 0 dependencias nuevas (`DEPENDENCY_PROPOSAL`) |
| 4 | Operación sobre PRODUCTION o despliegue de Production en Vercel | No · ver abajo |
| 5 | Nueva frontera de seguridad | No · exposición sin cambios; RPC solo `service_role` |
| 6 | Migración destructiva, edición de aplicada, lock alterado | No · Phase 0 intacta; lock solo añade |
| 7 | Contenido oficial a punto de entrar | No · ninguna semilla, PDF ni corpus |
| 8 | Clave legible por un rol de cliente, aunque fuera transitoriamente | No |
| 9 | Cambio de semántica de eventos (ADR-008) | No · solo la aclaración SD-021 ya aceptada |
| 10 | Cambio de identidad de concepto tras aceptar la convención | No |
| 11 | Expansión más allá de 1A | No · sin tabla de Phase 2+, motor, UI, Edge Function, pgvector, `learning_units` |
| 12 | Guarda o prueba debilitada | No · revisadas solo bajo C-7, ninguna relajada |
| 13 | Prueba que solo pasa saltando o con fixtures parecidos a lo oficial | No |
| 14 | Fixture confundible con contenido oficial | No |

---

## ENVIRONMENTS

### STAGING · `xzcrqsolxarutlvvkzfp` · único entorno mutable

14 migraciones aplicadas (versiones canónicas `00000000000000` … `13`); 23 tablas con RLS
forzado; esquemas `content` e `ingest` sin `USAGE` de cliente; 0 contenido canónico tras la
purga; auditoría de `ingest` retenida (D-17); Auth con los usuarios E2E borrados (0
residuales). Todas las operaciones pasaron por `node tools/db.mjs`, `db push`, `migration
repair` y `db:roundtrip` con autorización explícita `staging:db-roundtrip`.

### PRODUCTION · `nzcgufeycvehczroryoe` · no mutado

Verificado en solo lectura por el conector oficial de Supabase al cierre: `list_tables` → `[]`
(0 tablas), `list_migrations` → `[]` (0 migraciones), proyecto `ACTIVE_HEALTHY`, creado el
2026-09-07. Ninguna herramienta de la rama ni de CI conoce su cadena de conexión.

### Vercel · proyecto `study-os` · control de releases vigente

- Los merges a `main` (`a263ec1` el 2026-09-08 y `e5fc785`, PR #3, el 2026-09-09) produjeron
  despliegues de Production **CANCELED** por el Ignored Build Step: la desviación aceptada de
  Phase 0 sigue en vigor. El último Production READY es `5d8296c` (Phase 0).
- Los tres commits de la rama de Phase 1A generaron solo **Preview** (`target: null`), como
  cualquier rama; no se solicitó ni se produjo ningún despliegue de Production desde ella.
- Sin dominios personalizados; `live: false`.

### GitHub · `aquoapp/study-os` · público

Ruleset `22557790` activo sin bypass (`pull_request`, `required_status_checks`,
`non_fast_forward`, `deletion`). Ramas remotas: `main`, `phase/0-foundation`, `phase/0-freeze`,
`phase/1a-governance` (integrada por PR #3), `phase/1a-canonical-domain-foundation`. Tag:
solo `phase-0-v1.0`. `aquoapp/study-os-archive-private` sigue privado e intacto. PAT
`STUDY_OS Phase 0` revocado y sin sustituto.

---

## REPO HYGIENE · verificación negativa de alcance

| Comprobación | Resultado |
| --- | --- |
| Identificadores de proyectos ajenos en el árbol público | 0 |
| Literal del primer pack en `apps`, `packages`, `tools`, `tests`, `supabase` | 0 (guarda) |
| `OFFICIAL` en migraciones y fixtures | solo como clase de procedencia; ningún contenido |
| `supabase/seed/` | sin semillas |
| Tablas de Phase 2+ (`study_sessions`, `session_items`, `learning_events`, `question_attempts`, `concept_mastery`, `exam_readiness`, `planner_items`, `learning_units`, `user_event_counters`, `projection_watermarks`) | ausentes (`schema.drift.spec`, `adr.acceptedDecisions.spec`) |
| RPC invocable por cliente · UI de producto o administración · motor · proyección · pgvector · IA · offline/sync | ausentes |
| Secretos en árbol, evidencia y bundle | 0 (`secret-scan`, escaneo independiente del bundle) |
| `.env.example` | todas las claves vacías |

---

## ROLLBACK

Repositorio: la rama puede descartarse sin efecto sobre `main` (`e5fc785`), que está protegida.
Si se descarta, `main` conserva la gobernanza aceptada (C-7), que es documental.

STAGING: `npm run db:roundtrip` con `STUDY_OS_DESTRUCTIVE_AUTHORIZATION=staging:db-roundtrip`
revierte 13 → 3 y verifica el catálogo limpio antes de reaplicar; para dejar STAGING en el
estado de Phase 0 basta con revertir y no reaplicar (`migration repair --status reverted`
de 03 … 13). Las filas de auditoría de `ingest` desaparecen con el esquema. PRODUCTION: nada
que revertir.

Vercel: nada que revertir; no hay despliegue de Production posterior a Phase 0.

---

## AUDIT BUNDLE

`STUDY_OS_Phase_1A_Audit_Bundle_<HEAD>.zip` = `git archive HEAD` del commit que contiene este
checkpoint, construido dos veces de forma determinista y comparado byte a byte, con
comprobación blob a blob contra `HEAD` y escaneo independiente del contenido extraído. Su
SHA-256 y la salida íntegra de cada comando (extracción limpia, STAGING, CI, PRODUCTION, Vercel)
están en `STUDY_OS_Phase_1A_Audit_Bundle_<HEAD>_AUDIT_EVIDENCE.md`, **fuera del repositorio**,
en la carpeta STUDY_OS del escritorio de Ana.

---

## NEXT RECOMMENDED PHASE

**Ninguna se inicia.** El siguiente paso es humano: la aceptación independiente de este
checkpoint por Ana Victoria (y la auditoría cruzada anunciada), y solo después PR → merge →
tag `phase-1a-v1.0`. Phase 1B (corpus oficial; exige MI-01, MI-04 y la custodia privada de M-1),
Phase 2 y el hito FPS siguen **no autorizados**.

```text
PHASE 1A BUILD COMPLETE · PASS WITH DEBT · READY FOR HUMAN ACCEPTANCE
```
