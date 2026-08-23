#!/usr/bin/env node
/**
 * GUARDA 3 · El cliente no escribe. Política conservadora, **por símbolo**.
 *
 * INV-113 · «El servidor es la autoridad exclusiva para persistir Mastery, Exam
 * Readiness y estado del Planner. Ninguna ruta de cliente escribe esas proyecciones.»
 * REQ-A08 · ADR-001 v1.1 punto 2 · EC-002 · EC-003 · EC-010
 *
 * ---------------------------------------------------------------------------
 * La regla, en una frase
 *
 * En superficie de cliente, **cualquier acceso a un miembro llamado `insert`,
 * `update`, `upsert`, `delete` o `rpc` es un hallazgo**, se invoque o no. La única
 * excepción es una invocación directa sobre el símbolo global real del navegador.
 *
 * Formularla sobre el **acceso** y no sobre la llamada es lo que cierra la familia
 * entera de evasiones, porque todas consisten en separar el método de su llamada:
 *
 *     let w; w = query.update;              // asignación posterior
 *     ({ update: w } = query);              // asignación destructurada
 *     query.update.bind(query)              // bind, call, apply
 *     registrar(query.update)               // paso como argumento
 *     return query.update;                  // retorno
 *     const ops = { w: query.update };      // almacenado en otra estructura
 *     query['update'](p)                    // acceso computado literal
 *     query[M](p)                           // acceso computado constante
 *     query[loQueSea](p)                    // acceso computado no resoluble
 *
 * Ninguna necesita un caso propio: todas pasan por un acceso a `update`.
 *
 * El acceso computado no resoluble se denuncia igual. No poder demostrar que un
 * nombre no es `update` no equivale a que no lo sea.
 *
 * ---------------------------------------------------------------------------
 * La excepción de navegador, acotada de verdad
 *
 * `caches.delete(key)` es la Cache Storage API, no una tabla. La excepción vale
 * **solo** cuando se cumplen las tres cosas a la vez:
 *
 *   1. el receptor es un identificador que **resuelve al global**: ningún ámbito
 *      del fichero lo declara —ni parámetro, ni variable, ni importación—;
 *   2. ese nombre está en el registro de globales de navegador;
 *   3. el acceso es **la llamada misma**: `caches.delete(k)`, no `caches.delete`
 *      guardado, pasado o enlazado.
 *
 * Sombrear el nombre no la hereda, y extraer el método tampoco. La resolución es
 * por ámbito léxico —`tools/guards/lib/scope.mjs`—, no por «el fichero declara ese
 * nombre en algún sitio», que era la aproximación anterior y castigaba de más.
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, report } from './lib/walk.mjs';
import { lineOfNode, ts, walkAst } from './lib/ast.mjs';
import { buildScopeTable, DECL_KINDS } from './lib/scope.mjs';
import { computeClientSurface, describeVia } from './lib/client-surface.mjs';

const registry = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages/domain/src/authority-registry.json'), 'utf8'),
);

const PROJECTIONS = new Set(registry.projections.tables);
const AUTHORITATIVE_RPCS = new Set(registry.rpcs.names);
const READ_ONLY_RPCS = new Set(registry.readOnlyRpcs.names);
const WRITE_METHODS = new Set(registry.writeMethods.names);
const SERVICE_ROLE_MARKERS = new Set(registry.serviceRoleMarkers.names);
const BROWSER_API_RECEIVERS = new Set(registry.browserApiReceivers.names);

/** Miembros que no pueden tocarse en cliente, ni siquiera para mirarlos. */
const GUARDED_MEMBERS = new Set([...WRITE_METHODS, 'rpc']);

/** Formas de invocar algo sin escribir su nombre en la llamada. */
const INDIRECT_INVOKERS = new Set(['bind', 'call', 'apply']);

const { clientFiles, parsed, boundaryViolations } = computeClientSurface();

const findings = [];

/**
 * Constantes de cadena **por símbolo**.
 *
 * `const M = 'update'` solo resuelve si ese símbolo no se reasigna nunca. Una
 * constante que cambia no es una constante, y tratarla como tal sería justo el
 * agujero que este módulo existe para cerrar.
 */
