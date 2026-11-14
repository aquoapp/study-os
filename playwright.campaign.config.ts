import { defineConfig } from '@playwright/test';

import { sharedConfig, webServerConfig } from './playwright.base';

/**
 * Playwright de la campaña del Synthetic Learner Lab · CP4.
 *
 * Directorio propio, separado de `tests/lab-e2e`, para que el job de CP2 siga ejecutando
 * exactamente lo que se aceptó en CP2 y la campaña no se cuele en su evidencia. Un checkpoint
 * que arrastra la evidencia del siguiente deja de ser un checkpoint.
 *
 * `retries: 0` es deliberado: un reintento no repetiría la campaña, la partiría en dos mitades
 * y la segunda arrancaría sobre un mundo que la primera ya modificó. La repetición autorizada
 * (§16) crea un mundo nuevo y lo dice en el manifiesto.
 *
 * **No es un required check.** La campaña produce un veredicto; no bloquea la rama.
 */
const webServer = webServerConfig();

export default defineConfig({
  ...sharedConfig,
  testDir: './tests/lab-campaign',
  retries: 0,
  workers: 1,
  ...(webServer ? { webServer } : {}),
});
