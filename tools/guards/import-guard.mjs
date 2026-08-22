#!/usr/bin/env node
/**
 * GUARDA 1 · Regla de import de motores.
 *
 * ADR-001 v1.1 punto 2 · EC-002 · EC-003
 *
 * Los motores deterministas (Learning Engine, Planner Engine) son autoridad de
 * servidor. ADR-001 rebajó deliberadamente esta regla de invariante constitucional
 * a **medida de higiene revisable**: su incumplimiento es deuda a justificar, no un
 * fallo duro de arquitectura. El invariante duro es INV-113 (autoridad de
 * persistencia), que verifica `client-authority-guard`.
 *
 * Aun siendo higiene, se ejecuta como check bloqueante de CI: la forma de que una
 * regla revisable no se erosione es que romperla cueste una conversación explícita.
 *
 * En Phase 0 no existe todavía ningún paquete de motor. La guarda ya está activa
 * para que el primer import indebido de Phase 3 falle el día que se escriba, no
 * tres fases después.
 */

import { join } from 'node:path';

import { REPO_ROOT, lineOf, read, report, stripComments, walk } from './lib/walk.mjs';

/** Paquetes cuyo código no debe alcanzar el cliente. */
const ENGINE_PACKAGES = ['@study-os/learning-engine', '@study-os/planner-engine'];

/** Ficheros de cliente: llevan la directiva `use client` o son de navegador por ruta. */
function isClientFile(relPath, source) {
  if (/^apps\/web\/src\/lib\//.test(relPath)) return true;
  return /^\s*(['"])use client\1/m.test(source);
}

const CANDIDATES = walk(join(REPO_ROOT, 'apps'), (p) => /\.(ts|tsx|js|jsx|mjs)$/.test(p));

const findings = [];

for (const file of CANDIDATES) {
  const source = read(file);
  if (!isClientFile(file, source)) continue;

  const code = stripComments(source);

  for (const pkg of ENGINE_PACKAGES) {
    const pattern = new RegExp(`(?:from\\s*|import\\s*\\(\\s*)['"]${pkg.replace('/', '\\/')}`, 'g');
    let match;
    while ((match = pattern.exec(code)) !== null) {
      findings.push({
        file,
        line: lineOf(code, match.index),
        message: `Fichero de cliente importa "${pkg}". Las reglas del motor no viajan al navegador.`,
      });
    }
  }
}

report(
  'import-guard',
  findings,
  'ADR-001 v1.1 punto 2. Si este import es necesario, es deuda que debe justificarse en\n' +
    'el checkpoint, no silenciarse. La alternativa correcta suele ser exponer el cálculo\n' +
    'como una superficie de servidor y consumir su resultado.',
);
