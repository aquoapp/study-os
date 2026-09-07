import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export interface GuardResult {
  readonly exitCode: number;
  readonly output: string;
}

/** Ejecuta una guarda y captura su código de salida sin lanzar excepción. */
export function runGuard(
  script: string,
  env: Record<string, string | undefined> = {},
  args: string[] = [],
): GuardResult {
  try {
    const output = execFileSync(
      process.execPath,
      [join(REPO_ROOT, 'tools', 'guards', script), ...args],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return { exitCode: 0, output };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: err.status ?? 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
}

/**
 * Escribe un fichero que viola deliberadamente un invariante, ejecuta la guarda y
 * lo borra pase lo que pase.
 *
 * Gate P0-G5 · «Las cuatro guardas fallan ante una violación deliberada de prueba».
 * Probar que una guarda pasa cuando todo está bien no demuestra nada: hay que
 * probar que **falla** cuando debe.
 */
export function withViolation<T>(relativePath: string, contents: string, body: () => T): T {
  return withViolations({ [relativePath]: contents }, body);
}

/**
 * Igual que `withViolation`, pero con varios ficheros a la vez.
 *
 * Hace falta para probar las fronteras **transitivas**: un componente de cliente
 * que importa un helper aparentemente neutro, y es el helper quien comete la
 * infracción. Con un solo fichero no puede demostrarse que la guarda sigue el grafo
 * de módulos en lugar de mirar únicamente el fichero marcado.
 */
/**
 * Sustituye temporalmente el contenido de un fichero que **ya existe** y lo
 * restaura al terminar, pase lo que pase.
 *
 * `withViolation` no sirve para esto: borra el fichero al final. Hace falta para
 * las pruebas que necesitan que una ruta real filtre algo, no que aparezca una
 * ruta nueva.
 */
export function withReplacedFile<T>(relativePath: string, contents: string, body: () => T): T {
  const absolute = join(REPO_ROOT, relativePath);
  const original = readFileSync(absolute, 'utf8');
  writeFileSync(absolute, contents, 'utf8');
  try {
    return body();
  } finally {
    writeFileSync(absolute, original, 'utf8');
  }
}

export function withViolations<T>(files: Record<string, string>, body: () => T): T {
  const written: string[] = [];
  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      const absolute = join(REPO_ROOT, relativePath);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, contents, 'utf8');
      written.push(absolute);
    }
    return body();
  } finally {
    for (const absolute of written) rmSync(absolute, { force: true });
  }
}

/**
 * Comprueba que unos ficheros **compilan** con las opciones reales del repositorio.
 *
 * Un fixture adversarial que no compila no demuestra nada: la guarda podría estar
 * saltando sobre un error de sintaxis, no sobre la evasión. Se construye un programa
 * de TypeScript con el `tsconfig.json` del repositorio y se exigen cero diagnósticos
 * —sintácticos y semánticos— en los ficheros indicados. Los diagnósticos de las
 * dependencias no cuentan: lo que se juzga es el fixture.
 */
export function assertCompiles(relativePaths: readonly string[]): void {
  const configPath = join(REPO_ROOT, 'tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error)
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, REPO_ROOT);

  const absolute = relativePaths.map((relative) => join(REPO_ROOT, relative));
  const program = ts.createProgram(absolute, {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
    incremental: false,
  });

  const normalize = (path: string) => path.split('\\').join('/').toLowerCase();
  const wanted = new Set(absolute.map(normalize));
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file && wanted.has(normalize(diagnostic.file.fileName)));

  if (diagnostics.length > 0) {
    const lines = diagnostics.map((diagnostic) => {
      const { line } = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      return `${diagnostic.file!.fileName}:${line + 1} · ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`;
    });
    throw new Error(`El fixture no compila:\n${lines.join('\n')}`);
  }
}
