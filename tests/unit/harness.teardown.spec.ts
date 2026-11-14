import { describe, expect, it } from 'vitest';

import { ERASE_ATTEMPTS, eraseTestUser, type UserEraser } from '../support/supabase-test-env';

/**
 * Regresión del teardown del arnés.
 *
 * ---------------------------------------------------------------------------
 * Qué defecto fija
 *
 * `deleteTestUser` hacía `await admin.auth.admin.deleteUser(userId)` y **no miraba el
 * resultado**. Un borrado fallido volvía en silencio y la limpieza seguía hasta purgar el pack,
 * donde chocaba con `question_attempts_answer_key_version_id_fkey`: la purga borra
 * `content.answer_key_versions` pero no los intentos, y los intentos solo caen en cascada con su
 * dueño. El error acusaba a la purga de un fallo que era del borrado.
 *
 * Estos casos no prueban Supabase: prueban que **un fallo de limpieza no puede quedar mudo** y
 * que un fallo transitorio no ensucia la base. Por eso corren contra un doble, sin red.
 * ---------------------------------------------------------------------------
 */

function eraser(outcomes: ReadonlyArray<string | null | 'throw'>): {
  readonly eraser: UserEraser;
  readonly calls: () => number;
} {
  let index = 0;
  return {
    eraser: {
      async deleteUser() {
        const outcome = outcomes[Math.min(index, outcomes.length - 1)] ?? null;
        index += 1;
        if (outcome === 'throw') throw new Error('fetch failed');
        return { error: outcome === null ? null : { message: outcome } };
      },
    },
    calls: () => index,
  };
}

describe('eraseTestUser · un fallo de limpieza nunca queda en silencio', () => {
  it('un borrado correcto no lanza y no reintenta', async () => {
    const { eraser: ok, calls } = eraser([null]);
    await expect(eraseTestUser(ok, 'u-1')).resolves.toBeUndefined();
    expect(calls()).toBe(1);
  });

  it('un error persistente se propaga, con el usuario y la causa', async () => {
    const { eraser: broken } = eraser(['database is locked']);
    await expect(eraseTestUser(broken, 'u-2')).rejects.toThrow(/u-2/);
    await expect(eraseTestUser(broken, 'u-2')).rejects.toThrow(/database is locked/);
  });

  it('agota los intentos antes de rendirse', async () => {
    const { eraser: broken, calls } = eraser(['no']);
    await expect(eraseTestUser(broken, 'u-3')).rejects.toThrow();
    expect(calls()).toBe(ERASE_ATTEMPTS);
  });

  it('un fallo transitorio no deja residuo: se reintenta y termina bien', async () => {
    const { eraser: flaky, calls } = eraser(['timeout', null]);
    await expect(eraseTestUser(flaky, 'u-4')).resolves.toBeUndefined();
    expect(calls()).toBe(2);
  });

  it('una excepción de transporte cuenta como intento fallido, no revienta la limpieza', async () => {
    const { eraser: throwing, calls } = eraser(['throw', null]);
    await expect(eraseTestUser(throwing, 'u-5')).resolves.toBeUndefined();
    expect(calls()).toBe(2);
  });

  it('explica por qué no se sigue: el error de la purga apuntaría al sitio equivocado', async () => {
    const { eraser: broken } = eraser(['nope']);
    await expect(eraseTestUser(broken, 'u-6')).rejects.toThrow(/purga del pack/);
  });
});
