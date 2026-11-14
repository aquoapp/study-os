import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Fronteras de alcance de CP1 · pruebas K y L.
 *
 * Estas pruebas no miran el comportamiento: miran el **árbol**. Comprueban que el laboratorio no
 * ha traído consigo una abstracción temporal «por si acaso» y que no ha tocado el producto.
 * Un alcance se vigila mirando lo que hay, no confiando en lo que se pretendía.
 */

const REPO = process.cwd();
const LAB_SRC = join(REPO, 'lab', 'src');

function labFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.ts')) out.push(full);
    }
  };
  walk(LAB_SRC);
  return out;
}

describe('K · LAB TEMPORAL no se ha colado', () => {
  /**
   * BT-09 está `BLOCKED BY GOVERNANCE DECISION`. No hay inyección de reloj, ni fechas falsas, ni
   * mutación de marcas, ni una abstracción temporal añadida «para después». Añadirla sin decisión
   * sería resolver BT-09 de hecho mientras se declara bloqueado.
   */
  const FORBIDDEN = [
    'clockInjection',
    'injectClock',
    'fakeTimers',
    'useFakeTimers',
    'setSystemTime',
    'travelTo',
    'advanceTime',
    'backdate',
    'plan_day',
    'set_today_override',
  ];

  it('ningún símbolo temporal prohibido aparece en lab/src', () => {
    const hits: string[] = [];
    for (const file of labFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const symbol of FORBIDDEN) {
        if (text.includes(symbol)) hits.push(`${file}: ${symbol}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('no existe una abstracción de reloj propia del laboratorio', () => {
    const names = labFiles().map((file) => file.toLowerCase());
    expect(names.some((name) => name.includes('clock') || name.includes('time'))).toBe(false);
  });
});

/**
 * El baseline solo es alcanzable con historia completa. El checkout de CI es superficial, así
 * que allí `git diff baseline...HEAD` falla con `Invalid symmetric difference expression`.
 *
 * Cuando no se puede comparar, el caso **no se declara aprobado**: se salta diciendo por qué. Un
 * verde obtenido por no poder mirar sería exactamente lo que el modelo de veredicto prohíbe.
 */
const BASELINE = '578b99c2a0c57ac880c7a6975bfe8bcdbed25d34';

function baselineReachable(): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASELINE}^{commit}`], { cwd: REPO, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!baselineReachable())('L · CP1 no modifica el producto', () => {
  /**
   * El laboratorio es un subsistema de test. Si CP1 hubiera tocado `apps/`, `packages/` o
   * `supabase/`, habría adquirido autoridad sobre STUDY OS, que es justo lo que no debe pasar.
   */
  const PRODUCT_PATHS = ['apps/', 'packages/', 'supabase/'];

  it('el diff contra el baseline no toca rutas productivas', () => {
    const changed = execFileSync('git', ['diff', '--name-only', `${BASELINE}...HEAD`], {
      cwd: REPO,
      encoding: 'utf8',
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const productChanges = changed.filter((file) =>
      PRODUCT_PATHS.some((prefix) => file.startsWith(prefix)),
    );
    expect(productChanges).toEqual([]);
  });

  it('no se han añadido migraciones', () => {
    const changed = execFileSync('git', ['diff', '--name-only', `${BASELINE}...HEAD`], {
      cwd: REPO,
      encoding: 'utf8',
    });
    expect(changed).not.toContain('supabase/migrations');
  });

  it('nada de apps/ ni packages/ importa el laboratorio', () => {
    // `git grep` sale con código 1 cuando no encuentra nada, que aquí es justo el resultado
    // deseado. Se captura el fallo en vez de dejar que lo confunda con un error.
    let hits = '';
    try {
      hits = execFileSync('git', ['grep', '-l', '-E', 'lab/src', '--', 'apps', 'packages'], {
        cwd: REPO,
        encoding: 'utf8',
      }).trim();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      if (failure.status !== 1) throw error;
      hits = (failure.stdout ?? '').trim();
    }
    expect(hits).toBe('');
  });
});
