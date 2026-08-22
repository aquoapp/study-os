import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ENVIRONMENTS,
  ENVIRONMENT_POLICIES,
  PUBLIC_ENV_ALLOWLIST,
  SERVER_ONLY_ENV_KEYS,
  isEnvironment,
  policyFor,
} from '@study-os/config';
import { readPublicConfig } from '@study-os/config/client';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `env.separation.spec` · gate **P0-G2** · «Separación de entornos ·
 * producción no accesible desde staging».
 *
 * REQ-A03 · EC-010 · Execution Plan §5.
 */

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('env.separation · REQ-A03 · gate P0-G2', () => {
  it('existen exactamente tres entornos', () => {
    expect([...ENVIRONMENTS]).toEqual(['local', 'staging', 'production']);
  });

  it('cada entorno declara su política completa', () => {
    for (const environment of ENVIRONMENTS) {
      const policy = policyFor(environment);
      expect(policy.environment).toBe(environment);
      expect(typeof policy.allowsDestructiveReset).toBe('boolean');
      expect(typeof policy.holdsRealUserData).toBe('boolean');
      expect(typeof policy.requiresSecureTransport).toBe('boolean');
    }
  });

  it('producción no admite reset destructivo', () => {
    expect(ENVIRONMENT_POLICIES.production.allowsDestructiveReset).toBe(false);
  });

  it('solo producción contiene datos reales de personas', () => {
    expect(ENVIRONMENT_POLICIES.production.holdsRealUserData).toBe(true);
    expect(ENVIRONMENT_POLICIES.staging.holdsRealUserData).toBe(false);
    expect(ENVIRONMENT_POLICIES.local.holdsRealUserData).toBe(false);
  });

  it('staging y producción exigen transporte seguro', () => {
    expect(ENVIRONMENT_POLICIES.staging.requiresSecureTransport).toBe(true);
    expect(ENVIRONMENT_POLICIES.production.requiresSecureTransport).toBe(true);
  });

  it('rechaza un nombre de entorno que no esté declarado', () => {
    expect(isEnvironment('prod')).toBe(false);
    expect(isEnvironment('dev')).toBe(false);
    expect(isEnvironment('')).toBe(false);
    expect(isEnvironment(undefined)).toBe(false);
  });

  describe('lectura de configuración', () => {
    it('falla en lugar de adivinar cuando el entorno es inválido', () => {
      process.env['NEXT_PUBLIC_ENVIRONMENT'] = 'preproduccion';
      expect(() => readPublicConfig()).toThrow(/NEXT_PUBLIC_ENVIRONMENT inválido/);
    });

    it('falla cuando falta una variable pública obligatoria', () => {
      process.env['NEXT_PUBLIC_ENVIRONMENT'] = 'local';
      delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
      delete process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
      expect(() => readPublicConfig()).toThrow(/Configuración ausente/);
    });

    it('devuelve la política del entorno leído', () => {
      process.env['NEXT_PUBLIC_ENVIRONMENT'] = 'production';
      process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://ejemplo.supabase.co';
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'clave-publica-de-prueba';

      const config = readPublicConfig();
      expect(config.environment).toBe('production');
      expect(config.policy.allowsDestructiveReset).toBe(false);
    });
  });

  describe('frontera cliente/servidor', () => {
    it('ninguna variable de servidor está en la allowlist pública', () => {
      for (const key of SERVER_ONLY_ENV_KEYS) {
        expect([...PUBLIC_ENV_ALLOWLIST]).not.toContain(key);
      }
    });

    it('toda variable de la allowlist lleva el prefijo NEXT_PUBLIC_', () => {
      for (const key of PUBLIC_ENV_ALLOWLIST) {
        expect(key.startsWith('NEXT_PUBLIC_')).toBe(true);
      }
    });

    it('el módulo de servidor está marcado server-only', () => {
      const source = readFileSync(join(REPO_ROOT, 'packages/config/src/server.ts'), 'utf8');
      expect(source.startsWith("import 'server-only';")).toBe(true);
    });

    it('el módulo de cliente no lee ninguna variable exclusiva de servidor', () => {
      const source = readFileSync(join(REPO_ROOT, 'packages/config/src/client.ts'), 'utf8');
      for (const key of SERVER_ONLY_ENV_KEYS) {
        expect(source).not.toContain(key);
      }
    });

    it('.env.example documenta la allowlist y no contiene ningún valor', () => {
      const example = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
      for (const key of PUBLIC_ENV_ALLOWLIST) {
        expect(example).toContain(key);
      }
      // Cada asignación queda vacía: el fichero enseña la forma, no el contenido.
      for (const line of example.split('\n')) {
        const assignment = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (assignment) {
          expect(assignment[2], `${assignment[1]} tiene un valor en .env.example`).toBe('');
        }
      }
    });
  });

  describe('guardas operativas', () => {
    it('.gitignore excluye los ficheros de entorno pero conserva el ejemplo', () => {
      const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');
      expect(gitignore).toContain('.env');
      expect(gitignore).toContain('!.env.example');
    });

    it('la configuración local de Supabase no apunta a un host remoto', () => {
      const config = readFileSync(join(REPO_ROOT, 'supabase/config.toml'), 'utf8');
      expect(config).toContain('site_url = "http://127.0.0.1:3000"');
      expect(config).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
    });
  });
});
