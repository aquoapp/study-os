# STUDY OS · ARCHITECTURE_STATE.md

**Propósito:** describir la **realidad** del repositorio, no la intención. Si este documento describe algo que no existe en el código, el documento está mal.

**Versión:** 1.2 · patch correctivo
**Última actualización:** 2026-08-22
**Fase actual:** −1 · Specification Compilation
**Estado global:** SIN CÓDIGO DE PRODUCTO

---

## 1. Qué existe hoy

| Elemento | Estado | Nota |
|---|---|---|
| Repositorio de aplicación | **NO EXISTE** | Phase 0 no autorizada |
| Aplicación Next.js | NO EXISTE | — |
| Proyecto Supabase | NO EXISTE | Ninguno de los tres entornos creado |
| Migraciones | NINGUNA | — |
| Políticas RLS | NINGUNA | — |
| `packages/learning-engine` | NO EXISTE | — |
| `packages/planner-engine` | NO EXISTE | — |
| `packages/design-system` | NO EXISTE | Tokens especificados, no implementados |
| Capa de IA | NO EXISTE | — |
| Tests | NINGUNO | La matriz de aceptación está especificada, no implementada |
| CI | NO EXISTE | — |
| Contenido ingerido | NINGUNO | Los workbooks son fuente de especificación, no base de datos |
| Artefactos de Phase −1 | **PROPUESTOS v1.2** | 17 exigidos por la spec (`/spec` 9 + `/architecture` 6 + `/docs` 2) + 2 no exigidos (`PHASE_MINUS_1_INDEX.md`, `/docs/PHASE_0_EXECUTION_PLAN.md`). **Total 19 ficheros.** |

## 2. Decisiones arquitectónicas vigentes

| ADR | Título | Estado |
|---|---|---|
| ADR-001 | Stack y fronteras de autoridad | PROPOSED · v1.1 (reabierto) |
| ADR-002 | Eventos de evidencia canónica | PROPOSED · v1.2 (orden total y watermark) |
| ADR-003 | Mastery, Readiness y configuración de motor | PROPOSED · v1.1 (gobierno de engine_config) |
| ADR-004 | Reconciliación offline y continuidad | PROPOSED · v1.1 (premisa WebKit corregida) |
| ADR-005 | Procedencia y versionado oficial | PROPOSED |

**Ninguna decisión está ACCEPTED.** Según ADR Policy, ninguna autoriza todavía cambio arquitectónico alguno.

## 3. Invariantes con enforcement activo

**Ninguno.** Todos los invariantes existen hoy únicamente como documento. Su conversión en constraints, políticas y tests comienza en Phase 0 (EC-010, EC-011, EC-015, INV-113) y continúa por fase según `invariant-register.md`.

Esto es exactamente lo que la Engineering Constitution advierte: *"los documentos por sí solos no son control suficiente"*.

## 4. Decisiones pendientes que bloquean estructura

| ID | Tipo | Asunto | Bloquea |
|---|---|---|---|
| MI-01 | MISSING_INPUT | 6 PDF oficiales | **PASS de Phase 1** (no Phase 0) |
| BD-02 | BLOCKED_DECISION | Identidad estable de concepto | Migración 3 |
| BD-03 | BLOCKED_DECISION | Escala de confianza (4 o 5) | Esquema de intento + CHECK |
| BD-04 | BLOCKED_DECISION | "Preparado para examen" por concepto | Función de estado visible |
| BD-05 | BLOCKED_DECISION | Convocatoria/modelo/ocurrencia | Migración 5 |
| BD-06 | BLOCKED_DECISION | Puntuación oficial y respuesta en blanco | Phase 6 |
| SD-015 | SPEC_DIFF PROPOSED | Orden total de eventos y watermark | Migración 8; antes de ingerir evidencia real |

**BD-02 y BD-05 deben resolverse antes de la primera migración de contenido.** Añadirlas después implica migrar contenido ya publicado.

## 5. Deuda técnica

Ninguna. No hay código.

**Deuda documental heredada** (no generada por la implementación): **26 contradicciones registradas** (C-01…C-26; C-26 detectada en v1.2), de las cuales 5 producen `BLOCKED_DECISION` y 1 se reclasificó como `MISSING_INPUT` (MI-01). Ver `contradiction-register.md`.

## 6. Entradas ausentes

| Entrada | Impacto | Responsable |
|---|---|---|
| 6 PDFs oficiales (cuestionarios y plantillas) | Bloquea contenido OFFICIAL respondible | Ana |
| Contenido didáctico (`learning_units`) | Bloquea LEARN más allá de IV.7/I.7 | Producción de contenido |
| Corpus normativo ingerido (Bloque I) | Limita el Tutor; capacidad legal desactivada | Producción de contenido |
| Mapping concepto↔pregunta revalidado | Bloquea siembra fiable de `question_concepts` | Contenido |
| Credenciales y plan de entornos | Necesario al iniciar Phase 0 | Ana |

## 7. Próxima transición

**De:** Phase −1 · Specification Compilation (outputs entregados, pendientes de revisión).
**A:** Phase 0 · Foundation — **no autorizada**.

Condición de entrada a Phase 0: aprobación humana de los outputs de Phase −1 v1.1 y credenciales/entornos (MI-05). MI-01 **no** bloquea Phase 0; bloquea el PASS de Phase 1. BD-02, BD-05, SD-006, SD-007, SD-015 e INV-101 pueden resolverse durante Phase 0, pero si siguen abiertas el checkpoint de Phase 0 **no puede declarar PASS**. Plan detallado en `/docs/PHASE_0_EXECUTION_PLAN.md`.

---

**Regla de mantenimiento:** este documento se actualiza en cada checkpoint. Si describe estado futuro o intenciones, se está usando mal.
