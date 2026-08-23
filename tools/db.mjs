#!/usr/bin/env node
/**
 * Punto de entrada único a las operaciones de base de datos.
 *
 * EC-011 · el esquema lo gobiernan las migraciones del repositorio.
 *
 * Todos los comandos pasan por aquí para que dos cosas sean imposibles por
 * construcción:
 *
 *   1. usar un CLI de Supabase cuya versión no esté fijada (ver `tools/supabase-cli.mjs`);
 *   2. ejecutar una operación destructiva contra un entorno que no la admite
 *      (ver `tools/lib/environment-policy.mjs`).
 */

import { spawnSync } from 'node:child_process';

import { assertPinnedCli, launchArgs, REPO_ROOT } from './supabase-cli.mjs';

const COMMANDS = {
  start: { args: ['start'], destructive: false },
  stop: { args: ['stop'], destructive: false },
  status: { args: ['status'], destructive: false },
  diff: { args: ['db', 'diff'], destructive: false },
  reset: { args: ['db', 'reset'], destructive: true },
};

const name = process.argv[2];
const extra = process.argv.slice(3);
const command = COMMANDS[name];

if (!command) {
  console.error(`Comando desconocido: ${String(name)}`);
  console.error(`Disponibles: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(2);
}

const { pinned, installed } = assertPinnedCli();
console.error(`CLI de Supabase ${installed} (fijado ${pinned})`);

const run = spawnSync(process.execPath, launchArgs([...command.args, ...extra]), {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});

process.exit(run.status ?? 1);
