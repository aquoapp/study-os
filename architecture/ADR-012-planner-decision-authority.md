# ADR-012 · Autoridad de decisión del Planner

STATUS: ACCEPTED · v1.0 (anexos v1.1 del 2026-09-17, v1.2 del 2026-09-18, v1.3 y v1.4 del 2026-09-19 · el texto v1.0 se conserva íntegro)
DATE: 2026-09-17
DECISION OWNER: Ana Victoria
DECISION RECORD: **Phase 4A · Planner Domain / Decision Engine · Governance Landing** del 2026-09-17 · copia aceptada en `docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md` · línea base congelada `7cf9190726f9f4edd8f41998acc6fee8792a2d3a`, sobre `phase-3-v1.1` → `577cc711e017f1fb48ba881ea34288d865317429`
IMPLEMENTATION STATUS: **IMPLEMENTED** · Phase 4A · **integrado en `main` y congelado el 2026-09-19** (PR #19 → `5a8f603`, tag `phase-4a-v1.0`). Construido como candidato en `phase/4a-planner-domain` (aceptado `120d166`): `packages/planner-engine`, migración 23 y el módulo de servidor del Planner (`docs/PHASE_4A_CHECKPOINT.md`). Hasta el 2026-09-19 constaba como NOT IMPLEMENTED
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

---

## Anexo v1.1 · 2026-09-17 · validación adversarial

El texto v1.0 **no se reescribe**. Este anexo registra lo que la revisión independiente corrigió y
lo que, en consecuencia, **no** puede darse por decidido.

### A1.1 · Qué no cambia

Las once decisiones de v1.0 siguen en pie sin excepción: Planner determinista y autoritativo de
servidor, selección categórica, ausencia de `priority_score`, ausencia de proxy de readiness,
frontera cálculo/persistencia, instantánea inmutable, replicabilidad, versionado de
configuración, plan no redactable por el cliente, ningún esquema privado nuevo, frontera de
frescura del motor y prueba en la frontera real de runtime.

La validación adversarial no encontró ningún defecto en la **arquitectura**. Los dos defectos
están en la **semántica de selección**, que vive en el contrato.

### A1.2 · IR-P4A-01 · una recomendación no es evidencia de ejecución

El contrato definía una necesidad de reparación como «respondida» cuando una ejecución anterior
del Planner **emitió** la acción correspondiente. Con eso, cerrar la aplicación sin hacer nada
retiraba la necesidad de la presión del Planner.

**Se eleva a decisión arquitectónica**, porque afecta a qué puede consumir la selección:

> **12. Un plan es un registro de decisión, no evidencia de ejecución.** El historial de
> ejecuciones del Planner es **auditoría**, nunca señal de selección. Lo único que satisface la
> garantía de reparación es **evidencia nueva registrada**. Ningún hecho de auditoría —cuántas
> veces se pidió un plan, si se abrió, qué se recomendó— puede influir en una decisión futura.

Gate mecánico asociado: **P4-G21**.

**Corrección puntual sobre v1.0.** La decisión 7 ponía como ejemplo de dato dependiente del
historial «si una necesidad de reparación estaba respondida». Ese ejemplo **queda sin efecto**:
ese dato ya no existe. La decisión 7 sigue vigente en lo que dice de verdad —lo que dependa del
historial se registra en la instantánea— y su ejemplo correcto es ahora la **posición de flujo de
la evidencia** que ordenó la reparación, que sí debe guardarse para que la decisión sea
verificable después.

### A1.3 · IR-P4A-02 · la atomicidad no estaba derivada

El contrato sostenía que aprender y comprobar son un único ítem indivisible porque el motor no
representa «reaprendido pero sin comprobar». La ausencia de ese estado prueba menos de lo que se
le hizo decir.

Lo que el análisis formal establece, y queda como autoridad:

- para `NEW`, el motor **sí** representa el bucle abierto mediante `EXPOSED`;
- para la reparación **no lo representa**;
- la cadena pura queda **falsada**: genera un bucle estructural del que la persona no puede salir.

Quedan dos modelos admisibles y no equivalentes, y **ninguna autoridad aceptada elige entre
ellos**. Es la decisión humana **P4-D3**, y con ella queda abierta también **P4-D4** (orden entre
`EXPOSED` y `NEW`).

### A1.4 · Consecuencia sobre el estado del contrato

`docs/PLANNER_CONTRACT.md` pasa a **`PROPOSED · BLOQUEADO POR DECISIÓN HUMANA`**. Este ADR sigue
`ACCEPTED`, porque su objeto es la frontera arquitectónica y esa no está en disputa; pero
**ninguna Build Authorization de Phase 4A puede emitirse** mientras P4-D3 y P4-D4 sigan abiertas:
el algoritmo no está determinado.

### A1.5 · Gates añadidos por este anexo

| Gate | Pasa cuando |
| --- | --- |
| **P4-G21** | emitir una recomendación no reduce la presión de la reparación; planificar dos veces sin ejecución produce el mismo plan; ningún hecho de auditoría entra en la selección |
| **P4-G22** | el empaquetado preserva la prioridad, salta lo que no cabe y no maximiza minutos ni ítems |

### A1.6 · Aprobación de este anexo

Pendiente. El anexo **registra** el resultado de la validación adversarial y **no** resuelve
P4-D3 ni P4-D4: las dos vuelven a Ana como fichas de decisión en
`docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md` §15.

---

## Anexo v1.2 · 2026-09-18 · Gate A · cierre parcial

El texto v1.0 y el anexo v1.1 **no se reescriben**.

### A2.1 · Decisiones humanas cerradas

**P4-D3 · `ACCEPTED` · granularidad híbrida.** `APRENDER` puede planificarse solo para `NEW`,
porque `EXPOSED` es la representación autoritativa ya existente del bucle abierto. La reparación
sigue siendo **atómica**: no existe estado aceptado que distinga «se reaprendió y falta verificar»
de «no ha pasado nada», y **ese estado no se inventa en Phase 4A**.

**P4-D4 · `ACCEPTED` · `EXPOSED` primero.** Precedencia categórica dentro de la continuidad, sin
pesos, ratios, cuotas ni máximos.

Ninguna de las dos autoriza retención, decaimiento, espaciado, programación de repasos, dominio
numérico ni readiness.

### A2.2 · Hallazgo nuevo · la clave de orden de la reparación no está derivada

El anexo v1.1 dio por buena «la última evidencia negativa, de más antigua a más reciente» apoyada
en la falsación de dos rivales. Ampliada la familia de políticas —todas las formulables sin
inventar ciencia del aprendizaje y sin usar el historial del Planner como señal— la vivacidad
elimina **cinco** y deja **dos** que no son equivalentes:

- **última evidencia negativa** · insiste con la reparación empezada;
- **último contacto real** · cede el turno cuando acaba de mostrarla.

Se separan ante **contacto sin verificación**, un estado alcanzable de verdad con la granularidad
híbrida ya aceptada. Es la decisión humana **P4-D5**, y este ADR **no la toma**.

Se añade como decisión arquitectónica derivada del hallazgo:

> **13. Derrotar rivales no demuestra unicidad.** Una clave de ordenación solo puede declararse
> derivada cuando se ha enumerado la familia completa de políticas formulables bajo la autoridad
> vigente y sobrevive exactamente una. En caso contrario es una decisión de producto.

### A2.3 · Lo que sí queda cerrado

`skip-non-fitting` es **única** bajo cuatro criterios con autoridad, y se comprueba contra una
definición independiente en todo el rango de presupuestos. Gate P4-G22 se mantiene.

### A2.4 · Consecuencia sobre el estado

`docs/PLANNER_CONTRACT.md` pasa a **v1.2**, y sigue **`PROPOSED · BLOQUEADO POR DECISIÓN
HUMANA`** — ahora por **P4-D5** únicamente. Este ADR sigue `ACCEPTED`. **Ninguna Build
Authorization de Phase 4A puede emitirse** mientras P4-D5 siga abierta: el algoritmo no está
determinado.

### A2.5 · Gates añadidos por este anexo

| Gate | Pasa cuando |
| --- | --- |
| **P4-G23** | la instantánea de la ejecución guarda la posición de evidencia que ordenó la reparación, de modo que «la más antigua sin atender» sea verificable después |

### A2.6 · Aprobación de este anexo

Pendiente. Registra el resultado de Gate A y **no** resuelve P4-D5, que vuelve a Ana como ficha de
decisión en `docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md` §24.

---

## Anexo v1.3 · 2026-09-19 · P4-D5 · Gate A reevaluado

El texto v1.0 y los anexos v1.1 y v1.2 **no se reescriben**.

**P4-D5 · `ACCEPTED` · última evidencia negativa.** Cuando varias reparaciones compiten, las ordena
la posición de flujo de la última evidencia negativa o conflictiva de cada concepto, de más
antigua a más reciente. **Solo la evidencia mueve la clave**: el contacto sin verificación no la
cambia. Queda como autoridad arquitectónica junto a la decisión 12 del anexo v1.1: la presentación
no cuenta como progreso, ni para eliminar una necesidad ni para rebajarla.

Con P4-D1, P4-D3, P4-D4 y P4-D5 aceptadas y P4-D2 diferida por decisión expresa, **el algoritmo
queda completamente determinado**. `docs/PLANNER_CONTRACT.md` pasa a **v1.3 · `ACCEPTED`** dentro
del candidato de gobernanza.

**Estado de implementación: sigue `NOT IMPLEMENTED`.** Gate A pasa, pero ni este ADR ni el contrato
autorizan un BUILD mientras no estén integrados en `main`: la ADR Policy v1.0 exige un ADR aceptado
para autorizar cambio arquitectónico, y CLAUDE.md §3 exige que la rama de fase parta de `main`.

---

## Anexo v1.4 · 2026-09-19 · P4-D6 · el motor proyecta la clave de P4-D5

El texto v1.0 y los anexos v1.1, v1.2 y v1.3 **no se reescriben**.

**Hallazgo que lo motiva.** Al abrir Gate B, antes de escribir código, se comprobó que la clave
aceptada en P4-D5 —la posición de stream de la última evidencia negativa de cada concepto— **no
existía en ninguna fuente que el Planner pudiera leer**. La proyección del motor emitía estado,
incertidumbre y vector; `latest_evidence_at` es una marca de `client_created_at` sobre todos los
resultados, y SD-023 prohíbe el reloj del cliente como autoridad de orden;
`concept_mastery.event_watermark` es la posición consumida por persona, idéntica en todas sus
filas. Y este ADR, junto al contrato, prohibía al Planner leer el vector y volver a plegar
evidencia. El modelo de referencia de gobernanza había tomado esa posición como una entrada
libre: probó la conducta de la política sin preguntar de dónde saldría el dato en producción.

**Decisión humana P4-D6 · `ACCEPTED` · opción A.** El **Learning Engine proyecta** el hecho
`last_negative_position` (contrato del Learning Engine, anexo v1.1 §25), y el Planner lo lee por
la frontera gobernada. Se añade como decisión arquitectónica:

> **14. Un solo pliegue autoritativo de evidencia.** Ningún consumidor del motor —el Planner
> incluido— vuelve a plegar intentos ni reimplementa atribución, exclusión de diagnóstico,
> semántica de generación, elegibilidad o clasificación de resultado. Si un consumidor necesita
> un hecho sobre la evidencia que el motor no emite, el hecho se añade **al motor**, por anexo de
> su contrato, y se prueba con `rebuild == incremental`.

Y una regla de método, porque el hallazgo no debe repetirse:

> **15. Un modelo de gobernanza solo prueba lo que su entrada puede recibir.** Toda entrada del
> modelo de referencia del Planner debe corresponder a una fuente de producción que el contrato
> permite leer. Una propiedad demostrada sobre una entrada sin procedencia autorizada no está
> demostrada.

**Lo que no cambia.** P4-D1, P4-D3, P4-D4 y P4-D5 quedan intactas; P4-D2 sigue diferida. El esquema
`engine` sigue sin exponerse (ADR-011 no se amplía). La superficie de RPC invocable por cliente no
cambia. `phase-3-v1.0` y `phase-3-v1.1` no se mueven: P4-D6 es un requisito nuevo de un
consumidor nuevo, no la corrección de un defecto de Phase 3.

**Gates.** P4-G23 y la propiedad P28 pasan a ser implementables. La implementación queda dentro
del BUILD de Phase 4A.

**Estado de implementación:** sigue `NOT IMPLEMENTED` hasta el BUILD.

---

## Anexo v1.5 · decisiones de pre-autorización de Phase 4B · 2026-09-20

**Estado:** `ACCEPTED` · decisora Ana Victoria, tras la reconciliación de pre-autorización de
Phase 4B y su revisión independiente.
**Estado de implementación:** **`NOT IMPLEMENTED`**. Este anexo no crea esquema, ni migraciones,
ni runtime, y **no autoriza el BUILD de Phase 4B**.
**Aterrizaje:** `docs/PHASE_4B_PREAUTHORIZATION.md`. **Duración:** propietario normativo
**ADR-013**, no este ADR.

Tres decisiones de autoridad de decisión del Planner quedan resueltas. Ninguna reabre P4-D1, P4-D3,
P4-D4, P4-D5 ni P4-D6, y ninguna introduce puntuación, peso, ratio, cuota ni parámetro de
equilibrio.

### 1 · P4B-D1 · `NOTHING_FITS` no ofrece acción fuera de presupuesto

§J dejaba la elección a 4B/UX sin decidirla. **Resuelta: no se ofrece como ejecutable.** El tiempo
declarado por la persona es autoritativo, Master §49 se conserva literalmente y la ejecución no
cambia de forma: cero ítems, y la acción elegible más corta registrada como `OVER_BUDGET`. La
interfaz puede enunciar con verdad esa estimación y permitir subir el tiempo de hoy, sin
preselección ni presión.

### 2 · P4B-D2 · consumo de ejecución · enmienda acotada de §O

Una ejecución está **consumida** cuando la sesión que la referencia alcanza un estado terminal. Una
ejecución consumida **no se reutiliza**: la petición siguiente escribe una sucesora aunque la
entrada canónica no haya cambiado. Una ejecución nunca arrancada conserva íntegra su
idempotencia.

**La entrada canónica no codifica el consumo.** El predicado vive en la persistencia, contra
`study_sessions`, fuera de `PlannerInput`. De ahí que P4-G4 y P4-G21 conserven su objeto exacto: el
escenario de P4-G21 es planificar dos veces *sin ejecución*, y la enmienda solo dispara *con*
ejecución.

No se toca ninguna garantía estructural: una sesión por ejecución, una sesión abierta por persona,
historia append-only y linaje lineal siguen igual, y la seguridad bajo concurrencia la dan los
índices únicos que ya existen, **sin ninguna primitiva nueva**. `start_planned_session` devuelve la
sesión existente solo si está abierta y gana el rechazo `RUN_ALREADY_CONSUMED`.

**Por qué era una decisión y no una derivación.** Edge States ED-03 nombra «Replanificar lo que
queda» como acción secundaria y REQ-C12 dice que lo no terminado vuelve al Planner; pero §O más el
índice único de una sesión por ejecución producían un punto muerto cuando la sesión terminaba sin
completar nada que cambiara la elegibilidad: la misma ejecución se reutilizaba y su arranque
devolvía una sesión ya terminal. Salir de ahí exigía enmendar §O o la entrada canónica. Enmendar la
entrada canónica habría hecho que la entrada dependiera de su propio consumo, que es justo lo que
la vuelve canónica; por eso se enmienda §O.

### 3 · P4B-D3 · override del mismo día · tabla más evento

El override vigente es **estado canónico mutable** que el Planner lee, clavado por persona y día de
plan, con el cero como dato; su declaración duradera se registra **además** como evento
`TODAY_OVERRIDE_SET`. La escritura es **solo de rol de servicio**, desde una acción con identidad
verificada, y **el día de plan se deriva en servidor** desde la zona horaria declarada: el cliente
nunca nombra la fecha. **La superficie de RPC invocable por cliente permanece en dos.**

CDEM no da hogar canónico al override —§3 no lo lleva en `learner_settings` y ninguna otra entidad
lo tiene—, mientras el enum de eventos sí trae el tipo desde la migración 18 sin contrato de
campos. Sobrevivían dos colocaciones admisibles, y la elegida es la que mantiene la lectura del
presupuesto como una consulta simple y deja la historia en el flujo append-only.

**Consecuencia que obliga a INV-118.** Aceptar un contrato de campos hace el tipo emitible por
cualquier cliente a través de `public.append_learning_event`, que reenvía todo tipo aceptado.
Historia y estado canónico podrían divergir. La lista de tipos **solo de servidor** cierra el
vector, con el mismo idioma que el registro de autoridad ya usa para las RPC.

### 4 · Invariantes que este anexo añade

| Id | Regla |
| --- | --- |
| **INV-117** | La versión de unidad y la representación de pregunta que el Planner selecciona son las que se presentan; una publicación intermedia nunca sustituye otra |
| **INV-118** | Un tipo de evento cuya autoridad de producción es el servidor no es emitible por un cliente |

**INV-113 no cambia y no se amplía:** la tabla de override **no** es una proyección autoritativa,
sino una declaración de la persona, de modo que no entra en `projections` del registro de
autoridad; su escritura es de servidor por integridad, no por ser proyección.

### 5 · Lo que no cambia

P4-D1, P4-D3, P4-D4, P4-D5 y P4-D6 intactas. Selección categórica sin puntuación, sin pesos y sin
parámetro de equilibrio. `EVIDENCE_POSITIVE` sigue sin ser elegible en v1. El esquema `engine`
sigue sin exponerse y ADR-011 no se amplía. Ningún esquema privado nuevo. `phase-3-v1.0`,
`phase-3-v1.1` y `phase-4a-v1.0` no se mueven, y los documentos congelados de Phase 4A no se
editan: la errata **E-P4B-1** sobre la redacción del gate P4-G3 se registra en el SPEC_DIFF_LOG,
no sobre ellos.

### 6 · Gates

**P4-G24 … P4-G38** quedan definidos en `docs/PHASE_4B_PREAUTHORIZATION.md` §10, con **P4-G18**
heredado. Ninguno se declara PASS en gobernanza. La implementación queda dentro de un BUILD de
Phase 4B que **todavía no está autorizado**.
