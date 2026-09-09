#!/usr/bin/env node
/**
 * GUARDA 3 · El cliente no escribe. Política conservadora, **por propagación**.
 *
 * INV-113 · «El servidor es la autoridad exclusiva para persistir Mastery, Exam
 * Readiness y estado del Planner. Ninguna ruta de cliente escribe esas proyecciones.»
 * REQ-A08 · ADR-001 v1.1 punto 2 · EC-002 · EC-003 · EC-010
 *
 * ---------------------------------------------------------------------------
 * Tres reglas, y ninguna mira la forma de la llamada
 *
 * 1. **Acceder** a un miembro llamado `insert`, `update`, `upsert` o `delete` en
 *    superficie de cliente es un hallazgo, se invoque o no. Un método que se
 *    guarda, se enlaza, se pasa o se devuelve sigue siendo el método.
 *
 * 2. **Invocar** algo que lleve una capacidad de escritura, de RPC extraída o de
 *    miembro no demostrable es un hallazgo. La capacidad la asigna el motor de
 *    propagación —`tools/guards/lib/dataflow.mjs`— y viaja por declaraciones,
 *    asignaciones simples y compuestas, desestructuración, propiedades de objeto,
 *    elementos de array, `bind`/`call`/`apply`, retornos y argumentos. Da igual
 *    cuántos alias haya en medio:
 *
 *        const operations = { run: query[method] };
 *        operations.run(payload);                 // invoca un miembro no demostrable
 *
 * 3. **`.rpc()`** solo se admite como invocación directa con nombre literal incluido
 *    en la allowlist de solo lectura. El acceso a `.rpc` no se denuncia por sí
 *    mismo: se comprueba la allowlist en la llamada. Una RPC fuera de la lista,
 *    con nombre dinámico, o extraída y llamada por otro camino, es un hallazgo.
 *
 * ---------------------------------------------------------------------------
 * La excepción de navegador es un par exacto
 *
 * `caches.delete(key)`. Solo eso. El receptor tiene que ser el identificador
 * `caches` que **ningún ámbito del fichero declara**, el miembro tiene que ser
 * `delete`, y el acceso tiene que ser la llamada misma. Otro global con un
 * `delete` —`window.delete()`, aunque alguien lo declare en `Window`— es un
 * hallazgo. Sombrear, extraer, enlazar o reasignar no heredan la excepción.
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, report } from './lib/walk.mjs';
import { lineOfNode, ts, walkAst } from './lib/ast.mjs';
import { buildScopeTable } from './lib/scope.mjs';
import { analyzeDataflow, unwrap } from './lib/dataflow.mjs';
import { computeClientSurface, describeVia } from './lib/client-surface.mjs';

const registry = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages/domain/src/authority-registry.json'), 'utf8'),
);

const PROJECTIONS = new Set(registry.projections.tables);
const AUTHORITATIVE_RPCS = new Set(registry.rpcs.names);
const READ_ONLY_RPCS = new Set(registry.readOnlyRpcs.names);
/**
 * Phase 2 · RPC invocables por cliente que escriben (H-P2-3). Mismo trato que la
 * allowlist de lectura: solo invocación directa con nombre literal. Su contrato de
 * seguridad vive en el registro; aquí solo se comprueba que el nombre esté declarado.
 */
const CLIENT_INVOKABLE_RPCS = new Set(registry.clientInvokableRpcs?.names ?? []);
const ALLOWED_RPCS = new Set([...READ_ONLY_RPCS, ...CLIENT_INVOKABLE_RPCS]);
const WRITE_METHODS = new Set(registry.writeMethods.names);
const SERVICE_ROLE_MARKERS = new Set(registry.serviceRoleMarkers.names);
/** Pares exactos `receptor global + miembro` que se admiten en invocación directa. */
const BROWSER_API_PAIRS = new Map(
  registry.browserApiExceptions.pairs.map((pair) => [`${pair.receiver}.${pair.member}`, pair]),
);

const LABEL_WRITE = 'cap:write';
const LABEL_RPC = 'cap:rpc';
const LABEL_OPAQUE = 'cap:opaque';

const { clientFiles, parsed, boundaryViolations } = computeClientSurface();

const findings = [];

