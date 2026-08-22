# ADR-002 · Eventos de evidencia canónica

STATUS: PROPOSED · v1.2 (añadido el contrato de orden total; requiere SD-015)
DATE: 2026-08-22
DECISION OWNER: Ana Victoria
SPEC REFERENCES: Canonical Data & Event Model v1.0 §10–§12, §23, §26, §29; Engineering Constitution EC-005, EC-006, EC-013; Pre-Build Closure v0.6 (02_Event_Model, 05_Data_Integrity); contradiction-register C-11, C-12, C-14, C-15, C-16

## Context
La evidencia conductual es la única fuente de verdad reconstruible del producto. Dos documentos definen taxonomías y mecanismos de idempotencia distintos (C-11, C-12), el modelo canónico carece de tres eventos que el producto sí necesita, y dos decisiones de integridad quedan abiertas: las referencias polimórficas (C-15) y la semántica de envío en PRÁCTICO (C-16).

## Decision
1. **Taxonomía y nombres:** gana `Canonical Data & Event Model v1.0`. Los nombres de `Pre-Build Closure v0.6` quedan superseded y prohibidos en código (`terminology.md` §2).
2. **Idempotencia:** clave única `event_id` (UUID generado en cliente). Las claves compuestas de v0.6 se conservan como aserciones de deduplicación semántica en tests, no como clave primaria.
3. **Inmutabilidad:** `learning_events` no admite UPDATE ni DELETE en el flujo normal de la aplicación. Ninguna corrección edita un evento: crea uno nuevo.
4. **Normalización e idempotencia del intento (corregido en v1.1):** `question_attempts.submitted_event_id` es **NOT NULL, UNIQUE y FK a `learning_events.event_id`**, y es el **mecanismo principal de deduplicación**. `attempt_number` queda como contador derivado asignado por el servidor, nunca como clave de idempotencia: el cliente no puede conocerlo de forma fiable en un reintento y dos dispositivos pueden calcular el mismo valor para eventos distintos.
   La normalización ocurre en la misma transacción que acepta el evento, con `ON CONFLICT DO NOTHING` en ambos niveles. `attempt_number` se calcula bajo bloqueo por par (user, question) o por secuencia, evitando la carrera de `SELECT MAX()+1`.
   Replay multidispositivo: el mismo `event_id` reenviado desde dos dispositivos produce un solo intento; eventos distintos producen intentos distintos porque son evidencia real.
   **Orden total (nuevo en v1.2):** ver punto 10.
5. **Selección vs envío (aclarado en v1.1):** la formulación «`ANSWER_SELECTED` es mutable» era imprecisa y contradecía EC-005. Correcto:
   - todo `ANSWER_SELECTED` aceptado es **append-only e inmutable**;
   - cambiar de opción **emite un evento nuevo**, no edita el anterior;
   - lo mutable es la **proyección «selección actual»**, definida como el último `ANSWER_SELECTED` aceptado del ítem, y por tanto reconstruible desde el stream;
   - `ANSWER_SELECTED` **no crea evidencia autoritativa** ni alimenta el Learning Engine;
   - **`ANSWER_SUBMITTED` es el único evento que crea evidencia autoritativa**, una sola vez por `event_id`;
   - en PRÁCTICO y simulacro puede haber N selecciones y un único envío por ítem al cerrar el caso; la confianza se captura antes del envío (INV-102).
