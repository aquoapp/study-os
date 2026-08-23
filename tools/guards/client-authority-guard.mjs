#!/usr/bin/env node
/**
 * GUARDA 3 · El cliente no escribe. Política conservadora.
 *
 * INV-113 · «El servidor es la autoridad exclusiva para persistir Mastery, Exam
 * Readiness y estado del Planner. Ninguna ruta de cliente escribe esas proyecciones.»
 * REQ-A08 · ADR-001 v1.1 punto 2 · EC-002 · EC-003 · EC-010
 *
 * ---------------------------------------------------------------------------
 * Por qué la política pasó de lista negra a lista blanca
 *
 * La versión anterior solo saltaba cuando podía **demostrar** que la escritura era
 * sobre una proyección autoritativa: reconstruía la cadena `.from('tabla').update()`
 * y comparaba el nombre contra un registro. Eso deja fuera todo lo que no se puede
 * demostrar de un vistazo:
 *
 *     const q = supabase.from(TABLE);   // nombre en una constante
 *     const w = q;                      // cadena partida en variables
 *     await w[method](payload);         // método computado
 *
 * y cualquier helper que envuelva la llamada. Una guarda que solo detecta lo obvio
 * es un filtro de descuidos, no un control.
 *
 * Ahora la regla es al revés y no necesita adivinar a qué tabla se escribe:
 *
 *   · en superficie de cliente, **cualquier** `.insert()`, `.update()`, `.upsert()`
 *     o `.delete()` es un hallazgo, sea cual sea el receptor;
 *   · **cualquier** `.rpc()` es un hallazgo salvo que su nombre esté en la allowlist
 *     explícita de RPC estrictamente de lectura —hoy vacía—;
 *   · si el nombre de la RPC no puede resolverse a un literal, se rechaza: no
 *     poder demostrar que es segura no es lo mismo que serlo.
 *
 * El coste es algún falso positivo si algún día el cliente necesita escribir en una
 * tabla que no es una proyección. Ese caso existirá y tendrá que justificarse en el
 * checkpoint, que es exactamente lo que se busca.
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, report } from './lib/walk.mjs';
import { lineOfNode, ts, walkAst } from './lib/ast.mjs';
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

const { clientFiles, parsed, boundaryViolations } = computeClientSurface();

const findings = [];

/**
 * Constantes de cadena declaradas en el fichero.
 *
 * Permite resolver `const TABLE = 'concept_mastery'` y `const M = 'update'`, que es
 * la forma más simple de partir una cadena para que una guarda textual no la vea.
 */
function collectStringConstants(sourceFile) {
  const constants = new Map();

  walkAst(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      constants.set(node.name.text, node.initializer.text);
    }
  });

  return constants;
}

/** Resuelve una expresión a un literal de cadena, si se puede. */
function resolveString(node, constants) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isIdentifier(node)) return constants.get(node.text) ?? null;
  if (ts.isParenthesizedExpression(node)) return resolveString(node.expression, constants);
  if (ts.isAsExpression(node)) return resolveString(node.expression, constants);
  return null;
}

/**
 * Identificador raíz de una cadena de accesos y llamadas.
 *
 * `caches.open(x)` tiene raíz `caches`. Solo se exime cuando la raíz es un
 * **global** del navegador declarado en el registro: un objeto local llamado
 * `cache` no queda exento.
 */
function rootIdentifier(expression) {
  let current = expression;
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current) ||
    ts.isCallExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : null;
}

/**
 * Nombre del método invocado y si estaba escrito de forma computada.
 *
 * Cubre `obj.update(...)`, `obj['update'](...)` y `obj[M](...)` con `M` constante.
 */
function invokedMethod(call, constants) {
  if (ts.isPropertyAccessExpression(call.expression)) {
    return { name: call.expression.name.text, computed: false };
  }
  if (ts.isElementAccessExpression(call.expression)) {
    const resolved = resolveString(call.expression.argumentExpression, constants);
    return { name: resolved, computed: true };
  }
  return { name: null, computed: false };
}

for (const [file, info] of clientFiles) {
  const sourceFile = parsed.get(file);
  if (!sourceFile) continue;

  const constants = collectStringConstants(sourceFile);
  const context = describeVia(info.via);

  walkAst(sourceFile, (node) => {
    // ------------------------------------------------ escrituras, sin excepción
    if (ts.isCallExpression(node)) {
      const { name, computed } = invokedMethod(node, constants);

      const root = rootIdentifier(node.expression);
      const isBrowserApi = root !== null && BROWSER_API_RECEIVERS.has(root);

      if (name && WRITE_METHODS.has(name) && !isBrowserApi) {
        findings.push({
          file,
          line: lineOfNode(sourceFile, node),
          message:
            `Escritura .${name}()${computed ? ' (acceso computado)' : ''} en superficie de ` +
            `cliente. INV-113: el cliente no persiste. Si esta escritura es legítima, ` +
            `es deuda que debe justificarse en el checkpoint.${context}`,
        });
      }

      // --------------------------------------------------------------- RPC
      if (name === 'rpc') {
        const rpcName = resolveString(node.arguments[0], constants);

        if (rpcName === null) {
          findings.push({
            file,
            line: lineOfNode(sourceFile, node),
            message:
              'Llamada .rpc() cuyo nombre no puede resolverse a un literal. No poder ' +
              'demostrar que es de solo lectura no equivale a que lo sea.' +
              context,
          });
        } else if (!READ_ONLY_RPCS.has(rpcName)) {
          const anchor = registry.rpcs.anchors?.[rpcName];
          findings.push({
            file,
            line: lineOfNode(sourceFile, node),
            message:
              `Llamada de cliente a la RPC "${rpcName}", que no está en la allowlist de ` +
              `solo lectura (${READ_ONLY_RPCS.size} entradas)` +
              `${AUTHORITATIVE_RPCS.has(rpcName) ? ` · RPC autoritativa · ${anchor}` : ''}.` +
              context,
          });
        }
      }
    }

    // ------------------------------------------- clave de rol de servicio
    if (ts.isIdentifier(node) && SERVICE_ROLE_MARKERS.has(node.text)) {
      findings.push({
        file,
        line: lineOfNode(sourceFile, node),
        message:
          `Referencia a "${node.text}" en superficie de cliente. La clave de rol de ` +
          `servicio atraviesa RLS (EC-010).${context}`,
      });
    }
    if (ts.isStringLiteralLike(node) && SERVICE_ROLE_MARKERS.has(node.text)) {
      findings.push({
        file,
        line: lineOfNode(sourceFile, node),
        message: `Literal "${node.text}" en superficie de cliente (EC-010).${context}`,
      });
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
  `  (superficie de cliente: ${clientFiles.size} fichero(s); política conservadora: ` +
    `0 escrituras permitidas, ${READ_ONLY_RPCS.size} RPC en la allowlist de lectura; ` +
    `${PROJECTIONS.size} proyecciones registradas)`,
);

report(
  'client-authority-guard',
  findings,
  'INV-113 · REQ-A08 · EC-010. En superficie de cliente no se escribe: ni `.insert()`,\n' +
    'ni `.update()`, ni `.upsert()`, ni `.delete()`, ni una `.rpc()` que no esté en la\n' +
    'allowlist de solo lectura. Una proyección local es legítima si está marcada\n' +
    '`authoritative: false` y se sustituye por la del servidor al sincronizar; lo que no\n' +
    'es legítimo es persistirla desde el navegador.\n' +
    'Registro: `packages/domain/src/authority-registry.json`.',
);
