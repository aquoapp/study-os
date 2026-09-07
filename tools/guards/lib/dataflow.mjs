/**
 * Propagación conservadora de **hechos** sobre valores, por punto fijo.
 *
 * ---------------------------------------------------------------------------
 * Por qué existe
 *
 * Las guardas anteriores reconocían formas: «alias por variable», «alias por
 * desestructuración», «`.bind()`», «paso como argumento»… Cada evasión nueva era un
 * `if` nuevo, y la siguiente evasión era siempre la forma que faltaba. Un análisis
 * por formas no converge: el espacio de formas es infinito.
 *
 * Aquí un valor lleva **hechos** —etiquetas—, y los hechos siguen al valor por
 * donde vaya. Se itera hasta que ningún hecho cambia. Las guardas solo dicen qué
 * hechos nacen dónde y qué hechos no pueden llegar a qué sitio.
 *
 * ---------------------------------------------------------------------------
 * Tres clases de hecho
 *
 * **Capacidades** («este valor es `.update`», «este valor es un miembro que no sé
 * nombrar»): basta con que lleguen por **algún** camino. Se unen.
 *
 * **Procedencia** («este valor deriva del verificador»): tiene que llegar por
 * **todos** los caminos. Las etiquetas declaradas en `mustLabels` tienen una
 * **etiqueta de veneno**: en cada unión, escritura o transformación en la que falte
 * la etiqueta obligatoria, se añade el veneno, y el veneno nunca se quita.
 *
 * **Funciones**: cada función del fichero es también un valor, con una etiqueta
 * interna `fn:<n>`. Así una función viaja igual que cualquier otro hecho —por
 * alias, propiedad, contenedor, argumento o retorno—, y **toda invocación** de un
 * valor que lleve `fn:<n>` resuelve los retornos de esa función y vierte los
 * argumentos en sus parámetros. Da igual que el callee sea un identificador, una
 * IIFE, una función expresión, una propiedad de objeto o un alias tardío.
 *
 * ---------------------------------------------------------------------------
 * Reglas generales, no excepciones
 *
 * · **Contenedores.** Lo que entra en un array, un objeto con clave desconocida, un
 *   `Map` o un `Set` vive en la ubicación de elementos `.[]` de ese contenedor. Y
 *   **cualquier** operación que pueda recuperar un elemento —acceso indexado,
 *   desestructuración, y toda llamada a un método del contenedor: `at`, `pop`,
 *   `shift`, `find`, `get`, `values`, y también las que no conocemos— devuelve los
 *   hechos de `.[]`. No hay lista blanca de métodos: una recuperación no modelada
 *   desde un contenedor contaminado da un valor contaminado.
 *
 * · **Llamadas no modeladas.** Una llamada que no resuelve a ninguna función del
 *   fichero no puede convertir en silencio los hechos existentes en un conjunto
 *   vacío. Su resultado lleva la unión de los hechos de sus argumentos y de los
 *   elementos de su receptor —lo que entra, puede salir— y **el veneno de toda
 *   etiqueta obligatoria**: si no sabemos qué hace la función, no podemos afirmar
 *   que devuelva una identidad verificada, pero sí que puede devolver lo que le
 *   dimos.
 *
 * · **Mutación.** Asignación compuesta, `++`/`--`, escritura de propiedad,
 *   `Object.assign`, `Reflect.set`, `Object.defineProperty` añaden la etiqueta de
 *   mutación al valor y a sus propiedades.
 *
 * · **Constructores de consulta.** Las etiquetas declaradas en `callInherits`
 *   pasan del receptor al resultado de cualquier llamada a método sobre él:
 *   `db.from('t').select()` es tan consulta como `db.from('t')`.
 *
 * ---------------------------------------------------------------------------
 * Ubicaciones
 *
 *   d:<n>          una declaración (variable, parámetro, importación, función…)
 *   <k>.prop       una propiedad, un nivel
 *   <k>.[]         los elementos de un contenedor
 *   <k>.*          claves no resolubles
 *   <k>.()         el valor de retorno del valor-función guardado en <k>
 *   o:<n>          un literal de objeto o array, o un `new` (temporal)
 *   f:<n>          una función expresión, flecha o método
 *   g:<nombre>     un global (no declarado en el fichero)
 *
 * Aliasar una ubicación a otra copia también sus propiedades, elementos y retorno.
 *
 * ---------------------------------------------------------------------------
 * Qué NO es
 *
 * No es sensible al flujo —una escritura en cualquier punto afecta a todo el
 * fichero—, no distingue instancias de una misma declaración en llamadas distintas,
 * no sigue valores fuera del fichero, y solo sigue un nivel de propiedades. Cada
 * simplificación produce **más** hechos, no menos. Si el punto fijo no converge en
 * `MAX_ITERATIONS`, `reachedLimit` es `true` y las guardas fallan cerrado.
 * ---------------------------------------------------------------------------
 */

