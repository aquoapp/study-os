# ADR-010 · Convocatorias y ocurrencias oficiales de pregunta

STATUS: ACCEPTED · v1.1 (anexo de implementación aceptado el 2026-09-09 · decisión C-3 · el texto v1.0 se conserva íntegro)
DATE: 2026-09-07
DECISION OWNER: Ana Victoria
DECISION RECORD: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · SHA-256 `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · baseline auditado `8823c2bdf2d31ec01a2f15b1566a94c1ad0eb04a`
IMPLEMENTATION STATUS: AUTHORIZED · Phase 1A (2026-09-09) · estructura de convocatorias y ocurrencias según el anexo v1.1; la carga oficial es de Phase 1B. Hasta el 2026-09-09 constaba como NOT IMPLEMENTED
OWNS: **BD-05 / SD-001** · propietario normativo único
SPEC REFERENCES: Canonical Data & Event Model v1.0 §5, §6, §7, §22, §23, §28; Master Product Specification v1.0 §18, §30, §31; Technical Architecture v1.0 §8, §9; Engineering Constitution EC-001, EC-007, EC-008; Official Exam Corpus v1.0 (05_DB_Schema, CORP-001…005); contradiction-register C-02; `spec/domain-model.md` [GAP-3], [GAP-5]; `docs/SPEC_DIFF_LOG.md` SD-001; REQ-B13; ADR-005 punto 5 (superseded por este ADR); ADR-006 (frontera de claves)

## Context

El corpus oficial contiene 270 preguntas canónicas, 405 ocurrencias y 30 preguntas de
reserva, con modelos A y B que son permutaciones de la misma pregunta semántica
(CORP-001, FROZEN). El CDEM §6 solo tiene `canonical_questions`: no puede representar la
convocatoria, el modelo, la sección, la posición mostrada ni la reserva (C-02, [GAP-3],
[GAP-5]). Tratar cada aparición como pregunta nueva infla la frecuencia y fragmenta la
evidencia; guardar solo la pregunta canónica pierde el orden, el modelo y la reserva.

## Decision

1. **`exam_sittings` representa la convocatoria o sesión oficial** y su contexto de
   procedencia: fecha de examen, parte o sección, y referencia a la fuente.
2. **`exam_occurrences` representa cada aparición de una pregunta canónica** en una
   convocatoria, modelo, sección y posición mostrada concretos, con **estado de reserva**
   explícito y **procedencia del fichero fuente**.
3. **Los modelos A y B pueden compartir una pregunta canónica** cuando se verifica que son
   el mismo ítem semántico. Identidad semántica y contenido de aprendizaje operan sobre la
   pregunta canónica; posición mostrada y analítica de frecuencia operan sobre las
   ocurrencias.
4. **Las posiciones y las referencias a fuente de cada ocurrencia son independientes**
   aunque compartan pregunta canónica.
5. **La unicidad impide posiciones oficiales duplicadas** dentro de la misma convocatoria,
   modelo y sección, y preserva la trazabilidad a la fuente.
6. **Las ocurrencias de reserva son explícitas**, con su estado, no duplicados canónicos.
7. **La clave de respuesta sigue versionada contra la pregunta canónica** (ADR-006 fija su
   frontera de exposición; este ADR no la redefine). **El modelo es metadato de
   procedencia** mientras la evidencia oficial no muestre divergencia semántica o de clave
   entre modelos: verificado sobre el corpus, la letra correcta no diverge entre A y B en
   ninguna de las 270 preguntas. Si una fuente futura demostrara una diferencia por
   modelo, se representará explícitamente mediante una decisión nueva; no se esconderá en
   metadatos.
8. **Ninguna fila del corpus se promociona sin procedencia de versión de fuente**
   (`source_version_id`; INV-110; ADR-005 puntos 1, 2 y 6, que siguen PROPOSED y no se
   redefinen aquí).

### Condiciones de aceptación vinculantes

- los totales verificados del corpus —270 preguntas canónicas, 405 ocurrencias, 30
  ocurrencias de reserva— se representan sin doble recuento de la frecuencia canónica;
- las permutaciones A/B conservan posiciones y referencias a fuente independientes y
  comparten identidad semántica donde se ha verificado;
- toda ocurrencia pertenece a una convocatoria válida y a una pregunta canónica válida;
- las reglas de unicidad rechazan posiciones oficiales duplicadas;
- ninguna fila del corpus se promociona sin procedencia de versión de fuente.

### Efecto sobre las decisiones existentes

- **BD-05 / SD-001** pasan a `ACCEPTED · NOT IMPLEMENTED`.
- **ADR-005 punto 5** queda **superseded por este ADR**. ADR-005 sigue `PROPOSED` en todo
  lo demás y, para la frontera de claves, **referencia a ADR-006** en lugar de
  duplicarla.

## Alternatives considered

- **Modelar A y B como bancos separados.** Rechazado por CORP-001: duplicaría la
  frecuencia histórica en Exam Intelligence.
- **Solo la pregunta canónica, con la posición en un JSON.** Rechazado: pierde unicidad,
  trazabilidad y la reserva; contradice CDEM §23 («use DB constraints wherever the
  database can enforce the invariant»).
- **Clave por modelo desde el principio.** Rechazado: la evidencia disponible no muestra
  divergencia; añadirla sin evidencia crea dos claves donde hay una y complica el ciclo
  `PROVISIONAL → FINAL → AMENDED`.

## Consequences

**Positivas:** frecuencia y orden oficiales fieles; reserva explícita; la trazabilidad
deja de ser una promesa; REQ-B13 pasa a ser verificable.
**Negativas:** dos entidades más y más pasos de ingestión; deben existir **antes** de la
primera carga de corpus.

## Product impact

EC-001, EC-007, EC-008, Master §18 (banco oficial), §30–§31 (procedencia y ciclo de
vida de fuentes). Afecta a ENTRENAR, al simulacro y a Exam Intelligence.

## Data/migration impact

**Ninguna migración autorizada por este ADR.** Afecta a la migración 5 (CDEM §28).
Prerrequisitos antes de redactarla: la forma exacta de las columnas de unicidad, la
representación del estado de reserva y las suites de abajo. `exam_sittings` y
`exam_occurrences` deben existir antes de la primera carga real: añadirlas después
obligaría a migrar contenido publicado.

## Security impact

Escritura exclusiva de admin / servidor (CDEM §22). Ninguna ocurrencia expone la clave de
respuesta: la frontera es la de ADR-006.

## Test/acceptance impact

Phase 1: `examOccurrence.load.spec` (REQ-B13): 405 ocurrencias con 270 preguntas canónicas
distintas; test de unicidad de posición por convocatoria, modelo y sección; test de
reserva explícita; test de procedencia obligatoria; AT-20 (aislamiento de pipeline).

## Rollback

Las entidades son aditivas y podrían retirarse antes de la primera carga. Después de
ingerir corpus real, no.

## Human approval

Approved by: Ana Victoria
Date: 2026-09-07
Record: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` §3.5 y §5 · SHA-256
`6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d`
Scope of approval: gobernanza únicamente · no autoriza migraciones, implementación de
dominio, infraestructura ni Phase 1

