import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `phase3.build.spec` · alcance del BUILD de Phase 3.
 *
 * El motor se construye **por debajo del producto**: ninguna superficie de aprendiz cambia,
 * el FPS congelado no se rediseña y no aparece ninguna pantalla de dominio. Lo que sí debe
 * existir es la doble ruta de invocación —no bloqueante y recuperable—, porque sin la segunda
 * una invocación perdida dejaría una proyección atrasada para siempre.
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

describe('§21 · el FPS congelado no se rediseña', () => {
  const actions = read('apps/web/src/app/actions/fps.ts');

  it('el único cambio en las acciones del FPS es la invocación no bloqueante', () => {
    expect(actions).toContain('scheduleProjection(identity.userId)');
    // Y no se espera a que termine: la respuesta al aprendiz no depende de la proyección.
    expect(actions).not.toContain('await scheduleProjection');
    expect(actions).not.toContain('await runEngineForUser');
  });

  it('ninguna superficie de aprendiz nombra el estado derivado', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? entry.name === 'engine'
            ? [] // el directorio de servidor del motor no es superficie de aprendiz
            : walk(join(dir, entry.name))
          : /\.(ts|tsx)$/.test(entry.name)
            ? [join(dir, entry.name)]
            : [],
      );
    const offenders: string[] = [];
    for (const file of walk(join(REPO_ROOT, 'apps', 'web', 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const forbidden of [
        'concept_mastery',
        'mastery_state',
        'EVIDENCE_POSITIVE',
        'Dominado',
        'Frágil',
        'Repaso pendiente',
        'error_pattern',
      ]) {
        if (source.includes(forbidden))
          offenders.push(`${file.replace(REPO_ROOT, '')} · ${forbidden}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('las rutas siguen siendo las cuatro del FPS más las de Phase 0', () => {
    const routes = readdirSync(join(REPO_ROOT, 'apps', 'web', 'src', 'app'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .sort();
    expect(routes).toEqual([
      'actions',
      'aprender',
      'comprobar',
      'cuenta',
      'entrar',
      'fin',
      'hoy',
      'offline',
      'onboarding',
      'registro',
    ]);
  });
});

describe('§18 · la invocación tiene dos rutas, y la segunda no es opcional', () => {
  const schedule = read('apps/web/src/server/engine/schedule.ts');

  it('la ruta normal no bloquea y no propaga su fallo', () => {
    expect(schedule).toContain('export function scheduleProjection');
    expect(flat(schedule)).toContain('void runEngineForUser(userId).catch(');
  });

  it('la ruta de recuperación existe y se apoya solo en evidencia y watermark', () => {
    expect(schedule).toContain('export async function recoverStaleProjections');
    expect(schedule).toContain("rpc('stale_users'");
    expect(flat(schedule)).toContain('la durabilidad de la evidencia no depende del éxito');
  });

  it('un fallo de un aprendiz no detiene el barrido de los demás', () => {
    expect(flat(schedule)).toContain('Un aprendiz que falla no detiene a los demás');
  });

  it('el cliente del motor no lanza hacia fuera si falta configuración de servidor', () => {
    const admin = read('apps/web/src/server/engine/admin.ts');
    expect(admin).toContain("import 'server-only'");
    expect(admin).toContain('export function tryCreateEngineClient');
    expect(admin).toContain('return null');
  });

  it('todo el runtime del motor es de servidor', () => {
    for (const file of ['admin.ts', 'run.ts', 'schedule.ts']) {
      const source = read(`apps/web/src/server/engine/${file}`);
      expect(source.startsWith("import 'server-only';"), `${file} no es server-only`).toBe(true);
    }
  });
});

describe('las dos migraciones autorizadas están completas y son reversibles', () => {
  it('cada migración de Phase 3 tiene su script de reversión', () => {
    for (const name of ['00000000000019_attribution_boundary', '00000000000020_engine_core']) {
      expect(existsSync(join(REPO_ROOT, 'supabase', 'migrations', `${name}.sql`))).toBe(true);
      expect(
        existsSync(join(REPO_ROOT, 'supabase', 'migrations', 'down', `${name}.down.sql`)),
        `falta el rollback de ${name}`,
      ).toBe(true);
    }
  });

  it('el rollback devuelve al rol de servicio lo que D-21 le quitó', () => {
    const down = read('supabase/migrations/down/00000000000019_attribution_boundary.down.sql');
    expect(down).toContain(
      'grant insert, update, delete on public.question_concepts to service_role',
    );
  });

  it('la reversión del motor no toca la evidencia', () => {
    const down = read('supabase/migrations/down/00000000000020_engine_core.down.sql');
    for (const evidence of ['learning_events', 'question_attempts', 'study_sessions']) {
      expect(down, `el rollback toca ${evidence}`).not.toContain(evidence);
    }
    expect(down).toContain('drop schema if exists engine');
  });
});

describe('el motor no necesita red ni IA', () => {
  it('ninguna dependencia nueva entró con Phase 3', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const forbidden of [
      'bullmq',
      'ioredis',
      'kafkajs',
      'openai',
      '@anthropic-ai/sdk',
      'pg-boss',
    ]) {
      expect(Object.keys(all), `dependencia no autorizada: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('el paquete del motor solo depende del dominio', () => {
    const engine = JSON.parse(read('packages/learning-engine/package.json')) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(engine.dependencies ?? {})).toEqual([]);
  });
});
