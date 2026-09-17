# STUDY OS · Phase 4A · Planner Domain / Decision Engine · Governance Landing

**Copia aceptada.** Registro de la autorización humana del 2026-09-17 y de lo que aterriza con
ella. **Solo gobernanza: el BUILD de Phase 4A no está autorizado.**

| Campo | Valor |
| --- | --- |
| Decisora | Ana Victoria |
| Fecha | 2026-09-17 |
| Línea base | `main` = `7cf9190726f9f4edd8f41998acc6fee8792a2d3a` |
| Fase congelada anterior | **Phase 3.1 · FROZEN · PASS WITH DEBT** · `phase-3-v1.1` → `577cc711e017f1fb48ba881ea34288d865317429` |
| Entrada aceptada | **Phase 4 · Planner Engine · Post-Phase-3.1 Pre-Authorization Decision Packet** |
| Modo | gobernanza · sin BUILD · sin runtime · sin esquema |
| Propietario normativo | **ADR-012** · contrato en `docs/PLANNER_CONTRACT.md` v1.0 |

---

## 1 · Qué aterriza

- **`docs/PLANNER_CONTRACT.md` v1.0** · `ACCEPTED` como contrato de Phase 4A.
- **ADR-012 · Autoridad de decisión del Planner** · `ACCEPTED · v1.0`, `NOT IMPLEMENTED`.
- **Disposiciones SPEC_DIFF** de H-P4-1a, por adenda.
- **P4-D1** registrada como autoridad de producto.
- **P4-D2** registrada como **diferida**.
- **H-P4-0** registrada como resuelta por Phase 3.1.
- Disposición de los cuatro tipos de evento sin contrato de campos.
- Disposición del hallazgo de contenido retirado en sesión abierta.
- Disposición de OBS-3.1-01.
- Estructura de entrega 4A → UX → 4B.
- Alcance propuesto de BUILD y gates de Phase 4A.
- Reconciliación documental de la tabla viva de `ARCHITECTURE_STATE.md` §1.

Y nada más. Ninguna migración, ningún esquema, ningún paquete, ninguna ruta, ninguna dependencia,
ninguna mutación de STAGING, ningún cambio en Vercel.

## 2 · P4-D1 · aprobada con modificación

Planner v1 **no** usa un orden global monolítico —ni «reparación primero» ni «cobertura
primero»— como política de selección completa. Usa **composición categórica equilibrada**, cuya
intención declarada es:

> **PROGRESO + REPARACIÓN · sin castigo · sin ignorar la evidencia.**

| ID | Autoridad establecida |
| --- | --- |
| **P4-D1.1** | **Garantía de reparación.** Existiendo necesidad legítima de reparación —`EVIDENCE_NEGATIVE`, `EVIDENCE_CONFLICTING` o patrón de error estructural activo y autoritativo— y permitiéndolo el presupuesto, el plan **debe responder** a esa necesidad. El Planner no puede ignorar en silencio la evidencia para seguir cubriendo sílabo |
| **P4-D1.2** | **Continuidad de cobertura.** La reparación **no puede monopolizar** la selección indefinidamente mientras queden necesidades legítimas `NEW` o `EXPOSED` elegibles. Una persona que produce evidencia negativa no puede quedar atrapada en un subconjunto pequeño mientras el resto del sílabo nunca se alcanza. Es adaptación **sin castigo** |
| **P4-D1.3** | **Verificación de bucle abierto.** `EXPOSED` es un bucle de aprendizaje legítimo sin resolver y puede ser accionable de forma independiente, sin convertirse en un valor numérico de dominio |
| **P4-D1.4** | **Exclusión de la evidencia positiva en v1.** `EVIDENCE_POSITIVE` no es elegible de forma independiente y **no se recicla** por no quedar otro candidato. Planner v1 no tiene modelo de retención, decaimiento, espaciado ni estabilidad, ni intervalo ni política de repaso, y por tanto **carece de autoridad** para programar su revisión. Esto **no** afirma que la evidencia positiva sea dominio permanente |
| **P4-D1.5** | **Agotamiento honesto.** Sin ninguna otra necesidad autorizada, el Planner devuelve `NOTHING_ELIGIBLE`, que significa solo «el modelo autorizado no tiene acción justificada» y **nunca** preparado, dominado, terminado, 100 % aprendido ni sin repaso futuro |
| **P4-D1.6** | **Sin actividad sintética.** Nunca se genera actividad solo para evitar una recomendación vacía. Un plan no vacío no es invariante de producto. Debe ser mecánicamente comprobable |
| **P4-D1.7** | **Sin parámetro de equilibrio oculto.** No autoriza 50/50, ratios, porcentajes, pesos, puntuaciones, cuotas, turnos rotatorios, «una reparación por cada N», máximos de categorías consecutivas, constantes de alternancia ni azar |

