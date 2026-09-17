# STUDY OS · Planner Contract · v1.0

**ESTADO:** `ACCEPTED` como contrato de Phase 4A · **BUILD no autorizado**
**FECHA:** 2026-09-17
**DECISORA:** Ana Victoria · Phase 4A · Planner Domain / Decision Engine · Governance Landing
**PROPIETARIO NORMATIVO:** ADR-012
**AUTORIDAD DE ORIGEN:** Master §1.1, §3, §7, §8, §9, §24, §49, §52 · Engineering Constitution
EC-003, EC-006, EC-014, EC-017 · Technical Architecture §2.3, §6, §6.1 · CDEM §17, §22, §23,
§26 · ADR-003 v1.2 · ADR-007 v1.1 · ADR-011 anexo v1.1 · INV-101, INV-106, INV-109, INV-113,
INV-116 · Learning Engine Contract v1.0

Este contrato define **qué decide el Planner y con qué autoridad**. No es un plan de
implementación. Donde dice «el Planner», se entiende el motor de decisión de servidor, no una
pantalla.

Si algo aquí contradice una especificación gobernante, **gana la especificación** y la
contradicción se reporta.

---

## A · Propósito

El Planner responde una sola pregunta, y la responde de forma reproducible:

> **¿Qué debe estudiar esta persona ahora, cuánto tiempo, y por qué?**

Y debe poder responder después, sobre una decisión ya tomada:

> **¿Por qué STUDY OS recomendó esta acción a esta persona en aquel momento?**

La segunda pregunta es la que obliga a casi todo lo que sigue. Un Planner que acierta pero no
puede explicarse no cumple este contrato.

## B · Autoridad

1. El Planner es **autoridad exclusiva de servidor** (INV-113). El cliente nunca compone, ordena,
   puntúa ni selecciona.
2. Es **determinista**: la misma entrada canónica produce la misma salida, byte a byte (EC-003).
3. Es **auditable**: cada decisión persiste con la versión de algoritmo y de configuración que la
   produjo.
4. Es **reproducible**: una ejecución se replica desde su propia instantánea, sin consultar
   estado mutable posterior.
5. Es **neutral respecto al examen**: no calcula, insinúa ni aproxima preparación (§Y).
6. No es una IA y no consulta ninguna. Una capa de lenguaje podrá **explicar** una decisión ya
   tomada; nunca tomarla (REQ-E12).

## C · Entradas autoritativas

| Entrada | Origen | Nota |
| --- | --- | --- |
| Objetivo activo y su pack | `learner_exam_goals` | uno ACTIVE por persona |
| Versión de pack resuelta | regla única compartida con el motor (§W) | no se resuelve dos veces con reglas distintas |
| Contenido publicado, estados y orden de sílabo | `content` vía frontera de servidor | `sort_order` de bloque, tema y concepto |
| Mapeo PRIMARY VALIDATED y generación de atribución | `ingest.attribution_snapshot` | INV-109 |
| Estado categórico por concepto, incertidumbre y patrones de error activos | Learning Engine (§W) | **solo categorías**; nunca el vector |
| Tupla de frescura del motor | `engine_version`, `engine_config_version`, `attribution_pack_version_id`, `attribution_generation`, `consumed_position` | §Q |
| Sesión abierta y su cursor | `study_sessions`, `session_items` | §N |
| Historial de sesiones e ítems completados | `session_items` | exclusión `COMPLETED_TODAY` |
| Ejecuciones anteriores del Planner | `planner_runs`, `planner_items` | necesarias para §F.4 |
| Disponibilidad declarada | override del día · entrada del día de la semana · `default_daily_minutes` | §I |
| Duración autoritativa por candidato | **entrada del contrato** (§I.3) | su origen es decisión P4-D2, **diferida** |
| Fecha de calendario y zona horaria de la persona | §I.1 | «hoy» no existe sin ella |

## D · Entradas explícitamente prohibidas

