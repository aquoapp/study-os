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

/**
 * Tablas de **contenido canónico**: las que se publican por la frontera de ingestión y por
 * eso enlazan su promoción (`promotion_id`, PI-1A-6). Se leen del catálogo, de modo que las
 * unidades de aprendizaje de Phase 2 entran solas y una tabla de contenido nueva queda
 * cubierta sin editar ninguna lista.
 */
const CANONICAL_CONTENT_TABLES = new Set(
  query<{ table: string }>(
    "select table_name as table from information_schema.columns where table_schema = 'public' and column_name = 'promotion_id'",
  )
    .map((row) => row.table)
    // `question_options` no lleva `promotion_id` propio: pertenece a su representación y
    // hereda su promoción (migración 08, SD-021). Es contenido canónico a todos los efectos.
    .concat('question_options'),
);

/** Tablas con propietario: las de `public` con columna `user_id`, más el perfil. */
const OWNED_TABLES = new Set(
  query<{ table: string }>(
    "select table_name as table from information_schema.columns where table_schema = 'public' and column_name = 'user_id'",
  )
    .map((row) => row.table)
    .concat('profiles'),
);

/**
 * Lo único que `authenticated` puede escribir en `public`.
 *
 * Phase 0: su propio perfil. Phase 2: las cuatro tablas de preferencias del aprendiz, y
 * **solo su propia fila** (la política RLS exige `user_id = auth.uid()` en `USING` y en
 * `WITH CHECK`; el aislamiento se prueba fila a fila en `tests/rls`).
 *
 * Deliberadamente ausentes: `study_sessions`, `session_items`, `learning_events`,
 * `question_attempts` y `sync_state`. La evidencia y las sesiones se escriben **solo** por
 * función (CDEM §22 «owner via validated app flow»; H-P2-3). Que aquí aparezca un INSERT
 * sobre cualquiera de ellas significa que se abrió una vía directa de escritura de
 * evidencia, y eso es un fallo duro, no una diferencia de estilo.
 */
const AUTHENTICATED_WRITE_ALLOWLIST: Record<string, string[]> = {
  profiles: ['SELECT', 'UPDATE'],
  learner_settings: ['INSERT', 'SELECT', 'UPDATE'],
  learner_exam_goals: ['INSERT', 'SELECT', 'UPDATE'],
  devices: ['INSERT', 'SELECT', 'UPDATE'],
  diagnostic_runs: ['INSERT', 'SELECT', 'UPDATE'],
};

/**
 * Funciones de `public` que un rol de cliente puede ejecutar.
 *
 * En Phase 0 y 1A: ninguna (`set_updated_at` lo era y la migración 14 lo revocó, D-19).
 * Phase 2 abre exactamente dos, declaradas en `authority-registry.json`
 * (`clientInvokableRpcs`) con su contrato de seguridad: la ingestión de evidencia y el
 * flujo validado de creación de sesión. Ampliar esta lista es un cambio de frontera de
 * seguridad (STOP 12 de la autorización de Phase 2).
 */
const AUTHENTICATED_FUNCTION_ALLOWLIST: string[] = [
  'append_learning_event',
  'create_study_session',
];

