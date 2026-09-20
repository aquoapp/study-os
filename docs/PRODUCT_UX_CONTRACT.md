# STUDY OS · Product UX Contract · v1.0

**ESTADO:** `ACCEPTED` · 2026-09-20 · **PRODUCT UX · WAVE 3 · HUMAN ACCEPTANCE: APPROVED**
**DECISORA:** Ana Victoria, tras revisión independiente de las Waves 1–2 (Revisión 1), del pack
B+ · Living Intelligence y del System Identity Lab **sobre los artboards renderizados**, no solo
sobre la justificación escrita.
**ALCANCE:** la experiencia de aprendiz del vertical integrado con el Planner. Es autoridad de
producto y de sistema visual; **no autoriza ninguna implementación**.
**PROPIETARIO NORMATIVO:** este documento para la experiencia; `docs/PLANNER_CONTRACT.md` y
`docs/LEARNING_ENGINE_CONTRACT.md` para el dominio, que este contrato **nunca** contradice.
**AUTORIDAD DE ORIGEN:** Master §1.1, §4, §6, §7, §8, §9, §10, §12, §17, §22, §35, §37, §49 ·
Engineering Constitution EC-003, EC-004, EC-012, EC-014, EC-015, EC-017, EC-019 · Design System
v1.0 §1–§17 · Onboarding & Edge States v1.0 · CDEM §3, §9, §17 · INV-101…INV-116 · SD-008 ·
SD-010 · SD-019 opción C · Planner Contract v1.4 más el anexo de Phase 4B.

Si algo aquí contradice una especificación gobernante, **gana la especificación** y la
contradicción se reporta.

**Relación con el contrato de pantalla del FPS.** `docs/FPS_SCREEN_CONTRACT.md` sigue siendo
autoridad **de FPS v1** y su §8 ya decía que no congela el diseño visual futuro. Desde este
contrato, la superficie visible del aprendiz la gobierna este documento; el del FPS queda como
autoridad histórica del vertical congelado.

---

## A · Estrella polar

> **La interfaz es un instrumento, no un panel de mando.** Muestra una decisión, dice por qué, y
> se aparta. Su inteligencia se percibe en la **coherencia** de lo que muestra, nunca en un
> adorno que la anuncie.

Tres reglas operativas:

1. **Una sola superficie dominante por pantalla.** La planitud del FPS (FPS-OBS-01) venía de lo
   contrario: cada grupo en su caja con borde, y por tanto nada dominante.
2. **El color transporta resultado, nunca valor.** Los tres tipos de trabajo que el sistema puede
   proponer son pares. Nada los ordena, los tiñe ni los puntúa.
3. **El vacío veraz se ve como producto, no como fallo.** Los estados vacíos se dibujan en la
   misma superficie, la misma posición y la misma escala tipográfica que un plan lleno.

### A.1 · Principio normativo de visibilidad del sistema

> **Cuando el aprendiz estudia, STUDY OS se retira.**
> **Cuando STUDY OS decide o adapta, STUDY OS se hace perceptible.**

Aprobado como parte de la autoridad del sistema visual. El objetivo **no** es que STUDY OS
parezca permanentemente tecnológico: es que el sistema subyacente sea perceptible exactamente
cuando esa percepción es **veraz y útil**.

## B · Modelo mental del aprendiz

> «Decide qué debo estudiar ahora, se mantiene al día con lo que de verdad demuestro, y cabe en
> el tiempo que tengo.»

| | |
| --- | --- |
| **Qué es HOY** | la decisión de hoy: qué hacer ahora, por qué y cuánto dura. Expira con el día; no es una página que acumula |
| **Qué es una acción** | una pieza completa de trabajo con un propósito: *leer algo nuevo*, *comprobar algo visto*, *repasar algo y comprobarlo*. Tiene duración y cabe hoy o no cabe. Nunca es media cosa |
| **Qué es adaptarse** | «se ha dado cuenta de lo que hice y lo siguiente ha cambiado». Se percibe porque **la siguiente acción es distinta**, no porque un mensaje anuncie la adaptación |
| **Qué es persistente** | el objetivo; la disponibilidad habitual; todo lo demostrado; que el trabajo sin terminar vuelve; la zona horaria |
| **Qué es efímero** | el tiempo de hoy; el plan de hoy; la sesión en curso |
| **Evidencia** | *responder es lo único que demuestra algo.* Leer importa y se recuerda, pero por sí solo no demuestra nada |
| **Confianza** | no es una nota y nunca cambia si la respuesta es correcta. Existe para que acertar con dudas y fallar con seguridad no se traten igual |
| **Tiempo** | capacidad, no objetivo. Se puede bajar sin consecuencia. **Cero es una respuesta completa** |
| **Interrupción** | normal. Lo completado cuenta; lo que no, vuelve al plan. Sin penalización y sin registro de haber parado |
| **Verificación** | la diferencia entre *visto* y *comprobado*. Es la distinción más importante del producto y se enseña de forma implícita, cerrando siempre los bucles que el sistema abrió |

### B.1 · Nunca son concepto de cara al aprendiz

`PlannerRun`, identificador de ejecución, sucesora, supersesión, hash de entrada, reutilización,
consumo, nombres de estado del motor (`NEW`, `EXPOSED`, `EVIDENCE_POSITIVE`, `EVIDENCE_NEGATIVE`,
`EVIDENCE_CONFLICTING`), etiquetas de incertidumbre, watermarks, generaciones, versiones de motor,
de configuración o de Planner, códigos de razón de composición, razones de exclusión, procedencia
de duración, nombres de evento, posiciones de stream, identificadores de representación o de
versión, recuentos de intentos, porcentajes, dominio, preparación, `ABANDONED`.

## C · El bucle de cara al aprendiz

```
HOY  ──▶  ACCIÓN  ──▶  (leer │ comprobar → corrección │ repasar → comprobar → corrección)
 ▲          │
 │          ▼
 └──────  SESIÓN CERRADA
```

