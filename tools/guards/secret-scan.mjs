#!/usr/bin/env node
/**
 * GUARDA 5 · Sin secretos en el cliente.
 *
 * EC-010 · «Secretos de servicio/proveedor nunca en cliente»
 * REQ-A05 · «Sin secretos de servicio/proveedor en el bundle»
 * Gate P0-G3 · `bundle.secret-scan.spec` sin hallazgos
 * Manifest §14 · «never expose service-role/provider secret in browser»
 *
 * ---------------------------------------------------------------------------
 * Qué cambió respecto a la primera versión
 *
 * Antes se limitaba a buscar en `.next/static` el **nombre** de las variables de
 * servidor y unos cuantos patrones. Eso demuestra poco: el nombre puede no
 * aparecer y el valor sí, y la salida renderizada en HTML —donde un secreto llega
 * con la misma facilidad, por serialización de props o por un mensaje de error— no
 * se miraba en absoluto.
 *
 * Ahora la prueba es positiva y no por ausencia de indicios:
 *
 *   1. se genera un **centinela** único por ejecución;
 *   2. se construye la aplicación con ese centinela **como valor** de las variables
 *      exclusivamente de servidor;
 *   3. se comprueba que el centinela no aparece en ningún artefacto de cliente;
 *   4. se arranca el servidor y se comprueba que tampoco aparece en el HTML
 *      renderizado de las rutas relevantes, ni en los recursos que ese HTML
 *      referencia.
 *
 * Si el centinela apareciera en cualquiera de esos sitios, sería el propio valor
 * del secreto viajando al navegador: no hay interpretación posible.
 * ---------------------------------------------------------------------------
 */

import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, lineOf, read, report, walk } from './lib/walk.mjs';

const BUILD = process.argv.includes('--build');
const WEB_DIR = join(REPO_ROOT, 'apps', 'web');
const NEXT_BIN = join(REPO_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const PORT = Number(process.env['SECRET_SCAN_PORT'] ?? 3210);

/** Espejo de `PUBLIC_ENV_ALLOWLIST` en `packages/config`. */
const PUBLIC_ENV_ALLOWLIST = [
  'NEXT_PUBLIC_ENVIRONMENT',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

/** Espejo de `SERVER_ONLY_ENV_KEYS` en `packages/config/server-env-keys`. */
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

/** Rutas cuya salida renderizada se inspecciona. */
const RENDERED_ROUTES = [
  '/',
  '/entrar',
  '/registro',
  '/offline',
  '/cuenta',
  '/manifest.webmanifest',
  '/sw.js',
];

const findings = [];

// ============================================================ pasada A · fuente
const SOURCE_ROOTS = ['apps', 'packages', 'tools', 'tests', 'supabase', '.github'];

for (const root of SOURCE_ROOTS) {
  const files = walk(join(REPO_ROOT, root), (p) =>
    /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|sql|toml|yml|yaml|env|example|css|md)$/.test(p),
  );

  for (const file of files) {
    if (file === 'tools/guards/secret-scan.mjs') continue; // define los patrones
    const source = read(file);
    if (source === '') continue;

    for (const { name, re } of SOURCE_PATTERNS) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(source)) !== null) {
        findings.push({ file, line: lineOf(source, match.index), message: `Fuente: ${name}.` });
      }
    }
  }
}

// ==================================================== pasada B · build centinela
const sentinels = {
  SUPABASE_SERVICE_ROLE_KEY: `so-sentinel-service-role-${randomBytes(16).toString('hex')}`,
  SUPABASE_DB_URL: `so-sentinel-db-url-${randomBytes(16).toString('hex')}`,
};

const BUNDLE_DIR = join(REPO_ROOT, 'apps', 'web', '.next');

const buildEnv = {
  ...process.env,
  NEXT_PUBLIC_ENVIRONMENT: process.env['NEXT_PUBLIC_ENVIRONMENT'] ?? 'local',
  NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? 'anon-placeholder-para-escaneo',
  ...sentinels,
};

