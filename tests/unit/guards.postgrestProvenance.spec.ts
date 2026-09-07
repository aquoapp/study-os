import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT, assertCompiles, runGuard, withViolations } from './lib/run-guard';

/**
 * `guards.postgrestProvenance.spec` · de dónde sale una consulta, demostrado.
 *
 * Gate **P0-G5**. La versión anterior sembraba la etiqueta de consulta en **cualquier
 * llamada a un miembro llamado `from`**. Eso fallaba en las dos direcciones a la vez:
 *
 *   · falso positivo · `Array.from(x)` y cualquier objeto local con un método
 *     `from()` quedaban marcados como consulta PostgREST;
 *   · falso negativo · un cliente cuyo `.from` se extraía —con `bind`, con `call`,
 *     por asignación posterior— y se invocaba por otro camino no quedaba marcado,
 *     y el método dinámico sobre la consulta resultante pasaba sin más.
 *
 * ---------------------------------------------------------------------------
 * Tres capacidades encadenadas
 *
 *   `supabase-client` nace SOLO en una llamada a un origen registrado en
 *   `authority-registry.json`, resuelto por **módulo** y por **nombre exportado**.
 *   Ni el nombre local ni la forma de la llamada cuentan.
 *
 *   `postgrest-from` nace al **acceder** a `.from` sobre un valor `supabase-client`.
 *   Es un valor como cualquier otro y viaja como cualquier otro.
 *
 *   `postgrest-query` nace al **invocar** un valor `postgrest-from`, y se conserva
 *   por las operaciones encadenadas de consulta.
 *
 * Y cuando la frontera no permite demostrar el origen —un parámetro `any`, un valor
 * que llega de fuera del fichero— pero la llamada puede llevar una columna o un
 * payload de identidad, se **falla cerrado** diciendo que la procedencia es opaca.
 *
 * Cada fixture compila con el `tsconfig.json` real y ejecuta la guarda como proceso
 * hijo.
 * ---------------------------------------------------------------------------
 */

const server = (lines: string[]) => lines.join('\n');

function fixture(files: Record<string, string>) {
  return withViolations(files, () => {
    assertCompiles(Object.keys(files));
    return runGuard('auth-authority-guard.mjs');
  });
}

const count = (output: string, needle: string) => output.split(needle).length - 1;

/** Las cuatro líneas que abren cualquier fixture con cliente canónico real. */
const CANONICAL_CLIENT = "import { createSupabaseServerClient } from './supabase/server-client';";

