import { defineConfig, devices } from '@playwright/test';

/**
 * Check de CI `test:e2e` (Execution Plan §4):
 * `app.boot.e2e`, `auth.signup-login.e2e`, `pwa.manifest.spec`.
 *
 * Gate P0-G1 · «La app arranca».
 *
 * Se prueba sobre el build de producción (`next build && next start`), no sobre el
 * servidor de desarrollo: el service worker solo se registra en producción y el
 * bundle que se analiza es el que se despliega.
 */

const PORT = Number(process.env['E2E_PORT'] || 3100);
// `||` y no `??`: una variable definida pero vacía debe tratarse como ausente.
const BASE_URL = process.env['E2E_BASE_URL'] || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.(e2e|spec)\.ts$/,

  // Los E2E crean usuarios reales a través de la interfaz. El setup deniega el
  // arranque contra un entorno que no lo admita; el teardown borra lo creado.
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      // Móvil primero: Master §38 y Design System §5 razonan sobre móvil.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Cuando `E2E_BASE_URL` apunta a un servidor ya levantado, no se arranca ninguno.
  ...(process.env['E2E_BASE_URL']
    ? {}
    : {
        webServer: {
          command:
            `npm run build --workspace @study-os/web && ` +
            `npm run start --workspace @study-os/web -- --port ${PORT}`,
          url: BASE_URL,
          reuseExistingServer: !process.env['CI'],
          timeout: 180_000,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
        },
      }),
});
