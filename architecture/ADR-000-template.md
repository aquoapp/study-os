# ADR-000 · Plantilla

STATUS: TEMPLATE
DATE:
DECISION OWNER:
SPEC REFERENCES:

## Context
¿Qué problema o restricción obliga a decidir? Referenciar la especificación gobernante y, si existe, la entrada del `contradiction-register`.

## Decision
Qué se hará exactamente. Sin ambigüedad y sin adjetivos.

## Alternatives considered
Alternativas creíbles rechazadas y por qué. Si no había alternativa creíble, decirlo.

## Consequences
Consecuencias positivas, negativas y operativas.

## Product impact
Qué comportamiento o invariante de STUDY OS queda afectado. Citar EC-xxx / INV-xxx.

## Data/migration impact
Esquema, backfill, compatibilidad, rollback.

## Security impact
RLS, auth, secretos, superficie expuesta.

## Test/acceptance impact
Qué gates cambian o se añaden.

## Rollback
Cómo se revierte.

## Human approval
Approved by:
Date:

---

**Reglas (ADR Policy v1.0):**
- Un ADR no invalida por sí solo el Master Product Specification.
- Un cambio que contradiga una especificación gobernante exige **además** un cambio de especificación versionado (`SPEC_DIFF_LOG`).
- Un ADR aceptado no se reescribe para ocultar historia: se supersede con otro.
- Solo `ACCEPTED` autoriza el cambio arquitectónico.
- La conveniencia de implementación no es justificación suficiente.
