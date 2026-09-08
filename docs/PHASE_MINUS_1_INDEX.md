# STUDY OS · Phase −1 · Paquete de entrega

**Versión:** 1.2 · patch correctivo
**Fecha:** 2026-08-22
**Estado:** PROPUESTO · pendiente de aprobación humana
**Código de producto escrito:** ninguno · **ADR en ACCEPTED:** ninguno · **Phase 0:** no iniciada

---

## Verificación programática (ejecutada sobre esta entrega)

| Comprobación | Resultado |
|---|---|
| REQ únicos en `requirement-index` | **123** |
| REQ con fila propia en `acceptance-matrix` | **123 / 123** |
| EC mapeados en la matriz | **20 / 20** |
| INV mapeados en la matriz | **15 / 15** |
| AT clasificados exactamente una vez | **42 / 42** (37 en MVP + 5 diferidos) |
| Deferred | **26 activos + 1 RETIRED (DEF-18)** · 27 IDs históricos |
| Contradicciones | **26** (C-01…C-26; C-26 nueva en v1.2) |
| Entradas SPEC_DIFF | **15** (SD-015 nueva) |
| Ficheros en el ZIP | **19** (17 exigidos + 2 adicionales) |

**Nota sobre el recuento de requisitos.** La revisión pedía verificar 122. El resultado real es **123** y la diferencia está justificada: la v1.1 había **eliminado en silencio** el `REQ-C15` de la v1.0 (`devices` + `sync_state`) al insertar el requisito de idempotencia en `REQ-C08` y desplazar los IDs. En v1.2 se restauran los IDs originales, se recupera ese requisito y la idempotencia recibe un ID nuevo (`REQ-C16`): 122 + 1 recuperado = 123. Con ello **RLS vuelve a ser `REQ-C13`**, como indicaba la revisión. Los IDs quedan congelados.

## Estructura del ZIP

```
PHASE_MINUS_1_INDEX.md          (no exigido por la spec)

/spec
  authority-map.md            v1.2 · original / delivered / canonical filename
  invariant-register.md       v1.2 · OBS-01 e INV-103 corregidos
  requirement-index.md        v1.2 · 123 requisitos, IDs estabilizados
  contradiction-register.md   v1.2 · 26 contradicciones (+C-26)
  terminology.md              v1.1
  domain-model.md             v1.2 · orden total y watermark
  acceptance-matrix.md        v1.2 · 123 REQ + 20 EC + 15 INV + 42 AT
  deferred-requirements.md    v1.2 · 26 activos + 1 tombstone
  risk-register.md            v1.1

/architecture
  ADR-000-template.md
  ADR-001-stack-and-boundaries.md              PROPOSED v1.1
  ADR-002-canonical-evidence-events.md         PROPOSED v1.2 · orden total
  ADR-003-mastery-vs-readiness.md              PROPOSED v1.1
  ADR-004-offline-reconciliation.md            PROPOSED v1.1
  ADR-005-provenance-and-official-versioning.md PROPOSED

/docs
  ARCHITECTURE_STATE.md          v1.2
  SPEC_DIFF_LOG.md               v1.2 · 15 entradas
  PHASE_0_EXECUTION_PLAN.md      v1.2
```

## Nomenclatura de ficheros (punto 1 de la revisión)

Los documentos gobernantes llegan al entorno con extensión `.pdf` pero su **contenido real es un ZIP de imágenes de página**, no un PDF ni un OOXML (verificado con `file` y `unzip -l`). Por tanto ni la etiqueta `.pdf` de la v1.1 ni una etiqueta `.docx` son verificables desde aquí. `authority-map` usa tres columnas: `original_filename` (solo cuando está confirmado; `UNVERIFIED` en el resto), `project_delivered_name` (verificado con `ls`) y `canonical_repo_filename`. Los dos nombres confirmados por la revisión se recogen literalmente. Queda **AMB-01**: confirmar la extensión de origen de los otros seis documentos gobernantes.

## Decisiones abiertas

| ID | Tipo | Asunto | Bloquea |
|---|---|---|---|
| MI-01 | MISSING_INPUT | 6 PDF oficiales | PASS de Phase 1 |
| MI-04 | MISSING_INPUT | Mapping concepto↔pregunta revalidado | Siembra de `question_concepts` |
| MI-05a | MISSING_INPUT | Repositorio, Supabase, Vercel | Arranque de Phase 0 |
| MI-05b | MISSING_INPUT | Proveedor/credencial de IA | **Phase 8**, no Phase 0 |
| AMB-01 | Ambigüedad | Extensión de origen de 6 documentos gobernantes | Auditoría de Drive |
| BD-02 | Decisión | Identidad estable de concepto | Migración 3 · PASS de Phase 0 |
| BD-05 | Decisión | Convocatoria / modelo / ocurrencia | Migración 5 · PASS de Phase 0 |
| BD-03 | Decisión | Escala de confianza 4 o 5 | Phases 3 y 5 |
| BD-06 | Decisión | Puntuación oficial y respuesta en blanco | Phase 6 |
| BD-04 | Decisión | "Preparado para examen" por concepto | Phases 3 y 7 |
| SD-015 | SPEC_DIFF | Orden total de eventos y watermark | Antes de ingerir evidencia real · PASS de Phase 0 |
| INV-101 | Invariante | Clave de respuesta fuera del cliente | Frontera respuestas/claves · PASS de Phase 0 |

`BD-01` está **retirado**: reclasificado como MI-01 en v1.1. No debe reaparecer.

## Cambios de este patch v1.2

1. Nomenclatura de ficheros en tres columnas; discrepancia extensión/contenido documentada.
2. Deferred: 26 activos + 1 RETIRED + 27 históricos; DEF-18 como tombstone.
3. Matriz con EC-001…EC-020 e INV-101…INV-115 completos, con prueba, fase y condición de PASS.
4. AT: 37 ejecutados + 5 diferidos; AT-04, AT-05, AT-14 y AT-27 dejan de figurar como diferidos.
5. `REQ-F07` corregido: la selección **debe** verse, con énfasis neutral y ARIA, sin señal de corrección.
6. Phase 0 Execution Plan: RLS = REQ-C13, MI-05 separado en a/b, BD-01 retirado, distinción arrancar vs cerrar con PASS.
7. OBS-01 y OBS-02: USER_001 es evidencia formativa; la calibración exige dataset representativo con criterio aprobado.
8. Orden total de eventos: `server_sequence`, watermark operativo con avance sin huecos, C-26 y SD-015 PROPOSED.
9. Estabilidad de IDs restaurada y `REQ-C15` recuperado.
