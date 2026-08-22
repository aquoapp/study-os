#!/usr/bin/env node
/**
 * GUARDA 5 · Sin secretos en el cliente.
 *
 * EC-010 · «Secretos de servicio/proveedor nunca en cliente»
 * REQ-A05 · «Sin secretos de servicio/proveedor en el bundle»
 * Gate P0-G3 · `bundle.secret-scan.spec` sin hallazgos
 * Manifest §14 · «never expose service-role/provider secret in browser»
 *
 * Dos pasadas:
 *
 *   A · **Fuente.** Busca material que no debe estar versionado nunca: claves
 *       privadas, tokens de proveedor, JWT con rol de servicio. Se ejecuta siempre.
 *
 *   B · **Bundle.** Recorre la salida de `next build` buscando (1) valores de
 *       variables exclusivamente de servidor y (2) variables `NEXT_PUBLIC_*` que no
 *       estén en la allowlist. Exige que el build exista: un escáner que se salta a
 *       sí mismo cuando no hay bundle no es un control.
 *
 * Un secreto expuesto es un **fallo duro** del Checkpoint Contract: impide PASS.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, lineOf, read, report, walk } from './lib/walk.mjs';

/** Espejo de `PUBLIC_ENV_ALLOWLIST` en `packages/config`. */
const PUBLIC_ENV_ALLOWLIST = [
  'NEXT_PUBLIC_ENVIRONMENT',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const SERVER_ONLY_ENV_KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL'];

/** Patrones de material sensible en la fuente. */
const SOURCE_PATTERNS = [
  { name: 'clave privada PEM', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  {
    name: 'JWT con rol de servicio',
    re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*(?:c2VydmljZV9yb2xl|role[^A-Za-z0-9]{0,4}service)/g,
  },
  { name: 'token de proveedor de IA', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'clave de AWS', re: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    name: 'asignación literal de service role',
    re: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"\s]{8,}['"]/g,
  },
];

const findings = [];

// ---------------------------------------------------------------- pasada A
const SOURCE_ROOTS = ['apps', 'packages', 'tools', 'tests', 'supabase', '.github'];

for (const root of SOURCE_ROOTS) {
  const files = walk(join(REPO_ROOT, root), (p) =>
    /\.(ts|tsx|js|jsx|mjs|cjs|json|sql|toml|yml|yaml|env|example|css|md)$/.test(p),
  );

  for (const file of files) {
    if (file === 'tools/guards/secret-scan.mjs') continue; // define los patrones
    const source = read(file);
    for (const { name, re } of SOURCE_PATTERNS) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(source)) !== null) {
        findings.push({ file, line: lineOf(source, match.index), message: `Fuente: ${name}.` });
      }
    }
  }
}

// ---------------------------------------------------------------- pasada B
const BUNDLE_DIR = join(REPO_ROOT, 'apps', 'web', '.next');

/**
 * Solo `.next/static`: es lo que el navegador descarga. `.next/server` no se
 * analiza a propósito — ahí un secreto de servidor es legítimo.
 */
const bundleFiles = existsSync(BUNDLE_DIR)
  ? walk(join(BUNDLE_DIR, 'static'), (p) => /\.(js|mjs|css|json|map|html)$/.test(p))
  : [];

if (!existsSync(BUNDLE_DIR)) {
  // No se sale antes de tiempo: los hallazgos de la pasada A también deben
  // reportarse. Pero la ausencia de bundle **es** un hallazgo, no una excusa:
  // un escáner que se omite a sí mismo no es un control.
  findings.push({
    file: 'apps/web/.next',
    line: 0,
    message:
      'no existe apps/web/.next · el escaneo del bundle no puede omitirse: sin build no hay ' +
      'control. Ejecuta `npm run build` antes de este check.',
  });
}

for (const file of bundleFiles) {
  const source = read(file);

  for (const key of SERVER_ONLY_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.length >= 8 && source.includes(value)) {
      findings.push({
        file,
        line: lineOf(source, source.indexOf(value)),
        message: `Bundle: contiene el VALOR de ${key}. Fallo duro (EC-010).`,
      });
    }
    if (source.includes(key)) {
      findings.push({
        file,
        line: lineOf(source, source.indexOf(key)),
        message: `Bundle: menciona ${key}. Ninguna variable de servidor debe aparecer en el cliente.`,
      });
    }
  }

  const publicVarPattern = /NEXT_PUBLIC_[A-Z0-9_]+/g;
  let match;
  while ((match = publicVarPattern.exec(source)) !== null) {
    const name = match[0];
    if (!PUBLIC_ENV_ALLOWLIST.includes(name)) {
      findings.push({
        file,
        line: lineOf(source, match.index),
        message:
          `Bundle: "${name}" no está en PUBLIC_ENV_ALLOWLIST. Todo lo que llega al cliente ` +
          'es público de facto; añadirlo a la allowlist debe ser una decisión, no un descuido.',
      });
    }
  }

  for (const { name, re } of SOURCE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) {
      findings.push({ file, line: lineOf(source, m.index), message: `Bundle: ${name}.` });
    }
  }
}

console.log(`  (bundle: ${bundleFiles.length} ficheros estáticos analizados)`);

report(
  'secret-scan',
  findings,
  'EC-010 · REQ-A05 · gate P0-G3. Un secreto en el bundle es un fallo duro del\n' +
    'Checkpoint Contract: impide PASS. Los secretos se configuran en Vercel/Supabase y\n' +
    'se leen desde `@study-os/config/server`, que está marcado `server-only`.',
);
