# ADR-012 · Autoridad de decisión del Planner

STATUS: ACCEPTED · v1.0
DATE: 2026-09-17
DECISION OWNER: Ana Victoria
DECISION RECORD: **Phase 4A · Planner Domain / Decision Engine · Governance Landing** del 2026-09-17 · copia aceptada en `docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md` · línea base congelada `7cf9190726f9f4edd8f41998acc6fee8792a2d3a`, sobre `phase-3-v1.1` → `577cc711e017f1fb48ba881ea34288d865317429`
IMPLEMENTATION STATUS: **NOT IMPLEMENTED** · el BUILD de Phase 4A no está autorizado por este ADR; no existe ninguna tabla, migración, función, grant ni paquete de Planner
OWNS: autoridad de decisión del Planner · frontera cálculo/persistencia · replicabilidad e historia de las ejecuciones · gobernanza de la configuración del Planner
SPEC REFERENCES: Master Product Specification v1.0 §1.1, §7, §8, §9, §24, §49, §52; Engineering Constitution EC-003, EC-006, EC-014, EC-017; Technical Architecture v1.0 §2.3, §6, §6.1; Canonical Data & Event Model v1.0 §17, §22, §23, §26; ADR-003 v1.2 (anexo §C y §E); ADR-007 v1.1; ADR-011 anexo v1.1; INV-101, INV-106, INV-109, INV-113, INV-116; `docs/LEARNING_ENGINE_CONTRACT.md` v1.0; `docs/PLANNER_CONTRACT.md` v1.0

## Context

La ADR Policy v1.0 exige un ADR **antes** de introducir semántica de Planner. Phase 4 estaba
bloqueada por un defecto real de Phase 3 —D-26, la invocación del motor en runtime— que se
corrigió y congeló en Phase 3.1 (`phase-3-v1.1`). Resuelto ese prerrequisito, la
pre-autorización posterior redujo siete decisiones humanas escaladas a dos, y la decisión
humana P4-D1 fijó la política de selección como **composición categórica equilibrada**,
prohibiendo explícitamente cualquier parámetro numérico o cíclico de equilibrio.

Quedan dos presiones arquitectónicas que no se resuelven solas:

1. **El Planner es la primera superficie del producto que decide por la persona.** CDEM §26
   contempla un `priority_score`; ADR-003 v1.2 anexo §C prohíbe «ninguna pseudopuntuación oculta
   bajo ningún otro nombre». Sin una decisión arquitectónica, la contradicción se resolvería sola
   en el código, por conveniencia.
2. **Un plan es una decisión que el cliente no puede redactar.** El precedente aceptado en
   Phase 3 —el paquete TypeScript calcula y una función de rol de servicio persiste la carga
   calculada— es seguro únicamente porque el cliente no puede invocar la persistencia. Copiar el
   patrón de `append_learning_event`, donde la persona sí redacta legítimamente su propia
   evidencia, abriría la puerta a un plan falsificado que ninguna función podría detectar.

Y una lección que no puede quedarse en prosa: **D-26 demostró que una capacidad de servidor
probada solo por SQL equivalente no está probada.** El gate P3-G7 pasó en el plano del contrato
de base de datos mientras la ruta real de la aplicación no se ejecutaba nunca.

## Decision

1. **El Planner es determinista y autoritativo de servidor.** Misma entrada canónica, misma
   salida byte a byte. El cliente nunca compone, ordena, puntúa ni selecciona (INV-113).
2. **La selección es categórica, no numérica.** Las necesidades se derivan del vocabulario
   categórico del Learning Engine y se ordenan por composición equilibrada y desempate
   lexicográfico sobre datos de contenido. No existe puntuación de prioridad.
3. **No hay `priority_score`.** El campo de CDEM §26 queda dispuesto como **no implementado** por
   adenda del `SPEC_DIFF_LOG`, en favor de ADR-003 v1.2 anexo §C. Ninguna columna, ningún cálculo
   intermedio y ningún código de razón puede reintroducirlo con otro nombre.
