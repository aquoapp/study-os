# ADR-003 · Mastery, Exam Readiness y configuración de motor

STATUS: ACCEPTED · v1.2 (vocabulario de estado superseded; sin puntuación numérica en v1)
DATE: 2026-08-22
DECISION OWNER: Ana Victoria
DECISION RECORD: Phase 3 Governance Landing Authorization · 2026-09-10 · copia aceptada en `docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md` · propuesta de entrada `STUDY_OS_Learning_Engine_Contract_v1.0_Proposal_d3581ba.md` · SHA-256 `cfb07a1ed05602b74daacb742472e21a94c7b602c6bbae634d9d2df42b33f6c7`
IMPLEMENTATION STATUS: NOT IMPLEMENTED · la aceptación **no autoriza migraciones** ni BUILD de runtime de Phase 3. El BUILD exige autorización humana independiente y posterior
OWNS: **BD-04** · propietario normativo único · el vocabulario de estado y la forma de la proyección los detalla `docs/LEARNING_ENGINE_CONTRACT.md`
SPEC REFERENCES: Master Product Specification §12, §13, §23, §25; Canonical Data & Event Model §14–§16; Engineering Constitution EC-002, EC-004, EC-006; `docs/LEARNING_ENGINE_CONTRACT.md` v1.0; **`Learning System v0.4` (Mastery Engine) · NO DISPONIBLE · referencia histórica, ya no normativa (H-P3-1)**; contradiction-register C-09, C-10, C-24, C-27

## Context
Tres cuestiones quedan abiertas y las tres tocan el mismo invariante:
1. Los siete estados de aprendizaje visibles (Master §12) mezclan mastery, patrón de error, repaso pendiente y **readiness** —que es por objetivo, no por concepto (C-09).
2. Existen dos modelos de pesos de mastery en documentos distintos, ambos declarados como hipótesis (C-10).
3. Los Hi-Fi muestran porcentajes exactos y proyecciones temporales que la evidencia no sostiene (C-24), en contra de Master §6.

> **Nota de supersesión parcial · v1.2 · 2026-09-10.** El punto 1 queda **superseded por el
> Anexo v1.2**: el vocabulario de seis estados procede en su totalidad de `Learning System v0.4`,
> declarado **NO DISPONIBLE** (H-P3-1), y la escalera monótona **no puede representar evidencia
> contradictoria**, que Master §12 exige como `△ Frágil` (C-27). El punto 6 queda **no operativo
> en v1** porque sin puntuación no hay pesos que aplicar. Los puntos 2, 3, 4, 5 y 7 siguen
> vigentes tal como están redactados. El texto histórico se conserva sin reescribir.

## Decision
1. **[SUPERSEDED por el Anexo v1.2 · texto histórico]** **`concept_mastery.mastery_state` almacena únicamente el estado del motor**: `NEW · EXPOSED · LEARNING · CONSOLIDATING · MASTERED · STRONG` (Learning System v0.4).
2. **El estado visible es una función pura de presentación**, no una columna. Deriva de `(mastery_state, error_pattern activo, next_review_at, uncertainty)` y produce las etiquetas de Master §12. Se implementa en `packages/domain` con tests por combinación.
3. **`exam_readiness` es una proyección independiente por objetivo**, nunca derivada como media de mastery. Debe poder bajar mientras el mastery sube (AT-32).
4. **`◆ Preparado para examen` no se emite a nivel de concepto** hasta decisión explícita de producto (BD-04). Por defecto, readiness se muestra solo a nivel de objetivo, en PROGRESO.
5. **Los pesos y umbrales viven en `engine_config` versionada**, no como constantes. Cada proyección persiste `engine_version` y `engine_config_version`.
   **Gobierno de `engine_config` (reforzado en v1.1 — la v1.0 daba pie a *tuning* silencioso en producción):**
   - **Versionada:** cada conjunto de parámetros es una versión identificable con autor, fecha y motivo.
   - **Inmutable por versión:** una versión publicada **no se edita**. Un cambio crea una versión nueva. Enforcement: trigger que rechaza UPDATE/DELETE sobre filas publicadas.
   - **Validada:** esquema tipado, rangos y suma de pesos verificados antes de aceptar la versión; una configuración inválida no puede persistirse.
   - **Promoción controlada:** la versión se crea en estado `DRAFT`, se prueba contra el dataset golden y solo pasa a `ACTIVE` mediante un paso de promoción explícito y registrado. Nunca se edita el valor activo en caliente.
   - **Aprobación humana obligatoria** cuando el cambio altera semantica de motor (dimensiones, significado de un estado, umbrales de transición). Un reajuste dentro de un rango ya aprobado puede promocionarse sin ADR, pero **siempre** deja registro y versión nueva.
   - **Sin tuning silencioso en producción:** el rol de aplicación no tiene grants de escritura sobre `engine_config`; la promoción es una operación administrada y auditada.
   - **Trazabilidad:** toda proyección indica con qué versión de configuración se calculó, de modo que una recalibración nunca reinterpreta silenciosamente la historia.
