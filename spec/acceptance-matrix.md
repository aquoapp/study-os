# STUDY OS · acceptance-matrix.md

**Fase:** −1 · Specification Compilation
**Versión:** 1.2 · patch correctivo (IDs C restaurados, invariantes completos, AT reclasificados, criterio de F07 corregido)
**Cobertura:** **123 / 123 requisitos** con prueba ejecutable identificable, tipo, fase, gate y condición de PASS.

**Tipos:** U=unit · I=integración/DB · E=E2E · S=estático/CI · SEC=seguridad/RLS · M=migración.
**Gate:** gate de fase del `Builder Handoff Manifest §10`, gate del `Master §49`, design gate `DS-xx`, wireflow gate `WF-xx`, o test de dato `CDEM-n`.
**Nombre de prueba:** identificador estable que debe existir en el repositorio con ese nombre.

---

## A · Phase 0 — Fundación

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-A01 | `repo.structure.spec` | S | 0 | P0-G1 app boots | Existen las rutas de Manifest §8; CI falla si falta alguna |
| REQ-A02 | `app.boot.e2e` · `pwa.manifest.spec` | S,E | 0 | P0-G1 | La app responde 200 en `/`; manifest válido y `display: standalone` |
| REQ-A03 | `env.separation.spec` | S | 0 | P0-G2 env separation | Tres entornos resuelven URL y claves distintas; producción no aparece en config de staging |
| REQ-A04 | `schema.drift.spec` | S,M | 0 | P0-G4 baseline | El esquema aplicado coincide byte a byte con las migraciones del repo |
| REQ-A05 | `bundle.secret-scan.spec` | S | 0 | P0-G3 no secrets | Cero coincidencias de patrones de clave de servicio/proveedor en el bundle |
| REQ-A06 | `tokens.contract.spec` · `tokens.contrast.spec` | U,S | 0 | P0-G4 | Tokens iguales a Design System §2; todo par texto/fondo ≥ AA |
| REQ-A07 | `auth.signup-login.e2e` · `profile.oneToOne.spec` | I,E | 0–2 | P0-G1 | Alta y login completan; existe exactamente un `profiles` por `auth.users` |
| REQ-A08 | `client.no-authoritative-write.spec` | S,I | 0 | P0-G3 | Ninguna ruta de cliente escribe en `concept_mastery`, `exam_readiness`, `planner_*` |
| REQ-A09 | `primarySpaces.frozen.spec` | U | 0 | P0-G4 | La constante tiene exactamente los 5 valores congelados |

## B · Phase 1 — Contenido canónico

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-B01 | `content.hierarchy.spec` · `concept.selfPrereq.reject.spec` | I | 1 | P1-G1 trazabilidad | Pack completo navegable; INSERT reflexivo rechazado por CHECK |
| REQ-B02 | `sourceVersion.supersede.spec` | I | 1 | P1-G1 | La versión superseded se lee por ID pero no aparece como vigente |
| REQ-B03 | `question.noBooleanCorrectness.spec` | I | 1 | P1-G2 clave inválida | No existe columna de corrección en `question_options` |
| REQ-B04 | `answerKey.lifecycle.spec` | I | 1 | P1-G2 | PROVISIONAL→FINAL→AMENDED registrado; versión previa consultable |
| REQ-B05 | `answerKey.crossQuestionOption.reject.spec` | I | 1 | CDEM-13 | INSERT con opción de otra pregunta rechazado por constraint |
| REQ-B06 | `questionConcepts.primarySecondary.spec` | I | 1 | Closure AT-38 | Una pregunta admite 1 primario y ≥1 secundario con peso |
| REQ-B07 | `ingestion.stagingBoundary.spec` | I | 1 | P1-G3 mutación | Un import inválido no crea filas en tablas publicadas |
| REQ-B08 | `ingestion.contract.reject.spec` | U,I | 1 | Closure AT-20 | Ítem con `access_type` no coincidente → REJECT registrado |
| REQ-B09 | `official.requiresPrimarySource.spec` | I | 1 | INV-110 | INSERT OFFICIAL sin `source_version_id` rechazado |
| REQ-B10 | `rls.canonicalContent.userWrite.deny.spec` | SEC | 1 | Closure AT-23 | UPDATE/INSERT de usuario denegado en todas las tablas de contenido |
| REQ-B11 | `seed.taiTopicCount.spec` | I | 1 | P1-G1 | 33 temas con distribución 9/5/9/10 |
| REQ-B12 | `practical.officialCasesFit.spec` | I | 1 | Mapping F-02 | Los 4 prácticos cargan sin entidades adicionales |
| REQ-B13 | `examOccurrence.load.spec` | I | 1 | P1-G1 | 405 ocurrencias con 270 preguntas canónicas distintas · **requiere BD-05** |
| REQ-B14 | `concept.identityAcrossVersions.spec` | I | 1 | EC-006 | Publicar versión N+1 mantiene resoluble el mastery de N · **requiere BD-02** |
| REQ-B15 | `official.hasOptions.spec` | I | 1 | **P1 PASS gate** | Toda pregunta OFFICIAL publicada tiene ≥2 opciones con texto · **requiere MI-01** |

## C · Phase 2 — Aprendiz y evidencia

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-C01 | `onboarding.minimal.e2e` | E | 2 | WF-01 | El usuario alcanza el primer plan sin abrir ajustes avanzados |
| REQ-C02 | `diagnostic.skip.conservative.spec` | U,E | 2–3 | OB-05 | Con diagnóstico omitido hay plan y la UI muestra incertidumbre explícita |
| REQ-C03 | `availability.change.preservesEvidence.spec` | I,E | 2 | Master §49 | Tras cambiar disponibilidad, el recuento de eventos es idéntico |
| REQ-C04 | `session.stateMachine.spec` | I | 2 | P2-G2 | Solo transiciones válidas; `ABANDONED` no aparece en copy |
| REQ-C05 | `event.append-only.spec` · `event.duplicateId.spec` | I,SEC | 2 | P2-G1 | UPDATE/DELETE de usuario denegado; segundo INSERT con mismo `event_id` no crea fila |
| REQ-C06 | `event.schemaValidation.spec` | U,I | 2 | P2-G1 | Payload que no valida contra su `schema_version` es rechazado |
| REQ-C07 | `attempt.requiredRefs.spec` | I | 2 | EC-007 | `answer_key_version_id` y `submitted_event_id` NOT NULL en todo intento |
| REQ-C08 | `attempt.blankAnswer.spec` | I | 2 | Knowledge Engine | `selected_option_id NULL` aceptado y puntuado 0 · **requiere BD-06 para scoring** |
| REQ-C09 | `session.autosave.abruptExit.e2e` | E | 2 | Closure AT-01 | Cerrada la app en Q7/15, al volver hay 7 intentos y el cursor está en Q8 |
| REQ-C10 | `session.resumeCursor.exact.e2e` | E | 2 | CDEM-10 | La reanudación abre el `session_item` exacto, no el primero |
| REQ-C11 | `session.crossDevice.latestState.spec` | I,E | 2 | Closure AT-03 | El dispositivo B carga el último estado confirmado por servidor |
| REQ-C12 | `session.partialCounts.e2e` | U,E | 2–4 | Closure AT-02 | 47/120 min completados cuentan; el resto vuelve al planner; sin etiqueta de fallo |
| REQ-C13 | `rls.userIsolation.<table>.spec` (una por tabla) | SEC | 2 | **P2-G3 · fallo duro** | Usuario A obtiene 0 filas y error de escritura sobre datos de B, en todas las tablas |
| REQ-C14 | `diagnostic.attemptLink.spec` | I | 2 | CDEM §13 | Los intentos del diagnóstico se filtran por `diagnostic_run_id` |
| REQ-C15 | `device.syncState.unique.spec` | I | 2 | CDEM §21 | Unicidad (user_id, device_id) garantizada por constraint |
| REQ-C16 | `attempt.idempotentBySubmittedEvent.spec` | I | 2 | **P2-G1 · fallo duro** | Reenviar el mismo `submitted_event_id` deja exactamente 1 intento; violación de UNIQUE tratada como éxito idempotente |

