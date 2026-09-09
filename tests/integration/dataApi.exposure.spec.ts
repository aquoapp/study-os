import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
  type TestUser,
} from '../support/supabase-test-env';

/**
 * `dataApi.exposure.spec` · ADR-011 · gate P1A-G1.
 *
 * La lista de exposición del Data API es una frontera de seguridad con una sola
 * definición: el registro de autoridad. Aquí se comprueba (1) que `config.toml` la
 * repite tal cual y (2) que PostgREST, con la instancia real delante, no sirve nada
 * de `content` ni de `ingest` a ningún rol —ni siquiera al de servicio, porque los
 * esquemas no están expuestos— y niega a los roles de cliente las funciones de la
 * frontera de ingestión.
 *
 * INV-101 · fallo duro del Checkpoint Contract si una clave resultara legible.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface Registry {
  dataApi: { exposedSchemas: string[]; nonExposedSchemas: string[] };
  rpcs: { names: string[] };
}

const registry = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages/domain/src/authority-registry.json'), 'utf8'),
) as Registry;

let env: TestEnv;
let user: TestUser;

beforeAll(async () => {
  env = readTestEnv();
  user = await createTestUser(env, 'exposure');
});

afterAll(async () => {
  if (user) await deleteTestUser(env, user.id);
});

describe('la lista de exposición tiene una sola definición', () => {
  it('config.toml expone exactamente los esquemas del registro', () => {
    const toml = readFileSync(join(REPO_ROOT, 'supabase/config.toml'), 'utf8');
    const match = /^\s*schemas\s*=\s*\[([^\]]*)\]/m.exec(toml);
    expect(match).not.toBeNull();
    const configured = (match?.[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    expect(configured).toEqual(registry.dataApi.exposedSchemas);
    expect(registry.dataApi.exposedSchemas).toEqual(['public']);
    expect(registry.dataApi.nonExposedSchemas).toEqual(['content', 'ingest']);
  });
});

describe('PostgREST no sirve los esquemas no expuestos', () => {
  const privateTables: Array<[string, string]> = [
    ['content', 'answer_key_versions'],
    ['ingest', 'staged_items'],
    ['ingest', 'promotions'],
  ];

  for (const [schema, table] of privateTables) {
    it(`${schema}.${table} · anon`, async () => {
      const { data, error } = await anonClient(env).schema(schema).from(table).select('id');
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it(`${schema}.${table} · authenticated`, async () => {
      const { data, error } = await user.client.schema(schema).from(table).select('id');
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it(`${schema}.${table} · ni siquiera el rol de servicio por el Data API`, async () => {
      // No es el grant lo que lo impide: el esquema no está en la lista de exposición.
      const { data, error } = await adminClient(env).schema(schema).from(table).select('id');
      expect(error).not.toBeNull();
      expect(data).toBeNull();
      expect(error?.message ?? '').toMatch(/schema|exposed|not found|acceptable/i);
    });
  }
});

describe('las funciones de la frontera son solo de servidor', () => {
  const serverOnly = [
    'stage_item',
    'validate_staged_item',
    'publish_staged_item',
    'copy_forward_question_concepts',
    'purge_generated_pack',
  ];

  it('están registradas como RPC reservadas', () => {
    for (const name of serverOnly) expect(registry.rpcs.names).toContain(name);
  });

  for (const name of serverOnly) {
    it(`${name} · anon recibe denegación`, async () => {
      const { error } = await anonClient(env).rpc(name, {});
      expect(error).not.toBeNull();
    });

    it(`${name} · authenticated recibe denegación`, async () => {
      const { error } = await user.client.rpc(name, {});
      expect(error).not.toBeNull();
      // Permiso denegado (42501) o función no visible: nunca ejecución.
      expect(
        error?.code === '42501' ||
          /permission|denied|not find|function/i.test(error?.message ?? ''),
      ).toBe(true);
    });
  }
});

describe('el contenido canónico publicado sí es legible por authenticated y nunca por anon', () => {
  it('authenticated lee exam_packs sin error', async () => {
    const { error } = await user.client.from('exam_packs').select('id, slug').limit(1);
    expect(error).toBeNull();
  });

  it('anon no lee exam_packs', async () => {
    const { data, error } = await anonClient(env).from('exam_packs').select('id').limit(1);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
