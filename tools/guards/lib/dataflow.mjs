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
 * Aquí se hace lo contrario. Un valor lleva **hechos** —etiquetas—, y los hechos
 * siguen al valor por donde vaya: declaraciones, asignaciones simples y compuestas,
 * desestructuración, propiedades de objeto y elementos de array, `bind`/`call`/
 * `apply`, retornos y argumentos de funciones locales, alias intermedios, accesos
 * directos y computados. Se itera hasta que ningún hecho cambia. Las guardas solo
 * dicen qué hechos nacen dónde y qué hechos no pueden llegar a qué sitio.
 *
 * ---------------------------------------------------------------------------
 * Dos clases de hecho
 *
 * **Capacidades** («este valor es `.update`», «este valor es un miembro que no sé
 * nombrar»): basta con que lleguen por **algún** camino. Se unen.
 *
 * **Procedencia** («este valor deriva del verificador»): tiene que llegar por
 * **todos** los caminos. Un valor que en un `?:` es verificado por una rama y crudo
 * por la otra no está verificado. Para esto las etiquetas declaradas en
 * `mustLabels` tienen una **etiqueta de veneno**: en cada unión o escritura en la
 * que falte la etiqueta obligatoria, se añade el veneno, y el veneno nunca se
 * quita. Envenenar gana siempre, en cualquier orden textual.
 *
 * Y toda **mutación** —asignación compuesta, `++`/`--`, escritura de propiedad,
 * `Object.assign`, `Reflect.set`, `Object.defineProperty`— añade la etiqueta de
 * mutación al valor y a sus propiedades. Un valor mutado ya no es el que salió del
 * verificador.
 *
 * ---------------------------------------------------------------------------
 * Ubicaciones
 *
 * Los hechos viven en **ubicaciones** con clave de texto:
 *
 *   d:<n>          una declaración (variable, parámetro, importación, función…)
 *   d:<n>.prop     una propiedad de esa declaración, un nivel
 *   d:<n>.*        «cualquier propiedad o elemento»: arrays y claves no resolubles
 *   o:<n>          un literal de objeto o array (temporal)
 *   ret:<n>        el valor de retorno de una función local
 *   g:<nombre>     un global (no declarado en el fichero)
 *
 * Aliasar una ubicación a otra copia también sus propiedades: `const x = y` hace
 * que `x.a` vea lo que había en `y.a`. Un nivel es suficiente para todo lo que las
 * guardas necesitan, y mantiene el análisis finito y rápido.
 *
 * ---------------------------------------------------------------------------
 * Qué NO es
 *
 * No es sensible al flujo —una escritura en cualquier punto afecta a todo el
 * fichero—, no distingue instancias de una misma declaración en llamadas
 * distintas, y no sigue valores fuera del fichero. Todas esas simplificaciones
 * producen **más** hechos, no menos: más capacidades detectadas, más veneno. Es la
 * dirección correcta para un control.
 * ---------------------------------------------------------------------------
 */

import { ts } from './ast.mjs';

const MAX_ITERATIONS = 32;

const INDIRECT_INVOKERS = new Set(['bind', 'call', 'apply']);

/** Métodos que meten valores en un contenedor. */
const CONTAINER_INSERTERS = new Set(['push', 'unshift', 'set', 'add']);

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