if (BUILD) {
  // Reproducible desde un checkout limpio: el propio check produce el artefacto
  // que necesita. Depender de un `npm run build` anterior hacía que el resultado
  // dependiera de lo que alguien hubiera ejecutado antes en esa máquina.
  console.log('  construyendo con centinela de servidor…');
  rmSync(BUNDLE_DIR, { recursive: true, force: true });

  const build = spawnSync(process.execPath, [NEXT_BIN, 'build'], {
    cwd: WEB_DIR,
    env: buildEnv,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  if (build.status !== 0) {
    findings.push({
      file: 'apps/web',
      line: 0,
      message: `El build falló (código ${build.status}). Sin artefacto no hay nada que escanear.`,
    });
  }
}

if (!existsSync(BUNDLE_DIR)) {
  findings.push({
    file: 'apps/web/.next',
    line: 0,
    message:
      'no existe apps/web/.next · el escaneo del bundle no puede omitirse: sin build no hay ' +
      'control. Ejecuta `npm run secret-scan` (que construye) o `npm run build` antes.',
  });
}

/**
 * Solo `.next/static`: es lo que el navegador descarga. `.next/server` no se
 * analiza a propósito — ahí un secreto de servidor es legítimo, y es justo lo que
 * el centinela permite distinguir.
 */
const bundleFiles = existsSync(BUNDLE_DIR)
  ? walk(join(BUNDLE_DIR, 'static'), (p) => /\.(js|mjs|css|json|map|html|txt)$/.test(p))
  : [];

for (const file of bundleFiles) {
  const source = read(file);
  if (source === '') continue;

  for (const [key, sentinel] of Object.entries(sentinels)) {
    if (source.includes(sentinel)) {
      findings.push({
        file,
        line: lineOf(source, source.indexOf(sentinel)),
        message: `Bundle: contiene el VALOR de ${key} (centinela). Fallo duro de EC-010.`,
      });
    }
  }

  for (const key of SERVER_ONLY_ENV_KEYS) {
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

// ============================================ pasada C · salida renderizada
let renderedChecked = 0;
let assetsChecked = 0;

if (BUILD && existsSync(BUNDLE_DIR)) {
  // Se invoca el binario de Next con el Node en ejecución. Pasar por `npm` con
  // `shell: true` concatenaría los argumentos sin escapar (DEP0190) justo donde se
  // manejan valores centinela.
  const server = spawn(process.execPath, [NEXT_BIN, 'start', '--port', String(PORT)], {
    cwd: WEB_DIR,
    env: buildEnv,
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: process.platform !== 'win32',
  });

  const base = `http://127.0.0.1:${PORT}`;

  async function waitForServer() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const response = await fetch(base, { redirect: 'manual' });
        if (response.status > 0) return true;
      } catch {
        /* todavía no escucha */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  }

  function inspectBody(label, body) {
    for (const [key, sentinel] of Object.entries(sentinels)) {
      if (body.includes(sentinel)) {
        findings.push({
          file: label,
          line: lineOf(body, body.indexOf(sentinel)),
          message:
            `Respuesta renderizada: contiene el VALOR de ${key} (centinela). ` +
            'Un secreto de servidor está llegando al navegador (EC-010).',
        });
      }
    }
    for (const key of SERVER_ONLY_ENV_KEYS) {
      if (body.includes(key)) {
        findings.push({
          file: label,
          line: lineOf(body, body.indexOf(key)),
          message: `Respuesta renderizada: menciona ${key}.`,
        });
      }
    }
  }

  try {
    const ready = await waitForServer();

    if (!ready) {
      findings.push({
        file: 'apps/web',
        line: 0,
        message:
          `El servidor no respondió en ${base}: la comprobación sobre la salida renderizada ` +
          'no ha podido ejecutarse y no se omite en silencio.',
      });
    } else {
      const seenAssets = new Set();

      for (const route of RENDERED_ROUTES) {
        const response = await fetch(`${base}${route}`, { redirect: 'follow' });
        const body = await response.text();
        renderedChecked += 1;
        inspectBody(`respuesta ${route}`, body);

        // Los recursos que la página referencia también los descarga el navegador.
        for (const match of body.matchAll(/(?:src|href)="(\/_next\/[^"]+)"/g)) {
          const asset = match[1];
          if (seenAssets.has(asset)) continue;
          seenAssets.add(asset);

          const assetResponse = await fetch(`${base}${asset}`);
          if (!assetResponse.ok) continue;
          const assetBody = await assetResponse.text();
          assetsChecked += 1;
          inspectBody(`recurso ${asset}`, assetBody);
        }
      }
    }
  } finally {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        server.kill('SIGTERM');
      }
    }
  }

  console.log(
    `  (renderizado: ${renderedChecked} ruta(s) y ${assetsChecked} recurso(s) referenciados)`,
  );
  console.log(`  (centinelas inyectados: ${Object.keys(sentinels).join(', ')})`);
} else if (!BUILD) {
  findings.push({
    file: 'tools/guards/secret-scan.mjs',
    line: 0,
    message:
      'Ejecutado sin --build: no se ha inyectado ningún centinela ni se ha inspeccionado la ' +
      'salida renderizada. Usa `npm run secret-scan`, que sí lo hace.',
  });
}

report(
  'secret-scan',
  findings,
  'EC-010 · REQ-A05 · gate P0-G3. Un secreto en el cliente es un fallo duro del\n' +
    'Checkpoint Contract: impide PASS. Los secretos se configuran en Vercel/Supabase y\n' +
    'se leen desde `@study-os/config/server`, que está marcado `server-only`.',
);
