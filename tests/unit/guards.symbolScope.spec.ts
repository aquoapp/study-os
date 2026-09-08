import { describe, expect, it } from 'vitest';

import { runGuard, withViolation, withViolations } from './lib/run-guard';

/**
 * `guards.symbolScope.spec` · las guardas razonan sobre símbolos, no sobre formas.
 *
 * Gate **P0-G5**. Las rondas anteriores cerraron el renombrado y el blanqueo por
 * extracción. La auditoría siguiente señaló que ambas guardas seguían mirando la
 * **forma** de la expresión: qué aspecto tenía la llamada, no a qué declaración
 * resolvía cada nombre.
 *
 * ---------------------------------------------------------------------------
 * Lo que eso dejaba abierto
 *
 * En `client-authority-guard`, todo lo que separa el método de su llamada sin usar
 * ninguna de las formas ya reconocidas: asignación posterior, asignación
 * destructurada, `.bind()`, paso como argumento, retorno, almacenamiento.
 *
 * En `auth-authority-guard`, dos cosas peores. Sombrear el import canónico con un
 * parámetro del mismo nombre —la evasión de menos esfuerzo que existe—, y reasignar
 * una variable verificada, que seguía contando como verificada el resto del fichero.
 *
 * ---------------------------------------------------------------------------
 * Cada caso ejecuta la guarda real
 *
 * Se escribe un fichero, se lanza el proceso de la guarda, se comprueba el código
 * de salida y se borra el fichero pase lo que pase. Un doble de prueba solo
 * demostraría que el doble funciona.
 *
 * Y los controles legítimos van al final, con el mismo peso: una guarda que falla
 * con cualquier código no protege nada, solo impide trabajar.
 * ---------------------------------------------------------------------------
 */

const client = (lines: string[]) => ["'use client';", '', ...lines].join('\n');
const server = (lines: string[]) => lines.join('\n');

describe('S1 · client-authority · el método separado de su llamada', () => {
  it('rechaza `w = query.update` · asignación posterior', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-assign.tsx',
      client([
        'export function build(query: any) {',
        '  let w;',
        '  w = query.update;',
        '  return w;',
        '}',
      ]),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('El miembro ".update"');
    expect(result.output).toContain('se asigna a una variable');
  });

  it('rechaza `query.update.bind(query)`', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-bind.tsx',
      client(['export function build(query: any) {', '  return query.update.bind(query);', '}']),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('se enlaza con .bind()');
  });

  it('rechaza `.call()` y `.apply()`', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-call-apply.tsx',
      client([
        'export function build(query: any, payload: unknown) {',
        '  query.insert.call(query, payload);',
        '  query.upsert.apply(query, [payload]);',
        '}',
      ]),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('se enlaza con .call()');
    expect(result.output).toContain('se enlaza con .apply()');
  });

  it('rechaza la asignación destructurada sin declaración', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-destructured-assign.tsx',
      client([
        'export function build(query: any) {',
        '  let w;',
        '  ({ update: w } = query);',
        '  return w;',
        '}',
      ]),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('Asignación destructurada de ".update"');
  });

  it('rechaza pasar `query.update` como argumento', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-argument.tsx',
      client([
        'declare function registrar(fn: unknown): void;',
        '',
        'export function build(query: any) {',
        '  registrar(query.update);',
        '}',
      ]),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('se pasa como argumento');
  });

  it('rechaza devolverlo y rechaza almacenarlo en otra estructura', () => {
    const result = withViolations(
      {
        'apps/web/src/app/_symbol-return.tsx': client([
          'export function build(query: any) {',
          '  return query.delete;',
          '}',
        ]),
        'apps/web/src/app/_symbol-stored.tsx': client([
          'export function build(query: any) {',
          '  const ops = { escribir: query.insert };',
          '  return ops;',
          '}',
        ]),
      },
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('se devuelve');
    expect(result.output).toContain('se almacena en otra estructura');
  });

  it('rechaza el acceso computado literal y el constante', () => {
    const result = withViolations(
      {
        'apps/web/src/app/_symbol-computed-literal.tsx': client([
          'export function build(query: any, payload: unknown) {',
          "  return query['update'](payload);",
          '}',
        ]),
        'apps/web/src/app/_symbol-computed-const.tsx': client([
          "const M = 'upsert';",
          '',
          'export function build(query: any, payload: unknown) {',
          '  return query[M](payload);',
          '}',
        ]),
      },
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('_symbol-computed-literal.tsx');
    expect(result.output).toContain('_symbol-computed-const.tsx');
    expect(result.output).toContain('(acceso computado)');
  });

  it('rechaza el acceso computado no resoluble, invocado o guardado y luego invocado', () => {
    const result = withViolations(
      {
        'apps/web/src/app/_symbol-computed-direct.tsx': client([
          'export function build(query: any, metodo: string, payload: unknown) {',
          '  return query[metodo](payload);',
          '}',
        ]),
        'apps/web/src/app/_symbol-computed-stored.tsx': client([
          'export function build(query: any, metodo: string, payload: unknown) {',
          '  const m = query[metodo];',
          '  return m(payload);',
          '}',
        ]),
      },
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('_symbol-computed-direct.tsx');
    expect(result.output).toContain('_symbol-computed-stored.tsx');
  });

  it('rechaza una constante reasignada que finge resolverse a algo inocuo', () => {
    // `const` no, pero `let` sí: si el símbolo cambia, no es una constante y no
    // puede usarse para demostrar nada.
    const result = withViolation(
      'apps/web/src/app/_symbol-poisoned-const.tsx',
      client([
        'export function build(query: any, payload: unknown, otro: string) {',
        "  let M = 'select';",
        '  M = otro;',
        '  return query[M](payload);',
        '}',
      ]),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('nombre computado no demostrable');
  });
});

describe('S2 · client-authority · la Cache API no se hereda ni se extrae', () => {
  it('rechaza extraer `caches.delete` en lugar de invocarlo', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-caches-extracted.tsx',
      client([
        'export function build() {',
        '  const borrar = caches.delete;',
        "  return borrar('v1');",
        '}',
      ]),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('El miembro ".delete"');
  });

  it('rechaza enlazar `caches.delete`', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-caches-bound.tsx',
      client(['export function build() {', '  return caches.delete.bind(caches);', '}']),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('se enlaza con .bind()');
  });

  it('rechaza un `caches` que resuelve a una variable del propio fichero', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-caches-local.tsx',
      client([
        'export function build(supabase: any) {',
        "  const caches = supabase.from('planner_runs');",
        "  return caches.delete('x');",
        '}',
      ]),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('El miembro ".delete"');
  });
});

