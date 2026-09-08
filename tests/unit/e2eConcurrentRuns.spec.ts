import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  LIST_PAGE_SIZE,
  MAX_LIST_PAGES,
  isEmailOfRun,
  listAllUsers,
  purgeRunUsers,
  runScopedEmail,
  type ListedUser,
  type UserDirectory,
} from '../support/supabase-test-env';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `e2eConcurrentRuns.spec` · dos ejecuciones a la vez sobre la misma instancia.
 *
 * ---------------------------------------------------------------------------
 * El defecto que cierra
 *
 * La limpieza ya solo borraba lo suyo, pero **verificaba mal**: censaba los
 * usuarios preexistentes al arrancar y al terminar exigía que siguieran ahí. Contra
 * una instancia compartida eso es una carrera. Si A termina y borra legítimamente
 * sus usuarios entre el censo de B y la verificación de B, B falla acusando de un
 * borrado que nadie hizo mal. La ejecución que revienta no es la que se equivocó, y
 * el fallo es intermitente: la peor combinación posible.
 *
 * La comprobación correcta no mira el mundo, mira **lo que esta ejecución pidió**.
 * Es una propiedad de la ejecución, y ninguna otra puede hacerla fallar.
 *
 * ---------------------------------------------------------------------------
 * Por qué esto se puede ejecutar sin Supabase
 *
 * La limpieza habla con un `UserDirectory` de cinco líneas —listar una página,
 * borrar un identificador—. Aquí se le da un doble en memoria compartido por las
 * dos ejecuciones, lo que permite intercalar sus fases en el orden exacto que
 * provocaba el fallo. Con una instancia real esto sería un test intermitente; con
 * el doble es determinista.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

/**
 * Directorio en memoria. Registra **todas** las peticiones de borrado, incluidas
 * las de identificadores que ya no existen: lo que se juzga es lo que se pidió.
 */
class FakeDirectory implements UserDirectory {
  readonly users = new Map<string, ListedUser>();
  readonly deleteRequests: string[] = [];
  listCalls = 0;

  add(email: string, id = email): ListedUser {
    const user = { id, email };
    this.users.set(id, user);
    return user;
  }

  async listPage(page: number, perPage: number): Promise<{ users: ListedUser[] }> {
    this.listCalls += 1;
    const all = [...this.users.values()];
    return { users: all.slice((page - 1) * perPage, page * perPage) };
  }

  async deleteUser(id: string): Promise<void> {
    this.deleteRequests.push(id);
    this.users.delete(id);
  }
}

const RUN_A = 'aaa11111bb';
const RUN_B = 'bbb22222cc';

describe('ciclo entrelazado · A-setup → B-setup → A-teardown → B-teardown', () => {
  /** Lo que hace el arranque: censar. No borra nada y no debe condicionar nada. */
  const setup = async (directory: FakeDirectory) => listAllUsers(directory);

  it('las dos ejecuciones terminan correctamente', async () => {
    const directory = new FakeDirectory();
    const heredado = directory.add('p0-heredado-1@example.test');
    const ajeno = directory.add('persona@ejemplo.com');

    // --- A-setup -------------------------------------------------------------
    const censoA = await setup(directory);
    const aUno = directory.add(runScopedEmail(RUN_A, 'alice', 1));
    const aDos = directory.add(runScopedEmail(RUN_A, 'alice', 2));

    // --- B-setup · ve a los usuarios de A, y eso es correcto -----------------
    const censoB = await setup(directory);
    const bUno = directory.add(runScopedEmail(RUN_B, 'bob', 1));

    expect(censoA.map((u) => u.id)).toEqual([heredado.id, ajeno.id]);
    expect(censoB.map((u) => u.id)).toContain(aUno.id);

    // --- A-teardown · borra los suyos ----------------------------------------
    const reporteA = await purgeRunUsers(directory, RUN_A);

    expect([...reporteA.deleted].sort()).toEqual([aUno.id, aDos.id].sort());
    expect(reporteA.requested.every((u) => isEmailOfRun(u.email, RUN_A))).toBe(true);

    // --- B-teardown · NO puede fallar porque A se llevara los suyos ----------
    const reporteB = await purgeRunUsers(directory, RUN_B);

    expect(reporteB.deleted).toEqual([bUno.id]);
    expect(reporteB.requested.every((u) => isEmailOfRun(u.email, RUN_B))).toBe(true);

    // Y lo ajeno sigue intacto.
    expect([...directory.users.keys()].sort()).toEqual([ajeno.id, heredado.id].sort());
  });

  it('cada ejecución pide borrar exclusivamente sus identificadores', async () => {
    const directory = new FakeDirectory();
    directory.add('p0-heredado-1@example.test');
    directory.add('persona@ejemplo.com');

    await setup(directory);
    const aUno = directory.add(runScopedEmail(RUN_A, 'alice', 1));
    await setup(directory);
    const bUno = directory.add(runScopedEmail(RUN_B, 'bob', 1));

    const antesDeA = directory.deleteRequests.length;
    await purgeRunUsers(directory, RUN_A);
    const pedidosPorA = directory.deleteRequests.slice(antesDeA);

    const antesDeB = directory.deleteRequests.length;
    await purgeRunUsers(directory, RUN_B);
    const pedidosPorB = directory.deleteRequests.slice(antesDeB);

    expect(pedidosPorA).toEqual([aUno.id]);
    expect(pedidosPorB).toEqual([bUno.id]);
    // Nada pedido dos veces: las dos listas son disjuntas.
    expect(pedidosPorA.filter((id) => pedidosPorB.includes(id))).toEqual([]);
  });

  it('B no falla aunque A borre sus usuarios en mitad del teardown de B', async () => {
    // El orden que rompía la versión anterior: B ya ha listado, y A borra después.
    const directory = new FakeDirectory();
    const heredado = directory.add('p0-heredado-1@example.test');

    await setup(directory);
    directory.add(runScopedEmail(RUN_A, 'alice', 1));
    const bUno = directory.add(runScopedEmail(RUN_B, 'bob', 1));

    const reporteB = await purgeRunUsers(directory, RUN_B);
    // A termina justo aquí.
    await purgeRunUsers(directory, RUN_A);

    expect(reporteB.requested.map((u) => u.id)).toEqual([bUno.id]);
    // La comprobación de B es sobre lo que pidió, no sobre lo que quedó.
    expect(reporteB.requested.every((u) => isEmailOfRun(u.email, RUN_B))).toBe(true);
    expect(directory.users.has(heredado.id)).toBe(true);
  });

  it('la limpieza de A no toca a un usuario de B con identificador parecido', async () => {
    const directory = new FakeDirectory();
    const parecido = `${RUN_A}0`;
    const suyo = directory.add(runScopedEmail(RUN_A, 'alice', 1));
    const delOtro = directory.add(runScopedEmail(parecido, 'alice', 1));

    const reporte = await purgeRunUsers(directory, RUN_A);

    expect(reporte.requested.map((u) => u.id)).toEqual([suyo.id]);
    expect(directory.users.has(delOtro.id)).toBe(true);
  });
});

