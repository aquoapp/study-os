/**
 * Contenido del corpus sintético de Preview · Phase 4B.
 *
 * **Todo lo de aquí está escrito de cero para este repositorio.** No procede de ningún corpus
 * oficial, de ninguna academia, de ningún temario con derechos ni de ninguna fuente externa.
 * Phase 1B y el corpus oficial del primer pack **no** están autorizados, y este fichero no los
 * abre: la procedencia de todo lo que publica es `GENERATED`, y así queda registrada en la
 * autoridad de datos, no solo en un comentario.
 *
 * **Existe para validar el producto, no para validar un examen.** La materia se parece a una
 * formación genérica de administración y de informática básica porque hace falta que se lea como
 * temario de verdad —si no, no se puede juzgar la experiencia de lectura—, pero no representa la
 * cobertura de ninguna convocatoria y no debe presentarse como tal.
 *
 * El tamaño es el **mínimo que produce todos los estados exigidos**, no un catálogo:
 *
 *   - **8 conceptos**, repartidos en dos bloques y tres temas, para que el orden de sílabo tenga
 *     algo que ordenar y la continuidad recorra más de un tema;
 *   - **7 unidades**: el concepto `sin-unidad` se queda **a propósito** sin ninguna, para que
 *     `NO_PUBLISHED_UNIT` sea alcanzable con contenido real en vez de solo en una prueba;
 *   - **18 preguntas**, dos o tres por concepto, para que COMPROBAR siga teniendo candidatos no
 *     respondidos después de varias sesiones y el Planner no se quede sin trabajo el segundo día;
 *   - **duraciones de 3 a 12 minutos**, para que cambiando el tiempo de hoy se alcancen `PLANNED`,
 *     `NOTHING_FITS` y `ZERO_TIME` sin tocar la base de datos.
 *
 * `NO_DURATION_METADATA` **no** se puede producir desde aquí, y eso es correcto: la frontera de
 * ingestión exige la duración desde la migración 24, de modo que una versión nueva sin ella no
 * puede publicarse. Solo pueden carecer de duración las versiones publicadas **antes** de esa
 * migración, y esa condición se prueba en integración fijando la columna a nula, no sembrando
 * contenido inválido.
 */

/** Dos bloques y tres temas: el orden de sílabo es lo que ordena la continuidad (§H). */
export const SYLLABUS = {
  blocks: [
    { code: 'B1', title: 'Organización del trabajo', sortOrder: 1 },
    { code: 'B2', title: 'Herramientas digitales', sortOrder: 2 },
  ],
  topics: [
    { block: 0, code: 'B1.T1', title: 'Documentos y registro', sortOrder: 1 },
    { block: 1, code: 'B2.T1', title: 'Ficheros y formatos', sortOrder: 1 },
    { block: 1, code: 'B2.T2', title: 'Datos y seguridad', sortOrder: 2 },
  ],
};

/**
 * Los ocho conceptos. `unit: false` marca el que se queda sin unidad **a propósito**.
 */
export const CONCEPTS = [
  { key: 'registro-entrada', topic: 0, title: 'El registro de entrada', unit: true },
  { key: 'compulsa', topic: 0, title: 'Copias y compulsas', unit: true },
  { key: 'plazos', topic: 0, title: 'Cómputo de plazos', unit: true },
  { key: 'formatos-abiertos', topic: 1, title: 'Formatos abiertos y cerrados', unit: true },
  { key: 'estructura-carpetas', topic: 1, title: 'Cómo se nombra un fichero', unit: true },
  { key: 'copias-seguridad', topic: 2, title: 'Copias de seguridad', unit: true },
  { key: 'contrasenas', topic: 2, title: 'Contraseñas y gestores', unit: true },
  // Tiene preguntas atribuidas y **ninguna unidad publicada**: así `NO_PUBLISHED_UNIT` deja de
  // ser una etiqueta teórica y se puede ver ocurrir con contenido real.
  { key: 'firma-electronica', topic: 2, title: 'Firma electrónica', unit: false },
];

const p = (...paragraphs) => paragraphs.join('\n\n');

/**
 * Las siete unidades, con su duración declarada.
 *
 * La duración es una **estimación operativa de planificación** (ADR-013 §2.1): no es un hecho de
 * ciencia del aprendizaje, ni una estimación de dominio, ni una predicción sobre quien lee. Aquí
 * la declara la autoría del contenido, que es exactamente de dónde la decisión dice que viene, y
 * queda fijada a esta versión exacta.
 */
export const UNITS = [
  {
    concept: 'registro-entrada',
    minutes: 5,
    title: 'El registro de entrada',
    body: p(
      'Cuando una persona presenta un documento ante una oficina pública, lo primero que ocurre no es que alguien lo lea: es que queda registrado. El registro anota la fecha, la hora, quién lo presenta y qué presenta, y devuelve un justificante con esos mismos datos.',
      'Ese justificante importa más de lo que parece. No dice que el documento sea correcto, ni que vaya a admitirse: dice únicamente que llegó, y cuándo. Esa distinción entre «presentado» y «admitido» es la que evita la mayoría de los malentendidos.',
      'La fecha del registro es, además, la que cuenta para los plazos. Un documento presentado a las 23:50 del último día está dentro; el mismo documento entregado en mano a la mañana siguiente, no.',
    ),
  },
  {
    concept: 'compulsa',
    minutes: 4,
    title: 'Copias y compulsas',
    body: p(
      'Una copia compulsada es una copia sobre la que alguien con competencia para hacerlo ha declarado que coincide con el original que tuvo delante. No es una fotocopia mejor: es una fotocopia con una afirmación encima.',
      'De ahí se sigue lo que una compulsa no hace. No convierte en auténtico un documento que no lo era, no valida su contenido y no lo sustituye para siempre: si el original se modifica, la copia compulsada queda describiendo un estado anterior.',
      'En la práctica conviene recordar quién compulsa y cuándo, porque esa fecha delimita hasta dónde llega lo que la copia afirma.',
    ),
  },
  {
    concept: 'plazos',
    minutes: 8,
    title: 'Cómputo de plazos',
    body: p(
      'Contar un plazo parece trivial y casi nunca lo es, porque dos plazos de la misma longitud aparente pueden terminar en días distintos según cómo estén expresados.',
      'La primera pregunta es si el plazo está en días o en meses. Un plazo en días se cuenta día a día, y hay que saber si esos días son hábiles o naturales. Un plazo en meses no se cuenta en días: vence el día equivalente del mes correspondiente, y cuando ese día no existe vence el último del mes.',
      'La segunda pregunta es desde cuándo se cuenta. Lo habitual es empezar el día siguiente al de la notificación, no el mismo día. Confundir esto desplaza el vencimiento una jornada entera, que suele ser justo la que falta.',
      'La tercera es qué pasa si el último día es inhábil. Entonces el plazo se prolonga al primer día hábil siguiente, de modo que nunca vence en un día en que no se puede actuar.',
    ),
  },
  {
    concept: 'formatos-abiertos',
    minutes: 6,
    title: 'Formatos abiertos y cerrados',
    body: p(
      'Un formato de fichero es un acuerdo sobre cómo se ordenan los bytes. Que ese acuerdo esté publicado y sea implementable por cualquiera es lo que lo hace abierto; que dependa de un único fabricante que puede cambiarlo, lo hace cerrado.',
      'La consecuencia práctica no es ideológica, es de plazos largos. Un documento guardado en un formato abierto se podrá abrir dentro de quince años aunque el programa que lo creó haya desaparecido, porque la especificación sigue estando ahí. Con un formato cerrado, esa garantía depende de que alguien siga manteniéndolo.',
      'Por eso lo que se archiva a largo plazo y lo que se intercambia entre organizaciones suelen guardarse en formatos abiertos, aunque el trabajo del día a día se haga en otra cosa.',
    ),
  },
  {
    concept: 'estructura-carpetas',
    minutes: 3,
    title: 'Cómo se nombra un fichero',
    body: p(
      'Un nombre de fichero es una herramienta de búsqueda futura, y casi siempre se escribe pensando solo en el presente.',
      'Tres decisiones resuelven la mayor parte del problema. Poner la fecha en formato año-mes-día al principio hace que el orden alfabético coincida con el cronológico. Evitar espacios y acentos evita sorpresas al moverlo entre sistemas. Y describir el contenido en vez del momento —«acta-reunion» en lugar de «definitivo2»— hace que siga significando algo cuando ya nadie recuerde el contexto.',
      'Ninguna de las tres es obligatoria. Las tres se agradecen cuando hay que encontrar algo dos años después.',
    ),
  },
  {
    concept: 'copias-seguridad',
    minutes: 10,
    title: 'Copias de seguridad',
    body: p(
      'Una copia de seguridad no es un fichero duplicado: es la respuesta a una pregunta concreta, «qué pasa si esto desaparece». Y hasta que no se restaura una vez, es una suposición.',
      'La regla que más se repite es sencilla de enunciar: tres copias de lo que importa, en dos soportes distintos, y una de ellas fuera del sitio donde están las otras. Cada parte responde a un modo de fallo distinto. Tres copias cubren el borrado accidental; dos soportes cubren que falle un tipo de disco; la copia externa cubre que el problema sea el edificio.',
      'Falta una cuarta pieza que no está en la regla y decide si sirve: probar la restauración. Una copia que nunca se ha restaurado no es una copia de seguridad, es un fichero grande del que se espera mucho.',
      'Conviene además saber cada cuánto se hace. Una copia diaria significa que, en el peor caso, se pierde un día de trabajo. Ese número, y no la existencia de la copia, es lo que de verdad define la protección.',
    ),
  },
  {
    concept: 'contrasenas',
    minutes: 12,
    title: 'Contraseñas y gestores',
    body: p(
      'Durante años se pidió a la gente que recordara contraseñas complicadas y que las cambiara cada pocos meses. El resultado predecible fue que todo el mundo acabó usando variaciones de la misma, porque la memoria humana no da para más.',
      'El consejo cambió cuando se midió lo que ocurría de verdad. Lo que hace difícil de adivinar una contraseña es sobre todo su longitud, no la cantidad de símbolos raros. Y el cambio forzado periódico empeoraba las cosas, porque empujaba a elegir la siguiente de forma previsible.',
      'La recomendación actual tiene dos partes. La primera es que cada servicio tenga una contraseña distinta, porque el riesgo real no es que adivinen la tuya, sino que se filtre de un sitio y la prueben en los demás. La segunda es que no intentes recordarlas: para eso existe un gestor, que solo te obliga a recordar una.',
      'Esa única que sí recuerdas conviene que sea larga y que no se parezca a ninguna otra. Y donde el servicio lo permita, añadir un segundo factor cambia el problema por completo: aunque la contraseña se filtre, sigue faltando algo.',
    ),
  },
];

