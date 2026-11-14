# Synthetic Learner Lab · LAB CORE

Subsistema de pruebas que observa a STUDY OS. **No es código de producción y no tiene autoridad
sobre el producto**: nada de `apps/` ni de `packages/` lo importa, igual que ocurre con
`tests/governance/`.

## Estado

| Ámbito                                             | Estado                                        |
| -------------------------------------------------- | --------------------------------------------- |
| Experimental Design v1.0 · LAB-DF-001              | `DESIGN FROZEN`                               |
| Implementation Architecture v1.0 · LAB-ARCH-DF-001 | `ARCHITECTURE FROZEN`                         |
| Implementación                                     | **CHECKPOINT 1 · foundation/safety skeleton** |
| LAB TEMPORAL · BT-09                               | `BLOCKED / NOT AUTHORIZED`                    |
| BT-10 · BT-11                                      | `PARTIALLY_BOUND`                             |

## Qué hace CP1

Demuestra que el laboratorio **puede existir sin adquirir autoridad**: fronteras de confianza
ejecutables, guarda de sustrato fail-closed, modelo de veredicto de cinco ejes, fundación del
ledger y observador apagado.

## Qué **no** hace CP1

No ejecuta campañas. No crea aprendices sintéticos. No escribe evidencia. No ejercita LEARN ni
CHECK. No implementa Route A. No crea corpus de campaña. No introduce migraciones, ni toca
Planner, Learning Engine, STAGING, PRODUCTION ni AQUO.

## Sustrato

El único admitido es el **efímero**: Supabase local, aplicación real y navegador real, declarado
con `LAB_SUBSTRATE=ephemeral-ci`. La guarda es una **allowlist por identidad positiva** —host de
loopback literal y puerto declarado—, no una lista de prohibidos: así quedan fuera STAGING,
PRODUCTION y cualquier proyecto ajeno sin necesidad de nombrarlos.

## Mapa

| Fichero              | Contenido                                        |
| -------------------- | ------------------------------------------------ |
| `src/verdict.ts`     | los cinco ejes ortogonales de §03.2, sin aplanar |
| `src/environment.ts` | guarda de sustrato fail-closed                   |
| `src/credentials.ts` | separación de credenciales por proceso           |
| `src/ledger.ts`      | modelo lógico versionado del ledger              |
| `src/observer.ts`    | Product Observer, `NOT_ACTIVE`                   |
| `src/contracts.ts`   | interfaces de los componentes                    |

Pruebas en `tests/lab/`.
