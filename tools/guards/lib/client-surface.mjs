/**
 * Determina qué ficheros forman la **superficie de cliente**.
 *
 * ---------------------------------------------------------------------------
 * Por qué no basta con mirar la directiva `'use client'`
 *
 * Un componente de cliente puede importar un módulo que no lleva ninguna
 * directiva, y ese módulo acaba igualmente en el navegador. Comprobar solo los
 * ficheros marcados deja fuera exactamente el sitio donde alguien pondría el
 * código que no quiere que se vea: un helper "neutro" en `packages/**` que hace
 * la escritura por él.
 *
 * Aquí la superficie de cliente se calcula por alcance transitivo:
 *
 *   raíces  = ficheros con `'use client'` + rutas declaradas de navegador
 *   cierre  = todo lo que esas raíces importan, y lo que aquello importa
 *   frontera= un módulo que importa `server-only` no entra, y que sea alcanzable
 *             desde cliente es en sí mismo un hallazgo; un módulo `'use server'`
 *             corta el recorrido, porque su cuerpo no viaja al navegador
 * ---------------------------------------------------------------------------
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { REPO_ROOT, read, walk } from './walk.mjs';
import {
  hasUseClientDirective,
  hasUseServerDirective,
  importsServerOnly,
  moduleSpecifiers,
  parseSource,
  SOURCE_EXTENSIONS,
} from './ast.mjs';

/** Rutas que son de navegador por definición, lleven directiva o no. */
export const BROWSER_PATH_PREFIXES = ['apps/web/src/lib/', 'apps/web/public/'];

/** Raíces analizadas. Las guardas cubren aplicación **y** paquetes. */
export const SCANNED_ROOTS = ['apps', 'packages'];

const CANDIDATE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/** Lee los alias de `tsconfig.base.json` para no mantener una segunda lista. */
function readPathAliases() {
  const raw = readFileSync(join(REPO_ROOT, 'tsconfig.base.json'), 'utf8');
  // `tsconfig.base.json` no lleva comentarios; si algún día los llevara, esto
  // fallaría de forma ruidosa y no en silencio.
  const config = JSON.parse(raw);
  return config.compilerOptions?.paths ?? {};
}

const PATH_ALIASES = readPathAliases();

function toRepoRelative(absolute) {
  return absolute
    .split('\\')
    .join('/')
    .replace(`${REPO_ROOT.split('\\').join('/')}`, '')
    .replace(/^\/+/, '');
}

function resolveCandidate(absoluteBase) {
  for (const ext of CANDIDATE_EXTENSIONS) {
    const withExt = `${absoluteBase}${ext}`;
    if (existsSync(withExt) && statSync(withExt).isFile()) return withExt;
  }
  for (const ext of CANDIDATE_EXTENSIONS) {
    const asIndex = join(absoluteBase, `index${ext}`);
    if (existsSync(asIndex) && statSync(asIndex).isFile()) return asIndex;
  }
  if (existsSync(absoluteBase) && statSync(absoluteBase).isFile()) return absoluteBase;
  return null;
}

/**
 * Resuelve un especificador a una ruta del repositorio, o `null` si es externo.
 *
 * Cubre importaciones relativas y los alias `@study-os/*` declarados en
 * `tsconfig.base.json`. Un `.js` en la ruta se prueba también como `.ts`, porque
 * ese es el estilo que usa TypeScript con `moduleResolution: Bundler`.
 */
