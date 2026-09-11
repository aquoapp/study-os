import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { redactSecrets, runSupabase } from '../../tools/supabase-cli.mjs';

/**
 * `secret.redaction.spec` · **D-25** · EC-010 · Manifest §14.
 *
 * El incidente: el CLI de Supabase falló, `execFileSync` compuso su mensaje de error con la
 * línea de comandos completa —`--db-url` incluido— y la herramienta lo imprimió tal cual. Una
 * contraseña de STAGING llegó así a una transcripción de trabajo.
 *
 * Estas pruebas no se fían de la intención: provocan **un fallo real del CLI** con una
 * contraseña centinela y comprueban que no aparece en el error. La centinela se construye en
 * tiempo de ejecución, de modo que ni este fichero contiene una cadena con forma de secreto ni
 * la prueba puede crear una segunda exposición: el destino es un puerto cerrado de loopback.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(REPO_ROOT, path), 'utf8');

function sentinel() {
  const password = `d25sentinel${randomBytes(12).toString('hex')}`;
  const url = ['postgresql://postgres', ':', password, '@127.0.0.1:1/postgres'].join('');
  return { password, url };
}

function failureOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  }
  return '';
}

describe('D-25 · el CLI de Supabase nunca devuelve la cadena de conexión', () => {
  it('redactSecrets borra el secreto conocido y cualquier cadena de conexión', () => {
    const { password, url } = sentinel();
    const other = ['postgres://otro', ':', `${password}x`, '@host:5432/db'].join('');
    const out = redactSecrets(`falló: ${url} · ${password} · ${other}`, [url, password]);
    expect(out).not.toContain(password);
    expect(out).not.toMatch(/postgres(?:ql)?:\/\//);
  });

  for (const form of ['--db-url <url>', '--db-url=<url>'] as const) {
    it(`un fallo real del CLI con ${form} no filtra la contraseña`, () => {
      const { password, url } = sentinel();
      const args =
        form === '--db-url <url>'
          ? ['db', 'query', 'select 1', '--db-url', url]
          : ['db', 'query', 'select 1', `--db-url=${url}`];
      const failure = failureOf(() => runSupabase(args, { timeout: 60_000 }));
      expect(failure, 'el CLI debería fallar contra un puerto cerrado').not.toBe('');
      expect(failure).not.toContain(password);
      expect(failure).not.toContain(url);
      // El error original de Node —«Command failed: <línea de comandos>»— no se propaga.
      expect(failure).not.toContain('Command failed');
      expect(failure).toContain('el CLI de Supabase terminó con código');
    }, 90_000);
  }
});

describe('D-25 · los secretos viajan por el entorno y nunca se imprimen', () => {
  it('CI inyecta STAGING_DB_URL solo como variable de entorno, nunca en un comando', () => {
    const ci = read('.github/workflows/ci.yml');
    const uses = ci.split('\n').filter((line) => line.includes('secrets.'));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) {
      expect(line.trim()).toBe('SUPABASE_DB_URL: ${{ secrets.STAGING_DB_URL }}');
    }
    // Nada que vuelque el entorno o la cadena: ni trazas de shell, ni printenv, ni echo.
    expect(ci).not.toMatch(/set -x|printenv|echo[^\n]*\$\{?SUPABASE_DB_URL|echo[^\n]*\$\{\{/);
  });

  it('toda herramienta que pasa --db-url al CLI está en la lista revisada y redacta', () => {
    const roots = ['tools', join('tests', 'support')];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(REPO_ROOT, dir))) {
        const path = join(dir, name);
        if (statSync(join(REPO_ROOT, path)).isDirectory()) walk(path);
        else if (/\.(mjs|ts)$/.test(name)) files.push(relative(REPO_ROOT, join(REPO_ROOT, path)));
      }
    };
    for (const root of roots) walk(root);
    const passing = files
      .filter((file) => read(file).includes("'--db-url'"))
      .map((file) => file.split('\\').join('/'))
      .sort();
    // Una herramienta nueva que hable con una base remota entra aquí solo tras revisión.
    expect(passing).toEqual([
      'tests/support/sql.ts',
      'tools/db-roundtrip.mjs',
      'tools/db.mjs',
      'tools/guards/schema-drift.mjs',
      'tools/supabase-cli.mjs',
    ]);
    // El ejecutor compartido separa los valores de `--db-url` y los redacta en toda salida.
    const executor = read('tools/supabase-cli.mjs');
    expect(executor).toContain('export function redactSecrets(');
    expect(executor).toContain('return redactSecrets(output, secrets);');
    const scrub = "replace(/postgres(?:ql)?:\\/\\/[^\\s\"'`]+/g, '<db-url>')";
    expect(read('tests/support/sql.ts')).toContain(scrub);
    expect(read('tools/db-roundtrip.mjs')).toContain(scrub);
    // `schema-drift` solo habla con el CLI a través del ejecutor que redacta.
    const drift = read('tools/guards/schema-drift.mjs');
    expect(drift).toContain('runSupabase(');
    expect(drift).not.toMatch(/execFileSync|spawnSync/);
    // `db.mjs` no lanza nada remoto: `--db-url` figura solo en su lista de denegación.
    expect(read('tools/db.mjs')).toMatch(/REMOTE_FLAGS = \[[^\]]*'--db-url'/);
  });

  it('ningún fichero de entorno está versionado: el paquete de aceptación no puede llevarlo', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((file) => /(^|\/)\.env(\.|$)/.test(file));
    expect(tracked.every((file) => file.endsWith('.example'))).toBe(true);
  });

  it('secret-scan vigila las cadenas de conexión con contraseña embebida', () => {
    expect(read('tools/guards/secret-scan.mjs')).toContain(
      "name: 'cadena de conexión con contraseña'",
    );
  });
});
