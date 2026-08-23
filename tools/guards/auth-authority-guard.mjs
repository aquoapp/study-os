#!/usr/bin/env node
/**
 * GUARDA 4 · Identidad verificada en servidor · **procedencia por símbolo**.
 *
 * INV-116 (SD-016) · REQ-A07 · EC-009 · Manifest §14 «never trust user-supplied
 * user_id without auth context». Alcance: `apps/**` y `packages/**`.
 *
 * ---------------------------------------------------------------------------
 * La regla
 *
 * Un valor usado como `user_id`, `owner_id` o `profile_id` **solo vale si se puede
 * demostrar que deriva del verificador de servidor**. Todo lo demás se rechaza,
 * incluido lo que la guarda no sabe interpretar.
 *
 * ---------------------------------------------------------------------------
 * Qué cambió: de nombres a símbolos
 *
 * La versión anterior confiaba en la **importación**: si el fichero importaba
 * `getVerifiedIdentity` del módulo canónico, cualquier llamada con ese nombre valía.
 * Eso deja abierto el sombreado, que es la evasión de menos esfuerzo que existe:
 *
 *     import { getVerifiedIdentity } from '../server/auth/identity';
 *
 *     export async function handler(getVerifiedIdentity: () => any, db: any) {
 *       const identity = getVerifiedIdentity();      // el parámetro, no el import
 *       return db.from('t').select().eq('user_id', identity.userId);
 *     }
 *
 * Y dejaba abierta la reasignación: una variable verificada que después recibe otra
 * cosa seguía contando como verificada durante todo el fichero.
 *
 * Ahora cada identificador se resuelve a **la declaración que lo introduce**
 * —`tools/guards/lib/scope.mjs`—, y la confianza se guarda por declaración, no por
 * nombre:
 *
 *   · el verificador vale si el símbolo invocado resuelve al **especificador de
 *     importación** del módulo canónico, con el nombre exportado correcto. Un
 *     parámetro, una variable o una función local que se llamen igual resuelven a
 *     otra declaración y no valen;
 *   · una declaración verificada se **envenena** si en cualquier punto del fichero
 *     recibe una expresión que no se puede demostrar verificada. Envenenar gana
 *     siempre: el orden textual no debe decidir la seguridad;
 *   · los métodos de consulta se reconocen tanto invocados directamente como
 *     extraídos —`const eq = q.eq; eq('user_id', v)`— y tanto por acceso a
 *     propiedad como por acceso computado que resuelva a un literal;
 *   · una **columna de filtro** que no se resuelve a un literal es un hallazgo: si
 *     no se puede saber qué columna es, no se puede descartar que sea de identidad.
 * ---------------------------------------------------------------------------
 */

import { read, report } from './lib/walk.mjs';
import { lineOfNode, parseSource, ts, walkAst } from './lib/ast.mjs';
import { buildScopeTable, DECL_KINDS } from './lib/scope.mjs';
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

const findings = [];

for (const file of collectSourceFiles()) {
  const source = read(file);
  if (source === '') continue;

  const sourceFile = parseSource(file, source);
  const { resolve } = buildScopeTable(sourceFile);

  const push = (node, message) => {
    findings.push({ file, line: lineOfNode(sourceFile, node), message });
  };

  // ======================================================= constantes por símbolo
  const constantValues = new Map();
  const constantPoisoned = new Set();

  walkAst(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      constantValues.set(node, node.initializer.text);
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const binding = resolve(node.left);
      if (binding) constantPoisoned.add(binding.declaration);
    }
  });

  const resolveString = (node) => {
    if (!node) return null;
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isParenthesizedExpression(node)) return resolveString(node.expression);
    if (ts.isAsExpression(node)) return resolveString(node.expression);
    if (ts.isIdentifier(node)) {
      const binding = resolve(node);
      if (!binding || constantPoisoned.has(binding.declaration)) return null;
      return constantValues.get(binding.declaration) ?? null;
    }
    return null;
  };

  // ==================================================== el verificador canónico
  /**
   * ¿Este identificador resuelve al export canónico del verificador?
   *
   * Tiene que ser un especificador de importación —no un parámetro, ni una
   * variable, ni una función local— de un módulo que resuelva al fichero canónico,
   * y con el nombre **exportado** correcto. El alias local da igual.
   */
  const isCanonicalVerifier = (identifier) => {
    const binding = resolve(identifier);

    if (!binding) {
      // Sin declaración local: en el propio módulo canónico eso no puede pasar
      // —las funciones están declaradas—, y fuera de él un global con ese nombre
      // no es el verificador.
      return false;
    }

    if (binding.kind === DECL_KINDS.IMPORT_NAMED) {
      return (
        VERIFIED_EXPORTS.has(binding.exportedName ?? '') &&
        binding.importedFrom !== null &&
        binding.importedFrom !== undefined &&
        resolveModule(file, binding.importedFrom) === IDENTITY_FACTORY_OWNER
      );
    }

    // Dentro del módulo canónico, sus propias funciones son las de verdad.
    if (binding.kind === DECL_KINDS.FUNCTION && file === IDENTITY_FACTORY_OWNER) {
      return VERIFIED_EXPORTS.has(binding.name);
    }

    return false;
  };

  /** ¿Este identificador es el espacio de nombres del módulo canónico? */
  const isCanonicalNamespace = (identifier) => {
    const binding = resolve(identifier);
    return Boolean(
      binding &&
      binding.kind === DECL_KINDS.IMPORT_NAMESPACE &&
      binding.importedFrom &&
      resolveModule(file, binding.importedFrom) === IDENTITY_FACTORY_OWNER,
    );
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
        '`' +
          kind +
          ' VerifiedIdentity`: la marca se afirma en lugar de obtenerse. Una identidad ' +
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
        'Solo "' +
          IDENTITY_FACTORY_OWNER +
          '" puede construir una identidad verificada. Fuera de ahí, la marca deja de ' +
          'demostrar que hubo verificación.',
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

  // ================================================= procedencia por declaración
  /** Declaraciones cuyo valor deriva del verificador. */
  const verified = new Set();
  /** Declaraciones que en algún punto reciben algo no demostrable. Gana siempre. */
  const poisoned = new Set();
  /** Funciones locales cuyos retornos son todos verificados. */
  const verifiedFunctions = new Set();

  const declarationOf = (identifier) => resolve(identifier)?.declaration ?? null;

  function isVerifiedExpression(node) {
    if (!node) return false;

    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node);
      return Boolean(declaration && verified.has(declaration) && !poisoned.has(declaration));
    }

    if (ts.isAwaitExpression(node)) return isVerifiedExpression(node.expression);
    if (ts.isParenthesizedExpression(node)) return isVerifiedExpression(node.expression);
    if (ts.isNonNullExpression(node)) return isVerifiedExpression(node.expression);

    // Un cast NO convierte en verificado: eso es justo lo que se rechaza arriba.
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      return isVerifiedExpression(node.expression);
    }

    if (ts.isPropertyAccessExpression(node)) {
      return IDENTITY_FIELDS.has(node.name.text) && isVerifiedExpression(node.expression);
    }
    if (ts.isElementAccessExpression(node)) {
      const key = resolveString(node.argumentExpression);
      return key !== null && IDENTITY_FIELDS.has(key) && isVerifiedExpression(node.expression);
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;

      if (ts.isIdentifier(callee)) {
        if (isCanonicalVerifier(callee)) return true;
        const declaration = declarationOf(callee);
        return Boolean(declaration && verifiedFunctions.has(declaration));
      }

      // `identidad.getVerifiedIdentity()` solo si `identidad` ES el módulo canónico
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        isCanonicalNamespace(callee.expression) &&
        VERIFIED_EXPORTS.has(callee.name.text)
      ) {
        return true;
      }
      return false;
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return isVerifiedExpression(node.left) && isVerifiedExpression(node.right);
    }
    if (ts.isConditionalExpression(node)) {
      return isVerifiedExpression(node.whenTrue) && isVerifiedExpression(node.whenFalse);
    }

    return false;
  }

  const markVerifiedBinding = (nameNode) => {
    if (!nameNode) return;
    if (ts.isIdentifier(nameNode)) {
      const declaration = declarationOf(nameNode);
      if (declaration) verified.add(declaration);
      return;
    }
    if (ts.isObjectBindingPattern(nameNode)) {
      for (const element of nameNode.elements) {
        if (!ts.isBindingElement(element)) continue;
        const source = element.propertyName ?? element.name;
        const key = ts.isIdentifier(source) || ts.isStringLiteralLike(source) ? source.text : null;
        // Solo los campos de la identidad conservan la confianza.
        if (key !== null && IDENTITY_FIELDS.has(key)) markVerifiedBinding(element.name);
      }
    }
  };

  // Punto fijo. Envenenar y verificar se recalculan juntos hasta estabilizar,
  // porque envenenar un símbolo puede dejar de verificar a otro.
  for (let pass = 0; pass < 6; pass += 1) {
    const before = verified.size + poisoned.size + verifiedFunctions.size;

    walkAst(sourceFile, (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (isVerifiedExpression(node.initializer)) markVerifiedBinding(node.name);
        return;
      }

      // Reasignación. Si lo que entra no es demostrable, el símbolo queda
      // envenenado para todo el fichero, hubiera sido verificado antes o no.
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        const declaration = declarationOf(node.left);
        if (!declaration) return;
        if (isVerifiedExpression(node.right)) verified.add(declaration);
        else poisoned.add(declaration);
        return;
      }

      const isFunction =
        ts.isFunctionDeclaration(node) ||
        (ts.isVariableDeclaration(node) &&
          node.initializer &&
          (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));

      if (isFunction) {
        const declaration = ts.isFunctionDeclaration(node)
          ? node
          : ts.isIdentifier(node.name)
            ? node
            : null;
        const body = ts.isFunctionDeclaration(node) ? node.body : node.initializer?.body;
        if (!declaration || !body) return;

        const returns = [];
        walkAst(body, (inner) => {
          if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
        });
        if (!ts.isBlock(body)) returns.push(body);

        if (returns.length > 0 && returns.every((expression) => isVerifiedExpression(expression))) {
          verifiedFunctions.add(declaration);
        }
      }
    });

    if (verified.size + poisoned.size + verifiedFunctions.size === before) break;
  }

  // ================================================ resolución de literales locales
  const initializers = new Map();
  const ambiguous = new Set();

  walkAst(sourceFile, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const declaration = declarationOf(node.name);
      if (!declaration) return;
      if (initializers.has(declaration)) ambiguous.add(declaration);
      initializers.set(declaration, node.initializer);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      // Reasignado: lo que hubiera en la declaración ya no describe el símbolo.
      const declaration = declarationOf(node.left);
      if (declaration) ambiguous.add(declaration);
    }
  });

  const unwrap = (node) => {
    let current = node;
    while (
      current &&
      (ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isNonNullExpression(current) ||
        ts.isAwaitExpression(current))
    ) {
      current = current.expression;
    }
    return current;
  };

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
      const declaration = declarationOf(current);
      if (!declaration || ambiguous.has(declaration)) return null;
      const initializer = initializers.get(declaration);
      return initializer ? resolveLiteral(initializer, depth + 1) : null;
    }
    return null;
  }

  // ============================================================== métodos extraídos
  /** Declaraciones que guardan un método de consulta: `const eq = q.eq`. */
  const aliasedSinks = new Map();

  const memberNameOf = (access) => {
    if (ts.isPropertyAccessExpression(access)) return access.name.text;
    if (ts.isElementAccessExpression(access)) return resolveString(access.argumentExpression);
    return null;
  };

  walkAst(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;

    let source = unwrap(node.initializer);
    // `q.eq.bind(q)` conserva la posición de los argumentos.
    if (
      ts.isCallExpression(source) &&
      ts.isPropertyAccessExpression(source.expression) &&
      source.expression.name.text === 'bind'
    ) {
      source = source.expression.expression;
    }

    if (!ts.isPropertyAccessExpression(source) && !ts.isElementAccessExpression(source)) return;

    const member = memberNameOf(source);
    if (member !== null && SINK_METHODS.has(member)) {
      const declaration = declarationOf(node.name);
      if (declaration) aliasedSinks.set(declaration, member);
    }
  });

  // ================================================================== sumideros
  const describeValue = (node) => {
    if (!node) return 'un valor ausente';
    const text = node.getText(sourceFile).replace(/\s+/g, ' ');
    return '`' + (text.length > 48 ? text.slice(0, 45) + '…' : text) + '`';
  };

  const reportSink = (node, column, detail, valueText) => {
    push(
      node,
      '"' +
        column +
        '" recibe ' +
        valueText +
        ' en ' +
        detail +
        ', y no se puede demostrar que derive del verificador de identidad de servidor. ' +
        'La identidad viene de la verificación en servidor, nunca del cliente (Manifest §14).',
    );
  };

  const reportOpaque = (node, detail, valueText) => {
    push(
      node,
      detail +
        ' recibe ' +
        valueText +
        ', que no se resuelve a un literal en este fichero. Puede llevar user_id, owner_id ' +
        'o profile_id sin verificar: no poder demostrar que no los lleva no equivale a que ' +
        'no los lleve (INV-116). Construye el objeto campo a campo en el punto de uso.',
    );
  };

  const reportOpaqueColumn = (node, detail, valueText) => {
    push(
      node,
      detail +
        ' filtra por la columna ' +
        valueText +
        ', que no se resuelve a un literal en este fichero. Si no se puede saber qué columna ' +
        'es, no se puede descartar que sea user_id, owner_id o profile_id (INV-116).',
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
          reportOpaque(property, detail + ' con clave computada', describeValue(property.name));
          continue;
        }
        if (IDENTITY_COLUMNS.has(key) && !isVerifiedExpression(property.initializer)) {
          reportSink(property, key, detail, describeValue(property.initializer));
        }
        continue;
      }

      if (ts.isShorthandPropertyAssignment(property)) {
        const key = property.name.text;
        const declaration = declarationOf(property.name);
        const trusted = Boolean(
          declaration && verified.has(declaration) && !poisoned.has(declaration),
        );
        if (IDENTITY_COLUMNS.has(key) && !trusted) {
          reportSink(property, key, detail + ' (shorthand)', '`' + key + '`');
        }
        continue;
      }

      if (ts.isSpreadAssignment(property) && !isVerifiedExpression(property.expression)) {
        push(
          property,
          'Spread ' +
            describeValue(property.expression) +
            ' en ' +
            detail +
            ': puede arrastrar una columna de identidad sin verificar. Construye el objeto ' +
            'campo a campo.',
        );
      }
    }
  };

  const checkPayloadArgument = (argument, detail, opaqueCounts = true) => {
    if (!argument) return;
    if (isHarmlessPrimitive(argument)) return;

    const literal = resolveLiteral(argument);

    if (literal === null) {
      if (opaqueCounts) reportOpaque(argument, detail, describeValue(argument));
      return;
    }
    if (ts.isRegularExpressionLiteral(literal) || ts.isNewExpression(literal)) return;
    if (ts.isArrayLiteralExpression(literal)) {
      for (const element of literal.elements) {
        checkPayloadArgument(element, detail + ' (elemento)', opaqueCounts);
      }
      return;
    }
    checkPayloadObject(literal, detail);
  };

  /** ¿La cadena pasa por un `.from(...)`? Única evidencia barata de PostgREST. */
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

  const checkSinkCall = (node, method) => {
    const label = '.' + method + '()';

    if (COLUMN_VALUE_METHODS.has(method)) {
      const column = resolveString(node.arguments[0]);
      if (column === null) {
        reportOpaqueColumn(node, label, describeValue(node.arguments[0]));
        return;
      }
      if (IDENTITY_COLUMNS.has(column) && !isVerifiedExpression(node.arguments[1])) {
        reportSink(node, column, label, describeValue(node.arguments[1]));
      }
      return;
    }

    if (method === 'filter') {
      // `Array.prototype.filter` lleva uno o dos argumentos; el de PostgREST, tres.
      if (node.arguments.length < 3) return;
      const column = resolveString(node.arguments[0]);
      if (column === null) {
        reportOpaqueColumn(node, label, describeValue(node.arguments[0]));
        return;
      }
      if (IDENTITY_COLUMNS.has(column) && !isVerifiedExpression(node.arguments[2])) {
        reportSink(node, column, label, describeValue(node.arguments[2]));
      }
      return;
    }

    if (method === 'in') {
      const column = resolveString(node.arguments[0]);
      if (column === null) {
        reportOpaqueColumn(node, label, describeValue(node.arguments[0]));
        return;
      }
      if (!IDENTITY_COLUMNS.has(column)) return;

      const list = node.arguments[1];
      const literal = resolveLiteral(list);
      if (literal === null || !ts.isArrayLiteralExpression(literal)) {
        reportOpaque(list ?? node, '.in("' + column + '")', describeValue(list));
        return;
      }
      for (const element of literal.elements) {
        if (!isVerifiedExpression(element)) {
          reportSink(element, column, '.in()', describeValue(element));
        }
      }
      return;
    }

    if (PAYLOAD_METHODS.has(method)) {
      // `.match()` lo comparten PostgREST, String.prototype y la Cache Storage API.
      const opaqueCounts = method !== 'match' || chainHasFrom(node);
      checkPayloadArgument(node.arguments[0], label, opaqueCounts);
      return;
    }

    if (method === 'rpc' && node.arguments[1]) {
      checkPayloadArgument(node.arguments[1], label);
    }
  };

  walkAst(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;

    const callee = node.expression;

    // Invocación directa: `q.eq(...)` y `q['eq'](...)`
    if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
      const method = memberNameOf(callee);
      if (method !== null && SINK_METHODS.has(method)) checkSinkCall(node, method);
      return;
    }

    // Método extraído: `const eq = q.eq; eq('user_id', v)`
    if (ts.isIdentifier(callee)) {
      const declaration = declarationOf(callee);
      const method = declaration ? aliasedSinks.get(declaration) : undefined;
      if (method) checkSinkCall(node, method);
    }
  });
}

console.log(
  '  (procedencia por símbolo y ámbito: solo ' +
    [...VERIFIED_EXPORTS].join(' y ') +
    ', resueltas al export real de ' +
    IDENTITY_FACTORY_OWNER +
    ', producen identidad válida)',
);

report(
  'auth-authority-guard',
  findings,
  'INV-116 (SD-016) · REQ-A07 · Manifest §14. La identidad se obtiene con\n' +
    '`getVerifiedIdentity()` / `requireVerifiedIdentity()` resueltas al export real del\n' +
    'módulo canónico "' +
    IDENTITY_FACTORY_OWNER +
    '". Llamarse así no basta, y un parámetro o\n' +
    'una variable local que sombreen la importación tampoco. La confianza se guarda por\n' +
    'símbolo: reasignar una variable verificada la invalida. Lo que no se puede demostrar\n' +
    'verificado se rechaza, y eso incluye un payload, una lista, unos argumentos de RPC o\n' +
    'una columna de filtro que no se resuelvan a un literal.\n' +
    'RLS protege los datos; esta guarda protege la capa de aplicación, que es la que queda\n' +
    'expuesta cuando la lógica no atraviesa RLS.',
);