export function resolveModule(fromRelPath, specifier) {
  if (specifier.startsWith('.')) {
    const base = resolve(join(REPO_ROOT, dirname(fromRelPath)), specifier);
    const stripped = base.replace(/\.(js|mjs|cjs|jsx)$/, '');
    const hit = resolveCandidate(stripped) ?? resolveCandidate(base);
    return hit ? toRepoRelative(hit) : null;
  }

  // Los alias más específicos primero: `@study-os/domain/internal/identity` debe
  // ganar a `@study-os/domain/*`, y el alias exacto `@study-os/domain` solo puede
  // resolver el especificador idéntico, nunca uno con subruta.
  const aliases = Object.entries(PATH_ALIASES).sort(
    ([a], [b]) => b.replace(/\*$/, '').length - a.replace(/\*$/, '').length,
  );

  for (const [alias, targets] of aliases) {
    const isWildcard = alias.endsWith('*');
    const prefix = alias.replace(/\*$/, '');

    if (isWildcard ? !specifier.startsWith(prefix) : specifier !== alias) continue;

    const rest = isWildcard ? specifier.slice(prefix.length) : '';
    for (const target of targets) {
      const targetPath = target.replace(/^\.\//, '').replace(/\*$/, '');
      const candidate = join(REPO_ROOT, `${targetPath}${rest}`);
      const stripped = candidate.replace(/\.(js|mjs|cjs|jsx)$/, '');
      const hit = resolveCandidate(stripped) ?? resolveCandidate(candidate);
      if (hit) return toRepoRelative(hit);
    }
  }

  return null; // dependencia externa: fuera del alcance del grafo
}

/** Todos los ficheros de código bajo `apps/` y `packages/`. */
export function collectSourceFiles() {
  const files = [];
  for (const root of SCANNED_ROOTS) {
    files.push(...walk(join(REPO_ROOT, root), (p) => SOURCE_EXTENSIONS.test(p)));
  }
  return files.sort();
}

/**
 * Calcula la superficie de cliente.
 *
 * @returns {{
 *   clientFiles: Map<string, {reason: string, via: string[]}>,
 *   serverOnly: Set<string>,
 *   boundaryViolations: {file: string, via: string[]}[],
 *   parsed: Map<string, import('typescript').SourceFile>
 * }}
 */
export function computeClientSurface() {
  const files = collectSourceFiles();
  const parsed = new Map();
  const serverOnly = new Set();
  const serverActions = new Set();
  const roots = [];

  for (const file of files) {
    const source = read(file);
    if (source === '') continue;
    const sourceFile = parseSource(file, source);
    parsed.set(file, sourceFile);

    if (importsServerOnly(sourceFile)) serverOnly.add(file);
    if (hasUseServerDirective(sourceFile)) serverActions.add(file);

    if (BROWSER_PATH_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      roots.push({ file, reason: 'ruta declarada de navegador' });
    } else if (hasUseClientDirective(sourceFile)) {
      roots.push({ file, reason: "directiva 'use client'" });
    }
  }

  const clientFiles = new Map();
  const boundaryViolations = [];
  const queue = [];

  for (const root of roots) {
    if (serverOnly.has(root.file)) {
      boundaryViolations.push({ file: root.file, via: [root.file] });
      continue;
    }
    clientFiles.set(root.file, { reason: root.reason, via: [root.file] });
    queue.push(root.file);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const sourceFile = parsed.get(current);
    if (!sourceFile) continue;

    const via = clientFiles.get(current)?.via ?? [current];

    for (const { module } of moduleSpecifiers(sourceFile)) {
      const target = resolveModule(current, module);
      if (!target || !parsed.has(target)) continue;

      // Frontera de red: el cuerpo de un módulo `'use server'` no viaja al
      // navegador, así que el grafo se detiene aquí en lugar de atravesarlo.
      if (serverActions.has(target)) continue;

      if (serverOnly.has(target)) {
        // Next.js también lo impediría en el build; registrarlo aquí da un
        // mensaje accionable en lugar de un error de empaquetado.
        boundaryViolations.push({ file: target, via: [...via, target] });
        continue;
      }
      if (clientFiles.has(target)) continue;

      clientFiles.set(target, { reason: 'alcanzable desde cliente', via: [...via, target] });
      queue.push(target);
    }
  }

  return { clientFiles, serverOnly, serverActions, boundaryViolations, parsed };
}

/** Cadena legible de cómo se llegó a un fichero desde una raíz de cliente. */
export function describeVia(via) {
  return via.length <= 1 ? '' : ` (alcanzado desde ${via[0]} → ${via.slice(1).join(' → ')})`;
}