La cadena del FPS se conserva en sustancia y se reencuadra en una cosa decisiva: **la unidad de
trabajo percibida es la acción, no el ítem**.

- LEER y COMPROBAR no son pares: son **pasos de una acción**, y una acción —la reparación— tiene
  dos y es indivisible para la planificación.
- La corrección sigue siendo una **fase** de COMPROBAR, no una etapa aparte.
- FIN se reduce de dos pantallas a una: la acción primaria del último paso cierra la sesión y
  aterriza directamente en el resumen cerrado (cierra FPS-OBS-03).

## D · Paso de dominio, paso percibido y pantalla

| Dominio (verdad de servidor) | Percibido | Pantalla |
| --- | --- | --- |
| acción `LEARN` → 1 `session_item` | «leer algo nuevo», una acción | `/aprender/[ordinal]` |
| acción `CHECK` → 1 `session_item` | una acción, dos fases | `/comprobar/[ordinal]` |
| acción `RELEARN_CHECK` → 2 `session_items` | **una acción, dos fases** | `/aprender/[ordinal]` y `/comprobar/[ordinal]`, con la misma cabecera de acción |
| ejecución + resultado + presupuesto | «tu plan de hoy» | `/hoy` |
| sesión abierta | «te quedaste aquí» | `/hoy` |
| reutilización, supersesión, consumo, hashes | **nada** | ninguna |

**Regla rectora:** *una ruta identifica siempre exactamente un `session_item`; una acción visible
puede abarcar dos rutas.* La continuidad la da una **cabecera de acción persistente**, nunca la
fusión de rutas.

## E · Inventario normativo de estados

Derivado del conjunto real de salidas del servidor, **no** de los recuentos históricos de estados
vacíos (11 del Design System §12, 5 de Edge States §7, 7 de REQ-F14). **Veintiún estados.**

| # | Estado | Disparador | Qué necesita saber | Primaria | Secundaria | Qué NO debe implicar |
| --- | --- | --- | --- | --- | --- | --- |
| **S1** | Preparando | render de HOY; puede incluir puesta al día bloqueante del motor | que está trabajando | — | — | que ya existe un plan |
| **S2** | Sin objetivo | `NO_ACTIVE_GOAL` | no hay examen elegido | Elegir examen | — | que se sepa algo de ella |
| **S3** | Declarar zona horaria | `TIMEZONE_REQUIRED` | sin ella no existe «hoy»; **la elige ella** | Confirmar la zona · habilitada solo tras selección explícita | Ver todas las zonas | que el sistema sepa dónde está; que confirmar sea un trámite |
| **S4** | Falta disponibilidad | `SETTINGS_REQUIRED` | cuánto tiempo suele tener | Declarar disponibilidad | — | compromiso ni objetivo |
| **S5** | Plan de hoy | `RUN{PLANNED}`, nueva o reutilizada | acción siguiente, razón, forma de la sesión, tiempo de hoy | Empezar | Cambiar el tiempo de hoy | porcentaje de temario, panel, racha, compromiso |
| **S6** | Hoy no tienes tiempo | `RUN{ZERO_TIME}` | su propia declaración, respetada | **ninguna** | Cambiar el tiempo de hoy · neutral | día perdido · deuda · racha rota · **que debería tener más tiempo** |
| **S7** | Nada completo cabe | `RUN{NOTHING_FITS}` | hay trabajo; la acción más corta necesita N min | **ninguna** | Cambiar el tiempo de hoy | fracaso · falta de esfuerzo · «estudia más» |
| **S8** | Nada que recomendar | `RUN{NOTHING_ELIGIBLE}` | nada justificado con lo que el sistema soporta | **ninguna** | **ninguna** | preparada · lista · dominado · temario terminado · que más tiempo ayudaría |
| **S9** | No podemos preparar tu plan | `PLAN_UNAVAILABLE_ENGINE` · `CONTENTION` · `SKIPPED` | temporal, no es culpa suya, no se pierde nada | Reintentar | — | que se produjo un plan; texto de proveedor |
| **S10** | Te quedaste aquí | `RESUME_REQUIRED` | continuación exacta, trabajo hecho, estimación restante | Retomamos desde aquí | Replanificar lo que queda | que sea necesariamente el plan **de hoy**; que parar fuera un fallo |
| **S11** | El tiempo de hoy | la persona abre la hoja | 0 · 5 · 10 · 20 · 30 · personalizar; solo hoy | Guardar | Mi disponibilidad habitual · Cancelar | que cambie el valor habitual; que más sea mejor |
| **S12** | Mi disponibilidad | `/ajustes` | patrón habitual por día **incluido 0**; zona horaria | Guardar | — | que reescriba nada pasado |
| **S13** | Leer | ítem `LEARNING_UNIT` | qué leer; qué acción es y su fase | Continuar · Comprobar · Terminar la sesión | Dejarlo por ahora | que leer demuestre algo |
| **S14** | Comprobar · responder | ítem `QUESTION` sin intento | la pregunta; selección ≠ corrección | Comprobar | Dejarlo por ahora | señal de corrección antes del envío (INV-103) |
| **S15** | Comprobar · corrección | intento registrado | resultado, su respuesta, la correcta, por qué, su confianza, procedencia | Siguiente · Terminar la sesión | — | dominado · a salvo · reparado · resuelto · «próximo repaso» |
| **S16** | Sesión cerrada | `SESSION_COMPLETED` | hechos contados de lo que hizo | Volver a Hoy | — | celebración, puntuación, proyección, promesa de mañana |
| **S17** | Guardando | acción en vuelo | que está en vuelo | (ocupada) | — | que ya está guardado (EC-012) |
| **S18** | No se ha podido guardar | fallo recuperable de escritura | no se ha perdido nada; reintentar es seguro | Reintentar | Dejarlo por ahora | que se guardó; mensaje de proveedor |
| **S19** | Esta sesión ya no está activa | rechazo de integridad | que este ya no es el sitio | Volver a Hoy | — | pérdida de datos; culpa |
| **S20** | El plan necesita actualizarse | `RUN_STALE` · `TARGET_UNAVAILABLE` · `RUN_SUPERSEDED` · `RUN_ALREADY_CONSUMED` · cambio de día | el plan está desactualizado; hay uno nuevo a un toque | Ver el plan de hoy | — | que algo se rompió; que se perdió trabajo; identidad de versión |
| **S21** | Confirmar replanificar | elige «Replanificar lo que queda» | qué se guarda, qué vuelve, **que si nada cambia el plan será el mismo** | Replanificar | Seguir con la sesión · Cambiar el tiempo de hoy | que se borra el progreso; que parar sea un fallo |

