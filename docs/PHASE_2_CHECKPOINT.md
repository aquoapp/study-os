# STUDY OS · Checkpoint de Phase 2 · Learner & Evidence Core

Conforme a `STUDY_OS_Checkpoint_Contract_v1.0`.

```text
PHASE: 2 · Learner & Evidence Core
BRANCH: phase/2-learner-evidence-core (parte de main = 0cf74678f80b7df19a8a61194ea9f5b3e72f4514)
COMMIT: <HEAD final> · sin merge, sin tag: la aceptación humana no se ha producido
STATUS: PASS WITH DEBT
```

**Autorización.** Phase 2 Build Authorization del 2026-09-09
(`STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md` · SHA-256
`da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67`, copiado con cabecera de
aceptación en `docs/PHASE_2_AUTHORIZATION_PACKET.md`). Autoriza BUILD sobre STAGING; **no**
autoriza merge final, tag, Release, congelación, FPS, Phase 1B, Phase 3 ni ninguna mutación
de PRODUCTION. La rama se detiene aquí.

---

## MODEL HANDOFF RECOVERY

Este checkpoint cubre un BUILD ejecutado por **dos modelos**. Fable 5.1 agotó su límite de
uso a mitad de la implementación; Opus 5 recuperó el estado, lo verificó y lo completó. La
distinción importa para auditar quién construyó qué y qué estaba realmente probado.

**Estado heredado.** La rama existía con **cero commits**: las migraciones 15–18, el
contrato de dominio, el arnés y doce suites de ADR-008 vivían solo en el árbol de trabajo,
ya aplicadas a STAGING. Nada se había perdido, pero nada era durable. La reconstrucción
forense (`STUDY_OS_Phase_2_MODEL_HANDOFF_RECOVERY_58c21a7.md`, fuera del repositorio)
comparó árbol, historial de Git, historial de migraciones, catálogo real de STAGING,
PRODUCTION y Vercel antes de tocar nada.

**Qué resultó falso de lo narrado.** Ninguna afirmación sobre el *código*: los ficheros
estaban completos, sin truncar, sin marcadores ni suites vacías. Lo que estaba mal era la
*verificación*: el último comando que el modelo anterior dio por lanzado había **fallado**
(una suite de siete en rojo), el `typecheck` estaba en rojo por un import sin usar, el
registro de huellas de migración listaba 15 unidades frente a 19 en disco, cuatro suites de
intentos no se habían ejecutado nunca y quedaba un usuario de prueba huérfano en STAGING.

**Qué se preservó.** Todo el trabajo correcto de Fable: las cuatro migraciones con sus
rollbacks, el contrato de canonicalización en SQL y TypeScript, el arnés de fixtures y las
doce suites de ADR-008. No se reescribió nada por preferencia de estilo.

**Qué reparó y completó Opus.** Los cinco defectos de arriba; después, la corrección
obligatoria §2 (SD-023), el aislamiento RLS por tabla, la continuidad de sesión, la
confianza y la respuesta en blanco, el red team de Phase 2, el ciclo de vida de las unidades
de aprendizaje, el alcance negativo y el onboarding mínimo. En el camino aparecieron **cuatro
defectos propios**, todos corregidos y todos con prueba de regresión: dos comentarios de
`public` que nombraban el esquema `ingest` y que PostgREST publicaba como descripción del
OpenAPI; un rollback que violaba una clave foránea contra la auditoría de promoción; el
roundtrip alcanzando el límite de línea de comandos de Windows; y una fuga de orden en la
limpieza del E2E.

**Resiliencia.** Desde el primer commit (`58c21a7`) la rama avanza por slices coherentes, de
modo que otra interrupción se recupera solo con Git.

---

## Por qué PASS WITH DEBT

Los nueve gates P2-G1 … P2-G9 están en **PASS**. La deuda que impide el `PASS` limpio es la
heredada y aceptada de fases anteriores —encabezada por **D-13**, que impide ejecutar el
nivel B de `schema-drift` en la máquina de desarrollo por decisión humana de no instalar
Docker— más dos entradas nuevas de arnés de pruebas (**D-22**, **D-23**), ninguna de las
cuales toca seguridad, evidencia ni corrección. Ningún hallazgo fue un fallo duro: ninguna
clave de respuesta fue legible por ninguna ruta, ninguna escritura cruzada prosperó, ningún
evento se corrompió, ninguna idempotencia falló y PRODUCTION no se tocó.

---

## AUTHORITY

| Decisión | Estado en Phase 2 |
| --- | --- |
| ADR-007 v1.1 (H-P2-1) | `ACCEPTED` · implementado: `session_items` con cuatro `item_type`, CHECK de exactamente un destino y `ON DELETE RESTRICT` |
| ADR-008 (SD-018) | `ACCEPTED` · implementado sin enmienda: puntos 1–9 y 11 y «el mismo orden para `question_attempts`». El punto 10 (watermarks) acompaña a la primera proyección, Phase 3 |
| SD-022 (H-P2-2) | `ACCEPTED` · canonicalización v1 en SQL y en `@study-os/domain`, con vectores de referencia comparados entre ambas |
| SD-023 (§2) | `ACCEPTED` · aclaración, no enmienda: `client_created_at` nunca elige representación ni clave |
| SD-008 (BD-03) | `ACCEPTED` · escala de confianza v1, cuatro niveles, sembrada e inmutable |
| H-FPS-1 | opción A · `learning_units` como adenda de contenido canónico por la frontera de Phase 1A, solo GENERATED |
| H-P2-3 | `append_learning_event` y `create_study_session` son las únicas RPC invocables por cliente |
| ADR-005, ADR-001…004 | `PROPOSED` · sin cambios |

## GIT

| Elemento | Valor |
| --- | --- |
| Rama | `phase/2-learner-evidence-core` |
| Base | `main` = `0cf74678f80b7df19a8a61194ea9f5b3e72f4514` (merge del aterrizaje de gobernanza, PR #6) |
| Commits | siete slices coherentes desde `58c21a7` |
| Merge / tag | **ninguno** · la aceptación humana no se ha producido |
| Phase 1A | congelada e intacta: tag `phase-1a-v1.0` → `be5a26a`, no se ha movido |

## MIGRATIONS · DOWNS · LOCK

Cuatro migraciones nuevas, todas con rollback y todas registradas en `.lock.json`
(**19 unidades**).

| Migración | Entrega |
| --- | --- |
| `15_learner_core` | `learner_settings`, `learner_exam_goals` (un objetivo `ACTIVE` por usuario), `devices`, `sync_state`, `diagnostic_runs` |
| `16_learning_units` | `learning_units` + `learning_unit_versions` (identidad estable + contenido versionado inmutable) y ampliación de la frontera de ingestión con dos tipos nuevos |
| `17_sessions` | `study_sessions` con grafo de estados, `session_items` con destinos tipados, y `create_study_session` |
| `18_evidence_core` | contadores en `ingest`, `learning_events`, `question_attempts`, `confidence_scales`, canonicalización, validación de esquema de evento, resolución de clave y `append_learning_event` |

Ninguna migración de Phase 0 o Phase 1A se editó.

## SCHEMA · EXPOSURE · PRIVILEGES

| Elemento | Valor verificado en STAGING |
| --- | --- |
| Tablas | `public` 32 · `content` 1 · `ingest` 4 (37 en total) |
| RLS | habilitado y **forzado** en las 37; cero excepciones |
| `anon` | **cero** grants en `public`, `content` e `ingest` (los 29 que existen son de `storage` y `realtime`, esquemas de la plataforma) |
| `authenticated` | `SELECT` en lo publicado; escritura de **su propia fila** solo en `learner_settings`, `learner_exam_goals`, `devices` y `diagnostic_runs`; ninguna escritura directa sobre evidencia ni sesiones |
| `service_role` | DML solo sobre contenido canónico y `profiles`; **solo `SELECT`** sobre el núcleo de aprendiz, la evidencia y los contadores |
| Funciones ejecutables por cliente | exactamente `append_learning_event` y `create_study_session` |
| `SECURITY DEFINER` | todas con `search_path` fijado; cero excepciones |
| Comentarios de `public` | ninguno nombra un esquema no expuesto (defecto propio corregido, con prueba de catálogo) |

## EVENT STREAM · CANONICALIZATION

`stream_position` por usuario, monotónica y sin huecos; contador bloqueado con
`SELECT … FOR UPDATE` **antes** de comprobar `event_id`; idempotencia solo con usuario y hash
canónico coincidentes; conflicto de identidad que revierte sin consumir posición; sin
`ON CONFLICT DO NOTHING` tras asignar posición; sin secuencia global; evidencia tardía que
conserva `client_created_at` y no reordena la historia. Canonicalización v1: claves ordenadas
por punto de código, cadenas NFC, ausente ≠ nulo, arrays en orden, enteros deterministas,
SHA-256 y versión almacenada por fila. Las implementaciones SQL y TypeScript reproducen los
mismos nueve vectores de referencia.

## ATTEMPTS · GRADING · REPRESENTATION AUTHORITY

El intento nace **solo** de un `ANSWER_SUBMITTED` aceptado, en la misma transacción, con la
representación exactamente presentada, la versión de clave resuelta **en servidor** para esa
representación, la corrección calculada en servidor, la confianza con su versión de escala,
la respuesta en blanco preservada como evidencia y el hash canónico completo. El intento es
inmutable: ni el propietario de la base puede editarlo o borrarlo.

**Hallazgo de la propia campaña.** Una representación nueva nace sin clave propia y por eso
**no es presentable** hasta que se publica la suya: la clave de la representación anterior
evalúa opciones que el aprendiz no vería. Es SD-023 §3d funcionando, y quedó fijado como
invariante con prueba en lugar de sortearse.

## SESSIONS · RESUME · DIAGNOSTIC · ONBOARDING

Grafo de estados `PLANNED → ACTIVE → INTERRUPTED → ACTIVE → COMPLETED` con los terminales
cerrados en la base; cierre abrupto en Q7/15 sin pérdida; reanudación en el ítem exacto
contrastada contra el cursor reconstruido desde los eventos; 7 de 15 que cuentan sin ninguna
etiqueta de fracaso; continuidad entre dispositivos; dispositivo obsoleto que no borra
historia. `diagnostic_runs` estructural, enlazada al objetivo. Onboarding mínimo en
`/onboarding`, protegido, con una primera vista **etiquetada como provisional** porque en
Phase 2 no existe Planner.

## TESTS · recuento verificable

| Suite | Contra STAGING | En CI |
| --- | --- | --- |
| Unitarias | **726** en 164 ficheros | verde |
| Integración | **475** en 23 ficheros | verde |
| RLS | **192** en 3 ficheros | verde |
| E2E estáticos | **70** | verde |
| E2E de autenticación | **22** (16 previos + 6 de onboarding) | verde |
| Roundtrip semántico | 944 entradas → catálogo limpio (18) → 944 idénticas · 19 migraciones | verde |
| Deriva de esquema | nivel B **BLOQUEADO** en local (D-13) · **verde en CI** contra STAGING real | verde |

## SECURITY

Campaña adversarial sobre descubrimiento del Data API, `Accept-Profile`, embeds, las catorce
RPC reservadas, rol de servicio, funciones `SECURITY DEFINER`, validación de esquema de
evento, flujo de creación de sesión, y ataques directos contra la base con `attack()` (que
siempre revierte). **Ninguna clave de respuesta fue legible por ninguna ruta**, ni antes del
envío, ni en errores, ni en metadatos, ni en el OpenAPI. Ninguna lectura ni escritura cruzada
entre usuarios prosperó en ninguna de las nueve tablas con propietario.

## SCOPE NEGATIVE

Sin motores, proyecciones, planner, watermarks, `engine_config`, recálculo, puntuación,
notas, IA, cola offline, simulacro, corpus oficial ni superficie de producto de Phase 5 o
FPS. Neutralidad de examen mantenida: el literal del primer pack no aparece en el shell.

## KNOWN DEBT

| # | Deuda | Riesgo | Por qué no bloquea | Cierre |
| --- | --- | --- | --- | --- |
| D-13 | `schema-drift` nivel B exige Docker, que por decisión humana no se instala | Bajo | El control corre en CI contra el stack local y contra STAGING real, y allí está en verde | Aceptada |
| D-18 | Las pruebas de catálogo lanzan el CLI por consulta | Bajo | Solo coste de tiempo | Revisar si el volumen crece |
| **D-22** | El arnés de fixtures reintenta de forma acotada un transitorio de validación de token del borde gestionado, y el de catálogo distingue un fallo de transporte de un rechazo de la base | Bajo | Los patrones son cerrados y estrechos: un rechazo de PostgreSQL nunca se reintenta, de modo que un ataque no puede quedar «rechazado» por la red | Revisar en Phase 3 |
| **D-23** | El rollback de la migración 16 restaura funciones enteras de Phase 1A y ronda los 33 KB | Bajo | El roundtrip ya no depende del límite de línea de comandos; el tamaño solo incomoda la lectura | Al dividir la frontera de ingestión, si se divide |
| D-04…D-12, D-16, D-20, D-21 | Heredadas sin cambios | — | — | Según su fase |

**D-12 quedó cerrada** en el aterrizaje de gobernanza: el anexo v1.1 de ADR-007 y SD-022
fijaron las celdas que estaban pendientes.

## GATES

| Gate | Resultado |
| --- | --- |
| **P2-G1** gobernanza | **PASS** · anexo, SD-008, SD-022, SD-023, H-FPS-1, H-P2-3 y registro de RPC integrados en `main` por PR #6 con CI en verde |
| **P2-G2** esquema y datos | **PASS** · tablas con RLS forzado, pruebas de aislamiento y unidades de aprendizaje por la frontera |
| **P2-G3** evidencia | **PASS** · doce suites de ADR-008, normalización del intento, resolución de clave, confianza y blanco |
| **P2-G4** sesión | **PASS** · grafo de estados, cierre abrupto, reanudación exacta y completitud parcial |
| **P2-G5** preferencias y objetivo | **PASS** · disponibilidad editable sin borrar evidencia; un objetivo activo |
| **P2-G6** seguridad | **PASS** · matriz de catálogo, aislamiento por tabla, red team sin fuga de clave |
| **P2-G7** onboarding mínimo | **PASS** · primera vista alcanzable sin ajustes avanzados, etiquetada como provisional |
| **P2-G8** alcance negativo | **PASS** · ausencia verificada de motores, proyecciones, puntuación, corpus y superficie |
| **P2-G9** entorno | **PASS** · CI en verde, roundtrip semántico, PRODUCTION sin mutar, control de releases vigente |

## ENVIRONMENTS

**STAGING `xzcrqsolxarutlvvkzfp`** · único entorno mutable. Estado de cierre: 19 migraciones,
37 tablas, 0 usuarios, 0 packs, 0 eventos, 0 intentos, 0 promociones, 0 ítems en staging, y
la escala de confianza `v1` activa (dato de esquema, no residuo). El roundtrip de cierre dejó
la firma idéntica.

**PRODUCTION `nzcgufeycvehczroryoe`** · **no mutado**: 0 tablas y 0 migraciones en cada
lectura, antes y después del BUILD. Ninguna operación de escritura se intentó.

**Vercel `study-os`** · control de releases vigente: el *Ignored Build Step* sigue cancelando
toda construcción de Production. Los Preview de la rama se construyen contra STAGING.

## STOP CONDITIONS

Ninguna de las quince se activó. En particular: no hizo falta enmendar ADR-008 —SD-023 es
aclaración—, ninguna semántica de Phase 1A cambió, no se requirió corpus oficial, no se
expandió la frontera de seguridad más allá de las dos RPC declaradas, y ninguna prueba
necesitó debilitar un invariante.

## NEXT AUTHORITY

Aceptación humana de Phase 2 por Ana Victoria con revisión independiente. Hasta entonces: sin
merge, sin tag, sin Release, sin FPS, sin Phase 1B, sin Phase 3 y sin despliegue.
