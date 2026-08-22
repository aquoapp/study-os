# STUDY OS · invariant-register.md

**Fase:** −1 · Specification Compilation
**Estado:** PROPUESTO · pendiente de aprobación humana
**Versión:** 1.2 · patch correctivo (OBS-01 e INV-103 corregidos)
**Regla:** un invariante sin enforcement mecánico es una intención, no un control. Cada fila declara cómo se convierte en test, constraint o política.

Leyenda de `Aprobación`: **SÍ** = cualquier cambio exige ADR aceptado + aprobación de Ana (Engineering Constitution EC-019).

---

## 1. Invariantes constitucionales (EC-001 … EC-020)

| ID | Regla | Fuente | Módulos / tablas afectadas | Enforcement mecánico | Fase intro | Fases que lo tocan | Aprobación |
|---|---|---|---|---|---|---|---|
| EC-001 | Contenido canónico versionado y separado de generado/personal | Constitution; Master §30; CDEM §1 | `sources`, `source_versions`, `learning_units`, `canonical_questions`, `generated_artifacts`, `personal_review_material` | CHECK sobre `provenance_class`; grants: sin INSERT/UPDATE de usuario en esquema `content`; test de integración "personal→canónico rechazado" | 1 | 1,8,10 | SÍ |
| EC-002 | Mastery lo calcula un motor determinista y versionado; un LLM no lo asigna | Constitution; Master §13; TA §2.2 | `concept_mastery`, `mastery_history`, `packages/learning-engine` | Escritura de proyecciones solo por rol de servicio; test de reproducibilidad; regla de CI: el endpoint de IA no importa el engine ni escribe proyecciones | 3 | 3,8 | SÍ |
| EC-003 | Planner determinista, versionado, auditable, con `reason_codes` | Constitution; Master §24; LS v0.4 P01–P08 | `planner_runs`, `planner_items`, `packages/planner-engine` | Test golden: mismos inputs + versión ⇒ mismo plan y mismos reason_codes; NOT NULL en `reason_codes_json` | 4 | 4,7,8 | SÍ |
| EC-004 | Mastery ≠ Exam Readiness | Constitution; Master §23; UX-007 | `concept_mastery`, `exam_readiness` | Tablas separadas sin FK de derivación directa; test AT-32; design gate DS-06 en E2E | 3 | 3,6,7 | SÍ |
| EC-005 | Evidencia aceptada append-only, versionada por esquema, idempotente | Constitution; CDEM §10 | `learning_events` | Sin políticas RLS de UPDATE/DELETE para el usuario; trigger que rechaza UPDATE en flujo normal; PK `event_id` | 2 | 2,9 | SÍ |
| EC-006 | Estado derivado reconstruible para (engine_version, watermark) | Constitution; CDEM §25 | todas las proyecciones | Job de rebuild + test que compara proyección incremental vs reconstruida | 3 | 3,4,6,7,10 | SÍ |
| EC-007 | El intento conserva la versión de clave usada; la rectificación crea recálculo | Constitution; Master §18 | `question_attempts`, `answer_key_versions`, `attempt_recalculations` | FK NOT NULL `answer_key_version_id`; test AT-19; prohibición de UPDATE sobre `is_correct_at_submission` | 1–2 | 1,2,10 | SÍ |
| EC-008 | OFFICIAL / VERIFIED / GENERATED / PERSONAL distinguibles en datos y UI | Constitution; Master §30 | contenido, notas, artefactos generados | Enum + NOT NULL; test AT-16/AT-17; componente `ProvenanceChip` obligatorio en superficies de contenido | 1 | 1,5,8 | SÍ |
| EC-009 | Aislamiento RLS probado en toda tabla expuesta de usuario | Constitution; TA §5.3 | todas las tablas con `user_id` | Política RLS por tabla + **test de aislamiento obligatorio en la misma migración** | 0–2 | todas | SÍ |
| EC-010 | Secretos de servicio/proveedor nunca en cliente | Constitution; TA §10 | build web | Check de CI que escanea el bundle; variables `NEXT_PUBLIC_` en allowlist | 0 | todas | SÍ |
| EC-011 | Cambios de esquema como migraciones versionadas en repo | Constitution; TA §5.1 | `/supabase/migrations` | Check de CI: diff de esquema vs migraciones; prohibición de edición por dashboard | 0 | todas | SÍ |
| EC-012 | Offline acotado; la UI no afirma sincronización sin confirmación | Constitution; Master §33–34 | cola local, `sync_state` | Estado derivado solo de ACK del servidor; test E2E de estado falso | 2 (contrato) / 9 (impl) | 2,9 | SÍ |
| EC-013 | El replay offline/retry no duplica evidencia ni intentos | Constitution; CDEM §29.3 | `learning_events`, `question_attempts` | UNIQUE en `learning_events.event_id`; **UNIQUE + FK NOT NULL en `question_attempts.submitted_event_id` → `learning_events.event_id`** (mecanismo principal); INSERT con ON CONFLICT DO NOTHING; test `attempt.idempotentBySubmittedEvent.spec` | 2 | 2,9 | SÍ |
| EC-014 | Tiempo reducido, interrupción y ausencia son estados de planificación | Constitution; Master §8–9 | planner, HOY, copy | Test de planner: 0 min ⇒ sin backlog; lint de copy prohibido (ver INV-107) | 4 | 4,5,7 | SÍ |
| EC-015 | IA primaria exactamente: HOY · APRENDER · ENTRENAR · PROGRESO · PLAN | Constitution; Master §4; UX-001 | shell de navegación | Constante única `PRIMARY_SPACES` con test de longitud e igualdad | 0 | 5,7,8 | SÍ |
| EC-016 | Notas es transversal; no se convierte en conocimiento canónico en MVP | Constitution; Master §27 | `notes`, `personal_review_material` | Sin ruta de promoción implementada; test de frontera | 8 | 8 | SÍ |
| EC-017 | Sin XP, monedas, ranking ni economía de rachas | Constitution; Master §37 | UI completa | Revisión de design gates + ausencia de entidades de gamificación | 5 | 5,7 | SÍ |
| EC-018 | TAI es un pack; el shell es exam-neutral | Constitution; Master §1.2 | todo el shell | Check de CI: prohibido el literal `TAI` fuera de `content/` y de seeds; test "segundo pack sin cambio de esquema" (CDEM §29.11) | 1 | todas | SÍ |
| EC-019 | Ningún cambio silencioso de invariante congelado | Constitution; ADR Policy | proceso | Checkpoint exige `INVARIANTS VERIFIED`; PR template referencia ADR | −1 | todas | SÍ |
| EC-020 | Fase completa solo con gates ejecutables en verde | Constitution; Checkpoint Contract | proceso | CI bloqueante; el checkpoint no puede decir PASS con tests rojos | −1 | todas | SÍ |

