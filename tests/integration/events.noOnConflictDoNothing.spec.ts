import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { one, query } from '../support/sql';

/**
 * `events.noOnConflictDoNothing.spec` · ADR-008 punto 7.
 *
 * Ningún `ON CONFLICT DO NOTHING` después de asignar la posición: en el repositorio y en el
 * catálogo real (el cuerpo desplegado de cada función de `ingest`). El único `ON CONFLICT`
 * de la función de evidencia es el `DO UPDATE` del estado de sincronización, que no toca
 * ningún contador. Tampoco existe secuencia global ni `nextval` (SD-015 superseded).
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('ADR-008 punto 7 · sin ON CONFLICT DO NOTHING tras asignar posición', () => {
  it('en el repositorio: ninguna migración de Phase 2 contiene la cláusula', () => {
    const dir = join(REPO_ROOT, 'supabase/migrations');
    for (const name of readdirSync(dir).filter((n) => /^000000000000(15|16|17|18)_/.test(n))) {
      const sql = readFileSync(join(dir, name), 'utf8').toLowerCase().replace(/--[^\n]*/g, '');
      expect(sql, name).not.toMatch(/on\s+conflict[^;]*?do\s+nothing/);
      expect(sql, name).not.toContain('create sequence');
      expect(sql, name).not.toContain('nextval');
    }
  });

  it('en el catálogo real: ninguna función de ingest desplegada contiene la cláusula', () => {
    const bodies = query<{ name: string; src: string }>(
      "select p.proname as name, lower(p.prosrc) as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'ingest'",
    );
    expect(bodies.length).toBeGreaterThanOrEqual(10);
    for (const fn of bodies) {
      expect(fn.src, fn.name).not.toMatch(/on\s+conflict[^;]*?do\s+nothing/);
      expect(fn.src, fn.name).not.toContain('nextval');
    }
    const append = bodies.find((b) => b.name === 'append_learning_event');
    expect(append?.src).toContain('on conflict (user_id, device_id) do update');
  });

  it('la posición solo la asigna el contador bloqueado: ninguna secuencia en public, content ni ingest', () => {
    const sequences = one<{ n: number }>(
      "select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'S' and n.nspname in ('public','content','ingest')",
    );
    expect(Number(sequences.n)).toBe(0);
    const column = one<{ def: string | null }>(
      "select column_default as def from information_schema.columns where table_schema = 'public' and table_name = 'learning_events' and column_name = 'stream_position'",
    );
    expect(column.def).toBeNull();
  });
});
