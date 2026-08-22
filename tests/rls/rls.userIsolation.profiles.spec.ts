import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
  type TestUser,
} from '../support/supabase-test-env';

/**
 * `rls.userIsolation.profiles.spec` · check de CI `test:rls` (Execution Plan §4).
 *
 * EC-009 · «Aislamiento RLS probado en toda tabla expuesta de usuario.
 *           User A must not read or mutate User B data.»
 * REQ-C13 · «RLS con test de aislamiento por tabla» ·
 *           criterio: «Lectura y escritura cruzada denegadas».
 * Manifest §5 · «RLS/user isolation is P0».
 *
 * **Fallo duro del Checkpoint Contract**: un test de aislamiento RLS en rojo impide
 * PASS en cualquier fase.
 */

let env: TestEnv;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  env = readTestEnv();
  alice = await createTestUser(env, 'alice');
  bob = await createTestUser(env, 'bob');
});

afterAll(async () => {
  if (alice) await deleteTestUser(env, alice.id);
  if (bob) await deleteTestUser(env, bob.id);
});

describe('rls.userIsolation.profiles · EC-009 · REQ-C13', () => {
  describe('lectura', () => {
    it('cada usuario ve su propio perfil', async () => {
      const { data, error } = await alice.client.from('profiles').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.id).toBe(alice.id);
    });

    it('Alice no ve el perfil de Bob ni pidiéndolo por su id', async () => {
      const { data, error } = await alice.client.from('profiles').select('id').eq('id', bob.id);

      // RLS no produce error: filtra. El resultado vacío ES la denegación.
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('una consulta sin filtro no devuelve más de una fila', async () => {
      const { data, error } = await bob.client.from('profiles').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.id).toBe(bob.id);
    });

    it('un cliente anónimo no lee ningún perfil', async () => {
      const { data, error } = await anonClient(env).from('profiles').select('id');
      // Sin grant para `anon`: o error de permisos, o conjunto vacío. Nunca datos.
      expect(data ?? []).toHaveLength(0);
      if (error) expect(error.message).toBeTruthy();
    });
  });

  describe('escritura', () => {
    it('Alice no puede modificar el perfil de Bob', async () => {
      const { error } = await alice.client
        .from('profiles')
        .update({ display_name: 'secuestrado' })
        .eq('id', bob.id);

      const { data: bobProfile } = await bob.client
        .from('profiles')
        .select('display_name')
        .single();
      expect(bobProfile?.display_name).not.toBe('secuestrado');
      if (error) expect(error).toBeTruthy();
    });

    it('Alice no puede insertar un perfil para Bob', async () => {
      const { error } = await alice.client.from('profiles').insert({ id: bob.id });
      expect(error).not.toBeNull();
    });

    it('Alice no puede borrar el perfil de Bob', async () => {
      const { error } = await alice.client.from('profiles').delete().eq('id', bob.id);

      const { data: bobProfile } = await bob.client.from('profiles').select('id').single();
      expect(bobProfile?.id).toBe(bob.id);
      if (error) expect(error).toBeTruthy();
    });

    it('nadie puede borrar su propio perfil: no hay política de DELETE', async () => {
      // El borrado de cuenta es OBS-03 y se decide antes de producción (Phase 11).
      // Hasta entonces, la ausencia de política es la decisión.
      await alice.client.from('profiles').delete().eq('id', alice.id);

      const { data } = await alice.client.from('profiles').select('id').single();
      expect(data?.id).toBe(alice.id);
    });

    it('un cliente anónimo no puede insertar un perfil', async () => {
      const { error } = await anonClient(env)
        .from('profiles')
        .insert({ id: '00000000-0000-4000-8000-000000000001' });
      expect(error).not.toBeNull();
    });
  });

  describe('la sesión es la que decide, no el parámetro', () => {
    it('cambiar el filtro no cambia lo que RLS permite ver', async () => {
      // Manifest §14 · «never trust user-supplied user_id without auth context».
      // Aunque la consulta pida explícitamente el id ajeno, la política se evalúa
      // sobre `auth.uid()`, que viene del JWT.
      const { data } = await alice.client
        .from('profiles')
        .select('id')
        .in('id', [alice.id, bob.id]);

      expect(data).toHaveLength(1);
      expect(data?.[0]?.id).toBe(alice.id);
    });

    it('tras cerrar sesión no queda acceso', async () => {
      const temp = await createTestUser(env, 'signout');
      await temp.client.auth.signOut();

      const { data } = await temp.client.from('profiles').select('id');
      expect(data ?? []).toHaveLength(0);

      await deleteTestUser(env, temp.id);
    });
  });
});
