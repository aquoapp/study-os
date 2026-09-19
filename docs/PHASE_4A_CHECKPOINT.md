# STUDY OS · Phase 4A · Planner Domain / Decision Engine · BUILD CHECKPOINT

**Formato:** `Checkpoint Contract v1.0`.
**Alcance:** P4-D6 (el Learning Engine proyecta la clave de P4-D5) y BUILD completo de Phase 4A,
construidos el 2026-09-19 como **candidato**. **Sin merge, sin tag, sin congelación**, sin Phase 4B
y sin PRODUCTION.
**Fecha:** 2026-09-19.
**Autoridad:** `docs/PLANNER_CONTRACT.md` v1.4 · ADR-012 (anexos v1.1 … v1.4) ·
`docs/LEARNING_ENGINE_CONTRACT.md` v1.1 (anexo §25) · `docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md`
· SD-030 … SD-032.

**PHASE 4A · CANDIDATO · HUMAN DECISION REQUIRED.** Todo lo que el contrato define está construido
y probado en la frontera real de runtime. Dos puntos necesitan decisión humana antes de la
aceptación (§M): el **alcance de la unicidad de sesión abierta** (P4-G10, OBS-4A-B2) y la
**ratificación del código de exclusión `NO_PUBLISHED_UNIT`** (OBS-4A-B1).

---

## A · Base exacta

| Campo | Valor |
| --- | --- |
| `main` | `a96cafc86830238ae813e80763530f0455ee56ac` (PR #18 · P4-D6 aterrizado) |
| Gobernanza de Phase 4A en `main` | PR #17 → `3a8025f` · PR #18 → `a96cafc` |
| Rama | `phase/4a-planner-domain`, descendiente limpio de `a96cafc` |
| Candidato | la punta de la rama. El SHA no se escribe aquí: un documento no puede contener el hash del commit que lo contiene. Vive en el manifiesto del paquete de evidencia y en el informe de cierre |

## B · Qué se ha construido

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| P4-D6 · hecho del motor | `packages/learning-engine` · migración 22 | `last_negative_position` por (persona, concepto): la posición de stream del intento elegible más reciente INCORRECT o BLANK, en el mismo pliegue que el estado; fuera del vector; tres CHECK (positiva, dentro del watermark, no nula ⇔ reparación) |
| Planner puro | `packages/planner-engine` | decisión determinista: elegibilidad con razón, necesidad categórica, granularidad híbrida, reparación por la última evidencia negativa más antigua, `EXPOSED` antes que `NEW`, una reparación en la cabeza, empaquetado que salta lo que no cabe; texto canónico, SHA-256 y reproducción |
| Esquema | migración 23 | `profiles.timezone`, `planner_config`, `planner_runs`, `planner_items`, `planner_run_audit`, FK `study_sessions.planner_run_id` RESTRICT, una sesión por ejecución y exclusión de la sesión planificada |
| Frontera de servidor | migración 23 | `planner_context`, `engine_planner_snapshot`, `create_planner_run` (revalidación en la misma transacción), `start_planned_session` (idempotente) · **solo rol de servicio** |
| Módulo real | `apps/web/src/server/planner` | puesta al día bloqueante del motor, recálculo ante entrada cambiada, negativa veraz sin fuente de duración; **ninguna ruta lo consume** |

## C · Commits

| Commit | Contenido |
| --- | --- |
| `613b405` | P4-D6 · el motor proyecta `last_negative_position` (migración 22) |
| `fc72e75` | paquete puro `@study-os/planner-engine` y su batería pura |
| `98248df` | migración 23, módulo de servidor y prueba en la frontera real |
| `4687543` | revalidación no reintentable, exclusión acotada, auditoría completa, enmiendas de catálogo |
| `c2ff1e4` | rendimiento del día de plan; ADR-012 `AUTHORIZED` sin integrar |
| punta | este checkpoint y la documentación de estado |

## D · Migraciones

| Migración | Rollback | STAGING |
| --- | --- | --- |
| `00000000000022_engine_last_negative_position.sql` | sí | aplicada |
| `00000000000023_planner_domain.sql` | sí | aplicada |

24 migraciones; `.lock.json` coherente. Ninguna migración anterior se ha editado. Las guardas que
fijaban el recuento de Phase 3 se acotaron **por nombre**: todo lo posterior a la 21 tiene que
ser la 22 o la 23.

## E · P4-D6 · la semántica, derivada y no elegida

Se derivó del contrato del motor sin inventar nada: el estado `EVIDENCE_NEGATIVE`/`CONFLICTING`
existe exactamente cuando hay un intento elegible no correcto (§9.1), los patrones de §17 solo
nacen de intentos no correctos, y la elegibilidad de §5.1 (atribución PRIMARY VALIDATED de la
versión declarada, sin diagnóstico, hasta el watermark) es la misma que ya usa el pliegue. Por eso
el campo es no nulo **exactamente** en reparación, y la base lo impone con un CHECK.

- Pruebas puras: reglas, elegibilidad (diagnóstico, sin atribución, más allá del watermark,
  anomalía temporal, cambio de generación) y la invariante sobre **9 330** secuencias
  exhaustivas. El golden del motor cambia con motivo documentado.
- Frontera real (`engine.lastNegativePosition.spec`): el módulo real persiste la posición exacta;
  `rebuild == incremental` (EC-006) también para este campo; la base rechaza las tres
  manipulaciones; leer y terminar una unidad no mueve la clave; un fallo nuevo la mueve
  exactamente; ningún cliente la alcanza.

## F · Zona horaria · clasificación B

CDEM v1.0 §3 (congelado, nivel 3) ya define `profiles.timezone` y «el usuario lee y actualiza su
fila». Está **autorizada y no implementada**: se implementa sin inventar política.

- nombre IANA validado contra el catálogo **al declararlo** (se rechazan `CET`, `+02:00`,
  minúsculas, vacíos);
- nula mientras no se declare: el Planner responde `TIMEZONE_REQUIRED` y no escribe nada;
- **nunca** se deduce del servidor, de la IP ni del navegador, y **nunca** se rellena con UTC;
- la persona solo declara la suya (concesión de columna + política RLS existente).

## G · P4-D2 sigue diferida

- ninguna migración ni paquete introduce duración de contenido ni valores por defecto;
- la duración es una **fuente inyectada** (`DurationSource`); el tipo solo admite procedencia
  `FIXTURE` y la base lo impone (`planner_runs.duration_provenance = 'FIXTURE'`);
- sin fuente, el módulo real responde **`DURATION_SOURCE_UNDECIDED` y no escribe nada**. Es la
  negativa veraz: la producción de 4A no planifica hasta que P4-D2 dé un origen;
- las pruebas inyectan duraciones de fixture; ninguna es constante de runtime (lo vigila
  `phase4a.governance.spec`).

No se ha colado P4-D2 por un argumento obligatorio: el argumento es opcional y su ausencia es
la negativa.

## H · Pruebas

| Batería | Resultado |
| --- | --- |
| Unitarias (incluidas gobernanza, contrato, diferencial, corpus, rendimiento) | ver §L · todas en verde |
| Diferencial exhaustivo contra el oráculo de gobernanza | 34 848 casos (2 conceptos, todo el dominio) + 15 972 (3 conceptos) · **0 discrepancias** |
| Controles de mutación | 14 variantes rechazadas · **14 muertas** |
| Simulación longitudinal en paralelo con el oráculo | **1 008 trayectorias × 100 sesiones** (100 800 sesiones) · 0 discrepancias · 0 excesos de presupuesto · 0 positivos reciclados · todos los desenlaces y razones recorridos |
| Metamórficas | permutación, traslación de posiciones, escala de presupuesto y duraciones, positivos añadidos |
| Corpus sintético | 40 y 100 conceptos, 3 semillas, barrido 0–120 minutos |
| Rendimiento (decisión + canónico + hash, mediana) | 40 → ~2,4 ms · 100 → ~3,8 ms · 500 → ~16,7 ms · 1000 → cota 800 ms |
| Frontera real del Planner (`planner.runtime.spec`, STAGING) | 31 casos · ver §L |
| Integración completa (STAGING) | ver §L |
| RLS (STAGING) | ver §L |

## I · Hallazgos del BUILD, corregidos antes del candidato

| Id | Hallazgo | Corrección |
| --- | --- | --- |
| BF-1 | La revalidación se señalaba con `serialization_failure` (40001). **PostgREST reintenta por sí solo** las transacciones 40001: una escritura atrasada entraba en bucle hasta el tiempo límite del gateway | `STALE_INPUT` usa 55000; el recálculo lo hace el servidor. Diagnosticado observando `pg_stat_activity` durante la carrera |
| BF-2 | Con `ZERO_TIME`, los candidatos elegibles quedaban en la auditoría **sin razón** | todo elegible no colocado lleva `OVER_BUDGET`, también con presupuesto cero (§S). Lo encontró el corpus sintético |
| BF-3 | `pg_timezone_names` en el camino de cada petición: **~0,5 s por consulta** medido en STAGING | la zona se valida al declararla; el día de plan no vuelve a consultar el catálogo |
| BF-4 | Una unicidad global de sesión abierta rompía el comportamiento congelado de `create_study_session` y 32 pruebas congeladas | alcance acotado al Planner y decisión humana (§M, OBS-4A-B2) |
| BF-5 | Regex de la guarda de override sin barras invertidas en el primer commit | corregida |

## J · Seguridad y autoridad

- Un plan es una decisión que el cliente no puede redactar: las cuatro funciones del Planner son
  **solo de rol de servicio**; la superficie invocable por cliente sigue en **dos RPC**.
- `planner_runs` e `planner_items`: RLS forzado, lectura propia **por columnas seguras** (ni
  versiones, ni tupla del motor, ni hash, ni razones); sin escritura de cliente.
- `planner_run_audit` y `planner_config`: **ninguna** concesión de cliente.
- Ningún esquema privado nuevo; `engine` no se amplía (ADR-011 anexo v1.1 intacto); la lectura
  del motor es un envoltorio `public.engine_*` invoker, igual que en Phase 3.1.
- INV-101: ninguna entrada ni salida del Planner contiene clave de respuesta.
- Registro de autoridad ampliado por gobernanza (tablas y RPC de servidor).

## K · STAGING

| Momento | Huella semántica (evidencia, intentos, sesiones, configuración del motor, pack de demo) |
| --- | --- |
| antes de la migración 22 | capturada |
| tras 22 y sus suites | **idéntica** salvo la lista de migraciones |
| tras 23 y todas las suites | **idéntica** salvo la lista de migraciones |

La evidencia de Ana no se ha tocado en ningún momento (62 eventos, 10 intentos, 2 sesiones: mismos
hashes). Las ejecuciones fallidas por saturación dejaron residuo sintético, que se purgó por la
frontera gobernada (`purge_generated_pack`) y por el patrón de usuario de prueba; residuo final
**cero**. PRODUCTION no se ha tocado. Vercel no se ha tocado; OBS-3.1-01 sigue abierta y no se ha
añadido ninguna clave.

## L · Resultados

| Comprobación | Resultado |
| --- | --- |
| Unitarias + gobernanza (`test:unit`) | 56 ficheros en verde |
| Integración completa contra STAGING | **662/662** · 32 ficheros (con `--maxWorkers=3`; en paralelo total STAGING Free se satura y aparecen `statement timeout` que cambian de suite en cada ejecución) |
| RLS contra STAGING | **207/207** · 3 ficheros |
| Frontera real del Planner (`planner.runtime.spec`) | 31/31, incluido el recorrido P4-D4 → P4-D5 → P4-D6 de punta a punta |
| Motor tras P4-D6 (6 suites) | 113/113 |
| Roundtrip **acotado** en STAGING (solo 23 y 22) | down → push: huella de datos **idéntica**; firma estructural 1 255 entradas, **solo difiere el `ordinal_position` de las dos columnas añadidas con `ALTER`** (`profiles.timezone`, `concept_mastery.last_negative_position`): PostgreSQL no reutiliza `attnum`. El roundtrip completo con firma exacta es el de CI sobre base limpia |
| Huella de STAGING (evidencia de Ana, sesiones, configuración del motor, pack de demo) | idéntica a la previa a Phase 4A, salvo la lista de migraciones |
| Residuo | cero: un usuario (Ana), un pack (`demo-estudio-eficaz`), cero ejecuciones del Planner |

## L.1 · Gates

| Gate | Estado | Prueba |
| --- | --- | --- |
| **P4-G1** | PASS | cambiar el valor por defecto replanifica hacia delante; la fila pasada, byte a byte igual |
| **P4-G2** | PASS · dominio | la precedencia con override está probada en el paquete; en 4A no existe almacenamiento del override (su captura es 4B), así que nada puede tocar el valor por defecto |
| **P4-G3** | PASS | un cero declarado para hoy da `ZERO_TIME`, cero ítems, sin deuda |
| **P4-G4** | PASS | `explainRun` reproduce la instantánea byte a byte; el hash lo recalcula la base |
| **P4-G5** | PASS | orden de filas invariante; peticiones repetidas y concurrentes dan la misma ejecución |
| **P4-G6** | PASS | un destino tipado, versión fijada, RESTRICT, mismo pack, inmutable |
| **P4-G7** | PASS | puesta al día bloqueante; con fallo inyectado en la frontera, `PLAN_UNAVAILABLE_ENGINE` sin escritura |
| **P4-G8** | PASS | duraciones de fixture; `NOTHING_FITS`, `ZERO_TIME`, `NOTHING_ELIGIBLE` |
| **P4-G9** | PASS | reanudación, reutilización, replanificación, cadena append-only, `RUN_SUPERSEDED`, `RUN_STALE` |
| **P4-G10** | **PASS ACOTADO · DECISIÓN HUMANA** | sesión planificada exclusiva y arranque idempotente; la unicidad entre sesiones ajenas al Planner no se impone (OBS-4A-B2) |
| **P4-G11** | PASS | RLS, columnas seguras, sin escritura ni RPC de cliente, registro y guardas por gobernanza |
| **P4-G12** | PASS | lista blanca de `planner_config`, vocabulario, `NOTHING_ELIGIBLE` sin preparación |
| **P4-G13** | PASS · pendiente de CI | roundtrip acotado, deriva limpia, residuo cero, PRODUCTION intacto; el roundtrip completo lo da CI |
| **P4-G14** | PASS · E2E en §L.2 | regresión completa de integración y RLS |
| **P4-G15** | PASS | ninguna ruta consume el Planner; solo `GENERATED` |
| **P4-G16** | PASS | módulo real contra PostgREST y la base reales |
| **P4-G17** | PASS | el Planner no emite eventos |
| **P4-G19** | PASS | sin necesidad autorizada no se fabrica actividad |
| **P4-G20** | PASS | exactamente una reparación en la cabeza |
| **P4-G21** | PASS | planificar dos veces da el mismo plan; leer sin comprobar no mueve nada |
| **P4-G22** | PASS | 12 → 10 y 2 minutos sin usar; salta lo que no cabe |
| **P4-G23** | PASS | la auditoría guarda la posición exacta que ordenó la reparación |

P4-G18 pertenece a Phase 4B.

## L.2 · E2E

| Batería | Resultado |
| --- | --- |
| `test:e2e:auth` contra STAGING (`next build` real) | **32/32**: alta y login, cookie forjada rechazada, onboarding, **vertical completo del FPS** (`fps-fixed-v1` intacto) y motor en la aplicación real; limpieza por ejecución con residuo cero |
| `test:e2e:static` | en la ejecución limpia desde `git archive` |

## M · Decisiones humanas y deuda

| Id | Qué | Estado |
| --- | --- | --- |
| **OBS-4A-B2** · P4-G10 | La base impide que una sesión **planificada** conviva con otra abierta (y dos planificadas). **No** impide dos sesiones abiertas ajenas al Planner: Phase 2 congelada lo admite en `create_study_session` y sus pruebas congeladas lo usan en decenas de casos. Extenderlo cambia comportamiento congelado (EC-019) | **DECISIÓN HUMANA**: (a) aceptar el alcance acotado, o (b) extenderlo a toda sesión con análisis de impacto y adaptación del arnés de Phase 2 y FPS |
| **OBS-4A-B1** | `NO_PUBLISHED_UNIT` no está en la lista de §E: nombra una exclusión forzada (§E.2 admite un concepto con solo pregunta, pero APRENDER exige una unidad) | **RATIFICACIÓN**: consta en `planner_config` v1 como `pending_ratification` |
| OBS-4A-B3 | `EVIDENCE_CONFLICTING` es absorbente en el motor v1: una reparación con evidencia mixta no se disuelve nunca. La vivacidad de P4-D5 la hace rotar, no desaparecer | vigilancia · semántica del motor, no del Planner |
| OBS-4A-B4 | §G.1 del contrato dice «la de menor clave de sílabo»; §F.5 y §G.2 (v1.3) dicen «evidencia más antigua». Se implementa §F.5/§G.2, que es la decisión P4-D5 | errata de redacción · no cambia semántica |
| OBS-4A-B5 | La simulación de «día siguiente» en las pruebas retrasa `session_items.completed_at` del aprendiz sintético; no toca evidencia | registrada |
| OBS-4A-B6 | El motor ordena con `localeCompare` (congelado en Phase 3); el Planner compara por punto de código (§H). No afecta a la proyección | vigilancia |
| D-13, D-18, D-20, D-22, D-23 · WATCH-P2-1 · OBS-3.1-01 | heredadas, sin cambios | abiertas y aceptadas |

## N · Lo que sigue sin autorizar

Merge del BUILD, tag, congelación, Phase 4B (HOY consumiendo el plan, superficie del override,
Rescue/Recovery, oferta fuera de presupuesto), P4-D2, Phase 1B, corpus oficial, readiness,
retención, PRODUCTION, Vercel Production, infraestructura de pago y AQUO.
