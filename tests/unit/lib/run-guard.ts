import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
): GuardResult {
  try {
    const output = execFileSync(process.execPath, [join(REPO_ROOT, 'tools', 'guards', script)], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
