import { describe, expect, it } from 'vitest';

import { assertCompiles, runGuard, withViolations } from './lib/run-guard';

/**
 * `guards.closure.spec` · cierre transitivo de la propagación.
 *
 * Gate **P0-G5**. La auditoría de la ronda anterior encontró cuatro agujeros en el
 * motor: `var` tratado como si tuviera ámbito de bloque; retornos que solo se
 * resolvían cuando el callee era un identificador ligado a una declaración;
 * contenedores cuyos elementos no llegaban a `pop`, `at`, `find`, `Map.get` ni a la
 * desestructuración; y un método computado no resoluble sobre una consulta PostgREST
 * que la guarda de identidad dejaba pasar.
 *
 * ---------------------------------------------------------------------------
 * Qué demuestra este fichero
 *
 * Que las cuatro evasiones fallan de verdad —código distinto de cero y el hallazgo
 * concreto— y que lo hacen por **reglas generales**, no por un `if` para cada
 * ejemplo: cada una se prueba por varios caminos distintos, y al final se compone
 * una cadena completa —contenedor → extracción → retorno → alias → llamada— que
 * ninguna regla individual cubre por sí sola.
 *
 * Cada fixture compila con el `tsconfig.json` real, ejecuta la guarda como proceso
 * hijo y borra sus ficheros pase lo que pase. Y los controles positivos van con el
 * mismo peso: una guarda que falla con todo no protege nada.
 * ---------------------------------------------------------------------------
 */

const client = (lines: string[]) => ["'use client';", '', ...lines].join('\n');
const server = (lines: string[]) => lines.join('\n');

function fixture(
  guard: 'client-authority-guard.mjs' | 'auth-authority-guard.mjs',
  files: Record<string, string>,
) {
  return withViolations(files, () => {
    assertCompiles(Object.keys(files));
    return runGuard(guard);
  });
}

const count = (output: string, needle: string) => output.split(needle).length - 1;

describe('C1 · `var` se iza a la función, nunca al bloque', () => {
  it('un `var caches` dentro de `{}` sombrea al global fuera del bloque', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_closure-var-caches.tsx': client([
        'export async function evade(supabase: any) {',
        '  {',
        "    var caches = supabase.from('planner_runs');",
        '  }',
        "  return caches.delete('x');",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('El miembro ".delete" se invoca');
  });

  it('un `var` izado desde un bucle o un `if` sombrea igual', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_closure-var-paths.tsx': client([
        'export async function porIf(supabase: any, cond: boolean) {',
        "  if (cond) var caches = supabase.from('planner_runs');",
        "  return caches?.delete('x');",
        '}',
        'export async function porBucle(supabase: any) {',
        "  for (var caches = supabase.from('t'); false; ) {}",
        "  return caches.delete('y');",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(count(result.output, 'El miembro ".delete" se invoca')).toBe(2);
  });
});

describe('C2 · toda invocación de un valor-función resuelve sus retornos', () => {
  it('IIFE, función expresión, método de objeto y alias tardío', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_closure-returns.tsx': client([
        'export function iife(query: any, payload: unknown) {',
        '  const w = (() => query.update)();',
        '  return w(payload);',
        '}',
        'export function expresion(query: any, payload: unknown) {',
        '  const dame = function () {',
        '    return query.upsert;',
        '  };',
        '  const w = dame();',
        '  return w(payload);',
        '}',
        'export function metodo(query: any, payload: unknown) {',
        '  const ops = {',
        '    get() {',
        '      return query.insert;',
        '    },',
        '  };',
        '  const w = ops.get();',
        '  return w(payload);',
        '}',
        'export function aliasTardio(query: any, payload: unknown) {',
        '  function dame() {',
        '    return query.update;',
        '  }',
        '  let alias;',
        '  alias = dame;',
        '  const w = alias();',
        '  return w(payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    // Cada invocación final llega por propagación, además del acceso original. El
    // pie del informe también dice «por propagación»: se cuenta el texto del hallazgo.
    expect(count(result.output, 'por propagación —alias')).toBe(4);
  });

  it('el retorno de un miembro opaco también se resuelve por IIFE y por alias', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_closure-opaque-returns.tsx': client([
        'export function iife(query: any, method: string, payload: unknown) {',
        '  const w = (() => query[method])();',
        '  return w(payload);',
        '}',
        'export function alias(query: any, method: string, payload: unknown) {',
        '  const dame = () => query[method];',
        '  const otro = dame;',
        '  return otro()(payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(count(result.output, 'nombre computado no demostrable')).toBe(2);
  });

  it('los argumentos también llegan a los parámetros por alias e IIFE', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_closure-arguments.ts': server([
        'export async function porAlias(db: any, raw: string) {',
        '  const filtrar = (valor: string) => db.from("t").select().eq("user_id", valor);',
        '  const alias = filtrar;',
        '  return alias(raw);',
        '}',
        'export async function porIife(db: any, raw: string) {',
        '  return ((valor: string) => db.from("t").select().eq("owner_id", valor))(raw);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(count(result.output, 'recibe `valor`')).toBe(2);
  });
});

