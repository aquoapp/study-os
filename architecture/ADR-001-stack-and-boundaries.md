# ADR-001 · Stack y fronteras de autoridad

STATUS: PROPOSED · v1.1 (reabierto y reformulado tras la revisión de Product/Architecture)
DATE: 2026-08-22
DECISION OWNER: Ana Victoria
SPEC REFERENCES: Technical Architecture v1.0 §1–§6, §16; Master Product Specification §39–§40; Engineering Constitution EC-002, EC-003, EC-010, EC-018; contradiction-register C-25

## Context
La `Technical Architecture v1.0` fija el stack pero **no declara dónde se ejecutan los motores deterministas**. Los define como paquetes TypeScript y prohíbe calcular mastery autoritativo en el navegador (§3.3), sin establecer un límite verificable. Sin ese límite, un import accidental basta para que las reglas del motor —y potencialmente la lógica de corrección— viajen al cliente, y para que aparezca la tentación de "calcular rápido en local".

## Decision
1. Se adopta el stack recomendado sin cambios: Next.js + TypeScript (App Router, PWA responsive), Supabase PostgreSQL, Supabase Auth, RLS, Edge Functions, Supabase Storage, IndexedDB, motores deterministas en TypeScript, capa de IA con proveedor abstraído, despliegue en Vercel, tres entornos separados.
2. **Autoridad de persistencia, no prohibición de código (reformulado en v1.1).** La v1.0 proponía elevar «ningún código de motor en el cliente» a invariante constitucional. Era excesivo: cierra la puerta a proyecciones locales que el propio contrato offline puede necesitar (Master §33 admite interacciones de repaso con contenido ya local). La regla correcta es:
   - **el servidor es la autoridad exclusiva para persistir Mastery, Exam Readiness y estado del Planner.** Ninguna ruta de cliente escribe esas proyecciones, garantizado por grants y por RLS, no solo por convención;
   - se **admiten expresamente** helpers y proyecciones locales **no autoritativas**: feedback optimista, estimación de progreso de sesión, orden local de ítems ya planificados. Deben marcarse `authoritative: false` y ser sustituidos por la proyección del servidor al sincronizar;
   - toda divergencia entre proyección local y servidor se resuelve **siempre** a favor del servidor, sin excepción ni fusión;
   - la regla de import en ESLint se conserva como **medida de higiene revisable**, no como invariante constitucional: su incumplimiento es deuda a justificar, no un fallo duro.
   El invariante duro es INV-113 en su formulación de autoridad de persistencia, verificado por `client.no-authoritative-write.spec`.
3. **`answer_key_versions` y cualquier marca de corrección quedan fuera del esquema expuesto al Data API.** La corrección se realiza en servidor y devuelve resultado + explicación, nunca la clave (INV-101).
4. **pgvector y la recuperación semántica se difieren a Phase 8** y solo se activan si existe corpus ingerido que lo justifique. El MVP usa recuperación determinista concepto → `learning_unit` → `source_version`.
5. Se mantienen fuera de MVP: Kubernetes, microservicios, broker de eventos, base de grafo, Elasticsearch, vector DB dedicada, apps nativas, auth propia.

## Alternatives considered
- **Motores autoritativos en cliente.** Rechazado: viola EC-002/EC-003 y expone reglas y umbrales.
- **Prohibición absoluta de código de motor en el cliente (posición de la v1.0).** Rechazada tras la revisión: convierte en constitucional una decisión de implementación y bloquearía proyecciones offline legítimas. Lo constitucional es quién **persiste**, no dónde se **calcula** algo provisional.
- **pgvector desde Phase 1.** Rechazado: sin corpus normativo ingerido (C-21) no hay sobre qué buscar; añade embeddings, reindexado y filtrado de versión al camino crítico sin beneficio.
- **App nativa.** Rechazado por Master §47 salvo que la validación demuestre que la PWA es insuficiente.

## Consequences
**Positivas:** la frontera de autoridad se convierte en control mecánico sin cerrar la puerta al offline; superficie de ataque menor; Phase 8 más simple; stack mantenible por una sola persona.
**Negativas:** la corrección de respuestas requiere red (punto 3, no negociable); las proyecciones locales añaden la obligación de distinguir visualmente lo provisional de lo confirmado, lo que es trabajo de UX adicional.
**Operativas:** el proyecto de staging en plan gratuito de Supabase puede pausarse por inactividad; conviene contar con ello al planificar las pruebas.

## Product impact
Refuerza EC-002, EC-003 e INV-101 sin hipotecar el contrato offline. Las respuestas se encolan; la corrección y el feedback llegan al reconectar cuando no están precacheados. Las proyecciones locales pueden dar continuidad visual, siempre declaradas como provisionales.

## Data/migration impact
Separación de esquemas: `content` (canónico, sin exposición directa donde no sea necesaria), `public` (recursos de aplicación), `engine`, `audit`. Ninguna migración retroactiva: es la posición inicial.

## Security impact
Elimina la vía de filtración descrita en C-13. Reduce el riesgo de exponer lógica de negocio. Mantiene los secretos exclusivamente en servidor (EC-010).

## Test/acceptance impact
Añade a Phase 0: regla de import y escaneo de bundle. Añade a Phase 1/5/6: test de inspección de payload que verifica que la clave correcta no viaja al cliente.

## Rollback
Reversible: bastaría con relajar la regla de import y exponer la tabla. No recomendable; requeriría un ADR de supersesión con análisis de impacto sobre INV-101.

## Human approval
Approved by:
Date:
