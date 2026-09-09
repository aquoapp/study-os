# STUDY OS · Contrato de pantalla del First Product Slice · v1

**Estado:** `ACCEPTED` · 2026-09-09 · FPS Build Authorization (H-FPS-B, dirección aprobada) ·
derivado, no inventado.
**Alcance:** las cinco superficies del FPS: **HOY · APRENDER · COMPROBAR · FEEDBACK · FIN**.
**Naturaleza:** contrato autoritativo **de FPS v1**. No congela el diseño visual futuro de
STUDY OS. Los hallazgos de UX del recorrido manual de Ana se clasifican en la aceptación; no
se ocultan ni se incorporan a posteriori sin registro.

---

## 0. De dónde sale este contrato

No hay ningún artefacto de pantalla en el repositorio: ni Hi-Fi, ni Screen Design Spec, ni
biblioteca de componentes. Este contrato se **deriva** de lo que sí es autoridad:

| Fuente | Qué aporta |
| --- | --- |
| `spec/requirement-index.md` §F | REQ-F01 … REQ-F15 y su criterio de aceptación |
| `spec/invariant-register.md` | INV-101, INV-102, INV-103, INV-104, INV-107, INV-111, EC-012, EC-015, EC-017 |
| `spec/terminology.md` §3 | léxico prohibido y las cuatro frases canónicas de Edge States |
| `spec/contradiction-register.md` C-06 · SD-010 | correcciones aceptadas sobre HOY y FIN |
| `packages/design-system` | espaciado, radios, tipografía, color, movimiento, 44 px, contraste |
| `docs/PHASE_2_CHECKPOINT.md` | qué evidencia existe realmente y qué puede afirmarse |
| Master §6, §10, §17, §21, §22, §35, §37 | jerarquía, corrección en servidor, orden del feedback, sin economía de celebración |

Dirección visual: **CALM INTELLIGENCE**. Sin gamificación, sin mascota, sin confeti, sin
trofeos, sin panel de mando, sin inteligencia fingida.

---

## 1. Reglas transversales

### 1.1 Una sola acción dominante (INV-104)

Cada pantalla tiene **exactamente un** botón primario visible. Las demás acciones son
secundarias, textuales y visiblemente subordinadas. Nunca hay dos primarios a la vez.

### 1.2 Verdad (EC-012)

La interfaz no afirma lo que no existe. En FPS **no existen** planificador, motor de
aprendizaje, dominio, preparación, proyecciones, puntuación ni simulación. Ninguna pantalla
los nombra, los insinúa ni los promete. Cuando algo es provisional, se dice.

### 1.3 Léxico (INV-107)

**Prohibido:** «sesión fallida», «has fallado», «atrasado», «vencido», «racha», «perdiste»,
«recupera lo perdido», «deberías haber», «nivel bajo», «abandonada».
**Canónico y preferente:** «Te quedaste aquí», «Retomamos desde aquí».

### 1.4 Sin internos visibles

Nunca se muestran identificadores UUID, JSON, nombres de tabla, de esquema, de evento o de
migración, ni el mensaje literal de un error de proveedor o de base de datos. Las rutas usan
el **ordinal** del ítem dentro de la sesión, nunca su identificador.

### 1.5 Accesibilidad (REQ-F15, Master §35)

Contraste mínimo 4.5:1 para texto normal y 3:1 para controles y foco. Objetivo interactivo
mínimo **44 × 44 px**. Foco visible siempre. Todo control accesible por teclado y con nombre
accesible. Estados anunciados con `aria-live` cuando cambian sin navegación. Se respeta
`prefers-reduced-motion`: sin animación, solo cambio de estado.

### 1.6 Color bajo SD-019 opción A

`teal` y `amber` **no** llevan texto normal encima: son fondos no textuales. `slate` solo
sobre `surface`. Los pares de rol son los de `SEMANTIC_ROLES`: `navy`/`onDark` para acento,
`forest`/`onDark` para acierto, `brick`/`onDark` para fallo.

**El color nunca es el único portador de significado.** Acierto y fallo se distinguen además
por texto explícito y por un icono de forma distinta.

### 1.7 Retícula

Móvil de referencia 390 px, 4 columnas, margen 16 a 20 px. Escritorio: columna de lectura
centrada, máximo **68 caracteres** de medida (REQ-F04), cuerpo 16 a 18 px, interlineado de
lectura 1.65. Nunca hay desbordamiento horizontal en ninguna anchura.

### 1.8 Navegación

FPS **no monta** la navegación de los cinco espacios primarios. Es un vertical. Cada pantalla
ofrece su propia continuación. Esto satisface REQ-F13 de forma trivial: no hay barra que
compita durante APRENDER ni COMPROBAR.

---

## 2. HOY · `/hoy`

### Propósito

Decir al aprendiz qué hacer ahora, y solo eso.

### Jerarquía de información

1. **Tarjeta de sesión**, elemento dominante y primer elemento enfocable del contenido.
2. Dentro de ella: qué es la sesión, **por qué es esta** (razón provisional), y qué contiene
   (recuento de unidades y preguntas).
3. Acción primaria.
4. Nada más. HOY no es un panel de mando (REQ-F02, Master §37).

### Acción primaria

| Estado | Etiqueta | Efecto |
| --- | --- | --- |
| sin sesión abierta | **Empezar la sesión** | crea una sesión `FPS_FIXED` y va al primer ítem |
| sesión `PLANNED` | **Empezar la sesión** | emite `SESSION_STARTED` y va al primer ítem |
| sesión `ACTIVE` o `INTERRUPTED` | **Retomamos desde aquí** | reanuda en el punto exacto |

Una sesión abierta **siempre gana**: nunca se ofrece crear otra mientras exista.

### Acciones secundarias

Ninguna en FPS v1. No hay ajustes, ni historial, ni «ver plan».

### Estados

| Estado | Qué se muestra |
| --- | --- |
| sin objetivo activo | «Todavía no has elegido qué examen preparas.» + acción secundaria a `/onboarding` |
| sin contenido publicado | «Todavía no hay contenido disponible para este examen.» Sin acción primaria |
| sin sesión abierta | tarjeta de sesión nueva con su previsualización |
| sesión abierta | tarjeta de continuación, con «Te quedaste aquí» y el nombre del paso |
| creando la sesión | botón en estado ocupado, deshabilitado, texto «Preparando la sesión…» |
| error recuperable | «No hemos podido preparar la sesión. Vuelve a intentarlo.» + reintentar |

### Copy exacto

- Título: **Hoy**
- Razón provisional, literal y obligatoria:
  > **Sesión fija.** Esta selección es la misma para todo el mundo y no está personalizada:
  > la planificación adaptativa llega más adelante.
- Previsualización: «N unidades para leer · M preguntas para comprobar».
- Continuación: «Te quedaste aquí» seguido del nombre del paso.

### Interrupción y reanudación

HOY es el punto de entrada de la reanudación. Deriva el paso del **cursor del servidor**, con
la única corrección de que una **corrección pendiente** tiene prioridad sobre el cursor
(véase §5.6).

### Prohibido

Panel de módulos, anillo de «nivel global», tarjeta motivacional, trofeo, icono de robot o
mascota, acceso «Resúmenes», porcentaje proyectado de ningún tipo, recomendación adaptativa,
mención de dominio o de preparación. (C-06 b, c, d, e, f, g.)

### Móvil y escritorio

Idéntico contenido. En móvil la tarjeta ocupa el ancho útil; en escritorio se centra con
ancho máximo de lectura. La acción primaria es visible sin desplazamiento en ambos.

---

## 3. APRENDER · `/aprender/[ordinal]`

### Propósito

Presentar una unidad de aprendizaje sintética para leerla.

### Jerarquía

1. Progreso textual discreto: «Paso 2 de 7».
2. Título de la unidad.
3. Cuerpo, en columna de lectura.
4. Acción primaria al final.

### Acción primaria

**Continuar** → emite `LEARNING_UNIT_COMPLETED` y avanza al siguiente ítem.

### Acciones secundarias

**Dejarlo por ahora** → emite `SESSION_INTERRUPTED` y vuelve a `/hoy`. Es la única salida
declarada, y existe para que interrumpir sea un acto normal y sin culpa.

### Estados

| Estado | Qué se muestra |
| --- | --- |
| cargando | esqueleto de lectura, sin texto que prometa nada |
| leyendo | título y cuerpo de la versión **vinculada** |
| enviando | acción primaria ocupada |
| error recuperable | «No hemos podido guardar tu avance. Vuelve a intentarlo.» |

### Copy

Título de sección: el de la unidad. Progreso: «Paso N de M». Sin copy motivacional.

### Interrupción y reanudación

Al presentar por primera vez se emite `LEARNING_UNIT_VIEWED` con la versión exacta, que queda
**vinculada** en el ítem. A partir de ahí siempre se muestra la versión vinculada, nunca «la
vigente ahora». Volver más tarde muestra exactamente el mismo texto.

### Prohibido

«No entiendo nada» y «Esto ya me lo sé»: sus capacidades no existen (REQ-F05, REQ-F06
diferidos). No se ofrece un botón que prometa un comportamiento inexistente. Sin IA en
ejecución. Sin afirmación de dominio.