---

## 2. Invariantes adicionales derivados de las especificaciones

No están en la Constitution pero son igual de vinculantes según Master/Design System/Closure. Propongo elevarlos a registro formal.

| ID | Regla | Fuente | Enforcement | Fase | Aprobación |
|---|---|---|---|---|---|
| **INV-101** | **La clave de respuesta correcta nunca llega al cliente antes del envío.** `answer_key_versions` y cualquier marca de corrección quedan fuera del Data API; la corrección ocurre en servidor y devuelve resultado + explicación, no la clave | Master §17, §20; Design System §6; derivado de C-13 | Tabla fuera de esquema expuesto; RPC/Edge Function de corrección; test de red en E2E que inspecciona el payload de CHECK y de simulacro | 1–2 | SÍ |
| INV-102 | La confianza se captura **antes** del feedback | Master §14; Design System §6; Screen Design 04_CHECK | Máquina de estados del intento: `CONFIDENCE_RECORDED` obligatorio antes de `FEEDBACK_VIEWED`; test AT-11/AT-12 | 5 | SÍ |
| INV-103 | La selección previa al envío **se ve** —confirmar la elección es requisito de usabilidad— pero **solo con énfasis neutral**: sin tokens, iconos, textos ni atributos de correcto/incorrecto, sin cambiar el orden y sin revelar la clave. Debe exponer `aria-checked`/`aria-selected` según el componente | Master §17; DS-03 | `check.selectionEmphasisIsNeutral.spec`: verifica estado de selección presente y accesible, y ausencia de señales de corrección | 5 | SÍ |
| INV-104 | Una sola acción primaria dominante por estado móvil | Master §38; Design System §5; WF-09 | Test de componente: máximo un `PrimaryButton` por vista móvil | 5 | NO (revisión de diseño) |
| INV-105 | Ningún estado se comunica solo por color | Master §35; DS-08 | Test de accesibilidad: todo estado semántico expone `label` + icono | 5 | NO |
| INV-106 | El override de hoy no altera la disponibilidad por defecto; el cambio de default replanifica el futuro y no reescribe el pasado | Master §7; LS v0.4 P04 | Test de planner explícito en ambas direcciones | 4 | SÍ |
| INV-107 | El copy no atribuye fracaso moral a interrupción, tiempo reducido o ausencia | Master §35; Edge States §10; UX-009 | Lista de términos prohibidos verificada en CI sobre ficheros de copy (`fallida`, `atrasado`, `perdiste`, `racha`, …) | 5 | NO |
| INV-108 | Ninguna revisión vencida se elimina silenciosamente del plan | LS v0.4 P01 | Test de planner: las revisiones vencidas se conservan o se explican vía `reason_codes` | 4 | SÍ |
| INV-109 | Contenido normativo desactualizado o bloqueado no puede asignarse como aprendizaje | LS v0.4 P05 | Filtro de `source_version.status` en la selección del planner y en la recuperación de IA | 4 / 8 | SÍ |
| INV-110 | Ningún ítem asciende a OFFICIAL sin fuente primaria; sin fuente verificable queda en cuarentena | LS v0.4 Ingestion Contract | Estado `QUARANTINE` en staging + constraint que exige `source_version_id` para `provenance_class='OFFICIAL'` | 1 | SÍ |
| INV-111 | No se muestran porcentajes exactos de dominio/readiness por debajo del umbral de evidencia definido | Master §6; OB-07; derivado de C-24 | Función de presentación que devuelve banda + texto cuando `evidence_count < umbral`; test unitario | 7 | NO |
| INV-112 | El tiempo de estudio registrado no incluye inactividad | Closure SC-08 / AT-04 | Pausa por inactividad + test de que el tiempo activo no se infla | 5 | NO |
| INV-113 | **El servidor es la autoridad exclusiva para persistir Mastery, Exam Readiness y estado del Planner.** Ninguna ruta de cliente escribe esas proyecciones. Se permiten helpers y proyecciones locales explícitamente **no autoritativas** (feedback optimista, estimaciones offline) siempre que estén marcadas como tales y sean sustituidas por la proyección del servidor al sincronizar | Derivado de TA §3.3 + C-25; ADR-001 v1.1 | Grants: solo rol de servicio escribe `concept_mastery`, `exam_readiness`, `planner_*`; test `client.no-authoritative-write.spec`; toda proyección local expone `authoritative: false` | 0 | SÍ |
| INV-114 | El documento recuperado es dato, nunca instrucción | Master §30; TA §7.4; Manifest §14 | Delimitadores en el prompt + test de inyección con documento hostil | 8 | SÍ |
| INV-115 | Todo endpoint de IA declara inputs, contexto, output permitido, mutaciones prohibidas, timeout y telemetría de coste | Manifest §15 | Tipo `AITaskContract` obligatorio por endpoint; test que rechaza endpoints sin contrato | 8 | SÍ |

---

## 3. Invariantes en observación (no bloqueantes todavía)

| ID | Regla | Motivo de no ser bloqueante aún |
|---|---|---|
| OBS-01 | Los pesos de Mastery, del Planner y del Risk Engine son **hipótesis** declaradas, no reglas validadas | **Corregido en v1.2.** Calibrarlos **requiere un dataset representativo y suficiente, con criterio de suficiencia definido y aprobado. USER_001 solo aporta evidencia formativa** (UX y bucle), no potencia estadística. Hasta entonces viven en `engine_config` versionada e inmutable por versión (ADR-003 · SD-013), nunca como constantes de código, y no se presentan al usuario como precisión. |
| OBS-02 | Los umbrales del Risk Engine (contestar vs blanco) no se fijan hasta tener datos reales | LS v0.4 lo declara explícitamente. Criterio de suficiencia de dataset por definir y aprobar (`deferred-requirements` §7). No exponer recomendación de riesgo en MVP. |
| OBS-03 | La política de borrado de cuenta debe definirse antes de producción | CDEM §24 lo deja abierto. Requisito de Phase 11. |