describe('Q1 · el cliente canónico y su `.from` extraído', () => {
  it('cliente canónico → `db.from.bind(db)` → consulta → método dinámico con user_id', () => {
    const result = fixture({
      'apps/web/src/server/_pg-bind.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function evade(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        '  const makeQuery = db.from.bind(db);',
        "  const query = makeQuery('profiles');",
        "  return (query as any)[method]('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('sobre una consulta PostgREST');
  });

  it('`.from` extraído por asignación posterior y llamado con `.call()`', () => {
    const result = fixture({
      'apps/web/src/server/_pg-call.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function evade(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        '  let extraido;',
        '  extraido = db.from;',
        "  const query = extraido.call(db, 'profiles');",
        "  return (query as any)[method]('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('sobre una consulta PostgREST');
  });

  it('consulta construida directamente y consulta mediante alias siguen fallando', () => {
    const result = fixture({
      'apps/web/src/server/_pg-direct-alias.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function directa(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  return (db.from('profiles').select() as any)[method]('user_id', raw);",
        '}',
        'export async function porAlias(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const q = db.from('profiles').select();",
        "  return (q as any)[method]('owner_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(count(result.output, 'sobre una consulta PostgREST')).toBe(2);
  });

  it('`.from` viaja también por `apply`, desestructuración, contenedor y retorno', () => {
    const result = fixture({
      'apps/web/src/server/_pg-travel.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function porApply(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        '  const f = db.from;',
        "  const query = f.apply(db, ['profiles']);",
        "  return (query as any)[method]('user_id', raw);",
        '}',
        'export async function porDesestructuracion(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        '  const { from } = db;',
        "  return (from('profiles') as any)[method]('user_id', raw);",
        '}',
        'export async function porContenedor(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        '  const caja = [db.from];',
        '  const sacado = caja.pop();',
        "  return (sacado!('profiles') as any)[method]('user_id', raw);",
        '}',
        'export async function porRetorno(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        '  const dame = () => db.from;',
        "  return (dame()('profiles') as any)[method]('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(count(result.output, 'sobre una consulta PostgREST')).toBe(4);
  });

  it('el origen externo `createServerClient` de `@supabase/ssr` también cuenta', () => {
    const result = fixture({
      'apps/web/src/server/_pg-external.ts': server([
        "import { createServerClient } from '@supabase/ssr';",
        '',
        'export function evade(url: string, key: string, method: string, raw: string) {',
        '  const db = createServerClient(url, key, { cookies: { getAll: () => [], setAll: () => {} } });',
        "  return (db.from('profiles') as any)[method]('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('sobre una consulta PostgREST');
  });

  it('el alias de importación no cambia nada: lo que cuenta es el export', () => {
    const result = fixture({
      'apps/web/src/server/_pg-renamed.ts': server([
        "import { createSupabaseServerClient as construir } from './supabase/server-client';",
        '',
        'export async function evade(method: string, raw: string) {',
        '  const db = await construir();',
        "  return (db.from('profiles') as any)[method]('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('sobre una consulta PostgREST');
  });
});

describe('Q2 · frontera opaca · falla cerrado y lo explica', () => {
  it('un cliente que llega como parámetro no demuestra su origen', () => {
    const result = fixture({
      'apps/web/src/server/_pg-opaque.ts': server([
        'export async function evade(db: any, method: string, raw: string) {',
        "  return db.from('profiles').select()[method]('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('cuya procedencia es opaca');
    expect(result.output).toContain('cliente Supabase registrado');
  });

  it('un payload opaco sobre un receptor opaco también falla cerrado', () => {
    const result = fixture({
      'apps/web/src/server/_pg-opaque-payload.ts': server([
        'export async function evade(db: any, method: string, payload: Record<string, unknown>) {',
        '  return db[method](payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('cuya procedencia es opaca');
  });
});

describe('Q3 · controles positivos · llamarse `from` no es ser una consulta', () => {
  it('el repositorio real pasa la guarda', () => {
    expect(runGuard('auth-authority-guard.mjs').exitCode).toBe(0);
  });

  it('un objeto local con un método `from()` y una propiedad dinámica inocua', () => {
    const result = fixture({
      'apps/web/src/server/_pg-local-from.ts': server([
        'type Fila = { titulo: string };',
        '',
        'const local = {',
        '  from(nombre: string): Fila {',
        '    return { titulo: nombre };',
        '  },',
        '  otro(valor: string): string {',
        '    return valor;',
        '  },',
        '};',
        '',
        'export function ordinario(m: string) {',
        "  const fila = local.from('x');",
        '  const dinamico = local as unknown as Record<string, (v: string) => unknown>;',
        "  return dinamico[m]?.('inocuo') ?? fila;",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('`Array.from()` y un `from` local homónimo no son consultas', () => {
    const result = fixture({
      'apps/web/src/server/_pg-array-from.ts': server([
        'export function desdeArray(valores: Iterable<string>) {',
        '  return Array.from(valores);',
        '}',
        'export function desdeLocal(m: string) {',
        '  const from = (nombre: string) => ({ nombre });',
        '  const caja: Record<string, (v: string) => unknown> = {',
        "    uno: () => from('a'),",
        '  };',
        "  return caja[m]?.('inocuo');",
        '}',
        'export function desdeGlobalHomonimo(fecha: string) {',
        '  return Date.parse(fecha) + Number.parseInt(fecha, 10);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una consulta canónica con identidad verificada sigue pasando', () => {
    const result = fixture({
      'apps/web/src/server/_pg-legit-query.ts': server([
        CANONICAL_CLIENT,
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function leer() {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  const db = await createSupabaseServerClient();',
        "  return db.from('profiles').select().eq('user_id', identity.userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('el registro de orígenes es la única fuente, y nombra módulo y export', () => {
    const registry = JSON.parse(
      readFileSync(join(REPO_ROOT, 'packages/domain/src/authority-registry.json'), 'utf8'),
    ) as {
      supabaseClientOrigins: {
        internal: { module: string; export: string }[];
        external: { module: string; export: string }[];
      };
    };

    const internal = registry.supabaseClientOrigins.internal.map(
      (origin) => `${origin.module}#${origin.export}`,
    );
    const external = registry.supabaseClientOrigins.external.map(
      (origin) => `${origin.module}#${origin.export}`,
    );

    expect(internal).toContain(
      'apps/web/src/server/supabase/server-client.ts#createSupabaseServerClient',
    );
    expect(external).toContain('@supabase/ssr#createServerClient');
    for (const origin of [
      ...registry.supabaseClientOrigins.internal,
      ...registry.supabaseClientOrigins.external,
    ]) {
      expect(origin.module, JSON.stringify(origin)).toBeTruthy();
      expect(origin.export, JSON.stringify(origin)).toBeTruthy();
    }
  });
});
