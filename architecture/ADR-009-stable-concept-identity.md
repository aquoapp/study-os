# ADR-009 · Identidad estable de concepto con representación versionada del sílabo

STATUS: ACCEPTED · v1.1 (anexo de implementación aceptado el 2026-09-09 · decisión C-2 · el texto v1.0 se conserva íntegro)
DATE: 2026-09-07
DECISION OWNER: Ana Victoria
DECISION RECORD: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · SHA-256 `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · baseline auditado `8823c2bdf2d31ec01a2f15b1566a94c1ad0eb04a`
IMPLEMENTATION STATUS: AUTHORIZED · Phase 1A (2026-09-09) · migraciones de jerarquía, conceptos, versiones y mapeos según el anexo v1.1. Hasta el 2026-09-09 constaba como NOT IMPLEMENTED
OWNS: **BD-02 / SD-002** · propietario normativo único
SPEC REFERENCES: Canonical Data & Event Model v1.0 §4, §6, §14, §20, §25, §29 (P0-5, P0-11); Master Product Specification v1.0 §11, §12, §31, §43; Technical Architecture v1.0 §6; Engineering Constitution EC-001, EC-006, EC-007; contradiction-register C-03, C-08; `spec/domain-model.md` [GAP-1], [GAP-2]; `docs/SPEC_DIFF_LOG.md` SD-002; REQ-B14

## Context

En el CDEM §4 los conceptos cuelgan de `topics`, que cuelgan de `syllabus_blocks`, que
cuelgan de una `exam_pack_version`. Con esa forma, publicar una versión nueva del temario
crea conceptos nuevos y deja huérfano el historial de dominio: `concept_mastery`
apuntaría a filas de una versión anterior, en contra de EC-006 y del gate «actualizar
contenido no destruye historial» (C-03, [GAP-1]). Además `canonical_questions` cuelga del
pack, no de la versión, y su relación con conceptos versionados quedaba indefinida
([GAP-2]). Es la decisión de esquema más difícil de revertir del proyecto (SD-002).

## Decision

**Modelo de dos capas:** identidad pedagógica estable dentro del linaje de un exam pack, y
una o más representaciones versionadas del sílabo.

1. **`concepts` es la identidad estable**, anclada a `exam_pack_id`, con `concept_key`
   inmutable y estado de ciclo de vida. Unicidad **`(exam_pack_id, concept_key)`**: el
   ámbito por pack impide colisiones entre packs.
2. **`concept_key` es inmutable una vez referenciada** por evidencia o por mastery.
3. **`concept_versions` es la representación versionada:** título, descripción,
   dificultad y colocación bajo la jerarquía bloque / tema de una `exam_pack_version`
   concreta. La navegación sigue el orden `Exam Pack → Version → Block → Topic →
   Concept`.
4. **`concept_mastery` se indexa por la identidad estable**, no por una fila versionada
   del sílabo. Lo mismo vale para `mastery_history`, `error_patterns`,
   `intervention_outcomes` y para cualquier proyección por concepto.
5. **Los mapeos pregunta→concepto y contenido→concepto son versionados o con vigencia
   (`effective-dated`)** y trazables a la representación versionada aplicable. Un intento
   histórico resuelve el mapeo y la representación de concepto válidos para su versión.
6. **Retiro explícito.** Un concepto puede retirarse sin borrarse; su estado lo dice.
7. **Linaje explícito de división y fusión (`split` / `merge`).** Toda división, fusión o
   redefinición semántica registra relaciones predecesor / sucesor.
8. **Sin transferencia silenciosa de mastery** a través de una división o fusión
   semántica. Nunca se copia mastery de un concepto a otro sin decisión.
9. **Política de recálculo o reinicio declarada antes de publicar** cualquier división,
   fusión o redefinición. Sin política publicada, el cambio no se publica.

### Condiciones de aceptación vinculantes

- publicar una versión nueva del exam pack no deja huérfanos ni el mastery del aprendiz
  ni la evidencia histórica;
- la navegación sigue la jerarquía versionada `Exam Pack → Version → Block → Topic →
  Concept`;
- los intentos históricos resuelven el mapeo y la representación de concepto válidos
  para su versión;
- división, fusión y retiro son auditables y nunca mutan evidencia antigua;
- las colisiones de concepto entre packs las impide la clave con ámbito de pack.

### Efecto sobre las decisiones existentes

- **BD-02 / SD-002** pasan a `ACCEPTED · NOT IMPLEMENTED` («modelo de dos capas»).
- ADR-007 referencia `concepts(id)` como destino estable del repaso.
- ADR-003 (PROPOSED) sigue describiendo el estado del motor; este ADR fija a qué
  identidad se indexa la proyección, no su semántica.

## Alternatives considered

- **Conceptos solo por versión del sílabo.** Rechazado: destruye la continuidad; cada
  publicación reinicia al aprendiz.
- **Conceptos solo a nivel de pack, sin representación versionada.** Rechazado: pierde
  la jerarquía versionada y el historial de cambios que Master §11 y §31 exigen.
- **Transferir mastery automáticamente al dividir o fusionar.** Rechazado: produce
  mastery sin significado (R-01), el peor modo de fallo del producto.

## Consequences

**Positivas:** continuidad del aprendiz entre versiones; jerarquía versionada intacta;
divisiones y fusiones auditables; REQ-B14 pasa a ser verificable.
**Negativas:** una tabla más y mapeos versionados; toda edición semántica de un concepto
obliga a declarar una política antes de publicar. Es el coste de no reinterpretar la
historia en silencio.

## Product impact

EC-006, EC-007, Master §11 («concept/evidence-oriented»), §12 (estados por concepto), §31
(ciclo de vida de fuentes). Afecta a PROGRESO, a las tarjetas de concepto y al planner.

## Data/migration impact

**Ninguna migración autorizada por este ADR.** Afecta a la migración 3 (CDEM §28) y, por
los mapeos, a la 5. Prerrequisitos antes de redactarlas: definir la forma exacta de los
mapeos versionados, la política de recálculo y las suites de abajo. Debe decidirse antes
de la primera carga de contenido; después implicaría migrar contenido publicado.

## Security impact

Ninguno directo. Las tablas de contenido siguen siendo de escritura exclusiva de admin /
servidor (CDEM §22).

## Test/acceptance impact

Phase 1: `concept.identityAcrossVersions.spec` (REQ-B14): publicar la versión N+1 mantiene
resoluble el mastery de N; test de unicidad `(exam_pack_id, concept_key)`; test de
inmutabilidad de `concept_key` referenciada; test de que un intento histórico resuelve su
mapeo versionado. Phase 3 y Phase 10: división y fusión con linaje y política declarada;
CDEM §29 P0-5 y P0-11.

## Rollback

Reversible mientras no exista contenido cargado. Después, no.

## Human approval

Approved by: Ana Victoria
Date: 2026-09-07
Record: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` §3.4 y §5 · SHA-256
`6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d`
Scope of approval: gobernanza únicamente · no autoriza migraciones, implementación de
dominio, infraestructura ni Phase 1

