import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Consultas SQL de solo lectura para las pruebas de catálogo.
 *
 * ---------------------------------------------------------------------------
 * Por qué no se usa un driver de PostgreSQL
 *
 * Las pruebas de Phase 1A necesitan mirar el catálogo (`pg_catalog`, `information_schema`):
 * qué tablas tienen RLS forzado, qué roles tienen qué privilegios, qué funciones puede
 * ejecutar `anon`. PostgREST no expone nada de eso, y añadir un driver sería una
 * dependencia nueva (Manifest §7) para algo que el CLI fijado de Supabase ya sabe hacer:
 * `supabase db query --db-url … --output json`.
 *
 * Se reutiliza el mismo binario con la misma versión fijada que `schema-drift`, sin
 * instalación global ni descarga de npx (`tools/supabase-cli.mjs`).
 *
 * **Solo lectura por contrato**: estas pruebas no mutan nada por SQL directo. Lo que
 * escriben lo escriben a través de la frontera de ingestión, como cualquier servidor.
 * ---------------------------------------------------------------------------
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NEWLINE = String.fromCharCode(10);

export function dbUrl(): string {
  const url = process.env['SUPABASE_DB_URL'];
  if (!url) {
    throw new Error(
      'SUPABASE_DB_URL no está definida: las pruebas de catálogo necesitan la cadena de ' +
        'conexión (local: postgresql://postgres:postgres@127.0.0.1:54322/postgres; STAGING: el ' +
        'pooler en modo sesión). No se saltan en silencio: sin base no hay prueba.',
    );
  }
  return url;
}

const launcher = join(REPO_ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');

/** Ejecuta una consulta y devuelve sus filas. Nunca imprime la cadena de conexión. */
export function query<Row = Record<string, unknown>>(sql: string): Row[] {
  if (!existsSync(launcher)) {
    throw new Error(`No se encuentra el CLI de Supabase en ${launcher}. Ejecuta \`npm ci\`.`);
  }
  const url = dbUrl();
  const result = spawnSync(
    process.execPath,
    [launcher, 'db', 'query', '--db-url', url, '--output', 'json', sql],
    { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // El CLI reparte su salida entre stdout y stderr según el modo (TTY, agente, CI).
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.split(url).join('<db-url>');
  if (result.status !== 0) {
    throw new Error(`La consulta de catálogo falló: ${output || String(result.error)}`);
  }
  const candidates: string[] = [];
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(output.slice(start, end + 1));
  for (const line of output.split(NEWLINE)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) candidates.push(trimmed);
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { rows?: Row[] };
      if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
    } catch {
      /* siguiente candidato */
    }
  }
  throw new Error(
    `La consulta no devolvió un JSON con "rows". Salida del CLI:${NEWLINE}${output.slice(0, 2000)}`,
  );
}

/** Exactamente una fila. Falla si no la hay: una consulta de catálogo vacía es un hallazgo. */
export function one<Row = Record<string, unknown>>(sql: string): Row {
  const rows = query<Row>(sql);
  const row = rows[0];
  if (!row) throw new Error(`La consulta no devolvió ninguna fila: ${sql.slice(0, 120)}`);
  return row;
}
