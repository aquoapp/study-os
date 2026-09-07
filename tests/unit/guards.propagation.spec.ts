import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  REPO_ROOT,
  assertCompiles,
  runGuard,
  withReplacedFile,
  withViolations,
} from './lib/run-guard';

/**
 * `guards.propagation.spec` · las guardas siguen el valor, no la forma.
 *
 * Gate **P0-G5**. Tras tres rondas de «un `if` por evasión», la auditoría exigió lo
 * contrario: un análisis de punto fijo que siga un valor por declaraciones,
 * asignaciones simples y compuestas, desestructuración, propiedades, arrays,
 * `bind`/`call`/`apply`, retornos, argumentos y alias intermedios. Está en
 * `tools/guards/lib/dataflow.mjs`, y estas pruebas son su contrato.
 *
 * ---------------------------------------------------------------------------
 * Cada fixture infractor cumple cuatro cosas
 *
 *   1. es TypeScript válido: `assertCompiles` construye un programa con el
 *      `tsconfig.json` real y exige cero diagnósticos en el fixture;
 *   2. ejecuta la guarda real como proceso hijo;
 *   3. termina con código distinto de cero;
 *   4. produce el hallazgo concreto, no uno cualquiera.
 *
 * Y cada control legítimo cumple las mismas, con código cero. Sin los controles, una
 * guarda que fallara con cualquier código pasaría todo lo de arriba.
 * ---------------------------------------------------------------------------
 */

const client = (lines: string[]) => ["'use client';", '', ...lines].join('\n');
const server = (lines: string[]) => lines.join('\n');

const CANONICAL = 'apps/web/src/server/auth/identity.ts';
const REGISTRY = 'packages/domain/src/authority-registry.json';

/** Escribe, compila, ejecuta la guarda y borra. */
function fixture(
  guard: 'client-authority-guard.mjs' | 'auth-authority-guard.mjs',
  files: Record<string, string>,
) {
  return withViolations(files, () => {
    assertCompiles(Object.keys(files));
    return runGuard(guard);
  });
}

describe('P1 · los seis fixtures que la auditoría exigió', () => {
  it('1 · miembro computado almacenado en un objeto y luego invocado', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_prop-stored-opaque.tsx': client([
        'export function evade(query: any, method: string, payload: unknown) {',
        '  const operations = { run: query[method] };',
        '  return operations.run(payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('Invocación de `operations.run`');
    expect(result.output).toContain('nombre computado no demostrable');
    expect(result.output).toContain('Almacenarlo en un objeto');
  });

  it('2 · `userId += raw` · la asignación compuesta invalida la procedencia', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-compound.ts': server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function evade(db: any, raw: string) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  let userId = identity.userId;',
        '  userId += raw;',
        "  return db.from('t').select().eq('user_id', userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe `userId`');
    expect(result.output).toContain('ha sido mutado después');
  });

  it('3 · mutación de `identity.userId` · escribir una propiedad muta la identidad', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-mutated-identity.ts': server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function evade(db: any, raw: string) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  (identity as { userId: string }).userId = raw;',
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"user_id" recibe `identity.userId`');
    expect(result.output).toContain('ha sido mutado después');
  });

  it('4 · alias de `.eq` por asignación posterior a la declaración', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-late-alias.ts': server([
        'export async function evade(db: any, raw: string) {',
        "  const query = db.from('t').select();",
        '  let filterByOwner;',
        '  filterByOwner = query.eq;',
        "  return filterByOwner('owner_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"owner_id" recibe `raw` en .eq()');
  });

  it('5 · verificador homónimo anidado dentro del módulo canónico', () => {
    // El fixture vive DENTRO del fichero canónico: se le añade una función con un
    // `requireVerifiedIdentity` anidado y se restaura el fichero pase lo que pase.
    const original = readFileSync(join(REPO_ROOT, CANONICAL), 'utf8');
    const extended = `${original}
export async function evadeInsideCanonical(db: any, raw: string) {
  function requireVerifiedIdentity() {
    return { userId: raw };
  }
  const identity = requireVerifiedIdentity();
  return db.from('t').select().eq('user_id', identity.userId);
}
`;

    const result = withReplacedFile(CANONICAL, extended, () => {
      assertCompiles([CANONICAL]);
      return runGuard('auth-authority-guard.mjs');
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain(CANONICAL);
    expect(result.output).toContain('"user_id" recibe `identity.userId`');
    expect(result.output).toContain('no deriva del verificador');
    // Y solo ese hallazgo: las funciones canónicas reales del mismo fichero no saltan.
    expect(result.output.match(/"user_id" recibe/g)?.length ?? 0).toBe(1);
  });

  it('6 · `window.delete()` · un global con `delete` no hereda la excepción de caches', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_prop-window-delete.tsx': client([
        'declare global {',
        '  interface Window {',
        '    delete(payload: unknown): unknown;',
        '  }',
        '}',
        '',
        'export function evade(payload: unknown) {',
        '  return window.delete(payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('El miembro ".delete" se invoca');
  });
});

