# STUDY OS · Planner Contract · v1.2

**ESTADO:** `PROPOSED · BLOQUEADO POR DECISIÓN HUMANA` · **no aceptado**
**CERRADAS:** **P4-D3** · granularidad híbrida (§F.2) y **P4-D4** · `EXPOSED` primero (§F.6), las
dos `ACCEPTED` el 2026-09-18.
**BLOQUEANTE:** **P4-D5** · qué posición de evidencia ordena la reparación (§F.5). Es un hallazgo
**nuevo** de la prueba residual A: derrotar a cinco políticas rivales no demuestra unicidad, y
sobreviven **dos** no equivalentes.
**HISTORIA:** v1.0 aterrizó como `ACCEPTED`; la revisión independiente encontró **IR-P4A-01** (una
recomendación emitida contaba como respuesta a la reparación) e **IR-P4A-02** (la atomicidad
estaba sobreafirmada) y el contrato pasó a v1.1 `PROPOSED`. v1.2 cierra P4-D3 y P4-D4 y abre
P4-D5.
**BUILD:** no autorizado.
**FECHA:** 2026-09-18
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
| Tupla de frescura del motor | `engine_version`, `engine_config_version`, `attribution_pack_version_id`, `attribution_generation`, `consumed_position` | §M |
| Sesión abierta y su cursor | `study_sessions`, `session_items` | §N |
| Historial de sesiones e ítems completados | `session_items` | exclusión `COMPLETED_TODAY` |
| Ejecuciones anteriores del Planner | `planner_runs`, `planner_items` | **auditoría, no señal** · solo para reutilizar un plan de hash idéntico (§O); **nunca** entran en la selección (§F.4) |
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
- **`priority_score`, pesos, ponderaciones, ratios, cuotas** (§G.8);
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

### F.2 · Granularidad de la acción · **P4-D3 · `ACCEPTED` · híbrida**

**Decisión humana del 2026-09-18.** Planner v1 usa **granularidad híbrida**:

- **`NEW`** → `APRENDER` puede planificarse de forma independiente. Tras su ejecución veraz el
  concepto pasa a **`EXPOSED`**, que es la representación autoritativa ya existente de «material
  visto y todavía sin verificar». No se inventa ningún estado intermedio.
- **`EXPOSED`** → `COMPROBAR`.
- **Reparación** (`EVIDENCE_NEGATIVE`, `EVIDENCE_CONFLICTING`, patrón de error estructural activo)
  → **`REAPRENDER + COMPROBAR` sigue siendo una acción atómica**, porque `REAPRENDER` por sí solo
  no produce evidencia autoritativa y **no existe estado aceptado** que distinga «se reaprendió y
  falta verificar» de «no ha pasado nada». Ese estado **no se inventa en Phase 4A**.

La decisión **no** autoriza retención, programación de repasos, dominio, readiness ni semántica
nueva de estado de aprendizaje.

El análisis que la precedió se conserva porque explica por qué la pregunta era real:

---

#### F.2.1 · Por qué esto era una decisión y no una derivación

**La versión anterior de este contrato sobreafirmaba.** Sostenía que `APRENDER + COMPROBAR` es
indivisible porque el motor no tiene estado para «reaprendido pero sin comprobar». La revisión
independiente rechazó la derivación, y tenía razón: la ausencia de ese estado prueba que
**aprender no crea evidencia de acierto**, no que aprender y comprobar deban ser un mismo ítem de
presupuesto.

El análisis formal corrige la afirmación en los dos sentidos:

- para `NEW`, **el motor sí sabe representar el bucle abierto**: ejecutar `APRENDER` mueve el
  concepto a `EXPOSED`, que significa exactamente «visto y sin comprobar». Ahí no hace falta
  atomicidad ninguna;
- para la reparación **no existe representación**: `REAPRENDER` no produce evidencia y el
  concepto sigue en `EVIDENCE_NEGATIVE`, indistinguible de no haberlo reaprendido.

De ahí sale un resultado mecánico, no una opinión: la cadena pura (`MODEL B`) **está falsada** —
en reparación produce un bucle estructural del que la persona no puede salir, porque la acción
que se le ofrece no puede cambiar el estado que la motiva. El contraejemplo mínimo y su prueba
están en `tests/governance/modelCheck.spec.ts`.

Quedan **dos modelos que satisfacen todas las invariantes aceptadas y que no son equivalentes**:

| Modelo | Comportamiento |
| --- | --- |
| **A · atómico** | `APRENDER + COMPROBAR` y `REAPRENDER + COMPROBAR` son un ítem indivisible |
| **D · híbrido** | encadenado donde el motor representa el bucle (`NEW` → `EXPOSED`); atómico donde no lo representa (reparación) |

Difieren de forma observable: con un presupuesto que solo admite el paso de aprender, **A**
devuelve `NOTHING_FITS` y **D** planifica `APRENDER`. Ninguna autoridad aceptada elegía entre
ellos, y por eso volvió como decisión humana. **Ana eligió D el 2026-09-18.**

### F.3 · Los conjuntos

- **R** · necesidades de reparación **sin responder** (§F.4).
- **V** · necesidades de verificación (`EXPOSED`).
- **N** · necesidades de cobertura (`NEW`).
- **C = V ∪ N** · el conjunto de continuidad, el que P4-D1.2 protege.

### F.4 · Qué satisface «responder a la reparación» · corregido · IR-P4A-01

**La versión anterior de este contrato estaba mal.** Definía una necesidad como «respondida»
cuando una ejecución anterior del Planner había **emitido** la acción correspondiente. La
revisión independiente lo rechazó con un contraejemplo que no admite defensa:

> la persona falla el concepto A · el Planner emite `REAPRENDER + COMPROBAR` para A · la persona
> cierra la aplicación sin ejecutar nada · vuelve más tarde · no existe ninguna evidencia nueva.

Bajo aquella redacción, A quedaba «respondida» y **salía de la presión del Planner sin que la
persona hubiera hecho absolutamente nada**. Eso convierte una recomendación en prueba de
ejecución, que es justo lo que no es.

**Principio corregido, y es normativo:**

> **Un plan es un registro de decisión, no evidencia de ejecución.**

Por tanto: **`RECOMENDADO` no equivale a `PRESENTADO`, `INICIADO`, `COMPLETADO`, `COMPROBADO`,
`EVIDENCIA REGISTRADA` ni `REPARACIÓN LOGRADA`.**

Lo único que puede satisfacer P4-D1.1 es **evidencia nueva registrada** para ese concepto: es el
único hecho duradero que el motor sabe representar, que la persona produce de verdad y que
cambia el estado categórico. En consecuencia, **este contrato elimina por completo el concepto
de «necesidad respondida»**: una necesidad de reparación existe exactamente mientras el estado
categórico del motor diga que existe, y desaparece solo cuando la evidencia la disuelve.

Ninguna ejecución anterior del Planner entra en la selección. El historial de ejecuciones es
**auditoría** (§S), no señal (§R).

### F.5 · Orden dentro de la reparación · `PROPOSED · BLOQUEADO POR DECISIÓN HUMANA P4-D5`

Si varias necesidades de reparación compiten, hace falta una clave de orden. La ronda anterior
propuso «la posición de la última evidencia negativa, de más antigua a más reciente» y la llamó
**derivada**. La prueba residual A demuestra que **no lo está**.

Siete políticas formulables sin inventar ciencia del aprendizaje y sin usar el historial del
Planner como señal, evaluadas mecánicamente en `tests/governance/residualProofs.spec.ts`:

| Política | Señal autorizada | Determinista | Sin historial del Planner | Sin cantidad oculta | Vivacidad | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| clave de sílabo | sí | sí | sí | sí | **no** | falsada |
| sílabo inverso | sí | sí | sí | sí | **no** | falsada |
| identidad estable del concepto | sí | sí | sí | sí | **no** | falsada |
| evidencia más reciente primero | sí | sí | sí | sí | **no** | falsada |
| **primera negativa sin resolver** | sí | sí | sí | sí | **no** | **falsada** · un fallo nuevo no mueve su clave, así que el mismo concepto se queda la ranura |
| **última negativa · más antigua primero** | sí | sí | sí | sí | **sí** | **sobrevive** |
| **último contacto real · más antiguo primero** | sí | sí | sí | sí | **sí** | **sobrevive** |
| menos recientemente servido · turno rotatorio | **no** · usaría el historial del Planner | — | — | — | — | excluida por autoridad |
| por número de intentos · por número de errores | **no** · recuento derivado del vector | — | — | — | — | excluida por el contrato del motor §10 |
| aleatoria sembrada | **no** · P4-D1.7 | — | — | — | — | excluida por autoridad |

**Sobreviven dos, y no son equivalentes.** Se separan exactamente cuando hay **contacto sin
verificación**: la persona abre la reparación, la lee y se marcha sin comprobar.

- Con **última negativa**, la evidencia no se ha movido: el concepto sigue el primero y se le
  vuelve a ofrecer. El sistema **insiste** en la reparación empezada.
- Con **último contacto**, el contacto es reciente: el concepto cede el turno al siguiente. El
  sistema **no repite** lo que acaba de mostrar.

Las dos son defendibles y las dos cumplen todos los criterios mecánicos. La diferencia es
alcanzable de verdad, no artificial: abandonar tras leer la produce. **Este contrato no elige.**

### F.6 · Orden dentro de la continuidad · **P4-D4 · `ACCEPTED` · `EXPOSED` primero**

**Decisión humana del 2026-09-18.** Dentro del conjunto de continuidad, **`EXPOSED` precede a
`NEW`**. Es una **precedencia categórica**, no una puntuación ni un peso.

Razón de producto registrada: STUDY OS debe cerrar un bucle de verificación que **ya abrió** antes
de abrir otro innecesariamente. Preserva `APRENDER → COMPROBAR → EVIDENCIA` sin afirmar dominio ni
preparación.

Agotados los candidatos `EXPOSED` —o cuando no quepan legítimamente— se seleccionan candidatos
`NEW` según las reglas de orden y presupuesto ya aceptadas. **No se introducen** pesos de
`EXPOSED`, ratios, cuotas, porcentajes ni máximos.

Consecuencia medida, no supuesta: el atraso de verificación queda acotado por lo que cabe en **un**
presupuesto y **no crece con el temario ni con el número de sesiones** — comprobado con 100
conceptos y 300 sesiones.

El análisis previo se conserva porque explica por qué la pregunta era real:

---

#### F.6.1 · Por qué esto era una decisión y no una derivación

Ninguna autoridad aceptada las ordenaba entre sí. P4-D1.3 declara `EXPOSED` accionable, pero no le
daba precedencia. Tres órdenes eran deterministas y admisibles:

| Opción | Consecuencia |
| --- | --- |
| **`EXPOSED` primero** | no se acumula material visto sin comprobar; el sílabo avanza más despacio |
| **`NEW` primero** | el sílabo avanza; con un sílabo grande, lo visto puede quedar sin verificar mucho tiempo |
| **orden de sílabo** | no distingue categoría; coincide con «`EXPOSED` primero» siempre que lo visto sea anterior en el sílabo |

Las dos últimas **no son equivalentes**, pero solo difieren en estados que el propio Planner no
puede crear: haría falta que algo externo expusiera un concepto posterior del sílabo, y hoy el
vertical congelado del FPS puede hacerlo. Está verificado mecánicamente.

Ordenar la continuidad por sílabo *habría parecido* resolverlo sin decidir, y por eso se dijo en
voz alta: habría sido colar la decisión por la puerta de atrás. **Ana eligió `EXPOSED` primero el
2026-09-18.**

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

1. Si **R ≠ ∅** y la acción de su primer elemento —**evidencia más antigua primero**, §F.5— cabe
   en el presupuesto: colocarla. **G-R**.
2. Recorrer **C** en su orden (§F.6) y colocar cada acción que quepa, **saltando** las que no
   quepan.
3. Cuando no quede ninguna acción de **C** por colocar, seguir con el resto de **R** en el orden
   de §F.5.
4. Parar en el presupuesto. Nunca rellenar (§K.1, P4-D1.6).

**Se salta, no se detiene.** Detenerse en el primer candidato que no cabe dejaría que la duración
de un candidato decidiera sobre la planificación de otro, que es un acoplamiento sin ninguna
autoridad detrás. Y **no se reordena para llenar minutos**: eso introduciría un objetivo de
optimización que nadie ha autorizado (§I.5).

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

### G.7 · Lo que las siete invariantes **no** determinan

Honestidad sobre el alcance de la derivación, porque la versión anterior de este contrato la
exageró:

**Las siete cláusulas de P4-D1 no determinan un algoritmo único.** Determinan una *familia* de
algoritmos deterministas. Lo que sí queda derivado dentro de esa familia:

| Pregunta | Estado |
| --- | --- |
| ¿La reparación va en la cabeza? | **derivado** (§G.3) |
| ¿Cuántas reparaciones garantizadas? | **derivado**: una, aridad de un existencial (§G.4) |
| ¿Tope simétrico para la cobertura? | **derivado**: no (§G.5) |
| ¿Orden dentro de la reparación? | **parcialmente derivado**: la vivacidad falsa cinco políticas y deja **dos** (§F.5) |
| ¿Se salta o se detiene ante lo que no cabe? | **derivado** (§G.2) |
| ¿Se optimizan minutos? | **derivado**: no (§I.5) |
| ¿Cadena pura como granularidad? | **falsada** (§F.2) |
| ¿Tamaño de la acción: atómica o híbrida? | **decidido por P4-D3 · híbrida** |
| ¿Orden entre `EXPOSED` y `NEW`? | **decidido por P4-D4 · `EXPOSED` primero** |
| **¿Qué posición de evidencia ordena la reparación?** | **NO DERIVADO · P4-D5** (§F.5) |

Corregido el 2026-09-18: donde §F.5 decía «derivado por vivacidad», la prueba residual A demuestra
que la vivacidad **elimina cinco** políticas y deja **dos**. El algoritmo queda determinado salvo
esa clave.

### G.8 · Lo que esta composición no introduce

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

### I.5 · Empaquetado · lo que «cabe» autoriza y lo que no

El presupuesto se llena recorriendo el orden de prioridad y **saltando** lo que no cabe. Nada más.
Seis comportamientos distintos se confunden con facilidad, y solo dos están autorizados:

| Comportamiento | Estado |
| --- | --- |
| Preservar el orden de prioridad | **autorizado** · es el resultado de §G |
| Saltar lo que no cabe | **autorizado** · detenerse acoplaría candidatos sin autoridad (§G.2) |
| Detenerse en el primero que no cabe | rechazado |
| Maximizar minutos usados | **rechazado** · objetivo de optimización no autorizado |
| Maximizar número de ítems | **rechazado** · ídem |
| Optimización de mochila | **rechazado** · descartaría la acción de mayor prioridad para llenar minutos |

Ejemplo, y es el que decide: presupuesto 12, acciones de 10, 6 y 6 minutos en ese orden de
prioridad. El Planner planifica **la de 10 y deja 2 minutos sin usar**. Un optimizador habría
elegido 6 + 6 para llenar los 12, descartando la acción más prioritaria: eso sería sustituir la
prioridad por un objetivo numérico que nadie ha aceptado. Master §8 dice «la acción de mayor
valor **que quepa**», no «la combinación que más minutos consuma».

Dejar minutos sin usar no es un fallo. Es la consecuencia de que la prioridad manda.

**Unicidad · prueba residual B, cerrada.** Cuatro criterios, todos con autoridad: preservar la
prioridad semántica; no exceder nunca el presupuesto; no inventar un objetivo de optimización; y
no dejar que un candidato sobredimensionado suprima a otros posteriores que sí caben. El cuarto
es el que descarta `prefix-stop`, y su autoridad es la misma que prohíbe que el orden de filas
decida: la duración de un candidato no es una propiedad del siguiente y no puede gobernar su
selección.

Cualquier política que recorra la prioridad tomando lo que cabe **es** saltar-lo-que-no-cabe.
Saltarse algo que cabe exigiría una razón, y toda razón disponible es un objetivo de optimización,
que el tercer criterio prohíbe. Detenerse antes viola el cuarto. Por tanto la política es
**única**, y se comprueba mecánicamente contra una definición independiente en todo el rango de
presupuestos 0–60 (`tests/governance/residualProofs.spec.ts`).

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

### K.1 · Sin actividad sintética

El Planner **nunca** genera actividad con el único fin de no devolver un plan vacío (P4-D1.6).

Un plan no vacío **no es un invariante de producto**. La ausencia veraz de recomendación
autorizada es preferible a trabajo fabricado. En particular, no se recurre a
`EVIDENCE_POSITIVE`, ni a ninguna otra señal no autorizada, para rellenar.

Gate P4-G19.

## L · `ZERO_TIME`

Presupuesto cero: una ejecución con **cero ítems** y razón `ZERO_TIME`. Sin backlog, sin
contador, sin marca de deuda y sin lenguaje de fallo (REQ-E08, EC-014).

El cero puede venir de un override del día o de una entrada explícita `0` en la disponibilidad
semanal (§I.2): en los dos casos es una declaración de la persona, y el Planner la respeta sin
convertirla en deuda.

## M · Frescura del motor y puesta al día bloqueante

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
| La proyección estaba atrasada | §M |
| Contenido recomendado retirado | el ítem no iniciado se excluye al arrancar con `TARGET_UNAVAILABLE` y se replanifica |

**Phase 4A no define umbrales de Rescue ni de ausencia.** «Materialmente por debajo» (Master §8)
y «ausencia significativa» (Master §9) no están definidas en ninguna autoridad aceptada, y este
contrato **no las inventa** (H-P4-5). 4A conserva los hechos mecánicos —si el presupuesto de hoy
difiere del derivado del valor por defecto, y cuántos días de calendario han pasado desde la
última evidencia— y nada más. Las experiencias nombradas **Rescue** y **Recovery** pertenecen a
4B/UX.

## Q · Ejecución inmutable y su historia

Una ejecución del Planner es un **registro histórico de decisión**, no un estado editable:

- `planner_runs` es **append-only**;
- `planner_items` es **inmutable** y no lleva estado de ejecución mutable: el progreso vive en
  `session_items`;
- una replanificación **añade** una ejecución nueva con `supersedes_run_id`; no edita la anterior
  (REQ-E13);
- «el plan actual» es la última ejecución no superseded del objetivo, no una fila mutable;
- la historia no se poda: una ejecución antigua sigue siendo la respuesta a «por qué entonces».

### Q.1 · Ciclo de vida de una recomendación

El ciclo completo, y dónde vive de verdad cada etapa:

| Etapa | ¿La representa la autoridad aceptada? | Evidencia duradera | ¿La ve el Planner? | ¿Afecta a la selección? |
| --- | --- | --- | --- | --- |
| `RECOMENDADA` | sí · `planner_items` | la propia ejecución | sí | **no** · solo auditoría |
| `PRESENTADA` | parcialmente · evento de presentación de ítem | `learning_events` | indirectamente | **no** |
| `INICIADA` | sí · `session_items` | estado del ítem de sesión | sí | solo como sesión abierta (§N) |
| `COMPLETADA` | sí · `session_items` | estado del ítem de sesión | sí | sí, como exclusión `COMPLETED_TODAY` |
| `COMPROBADA` | sí · intento inmutable | `question_attempts` | a través del motor | **sí** |
| `EVIDENCIA REGISTRADA` | sí · flujo de eventos y proyección | `learning_events` + motor | sí | **sí** |

**Ninguna etapa nueva se crea.** Las seis ya tienen representación autoritativa; lo que faltaba
era decir cuál de ellas satisface P4-D1.1, y la respuesta es la última: **evidencia registrada**.

### Q.2 · Qué hace, y qué no hace, una ejecución no arrancada

| ¿Una ejecución emitida y nunca arrancada…? | |
| --- | --- |
| ¿reserva contenido? | **no** |
| ¿suprime necesidades futuras? | **no** |
| ¿marca reparación como respondida? | **no** · IR-P4A-01 |
| ¿afecta a la elegibilidad? | **no** |
| ¿es reutilizable? | sí, solo si el hash de entrada canónica es idéntico (§O) |
| ¿caduca por tiempo? | **no** · un umbral temporal sería un parámetro inventado |
| ¿puede quedar superseded? | sí, por una ejecución posterior con `supersedes_run_id` |

Queda como principio normativo: **un plan es un registro de decisión, no evidencia de ejecución.**

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

### U.1 · Frontera de consistencia · cálculo y persistencia

Entre calcular y persistir puede cambiar todo: llega una respuesta, el motor avanza, se retira
contenido, cambia la generación de atribución, cambia el objetivo, cambia el override del día, o
la persona abre otra pestaña. La regla es una sola:

> La tupla autoritativa que la ejecución dice haber consumido se **revalida dentro de la misma
> transacción que la escribe**. Si ha cambiado, no se escribe: se recalcula.

Qué entra en esa revalidación: tupla de frescura del motor (versión, configuración, generación,
posición consumida), versión de pack resuelta, objetivo activo, valor y procedencia del
presupuesto, ausencia de sesión abierta, y disponibilidad de cada objetivo seleccionado.

Se resuelve con primitivas que el repositorio **ya usa**, sin arquitectura nueva:

- validación optimista de versión dentro de la función de persistencia, como ya hace la frontera
  de eventos al bloquear el contador del usuario antes de comprobar nada;
- **unicidad** de `(persona, hash de entrada, día de plan)` para la idempotencia de §O;
- **índice único parcial** de una sola sesión abierta por persona;
- arranque **idempotente por ejecución**.

Dos peticiones simultáneas no pueden producir dos ejecuciones autoritativas distintas ni dos
sesiones abiertas. Y si una sesión se abre mientras se calcula, gana la sesión (§N): la ejecución
no llega a escribirse.

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
| **Clave de orden de la reparación (P4-D5)** | **bloquea la aceptación del contrato** · §F.5 |
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
