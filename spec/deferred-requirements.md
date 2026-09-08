# STUDY OS · deferred-requirements.md

**Fase:** −1 · Specification Compilation
**Versión:** 1.2 · patch correctivo (recuento y tombstone)

**Recuento oficial:** **26 requisitos diferidos activos · 1 registro RETIRED (DEF-18) · 27 IDs históricos.**
`DEF-18` se conserva únicamente como *tombstone* de auditoría: su ID no se reutiliza y su fila documenta por qué dejó de ser diferible. No debe contarse como diferido activo.
**Regla:** nada desaparece detrás de un "más adelante". Todo requisito aplazado tiene motivo, destino y condición de reapertura.

---

## 0. Regla de alcance (añadida en v1.1 · vinculante)

Deben distinguirse dos cosas que la v1.0 mezclaba:

**Validation slice IV.7 / I.7** — el **contenido** sobre el que se ejercita el producto durante la construcción y la validación formativa con USER_001. Es una elección de material, no de funcionalidad.

**Alcance final del MVP TAI** — los 122 requisitos de `requirement-index.md` y el alcance IN·P0 del `Master §47`, incluido el **banco oficial de preguntas completo**.

Consecuencias:
1. **Ningún requisito P0 se difiere** por razones de contenido. Un requisito P0 solo sale del MVP mediante `SPEC_DIFF` aprobado sobre el Master.
2. **El banco oficial no es diferible.** Su ausencia es `MISSING_INPUT` MI-01 y bloquea el PASS de Phase 1.
3. Trabajar temporalmente sobre IV.7/I.7 **no reduce** el alcance del MVP: reduce la superficie de contenido durante la construcción.
4. Nada etiquetado GENERATED cuenta como cobertura de banco oficial.

---

## 1. Diferido a P1 por decisión de alcance (Master §47)

| ID | Requisito | Fuente | Motivo | Destino | Condición de reapertura |
|---|---|---|---|---|---|
| DEF-01 | Generación enriquecida de material de repaso personal | Master §47 P1 | El MVP solo requiere aprobación explícita de transformaciones simples | P1 | Uso real de notas > umbral |
| DEF-02 | Transformaciones avanzadas de notas | Master §47 P1 | Idem | P1 | — |
| DEF-03 | Analítica profunda | Master §47 P1 | Riesgo de dashboard disease antes de tener evidencia | P1 | Tras validación con USER_001 |
| DEF-04 | Más estrategias de intervención | Master §47 P1 | El MVP implementa el ciclo error→intervención→resultado con un conjunto reducido | P1 | Datos de eficacia por intervención |
| DEF-05 | Simulacros ampliados | Master §47 P1 | MVP entrega simulación básica | P1 | Tras Phase 6 validada |
| DEF-06 | Búsqueda avanzada de contenido | Master §47 P1 | — | P1 | — |
| DEF-07 | Packs de examen adicionales | Master §47 P1 | TAI valida la arquitectura | P1 | Prueba CDEM 11 en verde + demanda |
| DEF-08 | Administración sofisticada de contenido | Master §47 P1 | Ingestión server-side es suficiente en MVP | P1 | Volumen de contenido |
| DEF-09 | Notificaciones | Master §47 P1 | Riesgo de deriva hacia mecánicas de culpa | P1 | Decisión de producto explícita |

## 2. Diferido por falta de datos para calibrar

| ID | Requisito | Fuente | Motivo | Destino |
|---|---|---|---|---|
| DEF-10 | **Risk Engine** (recomendación contestar vs blanco) | LS v0.4 Risk Engine; AT-31 | Los propios documentos lo declaran heurístico y prohíben fijar umbrales sin datos reales (OBS-02) | P1 · **criterio de dataset suficiente por definir y aprobar** (ver §7) |
| DEF-11 | Modelo de eficiencia de aprendizaje (ajuste de estimaciones de tiempo) | AT-33 | Requiere historial | P1 |
| DEF-12 | Testing adaptativo por valor diagnóstico | AT-39; Intelligence 01 | Requiere banco etiquetado completo | P1 |
| DEF-13 | Inteligencia práctica avanzada (ruido, discriminación de evidencia) | AT-40 | Requiere prácticos oficiales descompuestos y validados | P1 |
| DEF-14 | Calibración de pesos de Mastery y de prioridad | LS v0.4; C-10 | Son hipótesis declaradas; el MVP los usa como configuración versionada inicial | P1 · recalibración sin deploy (ADR-003) |

## 3. Diferido por dependencia de contenido no disponible

| ID | Requisito | Bloqueado por | Destino |
|---|---|---|---|
| DEF-15 | Capacidad `LEGAL_EXPLANATION` del Tutor (afirmar vigencia normativa) | C-21: sin corpus normativo ingerido ni `source_chunks` | Se **desactiva** en MVP. Es una restricción de capacidad de la IA, no el diferimiento de un requisito P0. Reapertura tras ingestión versionada del Bloque I |
| DEF-16 | pgvector / recuperación semántica | C-21 + recomendación F-3 | Phase 8, solo si existe corpus que lo justifique. MVP usa recuperación determinista concepto→unidad→fuente |
| DEF-17 | Cobertura de contenido didáctico más allá de IV.7 e I.7 | C-22 / MI-02: no existen `learning_units` | Línea de trabajo de contenido paralela. **No difiere ningún requisito**: REQ-F04…F06 se implementan y prueban sobre el contenido disponible |
| ~~DEF-18~~ | **TOMBSTONE · RETIRED (v1.1)** · ~~ENTRENAR con banco OFFICIAL completo~~ | — | **No es diferible.** Es P0 (`Master §47`) y su bloqueo es `MISSING_INPUT` MI-01, con efecto sobre el PASS de Phase 1. ID conservado y no reutilizable. Ver C-01 | — |
| DEF-19 | Exam Intelligence (frecuencia histórica, recurrencia, transversalidad) | Depende de ocurrencias (C-02) y de mapping revalidado (C-07) | P1 |

## 4. Diferido por secuencia técnica (dentro de MVP)

| ID | Requisito | Fase de contrato | Fase de implementación | Riesgo si se separa mal |
|---|---|---|---|---|
| DEF-20 | Cola de eventos en IndexedDB | 2 (contrato de evento) | 9 | R-09: refactor de seis fases si el contrato no existe desde Phase 2 |
| DEF-21 | Resolución de conflicto con elección del usuario (ED-09) | 2 | 9 | — |
| DEF-22 | Recálculo dirigido por cambio de fuente | 1 (versionado) | 10 | — |
| DEF-23 | Observabilidad y rate limiting completos | 8 (telemetría de coste) | 11 | Coste de IA sin control si se retrasa la telemetría |

## 5. Diferido explícitamente fuera de MVP (Master §47 · OUT)

Feed social · comunidad · ranking · XP/monedas · economía de rachas · marketplace · editor tipo Notion · avatar de IA · chatbot flotante genérico · plataforma de autoría multi-examen para terceros · apps nativas (salvo que la validación demuestre que la PWA es insuficiente) · Kubernetes, microservicios, Kafka, grafo o vector DB adicionales sin evidencia.

**Estos no se reabren por conveniencia de implementación.** Requieren revisión de producto (Design System §17).

## 6. Requisitos con destino pendiente de decisión humana

| ID | Requisito | Bloqueado por |
|---|---|---|
| DEF-24 | "◆ Preparado para examen" como estado de concepto | BD-04 / C-09 |
| DEF-25 | Temporizador vinculante en PRÁCTICO fuera de modo examen | C-16 |
| DEF-26 | Política de borrado de cuenta y retención | CDEM §24 · requisito de Phase 11, sin definir |
| DEF-27 | Proyección tipo "llegarás al 75% en 23 días" | C-24 · requiere modelo validado; no mostrar en MVP |

---

## 7. Criterio de reapertura del Risk Engine (DEF-10) · pendiente de definir y aprobar

**Corrección de la v1.0.** La v1.0 proponía reabrir el Risk Engine "tras ≥1 simulacro completo de USER_001". Es incorrecto por dos motivos:

1. **La validación con USER_001 tras Phase 5 es formativa, no estadística.** Su objetivo es comprobar que el bucle HOY → LEARN → CHECK → FEEDBACK → SESSION END es comprensible, continuo y útil, y que las decisiones del planner resultan explicables. No produce potencia estadística para calibrar umbrales.
2. **Un simulacro no es un dataset.** Los propios documentos de dominio (`LS v0.4` Risk Engine, OBS-02) prohíben fijar umbrales de respuesta sin datos reales suficientes.

**Sustitución:** el criterio de reapertura pasa a ser un **umbral de dataset suficiente, todavía por definir y aprobar**, que debe existir antes de implementar nada del Risk Engine. Debe especificar como mínimo:

- número mínimo de intentos con confianza declarada, por franja de confianza;
- número mínimo de ítems distintos y de sesiones distintas, para evitar dependencia de una sola sesión;
- separación temporal mínima entre evidencias;
- métrica de calibración objetivo y su umbral;
- criterio de decisión si la calibración resulta inestable: no personalizar.

Hasta que ese criterio exista y esté aprobado, **el Risk Engine no se implementa y no se muestra ninguna recomendación de contestar o dejar en blanco.**

**Lo que sí produce la validación formativa con USER_001:** señales cualitativas sobre claridad, continuidad, carga cognitiva, comprensión de "por qué esto hoy", percepción de justicia del feedback y utilidad de Rescue. Pueden motivar cambios de UX; **no** pueden usarse para calibrar pesos de motor ni umbrales de riesgo.

## 8. Lo que el validation slice NO difiere

| Elemento | Estado |
|---|---|
| Banco oficial de preguntas | P0 · no diferible · bloqueado por MI-01 |
| Los 122 requisitos del `requirement-index` | P0 · ninguno diferido |
| Simulacro básico | P0 · Phase 6 · requiere BD-06 |
| PRÁCTICO | P0 · Phase 6 |
| Cobertura de los 33 temas del temario TAI | Alcance final del MVP; el slice IV.7/I.7 solo acota el contenido durante la construcción |
