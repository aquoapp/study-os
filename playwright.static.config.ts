import { defineConfig } from '@playwright/test';

import { sharedConfig, webServerConfig } from './playwright.base';

/**
 * E2E **estáticos**: arranque, PWA y accesibilidad renderizada.
 *
 * No tocan Supabase, no crean ningún usuario y no necesitan credenciales. Se
 * ejecutan en cualquier checkout con solo construir la aplicación, y por eso son
 * los únicos E2E que pueden considerarse evidencia sin infraestructura externa.
 *
 * Sin `globalSetup` ni `globalTeardown` a propósito: no hay nada que autorizar ni
 * nada que limpiar.
 */
const webServer = webServerConfig();

export default defineConfig({
  ...sharedConfig,
  testDir: './tests/e2e/static',
  ...(webServer ? { webServer } : {}),
});
