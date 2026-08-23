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
 * demostrar de un vistazo. Ahora la regla es al revés y no necesita adivinar a qué
 * tabla se escribe:
 *
 *   · en superficie de cliente, **cualquier** `.insert()`, `.update()`, `.upsert()`
 *     o `.delete()` es un hallazgo, sea cual sea el receptor;
 *   · **cualquier** `.rpc()` es un hallazgo salvo que su nombre esté en la allowlist
 *     explícita de RPC estrictamente de lectura —hoy vacía—;
 *   · si el nombre de la RPC o del método no puede resolverse a un literal, se
 *     rechaza: no poder demostrar que es seguro no es lo mismo que serlo.
 *
 * ---------------------------------------------------------------------------
 * Lo que la segunda auditoría demostró que seguía pasando
 *
 * Mirar solo la llamada deja fuera todo lo que **separa el método de su llamada**:
 *
 *     const upd = supabase.from('t').update;   // alias por acceso a propiedad
 *     await upd.call(q, payload);
 *
 *     const { rpc } = supabase;                // desestructuración
 *     await rpc('recalculate_mastery', {});
 *
 *     await q[metodoQueVieneDeFuera](payload); // nombre computado no resoluble
 *
 * Y la excepción de las APIs del navegador era peor: bastaba **sombrear** el
 * global para heredar su exención.
 *
 *     function evade(caches: any) {            // parámetro llamado como el global
 *       return caches.from('t').delete();
 *     }
 *
 * Ahora:
 *
 *   · declarar un alias de un método de escritura o de `rpc` es en sí mismo un
 *     hallazgo, se llame o no después: el alias es la evidencia;
 *   · llamar a un identificador suelto que se llama `insert`, `update`, `upsert`,
 *     `delete` o `rpc` es un hallazgo, venga de donde venga —desestructuración,
 *     parámetro o importación—;
 *   · un método computado que no se resuelve a un literal es un hallazgo;
 *   · la excepción de navegador **solo** vale para el símbolo global real: si el
 *     fichero declara en cualquier parte un enlace con ese nombre —parámetro,
 *     variable, importación, función, clase o `catch`— deja de aplicarse. Es
 *     deliberadamente conservador: preferimos revisar un caso legítimo a dejar
 *     pasar uno que se disfrazó de `caches`.
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

/** Todo lo que no puede separarse de su llamada sin levantar sospecha. */
const GUARDED_MEMBERS = new Set([...WRITE_METHODS, 'rpc']);

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

/**
 * Todos los nombres que el fichero **declara**.
 *
 * Sirve para una sola cosa: saber si un identificador puede ser el global del
 * navegador o si el fichero lo ha sombreado. Se recogen a nivel de fichero, no de
 * ámbito: sombrear `caches` en cualquier punto retira la exención en todo el
 * fichero. Es más estricto que la semántica de JavaScript, y esa es la dirección
 * en la que queremos equivocarnos.
 */
function collectDeclaredNames(sourceFile) {
  const declared = new Set();

  const addBindingName = (name) => {
    if (!name) return;
    if (ts.isIdentifier(name)) {
      declared.add(name.text);
      return;
    }
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) addBindingName(element.name);
      }
    }
  };

  walkAst(sourceFile, (node) => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      addBindingName(node.name);
      return;
    }
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      if (node.name) declared.add(node.name.text);
      return;
    }
    if (ts.isCatchClause(node) && node.variableDeclaration) {
      addBindingName(node.variableDeclaration.name);
      return;
    }
    if (ts.isImportClause(node)) {
      if (node.name) declared.add(node.name.text);
      const bindings = node.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) declared.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) declared.add(element.name.text);
      }
    }
  });

  return declared;
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
 * `caches.open(x)` tiene raíz `caches`.
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
 * Nombre del método invocado y cómo estaba escrito.
 *
 * Cubre `obj.update(...)`, `obj['update'](...)`, `obj[M](...)` con `M` constante y
 * `obj[loQueSea](...)`, que es el caso que antes se ignoraba en silencio.
 */
function invokedMethod(call, constants) {
  if (ts.isPropertyAccessExpression(call.expression)) {
    return { name: call.expression.name.text, computed: false, resolvable: true };
  }
  if (ts.isElementAccessExpression(call.expression)) {
    const resolved = resolveString(call.expression.argumentExpression, constants);
    return { name: resolved, computed: true, resolvable: resolved !== null };
  }
  return { name: null, computed: false, resolvable: true };
}

/** Nombre del miembro al que apunta un acceso, si puede saberse. */
function accessedMember(expression, constants) {
  if (ts.isPropertyAccessExpression(expression)) {
    return { name: expression.name.text, resolvable: true };
  }
  if (ts.isElementAccessExpression(expression)) {
    const resolved = resolveString(expression.argumentExpression, constants);
    return { name: resolved, resolvable: resolved !== null };
  }
  return { name: null, resolvable: true };
}