---

## Anexo v1.1 · convención de clave, mapeos versionados y prerrequisitos · ACCEPTED 2026-09-09

**Registro de decisión:** `STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4` · decisión **C-2** aceptada en la
Phase 1A Build Authorization del 2026-09-09 (decisiones humanas M-5 y M-6). El texto v1.0 no
se modifica; este anexo fija las celdas que v1.0 dejaba como prerrequisito de implementación.

### A · Convención determinista de `concept_key` (M-5)

1. **Forma:** `<slug>-<hash8>`, expresión regular `^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$`,
   longitud total ≤ 64.
2. **`slug`:** el título del concepto en el momento de su creación, normalizado (NFKD, sin
   diacríticos, minúsculas, solo letras y dígitos ASCII, cualquier otra secuencia colapsada a
   `-`), truncado a 40 caracteres en frontera de palabra. Es legible; **nunca** es identidad
   por sí solo.
3. **`hash8`:** los 8 primeros caracteres hexadecimales de SHA-256 sobre la cadena UTF-8
   `<exam_pack.slug> "\n" <NFC(título de creación)>`. Determinista para el mismo pack y
   título; independiente de códigos de programa y de orden de ingestión.
4. **Ámbito de pack:** unicidad `(exam_pack_id, concept_key)`. Un título idéntico dentro de un
   pack es, por definición, el mismo concepto; un duplicado semántico con el mismo título es
   una decisión de contenido que se registra en el linaje, no un cambio de clave.
