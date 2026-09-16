/** Tipos de `tools/supabase-cli.mjs` para las pruebas en TypeScript. */
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';

export const REPO_ROOT: string;
export function pinnedVersion(): string;
export function launcherPath(): string;
export function launchArgs(args: readonly string[]): string[];
export function installedVersion(): string;
export function assertPinnedCli(): { pinned: string; installed: string };
/** D-25 · redacta los secretos conocidos y cualquier cadena de conexión. */
export function redactSecrets(text: unknown, secrets?: readonly string[]): string;
/** Ejecuta el CLI fijado; la salida y cualquier error salen redactados. */
export function runSupabase(
  args: readonly string[],
  options?: Partial<ExecFileSyncOptionsWithStringEncoding>,
): string;
