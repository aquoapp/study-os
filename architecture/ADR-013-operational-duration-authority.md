# ADR-013 · Autoridad de duración operativa

**Estado:** `ACCEPTED` · 2026-09-20 · decisión humana **P4-D2**, resuelta tras la reconciliación de
pre-autorización de Phase 4B y su revisión independiente.
**Decisora:** Ana Victoria.
**Estado de implementación:** **`NOT IMPLEMENTED`**. Ninguna migración, columna, función, concesión
ni constante de runtime queda autorizada por esta aceptación.
**Contexto normativo:** Master §1.1 y §8 · CDEM §6 · Planner Contract §C, §I.3, §I.4, §T ·
ADR-012 · Design System §6 · Onboarding & Edge States ED-03 y OB-08 · DEF-11 · EC-001, EC-003,
EC-008, EC-019.
**Documento de aterrizaje:** `docs/PHASE_4B_PREAUTHORIZATION.md` §2.

---

## Contexto

El Planner recibe la duración de cada candidato **como entrada del contrato** (§I.3). Phase 4A
congeló deliberadamente esa entrada sin origen: `DURATION_PROVENANCES` admite solo `FIXTURE`, el
CHECK de `planner_runs.duration_provenance` lo impone, y sin fuente inyectada el módulo real
responde `DURATION_SOURCE_UNDECIDED` y no escribe nada. Esa negativa veraz era el enforcement del
diferimiento, no una propiedad deseada del producto.

La reconciliación previa a Phase 4B estableció tres hechos que obligan a resolverlo:

1. **Sin duración no hay producto.** Con P4-D2 abierta el Planner no escribe ninguna ejecución, de
   modo que no existe ninguna superficie de aprendiz posible.
2. **Dos artefactos congelados de nivel 3 exigen una estimación.** Design System §6 obliga a la
   tarjeta de continuación a mostrar «remaining estimate», y Edge States ED-03 lo repite; OB-08
   exige «today's useful study time».
3. **No existe ningún dato de duración en el modelo.** Ni `learning_units`, ni
   `learning_unit_versions`, ni `canonical_questions`, ni `question_representations` llevan minuto
   alguno. Los únicos minutos del esquema son de disponibilidad, de sesión y del propio Planner.

## Decisión

**La duración es una estimación operativa de planificación, y su origen es híbrido por tipo de
paso.**

### 1 · Qué es y qué no es

Una **estimación operativa de planificación**: cuánto tiempo ocupa presentar y realizar un paso.

**No es** un hecho de ciencia del aprendizaje · una estimación de dominio · una predicción de lo
que tardará esta persona · un valor aprendido del historial · una puntuación de rendimiento · una
estimación de retención.

De ahí se sigue lo que el Planner no puede hacer con ella: no la deriva, no la ajusta, no la
compara entre personas y no la usa para afirmar nada sobre nadie. Solo comprueba si una acción
**cabe**.

### 2 · Unidad de aprendizaje · metadato de autoría versionado

La duración de un paso `LEARN` o `RELEARN` vive como columna de
**`public.learning_unit_versions`**, anulable, con rango acotado.

Por qué ahí y no en otro sitio: es la única entidad del modelo que es simultáneamente **versionada**,
**inmutable al publicarse** y **ya fijada** por el Planner
(`planner_items.learning_unit_version_id`) y por la sesión
(`session_items.presented_learning_unit_version_id`). Fijar la duración a cualquier cosa menos
específica rompería el requisito de la decisión —«fijada a la versión exacta de contenido»— y
chocaría con INV-117.

Tres consecuencias derivadas:

- **anulable, no `NOT NULL`**: obligar a la columna forzaría a rellenar las versiones publicadas
  existentes, y todo valor rellenado sería un minuto inventado;
- **entra en la enumeración de columnas inmutables** del trigger que protege una versión publicada;
  omitirla dejaría mutable en silencio la duración de contenido publicado, que es la clase de
  debilitamiento que EC-019 existe para impedir;
- la ausencia se previene **hacia delante** en la frontera de ingestión, que es donde el contenido
  nace.

### 3 · Pregunta · estimación gobernada

La duración de un paso `CHECK` es una **estimación gobernada determinista**, idéntica para toda
pregunta en v1 e **independiente de la persona**, que vive como una clave de
**`public.planner_config`**.

La colocación se deriva de la propia taxonomía de tres clases del contrato del Planner §T: no es
versión de algoritmo —no cambia lo que el algoritmo hace—, y no es parámetro de ciencia del
aprendizaje —no afirma nada sobre aprender—. Es **política de producto** que un humano promueve,
que es la tercera fila de esa tabla. `planner_config` ya aporta versionado, unicidad de la versión
activa, evidencia de promoción e inmutabilidad, de modo que **no hace falta ninguna entidad ni
maquinaria nueva**.

**La prohibición de §T se estrecha, no se abre.** §T prohibía «duraciones por defecto» remitiendo a
§I.3, que era la cláusula de diferimiento; resolver P4-D2 es la autoridad que la levanta, y la
levanta para **exactamente una clave**, entera y acotada. Todas las demás prohibiciones siguen
literalmente en pie.

### 4 · Acción atómica

`REAPRENDER + COMPROBAR` = estimación fijada de la unidad + estimación gobernada de la pregunta. La
acción completa cabe o no cabe. **Sin empaquetado parcial.**

### 5 · Procedencia y reproducibilidad

El vocabulario de procedencia de la ejecución se amplía con `HYBRID_V1`, y `FIXTURE` se conserva
para que las ejecuciones de prueba sigan siendo distinguibles.

**La reproducibilidad no necesita mecanismo nuevo, y esto se verificó en vez de diseñarse.** Los
minutos de cada candidato son campos de `PlannerInput`; `canonicalInput()` los serializa;
`planner_run_audit.input_canonical` los congela con su hash recalculado por la base; `explainRun`
reproduce ese texto. **Ninguna reproducción consulta jamás una fuente de duración**, de modo que
cualquier mecanismo futuro es aditivo por construcción y toda ejecución pasada sigue siendo byte a
byte reproducible (P4-G4).

Consecuencia derivada: **cambiar una duración cambia el hash de entrada** y por tanto la identidad
de la ejecución, de modo que una corrección de duración replanifica hacia delante y no reescribe
nada, igual que un cambio de disponibilidad (§P).

### 6 · Metadato ausente

Condición estructural veraz, **sin respaldo silencioso**: el candidato se excluye con la razón
propia **`NO_DURATION_METADATA`** del enum cerrado, registrada en la instantánea de candidatos, y
la ejecución continúa con el resto. §E excluye candidatos, no aborta planes. La razón **nunca es
superficie de aprendiz**.

Reutilizar `NO_PUBLISHED_UNIT` se rechaza: confundiría «no existe unidad» con «existe pero no es
utilizable», y §R exige que las exclusiones sean explicables por causa.

## Alternativas consideradas y por qué se rechazan

| Alternativa | Motivo |
| --- | --- |
| **Constante de código** | §T reserva las constantes de código a la versión de algoritmo; cambiar una estimación operativa exigiría una release |
| **Tabla gobernada aparte para duración** | entidad canónica nueva que duplica versionado, promoción e inmutabilidad que `planner_config` ya tiene |
| **Autoría por pregunta** | la decisión pide estimación gobernada; además trasladaría al corpus oficial de Phase 1B la obligación de autorizar un minuto por ítem, sin fuente de la que derivarlo |
| **Regla determinista sobre la forma del contenido** (longitud a una cadencia) | sigue siendo una constante elegida, sin hogar legítimo bajo §T, y erraría en unidades atípicas sin que nadie pudiera corregirlas |
| **Duración declarada por la persona** | ninguna autoridad la propone y contradice Master §1.3: la persona no debe orquestar |
| **Duración aprendida del comportamiento** | prohibida por §D y diferida por DEF-11 |

## Consecuencias

**Positivas.** Desbloquea toda la superficie de aprendiz de Phase 4B. Hace satisfacible la
estimación restante que Design System §6 y ED-03 exigen. Deja el camino abierto a una fuente
aprendida futura como simple valor de procedencia añadido. Mantiene la duración fuera de la ciencia
del aprendizaje por definición explícita.

**Coste aceptado · OBS-4B-02.** Como una versión publicada es inmutable, corregir una duración
equivocada acuña una versión nueva de unidad: rotación de contenido por un número operativo. Es el
precio directo de «fijada a la versión exacta de contenido», y está acotado, porque las ejecuciones
pasadas conservan sus minutos congelados en su entrada canónica.

**Lo que no cambia.** P4-D1, P4-D3, P4-D4, P4-D5 y P4-D6 quedan intactas. La composición sigue sin
puntuación, sin pesos y sin parámetro de equilibrio. `planner_config` sigue sin poder contener
pesos, ratios, porcentajes, cuotas, longitudes de ciclo, umbrales de evidencia, intervalos de
repaso, semividas ni factores de decaimiento. El esquema `engine` no se amplía y ADR-011 no se
toca. La superficie de RPC invocable por cliente permanece en dos. **FPS-OBS-04 no se declara
cerrada** hasta que una implementación demuestre que la estimación restante se produce de verdad
(R-6).

## Gate

**P4-G26** · todo minuto planificado procede de un valor autorizado fijado a versión o de la
configuración activa; ninguna constante de runtime; una versión sin duración se excluye con su
propia razón y nunca se rellena.
