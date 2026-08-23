import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `toolchain.pinning.spec` · reproducibilidad del entorno de ejecución.
 *
 * EC-011 · el esquema lo gobiernan las migraciones del repositorio · una
 * herramienta que aplica migraciones con una versión distinta en cada máquina
 * convierte esa garantía en una suposición.
 * EC-020 · un gate solo demuestra algo si es reproducible.
 * Manifest §7 · las dependencias se declaran, no se descargan al vuelo.
 *
 * Dos derivas que este test hace imposibles:
 *
 *   1. **Runtime.** Node debe ser 24 en `package.json`, en `.nvmrc`, en
 *      `.node-version` y en CI, sin que ninguno pueda desviarse por su cuenta.
 *   2. **CLI de Supabase.** Versión exacta en `devDependencies` y en el lockfile.
 *      Ni `latest`, ni `npx --yes supabase`, ni una instalación global.
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

/**
 * Quita comentarios antes de buscar patrones prohibidos.
 *
 * Sin esto, el propio texto que **explica** por qué algo está prohibido cuenta
 * como infracción, y la única salida sería dejar de documentarlo.
 */
function code(source: string, style: 'js' | 'yaml'): string {
  if (style === 'yaml') {
    return source
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
  }
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const pkg = JSON.parse(read('package.json')) as {
  engines?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

const lock = JSON.parse(read('package-lock.json')) as {
  packages: Record<string, { version?: string }>;
};

const ci = read('.github/workflows/ci.yml');

describe('runtime · Node 24', () => {
  it('package.json declara un rango de Node 24 coherente', () => {
    const range = pkg.engines?.['node'];
    expect(range).toBeDefined();
    expect(range).toBe('>=24.0.0 <25');
  });

  it('.nvmrc y .node-version existen y coinciden', () => {
    const nvmrc = read('.nvmrc').trim();
    const nodeVersion = read('.node-version').trim();

    expect(nvmrc).toBe('24');
    expect(nodeVersion).toBe('24');
    expect(nvmrc).toBe(nodeVersion);
  });

  it('CI toma la versión de .nvmrc, no de un literal propio', () => {
    expect(ci).toContain('node-version-file: .nvmrc');
    // Un `node-version:` fijo en el YAML sería una segunda fuente de verdad que
    // puede desincronizarse en silencio.
    expect(ci).not.toMatch(/^\s*node-version:\s/m);
  });

  it('el Node en ejecución cumple el rango declarado', () => {
    const major = Number(process.versions.node.split('.')[0]);
    expect(major, `ejecutando Node ${process.versions.node}`).toBe(24);
  });

  it('npm también está acotado', () => {
    expect(pkg.engines?.['npm']).toBeDefined();
  });

  it('.npmrc activa engine-strict para que el rango se aplique de verdad', () => {
    // Sin esto, `engines` es documentación y npm sigue instalando igualmente.
    expect(read('.npmrc')).toContain('engine-strict=true');
  });
});

describe('CLI de Supabase · versión exacta', () => {
  const declared = pkg.devDependencies?.['supabase'];

  it('está declarado como devDependency', () => {
    expect(declared, 'el CLI no puede depender de una instalación global').toBeDefined();
  });

  it('la versión es exacta, sin rango ni "latest"', () => {
    expect(declared).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('el lockfile fija exactamente esa versión', () => {
    const locked = lock.packages['node_modules/supabase']?.version;
    expect(locked).toBe(declared);
  });

  it('CI no instala el CLI por su cuenta', () => {
    const ciCode = code(ci, 'yaml');
    expect(ciCode).not.toContain('supabase/setup-cli');
    expect(ciCode).not.toMatch(/version:\s*latest/);
  });

  it('ningún script ni herramienta invoca el CLI con npx sin fijar', () => {
    const sources = [
      'package.json',
      '.github/workflows/ci.yml',
      'tools/db.mjs',
      'tools/supabase-cli.mjs',
      'tools/guards/schema-drift.mjs',
      'tools/verify.mjs',
    ];

    for (const file of sources) {
      const style = file.endsWith('.yml') ? 'yaml' : 'js';
      const text = code(read(file), style);
      expect(text, `${file} usa npx para invocar el CLI`).not.toMatch(/npx[^\n]*supabase/);
    }
  });

  it('ningún script llama al CLI por nombre suelto, que resolvería el global', () => {
    for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
      expect(script, `script "${name}"`).not.toMatch(/(^|\s|&&\s*)supabase\s/);
    }
  });

  it('el resolutor del CLI comprueba la versión en tiempo de ejecución', () => {
    const resolver = read('tools/supabase-cli.mjs');
    expect(resolver).toContain('assertPinnedCli');
    expect(resolver).toContain('Versión del CLI de Supabase incoherente');
    // Se invoca el script JS con el Node en ejecución: sin shim .cmd ni shell.
    expect(resolver).toContain('process.execPath');
  });

  it('las operaciones de base de datos pasan por el punto de entrada único', () => {
    for (const key of ['db:start', 'db:stop', 'db:reset', 'db:diff', 'db:status']) {
      expect(pkg.scripts?.[key], `falta el script ${key}`).toContain('tools/db.mjs');
    }
  });
});

describe('compatibilidad de la cadena de herramientas con Node 24', () => {
  const dependencyEngines: Array<[string, string]> = [
    ['next', '>=20.9.0'],
    ['@supabase/supabase-js', '>=22.0.0'],
    ['vitest', '^20.0.0 || ^22.0.0 || >=24.0.0'],
    ['@playwright/test', '>=20'],
  ];

  for (const [name, expectedRange] of dependencyEngines) {
    it(`${name} declara el rango de Node esperado`, () => {
      const meta = JSON.parse(read(join('node_modules', name, 'package.json'))) as {
        engines?: Record<string, string>;
      };
      // Si un paquete cambia su rango en una actualización, este test lo detecta
      // antes de que el fallo aparezca como un error de ejecución opaco.
      expect(meta.engines?.['node']).toBe(expectedRange);
    });
  }
});
