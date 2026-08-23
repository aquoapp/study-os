#!/usr/bin/env node
/**
 * GUARDA 2 · El nombre del pack fuera del contenido.
 *
 * EC-018 · «TAI es un pack; el shell es exam-neutral».
 * Manifest §5 · «TAI-specific assumptions must not contaminate the reusable shell».
 *
 * El shell de Study OS debe poder servir un segundo pack de examen sin cambiar de
 * esquema ni de código. Cada aparición del nombre del pack en el shell es una
 * suposición incrustada que habrá que perseguir el día que exista ese segundo pack.
 *
 * ---------------------------------------------------------------------------
 * Qué cambió respecto a la primera versión
 *
 * Buscaba únicamente `TAI` en mayúsculas. `tai`, `Tai` y `tAI` la atravesaban sin
 * ruido, que es precisamente la forma en que este tipo de literal se cuela: en un
 * nombre de variable (`taiPackId`), en una clave de objeto o en una ruta.
 *
 * Ahora la comparación es **insensible a mayúsculas**, con fronteras que impiden
 * los falsos positivos de palabras que solo contienen esas letras (`retain`,
 * `detail`, `TAIL`, `contains`, `Taiwan`, `mountain`).
 * ---------------------------------------------------------------------------
 */

import { join } from 'node:path';

import { REPO_ROOT, lineOf, read, report, walk } from './lib/walk.mjs';

/** Rutas donde el nombre del pack es legítimo: es contenido, no shell. */
const ALLOWED_PREFIXES = [
  'content/',
  'supabase/seed/',
  // Documentación y especificación describen el pack; no son código de shell.
  'spec/',
  'architecture/',
  'docs/',
  'README.md',
  'CLAUDE.md',
  // Las guardas y sus pruebas nombran el literal para poder prohibirlo. Sin esta
  // excepción, el test que demuestra que la guarda funciona la haría fallar.
  'tools/guards/',
  'tests/unit/taiLiteral.guard.spec.ts',
  'tests/unit/guards.adversarial.spec.ts',
];

/**
 * `tai` como palabra completa, en cualquier caja.
 *
 * Las fronteras excluyen letras, dígitos y `_` a ambos lados, de modo que
 * `retain`, `detail`, `TAIL`, `contains`, `Taiwan` o `mountain` no coinciden,
 * mientras que `TAI`, `tai`, `Tai`, `tAI`, `tai_pack`, `pack.tai` y `"tai"` sí.
 *
 * `tai_pack` coincide porque `_` cuenta como frontera por la derecha solo si se
 * excluye del conjunto; se excluye a propósito: `TAI_PACK_ID` es exactamente el
 * caso que hay que detectar.
 */
const PACK_NAME_PATTERN = /(?<![A-Za-z0-9])tai(?![A-Za-z0-9])/gi;

const SCANNED_ROOTS = ['apps', 'packages', 'tools', 'tests', 'supabase'];

const findings = [];
let scanned = 0;

for (const root of SCANNED_ROOTS) {
  const files = walk(join(REPO_ROOT, root), (p) =>
    /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|css|sql|json|toml)$/.test(p),
  );

  for (const file of files) {
    if (ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;

    const source = read(file);
    if (source === '') continue;
    scanned += 1;

    PACK_NAME_PATTERN.lastIndex = 0;
    let match;
    while ((match = PACK_NAME_PATTERN.exec(source)) !== null) {
      findings.push({
        file,
        line: lineOf(source, match.index),
        message:
          `El nombre del pack aparece como "${match[0]}" en el shell reutilizable. ` +
          'TAI es el primer pack de contenido, no una propiedad del producto.',
      });
    }
  }
}

console.log(`  (${scanned} fichero(s) analizados, comparación insensible a mayúsculas)`);

report(
  'tai-literal',
  findings,
  'EC-018. Si el valor debe existir, va como dato del pack (tabla, seed o fichero de\n' +
    'contenido), no como literal en el shell. La prueba de que la regla se cumple es\n' +
    'que un segundo pack no exija cambio de esquema (CDEM §29.11).',
);
