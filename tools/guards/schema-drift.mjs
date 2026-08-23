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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, read, walk } from './lib/walk.mjs';
import { assertPinnedCli, runSupabase } from '../supabase-cli.mjs';

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

/**
 * Este check es **estrictamente de solo lectura**.
 *
 * Antes, si el lock no existía, lo creaba y seguía adelante. Eso convertía la
 * primera ejecución en un pase automático: el check registraba como correcto
 * cualquier estado que encontrase, incluido uno que nadie había revisado. Un
 * control que se otorga a sí mismo la línea base no controla nada.
 *
 * Ahora la ausencia del lock es un fallo, y generarlo es un comando aparte y
 * explícito: `npm run schema-drift:lock`.
 */
if (!existsSync(LOCK_PATH)) {
  problems.push(
    'No existe supabase/migrations/.lock.json.\n' +
      '    El registro de huellas es la línea base contra la que se detecta una migración\n' +
      '    editada después de aplicarse. Este check NO lo genera: hacerlo convertiría la\n' +
      '    primera ejecución en un pase automático sobre un estado que nadie ha revisado.\n' +
      '    Genéralo con `npm run schema-drift:lock` y revisa el diff antes de confirmarlo.',
  );
} else {
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

  for (const name of Object.keys(currentHashes)) {
    if (!(name in (previous.migrations ?? {}))) {
      problems.push(
        `La migración ${name} no está en el registro de huellas. Añádela con ` +
          '`npm run schema-drift:lock` y revisa el cambio antes de confirmarlo.',
      );
    }
  }
}

// -------------------------------------------------- nivel A · CLI reproducible
// El diff lo produce el CLI de Supabase. Si su versión no está controlada, el
// resultado del check tampoco lo está.
try {
  const { pinned, installed } = assertPinnedCli();
  console.log(`  (CLI de Supabase fijado: ${pinned}, instalado: ${installed})`);
} catch (error) {
  problems.push(error instanceof Error ? error.message : String(error));
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
    const output = runSupabase(['db', 'diff', '--db-url', dbUrl, '--schema', 'public']);

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