/** Privilegios esperados por rol, esquema y tabla. */
function expectedPrivileges(schema: string, table: string, role: string): string[] {
  if (role === 'anon') return [];
  if (role === 'authenticated') {
    if (schema !== 'public') return [];
    // El UPDATE de `profiles` es de columna (display_name, locale), no de tabla: se
    // comprueba aparte con role_column_grants.
    if (table === 'profiles') return ['SELECT'];
    return AUTHENTICATED_WRITE_ALLOWLIST[table] ?? ['SELECT'];
  }
  if (role === 'service_role') {
    // El rol de servicio escribe **contenido canónico** —lo que se publica por la frontera
    // de ingestión, reconocible por su columna `promotion_id`— y el perfil de Phase 0.
    // Sobre el núcleo de aprendiz y sobre la evidencia solo **lee**: los eventos y los
    // intentos los escribe la función de ingestión y nadie más, ni siquiera una herramienta
    // de servidor con la clave de servicio (autorización de Phase 2 §29, «service-role
    // overreach»). Un INSERT del rol de servicio sobre `learning_events` aquí significaría
    // que existe una vía de fabricación de evidencia.
    if (schema !== 'public') return ['SELECT'];
    /*
     * **Actualizado el 2026-09-10 · SD-025 · D-21 cerrada.**
     *
     * `question_concepts` sale del contenido escribible directamente. Sigue siendo contenido
     * canónico —lo publica la frontera de ingestión, que es SECURITY DEFINER y no depende de
     * este grant—, pero la **transición de estado de un mapeo** pasa desde ahora por
     * `ingest.set_question_concept_mapping_status`, que valida, atribuye actor y avanza la
     * generación de atribución. Sin esa frontera, un mapeo podría mutar entre el cálculo
     * incremental y el rebuild y el gate duro de EC-006 se volvería inestable.
     */
    if (table === 'question_concepts') return ['SELECT'];
    return CANONICAL_CONTENT_TABLES.has(table) || table === 'profiles'
      ? ['DELETE', 'INSERT', 'SELECT', 'UPDATE']
      : ['SELECT'];
  }
  throw new Error(`rol inesperado ${role}`);
}

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

  it('existen las tablas de Phase 1A y de Phase 2', () => {
    const names = tables.map((t) => `${t.schema}.${t.table}`);
    for (const expected of [
      // Phase 2 · núcleo de aprendiz, contenido de unidades, sesiones y evidencia.
      'public.learner_settings',
      'public.learner_exam_goals',
      'public.devices',
      'public.sync_state',
      'public.diagnostic_runs',
      'public.learning_units',
      'public.learning_unit_versions',
      'public.study_sessions',
      'public.session_items',
      'public.learning_events',
      'public.question_attempts',
      'public.confidence_scales',
      'ingest.user_event_counters',
      'ingest.user_question_counters',
      // Phase 0 y Phase 1A.
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
      // Phase 3 · SD-025 · frontera de atribución. `engine` no aparece aquí porque este
      // recuento cubre `public`, `content` e `ingest`: el esquema del motor tiene su propia
      // batería en `engine.security.spec`.
      'ingest.attribution_generations',
      'ingest.mapping_transitions',
    ]) {
      expect(names, `falta ${expected}`).toContain(expected);
    }
    // 23 de Phase 1A + 12 de Phase 2 en `public` + 2 contadores + 2 tablas de atribución.
    expect(names).toHaveLength(39);
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

  it('ninguna función de public es ejecutable por roles de cliente (D-19 cerrada)', () => {
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

describe('matriz rol × privilegio derivada del catálogo (SI-1A-4)', () => {
  const tables = query<{ schema: string; table: string; forced: boolean }>(
    'select n.nspname as schema, c.relname as table, c.relforcerowsecurity as forced from pg_class c join pg_namespace n on n.oid = c.relnamespace ' +
      "where c.relkind = 'r' and n.nspname in ('public','content','ingest') order by 1, 2",
  );
  const grants = query<{ schema: string; table: string; grantee: string; privilege: string }>(
    'select table_schema as schema, table_name as table, grantee, privilege_type as privilege from information_schema.role_table_grants ' +
      "where table_schema in ('public','content','ingest') and grantee in ('anon','authenticated','service_role') order by 1, 2, 3, 4",
  );

  for (const row of tables) {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      it(`${row.schema}.${row.table} × ${role}`, () => {
        const actual = grants
          .filter((g) => g.schema === row.schema && g.table === row.table && g.grantee === role)
          .map((g) => g.privilege)
          .sort();
        expect(actual).toEqual(expectedPrivileges(row.schema, row.table, role));
        expect(row.forced).toBe(true);
      });
    }
  }

  it('authenticated solo puede actualizar dos columnas de su perfil (Phase 0)', () => {
    // Las tablas de preferencias de Phase 2 llevan su INSERT/UPDATE a nivel de TABLA, y por
    // eso aparecen aquí con una fila por columna: eso es la concesión de tabla, no una
    // concesión de columna. La restricción por columnas sigue siendo exclusiva del perfil,
    // que es lo que esta prueba vigila desde Phase 0.
    const columns = query<{ table: string; column: string; privilege: string }>(
      "select table_name as table, column_name as column, privilege_type as privilege from information_schema.role_column_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type <> 'SELECT' order by 1, 2, 3",
    );
    const perfil = columns.filter((row) => row.table === 'profiles');
    expect(perfil).toEqual([
      { table: 'profiles', column: 'display_name', privilege: 'UPDATE' },
      { table: 'profiles', column: 'locale', privilege: 'UPDATE' },
    ]);
    // Y fuera del perfil no hay más escritura que la declarada en la allowlist.
    const fuera = [
      ...new Set(columns.filter((row) => row.table !== 'profiles').map((row) => row.table)),
    ].sort();
    expect(fuera).toEqual(['devices', 'diagnostic_runs', 'learner_exam_goals', 'learner_settings']);
  });

  it('los privilegios por defecto de postgres en public no conceden nada a ningún rol de la API', () => {
    const defaults = query<{ objtype: string; acl: string }>(
      'select d.defaclobjtype as objtype, d.defaclacl::text as acl from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace join pg_roles r on r.oid = d.defaclrole ' +
        "where n.nspname = 'public' and r.rolname = 'postgres'",
    );
    for (const row of defaults) {
      expect(row.acl, `${row.objtype}: ${row.acl}`).not.toMatch(
        /\b(anon|authenticated|service_role)=/,
      );
    }
  });

  it('toda política de una tabla con propietario exige auth.uid() en lectura y en escritura', () => {
    // Dirigido por el catálogo: «tabla con propietario» = tabla de `public` con columna
    // `user_id` (más `profiles`, cuyo propietario es su propia clave). No hay lista a mano
    // que olvidar: una tabla de usuario nueva sin `auth.uid()` en su política rompe aquí.
    const owned = new Set(
      query<{ table: string }>(
        "select table_name as table from information_schema.columns where table_schema = 'public' and column_name = 'user_id'",
      )
        .map((r) => r.table)
        .concat('profiles'),
    );
    const policies = query<{
      table: string;
      name: string;
      cmd: string;
      qual: string | null;
      with_check: string | null;
    }>(
      "select tablename as table, policyname as name, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2",
    );
    expect(owned.size).toBeGreaterThanOrEqual(10);
    const offending = policies
      .filter((p) => owned.has(p.table))
      .filter((p) => !`${p.qual ?? ''}${p.with_check ?? ''}`.includes('auth.uid()'))
      .map((p) => `${p.table}.${p.name} (${p.cmd})`);
    expect(offending).toEqual([]);

    // Y ninguna tabla con propietario concede DELETE a un rol de cliente: la evidencia y
    // las preferencias solo desaparecen con la cuenta (CDEM §24).
    const deletes = policies.filter((p) => owned.has(p.table) && p.cmd === 'DELETE');
    expect(deletes).toEqual([]);
  });

  it('ninguna función SECURITY DEFINER de public, content o ingest carece de search_path', () => {
    // La lista nominal de la frontera de Phase 1A ya se comprueba arriba; esta es la
    // propiedad global, que cubre también las funciones nuevas de Phase 2.
    const fns = query<{ name: string; config: string | null }>(
      "select n.nspname || '.' || p.proname as name, p.proconfig::text as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','content','ingest') and p.prosecdef",
    );
    expect(fns.length).toBeGreaterThanOrEqual(10);
    const sinSearchPath = fns
      .filter((f) => !/search_path=/.test(f.config ?? ''))
      .map((f) => f.name);
    expect(sinSearchPath).toEqual([]);
  });

  it('toda política de public es permisiva de SELECT para authenticated, salvo el perfil propio y las preferencias; solo sources y la escala de confianza leen sin condición', () => {
    const policies = query<{
      table: string;
      name: string;
      cmd: string;
      roles: string;
      qual: string;
      permissive: string;
    }>(
      "select tablename as table, policyname as name, cmd, roles::text as roles, qual, permissive from pg_policies where schemaname = 'public' order by 1, 2",
    );
    expect(policies.length).toBeGreaterThanOrEqual(21);
    for (const p of policies) {
      expect(p.roles, p.name).toBe('{authenticated}');
      expect(p.permissive, p.name).toBe('PERMISSIVE');
      if (OWNED_TABLES.has(p.table)) {
        // Tablas con propietario: SELECT siempre, y escritura solo donde la allowlist la
        // declara. Ninguna admite DELETE (la evidencia se va con la cuenta, CDEM §24).
        const allowed = AUTHENTICATED_WRITE_ALLOWLIST[p.table] ?? ['SELECT'];
        expect(allowed, `${p.name}: ${p.cmd} no está en la allowlist de ${p.table}`).toContain(
          p.cmd,
        );
        expect(p.cmd, p.name).not.toBe('DELETE');
      } else {
        // Contenido canónico y referencia: solo lectura para el cliente.
        expect(p.cmd, p.name).toBe('SELECT');
      }
    }
    // Lo que se lee sin condición alguna: el catálogo de fuentes (Phase 1A) y la escala de
    // confianza (Phase 2), que el aprendiz necesita para pintar los cuatro niveles. Ninguna
    // de las dos contiene material de corrección.
    const unconditional = policies
      .filter((p) => p.qual === 'true')
      .map((p) => p.name)
      .sort();
    expect(unconditional).toEqual([
      'confidence_scales_select_authenticated',
      'sources_select_authenticated',
    ]);
  });
});

describe('sin marcadores de corrección en el esquema expuesto (SI-1A-5)', () => {
  it('ninguna tabla de contenido de public lleva columna de clave ni de corrección', () => {
    // La regla se aplica al **contenido**: una columna de corrección en una tabla que el
    // aprendiz lee antes de responder sería la fuga que INV-101 prohíbe. La evidencia
    // propia es otra cosa: el resultado del intento de uno mismo, después de enviarlo.
    const columns = query<{ table: string; column: string }>(
      'select table_name as table, column_name as column from information_schema.columns ' +
        "where table_schema = 'public' and column_name ~* '(correct|answer_key|is_right|solution|score_key)' " +
        "and table_name not in (select table_name from information_schema.columns where table_schema = 'public' and column_name = 'user_id')",
    );
    expect(columns).toEqual([]);
  });

  it('la evidencia propia lleva el resultado y la versión de clave, y nunca la clave', () => {
    // CDEM §12 y EC-007 exigen que el intento conserve la versión de clave con la que se
    // evaluó y su corrección en el envío. Ninguna de las dos revela la respuesta correcta:
    // `answer_key_version_id` es una referencia opaca a una fila de `content`, que el
    // cliente no puede leer, e `is_correct_at_submission` es el resultado propio.
    const columns = query<{ column: string }>(
      "select column_name as column from information_schema.columns where table_schema = 'public' and table_name = 'question_attempts' and column_name ~* '(correct|answer_key|solution)' order by 1",
    );
    expect(columns.map((c) => c.column)).toEqual([
      'answer_key_version_id',
      'is_correct_at_submission',
    ]);
    // Lo que no puede existir en el esquema expuesto es la opción correcta ni la explicación.
    const leaked = query<{ table: string; column: string }>(
      "select table_name as table, column_name as column from information_schema.columns where table_schema = 'public' and column_name in ('correct_option_id','correct_option_key','explanation','answer_key')",
    );
    expect(leaked).toEqual([]);
  });

  it('ningún comentario de un objeto de public nombra un esquema no expuesto', () => {
    // PostgREST publica los comentarios como descripciones del OpenAPI. Un comentario que
    // diga «lo escribe ingest.append_learning_event» filtra la topología interna por el
    // mismo canal que ADR-011 cierra para las tablas. Se vigila con el catálogo porque la
    // fuga entra por prosa, que es justo donde nadie mira.
    const comments = query<{ objeto: string; comentario: string }>(
      "select n.nspname || '.' || c.relname as objeto, obj_description(c.oid, 'pg_class') as comentario " +
        'from pg_class c join pg_namespace n on n.oid = c.relnamespace ' +
        "where n.nspname = 'public' and c.relkind in ('r','v') and obj_description(c.oid, 'pg_class') is not null " +
        'union all ' +
        "select n.nspname || '.' || t.typname, obj_description(t.oid, 'pg_type') from pg_type t " +
        "join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e' " +
        "and obj_description(t.oid, 'pg_type') is not null",
    );
    expect(comments.length).toBeGreaterThan(10);
    const offenders = comments
      .filter((row) => /\b(content|ingest)\.[a-z_]/i.test(row.comentario))
      .map((row) => `${row.objeto}: ${row.comentario.slice(0, 90)}`);
    expect(offenders).toEqual([]);
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
    // Solo contenido canónico y referencia: las tablas con propietario tienen su propio
    // contrato (fila propia) y se comprueban en la matriz de políticas de más arriba.
    const owned = [...OWNED_TABLES].map((t) => `'${t}'`).join(',');
    const policies = query<{ table: string; cmd: string }>(
      `select tablename as table, cmd from pg_policies where schemaname = 'public' and tablename not in (${owned}) and cmd <> 'SELECT'`,
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