function collectStringConstants(sourceFile, resolve) {
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

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const binding = resolve(node.left);
      if (binding) poisoned.add(binding.declaration);
    }
  });

  return (identifier) => {
    const binding = resolve(identifier);
    if (!binding || poisoned.has(binding.declaration)) return null;
    return values.get(binding.declaration) ?? null;
  };
}

/** Resuelve una expresión a un literal de cadena, si se puede demostrar. */
function makeStringResolver(constantOf) {
  const resolveString = (node) => {
    if (!node) return null;
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isIdentifier(node)) return constantOf(node);
    if (ts.isParenthesizedExpression(node)) return resolveString(node.expression);
    if (ts.isAsExpression(node)) return resolveString(node.expression);
    return null;
  };
  return resolveString;
}

for (const [file, info] of clientFiles) {
  const sourceFile = parsed.get(file);
  if (!sourceFile) continue;

  const { resolve } = buildScopeTable(sourceFile);
  const constantOf = collectStringConstants(sourceFile, resolve);
  const resolveString = makeStringResolver(constantOf);
  const context = describeVia(info.via);

  const add = (node, message) => {
    findings.push({ file, line: lineOfNode(sourceFile, node), message: message + context });
  };

  /** Nombre del miembro al que apunta un acceso, y si pudo demostrarse. */
  const accessedMember = (access) => {
    if (ts.isPropertyAccessExpression(access)) {
      return { name: access.name.text, computed: false, resolved: true };
    }
    const resolvedName = resolveString(access.argumentExpression);
    return { name: resolvedName, computed: true, resolved: resolvedName !== null };
  };

  /**
   * ¿Este acceso es la excepción legítima de la Cache API?
   *
   * Las tres condiciones a la vez. Si falta una, no hay excepción.
   */
  const isLegitimateBrowserApiCall = (access) => {
    const receiver = access.expression;
    if (!ts.isIdentifier(receiver)) return false;
    if (!BROWSER_API_RECEIVERS.has(receiver.text)) return false;
    // 1 y 2 · el símbolo resuelve al global real, no a algo que el fichero declara
    if (resolve(receiver) !== null) return false;
    // 3 · el acceso ES la llamada, no un valor que se guarda o se enlaza
    const parent = access.parent;
    return Boolean(parent && ts.isCallExpression(parent) && parent.expression === access);
  };

  /** Símbolos que, en algún punto, han recibido un miembro guardado. */
  const tainted = new Set();

  /** Símbolos que han recibido un miembro con nombre computado no demostrable. */
  const opaque = new Set();

  /**
   * ¿Este acceso se está usando como algo **invocable**?
   *
   * Un acceso computado que no se resuelve puede ser `query[metodo](payload)` o
   * puede ser `policies.environments[entorno]`, que es una consulta a un registro.
   * Sin tipos no hay forma de distinguirlos por el acceso en sí, así que se mira
   * qué se hace con él: invocarlo, enlazarlo, o guardarlo en un símbolo que
   * después se invoca. Lo demás es indexar datos, y denunciarlo sería ruido.
   */
  const isUsedAsCallable = (access) => {
    const parent = access.parent;
    if (!parent) return false;
    if (ts.isCallExpression(parent) && parent.expression === access) return true;
    if (ts.isPropertyAccessExpression(parent) && INDIRECT_INVOKERS.has(parent.name.text)) {
      return true;
    }
    return false;
  };

  const markTainted = (target) => {
    if (!target) return;
    if (ts.isIdentifier(target)) {
      const binding = resolve(target);
      if (binding) tainted.add(binding.declaration);
    }
  };

  const markOpaque = (target) => {
    if (!target) return;
    if (ts.isIdentifier(target)) {
      const binding = resolve(target);
      if (binding) opaque.add(binding.declaration);
    }
  };

  // ------------------------------------------------------------ pasada 1
  // Cada acceso a un miembro guardado, se invoque o no.
  walkAst(sourceFile, (node) => {
    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return;

    const { name, computed, resolved } = accessedMember(node);

    if (!resolved) {
      // Un nombre computado que no se demuestra. Solo importa si el receptor no es
      // un global de navegador legítimo: `caches[x]()` sigue siendo Cache API.
      if (isLegitimateBrowserApiCall(node)) return;

      if (isUsedAsCallable(node)) {
        add(
          node,
          'Invocación de un miembro con nombre computado que no puede resolverse a un ' +
            'literal. No poder demostrar que no es una escritura no equivale a que no lo ' +
            'sea (INV-113).',
        );
        return;
      }

      // Guardado en un símbolo: se denuncia cuando ese símbolo se invoque.
      if (node.parent && ts.isVariableDeclaration(node.parent)) {
        markOpaque(node.parent.name);
      } else if (
        node.parent &&
        ts.isBinaryExpression(node.parent) &&
        node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        node.parent.right === node
      ) {
        markOpaque(node.parent.left);
      }
      return;
    }

    if (name === null || !GUARDED_MEMBERS.has(name)) return;
    if (isLegitimateBrowserApiCall(node)) return;

    // El acceso ya es el hallazgo. Cómo se use después solo cambia el mensaje.
    const parent = node.parent;
    let how = 'se referencia';

    if (parent && ts.isCallExpression(parent) && parent.expression === node) {
      how = 'se invoca';
    } else if (
      parent &&
      ts.isPropertyAccessExpression(parent) &&
      INDIRECT_INVOKERS.has(parent.name.text)
    ) {
      how = `se enlaza con .${parent.name.text}()`;
    } else if (parent && ts.isVariableDeclaration(parent)) {
      how = 'se guarda en una variable';
      markTainted(parent.name);
    } else if (
      parent &&
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      parent.right === node
    ) {
      how = 'se asigna a una variable';
      markTainted(parent.left);
    } else if (parent && ts.isCallExpression(parent)) {
      how = 'se pasa como argumento';
    } else if (parent && ts.isReturnStatement(parent)) {
      how = 'se devuelve';
    } else if (parent && (ts.isPropertyAssignment(parent) || ts.isArrayLiteralExpression(parent))) {
      how = 'se almacena en otra estructura';
    }

    add(
      node,
      `El miembro ".${name}"${computed ? ' (acceso computado)' : ''} ${how} en superficie ` +
        'de cliente. INV-113: el cliente no persiste, y separar el método de su llamada no ' +
        'lo convierte en otra cosa. Si esta operación es legítima, es deuda que debe ' +
        'justificarse en el checkpoint.',
    );
  });

  // ------------------------------------------------------------ pasada 2
  // Desestructuración de un miembro guardado, en declaración o en asignación.
  walkAst(sourceFile, (node) => {
    /** @param {import('typescript').ObjectBindingPattern} pattern */
    const checkBindingPattern = (pattern) => {
      for (const element of pattern.elements) {
        if (!ts.isBindingElement(element)) continue;
        const source = element.propertyName ?? element.name;
        const key = ts.isIdentifier(source) || ts.isStringLiteralLike(source) ? source.text : null;
        if (key !== null && GUARDED_MEMBERS.has(key)) {
          add(
            element,
            `Desestructuración de ".${key}" en superficie de cliente. Extraer el método del ` +
              'cliente de datos no lo convierte en otra cosa (INV-113).',
          );
          markTainted(element.name);
        }
      }
    };

    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
      checkBindingPattern(node.name);
      return;
    }

    // `({ update: w } = query)` · asignación destructurada, sin declaración
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isObjectLiteralExpression(node.left)
    ) {
      for (const property of node.left.properties) {
        const key = ts.isPropertyAssignment(property)
          ? property.name
          : ts.isShorthandPropertyAssignment(property)
            ? property.name
            : null;
        const keyText =
          key && (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) ? key.text : null;
        if (keyText !== null && GUARDED_MEMBERS.has(keyText)) {
          add(
            property,
            `Asignación destructurada de ".${keyText}" en superficie de cliente. Que no haya ` +
              'declaración de por medio no cambia lo que se está extrayendo (INV-113).',
          );
          if (ts.isPropertyAssignment(property)) markTainted(property.initializer);
          else markTainted(property.name);
        }
      }
    }
  });

  // ------------------------------------------------------------ pasada 3
  // Llamadas: RPC con nombre, identificadores sueltos y símbolos contaminados.
  walkAst(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;

    // `.rpc('nombre', …)` · el nombre importa aunque el acceso ya se haya denunciado
    const callee = node.expression;
    const isRpcAccess =
      (ts.isPropertyAccessExpression(callee) && callee.name.text === 'rpc') ||
      (ts.isElementAccessExpression(callee) && resolveString(callee.argumentExpression) === 'rpc');

    if (isRpcAccess) {
      const rpcName = resolveString(node.arguments[0]);
      if (rpcName === null) {
        add(
          node,
          'Llamada .rpc() cuyo nombre no puede resolverse a un literal. No poder demostrar ' +
            'que es de solo lectura no equivale a que lo sea.',
        );
      } else if (!READ_ONLY_RPCS.has(rpcName)) {
        const anchor = registry.rpcs.anchors?.[rpcName];
        add(
          node,
          `Llamada de cliente a la RPC "${rpcName}", que no está en la allowlist de solo ` +
            `lectura (${READ_ONLY_RPCS.size} entradas)` +
            `${AUTHORITATIVE_RPCS.has(rpcName) ? ` · RPC autoritativa · ${anchor}` : ''}.`,
        );
      }
      return;
    }

    if (!ts.isIdentifier(callee)) return;

    const binding = resolve(callee);

    // Un identificador suelto que se llama como un miembro guardado. Venga de
    // desestructuración, de parámetro o de importación, el nombre es lo bastante
    // específico como para exigir justificación.
    if (GUARDED_MEMBERS.has(callee.text)) {
      add(
        node,
        `Llamada a "${callee.text}()" como función suelta en superficie de cliente. Sea ` +
          'alias, desestructuración, parámetro o importación, el cliente no persiste (INV-113).',
      );
      return;
    }

    // Un símbolo que en algún punto recibió un miembro guardado.
    if (binding && tainted.has(binding.declaration)) {
      add(
        node,
        `Llamada a "${callee.text}()", que en este fichero recibe un método de escritura o ` +
          'una RPC. El alias es la evidencia: renombrar no cambia la operación (INV-113).',
      );
      return;
    }

    // Un símbolo que recibió un miembro con nombre computado no demostrable, y que
    // ahora se invoca. Guardarlo no era prueba de nada; invocarlo lo convierte en
    // una operación que no se puede justificar.
    if (binding && opaque.has(binding.declaration)) {
      add(
        node,
        `Llamada a "${callee.text}()", que recibe un miembro con nombre computado no ` +
          'resoluble. No poder demostrar qué se invoca no equivale a que sea seguro (INV-113).',
      );
    }
  });

  // ------------------------------------------------------------ pasada 4
  // Clave de rol de servicio.
  walkAst(sourceFile, (node) => {
    if (ts.isIdentifier(node) && SERVICE_ROLE_MARKERS.has(node.text)) {
      add(
        node,
        `Referencia a "${node.text}" en superficie de cliente. La clave de rol de servicio ` +
          'atraviesa RLS (EC-010).',
      );
    }
    if (ts.isStringLiteralLike(node) && SERVICE_ROLE_MARKERS.has(node.text)) {
      add(node, `Literal "${node.text}" en superficie de cliente (EC-010).`);
    }
  });
}