/**
 * @typedef {{
 *   seed?: (node: import('typescript').Node) => Iterable<string> | null | undefined,
 *   resolveString?: (node: import('typescript').Node) => string | null,
 *   mustLabels?: Iterable<string>,
 *   poisonLabel?: string,
 *   mutatedLabel?: string,
 *   propertyInherits?: (label: string, property: string | null) => boolean,
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

  /** @type {Map<string, Set<string>>} */
  const store = new Map();
  const ids = new WeakMap();
  let nextId = 1;
  let changed = false;

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

  /** Une conjuntos aplicando la regla de «todos los caminos». */
  const join = (...sets) => {
    const result = new Set();
    for (const set of sets) for (const label of set) result.add(label);
    for (const must of mustLabels) {
      if (sets.some((set) => !set.has(must))) result.add(poisonLabel);
    }
    return result;
  };

  /** Escribe en una ubicación. Lo que falte de obligatorio, envenena. */
  const write = (key, incoming, aliasFrom = null) => {
    if (!key) return;
    const withPoison = new Set(incoming);
    for (const must of mustLabels) if (!incoming.has(must)) withPoison.add(poisonLabel);
    addFacts(key, withPoison);
    if (aliasFrom && aliasFrom !== key) aliasProperties(aliasFrom, key);
  };

  const aliasProperties = (fromKey, toKey) => {
    const prefix = `${fromKey}.`;
    for (const [key, set] of store) {
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

  /** Lectura de una ubicación, con lo que hereda de su objeto. */
  const readKey = (key) => {
    const result = new Set(facts(key));
    const dot = key.lastIndexOf('.');
    if (dot > 0) {
      const base = key.slice(0, dot);
      const property = key.slice(dot + 1);
      for (const label of facts(`${base}.*`)) result.add(label);
      if (property === '*' || property === '[]' || /^d+$/.test(property)) {
        for (const label of facts(`${base}.[]`)) result.add(label);
      }
      for (const label of facts(base)) {
        if (propertyInherits(label, property === '*' ? null : property)) result.add(label);
      }
    }
    return result;
  };

  // ------------------------------------------------------------- ubicaciones
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
    if (ts.isObjectLiteralExpression(current) || ts.isArrayLiteralExpression(current)) {
      return `o:${idOf(current)}`;
    }
    if (ts.isCallExpression(current)) {
      const callee = unwrap(current.expression);
      if (ts.isPropertyAccessExpression(callee) && INDIRECT_INVOKERS.has(callee.name.text)) {
        // `f.bind(x)` denota lo mismo que `f`.
        return callee.name.text === 'bind' ? keyOf(callee.expression) : null;
      }
      const target = localFunction(callee);
      return target ? `ret:${idOf(target)}` : `c:${idOf(current)}`;
    }
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      return `ret:${idOf(current)}`;
    }
    return null;
  };

  const literalKey = (node) => {
    if (!node) return null;
    const current = unwrap(node);
    if (ts.isNumericLiteral(current)) return current.text;
    return resolveString(current);
  };

  /** La función local a la que resuelve un callee, si es una. */
  const localFunction = (callee) => {
    if (!ts.isIdentifier(callee)) return null;
    const binding = resolve(callee);
    if (!binding) return null;
    const declaration = binding.declaration;
    if (ts.isFunctionDeclaration(declaration)) return declaration;
    if (
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      (ts.isArrowFunction(unwrap(declaration.initializer)) ||
        ts.isFunctionExpression(unwrap(declaration.initializer)))
    ) {
      return unwrap(declaration.initializer);
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
    // Evita ciclos: mientras se calcula, un nodo se lee como vacío.
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
        // Base sin ubicación (resultado de una llamada, etc.): hereda lo heredable.
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
      const callee = unwrap(node.expression);
      if (ts.isPropertyAccessExpression(callee) && INDIRECT_INVOKERS.has(callee.name.text)) {
        // El resultado de `f.bind(x)` es `f`. `f.call(...)`/`f.apply(...)` es el
        // resultado de invocar `f`, que no seguimos: lo que importa —que se invocó
        // `f`— lo mira la guarda con `effectiveCallee`.
        if (callee.name.text === 'bind') return withSeed(node, new Set(factsOf(callee.expression)));
        return withSeed(node, new Set());
      }
      const key = keyOf(node);
      return withSeed(node, key ? readKey(key) : new Set());
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
      // Comparaciones y aritmética que no conserva el valor: nada que propagar,
      // pero sí veneno si algún operando era obligatorio y ya no lo es.
      return withSeed(node, join(new Set(), factsOf(node.left)));
    }

    if (ts.isTemplateExpression(node)) {
      const parts = node.templateSpans.map((span) => factsOf(span.expression));
      return withSeed(node, parts.length ? join(...parts) : new Set());
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
        // Un patrón también puede sembrar hechos: extraer `update` es tocar `update`.
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
        writeTarget(target, subKey, subKey ? readKey(subKey) : new Set());
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
      // Escribir una propiedad muta el objeto.
      write(keyOf(current), sourceFacts, sourceKey);
      mutate(keyOf(current.expression));
      return;
    }
    write(keyOf(current), sourceFacts, sourceKey);
  };

  const enclosingFunction = (node) => {
    let current = node.parent;
    while (current) {
      if (
        ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isMethodDeclaration(current)
      ) {
        return current;
      }
      current = current.parent;
    }
    return null;
  };

  const transfer = (node) => {
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
          addFacts(`${key}.[]`, factsOf(element.expression));
          const sub = keyOf(element.expression);
          if (sub) for (const label of facts(`${sub}.[]`)) addFacts(`${key}.[]`, [label]);
          return;
        }
        addFacts(`${key}.${index}`, factsOf(element));
        addFacts(`${key}.[]`, factsOf(element));
      });
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
        return;
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

      // Inserción en un contenedor: `xs.push(v)`, `xs.unshift(v)`, `m.set(k, v)`,
      // `s.add(v)`. El contenedor pasa a llevar los hechos de lo que guarda.
      if (ts.isPropertyAccessExpression(callee) && CONTAINER_INSERTERS.has(callee.name.text)) {
        const container = keyOf(callee.expression);
        if (container) {
          const valueArguments =
            callee.name.text === 'set' ? node.arguments.slice(1) : node.arguments;
          for (const argument of valueArguments) {
            const value = ts.isSpreadElement(argument) ? argument.expression : argument;
            addFacts(`${container}.[]`, factsOf(value));
            const sub = keyOf(value);
            if (sub) aliasProperties(sub, `${container}.[]`);
          }
        }
      }

      // Argumentos hacia una función local: sus parámetros reciben los hechos.
      let target = localFunction(callee);
      let offset = 0;
      if (
        !target &&
        ts.isPropertyAccessExpression(callee) &&
        INDIRECT_INVOKERS.has(callee.name.text)
      ) {
        target = localFunction(unwrap(callee.expression));
        // `f.call(thisArg, a, b)` · los argumentos reales empiezan en 1.
        // `f.apply(thisArg, [a, b])` · llegan en un array: se vierten en todos.
        if (callee.name.text === 'call') offset = 1;
        if (callee.name.text === 'apply') offset = -1;
      }
      if (target) {
        target.parameters.forEach((parameter, index) => {
          let incoming;
          let sourceKey = null;
          if (offset === -1) {
            const array = node.arguments[1];
            sourceKey = array ? `${keyOf(array)}.[]` : null;
            incoming = sourceKey ? readKey(sourceKey) : new Set();
          } else {
            const argument = node.arguments[index + offset];
            if (!argument) return;
            incoming = factsOf(argument);
            sourceKey = keyOf(argument);
          }
          writePattern(parameter.name, sourceKey, incoming);
        });
      }
      return;
    }

    if (ts.isReturnStatement(node) && node.expression) {
      const owner = enclosingFunction(node);
      if (owner) write(`ret:${idOf(owner)}`, factsOf(node.expression), keyOf(node.expression));
      return;
    }

    if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
      write(`ret:${idOf(node)}`, factsOf(node.body), keyOf(node.body));
    }
  };

  // --------------------------------------------------------------- punto fijo
  const visitAll = (node, visitor) => {
    visitor(node);
    ts.forEachChild(node, (child) => visitAll(child, visitor));
  };

  let iterations = 0;
  do {
    changed = false;
    memo.clear();
    visitAll(sourceFile, transfer);
    iterations += 1;
  } while (changed && iterations < MAX_ITERATIONS);

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
    // `f.call(...)` y `f.apply(...)` invocan `f`. `f.bind(...)` NO la invoca: solo la
    // enlaza, y el resultado se invoca —o no— más tarde.
    if (
      ts.isPropertyAccessExpression(callee) &&
      (callee.name.text === 'call' || callee.name.text === 'apply')
    ) {
      return { node: unwrap(callee.expression), through: callee.name.text };
    }
    return { node: callee, through: null };
  };

  return {
    factsOf,
    keyOf,
    readKey,
    effectiveCallee,
    localFunction,
    iterations,
    reachedLimit: iterations >= MAX_ITERATIONS,
  };
}

export { unwrap };