describe('P2 · lo mismo por otros caminos, para que no sea un `if` disfrazado', () => {
  it('el miembro opaco sobrevive a un array, a `push` y a un retorno', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_prop-opaque-paths.tsx': client([
        'export function porArray(query: any, method: string, payload: unknown) {',
        '  const ops = [query[method]];',
        '  return ops[0](payload);',
        '}',
        'export function porPush(query: any, method: string, payload: unknown) {',
        '  const ops: unknown[] = [];',
        '  ops.push(query[method]);',
        '  return (ops[0] as (p: unknown) => unknown)(payload);',
        '}',
        'export function porRetorno(query: any, method: string, payload: unknown) {',
        '  const extraer = () => query[method];',
        '  const fn = extraer();',
        '  return fn(payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output.match(/nombre computado no demostrable/g)?.length ?? 0).toBe(3);
  });

  it('la escritura sobrevive a `call`, `apply`, un argumento y una propiedad', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_prop-write-paths.tsx': client([
        'export function porArgumento(query: any, payload: unknown) {',
        '  const ejecutar = (fn: (p: unknown) => unknown) => fn(payload);',
        '  return ejecutar(query.update);',
        '}',
        'export function porPropiedad(query: any, payload: unknown) {',
        '  const box = { inner: { fn: query.upsert } };',
        '  return box.inner.fn.call(query, payload);',
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    // El acceso ya es hallazgo; y además la invocación llega por propagación.
    expect(result.output).toContain('se pasa como argumento');
    expect(result.output).toContain('por propagación');
  });

  it('la mutación invalida también por `++`, `Object.assign`, `Reflect.set` y `defineProperty`', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-mutators.ts': server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function assign(db: any, raw: string) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  Object.assign(identity, { userId: raw });',
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
        'export async function reflect(db: any, raw: string) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        "  Reflect.set(identity, 'userId', raw);",
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
        'export async function define(db: any, raw: string) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        "  Object.defineProperty(identity, 'userId', { value: raw });",
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
        'export async function incremento(db: any) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  let contador = identity.userId as unknown as number;',
        '  contador++;',
        "  return db.from('t').select().eq('user_id', contador);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output.match(/ha sido mutado después/g)?.length ?? 0).toBe(4);
  });

  it('la reasignación destructurada y el `?:` con una rama cruda envenenan', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-poison-paths.ts': server([
        "import { getVerifiedIdentity } from './auth/identity';",
        '',
        'export async function destructurada(db: any, raw: { userId: string }) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  let userId = identity.userId;',
        '  ({ userId } = raw);',
        "  return db.from('t').select().eq('user_id', userId);",
        '}',
        'export async function ternario(db: any, raw: string, usarRaw: boolean) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        '  const userId = usarRaw ? raw : identity.userId;',
        "  return db.from('t').select().eq('user_id', userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output.match(/"user_id" recibe/g)?.length ?? 0).toBe(2);
  });

  it('el alias del sumidero sobrevive a `bind`, a un contenedor y a un retorno', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-sink-paths.ts': server([
        'export async function porBind(db: any, raw: string) {',
        "  const query = db.from('t').select();",
        '  const eq = query.eq.bind(query);',
        "  return eq('user_id', raw);",
        '}',
        'export async function porContenedor(db: any, raw: string) {',
        "  const query = db.from('t').select();",
        '  const ops = { filtrar: query.eq };',
        "  return ops.filtrar('profile_id', raw);",
        '}',
        'export async function porRetorno(db: any, raw: string) {',
        "  const query = db.from('t').select();",
        '  const dame = () => query.eq;',
        "  return dame()('owner_id', raw);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output.match(/recibe `raw` en \.eq\(\)/g)?.length ?? 0).toBe(3);
  });
});

