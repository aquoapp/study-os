import { execFileSync } from 'node:child_process';
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

export interface QueryResult<Row> {
  readonly rows: Row[];
}

const launcher = join(REPO_ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');

/** Ejecuta una consulta y devuelve sus filas. Nunca imprime la cadena de conexión. */
export function query<Row = Record<string, unknown>>(sql: string): Row[] {
  if (!existsSync(launcher)) {
    throw new Error(`No se encuentra el CLI de Supabase en ${launcher}. Ejecuta \`npm ci\`.`);
  }
  const url = dbUrl();
  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [launcher, 'db', 'query', '--db-url', url, '--output', 'json', sql],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const text = `${err.stdout ?? ''}${err.stderr ?? ''}`.split(url).join('<db-url>');
    throw new Error(`La consulta de catálogo falló: ${text || err.message}`);
  }
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < 0) {
    throw new Error(`Salida inesperada del CLI: ${output.slice(0, 200)}`);
  }
  const parsed = JSON.parse(output.slice(start, end + 1)) as { rows?: Row[] };
  return parsed.rows ?? [];
}

/** Exactamente una fila. Falla si no la hay: una consulta de catálogo vacía es un hallazgo. */
export function one<Row = Record<string, unknown>>(sql: string): Row {
  const rows = query<Row>(sql);
  const row = rows[0];
  if (!row) throw new Error(`La consulta no devolvió ninguna fila: ${sql.slice(0, 120)}`);
  return row;
}
