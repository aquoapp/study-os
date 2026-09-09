/**
 * `engine_config v1` · contrato §16 · SD-013.
 *
 * **Cero parámetros numéricos de aprendizaje.** No hay pesos porque no hay puntuación que
 * ponderar, y las dos ranuras de política quedan explícitamente **sin fijar**: ninguna
 * salida emitida por el motor v1 depende de ellas.
 */

/** Identidad del algoritmo. Cambiarla es cambiar de motor, no de configuración. */
export const ENGINE_ALGORITHM_ID = 'concept-evidence' as const;
export const ENGINE_ALGORITHM_VERSION = '1.0.0' as const;

/** Lo que se persiste en cada fila derivada como `engine_version`. */
export const ENGINE_VERSION = `${ENGINE_ALGORITHM_ID}-${ENGINE_ALGORITHM_VERSION}` as const;

/** Dimensiones activas: **observaciones**, no dimensiones ponderadas. No llevan peso. */
export const ACTIVE_DIMENSIONS = [
  'accuracy_observations',
  'confidence_calibration_observations',
] as const;

/** Dimensiones inactivas, con su motivo auditable. El sustrato existe; la dimensión no. */
export const INACTIVE_DIMENSIONS = {
  retention: 'sin modelo temporal gobernado',
  transfer: 'sin contrato semántico ni parámetro de dificultad en ninguna tabla',
  stability: 'definición canónica sí, contrato de evidencia de «separadas en el tiempo» no',
  speed: 'sin datos: response_ms es opcional en el esquema y ninguna ruta lo envía',
} as const;

/**
 * Ranuras de política **sin fijar**. Consumirlas es imposible por construcción: no hay
 * ninguna salida emitida que dependa de ellas (contrato §22).
 */
export const UNSET_POLICY_SLOTS = ['mastery_sufficiency', 'review_intervals'] as const;
export type UnsetPolicySlot = (typeof UNSET_POLICY_SLOTS)[number];

export interface EngineConfigDocument {
  readonly algorithm_id: typeof ENGINE_ALGORITHM_ID;
  readonly algorithm_version: typeof ENGINE_ALGORITHM_VERSION;
  readonly active_dimensions: readonly string[];
  readonly inactive_dimensions: Readonly<Record<string, string>>;
  readonly unset_policy_slots: readonly string[];
  readonly error_pattern_taxonomy: {
    readonly types: readonly string[];
    readonly recurrence: number;
    readonly recurrence_authority: string;
  };
}

export class EngineConfigError extends Error {}

/**
 * Valida un documento de configuración antes de que pueda gobernar nada.
 *
 * Tres reglas, y la tercera es la que impide la precisión falsa: **ninguna salida emitida
 * puede referenciar una ranura sin fijar**, de modo que una ranura vacía no puede
 * convertirse silenciosamente en un valor por defecto.
 */
export function assertEngineConfigV1(document: unknown): asserts document is EngineConfigDocument {
  if (typeof document !== 'object' || document === null) {
    throw new EngineConfigError('engine_config: el documento debe ser un objeto');
  }
  const config = document as Record<string, unknown>;

  if (config['algorithm_id'] !== ENGINE_ALGORITHM_ID) {
    throw new EngineConfigError(`engine_config: algorithm_id debe ser ${ENGINE_ALGORITHM_ID}`);
  }
  if (config['algorithm_version'] !== ENGINE_ALGORITHM_VERSION) {
    throw new EngineConfigError(
      `engine_config: algorithm_version debe ser ${ENGINE_ALGORITHM_VERSION}`,
    );
  }

  // Sin pesos: la validación de la suma de pesos de ADR-003 punto 5 se aplica *cuando
  // existan pesos*, y en v1 no los hay. Que aparezca uno es el fallo que hay que detectar.
  for (const forbidden of ['weights', 'weight', 'thresholds', 'bands', 'decay', 'half_life']) {
    if (forbidden in config) {
      throw new EngineConfigError(`engine_config v1 no admite \`${forbidden}\``);
    }
  }

  const slots = config['unset_policy_slots'];
  if (!Array.isArray(slots)) {
    throw new EngineConfigError('engine_config: unset_policy_slots debe ser una lista');
  }
  for (const slot of UNSET_POLICY_SLOTS) {
    if (!slots.includes(slot)) {
      throw new EngineConfigError(`engine_config v1: la ranura ${slot} debe declararse sin fijar`);
    }
    if (slot in config) {
      throw new EngineConfigError(
        `engine_config v1: la ranura ${slot} está sin fijar y no puede llevar valor`,
      );
    }
  }

  const inactive = config['inactive_dimensions'];
  if (typeof inactive !== 'object' || inactive === null) {
    throw new EngineConfigError('engine_config: inactive_dimensions debe ser un objeto');
  }
  for (const [dimension, reason] of Object.entries(INACTIVE_DIMENSIONS)) {
    const declared = (inactive as Record<string, unknown>)[dimension];
    if (typeof declared !== 'string' || declared.trim() === '') {
      throw new EngineConfigError(
        `engine_config: la dimensión inactiva ${dimension} exige motivo auditable (${reason})`,
      );
    }
  }

  const active = config['active_dimensions'];
  if (!Array.isArray(active)) {
    throw new EngineConfigError('engine_config: active_dimensions debe ser una lista');
  }
  for (const dimension of active) {
    if (!ACTIVE_DIMENSIONS.includes(dimension as (typeof ACTIVE_DIMENSIONS)[number])) {
      throw new EngineConfigError(`engine_config v1: dimensión activa no admitida: ${dimension}`);
    }
  }
  for (const dimension of ACTIVE_DIMENSIONS) {
    if (!active.includes(dimension)) {
      throw new EngineConfigError(`engine_config v1: falta la dimensión activa ${dimension}`);
    }
  }
}
