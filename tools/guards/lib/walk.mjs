import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Directorios que ninguna guarda debe recorrer. */
export const ALWAYS_IGNORED = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '_handoff',
]);

/**
 * Recorre un árbol devolviendo rutas relativas al repositorio, en POSIX.
 *
 * @param {string} root directorio absoluto de partida
 * @param {(relPath: string) => boolean} [accept] filtro sobre la ruta relativa
 */
export function walk(root, accept = () => true) {
  const found = [];

  const visit = (absolute) => {
    let entries;
    try {
      entries = readdirSync(absolute, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ALWAYS_IGNORED.has(entry.name)) continue;
      const child = join(absolute, entry.name);
      if (entry.isDirectory()) {
        visit(child);
      } else if (entry.isFile()) {
        const rel = relative(REPO_ROOT, child).split(sep).join('/');
        if (accept(rel)) found.push(rel);
      }
    }
  };

  try {
    if (statSync(root).isDirectory()) visit(root);
  } catch {
    /* el directorio puede no existir todavía; no es un fallo de la guarda */
  }

  return found.sort();
}

export function read(relPath) {
  try {
    return readFileSync(join(REPO_ROOT, relPath), 'utf8');
  } catch {
    // El fichero puede desaparecer entre el recorrido y la lectura (fixtures de
    // prueba, builds concurrentes). Un fichero inexistente no contiene ninguna
    // violación, así que la respuesta correcta es una cadena vacía, no un crash.
    return '';
  }
}

/** Elimina comentarios de línea y de bloque para no dar falsos positivos. */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Salida uniforme de las guardas.
 *
 * @param {string} name
 * @param {{file: string, line: number, message: string}[]} findings
 * @param {string} rationale
 */
export function report(name, findings, rationale) {
  if (findings.length === 0) {
    console.log(`✔ ${name}: sin hallazgos`);
    process.exit(0);
  }

  console.error(`✘ ${name}: ${findings.length} hallazgo(s)\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`    ${f.message}\n`);
  }
  console.error(rationale);
  process.exit(1);
}

/** Devuelve el número de línea (1-indexado) de un índice de carácter. */
export function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}
