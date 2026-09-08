import { describe, expect, it } from 'vitest';

import { assertCompiles, runGuard, withViolations } from './lib/run-guard';

/**
 * `guards.computedSink.spec` · el sumidero computado extraído de una consulta.
 *
 * Gate **P0-G5**. El falso negativo que quedaba: `q[method](...)` se denunciaba
 * solo cuando el acceso computado era **la llamada misma**. Bastaba separarlos:
 *
 *     const sink = query[method];
 *     sink('user_id', raw);
 *
 * y la guarda no veía nada, porque el acceso ya no formaba parte de la
 * `CallExpression`.
 *
 * ---------------------------------------------------------------------------
 * La regla
 *
 * **Leer** `q[m]` con `m` no resoluble sobre un valor `postgrest-query` produce un
 * valor con la capacidad `postgrest-computed-sink`. Es una capacidad como cualquier
 * otra y el motor la propaga como propaga una función-valor: declaraciones,
 * asignaciones posteriores, propiedades, contenedores, parámetros, retornos,
 * `bind`/`call`/`apply` y alias intermedios. **Invocar** un valor que la lleve es un
 * hallazgo, con el diagnóstico de método computado PostgREST, esté donde esté la
 * llamada.
 *
 * Solo nace sobre `postgrest-query`. Extraer `registry[m]` de un objeto local y
 * ejecutarlo no la produce.
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

const CANONICAL_CLIENT = "import { createSupabaseServerClient } from './supabase/server-client';";
const DIAGNOSTIC = 'extraído de una consulta PostgREST';

describe('K1 · los cuatro fixtures obligatorios', () => {
  it("`const sink = query[method]; sink('user_id', raw)`", () => {
    const result = fixture({
      'apps/web/src/server/_cs-extracted.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function evade(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        '  const sink = (query as any)[method];',
        "  return sink('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('Invocación de `sink`');
    expect(result.output).toContain(DIAGNOSTIC);
  });

  it('asignación posterior del mismo sumidero', () => {
    const result = fixture({
      'apps/web/src/server/_cs-late.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function evade(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        '  let sink;',
        '  sink = (query as any)[method];',
        "  return sink('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain(DIAGNOSTIC);
  });

  it('paso por contenedor y retorno', () => {
    const result = fixture({
      'apps/web/src/server/_cs-container-return.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function evade(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        '  const caja = [(query as any)[method]];',
        '  const dame = () => caja.pop();',
        '  const sink = dame();',
        "  return sink('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain(DIAGNOSTIC);
  });

  it('`.bind(query)` antes de invocarlo', () => {
    const result = fixture({
      'apps/web/src/server/_cs-bind.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function evade(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        '  const sink = (query as any)[method].bind(query);',
        "  return sink('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain(DIAGNOSTIC);
  });
});

describe('K2 · los demás caminos, para que no sea un `if` disfrazado', () => {
  it('propiedad, parámetro, `call`, `apply` y alias intermedio', () => {
    const result = fixture({
      'apps/web/src/server/_cs-paths.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function porPropiedad(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        '  const ops = { run: (query as any)[method] };',
        "  return ops.run('user_id', raw);",
        '}',
        'export async function porParametro(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        "  const ejecutar = (fn: (c: string, v: string) => unknown) => fn('user_id', raw);",
        '  return ejecutar((query as any)[method]);',
        '}',
        'export async function porCall(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        '  const sink = (query as any)[method];',
        "  return sink.call(query, 'user_id', raw);",
        '}',
        'export async function porApply(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        '  const sink = (query as any)[method];',
        "  return sink.apply(query, ['user_id', raw]);",
        '}',
        'export async function porAlias(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles').select();",
        '  const uno = (query as any)[method];',
        '  const dos = uno;',
        '  const tres = dos;',
        "  return tres('owner_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(count(result.output, DIAGNOSTIC)).toBe(5);
  });

  it('el acceso directo sigue teniendo su propio diagnóstico, sin duplicarse', () => {
    const result = fixture({
      'apps/web/src/server/_cs-direct.ts': server([
        CANONICAL_CLIENT,
        '',
        'export async function evade(method: string, raw: string) {',
        '  const db = await createSupabaseServerClient();',
        "  return (db.from('profiles').select() as any)[method]('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('sobre una consulta PostgREST');
    expect(count(result.output, DIAGNOSTIC)).toBe(0);
  });
});

describe('K3 · controles positivos · la capacidad solo nace sobre postgrest-query', () => {
  it('el repositorio real pasa la guarda', () => {
    expect(runGuard('auth-authority-guard.mjs').exitCode).toBe(0);
  });

  it('extraer `registry[method]` de un registro local y ejecutarlo', () => {
    const result = fixture({
      'apps/web/src/server/_cs-registry.ts': server([
        'const registry: Record<string, (c: string, v: string) => string> = {',
        '  concat: (c, v) => c + v,',
        '};',
        '',
        'export function ejecutar(method: string, raw: string) {',
        '  const fn = registry[method];',
        "  return fn?.('user_id', raw);",
        '}',
        'export function porContenedor(method: string, raw: string) {',
        '  const caja = [registry[method]];',
        '  const fn = caja.pop();',
        "  return fn?.('owner_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('leer `query.select` en el mismo fichero que `query[method]` no contamina la lectura', () => {
    // El comodín de claves no resolubles no puede alcanzar a las propiedades con
    // nombre: si lo hiciera, `query.select()` heredaría el sumidero computado.
    const result = fixture({
      'apps/web/src/server/_cs-no-leak.ts': server([
        CANONICAL_CLIENT,
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function mezcla(method: string) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  const db = await createSupabaseServerClient();',
        "  const query = db.from('profiles');",
        '  void (query as any)[method];',
        "  return query.select('id').eq('user_id', identity.userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una consulta canónica con identidad verificada sigue pasando', () => {
    const result = fixture({
      'apps/web/src/server/_cs-legit.ts': server([
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
});
