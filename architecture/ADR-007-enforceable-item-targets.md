# ADR-007 · Destinos verificables de ítems de sesión y de planner

STATUS: ACCEPTED · v1.1 (anexo de implementación aceptado el 2026-09-09 · decisión H-P2-1 · el texto v1.0 se conserva íntegro)
DATE: 2026-09-07
DECISION OWNER: Ana Victoria
DECISION RECORD: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · SHA-256 `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · baseline auditado `8823c2bdf2d31ec01a2f15b1566a94c1ad0eb04a`
IMPLEMENTATION STATUS: AUTHORIZED · Phase 2 (2026-09-09) · `session_items` según el anexo v1.1; `planner_items` sigue en Phase 4. Hasta el 2026-09-09 constaba como NOT IMPLEMENTED
OWNS: **SD-006** · propietario normativo único
SPEC REFERENCES: Canonical Data & Event Model v1.0 §1, §6, §7, §9, §14, §17, §22, §23, §25, §28; Master Product Specification v1.0 §5, §8, §12, §19, §24; Technical Architecture v1.0 §2.3, §6.2; Engineering Constitution EC-005, EC-009; contradiction-register C-15; `docs/SPEC_DIFF_LOG.md` SD-006; ADR-002 punto 6 (superseded por este ADR)

## Context

`session_items` y `planner_items` llevan en el CDEM (§9, §17) el par `item_type +
item_ref_id`. CDEM §23 exige que «un planner item referencie un objetivo válido de
contenido o repaso» y que se usen constraints «siempre que la base de datos pueda
garantizar el invariante». Una referencia polimórfica no puede tener clave foránea: el
invariante quedaba declarado y no verificable (C-15). ADR-002 punto 6 proponía la
solución; SD-006 la registraba; ninguna estaba aprobada.

## Decision

### Patrón vinculante

1. **Una columna de clave foránea tipada y nullable por cada destino admitido**, en
   `session_items` y en `planner_items`. Cada columna referencia una tabla real con
   `REFERENCES`.
2. **Un `CHECK` de base de datos exige exactamente un destino**: exactamente una de las
   columnas de destino es no nula, y la columna poblada **corresponde al `item_type`
   declarado**. Cero filas válidas sin destino o con más de uno; `item_type` y columna
   poblada no pueden discrepar.
3. **Ningún `item_ref_id` genérico, ninguna referencia en JSON y ninguna validación solo
   de aplicación** se conserva como alternativa ni como respaldo.
4. **Los destinos de propiedad de usuario no pueden cruzar usuarios:** la base de datos
   impide que un ítem apunte a un destino de otro usuario (CDEM §23: «un ítem de sesión no
   puede pertenecer a la sesión de otro usuario»).
5. **El comportamiento de borrado es explícito** por destino y **no puede dejar un ítem
   huérfano en silencio**.
6. **Añadir un tipo de destino exige migración y actualización de tests** compatible con
   este ADR. No es un valor de enum que se añade sin más.
7. Los **tests negativos de base de datos ejercitan cada combinación inválida**: sin
   destino, dos destinos, `item_type` que discrepa de la columna poblada, y destino de
   otro usuario donde aplique.

### Matriz de destinos

La matriz tiene estas columnas, y es **parte vinculante** de la decisión: tipo de ítem ·
columna FK y tabla referenciada · clasificación canónico / propiedad de usuario · regla
de propiedad · comportamiento `ON DELETE` · presencia en `session_items` · presencia en
`planner_items`.

Lo que sigue recoge **lo que determinan los documentos gobernantes** y nada más. Los
documentos gobernantes nombran las familias de destino —contenido y repaso, CDEM §23— y
las tablas de contenido canónico (CDEM §6, §7), pero **no enumeran los valores de
`item_type`** (CDEM §9 y §17 los declaran como columna sin lista) **ni fijan el
comportamiento de borrado**. Conforme a la regla de no invención (Manifest §6), esas
celdas se marcan como **PRERREQUISITO DE IMPLEMENTACIÓN**: se fijan en el plan de
implementación de las migraciones 7 y 11, a partir de los documentos gobernantes, antes
de redactar la migración. Marcar una celda como prerrequisito no reabre SD-006: el patrón
de los puntos 1–7 es vinculante desde hoy.

Los literales de `item_type` son **nombres recomendados**; la semántica, la propiedad y
las restricciones son lo vinculante (packet §2).

| Tipo de ítem (nombre recomendado) | Columna FK → tabla | Clasificación | Regla de propiedad | `ON DELETE` | `session_items` | `planner_items` |
| --- | --- | --- | --- | --- | --- | --- |
| `LEARNING_UNIT` · unidad de aprendizaje | `learning_unit_id → learning_units(id)` | Canónico (CDEM §1 capa 1, §6, §22 «canonical exam/content») | No aplica: el destino no tiene propietario | **PRERREQUISITO** · explícito y sin huérfanos silenciosos | Sí (Master §5 LEARN; CDEM §11 `LEARNING_UNIT_VIEWED`) | Sí · familia «content» (CDEM §23) |
| `QUESTION` · pregunta canónica | `question_id → canonical_questions(id)` | Canónico (CDEM §1, §6, §22) | No aplica | **PRERREQUISITO** | Sí (Master §5 CHECK; CDEM §11 `QUESTION_PRESENTED`) | Sí · familia «content» (CDEM §23) |
| `PRACTICAL` · supuesto práctico | `practical_id → practicals(id)` | Canónico (CDEM §1, §7, §22) | No aplica | **PRERREQUISITO** | Sí (Master §19; CDEM §11 `PRACTICAL_STARTED`) | Sí · familia «content»; Master §24 «practical/simulation needs» |
| `CONCEPT_REVIEW` · repaso de un concepto | `concept_id → concepts(id)` · identidad estable (ADR-009) | Canónico (CDEM §4, §22) | No aplica | **PRERREQUISITO** | Sí (Master §8 «critical retrieval/review») | Sí · familia «review» (CDEM §23; Master §24 «due reviews») |

**Por qué el repaso apunta al concepto y no a una fila de proyección.** El estado de
repaso vive en `concept_mastery.next_review_at` por (usuario, concepto) (CDEM §14) y en la
proyección `review_schedule` (TA §6.2), y ambas son **reconstruibles** (CDEM §25): una
clave foránea hacia una fila reconstruible se rompería en cada rebuild. El destino estable
es la identidad del concepto, que ADR-009 fija como inmutable una vez referenciada.

**Miembros no determinados por los documentos gobernantes.** No forman parte de la matriz
y **no pueden aparecer como `item_type`** hasta que una decisión los determine, con su
migración y sus tests:

| Candidato | Por qué no está |
| --- | --- |
| Simulacro | El CDEM no tiene tabla de simulacro (`terminology.md`: «pendiente, C-04»); `simulation_runs` es SD-003, `PROPOSED`. Sin tabla no hay clave foránea posible |
| Material de repaso personal (`personal_review_material`) | Ningún documento gobernante dice que sesiones o planner lo programen. Si se incorporara, sería **propiedad de usuario**: regla de propiedad = mismo `user_id` que la sesión o el run, verificado por la base de datos |
| Diagnóstico | CDEM §13: las respuestas de diagnóstico usan `question_attempts` con contexto de diagnóstico; no es un destino de ítem |

### Condiciones de aceptación vinculantes

- cero filas válidas sin destino o con más de un destino;
- `item_type` y la columna de destino poblada no pueden discrepar;
- todo destino tiene una clave foránea real;
- las referencias entre usuarios son imposibles para destinos de propiedad de usuario;
- el comportamiento de borrado es explícito y no puede dejar un ítem huérfano en silencio;
- los tests negativos de base de datos ejercitan cada combinación inválida.

### Efecto sobre las decisiones existentes

- **SD-006** pasa a `ACCEPTED · NOT IMPLEMENTED` («aceptado según aclaración»).
- **ADR-002 punto 6** queda **superseded por este ADR**. ADR-002 sigue `PROPOSED` en todo
  lo demás.

## Alternatives considered

- **Conservar `item_ref_id` polimórfico.** Rechazado: convierte un invariante declarado
  en una promesa no verificable, que es el patrón que la Constitution existe para evitar.
- **Tabla puente por tipo.** Alternativa creíble (C-15 la recogía). Rechazada por ahora:
  multiplica tablas y políticas RLS por destino sin ganar integridad respecto a las
  columnas tipadas con `CHECK`, y complica la ordenación de ítems dentro de una sesión.
- **Validar en aplicación.** Rechazado: no es un control.

## Consequences

**Positivas:** la promesa de integridad referencial del CDEM §23 pasa a ser ejecutable;
el conjunto de destinos es pequeño y controlado; cada tipo nuevo deja rastro en
migración y tests.
**Negativas:** más columnas y una migración más verbosa; añadir un tipo cuesta una
migración. Es un coste preferible a referencias permanentemente no verificables.

## Product impact

EC-005 (la evidencia referencia lo que realmente se estudió), Master §10 (continuidad
de sesión con cursor válido) y Master §24 (planner auditable: cada ítem apunta a un
destino resoluble).

## Data/migration impact

**Ninguna migración autorizada por este ADR.** Afecta a las migraciones 7 y 11 (CDEM
§28). Antes de redactarlas: fijar las celdas marcadas **PRERREQUISITO** a partir de los
documentos gobernantes, publicar la matriz completa como enmienda v1.1 de este ADR, y
acompañar cada tabla con su test de aislamiento (EC-009). Sin backfill: debe decidirse
antes de la primera carga real.

## Security impact

La imposibilidad de referencias cruzadas entre usuarios se garantiza en base de datos, no
solo por RLS de la tabla de ítems. `user_id` se valida contra el contexto de auth, nunca
se acepta del cliente (Manifest §14).

## Test/acceptance impact

Gate de Phase 2: test de exclusividad de referencia; tests negativos por combinación
inválida; test de destino de otro usuario; test de que cada columna de destino tiene FK
real. Phase 4: los `reason_codes` de un run resuelven cada ítem a su destino.

## Rollback

No reversible sin migración de datos una vez exista contenido cargado. Antes de la
primera carga, retirar columnas es una migración inversa ordinaria.

## Human approval

Approved by: Ana Victoria
Date: 2026-09-07
Record: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` §3.2 y §5 · SHA-256
`6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d`
Scope of approval: gobernanza únicamente · no autoriza migraciones, implementación de
dominio, infraestructura ni Phase 1

