#!/usr/bin/env node
/**
 * GUARDA 4 · Identidad verificada en servidor (INV-116 · SD-016).
 *
 * > «Las decisiones de autenticación y autorización en rutas, Server Actions y Route
 * > Handlers protegidos deben basarse en una identidad verificada en servidor. Con
 * > Supabase SSR se utilizará `auth.getClaims()` para validar el token y proteger
 * > páginas/datos, o `auth.getUser()` cuando sea necesaria una consulta actualizada
 * > al servidor de Auth. `getSession()`, una cookie o una sesión local sin
 * > verificación nunca constituyen autoridad suficiente.»
 *
 * REQ-A07 · EC-009 · Manifest §14 · alcance: `apps/**` y `packages/**`.
 *
 * ---------------------------------------------------------------------------
 * Comprueba tres cosas
 *
 *   1. **`getSession()` no decide acceso.** Devuelve el contenido de la cookie sin
 *      validar su firma.
 *   2. **La marca de identidad verificada tiene un único origen.**
 *   3. **Ninguna consulta filtra por un `user_id` que venga de la petición.**
 *      Manifest §14: «never trust user-supplied user_id without auth context».
 *
 * El punto 3 es el que motivó reescribir esta guarda. La versión anterior buscaba
 * el texto `.eq('user_id', body...` y se esquivaba con una línea:
 *
 *     const { user_id: uid } = await request.json();
 *     supabase.from('profiles').select('*').eq('user_id', uid);
 *
 * Ahora se hace propagación de contaminación sobre el AST: se marcan los valores
 * que provienen de la petición y se sigue su rastro a través de asignaciones,
 * desestructuraciones, alias y accesos a propiedad, hasta los puntos donde se usan
 * como filtro de identidad.
 * ---------------------------------------------------------------------------
 */

import { read, report } from './lib/walk.mjs';
import { callChain, lineOfNode, parseSource, stringArg, ts, walkAst } from './lib/ast.mjs';
import { collectSourceFiles } from './lib/client-surface.mjs';

/** Único fichero autorizado a construir una identidad verificada. */
const IDENTITY_FACTORY_OWNER = 'apps/web/src/server/auth/identity.ts';

/** El módulo donde se define el propio constructor. */
const IDENTITY_TYPE_MODULE = 'packages/domain/src/identity.ts';

/** Columnas que designan al propietario de una fila. */
const IDENTITY_COLUMNS = new Set(['user_id', 'owner_id', 'profile_id']);

/**
 * Identificadores que representan datos entrantes.
 *
 * Es una lista de nombres, y por tanto incompleta por naturaleza. Se combina con
 * la detección de expresiones (`request.json()`, `formData.get(...)`, …), que no
 * depende de cómo se llame la variable.
 */
const REQUEST_IDENTIFIERS = new Set([
  'body',
  'payload',
  'params',
  'searchParams',
  'req',
  'request',
  'formData',
  'input',
  'query',
  'args',
  'dto',
  'rawInput',
  'untrustedInput',
]);

/** Métodos que extraen datos de la petición. */
const REQUEST_EXTRACTORS = new Set(['json', 'formData', 'text', 'get', 'getAll']);

const findings = [];

