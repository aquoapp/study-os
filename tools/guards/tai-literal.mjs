#!/usr/bin/env node
/**
 * GUARDA 2 · El literal `TAI` fuera de contenido.
 *
 * EC-018 · «TAI es un pack; el shell es exam-neutral».
 * Enforcement declarado en `spec/invariant-register.md`: «Check de CI: prohibido el
 * literal `TAI` fuera de `content/` y de seeds».
 * Manifest §5 · «TAI-specific assumptions must not contaminate the reusable shell».
 *
 * El shell de Study OS debe poder servir un segundo pack de examen sin cambiar de
 * esquema ni de código. Cada aparición de `TAI` en el shell es una suposición
 * incrustada que habrá que perseguir el día que exista ese segundo pack.
 */

import { join } from 'node:path';

import { REPO_ROOT, lineOf, read, report, walk } from './lib/walk.mjs';

/** Rutas donde `TAI` es legítimo: es contenido, no shell. */
const ALLOWED_PREFIXES = [
  'content/',
  'supabase/seed/',
  // Documentación y especificación describen el pack; no son código de shell.
  'spec/',
  'architecture/',
  'docs/',
  'README.md',
  'CLAUDE.md',
  // Las guardas nombran el literal para poder prohibirlo.
  'tools/guards/',
  'tests/unit/taiLiteral.guard.spec.ts',
];

/** `TAI` como palabra completa: no debe saltar con `CONTAIN`, `retain` o `TAIL`. */
const TAI_PATTERN = /(?<![A-Za-z0-9_])TAI(?![A-Za-z0-9_])/g;

const SCANNED_ROOTS = ['apps', 'packages', 'tools', 'tests', 'supabase'];

const findings = [];

for (const root of SCANNED_ROOTS) {
  const files = walk(join(REPO_ROOT, root), (p) =>
    /\.(ts|tsx|js|jsx|mjs|css|sql|json|toml)$/.test(p),
  );

  for (const file of files) {
    if (ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;

    const source = read(file);
    let match;
    TAI_PATTERN.lastIndex = 0;
    while ((match = TAI_PATTERN.exec(source)) !== null) {
      findings.push({
        file,
        line: lineOf(source, match.index),
        message:
          'El literal "TAI" aparece en el shell reutilizable. TAI es el primer pack de ' +
          'contenido, no una propiedad del producto.',
      });
    }
  }
}

report(
  'tai-literal',
  findings,
  'EC-018. Si el valor debe existir, va como dato del pack (tabla, seed o fichero de\n' +
    'contenido), no como literal en el shell. La prueba de que la regla se cumple es\n' +
    'que un segundo pack no exija cambio de esquema (CDEM §29.11).',
);