## D · Phase 3 — Learning Engine

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-D01 | `mastery.projectionShape.spec` | U,I | 3 | P3-G1 | Fila única (user, concept) con `engine_version` y `event_watermark` no nulos |
| REQ-D02 | `mastery.deterministic.golden.spec` | U | 3 | **P3-G1 · fallo duro** | Dataset fijo produce salida idéntica byte a byte entre ejecuciones |
| REQ-D03 | `mastery.rebuildMatchesIncremental.spec` | I | 3 | **P3-G3 rebuild** | Rebuild total == proyección incremental para el mismo watermark |
| REQ-D04 | `mastery.confidenceCalibration.spec` | U | 3 | Closure AT-11/AT-12 | Acierto con confianza baja: conocimiento ↑, calibración ↓. Fallo con confianza alta: mastery no sube |
| REQ-D05 | `review.spacing.spec` | U | 3 | Master §13 | Aciertos separados en el tiempo aumentan el intervalo de `next_review_at` |
| REQ-D06 | `errorPattern.recurrence.spec` | U,I | 3 | Closure AT-13 | Tres fallos del mismo tipo crean un `error_pattern` activo |
| REQ-D07 | `intervention.historyAware.spec` | U | 3 | Closure AT-13 | Ante recurrencia, `intervention_type` distinto al ya aplicado |
| REQ-D08 | `engineConfig.immutableVersion.spec` · `engineConfig.promotion.spec` | U,I,S | 3 | P3-G1 | UPDATE sobre una versión publicada rechazado; promoción exige registro de aprobación |
| REQ-D09 | `engine.noNetwork.spec` | U | 3 | P3-G2 sin LLM | La suite del motor pasa con la red deshabilitada |
| REQ-D10 | `readiness.separateFromMastery.spec` | U,I | 3–6 | **Closure AT-32 · fallo duro** | Mastery alto + práctico lento ⇒ readiness no sube |
| REQ-D11 | `masteryState.presentation.spec` | U | 3 | EC-004 | Toda combinación (estado, error, repaso) mapea a una etiqueta única · **requiere BD-04** |

## E · Phase 4 — Planner Engine

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-E01 | `plannerRun.auditable.spec` | I | 4 | P4-G4 reason codes | Todo run persiste tipo, versión, watermark y reason_codes no vacíos |
| REQ-E02 | `plannerItem.reasonCodesReproduce.spec` | U,I | 4 | **P4-G4** | Reejecutar con los mismos inputs devuelve los mismos ítems y códigos |
| REQ-E03 | `priority.score.deterministic.spec` | U | 4 | P4-G4 | El score coincide con el cálculo esperado del modelo de 7 factores |
| REQ-E04 | `allocator.reviewDisplacesLearn.spec` | U | 4 | Closure AT-08 | Con revisiones críticas, los minutos de Learn se reducen antes que los de Review |
| REQ-E05 | `planner.defaultChangeReplansFuture.spec` | U,E | 4 | **P4-G1** | 2h→1h cambia el plan futuro; ningún evento pasado se modifica |
| REQ-E06 | `planner.todayOverrideKeepsDefault.spec` | U,E | 4 | **P4-G2** | Tras override, `default_daily_minutes` conserva su valor |
| REQ-E07 | `rescue.preservesCriticalReview.spec` | U,E | 4 | Closure AT-06 | Con 20 min, la revisión crítica permanece y el contenido nuevo se desplaza |
| REQ-E08 | `rescue.zeroMinutes.noDebt.spec` | U,E | 4 | **P4-G3** | Con 0 min no se crea backlog, contador ni marca de fracaso |
| REQ-E09 | `recovery.noOverdueWall.spec` | U,E | 4 | Closure AT-07 | Tras 5 días, el plan se compone desde el estado actual, sin lista de atrasos |
| REQ-E10 | `prereq.flexibleMicrolesson.spec` | U | 4 | Closure AT-09 | Con prerrequisito débil se inserta microlección, no bloqueo |
| REQ-E11 | `review.overdueNeverDropped.spec` | U | 4 | INV-108 | Ninguna revisión vencida desaparece sin reason_code que lo explique |
| REQ-E12 | `planner.noNetwork.spec` | U | 4 | Master §46 | La suite del planner pasa sin red |
| REQ-E13 | `planner.replanCreatesNewRun.spec` | I | 4 | Closure DI-05 | El replan inserta un run nuevo; el anterior permanece consultable |

