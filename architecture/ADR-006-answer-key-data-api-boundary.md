# ADR-006 · Frontera del Data API para las claves de respuesta

STATUS: ACCEPTED · v1.0
DATE: 2026-09-07
DECISION OWNER: Ana Victoria
DECISION RECORD: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` · SHA-256 `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d` · baseline auditado `8823c2bdf2d31ec01a2f15b1566a94c1ad0eb04a`
IMPLEMENTATION STATUS: AUTHORIZED · Phase 1A (2026-09-09) · la frontera de esquema (claves en `content`, ADR-011) se implementa en Phase 1A; la corrección en servidor es de fases posteriores. Hasta el 2026-09-09 constaba como NOT IMPLEMENTED
OWNS: **SD-007** · propietario normativo único
SPEC REFERENCES: Master Product Specification v1.0 §17, §20, §29, §40, §44; Technical Architecture v1.0 §5.3–§5.4; Canonical Data & Event Model v1.0 §6, §12, §22, §23, §29 (P0-13, P0-15); Engineering Constitution EC-007, EC-009, EC-010; INV-101, INV-116; contradiction-register C-13; `docs/SPEC_DIFF_LOG.md` SD-007

## Context

La matriz RLS del CDEM §22, leída literalmente, permitiría a un cliente autenticado leer
`answer_key_versions` antes de responder: invalidaría CHECK, PRÁCTICO y simulacro sin
producir ningún error visible (C-13). INV-101 —«la clave de respuesta correcta nunca llega
al cliente antes del envío»— está aprobado desde la autorización de arranque de Phase 0,
pero era un invariante sin cambio de especificación versionado que lo respaldara: SD-007
lo proponía y seguía pendiente.

ADR-001 (punto 3) y ADR-005 (punto 4) enunciaban la misma frontera cada uno por su lado.
Dos definiciones de la misma regla acaban divergiendo. Este ADR es la única.

## Decision

1. **Fuera del esquema expuesto.** `answer_key_versions`, los identificadores de opción
   correcta, las claves de puntuación y cualquier marcador equivalente de corrección viven
   **fuera de todo esquema expuesto a clientes no confiables**. No pertenecen a ningún
   esquema listado en la exposición del Data API ni son legibles por RLS desde el rol
   `anon` ni desde el rol `authenticated`.
2. **Payload sin señal.** El payload de una pregunta enviado **antes del envío de la
   respuesta** no contiene la opción correcta ni ninguna señal equivalente: ni token, ni
   icono, ni atributo, ni orden, ni campo del que pueda derivarse la respuesta correcta
   (Master §17; REQ-F07).
3. **Corrección en contexto de servidor confiable.** La corrección se ejecuta solo en
   servidor, **después** de verificar la identidad en servidor (INV-116) y la propiedad del
   intento y de la sesión (CDEM §23; Manifest §14).
4. **El intento conserva la versión de clave usada.** `question_attempts` registra la
   versión de clave vigente en el momento del envío (`answer_key_version_id`), y una
   rectificación posterior crea recálculo, no reescribe el intento (EC-007; CDEM §12).
5. **Qué puede devolver la corrección.** Resultado del aprendiz, explicación, feedback y
   el identificador de la versión de clave usada cuando la auditoría lo requiera. **No**
   devuelve la clave reutilizable ni un payload del que la respuesta correcta pueda
   derivarse antes del envío.
6. **Los clientes ordinarios no leen ni mutan claves ni contenido canónico.** Ningún
   cliente anónimo ni autenticado ordinario puede seleccionar claves o marcadores de
   corrección, ni insertar, actualizar o borrar contenido canónico o claves (CDEM §22:
   «admin/server only»). Una ruta o control de UI oculto no es autorización (Master §44).
7. **Las credenciales de rol de servicio nunca llegan al código de cliente** (EC-010;
   CDEM §29 P0-15).

### Condiciones de aceptación vinculantes

- clientes anónimos y autenticados ordinarios no pueden seleccionar claves ni marcadores
  de corrección;
- los clientes no pueden insertar, actualizar ni borrar contenido canónico ni claves;
- los payloads de pregunta previos al envío no contienen la respuesta correcta ni señal
  equivalente;
- la corrección usa la versión de clave vigente para el intento enviado y la registra;
- las respuestas del servidor y los bundles de cliente de producción están cubiertos por
  pruebas de fuga;
- las credenciales de rol de servicio nunca alcanzan el código de cliente.

### Efecto sobre las decisiones existentes

- **SD-007** pasa a `ACCEPTED · NOT IMPLEMENTED`. Ratifica INV-101 como cambio de
  especificación versionado sobre CDEM §22 y Technical Architecture §5.3–§5.4.
- **ADR-001 punto 3** y **ADR-005 punto 4** quedan **subordinados a este ADR**: pueden
  citarlo, no redefinirlo. ADR-001 y ADR-005 siguen `PROPOSED` en todo lo demás.

## Alternatives considered

- **Exponer la tabla y confiar en la aplicación.** Rechazado: hace posible la fuga
  silenciosa de respuestas y convierte la evidencia de CHECK, PRÁCTICO y simulacro en
  ruido. Ocultar una ruta no es autorización.
- **Corrección como booleano en la opción.** Rechazado por CDEM §6 y §7: impide el
  recálculo histórico y expone la corrección con el contenido.
- **Devolver la clave completa tras el envío «para comodidad del cliente».** Rechazado:
  una clave reutilizable en el cliente es una clave filtrada para el siguiente intento y
  para el modo examen (Master §20, §29).

## Consequences

**Positivas:** INV-101 pasa de principio a frontera de esquema verificable; una sola
definición normativa; la evidencia de evaluación conserva su valor.
**Negativas:** la corrección exige red; el feedback offline se encola y llega al
reconectar (ADR-004 punto 8); la separación de esquemas obliga a diseñar la exposición
del Data API desde la primera migración de contenido.

## Product impact

INV-101, EC-007, EC-010. Afecta a CHECK, PRÁCTICO, simulacro y a la pantalla de feedback.
REQ-F07 y REQ-F09 quedan anclados en esta frontera.

## Data/migration impact

**Ninguna migración autorizada por este ADR.** Cuando se escriban las migraciones 5 y 9
(CDEM §28), deberán: mantener `answer_key_versions` y toda marca de corrección fuera de
los esquemas expuestos, con RLS que niegue lectura a `anon` y `authenticated`; registrar
`answer_key_version_id` en el intento; y acompañar cada tabla con su test de aislamiento
en la misma migración (EC-009). Sin backfill: es la posición inicial.

## Security impact

Cierra C-13. Reduce la superficie de exposición de la lógica de negocio. Mantiene los
secretos de servicio exclusivamente en servidor.

## Test/acceptance impact

Antes de la primera migración de contenido: test de política RLS negativo (rol `anon` y
`authenticated` no leen claves), test de inspección de payload (la pregunta previa al
envío no lleva señal), test de respuesta de corrección (sin clave reutilizable), escaneo
de bundle de producción y test de que el intento registra la versión de clave. Phases
1, 2, 5 y 6.

## Rollback

Reversible solo mediante ADR de supersesión con análisis de impacto sobre INV-101 y cambio
de especificación versionado. No es reversible por conveniencia de implementación.

## Human approval

Approved by: Ana Victoria
Date: 2026-09-07
Record: `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md` §3.1 y §5 · SHA-256
`6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d`
Scope of approval: gobernanza únicamente · no autoriza migraciones, implementación de
dominio, infraestructura ni Phase 1
