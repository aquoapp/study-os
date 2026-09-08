# STUDY OS · Phase 0 · Execution Plan

**Versión:** 1.2 · patch correctivo
**Estado:** PROPUESTO · **Phase 0 NO está autorizada.** Este documento describe qué se haría, no algo iniciado.
**Alcance:** fundación de repositorio, entornos, CI, esqueleto de auth y base del Design System.
**Fuera de alcance de Phase 0:** contenido canónico, motores, UX de estudio, migraciones de dominio, IA.

---

## 1. Precondiciones de entrada

| # | Precondición | Responsable | Bloquea |
|---|---|---|---|
| P0-IN-1 | Aprobación humana de los outputs de Phase −1 (v1.1) | Ana | Todo |
| P0-IN-2 | Aprobación de INV-101 (clave de respuesta fuera del cliente) | Ana | **No bloquea el kickoff técnico de Phase 0.** Debe estar aprobado antes de diseñar la frontera respuestas/claves, es decir antes de P0-S4 si esa migración toca el esquema de contenido, y en todo caso antes del checkpoint |
| P0-IN-3 | **MI-05a**: repositorio Git, organización/proyecto Supabase y cuenta Vercel | Ana | P0-S2, P0-S6 |
| P0-IN-5 | **MI-05b**: proveedor y credencial de IA | Ana | **NO es entrada de Phase 0.** Se necesita en Phase 8. No debe solicitarse ni configurarse ahora |
| P0-IN-4 | Confirmación del nombre del repositorio y de la política de ramas | Ana | P0-S1 |

**Distinción entre arrancar y cerrar Phase 0.** Ninguna decisión abierta impide el *scaffolding* inicial (P0-S1…P0-S8): se puede crear repositorio, entornos, CI y esqueleto de auth sin ellas. Pero **BD-02, BD-05, SD-006, SD-007, SD-015 e INV-101 sí impiden declarar PASS en el checkpoint de Phase 0 si siguen abiertas**, porque determinan la forma de las primeras migraciones de dominio y del stream de eventos, y arrancar Phase 1 sobre supuestos obligaría a pagar la migración dos veces.

**MI-01** (PDF oficiales) no afecta a Phase 0 en ningún momento: bloquea el PASS de **Phase 1**.
**Ninguna credencial se introduce en el chat.** Las claves se configuran directamente en Vercel/Supabase y en el gestor de secretos local; el agente nunca las recibe ni las escribe en el repositorio.

## 2. Secuencia de ejecución

| Paso | Trabajo | Output verificable | Depende de |
|---|---|---|---|
| P0-S1 | Inicializar repositorio y estructura de Manifest §8 | Árbol `/apps/web`, `/packages/*`, `/supabase/*`, `/tests/*`, `/spec`, `/architecture`, `/docs`, `CLAUDE.md` | P0-IN-4 |
| P0-S2 | Configurar los tres entornos y su resolución de configuración | Fichero de configuración por entorno; sin valores de producción fuera de producción | P0-IN-3 |
| P0-S3 | Andamiaje Next.js + TypeScript + PWA | App que arranca; manifest PWA válido; `strict: true` en TS | P0-S1 |
| P0-S4 | Framework de migraciones y migración 0 (extensiones/enums) | `supabase/migrations/0000_init.sql` aplicable y reversible | P0-S2 |
| P0-S5 | Esqueleto de auth + tabla `profiles` (identidad, sin dominio) | Alta y login funcionando; `profiles` 1:1; RLS activa en `profiles` desde su creación | P0-S4 |
| P0-S6 | CI con los nueve checks (§4) y despliegue de preview | Pipeline en verde sobre rama de fase | P0-S3, P0-S2 |
| P0-S7 | Fundación de tokens del Design System | Paquete `design-system` con tokens y test de contraste | P0-S3 |
| P0-S8 | Guardas de invariante (import guard, secret scan, TAI literal, primary spaces) | Cuatro checks activos y fallando ante violación deliberada | P0-S6 |
| P0-S9 | Copiar `/spec`, `/architecture`, `/docs` aprobados al repositorio y enmendar `CLAUDE.md` (SD-009) | Ficheros versionados en el repo | P0-IN-1 |
| P0-S10 | Redactar checkpoint de Phase 0 | Informe conforme al Checkpoint Contract | Todos |

## 3. Outputs de Phase 0

1. Repositorio con la estructura acordada y ramas protegidas.
2. Aplicación Next.js + TypeScript que arranca e instala como PWA.
3. Tres entornos con configuración y secretos separados.
4. Framework de migraciones con migración inicial aplicable y reversible.
5. Esqueleto de auth con `profiles` y RLS activa.
6. Paquete de tokens del Design System.
7. Pipeline de CI con nueve checks.
8. Cuatro guardas de invariante operativas.
9. `/spec`, `/architecture`, `/docs` versionados en el repositorio.
10. Checkpoint de Phase 0.

**No se entrega:** ninguna tabla de dominio, ningún motor, ninguna pantalla de producto, ningún contenido.

## 4. Tests y checks de CI

