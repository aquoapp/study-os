#!/usr/bin/env node
/**
 * GUARDA 4 · Identidad verificada en servidor · **procedencia por propagación**.
 *
 * INV-116 (SD-016) · REQ-A07 · EC-009 · Manifest §14 «never trust user-supplied
 * user_id without auth context». Alcance: `apps/**` y `packages/**`.
 *
 * ---------------------------------------------------------------------------
 * La regla
 *
 * Un valor usado como `user_id`, `owner_id` o `profile_id` **solo vale si se puede
 * demostrar que deriva del verificador de servidor y que nadie lo ha tocado desde
 * entonces**. Todo lo demás se rechaza, incluido lo que la guarda no sabe
 * interpretar.
 *
 * ---------------------------------------------------------------------------
 * Cómo se demuestra: tres etiquetas y un punto fijo
 *
 * El motor de propagación —`tools/guards/lib/dataflow.mjs`— sigue cada valor por
 * declaraciones, asignaciones, desestructuración, propiedades, arrays, `bind`/
 * `call`/`apply`, retornos y argumentos, hasta que nada cambia. Esta guarda solo
 * dice dónde nacen tres etiquetas y qué combinación exige en cada sumidero:
 *
 *   · `derived`  · nace en una llamada al verificador **canónico** —el export de
 *                  nivel superior de `apps/web/src/server/auth/identity.ts`,
 *                  resuelto por símbolo, no por nombre— y hereda solo a los campos
 *                  de la identidad (`userId`, `email`, `method`);
 *   · `poisoned` · aparece en cualquier unión o escritura en la que `derived`
 *                  falte por algún camino: un `?:` con una rama cruda, una
 *                  reasignación desde una petición, un `+` con texto ajeno;
 *   · `mutated`  · aparece con toda mutación: `+=`, `++`, escritura de propiedad,
 *                  `Object.assign`, `Reflect.set`, `Object.defineProperty`. Un
 *                  valor mutado ya no es el que salió del verificador, ni lo son
 *                  sus propiedades.
 *
 * Un valor está verificado si lleva `derived` y no lleva ni `poisoned` ni
 * `mutated`. Ninguna de las dos últimas se quita nunca: envenenar y mutar ganan
 * siempre, en cualquier orden textual.
 *
 * Los métodos de consulta —`.eq`, `.neq`, `.is`, `.filter`, `.in`, `.match`,
 * `.insert`, `.update`, `.upsert`, `.rpc`— llevan también una etiqueta que viaja
 * con ellos. Así un alias del sumidero, nazca donde nazca, se trata como el
 * sumidero:
 *
 *     let filterByOwner;
 *     filterByOwner = query.eq;
 *     filterByOwner('owner_id', raw);        // es .eq('owner_id', raw)
 *
 * ---------------------------------------------------------------------------
 * El verificador canónico se resuelve a la declaración exportada exacta
 *
 * No basta con importar del módulo canónico —un parámetro o una variable local
 * con el mismo nombre resuelven a otra declaración— ni con estar dentro del módulo
 * canónico: una función anidada llamada `requireVerifiedIdentity` no es el
 * verificador, aunque viva en el mismo fichero. Solo lo es la `FunctionDeclaration`
 * de **nivel superior**, con `export`, con ese nombre.
 * ---------------------------------------------------------------------------
 */

import { read, report } from './lib/walk.mjs';
import { lineOfNode, parseSource, ts, walkAst } from './lib/ast.mjs';
import { buildScopeTable, DECL_KINDS } from './lib/scope.mjs';
import { analyzeDataflow, unwrap } from './lib/dataflow.mjs';
import { collectSourceFiles, resolveModule } from './lib/client-surface.mjs';

/** Único fichero autorizado a construir una identidad verificada. */
const IDENTITY_FACTORY_OWNER = 'apps/web/src/server/auth/identity.ts';

/** El módulo donde se define el propio constructor de la marca. */
const IDENTITY_TYPE_MODULE = 'packages/domain/src/identity.ts';

/** Nombres exportados por el módulo canónico cuya salida es identidad verificada. */
const VERIFIED_EXPORTS = new Set(['getVerifiedIdentity', 'requireVerifiedIdentity']);

/** Columnas que designan al propietario de una fila. */
const IDENTITY_COLUMNS = new Set(['user_id', 'owner_id', 'profile_id']);

/** Propiedades de una identidad verificada que siguen siendo de confianza. */
const IDENTITY_FIELDS = new Set(['userId', 'email', 'method']);

/** Filtros con la columna en la posición 0 y el valor en la 1. */
const COLUMN_VALUE_METHODS = new Set(['eq', 'neq', 'is']);

/** Métodos que reciben un objeto que puede llevar una columna de identidad. */
const PAYLOAD_METHODS = new Set(['insert', 'update', 'upsert', 'match']);

/** Todo lo que esta guarda vigila, para reconocerlo también extraído. */
const SINK_METHODS = new Set([...COLUMN_VALUE_METHODS, ...PAYLOAD_METHODS, 'filter', 'in', 'rpc']);

const DERIVED = 'derived';
const POISONED = 'poisoned';
const MUTATED = 'mutated';
const SINK = 'sink:';

const findings = [];

/** Constantes de cadena por símbolo: solo las que nunca se reasignan ni mutan. */
function makeConstantResolver(sourceFile, resolve) {
  const values = new Map();
  const poisoned = new Set();

  walkAst(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      values.set(node, node.initializer.text);
      return;
    }
    const isAssignment =
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
      node.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken &&
      ts.tokenToString(node.operatorToken.kind)?.endsWith('=');
    const isUpdate =
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      ts.isIdentifier(node.operand);
    if (isAssignment || isUpdate) {
      const binding = resolve(isAssignment ? node.left : node.operand);
      if (binding) poisoned.add(binding.declaration);
    }
  });

  const resolveString = (node) => {
    if (!node) return null;
    const current = unwrap(node);
    if (ts.isStringLiteralLike(current)) return current.text;
    if (ts.isIdentifier(current)) {
      const binding = resolve(current);
      if (!binding || poisoned.has(binding.declaration)) return null;
      return values.get(binding.declaration) ?? null;
    }
    return null;
  };

  return resolveString;
}

const hasExportModifier = (node) =>
  Boolean(
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );

for (const file of collectSourceFiles()) {
  const source = read(file);
  if (source === '') continue;

  const sourceFile = parseSource(file, source);
  const { resolve } = buildScopeTable(sourceFile);
  const resolveString = makeConstantResolver(sourceFile, resolve);

  const push = (node, message) => {
    findings.push({ file, line: lineOfNode(sourceFile, node), message });
  };

  // ==================================================== el verificador canónico
  /**
   * ¿Este identificador resuelve al export canónico del verificador?
   *
   * Fuera del módulo canónico: un especificador de importación de un módulo que
   * resuelva al fichero canónico, con el nombre **exportado** correcto.
   *
   * Dentro del módulo canónico: la `FunctionDeclaration` de **nivel superior**, con
   * `export`, con ese nombre. Una función anidada homónima resuelve a otra
   * declaración —la suya— y no vale, aunque esté en el mismo fichero.
   */
  const isCanonicalVerifier = (identifier) => {
    const binding = resolve(identifier);
    if (!binding) return false;

    if (binding.kind === DECL_KINDS.IMPORT_NAMED) {
      return (
        VERIFIED_EXPORTS.has(binding.exportedName ?? '') &&
        typeof binding.importedFrom === 'string' &&
        resolveModule(file, binding.importedFrom) === IDENTITY_FACTORY_OWNER
      );
    }

    if (binding.kind === DECL_KINDS.FUNCTION && file === IDENTITY_FACTORY_OWNER) {
      const declaration = binding.declaration;
      return (
        ts.isFunctionDeclaration(declaration) &&
        declaration.parent === sourceFile &&
        hasExportModifier(declaration) &&
        VERIFIED_EXPORTS.has(binding.name)
      );
    }

    return false;
  };

  /** ¿Este identificador es el espacio de nombres del módulo canónico? */
  const isCanonicalNamespace = (identifier) => {
    const binding = resolve(identifier);
    return Boolean(
      binding &&
      binding.kind === DECL_KINDS.IMPORT_NAMESPACE &&
      typeof binding.importedFrom === 'string' &&
      resolveModule(file, binding.importedFrom) === IDENTITY_FACTORY_OWNER,
    );
  };

  const memberNameOf = (access) => {
    if (ts.isPropertyAccessExpression(access)) return access.name.text;
    if (ts.isElementAccessExpression(access)) return resolveString(access.argumentExpression);
    return null;
  };

  // ============================================================ propagación
  const flow = analyzeDataflow(sourceFile, resolve, {
    resolveString,
    mustLabels: [DERIVED],
    poisonLabel: POISONED,
    mutatedLabel: MUTATED,
    propertyInherits(label, property) {
      if (label === DERIVED) return property !== null && IDENTITY_FIELDS.has(property);
      if (label === POISONED || label === MUTATED) return true;
      return false;
    },
    seed(node) {
      if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression);
        if (ts.isIdentifier(callee) && isCanonicalVerifier(callee)) return [DERIVED];
        if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          isCanonicalNamespace(callee.expression) &&
          VERIFIED_EXPORTS.has(callee.name.text)
        ) {
          return [DERIVED];
        }
        return null;
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const member = memberNameOf(node);
        if (member !== null && SINK_METHODS.has(member)) return [`${SINK}${member}`];
      }
      return null;
    },
  });

  if (flow.reachedLimit) {
    push(sourceFile, 'La propagación no convergió: el fichero se trata como no verificado entero.');
  }

  const isVerified = (node) => {
    const labels = flow.factsOf(node);
    return labels.has(DERIVED) && !labels.has(POISONED) && !labels.has(MUTATED);
  };

  const whyNot = (node) => {
    const labels = flow.factsOf(node);
    if (!labels.has(DERIVED)) return 'no deriva del verificador de identidad de servidor';
    if (labels.has(MUTATED)) return 'deriva del verificador pero ha sido mutado después';
    return 'deriva del verificador por algún camino, pero no por todos';
  };

  // ========================================================= marca falsificada
  walkAst(sourceFile, (node) => {
    if (
      file !== IDENTITY_TYPE_MODULE &&
      (ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isTypeAssertionExpression(node)) &&
      node.type &&
      ts.isTypeReferenceNode(node.type) &&
      ts.isIdentifier(node.type.typeName) &&
      node.type.typeName.text === 'VerifiedIdentity'
    ) {
      const kind = ts.isSatisfiesExpression(node) ? 'satisfies' : 'as';
      push(
        node,
        `\`${kind} VerifiedIdentity\`: la marca se afirma en lugar de obtenerse. Una identidad ` +
          'verificada solo puede salir del verificador de servidor (INV-116).',
      );
    }

    if (
      ts.isIdentifier(node) &&
      node.text === 'unsafeBrandVerifiedIdentity' &&
      file !== IDENTITY_FACTORY_OWNER &&
      file !== IDENTITY_TYPE_MODULE
    ) {
      push(
        node,
        `Solo "${IDENTITY_FACTORY_OWNER}" puede construir una identidad verificada. Fuera de ` +
          'ahí, la marca deja de demostrar que hubo verificación.',
      );
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'getSession'
    ) {
      push(
        node,
        'Uso de getSession(). No valida la firma del token: no puede ser la base de una ' +
          'decisión de acceso. Usa getClaims() o getUser() (INV-116).',
      );
    }
  });

  // ================================================ resolución de literales locales
  const initializers = new Map();
  const ambiguous = new Set();

  walkAst(sourceFile, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const declaration = resolve(node.name)?.declaration;
      if (!declaration) return;
      if (initializers.has(declaration)) ambiguous.add(declaration);
      initializers.set(declaration, node.initializer);
    }
    if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      ts.tokenToString(node.operatorToken.kind)?.endsWith('=') &&
      node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
      node.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken
    ) {
      const declaration = resolve(node.left)?.declaration;
      if (declaration) ambiguous.add(declaration);
    }
  });

  function resolveLiteral(node, depth = 0) {
    const current = unwrap(node);
    if (!current || depth > 4) return null;
    if (
      ts.isObjectLiteralExpression(current) ||
      ts.isArrayLiteralExpression(current) ||
      ts.isRegularExpressionLiteral(current)
    ) {
      return current;
    }
    if (ts.isNewExpression(current) && ts.isIdentifier(current.expression)) {
      return current.expression.text === 'RegExp' ? current : null;
    }
    if (ts.isIdentifier(current)) {
      const declaration = resolve(current)?.declaration;
      if (!declaration || ambiguous.has(declaration)) return null;
      // Un objeto mutado después de construirse ya no es su literal.
      if (flow.factsOf(current).has(MUTATED)) return null;
      const initializer = initializers.get(declaration);
      return initializer ? resolveLiteral(initializer, depth + 1) : null;
    }
    return null;
  }

  // ================================================================== sumideros
  const describeValue = (node) => {
    if (!node) return 'un valor ausente';
    const text = node.getText(sourceFile).replace(/\s+/g, ' ');
    return `\`${text.length > 48 ? `${text.slice(0, 45)}…` : text}\``;
  };

  const reportSink = (node, column, detail, valueNode) => {
    push(
      node,
      `"${column}" recibe ${describeValue(valueNode)} en ${detail}, que ${whyNot(valueNode)}. ` +
        'La identidad viene de la verificación en servidor, nunca del cliente (Manifest §14).',
    );
  };

  const reportOpaque = (node, detail, valueNode) => {
    push(
      node,
      `${detail} recibe ${describeValue(valueNode)}, que no se resuelve a un literal en este ` +
        'fichero. Puede llevar user_id, owner_id o profile_id sin verificar: no poder ' +
        'demostrar que no los lleva no equivale a que no los lleve (INV-116). Construye el ' +
        'objeto campo a campo en el punto de uso.',
    );
  };

  const reportOpaqueColumn = (node, detail, valueNode) => {
    push(
      node,
      `${detail} filtra por la columna ${describeValue(valueNode)}, que no se resuelve a un ` +
        'literal en este fichero. Si no se puede saber qué columna es, no se puede descartar ' +
        'que sea user_id, owner_id o profile_id (INV-116).',
    );
  };

  const isHarmlessPrimitive = (node) => {
    const current = unwrap(node);
    if (!current) return false;
    return (
      ts.isStringLiteralLike(current) ||
      ts.isNumericLiteral(current) ||
      ts.isRegularExpressionLiteral(current) ||
      current.kind === ts.SyntaxKind.TrueKeyword ||
      current.kind === ts.SyntaxKind.FalseKeyword ||
      current.kind === ts.SyntaxKind.NullKeyword
    );
  };

  const checkPayloadObject = (objectLiteral, detail) => {
    for (const property of objectLiteral.properties) {
      if (ts.isPropertyAssignment(property)) {
        const key =
          ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
            ? property.name.text
            : ts.isComputedPropertyName(property.name)
              ? resolveString(property.name.expression)
              : null;
        if (key === null) {
          reportOpaque(property, `${detail} con clave computada`, property.name);
          continue;
        }
        if (IDENTITY_COLUMNS.has(key) && !isVerified(property.initializer)) {
          reportSink(property, key, detail, property.initializer);
        }
        continue;
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        const key = property.name.text;
        if (IDENTITY_COLUMNS.has(key) && !isVerified(property.name)) {
          reportSink(property, key, `${detail} (shorthand)`, property.name);
        }
        continue;
      }
      if (ts.isSpreadAssignment(property) && !isVerified(property.expression)) {
        push(
          property,
          `Spread ${describeValue(property.expression)} en ${detail}: puede arrastrar una ` +
            'columna de identidad sin verificar. Construye el objeto campo a campo.',
        );
      }
    }
  };

  const checkPayloadArgument = (argument, detail, opaqueCounts = true) => {
    if (!argument) return;
    if (isHarmlessPrimitive(argument)) return;
    const literal = resolveLiteral(argument);
    if (literal === null) {
      if (opaqueCounts) reportOpaque(argument, detail, argument);
      return;
    }
    if (ts.isRegularExpressionLiteral(literal) || ts.isNewExpression(literal)) return;
    if (ts.isArrayLiteralExpression(literal)) {
      for (const element of literal.elements) {
        checkPayloadArgument(element, `${detail} (elemento)`, opaqueCounts);
      }
      return;
    }
    checkPayloadObject(literal, detail);
  };

  const chainHasFrom = (call) => {
    let current = call.expression;
    while (current) {
      if (ts.isCallExpression(current)) {
        if (
          ts.isPropertyAccessExpression(current.expression) &&
          current.expression.name.text === 'from'
        ) {
          return true;
        }
        current = current.expression;
        continue;
      }
      if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
        current = current.expression;
        continue;
      }
      return false;
    }
    return false;
  };

  const checkSinkCall = (node, method, args) => {
    const label = `.${method}()`;

    if (COLUMN_VALUE_METHODS.has(method)) {
      const column = resolveString(args[0]);
      if (column === null) {
        reportOpaqueColumn(node, label, args[0]);
        return;
      }
      if (IDENTITY_COLUMNS.has(column) && !isVerified(args[1])) {
        reportSink(node, column, label, args[1]);
      }
      return;
    }

    if (method === 'filter') {
      if (args.length < 3) return; // Array.prototype.filter
      const column = resolveString(args[0]);
      if (column === null) {
        reportOpaqueColumn(node, label, args[0]);
        return;
      }
      if (IDENTITY_COLUMNS.has(column) && !isVerified(args[2])) {
        reportSink(node, column, label, args[2]);
      }
      return;
    }

    if (method === 'in') {
      const column = resolveString(args[0]);
      if (column === null) {
        reportOpaqueColumn(node, label, args[0]);
        return;
      }
      if (!IDENTITY_COLUMNS.has(column)) return;
      const list = args[1];
      const literal = resolveLiteral(list);
      if (literal === null || !ts.isArrayLiteralExpression(literal)) {
        reportOpaque(list ?? node, `.in("${column}")`, list);
        return;
      }
      for (const element of literal.elements) {
        if (!isVerified(element)) reportSink(element, column, '.in()', element);
      }
      return;
    }

    if (PAYLOAD_METHODS.has(method)) {
      const opaqueCounts = method !== 'match' || chainHasFrom(node);
      checkPayloadArgument(args[0], label, opaqueCounts);
      return;
    }

    if (method === 'rpc' && args[1]) checkPayloadArgument(args[1], label);
  };

  walkAst(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;

    const { node: callee, through } = flow.effectiveCallee(node);

    // `f.call(thisArg, a, b)` · los argumentos reales empiezan en 1.
    // `f.apply(thisArg, [a, b])` · vienen en un array literal, o no se ven.
    let args = [...node.arguments];
    if (through === 'call') args = args.slice(1);
    if (through === 'apply') {
      const array = node.arguments[1] ? resolveLiteral(node.arguments[1]) : null;
      args = array && ts.isArrayLiteralExpression(array) ? [...array.elements] : [];
    }

    // Invocación directa: `q.eq(...)` y `q['eq'](...)`
    if (
      through === null &&
      (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
    ) {
      const method = memberNameOf(callee);
      if (method !== null && SINK_METHODS.has(method)) {
        checkSinkCall(node, method, args);
        return;
      }
      // Un miembro con otro nombre puede llevar el sumidero por propagación:
      // `const ops = { filtrar: query.eq }; ops.filtrar(...)`.
    }

    // Todo lo demás: el callee lleva la etiqueta del sumidero por propagación.
    const sinks = [...flow.factsOf(callee)]
      .filter((label) => label.startsWith(SINK))
      .map((label) => label.slice(SINK.length));
    for (const method of sinks) checkSinkCall(node, method, args);
  });
}

console.log(
  `  (procedencia por propagación: solo ${[...VERIFIED_EXPORTS].join(' y ')}, resueltas al ` +
    `export de nivel superior de ${IDENTITY_FACTORY_OWNER}, producen identidad; cualquier ` +
    'mutación o unión con un valor crudo la invalida)',
);

report(
  'auth-authority-guard',
  findings,
  'INV-116 (SD-016) · REQ-A07 · Manifest §14. La identidad se obtiene con\n' +
    '`getVerifiedIdentity()` / `requireVerifiedIdentity()` resueltas al export de nivel\n' +
    `superior de "${IDENTITY_FACTORY_OWNER}". Llamarse así no basta, un parámetro o una\n` +
    'variable local homónimos tampoco, y una función anidada en el módulo canónico\n' +
    'tampoco. La confianza viaja con el valor y se invalida ante cualquier mutación o\n' +
    'unión con un valor crudo. Lo que no se puede demostrar verificado se rechaza,\n' +
    'incluidos payloads, listas, argumentos de RPC y columnas de filtro que no se\n' +
    'resuelvan a un literal.\n' +
    'RLS protege los datos; esta guarda protege la capa de aplicación, que es la que queda\n' +
    'expuesta cuando la lógica no atraviesa RLS.',
);