**Fusiones, todas justificadas por verdad de producto:** plan nuevo y plan reutilizado son **S5**
(la reutilización es un hecho de implementación); una sucesora es **S5** (§12 permite el silencio);
`RUN_STALE`, `TARGET_UNAVAILABLE`, `RUN_SUPERSEDED`, `RUN_ALREADY_CONSUMED` y el cambio de día son
**S20** porque la acción de la persona es idéntica en los cinco; los fallos se separan por
**recuperabilidad**, que sí es accionable, no por causa, que no lo es; correcto, incorrecto y en
blanco son tres **representaciones** de S15; «reaprendido pero sin comprobar» **no es un estado**,
es S13 → S14 dentro de una acción y S10 al volver; `NO_PUBLISHED_UNIT`, `NO_DURATION_METADATA` y
toda razón de exclusión **nunca son superficie**.

## F · Jerarquía de verdad

**Cada frase de la interfaz debe ser atribuible a exactamente un nivel.**

| Nivel | Significado | En 4B |
| --- | --- | --- |
| **T1 · LA PERSONA DECLARA** | lo dijo ella. Autoritativo, nunca contradicho, nunca juzgado | tiempo de hoy; disponibilidad habitual; zona horaria; objetivo; confianza |
| **T2 · EL SISTEMA SABE** | hecho registrado | qué leyó; qué respondió; correcto o incorrecto contra la versión de clave usada; en blanco; ítems completados; duración de la sesión; qué está planificado; cuánto dura una acción |
| **T3 · LA PERSONA HA DEMOSTRADO** | produjo evidencia sobre un concepto | respondió una pregunta atribuida al concepto. **Único nivel que demuestra algo**; leer nunca lo alcanza |
| **T4 · EL SISTEMA INFIERE** | juicio categórico derivado | qué acción toca y por qué. **Solo puede aflorar como acción más razón**, nunca como afirmación sobre la persona |
| **T5 · EL SISTEMA AÚN NO SABE** | ausencia | sin evidencia; incertidumbre; retención; preparación; mañana. Se expresa como ausencia; **nunca se rellena** |

**Pares que no se colapsan:** leer ≠ demostrar · selección ≠ corrección · confianza ≠ corrección ·
corrección ≠ dominio · dominio ≠ preparación · disponibilidad ≠ obligación · un plan ≠ evidencia ·
una recomendación ≠ certeza · una estimación ≠ un plazo · `NOTHING_ELIGIBLE` ≠ terminado.

Son restricciones de diseño. Ninguna aparece como etiqueta en la interfaz.

## G · Jerarquía de divulgación

| Nivel | Contenido |
| --- | --- |
| **L1 · siempre visible** | tipo de acción · duración estimada de la sesión · estimación restante al retomar · **por qué esta acción**, en términos de la persona · tiempo de hoy · número de acciones y posición · captura de confianza · corrección, respuesta correcta y explicación, **solo tras el envío** |
| **L2 · bajo demanda** | minutos por acción · disponibilidad habitual · procedencia del contenido, discreta · razón de un cambio de plan, solo cuando lo causó la persona |
| **L3 · nunca de cara al aprendiz** | código de razón de composición · razón de exclusión · estado categórico del motor · incertidumbre · identificador de ejecución, `supersedes_run_id`, hash, reutilización, consumo · watermarks, generaciones, versiones · identificadores de representación y de versión · nombres de evento y posiciones de stream · recuentos de intentos · porcentajes · dominio · preparación |

**Lo de L3 se obtiene siempre por la frontera de servidor del Planner y nunca llega al DOM.**
Ninguna concesión de cliente se amplía para pintar la interfaz (Q-4).

## H · Modelo de interacción con el tiempo

Dos objetos distintos, en superficies estructuralmente distintas.

| | El tiempo de hoy | La disponibilidad habitual |
| --- | --- | --- |
| Dónde | hoja sobre HOY (**S11**) | `/ajustes` (**S12**) |
| Alcance | solo este día de plan | patrón hacia delante |
| Valores | 0 · 5 · 10 · 20 · 30 · personalizar (C-17) | minutos por día de la semana **incluido 0**, más un valor por defecto (5–600) |
| Efecto | supersede el plan de hoy | cambia los planes futuros; **no reescribe nada pasado** |
| Escribe el otro | **nunca** (INV-106, REQ-E06) | nunca |

**Dónde aparece el control de hoy, y la regla la dicta la verdad:** en **S5**, **S6** y **S7** —los
tres estados donde cambiar el tiempo puede cambiar el resultado—. **No** en S8: ofrecerlo
implicaría que más tiempo ayudaría, y no ayudaría. **No** durante una sesión abierta: §N del
contrato del Planner impide que el override toque una sesión en curso, así que ofrecerlo sería
mentir.

**`NOTHING_FITS`, la interacción que más importa.** Declarados 5, la acción completa más corta
necesita 10: no se crea ni se presenta ninguna acción ejecutable; el desajuste se enuncia como
hecho del trabajo, no de la persona; el control de hoy queda a un toque, **sin preseleccionar
nada**; y **no hay presión** — ni «solo 5 más», ni sugerencia destacada, ni aterrizaje por defecto
en el valor necesario.

**El cero es una respuesta completa.** S6 usa la lengua de ED-02: *Hoy no tienes que recuperar
nada.* Sin icono de fallo, sin rojo —Edge States §11 reserva `brick` al error y a la corrección
reales, nunca a la ausencia ni al tiempo reducido—. **Ningún gesto, sugerencia o valor por defecto
cuyo significado sea que debería tener más tiempo.**

**Estimaciones.** Se muestran el total de la sesión y la estimación restante al retomar (Design
System §6, ED-03). **Los minutos por acción no se exponen como cuenta atrás**: convertirían la
capacidad en objetivo y el producto en gestor de tareas. Nada cuenta hacia atrás.

## I · Continuidad e interrupción

**Tres intenciones, y confundir dos de ellas es el fallo clásico.**

| Intención | Acto | Dominio | Sesión después | Plan después |
| --- | --- | --- | --- | --- |
| **Pausar** | *Dejarlo por ahora*, o simplemente irse | `SESSION_INTERRUPTED`, o nada si fue abrupto | **abierta** | intacto |
| **Parar y replanificar** | *Replanificar lo que queda* → S21 | `SESSION_COMPLETED` anticipado | **cerrada** | ejecución consumida → sucesora (P4B-D2) |
| **Terminar** | acción primaria del último paso | `SESSION_COMPLETED` | cerrada | consumida |

Irse por accidente y pausar deliberadamente son **deliberadamente indistinguibles**. Ambas
aterrizan en S10 con *Te quedaste aquí*. El sistema nunca comenta cómo se fue.

**Por qué «Replanificar lo que queda» y no «Terminar la sesión».** Edge States ED-03 nombra así la
acción secundaria, y es además la verdadera: lo que la persona quiere es otro plan, y cerrar la
sesión es el mecanismo. Encuadrarlo como *terminar* invita a una lectura de fracaso; encuadrarlo
como *replanificar* enuncia la intención. Y evita `ABANDONED`, que nunca es copy.

**Reanudar frente a plan nuevo, sin exponer semántica de ejecución.** La regla que la persona
puede inferir: *una sesión sin terminar va siempre primero; un plan nuevo solo aparece cuando no
hay ninguna abierta.* HOY nunca ofrece las dos. No necesita explicación: basta con no
contradecirla nunca.

**Trampa que el copy debe evitar:** una sesión reanudada puede ser de un día anterior (§N: la
sesión abierta gana siempre y la reanudación nunca consulta el plan). S10 dice *Te quedaste aquí*
y **no** dice «el plan de hoy».

## J · `REAPRENDER + COMPROBAR`

**Verdad de dominio:** la acción es atómica para planificar; la persona puede parar entre los
pasos; si LEER se completa y COMPROBAR no, **no existe evidencia nueva**, la reparación no está
completa, y el concepto sale de la composición restante del día por `COMPLETED_TODAY`.

**Modelo: una acción, dos fases, una cabecera persistente, dos rutas.**

- Cabecera idéntica en ambos pasos: naturaleza, posición de acción y fase.
- La primaria de la fase 1 de una reparación dice **Comprobar**, no *Continuar*: el propio botón
  dice que la acción no ha terminado.
- Al reanudar a media acción se llega a la fase 2 con la cabecera intacta.
- Si se para tras la fase 1 **no se afirma nada**: ni marca de completado, ni tic contra el
  concepto, ni promesa de cuándo vuelve.

**No se acuña ningún estado de dominio nuevo** (P4-D3 se negó a acuñarlo y este modelo no lo cuela
por la puerta de la interfaz). **OBS-4A-B3:** con evidencia conflictiva la necesidad de reparación
no se disuelve en el motor v1; ninguna copy puede prometer que una reparación la resuelve.

## K · Modelo de corrección

> **Lo que ha pasado** es inmediato y pertenece a la acción. **Lo que el sistema hará al respecto**
> es diferido y pertenece al siguiente HOY, como acción, nunca como promesa.

Inmediato, en este orden (el del Design System §6, cinco de los siete bloques): resultado, con
icono de forma distinta y color de rol, **nunca solo color** · su respuesta · **la respuesta
correcta, siempre**, también al acertar · por qué · su confianza, con frase de calibración
**descriptiva**, nunca evaluativa. Procedencia, discreta.

Los dos bloques ausentes —análisis del distractor y ayuda del Tutor— **no se fabrican**: no hay
modelo de datos ni capacidad. La calibración sigue siendo delgada por necesidad (FPS-OBS-02): una
interpretación más rica exige evidencia e inteligencia que no existen.

**Nunca:** dominado · a salvo · preparada · arreglado · reparado · resuelto · completo · «próximo
repaso». Ni espectáculo de acierto ni espectáculo de fallo.

## L · Familia de estados terminales

Emparentados por construcción, distintos por contenido, y **ninguno parece un error** —los errores
son S9, S18 y S20, que no llevan borde de decisión y sí acción primaria.

| | **S6 · ZERO_TIME** | **S7 · NOTHING_FITS** | **S8 · NOTHING_ELIGIBLE** |
| --- | --- | --- | --- |
| Qué es verdad | declaró que hoy no tiene tiempo | hay trabajo; ninguna acción completa cabe | no hay trabajo justificado con la autoridad v1 |
| Origen | T1 | T1 + T2 | T4 |
| Accionable | sí, cambiar el tiempo | sí, cambiar el tiempo | **no** |
| Primaria | ninguna | ninguna | **ninguna** |
| Secundaria | control de hoy | control de hoy | **ninguna** |

**S8 es la superficie más difícil del producto y es deliberadamente la más vacía.** Puede ser
permanente (OBS-4A-02) y `✓ Dominado` no es alcanzable en el motor v1, así que el producto **no
tiene línea de meta que ofrecer**. La única postura veraz es una limitación enunciada en primera
persona sobre el sistema. Ofrecer práctica exigiría ENTRENAR (Phase 6, no autorizado) y sería
actividad fabricada (§K.1). **Cero CTA no es una carencia:** Edge States EMPTY-02 ya establece que
un estado vacío puede legítimamente no tener ninguna.

El acceso a `/ajustes` es **cromo persistente de HOY**, presente en todos sus estados, subordinado,
y **nunca atribuido a S8 como su resolución**.

## M · Cambio de plan y sucesora

**Postura por defecto: silencio.** Un plan nuevo es un plan. La explicación aparece solo donde la
persona causó el cambio y si no se confundiría: al cambiar el tiempo de hoy (la causa es evidente;
sin anuncio) y en S21 (que ya lo dijo antes, incluido que una entrada sin cambios da un plan sin
cambios). Evidencia nueva, fin de sesión y cambio de día: **silencio**. Contenido no disponible:
**S20**, el único caso que necesita superficie.

**Nunca se expone:** hash, `supersedes_run_id`, identificador, versiones, watermark, generación,
consumo. **Nunca se afirma:** «lo hemos movido a mañana» (no hay planificación multi-día),
«lo hemos protegido» (no hay criticidad), «repaso crítico» (no hay política de repaso), «tus
prioridades cambiaron porque X» (X sería un nombre de estado del motor).

**No hay comparador de replanificación en 4B.** Sería una segunda arquitectura de información para
una pregunta que nadie ha hecho, en una superficie que debe seguir siendo una sola decisión. Master
§26 y REQ-H07 son Phase 7.

## N · Fallo de fidelidad del plan

INV-117 es invisible cuando funciona. Solo se diseña el fallo, y **de las tres distinciones posibles
solo dos son alcanzables y una es accionable**.

| Causa | Experiencia |
| --- | --- |
| **Existe contenido más nuevo** | **ningún estado.** INV-117 fija la versión; una más nueva es irrelevante para esta sesión. Exponerlo filtraría identidad de versión y ofrecería una elección sin base |
| **El contenido planificado se retiró antes de arrancar** | **S20** · el plan necesita actualizarse; una acción devuelve al flujo normal. Sin sustitución, sin acción caducada, sin identificadores |
| **Se retiró dentro de una sesión abierta** (WATCH-4A-1) | **S19 → S20**: esta sesión no puede continuar con ese ítem; lo hecho se conserva. **Sin fallo silencioso**, que es lo que ocurre hoy |
| **Rechazo de integridad al presentar** | imposible bajo INV-117. Si ocurre es un defecto: camino genérico recuperable, sin copy a medida que lo normalice |

## O · Arquitectura de información y rutas

**No se monta el shell de los cinco espacios**: ENTRENAR es Phase 6, PROGRESO y PLAN son Phase 7, y
montar destinos para capacidades inexistentes es lo que EC-012 prohíbe. `PRIMARY_SPACES` sigue
siendo la constante única que ya es (EC-015), sin uso como navegación.

```
ENTRADA
  └─ HOY ......................... único destino
       ├─ El tiempo de hoy ....... hoja, solo hoy
       ├─ Confirmar replanificar . confirmación
       ├─ SESIÓN ................. en flujo, no destino
       │    ├─ Leer
       │    ├─ Comprobar → Corrección
       │    └─ Sesión cerrada
       └─ Mi disponibilidad ...... /ajustes · habitual + zona horaria
```

| Ruta | Propósito | Cambio respecto al FPS |
| --- | --- | --- |
| `/entrar`, `/registro` | auth | sin cambio |
| `/onboarding` | objetivo · nivel · disponibilidad habitual (**0 admitido**) · **zona horaria** | ampliada |
| `/hoy` | S1–S10, con S11 y S21 como superposiciones | reescrita |
| `/aprender/[ordinal]` | un paso `LEARN` o `RELEARN` | conservada, gana la cabecera de acción |
| `/comprobar/[ordinal]` | un paso `CHECK`, dos fases | conservada |
| `/fin` | S16, solo resumen cerrado | simplificada: desaparece la pantalla previa |
| `/ajustes` | S12 | **nueva**, mínima. **No** es el espacio PLAN |
| `/cuenta` | superficie de identidad | fuera del vertical, intacta |

`ordinal` sigue siendo la posición del ítem dentro de la sesión, nunca un identificador.

## P · Modelo de interacción

| Transición | Clase |
| --- | --- |
| entrar en HOY → estado de plan | **servidor** · puede incluir puesta al día bloqueante |
| *Empezar* → primer paso | **persona** · el evento de presentación lo emite la acción que navega, nunca el render |
| paso → paso | **persona** |
| responder → corrección | **persona**, misma ruta; el foco se mueve y el resultado se anuncia |
| último paso → S16 | **persona** · una acción cierra y aterriza en el resumen |
| *Dejarlo por ahora* → HOY | **persona** · la sesión sigue abierta, sin juicio |
| *Replanificar lo que queda* → S21 → HOY | **persona**, confirmado · irreversible, por tanto nunca de un toque |
| tiempo cambiado → plan nuevo | **persona inicia, servidor calcula** · silencioso |
| caducado / retirado / consumido / cambio de día → S20 | **servidor** · solo al intentar actuar |

**Reglas sin excepción:** ninguna navegación automática que la persona no cause, salvo un rechazo
del servidor que vuelva falsa la pantalla actual (S19, S20) · ninguna acción irreversible sin
confirmación que enuncie la consecuencia · **ninguna interacción fabrica evidencia**: todo acto que
produce evidencia es una acción explícita, y pintar una página nunca produce evidencia · ninguna
interacción afirma un guardado no confirmado (EC-012).

## Q · Modelo responsive

El escritorio no es móvil con más aire: comprime en móvil y **da sitio a la columna de lectura y
silencio a la periferia** en escritorio. La misma verdad, la misma decisión única, la misma acción
primaria.

| | Móvil (390 ref) | Escritorio |
| --- | --- | --- |
| Prioridad | acción siguiente → por qué → tiempo → primaria | idéntica; la tarjeta no crece hasta ser un panel |
| Medida de lectura | 45–70 caracteres | 45–70 caracteres, centrada; **el texto no se ensancha** |
| Acciones | primaria visible sin desplazamiento en HOY | primaria dentro del objeto dominante |
| Fijos | **ninguno por defecto**; una barra fija durante LEER compite con la lectura (DS §4) | ninguno |
| Unidades largas | superficie de lectura continua, nunca tarjeta por párrafo | igual |
| Preguntas | opciones a ancho completo, ≥44 px | columna única, nunca en fila |
| Desbordamiento | **ninguno a ninguna anchura** | ninguno |

**Presencia en escritorio (§W-QA).** El objeto de producto **no puede leerse como una aplicación de
tamaño móvil flotando dentro de un monitor grande**. Se valida escala perceptual de HOY, anchura
del objeto dominante, escala tipográfica, uso del espacio disponible, medida de lectura y relación
entre canvas, espina y objeto de decisión. Esto **no** autoriza ensanchar LEER.

## R · Modelo de accesibilidad

SD-019 **opción C** aplicada: ningún valor congelado se mueve; AA aplica al **texto**; `teal` y
`amber` son superficie, acento e indicador donde un emparejamiento de texto fallaría; `slate` es
texto solo sobre `surface`.

| Requisito | Condición |
| --- | --- |
| Contraste de texto | 4.5:1, o 3:1 a ≥24 px o ≥18.66 px en negrita, medido tras el layout contra el fondo computado real |
| Restricciones medidas | `slate` nunca como texto sobre `canvas` (4.31) · `magenta` nunca como texto sobre `canvas` (**4.47**, AA-1) · ningún texto sobre `teal` (3.95) ni sobre `amber` (4.42) |
| Bordes de control | 3:1; `slate` mide 4.31 sobre canvas y 4.70 sobre surface |
| Foco | `navy`, 2 px con 2 px de separación, visible sobre canvas (13.07), surface (14.25) y dentro de superposiciones |
| Dianas | ≥44×44 px tras el layout, incluidos los seis valores del control de tiempo y los cuatro de confianza |
| Zoom 200 % | sin desplazamiento horizontal a 390 px y sin pérdida de contenido |
| Medida | 45–70 caracteres en cuerpo de lectura y enunciado |
| Encabezados | un solo `h1` por superficie; orden sin saltos; la cabecera de acción es contexto, no encabezado |
| `aria-live` | resultado de la corrección (asertivo, con foco movido) · cambios de estado de plan (cortés) · fallos de guardado · carga cuando excede el umbral perceptible |
| Movimiento reducido | equivalente para **toda** transición; ningún significado depende del movimiento |
| Color | nunca portador único: resultado = forma del disco + forma del icono + palabra; naturaleza = forma + palabra, sin color |
| Estados de borde | Edge States §10 completo: sin parpadeo, sin auto-descarte prematuro, lenguaje de recuperación sin culpa moral |

## S · Sistema visual · L2 · System Intelligence

Dirección final aprobada: **Calm Intelligence + System Intelligence**. B+ es la línea base
histórica de la que L2 deriva; **L1/B+ no es la dirección final y L3 · Frontier no se selecciona**.

### S.1 · Tesis de identidad

La identidad **no** depende principalmente de paleta, logotipo, tecnología decorativa, estética de
IA ni cromo de panel. La produce la gramática combinada de: **espina del sistema · superficie de
decisión anclada · voces tipográficas diferenciadas · actividad adaptativa temporal ·
transformación y recomposición · retirada durante el aprendizaje.** La interfaz debe seguir siendo
estructuralmente reconocible en un fotograma quieto mientras su presencia tecnológica más fuerte
sigue siendo temporal.

### S.2 · La espina del sistema

Línea de 1 px que recorre la pantalla y a la que se ancla lo que el sistema decide. Es ancla
estructural persistente, continuidad entre estados, procedencia de los objetos producidos por el
sistema y pista para la actividad adaptativa temporal.

**En reposo la espina es neutra.** No implica corrección, progreso, dominio, preparación, urgencia,
puntuación ni actividad cuando no la hay. **Es estructural: no es métrica, no es raíl de progreso,
no es navegación, no es un stepper.**

### S.3 · La superficie de decisión anclada

La superficie dominante producida por el sistema se ancla a la espina: **lado izquierdo unido
estructuralmente, radio conservado a la derecha** (candidato `border-radius: 0 20px 20px 0`).

Aplica **específicamente** a la superficie de decisión dominante, donde la relación
sistema/procedencia es semánticamente verdadera. **No se generaliza indiscriminadamente.** Su
significado es estructural: *este objeto lo produjo y lo sostiene STUDY OS*.

### S.4 · Firma adaptativa · AS-2 · solo activo

**Autoritativo.** El teal se hace perceptible cuando STUDY OS está **computando, recomponiendo,
adaptándose o produciendo una decisión de planificación nueva**.

**En reposo el teal no permanece** como señal de actividad a altura completa por el mero hecho de
que exista una decisión válida. La relación estructural asentada la transportan **la espina neutra
y el objeto anclado**; la actividad adaptativa la transporta **el comportamiento temporal del
teal**. Esta distinción es normativa.

**Significado único del teal: *STUDY OS está actuando o adaptándose.*** La existencia de una
decisión válida se comunica estructuralmente, no con teal.

### S.5 · Regla de temporalidad

Las señales tecnológicas más fuertes son **temporales**. Una señal de sistema no puede persistir
para que la interfaz parezca tecnológica.

> Una señal asociada a computación o adaptación solo puede permanecer visible mientras esa
> actividad ocurre de verdad, más la breve transición de llegada o resolución que la continuidad
> perceptual requiera.

Sin animación ambiental, sin pulso en reposo, sin señal permanente de computación, sin bucle
decorativo, sin pensamiento de IA fingido.

### S.6 · Recomposición · demostrador principal

El cambio de disponibilidad es la interacción de referencia:

```
asentado → la persona cambia su disponibilidad autoritativa → restricción aceptada
→ la actividad del sistema se hace perceptible → el plan se recompone
→ llega una decisión nueva y veraz → la señal se resuelve → el sistema vuelve a la calma
```

