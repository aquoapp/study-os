/**
 * Pre-registro del Contract Oracle · CP3.
 *
 * ---------------------------------------------------------------------------
 * Por qué se sella antes de mirar
 *
 * Los criterios se fijan **antes** de ejecutar y no se tocan después. Un oráculo que ajusta su
 * condición de aprobado tras ver el resultado no evalúa: describe. Para que eso no dependa de la
 * buena voluntad, el pre-registro se congela —`Object.freeze` en profundidad— y lleva un digest:
 * cualquier intento de reescribirlo falla, y si alguien lo recrea, el digest cambia y deja rastro.
 * ---------------------------------------------------------------------------
 */

import { createHash } from 'node:crypto';

import { CONTRACT_PROPERTIES, SCENARIO_ID, SCENARIO_VERSION } from './scenario';

export const PREREGISTRATION_VERSION = '1.0.0';

export interface PreregisteredCriterion {
  readonly propertyId: string;
  readonly statement: string;
  readonly source: string;
  /** Qué evidencia hace falta para poder emitir cualquier veredicto. */
  readonly requiredEvidence: readonly string[];
  /** Si exige barrera de completitud antes de un PASS. */
  readonly requiresCompletenessBarrier: boolean;
  readonly passCondition: string;
  readonly failCondition: string;
  readonly inconclusiveCondition: string;
  readonly notApplicableCondition: string;
}

function criterionFor(property: (typeof CONTRACT_PROPERTIES)[number]): PreregisteredCriterion {
  return {
    propertyId: property.id,
    statement: property.statement,
    source: property.source,
    requiredEvidence: property.negative
      ? ['acciones aceptadas verificadas', 'lectura de barrera antes y después']
      : ['acciones aceptadas verificadas', 'estado observado antes y después'],
    requiresCompletenessBarrier: property.negative,
    passCondition: property.negative
      ? 'la barrera queda establecida (pending=false y consumed ≥ última aceptada) y no apareció la evidencia cuya ausencia se afirma'
      : 'la obligación se observa cumplida sobre la evidencia aceptada',
    failCondition: 'la obligación se observa incumplida sobre evidencia suficiente',
    inconclusiveCondition:
      'la evidencia requerida no pudo obtenerse, o la barrera no pudo establecerse',
    notApplicableCondition: 'la precondición de la propiedad no se dio en esta ejecución',
  };
}

export interface OraclePreregistration {
  readonly version: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly criteria: readonly PreregisteredCriterion[];
  readonly digest: string;
  readonly sealedAt: string;
}

export class PreregistrationViolation extends Error {
  constructor(message: string) {
    super(`pre-registro · ${message}`);
    this.name = 'PreregistrationViolation';
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** Sella los criterios. El instante de sellado es operativo del laboratorio. */
export function seal(sealedAt: string): OraclePreregistration {
  const criteria = CONTRACT_PROPERTIES.map(criterionFor);
  const digest = createHash('sha256')
    .update(JSON.stringify({ PREREGISTRATION_VERSION, SCENARIO_ID, SCENARIO_VERSION, criteria }))
    .digest('hex');
  return deepFreeze({
    version: PREREGISTRATION_VERSION,
    scenarioId: SCENARIO_ID,
    scenarioVersion: SCENARIO_VERSION,
    criteria,
    digest,
    sealedAt,
  });
}

/** Recalcula el digest y lo compara: detecta cualquier reescritura posterior. */
export function assertUnmodified(preregistration: OraclePreregistration): void {
  const recomputed = createHash('sha256')
    .update(
      JSON.stringify({
        PREREGISTRATION_VERSION: preregistration.version,
        SCENARIO_ID: preregistration.scenarioId,
        SCENARIO_VERSION: preregistration.scenarioVersion,
        criteria: preregistration.criteria,
      }),
    )
    .digest('hex');
  if (recomputed !== preregistration.digest) {
    throw new PreregistrationViolation(
      'los criterios no coinciden con su digest: alguien los cambió después de sellarlos',
    );
  }
}