for (const [file, info] of clientFiles) {
  const sourceFile = parsed.get(file);
  if (!sourceFile) continue;

  const constants = collectStringConstants(sourceFile);
  const declared = collectDeclaredNames(sourceFile);
  const context = describeVia(info.via);

  /** El global del navegador, y solo si el fichero no lo ha sombreado. */
  const isUnshadowedBrowserGlobal = (name) =>
    name !== null && BROWSER_API_RECEIVERS.has(name) && !declared.has(name);

  const add = (node, message) => {
    findings.push({ file, line: lineOfNode(sourceFile, node), message: message + context });
  };

  walkAst(sourceFile, (node) => {
    // ------------------------------------- alias de un método de escritura o rpc
    // `const upd = q.update` separa el método de su llamada. El alias es la
    // evidencia: no hace falta esperar a ver dónde se invoca.
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const initializer = node.initializer;
      if (ts.isPropertyAccessExpression(initializer) || ts.isElementAccessExpression(initializer)) {
        const member = accessedMember(initializer, constants);
        const root = rootIdentifier(initializer.expression);

        if (member.name !== null && GUARDED_MEMBERS.has(member.name)) {
          if (!isUnshadowedBrowserGlobal(root)) {
            add(
              node,
              'Alias de ".' +
                member.name +
                '" en superficie de cliente: el método se separa de su llamada para que ' +
                'la guarda no vea la escritura. INV-113: el cliente no persiste.',
            );
          }
        }
      }

      // `const { update } = q` · `const { rpc: r } = supabase`
      if (ts.isObjectBindingPattern(node.name)) {
        const root = node.initializer ? rootIdentifier(node.initializer) : null;
        for (const element of node.name.elements) {
          const source = element.propertyName ?? element.name;
          const key =
            ts.isIdentifier(source) || ts.isStringLiteralLike(source) ? source.text : null;
          if (key !== null && GUARDED_MEMBERS.has(key) && !isUnshadowedBrowserGlobal(root)) {
            add(
              element,
              'Desestructuración de ".' +
                key +
                '" en superficie de cliente. Extraer el método del cliente de datos no lo ' +
                'convierte en otra cosa (INV-113).',
            );
          }
        }
      }
    }

    if (!ts.isCallExpression(node)) {
      // ------------------------------------------- clave de rol de servicio
      if (ts.isIdentifier(node) && SERVICE_ROLE_MARKERS.has(node.text)) {
        add(
          node,
          'Referencia a "' +
            node.text +
            '" en superficie de cliente. La clave de rol de servicio atraviesa RLS (EC-010).',
        );
      }
      if (ts.isStringLiteralLike(node) && SERVICE_ROLE_MARKERS.has(node.text)) {
        add(node, 'Literal "' + node.text + '" en superficie de cliente (EC-010).');
      }
      return;
    }

    // ------------------------------- llamada a un identificador suelto guardado
    // `update(payload)` tras `const { update } = supabase.from('t')`, o recibido
    // como parámetro, o importado. No hay receptor que inspeccionar: el nombre es
    // lo bastante específico como para exigir justificación.
    if (ts.isIdentifier(node.expression) && GUARDED_MEMBERS.has(node.expression.text)) {
      add(
        node,
        'Llamada a "' +
          node.expression.text +
          '()" como función suelta en superficie de cliente. Sea alias, desestructuración, ' +
          'parámetro o importación, el cliente no persiste (INV-113).',
      );
      return;
    }

    const { name, computed, resolvable } = invokedMethod(node, constants);
    const root = rootIdentifier(node.expression);
    const isBrowserApi = isUnshadowedBrowserGlobal(root);

    // --------------------------------- método computado que no puede resolverse
    if (computed && !resolvable && !isBrowserApi) {
      add(
        node,
        'Método invocado con un nombre computado que no puede resolverse a un literal. ' +
          'No poder demostrar que no es una escritura no equivale a que no lo sea (INV-113).',
      );
      return;
    }

    // ------------------------------------------------ escrituras, sin excepción
    if (name && WRITE_METHODS.has(name) && !isBrowserApi) {
      add(
        node,
        'Escritura .' +
          name +
          '()' +
          (computed ? ' (acceso computado)' : '') +
          ' en superficie de cliente. INV-113: el cliente no persiste. Si esta escritura ' +
          'es legítima, es deuda que debe justificarse en el checkpoint.',
      );
    }

    // --------------------------------------------------------------- RPC
    if (name === 'rpc' && !isBrowserApi) {
      const rpcName = resolveString(node.arguments[0], constants);

      if (rpcName === null) {
        add(
          node,
          'Llamada .rpc() cuyo nombre no puede resolverse a un literal. No poder ' +
            'demostrar que es de solo lectura no equivale a que lo sea.',
        );
      } else if (!READ_ONLY_RPCS.has(rpcName)) {
        const anchor = registry.rpcs.anchors?.[rpcName];
        add(
          node,
          'Llamada de cliente a la RPC "' +
            rpcName +
            '", que no está en la allowlist de solo lectura (' +
            READ_ONLY_RPCS.size +
            ' entradas)' +
            (AUTHORITATIVE_RPCS.has(rpcName) ? ' · RPC autoritativa · ' + anchor : '') +
            '.',
        );
      }
    }

    // ------------------------------------------- clave de rol de servicio
    if (ts.isIdentifier(node.expression) && SERVICE_ROLE_MARKERS.has(node.expression.text)) {
      add(node, 'Referencia a "' + node.expression.text + '" en superficie de cliente (EC-010).');
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
    `${PROJECTIONS.size} proyecciones registradas; excepción de navegador solo para ` +
    `globales no sombreados)`,
);

report(
  'client-authority-guard',
  findings,
  'INV-113 · REQ-A08 · EC-010. En superficie de cliente no se escribe: ni `.insert()`,\n' +
    'ni `.update()`, ni `.upsert()`, ni `.delete()`, ni una `.rpc()` que no esté en la\n' +
    'allowlist de solo lectura, ni un alias o desestructuración de cualquiera de ellos.\n' +
    'Una proyección local es legítima si está marcada `authoritative: false` y se\n' +
    'sustituye por la del servidor al sincronizar; lo que no es legítimo es persistirla\n' +
    'desde el navegador.\n' +
    'Registro: `packages/domain/src/authority-registry.json`.',
);
