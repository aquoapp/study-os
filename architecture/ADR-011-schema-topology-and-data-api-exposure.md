# ADR-011 · Topología de esquemas y frontera de exposición del Data API

STATUS: ACCEPTED · v1.0
DATE: 2026-09-09
DECISION OWNER: Ana Victoria
DECISION RECORD: `STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4` · decisión C-1 aceptada en la **Phase 1A Build Authorization** del 2026-09-09 · línea base congelada `5d8296c1776be778b075d9e239b383a0476a6514` (`phase-0-v1.0`)
IMPLEMENTATION STATUS: AUTHORIZED · Phase 1A · el primer nodo de migración de Phase 1A lo implementa; hasta entonces no existe ningún esquema `content` ni `ingest`
OWNS: topología de esquemas · lista de exposición del Data API · frontera de ingestión
SPEC REFERENCES: Technical Architecture v1.0 §5.3, §5.4, §5.5, §10; Canonical Data & Event Model v1.0 §22, §23, §29 (P0-15); Master Product Specification v1.0 §44; Engineering Constitution EC-009, EC-010, EC-011, EC-019; ADR-006 (frontera de claves); INV-101, INV-116; decisión humana M-3 (Phase 1A Authorization Packet §4)

## Context

ADR-006 exige que las claves de respuesta vivan «fuera de todo esquema expuesto» pero no
fija dónde. TA §5.4 recomienda esquemas lógicos (`public`, `content`, `engine`, `audit`) y
deja la exposición exacta a la implementación; ADR-001 (PROPOSED) la fija sin estar
aceptado. La lista de exposición es una frontera de seguridad y hasta hoy solo existía
como configuración (`schemas = ["public"]` en `supabase/config.toml`). La decisión humana
M-3 ordenó no implementar topología desde un ADR PROPOSED y preparar este ADR.

## Decision

1. **`public` es la única superficie expuesta** en Phase 1A y se declara como superficie
   gobernada: contiene los recursos de aplicación (`profiles`) y el contenido canónico
   legible por `authenticated` en solo lectura.
2. **`content` es un esquema no expuesto** para material de corrección:
   `answer_key_versions` y cualquier marcador equivalente de corrección, presente o
   futuro. Ningún objeto de `content` es alcanzable por `anon` ni por `authenticated`.
3. **`ingest` es un esquema no expuesto** para la frontera de ingestión: tablas de
   staging, estado de validación y cuarentena, auditoría de promoción y las funciones de
   publicación. Ningún objeto de `ingest` es alcanzable por `anon` ni por
   `authenticated`.
4. **La lista de exposición es explícita, gobernada y probada.** Vive en
   `supabase/config.toml` (`[api].schemas`, `extra_search_path`) para el stack local y en
   la configuración de cada proyecto para STAGING y PRODUCTION. El registro
   `packages/domain/src/authority-registry.json` declara `dataApi.exposedSchemas` y
   `dataApi.nonExposedSchemas`; un test compara el registro con la configuración, y una
   prueba contra PostgREST verifica que los esquemas no expuestos responden con «no
   existe» o denegación para ambos roles de cliente.
5. **La exposición automática permanece desactivada** en todos los proyectos; los grants
   los dan exclusivamente las migraciones. Ningún `ALTER DEFAULT PRIVILEGES` concede
   nada a `anon` ni a `authenticated`.
6. **Los roles de cliente no tienen `USAGE` sobre `content` ni `ingest`.** `REVOKE ALL`
   en la migración que crea cada esquema; RLS habilitado y forzado en cada tabla de
   esos esquemas como segunda capa; sin políticas para roles de cliente.
7. **El acceso a `content` e `ingest` ocurre solo en contexto de servidor confiable**:
   `service_role` desde herramientas de servidor y CI, o funciones `SECURITY DEFINER`
   con `search_path` vacío, nombres cualificados y `REVOKE ALL … FROM public`, creadas
   por migración y listadas en el registro de autoridad como RPC reservadas cuando sean
   invocables.
8. **Ninguna vista, función o política de `public` puede leer `content` ni `ingest`**
   salvo las funciones de corrección o publicación autorizadas por un ADR aceptado y
   registradas en `authority-registry.json`.
9. **Añadir un esquema a la lista de exposición, o mover un objeto entre esquemas, es un
   cambio de frontera de seguridad** que exige ADR de supersesión o enmienda aceptada
   (EC-019) y actualización del registro y de sus pruebas.
10. **Esquemas futuros previstos y no creados aquí**: `engine` (configuración y
    funciones de motor, Phase 3) y `audit` (registros restringidos de cambio, Phase 10).
    Su creación exige enmienda de este ADR.

### Condiciones de aceptación vinculantes

- la lista de exposición efectiva es exactamente la declarada en el registro;
- `anon` y `authenticated` no alcanzan ningún objeto de `content` ni de `ingest` ni por
  PostgREST ni por RPC;
- ninguna migración concede privilegios sobre `content` o `ingest` a roles de cliente
  (guarda estática sobre el texto de las migraciones);
- ninguna tabla nueva de `public` queda expuesta sin política y grants explícitos;
- la prueba de exposición se ejecuta contra el stack local en CI y contra STAGING.

## Alternatives considered

- **Aceptar ADR-001 (`content`/`public`/`engine`/`audit`) tal cual.** Rechazado por
  decisión humana: mezcla el stack ya vigente por TA v1.0 con una topología no aprobada.
