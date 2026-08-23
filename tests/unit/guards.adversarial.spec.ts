import { describe, expect, it } from 'vitest';

import { runGuard, withViolation, withViolations } from './lib/run-guard';

/**
 * Pruebas adversariales de las guardas de invariante.
 *
 * Gate **P0-G5** · «Las guardas fallan ante una violación deliberada».
 *
 * ---------------------------------------------------------------------------
 * Por qué existe este fichero aparte
 *
 * La auditoría externa señaló que las guardas de la primera entrega eran
 * evadibles: buscaban texto, miraban solo `apps/**` y solo los ficheros con
 * `'use client'`. Las cinco pruebas de este fichero son exactamente los cinco
 * caminos de evasión que se denunciaron. Cada una escribe una infracción real en
 * el árbol, ejecuta la guarda de verdad y exige que termine en rojo.
 *
 * Una guarda que pasa cuando todo está bien no demuestra nada. Lo que hay que
 * demostrar es que **falla cuando debe**, y por el motivo correcto: por eso cada
 * prueba comprueba también el contenido del mensaje.
 * ---------------------------------------------------------------------------
 */

describe('P0-G5 · A1 · escritura autoritativa desde un componente de cliente en packages/**', () => {
  /**
   * Evasión que se corrige: la guarda anterior solo recorría `apps/**`. Bastaba
   * mover el componente a un paquete compartido para que dejara de verlo.
   */
  it('client-authority-guard rechaza un `use client` de packages/** que escribe concept_mastery', () => {
    const result = withViolation(
      'packages/design-system/src/_adversarial-write.tsx',
      [
        "'use client';",
        '',
        'export async function persistMastery(supabase: any, score: number) {',
        "  return supabase.from('concept_mastery').upsert({ score });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('concept_mastery');
    expect(result.output).toContain('packages/design-system/src/_adversarial-write.tsx');
    expect(result.output).toContain('INV-113');
  });

  it('también lo rechaza cuando la escritura está en un helper sin directiva, alcanzado por importación', () => {
    // Frontera transitiva: el fichero infractor no lleva ninguna marca. Llega al
    // navegador porque un componente de cliente lo importa.
    const result = withViolations(
      {
        'packages/domain/src/_adversarial-helper.ts': [
          'export async function writeReadiness(supabase: any, value: number) {',
          "  return supabase.from('exam_readiness').update({ value });",
          '}',
        ].join('\n'),
        'apps/web/src/app/_adversarial-consumer.tsx': [
          "'use client';",
          '',
          "import { writeReadiness } from '@study-os/domain/_adversarial-helper';",
          '',
          'export const use = writeReadiness;',
        ].join('\n'),
      },
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('exam_readiness');
    expect(result.output).toContain('alcanzado desde');
  });
});

describe('P0-G5 · A2 · RPC autoritativa invocada desde cliente', () => {
  /**
   * Evasión que se corrige: la guarda anterior solo miraba `.from(...)` con
   * métodos de escritura. Una RPC lograba el mismo efecto sin tocar ese patrón.
   */
  it('client-authority-guard rechaza una RPC del registro autoritativo', () => {
    const result = withViolation(
      'apps/web/src/app/_adversarial-rpc.tsx',
      [
        "'use client';",
        '',
        'export async function recompute(supabase: any) {',
        "  return supabase.rpc('recalculate_mastery', { concept_key: 'x' });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('recalculate_mastery');
    expect(result.output).toContain('RPC autoritativa');
    // El mensaje cita el invariante que ancla esa RPC, no una regla genérica.
    expect(result.output).toContain('EC-002');
  });

  it('no marca una RPC que no está en el registro', () => {
    // El registro es explícito a propósito: prohibir toda RPC convertiría la
    // guarda en un obstáculo y acabaría desactivada.
    const result = withViolation(
      'apps/web/src/app/_adversarial-rpc-ok.tsx',
      [
        "'use client';",
        '',
        'export async function ping(supabase: any) {',
        "  return supabase.rpc('search_public_glossary', { term: 'x' });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });
});

describe('P0-G5 · A3 · variantes de caja del nombre del pack', () => {
  /**
   * Evasión que se corrige: la guarda anterior solo buscaba `TAI` en mayúsculas.
   */
  const variants = ['TAI', 'tai', 'Tai', 'tAI', 'TaI'];

  for (const variant of variants) {
    it(`tai-literal rechaza la variante "${variant}"`, () => {
      const result = withViolation(
        'packages/domain/src/_adversarial-pack.ts',
        `export const DEFAULT_PACK = '${variant}';\n`,
        () => runGuard('tai-literal.mjs'),
      );

      expect(result.exitCode, result.output).toBe(1);
      expect(result.output).toContain('_adversarial-pack.ts');
    });
  }

  it('rechaza la variante embebida en un identificador con guion bajo', () => {
    const result = withViolation(
      'packages/domain/src/_adversarial-pack-id.ts',
      'export const tai_pack_id = 1;\n',
      () => runGuard('tai-literal.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
  });

  it('no marca palabras que solo contienen esas letras', () => {
    const result = withViolation(
      'packages/domain/src/_adversarial-falsepositive.ts',
      [
        'export const words = ["retain", "contains", "TAIL", "detail", "MOUNTAIN", "Taiwan"];',
        'export const captain = 1;',
        'export const TAILWIND = 2;',
      ].join('\n'),
      () => runGuard('tai-literal.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });
});

describe('P0-G5 · A4 · user_id de la petición mediante alias o desestructuración', () => {
  /**
   * Evasión que se corrige: la guarda anterior comparaba el texto
   * `.eq('user_id', body` y se esquivaba con cualquier variable intermedia.
   */
  it('rechaza la desestructuración con alias', () => {
    const result = withViolation(
      'apps/web/src/app/_adversarial-alias.ts',
      [
        'export async function leak(supabase: any, request: Request) {',
        '  const { user_id: uid } = await request.json();',
        "  return supabase.from('profiles').select('*').eq('user_id', uid);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('user_id');
    expect(result.output).toContain('_adversarial-alias.ts');
  });

  it('rechaza la desestructuración simple', () => {
    const result = withViolation(
      'apps/web/src/app/_adversarial-destructure.ts',
      [
        'export async function leak(supabase: any, body: { user_id: string }) {',
        '  const { user_id } = body;',
        "  return supabase.from('profiles').delete().eq('user_id', user_id);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('user_id');
  });

  it('rechaza la cadena de variables intermedias', () => {
    const result = withViolation(
      'apps/web/src/app/_adversarial-chain.ts',
      [
        'export async function leak(supabase: any, payload: any) {',
        '  const first = payload;',
        '  const second = first.user_id;',
        '  const owner = second;',
        "  return supabase.from('profiles').select('*').eq('user_id', owner);",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
  });

  it('rechaza el valor en el cuerpo de un insert', () => {
    const result = withViolation(
      'apps/web/src/app/_adversarial-insert.ts',
      [
        'export async function leak(supabase: any, request: Request) {',
        '  const input = await request.json();',
        "  return supabase.from('notes').insert({ user_id: input.owner, body: 'x' });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.insert()');
  });

  it('rechaza el valor pasado a una RPC', () => {
    const result = withViolation(
      'apps/web/src/app/_adversarial-rpc-owner.ts',
      [
        'export async function leak(supabase: any, searchParams: URLSearchParams) {',
        "  const owner = searchParams.get('u');",
        "  return supabase.rpc('run_planner', { user_id: owner });",
        '}',
      ].join('\n'),
      () => runGuard('auth-authority-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('.rpc()');
  });

  it('no marca el filtro por una identidad verificada en servidor', () => {
    const result = withViolation(
      'apps/web/src/app/_adversarial-ok.ts',
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
});

describe('P0-G5 · A5 · importación prohibida desde un paquete de cliente', () => {
  /**
   * Evasión que se corrige: la guarda anterior solo recorría `apps/**` y solo
   * reconocía `from '…'`.
   */
  it('import-guard rechaza el motor importado desde un `use client` en packages/**', () => {
    const result = withViolation(
      'packages/design-system/src/_adversarial-engine.tsx',
      [
        "'use client';",
        '',
        "import { computeMastery } from '@study-os/learning-engine';",
        '',
        'export const value = computeMastery;',
      ].join('\n'),
      () => runGuard('import-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('@study-os/learning-engine');
    expect(result.output).toContain('packages/design-system/src/_adversarial-engine.tsx');
  });

  it('lo rechaza también a través de un paquete intermedio sin directiva', () => {
    const result = withViolations(
      {
        'packages/domain/src/_adversarial-bridge.ts': [
          "export { buildPlan } from '@study-os/planner-engine';",
        ].join('\n'),
        'apps/web/src/app/_adversarial-bridge-user.tsx': [
          "'use client';",
          '',
          "import { buildPlan } from '@study-os/domain/_adversarial-bridge';",
          '',
          'export const value = buildPlan;',
        ].join('\n'),
      },
      () => runGuard('import-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('@study-os/planner-engine');
    expect(result.output).toContain('alcanzado desde');
  });

  it('lo rechaza con importación dinámica', () => {
    const result = withViolation(
      'packages/design-system/src/_adversarial-dynamic.ts',
      [
        "'use client';",
        '',
        'export async function load() {',
        "  return import('@study-os/learning-engine');",
        '}',
      ].join('\n'),
      () => runGuard('import-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain('dynamic');
  });

  it('no marca el motor importado desde una superficie de servidor', () => {
    const result = withViolation(
      'apps/web/src/server/_adversarial-allowed.ts',
      [
        "import 'server-only';",
        "import { computeMastery } from '@study-os/learning-engine';",
        '',
        'export const value = computeMastery;',
      ].join('\n'),
      () => runGuard('import-guard.mjs'),
    );

    expect(result.exitCode, result.output).toBe(0);
  });
});
