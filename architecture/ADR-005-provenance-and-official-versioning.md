# ADR-005 · Procedencia y versionado de contenido oficial

STATUS: PROPOSED
DATE: 2026-08-22
DECISION OWNER: Ana Victoria
SPEC REFERENCES: Master Product Specification §18, §30, §31; Technical Architecture §8, §9; Canonical Data & Event Model §5–§7, §20; Engineering Constitution EC-001, EC-007, EC-008; Learning System v0.4 (Ingestion Contract); Official Exam Corpus v1.0 (05_DB_Schema, decisiones CORP-001…005); contradiction-register C-01, C-02, C-07, C-13

## Context
La trazabilidad es la ventaja defendible del producto, y es donde el paquete presenta los huecos más serios: el corpus oficial define entidades que el modelo canónico no tiene (C-02), no contiene los textos de las opciones (C-01), el mapping concepto↔pregunta contiene errores verificables pese a declararse validado (C-07), y la matriz RLS, leída literalmente, expondría las claves de respuesta al cliente (C-13).

## Decision
1. **Clases de procedencia obligatorias e inmutables:** `OFFICIAL · VERIFIED · GENERATED · PERSONAL`, con NOT NULL y CHECK. `OFFICIAL` exige `source_version_id` de fuente primaria verificable; sin ella, el ítem queda en **cuarentena** y no asciende por inferencia (INV-110).
2. **La autoridad pertenece a la versión de la fuente, no a la fuente.** Toda recuperación sensible a autoridad filtra estado y vigencia **antes** de aplicar similitud.
3. **Ciclo de vida de la clave oficial:** `PROVISIONAL → FINAL → AMENDED`. El intento conserva la versión utilizada al enviar. Una rectificación posterior crea `attempt_recalculations` y **nunca** reescribe el intento (EC-007).
4. **Las claves de respuesta no se exponen al cliente.** `answer_key_versions` queda fuera del esquema accesible por el Data API; la corrección ocurre en servidor (INV-101).
5. **Se añaden entidades de examen** —`exam_sittings` (convocatoria/sesión) y `exam_occurrences` (pregunta canónica × modelo × sección × `display_no` × fichero fuente)— para representar A/B como permutaciones de una misma pregunta semántica (CORP-001) y para soportar preguntas de reserva. Verificado sobre el corpus: la letra correcta no diverge entre modelos en ninguna de las 270 preguntas, por lo que la clave se mantiene a nivel de pregunta canónica con `model` como metadato de procedencia. **Sujeto a BD-05.**
6. **Pipeline de ingestión sin atajos:** SOURCE → versión → parse → **staging** → normalize → validate → publish → audit. El contenido parseado nunca entra directamente en tablas publicadas. Campos inmutables del contrato v0.4: `body_code`, `access_type`, `call_id`, `exam_date`, `model`, `part`, `question_number`, `source_url`, `source_hash`.
7. **El mapping concepto↔pregunta de v1.1 se marca `PENDING_REVALIDATION`** y no se siembra salvo para el subconjunto revalidado (IV.7, I.7). Todo mapping publicado lleva `mapping_confidence` y estado.
8. **GENERATED no asciende a VERIFIED en MVP.** No existe ruta de promoción implementada (AT-17).
9. **Cambio de fuente oficial:** genera `content_change_events` y `user_recalculation_jobs` dirigidos; se avisa al usuario **solo si le afecta**, sin lenguaje alarmista (ED-10).

## Alternatives considered
- **Corrección como booleano en la opción:** rechazado explícitamente por CDEM §6; impide el recálculo histórico.
- **Sembrar el mapping tal cual para avanzar:** rechazado; produciría mastery sin significado (R-01), que es el peor modo de fallo del producto.
- **Modelar A/B como bancos separados:** rechazado por CORP-001; duplicaría la frecuencia histórica en Exam Intelligence.
- **Rellenar el hueco de opciones con contenido generado:** rechazado; es la vía directa al falso OFFICIAL (R-07).

## Consequences
**Positivas:** la trazabilidad deja de ser una promesa y pasa a ser una propiedad verificable; el ciclo de rectificación oficial (frecuente en oposiciones tras alegaciones) queda soportado sin reescribir historia.
**Negativas:** más entidades y más pasos de ingestión; el contenido oficial no estará disponible hasta que se aporte **MI-01**.

## Product impact
Sostiene EC-001, EC-007, EC-008 y la promesa "las respuestas oficiales tienen ciclo de versiones y una rectificación no reescribe la historia".

## Data/migration impact
Afecta a las migraciones 4–5 de CDEM §28. `exam_sittings`/`exam_occurrences` deben existir **antes** de la primera carga real de corpus: añadirlas después obligaría a migrar contenido publicado.

## Security impact
Cierra la vía de filtración de C-13. Toda mutación de contenido canónico ocurre en contexto de servidor confiable; una ruta de UI oculta no es autorización (Master §44).

## Test/acceptance impact
Phase 1: AT-20 (aislamiento de pipeline), AT-23 (roles), INV-110 (cuarentena), CDEM 13 (opción cruzada), CDEM 14 (filtro de versión obsoleta).
Phase 10: AT-19 y AT-37 (rectificación con preservación e historial).

## Rollback
Las entidades de examen son aditivas y podrían retirarse antes de la primera carga. Después de ingerir corpus real, no.

## Human approval
Approved by:
Date:
