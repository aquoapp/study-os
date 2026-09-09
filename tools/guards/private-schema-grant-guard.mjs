#!/usr/bin/env node
/**
 * GUARDA 6 · Los esquemas no expuestos no reciben privilegios de cliente.
 *
 * ADR-011 · «`content` e `ingest` son esquemas NO expuestos; los roles de cliente no
 * tienen USAGE ni grants sobre ellos; la exposición automática permanece
 * desactivada». SI-1A-3 · Phase 1A Authorization Packet §J.
 *
 * ---------------------------------------------------------------------------
 * Qué mira
 *
 * El texto de TODAS las migraciones (`supabase/migrations/*.sql`), sin comentarios
 * ni literales de cadena, en busca de sentencias que concedan algo a `anon`,
 * `authenticated` o al pseudo-rol `public` sobre:
 *
 *   - los esquemas no expuestos declarados en `authority-registry.json`
 *     (`dataApi.nonExposedSchemas`), o cualquier objeto calificado con ellos;
 *   - privilegios por defecto (`ALTER DEFAULT PRIVILEGES … TO anon|authenticated`)
 *     en cualquier esquema: un grant futuro y silencioso es peor que uno presente.
 *
 * Y comprueba que la lista de exposición de `supabase/config.toml` coincide con
 * `dataApi.exposedSchemas` del registro: la lista es una frontera, y una frontera con
 * dos definiciones acaba teniendo dos.
 *
 * Es una guarda **estática**: complementa, no sustituye, la prueba contra PostgREST
 * (`tests/integration/dataApi.exposure.spec.ts`) y la de catálogo
 * (`tests/integration/catalog.security.spec.ts`).
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, lineOf, read, report, walk } from './lib/walk.mjs';

const registry = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages/domain/src/authority-registry.json'), 'utf8'),
);

const NON_EXPOSED = registry.dataApi.nonExposedSchemas;
const EXPOSED = registry.dataApi.exposedSchemas;
const CLIENT_ROLES = ['anon', 'authenticated', 'public'];

const findings = [];

// ---------------------------------------------------------------- lista de exposición
const toml = read('supabase/config.toml');
const schemasLine = /^\s*schemas\s*=\s*\[([^\]]*)\]/m.exec(toml);
const configured = schemasLine
  ? schemasLine[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  : [];

if (JSON.stringify(configured) !== JSON.stringify(EXPOSED)) {
  findings.push({
    file: 'supabase/config.toml',
    line: schemasLine ? lineOf(toml, schemasLine.index) : 1,
    message:
      `La lista de exposición [api].schemas es [${configured.join(', ')}] y el registro declara ` +
      `[${EXPOSED.join(', ')}]. ADR-011 punto 4: una sola definición, gobernada.`,
  });
}

for (const schema of NON_EXPOSED) {
  if (configured.includes(schema)) {
    findings.push({
      file: 'supabase/config.toml',
      line: schemasLine ? lineOf(toml, schemasLine.index) : 1,
      message: `El esquema no expuesto "${schema}" aparece en la lista de exposición del Data API.`,
    });
  }
}

const searchPath = /^\s*extra_search_path\s*=\s*\[([^\]]*)\]/m.exec(toml);
if (searchPath) {
  for (const schema of NON_EXPOSED) {
    if (new RegExp(`["']${schema}["']`).test(searchPath[1])) {
      findings.push({
        file: 'supabase/config.toml',
        line: lineOf(toml, searchPath.index),
        message: `"${schema}" no puede estar en extra_search_path: PostgREST lo resolvería sin calificar.`,
      });
    }
  }
}

// ---------------------------------------------------------------- migraciones
function stripSql(source) {
  return source.replace(/--[^\n]*/g, '').replace(/'[^']*'/g, "''");
}

const roleAlternation = CLIENT_ROLES.join('|');
const schemaAlternation = NON_EXPOSED.join('|');

const migrations = walk(join(REPO_ROOT, 'supabase', 'migrations'), (p) => p.endsWith('.sql'));

for (const file of migrations) {
  const raw = read(file);
  const source = stripSql(raw);

  for (const statement of source.split(';')) {
    const flat = statement.replace(/\s+/g, ' ').trim().toLowerCase();
    if (flat === '') continue;

    const index = raw.toLowerCase().indexOf(flat.slice(0, 40));
    const line = index >= 0 ? lineOf(raw, index) : 1;

    // GRANT … TO anon|authenticated|public sobre un esquema no expuesto o un objeto suyo.
    if (/^grant\b/.test(flat) && new RegExp(`\\bto\\b[^;]*\\b(${roleAlternation})\\b`).test(flat)) {
      const touchesPrivate =
        new RegExp(`\\bon\\s+schema\\s+(${schemaAlternation})\\b`).test(flat) ||
        new RegExp(`\\bon\\s+(all\\s+\\w+\\s+in\\s+schema\\s+)?(${schemaAlternation})\\b`).test(
          flat,
        ) ||
        new RegExp(`\\b(${schemaAlternation})\\.[a-z_]+`).test(flat);
      if (touchesPrivate) {
        findings.push({
          file,
          line,
          message: `Concede privilegios de cliente sobre un esquema no expuesto: "${flat.slice(0, 120)}"`,
        });
      }
    }

    // ALTER DEFAULT PRIVILEGES … TO anon|authenticated en cualquier esquema.
    if (
      /^alter\s+default\s+privileges\b/.test(flat) &&
      new RegExp(`\\bto\\b[^;]*\\b(anon|authenticated)\\b`).test(flat) &&
      !/\brevoke\b/.test(flat)
    ) {
      findings.push({
        file,
        line,
        message: `Privilegios por defecto para roles de cliente: "${flat.slice(0, 120)}". ADR-011 punto 5.`,
      });
    }

    // CREATE POLICY sobre una tabla de esquema no expuesto para roles de cliente.
    if (
      /^create\s+policy\b/.test(flat) &&
      new RegExp(`\\bon\\s+(${schemaAlternation})\\.[a-z_]+`).test(flat) &&
      new RegExp(`\\bto\\b[^;]*\\b(${roleAlternation})\\b`).test(flat)
    ) {
      findings.push({
        file,
        line,
        message: `Política para roles de cliente sobre una tabla no expuesta: "${flat.slice(0, 120)}"`,
      });
    }
  }
}

// ---------------------------------------------------------------- tablas cerradas al crearse
// SI-1A-4 · EC-009. Toda tabla que una migración crea queda, en esa MISMA migración, con
// RLS forzado y sin privilegios para los roles de cliente. Los privilegios por defecto de
// la plataforma pueden conceder TRUNCATE, REFERENCES o TRIGGER a `anon` sobre una tabla
// nueva: la revocación explícita no es opcional.
for (const file of migrations) {
  if (/[\\/]down[\\/]/.test(file)) continue;
  const raw = read(file);
  const source = stripSql(raw).toLowerCase();
  const flat = source.replace(/\s+/g, ' ');
  for (const match of raw
    .replace(/--[^\n]*/g, '')
    .matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_]+\.[a-z_]+)/gi)) {
    const table = match[1].toLowerCase();
    const escaped = table.replace('.', '\\.');
    const forced = new RegExp(`alter table ${escaped} force row level security`).test(flat);
    const revoked = new RegExp(
      `revoke all on ${escaped} from (?=[^;]*\\banon\\b)(?=[^;]*\\bauthenticated\\b)`,
    ).test(flat);
    if (!forced || !revoked) {
      findings.push({
        file,
        line: lineOf(raw, match.index ?? 0),
        message:
          `La tabla ${table} se crea sin ${!forced ? 'FORCE ROW LEVEL SECURITY' : ''}${!forced && !revoked ? ' ni ' : ''}` +
          `${!revoked ? 'REVOKE ALL … FROM anon, authenticated' : ''} en la misma migración (SI-1A-4 · EC-009).`,
      });
    }
  }
}

console.log(
  `  (${migrations.length} migración(es) analizadas · no expuestos: ${NON_EXPOSED.join(', ')} · expuestos: ${EXPOSED.join(', ')})`,
);

report(
  'private-schema-grant-guard',
  findings,
  'ADR-011. Los esquemas no expuestos son una frontera de seguridad: ningún rol de cliente\n' +
    'recibe USAGE, grants, políticas ni privilegios por defecto sobre ellos, y la lista de\n' +
    'exposición tiene una sola definición. Cambiarla exige enmienda del ADR (EC-019).',
);