## 3 · P4-D2 · diferida

El origen de los minutos planificados **no se decide en esta ronda**. El contrato puro de
Phase 4A **acepta la duración autoritativa de cada candidato como entrada**.

Vinculante en 4A: no se añade metadato de duración al contenido · no se crean valores por defecto
· no se inventan minutos · no se crean requisitos de autoría · no se cierra FPS-OBS-04. Las
duraciones de fixture son **datos de prueba** y no pueden convertirse en constantes de runtime.

P4-D2 **no bloquea la semántica de Phase 4A**.

## 4 · H-P4-0

**H-P4-0 · RESOLVED BY PHASE 3.1.** La historia de Phase 3 no se reescribe: D-26 sigue siendo
verdad histórica en `phase-3-v1.0` y está **CERRADA** en `phase-3-v1.1`.

## 5 · Disposiciones derivadas de autoridad existente · H-P4-1a, 3, 4, 5, 6, 7

Se aceptan como **resoluciones derivadas de autoridad existente**, no como decisiones humanas de
producto separadas.

| ID | Disposición |
| --- | --- |
| **H-P4-1a · REQ-E03** | El modelo numérico de prioridad de siete factores queda **superseded** por ADR-003 v1.2 anexo §C |
| **H-P4-1a · REQ-E04** | Se reinterpreta **solo** como acumulación honesta de presupuesto; sin semántica de desplazamiento de repasos mientras no exista programación de repasos |
| **H-P4-1a · REQ-E10** | Semántica de prerrequisitos **diferida**: `strength` no tiene significado aceptado y los ciclos no están impedidos |
| **H-P4-1a · REQ-E11 / INV-108** | «Ningún repaso se descarta en silencio» es **vacuo** en Planner v1: no existe calendario de repaso autoritativo |
| **H-P4-3** | `NOTHING_FITS`: se devuelve el estado, **no** se coloca un ítem fuera de presupuesto, se registra la exclusión `OVER_BUDGET`. La oferta a la persona se difiere a 4B/UX |
| **H-P4-4** | Precedencia de presupuesto: override válido del mismo día → entrada explícita del día de la semana, **incluido `0`** → `default_daily_minutes`. El cero es dato, no ausencia |
| **H-P4-5** | **Sin umbrales** de Rescue ni de ausencia en Phase 4A. 4A conserva los hechos mecánicos y no inventa «materialmente por debajo» ni «ausencia significativa». Las experiencias nombradas pertenecen a 4B/UX |
| **H-P4-6** | Mecanismos de mínimo privilegio ya existentes: `public` con RLS forzado, superficies legibles por la persona y una tabla de servicio sin concesión a `anon` ni `authenticated`. **Ningún esquema privado nuevo**; ADR-011 no se amplía en silencio |
| **H-P4-7** | Creación de plan y arranque de sesión planificada **autoritativos de servidor**. La superficie de RPC invocable por el cliente **no se amplía**: servidor calcula la decisión autoritativa → frontera de persistencia gobernada |

## 6 · Derivación de la composición equilibrada

§6 de la autorización exige demostrar que la composición equilibrada se deriva **sin introducir
un parámetro oculto de producto o de ciencia**, y detenerse si no se puede.