## Anexo v1.1 · enumeración cerrada de `item_type` y comportamiento de borrado · ACCEPTED 2026-09-09

**Registro de decisión:** `STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md` · SHA-256 `da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67` · decisión **H-P2-1** aceptada en la
Phase 2 Build Authorization del 2026-09-09 (copia aceptada en `docs/PHASE_2_AUTHORIZATION_PACKET.md`).
El texto v1.0 no se modifica; este anexo fija las dos celdas que v1.0 dejaba como
**PRERREQUISITO DE IMPLEMENTACIÓN** y cierra la deuda D-12 (a). Ambas celdas quedaron
determinadas por los documentos gobernantes y por la propia Phase 1A; la aceptación es el
acto de gobernanza, no una elección entre opciones.

### A · Enumeración cerrada de `item_type`

1. `item_type` es un tipo enumerado de base de datos con **exactamente cuatro** valores:
   `LEARNING_UNIT`, `QUESTION`, `PRACTICAL`, `CONCEPT_REVIEW`. Son los cuatro nombres
   recomendados de la matriz v1.0, ahora vinculantes como literales.
2. Los tres candidatos no determinados por los documentos gobernantes (simulacro, material
   de repaso personal, diagnóstico) **siguen excluidos**. Incorporar cualquiera exige, como
   dice el punto 6 del patrón, migración, actualización de esta matriz y tests.
