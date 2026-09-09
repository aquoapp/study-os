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
  let output = '';
  let status: number | null = null;
  // El propio proceso del CLI puede caerse antes de hablar con la base (D-18: se observó un
  // fallo interno en ~900 lanzamientos). Se reintenta SOLO cuando la salida no contiene un
  // error de PostgreSQL: un rechazo de la base nunca se reintenta ni se enmascara.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = spawnSync(
      process.execPath,
      [launcher, 'db', 'query', '--db-url', url, '--output', 'json', '--agent', 'no', sql],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    // El CLI reparte su salida entre stdout y stderr según el modo (TTY, agente, CI).
    output = `${result.stdout ?? ''}${result.stderr ?? ''}`.split(url).join('<db-url>');
    status = result.status;
    const databaseSpoke = /failed to execute query|SQLSTATE|ERROR:/.test(output);
    if (status === 0 || databaseSpoke) break;
    if (attempt === 3)
      throw new Error(
        `El CLI de Supabase falló tres veces sin llegar a la base: ${output.slice(0, 500)}`,
      );
  }
  if (status !== 0) {
    throw new Error(`La consulta de catálogo falló: ${output}`);
  }
  // Modo normal: un array JSON de filas. Modo agente: {boundary, rows, warning}.
  const candidates: string[] = [];
  for (const [open, close] of [
    ['[', ']'],
    ['{', '}'],
  ] as const) {
    const start = output.indexOf(open);
    const end = output.lastIndexOf(close);
    if (start >= 0 && end > start) candidates.push(output.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Row[] | { rows?: Row[] };
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
    } catch {
      /* siguiente candidato */
    }
  }
  throw new Error(
    `La consulta no devolvió un JSON con "rows". Salida del CLI:${NEWLINE}${output.slice(0, 2000)}`,
  );
}

export interface AttackOutcome {
  /** Verdadero si la base rechazó el ataque (la excepción no fue la centinela). */
  readonly rejected: boolean;
  /** Mensaje de error de PostgreSQL, ya redactado. */
  readonly message: string;
}

const ATTACK_SENTINEL = 'STUDY_OS_ATTACK_SUCCEEDED';

/**
 * Ataque **sin residuo** contra los invariantes de la base.
 *
 * Ejecuta `statements` dentro de un bloque `DO` que termina SIEMPRE con una excepción:
 * si los ataques prosperan, la centinela; si un trigger o una restricción los rechaza,
 * el error del rechazo. En ambos casos la transacción se revierte y no queda ninguna
 * fila. Se ejecuta con el usuario de la cadena de conexión (propietario de los
 * objetos), de modo que lo que se prueba es el enforcement de la base —triggers,
 * restricciones, índices—, no la RLS de un rol: eso lo prueban los clientes de
 * PostgREST. «El código de aplicación nunca lo haría» no es enforcement.
 *
 * Solo tiene sentido fuera de PRODUCTION; se niega si el entorno no es local ni staging.
 */
export function attack(statements: string): AttackOutcome {
  const environment = process.env['NEXT_PUBLIC_ENVIRONMENT'] ?? '';
  if (environment !== 'local' && environment !== 'staging') {
    throw new Error(`attack(): entorno "${environment}" no admitido (solo local o staging)`);
  }
  if (statements.includes('$attack$')) throw new Error('attack(): etiqueta reservada');
  const block =
    `do $attack$ begin${NEWLINE}${statements}${NEWLINE}` +
    `raise exception '${ATTACK_SENTINEL}';${NEWLINE}end $attack$;`;
  try {
    query(block);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { rejected: !message.includes(ATTACK_SENTINEL), message };
  }
  // Un bloque que termina en excepción nunca «devuelve filas»: llegar aquí es un fallo
  // del arnés, no de la base.
  throw new Error('attack(): el bloque no lanzó ninguna excepción');
}

/** Exactamente una fila. Falla si no la hay: una consulta de catálogo vacía es un hallazgo. */
export function one<Row = Record<string, unknown>>(sql: string): Row {
  const rows = query<Row>(sql);
  const row = rows[0];
  if (!row) throw new Error(`La consulta no devolvió ninguna fila: ${sql.slice(0, 120)}`);
  return row;
}
