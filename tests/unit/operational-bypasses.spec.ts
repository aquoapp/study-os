import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `operational-bypasses.spec` · los bypasses se ejecutan de verdad.
 *
 * ---------------------------------------------------------------------------
 * Por qué se invocan los comandos reales
 *
 * Comprobar que el código fuente «contiene la comprobación» no demuestra que la
 * comprobación funcione: una condición mal escrita sigue estando presente en el
 * fichero. Aquí se ejecutan los bypasses tal como los escribiría alguien que
 * quisiera saltarse el control, y se exige que el comando termine en rojo.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

/**
 * Quita comentarios antes de buscar patrones prohibidos.
 *
 * Sin esto, la prosa que **explica** por qué algo está prohibido cuenta como
 * infracción, y la única salida sería dejar de documentarlo.
 */
const code = (relative: string) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

interface Run {
  readonly exitCode: number;
  readonly output: string;
}

function runNode(args: string[], env: Record<string, string | undefined> = {}): Run {
  try {
    const output = execFileSync(process.execPath, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, output };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { exitCode: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const DB = join(REPO_ROOT, 'tools', 'db.mjs');

describe('db:reset · el destino solo puede ser local', () => {
  const bypasses: Array<[string, string[]]> = [
    ['--db-url', ['reset', '--db-url', 'postgresql://u:p@remoto.supabase.co:5432/postgres']],
    ['--db-url con =', ['reset', '--db-url=postgresql://u:p@remoto.supabase.co:5432/postgres']],
    ['--linked', ['reset', '--linked']],
    ['--project-ref', ['reset', '--project-ref', 'abcdefghijklmnop']],
    ['argumentos tras --', ['reset', '--', '--db-url=postgresql://u:p@remoto.co/db']],
    ['cadena de conexión suelta', ['reset', 'postgresql://u:p@remoto.co/db']],
  ];

  for (const [name, args] of bypasses) {
    it(`rechaza ${name}`, () => {
      const result = runNode([DB, ...args], { NEXT_PUBLIC_ENVIRONMENT: 'local' });
      expect(result.exitCode, result.output).toBe(1);
      expect(result.output).toMatch(
        /solo puede ejecutarse contra la instancia local|cadena de conexión/,
      );
    });
  }

  it('`--local` forma parte del comando y no se puede quitar', () => {
    const source = read('tools/db.mjs');
    expect(source).toContain("args: ['db', 'reset', '--local']");
  });

  it('no filtra ni corrige el argumento: rechaza la invocación entera', () => {
    // Corregir en silencio deja creer que se ejecutó lo que se pidió.
    const source = read('tools/db.mjs');
    expect(source).toContain('la invocación se rechaza entera');
  });

  it('sigue denegando producción, con destino local o sin él', () => {
    const result = runNode([DB, 'reset'], { NEXT_PUBLIC_ENVIRONMENT: 'production' });
    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('prohibida en "production"');
  });
});

describe('schema-drift · estrictamente de solo lectura', () => {
  const LOCK = join(REPO_ROOT, 'supabase', 'migrations', '.lock.json');
  const BACKUP = join(tmpdir(), 'study-os-lock-backup.json');
  const DRIFT = join(REPO_ROOT, 'tools', 'guards', 'schema-drift.mjs');

  it('falla si falta el registro de huellas, y NO lo genera', () => {
    expect(existsSync(LOCK), 'el lock debería existir antes de la prueba').toBe(true);
    copyFileSync(LOCK, BACKUP);
    rmSync(LOCK);

    try {
      // Esta prueba mide el nivel A de la guarda —el registro de huellas—, no el
      // nivel B. Con `SUPABASE_DB_URL` heredada del entorno (CI, o un desarrollador
      // con staging cargado) la guarda intentaría un `db diff` real, que tarda
      // minutos en fallar sin base ni Docker y convierte esta prueba en un timeout.
      // Se vacía a propósito: el nivel B tiene su propio check, `schema-drift`.
      const result = runNode([DRIFT], { SUPABASE_DB_URL: '' });

      expect(result.exitCode, result.output).toBe(1);
      expect(result.output).toContain('No existe supabase/migrations/.lock.json');
      // Lo importante: no se ha auto-otorgado la línea base.
      expect(existsSync(LOCK), 'el check ha creado el lock: ya no es de solo lectura').toBe(false);
    } finally {
      copyFileSync(BACKUP, LOCK);
      rmSync(BACKUP, { force: true });
    }
  });

  it('el check no escribe en ningún caso', () => {
    const source = read('tools/guards/schema-drift.mjs');
    expect(source).not.toContain('writeFileSync');
    expect(source).toContain('estrictamente de solo lectura');
  });

  it('la generación del lock es un comando aparte y explícito', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['schema-drift:lock']).toBe('node tools/guards/schema-drift-lock.mjs');
    expect(pkg.scripts['schema-drift']).toBe('node tools/guards/schema-drift.mjs');
  });

  it('el generador muestra el diff antes de escribir', () => {
    const source = read('tools/guards/schema-drift-lock.mjs');
    expect(source).toContain('Revisa el diff antes de confirmarlo');
    expect(source).toContain('exige aprobación');
  });

  it('detecta una migración que no está en el registro', () => {
    const lock = JSON.parse(read('supabase/migrations/.lock.json')) as {
      migrations: Record<string, string>;
    };
    // El registro cubre exactamente las migraciones del árbol, y las tres de Phase 0
    // siguen ahí con su nombre original: ninguna se renombra ni desaparece.
    const onDisk = readdirSync(join(REPO_ROOT, 'supabase', 'migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    expect(Object.keys(lock.migrations).sort()).toEqual(onDisk);
    for (const phase0 of [
      '00000000000000_init.sql',
      '00000000000001_profiles.sql',
      '00000000000002_profiles_service_role.sql',
    ]) {
      expect(Object.keys(lock.migrations)).toContain(phase0);
    }
    expect(read('tools/guards/schema-drift.mjs')).toContain('no está en el registro de huellas');
  });
});

describe('E2E · las dos suites están separadas', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it('hay una suite estática y una de auth, con configuraciones distintas', () => {
    expect(pkg.scripts['test:e2e:static']).toContain('playwright.static.config.ts');
    expect(pkg.scripts['test:e2e:auth']).toContain('playwright.auth.config.ts');
  });

  it('la suite estática no tiene setup ni teardown: no hay nada que autorizar ni limpiar', () => {
    const config = code('playwright.static.config.ts');
    expect(config).toContain("testDir: './tests/e2e/static'");
    expect(config).not.toContain('globalSetup');
    expect(config).not.toContain('globalTeardown');
  });

  it('la suite de auth tiene ambos', () => {
    const config = read('playwright.auth.config.ts');
    expect(config).toContain("testDir: './tests/e2e/auth'");
    expect(config).toContain("globalSetup: './tests/e2e/auth/global-setup.ts'");
    expect(config).toContain("globalTeardown: './tests/e2e/auth/global-teardown.ts'");
  });

  it('los ficheros están donde dicen las configuraciones', () => {
    for (const file of [
      'tests/e2e/static/app.boot.e2e.ts',
      'tests/e2e/static/pwa.manifest.spec.ts',
      'tests/e2e/static/accessibility.a11y.spec.ts',
      'tests/e2e/auth/auth.signup-login.e2e.ts',
      'tests/e2e/auth/auth.forgedCookieRejected.e2e.ts',
    ]) {
      expect(() => read(file), `${file} no existe`).not.toThrow();
    }
  });
});

describe('E2E de auth · la limpieza es obligatoria', () => {
  const setup = read('tests/e2e/auth/global-setup.ts');
  const teardown = read('tests/e2e/auth/global-teardown.ts');

  it('exige credenciales de limpieza ANTES de crear ningún usuario', () => {
    expect(setup).toContain('NO se ejecutan sin credenciales de limpieza');
    expect(setup).toContain("process.env['SUPABASE_SERVICE_ROLE_KEY']");
  });

  it('comprueba que la credencial funciona, no solo que está', () => {
    // Una clave inválida deja los mismos usuarios huérfanos que ninguna clave.
    expect(setup).toContain('Las credenciales de limpieza no funcionan');
    expect(setup).toContain('listUsers');
  });

  it('censa los usuarios previos para poder distinguir lo que crea la ejecución', () => {
    expect(setup).toContain('preexisting');
  });

  it('el teardown ya no tiene el camino `console.warn` + `return`', () => {
    const teardownCode = code('tests/e2e/auth/global-teardown.ts');
    expect(teardownCode).not.toContain('console.warn');
    expect(teardown).not.toMatch(/console\.warn[\s\S]*return;/);
  });

  it('falla si la limpieza falla', () => {
    expect(teardown).toContain('La limpieza de usuarios E2E falló');
    expect(teardown).toContain('throw new Error');
  });

  it('falla si queda algún usuario de ESTA ejecución después de limpiar', () => {
    expect(teardown).toContain('La limpieza dejó');
    expect(teardown).toContain('isEmailOfRun(user.email, runId)');
  });

  it('falla si la suite corrió sin que el setup se completara', () => {
    // El marcador pasó a ser propio de cada ejecución, así que lo primero que se
    // comprueba es que exista el identificador que lo nombra.
    expect(teardown).toContain('No hay identificador de ejecución');
    expect(teardown).toContain('No existe el marcador de la ejecución');
  });

  it('la verificación posterior vuelve a listar, no se fía del borrado', () => {
    expect(teardown).toContain('const remaining = (await listAllUsers(directory))');
  });
});
