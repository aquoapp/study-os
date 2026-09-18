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
| Propietario normativo | **ADR-012** · contrato en `docs/PLANNER_CONTRACT.md` |
| Validación adversarial | 2026-09-17 · **IR-P4A-01** e **IR-P4A-02** aceptados · el contrato pasa a `PROPOSED · BLOQUEADO` (§6) |
| Gate A · cierre | 2026-09-18 · **P4-D3** y **P4-D4** `ACCEPTED`; prueba residual B cerrada; **prueba residual A NO cierra** → **P4-D5** (§23, §24). **Gate A = FAIL · no se construye** |

---

## 1 · Qué aterriza

> **Corrección del 2026-09-17.** La revisión independiente encontró dos defectos reales en el
> candidato v1 y los dos se aceptan sin defensa (§6.1, §6.2). El contrato **deja de estar
> aceptado**: la validación demuestra que las siete cláusulas de P4-D1 **no determinan un
> algoritmo único**, y quedan dos decisiones humanas —**P4-D3** y **P4-D4**— que esta ronda no
> toma. Todo lo demás de este aterrizaje se mantiene.

- **`docs/PLANNER_CONTRACT.md` v1.1** · `PROPOSED · BLOQUEADO POR DECISIÓN HUMANA` (P4-D3, P4-D4).
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

## 6 · Derivación de la composición · **reconstruida tras la validación adversarial**

La revisión independiente rechazó la prueba anterior. Tenía razón dos veces, y las dos
correcciones están abajo. La prueba se reconstruye desde cero; no se conserva ninguna conclusión
solo porque apareciera en el candidato v1.

### 6.1 · IR-P4A-01 · una recomendación no es una respuesta

**Afirmación anterior:** una necesidad de reparación queda «respondida» cuando una ejecución
anterior del Planner **emitió** la acción correspondiente.

**Contraejemplo, aceptado sin defensa:** la persona falla el concepto A · el Planner emite
`REAPRENDER + COMPROBAR` · la persona cierra la aplicación sin ejecutar nada · vuelve más tarde ·
no hay evidencia nueva. Bajo aquella redacción A quedaba «respondida» y salía de la presión del
Planner **sin que la persona hubiera hecho nada**.

`PLANIFICADO` no equivale a `PRESENTADO`, `INICIADO`, `COMPLETADO`, `COMPROBADO`,
`EVIDENCIA REGISTRADA` ni `REPARACIÓN LOGRADA`.

**Corrección:** el concepto de «necesidad respondida» **se elimina del contrato**. Lo único que
satisface P4-D1.1 es **evidencia nueva registrada**, que es el único hecho duradero que el motor
representa, que la persona produce de verdad y que cambia el estado categórico. El historial de
ejecuciones del Planner pasa a ser **auditoría, nunca señal**.

**Consecuencia sobre la prueba:** la prueba anterior usaba ese «drenaje» como premisa material.
Cae entera y hay que rehacerla.

### 6.2 · IR-P4A-02 · la atomicidad estaba sobreafirmada

**Afirmación anterior:** `APRENDER + COMPROBAR` es indivisible porque el motor no tiene estado
para «reaprendido pero sin comprobar».

**Por qué no basta:** esa ausencia prueba que aprender no crea evidencia de acierto. No prueba
que aprender y comprobar deban ser el mismo ítem de presupuesto.

**Lo que el análisis sí establece:**

- para `NEW`, el motor **sí** representa el bucle abierto: ejecutar `APRENDER` deja el concepto en
  `EXPOSED`, que significa exactamente «visto y sin comprobar»;
- para la reparación **no lo representa**: `REAPRENDER` no produce evidencia y el concepto sigue
  en `EVIDENCE_NEGATIVE`;
- por tanto la **cadena pura queda falsada**: en reparación genera un bucle estructural del que
  la persona no puede salir, porque la acción ofrecida no puede cambiar el estado que la motiva.
  Contraejemplo mínimo y prueba mecánica en `tests/governance/modelCheck.spec.ts`.

Quedan **dos modelos admisibles y no equivalentes** —atómico e híbrido— y ninguna autoridad elige
entre ellos. Es la decisión humana **P4-D3**.

### 6.3 · La prueba reconstruida

Con «respondida» eliminada, la vivacidad tiene que venir de otro sitio. Viene de la evidencia.

1. **Tres conjuntos** con comportamiento distinto: **R** (reparación), **V** (`EXPOSED`), **N**
   (`NEW`), con **C = V ∪ N**.
2. **V y N drenan** al actuar sobre ellos. **R puede reaparecer**: la persona puede volver a
   fallar. Esa asimetría —y no una preferencia pedagógica— es la que crea el riesgo de monopolio
   que P4-D1.2 prohíbe.
3. **La cabeza es de reparación.** P4-D1.1 es una obligación incondicional y P4-D1.2 una
   prohibición de monopolio; con la cabeza en cobertura, un presupuesto pequeño dejaría el plan
   sin ninguna reparación.
4. **La cantidad es uno, y no es una cuota.** P4-D1.1 es una garantía **existencial**: exige que
   exista una respuesta, no cuántas. Cero la incumple; cualquier valor mayor sería una cantidad
   **elegida**, exactamente el parámetro que P4-D1.7 prohíbe.
