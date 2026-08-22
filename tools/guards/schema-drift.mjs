#!/usr/bin/env node
/**
 * CHECK · Deriva de esquema.
 *
 * EC-011 · «Cambios de esquema como migraciones versionadas en repo. Production
 * schema cannot be governed by undocumented dashboard edits.»
 * REQ-A04 · «Migraciones versionadas en repositorio» · «Check de deriva de esquema en verde»
 * Manifest §9 · «No production-only dashboard schema edits without repository migration»
 *
 * Dos niveles, y el segundo no sustituye al primero:
 *
 *   A · **Estático, siempre ejecutable.** Verifica que el conjunto de migraciones es
 *       coherente: nombres ordenables, sin duplicados de prefijo, cada migración con
 *       su script de rollback, y ninguna migración editada después de aplicada
 *       (se comprueba contra el registro de huellas `supabase/migrations/.lock.json`).
 *
 *   B · **Contra la base de datos.** `supabase db diff` sobre el entorno indicado por
 *       `SUPABASE_DB_URL`. Si la base tiene algo que las migraciones no describen,
 *       el diff no está vacío y el check falla.
 *
 * Si no hay base de datos alcanzable, el nivel B **no se salta en silencio**: el
 * check termina en fallo indicando qué falta. Un check que se auto-exime cuando no
 * puede ejecutarse deja de ser un control.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { REPO_ROOT, read, walk } from './lib/walk.mjs';

const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');
const LOCK_PATH = join(MIGRATIONS_DIR, '.lock.json');

const problems = [];

// ---------------------------------------------------------------- nivel A
const migrations = walk(MIGRATIONS_DIR, (p) => /supabase\/migrations\/[^/]+\.sql$/.test(p));

if (migrations.length === 0) {
  problems.push('No hay ninguna migración en supabase/migrations.');
}

const prefixes = new Map();

for (const file of migrations) {
  const base = file.split('/').pop() ?? '';
  const match = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(base);

  if (!match) {
    problems.push(
      `Nombre de migración inválido: ${base}. Formato exigido: <14 dígitos>_<nombre_snake_case>.sql`,
    );
    continue;
  }

  const [, prefix, name] = match;
  if (prefixes.has(prefix)) {
    problems.push(
      `Prefijo duplicado ${prefix}: ${prefixes.get(prefix)} y ${base}. El orden sería ambiguo.`,
    );
  }
  prefixes.set(prefix, base);

  const downPath = join(MIGRATIONS_DIR, 'down', `${prefix}_${name}.down.sql`);
  if (!existsSync(downPath)) {
    problems.push(
      `La migración ${base} no tiene rollback. P0-S4 exige "aplicable y reversible": ` +
        `crea supabase/migrations/down/${prefix}_${name}.down.sql`,
    );
  }
}

// Huellas: detectan la edición de una migración ya registrada.
const currentHashes = Object.fromEntries(
  migrations.map((file) => [
    file.split('/').pop(),
    createHash('sha256').update(read(file)).digest('hex'),
  ]),
);

if (existsSync(LOCK_PATH)) {
  const previous = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  for (const [name, hash] of Object.entries(previous.migrations ?? {})) {
    if (!(name in currentHashes)) {
      problems.push(
        `La migración ${name} estaba registrada y ha desaparecido. Reescribir el historial de ` +
          'migraciones exige aprobación humana explícita (Engineering Constitution).',
      );
    } else if (currentHashes[name] !== hash) {
      problems.push(
        `La migración ${name} ha cambiado después de registrarse. Una migración aplicada no se ` +
          'edita: se añade una nueva.',
      );
    }
  }
} else {
  writeFileSync(
    LOCK_PATH,
    `${JSON.stringify({ version: 1, migrations: currentHashes }, null, 2)}\n`,
    'utf8',
  );
  console.log('  (registro de huellas creado: supabase/migrations/.lock.json)');
}

// ---------------------------------------------------------------- nivel B
const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  problems.push(
    'SUPABASE_DB_URL no está definida: el diff contra la base de datos no se ha podido ejecutar.\n' +
      '    Requiere Supabase local en marcha (`npm run db:start`, que a su vez requiere Docker)\n' +
      '    o la cadena de conexión de un entorno remoto. Ver MI-05a.',
  );
} else {
  try {
    const output = execFileSync(
      'npx',
      ['--yes', 'supabase', 'db', 'diff', '--db-url', dbUrl, '--schema', 'public'],
      { encoding: 'utf8', cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    const meaningful = output
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.trim().startsWith('--'))
      .join('\n')
      .trim();

    if (meaningful !== '') {
      problems.push(`El esquema de la base difiere de las migraciones:\n${meaningful}`);
    }
  } catch (error) {
    problems.push(
      `No se pudo ejecutar "supabase db diff": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ---------------------------------------------------------------- resultado
if (problems.length === 0) {
  console.log('✔ schema-drift: sin deriva');
  process.exit(0);
}

console.error(`✘ schema-drift: ${problems.length} problema(s)\n`);
for (const p of problems) console.error(`  - ${p}\n`);
console.error('EC-011 · REQ-A04. El esquema lo gobiernan las migraciones del repositorio.');
process.exit(1);
