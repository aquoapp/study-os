# STUDY OS · Phase 4B · Build Log

**Naturaleza:** estado de recuperación para otro agente de ingeniería. **No es documentación
narrativa.** Nunca contiene secretos.

**Autorización:** Phase 4B Build Authorization · 2026-09-20 · Ana Victoria.
**Autoridad derivada de:** `docs/PRODUCT_UX_CONTRACT.md` v1.0 · `docs/PHASE_4B_PREAUTHORIZATION.md`
· `architecture/ADR-013` · `architecture/ADR-012` anexo v1.5 · `docs/PLANNER_CONTRACT.md` v1.4
superseded en §C §I.2 §I.3 §J §O §T §V §Z · `docs/LEARNING_ENGINE_CONTRACT.md` v1.1 · ADR-011.

---

## 0 · Fronteras prohibidas · vigentes en todo momento

PRODUCTION · AQUO · Phase 1B · corpus oficial TAI · infraestructura de pago · mastery numérica ·
retención/decaimiento/intervalos de repaso · autoridad de IA · PLAN · PROGRESO · ENTRENAR ·
Rescue como modo · notas/tutor/sync · marca externa · prototipo paralelo desechable.

`engine`, `content` e `ingest` siguen **sin exponer** (ADR-011). La superficie de RPC invocable por
cliente sigue en **dos**: `append_learning_event`, `create_study_session`.

STAGING solo se muta tras revisión de migración y pruebas en verde. PRODUCTION nunca.

---

## 1 · Estado actual

| Campo | Valor |
| --- | --- |
| Rama | `phase/4b-product-integration` |
| Base | `852a9c99e4eb60c3debee0f2e3fd215d2cceb735` (`main`, PR #22 integrado) |
| HEAD | ver §2, última fila |
| Último commit verde conocido | ver §2, última fila marcada VERDE |
| Árbol local | limpio |
| STAGING | **sin mutar** por Phase 4B |
| Preview | despliegue automático de Vercel por rama; sin configuración nueva |
| Credencial de servicio de Preview | **OBS-3.1-01 · sin configurar** |

---

## 2 · Bloques

| # | Bloque | Estado | Commit |
| --- | --- | --- | --- |
| 0 | Línea base y log de continuación | **HECHO** | este commit |
| 1 | Esquema y dominio de Phase 4B (migración 24) + OBS-4B-03 | pendiente | — |
| 2 | Runtime del Planner: duración HYBRID_V1, override, consumo | pendiente | — |
| 3 | Corpus sintético de Preview | pendiente | — |
| 4 | Sesión real: LEER · COMPROBAR · CORRECCIÓN · FIN | pendiente | — |
| 5 | HOY + disponibilidad + replanificación | pendiente | — |
| 6 | Sistema visual L2 | pendiente | — |
| 7 | Telemetría y readout de validación | pendiente | — |
| 8 | Endurecimiento de Preview y pruebas | pendiente | — |

---

## 3 · Tarea siguiente exacta

Bloque 1 · migración `supabase/migrations/00000000000024_phase4b_product_integration.sql` con su
`down/`, según la lista cerrada de `docs/PHASE_4B_PREAUTHORIZATION.md` §11.

---

## 4 · Acciones humanas pendientes

| Id | Acción | Estado |
| --- | --- | --- |
| OBS-3.1-01 | Credencial de rol de servicio en el entorno Preview de Vercel | **sin evaluar todavía** |

---

## 5 · Bitácora

### 2026-09-20 · bloque 0

Línea base reconstruida del repositorio, no de memoria. Verificado: migraciones 0–23, cinco
paquetes, `apps/web` con el vertical del FPS vivo y `apps/web/src/server/planner` construido pero
**sin consumidor de ruta**. `start_planned_session` no copia `presented_*` (Q-3 pendiente).
`create_planner_run` reutiliza sin predicado de consumo (P4B-D2 pendiente). `planner_budget` no
conoce el override (P4B-D3 pendiente). `DURATION_PROVENANCES = ['FIXTURE']`.