5. **La asimetría es derivada:** ninguna invariante protege a la reparación de la cobertura, así
   que un tope simétrico sería política inventada.
6. **El orden de sílabo por sí solo no sirve:** todo concepto con evidencia está estructuralmente
   antes en el sílabo que el siguiente concepto nuevo, así que una composición puramente ordinal
   degenera en «reparar todo lo ya tocado antes de avanzar». Por eso las garantías son
   **posicionales**.
7. **Dentro de la reparación, la evidencia más antigua primero.** Es lo único que da vivacidad:
   actuar produce evidencia nueva, que empuja ese concepto al final y deja pasar al siguiente. Las
   dos alternativas naturales están **falsadas mecánicamente**: con orden de sílabo, y con
   «evidencia más reciente primero», un concepto que falla repetidamente se queda la ranura para
   siempre y los demás no se atienden nunca.
8. **Se salta lo que no cabe, no se optimiza.** Detenerse acoplaría la duración de un candidato a
   la planificación de otro; reordenar para llenar minutos introduciría un objetivo de
   optimización que nadie ha autorizado.

**Ningún parámetro nuevo.** La única cantidad sigue siendo el uno del paso 4, que es la aridad de
una garantía existencial. No hay ratio, porcentaje, peso, cuota, longitud de ciclo, constante de
alternancia, máximo de consecutivos ni azar.

### 6.4 · Lo que la prueba **no** consigue

Y esto es lo que cambia el veredicto de la ronda:

> **Las siete cláusulas de P4-D1 no determinan un algoritmo único.**

Determinan una familia. Dentro de ella quedan derivados la posición y la aridad de la garantía,
la asimetría, el orden dentro de la reparación, el empaquetado y el rechazo de la optimización. Y
quedan **sin determinar** dos cosas que una persona nota:

- **P4-D3 · granularidad de la acción** (atómica o híbrida);
- **P4-D4 · orden entre `EXPOSED` y `NEW`** dentro de la continuidad.

Dos algoritmos deterministas no equivalentes satisfacen las siete invariantes. Por tanto el
algoritmo **no está derivado**, y esta ronda **no lo elige**: las dos preguntas se devuelven como
decisiones humanas (§6.7).

### 6.5 · Comprobación exhaustiva de estados pequeños

`tests/governance/modelCheck.spec.ts` enumera espacios abstractos completos —1 a 4 conceptos, los
cinco estados categóricos, tres vectores de duración, siete presupuestos, tres granularidades y
tres órdenes de continuidad— y ejecuta sobre cada caso las propiedades formales.

| Medida | Valor |
| --- | --- |
| Estados explorados | **557 550** · barrido de variantes 1..4 conceptos más configuración aceptada 1..6 |
| Transiciones evaluadas | **3 345 300** |
| Contraejemplos de las propiedades | **0** |
| Variantes de política falsadas | **6** · cadena pura, y cinco órdenes de reparación (§23.4) |

### 6.6 · Simulación longitudinal

`tests/governance/simulation.spec.ts` ejecuta **1 560 trayectorias deterministas sembradas** de
100 sesiones cada una —**156 000 sesiones**— sobre sílabos de 3, 8, 20 y **100** conceptos, con
trece comportamientos de aprendiz, presupuestos fijos y variables, e interrupciones.

Mide **solo propiedades estructurales**. No hay puntuación de aprendizaje, de dominio, de
preparación ni de retención, y de esta simulación **no se deriva ninguna afirmación pedagógica**.

| Medida | Resultado |
| --- | --- |
| Violaciones de presupuesto | 0 |
| Actividad fabricada | 0 |
| Decisiones no deterministas | 0 |
| Bucles estructurales | 0 |
| Cobertura alcanzada con una debilidad persistente | > 15 de 20 conceptos |
| Planes repetidos sin ejecución | los esperados: la recomendación sigue pendiente |

### 6.7 · Las dos decisiones que esta ronda devuelve

Están en §15 como fichas completas. En una línea cada una:

- **P4-D3** · ¿una acción de aprendizaje es un único ítem de presupuesto, o el paso de aprender
  puede planificarse solo cuando el motor sabe representar el bucle abierto?
- **P4-D4** · ¿cerrar un bucle ya abierto va antes que abrir uno nuevo?

### 6.8 · Consecuencias registradas, no resueltas

**OBS-4A-01.** Con un presupuesto que solo admite una acción muy corta, una disponibilidad
declarada permanentemente mínima avanza poco o nada. Es consecuencia veraz de las invariantes
aceptadas y su severidad depende de **P4-D3** y de **P4-D2**. Registrada, no mitigada.

**OBS-4A-02.** Con `EVIDENCE_POSITIVE` excluida y sin política de repaso, una persona con
evidencia positiva en todo su pack alcanza `NOTHING_ELIGIBLE` de forma permanente. Consecuencia
directa de P4-D1.4 y DEF-28.

