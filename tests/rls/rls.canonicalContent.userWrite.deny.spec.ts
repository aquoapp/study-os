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

/**
 * Tablas **de contenido canónico y de referencia**: las de `public` que no tienen
 * propietario, es decir, sin columna `user_id`, y que no son el perfil.
 *
 * La regla se lee del catálogo en lugar de enumerarse, y por eso sigue siendo correcta
 * cuando Phase 2 añade tablas: `learning_units`, `learning_unit_versions` y
 * `confidence_scales` entran aquí solas —contenido y referencia, de lectura para el
 * aprendiz—, mientras que las tablas con propietario (`learner_settings`,
 * `study_sessions`, `learning_events`, `question_attempts`…) quedan fuera y las cubre
 * `rls.userIsolation.phase2.spec`, que prueba el aislamiento entre usuarios.
 */
const tables = query<{ table: string }>(
  "select t.tablename as table from pg_tables t where t.schemaname = 'public' and t.tablename <> 'profiles' " +
    "and not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.tablename and c.column_name = 'user_id') " +
    'order by 1',
).map((row) => row.table);

/**
 * Primera columna de la clave primaria de cada tabla, leída del catálogo. Sirve de sonda
 * neutral para las escrituras: existe siempre y no obliga a suponer nombres de columna.
 */
const PRIMARY_KEYS = new Map(
  query<{ table: string; column: string }>(
    'select c.relname as table, a.attname as column from pg_constraint k ' +
      'join pg_class c on c.oid = k.conrelid ' +
      'join pg_namespace n on n.oid = c.relnamespace ' +
      'join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1] ' +
      "where k.contype = 'p' and n.nspname = 'public'",
  ).map((row) => [row.table, row.column] as const),
);

function primaryKey(table: string): string {
  const column = PRIMARY_KEYS.get(table);
  if (!column) throw new Error(`sin clave primaria en el catálogo: ${table}`);
  return column;
}

/**
 * Valor que no coincide con ninguna fila real. Es un UUID válido —lo aceptan las claves
 * `uuid`— y una cadena cualquiera para las de texto, de modo que el rechazo que llega es
 * el de privilegio y no el de conversión de tipo.
 */
const NEVER_MATCHES = '00000000-0000-4000-8000-000000000000';

beforeAll(async () => {
  env = readTestEnv();
  user = await createTestUser(env, 'canonical-deny');
});

afterAll(async () => {
  if (user) await deleteTestUser(env, user.id);
});

describe('el catálogo aporta las tablas canónicas', () => {
  it('hay al menos las diecinueve de Phase 1A y las de contenido de Phase 2', () => {
    expect(tables.length).toBeGreaterThanOrEqual(22);
    expect(tables).toContain('canonical_questions');
    expect(tables).toContain('exam_occurrences');
    expect(tables).toContain('learning_units');
    expect(tables).toContain('learning_unit_versions');
    expect(tables).toContain('confidence_scales');
    // Y ninguna tabla con propietario se cuela aquí: su contrato es otro.
    for (const owned of [
      'learner_settings',
      'study_sessions',
      'learning_events',
      'question_attempts',
    ]) {
      expect(tables, `${owned} no es contenido canónico`).not.toContain(owned);
    }
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
      // La sonda usa la clave primaria de cada tabla, leída del catálogo: `created_at` no
      // existe en todas (`confidence_scales` lleva `activated_at`), y una sonda que asume
      // una columna acaba probando que la columna no existe en vez de que falta el
      // privilegio. El rechazo debe ser 42501: falta de privilegio, no un accidente.
      const { error } = await user.client
        .from(table)
        .update({ [primaryKey(table)]: NEVER_MATCHES })
        .neq(primaryKey(table), NEVER_MATCHES);
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('authenticated no borra', async () => {
      const { error } = await user.client
        .from(table)
        .delete()
        .neq(primaryKey(table), NEVER_MATCHES);
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