| Check | Prueba | Bloqueante |
|---|---|---|
| `typecheck` | `tsc --noEmit` | SÍ |
| `lint` | ESLint incluida la regla de import de motores | SÍ |
| `test:unit` | `tokens.contract.spec`, `tokens.contrast.spec`, `primarySpaces.frozen.spec` | SÍ |
| `test:integration` | `profile.oneToOne.spec` | SÍ |
| `test:rls` | `rls.userIsolation.profiles.spec` | SÍ |
| `test:e2e` | `app.boot.e2e`, `auth.signup-login.e2e`, `pwa.manifest.spec` | SÍ |
| `schema-drift` | `schema.drift.spec` | SÍ |
| `secret-scan` | `bundle.secret-scan.spec` | SÍ |
| `client-authority-guard` | `client.no-authoritative-write.spec` | SÍ |

Requisitos cubiertos: **REQ-A01 … REQ-A09** y, parcialmente, **REQ-C13** (RLS, verificada sobre `profiles`).
*Corrección v1.2: la v1.1 citaba REQ-C14 por el desplazamiento de IDs introducido entonces; los IDs se han restaurado y RLS vuelve a ser REQ-C13.*

## 5. Gates de salida (Manifest §10 · Phase 0)

| Gate | Condición de PASS | Evidencia |
|---|---|---|
| P0-G1 · La app arranca | `app.boot.e2e` y `pwa.manifest.spec` en verde | Log de CI |
| P0-G2 · Separación de entornos | `env.separation.spec` en verde; producción no accesible desde staging | Log de CI |
| P0-G3 · Sin secretos en cliente | `bundle.secret-scan.spec` sin hallazgos; `client.no-authoritative-write.spec` en verde | Log de CI |
| P0-G4 · Baseline lint/type/test | Los nueve checks en verde | Log de CI |
| P0-G5 (añadido) · Guardas de invariante activas | Las cuatro guardas fallan ante una violación deliberada de prueba | Commit de prueba negativa |

## 6. Stop conditions

Phase 0 se detiene y se reporta **BLOCKED** si:

1. No se dispone de credenciales o entornos (MI-05).
2. Un check de CI no puede implementarse sin introducir una dependencia con impacto arquitectónico (exige propuesta de dependencia, Manifest §7).
3. Aparece una contradicción material nueva no registrada.
4. La estructura de repositorio propuesta obliga a alterar una frontera arquitectónica congelada.
5. Cualquier gate P0-G1…P0-G5 no puede alcanzarse sin debilitar un invariante.

6. Se alcanza el checkpoint con **BD-02, BD-05, SD-006, SD-007, SD-015 o INV-101** todavía abiertas: en ese caso el checkpoint se reporta **PASS WITH DEBT o BLOCKED**, nunca PASS, porque autorizar Phase 1 sin ellas significa migrar sobre supuestos.

Phase 0 **no** se detiene por MI-01 ni por ausencia de contenido: no afectan a la fundación. La v1.1 afirmaba de forma demasiado amplia que Phase 0 no se detenía por ninguna decisión abierta; era incorrecto, porque contradecía su propio gate de salida. (El identificador BD-01 quedó retirado en v1.1 al reclasificarse como MI-01 y no debe reaparecer.) La formulación correcta es la distinción entre *arrancar* (no bloqueado) y *cerrar con PASS* (sí condicionado).

## 7. Decisiones que deben cerrarse antes del checkpoint de Phase 0

Estas no bloquean la ejecución de Phase 0, pero **sí su checkpoint**, porque determinan la primera migración de dominio de Phase 1:

| Decisión | Por qué antes del cierre de Phase 0 |
|---|---|
| **BD-02** · identidad estable de concepto | Determina la migración 3; después implicaría migrar contenido publicado |
| **BD-05** · convocatoria/modelo/ocurrencia | Determina la migración 5; misma razón |
| **SD-006** · integridad de referencias polimórficas | Determina la forma de `session_items` y `planner_items` |
| **SD-007** · claves de respuesta fuera del Data API | Determina la separación de esquemas desde la primera migración |
| **SD-015** · orden total de eventos y watermark | Determina la migración 8; debe estar decidido antes de ingerir cualquier evidencia real |
| **INV-101** | Determina el diseño del endpoint de corrección y la frontera respuestas/claves |

Y estas deben cerrarse antes del **PASS de Phase 1**, no de Phase 0:

| Decisión | Motivo |
|---|---|
| **MI-01** · PDF oficiales | Sin ellos, `official.hasOptions.spec` no puede pasar y el banco oficial P0 no existe |
| **MI-04** · mapping revalidado | Sin él no puede sembrarse `question_concepts` de forma fiable |
| **BD-03** · escala de confianza | Determina el CHECK del intento antes de acumular evidencia |
| **BD-06** · puntuación oficial y blanco | Determina la semántica del intento en blanco |

## 8. Duración estimada y riesgo

Trabajo de fundación acotado; el riesgo dominante no es técnico sino de **arrastre de decisiones**: si BD-02, BD-05, SD-006, SD-007 o SD-015 llegan sin cerrar al final de Phase 0, el checkpoint no puede declarar PASS y Phase 1 arrancaría sobre supuestos, pagando la migración dos veces.

## 9. Qué NO hará el agente en Phase 0

- No crear tablas de dominio ni de contenido.
- No implementar motores ni proyecciones.
- No construir pantallas de producto.
- No ingerir contenido, ni siquiera de prueba, en tablas canónicas.
- No introducir dependencias fuera de la lista aprobada.
- No marcar ningún ADR como ACCEPTED.
- No iniciar Phase 1 tras el checkpoint, aunque los gates estén en verde.