/** Constantes de cadena por símbolo: solo las que nunca se reasignan. */
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
    if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
      node.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken &&
      ts.tokenToString(node.operatorToken.kind)?.endsWith('=')
    ) {
      const binding = resolve(node.left);
      if (binding) poisoned.add(binding.declaration);
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      ts.isIdentifier(node.operand)
    ) {
      const binding = resolve(node.operand);
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

for (const [file, info] of clientFiles) {
  const sourceFile = parsed.get(file);
  if (!sourceFile) continue;

  const { resolve } = buildScopeTable(sourceFile);
  const resolveString = makeConstantResolver(sourceFile, resolve);
  const context = describeVia(info.via);

  const add = (node, message) => {
    findings.push({ file, line: lineOfNode(sourceFile, node), message: message + context });
  };

  /** Nombre del miembro accedido: `{ name, computed, resolved }`. */
  const memberOf = (access) => {
    if (ts.isPropertyAccessExpression(access)) {
      return { name: access.name.text, computed: false, resolved: true };
    }
    const name = resolveString(access.argumentExpression);
    return { name, computed: true, resolved: name !== null };
  };

  const isDirectCallee = (access) => {
    const parent = access.parent;
    return Boolean(parent && ts.isCallExpression(parent) && parent.expression === access);
  };

  /** El par exacto: receptor global no sombreado + miembro registrado + llamada. */
  const isBrowserApiPair = (access) => {
    const receiver = unwrap(access.expression);
    if (!ts.isIdentifier(receiver)) return false;
    if (resolve(receiver) !== null) return false;
    const { name } = memberOf(access);
    if (name === null || !BROWSER_API_PAIRS.has(`${receiver.text}.${name}`)) return false;
    return isDirectCallee(access);
  };

  // --------------------------------------------------------------- propagación
  const flow = analyzeDataflow(sourceFile, resolve, {
    resolveString,
    seed(node) {
      // Elementos de patrón: `const { update } = q` y `({ update: w } = q)`.
      if (
        ts.isBindingElement(node) ||
        ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node)
      ) {
        const keyNode = ts.isBindingElement(node) ? (node.propertyName ?? node.name) : node.name;
        const key =
          ts.isIdentifier(keyNode) || ts.isStringLiteralLike(keyNode)
            ? keyNode.text
            : ts.isComputedPropertyName(keyNode)
              ? resolveString(keyNode.expression)
              : null;
        if (key === null && ts.isComputedPropertyName(keyNode)) return [LABEL_OPAQUE];
        if (key !== null && WRITE_METHODS.has(key)) return [`${LABEL_WRITE}:${key}`];
        if (key === 'rpc') return [LABEL_RPC];
        return null;
      }
      if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return null;
      if (isBrowserApiPair(node)) return null;
      const { name, resolved } = memberOf(node);
      if (!resolved) return [LABEL_OPAQUE];
      if (WRITE_METHODS.has(name)) return [`${LABEL_WRITE}:${name}`];
      if (name === 'rpc') return [LABEL_RPC];
      return null;
    },
  });

  if (flow.reachedLimit) {
    add(sourceFile, 'La propagación no convergió: el fichero se trata como sospechoso entero.');
  }

  const howUsed = (access) => {
    const parent = access.parent;
    if (!parent) return 'se referencia';
    if (ts.isCallExpression(parent) && parent.expression === access) return 'se invoca';
    if (
      ts.isPropertyAccessExpression(parent) &&
      ['bind', 'call', 'apply'].includes(parent.name.text)
    ) {
      return `se enlaza con .${parent.name.text}()`;
    }
    if (ts.isVariableDeclaration(parent)) return 'se guarda en una variable';
    if (ts.isBinaryExpression(parent) && parent.right === access) return 'se asigna a una variable';
    if (ts.isCallExpression(parent)) return 'se pasa como argumento';
    if (ts.isReturnStatement(parent)) return 'se devuelve';
    if (ts.isPropertyAssignment(parent) || ts.isArrayLiteralExpression(parent)) {
      return 'se almacena en otra estructura';
    }
    return 'se referencia';
  };

  // ------------------------------------------------ 1 · accesos a escritura
  walkAst(sourceFile, (node) => {
    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return;
    if (isBrowserApiPair(node)) return;

    const { name, computed, resolved } = memberOf(node);
    if (!resolved) return; // lo decide la propagación, cuando se invoque
    if (WRITE_METHODS.has(name)) {
      add(
        node,
        `El miembro ".${name}"${computed ? ' (acceso computado)' : ''} ${howUsed(node)} en ` +
          'superficie de cliente. INV-113: el cliente no persiste, y separar el método de su ' +
          'llamada no lo convierte en otra cosa. Si esta operación es legítima, es deuda que ' +
          'debe justificarse en el checkpoint.',
      );
      return;
    }
    // `.rpc` extraído: no es una invocación directa, así que la allowlist no puede
    // comprobarse. Se denuncia la extracción.
    if (name === 'rpc' && !isDirectCallee(node)) {
      add(
        node,
        `El miembro ".rpc" ${howUsed(node)} en lugar de invocarse directamente. Una RPC ` +
          'extraída no puede contrastarse con la allowlist de solo lectura (INV-113).',
      );
    }
  });

  // --------------------------------------- 1b · desestructuración de escritura
  const checkKey = (keyNode, target, verb = 'Desestructuración') => {
    const key =
      ts.isIdentifier(keyNode) || ts.isStringLiteralLike(keyNode)
        ? keyNode.text
        : ts.isComputedPropertyName(keyNode)
          ? resolveString(keyNode.expression)
          : null;
    if (key !== null && WRITE_METHODS.has(key)) {
      add(
        target,
        `${verb} de ".${key}" en superficie de cliente. Extraer el método del ` +
          'cliente de datos no lo convierte en otra cosa (INV-113).',
      );
    }
    if (key === 'rpc') {
      add(
        target,
        `${verb} de ".rpc" en superficie de cliente. Una RPC extraída no puede ` +
          'contrastarse con la allowlist de solo lectura (INV-113).',
      );
    }
  };

  walkAst(sourceFile, (node) => {
    if (ts.isObjectBindingPattern(node)) {
      for (const element of node.elements) {
        if (ts.isBindingElement(element)) checkKey(element.propertyName ?? element.name, element);
      }
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isObjectLiteralExpression(node.left)
    ) {
      for (const property of node.left.properties) {
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          checkKey(property.name, property, 'Asignación destructurada');
        }
      }
    }
  });

  // ---------------------------------------------- 2 y 3 · invocaciones
  walkAst(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;

    const { node: callee, through } = flow.effectiveCallee(node);
    const isDirectMember =
      through === null &&
      (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee));

    // 3 · `.rpc(nombre, …)` como invocación directa: se comprueba la allowlist.
    if (isDirectMember && memberOf(callee).name === 'rpc') {
      const rpcName = resolveString(node.arguments[0]);
      if (rpcName === null) {
        add(
          node,
          'Llamada .rpc() cuyo nombre no puede resolverse a un literal. No poder demostrar ' +
            'que es de solo lectura no equivale a que lo sea.',
        );
      } else if (!ALLOWED_RPCS.has(rpcName)) {
        const anchor = registry.rpcs.anchors?.[rpcName];
        add(
          node,
          `Llamada de cliente a la RPC "${rpcName}", que no está en la allowlist de solo ` +
            `lectura (${READ_ONLY_RPCS.size} entradas) ni entre las RPC invocables por ` +
            `cliente declaradas (${CLIENT_INVOKABLE_RPCS.size} entradas)` +
            `${AUTHORITATIVE_RPCS.has(rpcName) ? ` · RPC autoritativa · ${anchor}` : ''}.`,
        );
      }
      return;
    }

    // Un acceso directo a escritura ya se denunció en 1. Lo que sigue es lo que
    // llega por propagación: alias, contenedores, bind/call/apply, retornos…
    if (isDirectMember && WRITE_METHODS.has(memberOf(callee).name ?? '')) return;

    const capabilities = flow.factsOf(callee);
    const describe = ts.isIdentifier(callee)
      ? `"${callee.text}()"`
      : `\`${callee.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 48)}\``;
    const via = through ? ` a través de .${through}()` : '';

    for (const label of capabilities) {
      if (label.startsWith(`${LABEL_WRITE}:`)) {
        add(
          node,
          `Invocación de ${describe}${via}, que lleva el método ".${label.slice(LABEL_WRITE.length + 1)}" ` +
            'por propagación —alias, contenedor, enlace o retorno—. Renombrar no cambia la ' +
            'operación (INV-113).',
        );
        return;
      }
    }
    if (capabilities.has(LABEL_OPAQUE)) {
      add(
        node,
        `Invocación de ${describe}${via}, que lleva un miembro con nombre computado no ` +
          'demostrable. Almacenarlo en un objeto, array o variable no lo blanquea: no poder ' +
          'demostrar qué se invoca no equivale a que sea seguro (INV-113).',
      );
      return;
    }
    if (capabilities.has(LABEL_RPC)) {
      add(
        node,
        `Invocación de ${describe}${via}, que es una RPC extraída. Sin invocación directa ` +
          'con nombre literal, la allowlist de solo lectura no puede comprobarse (INV-113).',
      );
      return;
    }

    // Identificador suelto con nombre de escritura: parámetro, importación…
    if (
      ts.isIdentifier(callee) &&
      through === null &&
      (WRITE_METHODS.has(callee.text) || callee.text === 'rpc')
    ) {
      add(
        node,
        `Llamada a "${callee.text}()" como función suelta en superficie de cliente. Sea ` +
          'alias, parámetro o importación, el cliente no persiste (INV-113).',
      );
    }
  });

  // -------------------------------------------- clave de rol de servicio
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
  `  (superficie de cliente: ${clientFiles.size} fichero(s); propagación de capacidades por ` +
    `punto fijo; 0 escrituras permitidas, ${READ_ONLY_RPCS.size} RPC en la allowlist de ` +
    `lectura, ${CLIENT_INVOKABLE_RPCS.size} RPC invocables por cliente declaradas; ` +
    `${PROJECTIONS.size} proyecciones registradas; excepción de navegador: ` +
    `${[...BROWSER_API_PAIRS.keys()].join(', ')} en invocación directa)`,
);

report(
  'client-authority-guard',
  findings,
  'INV-113 · REQ-A08 · EC-010. En superficie de cliente no se accede a `.insert()`,\n' +
    '`.update()`, `.upsert()` ni `.delete()` —ni para invocarlos, ni para guardarlos,\n' +
    'enlazarlos, pasarlos o devolverlos—, y `.rpc()` solo como invocación directa con un\n' +
    'nombre literal de la allowlist de solo lectura. Lo que llega por alias, contenedor,\n' +
    'bind/call/apply o retorno se detecta por propagación, no por su forma.\n' +
    'Registro: `packages/domain/src/authority-registry.json`.',
);