## F · Phase 5 — UX de aprendizaje

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-F01 | `hoy.resumeDominates.e2e` | E | 5 | **WF-02 / P5-G5** | Con sesión interrumpida, la tarjeta de resume es el primer elemento y la única CTA primaria |
| REQ-F02 | `hoy.singleDominantAction.e2e` · `hoy.hierarchy.spec` | E | 5 | DS-01, DS-09 | Un solo `PrimaryButton` visible; proporciones conformes a SD-01 |
| REQ-F03 | `hoy.whyThisToday.e2e` | E | 5 | WF-06 | La razón es alcanzable en una interacción y proviene de reason_codes |
| REQ-F04 | `learn.readingMeasure.spec` | E | 5 | DS-02 | Medida entre 45 y 70 caracteres; cuerpo ≥16px |
| REQ-F05 | `learn.dontUnderstand.changesStrategy.e2e` | E | 5 | Closure AT-29 | El segundo intento devuelve contenido distinto del primero |
| REQ-F06 | `learn.alreadyKnow.proofCheck.e2e` | E | 5 | Closure AT-28 | El salto exige comprobación; si falla, refuerza sin lenguaje punitivo |
| REQ-F07 | `check.selectionEmphasisIsNeutral.spec` (renombrado desde `check.neutralBeforeSubmit.spec`) | U,E | 5 | **DS-03 / P5-G2** | (a) la opción seleccionada **sí** se distingue de la no seleccionada mediante énfasis neutral y expone `aria-checked`/`aria-selected`; (b) el marcado no contiene tokens, iconos, textos ni atributos de correcto/incorrecto; (c) el orden de opciones no cambia; (d) ningún payload ni atributo revela la clave |
| REQ-F08 | `check.confidenceBeforeFeedback.e2e` | E | 5 | **P5-G3** | `CONFIDENCE_RECORDED` precede a `FEEDBACK_VIEWED` en el stream · **escala requiere BD-03** |
| REQ-F09 | `check.payloadHasNoKey.e2e` | SEC,E | 5 | **INV-101 · fallo duro** | Ninguna respuesta de red previa al envío contiene la opción correcta |
| REQ-F10 | `feedback.order.e2e` | E | 5 | DS-04 | Los siete bloques aparecen en el orden especificado |
| REQ-F11 | `feedback.sourceAccess.e2e` | E | 5 | WF-05, AT-41 | Procedencia y versión de clave alcanzables sin abandonar el feedback |
| REQ-F12 | `sessionEnd.noCelebrationEconomy.e2e` | E | 5 | **DS-06 / EC-017** | Sin confeti, trofeo, XP ni racha en el DOM |
| REQ-F13 | `session.navRecedes.e2e` | E | 5 | Screen Design 04 | La barra inferior no se renderiza durante la respuesta activa |
| REQ-F14 | `emptyStates.sevenCases.e2e` | E | 5 | Master §32 | Los 7 estados existen, explican utilidad y ofrecen ≤1 acción |
| REQ-F15 | `a11y.studySurfaces.spec` | E,S | 5–11 | DS-08 | Cero violaciones críticas de contraste, foco y etiquetado |

## G · Phase 6 — Práctico y simulacro

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-G01 | `practical.dualPane.e2e` | E | 6 | DS-05 | Ambos paneles con scroll independiente en ≥834px |
| REQ-G02 | `practical.mobileScenarioPosition.e2e` | E | 6 | **P6-G2** | Al cerrar y reabrir el escenario, el scroll vuelve al píxel anterior |
| REQ-G03 | `practical.selectVsSubmit.spec` | U,E | 6 | ADR-002 | Cambiar la selección no crea `question_attempts`; el envío crea exactamente uno |
| REQ-G04 | `practical.feedsReadiness.spec` | U | 6 | **P6-G4** | La evidencia práctica mueve `practical_readiness` sin escribir mastery de concepto |
| REQ-G05 | `simulation.noAnswerLeak.e2e` | E,SEC | 6 | **P6-G3 · fallo duro** | Ninguna respuesta ni feedback accesible antes del cierre configurado |
| REQ-G06 | `simulation.resume.e2e` | E | 6 | Master §20 | Interrumpir y volver conserva todas las respuestas enviadas |
| REQ-G07 | `simulation.officialScoring.spec` | U,I | 6 | Knowledge Engine | Puntuación reproducida: −1/3 por error, 0 en blanco, 0–50 por parte, mínimo 25 · **requiere BD-06** |
| REQ-G08 | `simulation.doesNotWriteMastery.spec` | U | 6 | **P6-G4** | Cero escrituras en `concept_mastery` desde el flujo de simulacro |
| REQ-G09 | `practical.trackSelection.spec` | I | 6 | Knowledge Engine | La readiness práctica se calcula solo sobre el track elegido |

