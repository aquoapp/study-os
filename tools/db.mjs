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

import { assertPinnedCli, launchArgs, REPO_ROOT, runSupabase } from './supabase-cli.mjs';
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
  /**
   * Aplica a una base **remota** las migraciones del repositorio · Phase 4B.
   *
   * Tres cosas que lo distinguen de los demás comandos, y las tres son deliberadas:
   *
   *   1. **la cadena de conexión no se escribe en la invocación.** La lee este script del entorno y
   *      la pasa al CLI por su cuenta. Escribirla en la línea de comandos la dejaría en el
   *      historial del shell y en cualquier transcripción;
   *   2. **la salida se redacta.** Va por `runSupabase`, no por `stdio: 'inherit'`, porque el
   *      camino de error del CLI es exactamente por donde se escapó una credencial en D-25;
   *   3. **exige autorización explícita** como el reset. Aplicar esquema a una base remota no borra
   *      datos, pero cambia la autoridad del esquema de un entorno entero, y EC-011 dice que eso lo
   *      gobiernan las migraciones del repositorio **con** aprobación, no de paso.
   */
  push: { args: ['db', 'push'], destructive: 'db-push', localOnly: false, redact: true },
};

/** PRODUCTION no se muta, y tampoco se intenta: la comprobación es del ref, no de la etiqueta. */
const PRODUCTION_REF = 'nzcgufeycvehczroryoe';

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

if (command.redact) {
  /*
   * El destino sale del entorno, nunca de la invocación. Así la cadena no aparece en el historial
   * del shell ni en ninguna transcripción, y `runSupabase` la redacta de toda salida, incluida la
   * de error, que es la lección de D-25.
   */
  const dbUrl = process.env['SUPABASE_DB_URL'];
  if (!dbUrl) {
    console.error('✘ SUPABASE_DB_URL no está definida: sin destino no se aplica nada.');
    console.error('');
    console.error('  Inyéctala con: node --env-file=.env.staging.local tools/db.mjs push');
    process.exit(1);
  }
  if (dbUrl.includes(PRODUCTION_REF)) {
    console.error('✘ la cadena apunta a PRODUCTION. Esta operación no se ejecuta ahí.');
    process.exit(1);
  }
  try {
    const output = runSupabase([...command.args, '--db-url', dbUrl, ...extra]);
    if (output.trim() !== '') console.log(output.trimEnd());
    console.error('✔ migraciones aplicadas');
    process.exit(0);
  } catch (error) {
    // El mensaje ya viene redactado por `runSupabase`: se imprime tal cual.
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const run = spawnSync(process.execPath, launchArgs([...command.args, ...extra]), {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});

process.exit(run.status ?? 1);