---

## Anexo v1.1 · dimensiones exam-neutral, unicidad y reserva · ACCEPTED 2026-09-09

**Registro de decisión:** `STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4` · decisión **C-3** aceptada en la
Phase 1A Build Authorization del 2026-09-09 (decisión humana M-7). El texto v1.0 no se
modifica; este anexo fija los prerrequisitos que v1.0 dejaba abiertos.

### Modelo mínimo, sin enum global

1. `exam_sections(id, exam_pack_id, code, title, sort_order)` · partes del examen definidas
   por el pack (las filas THEORY, PRACTICAL_I y PRACTICAL_II de TAI son datos de Phase 1B).
   Unicidad `(exam_pack_id, code)`.
2. `exam_sittings(id, exam_pack_id, sitting_date, call_label, source_version_id, notes,
   created_at)` · convocatoria o sesión oficial. Unicidad `(exam_pack_id, sitting_date,
   call_label)`.
3. `exam_sitting_models(id, sitting_id, model_code, source_version_id)` · variantes de una
   convocatoria (A, B). Unicidad `(sitting_id, model_code)`. Los modelos son filas, nunca un
   enum.
4. `exam_occurrences(id, sitting_model_id, section_id, question_id, display_no, is_reserve,
   source_version_id, source_file_ref, created_at)`:
   - unicidad `(sitting_model_id, section_id, display_no)`: sin posiciones oficiales
     duplicadas;
   - unicidad `(sitting_model_id, question_id)`: una pregunta aparece una vez por modelo;
   - mismo pack: sección, convocatoria y pregunta comparten `exam_pack_id` (claves foráneas
     compuestas);
   - `is_reserve boolean NOT NULL`; la bolsa de reserva es la sección, de modo que
     THEORY_RESERVE = (sección THEORY, reserva verdadera);
   - `source_version_id NOT NULL` (INV-110).
5. La clave de respuesta sigue por pregunta canónica (representación); el modelo es metadato
   de procedencia (punto 7 de v1.0).
6. `practical_questions(practical_id, question_id, sort_order)` no cambia; las ocurrencias de
   preguntas de práctico usan las secciones de práctico.
7. **No modelado en Phase 1A, a propósito:** divergencia de clave por modelo (decisión nueva
   si aparece evidencia), puntuación (BD-06), simulacro (Phase 6).

### Pruebas que fija este anexo

`examOccurrence.uniquePosition.spec`, `examOccurrence.uniqueQuestionPerModel.spec`,
`examOccurrence.reserveExplicit.spec`, `examOccurrence.provenanceRequired.spec`,
`examOccurrence.samePack.spec`, `secondPack.noSchemaChange.spec` (dos packs sintéticos con
secciones y modelos disjuntos).

**Alcance de la aceptación:** Phase 1A. La carga de las 405 ocurrencias oficiales (REQ-B13) y
sus totales son Phase 1B.
