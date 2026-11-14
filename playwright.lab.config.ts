import { defineConfig } from '@playwright/test';

import { sharedConfig, webServerConfig } from './playwright.base';

/**
 * Playwright del Synthetic Learner Lab · CP2.
 *
 * Reutiliza la configuración base del repositorio en lugar de duplicar infraestructura: mismo
 * navegador, mismo servidor y mismas reglas. Lo único propio es el directorio de pruebas.
 *
 * **Este proyecto no es un required check.** Se introduce como evidencia del checkpoint, y su
 * estabilidad se mide antes de proponer que bloquee nada.
 */
const webServer = webServerConfig();

export default defineConfig({
  ...sharedConfig,
  testDir: './tests/lab-e2e',
  ...(webServer ? { webServer } : {}),
});
