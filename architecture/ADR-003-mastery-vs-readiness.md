# ADR-003 · Mastery, Exam Readiness y configuración de motor

STATUS: PROPOSED · v1.1 (gobierno de `engine_config` reforzado)
DATE: 2026-08-22
DECISION OWNER: Ana Victoria
SPEC REFERENCES: Master Product Specification §12, §13, §23, §25; Canonical Data & Event Model §14–§16; Engineering Constitution EC-002, EC-004, EC-006; Learning System v0.4 (Mastery Engine); contradiction-register C-09, C-10, C-24

## Context
Tres cuestiones quedan abiertas y las tres tocan el mismo invariante:
1. Los siete estados de aprendizaje visibles (Master §12) mezclan mastery, patrón de error, repaso pendiente y **readiness** —que es por objetivo, no por concepto (C-09).
2. Existen dos modelos de pesos de mastery en documentos distintos, ambos declarados como hipótesis (C-10).
3. Los Hi-Fi muestran porcentajes exactos y proyecciones temporales que la evidencia no sostiene (C-24), en contra de Master §6.

## Decision
1. **`concept_mastery.mastery_state` almacena únicamente el estado del motor**: `NEW · EXPOSED · LEARNING · CONSOLIDATING · MASTERED · STRONG` (Learning System v0.4).
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
6. **Modelo de pesos inicial** (Learning System v0.4, declarado como hipótesis): accuracy .30 · retention .20 · transfer .20 · stability .10 · confidence_calibration .10 · speed .10. El modelo del Vertical Slice v0.1 queda superseded.
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

## Human approval
Approved by:
Date:
