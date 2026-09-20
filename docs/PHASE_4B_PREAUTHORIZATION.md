# STUDY OS · Phase 4B · Product Integration · Pre-Authorization Decisions

**ESTADO:** decisiones humanas **`ACCEPTED`** · 2026-09-20 · **el BUILD de Phase 4B NO está
autorizado.**
**DECISORA:** Ana Victoria, tras la reconciliación de pre-autorización de Phase 4B y su revisión
independiente.
**NATURALEZA:** aterrizaje **documental** de las decisiones que la reconciliación devolvió. No crea
esquema, no crea migraciones, no cambia ninguna ruta, no toca runtime y no autoriza la fase
siguiente.
**PROPIETARIOS NORMATIVOS:** ADR-012 (anexo v1.5) para la autoridad de decisión del Planner;
**ADR-013** para la autoridad de duración; `docs/PRODUCT_UX_CONTRACT.md` para la experiencia.

Este documento es **anexo del contrato del Planner**. `docs/PLANNER_CONTRACT.md` conserva su
cuerpo v1.4 como artefacto de Phase 4A; las secciones que aquí se modifican quedan marcadas allí
con su supersesión, siguiendo el patrón con el que ADR-003, ADR-007, ADR-008 y ADR-011 recibieron
sus anexos.

---

## 1 · Las cinco decisiones humanas

| Id | Decisión | Estado |
| --- | --- | --- |
| **P4-D2** | Origen de la duración: **HÍBRIDO** | `ACCEPTED` |
| **P4B-D1** | `NOTHING_FITS`: **no se ofrece** la acción fuera de presupuesto como ejecutable | `ACCEPTED` |
| **P4B-D2** | Salida anticipada y **consumo de ejecución** · opción B2-a | `ACCEPTED` |
| **P4B-D3** | Override del mismo día: **TABLA + EVENTO** | `ACCEPTED` |
| **SD-019** | Accesibilidad de la paleta: **opción C** | `ACCEPTED` |

## 2 · P4-D2 · autoridad de duración · híbrida

**Decisión.** La duración entra en el Planner como **entrada del contrato**, pero su origen queda
autorizado y partido por tipo de paso.

### 2.1 · Duración de la unidad de aprendizaje

Metadato de autoría **versionado**, asociado a la versión exacta de unidad que el Planner
selecciona. Es una **estimación operativa de planificación**.

**No es** un hecho de ciencia del aprendizaje, ni una estimación de dominio, ni una predicción de
lo que tardará esta persona, ni un valor aprendido del historial, ni una puntuación de rendimiento,
ni una estimación de retención.

Debe ser explícita, versionada, auditable, determinista como entrada del Planner y **fijada a la
versión exacta de contenido**. **No se rellena en silencio si falta.**

**Colocación canónica:** columna sobre `public.learning_unit_versions` (CDEM §6, adenda H-FPS-1),
que es la única entidad del modelo que es a la vez versionada, inmutable al publicarse y **ya
fijada** por `planner_items.learning_unit_version_id` y `session_items.presented_learning_unit_version_id`.

Consecuencias derivadas, no elegidas:

- la columna es **anulable**. `NOT NULL` exigiría rellenar las filas publicadas existentes, y todo
  valor rellenado sería un minuto inventado, que §2.5 prohíbe;
- la columna entra en la enumeración de columnas inmutables de
  `reject_published_unit_version_mutation()`. Omitirla dejaría mutable en silencio la duración de
  una versión publicada, que es exactamente la clase de debilitamiento que EC-019 existe para
  impedir;
- la ausencia se **previene hacia delante** en la frontera de ingestión:
  `ingest.validate_staged_item` exige la clave para el tipo `learning_unit_version` y
  `ingest.publish_staged_item` la traslada al insert;
- **consecuencia aceptada (OBS-4B-02):** como una versión publicada es inmutable, corregir una
  duración equivocada acuña una versión nueva. Es el coste directo de «fijada a la versión exacta
  de contenido», y queda acotado: las ejecuciones pasadas no se ven afectadas porque sus minutos
  están congelados en su entrada canónica (§2.4).

### 2.2 · Duración de la pregunta

**Estimación gobernada determinista**, independiente de la persona, idéntica para toda pregunta en
v1. **No** usa historial, `response_ms`, confianza, inferencia de dificultad, estimación por IA ni
rendimiento de la pregunta.

**Colocación canónica:** una clave en `public.planner_config`, derivada de la propia taxonomía de
tres clases del contrato del Planner §T —no es versión de algoritmo, no es parámetro de ciencia del
aprendizaje, es **política de producto** que un humano promueve—. `planner_config` ya aporta el
versionado, la unicidad de la versión `ACTIVE`, la evidencia de promoción y la inmutabilidad.

**No es una constante mágica:** vive en una fila versionada con autor, motivo, promotor, fecha y
evidencia de promoción, y la ejecución registra qué versión de configuración la produjo.

**La prohibición de §T se estrecha, no se abre.** §T prohibía «duraciones por defecto» por
referencia a §I.3, que era la cláusula de diferimiento de P4-D2; resolver P4-D2 es la autoridad que
la levanta. La lista blanca del documento admite **exactamente una clave** más, de valor entero y
acotado, y **todas las demás prohibiciones siguen en pie**: pesos, ratios, porcentajes, cuotas,
longitudes de ciclo, constantes de alternancia, umbrales sobre recuentos de evidencia, intervalos
de repaso, semividas y factores de decaimiento.

Colocaciones rechazadas, con motivo: constante de código (§T reserva las constantes de código a la
versión de algoritmo, y cambiar una estimación operativa exigiría una release); tabla gobernada
aparte (entidad canónica nueva que duplica maquinaria que `planner_config` ya tiene); metadato de
autoría sobre `question_representations` (la decisión pide estimación gobernada, y autorizar un
minuto por pregunta es justo la carga que el híbrido evita).

### 2.3 · Acción atómica

Duración de `REAPRENDER + COMPROBAR` = **estimación fijada de la unidad + estimación gobernada de
la pregunta**. La acción completa debe caber en el presupuesto disponible. **Sin empaquetado
parcial.**

### 2.4 · Procedencia y reproducibilidad

**La reproducibilidad ya está garantizada por la arquitectura existente, y esto se verificó en vez
de diseñarse.** `UnitCandidate.minutes` y `QuestionCandidate.minutes` son campos de `PlannerInput`;
`canonicalInput()` serializa la entrada completa; `planner_run_audit.input_canonical` la guarda con
su SHA-256 recalculado por la base; `explainRun` reproduce **ese texto**. **Ninguna reproducción
consulta jamás una fuente de duración.** Por tanto todo mecanismo futuro es aditivo por
construcción y toda ejecución pasada sigue siendo byte a byte reproducible (P4-G4). No hace falta
nada nuevo para cumplir este requisito.

Vocabulario de procedencia:

| Capa | Ahora | Después |
| --- | --- | --- |
| `DURATION_PROVENANCES` | `['FIXTURE']` | `['FIXTURE', 'HYBRID_V1']` |
| CHECK de `planner_runs.duration_provenance` | `= 'FIXTURE'` | `in ('FIXTURE','HYBRID_V1')` |
| Significado de `HYBRID_V1` | — | minutos de unidad autorizados sobre la versión fijada; minutos de pregunta desde `planner_config` de la versión registrada |
| Mecanismo por candidato | — | reconstruible sin columna nueva: la entrada canónica lleva los minutos de cada candidato y `planner_items` lleva las identidades fijadas |

`FIXTURE` se conserva para que las ejecuciones de prueba sigan siendo expresables y distinguibles
de las de producción.

**`DurationSource` se reclava por versión:** hoy `DurationTargets` se indexa por identidad de
unidad, no por versión; la decisión exige fijación a la versión exacta, de modo que la interfaz
pasa a tomar `learningUnitVersionId`. `planner_context` ya devuelve esa identidad.

**Una fuente aprendida o adaptativa en el futuro es aditiva y NO está autorizada ahora.** DEF-11 y
el §D del contrato del Planner siguen vigentes.

### 2.5 · Metadato de duración ausente

Condición estructural veraz, **sin respaldo silencioso**. La autoridad vigente ya determina la
forma de la respuesta: §E del contrato del Planner es un filtro duro con razón registrada, y §R
exige que las exclusiones sean explicables **por causa**. Reutilizar `NO_PUBLISHED_UNIT`
confundiría dos causas distintas y degradaría la explicabilidad.

**Resultado de producción requerido:** el candidato queda **excluido** con una razón propia del
enum cerrado, **`NO_DURATION_METADATA`**, registrada en la instantánea de candidatos. La ejecución
continúa con el resto: §E excluye candidatos, no aborta planes, y una sola unidad sin duración no
puede bloquear el producto. La razón **nunca es superficie de aprendiz**.

## 3 · P4B-D1 · `NOTHING_FITS`

**El tiempo declarado por la persona es autoritativo.** Con 5 minutos disponibles y una acción
elegible más corta de 10 minutos, STUDY OS **no crea ni presenta** una acción de 10 minutos bajo un
presupuesto de 5.

La ejecución no cambia de forma: `outcome = 'NOTHING_FITS'`, cero ítems, y la acción elegible más
corta registrada como `OVER_BUDGET` (§J, más BF-2, que ya garantiza que todo elegible no colocado
lleva razón).

La interfaz **puede** comunicar con verdad la estimación de la acción elegible más corta y permitir
que la persona aumente el tiempo de hoy. Si lo aumenta: la entrada cambia, la ejecución vigente
queda superseded según la semántica de frescura aceptada, y se calcula un plan nuevo.

**Sin microacción sintética. Sin acción truncada. Sin violación oculta de presupuesto. Sin
encuadre de culpa ni de deuda.** La redacción exacta pertenece al milestone de UX.

## 4 · P4B-D2 · salida anticipada y consumo de ejecución · B2-a

**Una persona puede terminar una sesión del Planner antes de agotar el plan.** La agencia se
preserva.

**Definición nueva y normativa.** Una ejecución está **consumida** cuando existe una fila de
`study_sessions` con su `planner_run_id` cuyo estado es terminal (`COMPLETED` o `ABANDONED`). Una
ejecución sin sesión no está consumida. Una ejecución con sesión abierta no está consumida, y esa
rama es inalcanzable desde una petición de plan porque §N devuelve `RESUME_REQUIRED` antes de
persistir.

**Enmienda mínima y explícita de §O:**

> Una ejecución es una instantánea. Si vuelve a pedirse un plan, el **hash de entrada canónica** es
> idéntico al de la última ejecución no superseded del día **y esa ejecución no ha sido
> consumida**, se reutiliza y **no** se escribe otra. Peticiones repetidas idénticas sobre una
> ejecución no arrancada son idempotentes. Una ejecución **consumida** —aquella cuya sesión alcanzó
> un estado terminal— **no se reutiliza**: la petición siguiente escribe una sucesora, aunque la
> entrada canónica no haya cambiado. **La entrada canónica no codifica el consumo.**

**Enmienda acompañante de §U.6:** `start_planned_session` devuelve la sesión existente **solo
cuando está abierta**; una sesión terminal produce el rechazo nuevo **`RUN_ALREADY_CONSUMED`**, de
modo que quien sostenga un identificador caducado vuelva a pedir plan en lugar de recibir una
sesión muerta.

**§Q.2 gana una fila hermana:** una ejecución **consumida** no es reutilizable, no se edita ni se
borra, no fabrica evidencia de lo no completado y no pierde su historia: queda como predecesora de
su sucesora.

### 4.1 · Propiedades exigidas, demostradas

1. **Una ejecución nunca arrancada sigue siendo reutilizable de forma idempotente** con entrada sin
   cambios: no existe fila de sesión, luego no está consumida, luego se entra en la rama de reuso
   sin cambios. P4-G5 y P4-G21 conservan su objeto exacto.
2. **Render, prefetch y peticiones repetidas no crean sucesoras innecesarias**: encuentran el mismo
   hash y una ejecución no consumida, luego reutilizan. Una sucesora exige que una sesión haya
   alcanzado estado terminal, lo que exige dos actos deliberados.
3. **Una ejecución consumida nunca atrapa**: por la regla enmendada no se reutiliza, luego se
   escribe una sucesora sin sesión, luego arrancable. Si no queda trabajo elegible, la sucesora es
   `NOTHING_ELIGIBLE`, `NOTHING_FITS` o `ZERO_TIME`, que son respuestas veraces, no trampas.
4. **Una sesión por ejecución** se mantiene: el índice único parcial sobre `planner_run_id` no se
   toca; la sucesora es otra ejecución.
5. **Una sesión abierta por persona** se mantiene: la restricción de exclusión diferida no se toca.
6. **Historia inmutable**: la enmienda decide *si se escribe una fila nueva*, nunca modifica una
   existente.
7. **Linaje explícito y auditable**: la sucesora lleva `supersedes_run_id`; la cadena sigue siendo
   lineal por los índices únicos ya existentes, que además hacen la enmienda **segura bajo
   concurrencia sin ninguna primitiva nueva**.
8. **Terminar antes no fabrica evidencia**: `SESSION_COMPLETED` es de ámbito sesión y carga vacía;
   no crea intentos ni eventos de ítem; los ítems no completados quedan `PENDING`.
9. **La evidencia completada sigue siendo válida**: vive en `learning_events` y `question_attempts`,
   independiente del linaje.
10. **Una reparación sin terminar no se describe como reparada**: lo garantiza el motor, no la
    interfaz — el estado categórico solo cambia con evidencia nueva (§F.4, IR-P4A-01).

**La entrada canónica no cambia.** El predicado de consumo se evalúa dentro de la persistencia
contra `study_sessions`, fuera de `PlannerInput`. La observación que cierra la prueba: **el
escenario de P4-G21 es planificar dos veces *sin ejecución*, y la enmienda solo dispara *con*
ejecución; no pueden colisionar.**

**Consecuencia aceptada (OBS-4B-01):** arrancar y terminar repetidamente genera una sucesora por
ciclo. Cada ciclo exige dos actos deliberados, cada ejecución es historia inmutable y §Q.2 ya trata
la cadena como auditoría. **No se inventa ninguna caducidad temporal**, que sería el parámetro que
§Q.2 prohíbe.

## 5 · P4B-D3 · override del mismo día · tabla + evento

El override vigente es **estado canónico mutable** que el Planner lee directamente; su declaración
duradera se registra **además** como evento.

**Entidad:** tabla nueva en `public`, con RLS forzado y sin concesión de escritura de cliente,
clavada al menos por persona y día de plan, con minutos acotados **0–600** —el cero es dato— y sin
acoplamiento alguno con `default_daily_minutes` (INV-106, REQ-E06).

**Frontera de escritura:** función `SECURITY DEFINER` con `search_path` vacío, **solo rol de
servicio**, invocada desde una acción de servidor con identidad verificada (INV-116). **Deriva el
día de plan en servidor** desde `profiles.timezone`: el cliente nunca nombra la fecha, por la misma
autoridad que impide que `client_created_at` elija representación o clave (SD-023). **La superficie
de RPC invocable por cliente permanece en dos.**

**Procedencia de presupuesto:** `TODAY_OVERRIDE` debe ser distinguible de `WEEKLY_ENTRY` y de
`DEFAULT_DAILY`. **Delta menor del esperado:** `BUDGET_SOURCES` en `@study-os/planner-engine` ya
contiene `TODAY_OVERRIDE`; faltan el CHECK de base de datos y el lector.

**Precedencia, sin cambios:** override del mismo día > entrada explícita del día de la semana
**incluido el cero** > `default_daily_minutes`.

**Cero es dato:** un override de 0 es válido y produce `ZERO_TIME`.

**Semántica de fecha:** la zona horaria declarada por la persona.

**Cambiar el override cambia la entrada del Planner** y por tanto dispara recomputación y
supersesión gobernadas. **No reescribe una sesión ya abierta** (§N).

### 5.1 · Contrato de campos de `TODAY_OVERRIDE_SET`

Espeja `AVAILABILITY_CHANGED`, único precedente aceptado para una declaración de tiempo: ámbito
`user` —la frontera ya rechaza un evento de ámbito `user` que traiga sesión o ítem—, con día de
plan y minutos como campos obligatorios, validación semántica de rango y coherencia del día
derivado, y espejo en `EVENT_SCHEMAS_V1`, que una prueba compara para que no deriven.

### 5.2 · Consecuencia que no puede pasarse por alto · INV-118

`public.append_learning_event(jsonb)` es un envoltorio delgado que reenvía **cualquier** tipo cuyo
`event_field_types` no sea nulo, y está concedido a `authenticated`. **En cuanto
`TODAY_OVERRIDE_SET` tenga contrato de campos, un cliente autenticado podría emitirlo directamente**
y crear una declaración en la historia sin fila canónica correspondiente: historia y estado en
desacuerdo, que es justo lo que «tabla + evento» existe para evitar.

El repositorio ya tiene el idioma: `authority-registry.json` distingue `rpcs` de
`clientInvokableRpcs`. La misma distinción debe existir para **tipos de evento**. Se formaliza como
**INV-118**.

## 6 · R-8 · `AVAILABILITY_CHANGED`

**Cerrada a nivel de semántica de gobernanza.** El camino de escritura canónico de la disponibilidad
semanal y por defecto de Phase 4B debe emitir `AVAILABILITY_CHANGED` bajo el mismo principio
arquitectónico aceptado para `TODAY_OVERRIDE_SET`: **cambio de estado canónico más evento de
declaración duradero**, con el evento **autoritativo de servidor**, de modo que un cliente no pueda
crearlo con independencia del cambio de estado canónico.

Esto **no** clasifica la disponibilidad como evidencia de aprendizaje: es una **declaración duradera
de la persona**. Hoy `AVAILABILITY_CHANGED` tiene contrato de campos aceptado y **no lo emite nadie**:
`completeOnboardingAction` escribe `learner_settings` directamente. Sus consecuencias de
implementación y de prueba entran en el BUILD de Phase 4B. **No se implementa ahora.**

## 7 · Q-1 … Q-6 · condiciones de aceptación

| Id | Disposición |
| --- | --- |
| **Q-1 · bucle de plan vacío** | **Cerrado por P4B-D2** a nivel de gobernanza, con la prueba de §4.1 |
| **Q-2 · ejecución atómica parcial** | **Ninguna semántica de Planner nueva.** Si LEER se completa y COMPROBAR no: no se afirma reparación completa, no se fabrica evidencia y **no se cambia la elegibilidad para que la interfaz quede más limpia**. El estado veraz que la UX debe representar está en `docs/PRODUCT_UX_CONTRACT.md` §J. No se inventa semántica de retención ni de repaso |
| **Q-3 · fidelidad de plan** | **Gate duro.** La versión de unidad y la representación de pregunta que el Planner selecciona son las que se presentan. Formalizado como **INV-117** |
| **Q-4 · datos protegidos de presentación** | HOY obtiene la presentación protegida del Planner por la frontera autoritativa de servidor. **No se amplía ninguna concesión de cliente para pintar la interfaz** |
| **Q-5 · planificar al renderizar** | Crear o reutilizar una ejecución durante el render de servidor de HOY está **permitido** como decisión de planificación, distinta de emitir evidencia de aprendiz. Render y prefetch permanecen idempotentes para una ejecución no arrancada |
| **Q-6 · cambio de día** | El cambio de día entre ver y arrancar **invalida y recomputa con verdad** en lugar de arrancar la ejecución de ayer |

### 7.1 · Q-3 · la consecuencia más pequeña, y es notablemente pequeña

`start_planned_session` copia dos valores que hoy descarta:
`planner_items.learning_unit_version_id` → `session_items.presented_learning_unit_version_id` y
`planner_items.question_representation_id` → `session_items.presented_representation_id`.

Eso es todo el cambio. El resto se deriva de maquinaria que ya existe: el trigger de fijación única
de `session_items` permite fijar en el insert y después congela; y **las comprobaciones de igualdad
del boundary de eventos se convierten en la guarda sin escribir ninguna comprobación nueva** —
`LEARNING_UNIT_VIEWED` y `QUESTION_PRESENTED` ya levantan `REPRESENTATION_MISMATCH` cuando
`presented_*` no es nulo y el evento nombra otra identidad, y `ANSWER_SUBMITTED` ya exige que la
representación del payload sea la presentada.

El respaldo «resolver la publicada vigente» de la capa de contenido queda **inalcanzable** para
sesiones `PLANNER_RUN` y se conserva solo para sesiones históricas `FPS_FIXED`.

## 8 · R-1 … R-6 · reconciliación

### 8.1 · CDEM §17 · campos sin disposición

Derivado de autoridad ya aceptada; **ninguna decisión humana nueva**.

| Campo de CDEM §17 | Disposición |
| --- | --- |
| `run_type: DAILY \| REPLAN` | **SUPERSEDED** por el modelo de linaje: ambos valores se computan de columnas persistidas —una ejecución cuyo predecesor tiene otro `plan_day` es la primera del día; una que comparte `plan_day` es replanificación; `supersedes_run_id IS NULL` es la raíz—. Una columna los denormalizaría y podría contradecirlos |
| `run_type: RESCUE` | **DIFERIDO** con la experiencia nombrada: exige el umbral «materialmente por debajo» de Master §8, que ninguna autoridad define y que H-P4-5 se negó a inventar. Un valor de enum cuyo criterio no existe no se emite |
| `run_type: RECOVERY` | **DIFERIDO**, por Master §9 y «ausencia significativa» |
| **neto: `run_type`** | **NO IMPLEMENTADO en Planner v1.** No se crea la columna. Reapertura: autorización de Rescue o Recovery nombrados |
| `input_watermark` | **SUPERSEDED** por la tupla de frescura de cinco partes, estrictamente más fuerte: un watermark único no detecta cambio de configuración ni de generación |
| `available_minutes` | **IMPLEMENTADO con procedencia** como `budget_minutes` + `budget_source`; §I.2 exige registrar el valor **y su procedencia** |
| `reason_codes_json` de ejecución | **IMPLEMENTADO, distribuido** en `planner_items.composition_reason` más las razones de exclusión de la auditoría; §R y §S exigen razón por ítem **y** por exclusión |
| `planner_items.item_ref_id` | **SUPERSEDED** por exactamente un destino tipado (ADR-007 v1.1, SD-006): claves foráneas reales donde una referencia polimórfica no puede darlas |
| `planner_items.priority_score` | **NO IMPLEMENTADO**, ya dispuesto por SD-030 |
| `planner_items.scheduled_date` | **DIFERIDO · no aplicable en v1**: el Planner planifica un solo día y el campo sería copia constante de `planner_runs.plan_day`. Su propósito solo existe bajo planificación multi-día, que no está autorizada. Reapertura: autorización de planificación multi-día |
| `planner_items.status` | **SUPERSEDED** por `session_items`: §Q ya dice que el progreso no vive en una decisión inmutable |

### 8.2 · Errata E-P4B-1

El gate **P4-G3** dice «ejecución **RESCUE** con cero ítems». `run_type` no existe y el sistema
construido registra `outcome = 'ZERO_TIME'` conforme a §L, que es sobre lo que el gate se marcó
PASS. La redacción se corrige a `ZERO_TIME`. **Ningún cambio semántico**, exactamente como
E-P4A-1. Los documentos congelados de Phase 4A **no se editan**: la errata se registra aquí y en el
SPEC_DIFF_LOG.

### 8.3 · R-3 … R-6

| Id | Disposición |
| --- | --- |
| **R-3** | **Rescue nombrado sigue DIFERIDO.** «Materialmente por debajo» **no se define ahora**. Los valores 0·5·10·20·30·personalizado (C-17) son el control de tiempo de hoy, disponible **sin umbral** |
| **R-4** | No se arbitra entre 11, 5 y 7 estados vacíos. El conjunto de 4B se **deriva** de las salidas reales: 21 estados en `docs/PRODUCT_UX_CONTRACT.md` §E. El desajuste documental queda registrado; REQ-F14 sigue `DIFERIDO` |
| **R-5** | Sin semántica de conservar/mover/proteger: exige planificación entre días, criticidad o retención. Un comparador de replanificación solo podría comunicar hechos que dos ejecuciones sostienen, y **4B no lo incluye** |
| **R-6** | Resuelto **estructuralmente** por P4-D2. **No se declara cerrado** hasta que una implementación demuestre que la estimación restante se produce de verdad. **FPS-OBS-04 viaja con él** |

## 9 · Invariantes nuevas

| Id | Regla | Enforcement |
| --- | --- | --- |
| **INV-117** | La versión de unidad y la representación de pregunta que el Planner selecciona son las que se presentan. Una publicación entre la creación del plan y la presentación **nunca** sustituye otra | fijación en el insert de `start_planned_session`; trigger de fijación única; las comprobaciones `REPRESENTATION_MISMATCH` existentes; aserción universal sobre sesiones planificadas arrancadas |
| **INV-118** | Un tipo de evento cuya autoridad de producción es el servidor **no es emitible por un cliente** | lista de tipos solo-servidor en `authority-registry.json`; rechazo en `public.append_learning_event`; prueba que comprueba que el primer intento de cliente falla |

**INV-106** no cambia de redacción; su alcance se vuelve real al existir el override.
**INV-113** no cambia: la tabla de override **no** es una proyección autoritativa —es una
declaración de la persona—, de modo que **no** entra en `projections` del registro de autoridad; su
camino de escritura es solo de servidor por integridad, no por ser proyección.
**INV-108** y **REQ-E11** siguen vacuas en v1 (SD-030).

## 10 · Conjunto de gates de Phase 4B

La numeración continúa la serie **P4-G** porque P4-G18 ya pertenece a Phase 4B y una serie paralela
lo dejaría huérfano. Editorial, no decisión.

| Gate | Pasa cuando |
| --- | --- |
| **P4-G18** (heredado) | Ana completa un recorrido humano sobre un Preview desplegado |
| **P4-G24** | **Fidelidad de plan** (INV-117): la versión fijada es la presentada; la sustitución se rechaza; auditoría y evidencia coinciden |
| **P4-G25** | **Consumo de ejecución** (P4B-D2): incluida la prueba de control negativa de que una ejecución no arrancada **no** produce sucesora |
| **P4-G26** | **Autoridad de duración** (P4-D2): todo minuto planificado procede de un valor autorizado fijado a versión o de la configuración activa; ninguna constante de runtime; una versión sin duración se excluye con su propia razón y **nunca** se rellena |
| **P4-G27** | **`NOTHING_FITS`** (P4B-D1): no se crea ni presenta ítem fuera de presupuesto; la estimación es legible; subir el tiempo supersede y replanifica |
| **P4-G28** | **Override del mismo día** (P4B-D3): precedencia respetada incluido el cero; `default_daily_minutes` intacto; procedencia persistida; estado e historia coinciden; el día viene de la zona declarada; una sesión abierta no se reescribe |
| **P4-G29** | **Eventos solo de servidor** (INV-118): un cliente que intenta `TODAY_OVERRIDE_SET` por `append_learning_event` es rechazado; la superficie de RPC invocable sigue en dos |
| **P4-G30** | **Disciplina de frontera** (Q-4): ninguna concesión de cliente ampliada; ningún elemento de L3 en el DOM |
| **P4-G31** | **Idempotencia de render** (Q-5): renders y prefetch producen una ejecución y cero eventos de aprendizaje |
| **P4-G32** | **Cambio de día** (Q-6): nunca se arranca una ejecución del día anterior |
| **P4-G33** | **Contenido retirado en sesión abierta** (WATCH-4A-1): sin fallo silencioso |
| **P4-G34** | **Retirada del FPS**: ningún camino de aprendiz alcanza `fps-fixed-v1`; las sesiones históricas `FPS_FIXED` y su evidencia siguen legibles y válidas |
| **P4-G35** | **Accesibilidad y QA de diseño**: las condiciones medibles de `docs/PRODUCT_UX_CONTRACT.md` §R y §T sobre toda superficie autenticada, a anchura móvil y de escritorio, más **presencia en escritorio** (§Q) |
| **P4-G36** | **Regresión**: Phase 0, 1A, 2, FPS, 3, 3.1 y 4A en verde; la guarda de alcance negativo de 4A **retirada por autorización**, nunca editada en silencio |
| **P4-G37** | **Frontera real de runtime**: una ruta ejecuta el módulo real contra la frontera real. La regla de D-26 |
| **P4-G38** | **Veracidad**: sin readiness, sin puntuación de dominio, sin porcentaje, sin `✓ Dominado`, sin deuda, sin backlog, sin actividad sintética; `NOTHING_ELIGIBLE` no afirma preparación |

## 11 · Consecuencias de esquema · NO IMPLEMENTADAS

Una sola migración aditiva con su `down/`, listada para acotar la futura autorización. **Nada de
esto se escribe aquí.**

`learning_unit_versions.estimated_minutes` anulable con CHECK de rango · esa columna añadida a la
enumeración de `reject_published_unit_version_mutation()` · `ingest.validate_staged_item` exige la
clave y `ingest.publish_staged_item` la traslada · lista blanca y completitud de `planner_config`
admiten exactamente la clave de estimación de paso CHECK, entera y acotada · una versión nueva de
`planner_config` promovida con autor, motivo y evidencia · CHECK de `duration_provenance` ampliado
a `HYBRID_V1` · CHECK de `budget_source` ampliado con la procedencia de override · tabla de override
con RLS forzado y sin escritura de cliente · función de escritura solo de rol de servicio ·
`planner_budget` gana el nivel de override · `planner_context` devuelve override y procedencia ·
contrato de campos de `TODAY_OVERRIDE_SET` y su espejo de dominio · rechazo de tipos solo-servidor
en `public.append_learning_event` · predicado de consumo en `create_planner_run` ·
`start_planned_session` copia `presented_*`, devuelve sesión existente solo si está abierta y añade
`RUN_ALREADY_CONSUMED` · `NO_DURATION_METADATA` en el enum de razones.

**Ningún esquema privado se crea ni se amplía. `engine`, `content` e `ingest` siguen sin exponer.
ADR-011 no se toca.**

## 12 · Deuda en código que esta ronda deja registrada, no corregida

| Dónde | Qué dice hoy | Por qué no se corrige aquí |
| --- | --- | --- |
| `packages/design-system/src/status.ts` | SD-019 B y C «diferidas · antes de Phase 5» | Es código, y su prueba de gobernanza lo afirma. Un aterrizaje documental no muta en silencio código que vigila una fase congelada. Se corrige en el BUILD de Phase 4B o en un correctivo acotado |
| `packages/design-system/src/tokens.ts` | mismo diferimiento en el comentario de SD-019 | igual |
| `tests/unit/designSystem.blocked.spec.ts` | afirma que B y C siguen diferidas | igual; la prueba debe cambiar **con** el código, en el mismo acto y de forma explícita |
| `packages/planner-engine/src/types.ts` | `DURATION_PROVENANCES = ['FIXTURE']` | correcto hoy: la **decisión** está tomada, la **implementación** es trabajo de BUILD |

Queda registrado como **OBS-4B-03**: la aceptación de SD-019 opción C es autoridad desde hoy y su
reflejo en código está pendiente del primer acto de implementación autorizado.

## 13 · Fronteras de esta autorización

**No autoriza:** el BUILD de Phase 4B · esquema · migraciones · dependencias · mutación de STAGING ·
cambios en Vercel · credenciales · el prerrequisito OBS-3.1-01 · Phase 1B · corpus oficial ·
readiness · PRODUCTION · infraestructura de pago · AQUO.

No mueve `main` por sí misma, no crea ningún tag y no reescribe ninguna congelación anterior.
`phase-4a-v1.0` y todos los tags históricos permanecen intactos.
