# STUDY OS · Phase 4B · Product Integration · CHECKPOINT

**Veredicto: `PASS WITH DEBT`.** Aceptada por Ana el 2026-11-14 tras un walkthrough humano
longitudinal de dos días reales, y congelada el mismo día.

Este informe sigue el `Checkpoint Contract v1.0`. No declara nada que no esté demostrado, y
distingue en todo momento lo que verificó una suite de lo que verificó una persona.

---

## A · Base exacta

| Pieza | Valor |
| --- | --- |
| Rama | `phase/4b-product-integration` |
| Base | `852a9c99e4eb60c3debee0f2e3fd215d2cceb735` (`main`, Product UX Waves 1–3 y pre-autorización de Phase 4B) |
| Candidato funcional aceptado | `7c08e8a0eab56fd1ff83ad49c4fff89add85fdca` |
| HEAD integrado | `fdaeb3ecf0b92f7c2e70ee2736585474b1d6fba6` |
| Merge de implementación | **`f7886a76aa903619ee8e07a0e89fa26e95909bd7`** (PR #23) |
| Árbol del merge | `0def22e9a81c1415bb000130f1102866e864a6fc` |
| Tag anotado | **`phase-4b-v1.0`** · objeto `8231dd1c96b4c4748fbfcde3ab060bcc809fe9e8` → `f7886a7` |

**Equivalencia funcional con el candidato aceptado**, comprobada por hash de subárbol: `apps`,
`packages`, `supabase` y `tools` son **byte a byte idénticos** entre `7c08e8a` y el merge. Solo
`tests` difiere, por el correctivo de arnés autorizado el 2026-11-14.

---

## B · Qué se congela

HOY deja de mostrar una selección fija y **consume el plan real del Planner**. El vertical de
estudio queda navegable de punta a punta para una cuenta nueva, y el Learning Engine pliega la
evidencia por sus dos rutas.

| Pieza | Estado |
| --- | --- |
| `resolveToday` y los estados S1–S10 de HOY | plan real, con su presupuesto y su razón |
| Consumo del plan y ejecuciones sucesoras (P4B-D2) | una ejecución se consume al arrancar sesión; la siguiente la supersede |
| Autoridad de duración híbrida (P4-D2 · ADR-013) | `HYBRID_V1`; la ausencia de duración excluye con razón propia, no se inventa |
| `NOTHING_FITS` (P4B-D1) | no se ofrece acción fuera de presupuesto |
| Override del día (P4B-D3) | tabla más evento duradero, escritura solo de servidor |
| Onboarding | objetivo, zona horaria y disponibilidad. **Sin pregunta de diagnóstico** (OBS-4B-H05) |
| Navegación | la entrada desemboca en HOY, único destino (§O) |

**Sin migraciones nuevas.** Phase 4B vive entero dentro de la frontera de esquema ya congelada.

---

## C · Gates

| Gate | Resultado |
| --- | --- |
| Estático · typecheck, lint, unit, guardas | **PASS** |
| Base de datos · migraciones, integración, RLS, E2E | **PASS** |
| Deriva de esquema · STAGING real (EC-011) | **PASS** |
| Smoke completo de Phase 4B contra el candidato desplegado | **PASS · 45/45** |
| Walkthrough humano de dos días | **PASS** · cierra lo que ninguna suite cierra |

Cifras: **1247** unitarias · **70** E2E estáticas · **38** E2E de auth · **218** RLS · seis
guardas · `secret-scan`.

---

## D · Invariantes verificadas

| Invariante | Cómo se verificó |
| --- | --- |
| **INV-101** | la clave la fija el servidor; `graded_at` llega entre 0,07 y 0,28 s después del envío |
| **INV-102** | `CONFIDENCE_RECORDED` precede a `ANSWER_SUBMITTED` en los **siete** envíos humanos |
| **INV-103** | ninguna señal de corrección antes del envío (smoke, paso 31) |
| **INV-116** | identidad verificada en servidor en cada superficie protegida |
| **INV-117** | lo presentado es lo planificado, en todos los ítems |
| **INV-118** | el cliente no emite `TODAY_OVERRIDE_SET`: `SERVER_ONLY_EVENT_TYPE` |
| **EC-009 / EC-010 / EC-011** | RLS 218/218 · `secret-scan` y `client-authority-guard` · deriva en verde |

---

## E · El walkthrough humano, que es lo que cierra esta fase

Dos días reales, sin manipular el reloj ni teclear rutas.

**Día 1.** Onboarding sobre `preview-4b-fundamentos`; el Planner produjo una sesión de lectura
dentro del presupuesto del jueves; hubo interrupción real, reanudación y replanificación con
ejecución sucesora; se completó una sesión de cinco unidades; al volver, `NOTHING_ELIGIBLE` por
`COMPLETED_TODAY`.

**Día 2.** El `plan_day` avanzó solo y el presupuesto cambió a la entrada del viernes. El Planner
pidió comprobar lo leído: seis preguntas, con combinaciones reales de exactitud y confianza. Una
acción pendiente de cobertura sobre el séptimo concepto se completó después.

**Las dos rutas del motor, demostradas por interacción humana**, no por inferencia:

- **Ruta A** · un pliegue `INCREMENTAL` por cada uno de los **siete** envíos, entre 1,8 y 2,8 s
  después de cada uno y **antes** de volver a HOY. Es `after()` dentro de la server action.
- **Ruta B** · el pliegue que cubre `FEEDBACK_VIEWED` y `SESSION_COMPLETED`, al volver a HOY.

Estado final del motor: watermark **49**, dos conceptos `EVIDENCE_POSITIVE`, cinco
`EVIDENCE_NEGATIVE` con su `last_negative_position` igual a la posición exacta del envío, y uno
`NEW` sin unidad publicada. Integridad: 7 intentos para 7 ítems sin duplicados, **stream contiguo
1→49**, cero discrepancias de representación, cero confianzas perdidas, ninguna atribución
cruzada.

---

## F · Hallazgos corregidos durante la fase

| Hallazgo | Corrección |
| --- | --- |
| **Una cuenta nueva no tenía camino navegable hasta HOY** | la entrada desembocaba en `/cuenta`, la portada solo enlazaba allí y `/ajustes` no tenía vuelta. Las tres eran de Phase 0 y contradecían §O |
| **La suite no probaba el grafo de navegación** | todas las E2E abrían `/onboarding` tecleando la ruta. Se añade un caso que va de la portada a HOY sin escribir ninguna |
| **OBS-4B-H05 · el onboarding ofrecía un diagnóstico inexistente** | `TAKE` y `SKIP` producían el mismo recorrido. Se retira la pregunta, no la infraestructura |
| **El teardown del arnés perdía usuarios en silencio** | `deleteTestUser` ignoraba el error; el síntoma aparecía como colisión de FK en la purga |

La lección de la primera, que ya es la tercera vez que aparece en este repositorio: **una ruta
solo está probada cuando una prueba la recorre de verdad**. En D-26 fue una ruta de runtime sin
llamador; aquí, una ruta de navegación sin recorrido.

---

## G · Deuda viva

Aceptada, explícita y **no corregida**:

| ID | Qué es |
| --- | --- |
| **OBS-4B-HVIS-01** | la línea del sistema aparece pegada al contenido en varias superficies |
| **OBS-4B-HUX-01** | la continuación desde `/ajustes` es «Volver a Hoy»; pendiente de revisión contractual |
| **OBS-4B-H02** | el corpus de Preview tiene 8 conceptos y 7 unidades: uno nunca será planificable |
| **OBS-4B-H04** | `engine_processed_at` queda nulo; la autoridad de avance es el watermark (ADR-008) |
| **OBS-4B-CI-01** | `test:e2e:auth` falla de forma intermitente en CI al resolver `next/font/google` durante el build (dos de cinco ejecuciones). Vive en `apps/` y queda fuera de lo autorizado para esta congelación |

**OBS-4B-H03 retirada**: `response_ms` nulo está declarado en el contrato del Planner, así que no
era deuda. **OBS-4B-H05 cerrada** por decisión de gobernanza, sin implementar el diagnóstico.

Heredada sin cambio: D-13, D-18, D-20, D-22, D-23, WATCH-P2-1 y OBS-3.1-01.

---

## H · Lo que sigue sin autorizar

Phase 5, Phase 1B, corpus oficial, readiness, Release, PRODUCTION, Vercel Production y AQUO.
