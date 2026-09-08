# ADR-008 · Orden de eventos por usuario e idempotencia en una sola transacción

STATUS: ACCEPTED · v1.0
DATE: 2026-09-07
DECISION OWNER: Ana Victoria
DECISION RECORD: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · SHA-256 `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · baseline auditado `8823c2bdf2d31ec01a2f15b1566a94c1ad0eb04a`
IMPLEMENTATION STATUS: NOT IMPLEMENTED · este ADR no autoriza ninguna migración ni código de dominio
OWNS: **SD-018** · propietario normativo único · **supersede a SD-015** y a toda parte de **ADR-002 v1.2** que lo contradiga
SPEC REFERENCES: Canonical Data & Event Model v1.0 §10, §12, §14, §16, §25, §26, §29 (P0-2, P0-3, P0-5, P0-9); Master Product Specification v1.0 §42, §43; Technical Architecture v1.0 §4, §6; Engineering Constitution EC-005, EC-006, EC-013; contradiction-register C-26; `docs/SPEC_DIFF_LOG.md` SD-015 (superseded), SD-018 y su corrección; ADR-002 puntos 4 y 10 (superseded por este ADR); ADR-004 puntos 1–3

## Context

La evidencia conductual es la única fuente de verdad reconstruible del producto (EC-006).
Tres redacciones anteriores no lo garantizaban:

- **ADR-002 v1.1** decía que `server_received_at` fijaba el orden autoritativo. No resuelve
  empates, no es monótono ante ajustes de reloj y confunde llegada con hecho (C-26).
- **SD-015 / ADR-002 v1.2** proponían una **secuencia global** `server_sequence` con un
  watermark global «sin huecos». Una secuencia de PostgreSQL no es transaccional —`nextval`
  no se revierte— y el orden global acopla usuarios que no comparten nada: un hueco de
  cualquiera detiene las proyecciones de todos.
- La primera redacción de **SD-018** conservaba `ON CONFLICT DO NOTHING` después de
  incrementar el contador —hueco garantizado— y trataba como idempotente un `event_id`
  reutilizado con otro usuario u otro contenido —éxito falso—.

SD-018, corregido dos veces en `docs/SPEC_DIFF_LOG.md`, es el contrato que este ADR
fija como aceptado.

## Decision

### Contrato vinculante para `learning_events`

1. **`stream_position` por usuario, monotónica y sin huecos.** Cada usuario tiene su
   stream; no existe orden global ni se necesita. `unique(user_id, stream_position)`.
2. **Contador por usuario bloqueado transaccionalmente.** `user_event_counters(user_id,
   next_position)` se bloquea con `SELECT … FOR UPDATE` dentro de la transacción que
   acepta el evento; si no hay fila, se crea con `next_position = 1` y se bloquea.
3. **El bloqueo del contador precede a la comprobación de `event_id`.** Comprobar antes
   del bloqueo abre una ventana en la que dos transacciones ven «no existe» y ambas
   siguen adelante.
4. **Un evento existente solo es idempotente si coinciden `user_id` y el hash del
   payload canónico completo.** Entonces se devuelve el evento existente **sin avanzar
   el contador**.
5. **Si no coinciden, es un conflicto de integridad.** Mismo `event_id` con otro usuario
   u otro contenido no es un reintento: es un error o un intento de suplantación, y nunca
   se reporta como éxito idempotente.
6. **Solo para un evento nuevo se reserva la posición y se inserta, en la misma
   transacción.** La posición vive y muere con la transacción que la usa.
7. **Ningún `ON CONFLICT DO NOTHING` después de asignar la posición.** El bloqueo del
   punto 2 y la comprobación del punto 3 cubren la concurrencia; la cláusula reintroduciría
   el hueco.
8. **Un conflicto de unicidad inesperado revierte la transacción entera, incluido el
   contador.** Es la propiedad que hace que no haya huecos.
9. **Tras el rollback, una transacción nueva recupera el evento existente y lo valida
   con la misma regla de igualdad del punto 4.** Un reintento legítimo termina devolviendo
   el evento original; uno ilegítimo termina en conflicto de integridad.
10. **Los watermarks son por usuario y por proyección:** `projection_watermarks(user_id,
    projection_name, consumed_position)`. Un usuario atrasado no detiene a otro; una
    proyección lenta no detiene a las demás.
11. **La evidencia offline tardía conserva `client_created_at` y dispara recálculo sin
    reescribir la historia.** Se acepta en la siguiente posición de su stream;
    `client_created_at` es la referencia temporal del hecho para el motor;
    `server_received_at` es auditoría. **Ninguna ausencia se declara definitiva por
    timeout.**

### El mismo orden para `question_attempts`

`submitted_event_id` es el mecanismo principal de deduplicación del intento y
`attempt_number` un contador derivado del servidor (ADR-002 punto 4, en lo que no
contradice a este ADR; CDEM §12). Se aplica el mismo orden:

1. bloquear el contador del par `(user_id, question_id)`;
2. después del bloqueo, comprobar `submitted_event_id`;
3. si existe, exigir la **triple coincidencia**: mismo `user_id`, misma `question_id` y
   el mismo **payload canónico completo de la respuesta**, comparado por
   `answer_payload_hash`; si coinciden, devolver el intento existente con su
   `attempt_number` original, **sin asignar número nuevo**;
4. si difiere cualquiera de las tres, **conflicto de integridad**: la transacción aborta y
   revierte por completo, y **no consume ningún `attempt_number`**; el siguiente intento
   legítimo de ese par recibe el número que le tocaba;
5. solo para un intento nuevo, asignar `attempt_number` e insertar en la misma
   transacción; sin `ON CONFLICT DO NOTHING` después de asignar.

«Completo» significa completo: opción u opciones elegidas, texto libre si lo hay, orden
presentado si la pregunta lo usa, versión del ítem, versión de la clave de respuesta
vigente en el envío (EC-007) y cualquier otro campo que forme parte de la respuesta. Un
hash sobre un subconjunto reintroduce el defecto en pequeño. El error distingue el caso
—usuario, pregunta o payload distinto— porque las consecuencias operativas difieren.

### Contrato de canonicalización · prerrequisito de la migración

Antes de la migración 8 debe existir un **contrato de canonicalización versionado**, que
fije como mínimo:

- el orden de claves;
- la normalización de cadenas (forma Unicode, espacios, mayúsculas si aplica);
- el tratamiento de nulos y de campos ausentes;
- el orden de las colecciones;
- el **conjunto completo de campos** que entra en el hash, para eventos y para
  respuestas;
- el identificador del algoritmo y de la versión del contrato, **almacenado o
  recuperable**, de modo que los hashes históricos sigan siendo interpretables.

Un hash canónico sin canonicalización fijada no es determinista: la comparación fallaría
de forma intermitente en lugar de fallar siempre.

### Condiciones de aceptación vinculantes

- inserciones concurrentes de un usuario producen posiciones consecutivas;
- un rollback no deja hueco;
- un reenvío legítimo devuelve la fila original sin avanzar ningún contador;
- un identificador reutilizado con otra propiedad u otro payload falla como conflicto de
  integridad;
- dos representaciones equivalentes del mismo payload producen el mismo hash canónico;
- un intento en conflicto no consume `attempt_number`;
- los rebuilds son deterministas para una versión de motor y un watermark por usuario
  declarados.

### Efecto sobre las decisiones existentes

- **SD-018** pasa a `ACCEPTED · NOT IMPLEMENTED`.
- **SD-015** queda `SUPERSEDED BY SD-018 / ADR-008`. Su texto permanece en el cuerpo
  congelado del `SPEC_DIFF_LOG` sin editar, y es **no operativo**.
- **ADR-002 v1.2** no se acepta tal como está: su `server_sequence` global —superseded—,
  su watermark global «sin huecos» y su `ON CONFLICT DO NOTHING` (puntos 4 y 10) quedan
  **superseded por este ADR** y son **no operativos**. ADR-002 sigue `PROPOSED` en todo lo demás y
  señala a este ADR como sustituto normativo.
- **ADR-004 punto 2** («el servidor asigna orden autoritativo de ingestión») se satisface
  con la posición por usuario de este ADR.

## Alternatives considered

- **Ordenar por `(server_received_at, event_id)`.** Determinista pero arbitrario ante
  empates, sujeto a ajustes de reloj y sin posición monótona utilizable como watermark.
- **Secuencia global con avance sin huecos (SD-015).** Rechazada por los dos defectos del
  contexto: no transaccional y unidad equivocada.
- **`ON CONFLICT DO NOTHING` en ambos niveles (SD-018 primera redacción).** Rechazado:
  produce huecos y éxito idempotente falso.
- **Idempotencia por usuario y pregunta sin payload.** Rechazada: dos envíos con el mismo
  identificador pueden llevar respuestas distintas; aceptar el segundo descarta o
  sobrescribe evidencia sin rastro.

## Consequences

**Positivas:** el orden es reconstruible y verificable por usuario, sin huecos por
construcción; EC-006 pasa a ser demostrable; el aislamiento que RLS da a nivel de fila se
extiende al procesamiento; ni corrupción silenciosa ni huecos por deduplicación.
**Negativas:** el contador por usuario es un punto de serialización por usuario —aceptable:
la evidencia de una persona es intrínsecamente secuencial y de volumen bajo—; ya no se
pueden ordenar entre sí eventos de dos usuarios sin un criterio adicional explícito, que
ninguna proyección de Phase 0 a Phase 9 necesita.

## Product impact

EC-005, EC-006, EC-013, Master §42–§43 y las promesas de continuidad (Master §10) y de
sincronización veraz (EC-012).

## Data/migration impact

**Ninguna migración autorizada por este ADR.** Afecta a las migraciones 8, 9 y 16 (CDEM
§28). Prerrequisitos antes de redactarlas: el contrato de canonicalización versionado y
las suites listadas abajo. Debe aplicarse antes de ingerir cualquier evidencia real.
Ninguna tabla de eventos, contador, watermark ni función existe en el repositorio, y
`sd018.contract.spec` lo verifica.

## Security impact

Un `event_id` reutilizado con otro usuario se rechaza como conflicto de integridad: la
idempotencia no es una vía de suplantación. `user_id` se valida contra el contexto de
auth (Manifest §14).

## Test/acceptance impact

Gate de Phase 2, ninguna implementada todavía: `events.lockBeforeIdempotencyCheck.spec`,
`events.duplicateEventIdReturnsExisting.spec`, `events.conflictingEventIdAborts.spec`,
`events.noGapsUnderRollback.spec`, `events.noOnConflictDoNothing.spec`,
`events.streamPositionMonotonic.spec`, `events.concurrentInsertSerialized.spec`,
`watermark.perUserPerProjection.spec`, `events.lateArrivalNoTimeout.spec`,
`rebuild.deterministicOrder.spec`, `attempts.idempotentBeforeAttemptNumber.spec`,
`attempts.tripleMatchRequired.spec`, `attempts.conflictDoesNotConsumeAttemptNumber.spec`,
`attempts.canonicalHashIsDeterministic.spec`. CDEM §29: P0-2, P0-3, P0-5, P0-9.

## Rollback

El contrato no es reversible una vez ingerida evidencia real. Antes, cualquier cambio
exige ADR de supersesión y cambio de especificación versionado.

## Human approval

Approved by: Ana Victoria
Date: 2026-09-07
Record: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` §3.3 y §5 · SHA-256
`6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d`
Scope of approval: gobernanza únicamente · no autoriza migraciones, implementación de
dominio, infraestructura ni Phase 1