## H · Phase 7 — Progreso y plan

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-H01 | `progress.masteryVsReadiness.e2e` | E | 7 | **DS-06 / P7-G1** | Dos secciones con etiquetas y explicaciones distintas; ningún número compartido |
| REQ-H02 | `progress.masteryMap.e2e` | E | 7 | Master §25 | Cada estado se comunica con etiqueta + icono, no solo color |
| REQ-H03 | `progress.attentionActionable.e2e` | E | 7 | Master §25 | Cada área listada ofrece una acción concreta |
| REQ-H04 | `progress.calibration.e2e` | E | 7 | UX P4 | La calibración se muestra con explicación y sin lenguaje de juicio |
| REQ-H05 | `progress.noFalsePrecision.spec` | U,E | 7 | INV-111 | Bajo el umbral de evidencia se muestra banda, nunca porcentaje exacto |
| REQ-H06 | `plan.fourBlocks.e2e` | E | 7 | Master §26 | Objetivo, default, override y carga presentes y editables |
| REQ-H07 | `plan.changePreview.e2e` | E | 7 | **DS-07 / P7-G3** | Antes de confirmar se muestran mantiene/mueve/protege |
| REQ-H08 | `plan.noOverdueWall.e2e` | E | 7 | **P7-G2** | Sin contador de vencidos ni superficie roja de deuda |

## I · Phase 8 — Notas y Tutor

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-I01 | `notes.contextLink.spec` | I,E | 8 | Master §27 | La nota creada desde una lección guarda concepto, tema y fuente |
| REQ-I02 | `notes.crud.e2e` · `notes.deleteKeepsCanonical.spec` | E,I | 8 | CDEM-12 | Borrar la nota no altera contenido canónico ni su contexto histórico |
| REQ-I03 | `notes.rememberFlag.spec` | I | 8 | Master §27 | El flag persiste y es filtrable |
| REQ-I04 | `notes.aiTransformApproval.e2e` | E | 8 | **P8-G4** | Sin aprobación explícita no se crea `personal_review_material` |
| REQ-I05 | `personal.cannotBecomeCanonical.spec` | SEC,I | 8 | **CDEM-7 · fallo duro** | La API de usuario no puede insertar en tablas de contenido |
| REQ-I06 | `tutor.contextualOnly.e2e` | E | 8 | Master §28 | No existe entrada de tutor fuera de las cinco superficies permitidas |
| REQ-I07 | `tutor.generatedLabelled.e2e` | E | 8 | Closure AT-16 | Toda salida generada muestra su procedencia |
| REQ-I08 | `ai.providerAdapter.spec` | U | 8 | Manifest §15 | Sustituir el adaptador no cambia la lógica de producto |
| REQ-I09 | `ai.costTelemetry.spec` | I | 8 | Master §46 | Cada llamada registra proveedor, modelo, tokens, latencia y estado |
| REQ-I10 | `ai.promptInjection.spec` | U | 8 | **INV-114** | Un documento con instrucciones embebidas no altera el comportamiento |
| REQ-I11 | `ai.cannotMutateProtectedState.spec` | SEC | 8 | **Closure AT-18 / CDEM-8 · fallo duro** | El rol de la capa IA no tiene grants sobre proyecciones |
| REQ-I12 | `tutor.noLegalCurrencyClaim.spec` | U,E | 8 | Closure AT-15 | Sin `source_version` vigente, la capacidad legal responde con negativa explícita |

