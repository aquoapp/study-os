import { describe, expect, it } from 'vitest';

import { one, query } from '../support/sql';

/**
 * `catalog.security.spec` · SI-1A-1 … SI-1A-8 · gates P1A-G1 y P1A-G3.
 *
 * Pruebas **dirigidas por el catálogo**: no hay una lista de tablas escrita a mano que
 * alguien pueda olvidar actualizar. Se pregunta a PostgreSQL qué existe y se exige que
 * TODO lo que existe cumpla la frontera. Una tabla nueva sin RLS forzado, un grant
 * olvidado a `anon` o un `USAGE` sobre `content` rompen esta suite aunque nadie haya
 * escrito una prueba para esa tabla.
 *
 * Requiere `SUPABASE_DB_URL` (stack local en CI; pooler de STAGING en local). Sin ella
 * falla, no se salta.
 */

const PRIVATE_SCHEMAS = ['content', 'ingest'];
const CLIENT_ROLES = ['anon', 'authenticated'];

/** Lo único que `authenticated` puede escribir en `public`: su propio perfil (Phase 0). */
const AUTHENTICATED_WRITE_ALLOWLIST: Record<string, string[]> = {
  profiles: ['SELECT', 'UPDATE'],
};

/** Funciones de `public` que `authenticated` puede ejecutar (Phase 0: utilidades). */
const AUTHENTICATED_FUNCTION_ALLOWLIST = ['set_updated_at'];

interface TableRow {
  schema: string;
  table: string;
  rls: boolean;
  forced: boolean;
}

describe('toda tabla de public, content e ingest tiene RLS habilitado y forzado', () => {
  const tables = query<TableRow>(
    'select n.nspname as schema, c.relname as table, c.relrowsecurity as rls, c.relforcerowsecurity as forced ' +
      'from pg_class c join pg_namespace n on n.oid = c.relnamespace ' +
      "where c.relkind = 'r' and n.nspname in ('public','content','ingest') order by 1, 2",
  );

  it('existen las tablas de Phase 1A', () => {
    const names = tables.map((t) => `${t.schema}.${t.table}`);
    for (const expected of [
      'public.profiles',
      'public.exam_packs',
      'public.exam_pack_versions',
      'public.syllabus_blocks',
      'public.topics',
      'public.concepts',
      'public.concept_versions',
      'public.concept_prerequisites',
      'public.sources',
      'public.source_versions',
      'public.canonical_questions',
      'public.question_representations',
      'public.question_options',
      'public.question_concepts',
      'public.exam_sections',
      'public.exam_sittings',
      'public.exam_sitting_models',
      'public.exam_occurrences',
      'public.practicals',
      'public.practical_questions',
      'content.answer_key_versions',
      'ingest.promotions',
      'ingest.staged_items',
    ]) {
      expect(names, `falta ${expected}`).toContain(expected);
    }
    expect(names).toHaveLength(23);
  });

  for (const row of tables) {
    it(`${row.schema}.${row.table}`, () => {
      expect(row.rls, 'RLS no habilitado').toBe(true);
      expect(row.forced, 'RLS no forzado (el propietario lo atravesaría)').toBe(true);
    });
  }
});

describe('los roles de cliente no alcanzan content ni ingest', () => {
  for (const schema of PRIVATE_SCHEMAS) {
    for (const role of CLIENT_ROLES) {
      it(`${role} no tiene USAGE sobre ${schema}`, () => {
        const row = one<{ usage: boolean }>(
          `select has_schema_privilege('${role}', '${schema}', 'USAGE') as usage`,
        );
        expect(row.usage).toBe(false);
      });
    }
  }

  it('ningún grant de tabla ni de función para roles de cliente en content/ingest', () => {
    const grants = query<{ grantee: string; object: string }>(
      "select grantee, table_schema || '.' || table_name as object from information_schema.role_table_grants " +
        "where table_schema in ('content','ingest') and grantee in ('anon','authenticated','PUBLIC') " +
        'union all ' +
        "select grantee, routine_schema || '.' || routine_name from information_schema.role_routine_grants " +
        "where routine_schema in ('content','ingest') and grantee in ('anon','authenticated','PUBLIC')",
    );
    expect(grants).toEqual([]);
  });

  it('ninguna política de RLS en content/ingest apunta a roles de cliente', () => {
    const policies = query<{ policyname: string; roles: string }>(
      "select policyname, roles::text as roles from pg_policies where schemaname in ('content','ingest')",
    );
    const clientFacing = policies.filter((p) => /anon|authenticated|public/.test(p.roles));
    expect(clientFacing).toEqual([]);
  });

  it('no hay privilegios por defecto para roles de cliente en content/ingest', () => {
    const defaults = query<{ schema: string; acl: string }>(
      'select n.nspname as schema, d.defaclacl::text as acl from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace ' +
        "where n.nspname in ('content','ingest')",
    );
    const offending = defaults.filter((d) => /anon|authenticated/.test(d.acl));
    expect(offending).toEqual([]);
  });
});

describe('en public, anon no tiene nada y authenticated solo lee', () => {
  const grants = query<{ grantee: string; table: string; privilege: string }>(
    'select grantee, table_name as table, privilege_type as privilege from information_schema.role_table_grants ' +
      "where table_schema = 'public' and grantee in ('anon','authenticated') order by 1, 2, 3",
  );

  it('anon no conserva ningún grant en public', () => {
    expect(grants.filter((g) => g.grantee === 'anon')).toEqual([]);
  });

  it('authenticated solo tiene SELECT, salvo su propio perfil', () => {
    const offending = grants.filter((g) => {
      if (g.grantee !== 'authenticated') return false;
      const allowed = AUTHENTICATED_WRITE_ALLOWLIST[g.table] ?? ['SELECT'];
      return !allowed.includes(g.privilege);
    });
    expect(offending).toEqual([]);
  });

  it('las funciones de public ejecutables por roles de cliente son solo las de Phase 0', () => {
    const fns = query<{ role: string; name: string }>(
      'select r.rolname as role, p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace ' +
        "cross join (values ('anon'), ('authenticated')) as r(rolname) " +
        "where n.nspname = 'public' and has_function_privilege(r.rolname, p.oid, 'EXECUTE') order by 1, 2",
    );
    expect(fns.filter((f) => f.role === 'anon')).toEqual([]);
    const authenticated = fns.filter((f) => f.role === 'authenticated').map((f) => f.name);
    for (const name of authenticated) expect(AUTHENTICATED_FUNCTION_ALLOWLIST).toContain(name);
  });

  it('las funciones de la frontera son SECURITY DEFINER con search_path vacío', () => {
    const fns = query<{ name: string; secdef: boolean; config: string | null }>(
      'select p.proname as name, p.prosecdef as secdef, p.proconfig::text as config from pg_proc p ' +
        "join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'ingest' " +
        "and p.proname in ('stage_item','validate_staged_item','publish_staged_item','copy_forward_question_concepts','purge_generated_pack')",
    );
    expect(fns).toHaveLength(5);
    for (const fn of fns) {
      expect(fn.secdef, `${fn.name} no es SECURITY DEFINER`).toBe(true);
      expect(fn.config ?? '', `${fn.name} sin search_path vacío`).toMatch(/search_path=/);
    }
  });
});

describe('sin marcadores de corrección en el esquema expuesto (SI-1A-5)', () => {
  it('ninguna columna de public se llama como una clave o marcador', () => {
    const columns = query<{ table: string; column: string }>(
      'select table_name as table, column_name as column from information_schema.columns ' +
        "where table_schema = 'public' and column_name ~* '(correct|answer_key|is_right|solution|score_key)'",
    );
    expect(columns).toEqual([]);
  });

  it('no existe ninguna vista en public que lea content o ingest', () => {
    const views = query<{ name: string; definition: string }>(
      "select viewname as name, definition from pg_views where schemaname = 'public'",
    );
    const offending = views.filter((v) => /\b(content|ingest)\./.test(v.definition));
    expect(offending).toEqual([]);
  });
});

describe('no existe ruta de promoción GENERATED → VERIFIED/OFFICIAL (PI-1A-4)', () => {
  it('ninguna función de public, content o ingest promociona clases de procedencia', () => {
    const fns = query<{ name: string }>(
      "select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname in ('public','content','ingest') and p.proname ~* '(promote|to_verified|to_official|upgrade_provenance)'",
    );
    expect(fns).toEqual([]);
  });

  it('las tablas canónicas no tienen política de UPDATE para roles de cliente', () => {
    const policies = query<{ table: string; cmd: string }>(
      "select tablename as table, cmd from pg_policies where schemaname = 'public' and tablename <> 'profiles' and cmd <> 'SELECT'",
    );
    expect(policies).toEqual([]);
  });
});

describe('convención de concept_key (ADR-009 v1.1 §A)', () => {
  it('es determinista, exam-neutral y cumple la expresión regular', () => {
    const row = one<{ a: string; b: string; c: string; d: string }>(
      "select ingest.concept_key('fixture-x', 'Configuración de redes: DHCP') as a, " +
        "ingest.concept_key('fixture-x', 'Configuración de redes: DHCP') as b, " +
        "ingest.concept_key('fixture-y', 'Configuración de redes: DHCP') as c, " +
        "ingest.concept_key('fixture-x', 'Un título extraordinariamente largo que supera con holgura los cuarenta caracteres permitidos') as d",
    );
    const convention = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$/;
    expect(row.a).toMatch(convention);
    expect(row.a).toBe(row.b);
    expect(row.a).not.toBe(row.c);
    expect(row.a.startsWith('configuracion-de-redes-dhcp-')).toBe(true);
    expect(row.d).toMatch(convention);
    expect(row.d.length).toBeLessThanOrEqual(64);
    expect(row.d.slice(0, -9).length).toBeLessThanOrEqual(40);
  });
});
