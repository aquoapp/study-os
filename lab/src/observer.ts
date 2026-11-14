/**
 * Product Observer · en CP1 existe y permanece **`NOT_ACTIVE`**.
 *
 * ---------------------------------------------------------------------------
 * Por qué no hay umbrales aquí
 *
 * BD-09 sigue abierta: los umbrales, los márgenes de equivalencia y la definición de *near-miss*
 * no están decididos. Inventarlos para que el observador «funcione» sería fabricar la autoridad
 * que falta, y un observador con reglas improvisadas produce señales que nadie puede defender.
 *
 * Así que el observador arranca apagado y **solo puede encenderse con un pre-registro previo a
 * la campaña**. Mientras tanto emite nada: ni una señal, ni una observación.
 * ---------------------------------------------------------------------------
 */

export const OBSERVER_STATE = ['NOT_ACTIVE', 'ACTIVE'] as const;
export type ObserverState = (typeof OBSERVER_STATE)[number];

/**
 * Pre-registro obligatorio. Sus valores son `IMPLEMENTATION_BINDING_PENDING` (BD-09): este tipo
 * describe **qué haría falta**, no lo que hay.
 */
export interface ObserverPreregistration {
  readonly observerVersion: string;
  readonly digest: string;
  /** Instante en que se fijó. Debe ser anterior a la campaña; la comprobación es de CP posterior. */
  readonly registeredAt: string;
  /** Umbrales por patrón. Vacío es inválido: un observador sin umbrales no decide nada. */
  readonly thresholds: Readonly<Record<string, number>>;
}

export class ObserverNotActive extends Error {
  constructor(message: string) {
    super(`observer · ${message}`);
    this.name = 'ObserverNotActive';
  }
}

export interface ProductObserver {
  readonly state: ObserverState;
  readonly preregistration: ObserverPreregistration | null;
}

/** El observador de CP1. Siempre apagado, sin excepción ni atajo. */
export function createObserver(): ProductObserver {
  return { state: 'NOT_ACTIVE', preregistration: null };
}

/**
 * Enciende el observador **solo** con un pre-registro completo.
 *
 * No existe forma de activarlo sin él: ni un valor por defecto, ni un modo «permisivo», ni una
 * bandera de entorno. Si BD-09 no está resuelta, el pre-registro no puede construirse honestamente
 * y la activación falla.
 */
export function activateObserver(
  observer: ProductObserver,
  preregistration: ObserverPreregistration,
): ProductObserver {
  // DEC-02 · los criterios son **anteriores** a la campaña y no se ajustan retrospectivamente.
  // Reactivar uno ya activo sería exactamente ese ajuste, con otro nombre.
  if (observer.state === 'ACTIVE') {
    throw new ObserverNotActive(
      'el observador ya está activo: cambiar su pre-registro a mitad de campaña es ajustar los ' +
        'criterios después de ver los datos',
    );
  }
  if (!preregistration.observerVersion || !preregistration.digest) {
    throw new ObserverNotActive('el pre-registro necesita versión y digest');
  }
  if (Object.keys(preregistration.thresholds).length === 0) {
    throw new ObserverNotActive(
      'el pre-registro no declara ningún umbral. BD-09 sigue abierta: sin umbrales acordados de ' +
        'antemano, cualquier señal sería una opinión con formato de dato.',
    );
  }
  return { state: 'ACTIVE', preregistration };
}

/**
 * Emite una señal. Con el observador apagado, lanza: no devuelve una lista vacía, porque una
 * lista vacía se confundiría con «se miró y no había nada».
 */
export function emitSignal(observer: ProductObserver, pattern: string): never | string {
  if (observer.state !== 'ACTIVE') {
    throw new ObserverNotActive(
      `no puede emitirse la señal "${pattern}" con el observador en NOT_ACTIVE. Un silencio por ` +
        'apagado no es lo mismo que un silencio por ausencia de patrón.',
    );
  }
  return pattern;
}