### Móvil y escritorio

Medida de lectura 45 a 68 caracteres en ambos. En móvil el cuerpo ocupa el ancho útil menos
los márgenes; en escritorio se limita la medida, no se ensancha el texto.

---

## 4. COMPROBAR · `/comprobar/[ordinal]`

Una sola ruta con **dos estados**: *responder* y *corrección*. La corrección no es otra ruta.

### 4.1 Estado «responder»

#### Propósito

Presentar la pregunta exacta y recoger respuesta y confianza, sin filtrar la clave.

#### Jerarquía

1. Progreso: «Paso 4 de 7».
2. Enunciado.
3. Opciones.
4. Confianza.
5. Acción primaria.

#### Acción primaria

**Comprobar** → emite `ANSWER_SUBMITTED` y pasa al estado de corrección.
Está **deshabilitada** hasta que exista confianza registrada (INV-102: la confianza precede al
feedback). No exige haber elegido opción: dejarlo en blanco es una respuesta legítima.

#### Acciones secundarias

**Dejarlo por ahora** → `SESSION_INTERRUPTED` y vuelta a `/hoy`.

#### Opciones (INV-103)

La opción elegida se ve, con **énfasis neutral**: cambio de fondo a `surface` con borde
`navy` de 2 px y `aria-checked="true"`. Ningún token, icono, texto ni atributo de correcto o
incorrecto. El orden no cambia nunca. Cada opción es un objetivo de 44 px como mínimo. Grupo
con `role="radiogroup"` y navegación por flechas.

Elegir emite `ANSWER_SELECTED`, que es autoguardado real: al volver, la elección sigue ahí.

#### Confianza (SD-008, INV-102)

Cuatro niveles leídos **de la tabla gobernada** `confidence_scales`, versión `v1`. Las
etiquetas no se escriben a mano en el código como autoridad; se leen. Hoy son:

| Valor | Etiqueta |
| --- | --- |
| 1 | Nada segura |
| 2 | Dudosa |
| 3 | Bastante |
| 4 | Segura |

Pregunta: «¿Cómo de segura estás?». Elegir emite `CONFIDENCE_RECORDED`, y el valor se repite
en el envío para que el intento lleve su propia calibración.

#### Estados

| Estado | Qué se muestra |
| --- | --- |
| cargando | esqueleto de pregunta |
| respondiendo | enunciado, opciones, confianza |
| sin confianza | acción primaria deshabilitada con ayuda: «Elige cómo de segura estás para comprobar.» |
| enviando | acción primaria ocupada, opciones bloqueadas |
| error recuperable | «No hemos podido comprobar tu respuesta. Vuelve a intentarlo.» y el mismo botón reintenta **con la misma identidad de envío** |

#### Prohibido

Cualquier señal de corrección antes del envío: color de acierto, icono, texto, atributo,
reordenación, número de opción correcta, o cualquier dato del que se infiera. Temporizador.
Penalización por dejarlo en blanco.

### 4.2 Estado «corrección» (FEEDBACK)

#### Propósito

Decir la verdad sobre lo que acaba de ocurrir, y enseñar.

#### Jerarquía, en este orden

1. **Resultado**: «Correcto», «Incorrecto» o «Sin responder», con icono de forma distinta y
   color de rol, nunca solo color.
2. **Tu respuesta**: la opción elegida, o «No respondiste».
3. **Respuesta correcta**: la opción correcta, siempre, también cuando se acertó.
4. **Por qué**: la explicación.
5. **Tu confianza**: la etiqueta elegida, con una frase de calibración **descriptiva**, nunca
   evaluativa.
6. **Procedencia**: la referencia de la unidad o fuente sintética, discreta.
7. **Acción primaria**.

Esto es REQ-F10 **parcialmente satisfecho**: cinco de los siete bloques. No se fabrica el
análisis del distractor, que no tiene modelo de datos, ni la ayuda del Tutor, que no existe.

#### Acción primaria

**Siguiente** → emite `FEEDBACK_VIEWED` y avanza. En el último ítem la etiqueta es
**Terminar la sesión**.

#### Copy de calibración

Descriptiva, sin juicio:

| Situación | Frase |
| --- | --- |
| acierto con confianza alta | «Acertaste y estabas segura.» |
| acierto con confianza baja | «Acertaste, aunque no lo tenías claro.» |
| fallo con confianza alta | «Esta la dabas por segura. Merece una segunda lectura.» |
| fallo con confianza baja | «No lo tenías claro, y aquí está la explicación.» |
| en blanco | «No respondiste. Esta es la respuesta y el porqué.» |

#### Prohibido

Consultar la clave por separado. Mostrar el identificador de la versión de clave. Mostrar
puntuación, acumulado, racha o economía. Reprochar el fallo.

### 4.3 Móvil y escritorio

En móvil las opciones son bloques a ancho completo con separación de 12 px. En escritorio se
mantiene la columna de lectura; las opciones no se reparten en varias columnas, porque la
comparación en fila induce error.

---

## 5. FIN · `/fin`

### Propósito

Cerrar la sesión con consecuencia, no con celebración (REQ-F12, Master §22, EC-017).

### Jerarquía

1. Título: **Sesión terminada**.
2. Resumen de evidencia real.
3. Frase de cierre honesta.
4. Acción primaria.

### Resumen de evidencia

Solo hechos derivados de la evidencia del propio aprendiz:

- unidades leídas;
- preguntas respondidas;
- aciertos;
- fallos;
- sin responder, si hubo alguna;
- tiempo de la sesión.

Cifras exactas de **hechos contados**, nunca porcentajes proyectados (INV-111).

### Frase de cierre

> Esto es lo que hiciste hoy. Todavía no hay un plan que decida lo siguiente: la planificación
> llega más adelante.

### Acción primaria

**Volver a Hoy**.

### Estados

| Estado | Qué se muestra |
| --- | --- |
| terminando | acción ocupada |
| terminada | resumen |
| sesión ya terminada al llegar | el mismo resumen, sin reanudar nada |

### Prohibido

Confeti, trofeo, medalla, insignia, XP, monedas, racha, puntuación, nivel, dominio,
preparación, «próximo repaso», «errores reparados», recomendación, proyección o cualquier
promesa de lo que vendrá mañana. Es la corrección C-06 a aplicada al alcance que FPS puede
sostener con verdad: la parte del sustituto que depende del programador de repasos queda
diferida con él.

---

## 6. Estados de carga, error y vacío

Solo los que FPS necesita de verdad. **No se declara REQ-F14** ni se inventan los siete
estados vacíos canónicos.

| Situación | Copy |
| --- | --- |
| verificando identidad | esqueleto, sin texto |
| sin objetivo activo | «Todavía no has elegido qué examen preparas.» |
| sin contenido publicado | «Todavía no hay contenido disponible para este examen.» |
| sin ítems en la sesión | «Esta sesión no tiene contenido.» + volver a Hoy |
| creando la sesión | «Preparando la sesión…» |
| cargando contenido | esqueleto |
| enviando evidencia | control ocupado |
| fallo de red recuperable | «No hemos podido guardar esto. Vuelve a intentarlo.» + reintentar |
| estado de producto irrecuperable | «Algo no ha ido bien. Vuelve a Hoy y retómalo.» + volver a Hoy |
| sesión terminada | «Esta sesión ya está terminada.» + volver a Hoy |

Ninguno culpa al aprendiz. Ninguno promete persistencia o sincronización que no haya ocurrido
(EC-012). Ninguno muestra el texto original del error.

---

## 7. Capa de componentes mínima

Solo lo que este contrato necesita:

| Componente | Uso |
| --- | --- |
| `PageShell` | fondo `canvas`, columna de lectura, saltos y región principal |
| `PrimaryButton` | la única acción dominante, 44 px, `navy`/`onDark`, estado ocupado |
| `TextAction` | acción secundaria textual, subrayada, sin peso de botón |
| `SessionCard` | tarjeta de HOY, radio `hero`, superficie `surface` |
| `ContentSurface` | superficie de lectura para APRENDER y para el enunciado |
| `AnswerOption` | opción de respuesta, `role="radio"`, énfasis neutral |
| `ConfidenceSelector` | cuatro niveles leídos de la escala gobernada |
| `FeedbackPanel` | resultado, respuesta, correcta, porqué, calibración, procedencia |
| `EvidenceSummary` | lista de recuentos de FIN |
| `StatusNote` | carga, vacío y error, con `aria-live` |

No se construye la biblioteca de Phase 5. Cualquier componente que este contrato no necesite
no se escribe.

---

## 8. Qué NO gobierna este contrato

- El diseño visual definitivo de STUDY OS.
- Las 18 familias de componentes de Design System §16.
- Los cinco espacios primarios como navegación.
- Las pantallas de ENTRENAR, PROGRESO y PLAN.
- La incorporación de Onboarding & Edge States v1.0, que sigue siendo trabajo de Phase 5.

Los hallazgos de UX del recorrido manual de Ana se registran en la aceptación de FPS y se
clasifican allí: defecto de implementación, decisión de producto nueva, o trabajo de Phase 5.
