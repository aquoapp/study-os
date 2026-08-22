#!/usr/bin/env node
/**
 * Ejecuta los nueve checks bloqueantes de Phase 0 y produce un resumen legible.
 *
 * Execution Plan §4. El mismo conjunto que ejecuta CI, para que «en mi máquina
 * pasa» signifique algo.
 *
 * Ningún check se omite: si uno no puede ejecutarse por falta de entorno, se
 * reporta como **BLOQUEADO**, cuenta como fallo y el resumen dice exactamente qué
 * falta. Un check omitido en silencio produce un verde que no demuestra nada
 * (Checkpoint Contract · «acceptance tests skipped without approved reason»).
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * @typedef {{ id: string, script: string, requires?: string[], covers: string }} Check
 */

/** @type {Check[]} */
const CHECKS = [
  { id: 'typecheck', script: 'typecheck', covers: 'REQ-A02 · TypeScript strict' },
  { id: 'lint', script: 'lint', covers: 'ADR-001 · regla de import de motores · INV-116' },
  {
    id: 'test:unit',
    script: 'test:unit',
    covers: 'REQ-A06 · REQ-A09 · EC-015 · EC-017 · INV-116 · gate P0-G5',
  },
  {
    id: 'test:integration',
    script: 'test:integration',
    requires: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
    covers: 'REQ-A07 · profiles 1:1',
  },
  {
    id: 'test:rls',
    script: 'test:rls',
    requires: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
    covers: 'EC-009 · REQ-C13 · aislamiento RLS',
  },
  {
    id: 'test:e2e',
    script: 'test:e2e',
    requires: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    covers: 'REQ-A02 · REQ-A07 · gate P0-G1',
  },
  {
    id: 'schema-drift',
    script: 'schema-drift',
    requires: ['SUPABASE_DB_URL'],
    covers: 'EC-011 · REQ-A04',
  },
  { id: 'secret-scan', script: 'secret-scan', covers: 'EC-010 · REQ-A05 · gate P0-G3' },
  {
    id: 'client-authority-guard',
    script: 'client-authority-guard',
    covers: 'INV-113 · REQ-A08 · gate P0-G3',
  },
];

const results = [];

for (const check of CHECKS) {
  const missing = (check.requires ?? []).filter((key) => !process.env[key]);

  if (missing.length > 0) {
    results.push({
      id: check.id,
      status: 'BLOQUEADO',
      detail: `faltan variables de entorno: ${missing.join(', ')}`,
      covers: check.covers,
    });
    console.error(`\n■ ${check.id} · BLOQUEADO · faltan ${missing.join(', ')}\n`);
    continue;
  }

  console.error(`\n▶ ${check.id}\n`);

  const run = spawnSync('npm', ['run', '--silent', check.script], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  results.push({
    id: check.id,
    status: run.status === 0 ? 'PASS' : 'FAIL',
    detail: run.status === 0 ? '' : `código de salida ${run.status}`,
    covers: check.covers,
  });
}

// ---------------------------------------------------------------- resumen
const width = Math.max(...results.map((r) => r.id.length));
const symbol = { PASS: '✔', FAIL: '✘', BLOQUEADO: '■' };

console.error('\n' + '─'.repeat(78));
console.error('STUDY OS · Phase 0 · checks bloqueantes');
console.error('─'.repeat(78));

for (const r of results) {
  const line = `${symbol[r.status]} ${r.id.padEnd(width)}  ${r.status.padEnd(10)} ${r.covers}`;
  console.error(line);
  if (r.detail) console.error(`  ${' '.repeat(width)}  ${r.detail}`);
}

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
const blocked = results.filter((r) => r.status === 'BLOQUEADO').length;

console.error('─'.repeat(78));
console.error(
  `${passed} en verde · ${failed} en rojo · ${blocked} bloqueados · ${results.length} totales`,
);

if (blocked > 0) {
  console.error('');
  console.error('Los checks bloqueados necesitan una instancia de Supabase alcanzable.');
  console.error('En local: `npm run db:start` (requiere Docker). Ver MI-05a.');
}

console.error('─'.repeat(78));

process.exit(failed + blocked > 0 ? 1 : 0);