- **Un solo esquema `public` con RLS de denegación para las claves.** Rechazado: la
  exposición seguiría siendo una política y no una frontera; un `GRANT` accidental la
  desharía.
- **Tres esquemas no expuestos desde ahora (`content`, `ingest`, `engine`).** Rechazado:
  `engine` no tiene objeto en Phase 1A y crearlo sería abstracción prematura.

## Consequences

**Positivas:** INV-101 es una frontera de esquema verificable; la ingestión no puede
publicar por accidente; la lista de exposición pasa a ser código revisado.
**Negativas:** dos esquemas más y funciones de publicación explícitas; el contenido
legible y sus claves viven en esquemas distintos y la corrección exige una función de
servidor.

## Product impact

INV-101, EC-010, Master §44. Afecta a toda superficie futura de CHECK, PRÁCTICO y
simulacro.

## Data/migration impact

Primer nodo de migración de Phase 1A: `create schema content; create schema ingest;` con
`REVOKE ALL` para los roles de cliente, sin privilegios por defecto para ellos, y registro
actualizado. Sin backfill.

## Security impact

Cierra la ambigüedad de «fuera de todo esquema expuesto». Mantiene los secretos en
servidor. Una función definer mal escrita sigue siendo el riesgo residual: se exige
`search_path` vacío y revisión.

## Test/acceptance impact

`dataApi.exposureList.spec`, `dataApi.nonExposedSchemas.postgrest.spec`,
`migrations.noClientGrantsOnPrivateSchemas` (guarda `private-schema-grant-guard`),
`rls.canonicalContent.userWrite.deny.spec`. Gate P1A-G1.

## Rollback

Reversible mientras `content` e `ingest` estén vacíos (drop schema). Después, exige ADR.

## Human approval

Approved by: Ana Victoria
Date: 2026-09-09
Record: Phase 1A Build Authorization · decisión C-1 sobre
`STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md` · SHA-256
`806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4`
Scope of approval: gobernanza e implementación en Phase 1A · no autoriza Phase 1B, Phase 2,
FPS ni ninguna mutación de PRODUCTION

---

## Anexo v1.1 · **PROPUESTO · sin aprobar** · alta del esquema `engine` (Phase 3)

**Estado:** `PROPUESTO` · 2026-09-10 · **requiere firma humana antes del aterrizaje de
Phase 3.** El cuerpo v1.0 de este ADR y su aprobación del 2026-09-09 quedan intactos.

**Por qué existe este anexo.** El punto 10 del cuerpo ya previó `engine` —«configuración y
funciones de motor, Phase 3»— y declaró que **su creación exige enmienda de este ADR**. La
Phase 3 Build Authorization ordena materializar `concept_mastery`, `mastery_history`,
`error_patterns`, `projection_watermarks` y `engine_config` sin decir en qué esquema. Este
anexo cierra esa frase pendiente; no abre una decisión nueva.

**Por qué no valen `public` ni `ingest`.**

- `public` es la superficie **expuesta**. Toda tabla de `public` con columna `user_id` entra
  automáticamente en `rls.userIsolation.phase2.spec`, que es catálogo-dirigido a propósito y
  exige que **cada aprendiz lea sus propias filas**. Poner ahí la proyección obligaría a
  concederle lectura al rol `authenticated` —autoridad de cliente que ninguna fase de Phase 3
  necesita y que §21 de la autorización deja fuera— o a debilitar una prueba de aislamiento
  para que deje de mirar. Ninguna de las dos es aceptable.
- `ingest` es la **frontera de ingestión**: staging, validación, cuarentena y publicación. Una
  proyección derivada no es ingestión, y meterla ahí sería una mentira de nomenclatura que la
  siguiente fase heredaría.

**Qué se decide.**

1. **`engine` es un esquema no expuesto** para la configuración versionada del motor, sus
   proyecciones derivadas y sus funciones. Ningún objeto de `engine` es alcanzable por `anon`
   ni por `authenticated`.
2. `REVOKE ALL … FROM public, anon, authenticated` sobre el esquema; `USAGE` solo para el rol
   de servicio. RLS habilitado y **forzado** en cada tabla como segunda capa, sin políticas
   para roles de cliente.
3. El acceso ocurre solo en contexto de servidor confiable: rol de servicio, o funciones
   `SECURITY DEFINER` con `search_path` vacío, nombres cualificados y `REVOKE ALL … FROM
   public`, creadas por migración y registradas en `authority-registry.json`.
4. `dataApi.nonExposedSchemas` pasa a `["content", "ingest", "engine"]`.
   `dataApi.exposedSchemas` **no cambia**: sigue siendo `["public"]`, y `supabase/config.toml`
   no se toca.
5. Los puntos 1 … 9 del cuerpo v1.0 siguen vigentes sin modificación. Este anexo **no** amplía
   ninguna superficie expuesta: la reduce, al mantener el estado derivado fuera del Data API.

**Consecuencia sobre las pruebas.** `dataApi.exposure.spec` afirmaba literalmente que los
esquemas no expuestos eran exactamente `['content', 'ingest']`. Esa aserción se actualiza con
traza explícita a este anexo, y se extiende la batería de PostgREST a una tabla de `engine`,
de modo que la lista siga teniendo una sola definición y siga probándose contra el servidor
real.

**Alcance.** Gobernanza del esquema únicamente. No autoriza merge, ni tag, ni congelación, ni
Phase 4, ni ninguna mutación de PRODUCTION.

### Human approval · anexo v1.1

Approved by:
Date:
Record: Phase 3 Build Authorization · pendiente de firma
Scope of approval:
