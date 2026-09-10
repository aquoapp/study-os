import { describe, expect, it } from 'vitest';

import { decideRunMode, historyReasonOf, type RunModeInput } from '@study-os/learning-engine';

/**
 * `engine.runMode.spec` · contrato §13 y §15 · la decisión entre continuar y reconstruir.
 *
 * Es la regla que protege el gate de EC-006: si la tupla semántica declarada cambió, continuar
 * incrementalmente compararía dos proyecciones que no hablan de lo mismo. Aquí se prueba sin
 * base de datos porque es aritmética sobre una tupla, no un efecto.
 */

const PACK = 'cccccccc-0000-4000-8000-000000000001';
const OTHER_PACK = 'cccccccc-0000-4000-8000-000000000002';

function baseline(overrides: Partial<RunModeInput> = {}): RunModeInput {
  return {
    stored: {
      consumedPosition: 10,
      engineConfigVersion: 'v1',
      attributionPackVersionId: PACK,
      attributionGeneration: 3,
    },
    currentConfigVersion: 'v1',
    currentPackVersionId: PACK,
    currentGeneration: 3,
    maxPosition: 10,
    ...overrides,
  };
}

describe('primera ejecución', () => {
  it('sin watermark se reconstruye: no hay nada sobre lo que continuar', () => {
    expect(decideRunMode(baseline({ stored: null }))).toEqual({
      kind: 'REBUILD',
      reason: 'FIRST_RUN',
    });
  });
});

describe('semántica intacta', () => {
  it('sin evidencia nueva no hay nada que hacer', () => {
    expect(decideRunMode(baseline())).toEqual({ kind: 'UP_TO_DATE', consumedPosition: 10 });
  });

  it('con evidencia nueva se continúa desde el watermark', () => {
    expect(decideRunMode(baseline({ maxPosition: 14 }))).toEqual({
      kind: 'INCREMENTAL',
      fromPosition: 10,
    });
  });

  it('el rebuild forzado gana sobre «no hay nada nuevo»', () => {
    expect(decideRunMode(baseline({ forceRebuild: true }))).toEqual({
      kind: 'REBUILD',
      reason: 'FORCED',
    });
  });
});

describe('una mutación de atribución nunca es continuación ordinaria', () => {
  it('otra generación obliga a recálculo registrado', () => {
    const mode = decideRunMode(baseline({ currentGeneration: 4 }));
    expect(mode).toEqual({ kind: 'RECALCULATION', reason: 'ATTRIBUTION_CHANGED' });
    expect(historyReasonOf(mode)).toBe('RECALCULATION_ATTRIBUTION_CHANGED');
  });

  it('otra versión de pack obliga a recálculo registrado', () => {
    expect(decideRunMode(baseline({ currentPackVersionId: OTHER_PACK }))).toEqual({
      kind: 'RECALCULATION',
      reason: 'ATTRIBUTION_CHANGED',
    });
  });

  it('la obsolescencia se detecta **antes** que «no hay nada nuevo»', () => {
    // Sin evidencia nueva y con la generación cambiada, lo obsoleto gana: si el orden fuera el
    // contrario, una proyección calculada con otra semántica se daría por buena para siempre.
    const mode = decideRunMode(baseline({ currentGeneration: 9, maxPosition: 10 }));
    expect(mode.kind).toBe('RECALCULATION');
  });
});

describe('un cambio de motor también invalida la continuación', () => {
  it('otra versión de configuración obliga a recálculo registrado', () => {
    const mode = decideRunMode(baseline({ currentConfigVersion: 'v2' }));
    expect(mode).toEqual({ kind: 'RECALCULATION', reason: 'ENGINE_CHANGED' });
    expect(historyReasonOf(mode)).toBe('RECALCULATION_ENGINE_CHANGED');
  });

  it('una tupla almacenada incompleta se trata como cambio, no como coincidencia', () => {
    const mode = decideRunMode(
      baseline({
        stored: {
          consumedPosition: 10,
          engineConfigVersion: null,
          attributionPackVersionId: null,
          attributionGeneration: null,
        },
      }),
    );
    expect(mode.kind).toBe('RECALCULATION');
  });
});

describe('una proyección incoherente se rehace antes que nada', () => {
  it('unas filas que no proceden del watermark declarado fuerzan el rebuild', () => {
    const mode = decideRunMode(
      baseline({
        stored: {
          consumedPosition: 10,
          engineConfigVersion: 'v1',
          attributionPackVersionId: PACK,
          attributionGeneration: 3,
          projectionCoherent: false,
        },
      }),
    );
    expect(mode).toEqual({ kind: 'REBUILD', reason: 'INCOHERENT' });
  });

  it('la incoherencia gana incluso sin evidencia nueva y con la semántica intacta', () => {
    const mode = decideRunMode(
      baseline({
        maxPosition: 10,
        stored: {
          consumedPosition: 10,
          engineConfigVersion: 'v1',
          attributionPackVersionId: PACK,
          attributionGeneration: 3,
          projectionCoherent: false,
        },
      }),
    );
    expect(mode.kind).toBe('REBUILD');
  });

  it('una proyección coherente no dispara nada', () => {
    const mode = decideRunMode(
      baseline({
        stored: {
          consumedPosition: 10,
          engineConfigVersion: 'v1',
          attributionPackVersionId: PACK,
          attributionGeneration: 3,
          projectionCoherent: true,
        },
      }),
    );
    expect(mode.kind).toBe('UP_TO_DATE');
  });
});

describe('todo modo tiene un motivo persistible', () => {
  it('los cuatro modos mapean a un motivo del enum de historial', () => {
    const reasons = [
      historyReasonOf({ kind: 'INCREMENTAL', fromPosition: 1 }),
      historyReasonOf({ kind: 'REBUILD', reason: 'FIRST_RUN' }),
      historyReasonOf({ kind: 'RECALCULATION', reason: 'ATTRIBUTION_CHANGED' }),
      historyReasonOf({ kind: 'RECALCULATION', reason: 'ENGINE_CHANGED' }),
    ];
    expect(reasons).toEqual([
      'INCREMENTAL',
      'REBUILD',
      'RECALCULATION_ATTRIBUTION_CHANGED',
      'RECALCULATION_ENGINE_CHANGED',
    ]);
  });
});
