<!--
  ADR Policy v1.0 · «Phase reports must reference any ADR introduced or affected».
  EC-019 · ningún cambio silencioso de invariante congelado.
  Este PR no puede fusionarse a `main` con checks en rojo (EC-020).
-->

## Qué cambia

<!-- Una frase. Qué hace este PR que antes no se hacía. -->

## Requisitos e invariantes gobernantes

<!-- IDs concretos. Sin esto no se puede revisar: REQ-xxx, EC-xxx, INV-xxx, AT-xx -->

- REQ:
- EC / INV:
- Fase:

## ADR

- [ ] Este cambio **no** toca ninguna decisión que exija ADR (ADR Policy §«When an ADR is mandatory»).
- [ ] Este cambio referencia el ADR: `ADR-___` · estado: `PROPOSED | ACCEPTED`

> Solo un ADR en `ACCEPTED` puede autorizar un cambio arquitectónico.

## SPEC_DIFF

- [ ] No contradice ninguna especificación gobernante.
- [ ] Contradice una y está registrado en `docs/SPEC_DIFF_LOG.md` como `SD-___`, con aprobación humana.

## Migraciones

| Migración | Propósito | ¿Reversible? | ¿Destructiva? |
| --------- | --------- | ------------ | ------------- |
|           |           |              |               |

- [ ] Cada migración tiene su script en `supabase/migrations/down/`.
- [ ] Toda tabla nueva con `user_id` lleva política RLS **y** su test de aislamiento en la misma migración (EC-009).

## Checks

- [ ] `npm run verify` en verde, o los bloqueos están explicados abajo.
- [ ] `typecheck` · `lint` · `test:unit` · `test:integration` · `test:rls` · `test:e2e` · `schema-drift` · `secret-scan` · `client-authority-guard`

## Seguridad

- [ ] Sin secretos en el repositorio ni en el bundle (EC-010).
- [ ] Toda superficie protegida decide sobre identidad verificada en servidor (INV-116); ningún `getSession()` como autorización.
- [ ] Ninguna consulta filtra por un `user_id` recibido del cliente (Manifest §14).
- [ ] Ninguna ruta de cliente persiste Mastery, Exam Readiness ni Planner (INV-113).

## Qué puede romper esto

<!-- La pregunta 3 de la revisión humana del Checkpoint Contract. Respuesta honesta. -->

## Deuda que introduce

<!-- Deuda, motivo y fase en la que se resuelve. «Ninguna» es una respuesta válida si es cierta. -->