/**
 * Las preguntas, con su clave y su explicación.
 *
 * Dos o tres por concepto, incluido el que no tiene unidad: así `NO_PUBLISHED_UNIT` se produce
 * por lo que es —no hay unidad que leer—, y no por falta de preguntas atribuidas.
 */
export const QUESTIONS = [
  {
    concept: 'registro-entrada',
    stem: '¿Qué acredita exactamente el justificante de un registro de entrada?',
    options: [
      'Que el documento presentado es correcto y está completo.',
      'Que el documento fue presentado, y en qué fecha y hora.',
      'Que el documento ha sido admitido a trámite.',
      'Que el documento ha sido leído por el órgano competente.',
    ],
    correct: 1,
    explanation:
      'El registro acredita la presentación y su momento, nada más. Que el documento sea correcto o se admita son decisiones posteriores y distintas.',
  },
  {
    concept: 'registro-entrada',
    stem: 'Un escrito se registra a las 23:50 del último día de plazo. ¿Está presentado en plazo?',
    options: [
      'No, porque las oficinas ya estaban cerradas.',
      'Sí, porque la fecha que cuenta es la del registro.',
      'Solo si se entrega también en mano al día siguiente.',
      'Solo si el plazo estaba expresado en meses.',
    ],
    correct: 1,
    explanation:
      'Lo que fija la presentación es la fecha y hora del registro. El último día cuenta entero.',
  },
  {
    concept: 'compulsa',
    stem: '¿Qué añade una compulsa a una copia?',
    options: [
      'La declaración de que coincide con el original que se tuvo delante.',
      'La autenticidad del documento original.',
      'La validez indefinida de su contenido.',
      'La sustitución permanente del original.',
    ],
    correct: 0,
    explanation:
      'La compulsa afirma la coincidencia con el original en un momento dado. No valida el contenido ni convierte en auténtico lo que no lo era.',
  },
  {
    concept: 'compulsa',
    stem: 'Si el documento original se modifica después de compulsar una copia, ¿qué ocurre con la copia?',
    options: [
      'Se actualiza automáticamente.',
      'Pasa a ser el documento válido.',
      'Sigue describiendo el estado anterior del original.',
      'Queda anulada de forma automática.',
    ],
    correct: 2,
    explanation:
      'La copia compulsada afirma una coincidencia fechada. Si el original cambia, la copia sigue describiendo cómo era antes.',
  },
  {
    concept: 'plazos',
    stem: 'Un plazo expresado en meses, ¿cómo vence?',
    options: [
      'Contando treinta días por mes.',
      'El día equivalente del mes correspondiente.',
      'El último día natural de ese mes, siempre.',
      'Contando solo los días hábiles de cada mes.',
    ],
    correct: 1,
    explanation:
      'Un plazo en meses no se convierte a días: vence el día equivalente, y si ese día no existe, el último del mes.',
  },
  {
    concept: 'plazos',
    stem: 'Por regla general, ¿desde cuándo empieza a contarse un plazo tras una notificación?',
    options: [
      'Desde el mismo día de la notificación.',
      'Desde el día siguiente al de la notificación.',
      'Desde el primer día hábil del mes siguiente.',
      'Desde que la persona interesada acusa recibo.',
    ],
    correct: 1,
    explanation:
      'Lo habitual es empezar el día siguiente. Contar desde el mismo día desplaza el vencimiento una jornada.',
  },
  {
    concept: 'plazos',
    stem: 'Si el último día de un plazo es inhábil, ¿qué sucede?',
    options: [
      'El plazo vence igualmente ese día.',
      'El plazo vence el día hábil anterior.',
      'El plazo se prolonga al primer día hábil siguiente.',
      'El plazo se reinicia por completo.',
    ],
    correct: 2,
    explanation:
      'Se prolonga al primer día hábil siguiente, de modo que el plazo nunca vence en un día en que no se puede actuar.',
  },
  {
    concept: 'formatos-abiertos',
    stem: '¿Qué caracteriza a un formato de fichero abierto?',
    options: [
      'Que se puede abrir sin contraseña.',
      'Que su especificación está publicada y cualquiera puede implementarla.',
      'Que ocupa menos espacio que uno cerrado.',
      'Que lo mantiene un único fabricante.',
    ],
    correct: 1,
    explanation:
      'Lo que lo define es que el acuerdo sobre cómo se ordenan los datos es público e implementable, no quién puede abrirlo hoy.',
  },
  {
    concept: 'formatos-abiertos',
    stem: '¿Por qué se prefieren formatos abiertos para archivar a largo plazo?',
    options: [
      'Porque son siempre más rápidos de abrir.',
      'Porque su especificación sigue disponible aunque desaparezca el programa que los creó.',
      'Porque no se pueden modificar una vez guardados.',
      'Porque ocupan menos espacio en disco.',
    ],
    correct: 1,
    explanation:
      'La garantía a quince años no la da el programa, la da la especificación pública. Con un formato cerrado depende de que alguien lo mantenga.',
  },
  {
    concept: 'estructura-carpetas',
    stem: '¿Por qué conviene escribir la fecha como año-mes-día al principio del nombre?',
    options: [
      'Porque el orden alfabético coincide entonces con el cronológico.',
      'Porque es el único formato que aceptan los sistemas de ficheros.',
      'Porque reduce el tamaño del fichero.',
      'Porque impide que el fichero se modifique.',
    ],
    correct: 0,
    explanation:
      'Con año-mes-día, ordenar alfabéticamente ordena también en el tiempo, sin hacer nada más.',
  },
  {
    concept: 'estructura-carpetas',
    stem: '¿Cuál de estos nombres seguirá significando algo dentro de dos años?',
    options: [
      'definitivo2.docx',
      'final_v3_bueno.docx',
      '2026-03-04-acta-reunion.docx',
      'nuevo.docx',
    ],
    correct: 2,
    explanation:
      'Describe qué es y cuándo. Los otros describen el momento en que se guardaron, que es justo lo que se olvida.',
  },
  {
    concept: 'copias-seguridad',
    stem: 'En la regla 3-2-1, ¿qué riesgo cubre específicamente la copia guardada fuera del sitio?',
    options: [
      'Que se borre un fichero por error.',
      'Que falle un tipo concreto de disco.',
      'Que el problema afecte al lugar donde están las demás.',
      'Que la copia se haga con poca frecuencia.',
    ],
    correct: 2,
    explanation:
      'Cada parte de la regla cubre un modo de fallo distinto. La copia externa es la que cubre que el problema sea el edificio.',
  },
  {
    concept: 'copias-seguridad',
    stem: '¿Qué convierte una copia de seguridad en algo más que una suposición?',
    options: [
      'Hacerla todos los días.',
      'Guardarla cifrada.',
      'Haber restaurado a partir de ella al menos una vez.',
      'Tenerla en un disco nuevo.',
    ],
    correct: 2,
    explanation:
      'Hasta que no se restaura, no se sabe si sirve. Una copia nunca restaurada es un fichero grande del que se espera mucho.',
  },
  {
    concept: 'copias-seguridad',
    stem: 'Si las copias se hacen una vez al día, ¿qué define eso exactamente?',
    options: [
      'Cuánto tarda la restauración.',
      'Cuánto trabajo se pierde como máximo.',
      'Cuántas copias hay que conservar.',
      'Si la copia está cifrada o no.',
    ],
    correct: 1,
    explanation:
      'La frecuencia define la pérdida máxima. Con copia diaria, el peor caso es perder un día de trabajo.',
  },
  {
    concept: 'contrasenas',
    stem: '¿Qué hace sobre todo que una contraseña sea difícil de adivinar?',
    options: [
      'La cantidad de símbolos poco habituales.',
      'Su longitud.',
      'Cambiarla cada tres meses.',
      'Que empiece por mayúscula.',
    ],
    correct: 1,
    explanation:
      'La longitud es lo que más pesa. Los símbolos raros ayudan poco si la contraseña es corta, y complican recordarla.',
  },
  {
    concept: 'contrasenas',
    stem: '¿Por qué conviene una contraseña distinta en cada servicio?',
    options: [
      'Porque así son más fáciles de recordar.',
      'Porque el riesgo real es que se filtre de un sitio y la prueben en los demás.',
      'Porque los servicios lo exigen por ley.',
      'Porque reduce el tiempo de inicio de sesión.',
    ],
    correct: 1,
    explanation:
      'El ataque habitual no es adivinar la tuya: es reutilizar una filtrada. Contraseñas distintas cortan esa cadena.',
  },
  {
    concept: 'firma-electronica',
    stem: '¿Qué permite comprobar una firma electrónica sobre un documento?',
    options: [
      'Que el documento está escrito correctamente.',
      'Que no ha cambiado desde que se firmó, y quién lo firmó.',
      'Que el documento ha sido registrado.',
      'Que el documento no puede copiarse.',
    ],
    correct: 1,
    explanation:
      'La firma vincula un documento concreto con quien firma, y permite detectar cualquier cambio posterior. No dice nada sobre su contenido.',
  },
  {
    concept: 'firma-electronica',
    stem: 'Si un documento firmado electrónicamente se modifica después, ¿qué ocurre con la firma?',
    options: [
      'Se actualiza sola.',
      'Sigue siendo válida si el cambio es pequeño.',
      'Deja de verificar, y la comprobación lo detecta.',
      'Se traslada automáticamente a la versión nueva.',
    ],
    correct: 2,
    explanation:
      'Ese es justamente su propósito: cualquier modificación posterior hace que la comprobación falle.',
  },
];

export const OPTION_KEYS = ['A', 'B', 'C', 'D'];