**Se puede.** La derivación completa es §G del contrato. Resumen del argumento:

1. **Las necesidades se agrupan en tres conjuntos** con propiedades de agotamiento distintas:
   **R** (reparación sin responder), **V** (`EXPOSED`), **N** (`NEW`), con **C = V ∪ N**.
2. **V y N drenan monótonamente**: actuar sobre ellos produce evidencia y el concepto abandona el
   conjunto. **R puede reaparecer** indefinidamente, porque la persona puede volver a fallar. Esa
   asimetría, y no una preferencia pedagógica, es la que crea el riesgo de monopolio que P4-D1.2
   prohíbe.
3. **Una acción es atómica** (contrato §F.2). No se deriva de comodidad: no existe estado
   categórico para «reaprendido pero sin comprobar», de modo que media acción abriría un bucle
   que las propias entradas del Planner no pueden ver, y la reproducción histórica dejaría de ser
   fiel.
4. **Una necesidad de reparación está respondida** cuando una ejecución anterior ya emitió su
   acción con evidencia consumida igual o posterior a la evidencia que la creó. Es la definición
   de «responder» que P4-D1.1 usa, no una política nueva. Gracias a ella, R también drena salvo
   que llegue evidencia negativa nueva.
5. **La cabeza es de reparación.** P4-D1.1 es una obligación incondicional y P4-D1.2 una
   prohibición de monopolio. Con la cabeza en cobertura, un presupuesto pequeño dejaría el plan
   sin reparación e incumpliría P4-D1.1. El orden queda determinado.
6. **La cantidad es uno, y no es una cuota.** P4-D1.1 es una garantía **existencial**: exige que
   exista una respuesta, no una cantidad. La aridad de un existencial es uno. Cero incumple
   P4-D1.1; cualquier valor mayor sería una cantidad **elegida**, exactamente el parámetro que
   P4-D1.7 prohíbe. El tope tampoco se fija: es el complemento de la garantía, porque ninguna
   otra regla coloca reparación mientras quede cobertura por colocar.
7. **La asimetría es derivada.** Ninguna invariante protege a la reparación de la cobertura, de
   modo que un tope simétrico sería política inventada.
8. **El orden de sílabo por sí solo no sirve.** Un concepto solo tiene evidencia si ya se
   estudió, y el estudio avanza en orden de sílabo: todo concepto con evidencia está
   estructuralmente **antes** que el siguiente concepto nuevo. Una composición puramente ordinal
   degenera en «reparar todo lo tocado antes de avanzar», el monopolio prohibido. Por eso las
   garantías son **posicionales**.

**Ningún parámetro nuevo.** La única cantidad que aparece es el uno del paso 6, que es la aridad
de una garantía existencial y no una proporción elegida. No hay ratio, porcentaje, peso, cuota,
longitud de ciclo, constante de alternancia, máximo de consecutivos ni azar. La mezcla real de un
plan es **consecuencia** de la elegibilidad y del presupuesto.

### 6.1 · Red team de la derivación

