import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `schema.drift.spec` · prueba del check `schema-drift`.
 *
 * REQ-A04 · «Migraciones versionadas en repositorio»
 * EC-011 · «Production schema cannot be governed by undocumented dashboard edits»
 * P0-S4 · «migración 0 aplicable y **reversible**»
 *
 * Comprueba las propiedades estáticas del conjunto de migraciones. La comparación
 * real contra una base de datos vive en `tools/guards/schema-drift.mjs` nivel B y
 * exige `SUPABASE_DB_URL`.
 */

const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');

function listMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

describe('schema.drift · REQ-A04 · EC-011', () => {
  const migrations = listMigrations();

  it('existe al menos la migración inicial', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('todas siguen el patrón de nombre ordenable', () => {
    for (const name of migrations) {
      expect(name, `nombre inválido: ${name}`).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    }
  });

  it('no hay prefijos duplicados', () => {
    const prefixes = migrations.map((name) => name.slice(0, 14));
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('cada migración tiene su rollback', () => {
    const downs = new Set(readdirSync(join(MIGRATIONS_DIR, 'down')));
    for (const name of migrations) {
      const expected = name.replace(/\.sql$/, '.down.sql');
      expect(downs, `falta el rollback de ${name}`).toContain(expected);
    }
  });

  it('ninguna migración crea tablas de Phase 2 en adelante: Phase 1A no las entrega', () => {
    // Execution Plan §9 · «No crear tablas de dominio ni de contenido» regía Phase 0.
    // Phase 1A (2026-09-09) autoriza el contenido canónico; lo de aprendiz, evidencia,
    // motores y planner sigue prohibido hasta su fase.
    const domainTables = [
      'learning_events',
      'question_attempts',
      'concept_mastery',
      'exam_readiness',
      'planner_runs',
      'planner_items',
      'learning_units',
      'sessions',
      'study_sessions',
      'session_items',
      'learner_settings',
      'learner_exam_goals',
      'diagnostic_runs',
    ];

    for (const name of migrations) {
      const sql = readMigration(name).toLowerCase();
      for (const table of domainTables) {
        expect(sql, `${name} crea la tabla de dominio ${table}`).not.toMatch(
          new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${table}\\b`),
        );
      }
    }
  });

  it('ninguna migración habilita pgvector: ADR-001 lo difiere a Phase 8', () => {
    for (const name of migrations) {
      expect(readMigration(name).toLowerCase()).not.toContain(
        'create extension if not exists "vector"',
      );
      expect(readMigration(name).toLowerCase()).not.toContain('create extension vector');
    }
  });

  describe('migración de profiles', () => {
    const profiles = migrations.find((name) => name.includes('profiles'));
    const sql = profiles ? readMigration(profiles).toLowerCase() : '';

    it('existe', () => {
      expect(profiles).toBeDefined();
    });

    it('EC-009 · habilita RLS en la misma migración que crea la tabla', () => {
      expect(sql).toContain('alter table public.profiles enable row level security');
    });

    it('fuerza RLS también para el propietario de la tabla', () => {
      expect(sql).toContain('force row level security');
    });

    it('REQ-A07 · la relación con auth.users es 1:1 por clave primaria', () => {
      expect(sql).toMatch(/id\s+uuid\s+primary\s+key\s+references\s+auth\.users/);
    });

    it('el borrado del usuario arrastra su perfil', () => {
      expect(sql).toContain('on delete cascade');
    });

    it('las políticas se restringen al propio usuario', () => {
      expect(sql).toContain('auth.uid()) = id');
    });

    it('anon no conserva ningún grant', () => {
      expect(sql).toContain('revoke all on public.profiles from anon');
    });

    it('la función definer fija search_path vacío', () => {
      // Sin esto, una función `security definer` es una vía de escalada.
      expect(sql).toContain('security definer');
      expect(sql).toContain("set search_path = ''");
    });
  });
});
