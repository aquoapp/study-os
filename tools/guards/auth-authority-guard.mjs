#!/usr/bin/env node
/**
 * GUARDA 4 · Identidad verificada en servidor · **procedencia positiva**.
 *
 * INV-116 (SD-016) · REQ-A07 · EC-009 · Manifest §14 «never trust user-supplied
 * user_id without auth context». Alcance: `apps/**` y `packages/**`.
 *
 * ---------------------------------------------------------------------------
 * Por qué se invirtió la pregunta
 *
 * La primera versión hacía **propagación de contaminación**: marcaba lo que venía
 * de la petición y lo perseguía hasta los sumideros. Eso obliga a enumerar de dónde
 * puede venir un dato sucio, y esa lista nunca está completa: bastaba con no llamar
 * `body` a la variable.
 *
 * Ahora la pregunta es la contraria y la carga de la prueba cambia de lado: un valor
 * usado como `user_id`, `owner_id` o `profile_id` **solo es válido si se puede
 * demostrar que deriva del verificador de servidor**. Todo lo demás se rechaza,
 * incluido lo que la guarda no sabe interpretar.
 *
 * ---------------------------------------------------------------------------
 * Lo que la segunda auditoría demostró que seguía pasando
 *
 * **1 · Confiaba en el nombre, no en el origen.** Cualquier función llamada
 * `getVerifiedIdentity` valía, la definiera quien la definiera:
 *
 *     function getVerifiedIdentity(r: Request) {      // factory falso
 *       return { userId: r.headers.get('x-user') };
 *     }
 *
 * Ahora un nombre solo es fuente verificada si se ha **importado y resuelto** desde
 * el módulo canónico de identidad. Se admite el renombrado en la importación —lo que
 * importa es de dónde viene, no cómo se llame aquí— y el espacio de nombres
 * (`import * as auth`), pero un `auth.getVerifiedIdentity()` sobre un objeto
 * cualquiera ya no cuela.
 *
 * **2 · Solo miraba dentro de literales.** Un payload, un filtro o una lista
 * guardados en una variable pasaban sin inspección:
 *
 *     await db.from('t').insert(payload);             // ¿qué trae payload?
 *     await db.from('t').select().in('user_id', ids);  // ¿qué trae ids?
 *     await db.rpc('f', args);                         // ¿qué trae args?
 *
 * Ahora un payload, una lista o unos argumentos de RPC que no se puedan resolver a
 * un literal **en el mismo fichero** son un hallazgo. No es que se sepa que traen
 * una columna de identidad: es que no se puede demostrar que no.
 * ---------------------------------------------------------------------------
 */

import { read, report } from './lib/walk.mjs';
import { lineOfNode, parseSource, stringArg, ts, walkAst } from './lib/ast.mjs';
import { collectSourceFiles, resolveModule } from './lib/client-surface.mjs';

/** Único fichero autorizado a construir una identidad verificada. */
const IDENTITY_FACTORY_OWNER = 'apps/web/src/server/auth/identity.ts';

/** El módulo donde se define el propio constructor. */
const IDENTITY_TYPE_MODULE = 'packages/domain/src/identity.ts';

/** Nombres exportados por el módulo canónico cuya salida es identidad verificada. */
const VERIFIED_EXPORTS = new Set(['getVerifiedIdentity', 'requireVerifiedIdentity']);

/** Columnas que designan al propietario de una fila. */
const IDENTITY_COLUMNS = new Set(['user_id', 'owner_id', 'profile_id']);

/** Propiedades de una identidad verificada que siguen siendo de confianza. */
const IDENTITY_FIELDS = new Set(['userId', 'email', 'method']);

/** Métodos que reciben un payload que puede llevar una columna de identidad. */
const PAYLOAD_METHODS = new Set(['insert', 'update', 'upsert', 'match']);

const findings = [];

for (const file of collectSourceFiles()) {
  const source = read(file);
  if (source === '') continue;

  const sourceFile = parseSource(file, source);

  // ============================================ qué nombres son fuente verificada
  /**
   * Un nombre solo cuenta si se ha importado del módulo canónico y se ha resuelto
   * a ese fichero. Llamarse `getVerifiedIdentity` no basta: eso es exactamente lo
   * que permitía el factory falso.
   */
  const verifiedSourceNames = new Set();
  const verifiedNamespaces = new Set();

  if (file === IDENTITY_FACTORY_OWNER) {
    // En su propio módulo, las funciones son las de verdad.
    for (const name of VERIFIED_EXPORTS) verifiedSourceNames.add(name);
  }

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      !ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      continue;
    }

    const target = resolveModule(file, statement.moduleSpecifier.text);
    if (target !== IDENTITY_FACTORY_OWNER) continue;

    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      verifiedNamespaces.add(bindings.name.text);
    }
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        // `import { getVerifiedIdentity as gvi }` · lo que se comprueba es el
        // nombre exportado, no el local.
        const exported = (element.propertyName ?? element.name).text;
        if (VERIFIED_EXPORTS.has(exported)) verifiedSourceNames.add(element.name.text);
      }
    }
  }

  // =========================================================== marca falsificada
  walkAst(sourceFile, (node) => {
    if (
      // El módulo que **define** la marca es el único que puede colocarla: ahí el
      // cast es la implementación del tipo, no una forma de saltárselo.
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
      findings.push({
        file,
        line: lineOfNode(sourceFile, node),
        message:
          '`' +
          kind +
          ' VerifiedIdentity`: la marca se afirma en lugar de obtenerse. Una identidad ' +
          'verificada solo puede salir del verificador de servidor (INV-116).',
      });
    }

    if (
      ts.isIdentifier(node) &&
      node.text === 'unsafeBrandVerifiedIdentity' &&
      file !== IDENTITY_FACTORY_OWNER &&
      file !== IDENTITY_TYPE_MODULE
    ) {
      findings.push({
        file,
        line: lineOfNode(sourceFile, node),
        message:
          'Solo "' +
          IDENTITY_FACTORY_OWNER +
          '" puede construir una identidad verificada. Fuera de ahí, la marca deja de ' +
          'demostrar que hubo verificación.',
      });
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'getSession'
    ) {
      findings.push({
        file,
        line: lineOfNode(sourceFile, node),
        message:
          'Uso de getSession(). No valida la firma del token: no puede ser la base de una ' +
          'decisión de acceso. Usa getClaims() o getUser() (INV-116).',
      });
    }
  });

  // ====================================================== procedencia positiva
  /** Identificadores que se ha demostrado que derivan del verificador. */
  const verified = new Set();
  /** Funciones locales cuyo valor de retorno deriva del verificador. */
  const verifiedFunctions = new Set();

  function isVerifiedExpression(node) {
    if (!node) return false;

    if (ts.isIdentifier(node)) return verified.has(node.text);

    if (ts.isAwaitExpression(node)) return isVerifiedExpression(node.expression);
    if (ts.isParenthesizedExpression(node)) return isVerifiedExpression(node.expression);
    if (ts.isNonNullExpression(node)) return isVerifiedExpression(node.expression);

    // Un cast NO convierte en verificado: eso es justo lo que se rechaza arriba.
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      return isVerifiedExpression(node.expression);
    }

    // `identity.userId`, `identity['userId']`
    if (ts.isPropertyAccessExpression(node)) {
      return IDENTITY_FIELDS.has(node.name.text) && isVerifiedExpression(node.expression);
    }
    if (ts.isElementAccessExpression(node)) {
      const key = ts.isStringLiteralLike(node.argumentExpression)
        ? node.argumentExpression.text
        : null;
      return key !== null && IDENTITY_FIELDS.has(key) && isVerifiedExpression(node.expression);
    }

    if (ts.isCallExpression(node)) {
      // Fuente verificada importada del módulo canónico, con el nombre que sea.
      if (ts.isIdentifier(node.expression) && verifiedSourceNames.has(node.expression.text)) {
        return true;
      }
      // `auth.getVerifiedIdentity()` solo si `auth` ES el módulo canónico.
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        verifiedNamespaces.has(node.expression.expression.text) &&
        VERIFIED_EXPORTS.has(node.expression.name.text)
      ) {
        return true;
      }
      // Helper local cuyo retorno se demostró verificado.
      if (ts.isIdentifier(node.expression) && verifiedFunctions.has(node.expression.text)) {
        return true;
      }
      return false;
    }

    // `a ?? b` y `a ? b : c` solo son de confianza si ambas ramas lo son.
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

  function markVerifiedBinding(name) {
    if (ts.isIdentifier(name)) {
      verified.add(name.text);
      return;
    }
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const property = element.propertyName ?? element.name;
        const key =
          ts.isIdentifier(property) || ts.isStringLiteralLike(property) ? property.text : null;
        // Solo los campos de la identidad conservan la confianza.
        if (key !== null && IDENTITY_FIELDS.has(key)) markVerifiedBinding(element.name);
      }
    }
  }

  // Punto fijo: el orden textual no debe decidir qué se considera verificado.
  for (let pass = 0; pass < 5; pass += 1) {
    const before = verified.size + verifiedFunctions.size;

    walkAst(sourceFile, (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (isVerifiedExpression(node.initializer)) markVerifiedBinding(node.name);
        return;
      }

      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left) &&
        isVerifiedExpression(node.right)
      ) {
        verified.add(node.left.text);
        return;
      }

      // Una función local es «verificada» si TODOS sus retornos lo son.
      const isFunction =
        ts.isFunctionDeclaration(node) ||
        (ts.isVariableDeclaration(node) &&
          node.initializer &&
          (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));

      if (isFunction) {
        const name = ts.isFunctionDeclaration(node)
          ? node.name?.text
          : ts.isIdentifier(node.name)
            ? node.name.text
            : null;
        const body = ts.isFunctionDeclaration(node) ? node.body : node.initializer?.body;
        if (!name || !body) return;

        const returns = [];
        walkAst(body, (inner) => {
          if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
        });
        // Cuerpo de flecha con expresión directa.
        if (!ts.isBlock(body)) returns.push(body);

        if (returns.length > 0 && returns.every((expression) => isVerifiedExpression(expression))) {
          verifiedFunctions.add(name);
        }
      }
    });

    if (verified.size + verifiedFunctions.size === before) break;
  }

  // ================================================ resolución de literales locales
  /**
   * Iniciadores de las variables del fichero, para poder seguir un payload guardado
   * en una variable hasta el literal que lo construye. Si hay dos declaraciones con
   * el mismo nombre, no se resuelve ninguna: la ambigüedad se trata como falta de
   * prueba, no como permiso.
   */
  const initializers = new Map();
  const ambiguous = new Set();

  walkAst(sourceFile, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (initializers.has(node.name.text)) ambiguous.add(node.name.text);
      initializers.set(node.name.text, node.initializer);
    }
  });

  function unwrap(node) {
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
  }

  /** Sigue un identificador hasta el literal que lo inicializa, si lo hay. */
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
      // `new RegExp(...)` no es un payload: es el caso legítimo de String.match.
      return current.expression.text === 'RegExp' ? current : null;
    }
    if (ts.isIdentifier(current)) {
      if (ambiguous.has(current.text)) return null;
      const initializer = initializers.get(current.text);
      return initializer ? resolveLiteral(initializer, depth + 1) : null;
    }
    return null;
  }

  // ============================================================== sumideros
  function reportSink(node, column, detail, valueText) {
    findings.push({
      file,
      line: lineOfNode(sourceFile, node),
      message:
        '"' +
        column +
        '" recibe ' +
        valueText +
        ' en ' +
        detail +
        ', y no se puede demostrar que derive del verificador de identidad de servidor. ' +
        'La identidad viene de la verificación en servidor, nunca del cliente (Manifest §14).',
    });
  }

  function reportOpaque(node, detail, valueText) {
    findings.push({
      file,
      line: lineOfNode(sourceFile, node),
      message:
        detail +
        ' recibe ' +
        valueText +
        ', que no se resuelve a un literal en este fichero. Puede llevar user_id, owner_id ' +
        'o profile_id sin verificar: no poder demostrar que no los lleva no equivale a que ' +
        'no los lleve (INV-116). Construye el objeto campo a campo en el punto de uso.',
    });
  }

  function describeValue(node) {
    if (!node) return 'un valor ausente';
    const text = node.getText(sourceFile).replace(/\s+/g, ' ');
    return '`' + (text.length > 48 ? text.slice(0, 45) + '…' : text) + '`';
  }

  function checkPayloadObject(objectLiteral, detail) {
    for (const property of objectLiteral.properties) {
      // { user_id: valor }
      if (ts.isPropertyAssignment(property)) {
        const key =
          ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
            ? property.name.text
            : null;
        if (key === null) {
          // `{ [loQueSea]: valor }` · no se puede saber qué columna es.
          reportOpaque(property, detail + ' con clave computada', describeValue(property.name));
          continue;
        }
        if (IDENTITY_COLUMNS.has(key) && !isVerifiedExpression(property.initializer)) {
          reportSink(property, key, detail, describeValue(property.initializer));
        }
        continue;
      }

      // { user_id }  · shorthand
      if (ts.isShorthandPropertyAssignment(property)) {
        const key = property.name.text;
        if (IDENTITY_COLUMNS.has(key) && !verified.has(key)) {
          reportSink(property, key, detail + ' (shorthand)', '`' + key + '`');
        }
        continue;
      }

      // { ...algo } · no se puede saber qué trae
      if (ts.isSpreadAssignment(property)) {
        if (!isVerifiedExpression(property.expression)) {
          findings.push({
            file,
            line: lineOfNode(sourceFile, property),
            message:
              'Spread ' +
              describeValue(property.expression) +
              ' en ' +
              detail +
              ': puede arrastrar una columna de identidad sin verificar. Construye el ' +
              'objeto campo a campo.',
          });
        }
      }
    }
  }

  /**
   * ¿La cadena de llamadas pasa por un `.from(...)`?
   *
   * Es la única evidencia barata de que se está construyendo una consulta PostgREST
   * y no llamando a `String.prototype.match` o a la Cache Storage API. Se usa solo
   * para `.match()`, que es el nombre que comparten los tres.
   */
  function chainHasFrom(call) {
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
  }

  /** Un valor que por construcción no puede llevar una columna de identidad. */
  function isHarmlessPrimitive(node) {
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
  }

  /** Comprueba un payload que debería ser un objeto, resolviéndolo si hace falta. */
  function checkPayloadArgument(argument, detail, opaqueCounts = true) {
    if (!argument) return;
    if (isHarmlessPrimitive(argument)) return;

    const literal = resolveLiteral(argument);

    if (literal === null) {
      if (opaqueCounts) reportOpaque(argument, detail, describeValue(argument));
      return;
    }
    if (ts.isRegularExpressionLiteral(literal) || ts.isNewExpression(literal)) {
      // String.prototype.match: no es una consulta.
      return;
    }
    if (ts.isArrayLiteralExpression(literal)) {
      for (const element of literal.elements) {
        checkPayloadArgument(element, detail + ' (elemento)', opaqueCounts);
      }
      return;
    }
    checkPayloadObject(literal, detail);
  }

  walkAst(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;

    const method = node.expression.name.text;

    // `.eq('user_id', valor)` · `.neq` · `.is`
    if (method === 'eq' || method === 'neq' || method === 'is') {
      const column = stringArg(node, 0);
      if (column && IDENTITY_COLUMNS.has(column) && !isVerifiedExpression(node.arguments[1])) {
        reportSink(node, column, '.' + method + '()', describeValue(node.arguments[1]));
      }
      return;
    }

    // `.filter('user_id', 'eq', valor)`
    if (method === 'filter') {
      const column = stringArg(node, 0);
      if (column && IDENTITY_COLUMNS.has(column) && !isVerifiedExpression(node.arguments[2])) {
        reportSink(node, column, '.filter()', describeValue(node.arguments[2]));
      }
      return;
    }

    // `.in('user_id', [...])` · la lista puede estar en una variable
    if (method === 'in') {
      const column = stringArg(node, 0);
      if (!column || !IDENTITY_COLUMNS.has(column)) return;

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

    // `.match({...})` · `.insert({...})` · `.update({...})` · `.upsert({...})`
    if (PAYLOAD_METHODS.has(method)) {
      // `.match()` lo comparten PostgREST, String.prototype y la Cache Storage API.
      // Un payload opaco solo cuenta como hallazgo si la cadena pasa por `.from()`;
      // un objeto literal se inspecciona siempre, cueste lo que cueste el nombre.
      const opaqueCounts = method !== 'match' || chainHasFrom(node);
      checkPayloadArgument(node.arguments[0], '.' + method + '()', opaqueCounts);
      return;
    }

    // `.rpc('nombre', argumentos)`
    if (method === 'rpc') {
      const payload = node.arguments[1];
      if (payload) checkPayloadArgument(payload, '.rpc()');
    }
  });
}

console.log(
  '  (procedencia positiva: solo ' +
    [...VERIFIED_EXPORTS].join(' y ') +
    ', importadas y resueltas desde ' +
    IDENTITY_FACTORY_OWNER +
    ', producen identidad válida)',
);

report(
  'auth-authority-guard',
  findings,
  'INV-116 (SD-016) · REQ-A07 · Manifest §14. La identidad se obtiene con\n' +
    '`getVerifiedIdentity()` / `requireVerifiedIdentity()` importadas del módulo\n' +
    'canónico "' +
    IDENTITY_FACTORY_OWNER +
    '". Llamarse así no basta: la guarda resuelve la\n' +
    'importación. La carga de la prueba está del lado de quien usa el valor: lo que no\n' +
    'se puede demostrar verificado se rechaza, y eso incluye un payload, una lista o\n' +
    'unos argumentos de RPC que no se resuelvan a un literal.\n' +
    'RLS protege los datos; esta guarda protege la capa de aplicación, que es la que\n' +
    'queda expuesta cuando la lógica no atraviesa RLS.',
);
