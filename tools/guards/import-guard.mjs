#!/usr/bin/env node
/**
 * GUARDA 1 · Regla de import de motores.
 *
 * ADR-001 v1.1 punto 2 · EC-002 · EC-003
 *
 * Los motores deterministas son autoridad de servidor. ADR-001 rebajó
 * deliberadamente esta regla de invariante constitucional a **medida de higiene
 * revisable**: su incumplimiento es deuda a justificar, no un fallo duro de
 * arquitectura. El invariante duro es INV-113, que verifica `client-authority-guard`.
 *
 * Aun siendo higiene, se ejecuta como check bloqueante: la forma de que una regla
 * revisable no se erosione es que romperla cueste una conversación explícita.
 *
 * ---------------------------------------------------------------------------
 * Qué cambió respecto a la primera versión
 *
 *   - Alcance: `apps/**` **y** `packages/**`. Un paquete que forma parte de la
 *     superficie de cliente puede importar un motor igual que un componente, y la
 *     versión anterior no miraba ahí.
 *   - Superficie de cliente **transitiva**, no solo ficheros con `'use client'`.
 *   - Detección por AST: cubre `import`, `export … from`, `import()` dinámico y
 *     `require()`. La versión anterior solo veía `from '…'`.
 * ---------------------------------------------------------------------------
 */

import { report } from './lib/walk.mjs';
import { lineOfNode, moduleSpecifiers } from './lib/ast.mjs';
import { computeClientSurface, describeVia } from './lib/client-surface.mjs';

/** Paquetes cuyo código no debe alcanzar el cliente. */
const ENGINE_PACKAGES = ['@study-os/learning-engine', '@study-os/planner-engine'];

const { clientFiles, parsed } = computeClientSurface();

const findings = [];

for (const [file, info] of clientFiles) {
  const sourceFile = parsed.get(file);
  if (!sourceFile) continue;

  for (const entry of moduleSpecifiers(sourceFile)) {
    const engine = ENGINE_PACKAGES.find(
      (pkg) => entry.module === pkg || entry.module.startsWith(`${pkg}/`),
    );
    if (!engine) continue;

    findings.push({
      file,
      line: lineOfNode(sourceFile, entry.node),
      message:
        `Superficie de cliente importa "${entry.module}" (${entry.kind}). ` +
        `Las reglas del motor no viajan al navegador.${describeVia(info.via)}`,
    });
  }
}

console.log(`  (superficie de cliente: ${clientFiles.size} fichero(s) en apps/ y packages/)`);

report(
  'import-guard',
  findings,
  'ADR-001 v1.1 punto 2. Si este import es necesario, es deuda que debe justificarse en\n' +
    'el checkpoint, no silenciarse. La alternativa correcta suele ser exponer el cálculo\n' +
    'como una superficie de servidor y consumir su resultado.',
);