4. **Ningún proxy de readiness.** Sin agregación entre conceptos, sin porcentajes, sin recuentos
   derivados, sin vocabulario de preparación. Las únicas columnas numéricas admisibles en el
   registro de decisión son la posición en la secuencia y los minutos planificados. Readiness
   sigue siendo propiedad de ADR-003 y de Phase 6.
5. **Frontera cálculo / persistencia.** El cálculo vive en un paquete TypeScript puro de
   servidor, sin red y sin dependencias. La persistencia vive en una función `SECURITY DEFINER`
   con `search_path` vacío, **ejecutable solo por el rol de servicio**. La superficie de RPC
   invocable por el cliente **permanece en dos** y no se amplía.
6. **La ejecución es una instantánea inmutable.** `planner_runs` es append-only, `planner_items`
   es inmutable y sin estado de ejecución mutable. Una replanificación añade una ejecución con
   `supersedes_run_id`; la historia no se edita.
7. **Replicabilidad.** Toda decisión se reconstruye desde su propia instantánea, sin consultar
   estado mutable posterior. Lo que dependa del historial —incluido si una necesidad de
   reparación estaba respondida— se **registra en la instantánea**.
8. **Versionado de configuración.** Se separan versión de algoritmo (constante de código),
   política de producto (`planner_config`, versionada y promovida por decisión humana) y
   parámetro de ciencia del aprendizaje (**ninguno en v1**). Una configuración versionada no es
   legítima por ser auditable.
9. **Ningún esquema privado nuevo.** Tablas en `public` con RLS forzado, más una tabla de
   auditoría sin concesión a `anon` ni a `authenticated`. El anexo v1.1 de ADR-011 autorizó
   `engine` para el Learning Engine y para nada más: este ADR **no lo amplía**. Si un análisis
   posterior demostrara que hace falta un esquema privado de Planner, exigiría su propio anexo
   aceptado antes de existir.
10. **Frontera de frescura del motor.** Una petición de plan que requiera estado autoritativo no
    planifica desde una proyección que se sabe atrasada: puesta al día **bloqueante** por la
    frontera gobernada de Phase 3.1 y, si falla, `PLAN_UNAVAILABLE_ENGINE` sin escribir ejecución.
    Sin degradación silenciosa a `fps-fixed-v1`, a planificación sin personalizar ni a datos
    atrasados.
11. **Prueba en la frontera real de runtime.** Toda capacidad crítica de servidor del Planner se
    prueba ejecutando el **módulo real de servidor contra la frontera real** donde correrá. Un
    arnés SQL o de dominio equivalente es complementario y **no suficiente**. Esta cláusula es
    autoridad de aceptación mecánica (gate P4-G16) y es la consecuencia directa de D-26.

## Alternatives considered

- **Puntuación numérica de prioridad (CDEM §26 literal).** Rechazada: contradice ADR-003 v1.2
  anexo §C, exige calibración que DEF-14 difiere, y convierte cualquier revisión futura en una
  discusión sobre pesos que nadie ha aceptado.
- **Orden global único, «reparación primero» o «cobertura primero».** Rechazada por la decisión
  humana P4-D1. Además, «orden de sílabo puro» degenera en reparación primero, porque todo
  concepto con evidencia está estructuralmente antes en el sílabo que el siguiente concepto
  nuevo.
- **Escritura del Planner invocable por el cliente con `auth.uid()`.** Rechazada: el cliente no
  puede redactar una decisión que la función no calculó, y la falsificación no sería detectable.
- **Portar la selección a SQL** para evitar la clave de servicio. Rechazada: crearía una segunda
  implementación autoritativa del Planner y contradice TA §6.1 y el precedente de Phase 3, donde
  SQL nunca calcula el pliegue.