6. **Referencias polimórficas:** `session_items` y `planner_items` usan columnas nullable por tipo con FK real y un CHECK de exclusividad (`exactly one non-null`), en lugar de un `item_ref_id` sin integridad. La base de datos debe poder garantizar el invariante de CDEM §23.
7. **Eventos adicionales** (aditivos, sin romper la taxonomía): `REVIEW_COMPLETED`, `SESSION_IDLE_PAUSED`, `ERROR_REASON_CORRECTED_BY_USER`. Registrados en `SPEC_DIFF_LOG` SD-004.
8. **Enlace de diagnóstico:** `question_attempts.diagnostic_run_id` nullable (SD-005).
9. **Respuesta en blanco:** `selected_option_id NULL` es un intento válido y explícito, no la ausencia de intento (SD-003).
10. **Orden total determinista y watermark operativo (nuevo en v1.2 · C-26 · SD-015).** La v1.1 afirmaba que `server_received_at` fijaba el orden autoritativo. Es falso: no resuelve empates, no es monótono ante ajustes de reloj y no distingue orden de llegada de orden del hecho. Además `event_watermark` carecía de definición operativa, con lo que EC-006 no era verificable.
    Decisión:
    - `learning_events.server_sequence BIGINT NOT NULL`, asignado por una secuencia de base de datos al aceptar el evento, es la **clave de orden total**;
    - `event_id` sigue siendo la única clave de **idempotencia**;
    - `server_received_at` queda como **timestamp de auditoría**;
    - `client_sequence` conserva el **orden local por dispositivo** y no es comparable entre dispositivos;
    - `client_created_at` sigue siendo la referencia temporal del hecho para la lógica del motor;
    - **`event_watermark` = `server_sequence`** consumido por la proyección;
    - el watermark **solo avanza hasta el mayor `server_sequence` contiguo confirmado**, porque una secuencia puede confirmarse fuera de orden y un valor confirmado tarde quedaría por debajo del watermark y no se procesaría nunca;
    - todo rebuild recorre la evidencia por `server_sequence` ascendente, de modo que dos rebuilds producen el mismo orden;
    - un evento offline antiguo recibido tarde obtiene un `server_sequence` alto, conserva su `client_created_at`, **no borra ni reordena historia** y dispara recálculo desde el watermark afectado.
    Alternativa considerada y rechazada: ordenar por `(server_received_at, event_id)`. Es determinista pero arbitraria ante empates, sigue sujeta a ajustes de reloj y no ofrece una posición monótona utilizable como watermark.
    **Este punto amplía el CDEM: requiere `SD-015` aprobado antes de implementarse.**

## Alternatives considered
- **Mantener los nombres de v0.6** por ser más descriptivos: rechazado por jerarquía de autoridad.
- **Idempotencia por clave compuesta:** rechazada; frágil ante reintentos parciales y difícil de indexar de forma estable.
- **Conservar `item_ref_id` polimórfico** por simplicidad: rechazado; convierte un invariante declarado en una promesa no verificable, exactamente el patrón que la Constitution pretende evitar.

## Consequences
**Positivas:** integridad garantizada por la base de datos; reintentos seguros; historial reconstruible; el práctico y el simulacro se modelan sin duplicar evidencia.
**Negativas:** más columnas en `session_items`/`planner_items` y una migración más verbosa; añadir un tipo de ítem nuevo exige migración en lugar de un simple valor de enum.

## Product impact
Sostiene EC-005, EC-006, EC-013 y las promesas de continuidad de sesión (Master §10) y de no penalización por interrupción (EC-014).

## Data/migration impact
Afecta a las migraciones 7–9 del orden de CDEM §28. Los eventos adicionales son aditivos y compatibles hacia atrás mediante `schema_version`.

## Security impact
La ausencia de políticas de UPDATE/DELETE para el usuario es en sí misma un control de seguridad. `learning_events.user_id` debe validarse contra el contexto de auth, nunca aceptarse del cliente (Manifest §14).

## Test/acceptance impact
Gate de Phase 2: AT-24 (idempotencia), AT-01 (reanudación), AT-25/AT-42 (dispositivo obsoleto), test de exclusividad de referencia y **`rebuild.deterministicOrder.spec`** (dos rebuilds, mismo orden) más **`watermark.noGapSkip.spec`** (un evento confirmado fuera de orden no se pierde). Gate de Phase 6: no duplicación de evidencia al cambiar respuesta antes del envío.

## Rollback
Los eventos adicionales son retirables. La decisión sobre referencias polimórficas no es reversible sin migración de datos: debe decidirse antes de la primera carga real.

## Human approval
Approved by:
Date:
