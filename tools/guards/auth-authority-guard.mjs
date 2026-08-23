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
 * La versión anterior hacía **propagación de contaminación**: marcaba lo que venía
 * de la petición y lo perseguía hasta los sumideros. Eso obliga a enumerar de dónde
 * puede venir un dato sucio, y esa lista nunca está completa:
 *
 *     export async function h(r: Request) {            // parámetro sin nombre sospechoso
 *       const raw = await r.json();
 *       const owner = String(raw.u);                   // envuelto en String()
 *       return db.from('t').select().eq('user_id', owner);
 *     }
 *
 * Bastaba con no llamar `body` a la variable. Una guarda que se esquiva renombrando
 * no es un control.
 *
 * Ahora la pregunta es la contraria y la carga de la prueba cambia de lado: un valor
 * usado como `user_id`, `owner_id` o `profile_id` **solo es válido si se puede
 * demostrar que deriva de `getVerifiedIdentity()` o `requireVerifiedIdentity()`**.
 * Todo lo demás se rechaza, incluido lo que la guarda no sabe interpretar. No poder
 * demostrar que un valor es de confianza no es lo mismo que serlo.
 *
 * Además se rechazan las vías para fabricar la marca sin pasar por el verificador:
 * `as VerifiedIdentity`, `satisfies VerifiedIdentity`, el doble cast a través de
 * `unknown`, y `unsafeBrandVerifiedIdentity` fuera del factory.
 * ---------------------------------------------------------------------------
 */

import { read, report } from './lib/walk.mjs';
import { lineOfNode, parseSource, stringArg, ts, walkAst } from './lib/ast.mjs';
import { collectSourceFiles } from './lib/client-surface.mjs';

/** Único fichero autorizado a construir una identidad verificada. */
const IDENTITY_FACTORY_OWNER = 'apps/web/src/server/auth/identity.ts';

/** El módulo donde se define el propio constructor. */
const IDENTITY_TYPE_MODULE = 'packages/domain/src/identity.ts';

/** Funciones cuya salida sí es una identidad verificada. */
const VERIFIED_SOURCES = new Set(['getVerifiedIdentity', 'requireVerifiedIdentity']);

/** Columnas que designan al propietario de una fila. */
const IDENTITY_COLUMNS = new Set(['user_id', 'owner_id', 'profile_id']);

/** Propiedades de una identidad verificada que siguen siendo de confianza. */
const IDENTITY_FIELDS = new Set(['userId', 'email', 'method']);

const findings = [];

for (const file of collectSourceFiles()) {
  const source = read(file);
  if (source === '') continue;

  const sourceFile = parseSource(file, source);

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
          `\`${kind} VerifiedIdentity\`: la marca se afirma en lugar de obtenerse. Una ` +
          'identidad verificada solo puede salir del verificador de servidor (INV-116).',
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
          `Solo "${IDENTITY_FACTORY_OWNER}" puede construir una identidad verificada. ` +
          'Fuera de ahí, la marca deja de demostrar que hubo verificación.',
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
      // getVerifiedIdentity() / requireVerifiedIdentity()
      if (ts.isIdentifier(node.expression) && VERIFIED_SOURCES.has(node.expression.text)) {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        VERIFIED_SOURCES.has(node.expression.name.text)
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

  // ============================================================== sumideros
  function reportSink(node, column, detail, valueText) {
    findings.push({
      file,
      line: lineOfNode(sourceFile, node),
      message:
        `"${column}" recibe ${valueText} en ${detail}, y no se puede demostrar que derive ` +
        'de getVerifiedIdentity() ni de requireVerifiedIdentity(). La identidad viene de la ' +
        'verificación en servidor, nunca del cliente (Manifest §14).',
    });
  }

  function describeValue(node) {
    if (!node) return 'un valor ausente';
    const text = node.getText(sourceFile).replace(/\s+/g, ' ');
    return `\`${text.length > 48 ? `${text.slice(0, 45)}…` : text}\``;
  }

  function checkPayloadObject(objectLiteral, detail) {
    for (const property of objectLiteral.properties) {
      // { user_id: valor }
      if (ts.isPropertyAssignment(property)) {
        const key =
          ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
            ? property.name.text
            : null;
        if (key && IDENTITY_COLUMNS.has(key) && !isVerifiedExpression(property.initializer)) {
          reportSink(property, key, detail, describeValue(property.initializer));
        }
        continue;
      }

      // { user_id }  · shorthand
      if (ts.isShorthandPropertyAssignment(property)) {
        const key = property.name.text;
        if (IDENTITY_COLUMNS.has(key) && !verified.has(key)) {
          reportSink(property, key, `${detail} (shorthand)`, `\`${key}\``);
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
              `Spread ${describeValue(property.expression)} en ${detail}: puede arrastrar ` +
              'una columna de identidad sin verificar. Construye el objeto campo a campo.',
          });
        }
      }
    }
  }

  walkAst(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;

    const method = node.expression.name.text;

    // `.eq('user_id', valor)` · `.neq` · `.is`
    if (method === 'eq' || method === 'neq' || method === 'is') {
      const column = stringArg(node, 0);
      if (column && IDENTITY_COLUMNS.has(column) && !isVerifiedExpression(node.arguments[1])) {
        reportSink(node, column, `.${method}()`, describeValue(node.arguments[1]));
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

    // `.in('user_id', [...])`
    if (method === 'in') {
      const column = stringArg(node, 0);
      const list = node.arguments[1];
      if (column && IDENTITY_COLUMNS.has(column) && list && ts.isArrayLiteralExpression(list)) {
        for (const element of list.elements) {
          if (!isVerifiedExpression(element)) {
            reportSink(element, column, '.in()', describeValue(element));
          }
        }
      }
      return;
    }

    // `.match({...})` · `.insert({...})` · `.update({...})` · `.upsert({...})`
    if (['match', 'insert', 'update', 'upsert'].includes(method)) {
      const arg = node.arguments[0];
      const candidates = arg && ts.isArrayLiteralExpression(arg) ? arg.elements : [arg];
      for (const candidate of candidates) {
        if (candidate && ts.isObjectLiteralExpression(candidate)) {
          checkPayloadObject(candidate, `.${method}()`);
        }
      }
      return;
    }

    // `.rpc('nombre', { user_id: valor })`
    if (method === 'rpc') {
      const payload = node.arguments[1];
      if (payload && ts.isObjectLiteralExpression(payload)) {
        checkPayloadObject(payload, '.rpc()');
      }
    }
  });
}

console.log(
  `  (procedencia positiva: solo ${[...VERIFIED_SOURCES].join(' y ')} producen identidad válida)`,
);

report(
  'auth-authority-guard',
  findings,
  'INV-116 (SD-016) · REQ-A07 · Manifest §14. La identidad se obtiene con\n' +
    `\`getVerifiedIdentity()\` / \`requireVerifiedIdentity()\` en "${IDENTITY_FACTORY_OWNER}".\n` +
    'La carga de la prueba está del lado de quien usa el valor: lo que no se puede\n' +
    'demostrar verificado se rechaza. RLS protege los datos; esta guarda protege la\n' +
    'capa de aplicación, que es la que queda expuesta cuando la lógica no atraviesa RLS.',
);
