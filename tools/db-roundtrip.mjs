#!/usr/bin/env node
/**
 * `npm run db:roundtrip` · reversibilidad real de las migraciones.
 *
 * P0-S4 · «migración aplicable y reversible» · EC-011 · Phase 1A Authorization Packet §P
 * (rollback roundtrip por nodo) y §Q.
 *
 * ---------------------------------------------------------------------------
 * Qué hace
 *
 *   1. Ejecuta los scripts `down/` de las migraciones posteriores a Phase 0, en orden
 *      inverso, contra la base indicada por `SUPABASE_DB_URL`. Cada script se envuelve en
 *      un único bloque `DO` porque el CLI fijado ejecuta una sola sentencia por llamada
 *      (`supabase db query`), y así cada rollback es además atómico.
 *   2. Comprueba en el catálogo que no queda ningún objeto de Phase 1A: ni los esquemas
 *      `content` e `ingest`, ni tabla alguna de `public` salvo `profiles`.
 *   3. Vuelve a aplicar las migraciones: en local con `db reset` (desde cero); en
 *      STAGING marcando las versiones revertidas en el historial y haciendo `db push`.
 *   4. Deja la comprobación de deriva a `schema-drift`, que se ejecuta después.
 *
 * Es una operación **destructiva** y pasa por la misma guarda que `db reset`
 * (`db-roundtrip`): local sin más; STAGING solo con autorización explícita; PRODUCTION
 * nunca. La cadena de conexión no se imprime.
 * ---------------------------------------------------------------------------
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AUTHORIZATION_ENV_VAR,
  assertDestructiveOperationAllowed,
  isLoopbackUrl,
} from './lib/environment-policy.mjs';
import { assertPinnedCli, launchArgs, REPO_ROOT } from './supabase-cli.mjs';

const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');
/** Las tres migraciones de Phase 0 no se revierten: `profiles` sostiene la auth real. */
const PHASE_0_PREFIXES = new Set(['00000000000000', '00000000000001', '00000000000002']);

const environment = process.env['NEXT_PUBLIC_ENVIRONMENT'];
const dbUrl = process.env['SUPABASE_DB_URL'];

if (!dbUrl) {
  console.error('✘ db:roundtrip: SUPABASE_DB_URL no está definida. Sin base no hay roundtrip.');
  process.exit(1);
}

try {
  assertDestructiveOperationAllowed(
    'db-roundtrip',
    environment,
    process.env[AUTHORIZATION_ENV_VAR],
  );
} catch (error) {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (environment === 'local' && !isLoopbackUrl(dbUrl)) {
  console.error(
    '✘ NEXT_PUBLIC_ENVIRONMENT dice "local" pero SUPABASE_DB_URL no apunta a loopback.',
  );
  process.exit(1);
}
if (environment !== 'local' && isLoopbackUrl(dbUrl)) {
  console.error(`✘ NEXT_PUBLIC_ENVIRONMENT dice "${environment}" pero la URL es loopback.`);
  process.exit(1);
}

const NEWLINE = String.fromCharCode(10);
const redact = (text) =>
  String(text ?? '')
    .split(dbUrl)
    .join('<db-url>');

function cli(args) {
  assertPinnedCli();
  const result = spawnSync(process.execPath, launchArgs(args), {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0) {
    throw new Error(redact(output));
  }
  // El CLI reparte su salida entre stdout y stderr según el modo (TTY, agente, CI):
  // se devuelve todo y quien parsea busca el JSON donde esté.
  return redact(output);
}

/** Extrae el objeto JSON con `rows` de la salida del CLI, esté donde esté. */
function parseRows(out, expectRows) {
  // Modo normal: un array JSON de filas. Modo agente: {boundary, rows, warning}.
  const candidates = [];
  for (const [open, close] of [
    ['[', ']'],
    ['{', '}'],
  ]) {
    const start = out.indexOf(open);
    const end = out.lastIndexOf(close);
    if (start >= 0 && end > start) candidates.push(out.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
    } catch {
      /* siguiente candidato */
    }
  }
  if (!expectRows) return [];
  throw new Error(
    `La consulta no devolvió un JSON con "rows". Salida del CLI:${NEWLINE}${out.slice(0, 2000)}`,
  );
}

function query(sql, { expectRows = true } = {}) {
  const out = cli(['db', 'query', '--db-url', dbUrl, '--output', 'json', '--agent', 'no', sql]);
  return parseRows(out, expectRows);
}

const ups = readdirSync(MIGRATIONS_DIR)
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
  .sort();
const reversible = ups.filter((name) => !PHASE_0_PREFIXES.has(name.slice(0, 14)));

if (reversible.length === 0) {
  console.log('db:roundtrip: no hay migraciones posteriores a Phase 0 que revertir.');
  process.exit(0);
}

console.log(
  `db:roundtrip · entorno ${environment} · ${reversible.length} migración(es) a revertir`,
);

// ---------------------------------------------------------------- 1 · downs
for (const name of [...reversible].reverse()) {
  const downPath = join(MIGRATIONS_DIR, 'down', name.replace(/\.sql$/, '.down.sql'));
  const body = readFileSync(downPath, 'utf8')
    .split(NEWLINE)
    .filter((line) => !line.trim().startsWith('--'))
    .join(NEWLINE)
    .trim();
  if (body.includes('$roundtrip$')) throw new Error(`${downPath}: etiqueta reservada`);
  const wrapped = `do $roundtrip$ begin${NEWLINE}${body}${NEWLINE}end $roundtrip$;`;
  process.stdout.write(`  ↓ ${name} … `);
  // Un bloque DO no devuelve filas: no se exige JSON.
  query(wrapped, { expectRows: false });
  console.log('revertida');
}

// ---------------------------------------------------------------- 2 · catálogo
const [state] = query(
  "select (select count(*)::int from pg_namespace where nspname in ('content','ingest')) as private_schemas, " +
    "(select string_agg(tablename, ',' order by tablename) from pg_tables where schemaname = 'public') as public_tables, " +
    "(select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e' and t.typname <> 'provenance_class') as phase1a_enums",
);
const leftovers = [];
if (state.private_schemas !== 0) leftovers.push('siguen existiendo content/ingest');
if (state.public_tables !== 'profiles') {
  leftovers.push(`public contiene ${state.public_tables}`);
}
if (state.phase1a_enums !== 0) leftovers.push(`quedan ${state.phase1a_enums} enum(s) de Phase 1A`);
if (leftovers.length > 0) {
  console.error(`✘ db:roundtrip: tras revertir quedan restos: ${leftovers.join('; ')}`);
  process.exit(1);
}
console.log('  ✔ catálogo limpio tras revertir: solo public.profiles y los objetos de Phase 0');

// ---------------------------------------------------------------- 3 · reaplicar
if (environment === 'local') {
  execFileSync(process.execPath, [join(REPO_ROOT, 'tools', 'db.mjs'), 'reset'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
} else {
  const versions = reversible.map((name) => name.slice(0, 14));
  cli(['migration', 'repair', '--status', 'reverted', ...versions, '--db-url', dbUrl]);
  console.log(`  historial: ${versions.length} versión(es) marcadas como revertidas`);
  const pushed = cli(['db', 'push', '--db-url', dbUrl]);
  console.log(
    pushed
      .split(NEWLINE)
      .filter((line) => /Applying migration|Finished/.test(line))
      .join(NEWLINE),
  );
}

const [after] = query(
  "select (select count(*)::int from pg_namespace where nspname in ('content','ingest')) as private_schemas, " +
    "(select count(*)::int from pg_tables where schemaname in ('public','content','ingest')) as tables",
);
console.log(`  ✔ reaplicadas: esquemas privados=${after.private_schemas} · tablas=${after.tables}`);
console.log(
  '✔ db:roundtrip: down → catálogo limpio → up. Ejecuta schema-drift para cerrar el ciclo.',
);