3. Cada valor corresponde a una única columna de destino, y el `CHECK` del punto 2 del patrón
   exige que la columna poblada sea exactamente la del `item_type` declarado.

### B · Comportamiento de borrado

1. **`ON DELETE RESTRICT` en las cuatro claves foráneas de destino**, en `session_items` y,
   cuando se implemente en Phase 4, en `planner_items`.
2. Motivo: Phase 1A hizo regla de base de datos que **una fila canónica publicada no se borra,
   se retira** (DI-1A-3; triggers de las migraciones 04, 08 y 14). Un destino retirado sigue
   siendo resoluble, de modo que el historial de sesión conserva a qué apuntó cada ítem
   (EC-005). `RESTRICT` es la única opción compatible con el punto 5 del patrón: ni
   `CASCADE` (borraría evidencia de sesión en silencio) ni `SET NULL` (dejaría un ítem sin
   destino, prohibido por el `CHECK`).
3. El único borrado admitido de filas canónicas es la purga de packs íntegramente GENERATED
   (`purge_generated_pack`, PI-1A-5). Con `RESTRICT`, la purga de un pack que tenga ítems de
   sesión referenciándolo falla; la purga de fixtures de Phase 2 borra antes las sesiones,
   ítems, eventos e intentos sintéticos de los usuarios de prueba, que se dan de baja al
   terminar cada ejecución (§33 de la autorización de Phase 2).

