/**
 * Elección entre continuación incremental y reconstrucción · contrato §13 y §15.
 *
 * Es una decisión **mecánica**, no una heurística: si la tupla semántica declarada que guarda
 * el watermark difiere de la vigente —versión de configuración, versión de pack o generación
 * de atribución—, la fila está **obsoleta** y no se continúa sobre ella. Una mutación de
 * atribución nunca es una continuación incremental ordinaria.
 *
 * Vive aquí, en el paquete puro, para que se pueda probar sin base de datos: es la regla que
 * decide si el gate de EC-006 se aplica sobre terreno comparable.
 */

/** La tupla semántica con la que se calculó una proyección. */
export interface DeclaredSemantics {
  readonly engineConfigVersion: string | null;
  readonly attributionPackVersionId: string | null;
  readonly attributionGeneration: number | null;
}

export interface RunModeInput {
  /** Lo que el watermark declara. `null` si la proyección no existe todavía. */
  readonly stored:
    | (DeclaredSemantics & {
        readonly consumedPosition: number;
        /**
         * ¿Toda fila de proyección procede del punto que el watermark declara?
         *
         * Si no, la proyección **no es una función de la evidencia** —alguien escribió algo
         * que no fue una ejecución fiel del motor— y continuar sobre ella sería dar por buena
         * una mentira. Se reconstruye.
         */
        readonly projectionCoherent?: boolean | undefined;
      })
    | null;
  readonly currentConfigVersion: string;
  readonly currentPackVersionId: string;
  readonly currentGeneration: number;
  /** Posición máxima del stream del aprendiz. */
  readonly maxPosition: number;
  readonly forceRebuild?: boolean | undefined;
}

export type RunMode =
  | { readonly kind: 'UP_TO_DATE'; readonly consumedPosition: number }
  | { readonly kind: 'INCREMENTAL'; readonly fromPosition: number }
  | { readonly kind: 'REBUILD'; readonly reason: 'FIRST_RUN' | 'FORCED' | 'INCOHERENT' }
  | { readonly kind: 'RECALCULATION'; readonly reason: 'ATTRIBUTION_CHANGED' | 'ENGINE_CHANGED' };

export function decideRunMode(input: RunModeInput): RunMode {
  const stored = input.stored;
  if (stored === null) return { kind: 'REBUILD', reason: 'FIRST_RUN' };

  // Lo incoherente se atiende antes que nada: si la proyección no procede de la evidencia,
  // ninguna comparación posterior significa nada.
  if (stored.projectionCoherent === false) return { kind: 'REBUILD', reason: 'INCOHERENT' };

  const attributionChanged =
    stored.attributionPackVersionId !== input.currentPackVersionId ||
    Number(stored.attributionGeneration) !== input.currentGeneration;
  if (attributionChanged) return { kind: 'RECALCULATION', reason: 'ATTRIBUTION_CHANGED' };

  if (stored.engineConfigVersion !== input.currentConfigVersion) {
    return { kind: 'RECALCULATION', reason: 'ENGINE_CHANGED' };
  }

  if (input.forceRebuild === true) return { kind: 'REBUILD', reason: 'FORCED' };

  // Solo aquí, con la semántica intacta, «no hay nada nuevo» significa de verdad que no hay
  // nada que hacer. Comprobarlo antes habría dejado pasar una proyección obsoleta.
  if (input.maxPosition <= stored.consumedPosition) {
    return { kind: 'UP_TO_DATE', consumedPosition: stored.consumedPosition };
  }
  return { kind: 'INCREMENTAL', fromPosition: stored.consumedPosition };
}

/** El motivo que se persiste en `mastery_history` para cada modo. */
export function historyReasonOf(mode: RunMode): string {
  switch (mode.kind) {
    case 'INCREMENTAL':
      return 'INCREMENTAL';
    case 'REBUILD':
      return 'REBUILD';
    case 'RECALCULATION':
      return mode.reason === 'ATTRIBUTION_CHANGED'
        ? 'RECALCULATION_ATTRIBUTION_CHANGED'
        : 'RECALCULATION_ENGINE_CHANGED';
    case 'UP_TO_DATE':
      return 'INCREMENTAL';
  }
}
