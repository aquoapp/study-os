# STUDY OS

Sistema de estudio adaptativo. **Study OS es el producto; TAI es el primer pack de contenido**
(Engineering Constitution EC-018, Builder Handoff Manifest §5).

> **Estado actual:** Phase 0 congelada (`phase-0-v1.0`) · Phase 1A · Canonical Domain
> Foundation **aceptada y congelada** (`phase-1a-v1.0`, checkpoint **PASS WITH DEBT** en
> `docs/PHASE_1A_CHECKPOINT.md`). Phase 2 · Learner & Evidence Core **BUILD autorizado** el
> 2026-09-09 (`docs/PHASE_2_AUTHORIZATION_PACKET.md`; STAGING únicamente, sin merge final).
> Phase 1B, Phase 3 y FPS no autorizados. Ningún motor, ninguna pantalla de producto y
> ningún contenido oficial: el corpus TAI no entra en este repositorio público. Ver
> `docs/ARCHITECTURE_STATE.md`.

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
/supabase/migrations   Migraciones versionadas (EC-011) · con `down/` y `.lock.json`
/supabase/functions    Edge Functions
/supabase/seed         Semillas (vacío en Phase 0)
/tests/unit            Tests unitarios
/tests/integration     Tests de integración y RLS
/tests/e2e             Tests end-to-end
/tools/guards          Guardas de invariante ejecutables (seis desde Phase 1A)
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

```bash
npm run db:roundtrip
```

Reversibilidad real de las migraciones posteriores a Phase 0: toma la firma semántica del
catálogo, revierte con los scripts `down/` en orden inverso, comprueba por firma que solo
queda Phase 0, vuelve a aplicar y exige una firma idéntica. Es destructiva: local sin más,
STAGING con autorización explícita, PRODUCTION nunca.

Esquemas (ADR-011): `public` es la única superficie expuesta al Data API; `content`
(claves de respuesta) e `ingest` (frontera de ingestión) no se exponen y ningún rol de
cliente los alcanza.

Aparte, y **fuera** de esos nueve:

```bash
npm run verify:originals
```

Comprueba los catorce artefactos de `_handoff/originals/` contra el registro de
`docs/governing-documents.json`. No se ejecuta en CI y no puede: los originales son
material de entrada y no se versionan. Ningún test versionado los lee.

## Reproducir desde un checkout limpio

Todo lo que sigue funciona sobre `git archive HEAD` extraído en una carpeta vacía,
sin `_handoff`, sin `node_modules` y sin ningún `.env`:

```bash
npm ci && npm run typecheck && npm run lint && npm run format && npm run test:unit && npm run guards && npm run secret-scan
```

`npm run build` y los E2E estáticos necesitan además la **configuración pública**.
No son secretos —viajan al navegador por definición—, pero tampoco se inventan: sin
ellos la aplicación falla en el arranque en lugar de asumir un entorno.

```bash
NEXT_PUBLIC_ENVIRONMENT=local NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=clave-publishable npm run build
```

`npm run secret-scan` no necesita ese preámbulo: construye por sí mismo, con un
centinela de servidor, precisamente para ser reproducible sin preparación previa.

## Secretos

Ningún secreto se escribe en el repositorio ni en la conversación con el agente (EC-010,
Manifest §14). Las claves se configuran en Vercel/Supabase y en el gestor de secretos local.
Solo las variables con prefijo `NEXT_PUBLIC_` de la allowlist pueden alcanzar el cliente.
