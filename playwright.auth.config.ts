import { defineConfig } from '@playwright/test';

import { sharedConfig, webServerConfig } from './playwright.base';

/**
 * E2E de **autenticación**: dan de alta usuarios reales a través del formulario.
 *
 * `globalSetup` deniega el arranque si falta cualquier condición —entorno
 * autorizado, host de loopback y **credenciales de limpieza**— antes de abrir
 * ningún navegador. `globalTeardown` borra lo creado y **falla** si queda algo.
 *
 * No hay camino silencioso: si la limpieza no puede ejecutarse, la suite no se
 * ejecuta.
 */
const webServer = webServerConfig();

export default defineConfig({
  ...sharedConfig,
  testDir: './tests/e2e/auth',
  globalSetup: './tests/e2e/auth/global-setup.ts',
  globalTeardown: './tests/e2e/auth/global-teardown.ts',
  ...(webServer ? { webServer } : {}),
});
