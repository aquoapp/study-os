import { defineConfig, devices } from '@playwright/test';

import { sharedConfig, webServerConfig } from './playwright.base';

/**
 * Playwright de la campaña del Synthetic Learner Lab · CP4.
 *
 * ---------------------------------------------------------------------------------------
 * Una campaña es **una** campaña
 *
 * `sharedConfig` declara dos proyectos de navegador —móvil y escritorio— porque las suites de
 * regresión del producto quieren ambos. Heredarlos aquí hacía que la campaña se ejecutara
 * **dos veces** por invocación, y con la repetición de §16 habrían sido cuatro.
 *
 * Eso no es un descuido técnico: CP4 autoriza **una** campaña, un aprendiz y un escenario.
 * Ejecutar dos por herencia de configuración excede la autorización sin que nadie lo pida, y
 * además la segunda arrancaba sobre un mundo que la primera ya había modificado —falló al
 * reinstalar el corpus, que es la forma honesta de que se note.
 *
 * Así que el proyecto se declara explícitamente y es uno solo. Móvil, porque es la superficie
 * que gobierna: Master §38 y el Design System §5 razonan sobre móvil primero, y es además el
 * viewport más estrecho, luego el más exigente.
 *
 * `retries: 0` por la misma razón: un reintento no repetiría la campaña, la partiría en dos
 * mitades y la segunda arrancaría sobre un mundo ya modificado. La repetición autorizada crea
 * un mundo nuevo y lo dice en el manifiesto.
 *
 * **No es un required check.** La campaña produce un veredicto; no bloquea la rama.
 * ---------------------------------------------------------------------------------------
 */
const webServer = webServerConfig();

export default defineConfig({
  ...sharedConfig,
  testDir: './tests/lab-campaign',
  /**
   * Playwright **borra** su `outputDir` al arrancar cada ejecución.
   *
   * Por defecto es `test-results`, que es donde la campaña escribe su ledger y sus informes: la
   * ejecución 2 de §16 habría destruido la evidencia de la ejecución 1 antes de poder
   * compararlas, y la comparación habría fallado por un fichero inexistente en vez de por una
   * diferencia real. La evidencia del laboratorio vive fuera de lo que Playwright administra.
   */
  outputDir: './test-results/lab-campaign-playwright',
  retries: 0,
  workers: 1,
  projects: [
    {
      name: 'campaign-mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  ...(webServer ? { webServer } : {}),
});