| # | Escenario | Comportamiento | Veredicto |
| --- | --- | --- | --- |
| 1 | Todo reparación | C = ∅ · se llena con R en orden de sílabo; P4-D1.2 es vacua | PASA |
| 2 | Todo `NEW` | R = ∅ · cobertura en orden de sílabo | PASA |
| 3 | Todo `EXPOSED` | R = ∅ · verificaciones en orden de sílabo | PASA |
| 4 | Reparación + `NEW` | una reparación (la de menor sílabo sin responder) + cobertura | PASA · progreso y reparación en el mismo plan |
| 5 | Reparación + `EXPOSED` | una reparación + verificaciones | PASA |
| 6 | Los tres | una reparación, luego V y N por posición de sílabo, sin regla de categoría | PASA |
| 7 | Presupuesto de una acción | solo caben acciones de un ítem: la verificación. Si no hay ninguna, `NOTHING_FITS` | PASA · determinista, sin elección arbitraria |
| 8 | Presupuesto de dos ítems | cabe una acción de reparación: la toma **G-R**; la cobertura no entra porque no cabe, no porque se la excluya | PASA |
| 9 | Presupuesto muy grande | una reparación + toda la cobertura; agotada la cobertura, el resto en reparación | PASA |
| 10 | Sesiones repetidas con conjunto elegible sin cambios | hash de entrada idéntico → reutilización, sin ejecución nueva | PASA |
| 11 | Un concepto que falla una y otra vez | cada sesión vuelve a estar sin responder y toma **la única** ranura de reparación; la cobertura sigue avanzando | PASA · es el caso que P4-D1.2 protege |
| 12 | Sílabo grande, persona que progresa | la cobertura avanza monótonamente; la reparación drena por respuesta | PASA |
| 13 | Reproducción determinista | todo lo dependiente del historial —incluido respondida/sin responder— se registra en la instantánea | PASA · requisito de contrato §S |
| 14 | Orden de filas alterado | solo claves de sílabo y comparación por punto de código | PASA |
| 15 | Ratio accidental emergente | la única cantidad es la aridad uno; la mezcla es consecuencia, no proporción | PASA |

### 6.2 · Consecuencia registrada, no resuelta

**OBS-4A-01.** Con acciones atómicas y un presupuesto que solo admite una acción de un ítem, una
persona cuya disponibilidad declarada sea permanentemente mínima avanzará solo por
verificaciones. Es consecuencia veraz de las invariantes aceptadas más la atomicidad, y **no se
resuelve inventando nada**: queda registrada para el milestone de UX y para la decisión P4-D2,
que es la que determina cuántas acciones caben en un presupuesto.

**OBS-4A-02.** Con `EVIDENCE_POSITIVE` excluida y sin política de repaso, una persona con
evidencia positiva en todo su pack alcanza `NOTHING_ELIGIBLE` de forma permanente. Es
consecuencia directa y aceptada de P4-D1.4 y de DEF-28. Registrada, no mitigada.

## 7 · Disposición de los cuatro tipos de evento sin contrato

`TODAY_OVERRIDE_SET`, `RESCUE_MODE_ENTERED`, `REPLAN_CONFIRMED` y `RECOVERY_STARTED` existen en
el enum de tipos de evento desde la migración 18, pero `ingest.event_field_types` devuelve `null`
para los cuatro: la frontera los rechaza hoy con `EVENT_TYPE_NOT_ACCEPTED`.

| Evento | Disposición en Phase 4A |
| --- | --- |
| `TODAY_OVERRIDE_SET` | **DEFERRED TO 4B** · el override es un cambio declarado por la persona y se emite desde la superficie que lo captura, que es 4B. 4A no lo emite |
| `RESCUE_MODE_ENTERED` | **NOT EMITTED** · Phase 4A no define umbral de Rescue (H-P4-5). Un evento cuyo criterio no existe no se emite |
| `REPLAN_CONFIRMED` | **NOT EMITTED** · «confirmado» implica una confirmación de la persona, que es superficie de 4B |
| `RECOVERY_STARTED` | **NOT EMITTED** · igual que Rescue: sin definición aceptada de ausencia |

No se inventa ningún contrato de campos por el mero hecho de que el enum exista. Todo evento que
Phase 4A pretenda emitir tendrá contrato de campos explícito y aceptado **antes** del BUILD.
Gate **P4-G17** lo vigila.

## 8 · Disposición del contenido retirado en sesión abierta

El hallazgo es real: un objetivo retirado dentro de una sesión ya abierta falla hoy en silencio.

**Disposición: no es un asunto de Phase 4A.** Es consumo de sesión, y Phase 4A no toca la
semántica de sesión de Phase 2 ni la superficie visible. Se registra como **WATCH-4A-1** y su
tratamiento corresponde a Phase 4B, donde la sesión planificada se arranca y se consume.

Phase 4A sí fija lo que le toca: un ítem **no iniciado** cuyo objetivo ha sido retirado se
excluye al arrancar con `TARGET_UNAVAILABLE` y provoca replanificación (contrato §P).