- **Esquema privado `planner`.** Rechazada por ahora: el mecanismo de tablas cerradas por
  concesión ya resuelve la confidencialidad, y un esquema nuevo exigiría ampliar ADR-011 sin
  necesidad demostrada.
- **Reutilizar el esquema `engine`.** Rechazada: ampliaría un anexo que se firmó explícitamente
  acotado al Learning Engine.

## Consequences

**Positivas.** La política de selección es explicable en una frase y verificable por prueba. No
hay número que calibrar, así que no hay número que discutir ni que justificar ante la persona. La
historia de decisiones es reproducible. La frontera de seguridad es la que el repositorio ya usa.

**Negativas.** Sin puntuación, la expresividad del Planner v1 es limitada a propósito: no puede
matizar «esto urge más que aquello» dentro de una misma categoría. Sin política de repaso, una
persona con evidencia positiva en todo su pack llega a `NOTHING_ELIGIBLE`, que es veraz pero
deja al producto sin acción — consecuencia aceptada de P4-D1.4 y registrada como observación.

**Operativas.** La escritura autoritativa exige rol de servicio en runtime. En local, CI y
STAGING eso ya existe; en un despliegue no. OBS-3.1-01 pasa de observación a **prerrequisito con
milestone nombrado** para el recorrido humano de Phase 4B, y exigirá autorización humana
explícita en su momento. Este ADR **no** la concede.

## Product impact

Afecta a Master §1.1 («qué estudiar ahora, cuánto y por qué»), §7 (override frente a valor por
defecto, INV-106), §49 (el plan cabe en la disponibilidad; los códigos de razón explican la
selección) y §52. Preserva EC-003, EC-006, EC-014, EC-017, INV-101, INV-109, INV-113 e INV-116.

Durante toda Phase 4A **no hay cambio visible para la persona**: `fps-fixed-v1` sigue siendo el
camino de selección.

## Data/migration impact

Ninguno en este aterrizaje: **no se crea esquema**. Cuando el BUILD se autorice, el impacto
propuesto es registro de ejecuciones, ítems de ejecución, auditoría de candidatos, configuración
versionada, almacenamiento del override del mismo día, zona horaria, integridad referencial de
`study_sessions.planner_run_id` y la unicidad de sesión abierta. Cada migración con su script de
`down/`, reversible mientras ninguna ejecución esté referenciada por una sesión; a partir de ahí,
según el precedente de D-23.

## Security impact

Escritura solo con rol de servicio; RLS forzado; lectura de la persona limitada a lo suyo y a
columnas seguras; auditoría sin concesión a roles de cliente; sin ampliación de la superficie de
RPC de cliente; sin esquema privado nuevo; INV-101 intacto porque las claves de respuesta no
entran en el alcance del Planner y ningún código de razón puede codificar la corrección de una
pregunta.

## Test/acceptance impact

Introduce los gates P4-G1 … P4-G17 y P4-G19 de Phase 4A, con dos que nacen de este ADR:

- **P4-G16 · frontera real de runtime** — decisión 11;
- **P4-G19 · sin actividad sintética** — el Planner devuelve `NOTHING_ELIGIBLE` en vez de
  fabricar trabajo.

P4-G18 pertenece a Phase 4B y **no** es un gate de 4A. Ningún gate se declara PASS en gobernanza.

## Rollback

Este ADR no toca el runtime, así que revertirlo es revertir documentación. Una vez construido,
la reversión es la de sus migraciones más la retirada del paquete; mientras `planner_run_id` siga
siendo NULL en todas las sesiones, la reversión es completa. Si se llegara a superseder, se hace
con un ADR nuevo: este texto no se reescribe.

## Human approval

Approved by: Ana Victoria
Date: 2026-09-17

Alcance de la firma: autoridad de decisión del Planner y contrato v1.0. **No autoriza** el BUILD
de Phase 4A, ni esquema, ni migraciones, ni cambio en Vercel, ni Phase 4B, ni la decisión P4-D2,
ni ninguna mutación de PRODUCTION.
