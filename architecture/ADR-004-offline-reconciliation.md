# ADR-004 · Reconciliación offline y continuidad

STATUS: PROPOSED · v1.1 (corregida la premisa sobre almacenamiento en WebKit)
DATE: 2026-08-22
DECISION OWNER: Ana Victoria
SPEC REFERENCES: Master Product Specification §10, §33, §34; Technical Architecture §4; Canonical Data & Event Model §21, §26; Engineering Constitution EC-012, EC-013; Pre-Build Closure v0.6 (01_Session_Continuity, 05_Data_Integrity); contradiction-register C-23

## Context
El soporte offline es P0 pero se implementa en Phase 9. Si las Phases 2–8 se construyen sin el contrato de evento offline, Phase 9 obliga a refactorizar seis fases (C-23, R-09). Además, la v1.0 de este ADR partía de una premisa **incorrecta** sobre WebKit. Corrección verificada contra la documentación oficial (https://webkit.org/tracking-prevention/):
- ITP aplica un límite de 7 días sin interacción a todo el almacenamiento escribible por script —IndexedDB, LocalStorage, SessionStorage, claves de medios y registros de Service Worker— para sitios usados **en el navegador**;
- **las aplicaciones web añadidas a la pantalla de inicio están exentas** de ese límite en su dominio de primera parte, y sus datos permanecen aislados de Safari.

La conclusión correcta no es que el almacenamiento local sea efímero, sino que es **best-effort**: puede desaparecer por desalojo bajo presión de disco, borrado del usuario, uso en pestaña sin instalar o cambio de dispositivo.

## Decision
1. **Separación contrato / implementación.** El **contrato de evento offline** (event_id de cliente, `client_sequence`, `created_offline`, ingestión idempotente, validación de propiedad) se implementa en **Phase 2**. La **cola IndexedDB, los reintentos y la UI de conflicto** se implementan en **Phase 9**.
2. **Los eventos se fusionan; el historial no es last-write-wins.** El servidor asigna orden autoritativo de ingestión. Un dispositivo obsoleto no puede borrar evidencia más nueva aceptada.
3. **IndexedDB es almacenamiento local best-effort y nunca la única fuente canónica.** La evidencia canónica vive en el servidor; la cola local es su antesala. Se elimina la afirmación de la v1.0 «no se asume durabilidad más allá de la sesión activa»: es falsa para la PWA instalada y demasiado pesimista para la pestaña. La cola **sí** persiste entre sesiones; simplemente no se le confiere carácter canónico.
   Consecuencias prácticas: sincronizar al reconectar y al volver a primer plano; promover la instalación en pantalla de inicio para el uso diario de estudio; no diseñar ninguna funcionalidad cuya corrección dependa de que un dato local sobreviva.
4. **Alcance offline declarado y acotado** (Master §33): lección o sesión ya cargada, cola de eventos de respuesta, borradores de nota, posición de reanudación, interacciones de repaso cuyo contenido ya es local. Todo lo demás se deshabilita con explicación, no falla en silencio.
5. **La UI nunca afirma "Sincronizado" sin ACK del servidor** (EC-012). Los estados son: sincronizado · pendiente · reconectando · conflicto que requiere atención.
6. **Conflictos:** si la reconciliación automática es segura, no se interrumpe al usuario (ED-08). Solo se bloquea cuando existe riesgo real de integridad (ED-09), y siempre preservando ambos lados antes de decidir.
7. **Las notas son documentos mutables** y requieren versión/conflicto propios (`sync_version`); no comparten el modelo de la evidencia inmutable.
8. **Sin corrección local.** La corrección de respuestas ocurre en servidor (ADR-001): offline se encola la respuesta y el feedback llega al reconectar, salvo contenido ya precacheado.

## Alternatives considered
- **Offline completo con motor en cliente:** rechazado; contradice ADR-001 y el alcance acotado del Master §33, y multiplica la complejidad antes de tener un usuario.
- **Implementar todo offline en Phase 2:** rechazado; adelanta complejidad sin necesidad y contradice la secuencia del Manifest.
- **Last-write-wins por simplicidad:** rechazado; destruye evidencia y viola EC-005.

## Consequences
**Positivas:** Phase 9 deja de ser un refactor; la continuidad de sesión funciona desde Phase 2; el contrato es verificable con tests desde el principio; el alcance offline se dimensiona sobre el comportamiento real de la plataforma, no sobre una suposición pesimista.
**Negativas:** parte del coste de Phase 9 se adelanta a Phase 2; el feedback offline no es inmediato, lo que debe comunicarse con honestidad en la UI.

## Product impact
Sostiene EC-012, EC-013 y las promesas de continuidad de Master §10. Acota expectativas: el producto promete offline **acotado y veraz**, no offline total.

## Data/migration impact
`learning_events` incluye `created_offline`, `client_created_at` y `client_sequence` desde la primera migración de eventos. `sync_state` por usuario+dispositivo. Sin backfill posterior.

## Security impact
`user_id` y `session_id` se validan siempre contra el contexto de auth; nunca se confía en el valor enviado por el cliente (Manifest §14).

## Test/acceptance impact
Phase 2: AT-24 (idempotencia), AT-01/AT-02 (continuidad), AT-03/AT-25 (cross-device).
Phase 9: AT-35 (respuestas offline sincronizadas una vez y en orden), AT-42 (dispositivos concurrentes), EC-012 (sin afirmación falsa de sincronización).

## Rollback
El contrato de evento no es reversible una vez ingerida evidencia real. La implementación de cola sí puede desactivarse degradando a modo estrictamente online.

## Human approval
Approved by:
Date:
