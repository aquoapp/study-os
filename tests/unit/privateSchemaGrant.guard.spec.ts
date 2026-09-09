import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT, runGuard, withReplacedFile, withViolation } from './lib/run-guard';

/**
 * ADR-011 · SI-1A-3 · la guarda estática de esquemas no expuestos.
 *
 * Igual que las cuatro guardas de Phase 0: probar que pasa cuando todo está bien no
 * demuestra nada; hay que probar que **falla** ante una violación deliberada.
 */

const VIOLATION = 'supabase/migrations/99999999999999_violation_private_grant.sql';

describe('private-schema-grant-guard · ADR-011', () => {
  it('el árbol actual no concede nada de cliente sobre content ni ingest', () => {
    const result = runGuard('private-schema-grant-guard.mjs');
    expect(result.output).toContain('sin hallazgos');
    expect(result.exitCode).toBe(0);
  });

  it('falla ante un GRANT a authenticated sobre una tabla de content', () => {
    const result = withViolation(
      VIOLATION,
      'grant select on content.answer_key_versions to authenticated;\n',
      () => runGuard('private-schema-grant-guard.mjs'),
    );
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('99999999999999_violation_private_grant.sql');
  });

  it('falla ante USAGE de esquema para anon', () => {
    const result = withViolation(VIOLATION, 'grant usage on schema ingest to anon;\n', () =>
      runGuard('private-schema-grant-guard.mjs'),
    );
    expect(result.exitCode).toBe(1);
  });

  it('falla ante privilegios por defecto para roles de cliente', () => {
    const result = withViolation(
      VIOLATION,
      'alter default privileges in schema content grant select on tables to authenticated;\n',
      () => runGuard('private-schema-grant-guard.mjs'),
    );
    expect(result.exitCode).toBe(1);
  });

  it('falla ante una política para roles de cliente sobre una tabla no expuesta', () => {
    const result = withViolation(
      VIOLATION,
      'create policy leak on content.answer_key_versions for select to authenticated using (true);\n',
      () => runGuard('private-schema-grant-guard.mjs'),
    );
    expect(result.exitCode).toBe(1);
  });

  it('no salta con el texto de un comentario ni de una cadena', () => {
    const result = withViolation(
      VIOLATION,
      "-- grant select on content.answer_key_versions to authenticated;\nselect 'grant usage on schema content to anon';\n",
      () => runGuard('private-schema-grant-guard.mjs'),
    );
    expect(result.exitCode).toBe(0);
  });

  it('falla si config.toml expone un esquema no expuesto o difiere del registro', () => {
    const original = readFileSync(join(REPO_ROOT, 'supabase/config.toml'), 'utf8');
    const tampered = original.replace('schemas = ["public"]', 'schemas = ["public", "content"]');
    expect(tampered).not.toBe(original);
    const result = withReplacedFile('supabase/config.toml', tampered, () =>
      runGuard('private-schema-grant-guard.mjs'),
    );
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('config.toml');
  });

  it('forma parte de la cadena de guardas', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['guard:private-schemas']).toBe(
      'node tools/guards/private-schema-grant-guard.mjs',
    );
    expect(pkg.scripts['guards']).toContain('guard:private-schemas');
  });
});
