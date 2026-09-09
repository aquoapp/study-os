import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { query } from '../support/sql';
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
  type TestUser,
} from '../support/supabase-test-env';

/**
 * `rls.canonicalContent.userWrite.deny.spec` · REQ-B10 · Master §44 · CDEM §22 ·
 * Closure AT-23 · gate P1A-G3.
 *
 * «El usuario normal no muta contenido canónico.» Dirigida por el catálogo: la lista de
 * tablas se lee de PostgreSQL, de modo que una tabla canónica nueva queda cubierta sin
 * que nadie tenga que acordarse. Para cada una, con la instancia real delante:
 *
 *   - `authenticated` puede leer (sin error; puede que sin filas);
 *   - `authenticated` no puede insertar, actualizar ni borrar;
 *   - `anon` no puede leer.
 *
 * **Fallo duro del Checkpoint Contract**: una escritura de usuario en contenido canónico
 * es una brecha de la frontera generado/personal → canónico.
 */

let env: TestEnv;
let user: TestUser;

const tables = query<{ table: string }>(
  "select tablename as table from pg_tables where schemaname = 'public' and tablename <> 'profiles' order by 1",
).map((row) => row.table);

beforeAll(async () => {
  env = readTestEnv();
  user = await createTestUser(env, 'canonical-deny');
});

afterAll(async () => {
  if (user) await deleteTestUser(env, user.id);
});

describe('el catálogo aporta las tablas canónicas', () => {
  it('hay al menos las diecinueve de Phase 1A', () => {
    expect(tables.length).toBeGreaterThanOrEqual(19);
    expect(tables).toContain('canonical_questions');
    expect(tables).toContain('exam_occurrences');
  });
});

for (const table of tables) {
  describe(`public.${table}`, () => {
    it('authenticated lee sin error', async () => {
      const { error } = await user.client.from(table).select('*').limit(1);
      expect(error).toBeNull();
    });

    it('authenticated no inserta', async () => {
      const { error } = await user.client.from(table).insert({});
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('authenticated no actualiza', async () => {
      const { error } = await user.client
        .from(table)
        .update({ created_at: new Date().toISOString() })
        .neq('created_at', '1970-01-01');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('authenticated no borra', async () => {
      const { error } = await user.client.from(table).delete().neq('created_at', '1970-01-01');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('anon no lee', async () => {
      const { data, error } = await anonClient(env).from(table).select('*').limit(1);
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });
}
