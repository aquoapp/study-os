import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ObservationRefused, resolveLauncher } from '../../lab/src/observation';

/**
 * Resolución del CLI del Observador · CP4.
 *
 * ---------------------------------------------------------------------------------------
 * Por qué esta prueba existe
 *
 * El Observador localizaba el CLI con `import.meta.url`. Playwright transforma las pruebas de
 * campaña a CommonJS, donde `import.meta` es un **error de sintaxis**: el módulo no se cargaba y
 * la campaña terminaba con «no se encontraron pruebas». No lo detectó nada porque las suites de
 * Vitest sí son ESM, y la única suite que importaba este módulo era de Vitest.
 *
 * Dos defensas, y ninguna de las dos es un comentario: la resolución no usa `import.meta`, y una
 * prueba lee el fichero para comprobar que sigue sin usarlo.
 * ---------------------------------------------------------------------------------------
 */

describe('el Observador localiza su CLI sin depender del sistema de módulos', () => {
  it('resuelve el CLI fijado de este repositorio', () => {
    const launcher = resolveLauncher();
    expect(launcher).toContain(join('node_modules', 'supabase', 'dist', 'supabase.js'));
  });

  it('lo resuelve igual desde un subdirectorio', () => {
    expect(resolveLauncher(join(process.cwd(), 'lab', 'src'))).toBe(resolveLauncher());
  });

  it('si no lo encuentra, lo dice en vez de inventar una ruta', () => {
    expect(() => resolveLauncher('/')).toThrow(ObservationRefused);
  });

  it('el módulo no usa import.meta: rompería la campaña bajo Playwright', () => {
    const source = readFileSync(join(process.cwd(), 'lab', 'src', 'observation.ts'), 'utf8');
    // Se busca el uso real, no la palabra en un comentario.
    expect(source).not.toMatch(/import\s*\.\s*meta\s*\./);
  });

  it('ningún módulo del laboratorio que la campaña importe usa import.meta', () => {
    for (const module of [
      'observation.ts',
      'evidence.ts',
      'route.ts',
      'actor-log.ts',
      'ingest.ts',
      'oracle.ts',
      'runner.ts',
      'report.ts',
      'ledger-build.ts',
      'ledger-store.ts',
      'campaign.ts',
    ]) {
      const source = readFileSync(join(process.cwd(), 'lab', 'src', module), 'utf8');
      expect(source, `${module} usa import.meta`).not.toMatch(/import\s*\.\s*meta\s*\./);
    }
  });
});