describe('C3 · lo que entra en un contenedor sale por cualquier recuperación', () => {
  it('acceso indexado, desestructuración, `at`, `pop`, `shift`, `find` y `Map.get`', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_closure-containers.tsx': client([
        'export function porIndice(query: any, method: string, payload: unknown) {',
        '  const box = [query[method]];',
        '  return box[0](payload);',
        '}',
        'export function porDestructuring(query: any, method: string, payload: unknown) {',
        '  const box = [query[method]];',
        '  const [w] = box;',
        '  return w(payload);',
        '}',
        'export function porAt(query: any, method: string, payload: unknown) {',
        '  const box = [query[method]];',
        '  return box.at(-1)(payload);',
        '}',
        'export function porPop(query: any, method: string, payload: unknown) {',
        '  const box = [query[method]];',
        '  const w = box.pop();',
        '  return w(payload);',
        '}',
        'export function porShift(query: any, method: string, payload: unknown) {',
        '  const box = [query[method]];',
        '  const w = box.shift();',
        '  return w(payload);',
        '}',
        'export function porFind(query: any, method: string, payload: unknown) {',
        '  const box = [query[method]];',
        '  const w = box.find(() => true);',
        '  return w(payload);',
        '}',
        'export function porMapGet(query: any, method: string, payload: unknown) {',
        "  const box = new Map([['w', query[method]]]);",
        "  const w = box.get('w');",
        '  return w(payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(count(result.output, 'nombre computado no demostrable')).toBe(7);
  });

  it('una recuperación no modelada desde un contenedor contaminado falla cerrado', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_closure-unknown-retrieval.tsx': client([
        'export function porReduce(query: any, method: string, payload: unknown) {',
        '  const box = [query[method]];',
        '  const w = box.reduce((_acc, fn) => fn, null);',
        '  return w(payload);',
        '}',
        'export function porSlice(query: any, payload: unknown) {',
        '  const box = [query.update];',
        '  const [w] = box.slice(0, 1);',
        '  return w(payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('nombre computado no demostrable');
    expect(result.output).toContain('lleva el método ".update" por propagación');
  });

  it('la identidad guardada en un contenedor y recuperada sigue siendo identidad', () => {
    // Control de la otra dirección: si `derived` no atravesara el contenedor, esta
    // consulta legítima saltaría, y una guarda que salta con lo legítimo no protege.
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_closure-identity-container.ts': server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function leer(db: any) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  const caja = [identity];',
        '  const [primera] = caja;',
        '  if (!primera) return null;',
        "  return db.from('t').select().eq('user_id', primera.userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una transformación no modelada no vacía los hechos, pero sí la procedencia', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_closure-unmodeled.ts': server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'declare function normalizar(value: string): string;',
        '',
        'export async function evade(db: any) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  const userId = normalizar(identity.userId);',
        "  return db.from('t').select().eq('user_id', userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe `userId`');
    // Lo que sale de una función desconocida ya no es la identidad: ni siquiera
    // «por algún camino». La transformación la borra y deja el veneno.
    expect(result.output).toContain('no deriva del verificador');
  });
});