6. **[NO OPERATIVO en v1 · Anexo v1.2 · texto histórico]** **Modelo de pesos inicial** (Learning System v0.4, declarado como hipótesis): accuracy .30 · retention .20 · transfer .20 · stability .10 · confidence_calibration .10 · speed .10. El modelo del Vertical Slice v0.1 queda superseded.
7. **Sin precisión falsa:** por debajo del umbral de evidencia definido, la UI muestra banda + interpretación textual, nunca un porcentaje exacto (INV-111). Las proyecciones tipo "llegarás al 75% en 23 días" no se muestran en MVP.

## Alternatives considered
- **Guardar los siete estados en `mastery_state`:** rechazado; colapsa tres proyecciones distintas en una columna y erosiona EC-004 desde el esquema.
- **Pesos en código:** rechazado; obligaría a desplegar para recalibrar y rompería la comparabilidad histórica exigida por EC-006.
- **Readiness derivada de mastery:** rechazado explícitamente por el Master §23 y por AT-32. Es la diferencia entre saber y rendir, que es la tesis del producto.

## Consequences
**Positivas:** el invariante más importante del producto queda sostenido por el esquema, no por la disciplina; recalibrar no destruye el historial ni exige despliegue, pero tampoco puede hacerse a escondidas.
**Negativas:** más lógica de presentación que probar; la UI no puede leer un único campo "estado" y debe componerlo; la promoción de configuración añade un paso operativo deliberadamente incómodo.

## Product impact
EC-004 y EC-002 quedan verificables. Afecta a PROGRESO, a las tarjetas de concepto y a HOY (donde el Hi-Fi actual muestra un "nivel global" sin proyección declarada, C-06c).

## Data/migration impact
Añade `engine_config` y `engine_config_version` en las proyecciones. No hay backfill: es la posición inicial de Phase 3.

## Security impact
Ninguno directo. Las proyecciones siguen siendo de escritura exclusiva del motor/servidor.

## Test/acceptance impact
Gate de Phase 3: AT-11, AT-12, AT-26, AT-32 y tests de la función de presentación. Gate de Phase 7: DS-06 y INV-111.

## Rollback
Reversible mientras no exista evidencia acumulada. Después, cualquier cambio de semántica de estado exige ADR de supersesión y plan de recálculo.

## Anexo v1.2 · ACCEPTED 2026-09-10 · Phase 3 Governance Landing Authorization

**Registro de decisión:** Phase 3 Governance Landing Authorization · 2026-09-10 · Ana Victoria ·
copia aceptada en `docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md` · propuesta de entrada
`STUDY_OS_Learning_Engine_Contract_v1.0_Proposal_d3581ba.md` · SHA-256
`cfb07a1ed05602b74daacb742472e21a94c7b602c6bbae634d9d2df42b33f6c7`.

