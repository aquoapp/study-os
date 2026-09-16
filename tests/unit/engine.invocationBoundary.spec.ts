import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `engine.invocationBoundary.spec` · Phase 3.1 · D-26 · la forma de la frontera corregida.
 *
 * La ejecución real la prueban `engine.runtime.spec` (módulo de servidor contra PostgREST) y
 * `engine.runtime.e2e` (aplicación construida). Aquí se vigila, sin base de datos, que la forma
 * no vuelva a degradarse: ningún acceso a esquemas privados desde la aplicación, y cada punto
 * de entrada del motor declarado en la migración, en el registro y solo para el rol de servicio.
 */

const read = (relativePath: string) => readFileSync(join(REPO_ROOT, relativePath), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

const MIGRATION = 'supabase/migrations/00000000000021_engine_invocation_boundary.sql';
const DOWN = 'supabase/migrations/down/00000000000021_engine_invocation_boundary.down.sql';

const WRAPPERS: Record<string, string> = {
  engine_active_config_version: '',
  engine_evidence_snapshot: 'uuid',
  engine_attribution_snapshot: 'uuid',
  engine_recalculate_mastery: 'uuid, bigint, jsonb, text',
  engine_rebuild_projections: 'uuid, jsonb, text',
  engine_stale_users: 'text, integer',
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(REPO_ROOT, dir))) {
    const path = join(dir, name);
    if (statSync(join(REPO_ROOT, path)).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(relative(REPO_ROOT, join(REPO_ROOT, path)));
  }
  return out;
}

describe('D-26 · la aplicación nunca pide un esquema privado al Data API', () => {
  it('ningún fichero de apps/web usa `.schema(`', () => {
    // Es exactamente la llamada que `phase-3-v1.0` hacía y que PostgREST rechaza con PGRST106.
    const offenders = sourceFiles('apps/web/src').filter((file) =>
      /\.schema\s*\(/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it('el runtime del motor usa solo los puntos de entrada declarados', () => {
    const run = read('apps/web/src/server/engine/run.ts');
    const schedule = read('apps/web/src/server/engine/schedule.ts');
    const declared = [...run.matchAll(/:\s*'(engine_[a-z_]+)'/g)].map((match) => match[1]);
    expect(declared.sort()).toEqual(Object.keys(WRAPPERS).sort());
    // Toda llamada RPC del motor pasa por la constante, no por un literal suelto.
    for (const source of [run, schedule]) {
      expect(source).not.toMatch(/\.rpc\(\s*'/);
    }
  });
});

describe('D-26 · la migración 21 es solo frontera, solo rol de servicio y reversible', () => {
  // Se comparan las sentencias, no los comentarios: la cabecera explica qué NO se crea.
  const statements = (path: string) =>
    flat(
      read(path)
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n'),
    ).toLowerCase();
  const sql = statements(MIGRATION);
  const down = statements(DOWN);

  for (const [name, args] of Object.entries(WRAPPERS)) {
    describe(`public.${name}(${args})`, () => {
      it('existe, es SECURITY INVOKER y fija un search_path vacío', () => {
        const start = sql.indexOf(`create or replace function public.${name}(`);
        expect(start, 'la función no se crea').toBeGreaterThanOrEqual(0);
        const body = sql.slice(start, sql.indexOf('$$;', start));
        expect(body).toContain('security invoker');
        expect(body).not.toContain('security definer');
        expect(body).toContain("set search_path = ''");
      });

      it('revoca a public, anon y authenticated y concede solo al rol de servicio', () => {
        expect(sql).toContain(
          `revoke all on function public.${name}(${args}) from public, anon, authenticated;`,
        );
        expect(sql).toContain(`grant execute on function public.${name}(${args}) to service_role;`);
        const grants = [
          ...sql.matchAll(
            new RegExp(
              `grant [a-z, ]+ on function public\\.${name}\\([^)]*\\) to ([a-z_, ]+);`,
              'g',
            ),
          ),
        ].map((match) => match[1]);
        expect(grants).toEqual(['service_role']);
      });

      it('el rollback la retira', () => {
        expect(down).toContain(`drop function if exists public.${name}(${args});`);
      });

      it('está registrada como RPC reservada de servidor, anclada en D-26', () => {
        const registry = JSON.parse(read('packages/domain/src/authority-registry.json')) as {
          rpcs: { names: string[]; anchors: Record<string, string> };
          clientInvokableRpcs: { names: string[] };
          readOnlyRpcs: { names: string[] };
        };
        expect(registry.rpcs.names).toContain(name);
        expect(registry.rpcs.anchors[name]).toMatch(/^D-26 · Phase 3\.1/);
        expect(registry.clientInvokableRpcs.names).not.toContain(name);
        expect(registry.readOnlyRpcs.names).not.toContain(name);
      });
    });
  }

  it('no crea tablas, tipos, esquemas ni ningún sustrato de Phase 4', () => {
    expect(sql).not.toMatch(/create\s+(table|type|schema|index|view|trigger)\b/);
    expect(sql).not.toMatch(/alter\s+(table|schema|type)\b/);
    for (const forbidden of ['planner', 'readiness', 'today_override', 'timezone', 'score']) {
      expect(sql).not.toContain(forbidden);
    }
    // Ningún grant a roles de cliente sobre esquemas privados ni cambio de exposición.
    expect(sql).not.toMatch(/grant [^;]* to (anon|authenticated)/);
    expect(sql).not.toMatch(/on schema (engine|ingest|content)/);
  });

  it('la lista de exposición del Data API no cambia', () => {
    const registry = JSON.parse(read('packages/domain/src/authority-registry.json')) as {
      dataApi: { exposedSchemas: string[]; nonExposedSchemas: string[] };
    };
    expect(registry.dataApi.exposedSchemas).toEqual(['public']);
    expect(registry.dataApi.nonExposedSchemas).toEqual(['content', 'ingest', 'engine']);
    expect(read('supabase/config.toml')).toMatch(/^schemas = \["public"\]$/m);
  });
});

describe('D-26 · la ruta B tiene un llamador real y no cambia HOY', () => {
  const hoy = read('apps/web/src/app/hoy/page.tsx');

  it('HOY recupera la proyección del aprendiz verificado, después de verificarlo', () => {
    const verified = hoy.indexOf("if (!identity) redirect('/entrar?siguiente=/hoy');");
    const recovery = hoy.indexOf('recoverProjectionOnReturn(identity.userId);');
    expect(verified).toBeGreaterThanOrEqual(0);
    expect(recovery).toBeGreaterThan(verified);
    // Una sola llamada, y ningún otro uso del motor en la pantalla.
    expect(hoy.match(/recoverProjectionOnReturn\(/g)).toHaveLength(1);
    expect(hoy).not.toMatch(/runEngineForUser|scheduleProjection|recoverStaleProjections/);
  });

  it('la recuperación no espera al motor ni devuelve nada a la pantalla', () => {
    const schedule = flat(read('apps/web/src/server/engine/schedule.ts'));
    expect(schedule).toContain('export function recoverProjectionOnReturn(userId: string): void {');
    expect(schedule).toMatch(
      /recoverProjectionOnReturn\(userId: string\): void \{ after\(async \(\) => \{ try \{ await runEngineForUser\(userId\);/,
    );
  });
});