import { ts } from './ast.mjs';

const MAX_ITERATIONS = 48;

/** Prefijo de la etiqueta interna de valor-función. Las guardas no la ven. */
const FN = ' fn:';

/** Métodos que meten valores en un contenedor: desde qué argumento va el valor. */
const CONTAINER_INSERTERS = new Map([
  ['push', 0],
  ['unshift', 0],
  ['add', 0],
  ['set', 1],
  ['splice', 2],
  ['fill', 0],
]);

/** Llamadas que mutan su primer argumento. */
const MUTATORS = new Map([
  ['Object.assign', 0],
  ['Object.defineProperty', 0],
  ['Object.defineProperties', 0],
  ['Object.setPrototypeOf', 0],
  ['Reflect.set', 0],
  ['Reflect.defineProperty', 0],
  ['Reflect.deleteProperty', 0],
  ['Reflect.setPrototypeOf', 0],
]);

const COMPOUND_ASSIGNMENTS = new Set([
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
]);

/** Operadores binarios cuyo resultado combina ambos operandos. */
const JOINING_BINARY = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.CommaToken,
]);

function unwrap(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isAwaitExpression(current) ||
      ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

const isFunctionLike = (node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node);

/**
 * @typedef {{
 *   seed?: (node: import('typescript').Node) => Iterable<string> | null | undefined,
 *   resolveString?: (node: import('typescript').Node) => string | null,
 *   mustLabels?: Iterable<string>,
 *   poisonLabel?: string,
 *   mutatedLabel?: string,
 *   propertyInherits?: (label: string, property: string | null) => boolean,
 *   callInherits?: (label: string) => boolean,
 * }} DataflowConfig
 */

/**
 * @param {import('typescript').SourceFile} sourceFile
 * @param {(id: import('typescript').Node) => {declaration: import('typescript').Node} | null} resolve
 * @param {DataflowConfig} config
 */
export function analyzeDataflow(sourceFile, resolve, config = {}) {
  const seed = config.seed ?? (() => null);
  const resolveString = config.resolveString ?? (() => null);
  const mustLabels = new Set(config.mustLabels ?? []);
  const poisonLabel = config.poisonLabel ?? 'poisoned';
  const mutatedLabel = config.mutatedLabel ?? 'mutated';
  const propertyInherits = config.propertyInherits ?? (() => false);
  const callInherits = config.callInherits ?? (() => false);

  /** @type {Map<string, Set<string>>} */
  const store = new Map();
  const ids = new WeakMap();
  /** @type {Map<number, import('typescript').Node>} */
  const functionsById = new Map();
  let nextId = 1;
  let changed = false;
  /** Fase de veneno: los hechos han convergido y los desacuerdos ya son reales. */
  let poisonMode = false;

  const idOf = (node) => {
    let id = ids.get(node);
    if (id === undefined) {
      id = nextId;
      nextId += 1;
      ids.set(node, id);
    }
    return id;
  };

  const declKey = (declaration) => `d:${idOf(declaration)}`;

  /** Etiqueta de valor-función de un nodo función, registrándolo. */
  const fnLabel = (functionNode) => {
    const id = idOf(functionNode);
    functionsById.set(id, functionNode);
    return `${FN}${id}`;
  };

  /** Clave de la ubicación que representa a la propia función. */
  const fnKey = (functionNode) =>
    ts.isFunctionDeclaration(functionNode) ? declKey(functionNode) : `f:${idOf(functionNode)}`;

  const facts = (key) => store.get(key) ?? new Set();

  const addFacts = (key, incoming) => {
    if (!key) return;
    let set = store.get(key);
    if (!set) {
      set = new Set();
      store.set(key, set);
    }
    for (const label of incoming) {
      if (!set.has(label)) {
        set.add(label);
        changed = true;
      }
    }
  };

  /**
   * Une conjuntos aplicando la regla de «todos los caminos».
   *
   * El veneno por desacuerdo solo se emite en la **pasada de veneno**, cuando los
   * hechos ya han convergido. Emitirlo antes registraría como desacuerdo lo que solo
   * era un hecho todavía no calculado, y el veneno no se quita.
   */
  const join = (...sets) => {
    const result = new Set();
    for (const set of sets) for (const label of set) result.add(label);
    if (poisonMode) {
      for (const must of mustLabels) {
        if (sets.some((set) => !set.has(must))) result.add(poisonLabel);
      }
    }
    return result;
  };

  /** Lo que sale de una transformación desconocida: lo que entró, envenenado. */
  const opaque = (...sets) => {
    const result = new Set();
    for (const set of sets) for (const label of set) result.add(label);
    for (const must of mustLabels) {
      result.delete(must);
      result.add(poisonLabel);
    }
    return result;
  };

  /**
   * Escribe en una ubicación.
   *
   * Una ubicación que recibe **a la vez** valores con y sin una etiqueta obligatoria
   * queda envenenada: es la regla de «todos los caminos» aplicada a las escrituras,
   * en cualquier orden textual. Una ubicación que solo recibe valores sin la etiqueta
   * no está envenenada: simplemente no la tiene. La diferencia importa para los
   * contenedores: `[identity]` no es una identidad, pero sus elementos sí.
   */
  const write = (key, incoming, aliasFrom = null) => {
    if (!key) return;
    const withPoison = new Set(incoming);
    if (poisonMode) {
      // Con los hechos convergidos: si esta escritura no trae la etiqueta y la
      // ubicación ya la tiene por otra escritura, hay desacuerdo entre caminos.
      const existing = facts(key);
      for (const must of mustLabels) {
        if (!incoming.has(must) && existing.has(must)) withPoison.add(poisonLabel);
      }
    }
    addFacts(key, withPoison);
    if (aliasFrom && aliasFrom !== key) aliasProperties(aliasFrom, key);
  };

  const aliasProperties = (fromKey, toKey) => {
    const prefix = `${fromKey}.`;
    for (const [key, set] of [...store]) {
      if (key.startsWith(prefix)) addFacts(`${toKey}.${key.slice(prefix.length)}`, set);
    }
  };

  const mutate = (key) => {
    if (!key) return;
    addFacts(key, [mutatedLabel]);
    const prefix = `${key}.`;
    for (const storedKey of [...store.keys()]) {
      if (storedKey.startsWith(prefix)) addFacts(storedKey, [mutatedLabel]);
    }
    addFacts(`${key}.*`, [mutatedLabel]);
  };

  /** Los hechos de los elementos de un contenedor, con lo que hereda. */
  const elementFacts = (containerKey) => {
    const result = new Set(facts(`${containerKey}.[]`));
    for (const label of facts(`${containerKey}.*`)) result.add(label);
    for (const label of facts(containerKey)) {
      if (propertyInherits(label, null)) result.add(label);
    }
    return result;
  };

  /** Lectura de una ubicación, con lo que hereda de su objeto. */
  const readKey = (key) => {
    const result = new Set(facts(key));
    const dot = key.lastIndexOf('.');
    if (dot > 0) {
      const base = key.slice(0, dot);
      const property = key.slice(dot + 1);
      for (const label of facts(`${base}.*`)) result.add(label);
      if (property === '*' || property === '[]' || /^\d+$/.test(property)) {
        for (const label of facts(`${base}.[]`)) result.add(label);
      }
      for (const label of facts(base)) {
        if (propertyInherits(label, property === '*' ? null : property)) result.add(label);
      }
    }
    return result;
  };

  // ------------------------------------------------------------- ubicaciones
  const literalKey = (node) => {
    if (!node) return null;
    const current = unwrap(node);
    if (ts.isNumericLiteral(current)) return current.text;
    return resolveString(current);
  };

  /** Clave de la ubicación que **denota** una expresión, si denota alguna. */
  const keyOf = (node) => {
    const current = unwrap(node);
    if (!current) return null;

    if (ts.isIdentifier(current)) {
      const binding = resolve(current);
      return binding ? declKey(binding.declaration) : `g:${current.text}`;
    }
    if (ts.isPropertyAccessExpression(current)) {
      const base = keyOf(current.expression);
      return base ? `${base}.${current.name.text}` : null;
    }
    if (ts.isElementAccessExpression(current)) {
      const base = keyOf(current.expression);
      if (!base) return null;
      const literal = literalKey(current.argumentExpression);
      return `${base}.${literal ?? '*'}`;
    }
    if (
      ts.isObjectLiteralExpression(current) ||
      ts.isArrayLiteralExpression(current) ||
      ts.isNewExpression(current)
    ) {
      return `o:${idOf(current)}`;
    }
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      return fnKey(current);
    }
    if (ts.isCallExpression(current)) {
      const callee = unwrap(current.expression);
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'bind') {
        return keyOf(callee.expression);
      }
      return `c:${idOf(current)}`;
    }
    return null;
  };

  // --------------------------------------------------------------- lectura
  const memo = new Map();

  /** Hechos que lleva el valor de una expresión, en la iteración actual. */
  const factsOf = (node) => {
    if (!node) return new Set();
    const cached = memo.get(node);
    if (cached) return cached;
    memo.set(node, new Set());
    const result = compute(node);
    memo.set(node, result);
    return result;
  };

  const withSeed = (node, set) => {
    const extra = seed(node);
    if (extra) for (const label of extra) set.add(label);
    return set;
  };

  /** Funciones del fichero a las que puede referirse un valor. */
  const functionsIn = (labels) => {
    const found = [];
    for (const label of labels) {
      if (label.startsWith(FN)) {
        const node = functionsById.get(Number(label.slice(FN.length)));
        if (node) found.push(node);
      }
    }
    return found;
  };

  /** Hechos del resultado de una llamada. */
  const callResult = (call) => {
    const callee = unwrap(call.expression);

    // `f.bind(x)` devuelve `f`, no la invoca.
    if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'bind') {
      return new Set(factsOf(callee.expression));
    }

    // `f.call(...)` y `f.apply(...)` invocan `f`.
    let target = callee;
    if (
      ts.isPropertyAccessExpression(callee) &&
      (callee.name.text === 'call' || callee.name.text === 'apply')
    ) {
      target = unwrap(callee.expression);
    }

    const targetFacts = factsOf(target);
    const functions = functionsIn(targetFacts);

    // Resuelve a funciones del fichero: sus retornos, unidos con «todos los caminos».
    if (functions.length > 0) {
      const returns = functions.map((fn) => readKey(`${fnKey(fn)}.()`));
      const result = join(...returns);
      // Y el resultado también puede ser lo que la función devuelve de sus propios
      // parámetros: ya está en `.()` porque los parámetros reciben los argumentos.
      return result;
    }

    // No modelada. Lo que entró puede salir; lo obligatorio no se puede afirmar.
    const inputs = call.arguments.map((argument) =>
      factsOf(ts.isSpreadElement(argument) ? argument.expression : argument),
    );

    if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
      const receiver = target.expression;
      const receiverKey = keyOf(receiver);
      const receiverFacts = factsOf(receiver);

      // Recuperación desde un contenedor: cualquier método puede devolver un
      // elemento. `at`, `pop`, `shift`, `find`, `get`, `values`… y los que no
      // conocemos.
      if (receiverKey) inputs.push(elementFacts(receiverKey));

      const result = opaque(...inputs);
      // Constructores de consulta: el resultado sigue siendo la consulta.
      for (const label of receiverFacts) if (callInherits(label)) result.add(label);
      return result;
    }

    return opaque(...inputs);
  };

  const compute = (node) => {
    const current = unwrap(node);
    if (current !== node) return factsOf(current);

    if (ts.isIdentifier(node)) {
      const key = keyOf(node);
      return withSeed(node, key ? readKey(key) : new Set());
    }

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const key = keyOf(node);
      const result = key ? readKey(key) : new Set();
      if (!key) {
        // Base sin ubicación (resultado de una llamada, etc.): hereda lo heredable,
        // y si la base es un contenedor contaminado, sus elementos.
        const property = ts.isPropertyAccessExpression(node)
          ? node.name.text
          : literalKey(node.argumentExpression);
        for (const label of factsOf(node.expression)) {
          if (propertyInherits(label, property)) result.add(label);
        }
      }
      return withSeed(node, result);
    }

    if (ts.isCallExpression(node)) {
      // Una llamada que la guarda siembra con una etiqueta obligatoria está
      // modelada por definición: es el verificador. No se envenena por desconocida.
      const sown = seed(node);
      const sownSet = new Set(sown ?? []);
      for (const must of mustLabels) if (sownSet.has(must)) return sownSet;
      return withSeed(node, callResult(node));
    }

    if (ts.isNewExpression(node)) {
      return withSeed(node, new Set(facts(keyOf(node))));
    }

    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      return withSeed(node, new Set([fnLabel(node)]));
    }

    if (ts.isConditionalExpression(node)) {
      return withSeed(node, join(factsOf(node.whenTrue), factsOf(node.whenFalse)));
    }

    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        return withSeed(node, new Set(factsOf(node.right)));
      }
      if (COMPOUND_ASSIGNMENTS.has(node.operatorToken.kind)) {
        return withSeed(node, join(factsOf(node.left), factsOf(node.right)));
      }
      if (JOINING_BINARY.has(node.operatorToken.kind)) {
        return withSeed(node, join(factsOf(node.left), factsOf(node.right)));
      }
      return withSeed(node, opaque(factsOf(node.left), factsOf(node.right)));
    }

    if (ts.isTemplateExpression(node)) {
      const parts = node.templateSpans.map((span) => factsOf(span.expression));
      return withSeed(node, parts.length ? opaque(...parts) : new Set());
    }

    if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) {
      return withSeed(node, new Set(facts(keyOf(node))));
    }

    if (ts.isSpreadElement(node)) return factsOf(node.expression);

    return withSeed(node, new Set());
  };

  // ------------------------------------------------------------- escrituras
  const writePattern = (pattern, sourceKey, sourceFacts) => {
    if (!pattern) return;
    if (ts.isIdentifier(pattern)) {
      write(keyOf(pattern), sourceFacts, sourceKey);
      return;
    }
    if (ts.isObjectBindingPattern(pattern)) {
      for (const element of pattern.elements) {
        if (!ts.isBindingElement(element)) continue;
        if (element.dotDotDotToken) {
          write(keyOf(element.name), sourceFacts, sourceKey);
          continue;
        }
        const source = element.propertyName ?? element.name;
        const property =
          ts.isIdentifier(source) || ts.isStringLiteralLike(source)
            ? source.text
            : ts.isComputedPropertyName(source)
              ? literalKey(source.expression)
              : null;
        const subKey = sourceKey ? `${sourceKey}.${property ?? '*'}` : null;
        const subFacts = subKey ? readKey(subKey) : new Set();
        for (const label of sourceFacts) {
          if (propertyInherits(label, property)) subFacts.add(label);
        }
        const sown = seed(element);
        if (sown) for (const label of sown) subFacts.add(label);
        writePattern(element.name, subKey, subFacts);
      }
      return;
    }
    if (ts.isArrayBindingPattern(pattern)) {
      pattern.elements.forEach((element, index) => {
        if (!ts.isBindingElement(element)) return;
        const subKey = sourceKey ? `${sourceKey}.${element.dotDotDotToken ? '[]' : index}` : null;
        const subFacts = subKey ? readKey(subKey) : new Set();
        // Desestructurar un array recupera elementos: lo que haya en `.[]` llega.
        if (sourceKey) for (const label of elementFacts(sourceKey)) subFacts.add(label);
        // Si la fuente es el resultado de una llamada —sin ubicación propia—, sus
        // hechos son los de sus elementos: lo que entró en la llamada puede salir.
        if (!sourceKey || sourceKey.startsWith('c:')) {
          for (const label of sourceFacts) subFacts.add(label);
        }
        writePattern(element.name, subKey, subFacts);
      });
    }
  };

  /** `({ a: x, b } = y)` · desestructuración en asignación. */
  const writeAssignmentPattern = (pattern, sourceKey, sourceFacts) => {
    if (ts.isObjectLiteralExpression(pattern)) {
      for (const property of pattern.properties) {
        let name = null;
        let target = null;
        if (ts.isPropertyAssignment(property)) {
          name =
            ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
              ? property.name.text
              : ts.isComputedPropertyName(property.name)
                ? literalKey(property.name.expression)
                : null;
          target = property.initializer;
        } else if (ts.isShorthandPropertyAssignment(property)) {
          name = property.name.text;
          target = property.name;
        } else if (ts.isSpreadAssignment(property)) {
          write(keyOf(property.expression), sourceFacts, sourceKey);
          continue;
        }
        if (!target) continue;
        const subKey = sourceKey ? `${sourceKey}.${name ?? '*'}` : null;
        const subFacts = subKey ? readKey(subKey) : new Set();
        for (const label of sourceFacts) if (propertyInherits(label, name)) subFacts.add(label);
        const sown = seed(property);
        if (sown) for (const label of sown) subFacts.add(label);
        writeTarget(target, subKey, subFacts);
      }
      return;
    }
    if (ts.isArrayLiteralExpression(pattern)) {
      pattern.elements.forEach((element, index) => {
        if (ts.isOmittedExpression(element)) return;
        const isRest = ts.isSpreadElement(element);
        const target = isRest ? element.expression : element;
        const subKey = sourceKey ? `${sourceKey}.${isRest ? '[]' : index}` : null;
        const subFacts = subKey ? readKey(subKey) : new Set();
        if (sourceKey) for (const label of elementFacts(sourceKey)) subFacts.add(label);
        if (!sourceKey || sourceKey.startsWith('c:')) {
          for (const label of sourceFacts) subFacts.add(label);
        }
        writeTarget(target, subKey, subFacts);
      });
    }
  };

  /** Escritura sobre un destino de asignación: identificador, propiedad o patrón. */
  const writeTarget = (target, sourceKey, sourceFacts) => {
    const current = unwrap(target);
    if (ts.isObjectLiteralExpression(current) || ts.isArrayLiteralExpression(current)) {
      writeAssignmentPattern(current, sourceKey, sourceFacts);
      return;
    }
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      write(keyOf(current), sourceFacts, sourceKey);
      mutate(keyOf(current.expression));
      return;
    }
    write(keyOf(current), sourceFacts, sourceKey);
  };

  const enclosingFunction = (node) => {
    let current = node.parent;
    while (current) {
      if (isFunctionLike(current)) return current;
      current = current.parent;
    }
    return null;
  };

  /** Vierte los argumentos de una llamada en los parámetros de una función. */
  const bindArguments = (call, fn, through) => {
    if (!fn.parameters) return;
    fn.parameters.forEach((parameter, index) => {
      let incoming;
      let sourceKey = null;
      if (through === 'apply') {
        const array = call.arguments[1];
        const arrayKey = array ? keyOf(array) : null;
        incoming = arrayKey ? elementFacts(arrayKey) : new Set();
        sourceKey = arrayKey ? `${arrayKey}.[]` : null;
      } else {
        const offset = through === 'call' ? 1 : 0;
        const argument = call.arguments[index + offset];
        if (!argument) return;
        const value = ts.isSpreadElement(argument) ? argument.expression : argument;
        incoming = factsOf(value);
        sourceKey = keyOf(value);
      }
      if (parameter.dotDotDotToken) {
        const restKey = keyOf(parameter.name);
        if (restKey) addFacts(`${restKey}.[]`, incoming);
        return;
      }
      writePattern(parameter.name, sourceKey, incoming);
    });
  };

  const transfer = (node) => {
    // Cada función es un valor. Las declaradas viven en su propia declaración.
    if (ts.isFunctionDeclaration(node) && node.name) {
      addFacts(declKey(node), [fnLabel(node)]);
      return;
    }
    if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
      write(`${fnKey(node)}.()`, factsOf(node.body), keyOf(node.body));
      return;
    }
    if (ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent)) {
      const name =
        ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name) ? node.name.text : null;
      addFacts(`${keyOf(node.parent)}.${name ?? '*'}`, [fnLabel(node)]);
      return;
    }

    if (ts.isReturnStatement(node) && node.expression) {
      const owner = enclosingFunction(node);
      if (owner) write(`${fnKey(owner)}.()`, factsOf(node.expression), keyOf(node.expression));
      return;
    }

    // Literales de objeto y array: sus propiedades viven en `o:<n>.prop`.
    if (ts.isObjectLiteralExpression(node)) {
      const key = keyOf(node);
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          const name =
            ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
              ? property.name.text
              : ts.isComputedPropertyName(property.name)
                ? literalKey(property.name.expression)
                : null;
          addFacts(`${key}.${name ?? '*'}`, factsOf(property.initializer));
          const sub = keyOf(property.initializer);
          if (sub) aliasProperties(sub, `${key}.${name ?? '*'}`);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          addFacts(`${key}.${property.name.text}`, factsOf(property.name));
          const sub = keyOf(property.name);
          if (sub) aliasProperties(sub, `${key}.${property.name.text}`);
        } else if (ts.isSpreadAssignment(property)) {
          const sub = keyOf(property.expression);
          if (sub) aliasProperties(sub, key);
          addFacts(`${key}.*`, factsOf(property.expression));
        }
      }
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      const key = keyOf(node);
      node.elements.forEach((element, index) => {
        if (ts.isOmittedExpression(element)) return;
        if (ts.isSpreadElement(element)) {
          const sub = keyOf(element.expression);
          addFacts(`${key}.[]`, factsOf(element.expression));
          if (sub) addFacts(`${key}.[]`, elementFacts(sub));
          return;
        }
        addFacts(`${key}.${index}`, factsOf(element));
        addFacts(`${key}.[]`, factsOf(element));
        const sub = keyOf(element);
        if (sub) {
          aliasProperties(sub, `${key}.${index}`);
          aliasProperties(sub, `${key}.[]`);
        }
      });
      return;
    }
    if (ts.isNewExpression(node) && node.arguments) {
      // `new Map([[k, v], …])`, `new Set([v, …])`, `new Array(v, …)`: lo que se pase
      // al constructor puede acabar como elemento del contenedor, un nivel o dos.
      const key = keyOf(node);
      for (const argument of node.arguments) {
        const value = ts.isSpreadElement(argument) ? argument.expression : argument;
        addFacts(`${key}.[]`, factsOf(value));
        const sub = keyOf(value);
        if (sub) {
          addFacts(`${key}.[]`, elementFacts(sub));
          for (const [storedKey, set] of [...store]) {
            if (storedKey.startsWith(`${sub}.`) && storedKey.endsWith('.[]')) {
              addFacts(`${key}.[]`, set);
            }
          }
        }
      }
      return;
    }

    if (ts.isVariableDeclaration(node) && node.initializer) {
      writePattern(node.name, keyOf(node.initializer), factsOf(node.initializer));
      return;
    }

    if (ts.isBinaryExpression(node)) {
      const kind = node.operatorToken.kind;
      if (kind === ts.SyntaxKind.EqualsToken) {
        writeTarget(node.left, keyOf(node.right), factsOf(node.right));
        return;
      }
      if (COMPOUND_ASSIGNMENTS.has(kind)) {
        const incoming = join(factsOf(node.left), factsOf(node.right));
        incoming.add(mutatedLabel);
        writeTarget(node.left, null, incoming);
        mutate(keyOf(node.left));
      }
      return;
    }

    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      mutate(keyOf(node.operand));
      return;
    }

    if (ts.isDeleteExpression(node)) {
      const current = unwrap(node.expression);
      if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
        mutate(keyOf(current.expression));
      }
      return;
    }

    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);

      // Mutadores evidentes: `Object.assign(t, …)`, `Reflect.set(t, …)`…
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
        const qualified = `${callee.expression.text}.${callee.name.text}`;
        const argumentIndex = MUTATORS.get(qualified);
        if (argumentIndex !== undefined && resolve(callee.expression) === null) {
          mutate(keyOf(node.arguments[argumentIndex]));
        }
      }

      // Inserción en un contenedor: el contenedor pasa a llevar lo que guarda.
      if (ts.isPropertyAccessExpression(callee) && CONTAINER_INSERTERS.has(callee.name.text)) {
        const container = keyOf(callee.expression);
        if (container) {
          const from = CONTAINER_INSERTERS.get(callee.name.text);
          for (const argument of node.arguments.slice(from)) {
            const value = ts.isSpreadElement(argument) ? argument.expression : argument;
            addFacts(`${container}.[]`, factsOf(value));
            const sub = keyOf(value);
            if (sub) aliasProperties(sub, `${container}.[]`);
          }
        }
      }

      // Toda invocación de un valor-función vierte los argumentos en sus parámetros.
      let target = callee;
      let through = null;
      if (
        ts.isPropertyAccessExpression(callee) &&
        (callee.name.text === 'call' || callee.name.text === 'apply')
      ) {
        target = unwrap(callee.expression);
        through = callee.name.text;
      }
      for (const fn of functionsIn(factsOf(target))) bindArguments(node, fn, through);
    }
  };

  // --------------------------------------------------------------- punto fijo
  const visitAll = (node, visitor) => {
    visitor(node);
    ts.forEachChild(node, (child) => visitAll(child, visitor));
  };

  /**
   * Dos fases, repetidas hasta que nada cambia.
   *
   * Primero se propagan los hechos hasta el punto fijo **sin** emitir veneno por
   * desacuerdo. Después, con todos los hechos en su sitio, una pasada de veneno
   * compara cada escritura y cada unión con lo que la ubicación ya tiene. Si aparece
   * veneno nuevo, hay que propagarlo —una identidad envenenada envenena sus campos,
   * sus alias y sus retornos—, así que se vuelve a la primera fase. El veneno solo
   * crece, y termina.
   *
   * Hacerlo en una sola fase registraría como desacuerdo lo que solo era un hecho
   * todavía no calculado en esa iteración, y el veneno no se quita.
   */
  let iterations = 0;
  let outer = 0;
  let newPoison;
  do {
    do {
      changed = false;
      memo.clear();
      visitAll(sourceFile, transfer);
      iterations += 1;
    } while (changed && iterations < MAX_ITERATIONS);

    poisonMode = true;
    changed = false;
    memo.clear();
    visitAll(sourceFile, transfer);
    poisonMode = false;
    newPoison = changed;
    outer += 1;
  } while (newPoison && iterations < MAX_ITERATIONS && outer < MAX_ITERATIONS);

  memo.clear();

  /**
   * El callee «real» de una llamada: para `f.call(...)` y `f.apply(...)` es `f`.
   * Para `f.bind(...)(...)` es `f`. Para todo lo demás, el propio callee.
   */
  const effectiveCallee = (call) => {
    let callee = unwrap(call.expression);
    while (
      ts.isCallExpression(callee) &&
      ts.isPropertyAccessExpression(unwrap(callee.expression)) &&
      unwrap(callee.expression).name.text === 'bind'
    ) {
      callee = unwrap(unwrap(callee.expression).expression);
    }
    if (
      ts.isPropertyAccessExpression(callee) &&
      (callee.name.text === 'call' || callee.name.text === 'apply')
    ) {
      return { node: unwrap(callee.expression), through: callee.name.text };
    }
    return { node: callee, through: null };
  };

  /** Hechos visibles para las guardas: sin las etiquetas internas (empiezan por espacio). */
  const publicFacts = (node) => {
    const result = new Set();
    for (const label of factsOf(node)) if (!label.startsWith(' ')) result.add(label);
    return result;
  };

  return {
    factsOf: publicFacts,
    keyOf,
    readKey,
    effectiveCallee,
    iterations,
    reachedLimit: iterations >= MAX_ITERATIONS,
  };
}

export { unwrap };
