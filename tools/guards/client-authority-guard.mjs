#!/usr/bin/env node
/**
 * GUARDA 3 · El cliente no persiste proyecciones autoritativas.
 *
 * INV-113 · «El servidor es la autoridad exclusiva para persistir Mastery, Exam
 * Readiness y estado del Planner. Ninguna ruta de cliente escribe esas proyecciones.»
 * REQ-A08 · ADR-001 v1.1 punto 2 · EC-002 · EC-003 · EC-010
 *
 * Check de CI: `client-authority-guard` (Execution Plan §4).
 *
 * ---------------------------------------------------------------------------
 * Alcance
 *
 *   - `apps/**` y `packages/**`. Un helper en `packages/` importado por un
 *     componente de cliente acaba en el navegador igual que si estuviera en
 *     `apps/`; limitar la guarda a `apps/` dejaba abierta esa puerta.
 *   - Superficie de cliente **transitiva**: raíces `'use client'` y rutas de
 *     navegador, más todo lo que alcanzan por importación.
 *
 * Qué detecta
 *
 *   1. escritura sobre una proyección autoritativa: `.from('tabla')` en la misma
 *      cadena que `.insert|update|upsert|delete`;
 *   2. invocación de una RPC autoritativa: `.rpc('nombre')` contra el registro
 *      explícito de `packages/domain/src/authority-registry.json`;
 *   3. referencia a la clave de rol de servicio, que atraviesa RLS;
 *   4. un módulo `server-only` alcanzable desde cliente.
 *
 * El análisis es sintáctico, no textual: la cadena se reconstruye del AST, de modo
 * que saltos de línea, comentarios o llamadas intermedias no la ocultan.
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, report } from './lib/walk.mjs';
import { callChain, lineOfNode, stringArg, ts, walkAst } from './lib/ast.mjs';
import { computeClientSurface, describeVia } from './lib/client-surface.mjs';

const registry = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages/domain/src/authority-registry.json'), 'utf8'),
);

const PROJECTIONS = new Set(registry.projections.tables);
const AUTHORITATIVE_RPCS = new Set(registry.rpcs.names);
const WRITE_METHODS = new Set(registry.writeMethods.names);
const SERVICE_ROLE_MARKERS = new Set(registry.serviceRoleMarkers.names);

const { clientFiles, parsed, boundaryViolations } = computeClientSurface();

const findings = [];

for (const [file, info] of clientFiles) {
  const sourceFile = parsed.get(file);
  if (!sourceFile) continue;

  const context = describeVia(info.via);

  walkAst(sourceFile, (node) => {
    // --- 1 y 2 · cadenas de llamada -----------------------------------------
    const chain = callChain(node);
    if (chain) {
      const fromStep = chain.steps.find((step) => step.name === 'from');
      const table = fromStep ? stringArg(fromStep.call) : null;

      if (table && PROJECTIONS.has(table)) {
        const write = chain.steps.find((step) => WRITE_METHODS.has(step.name));
        if (write) {
          findings.push({
            file,
            line: lineOfNode(sourceFile, write.call),
            message:
              `Escritura de cliente .${write.name}() sobre la proyección autoritativa ` +
              `"${table}". INV-113: solo el servidor la persiste.${context}`,
          });
        }
      }

      const rpcStep = chain.steps.find((step) => step.name === 'rpc');
      const rpcName = rpcStep ? stringArg(rpcStep.call) : null;
      if (rpcName && AUTHORITATIVE_RPCS.has(rpcName)) {
        const anchor = registry.rpcs.anchors?.[rpcName] ?? 'INV-113';
        findings.push({
          file,
          line: lineOfNode(sourceFile, rpcStep.call),
          message:
            `Invocación de cliente a la RPC autoritativa "${rpcName}". ` +
            `Anclaje: ${anchor}.${context}`,
        });
      }
    }

    // --- 3 · clave de rol de servicio ---------------------------------------
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

// --- 4 · frontera server-only ------------------------------------------------
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
  `  (superficie de cliente: ${clientFiles.size} fichero(s); ` +
    `${PROJECTIONS.size} proyecciones y ${AUTHORITATIVE_RPCS.size} RPC en el registro)`,
);

report(
  'client-authority-guard',
  findings,
  'INV-113 · REQ-A08 · EC-010. Una proyección local es legítima si está marcada\n' +
    '`authoritative: false` (ver `@study-os/domain`) y se sustituye por la del servidor al\n' +
    'sincronizar. Lo que no es legítimo es persistirla desde el navegador.\n' +
    'El registro de proyecciones y RPC autoritativas vive en\n' +
    '`packages/domain/src/authority-registry.json`.',
);