for (const file of collectSourceFiles()) {
  const source = read(file);
  if (source === '') continue;

  const sourceFile = parseSource(file, source);

  // ---------------------------------------------------------------- 1 y 2
  walkAst(sourceFile, (node) => {
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
  });

  // ------------------------------------------------------------------ 3
  const tainted = new Set();

  /** ¿Esta expresión procede de la petición? */
  function isTaintedExpression(node) {
    if (!node) return false;

    if (ts.isIdentifier(node)) {
      return tainted.has(node.text) || REQUEST_IDENTIFIERS.has(node.text);
    }
    if (ts.isAwaitExpression(node)) return isTaintedExpression(node.expression);
    if (ts.isParenthesizedExpression(node)) return isTaintedExpression(node.expression);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      return isTaintedExpression(node.expression);
    }
    if (ts.isNonNullExpression(node)) return isTaintedExpression(node.expression);

    // `body.user_id`, `req.body.user_id`, …
    if (ts.isPropertyAccessExpression(node)) return isTaintedExpression(node.expression);
    if (ts.isElementAccessExpression(node)) return isTaintedExpression(node.expression);

    // `request.json()`, `formData.get('user_id')`, `searchParams.get(...)`
    if (ts.isCallExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (REQUEST_EXTRACTORS.has(method) && isTaintedExpression(node.expression.expression)) {
          return true;
        }
        return isTaintedExpression(node.expression.expression);
      }
      return false;
    }

    return false;
  }

  /** Marca como contaminado todo lo que un patrón de enlace introduce. */
  function taintBindingName(name) {
    if (ts.isIdentifier(name)) {
      tainted.add(name.text);
      return;
    }
    if (ts.isObjectBindingPattern(name)) {
      // Cubre `{ user_id }` y el alias `{ user_id: uid }`.
      for (const element of name.elements) taintBindingName(element.name);
      return;
    }
    if (ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) taintBindingName(element.name);
      }
    }
  }

  // Primera pasada: propagar contaminación por declaraciones y asignaciones.
  // Se repite hasta punto fijo para no depender del orden textual.
  for (let pass = 0; pass < 4; pass += 1) {
    const before = tainted.size;

    walkAst(sourceFile, (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (isTaintedExpression(node.initializer)) taintBindingName(node.name);
        return;
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left) &&
        isTaintedExpression(node.right)
      ) {
        tainted.add(node.left.text);
        return;
      }
      // Parámetro desestructurado de un objeto que representa la petición:
      //   function handler({ user_id }: { user_id: string })
      if (ts.isParameter(node) && ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const property = element.propertyName ?? element.name;
          if (ts.isIdentifier(property) && IDENTITY_COLUMNS.has(property.text)) {
            taintBindingName(element.name);
          }
        }
      }
    });

    if (tainted.size === before) break;
  }

  // Segunda pasada: los sumideros.
  function reportSink(node, column, detail) {
    findings.push({
      file,
      line: lineOfNode(sourceFile, node),
      message:
        `Filtro por "${column}" con un valor procedente de la petición (${detail}). ` +
        'La identidad viene de la verificación en servidor, nunca del cliente (Manifest §14).',
    });
  }

  walkAst(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;

    const method = node.expression.name.text;

    // `.eq('user_id', valor)` · `.filter('user_id', 'eq', valor)`
    if (method === 'eq' || method === 'neq' || method === 'is') {
      const column = stringArg(node, 0);
      if (column && IDENTITY_COLUMNS.has(column) && isTaintedExpression(node.arguments[1])) {
        reportSink(node, column, `.${method}()`);
      }
      return;
    }
    if (method === 'filter') {
      const column = stringArg(node, 0);
      if (column && IDENTITY_COLUMNS.has(column) && isTaintedExpression(node.arguments[2])) {
        reportSink(node, column, '.filter()');
      }
      return;
    }

    // `.match({ user_id: valor })`, `.insert({ user_id: valor })`, `.update(...)`
    if (['match', 'insert', 'update', 'upsert'].includes(method)) {
      const arg = node.arguments[0];
      const objects = arg && ts.isArrayLiteralExpression(arg) ? arg.elements : [arg];

      for (const candidate of objects) {
        if (!candidate || !ts.isObjectLiteralExpression(candidate)) continue;
        for (const property of candidate.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const key =
            ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
              ? property.name.text
              : null;
          if (key && IDENTITY_COLUMNS.has(key) && isTaintedExpression(property.initializer)) {
            reportSink(property, key, `.${method}()`);
          }
        }
      }
    }
  });

  // Un `.rpc()` que reciba un identificador de propietario contaminado.
  walkAst(sourceFile, (node) => {
    const chain = callChain(node);
    if (!chain) return;
    const rpcStep = chain.steps.find((step) => step.name === 'rpc');
    if (!rpcStep) return;

    const payload = rpcStep.call.arguments[1];
    if (!payload || !ts.isObjectLiteralExpression(payload)) return;

    for (const property of payload.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key =
        ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
          ? property.name.text
          : null;
      if (key && IDENTITY_COLUMNS.has(key) && isTaintedExpression(property.initializer)) {
        reportSink(property, key, '.rpc()');
      }
    }
  });
}

report(
  'auth-authority-guard',
  findings,
  'INV-116 (SD-016) · REQ-A07 · Manifest §14. La identidad se obtiene con\n' +
    '`getVerifiedIdentity()` / `requireVerifiedIdentity()` en\n' +
    `"${IDENTITY_FACTORY_OWNER}". RLS protege los datos; esta guarda protege la capa de\n` +
    'aplicación, que es la que queda expuesta cuando la lógica no atraviesa RLS.',
);