**OBS-4A-03 · nueva.** El Planner deja minutos sin usar cuando la acción más prioritaria no cabe
y las siguientes tampoco. Es el precio de no optimizar, y es deliberado.
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
| **P4-G21** | **sin falsa reparación completada** (IR-P4A-01) · emitir una recomendación no reduce la presión de la reparación. Planificar dos veces sin ejecución produce el mismo plan, y una necesidad solo desaparece cuando la evidencia la disuelve. Ningún hecho de auditoría —incluidas las ejecuciones anteriores del Planner— entra en la selección |
| **P4-G22** | **empaquetado sin optimización** · se preserva el orden de prioridad, se salta lo que no cabe, y no se maximizan minutos ni ítems. Dejar presupuesto sin usar no es un fallo |

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

---

## 15 · Decisiones humanas que esta ronda devuelve

Ninguna está tomada. Ninguna lleva `ACCEPTED`. Mientras sigan abiertas, el contrato del Planner
no puede aceptarse.

### P4-D3

**DECISIÓN EN UNA FRASE**
¿Una acción de aprendizaje es un único ítem de presupuesto indivisible, o el paso de aprender
puede planificarse por separado cuando el motor sabe representar el bucle abierto que deja?

**POR QUÉ DEBE SER HUMANA**
Ninguna autoridad aceptada lo decide. La cadena pura está falsada mecánicamente, pero quedan dos
modelos que satisfacen las siete cláusulas de P4-D1 y **no son equivalentes**: cambian lo que una
persona con poco tiempo recibe. La derivación anterior afirmaba tener la respuesta y la revisión
independiente demostró que no la tenía.

**QUÉ EXPERIMENTA LA PERSONA**
Con 6 minutos declarados y una unidad que se lee en 5 y se comprueba en 3: con el modelo atómico
la persona no recibe nada; con el híbrido recibe la lectura, y la comprobación llega en la
siguiente sesión.

**OPCIÓN A · atómica**
`APRENDER + COMPROBAR` y `REAPRENDER + COMPROBAR` son un único ítem indivisible.
- *Beneficios:* nunca se abre un bucle de verificación que quede colgando; lo planificado, si se
  ejecuta entero, siempre produce evidencia; el plan es más fácil de explicar.
- *Costes:* con presupuestos pequeños, `NOTHING_FITS` es frecuente y la persona puede no recibir
  nada durante mucho tiempo; agrava OBS-4A-01.
- *Casos límite:* una unidad larga con una comprobación corta puede no caber nunca en una
  disponibilidad modesta.
- *Consecuencias futuras:* si más adelante se declara una duración por ítem más fina (P4-D2), el
  problema se suaviza sin cambiar la semántica.

**OPCIÓN D · híbrida**
Encadenada donde el motor representa el bucle (`NEW` → `EXPOSED` al aprender); atómica donde no
lo representa (reparación).
- *Beneficios:* usa exactamente lo que el motor ya sabe decir, sin inventar estado; un
  presupuesto pequeño sigue produciendo trabajo honesto; reduce OBS-4A-01.
- *Costes:* una persona puede acumular material visto y sin comprobar, y ahí la decisión P4-D4
  pasa a importar mucho más; el plan tiene dos granularidades y es algo más difícil de explicar.
- *Casos límite:* si se abandona tras aprender, el concepto queda `EXPOSED` — que es exactamente
  lo que pasó, dicho con honestidad.
- *Consecuencias futuras:* deja el camino abierto a que la comprobación se planifique con criterio
  propio cuando exista política de repaso.

**RECOMENDACIÓN ARQUITECTÓNICA**
Opción D.

**POR QUÉ**
Porque no inventa nada: `EXPOSED` ya significa «visto y sin comprobar», y el modelo híbrido se
limita a usar el vocabulario existente donde existe y a exigir atomicidad solo donde el motor se
quedaría ciego. Además evita que una persona con 10 minutos al día reciba `NOTHING_FITS` de forma
sistemática, que es el peor efecto práctico de la opción A. No la marco aceptada: la diferencia
es visible para la persona y es tuya.

**QUÉ NO DECIDE ESTA DECISIÓN**
No decide el origen de los minutos (P4-D2), ni el orden entre `EXPOSED` y `NEW` (P4-D4), ni nada
sobre repaso, retención o readiness.

**QUÉ BLOQUEA**
La aceptación del contrato del Planner y los gates P4-G8 y P4-G20.

**REVERSIBILIDAD**
**MODERADA** — cambia la forma de los ítems planificados, de modo que las ejecuciones históricas
quedarían con una granularidad distinta a la nueva. La historia sigue siendo reproducible porque
cada ejecución guarda su versión de algoritmo, pero el cambio se nota en el producto.

---

### P4-D4

**DECISIÓN EN UNA FRASE**
Dentro de la continuidad, ¿cerrar un bucle de aprendizaje ya abierto (`EXPOSED`) va antes que
abrir uno nuevo (`NEW`)?

**POR QUÉ DEBE SER HUMANA**
P4-D1.3 declara `EXPOSED` accionable pero no le da precedencia, y ninguna otra autoridad ordena
las dos categorías. Ordenar la continuidad «por sílabo» parecería resolverlo sin decidir, y por
eso se dice en voz alta: sería colar la decisión por la puerta de atrás.

**QUÉ EXPERIMENTA LA PERSONA**
Si dejó a medias la comprobación de algo que ya leyó, ¿el producto vuelve a eso primero, o sigue
avanzando por el temario?

**OPCIÓN A · `EXPOSED` primero**
- *Beneficios:* no se acumula material visto sin verificar; cada cosa empezada se cierra; la
  evidencia del motor es más completa antes.
- *Costes:* el avance por el temario es más lento y puede resultar frustrante para quien quiere
  ver el alcance del examen.
- *Casos límite:* con la opción D de P4-D3, la persona alterna aprender y comprobar de forma casi
  continua.

**OPCIÓN B · `NEW` primero**
- *Beneficios:* el temario avanza visiblemente; la persona alcanza antes la vista completa.
- *Costes:* con un sílabo grande, lo visto puede quedar sin comprobar durante mucho tiempo, que
  es justo el bucle abierto que P4-D1.3 reconoce como necesidad legítima.
- *Casos límite:* combinado con la opción D de P4-D3, la persona puede acumular decenas de
  conceptos leídos y sin comprobar.

**OPCIÓN C · orden de sílabo, sin distinguir categoría**
- *Beneficios:* una sola regla; coincide con la opción A siempre que lo visto sea anterior en el
  temario, que es el caso normal.
- *Costes:* cuando algo posterior del temario quedó expuesto —hoy el vertical congelado del FPS
  puede provocarlo— se comporta como la opción B sin haberlo decidido.

**RECOMENDACIÓN ARQUITECTÓNICA**
Opción A.

**POR QUÉ**
El bucle abierto lo abrió el producto, no la persona: presentó material y no lo verificó. Cerrar
primero lo que uno mismo dejó abierto es coherente con P4-D1.3, y mantiene la evidencia del
motor lo más completa posible, que es de lo que depende todo lo demás. La opción C es
indistinguible de la A en el caso normal, pero decide sola en el caso raro, y prefiero que el
caso raro esté decidido a propósito.

**QUÉ NO DECIDE ESTA DECISIÓN**
No decide la garantía de reparación ni su aridad, ni el empaquetado, ni la granularidad (P4-D3).

**QUÉ BLOQUEA**
La aceptación del contrato del Planner y el gate P4-G20.

**REVERSIBILIDAD**
**FÁCIL** — es orden dentro de una categoría y vive en la configuración versionada del Planner.
Las ejecuciones pasadas conservan la versión con la que se tomaron.

---

## 16 · Inanición · análisis con cotas

No basta simular. Cada pregunta se responde con una cota y de dónde sale.

| # | ¿Puede ocurrir? | Veredicto | Cota y origen |
| --- | --- | --- | --- |
| A | ¿La reparación mata de hambre a la cobertura? | **IMPOSIBLE POR INVARIANTE** | la garantía coloca **una** acción de reparación y ninguna otra regla coloca más mientras quede continuidad (§6.3 pasos 4 y 5) |
| B | ¿La cobertura mata de hambre a la reparación? | **IMPOSIBLE POR INVARIANTE** | la reparación va en la cabeza, antes que toda la continuidad (§6.3 paso 3) |
| C | ¿`EXPOSED` mata de hambre a `NEW`? | **ACOTADO** | `EXPOSED` drena: comprobar produce evidencia y el concepto sale del conjunto. La cota es el número de conceptos expuestos, que no crece sin que la persona aprenda. **Depende de P4-D4** |
| D | ¿`NEW` mata de hambre a `EXPOSED`? | **POSIBLE** bajo la opción B de P4-D4 | con un sílabo grande, `NEW` no se agota y lo expuesto espera indefinidamente. Es el coste declarado de esa opción, no un defecto oculto |
| E | ¿Un concepto que falla siempre mata de hambre a otros que fallan? | **IMPOSIBLE POR INVARIANTE**, con §F.5 | actuar produce evidencia nueva que lo manda al final de la cola. Con orden de sílabo o «más reciente primero» **sí ocurre**, y por eso están falsados |
| F | ¿El propio orden de sílabo crea inanición? | **SÍ, si se usa como política completa** | todo concepto con evidencia precede al siguiente `NEW`; por eso las garantías son posicionales (§6.3 paso 6) |
| G | ¿La heterogeneidad de duraciones crea inanición? | **POSIBLE** | una acción sistemáticamente más larga que el presupuesto no entra nunca. No es política: es aritmética. Su severidad depende de **P4-D2** y de **P4-D3** · OBS-4A-01 |
| H | ¿Un presupuesto permanentemente diminuto crea inanición? | **POSIBLE** | idéntico a G. El Planner no puede resolverlo sin fabricar trabajo, y P4-D1.6 lo prohíbe |

Ninguna cota introduce un número de política. Las cotas C y E salen de que el conjunto drena; D,
G y H son consecuencias declaradas, no reglas.

## 17 · Dependencia del camino

Cada hecho histórico que el Planner podría consumir, clasificado:

| Hecho | Clase | ¿Entra en la selección? |
| --- | --- | --- |
| Estado categórico por concepto | **SEMÁNTICO** | sí |
| Posición de flujo de la última evidencia negativa | **SEMÁNTICO** | sí (§F.5) |
| Patrones de error activos | **SEMÁNTICO** | sí |
| Ítems completados en el día de plan | **SEMÁNTICO** | sí, como exclusión |
| Sesión abierta | **SEMÁNTICO** | sí, como puerta |
| Presupuesto y su procedencia | **SEMÁNTICO** | sí |
| Versión de pack y generación de atribución | **SEMÁNTICO** | sí |
| **Ejecuciones anteriores del Planner** | **SOLO AUDITORÍA** | **no** — corregido por IR-P4A-01 |
| Cuántas veces se pidió un plan | **IRRELEVANTE** | no |
| Si un plan se abrió o no | **SOLO AUDITORÍA** | no |
| Agrupación transaccional de los intentos | **IRRELEVANTE** | no |
| Si el estado llegó por recuperación o ya estaba al día | **IRRELEVANTE** | no |

Historias con la misma evidencia final producen el mismo plan, con independencia de cuántas veces
se pidió, de si un plan anterior se abrió, o de cómo se agruparon las escrituras. Esto era **falso
en el candidato v1**, y es la consecuencia más importante de la corrección.

## 18 · Contraejemplos semánticos

Presión de explicabilidad, no diseño de interfaz. La columna «decisión» se lee bajo la
recomendación arquitectónica (P4-D3 = híbrida, P4-D4 = `EXPOSED` primero); donde la decisión
humana cambia el resultado, se dice.

| # | Estado · tiempo · historia | Decisión | Por qué | Propiedad | Consecuencia sorprendente | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Todo `NEW`, 30 min, sin historia | aprender el primero del temario | sin reparación, manda la continuidad | P7 | ninguna | ACEPTABLE |
| 2 | Un concepto fallado, resto `NEW`, 30 min | reparar ese, luego avanzar | garantía de reparación en la cabeza | P6 | el fallo aparece **antes** que el temario | ACEPTABLE |
| 3 | Cinco fallados, resto `NEW`, 60 min | **una** reparación y el resto cobertura | aridad existencial | P7 | «he fallado cinco y solo repaso uno» | ACEPTABLE · es P4-D1.2 |
| 4 | Como 3 pero sin `NEW` ni `EXPOSED` | las cinco reparaciones | no hay continuidad que proteger | P6 | ninguna | ACEPTABLE |
| 5 | Un fallado, se planifica, se cierra la app, se vuelve | **el mismo plan** | una recomendación no es ejecución | P8 · P10 | ninguna · es la corrección de IR-P4A-01 | ACEPTABLE |
| 6 | Como 5, pero sí lo hizo y volvió a fallar | ese concepto pasa al final de la cola de reparación | evidencia nueva | P6 | «lo acabo de fallar y ahora me ofrece otro» | ACEPTABLE · es la vivacidad |
| 7 | Dos fallados; solo falla el primero una y otra vez | se alternan | evidencia más antigua primero | P6 | ninguna | ACEPTABLE |
| 8 | Todo `EVIDENCE_POSITIVE` | `NOTHING_ELIGIBLE` | sin política de repaso no hay autoridad | P5 · P20 | «no tengo nada que hacer», sin decir que esté preparada | ACEPTABLE · OBS-4A-02 |
| 9 | Todo positivo salvo uno retirado | `NOTHING_ELIGIBLE` con exclusión registrada | INV-109 | P20 | ninguna | ACEPTABLE |
| 10 | 5 min; toda acción cuesta más | `NOTHING_FITS` con `OVER_BUDGET` | Master §49 | P9 · P20 | «tengo 5 minutos y no me da nada» | **DECISIÓN HUMANA** · la oferta fuera de presupuesto es de 4B |
| 11 | 0 min declarados | `ZERO_TIME`, cero ítems | REQ-E08 | P20 | ninguna deuda, ningún contador | ACEPTABLE |
| 12 | Presupuesto 12; acciones de 10, 6 y 6 | solo la de 10; 2 min sin usar | no se optimiza | P9 | «sobraban 2 minutos y cabían dos cosas» | ACEPTABLE · §I.5 |
| 13 | Presupuesto 15; acciones de 10, 35 y 4 | la de 10 y la de 4 | se salta lo que no cabe | P9 | ninguna | ACEPTABLE |
| 14 | Sesión abierta y plan nuevo disponible | `RESUME_REQUIRED` | la sesión abierta gana | P12 | ninguna | ACEPTABLE |
| 15 | Motor atrasado y la puesta al día falla | `PLAN_UNAVAILABLE_ENGINE`, sin escribir nada | frontera de consistencia | P14 | «no puedo planificarte ahora» en vez de un plan malo | ACEPTABLE |
| 16 | Evidencia nueva desde otro dispositivo | replanifica en la siguiente petición; la sesión abierta no se toca | desajuste de tupla | P13 | ninguna | ACEPTABLE |
| 17 | Cambia la generación de atribución | replanifica | versión | P13 | un concepto puede desaparecer de los candidatos | ACEPTABLE |
| 18 | Un objetivo del plan se retira antes de arrancar | exclusión `TARGET_UNAVAILABLE` y replan | INV-109 | P13 | ninguna | ACEPTABLE |
| 19 | Un objetivo se retira **dentro** de una sesión abierta | **hoy falla en silencio** | fuera de 4A | — | la persona ve un ítem que no se puede mostrar | **NO ACEPTABLE** · WATCH-4A-1, corresponde a 4B |
| 20 | Leyó una unidad y no la comprobó; hay material nuevo | comprobar lo leído primero | P4-D1.3 | P18 | «¿por qué no avanzo?» | **DECISIÓN HUMANA** · P4-D4 |
| 21 | 6 min; unidad de 5 más comprobación de 3 | aprender ahora, comprobar después | el motor representa `EXPOSED` | P18 | queda algo a medias, dicho con honestidad | **DECISIÓN HUMANA** · P4-D3 |
| 22 | Dos pestañas piden plan a la vez | una sola ejecución; la segunda reutiliza | idempotencia por hash | P11 | ninguna | ACEPTABLE |
| 23 | Responde mientras se calcula el plan | la escritura se rechaza y se recalcula | revalidación en transacción | P11 · P14 | una espera mínima | ACEPTABLE |
| 24 | Baja la disponibilidad de 60 a 20 a mitad de sesión | la sesión abierta no se reescribe; la próxima ejecución usa 20 | INV-106 | P12 | ninguna | ACEPTABLE |

## 19 · Red team de explicabilidad

Para cada razón, la explicación interna veraz que la auditoría debe poder reconstruir:

| Razón | Explicación interna |
| --- | --- |
| `REMEDIATION_GUARANTEE` | «se eligió porque hay evidencia de que esta persona falló este concepto, y es la evidencia negativa **más antigua** sin atender; el plan debe responder a la reparación» |
| `COVERAGE` | «se eligió porque no hay evidencia sobre este concepto, o hay exposición sin comprobar, y es el siguiente según el orden del temario» |
| `REMEDIATION_OVERFLOW` | «se eligió porque ya no quedaba continuidad elegible que colocar» |
| `POSITIVE_NO_REVIEW_POLICY` | «no se eligió porque hay evidencia positiva y este sistema **no tiene autoridad** para decidir cuándo repasarlo. No significa que esté dominado» |
| `OVER_BUDGET` | «no se eligió porque su duración declarada no cabía en los minutos de hoy» |
| `COMPLETED_TODAY` | «no se eligió porque ya se trabajó hoy» |
| `TARGET_RETIRED` · `NO_ATTRIBUTED_QUESTION` | «no se eligió porque el contenido ya no está publicado, o no tiene pregunta atribuida válida» |
| `NOTHING_ELIGIBLE` | «no hay ninguna acción **justificada por el modelo autorizado**. No es preparación, ni dominio, ni fin del aprendizaje» |

«Por qué esta duración» se responde con el valor declarado y su procedencia, nunca con una
estimación sobre la persona. «Por qué esto no es readiness» se responde solo: no hay agregación
entre conceptos, ni porcentaje, ni recuento.

**Suficiencia de la auditoría.** Las ocho explicaciones se reconstruyen desde la instantánea
(§R, §S del contrato) sin consultar estado actual, **con una condición nueva**: la instantánea
debe guardar la posición de flujo que ordenó la reparación. Sin ella, «la más antigua sin
atender» no sería verificable después. Queda como requisito de contrato.

## 20 · Ataque a la configuración

| Valor propuesto | Veredicto |
| --- | --- |
| `repair_slots = 1` | **RECHAZADO** · convierte una aridad derivada en cuota configurable; mañana valdría 3 |
| `coverage_ratio` | **RECHAZADO** · P4-D1.7 |
| `max_consecutive_repairs` | **RECHAZADO** · constante de alternancia |
| `new_vs_exposed_weight` | **RECHAZADO** · P4-D4 es categórica, no un peso |
| `review_after_days` | **RECHAZADO** · inventa política de repaso; DEF-28 |
| `default_question_minutes` | **RECHAZADO en 4A** · P4-D2 sigue diferida |
| `weakness_threshold` | **RECHAZADO** · umbral sobre recuentos de evidencia |
| `rescue_threshold` | **RECHAZADO** · H-P4-5 no define «materialmente por debajo» |
| `planner_version` | **LEGÍTIMO** · identidad de algoritmo |
| `planner_config_version` | **LEGÍTIMO** · identidad de configuración |
| enum cerrado de códigos de razón | **LEGÍTIMO** · vocabulario, no política numérica |
| orden categórico de P4-D4, una vez decidido | **LEGÍTIMO** · categórico y humano |

**Razonamiento de la lista.** Es legítimo lo que expresa **identidad** o una **elección categórica
ya tomada por una persona**. Es ilegítimo todo lo que introduzca una **cantidad** que module el
aprendizaje, aunque esté versionada y auditada. Una configuración no se vuelve legítima por ser
auditable: se vuelve auditable, que es otra cosa.

## 21 · Matriz de aceptación en runtime real · para el futuro BUILD

La lección de D-26, convertida en exigencia por capacidad. **Ninguna se ejecuta ahora.**