describe('P3 · la allowlist de RPC funciona de verdad', () => {
  const registry = readFileSync(join(REPO_ROOT, REGISTRY), 'utf8');
  const withProbe = JSON.stringify(
    {
      ...(JSON.parse(registry) as Record<string, unknown>),
      readOnlyRpcs: {
        ...(JSON.parse(registry) as { readOnlyRpcs: Record<string, unknown> }).readOnlyRpcs,
        names: ['read_only_probe'],
      },
    },
    null,
    2,
  );

  it('control positivo · una RPC literal incluida en la allowlist pasa', () => {
    const result = withReplacedFile(REGISTRY, withProbe, () =>
      fixture('client-authority-guard.mjs', {
        'apps/web/src/app/_rpc-allowed.tsx': client([
          'export async function leer(supabase: any) {',
          "  return supabase.rpc('read_only_probe', { limit: 10 });",
          '}',
        ]),
      }),
    );

    expect(result.exitCode, result.output).toBe(0);
    expect(result.output).toContain('1 RPC en la allowlist');
  });

  it('la misma RPC sin estar en la allowlist falla', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/app/_rpc-not-allowed.tsx': client([
        'export async function leer(supabase: any) {',
        "  return supabase.rpc('read_only_probe', { limit: 10 });",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('"read_only_probe", que no está en la allowlist');
  });

  it('con la allowlist activa, una RPC dinámica y una extraída siguen fallando', () => {
    const result = withReplacedFile(REGISTRY, withProbe, () =>
      fixture('client-authority-guard.mjs', {
        'apps/web/src/app/_rpc-dynamic-extracted.tsx': client([
          'export async function dinamica(supabase: any, name: string) {',
          '  return supabase.rpc(name);',
          '}',
          'export async function extraida(supabase: any) {',
          '  const llamar = supabase.rpc;',
          "  return llamar('read_only_probe');",
          '}',
          'export async function desestructurada(supabase: any) {',
          '  const { rpc } = supabase;',
          "  return rpc('read_only_probe');",
          '}',
        ]),
      }),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('nombre no puede resolverse a un literal');
    expect(result.output.match(/RPC extraída/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('la RPC autoritativa se denuncia con su ancla, tras comprobar la allowlist', () => {
    const result = withReplacedFile(REGISTRY, withProbe, () =>
      fixture('client-authority-guard.mjs', {
        'apps/web/src/app/_rpc-authoritative.tsx': client([
          'export async function recalcular(supabase: any) {',
          "  return supabase.rpc('recalculate_mastery', {});",
          '}',
        ]),
      }),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('RPC autoritativa');
    expect(result.output).toContain('1 entradas');
  });
});

describe('P4 · controles positivos · lo legítimo sigue pasando', () => {
  it('el repositorio real pasa las dos guardas', () => {
    expect(runGuard('client-authority-guard.mjs').exitCode).toBe(0);
    expect(runGuard('auth-authority-guard.mjs').exitCode).toBe(0);
  });

  it('`caches.delete(key)` directo sobre el global', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/lib/_prop-legit-caches.ts': [
        'export async function limpiar(keys: string[]) {',
        "  await caches.delete('v1');",
        '  return Promise.all(keys.map((key) => caches.delete(key)));',
        '}',
      ].join('\n'),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('identidad canónica real, directa y por espacio de nombres', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-legit-identity.ts': server([
        "import { getVerifiedIdentity } from './auth/identity';",
        "import * as identidad from './auth/identity';",
        '',
        'export async function directa(db: any) {',
        '  const identity = await getVerifiedIdentity();',
        '  if (!identity) return null;',
        "  return db.from('t').select().eq('user_id', identity.userId);",
        '}',
        'export async function porEspacio(db: any) {',
        "  const identity = await identidad.requireVerifiedIdentity('_legit');",
        '  const { userId } = identity;',
        "  return db.from('t').insert({ user_id: userId, locale: 'es' });",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('reasignación desde otra identidad verificada', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-legit-reassign.ts': server([
        "import { getVerifiedIdentity, requireVerifiedIdentity } from './auth/identity';",
        '',
        'export async function leer(db: any, estricto: boolean) {',
        '  let identity = await getVerifiedIdentity();',
        "  if (estricto) identity = await requireVerifiedIdentity('_legit');",
        '  if (!identity) return null;',
        '  let userId = identity.userId;',
        '  userId = identity.userId;',
        "  return db.from('t').select().eq('user_id', userId);",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('acceso ordinario a registros con clave variable', () => {
    const result = fixture('client-authority-guard.mjs', {
      'apps/web/src/lib/_prop-legit-record.ts': [
        'const tabla: Record<string, { titulo: string; contar: () => number }> = {};',
        '',
        'export function leer(clave: string) {',
        '  const fila = tabla[clave];',
        '  const copia = { ...fila };',
        '  return copia.titulo ?? null;',
        '}',
        'export function contar(clave: string) {',
        '  return tabla[clave]?.contar() ?? 0;',
        '}',
      ].join('\n'),
    });

    expect(result.exitCode, result.output).toBe(0);
  });

  it('`Array.prototype.filter`, `.select().eq()` y una columna constante inocua', () => {
    const result = fixture('auth-authority-guard.mjs', {
      'apps/web/src/server/_prop-legit-misc.ts': server([
        "const COLUMNA = 'locale';",
        '',
        'export function limpiar(claves: string[], actual: string) {',
        '  return claves.filter((clave) => clave !== actual);',
        '}',
        'export async function leer(db: any, valor: string) {',
        "  return db.from('t').select().eq(COLUMNA, valor)['neq']('estado', 'borrado');",
        '}',
      ]),
    });

    expect(result.exitCode, result.output).toBe(0);
  });
});
