/**
 * Resolución del CLI de Supabase.
 *
 * EC-011 · «El esquema lo gobiernan las migraciones del repositorio».
 * Manifest §7 · toda dependencia se declara y se justifica.
 *
 * ---------------------------------------------------------------------------
 * Por qué existe este módulo
 *
 * Una herramienta que decide el esquema de la base de datos no puede tener una
 * versión distinta en cada máquina. `npx --yes supabase` descarga *la última*
 * versión disponible en ese momento: dos personas, o la misma persona en dos
 * semanas distintas, ejecutarían binarios diferentes contra las mismas
 * migraciones. `supabase/setup-cli@v1` con `version: latest` tiene el mismo
 * defecto en CI.
 *
 * Aquí el CLI es una `devDependency` con **versión exacta**, resuelta desde
 * `node_modules/.bin`, y se comprueba en tiempo de ejecución que la versión
 * instalada es la fijada. Si no lo es, se falla en lugar de continuar.
 * ---------------------------------------------------------------------------
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Versión fijada. Única fuente de verdad: `devDependencies.supabase`. */
export function pinnedVersion() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const declared = pkg.devDependencies?.supabase;

  if (!declared) {
    throw new Error(
      'El CLI de Supabase no está declarado en devDependencies. ' +
        'Una herramienta que gobierna el esquema no puede depender de una instalación global.',
    );
  }
  if (!/^\d+\.\d+\.\d+$/.test(declared)) {
    throw new Error(
      `La versión del CLI de Supabase debe ser exacta, y es "${declared}". ` +
        'Rangos como ^ o ~ y el literal "latest" reintroducen la deriva que esto evita.',
    );
  }
  return declared;
}

/**
 * Ruta al lanzador del CLI. Nunca una instalación global ni una descarga de npx.
 *
 * Se apunta al script JS del paquete (`dist/supabase.js`) y no al *shim* de
 * `node_modules/.bin`. En Windows ese shim es un `.cmd`, y ejecutar un `.cmd`
 * desde Node exige `shell: true`, lo que reintroduce las reglas de citado del
 * intérprete de comandos justo donde se pasan cadenas de conexión. Invocarlo con
 * `process.execPath` evita el intérprete por completo.
 */
export function launcherPath() {
  const path = join(REPO_ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');

  if (!existsSync(path)) {
    throw new Error(
      `No se encuentra el CLI de Supabase en ${path}. Ejecuta \`npm ci\`. ` +
        'No se recurre a una instalación global a propósito: sería una versión sin controlar.',
    );
  }
  return path;
}

/** Argumentos completos para lanzar el CLI con el Node en ejecución. */
export function launchArgs(args) {
  return [launcherPath(), ...args];
}

/** Versión realmente instalada. */
export function installedVersion() {
  return execFileSync(process.execPath, launchArgs(['--version']), {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .trim()
    .split('\n')
    .pop()
    .trim();
}

/**
 * Comprueba que lo instalado coincide con lo fijado.
 * @returns {{ pinned: string, installed: string }}
 */
export function assertPinnedCli() {
  const pinned = pinnedVersion();
  const installed = installedVersion();

  if (installed !== pinned) {
    throw new Error(
      `Versión del CLI de Supabase incoherente: fijada ${pinned}, instalada ${installed}. ` +
        'Ejecuta `npm ci` para restaurar la versión del lockfile.',
    );
  }
  return { pinned, installed };
}

/** Cualquier cadena de conexión PostgreSQL, con o sin contraseña. */
const CONNECTION_STRING = /postgres(?:ql)?:\/\/[^\s"'`]+/g;

/**
 * Redacta de un texto los secretos conocidos y **cualquier** cadena de conexión.
 *
 * D-25 · el camino de error de `execFileSync` compone su mensaje con la línea de comandos
 * completa, y con ella el valor de `--db-url`: así llegó una contraseña de STAGING a una
 * transcripción de trabajo. Ningún texto que salga de este módulo puede llevarla.
 */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? '');
  for (const secret of secrets) if (secret) out = out.split(secret).join('<redactado>');
  return out.replace(CONNECTION_STRING, '<db-url>');
}

/** Valores de argumento que son secretos: lo que sigue a `--db-url`, o `--db-url=…`. */
function secretArguments(args) {
  const secrets = [];
  args.forEach((arg, index) => {
    if (arg === '--db-url' && typeof args[index + 1] === 'string') secrets.push(args[index + 1]);
    else if (typeof arg === 'string' && arg.startsWith('--db-url=')) {
      secrets.push(arg.slice('--db-url='.length));
    }
  });
  return secrets;
}

/**
 * Ejecuta el CLI fijado y devuelve su salida, redactada.
 *
 * Si el CLI falla, el error original **no se propaga**: su `message` y su `cmd` contienen la
 * línea de comandos. Se construye uno nuevo con el código de salida y la salida del CLI, ambos
 * redactados.
 */
export function runSupabase(args, options = {}) {
  assertPinnedCli();
  const secrets = secretArguments(args);
  let output;
  try {
    output = execFileSync(process.execPath, launchArgs(args), {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  } catch (error) {
    const failure = /** @type {{ status?: number | null, stdout?: unknown, stderr?: unknown }} */ (
      error ?? {}
    );
    const detail = [failure.stderr, failure.stdout]
      .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
      .map(String)
      .join('\n')
      .trim();
    throw new Error(
      redactSecrets(
        `el CLI de Supabase terminó con código ${failure.status ?? 'desconocido'} ` +
          `(supabase ${args.slice(0, 2).join(' ')})${detail ? `: ${detail}` : ''}`,
        secrets,
      ),
    );
  }
  return redactSecrets(output, secrets);
}
