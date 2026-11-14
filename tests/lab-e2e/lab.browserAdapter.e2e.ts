import { expect, test } from '@playwright/test';

import {
  registerThroughUi,
  readSurface,
  open,
  BrowserAdapterRefused,
  type BrowserAdapterContext,
} from '../../lab/src/browser';
import { syntheticIdentity, isSynthetic } from '../../lab/src/harness';
import { LAB_ENV, SUBSTRATE_ENV_VAR, EPHEMERAL_SUBSTRATE } from '../../lab/src/environment';
import { resolveSubstrate } from '../../lab/src/substrate';
import { actorCredentials } from '../../lab/src/credentials';

/**
 * Browser Adapter · CP2 · pruebas C, D, E.
 *
 * Demuestra con navegador real que el Actor alcanza STUDY OS por la interfaz, sobre la instancia
 * efímera. **No ejecuta campaña**: se detiene en cuanto llega a una superficie de aprendiz.
 *
 * Lo que aquí se prueba no se reutiliza de las suites existentes: los E2E de `tests/e2e/auth`
 * existen por regresión del producto y no respetan las fronteras del laboratorio —comparten
 * proceso con credenciales de servicio—, así que contarlos como evidencia del Lab sería
 * exactamente el autoengaño que el checkpoint pide descartar.
 */

const substrateDeclared = process.env[SUBSTRATE_ENV_VAR] === EPHEMERAL_SUBSTRATE;

test.skip(
  !substrateDeclared,
  `sin ${SUBSTRATE_ENV_VAR}=${EPHEMERAL_SUBSTRATE} no hay sustrato efímero: la suite no se ejecuta ` +
    'en lugar de buscar otro destino',
);

test.describe('CP2 · el Actor alcanza el producto por la interfaz real', () => {
  test('alta sintética por UI hasta una superficie de aprendiz', async ({ page, baseURL }) => {
    const { identity } = resolveSubstrate(process.env);
    const substrate = {
      apiUrl: process.env[LAB_ENV.apiUrl] as string,
      anonKey: process.env[LAB_ENV.anonKey] as string,
      serviceRoleKey: '',
      databaseUrl: '',
    };

    const context: BrowserAdapterContext = {
      page,
      credentials: actorCredentials(substrate),
      baseUrl: baseURL ?? '',
    };

    // C · la aplicación arranca y sirve la portada.
    await open(context, '/');
    expect(await readSurface(context)).toContain('Study OS');

    // E · auth real: alta por el formulario, con su server action.
    const synthetic = syntheticIdentity('cp2');
    expect(isSynthetic(synthetic.email)).toBe(true);
    await registerThroughUi(context, synthetic);

    // D · se alcanzó una superficie de aprendiz legítima.
    expect(page.url()).toContain('/hoy');
    const surface = await readSurface(context);
    expect(surface).toContain('Hoy');

    // La procedencia dice contra qué instancia se hizo.
    expect(identity.kind).toBe(EPHEMERAL_SUBSTRATE);
    expect(identity.databaseHost).toBe('127.0.0.1');
  });

  test('el adaptador se niega a salir del alcance de CP2', async ({ page, baseURL }) => {
    const context: BrowserAdapterContext = {
      page,
      credentials: { apiUrl: '', anonKey: '' },
      baseUrl: baseURL ?? '',
    };
    await expect(open(context, '/comprobar/1' as never)).rejects.toThrow(BrowserAdapterRefused);
  });
});