## 9 · Disposición de OBS-3.1-01

Consecuencia arquitectónica, registrada y nada más:

| Milestone | ¿Prerrequisito? |
| --- | --- |
| BUILD de Phase 4A en local, CI y STAGING | **No** · la clave ya existe en el entorno local y en los secretos de CI |
| Recorrido humano en un Preview desplegado (4B) | **Sí** · sin credencial de servidor no se puede crear ninguna ejecución del Planner, y el recorrido sería vacío |
| Aceptación de Phase 4B | **Sí**, en la medida en que la aceptación exija recorrido desplegado |
| PRODUCTION | fuera de alcance · sigue INACTIVO |

**No se ha cambiado Vercel, no se ha pedido ninguna credencial, no se ha impreso ninguna
credencial y no se ha añadido ninguna.** OBS-3.1-01 sigue arrastrándose hasta su milestone
explícitamente autorizado, que será una autorización humana propia dentro de Phase 4B.

## 10 · Estructura de entrega

```
PHASE 4A · Planner Domain / Decision Engine
   → congelación
   → milestone dedicado de Producto · UX / Diseño visual
   → autorización explícita de credencial de runtime en Preview, cuando haga falta
   → PHASE 4B · Planner Product Integration
```

La congelación de 4A produce **cero cambio visible de selección**: `fps-fixed-v1` sigue siendo el
camino de selección de la persona durante toda 4A. El milestone de UX diseña contra estados
congelados y reales del Planner, y **no** inventa semántica de Planner. No se ejecuta UX ahora.

## 11 · Alcance propuesto de BUILD de Phase 4A · no autorizado

Propuesto, sujeto al contrato y **pendiente de una Build Authorization separada**:

- paquete puro y determinista del Planner, sin red y sin dependencias;
- contrato de entrada de candidatos, con la duración como **entrada** (§3);
- ejecuciones e ítems del Planner, con historia inmutable;
- auditoría de candidatos y exclusiones;
- configuración versionada del Planner, con promoción humana;
- almacenamiento del override del mismo día, **si el contrato aceptado lo exige** en 4A;
- zona horaria de la persona, exigida para definir «hoy»;
- integridad referencial de `study_sessions.planner_run_id`;
- unicidad de una sesión abierta por persona en base de datos;
- frontera de persistencia autoritativa de servidor;
- frontera de arranque de sesión planificada, idempotente por ejecución;
- puesta al día bloqueante del Learning Engine;
- reproducción determinista desde la instantánea;
- seguridad, RLS y actualización del registro de autoridad y de las guardas;
- migraciones con su `down/`;
- fixtures `GENERATED` más ricos y prueba en STAGING;
- pruebas en la **frontera real de runtime**.

Dos aclaraciones de recorte, porque §15 pide quitar lo que no haga falta:

- **el almacenamiento del override del mismo día** solo entra en 4A si el contrato lo exige para
  calcular el presupuesto; la **superficie** que lo captura es 4B en todo caso;
- **ningún metadato de duración** entra en 4A (§3).

## 12 · Explícitamente fuera de Phase 4A

HOY consumiendo la salida del Planner · selección adaptativa visible · rediseño de UX · Claude
Design · ejecución del milestone de UX · la decisión P4-D2 · duraciones por defecto inventadas ·
UX final de tiempo reducido · umbrales nombrados de Rescue y Recovery · oferta de ítem fuera de
presupuesto · Phase 1B · corpus oficial · readiness · dominio numérico · retención, decaimiento y
espaciado · programación de repasos · semántica de prerrequisitos · planificación de `PRACTICAL`
y `CONCEPT_REVIEW` · autoridad de IA · offline · PRODUCTION · infraestructura de pago · AQUO.

## 13 · Gates de aceptación de Phase 4A

Ninguno se declara PASS en gobernanza.