describe('C4 · método computado no resoluble sobre una consulta PostgREST', () => {
  it("`db.from('profiles').select()[method]('user_id', raw)` falla", () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_closure-computed-sink.ts': server([
        'export async function evade(db: any, method: string, raw: string) {',
        "  return db.from('profiles').select()[method]('user_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    // `db` es un parámetro `any`: su procedencia no se puede demostrar. La guarda ya
    // no supone que todo `.from()` sea PostgREST —`Array.from` es el contraejemplo—,
    // así que este caso entra por la otra puerta: falla cerrado por origen opaco.
    // La procedencia demostrada la cubre `guards.postgrestProvenance.spec`.
    expect(result.output).toContain('cuya procedencia es opaca');
  });

  it('también por alias de la consulta y tras otros métodos encadenados', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_closure-computed-sink-paths.ts': server([
        'export async function porAlias(db: any, method: string, raw: string) {',
        "  const q = db.from('profiles').select();",
        "  return q[method]('user_id', raw);",
        '}',
        'export async function trasCadena(db: any, method: string, raw: string) {',
        "  return db.from('profiles').select('id').limit(1)[method]('owner_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(count(result.output, 'cuya procedencia es opaca')).toBe(2);
  });

  it('un método computado ordinario sobre un registro ajeno a datos sigue permitido', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_closure-computed-record.ts': server([
        'type Handlers = Record<string, (value: string) => number>;',
        '',
        'export function ejecutar(tabla: Record<string, Handlers>, clave: string, m: string) {',
        "  return tabla[clave]?.[m]?.('x') ?? 0;",
        '}',
        'export function porMapa(handlers: Map<string, Handlers>, clave: string, m: string) {',
        "  return handlers.get(clave)?.[m]?.('y') ?? 0;",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });
});

describe('C5 · cierre transitivo · contenedor → extracción → retorno → alias → llamada', () => {
  it('la cadena completa falla en la guarda de cliente', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_closure-chain.tsx': client([
        'export function evade(query: any, method: string, payload: unknown) {',
        "  const box = new Map([['w', query[method]]]); // contenedor",
        '  function extraer() {',
        "    return box.get('w'); // extracción + retorno",
        '  }',
        '  const alias = extraer; // alias',
        '  const w = alias(); // llamada al alias',
        '  return w(payload); // llamada final',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('nombre computado no demostrable');
  });

  it('la cadena completa falla en la guarda de identidad, con el sumidero al final', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_closure-chain-sink.ts': server([
        'export async function evade(db: any, raw: string) {',
        "  const query = db.from('t').select();",
        '  const box = [query.eq]; // contenedor',
        '  const dame = () => box.pop(); // extracción + retorno',
        '  const alias = dame; // alias',
        '  const filtrar = alias(); // llamada al alias',
        "  return filtrar('profile_id', raw); // sumidero",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"profile_id" recibe `raw` en .eq()');
  });

  it('la misma cadena con una función inocua no produce hallazgos', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_closure-chain-benign.tsx': client([
        'export function ok(payload: unknown) {',
        "  const box = new Map([['w', (p: unknown) => p]]);",
        '  function extraer() {',
        "    return box.get('w');",
        '  }',
        '  const alias = extraer;',
        '  const w = alias();',
        '  return w?.(payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });
});

describe('C6 · controles positivos', () => {
  it('el repositorio real pasa las dos guardas', () => {
    expect(runGuard('client-authority-guard.mjs').exitCode).toBe(0);
    expect(runGuard('auth-authority-guard.mjs').exitCode).toBe(0);
  });

  it('`caches.delete(key)` sobre el global real sigue pasando', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/lib/_closure-legit-caches.ts': [
        'export async function limpiar(keys: string[]) {',
        "  await caches.delete('v1');",
        '  return Promise.all(keys.map((key) => caches.delete(key)));',
        '}',
      ].join('\n'),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('un `Map` de funciones inocuas recuperadas y llamadas no produce hallazgos', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/lib/_closure-legit-handlers.ts': [
        "const handlers = new Map<string, () => number>([['a', () => 1]]);",
        '',
        'export function ejecutar(nombre: string) {',
        '  const fn = handlers.get(nombre);',
        '  const [primero] = [...handlers.values()];',
        '  return (fn?.() ?? 0) + (primero?.() ?? 0);',
        '}',
      ].join('\n'),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('la identidad canónica a través de un helper local se acepta', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_closure-legit-helper.ts': server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'async function quien() {',
        '  return getVerifiedIdentity();',
        '}',
        'export async function leer(db: any) {',
        '  const identity = await quien();',
        '  if (!identity) return null;',
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });
});
