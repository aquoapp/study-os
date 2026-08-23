#!/usr/bin/env node
/**
 * Punto de entrada único a las operaciones de base de datos.
 *
 * EC-011 · el esquema lo gobiernan las migraciones del repositorio.
 * Engineering Constitution · «Human approval required for destructive migrations».
 *
 * Tres cosas imposibles por construcción:
 *
 *   1. usar un CLI de Supabase cuya versión no esté fijada (`tools/supabase-cli.mjs`);
 *   2. ejecutar una operación destructiva contra un entorno que no la admite
 *      (`tools/lib/environment-policy.mjs`);
 *   3. **apuntar un reset a cualquier destino que no sea la instancia local.**
 */

import { spawnSync } from 'node:child_process';

import { assertPinnedCli, launchArgs, REPO_ROOT } from './supabase-cli.mjs';
import {
  AUTHORIZATION_ENV_VAR,
  assertDestructiveOperationAllowed,
  isLoopbackUrl,
} from './lib/environment-policy.mjs';

const COMMANDS = {
  start: { args: ['start'], destructive: null, localOnly: false },
  stop: { args: ['stop'], destructive: null, localOnly: false },
  status: { args: ['status'], destructive: null, localOnly: false },
  diff: { args: ['db', 'diff'], destructive: null, localOnly: false },
  // `--local` no es un valor por defecto: es parte del comando y no se puede quitar.
  reset: { args: ['db', 'reset', '--local'], destructive: 'db-reset', localOnly: true },
};

/**
 * Banderas que redirigen la operación fuera de la instancia local.
 *
 * `db reset` acepta `--db-url` y `--linked`, y cualquiera de las dos convierte un
 * reset local en un borrado remoto. No se filtran ni se corrigen: se rechaza la
 * invocación entera. Corregir en silencio un argumento que el usuario escribió es
 * peor que fallar, porque deja creer que se ejecutó lo que se pidió.
 */
const REMOTE_FLAGS = ['--db-url', '--linked', '--project-ref', '--remote'];

const name = process.argv[2];
const extra = process.argv.slice(3);
const command = COMMANDS[name];

if (!command) {
  console.error(`Comando desconocido: ${String(name)}`);
  console.error(`Disponibles: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(2);
}

// ------------------------------------------------- destino: solo local
if (command.localOnly) {
  // Se inspeccionan TODOS los argumentos, incluidos los que van después de `--`.
  // npm reenvía ahí lo que el usuario escriba, y un `--` no convierte una bandera
  // en algo inofensivo: el CLI la sigue leyendo.
  const offending = extra.filter((argument) =>
    REMOTE_FLAGS.some((flag) => argument === flag || argument.startsWith(`${flag}=`)),
  );

  if (offending.length > 0) {
    console.error(
      `✘ "${name}" solo puede ejecutarse contra la instancia local. Argumentos rechazados: ` +
        `${offending.join(', ')}`,
    );
    console.error('');
    console.error('  Esas banderas redirigen la operación a una base remota. No se filtran ni se');
    console.error('  corrigen: la invocación se rechaza entera, para que quede claro que lo que');
    console.error('  se pidió no se ha ejecutado.');
    process.exit(1);
  }

  // Una cadena de conexión suelta también es un destino.
  const looksLikeConnectionString = extra.find((argument) =>
    /^[a-z][a-z0-9+.-]*:\/\//i.test(argument),
  );
  if (looksLikeConnectionString) {
    console.error(
      `✘ "${name}" recibió lo que parece una cadena de conexión: ${looksLikeConnectionString}`,
    );
    process.exit(1);
  }
}

// --------------------------------------------------------- guarda destructiva
if (command.destructive) {
  const environment = process.env['NEXT_PUBLIC_ENVIRONMENT'];

  try {
    assertDestructiveOperationAllowed(
      command.destructive,
      environment,
      process.env[AUTHORIZATION_ENV_VAR],
    );
  } catch (error) {
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
    if (!environment) {
      console.error('');
      console.error(
        'Define NEXT_PUBLIC_ENVIRONMENT con el entorno objetivo. Sin ese dato la operación se',
      );
      console.error('deniega: no se adivina contra qué base de datos se está trabajando.');
    }
    process.exit(1);
  }

  // El nombre del entorno lo escribe una persona. La URL dice contra qué se
  // trabaja de verdad, así que se comprueban las dos cosas.
  const dbUrl = process.env['SUPABASE_DB_URL'];
  if (environment === 'local' && dbUrl && !isLoopbackUrl(dbUrl)) {
    console.error(
      `✘ NEXT_PUBLIC_ENVIRONMENT dice "local" pero SUPABASE_DB_URL no apunta a loopback.\n` +
        '  Una etiqueta equivocada no puede autorizar un reset contra una base remota.',
    );
    process.exit(1);
  }

  console.error(
    `Operación destructiva "${command.destructive}" autorizada en "${environment}", ` +
      'forzada a --local.',
  );
}

const { pinned, installed } = assertPinnedCli();
console.error(`CLI de Supabase ${installed} (fijado ${pinned})`);

const run = spawnSync(process.execPath, launchArgs([...command.args, ...extra]), {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});

process.exit(run.status ?? 1);