## J · Phases 9–10 — Offline, sync y ciclo oficial

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-J01 | `offline.queueRetry.noDuplicate.spec` | U,E | 9 | **P9-G1 · fallo duro** | Tres reintentos del mismo evento producen un solo intento |
| REQ-J02 | `sync.stateTruthful.e2e` | E | 9 | **P9-G3 / EC-012** | El estado "sincronizado" solo aparece tras ACK del servidor |
| REQ-J03 | `sync.conflictResolution.e2e` | I,E | 9 | ED-08, ED-09 | Conflicto seguro se resuelve sin interrumpir; el inseguro bloquea y preserva ambos lados |
| REQ-J04 | `sync.staleDeviceCannotErase.spec` | I | 9 | **Closure AT-42 / CDEM-9 · fallo duro** | Eventos antiguos no eliminan ni sobrescriben evidencia más nueva aceptada |
| REQ-J05 | `offline.scopeBoundary.e2e` | E | 9 | Master §33 | Las acciones fuera del alcance se deshabilitan con explicación, no fallan |
| REQ-J06 | `official.updateLifecycle.e2e` | I,E | 10 | **P10-G1** | El ciclo completo se ejecuta y queda auditado |
| REQ-J07 | `attempt.recalculationPreservesHistory.spec` | I | 10 | **Closure AT-19 / CDEM-4 · fallo duro** | El intento original permanece intacto y existe registro de recálculo |
| REQ-J08 | `official.noticeOnlyIfAffected.e2e` | E | 10 | ED-10 | Un usuario no afectado no recibe aviso |
| REQ-J09 | `recalculation.targeted.spec` | I | 10 | CDEM §20 | Solo se recalculan los usuarios y proyecciones afectados |

## K · Phase 11 — Endurecimiento

| REQ | Prueba ejecutable | Tipo | Fase | Gate | Condición de PASS |
|---|---|---|---|---|---|
| REQ-K01 | `a11y.full.spec` | E,S | 11 | **Manifest §20** | Cero violaciones críticas en las 8 superficies principales |
| REQ-K02 | `observability.logSeparation.spec` | S | 11 | TA §11 | Los logs operacionales no contienen texto libre personal |
| REQ-K03 | `rateLimit.aiEndpoints.spec` | SEC | 11 | Master §44 | Superado el límite, el endpoint responde 429 |
| REQ-K04 | `backup.restore.drill` | M | 11 | TA §12 | Restauración completada y verificada en entorno aislado |
| REQ-K05 | `account.deletionPolicy.spec` | I | 11 | CDEM §24 | El borrado elimina lo personal y conserva lo canónico |
| REQ-K06 | Suite completa | todas | 11 | **Master §49** | Todos los gates de aceptación del MVP en verde |

---

## Invariantes → prueba · cobertura completa (EC-001…EC-020 · INV-101…INV-115)

**20/20 EC y 15/15 INV con prueba, fase y condición de PASS.** Algunos son *design gates* o *process gates*: su prueba es una comprobación reproducible en CI o en el checkpoint, no un test unitario, y se marca como tal.