// ---------------------------------------------------- frontera server-only
for (const violation of boundaryViolations) {
  findings.push({
    file: violation.file,
    line: 1,
    message:
      'Módulo marcado `server-only` alcanzable desde superficie de cliente' +
      `${describeVia(violation.via)}.`,
  });
}

console.log(
  `  (superficie de cliente: ${clientFiles.size} fichero(s); análisis por símbolo y ámbito; ` +
    `0 escrituras permitidas, ${READ_ONLY_RPCS.size} RPC en la allowlist de lectura; ` +
    `${PROJECTIONS.size} proyecciones registradas; excepción de navegador solo para ` +
    `invocación directa sobre el global real)`,
);

report(
  'client-authority-guard',
  findings,
  'INV-113 · REQ-A08 · EC-010. En superficie de cliente no se accede a `.insert()`,\n' +
    '`.update()`, `.upsert()`, `.delete()` ni `.rpc()` —ni para invocarlos, ni para\n' +
    'guardarlos, enlazarlos, pasarlos o devolverlos—, salvo una `.rpc()` que esté en la\n' +
    'allowlist de solo lectura. Una proyección local es legítima si está marcada\n' +
    '`authoritative: false` y se sustituye por la del servidor al sincronizar; lo que no\n' +
    'es legítimo es persistirla desde el navegador.\n' +
    'Registro: `packages/domain/src/authority-registry.json`.',
);

if (process.env['STUDY_OS_GUARD_DEBUG'] === '1') {
  console.error(`DEBUG · ${DECL_KINDS.VARIABLE} · ${findings.length} hallazgo(s)`);
}