| Gate | Pasa cuando |
| --- | --- |
| **P4-G1** | cambiar el valor por defecto replanifica ejecuciones futuras y no modifica ninguna ejecución, sesión ni evento pasados (REQ-E05) |
| **P4-G2** | el override del día deja `default_daily_minutes` intacto (REQ-E06) |
| **P4-G3** | presupuesto cero: ejecución RESCUE con cero ítems, sin backlog, contador ni marca de deuda (REQ-E08) |
| **P4-G4** | reproducir una ejecución desde su instantánea da ítems y códigos de razón idénticos byte a byte |
| **P4-G5** | orden de filas alterado y peticiones idénticas repetidas dan el mismo `input_hash` y el mismo plan, sin ejecución duplicada |
| **P4-G6** | integridad de ítem: exactamente un objetivo tipado, versión fijada, RESTRICT, mismo pack, inmutable |
| **P4-G7** | motor atrasado: puesta al día bloqueante y, si falla, `PLAN_UNAVAILABLE_ENGINE` sin escribir ejecución y sin degradación silenciosa |
| **P4-G8** | semántica de presupuesto con **duraciones de fixture explícitas**, y matriz `NOTHING_FITS` / `ZERO_TIME` / `NOTHING_ELIGIBLE` cubierta |
| **P4-G9** | la matriz de reanudación, reutilización, invalidación y replanificación aplicable a 4A, con historia append-only |
| **P4-G10** | una sola sesión abierta por persona, impuesta por la base de datos; arranque idempotente por ejecución |
| **P4-G11** | seguridad: aislamiento RLS, sin escritura ni autoridad de selección del cliente, escritura solo por rol de servicio, registro y guardas actualizados por gobernanza, claves de respuesta inalcanzables |
| **P4-G12** | sin proxy de readiness y sin parámetro inventado: CHECKs de esquema, prohibición de vocabulario y CHECK de configuración. Incluye que `NOTHING_ELIGIBLE` no afirme preparación |
| **P4-G13** | entorno: roundtrip reversible con firma idéntica, deriva limpia, extracción limpia de `git archive`, residuo cero en STAGING, PRODUCTION intacto, sin recursos de pago |
| **P4-G14** | regresión completa: Phase 0, 1A, 2, FPS, 3 y 3.1 en verde; fixture `fps-fixed-v1` intacto |
| **P4-G15** | alcance negativo: solo `GENERATED`, sin Phase 1B, sin comportamiento de Phase 5/6/8, **sin cambio visible de selección** |
| **P4-G16** | **frontera real de runtime** · toda capacidad crítica de servidor del Planner probada ejecutando el módulo real contra la frontera real donde correrá. Un arnés SQL o de dominio equivalente es complementario y **no suficiente** |
| **P4-G17** | **honestidad de la frontera de eventos** · todo evento del Planner que se emita tiene contrato de campos aceptado |
| **P4-G19** | **sin actividad sintética** · sin necesidad elegible autorizada, el Planner devuelve `NOTHING_ELIGIBLE` y no fabrica actividad desde `EVIDENCE_POSITIVE` ni desde ninguna otra señal no autorizada |

**P4-G18 pertenece a Phase 4B** (recorrido en Preview desplegado) y **no** es un gate de 4A.

Gate derivado del contrato aceptado, añadido aquí:

| Gate | Pasa cuando |
| --- | --- |
| **P4-G20** | **composición equilibrada** · con reparación y continuidad simultáneamente elegibles y presupuesto suficiente, el plan contiene **exactamente una** acción de reparación y ninguna regla, columna ni configuración introduce ratio, cuota, ciclo ni alternancia. La matriz §6.1 se prueba entera |

## 14 · Fronteras de esta autorización

No autoriza: BUILD de Phase 4A · esquema · migraciones · dependencias · mutación de STAGING ·
cambios en Vercel · credenciales · Phase 4B · el milestone de UX · Phase 1B · corpus oficial ·
readiness · PRODUCTION · AQUO.

No mueve `main`, no crea ningún tag y no reescribe ninguna congelación anterior. `phase-3-v1.0` y
`phase-3-v1.1` permanecen intactos.
