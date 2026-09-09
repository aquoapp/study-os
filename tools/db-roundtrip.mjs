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

/**
 * Firma semántica del catálogo (esquemas `public`, `content` e `ingest`): esquemas,
 * tablas (ACL, RLS, comentario), columnas, restricciones, índices, triggers, funciones
 * (firma, resultado, definer, configuración, ACL, huella del cuerpo), políticas y tipos.
 * Una sola sentencia, ordenada, para comparar estados byte a byte.
 *
 * Quedan fuera a propósito los privilegios por defecto (su estado previo es de plataforma,
 * no de migración: ver la migración 14) y el historial de migraciones (se compara aparte).
 */
const SIGNATURE_SQL = `
select kind, identity, definition from (
  select 'schema' as kind, n.nspname as identity, coalesce(n.nspacl::text, '') as definition
    from pg_namespace n where n.nspname in ('public','content','ingest')
  union all
  select 'table', n.nspname || '.' || c.relname,
         coalesce(c.relacl::text, '') || '|rls=' || c.relrowsecurity || '|forced=' || c.relforcerowsecurity || '|' || coalesce(obj_description(c.oid, 'pg_class'), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r','v','m','S') and n.nspname in ('public','content','ingest')
  union all
  select 'column', table_schema || '.' || table_name || '.' || column_name,
         udt_name || '|' || is_nullable || '|' || coalesce(column_default, '') || '|' || ordinal_position
    from information_schema.columns where table_schema in ('public','content','ingest')
  union all
  select 'constraint', c.conrelid::regclass::text || '.' || c.conname, pg_get_constraintdef(c.oid)
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
   where n.nspname in ('public','content','ingest')
  union all
  select 'index', schemaname || '.' || indexname, indexdef
    from pg_indexes where schemaname in ('public','content','ingest')
  union all
  select 'trigger', n.nspname || '.' || c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid) || '|' || t.tgenabled::text
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and n.nspname in ('public','content','ingest')
  union all
  select 'function', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         pg_get_function_result(p.oid) || '|secdef=' || p.prosecdef || '|' || coalesce(p.proconfig::text, '') || '|' || coalesce(p.proacl::text, '') || '|' || p.provolatile::text || '|' || md5(p.prosrc) || '|' || coalesce(obj_description(p.oid, 'pg_proc'), '')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','content','ingest')
  union all
  select 'policy', schemaname || '.' || tablename || '.' || policyname,
         cmd || '|' || permissive || '|' || roles::text || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '')
    from pg_policies where schemaname in ('public','content','ingest')
  union all
  select 'type', n.nspname || '.' || t.typname,
         t.typtype::text || '|' || coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid), '')
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
   where n.nspname in ('public','content','ingest') and t.typtype in ('e','d')
) s order by kind, identity`;

function catalogSignature() {
  return query(SIGNATURE_SQL).map((row) => `${row.kind} ${row.identity} :: ${row.definition}`);
}

function diffSignatures(before, after) {
  const a = new Set(before);
  const b = new Set(after);
  return {
    missing: before.filter((line) => !b.has(line)),
    extra: after.filter((line) => !a.has(line)),
  };
}

/** Objetos que Phase 0 deja en `public`; cualquier otro tras revertir es un resto. */
const PHASE_0_ALLOWED = [
  /^schema public /,
  /^table public\.profiles /,
  /^column public\.profiles\./,
  /^constraint (public\.)?profiles\./,
  /^index public\.profiles_pkey /,
  /^trigger public\.profiles\./,
  /^function public\.(handle_new_user|set_updated_at)\(\) /,
  /^policy public\.profiles\./,
  /^type public\.provenance_class /,
];

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

// ---------------------------------------------------------------- 0 · firma inicial
const signatureBefore = catalogSignature();
const migrationsBefore = query(
  'select version, name from supabase_migrations.schema_migrations order by version',
).map((row) => `${row.version} ${row.name}`);
console.log(`  firma del catálogo antes de revertir: ${signatureBefore.length} entradas`);

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
// Firma semántica tras revertir: nada fuera de lo que Phase 0 deja.
const signatureDown = catalogSignature();
for (const line of signatureDown) {
  if (!PHASE_0_ALLOWED.some((pattern) => pattern.test(line))) {
    leftovers.push(`resto tras revertir: ${line.slice(0, 160)}`);
  }
}
if (leftovers.length > 0) {
  console.error(
    `✘ db:roundtrip: tras revertir quedan restos:${NEWLINE}  ${leftovers.join(`${NEWLINE}  `)}`,
  );
  process.exit(1);
}
console.log(
  `  ✔ catálogo limpio tras revertir: solo public.profiles y los objetos de Phase 0 (${signatureDown.length} entradas)`,
);

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

// ---------------------------------------------------------------- 4 · firma final
// up → down → up deja el catálogo idéntico (Phase 1A Authorization Packet §Q): misma firma
// semántica y mismo historial de migraciones.
const signatureAfter = catalogSignature();
const { missing, extra } = diffSignatures(signatureBefore, signatureAfter);
const migrationsAfter = query(
  'select version, name from supabase_migrations.schema_migrations order by version',
).map((row) => `${row.version} ${row.name}`);
const historyDiff = diffSignatures(migrationsBefore, migrationsAfter);
if (
  missing.length > 0 ||
  extra.length > 0 ||
  historyDiff.missing.length > 0 ||
  historyDiff.extra.length > 0
) {
  console.error('✘ db:roundtrip: el catálogo tras reaplicar no es idéntico al de partida.');
  for (const line of missing) console.error(`  − ${line.slice(0, 200)}`);
  for (const line of extra) console.error(`  + ${line.slice(0, 200)}`);
  for (const line of historyDiff.missing) console.error(`  − migración ${line}`);
  for (const line of historyDiff.extra) console.error(`  + migración ${line}`);
  process.exit(1);
}
console.log(
  `  ✔ firma semántica idéntica tras reaplicar (${signatureAfter.length} entradas · ${migrationsAfter.length} migraciones)`,
);
console.log(
  '✔ db:roundtrip: down → catálogo limpio → up → catálogo idéntico. Ejecuta schema-drift para cerrar el ciclo.',
);
