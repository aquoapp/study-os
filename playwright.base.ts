import { devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * Configuración común de las dos suites E2E.
 *
 * ---------------------------------------------------------------------------
 * Por qué hay dos suites y no una
 *
 * Los E2E **estáticos** (arranque, PWA, accesibilidad) no tocan Supabase: se
 * ejecutan en cualquier checkout con solo construir la aplicación.
 *
 * Los E2E de **auth** dan de alta usuarios reales a través del formulario. Eso
 * exige credenciales de limpieza *antes* de crear nada, y exige comprobar al final
 * que no queda ninguno. Mezclarlas obligaba a que la limpieza fuera opcional —y una
 * limpieza opcional acaba no ejecutándose.
 * ---------------------------------------------------------------------------
 */

export const PORT = Number(process.env['E2E_PORT'] || 3100);

// `||` y no `??`: una variable definida pero vacía debe tratarse como ausente.
export const BASE_URL = process.env['E2E_BASE_URL'] || `http://127.0.0.1:${PORT}`;

export const sharedConfig: PlaywrightTestConfig = {
  testMatch: /.*\.(e2e|spec)\.ts$/,

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
};

/**
 * Servidor de pruebas.
 *
 * Se prueba sobre el build de producción (`next build && next start`), no sobre el
 * servidor de desarrollo: el service worker solo se registra en producción y el
 * bundle que se analiza es el que se despliega.
 */
export function webServerConfig(): PlaywrightTestConfig['webServer'] | undefined {
  if (process.env['E2E_BASE_URL']) return undefined;

  return {
    command:
      `npm run build --workspace @study-os/web && ` +
      `npm run start --workspace @study-os/web -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
  };
}