describe('listar entero antes de borrar', () => {
  it('no pagina sobre una colección que encoge', async () => {
    // Con 250 usuarios y páginas de 200, borrar mientras se pagina hace que la
    // segunda página se salte a los desplazados. Se comprueba que se listan las
    // dos páginas ANTES de la primera petición de borrado.
    const directory = new FakeDirectory();
    for (let index = 0; index < 250; index += 1) {
      directory.add(runScopedEmail(RUN_A, 'carga', index));
    }

    const order: string[] = [];
    const original = directory.listPage.bind(directory);
    directory.listPage = async (page, perPage) => {
      order.push(`list:${page}`);
      return original(page, perPage);
    };
    const originalDelete = directory.deleteUser.bind(directory);
    directory.deleteUser = async (id) => {
      order.push('delete');
      return originalDelete(id);
    };

    const reporte = await purgeRunUsers(directory, RUN_A);

    expect(reporte.scanned).toBe(250);
    expect(reporte.deleted).toHaveLength(250);
    expect(order.slice(0, 2)).toEqual(['list:1', 'list:2']);
    expect(order.indexOf('delete')).toBe(2);
    expect(directory.users.size).toBe(0);
  });

  it('falla cerrado si alcanza el tope de páginas con la última llena', async () => {
    // Directorio que siempre devuelve una página llena: no se puede afirmar que se
    // haya visto todo, así que no se declara limpieza completa.
    const inagotable: UserDirectory = {
      async listPage(page, perPage) {
        return {
          users: Array.from({ length: perPage }, (_, index) => ({
            id: `u-${page}-${index}`,
            email: runScopedEmail(RUN_A, 'x', page * perPage + index),
          })),
        };
      },
      async deleteUser() {
        throw new Error('no debería borrar nada');
      },
    };

    await expect(purgeRunUsers(inagotable, RUN_A)).rejects.toThrow(/falla cerrado/);
    await expect(purgeRunUsers(inagotable, RUN_A)).rejects.toThrow(
      new RegExp(String(MAX_LIST_PAGES)),
    );
  });

  it('se detiene en cuanto una página viene incompleta', async () => {
    const directory = new FakeDirectory();
    directory.add(runScopedEmail(RUN_A, 'uno', 1));

    await purgeRunUsers(directory, RUN_A);

    expect(directory.listCalls).toBe(1);
    expect(LIST_PAGE_SIZE).toBeGreaterThan(1);
  });
});

describe('el teardown aplica el contrato corregido', () => {
  const teardown = read('tests/e2e/auth/global-teardown.ts');

  it('verifica sobre lo que se pidió borrar, no sobre lo que desapareció', () => {
    expect(teardown).toContain('report.requested.filter');
    expect(teardown).toContain('no sobre lo que');
    // Y ya no censa preexistentes para exigir que sigan ahí.
    expect(teardown).not.toContain('vanished');
    expect(teardown).not.toContain('marker.preexisting');
  });

  it('conserva el marcador mientras algo pueda ir mal', () => {
    const borrado = teardown.indexOf('rmSync(markerPath');
    expect(borrado, 'el marcador no se borra en ningún sitio').toBeGreaterThan(0);

    // Todas las comprobaciones que lanzan van ANTES del borrado del marcador.
    for (const anchor of [
      'ajenos.length > 0',
      'remaining.length > 0',
      'La limpieza de usuarios E2E falló',
    ]) {
      expect(teardown.indexOf(anchor), `"${anchor}" va después de borrar el marcador`).toBeLessThan(
        borrado,
      );
    }
    expect(teardown).toContain('para diagnóstico y reintento');
  });

  it('la limpieza lista entero antes de borrar', () => {
    const source = read('tests/support/supabase-test-env.ts');
    expect(source).toContain('export async function listAllUsers');
    expect(source).toContain('const all = await listAllUsers(directory);');
    expect(source).toContain('falla cerrado');
  });

  it('la limpieza devuelve lo que pidió borrar, no solo cuántos', () => {
    const source = read('tests/support/supabase-test-env.ts');
    expect(source).toContain('readonly requested: readonly ListedUser[];');
  });
});