Ninguna de estas entra en el Planner v1, ni directamente ni por proxy:

- **puntuación numérica de dominio o estabilidad** (Learning Engine Contract §10; ADR-003 v1.2
  anexo §C);
- **el vector de evidencia** o cualquier recuento derivado de él — leerlo para componer una cifra
  sería reconstruir el dominio numérico con otro nombre;
- **repasos vencidos, `next_review_at`, intervalos de repaso** (DEF-28; la columna está forzada a
  NULL por CHECK);
- **olvido, decaimiento o cualquier función del tiempo transcurrido** sobre el estado (contrato
  del motor §8);
- **exam readiness** en cualquier forma (§Y);
- **`priority_score`, pesos, ponderaciones, ratios, cuotas** (§G.7);
- **semántica de prerrequisitos** — `strength` no tiene significado aceptado y los ciclos no están
  impedidos hoy (DEF-E10);
- **necesidades de intervención** (DEF-29) y **recurrencia de examen** (DEF-19);
- **evidencia de diagnóstico** — `diagnostic_run_id` no lo escribe ningún camino;
- **duraciones aprendidas del comportamiento observado** (DEF-11);
- **velocidad de respuesta** (`response_ms` no se envía);
- **`target_date`** como ritmo o presión;
- **aleatoriedad** de cualquier clase.

## E · Elegibilidad del candidato

La elegibilidad es un **filtro duro con razón registrada**, anterior a toda ordenación. Un
concepto es candidato si y solo si:

1. pertenece a la versión de pack resuelta del objetivo activo;
2. tiene al menos una unidad de aprendizaje `PUBLISHED`, **o** una pregunta `PUBLISHED` con
   mapeo PRIMARY `VALIDATED` en la generación de atribución vigente;
3. el estado de su fuente lo permite (INV-109);
4. no está retirado (`RETIRED`);
5. no ha sido completado ya en el día de plan en curso.

Toda exclusión se registra con su razón: `TARGET_RETIRED`, `NO_ATTRIBUTED_QUESTION`,
`SOURCE_STATUS_EXCLUDED`, `COMPLETED_TODAY`, `POSITIVE_NO_REVIEW_POLICY`, `OVER_BUDGET`.

Un candidato excluido **no desaparece**: queda en la auditoría con su razón (§S). Esa es la
diferencia entre «no lo planifiqué» y «no lo vi».

## F · Clasificación de la necesidad

### F.1 · Necesidad por estado categórico

| Estado del motor | Necesidad | Acción correspondiente |
| --- | --- | --- |
| `NEW` | cobertura | **APRENDER + COMPROBAR** |
| `EXPOSED` | verificación de un bucle abierto | **COMPROBAR** |
| `EVIDENCE_NEGATIVE` | reparación | **REAPRENDER + COMPROBAR** |
| `EVIDENCE_CONFLICTING` | reparación | **REAPRENDER + COMPROBAR** |
| patrón de error estructural activo | reparación | **REAPRENDER + COMPROBAR** |
| `EVIDENCE_POSITIVE` | **ninguna en v1** | — (§K) |

`EXPOSED` es una necesidad legítima e independiente: la persona vio material que el producto
nunca verificó, y ese bucle lo abrió el producto (P4-D1.3). Tratarlo como necesidad **no** lo
convierte en una cifra.

### F.2 · La acción es atómica

Una acción se planifica **entera o no se planifica**. No se parte entre ejecuciones ni entre
sesiones.

Esto no es una comodidad de implementación: es una consecuencia del vocabulario del motor. No
existe ningún estado categórico que represente «reaprendido pero sin comprobar». Si el Planner
emitiera media acción, abriría un bucle de verificación que **sus propias entradas no pueden
ver**, y en la siguiente ejecución sería indistinguible de no haber hecho nada. La reproducción
histórica dejaría de ser fiel. Por tanto, la atomicidad se deriva del contrato del motor, no se
elige.

### F.3 · Los conjuntos

- **R** · necesidades de reparación **sin responder** (§F.4).
- **V** · necesidades de verificación (`EXPOSED`).
- **N** · necesidades de cobertura (`NEW`).
- **C = V ∪ N** · el conjunto de continuidad, el que P4-D1.2 protege.

### F.4 · Reparación respondida y sin responder

Una necesidad de reparación de un concepto está **respondida** cuando una ejecución anterior del
Planner ya emitió una acción de reparación para ese concepto **con una tupla de evidencia
consumida igual o posterior** a la posición de flujo de la última evidencia negativa o
conflictiva de ese concepto. En caso contrario está **sin responder**.

Esto es la definición de «responder», no una política nueva: P4-D1.1 obliga a que el plan
**responda** a la necesidad; una necesidad ya respondida no está sin responder. Evidencia
negativa nueva vuelve a crear una necesidad sin responder.

Consecuencias, y son las que hacen que el conjunto drene:

- un concepto reparado no vuelve a competir hasta que la persona vuelva a fallarlo;
- si la persona no lo reintenta, no hay evidencia nueva y la necesidad sigue respondida;
- entre varias reparaciones pendientes, la ordenación natural es la del sílabo, y las respondidas
  ceden ante las que no lo están.

El valor de «respondida / sin responder» se **registra en la instantánea** de la ejecución
(§S), porque depende del historial y la reproducción no puede consultar historial mutable.

## G · Composición categórica equilibrada

P4-D1 rechaza tanto «reparación primero» como «cobertura primero» como política completa. Lo que
autoriza es **PROGRESO + REPARACIÓN**, sin castigo y sin ignorar la evidencia, y prohíbe
explícitamente cualquier parámetro numérico o cíclico de equilibrio (P4-D1.7).

### G.1 · Las dos garantías

**G-R · garantía de reparación** — derivada de P4-D1.1.
Si **R ≠ ∅** y el presupuesto admite su acción correspondiente, el plan contiene una acción de
reparación: la de menor clave de sílabo entre las de **R**.

**G-C · garantía de continuidad** — derivada de P4-D1.2.
Mientras queden acciones de **C** elegibles y quepan, la reparación no consume el resto del plan.

### G.2 · El algoritmo

1. Si **R ≠ ∅** y su acción de menor clave de sílabo cabe en el presupuesto: colocarla. **G-R**.
2. Llenar el presupuesto restante con acciones de **C**, en orden de sílabo, mientras quepan.
3. Cuando no quede ninguna acción de **C** por colocar, seguir llenando con **R** en orden de
   sílabo.
4. Parar en el presupuesto. Nunca rellenar (§L, P4-D1.6).

### G.3 · Por qué la reparación va en la cabeza y la cobertura en el resto

P4-D1.1 es una obligación incondicional («debe responder»); P4-D1.2 es una prohibición de
monopolio. Si la cabeza fuera de cobertura, un presupuesto pequeño podría dejar el plan sin
ninguna reparación y **G-R** se incumpliría. Si la cola fuera de reparación sin agotar antes la
cobertura, **G-C** se incumpliría. El orden queda determinado; no se elige.

### G.4 · Por qué exactamente una, y por qué eso no es una cuota

P4-D1.1 es una garantía **existencial**: exige que exista una respuesta, no una cantidad de
respuestas. La aridad de un existencial es uno. Cero incumple P4-D1.1; cualquier valor mayor que
uno sería una cantidad **elegida**, es decir, exactamente el parámetro de equilibrio que P4-D1.7
prohíbe inventar.

El uno no se elige como proporción: es lo que queda cuando se satisface la garantía y no se
añade nada. Y el tope no se fija: es el complemento de la garantía — ninguna otra regla coloca
reparación mientras quede cobertura por colocar.

### G.5 · Por qué la asimetría es derivada

No hay tope simétrico para la cobertura porque **ninguna invariante protege a la reparación de la
cobertura**. P4-D1.2 protege a `NEW`/`EXPOSED` del monopolio de la reparación; no existe la
obligación recíproca. Imponer un tope a la cobertura sería inventar una política que nadie ha
aceptado.

### G.6 · Por qué el orden de sílabo no basta por sí solo

Un concepto solo tiene evidencia si ya se estudió, y el estudio avanza en orden de sílabo. Por
tanto **todo concepto con evidencia está, estructuralmente, antes en el sílabo que el siguiente
concepto nuevo**. Una composición puramente ordenada por sílabo degenera en «reparar y verificar
todo lo ya tocado antes de avanzar», que es precisamente el monopolio que P4-D1.2 prohíbe. Esta
es la razón por la que las garantías son **posicionales** (una cabeza) y no ordinales.

### G.7 · Lo que esta composición no introduce

Ni ratio, ni porcentaje, ni peso, ni cuota, ni turno rotatorio, ni longitud de ciclo, ni máximo
de categorías consecutivas, ni constante de alternancia, ni azar. La mezcla real de un plan es
**consecuencia** de la elegibilidad y del presupuesto, nunca de una proporción configurada.
`planner_config` no puede contener ninguno de esos valores (§T).

## H · Desempate determinista

Solo datos estables de contenido. Nunca el orden de filas, `created_at` ni el UUID como clave
primaria de orden:

1. `syllabus_blocks.sort_order`
2. `topics.sort_order`
3. `concept_versions.sort_order`
4. `concept_key`, comparado **por punto de código**, no por colación de locale
5. `concepts.id`

Para elegir pregunta dentro de una acción: entre las publicadas con mapeo atribuido y no
respondidas en el día de plan, `canonical_questions.id` por punto de código.

La comparación por punto de código es obligatoria: `fps-fixed-v1` usa `localeCompare`, y una
colación dependiente de locale haría que el mismo plan dependiera del entorno.

## I · Semántica de presupuesto

### I.1 · «Hoy»

El día de plan es una fecha de calendario en la **zona horaria declarada de la persona**. Sin
zona horaria no existe «hoy», y el Planner no la deduce de la IP, del navegador ni del servidor.

### I.2 · Origen del presupuesto

Precedencia, aceptada en H-P4-4:

1. **override válido del mismo día**, si existe;
2. **entrada explícita del día de la semana** en `weekly_availability_json`, **incluido `0`**;
3. **`default_daily_minutes`**.

El cero es dato, no ausencia. Una clave ausente sí es ausencia y cae al siguiente nivel.

El override **nunca** modifica `default_daily_minutes` (INV-106, REQ-E06). Cambiar el valor por
defecto afecta a ejecuciones futuras y **no reescribe** ninguna ejecución pasada, ninguna sesión
ni ningún evento (REQ-E05).

Cada ejecución registra el valor usado **y su procedencia**.

### I.3 · Duración: entrada, no política

El Planner recibe la duración autoritativa de cada candidato **como entrada del contrato**. Este
contrato **no** fija su origen: P4-D2 está deliberadamente diferida a una decisión previa a
Phase 4B.

En consecuencia, y esto es vinculante:

- Phase 4A **no** añade metadatos de duración al contenido;
- **no** crea valores por defecto por tipo de ítem;
- **no** inventa minutos;
- `planner_config` **no** se puebla con duraciones;
- las duraciones de fixture usadas en pruebas son **datos de prueba** y no pueden convertirse en
  constantes de runtime;
- FPS-OBS-04 **no** queda cerrada.

### I.4 · Acumulación

Se acumulan acciones completas (§F.2) mientras la suma de sus minutos declarados quepa en el
presupuesto. El Planner selecciona una **secuencia acotada en tiempo**, no un número de ítems.
El tiempo transcurrido real se registra como evidencia y **no** alimenta ninguna estimación
(DEF-11).

### I.5 · `ZERO_TIME`

Presupuesto cero: una ejecución con **cero ítems** y razón `ZERO_TIME`. Sin backlog, sin
contador, sin marca de deuda y sin lenguaje de fallo (REQ-E08, EC-014).

## J · `NOTHING_FITS`

Si existen candidatos elegibles pero **ninguna acción completa cabe** en el presupuesto:

- la ejecución se emite con cero ítems y estado `NOTHING_FITS`;
- **no se coloca un ítem por encima del presupuesto**;
- la acción elegible más corta queda registrada como exclusión `OVER_BUDGET`.

Colocar un ítem fuera de presupuesto contradiría Master §49 («el plan cabe en la
disponibilidad») y Master §8 («la acción de mayor valor **que quepa**»). Ofrecer o no a la
persona esa acción por encima del presupuesto es una decisión de producto **diferida a 4B/UX**:
el modelo de datos la soporta sin decidirla.

## K · `NOTHING_ELIGIBLE`

Si todos los conceptos por lo demás relevantes son `EVIDENCE_POSITIVE` y no existe ninguna otra
necesidad autorizada, el Planner devuelve `NOTHING_ELIGIBLE` (P4-D1.5).

`EVIDENCE_POSITIVE` **no es elegible de forma independiente en v1**, y no se recicla por el mero
hecho de que no quede otro candidato (P4-D1.4). Planner v1 no tiene modelo de retención, de
decaimiento, de espaciado ni de estabilidad, ni intervalo ni política de repaso: por tanto
**carece de autoridad para afirmar que un concepto con evidencia positiva deba revisarse en un
momento dado**.

`NOTHING_ELIGIBLE` significa exactamente una cosa:

> el modelo actualmente autorizado no tiene ninguna acción de estudio justificada.

Y **no** significa ni puede presentarse como: preparado para el examen · dominado para siempre ·
listo · aprendizaje terminado · 100 % aprendido · sin repaso futuro necesario.

Esta distinción es normativa y es materia de prueba mecánica (§Z, P4-G12).

## L · Sin actividad sintética

El Planner **nunca** genera actividad con el único fin de no devolver un plan vacío
(P4-D1.6).

Un plan no vacío **no es un invariante de producto**. La ausencia veraz de recomendación
autorizada es preferible a trabajo fabricado. En particular, no se recurre a
`EVIDENCE_POSITIVE`, ni a ninguna otra señal no autorizada, para rellenar.

Gate P4-G19.

## M · Ejecución inmutable

Una ejecución del Planner es un **registro histórico de decisión**, no un estado editable:

- `planner_runs` es **append-only**;
- `planner_items` es **inmutable** y no lleva estado de ejecución mutable: el progreso vive en
  `session_items`;
- una replanificación **añade** una ejecución nueva con `supersedes_run_id`; no edita la anterior
  (REQ-E13);
- «el plan actual» es la última ejecución no superseded del objetivo, no una fila mutable.

## N · La sesión abierta gana

Si existe una sesión válida abierta, gana siempre:

- no se crea ninguna ejecución del Planner;
- el estado devuelto es `RESUME_REQUIRED`;
- la reanudación **nunca consulta el plan**: misma sesión, mismos ítems, mismo cursor;
- ninguna ejecución del Planner reescribe, reordena ni interrumpe una sesión abierta.

Esto preserva sin cambios la semántica de Phase 2 y del FPS.

## O · Reutilización del plan

Una ejecución es una instantánea. Si vuelve a pedirse un plan y el **hash de entrada canónica**
es idéntico al de la última ejecución no superseded del día, se reutiliza esa ejecución y **no**
se escribe otra. Peticiones repetidas idénticas son idempotentes.

## P · Invalidación y replanificación

Una ejecución queda invalidada cuando su tupla de entrada deja de coincidir con la actual.
Casos, todos derivados y ninguno nuevo:

| Situación | Resultado |
| --- | --- |
| Cambia la disponibilidad | ejecución nueva; la sesión abierta no se reescribe |
| Cambia el objetivo | las ejecuciones están ligadas al objetivo; el objetivo nuevo genera ejecución nueva; las antiguas se conservan |
| Cambia la versión de contenido | desajuste de tupla → replanificación en la siguiente petición |
| Cambia la generación de atribución | igual |
| Llega evidencia nueva (también desde otro dispositivo) | avanza la posición de flujo → desajuste → replanificación futura; la sesión abierta gana |
| La proyección estaba atrasada | §Q |
| Contenido recomendado retirado | el ítem no iniciado se excluye al arrancar con `TARGET_UNAVAILABLE` y se replanifica |

**Phase 4A no define umbrales de Rescue ni de ausencia.** «Materialmente por debajo» (Master §8)
y «ausencia significativa» (Master §9) no están definidas en ninguna autoridad aceptada, y este
contrato **no las inventa** (H-P4-5). 4A conserva los hechos mecánicos —si el presupuesto de hoy
difiere del derivado del valor por defecto, y cuántos días de calendario han pasado desde la
última evidencia— y nada más. Las experiencias nombradas **Rescue** y **Recovery** pertenecen a
4B/UX.

## Q · Frescura del motor y puesta al día bloqueante

Regla congelada tras Phase 3.1:

> Una petición de plan que requiera estado autoritativo de la persona **no puede planificar en
> silencio desde una proyección del Learning Engine que se sabe atrasada.**

1. En la petición, con identidad verificada en servidor, se calcula la tupla de frescura.
2. Si está atrasada, incoherente, o han cambiado la configuración o la generación: se intenta una
   **puesta al día bloqueante** a través de la frontera de invocación gobernada y aceptada
   (envoltorios `public.engine_*`, migración 21).
3. Si tiene éxito: se planifica contra la tupla autoritativa resultante, y la ejecución **registra
   la tupla que consumió**.
4. Si falla: **no se escribe ninguna ejecución autoritativa** y se devuelve
   `PLAN_UNAVAILABLE_ENGINE`. La sesión abierta sigue ganando.

No hay degradación silenciosa: ni a `fps-fixed-v1`, ni a planificación sin personalizar, ni a
planificación con datos atrasados, salvo autorización futura y explícita.

La recuperación asíncrona existente (`recoverProjectionOnReturn`, ruta B de Phase 3.1) sigue
siendo útil y **no es sustituto** de esta frontera: entrega su trabajo a `after()`, es decir
después de enviar la respuesta, de modo que una petición de plan de esa misma respuesta leería
estado previo a la recuperación.

## R · Explicabilidad

La pregunta que Phase 4A debe poder responder siempre, sobre cualquier decisión pasada:

> **¿Por qué STUDY OS recomendó esta acción a esta persona en aquel momento?**

La respuesta se reconstruye **solo** desde datos congelados de la ejecución, nunca desde estado
mutable actual. Evidencia semántica mínima que la ejecución debe conservar:

- objetivo y versión de contenido resuelta;
- generación de atribución cuando sea relevante;
- estado y frescura del motor consumidos;
- elegibilidad del candidato y razones de exclusión;
- categoría de necesidad por concepto, y si la reparación estaba respondida o sin responder;
- **razón de composición**: si la acción entró por `G-R`, por continuidad, o por desbordamiento
  tras agotar la continuidad;
- clave de desempate efectivamente usada;
- valor de presupuesto y su procedencia;
- acción seleccionada, con su objetivo tipado y su versión fijada;
- versión de Planner y de configuración.

Los códigos de razón son un **enum cerrado y versionado**. La redacción visible para la persona
deriva de ellos (REQ-F03, Phase 5) y **nunca** expone versiones, watermarks, generaciones,
recuentos, porcentajes ni nombres de estado categórico. Que un nombre de estado se almacene para
auditoría no autoriza a mostrarlo.

## S · Auditoría de candidatos y exclusiones

La instantánea de candidatos es el registro de **lo que no se eligió y por qué**. Sin ella, la
pregunta de §R solo se puede responder para lo que sí se planificó, que es la mitad fácil.

Contiene, por concepto candidato: la necesidad categórica, el estado de respuesta de la
reparación, la razón de exclusión si la hubo, y la clave de sílabo usada para ordenar.

Contiene nombres de estado categórico del motor. Por tanto es **material de servicio**: ninguna
concesión a `anon` ni a `authenticated` (§U).

## T · Gobernanza de la configuración

Tres cosas distintas, y la distinción es normativa:

| Clase | Dónde vive | Ejemplo |
| --- | --- | --- |
| **Versión de algoritmo** | constante de código, sube con la release | `planner_version` |
| **Política de producto** | `planner_config`, versionada y promovida por decisión humana | el enum de razones; la política de día de plan |
| **Parámetro de ciencia del aprendizaje** | **ninguno en v1** | — |

Una configuración versionada **no es legítima por ser auditable**. `planner_config` no puede
convertirse en la puerta trasera de la ciencia inventada. Queda **prohibido** que contenga:

- pesos, ratios, porcentajes, cuotas, puntuaciones;
- longitudes de ciclo, constantes de alternancia, máximos de categorías consecutivas;
- umbrales sobre recuentos de evidencia, o reutilización del «3» del motor;
- intervalos de repaso, semividas, factores de decaimiento;
- **duraciones por defecto** (§I.3);
- umbrales de «materialmente por debajo» o de «ausencia significativa».

P4-D1 autoriza la composición categórica equilibrada. **No** autoriza pesos ni ratios dentro de
`planner_config`.

## U · Seguridad y autoridad de servidor

1. **Petición:** la persona autenticada, solo para sí misma, a través de una acción de servidor
   con identidad verificada (INV-116).
2. **Cálculo:** paquete TypeScript puro de servidor, determinista y sin red. Nunca en el cliente,
   nunca en una IA.
3. **Persistencia:** función `SECURITY DEFINER` con `search_path` vacío, ejecutable **solo por el
   rol de servicio**.
4. **Un plan es una decisión que el cliente no puede redactar.** A diferencia de la evidencia
   —que la persona sí genera legítimamente— una carga de plan falsificada no es detectable por
   una función que no la calculó. Por eso la escritura del Planner **no puede** ser invocable por
   el cliente, y la superficie de RPC invocable por cliente **permanece en dos**:
   `append_learning_event` y `create_study_session`.
5. **Lectura del cliente:** solo sus propias ejecuciones e ítems, con RLS forzado y columnas
   seguras para la persona. La instantánea de auditoría (§S) vive en una tabla aparte **sin
   concesión alguna** a `anon` ni a `authenticated`.
6. **Arranque de sesión planificada:** una frontera que recibe **solo** un identificador de
   ejecución, comprueba propiedad, frescura de entrada, disponibilidad del objetivo y ausencia de
   sesión abierta, copia los ítems como **instantánea** y fija `planner_run_id`. Es **idempotente
   por ejecución**.
7. **Generación y arranque no son atómicos, y no deben serlo:** una ejecución sin sesión es
   historia válida.
8. **Sin esquema privado nuevo.** Tablas en `public` con RLS forzado más una tabla de auditoría
   sin concesión a roles de cliente bastan, usando el mecanismo que el repositorio ya emplea
   desde la migración 14. El anexo v1.1 de ADR-011 autorizó `engine` para el Learning Engine y
   para nada más, y este contrato **no lo amplía**.
9. **INV-101 intacto:** la clave de respuesta correcta no entra en el alcance del Planner, y
   ningún código de razón puede codificar la corrección de una pregunta concreta.

## V · Relación con `study_sessions`

- `study_sessions.planner_run_id` deja de ser una columna sin semántica: pasa a referenciar una
  ejecución real, con integridad referencial y `ON DELETE RESTRICT`.
- Lo fija el **servidor** al crear una sesión planificada; el cliente no puede proponerlo — ya
  está en `rejects` del registro de autoridad.
