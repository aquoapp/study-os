# CLAUDE.md · instrucciones persistentes del repositorio

Study OS. Este fichero gobierna cómo se trabaja aquí. Si algo de lo que sigue
contradice una especificación gobernante, **gana la especificación** y la
contradicción se reporta; no se resuelve en silencio.

---

## 1. Orden de autoridad

Conforme a `Source of Truth Index` (contenido v1.1) §1 y a la enmienda **SD-009**,
que incorpora la Engineering Constitution al nivel 2 y el Builder Handoff Manifest
al nivel 4:

| Nivel | Documento                        | Nota                                                                                                                  |
| ----- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1     | **Master Product Specification** | Gana siempre                                                                                                          |
| 2     | **Engineering Constitution**     | Operacionaliza. Si contradice al Master, gana el Master y se reporta                                                  |
| 3     | **Especialistas FROZEN / v1.0**  | Design System · Onboarding & Edge States · Technical Architecture · Canonical Data & Event Model · Functional Closure |
| 4     | **Builder Handoff Manifest**     | Contrato de ejecución y fases                                                                                         |
| 5     | **Hi-Fi aprobado**               | Intención visual. Nunca invalida una regla funcional o de accesibilidad                                               |
| 6     | Especialistas v0.x               | Detalle de dominio                                                                                                    |
| 7     | Material exploratorio            | No gobierna                                                                                                           |
| 8     | Archivo / histórico              | Solo trazabilidad                                                                                                     |

El mapa completo, con nombres de fichero y ambigüedades, está en
[`spec/authority-map.md`](spec/authority-map.md).

## 2. Regla de no invención

Manifest §6. Si un comportamiento requerido es **materialmente ambiguo**:

1. buscar en los artefactos gobernantes;
2. buscar en el artefacto especialista correspondiente;
3. si sigue sin resolverse, emitir un informe `BLOCKED_DECISION` con: ambigüedad,
   ficheros consultados, opciones, recomendación y consecuencia;
4. detener **solo el slice afectado**, no el trabajo no relacionado.

No se inventan reglas de negocio para poder seguir escribiendo código.

## 3. Ramas y checkpoints

- `main` está **protegida**. No se trabaja sobre ella.
- Toda fase se ejecuta en `phase/<n>-<nombre>`, que parte de `main`.
- Flujo: rama de fase → CI en verde → PR → revisión humana → merge → tag.
- Cada fase **para en su checkpoint** y no continúa a la siguiente aunque los gates
  estén verdes. La autorización para avanzar es humana y explícita.
- El informe de checkpoint sigue el formato del `Checkpoint Contract v1.0`.
  `PASS | PASS WITH DEBT | BLOCKED`. Nunca un «hecho» vago.

## 4. Invariantes que no se debilitan en silencio

La lista completa vive en [`spec/invariant-register.md`](spec/invariant-register.md).
Los que más veces se rompen por descuido:

| ID          | Regla operativa                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EC-009**  | Toda tabla expuesta con `user_id` lleva RLS **y** su test de aislamiento en la misma migración                                                                                        |
| **EC-010**  | Ningún secreto de servicio o de proveedor en el cliente. Ninguno se escribe en el repositorio ni en la conversación                                                                   |
| **EC-011**  | El esquema lo gobiernan las migraciones del repositorio. Nunca ediciones por panel                                                                                                    |
| **EC-015**  | Cinco espacios primarios: HOY · APRENDER · ENTRENAR · PROGRESO · PLAN. Una sola constante, en `@study-os/design-system`                                                               |
| **EC-017**  | Sin XP, monedas, ranking ni economía de rachas                                                                                                                                        |
| **EC-018**  | `TAI` es un pack de contenido. El literal no aparece en el shell                                                                                                                      |
| **EC-019**  | Cambiar un invariante congelado exige ADR → análisis de impacto → plan de migración y tests → aprobación humana                                                                       |
| **INV-101** | La clave de respuesta correcta nunca llega al cliente antes del envío                                                                                                                 |
| **INV-113** | El servidor es la autoridad exclusiva para persistir Mastery, Exam Readiness y Planner. Las proyecciones locales existen, pero se marcan `authoritative: false`                       |
| **INV-116** | Las superficies protegidas deciden sobre identidad **verificada en servidor**: `getClaims()` o `getUser()`. `getSession()`, una cookie o una sesión local no son autoridad suficiente |

## 5. Cómo se trabaja un slice

Manifest §9:

1. identificar los IDs de requisito y sección que lo gobiernan;
2. implementar el slice vertical coherente más pequeño;
3. añadir o actualizar migraciones;
4. añadir tests;
5. ejecutar los checks de aceptación;
6. reportar ficheros cambiados;
7. reportar riesgo y deuda no resueltos;
8. **no** declarar el slice completo con tests en rojo.

## 6. Dependencias

Manifest §7. Antes de añadir una dependencia hay que reportar: paquete o servicio,
problema que resuelve, por qué la plataforma no basta, implicación de mantenimiento
y seguridad, y si es crítica para el MVP. Las dependencias vigentes y su
justificación están en [`docs/DEPENDENCY_PROPOSAL.md`](docs/DEPENDENCY_PROPOSAL.md).

## 7. Secretos

Nunca se piden ni se escriben en la conversación. Nunca se versionan. Se configuran
en Vercel y Supabase y en el gestor de secretos local. `.env.example` documenta la
forma, jamás el valor.

## 8. Comandos

```bash
npm run verify
```

Los nueve checks bloqueantes. Los que necesitan base de datos se reportan como
**BLOQUEADO** si no la encuentran; nunca se omiten en silencio. Desde Phase 1A, `guards`
incluye una sexta guarda (`private-schema-grant-guard`, ADR-011) y el job de base de datos
de CI ejecuta además `db:roundtrip` (reversibilidad real de las migraciones). `secret-scan`
construye por sí mismo con un centinela de servidor, de modo que `verify` es
reproducible desde un checkout limpio.

El runtime es **Node 24** (`.nvmrc`) y el CLI de Supabase está fijado con versión
exacta como `devDependency`: las operaciones de base de datos pasan siempre por
`node tools/db.mjs`, que además deniega cualquier operación destructiva contra un
entorno que no la admita.

## 9. Estado actual

**Phase 0 · Foundation.** No existe ninguna tabla de dominio, ningún motor, ninguna
pantalla de producto ni contenido canónico. Ver
[`docs/PHASE_0_EXECUTION_PLAN.md`](docs/PHASE_0_EXECUTION_PLAN.md) §9 para la lista
explícita de lo que **no** se hace en esta fase.

Las cinco decisiones que condicionaban el cierre de Phase 0 quedaron **aceptadas el
2026-09-07** (`STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md`, gobernanza únicamente):
**SD-007** → ADR-006, **SD-006** → ADR-007, **SD-018** → ADR-008 (que supersede a
SD-015), **BD-02** → ADR-009 y **BD-05** → ADR-010. Todas en `ACCEPTED · NOT
IMPLEMENTED`: ninguna migración de dominio queda autorizada por la aceptación. ADR-001 …
ADR-005 siguen `PROPOSED`. **SD-019** (contraste de la paleta) sigue diferida antes de
Phase 5 y no bloquea Phase 0.

**Infraestructura real (2026-09-08).** Organización Supabase dedicada `STUDY_OS`:
`STUDY_OS_STAGING` (`xzcrqsolxarutlvvkzfp`) es el único entorno mutable y
`STUDY_OS_PRODUCTION` (`nzcgufeycvehczroryoe`) no se muta. Cualquier otro proyecto Supabase
—incluido el proyecto preexistente de otro producto que también se llamaba `STUDY_OS`— está
**prohibido**.
Repositorio `aquoapp/study-os`, **público** desde el 2026-09-08, con CI en verde y `main`
protegida por un ruleset sin bypass (PR obligatorio, checks exigidos, sin force-push ni
borrado); proyecto Vercel `study-os` vinculado a él. El repositorio privado anterior,
`aquoapp/study-os-archive-private`, es archivo de trazabilidad y no se toca ni se publica.
Los secretos viven en `.env.staging.local` y `.env.supabase-admin.local`, ignorados por Git:
nunca se leen ni se imprimen. Todo lo que se sube es público: ningún identificador de
proyectos ajenos, ningún dato real, ningún secreto. El checkpoint de Phase 0 es
**PASS WITH DEBT** (MI-05a cerrado). Phase 0 quedó aceptada, integrada en `main`
(`5d8296c`, tag `phase-0-v1.0`) y **congelada** el 2026-09-08. Vercel no despliega
Production automáticamente desde Git: exige decisión humana.