| ID | Prueba ejecutable | Tipo | Fase | Condición de PASS | Fallo duro |
|---|---|---|---|---|---|
| EC-001 | `provenance.classRequired.spec` · `personal.cannotBecomeCanonical.spec` | I,SEC | 1,8 | Toda fila de contenido tiene `provenance_class` NOT NULL válido; ninguna API de usuario inserta en tablas canónicas | SÍ |
| EC-002 | `mastery.deterministic.golden.spec` · `ai.cannotMutateProtectedState.spec` | U,SEC | 3,8 | Salida idéntica para el mismo dataset y versión; el rol de IA carece de grants sobre `concept_mastery` | SÍ |
| EC-003 | `plannerItem.reasonCodesReproduce.spec` | U,I | 4 | Mismos inputs y versión ⇒ mismos ítems y mismos reason_codes | SÍ |
| EC-004 | `readiness.separateFromMastery.spec` · `progress.masteryVsReadiness.e2e` | U,E | 3,6,7 | Readiness no sube con mastery alto y práctico lento; UI con secciones y explicaciones distintas | SÍ |
| EC-005 | `event.append-only.spec` | SEC | 2 | UPDATE y DELETE de usuario denegados sobre `learning_events` | SÍ |
| EC-006 | `mastery.rebuildMatchesIncremental.spec` · `rebuild.deterministicOrder.spec` | I | 3 | Rebuild == incremental para el mismo watermark; dos rebuilds producen el mismo orden | SÍ |
| EC-007 | `attempt.recalculationPreservesHistory.spec` | I | 1,10 | El intento original permanece intacto y existe registro de recálculo | SÍ |
| EC-008 | `tutor.generatedLabelled.e2e` · `provenance.chipPresent.spec` | E,I | 1,8 | Toda superficie de contenido muestra procedencia; GENERATED nunca se presenta como OFFICIAL | SÍ |
| EC-009 | `rls.userIsolation.<table>.spec` | SEC | 2+ | Cero filas leídas y error de escritura entre usuarios, en todas las tablas expuestas | SÍ |
| EC-010 | `bundle.secret-scan.spec` | S | 0 | Cero coincidencias de patrones de clave de servicio o proveedor en el bundle | SÍ |
| EC-011 | `schema.drift.spec` | S,M | 0+ | El esquema aplicado coincide con las migraciones del repositorio | SÍ |
| EC-012 | `sync.stateTruthful.e2e` | E | 9 | El estado "sincronizado" solo aparece tras ACK del servidor | SÍ |
| EC-013 | `attempt.idempotentBySubmittedEvent.spec` · `offline.queueRetry.noDuplicate.spec` | I,E | 2,9 | N reintentos del mismo evento ⇒ 1 intento | SÍ |
| EC-014 | `rescue.zeroMinutes.noDebt.spec` · `recovery.noOverdueWall.spec` | U,E | 4 | Ni backlog, ni contador de deuda, ni marca de fracaso en ninguna de las dos rutas | SÍ |
| EC-015 | `primarySpaces.frozen.spec` | U | 0 | La constante contiene exactamente los 5 valores congelados | SÍ |
| EC-016 | `notes.noPromotionPath.spec` | SEC | 8 | No existe ruta implementada de PERSONAL → canónico | SÍ |
| EC-017 | `ui.noEngagementEconomy.e2e` (design gate) | E | 5,7 | Ausencia en el DOM de XP, monedas, ranking, racha, confeti y trofeo en las 8 superficies | SÍ |
| EC-018 | `content.noTaiLiteralInShell.spec` · `secondPack.noSchemaChange.spec` | S,I | 1 | El literal TAI no aparece fuera de `content/` y seeds; un segundo pack carga sin migración | SÍ |
| EC-019 | `governance.adrReferenced.spec` (process gate) | S | todas | Todo PR que toca un módulo marcado como invariante referencia un ADR ACCEPTED; el checkpoint incluye `INVARIANTS VERIFIED` completo | SÍ |
| EC-020 | `ci.blockingGates.spec` (process gate) | S | todas | Ningún checkpoint puede declarar PASS con un check bloqueante en rojo; verificado por el propio pipeline | SÍ |
| INV-101 | `check.payloadHasNoKey.e2e` · `answerKey.notInDataApi.spec` | SEC,E,I | 1,5,6 | Ninguna respuesta previa al envío contiene la clave; la tabla no está en el esquema expuesto | SÍ |
| INV-102 | `check.confidenceBeforeFeedback.e2e` | E | 5 | `CONFIDENCE_RECORDED` precede a `FEEDBACK_VIEWED` en el stream | SÍ |
| INV-103 | `check.selectionEmphasisIsNeutral.spec` | U,E | 5 | Selección visible con énfasis neutral y ARIA; sin señal de corrección, sin reordenar, sin filtrar la clave | SÍ |
| INV-104 | `mobile.singleDominantAction.spec` (design gate) | U,E | 5 | Máximo un `PrimaryButton` renderizado por vista móvil, en todas las rutas de estudio | NO |
| INV-105 | `a11y.stateNotColorOnly.spec` (design gate) | U,E | 5,7 | Todo estado semántico expone etiqueta textual + icono además del color; verificado en modo escala de grises | NO |
| INV-106 | `planner.todayOverrideKeepsDefault.spec` · `planner.defaultChangeReplansFuture.spec` | U,E | 4 | El override no altera `default_daily_minutes`; el cambio de default replanifica el futuro sin tocar el pasado | SÍ |
| INV-107 | `copy.forbiddenTerms.spec` (process gate en CI) | S | 5+ | Ningún fichero de copy contiene los términos vetados de `terminology.md` §3 | NO |
| INV-108 | `review.overdueNeverDropped.spec` | U | 4 | Toda revisión vencida aparece en el plan o queda explicada por un reason_code | SÍ |
| INV-109 | `content.staleNormativeNotAssignable.spec` | U,I | 4,8 | El planner no selecciona contenido cuya `source_version` no esté vigente; la recuperación de IA lo filtra antes de generar | SÍ |
| INV-110 | `official.requiresPrimarySource.spec` | I | 1 | INSERT OFFICIAL sin `source_version_id` verificable queda en cuarentena | SÍ |
| INV-111 | `progress.noFalsePrecision.spec` | U,E | 7 | Bajo el umbral de evidencia se devuelve banda + texto, nunca porcentaje exacto | NO |
| INV-112 | `session.idleDoesNotInflateTime.spec` | U,E | 5 | Superado el umbral de inactividad, el tiempo activo deja de acumularse; requiere `SESSION_IDLE_PAUSED` (SD-004) | NO |
| INV-113 | `client.no-authoritative-write.spec` | S,I | 0 | Ninguna ruta de cliente escribe `concept_mastery`, `exam_readiness` ni `planner_*`; toda proyección local expone `authoritative: false` | SÍ |
| INV-114 | `ai.promptInjection.spec` | U | 8 | Un documento con instrucciones embebidas no altera el comportamiento ni invoca herramientas | SÍ |
| INV-115 | `ai.taskContractRequired.spec` | U,S | 8 | Todo endpoint de IA declara inputs, contexto, output permitido, mutaciones prohibidas, timeout y telemetría; sin contrato no compila | SÍ |

