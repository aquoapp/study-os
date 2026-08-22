#!/usr/bin/env node
/**
 * GUARDA 3 · El cliente no persiste proyecciones autoritativas.
 *
 * INV-113 · «El servidor es la autoridad exclusiva para persistir Mastery, Exam
 * Readiness y estado del Planner. Ninguna ruta de cliente escribe esas proyecciones.»
 * REQ-A08 · ADR-001 v1.1 punto 2 · EC-002 · EC-003
 *
 * Check de CI: `client-authority-guard` (Execution Plan §4).
 * Test asociado: `tests/unit/client.no-authoritative-write.spec.ts`.
 *
 * Detecta dos cosas en ficheros de cliente:
 *   1. escrituras (`insert`/`update`/`upsert`/`delete`/`rpc`) sobre las tablas de
 *      proyección autoritativa;
 *   2. uso de la clave de rol de servicio, que atraviesa RLS.
 *
 * Complementa —no sustituye— a los grants de base de datos. Los grants son el
 * control real; esto detecta la intención antes de que llegue a producción.
 */

import { join } from 'node:path';

import { REPO_ROOT, lineOf, read, report, stripComments, walk } from './lib/walk.mjs';

/** Proyecciones cuya persistencia es exclusiva del servidor (INV-113). */
const AUTHORITATIVE_TABLES = [
  'concept_mastery',
  'mastery_history',
  'exam_readiness',
  'planner_runs',
  'planner_items',
];

const WRITE_METHODS = ['insert', 'update', 'upsert', 'delete'];

const SERVICE_ROLE_MARKERS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'supabaseServiceRoleKey',
  'service_role',
];

function isClientFile(relPath, source) {
  if (/^apps\/web\/src\/lib\//.test(relPath)) return true;
  if (/^apps\/web\/public\//.test(relPath)) return true;
  return /^\s*(['"])use client\1/m.test(source);
}

const files = walk(join(REPO_ROOT, 'apps'), (p) => /\.(ts|tsx|js|jsx|mjs)$/.test(p));

const findings = [];

for (const file of files) {
  const source = read(file);
  if (!isClientFile(file, source)) continue;

  const code = stripComments(source);

  for (const table of AUTHORITATIVE_TABLES) {
    // `.from('tabla')` seguido, en las líneas próximas, de un método de escritura.
    const fromPattern = new RegExp(
      `\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)([\\s\\S]{0,200})`,
      'g',
    );
    let match;
    while ((match = fromPattern.exec(code)) !== null) {
      const tail = match[1] ?? '';
      const method = WRITE_METHODS.find((m) => new RegExp(`\\.${m}\\s*\\(`).test(tail));
      if (method) {
        findings.push({
          file,
          line: lineOf(code, match.index),
          message: `Escritura de cliente (.${method}) sobre la proyección autoritativa "${table}".`,
        });
      }
    }
  }

  for (const marker of SERVICE_ROLE_MARKERS) {
    const pattern = new RegExp(marker, 'g');
    let match;
    while ((match = pattern.exec(code)) !== null) {
      findings.push({
        file,
        line: lineOf(code, match.index),
        message: `Referencia a "${marker}" en un fichero de cliente. La clave de rol de servicio atraviesa RLS.`,
      });
    }
  }
}

report(
  'client-authority-guard',
  findings,
  'INV-113 · REQ-A08. Una proyección local es legítima si está marcada\n' +
    '`authoritative: false` (ver `@study-os/domain`) y se sustituye por la del servidor al\n' +
    'sincronizar. Lo que no es legítimo es persistirla.',
);