| Capacidad | Modelo puro | Integración BD | RLS | Módulo real de servidor | Frontera PostgREST/RPC real | E2E STAGING |
| --- | --- | --- | --- | --- | --- | --- |
| Decisión y composición | **obligatorio** | — | — | obligatorio | — | — |
| Persistencia de la ejecución | — | **obligatorio** | obligatorio | **obligatorio** | **obligatorio** | — |
| Puesta al día bloqueante del motor | — | obligatorio | — | **obligatorio** | **obligatorio** | **obligatorio** |
| Arranque de sesión planificada | — | obligatorio | obligatorio | **obligatorio** | **obligatorio** | **obligatorio** |
| Reproducción desde instantánea | **obligatorio** | obligatorio | — | obligatorio | — | — |
| Una sola sesión abierta | — | **obligatorio** | — | — | obligatorio | **obligatorio** |
| Aislamiento entre personas | — | obligatorio | **obligatorio** | — | **obligatorio** | — |
| Honestidad de la frontera de eventos | — | obligatorio | — | obligatorio | **obligatorio** | — |

**Ningún gate pasa porque un arnés SQL equivalente funcione, si el camino de producción usa otra
frontera.** Es exactamente lo que ocurrió con P3-G7.

## 22 · Corpus sintético adversarial · diseño, no ingestión

`GENERATED` únicamente. **No se ingiere en STAGING en esta ronda.**

Forma propuesta: 3 bloques · 8 temas · 40 conceptos · de 1 a 3 preguntas por concepto donde
aporte · duraciones de fixture deterministas y heterogéneas, incluida alguna acción más larga que
los presupuestos pequeños · conceptos retirados · conceptos sin atribución válida · conceptos
excluidos por estado de fuente · mapeos PRIMARY completos e incompletos · casos con patrón de
error activo · y estados de motor mezclados, incluidos `EXPOSED` posteriores en el temario para
ejercitar el caso raro de P4-D4.

Sirve para validación **estructural** del Planner. No simula el corpus oficial ni pretende
parecerse a él.

---

## 23 · Gate A · cierre de gobernanza · 2026-09-18

### 23.1 · P4-D3 · `ACCEPTED` · granularidad híbrida

`NEW` → `APRENDER` puede planificarse de forma independiente; tras su ejecución veraz el concepto
pasa a `EXPOSED`, que es la representación autoritativa ya existente de «material visto y sin
verificar». `EXPOSED` → `COMPROBAR`.

La reparación —`EVIDENCE_NEGATIVE`, `EVIDENCE_CONFLICTING`, patrón de error estructural activo—
mantiene `REAPRENDER + COMPROBAR` como **acción atómica**, porque `REAPRENDER` solo no produce
evidencia autoritativa y no hay estado aceptado que distinga «se reaprendió y falta verificar» de
«no ha pasado nada». **Ese estado no se inventa en Phase 4A.**

No autoriza retención, programación de repasos, dominio, readiness ni semántica nueva de estado.

### 23.2 · P4-D4 · `ACCEPTED` · `EXPOSED` primero

Dentro de la continuidad, `EXPOSED` precede a `NEW`. Precedencia **categórica**, sin puntuación,
peso, ratio, cuota, porcentaje ni máximo. Agotados los `EXPOSED` —o cuando no quepan— se
seleccionan `NEW` con las reglas ya aceptadas.

Medido, no supuesto: el atraso de verificación queda acotado por lo que cabe en **un** presupuesto
y **no crece con el temario ni con el número de sesiones** (100 conceptos, 300 sesiones).

### 23.3 · Prueba residual B · **CERRADA**

`skip-non-fitting` es **única** bajo cuatro criterios con autoridad: preservar la prioridad
semántica, no exceder el presupuesto, no inventar objetivo de optimización, y no permitir que un
candidato sobredimensionado suprima a otros posteriores que sí caben.

| Política | Veredicto |
| --- | --- |
| `prefix-stop` | rechazada · deja que la duración de un candidato decida sobre otro |
| **`skip-non-fitting` / `first-fit` sobre la prioridad** | **única superviviente** |
| `best-fit` | rechazada · objetivo de optimización |
| maximizar minutos · maximizar acciones · mochila | rechazadas · objetivo de optimización |
| reordenar por duración · más corta primero · más larga primero | rechazadas · destruyen la prioridad |

Comprobada contra una definición independiente en todo el rango de presupuestos 0–60.

### 23.4 · Prueba residual A · **NO CIERRA**

La ronda anterior falsó dos rivales y llamó «derivado» al superviviente. Ampliada la familia a
todo lo formulable sin inventar ciencia del aprendizaje y sin usar el historial del Planner como
señal, el resultado cambia: la vivacidad **elimina cinco** políticas y deja **dos**.

Falsadas por inanición —con ejecución real, una de dos necesidades no se atiende nunca—: clave de
sílabo, sílabo inverso, identidad estable, evidencia más reciente primero, y **primera negativa
sin resolver** (un fallo nuevo no mueve su clave, así que el mismo concepto se queda la ranura).

