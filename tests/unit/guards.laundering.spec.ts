import { describe, expect, it } from 'vitest';

import { runGuard, withViolation, withViolations } from './lib/run-guard';

/**
 * `guards.laundering.spec` · blanqueo de escrituras y de identidad.
 *
 * Gate **P0-G5**. La ronda anterior cerró las evasiones por *renombrado*. La
 * auditoría siguiente encontró la clase de al lado: **separar la operación de su
 * llamada** y **fabricar la procedencia**.
 *
 * ---------------------------------------------------------------------------
 * Las seis obligatorias
 *
 *   1. alias de `.update`            · el método se guarda en una variable
 *   2. alias de `.rpc`               · ídem, por desestructuración
 *   3. `caches` sombreado            · heredar la excepción de navegador
 *   4. factory falso                 · una función llamada como el verificador
 *   5. payload variable en `.insert` · el objeto no se ve desde la llamada
 *   6. lista variable en `.in()`     · la lista tampoco
 *
 * Cada una ejecuta la guarda **real** contra un fichero que se escribe y se borra.
 * Un doble de prueba demostraría que el doble funciona.
 *
 * Y después, los controles legítimos: una guarda que salta con todo no protege,
 * estorba. Si alguno de ellos empieza a fallar, la guarda se ha vuelto inservible
 * aunque siga «detectando» las seis de arriba.
 * ---------------------------------------------------------------------------
 */

describe('L1 · client-authority · separar el método de su llamada', () => {
  it('1 · rechaza el alias de .update aunque no se llame en el mismo sitio', () => {
    const result = withViolation(
      'apps/web/src/app/_laundering-alias-update.tsx',
      [
        "'use client';",
        '',
        'export function build(supabase: any) {',
        "  const escribir = supabase.from('concept_mastery').update;",
        '  return escribir;',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    // El mensaje pasó a describir el acceso, no la declaración: la guarda ya no
    // razona sobre la forma de la asignación sino sobre el símbolo tocado.
    expect(result.output).toContain('El miembro ".update"');
    expect(result.output).toContain('se guarda en una variable');
  });

  it('2 · rechaza el alias de .rpc por desestructuración, y su llamada', () => {
    const result = withViolation(
      'apps/web/src/app/_laundering-alias-rpc.tsx',
      [
        "'use client';",
        '',
        'export async function evade(supabase: any) {',
        '  const { rpc } = supabase;',
        "  return rpc('recalculate_mastery', {});",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('Desestructuración de ".rpc"');
    // La llamada al alias la detecta la propagación, no el nombre suelto.
    expect(result.output).toContain('RPC extraída');
  });

  it('rechaza el alias renombrado en la desestructuración', () => {
    const result = withViolation(
      'apps/web/src/app/_laundering-alias-renamed.tsx',
      [
        "'use client';",
        '',
        'export async function evade(supabase: any) {',
        '  const { upsert: guardar } = supabase.from("planner_items");',
        '  return guardar({ done: true });',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('Desestructuración de ".upsert"');
  });

  it('rechaza el método computado que no se resuelve a un literal', () => {
    const result = withViolation(
      'apps/web/src/app/_laundering-computed-opaque.tsx',
      [
        "'use client';",
        '',
        'export async function evade(supabase: any, metodo: string) {',
        "  return supabase.from('notes')[metodo]({ body: 'x' });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('nombre computado no demostrable');
  });

  it('rechaza la escritura escondida tras dos saltos de helper transitivo', () => {
    // El helper no lleva ninguna directiva y vive en otro paquete. Llega a la
    // superficie de cliente por el grafo de importaciones, no por su nombre.
    const result = withViolations(
      {
        'packages/domain/src/_laundering-inner.ts': [
          'export async function persist(client: any, payload: unknown) {',
          "  return client.from('exam_readiness').upsert(payload);",
          '}',
        ].join('\n'),
        'packages/domain/src/_laundering-outer.ts': [
          "import { persist } from './_laundering-inner';",
          '',
          'export const passthrough = persist;',
        ].join('\n'),
        'apps/web/src/app/_laundering-transitive.tsx': [
          "'use client';",
          '',
          "import { passthrough } from '@study-os/domain/_laundering-outer';",
          '',
          'export const use = passthrough;',
        ].join('\n'),
      },
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('_laundering-inner.ts');
    expect(result.output).toContain('.upsert()');
  });
});

describe('L2 · client-authority · la excepción de navegador no se hereda', () => {
  it('3 · rechaza un parámetro llamado `caches`', () => {
    const result = withViolation(
      'apps/web/src/app/_laundering-shadow-param.tsx',
      [
        "'use client';",
        '',
        'export async function evade(caches: any) {',
        "  return caches.from('planner_runs').delete();",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.delete()');
  });

  it('rechaza una variable local llamada `localStorage`', () => {
    const result = withViolation(
      'apps/web/src/app/_laundering-shadow-var.tsx',
      [
        "'use client';",
        '',
        'export async function evade(supabase: any) {',
        "  const localStorage = supabase.from('mastery_history');",
        '  return localStorage.insert({ score: 1 });',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.insert()');
  });

  it('rechaza una importación llamada `window`', () => {
    const result = withViolations(
      {
        'packages/domain/src/_laundering-window.ts': [
          'export const window = {',
          '  update: async (_payload: unknown) => undefined,',
          '};',
        ].join('\n'),
        'apps/web/src/app/_laundering-shadow-import.tsx': [
          "'use client';",
          '',
          "import { window } from '@study-os/domain/_laundering-window';",
          '',
          'export async function evade() {',
          '  return window.update({ score: 1 });',
          '}',
        ].join('\n'),
      },
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('_laundering-shadow-import.tsx');
  });
});

describe('L3 · auth-authority · fabricar la procedencia', () => {
  it('4 · rechaza un factory falso que se llama como el verificador', () => {
    const result = withViolation(
      'apps/web/src/server/_laundering-fake-factory.ts',
      [
        '// No importa nada del módulo canónico: define su propio verificador.',
        'function getVerifiedIdentity(request: Request) {',
        "  return { userId: request.headers.get('x-user') ?? '' };",
        '}',
        '',
        'export async function handler(db: any, request: Request) {',
        '  const identity = getVerifiedIdentity(request);',
        "  return db.from('profiles').select().eq('user_id', identity.userId);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe');
  });

  it('rechaza un objeto con un método llamado como el verificador', () => {
    const result = withViolation(
      'apps/web/src/server/_laundering-fake-namespace.ts',
      [
        'const auth = {',
        "  requireVerifiedIdentity: (r: Request) => ({ userId: r.headers.get('u') ?? '' }),",
        '};',
        '',
        'export async function handler(db: any, request: Request) {',
        '  const identity = auth.requireVerifiedIdentity(request);',
        "  return db.from('profiles').update({ user_id: identity.userId });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe');
  });

  it('rechaza un verificador importado de un módulo que no es el canónico', () => {
    const result = withViolations(
      {
        'packages/domain/src/_laundering-impostor.ts': [
          'export function getVerifiedIdentity() {',
          "  return { userId: 'cualquiera' };",
          '}',
        ].join('\n'),
        'apps/web/src/server/_laundering-impostor-user.ts': [
          "import { getVerifiedIdentity } from '@study-os/domain/_laundering-impostor';",
          '',
          'export async function handler(db: any) {',
          '  const identity = getVerifiedIdentity();',
          "  return db.from('profiles').select().eq('owner_id', identity.userId);",
          '}',
        ].join('\n'),
      },
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"owner_id" recibe');
  });
});

describe('L4 · auth-authority · lo que no se ve no se acepta', () => {
  it('5 · rechaza un payload variable en .insert()', () => {
    const result = withViolation(
      'apps/web/src/server/_laundering-opaque-insert.ts',
      [
        'export async function save(db: any, payload: Record<string, unknown>) {',
        "  return db.from('profiles').insert(payload);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.insert()');
    expect(result.output).toContain('no se resuelve a un literal');
  });

  it('6 · rechaza una lista variable en .in()', () => {
    const result = withViolation(
      'apps/web/src/server/_laundering-opaque-in.ts',
      [
        'export async function read(db: any, ids: string[]) {',
        "  return db.from('profiles').select().in('user_id', ids);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.in("user_id")');
  });

  it('rechaza unos argumentos variables en .rpc()', () => {
    const result = withViolation(
      'apps/web/src/server/_laundering-opaque-rpc.ts',
      [
        'export async function call(db: any, args: Record<string, unknown>) {',
        "  return db.rpc('rebuild_projections', args);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.rpc()');
  });

  it('rechaza un payload en variable que tampoco se resuelve por indirección', () => {
    const result = withViolation(
      'apps/web/src/server/_laundering-opaque-indirect.ts',
      [
        'export async function save(db: any, entrada: Record<string, unknown>) {',
        '  const payload = entrada;',
        "  return db.from('profiles').update(payload);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.update()');
  });

  it('rechaza una clave computada en el payload', () => {
    const result = withViolation(
      'apps/web/src/server/_laundering-computed-key.ts',
      [
        'export async function save(db: any, columna: string, valor: string) {',
        "  return db.from('profiles').insert({ [columna]: valor });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('clave computada');
  });

  it('rechaza un elemento sin verificar dentro de una lista literal en .in()', () => {
    const result = withViolation(
      'apps/web/src/server/_laundering-list-element.ts',
      [
        'export async function read(db: any, otro: string) {',
        "  return db.from('profiles').select().in('profile_id', [otro]);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"profile_id" recibe');
  });
});

describe('L5 · controles legítimos · la guarda no puede saltar con todo', () => {
  it('el global `caches` sin sombrear sigue exento', () => {
    const result = withViolation(
      'apps/web/src/lib/_legit-caches.ts',
      [
        'export async function limpiar(clave: string) {',
        '  await caches.delete(clave);',
        "  return caches.match('/offline');",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una lectura de cliente con .select() no es una escritura', () => {
    const result = withViolation(
      'apps/web/src/app/_legit-select.tsx',
      [
        "'use client';",
        '',
        'export async function leer(supabase: any) {',
        "  return supabase.from('profiles').select('id, display_name').single();",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('la identidad importada del módulo canónico se acepta', () => {
    const result = withViolation(
      'apps/web/src/server/_legit-canonical.ts',
      [
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function read(db: any) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        "  return db.from('profiles').select().eq('user_id', identity.userId);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('la identidad importada con otro nombre también se acepta', () => {
    const result = withViolation(
      'apps/web/src/server/_legit-renamed-import.ts',
      [
        "import { requireVerifiedIdentity as exigir } from './auth/identity';",
        '',
        'export async function write(db: any) {',
        "  const identity = await exigir('_legit');",
        "  return db.from('profiles').insert({ user_id: identity.userId, locale: 'es' });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('el espacio de nombres del módulo canónico también se acepta', () => {
    const result = withViolation(
      'apps/web/src/server/_legit-namespace.ts',
      [
        "import * as identidad from './auth/identity';",
        '',
        'export async function read(db: any) {',
        '  const identity = await identidad.getVerifiedIdentity();',
        '  if (!identity) return null;',
        "  return db.from('profiles').select().in('user_id', [identity.userId]);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('un payload en variable construido a partir de la identidad se acepta', () => {
    const result = withViolation(
      'apps/web/src/server/_legit-resolved-payload.ts',
      [
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function save(db: any) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        "  const payload = { user_id: identity.userId, locale: 'es' };",
        "  return db.from('profiles').upsert(payload);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('String.prototype.match con una expresión regular en variable no es una consulta', () => {
    const result = withViolation(
      'apps/web/src/server/_legit-string-match.ts',
      [
        'const PATRON = /^p0-[a-z]+$/;',
        '',
        'export function parse(entrada: string) {',
        '  return entrada.match(PATRON);',
        '}',
        '',
        'export function parseLiteral(entrada: string) {',
        "  return entrada.match('sin-conexion');",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una columna que no designa propietario no se persigue', () => {
    const result = withViolation(
      'apps/web/src/server/_legit-other-column.ts',
      [
        'export async function read(db: any, locale: string) {',
        "  return db.from('profiles').select().eq('locale', locale);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });
});

describe('L6 · el repositorio real pasa las dos guardas', () => {
  it('client-authority-guard no encuentra nada en el árbol tal cual está', () => {
    const result = runGuard('client-authority-guard.mjs');
    expect(result.exitCode, result.output).toBe(0);
  });

  it('auth-authority-guard no encuentra nada en el árbol tal cual está', () => {
    const result = runGuard('auth-authority-guard.mjs');
    expect(result.exitCode, result.output).toBe(0);
  });
});
