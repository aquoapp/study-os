#!/usr/bin/env node
/**
 * `npm run schema-drift:lock` · genera o actualiza el registro de huellas.
 *
 * ---------------------------------------------------------------------------
 * Por qué es un comando aparte
 *
 * `schema-drift` comprueba que ninguna migración ha cambiado desde que se
 * registró. Si ese mismo check pudiera escribir el registro, se estaría dando a sí
 * mismo la línea base: cualquier estado quedaría aprobado por el hecho de haberlo
 * observado. El primer `npm run verify` de una máquina nueva pasaría siempre.
 *
 * Separarlo obliga a que alguien decida, de forma explícita, que el estado actual
 * es la referencia. Este comando imprime el diff antes de escribir para que esa
 * decisión se tome viendo qué cambia.
 * ---------------------------------------------------------------------------
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, read, walk } from './lib/walk.mjs';

const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');
const LOCK_PATH = join(MIGRATIONS_DIR, '.lock.json');

const migrations = walk(MIGRATIONS_DIR, (p) => /supabase\/migrations\/[^/]+\.sql$/.test(p));

if (migrations.length === 0) {
  console.error('✘ schema-drift:lock: no hay ninguna migración que registrar.');
  process.exit(1);
}

const current = Object.fromEntries(
  migrations.map((file) => [
    file.split('/').pop(),
    createHash('sha256').update(read(file)).digest('hex'),
  ]),
);

const previous = existsSync(LOCK_PATH)
  ? (JSON.parse(readFileSync(LOCK_PATH, 'utf8')).migrations ?? {})
  : {};

const added = Object.keys(current).filter((name) => !(name in previous));
const removed = Object.keys(previous).filter((name) => !(name in current));
const changed = Object.keys(current).filter(
  (name) => name in previous && previous[name] !== current[name],
);

console.log(
  existsSync(LOCK_PATH)
    ? 'Actualizando el registro de huellas.'
    : 'Creando el registro de huellas.',
);
console.log('');

for (const name of added) console.log(`  + ${name}  ${current[name]}`);
for (const name of removed) console.log(`  - ${name}  ${previous[name]}`);
for (const name of changed) {
  console.log(`  ~ ${name}`);
  console.log(`      antes:  ${previous[name]}`);
  console.log(`      ahora:  ${current[name]}`);
}

if (added.length === 0 && removed.length === 0 && changed.length === 0) {
  console.log('  (sin cambios)');
}

console.log('');

if (changed.length > 0 || removed.length > 0) {
  console.log('⚠  Una migración ya registrada ha cambiado o desaparecido.');
  console.log('   Editar una migración aplicada, o reescribir el historial, exige aprobación');
  console.log('   humana explícita (Engineering Constitution). Lo normal es añadir una');
  console.log('   migración nueva, no modificar una existente.');
  console.log('');
}

writeFileSync(
  LOCK_PATH,
  `${JSON.stringify({ version: 1, migrations: current }, null, 2)}\n`,
  'utf8',
);

console.log(
  `✔ supabase/migrations/.lock.json escrito · ${Object.keys(current).length} migración(es)`,
);
console.log('  Revisa el diff antes de confirmarlo.');