- `planner_run_id IS NULL` sigue significando «esta sesión no la eligió un Planner», que es lo
  que significa hoy en el FPS.
- **`fps-fixed-v1` se conserva intacto**: durante toda Phase 4A sigue siendo el camino de
  selección visible para la persona. Nunca es un respaldo silencioso de un plan fallido.
- La unicidad de «una sesión abierta por persona» pasa a estar respaldada por la base de datos si
  el contrato la necesita; hoy vive solo en código de aplicación.

## W · Relación con el Learning Engine

1. El Planner lee **solo** `mastery_state`, `uncertainty` y patrones de error activos por
   (persona, concepto), más la tupla de frescura.
2. **La ausencia de fila significa `NEW`**: el motor solo crea filas cuando hay evidencia.
3. El Planner **no** vuelve a plegar la evidencia ni lee el vector (§D).
4. El Planner **no** emite ni infiere `LEARNING`, `CONSOLIDATING`, `MASTERED` ni `STRONG`, y no
   programa repasos.
5. `EVIDENCE_POSITIVE` significa «tiene evidencia positiva». No significa «terminado» ni
   «dominado» (DEF-30).
6. La **resolución de versión de pack es una sola regla**, compartida con el motor. Hoy
   `evidence_snapshot` resuelve por la publicada creada más recientemente; el Planner no puede
   resolver por otra vía.
7. La frontera de invocación es la aceptada en Phase 3.1: envoltorios `public.engine_*`, solo rol
   de servicio, sin exponer ningún esquema privado.

## X · Relación con Phase 1B

Todo lo que este contrato define es demostrable con contenido **`GENERATED`**. Phase 4A no
necesita el corpus oficial, no toca la custodia privada de contenido, y no altera D-20 ni H-1.
D-20 bloquea la primera fuente `OFFICIAL`, **no** un BUILD sintético del Planner.

Los fixtures serán visiblemente sintéticos, como en todas las fases anteriores.

## Y · Relación con Exam Readiness

El Planner **no** produce readiness ni ningún proxy suyo. Mecánicamente:

- ninguna agregación entre conceptos;
- ningún porcentaje, recuento ni ratio derivado en ejecuciones, ítems o códigos de razón;
- ningún vocabulario de «listo», «preparado», «débil», «riesgo» o «probabilidad» en el enum de
  razones;
- `target_date` no se usa;
- un concepto con evidencia positiva **no** es un concepto dominado;
- las únicas columnas numéricas admisibles son la **posición** en la secuencia y los **minutos
  planificados**.

La prioridad de selección es un **orden de acciones**, no una afirmación sobre la preparación de
la persona. ADR-003 v1.2 anexo §E sigue siendo el propietario de readiness, y es Phase 6.

## Z · Semántica diferida

Este contrato **no** define, y Phase 4A **no** implementa:

| Diferido | Motivo |
| --- | --- |
| Origen de la duración (P4-D2) | decisión de producto previa a 4B |
| Umbrales de Rescue y de ausencia | Master §8/§9 no los definen; H-P4-5 |
| Oferta a la persona de un ítem fuera de presupuesto | 4B/UX (§J) |
| Programación de repasos, retención, decaimiento, espaciado | sin autoridad aceptada; DEF-28 |
| Semántica de prerrequisitos | `strength` sin significado; ciclos posibles |
| Planificación de `PRACTICAL` y `CONCEPT_REVIEW` | no tienen camino de evidencia en runtime |
| Diagnóstico como entrada | `diagnostic_run_id` no se escribe nunca |
| Ritmo por `target_date` | sin regla aceptada |
| Readiness | Phase 6 |
| Consumo del plan por HOY y selección visible | Phase 4B |

---

## Nota de alcance

Este contrato es **autoridad de Phase 4A**. No autoriza el BUILD, no crea esquema, no crea
migraciones y no cambia ninguna ruta de la aplicación. La selección visible para la persona
sigue siendo `fps-fixed-v1` durante toda Phase 4A.
