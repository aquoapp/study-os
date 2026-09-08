import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  createTestUser,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
  type TestUser,
} from '../support/supabase-test-env';

/**
 * `profile.oneToOne.spec` · check de CI `test:integration` (Execution Plan §4).
 *
 * REQ-A07 · «Auth con perfil separado de la identidad de auth» ·
 * criterio: «Alta y login funcionan; `profiles` 1:1 con `auth.users`».
 * P0-S5 · gate del checkpoint de Phase 0.
 */

let env: TestEnv;
const createdUserIds: string[] = [];

beforeAll(() => {
  env = readTestEnv();
});

afterAll(async () => {
  for (const id of createdUserIds) {
    await deleteTestUser(env, id);
  }
});

async function newUser(label: string): Promise<TestUser> {
  const user = await createTestUser(env, label);
  createdUserIds.push(user.id);
  return user;
}

describe('profile.oneToOne · REQ-A07', () => {
  it('el alta de un usuario crea exactamente un perfil', async () => {
    const user = await newUser('one-to-one');
    const admin = adminClient(env);

    const { data, error } = await admin.from('profiles').select('id').eq('id', user.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(user.id);
  });

  it('el identificador del perfil es el mismo que el de auth.users', async () => {
    const user = await newUser('same-id');
    const { data, error } = await user.client.from('profiles').select('id').single();

    expect(error).toBeNull();
    expect(data?.id).toBe(user.id);
  });

  it('no puede existir un segundo perfil para el mismo usuario', async () => {
    const user = await newUser('duplicate');
    const admin = adminClient(env);

    const { error } = await admin.from('profiles').insert({ id: user.id });

    // La clave primaria lo impide: la unicidad es estructural, no una comprobación
    // que la aplicación deba recordar hacer.
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('no puede existir un perfil sin usuario de auth', async () => {
    const admin = adminClient(env);
    const orphanId = '00000000-0000-4000-8000-000000000000';

    const { error } = await admin.from('profiles').insert({ id: orphanId });

    expect(error).not.toBeNull();
    expect(error?.code).toBe('23503'); // violación de clave foránea
  });

  it('borrar el usuario borra su perfil en cascada', async () => {
    const user = await createTestUser(env, 'cascade');
    const admin = adminClient(env);

    await deleteTestUser(env, user.id);

    const { data, error } = await admin.from('profiles').select('id').eq('id', user.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('el perfil nace con los valores por defecto esperados', async () => {
    const user = await newUser('defaults');
    const { data, error } = await user.client
      .from('profiles')
      .select('id, display_name, locale, created_at, updated_at')
      .single();

    expect(error).toBeNull();
    expect(data?.locale).toBe('es');
    expect(data?.display_name).toBeNull();
    expect(data?.created_at).toBeTruthy();
    expect(data?.updated_at).toBeTruthy();
  });

  it('el usuario puede actualizar su nombre visible', async () => {
    const user = await newUser('update-own');

    const { error } = await user.client
      .from('profiles')
      .update({ display_name: 'Nombre de prueba' })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data } = await user.client.from('profiles').select('display_name').single();
    expect(data?.display_name).toBe('Nombre de prueba');
  });

  it('updated_at avanza al actualizar', async () => {
    const user = await newUser('updated-at');
    const before = await user.client.from('profiles').select('updated_at').single();

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await user.client.from('profiles').update({ display_name: 'Otro nombre' }).eq('id', user.id);

    const after = await user.client.from('profiles').select('updated_at').single();

    expect(new Date(after.data?.updated_at ?? 0).getTime()).toBeGreaterThan(
      new Date(before.data?.updated_at ?? 0).getTime(),
    );
  });

  it('rechaza un locale con formato inválido', async () => {
    const user = await newUser('locale-check');

    const { error } = await user.client
      .from('profiles')
      .update({ locale: 'castellano' })
      .eq('id', user.id);

    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514'); // violación de CHECK
  });

  it('el usuario no puede reasignar su perfil a otra persona', async () => {
    const owner = await newUser('reassign-owner');
    const other = await newUser('reassign-other');

    const { error } = await owner.client
      .from('profiles')
      .update({ id: other.id })
      .eq('id', owner.id);

    // Sin grant de UPDATE sobre `id`, la columna no es escribible por el usuario.
    expect(error).not.toBeNull();
  });
});