## Cobertura de los 42 acceptance tests de `TAI_STUDY_OS_Pre_Build_Closure_v0.6`

**Clasificación verificada: 42 IDs, cada uno exactamente una vez. 37 dentro del MVP · 5 diferidos.**

**Dentro del MVP (37):**

| Fase | AT |
|---|---|
| 2 · evidencia y continuidad | AT-01, AT-02, AT-03, AT-24, AT-25 |
| 5 · UX (incluye superficies añadidas por SD-004) | AT-04, AT-05, AT-27, AT-28, AT-29, AT-30 |
| 4 · planner | AT-06, AT-07, AT-08, AT-09, AT-10, AT-34 |
| 3 · learning engine (la corrección de diagnóstico usa el evento nuevo de SD-004) | AT-11, AT-12, AT-13, AT-14, AT-26, AT-32 |
| 8 · IA y tutor | AT-15, AT-16, AT-17, AT-18, AT-41 |
| 1 y 10 · contenido oficial | AT-19, AT-20, AT-37, AT-38 |
| 2 · seguridad | AT-21, AT-22, AT-23 |
| 9 · offline y sync | AT-35, AT-42 |

**Diferidos (5):** AT-31 (Risk Engine) · AT-33 (eficiencia de aprendizaje) · AT-36 (evidence ledger) · AT-39 (testing adaptativo) · AT-40 (inteligencia práctica avanzada). Todos con destino en `deferred-requirements.md`.

**Corrección respecto a la v1.1:** AT-04, AT-05, AT-14 y AT-27 figuraban como "requieren eventos añadidos" en una redacción que los dejaba fuera del recuento de ejecutados. **No están diferidos**: se implementan en Phases 2, 3 y 5 mediante los eventos y superficies que introduce SD-004 (`SESSION_IDLE_PAUSED`, `ERROR_REASON_CORRECTED_BY_USER`, `REVIEW_COMPLETED`). El recuento correcto es 37 ejecutados + 5 diferidos.

## Fallos duros que nunca permiten PASS (Checkpoint Contract + adiciones)

1. `rls.userIsolation.*` en rojo · 2. `attempt.idempotentBySubmittedEvent` en rojo · 3. migración fallida ·
4. `bundle.secret-scan` con hallazgos · 5. **`check.payloadHasNoKey` en rojo** · 6. cambio constitucional sin aprobación ·
7. contradicción sin registrar · 8. `personal.cannotBecomeCanonical` en rojo · 9. `mastery.deterministic.golden` en rojo ·
10. tests de aceptación omitidos sin motivo aprobado.