describe('S3 · auth-authority · el verificador se resuelve, no se reconoce por nombre', () => {
  it('rechaza un import canónico sombreado por un parámetro', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-shadowed-param.ts',
      server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function legitima(db: any) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
        '',
        '// El import existe arriba, pero aquí el nombre resuelve al parámetro.',
        'export async function evade(',
        '  getVerifiedIdentity: () => { userId: string },',
        '  db: any,',
        ') {',
        '  const identity = getVerifiedIdentity();',
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe');
    // Y la función legítima del mismo fichero NO produce hallazgo.
    expect(result.output.match(/"user_id" recibe/g)?.length ?? 0).toBe(1);
  });

  it('rechaza un import canónico sombreado por una variable local', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-shadowed-var.ts',
      server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function evade(db: any, request: Request) {',
        '  {',
        "    const getVerifiedIdentity = () => ({ userId: request.headers.get('u') ?? '' });",
        '    const identity = getVerifiedIdentity();',
        "    return db.from('t').select().eq('owner_id', identity.userId);",
        '  }',
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"owner_id" recibe');
  });

  it('rechaza una identidad verificada y después reasignada', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-reassigned.ts',
      server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function evade(db: any, request: Request) {',
        '  let identity = await getVerifiedIdentity();',
        '  identity = {',
        "    userId: request.headers.get('x-user') ?? '',",
        '    email: null,',
        "    method: 'getUser',",
        '  } as never;',
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe');
  });

  it('rechaza la reasignación aunque ocurra después del uso', () => {
    // El orden textual no puede decidir la seguridad: envenenar gana siempre.
    const result = withViolation(
      'apps/web/src/server/_symbol-reassigned-later.ts',
      server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function evade(db: any, request: Request) {',
        '  let identity = await getVerifiedIdentity();',
        "  const primera = db.from('t').select().eq('user_id', identity!.userId);",
        "  identity = { userId: request.headers.get('x') ?? '' } as never;",
        '  return primera;',
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe');
  });
});

describe('S4 · auth-authority · columnas y métodos que se esconden', () => {
  it("rechaza `query['eq'](...)` con acceso computado literal", () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-eq-computed.ts',
      server([
        'export async function evade(db: any, valor: string) {',
        "  return db.from('t').select()['eq']('user_id', valor);",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe');
  });

  it("rechaza `const column = 'user_id'; query.eq(column, ...)`", () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-column-const.ts',
      server([
        "const column = 'user_id';",
        '',
        'export async function evade(db: any, valor: string) {',
        "  return db.from('t').select().eq(column, valor);",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe');
  });

  it('rechaza el alias de `.eq`', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-eq-alias.ts',
      server([
        'export async function evade(db: any, valor: string) {',
        "  const query = db.from('t').select();",
        '  const eq = query.eq;',
        "  return eq('user_id', valor);",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe');
  });

  it('rechaza el alias de `.eq` enlazado con `.bind()`', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-eq-bound.ts',
      server([
        'export async function evade(db: any, valor: string) {',
        "  const query = db.from('t').select();",
        '  const eq = query.eq.bind(query);',
        "  return eq('profile_id', valor);",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"profile_id" recibe');
  });

  it('rechaza una columna de filtro que no se resuelve a un literal', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-opaque-column.ts',
      server([
        'export async function evade(db: any, columna: string, valor: string) {',
        "  return db.from('t').select().eq(columna, valor);",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('no se resuelve a un literal');
  });

  it('rechaza columnas opacas también en `.neq`, `.is`, `.filter` y `.in`', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-opaque-column-family.ts',
      server([
        'export async function evade(db: any, c: string, v: string, lista: string[]) {',
        "  const q = db.from('t').select();",
        '  q.neq(c, v);',
        '  q.is(c, v);',
        "  q.filter(c, 'eq', v);",
        '  q.in(c, lista);',
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output.match(/no se resuelve a un literal/g)?.length ?? 0).toBe(4);
  });
});

describe('S5 · controles legítimos · las guardas no pueden fallar con cualquier código', () => {
  it('el repositorio real pasa las dos guardas', () => {
    expect(runGuard('client-authority-guard.mjs').exitCode).toBe(0);
    expect(runGuard('auth-authority-guard.mjs').exitCode).toBe(0);
  });

  it('`caches.delete(k)` invocado directamente sobre el global sigue siendo legítimo', () => {
    const result = withViolation(
      'apps/web/src/lib/_symbol-legit-caches.ts',
      [
        'export async function limpiar(keys: string[]) {',
        '  await caches.delete("v1");',
        '  return Promise.all(keys.map((k) => caches.delete(k)));',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('indexar un registro con una clave variable no es invocar un método', () => {
    // El patrón de `packages/config`: `policies.environments[entorno]`. Denunciarlo
    // sería ruido, y el ruido acaba desactivando la guarda.
    const result = withViolation(
      'apps/web/src/lib/_symbol-legit-record.ts',
      [
        'const tabla: Record<string, { titulo: string }> = {};',
        '',
        'export function leer(clave: string) {',
        '  const fila = tabla[clave];',
        '  return fila?.titulo ?? null;',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('la lectura de cliente con `.select()` y `.eq()` no es una escritura', () => {
    const result = withViolation(
      'apps/web/src/app/_symbol-legit-select.tsx',
      client([
        'export async function leer(supabase: any, locale: string) {',
        "  return supabase.from('profiles').select('id').eq('locale', locale).single();",
        '}',
      ]),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('la identidad canónica se acepta directa, renombrada y por espacio de nombres', () => {
    const result = withViolations(
      {
        'apps/web/src/server/_symbol-legit-direct.ts': server([
          "import { getVerifiedIdentity } from './auth/identity';",
          '',
          'export async function leer(db: any) {',
          '  const identity = await getVerifiedIdentity();',
          '  if (!identity) return null;',
          "  return db.from('t').select().eq('user_id', identity.userId);",
          '}',
        ]),
        'apps/web/src/server/_symbol-legit-renamed.ts': server([
          "import { requireVerifiedIdentity as exigir } from './auth/identity';",
          '',
          'export async function escribir(db: any) {',
          "  const identity = await exigir('_legit');",
          "  return db.from('t').insert({ user_id: identity.userId, locale: 'es' });",
          '}',
        ]),
        'apps/web/src/server/_symbol-legit-namespace.ts': server([
          "import * as identidad from './auth/identity';",
          '',
          'export async function leer(db: any) {',
          '  const identity = await identidad.getVerifiedIdentity();',
          '  if (!identity) return null;',
          "  return db.from('t').select().in('user_id', [identity.userId]);",
          '}',
        ]),
      },
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una columna constante que no designa propietario se acepta', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-legit-column.ts',
      server([
        "const COLUMNA = 'locale';",
        '',
        'export async function leer(db: any, valor: string) {',
        "  return db.from('t').select().eq(COLUMNA, valor)['neq']('estado', 'borrado');",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('`Array.prototype.filter` con uno o dos argumentos no es un filtro de consulta', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-legit-array-filter.ts',
      server([
        'export function limpiar(claves: string[], actual: string) {',
        '  return claves.filter((clave) => clave !== actual);',
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una variable verificada reasignada desde otra verificada sigue valiendo', () => {
    const result = withViolation(
      'apps/web/src/server/_symbol-legit-reassign.ts',
      server([
        "import { getVerifiedIdentity, requireVerifiedIdentity } from './auth/identity';",
        '',
        'export async function leer(db: any, estricto: boolean) {',
        '  let identity = await getVerifiedIdentity();',
        "  if (estricto) identity = await requireVerifiedIdentity('_legit');",
        '  if (!identity) return null;',
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
      ]),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });
});