Excluidas por autoridad, no por rendimiento: menos-recientemente-servido y turno rotatorio
(usarían el historial del Planner como señal, prohibido); por número de intentos y por número de
errores (recuento derivado del vector de evidencia, contrato del motor §10, y dominio numérico por
proxy); aleatoria sembrada (P4-D1.7, y la semilla es un parámetro oculto).

**Sobreviven dos, no equivalentes:**

| Política | Qué hace cuando alguien abre una reparación, la lee y se va sin comprobar |
| --- | --- |
| **última negativa · más antigua primero** | la evidencia no se ha movido: **insiste** con el mismo concepto |
| **último contacto real · más antiguo primero** | el contacto es reciente: **cede el turno** al siguiente |

Las dos son deterministas, independientes del camino, sin cantidad oculta, reproducibles,
explicables, y ninguna viola P4-D1. La divergencia es **alcanzable**: abandonar tras leer la
produce, y con granularidad híbrida más reparación atómica ese estado existe de verdad.

Por tanto **Gate A no pasa** y la decisión vuelve como **P4-D5**.

### 23.5 · Gate A · veredicto

**FAIL**, por la prueba residual A. Todo lo demás está en su sitio: P4-D3 y P4-D4 registradas,
prueba residual B cerrada, modelo formal en verde, simulación en verde, pruebas de gobernanza en
verde, candidato coherente. **Gate B no se abre y no se construye nada.**

---

## 24 · P4-D5 · decisión humana

**DECISIÓN EN UNA FRASE**
Cuando varias reparaciones compiten, ¿las ordena la **última evidencia negativa** de cada
concepto, o el **último contacto real** de la persona con él?

**POR QUÉ DEBE SER HUMANA**
Cinco políticas mueren por inanición y tres están excluidas por autoridad. Las dos que quedan
pasan todos los filtros mecánicos y describen dos conductas de producto distintas. Elegir una por
mi cuenta sería repetir exactamente el error que la revisión independiente ya detectó una vez.

**QUÉ EXPERIMENTA LA PERSONA**
Ha fallado dos conceptos. Abre el primero, lo lee, y se va sin llegar a la comprobación. Mañana:
¿el sistema le vuelve a poner ese mismo concepto, o le ofrece el otro?

**OPCIÓN A · última evidencia negativa**
La clave es la posición de la última negativa. Leer sin comprobar no la mueve.
- *Beneficios:* insiste en lo empezado hasta que haya verificación real; ninguna acción de la
  persona que no produzca evidencia altera la prioridad; es la lectura más estricta de «solo la
  evidencia cuenta».
- *Costes:* quien abandona repetidamente ve el mismo concepto una y otra vez, y puede vivirlo como
  insistencia; las demás reparaciones esperan mientras tanto.
- *Casos límite:* abandonar siempre tras leer congela la cola de reparación en un solo concepto.
- *Consecuencias futuras:* encaja con cualquier política de repaso futura, que también se definirá
  sobre evidencia.

**OPCIÓN B · último contacto real**
La clave es la posición del último contacto —exposición o intento— con el concepto.
- *Beneficios:* no repite de inmediato lo que acaba de mostrar; reparte la atención entre las
  reparaciones pendientes aunque la persona abandone; se siente menos machacón.
- *Costes:* una lectura sin comprobación **desplaza** una necesidad que sigue viva, y eso se
  parece incómodamente a dejar que la presentación cuente como progreso — el mismo error que
  IR-P4A-01 corrigió, aunque aquí solo afecte al orden y no a la existencia de la necesidad.
- *Casos límite:* quien abandona siempre rota por todas sus reparaciones sin cerrar ninguna.
- *Consecuencias futuras:* introduce la exposición como señal de ordenación, lo que habrá que
  reconciliar cuando exista política de repaso.

**RECOMENDACIÓN ARQUITECTÓNICA**
Opción A.

**POR QUÉ**
Porque la necesidad la crea la evidencia y debería ordenarla la misma clase de hecho. Bajo la
opción B, mostrar algo sin verificarlo baja su prioridad, y eso es una versión atenuada de tratar
la presentación como progreso — que es justo lo que esta fase acaba de corregir. La insistencia de
la opción A es incómoda, pero es honesta: la necesidad sigue abierta porque nadie la ha cerrado.
Si esa insistencia resulta ser un problema de producto, el sitio para resolverlo es la experiencia
en 4B, no la clave de orden del motor de decisión.

**QUÉ NO DECIDE ESTA DECISIÓN**
No decide la garantía de reparación ni su aridad, ni la granularidad (ya cerrada por P4-D3), ni el
orden de la continuidad (ya cerrado por P4-D4), ni el empaquetado, ni nada sobre repaso, retención
o readiness.

**QUÉ BLOQUEA**
La aceptación del contrato del Planner y, con ella, la Build Authorization de Phase 4A.

**REVERSIBILIDAD**
**FÁCIL** — es una clave de orden dentro de una categoría y vive en la configuración versionada.
Las ejecuciones pasadas conservan la versión con la que se tomaron. El único coste de cambiarla
después es que la instantánea debe guardar **las dos** posiciones para que la historia siga siendo
verificable; el contrato ya exige guardar la que ordena.