**Phase 1A · Canonical Domain Foundation · BUILD autorizado el 2026-09-09** por la Phase 1A
Build Authorization (paquete aceptado en `docs/PHASE_1A_AUTHORIZATION_PACKET.md`): ADR-011
`ACCEPTED`, anexos v1.1 de ADR-009 y ADR-010 `ACCEPTED`, SD-020 y SD-021 `ACCEPTED`, ADR-005
con disposición punto por punto y aún `PROPOSED`. **Construida** en
`phase/1a-canonical-domain-foundation` (migraciones 3–14; esquemas `content` e `ingest` no
expuestos), **auditada adversarialmente** el mismo día (migración 14 de endurecimiento;
pruebas que atacan cada invariante sin residuo, `tests/support/sql.ts` → `attack()`;
roundtrip semántico) y **aceptada y congelada** por Ana el 2026-09-09: PR #4 integrado en
`main` (`be5a26a`), tag anotado `phase-1a-v1.0`. El checkpoint de Phase 1A es
**PASS WITH DEBT** (`docs/PHASE_1A_CHECKPOINT.md`; D-20 y D-21 deben cerrarse antes de la
operación de Phase 1B). Decisiones registradas para la planificación (ARCHITECTURE_STATE
§10): custodia del contenido privado en Git privado (H-2), mapeo de campos sin duplicar
esquema (H-3), D-20 por mínimo privilegio (H-4), derechos del corpus sin resolver (H-1), FPS
con contenido GENERATED sin depender de Phase 1B (H-FPS-2). Phase 1B, Phase 2 y FPS **no**
están autorizados; el corpus oficial TAI nunca entra en este repositorio público, y los
fixtures son siempre GENERATED y visiblemente sintéticos.

**Phase 2 · Learner & Evidence Core · BUILD autorizado el 2026-09-09** por la Phase 2 Build
Authorization (paquete aceptado en `docs/PHASE_2_AUTHORIZATION_PACKET.md`): ADR-007 v1.1
(anexo: cuatro `item_type`, `ON DELETE RESTRICT`) y ADR-008 pasan a implementación
autorizada; SD-022 (canonicalización v1), SD-023 (autoridad de representación y de tiempo:
`client_created_at` nunca elige representación ni clave) y SD-008 (escala de confianza v1,
cuatro niveles) `ACCEPTED`; `learning_units` entra como adenda de contenido canónico (H-FPS-1,
opción A, solo GENERATED); `append_learning_event` y `create_study_session` son las únicas RPC
invocables por cliente, declaradas en `authority-registry.json`. El aterrizaje de gobernanza
se integró en `main` (PR #6, `0cf7467`). **Construida** en `phase/2-learner-evidence-core`:
migraciones 15–18 con rollback, 12 tablas de `public` y 2 de `ingest` con RLS forzado,
canonicalización v1, stream de eventos sin huecos, intentos inmutables con corrección en
servidor, continuidad de sesión y onboarding mínimo en `/onboarding`. **Aceptada y
congelada** por Ana el 2026-09-09: PR #7 integrado en `main` (`46b8fcd`), tag anotado
`phase-2-v1.0`. El checkpoint de Phase 2 es **PASS WITH DEBT**
(`docs/PHASE_2_CHECKPOINT.md`): D-13, D-18, D-22 (solo arnés de pruebas) y D-23 (solo
rollback) quedan abiertas y aceptadas, y D-12 cerrada. **WATCH-P2-1** se registra como
vigilancia y **no** como deuda: la corrección posterior al envío es enumerable mediante
intentos registrados, y ninguna mitigación futura puede comprometer la retroalimentación
pedagógica veraz posterior al envío. STAGING es el único entorno mutable; PRODUCTION no se
toca; Release, FPS, Phase 1B y Phase 3 **no** están autorizados.

El BUILD lo ejecutaron dos modelos: Fable 5.1 hasta agotar su límite de uso y Opus 5 tras
una recuperación forense del estado interrumpido. Si vuelve a ocurrir, la regla es la misma:
reconstruir la realidad desde el repositorio, el historial de migraciones y el catálogo antes
de escribir nada, y avanzar por commits coherentes para que la siguiente sesión pueda
retomarlo con Git.

**INV-101 ya no está abierto.** Ana lo aprobó, con su redacción congelada, en la
autorización de arranque de Phase 0. Aparece en la tabla de §4 como invariante
vigente, no como decisión pendiente. Lo mismo ocurre con **INV-113**.

Estado real del repositorio: [`docs/ARCHITECTURE_STATE.md`](docs/ARCHITECTURE_STATE.md).
Informes de fase: [`docs/PHASE_0_CHECKPOINT.md`](docs/PHASE_0_CHECKPOINT.md) y
[`docs/PHASE_1A_CHECKPOINT.md`](docs/PHASE_1A_CHECKPOINT.md).