**A · `Learning System v0.4` · NO DISPONIBLE.** No está en `_handoff/originals/` y la decisión
H-P3-1 lo declara no disponible. Deja de ser referencia normativa de este ADR. No se sigue
buscando, no se inventa su contenido y no se afirma haberlo recuperado. Lo sustituye
`docs/LEARNING_ENGINE_CONTRACT.md` v1.0, derivado únicamente de autoridad vigente.

**B · Vocabulario de estado v1 · supersede al punto 1.** Los estados categóricos autoritativos
del Learning Engine v1 son:

`NEW · EXPOSED · EVIDENCE_POSITIVE · EVIDENCE_NEGATIVE · EVIDENCE_CONFLICTING`

`LEARNING · CONSOLIDATING · MASTERED · STRONG` quedan como vocabulario **RESERVED / FUTURE**:
**no se emiten** como estado autoritativo de v1 y **no se redefinen en silencio** para hacerlos
encajar.

**Motivo de la supersesión, registrado:** *la escalera monótona heredada no puede representar
evidencia contradictoria, mientras que el producto exige una condición veraz de fragilidad o
conflicto.* Master §12 exige `△ Frágil` y la escalera no tiene dónde ponerlo; no es un problema
de calibración sino de vocabulario. Se registra como contradicción **C-27** (SD-028).

**C · Sin puntuación numérica autoritativa en v1 (H-P3-8).** `mastery_score_internal` y
`stability_score` numérico quedan **superseded** del contrato autoritativo de proyección de
Phase 3. No se admite porcentaje sustituto, puntuación normalizada, probabilidad ni
pseudopuntuación oculta bajo ningún otro nombre. La proyección autoritativa es el **vector de
evidencia**; el estado categórico se deriva de él. REQ-D01 exige «estado, estabilidad,
incertidumbre, versión, watermark» y **no exige número**. Toda puntuación futura exige
gobernanza nueva y explícita.

**Consecuencia sobre el punto 6:** sin puntuación no hay pesos que aplicar. Los seis pesos
quedan **no operativos en v1**, **no se redistribuyen** y siguen siendo material declarado como
hipótesis para una versión futura del motor. DEF-14 y OBS-01 no cambian.

**D · `uncertainty` categórica.** En v1, la incertidumbre se representa como
`NO_EVIDENCE · SINGLE_OBSERVATION · REPEATED_SAME_QUESTION · MULTIPLE_QUESTIONS`, cuatro
distinciones que son límites de lo observable y no umbrales elegidos. Sigue siendo cierto que
«se muestra, no se oculta».

**E · BD-04 · CERRADA · opción A.** Se ratifica y se cierra el punto 4: Exam Readiness existe
**solo a nivel de objetivo**; `◆ Preparado para examen` **no se emite** como estado de concepto.
En Phase 3 no se crea `exam_readiness`, no se calcula readiness y no se deriva probabilidad de
aprobar, porcentaje de preparación ni equivalente. **REQ-D11 deja de estar `BLOQ`.**

**F · Gobierno de `engine_config` · punto 5 intacto, con una precisión.** Todo el punto 5 sigue
vigente. La validación de la **suma de pesos** se aplica **cuando existan pesos**: en v1 no los
hay, de modo que esa comprobación queda vacía sin quedar eliminada. `engine_config v1` contiene
**cero parámetros numéricos de aprendizaje**, y sus ranuras de política `mastery_sufficiency` y
`review_intervals` quedan **explícitamente sin fijar**; ninguna salida emitida por el motor v1
depende de ellas.

**G · Qué no cambia.** Los puntos 2 (el estado visible es una función pura de presentación),
3 (readiness independiente, nunca media de mastery), 4 y 7 (sin precisión falsa) siguen vigentes
tal como están redactados. EC-002 y EC-004 no se tocan. La aceptación de este ADR **no autoriza
ninguna migración** ni ningún objeto de runtime.

## Human approval
Approved by: Ana Victoria
Date: 2026-09-10
Scope: gobernanza únicamente · **no autoriza migraciones** ni BUILD de runtime de Phase 3 ·
ni Phase 1B, ni Phase 4, ni ninguna mutación de PRODUCTION
