#!/usr/bin/env node
/**
 * Readout de validación de producto · Phase 4B.
 *
 * Ejecuta las consultas de `tools/validation-readout.sql` sobre un aprendiz concreto y las
 * imprime. **Todas son de solo lectura**: este script no escribe, no borra y no bloquea nada.
 *
 * **No es un panel para el aprendiz** y no debe convertirse en uno: lo que muestra es el nivel L3
 * que el contrato de producto prohíbe llevar a una superficie de aprendiz (§G). Es una
 * herramienta de desarrollo, y por eso vive en `tools/` y no en `apps/`.
 *
 * Reutiliza el mismo CLI fijado de Supabase que `schema-drift` y las pruebas de catálogo: sin
 * driver nuevo, sin dependencia nueva y sin instalación global (Manifest §7).
 *
 * Uso:
 *   node --env-file=.env.staging.local tools/validation-readout.mjs --email persona@ejemplo
 *   node --env-file=.env.staging.local tools/validation-readout.mjs --user <uuid>
 *   node --env-file=.env.staging.local tools/validation-readout.mjs --list
 *
 * El fichero de entorno **no se lee aquí**: lo inyecta Node. Ninguna clave se imprime nunca, y la
 * cadena de conexión no aparece en ningún mensaje de error.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, runSupabase } from './supabase-cli.mjs';

const PRODUCTION_REF = 'nzcgufeycvehczroryoe';

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dbUrl = process.env['SUPABASE_DB_URL'];
if (!dbUrl) {
  fail(
    [
      'SUPABASE_DB_URL no está definida.',
      '',
      'local:   postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      'STAGING: el pooler en modo sesión.',
      '',
      'Inyéctala con: node --env-file=.env.staging.local tools/validation-readout.mjs',
    ].join('\n'),
  );
}
// El readout es de solo lectura, pero PRODUCTION no se consulta ni para leer: no hay nada que
// mirar ahí, y abrir el hábito es cómo se acaba escribiendo.
if (dbUrl.includes(PRODUCTION_REF))
  fail('la cadena apunta a PRODUCTION. Este readout no se usa ahí.');

/**
 * Ejecuta SQL de **solo lectura** y devuelve filas.
 *
 * Pasa por `runSupabase`, el ejecutor compartido, y no por un `spawn` propio. Esa es la
 * diferencia que importa: el ejecutor separa los valores de `--db-url` y los **redacta en toda
 * salida**, incluida la de error. Reimplementar aquí la redacción sería exactamente la clase de
 * duplicado que hizo falta cerrar D-25, cuando una credencial acabó impresa por el camino de
 * error del CLI.
 */
function query(sql) {
  const output = runSupabase(['db', 'query', '--db-url', dbUrl, '--output', 'json', sql], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = (output ?? '').trim();
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

/** Trocea el fichero SQL por sus marcadores `-- :name <id>`. */
function readQueries() {
  const source = readFileSync(join(REPO_ROOT, 'tools', 'validation-readout.sql'), 'utf8');
  const out = [];
  const parts = source.split(/^--\s*:name\s+(\S+)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i];
    const body = (parts[i + 1] ?? '').split(/^--\s*\d/m)[0] ?? '';
    const sql = body
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim()
      .replace(/;\s*$/, '');
    if (sql) out.push({ name, sql });
  }
  return out;
}

function resolveUser() {
  const explicit = arg('user');
  if (explicit) return explicit;
  const email = arg('email');
  if (!email) {
    fail('indica --email <correo> o --user <uuid>. Con --list se ven los aprendices con datos.');
  }
  const safe = String(email).replace(/'/g, "''");
  const rows = query(`select id from auth.users where email = '${safe}' limit 1`);
  const id = rows[0]?.id;
  if (!id) fail('no hay ningún usuario con ese correo en este entorno.');
  return id;
}

function list() {
  const rows = query(`
    select u.id, u.email, count(distinct s.id) as sesiones, count(distinct r.id) as ejecuciones
    from auth.users u
    left join public.study_sessions s on s.user_id = u.id
    left join public.planner_runs r on r.user_id = u.id
    group by 1, 2
    having count(distinct s.id) > 0 or count(distinct r.id) > 0
    order by 3 desc
  `);
  if (rows.length === 0) {
    console.log('· todavía no hay ningún aprendiz con sesiones ni ejecuciones en este entorno');
    return;
  }
  console.table(rows);
}

const TITLES = {
  estados: '1 · Qué estados encontró',
  decisiones: '2 · Qué eligió el Planner, y por qué',
  presupuesto: '3 · Presupuesto disponible y su procedencia',
  ejecucion: '4 · Qué se arrancó y qué se completó de verdad',
  parada: '5 · Dónde se detuvo cada sesión',
  evidencia: '6 · Qué evidencia se produjo',
  motor: '7 · Cómo cambió el Learning Engine',
  estado_motor: '7b · Estado categórico vigente por concepto',
  linaje: '8 · Qué eligió la ejecución siguiente',
  declaraciones: '9 · Declaraciones de tiempo y el plan que vino después',
  invariantes: '10 · ¿Parece roto algún invariante? (debería salir todo a cero)',
};

function readout() {
  const userId = resolveUser();
  console.log(`\nReadout de validación · aprendiz ${userId}\n`);

  for (const { name, sql } of readQueries()) {
    const title = TITLES[name] ?? name;
    console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 68 - title.length))}`);
    let rows;
    try {
      rows = query(sql.split('$1').join(`'${userId}'`));
    } catch (error) {
      console.log(`  (no se pudo consultar: ${error instanceof Error ? error.message : error})`);
      continue;
    }
    if (!rows || rows.length === 0) {
      console.log('  (sin filas)');
      continue;
    }
    console.table(rows);
  }

  // OBS-4B-04 · `CANNOT_PLAN` no deja fila que contar, por construcción. Se señala el patrón
  // indirecto en vez de inventar un tipo de evento que ninguna autorización ampara.
  console.log(
    '\nOBS-4B-04 · CANNOT_PLAN no deja rastro consultable: no escribe ejecución. Si aparece a\n' +
      'menudo en el recorrido humano, esa observación es la que abre la decisión de registrarlo.\n',
  );
}

try {
  if (process.argv.includes('--list')) list();
  else readout();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