5. **Inmutabilidad:** un trigger rechaza `UPDATE` de `concept_key` cuando la fila está
   `PUBLISHED` o es referenciada por cualquier clave foránea. `concepts.id` (UUID) es el
   destino de toda FK; la clave es la identidad humana estable.
6. **Neutralidad de examen:** ningún código de programa oficial entra en la clave.
   `concept_versions.official_code` (texto, opcional) y la colocación bajo tema llevan la
   numeración oficial por versión del pack.
7. **Regla de ingestión:** una carga localiza los conceptos existentes por `concept_key`
   (recalculada a partir del slug del pack y del título de la fuente) o por un mapeo de linaje
   explícito; nunca regenera claves de conceptos existentes.

### B · Mapeos versionados (M-6)

1. `question_concepts(id, question_id, concept_id, exam_pack_version_id, relationship_type,
   weight, mapping_status, copied_from_mapping_id, validated_at, created_at)`.
2. **Unicidad:** `(question_id, concept_id, exam_pack_version_id)`; exactamente un
   `relationship_type = 'PRIMARY'` por `(question_id, exam_pack_version_id)` (índice único
   parcial); `weight` en `(0, 1]`.
3. **Mismo pack:** claves foráneas compuestas hacia `canonical_questions(id, exam_pack_id)`,
   `concepts(id, exam_pack_id)` y `exam_pack_versions(id, exam_pack_id)` que comparten la
   columna de pack.
4. **Copy-forward:** la función de servidor `copy_forward_question_concepts(from_version,
   to_version)` inserta filas con `mapping_status = 'PENDING_REVALIDATION'` y
   `copied_from_mapping_id`; un mapeo solo alimenta motores posteriores cuando está
   `VALIDATED`; el rechazo es un estado, no un borrado.
5. **Resolución de evidencia (Phase 2+):** un intento resuelve sus mapeos a través de la
   `exam_pack_version` vigente en `client_created_at`, o de la versión registrada en la
   sesión cuando exista.

### C · Prerrequisitos y colocación (M-6)

1. `concept_prerequisites(concept_id, prerequisite_concept_id, strength, rationale)` sobre
   identidades estables, mismo pack, sin autorreferencia, par único.
2. Si una fuente canónica demostrara alguna vez un prerrequisito específico de versión, será
   una decisión nueva (ADR), no una columna.
3. La colocación vive en `concept_versions(concept_id, exam_pack_version_id, topic_id, title,
   description, difficulty_hint, official_code, sort_order)` con unicidad
   `(concept_id, exam_pack_version_id)` y `(topic_id, sort_order)`.

### Pruebas que fija este anexo

`concept.keyConvention.spec` (regex, determinismo, normalización), `concept.keyImmutable.spec`,
`concept.identityAcrossVersions.spec` (REQ-B14 con packs sintéticos),
`questionConcepts.versionScope.spec`, `questionConcepts.copyForward.spec`,
`concept.selfPrereq.reject.spec`.

**Alcance de la aceptación:** Phase 1A. No autoriza Phase 1B, Phase 2 ni FPS.
