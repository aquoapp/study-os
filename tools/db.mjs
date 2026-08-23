#!/usr/bin/env node
/**
 * Punto de entrada único a las operaciones de base de datos.
 *
 * EC-011 · el esquema lo gobiernan las migraciones del repositorio.
 * Engineering Constitution · «Human approval required for destructive migrations».
 *
 * Todos los comandos pasan por aquí para que dos cosas sean imposibles por
 * construcción:
 *
 *   1. usar un CLI de Supabase cuya versión no esté fijada
 *      (ver `tools/supabase-cli.mjs`);
 *   2. ejecutar una operación destructiva contra un entorno que no la admite
 *      (ver `tools/lib/environment-policy.mjs`).
 *
 * La comprobación del punto 2 aplica las **mismas** reglas que
 * `@study-os/config/destructive`, leídas del mismo fichero de datos. Antes existía
 * una función `assertDestructiveOperationAllowed` en el código TypeScript que
 * nadie llamaba: daba apariencia de control sin serlo.
 */

import { spawnSync } from 'node:child_process';

import { assertPinnedCli, launchArgs, REPO_ROOT } from './supabase-cli.mjs';
import {
  AUTHORIZATION_ENV_VAR,
  assertDestructiveOperationAllowed,
  isLoopbackUrl,
} from './lib/environment-policy.mjs';

const COMMANDS = {
  start: { args: ['start'], destructive: null },
  stop: { args: ['stop'], destructive: null },
  status: { args: ['status'], destructive: null },
  diff: { args: ['db', 'diff'], destructive: null },
  reset: { args: ['db', 'reset'], destructive: 'db-reset' },
};

const name = process.argv[2];
const extra = process.argv.slice(3);
const command = COMMANDS[name];

if (!command) {
  console.error(`Comando desconocido: ${String(name)}`);
  console.error(`Disponibles: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(2);
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

  console.error(`Operación destructiva "${command.destructive}" autorizada en "${environment}".`);
}

const { pinned, installed } = assertPinnedCli();
console.error(`CLI de Supabase ${installed} (fijado ${pinned})`);

const run = spawnSync(process.execPath, launchArgs([...command.args, ...extra]), {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});

process.exit(run.status ?? 1);