El contenido de la persona **permanece legible**: la decisión anterior no se atenúa. Atenuarla al
55 % deja `ink` en **3.61:1** y `slate` en **2.12:1**; medido y descartado. Además la interacción
afirma justo eso: el sistema sostiene tu decisión actual hasta tener la siguiente.

El sistema **se transforma**, no se comporta como navegación entre páginas ajenas. No se expone
razonamiento interno, no se fabrica causalidad, no se usa teatro de carga genérico.

**Retroalimentación computacional:** tres cadenas de estado, todas hechos —*Tu tiempo cambió* ·
*Ajustando la sesión a N min* · *Sesión reajustada* · y, si falla, *No hemos podido actualizar tu
plan*—, en una ranura reservada para que nada se reajuste, con `aria-live` cortés. Sin porcentajes,
sin mensajes rotatorios, sin «analizando».

### S.7 · Profundidad y superficie

`canvas` y `surface` se separan solo **1.09:1**: la paleta congelada no da profundidad tonal. Por
eso la profundidad la hacen el espacio, la escala, la tipografía, un borde óptico y una luz de
suelo, y la sombra se reserva a las superposiciones.

| Capa | Tratamiento |
| --- | --- |
| **L0 · canvas** | el papel |
| **L0,5 · luz ambiental** | lavado radial detrás de la superficie dominante |
| **L1 · superficie dominante** | **una por pantalla**; gradiente vertical casi imperceptible, borde óptico superior de 1 px, hairline inferior, anclaje a la espina. **Sin borde** |
| **L2 · superposición** | la única sombra del sistema |

**No se reintroduce:** sopa de tarjetas · glassmorphism · gradientes decorativos amplios · glow ·
módulos flotantes de panel · sombras ornamentales. El sistema es moderno por **comportamiento y
estructura**, no por efectos.

### S.8 · Movimiento

Existe solo para comunicar orientación, continuidad, causalidad, retroalimentación o cambio de
estado veraz. **Transformación antes que sustitución** donde sea técnicamente razonable; los
elementos persistentes conservan continuidad espacial; el equivalente sin movimiento es
obligatorio; **el movimiento nunca es necesario para entender el estado autoritativo**.

Presupuesto del Design System §13: orientación 180–240 ms (hojas y confirmaciones) · continuidad
200–300 ms (entrar y retomar sesión) · respuesta 150–220 ms (entra la corrección) · cambio de
estado 250–350 ms (plan sustituido). `masteryStateChange` y `progressReveal` **siguen sin uso** en
4B. La señal de recomposición recorre **una sola vez** y descansa: **nada hace bucle**.

### S.9 · Retirada en LEER · norma

LEER es el estado de control de contención visual. Durante el aprendizaje enfocado: **sin teal
activo, sin teatro adaptativo, sin campo de sistema innecesario, sin tecnología decorativa, sin
tarjetas añadidas, sin señal computacional persistente**. El contenido debe dominar.

Puede quedar una traza estructural neutra solo donde haga falta para continuidad entre rutas y
solo si **no degrada la medida de lectura ni la atención**. **LEER no se hace más tecnológico
durante la implementación.**

### S.10 · Continuidad en COMPROBAR y CORRECCIÓN

**Solo continuidad de espina neutra.** No se lleva teal activo a COMPROBAR ni a CORRECCIÓN salvo
que el sistema esté realizando de verdad una operación adaptativa en ese instante exacto. No se
añade cromo. No se rediseña la arquitectura aceptada. **La semántica de resultado es independiente
de la semántica de actividad del sistema:** los colores de corrección no se confunden con
actividad.

### S.11 · Tipografía · una sola familia

**IBM Plex Sans**, aprobada para Product UX v1. Una sola familia; **no se añade una serif para
LEER en Phase 4B**. La diferencia entre **voz de sistema** y **voz de aprendizaje** se consigue
dentro de la familia con peso, tracking, caja, escala, ritmo y medida. **No se usa monoespaciada
para comunicar computación.**

| Voz | Registro | Dónde |
| --- | --- | --- |
| **Sistema** | versal, 13 px, tracking ≈.14em, 600 | fecha · naturaleza de la acción · posición de la acción · estado del sistema · metadato de capacidad autorizado |
| **Aprendizaje** | caja normal, sin tracking artificial, ritmo de lectura, medida aceptada | títulos de contenido, cuerpo, enunciados, opciones, corrección |

La distinción indica **autoría**. **No** implica jerarquía de valor ni de confianza de la persona.

Escala: título de página 30/40 px · título de acción 23/28 px · cuerpo de lectura 17–18 px a 1.65 ·
enunciado 17 px · opción 16 px · razón y secundario 15 px · micro-etiqueta 13 px, **12 px no se
usa** · numerales tabulares en toda duración, recuento y posición.

### S.12 · Wordmark de producto v1 · W1

**W1 · wordmark refinado**, aprobado **para producto v1 únicamente**: tracking óptico, STUDY más
cerrado, intervalo medido, OS algo más cerrado. Solo CSS, sin activo.

| Registro | Estado |
| --- | --- |
| **WORDMARK DE PRODUCTO V1** | **W1 · aprobado** |
| **MARCA / LOGOTIPO EXTERNO DEFINITIVO** | **DIFERIDO · NO BLOQUEANTE PARA PHASE 4B** |

Esta decisión **no** declara W1 logotipo corporativo permanente, marca externa permanente,
identidad de marketing final, icono de aplicación ni sistema de favicon. Esas preguntas quedan
explícitamente diferidas.

**No se selecciona W6** y **no se codifica la espina del sistema en el wordmark de producto**: la
gramática de producto es suficientemente apropiable para que el wordmark no tenga que cargar con
todo el problema de identidad. El wordmark debe permanecer lo bastante callado para que **HOY y la
acción actual dominen**.

Resultado exploratorio, sin hacer normativo lo rechazado: **W6** es coherente con la espina pero se
rechaza como wordmark final porque el separador vertical depende demasiado del contexto de producto
y es más débil como identidad aislada; **W10** es más reconocible pero introduce exigencias
excesivas de artesanía y atención para la necesidad actual; el resto de candidatos de segunda
pasada no se seleccionan. **No se continúa la exploración de wordmark antes de Phase 4B.**

### S.13 · L3 · Frontera · no seleccionada

Valor registrado como evidencia de límite. **Rechazados para Phase 4B:** marcas de posición
persistentes · canal de sistema de 24 px · tensado del radio durante la computación · oscurecimiento
del campo · capacidad como raíl lleno · desplazamiento estático de AS-3 · voz de sistema
monoespaciada · cualquier otra señal tecnológica decorativa o permanente.

**No se importan gestos aislados de L3** al BUILD salvo que estén listados como aprobados en este
contrato. El laboratorio estableció la frontera; **no se solicita ninguna capa tecnológica
adicional**.

**La frontera, enunciada:** STUDY OS deja de ser Calm Intelligence en cuanto una señal del sistema
(a) permanece cuando el sistema no hace nada, (b) ocupa espacio que pertenece a la lectura, o
(c) empieza a medir algo.

## T · Invariantes de UX · UX-INV-1 … UX-INV-24

Verificables mecánicamente. Son criterio de aceptación de la implementación de Phase 4B.

| Id | Invariante |
| --- | --- |
| **UX-INV-1** | Exactamente una acción primaria por estado, y **cero** en S6, S7 y S8 (INV-104) |
| **UX-INV-2** | Ningún elemento de L3 aparece en el DOM: identificador de ejecución, hash, versión, watermark, generación, nombre de estado del motor, razón de composición o exclusión, identificador de representación o versión, nombre de evento, posición de stream, porcentaje |
| **UX-INV-3** | Ningún término del léxico prohibido (terminology §3) aparece en ninguna superficie |
| **UX-INV-4** | Ninguna señal de corrección —token, icono, texto, atributo o reordenación— antes del envío (INV-103) |
| **UX-INV-5** | El control de envío está deshabilitado hasta que exista confianza, con ayuda asociada programáticamente (INV-102) |
| **UX-INV-6** | Al enviar, el foco se mueve al encabezado de resultado y el resultado se anuncia de forma asertiva |
| **UX-INV-7** | S6, S7 y S8 son textual y estructuralmente distintos; ninguno contiene el significado prohibido de otro; **S8 no contiene ninguna de sus siete lecturas prohibidas** |
| **UX-INV-8** | El control de tiempo de hoy es alcanzable en S5, S6 y S7, y **está ausente en S8 y en todo estado dentro de sesión**; **S8 no presenta ninguna acción contextual** |
| **UX-INV-9** | `fps-fixed-v1` es inalcanzable desde cualquier camino de aprendiz |
| **UX-INV-10** | Todo elemento interactivo mide ≥44×44 px tras el layout, a 390 px y a anchura de escritorio |
| **UX-INV-11** | Todo texto visible cumple su contraste; `slate` nunca sobre `canvas`; `magenta` nunca como texto sobre `canvas`; ningún texto sobre `teal` ni sobre `amber` |
| **UX-INV-12** | Sin desbordamiento horizontal a ninguna anchura |
| **UX-INV-13** | La medida se mantiene entre 45 y 70 caracteres en cuerpo de lectura y enunciado, a ambas anchuras |
| **UX-INV-14** | El vertical completo es operable solo con teclado; toda superposición devuelve el foco a su disparador; Esc cierra |
| **UX-INV-15** | Con `prefers-reduced-motion: reduce` todo cambio de estado sigue siendo perceptible y ningún significado depende de la animación |
| **UX-INV-16** | Ningún render emite evento de aprendizaje; la evidencia solo sigue a acciones explícitas |
| **UX-INV-17** | Ambos pasos de un `RELEARN_CHECK` llevan cabecera de acción idéntica; ninguna superficie afirma completado tras la fase 1 |
| **UX-INV-18** | `/fin` solo es alcanzable para una sesión cerrada; no existe pantalla previa al cierre |
| **UX-INV-19** | S10 nunca se refiere a la sesión abierta como «el plan de hoy» |
| **UX-INV-20** | Todo estado ocupado es distinguible de uno completado, y ninguna superficie afirma un guardado no confirmado |
| **UX-INV-21** | Ningún valor de zona horaria se escribe por render, prefetch, abandono ni ningún camino que no sea una selección explícita; al llegar a S3 nada está seleccionado y la primaria está deshabilitada |
| **UX-INV-22** | S6 no contiene ningún gesto, sugerencia, destacado ni valor por defecto cuyo significado sea que la persona debería tener más tiempo; el control de tiempo abre sin preselección |
| **UX-INV-23** | S8 no presenta acción primaria ni acción secundaria contextual; el acceso a ajustes del cromo persistente no se le atribuye como resolución |
| **UX-INV-24** | **Fidelidad de acción:** ninguna posición o total de acción visible se deriva del ordinal de ruta ni de `planner_runs.item_count`; ambos derivan de la agrupación autoritativa del Planner (`action_ordinal` y su máximo), obtenida en servidor. Los dos pasos de una acción de dos pasos muestran la **misma** posición; una acción de un solo paso no muestra indicador de fase |

## U · Lo que este contrato no autoriza

Ninguna implementación, migración, esquema, dependencia, mutación de STAGING, cambio en Vercel,
credencial, despliegue ni BUILD de Phase 4B. No reabre Waves 1–2. No modifica el contrato del
Planner ni el del Learning Engine: donde los toca, lo hace por el anexo de Phase 4B, que se
registra aparte.

Fuera de alcance y explícitamente no diseñado: shell de navegación, PLAN, PROGRESO, ENTRENAR,
readiness, superficies de dominio, Rescue como modo de producto nombrado, Recovery nombrado,
comparador de replanificación, estados de sincronización, notas, tutor, chips de procedencia como
componente, corpus oficial y cualquier dependencia de Phase 1B.