### C · Matriz completa (sustituye las celdas PRERREQUISITO de v1.0)

| `item_type` | Columna FK → tabla | Clasificación | Regla de propiedad | `ON DELETE` | `session_items` | `planner_items` |
| --- | --- | --- | --- | --- | --- | --- |
| `LEARNING_UNIT` | `learning_unit_id → learning_units(id)` | Canónico | No aplica | **RESTRICT** | Sí · Phase 2 | Sí · Phase 4 |
| `QUESTION` | `question_id → canonical_questions(id)` | Canónico | No aplica | **RESTRICT** | Sí · Phase 2 | Sí · Phase 4 |
| `PRACTICAL` | `practical_id → practicals(id)` | Canónico | No aplica | **RESTRICT** | Sí · Phase 2 | Sí · Phase 4 |
| `CONCEPT_REVIEW` | `concept_id → concepts(id)` | Canónico | No aplica | **RESTRICT** | Sí · Phase 2 | Sí · Phase 4 |

### D · Prerrequisito de existencia del destino `LEARNING_UNIT`

`learning_units` no existía en Phase 1A (SD-020 lo difirió). La decisión **H-FPS-1**
(opción A, misma autorización) lo crea en Phase 2 como adenda de contenido canónico a través
de la frontera `ingest` de Phase 1A: identidad estable (`learning_units`) más contenido
versionado e inmutable (`learning_unit_versions`), en el mismo patrón que SD-021 para las
preguntas. Solo contenido GENERATED en Phase 2; el contenido oficial llega por Phase 1B.

### E · Qué registra el ítem además del destino

El destino identifica **qué** se programó; la evidencia necesita además **qué versión se
presentó**. Para `QUESTION`, el ítem registra `presented_representation_id`
(`question_representations`), fijado por el servidor al aceptar `QUESTION_PRESENTED` y
inmutable desde entonces (SD-023). Para `LEARNING_UNIT`, `presented_learning_unit_version_id`
del mismo modo al aceptar `LEARNING_UNIT_VIEWED`. Ninguna de las dos columnas es un destino
alternativo: el `CHECK` de exclusividad no las contempla y solo pueden poblarse cuando el
`item_type` correspondiente lo admite.

### F · Alcance de la autorización

Este anexo autoriza la migración de `session_items` de Phase 2 con las pruebas negativas del
punto 7 del patrón y la prueba de que cada columna de destino tiene clave foránea real con
`RESTRICT`. **No autoriza** `planner_items` (Phase 4) ni ningún motor.
