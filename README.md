# STUDY OS

Sistema de estudio adaptativo. **Study OS es el producto; TAI es el primer pack de contenido**
(Engineering Constitution EC-018, Builder Handoff Manifest §5).

> **Estado actual:** Phase 0 · Foundation.
> No existe todavía ninguna tabla de dominio, ningún motor, ninguna pantalla de producto
> ni contenido canónico. Ver `docs/PHASE_0_EXECUTION_PLAN.md`.

---

## Autoridad

El orden de autoridad efectivo está declarado en [`spec/authority-map.md`](spec/authority-map.md) §0b.
Resumen: Master Product Specification → Engineering Constitution → especialistas FROZEN/v1.0 →
Builder Handoff Manifest → Hi-Fi aprobado → especialistas v0.x → material exploratorio → archivo.

Ningún cambio que contradiga una especificación gobernante puede aplicarse en silencio:
requiere ADR **y** entrada versionada en [`docs/SPEC_DIFF_LOG.md`](docs/SPEC_DIFF_LOG.md)
con aprobación humana (EC-019, ADR Policy v1.0).

## Disciplina de ramas

| Rama                 | Regla                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `main`               | **Protegida.** No se trabaja directamente sobre ella. Solo recibe merges por PR con gates en verde y revisión humana. |
| `phase/<n>-<nombre>` | Rama de trabajo obligatoria por fase. Parte siempre de `main`.                                                        |

Flujo por fase: rama de fase → commits → CI en verde → PR → revisión humana → merge → tag.

> La protección de `main` es una regla de la _forge_ (GitHub/GitLab). Mientras el remoto no
> exista (**MI-05a**), la protección es una política documentada, no un control mecánico.
> Ver `docs/PHASE_0_CHECKPOINT.md` → deuda conocida.

## Estructura

```text
/apps/web              Next.js + TypeScript (App Router, PWA)
/packages/design-system Tokens y primitivas visuales
/packages/domain       Tipos y contratos de dominio compartidos
/packages/config       Resolución de configuración por entorno
/supabase/migrations   Migraciones versionadas (EC-011)
/supabase/functions    Edge Functions
/supabase/seed         Semillas (vacío en Phase 0)
/tests/unit            Tests unitarios
/tests/integration     Tests de integración y RLS
/tests/e2e             Tests end-to-end
/tools/guards          Guardas de invariante ejecutables
/spec                  Outputs de Phase −1 (congelados)
/architecture          ADR
/docs                  Estado, plan de fase, diffs de especificación, checkpoints
```

Corresponde a `Builder Handoff Manifest §8` con el refinamiento que el propio §8 autoriza
(«Exact refinement is allowed if architectural boundaries remain intact»).

## Comandos

```bash
npm run verify
```

Ejecuta los nueve checks bloqueantes de CI. Ver `docs/PHASE_0_EXECUTION_PLAN.md` §4.

## Secretos

Ningún secreto se escribe en el repositorio ni en la conversación con el agente (EC-010,
Manifest §14). Las claves se configuran en Vercel/Supabase y en el gestor de secretos local.
Solo las variables con prefijo `NEXT_PUBLIC_` de la allowlist pueden alcanzar el cliente.
