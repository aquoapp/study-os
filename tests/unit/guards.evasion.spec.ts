import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT, runGuard, withViolation, withViolations } from './lib/run-guard';

/**
 * Evasiones que la auditoría externa demostró contra las guardas anteriores.
 *
 * Gate **P0-G5**. Cada caso es un camino real por el que el control podía
 * atravesarse; cada uno debe hacer fallar la guarda **de verdad**, no un doble.
 *
 * ---------------------------------------------------------------------------
 * Qué cambió en las guardas para cerrarlos
 *
 * `client-authority-guard` pasó de lista negra a **política conservadora**: en
 * superficie de cliente no se permite ninguna escritura ni ninguna `.rpc()` que no
 * esté en una allowlist explícita de solo lectura. Ya no necesita adivinar a qué
 * tabla se escribe, así que partir la cadena o esconder el nombre en una constante
 * deja de servir.
 *
 * `auth-authority-guard` pasó de contaminación a **procedencia positiva**: un valor
 * usado como identidad solo vale si se puede demostrar que sale del verificador.
 * Renombrar la variable ya no ayuda, porque el nombre nunca fue lo que se miraba.
 * ---------------------------------------------------------------------------
 */

describe('E1 · client-authority · cadena partida, alias y constantes', () => {
  it('rechaza la escritura con la cadena partida en variables', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-split.tsx',
      [
        "'use client';",
        '',
        'export async function evade(supabase: any) {',
        "  const query = supabase.from('profiles');",
        '  const alias = query;',
        '  return alias.update({ display_name: "x" });',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.update()');
  });

  it('rechaza la escritura con el nombre de tabla en una constante', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-const-table.tsx',
      [
        "'use client';",
        '',
        "const TABLE = 'concept_mastery';",
        '',
        'export async function evade(supabase: any) {',
        '  return supabase.from(TABLE).upsert({ score: 1 });',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.upsert()');
  });

  it('rechaza la escritura con el método computado', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-computed.tsx',
      [
        "'use client';",
        '',
        "const METHOD = 'insert';",
        '',
        'export async function evade(supabase: any) {',
        "  return supabase.from('notes')[METHOD]({ body: 'x' });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('acceso computado');
  });

  it('rechaza la escritura sobre una tabla que no es una proyección registrada', () => {
    // La política conservadora ya no depende de reconocer la tabla.
    const result = withViolation(
      'apps/web/src/app/_evasion-unknown-table.tsx',
      [
        "'use client';",
        '',
        'export async function evade(supabase: any) {',
        "  return supabase.from('tabla_que_nadie_registro').delete();",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.delete()');
  });

  it('rechaza la escritura escondida en un helper transitivo de packages/**', () => {
    const result = withViolations(
      {
        'packages/domain/src/_evasion-helper.ts': [
          'export async function save(client: any, payload: unknown) {',
          "  return client.from('planner_items').insert(payload);",
          '}',
        ].join('\n'),
        'apps/web/src/app/_evasion-helper-user.tsx': [
          "'use client';",
          '',
          "import { save } from '@study-os/domain/_evasion-helper';",
          '',
          'export const use = save;',
        ].join('\n'),
      },
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('alcanzado desde');
  });
});

describe('E2 · client-authority · RPC contra allowlist', () => {
  it('rechaza cualquier RPC que no esté en la allowlist de solo lectura', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-rpc-unknown.tsx',
      [
        "'use client';",
        '',
        'export async function evade(supabase: any) {',
        "  return supabase.rpc('parece_una_lectura_pero_no_esta_en_la_lista');",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('allowlist');
  });

  it('rechaza la RPC cuyo nombre está en una constante y no está permitida', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-rpc-const.tsx',
      [
        "'use client';",
        '',
        "const FN = 'recalculate_mastery';",
        '',
        'export async function evade(supabase: any) {',
        '  return supabase.rpc(FN, {});',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('recalculate_mastery');
  });

  it('rechaza la RPC cuyo nombre no puede resolverse a un literal', () => {
    // No poder demostrar que es de lectura no equivale a que lo sea.
    const result = withViolation(
      'apps/web/src/app/_evasion-rpc-dynamic.tsx',
      [
        "'use client';",
        '',
        'export async function evade(supabase: any, name: string) {',
        '  return supabase.rpc(name, {});',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('no puede resolverse');
  });

  it('la allowlist de solo lectura está vacía en Phase 0 y es explícita', () => {
    const registry = JSON.parse(
      readFileSync(join(REPO_ROOT, 'packages/domain/src/authority-registry.json'), 'utf8'),
    ) as { readOnlyRpcs: { names: string[]; $comment: string[] } };

    expect(registry.readOnlyRpcs.names).toEqual([]);
    // Vacía por decisión, no por olvido.
    expect(registry.readOnlyRpcs.$comment.join(' ')).toContain('no es un descuido');
  });
});

describe('E1/E2 · casos legítimos que no deben saltar', () => {
  it('una lectura desde cliente no es un hallazgo', () => {
    const result = withViolation(
      'apps/web/src/app/_legit-select.tsx',
      [
        "'use client';",
        '',
        'export async function read(supabase: any) {',
        "  return supabase.from('profiles').select('id, display_name').single();",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una escritura desde una superficie de servidor no es un hallazgo', () => {
    const result = withViolation(
      'apps/web/src/server/_legit-write.ts',
      [
        "import 'server-only';",
        '',
        'export async function persist(supabase: any) {',
        "  return supabase.from('concept_mastery').upsert({ score: 1 });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('la Cache API del service worker no cuenta como escritura de datos', () => {
    // `caches.delete(key)` es almacenamiento del navegador, no una tabla. La
    // excepción está declarada en el registro y acotada a globales.
    const result = runGuard('client-authority-guard.mjs');
    expect(result.exitCode, result.output).toBe(0);
  });
});

describe('E3 · auth-authority · procedencia positiva', () => {
  it('rechaza el valor que llega por un parámetro `r: Request`', () => {
    // El nombre de la variable ya no importa: lo que importa es de dónde sale.
    const result = withViolation(
      'apps/web/src/app/_evasion-request-param.ts',
      [
        'export async function evade(supabase: any, r: Request) {',
        '  const raw = await r.json();',
        "  return supabase.from('profiles').select('*').eq('user_id', raw.u);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('user_id');
  });

  it('rechaza el valor envuelto en String(...)', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-string-wrap.ts',
      [
        'export async function evade(supabase: any, r: Request) {',
        '  const raw = await r.json();',
        '  const owner = String(raw.u);',
        "  return supabase.from('profiles').select('*').eq('user_id', owner);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('user_id');
  });

  it('rechaza el valor que devuelve un helper no verificado', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-helper-value.ts',
      [
        'function pickOwner(input: { u: string }) {',
        '  return input.u;',
        '}',
        '',
        'export async function evade(supabase: any, r: Request) {',
        '  const owner = pickOwner(await r.json());',
        "  return supabase.from('profiles').select('*').eq('owner_id', owner);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('owner_id');
  });

  it('rechaza el shorthand en el cuerpo de un insert', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-shorthand.ts',
      [
        'export async function evade(supabase: any, r: Request) {',
        '  const { user_id } = await r.json();',
        "  return supabase.from('notes').insert({ user_id, body: 'x' });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('shorthand');
  });

  it('rechaza el spread que puede arrastrar una columna de identidad', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-spread.ts',
      [
        'export async function evade(supabase: any, r: Request) {',
        '  const payload = await r.json();',
        "  return supabase.from('notes').insert({ ...payload });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('Spread');
  });

  it('rechaza el acceso computado a un objeto de petición', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-computed-access.ts',
      [
        "const KEY = 'u';",
        '',
        'export async function evade(supabase: any, r: Request) {',
        '  const raw = await r.json();',
        "  return supabase.from('profiles').select('*').eq('profile_id', raw[KEY]);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('profile_id');
  });

  it('rechaza el valor pasado a una RPC', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-rpc-identity.ts',
      [
        'export async function evade(supabase: any, r: Request) {',
        '  const raw = await r.json();',
        "  return supabase.rpc('run_planner', { user_id: raw.u });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.rpc()');
  });

  it('rechaza el valor dentro de un .in()', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-in.ts',
      [
        'export async function evade(supabase: any, r: Request) {',
        '  const raw = await r.json();',
        "  return supabase.from('profiles').select('*').in('user_id', [raw.u]);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.in()');
  });
});

describe('E4 · auth-authority · fabricar la marca', () => {
  it('rechaza `as VerifiedIdentity`', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-cast.ts',
      [
        "import type { VerifiedIdentity } from '@study-os/domain';",
        '',
        "export const fake = { userId: 'x' } as VerifiedIdentity;",
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('as VerifiedIdentity');
  });

  it('rechaza `satisfies VerifiedIdentity`', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-satisfies.ts',
      [
        "import type { VerifiedIdentity } from '@study-os/domain';",
        '',
        "export const fake = { userId: 'x' } satisfies VerifiedIdentity;",
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('satisfies VerifiedIdentity');
  });

  it('rechaza el doble cast a través de unknown', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-double-cast.ts',
      [
        "import type { VerifiedIdentity } from '@study-os/domain';",
        '',
        "export const fake = { userId: 'x' } as unknown as VerifiedIdentity;",
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('VerifiedIdentity');
  });

  it('rechaza construir la marca fuera del factory', () => {
    const result = withViolation(
      'apps/web/src/app/_evasion-brand.ts',
      [
        "import { unsafeBrandVerifiedIdentity } from '@study-os/domain/internal/identity';",
        '',
        "export const fake = unsafeBrandVerifiedIdentity({ userId: 'x', email: null, method: 'getUser' });",
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('identidad verificada');
  });
});

describe('E3/E4 · casos legítimos que no deben saltar', () => {
  it('el filtro por identidad verificada pasa', () => {
    const result = withViolation(
      'apps/web/src/app/_legit-identity.ts',
      [
        "import { requireVerifiedIdentity } from '../server/auth/identity';",
        '',
        'export async function safe(supabase: any) {',
        "  const identity = await requireVerifiedIdentity('prueba');",
        "  return supabase.from('profiles').select('*').eq('user_id', identity.userId);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('la desestructuración de la identidad verificada pasa', () => {
    const result = withViolation(
      'apps/web/src/app/_legit-destructure.ts',
      [
        "import { requireVerifiedIdentity } from '../server/auth/identity';",
        '',
        'export async function safe(supabase: any) {',
        "  const { userId } = await requireVerifiedIdentity('prueba');",
        "  return supabase.from('notes').insert({ user_id: userId, body: 'x' });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('un helper cuyo retorno deriva de la identidad verificada pasa', () => {
    const result = withViolation(
      'apps/web/src/app/_legit-helper.ts',
      [
        "import { requireVerifiedIdentity } from '../server/auth/identity';",
        '',
        'async function ownerId() {',
        "  const identity = await requireVerifiedIdentity('prueba');",
        '  return identity.userId;',
        '}',
        '',
        'export async function safe(supabase: any) {',
        "  return supabase.from('profiles').select('*').eq('user_id', await ownerId());",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });

  it('una columna que no es de identidad no se vigila', () => {
    const result = withViolation(
      'apps/web/src/app/_legit-other-column.ts',
      [
        'export async function safe(supabase: any, r: Request) {',
        '  const raw = await r.json();',
        "  return supabase.from('notes').select('*').eq('tag', raw.tag);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });
});
