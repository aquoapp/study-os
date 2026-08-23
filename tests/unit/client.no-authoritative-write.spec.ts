import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  SERVER_AUTHORITATIVE_PROJECTIONS,
  SERVER_AUTHORITATIVE_RPCS,
  isAuthoritative,
  isServerAuthoritativeProjection,
  isServerAuthoritativeRpc,
  localProjection,
} from '@study-os/domain';

import registry from '../../packages/domain/src/authority-registry.json';

import { REPO_ROOT, runGuard, withViolation } from './lib/run-guard';

/**
 * Check de CI: `client-authority-guard` (Execution Plan §4).
 *
 * INV-113 · «El servidor es la autoridad exclusiva para persistir Mastery, Exam
 * Readiness y estado del Planner.»
 * REQ-A08 · ADR-001 v1.1 punto 2 · gate P0-G3 · gate P0-G5
 */

describe('client.no-authoritative-write · INV-113 · REQ-A08', () => {
  it('el repositorio actual no contiene ninguna escritura autoritativa de cliente', () => {
    const result = runGuard('client-authority-guard.mjs');
    expect(result.output).toContain('sin hallazgos');
    expect(result.exitCode).toBe(0);
  });

  it('P0-G5 · la guarda falla ante una escritura de cliente sobre concept_mastery', () => {
    const result = withViolation(
      'apps/web/src/app/_violation-check.tsx',
      [
        "'use client';",
        "import { createSupabaseBrowserClient } from '../lib/supabase/browser-client';",
        'export async function violate() {',
        '  const supabase = createSupabaseBrowserClient();',
        "  await supabase.from('concept_mastery').upsert({ score: 1 });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('concept_mastery');
  });

  it('P0-G5 · la guarda falla si un fichero de cliente nombra la clave de rol de servicio', () => {
    const result = withViolation(
      'apps/web/src/app/_violation-secret.tsx',
      ["'use client';", 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;'].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('una proyección local queda marcada como no autoritativa', () => {
    const projection = localProjection({ estimated: 0.4 }, 'optimistic-feedback');

    expect(projection.authoritative).toBe(false);
    expect(isAuthoritative(projection)).toBe(false);
    expect(projection.reason).toBe('optimistic-feedback');
  });

  it('la lista de proyecciones autoritativas cubre Mastery, Readiness y Planner', () => {
    // La lista vive en `authority-registry.json` para que el código y la guarda
    // lean lo mismo. Aquí se comprueba que cubre las tres proyecciones que nombra
    // INV-113, no un orden concreto.
    for (const table of ['concept_mastery', 'exam_readiness', 'planner_runs', 'planner_items']) {
      expect([...SERVER_AUTHORITATIVE_PROJECTIONS], `falta ${table}`).toContain(table);
    }
    expect(isServerAuthoritativeProjection('concept_mastery')).toBe(true);
    expect(isServerAuthoritativeProjection('profiles')).toBe(false);
  });

  it('el registro de RPC autoritativas no está vacío y ancla cada nombre a un invariante', () => {
    // Un registro vacío haría que la comprobación de RPC pasara siempre sin
    // comprobar nada.
    expect(SERVER_AUTHORITATIVE_RPCS.length).toBeGreaterThan(0);
    expect(isServerAuthoritativeRpc('recalculate_mastery')).toBe(true);
    expect(isServerAuthoritativeRpc('search_public_glossary')).toBe(false);

    const anchors: Record<string, string> = registry.rpcs.anchors;
    for (const rpc of SERVER_AUTHORITATIVE_RPCS) {
      expect(anchors[rpc], `la RPC "${rpc}" no declara su anclaje`).toBeTruthy();
    }
  });

  it('el código y la guarda leen el mismo registro', () => {
    const guard = readFileSync(join(REPO_ROOT, 'tools/guards/client-authority-guard.mjs'), 'utf8');
    expect(guard).toContain('packages/domain/src/authority-registry.json');
  });
});
