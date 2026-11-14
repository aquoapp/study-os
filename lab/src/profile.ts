/**
 * Perfil del aprendiz sintético · CP3 · **un solo perfil MVP**.
 *
 * ---------------------------------------------------------------------------
 * Qué es y qué no pretende ser
 *
 * Es una política **determinista** cuyo único fin es poder recorrer el escenario y comprobar que
 * el laboratorio funciona. **No simula a una persona**, no modela aprendizaje y no afirma nada
 * sobre eficacia. BD-08 sigue abierta: aquí no se resuelven distribuciones ni rangos globales.
 *
 * ---------------------------------------------------------------------------
 * Ceguera por construcción, no por disciplina
 *
 * La firma de `decide` recibe `ObservableScreen`: lo que una persona vería en la pantalla. No
 * existe parámetro por el que pudieran entrar la clave de respuesta, el veredicto esperado, el
 * estado interno del Planner, los umbrales del observador ni el recorrido humano. No es que el
 * perfil no deba mirarlos: es que no puede nombrarlos.
 *
 * La decisión depende únicamente de la posición del ítem en la sesión, que es información que la
 * propia pantalla muestra. Así la política es reproducible sin necesidad de semilla.
 * ---------------------------------------------------------------------------
 */

export const PROFILE_ID = 'SL-LAB-MVP';
export const PROFILE_VERSION = '1.0.0';

/** Lo único que el perfil puede ver: lo que hay en la pantalla. */
export interface ObservableScreen {
  /** Ruta actual, tal como la ve el navegador. */
  readonly path: string;
  /** Ordinal del ítem dentro de la sesión, si la pantalla lo muestra. */
  readonly actionOrdinal: number | null;
  /** Claves de las opciones ofrecidas, en el orden presentado. */
  readonly offeredOptionKeys: readonly string[];
  /** Si la pantalla ofrece continuar. */
  readonly canContinue: boolean;
}

export const LAB_ACTIONS = [
  'OPEN_TODAY',
  'START_ACTION',
  'READ_AND_CONTINUE',
  'SELECT_OPTION',
  'RECORD_CONFIDENCE',
  'SUBMIT',
  'VIEW_FEEDBACK',
  'INTERRUPT',
  'RESUME',
  'FINISH',
] as const;
export type LabAction = (typeof LAB_ACTIONS)[number];

export interface Decision {
  readonly action: LabAction;
  /** Para `SELECT_OPTION`: qué opción, por su clave presentada. */
  readonly optionKey?: string;
  /** Para `RECORD_CONFIDENCE`: nivel de la escala v1 (1–4). */
  readonly confidence?: 1 | 2 | 3 | 4;
}

/**
 * Política de respuesta.
 *
 * **Elige siempre la primera opción ofrecida.** No es «responder bien» ni «responder mal»: es
 * una regla que no mira el contenido, de modo que el acierto o el fallo dependen del corpus y no
 * de que el perfil sepa la respuesta. Si eligiera la correcta, estaría usando la clave; si
 * eligiera la incorrecta a propósito, también.
 */
export function answerPolicy(screen: ObservableScreen): string {
  const first = screen.offeredOptionKeys[0];
  if (first === undefined) {
    throw new Error('la pantalla no ofrece ninguna opción: el perfil no inventa una');
  }
  return first;
}

/**
 * Política de confianza · determinista por posición.
 *
 * Alterna 3 y 2 según el ordinal. No pretende representar una calibración humana: pretende que
 * dos ejecuciones del escenario produzcan la misma secuencia de confianzas.
 */
export function confidencePolicy(screen: ObservableScreen): 1 | 2 | 3 | 4 {
  const ordinal = screen.actionOrdinal ?? 1;
  return ordinal % 2 === 1 ? 3 : 2;
}

/** Puntos de interrupción declarados de antemano. */
export const INTERRUPTION_ORDINALS = [2] as const;

export function interruptionPolicy(screen: ObservableScreen): boolean {
  const ordinal = screen.actionOrdinal;
  if (ordinal === null) return false;
  return (INTERRUPTION_ORDINALS as readonly number[]).includes(ordinal);
}

/** Disponibilidad que el perfil declara en el onboarding. Entrada, no resultado. */
export const AVAILABILITY_INPUT = {
  defaultDailyMinutes: 30,
  timezone: 'Europe/Madrid',
} as const;

/** Qué hace al ver la corrección: la lee y sigue. No reintenta ni cambia su política. */
export const FEEDBACK_BEHAVIOUR = 'VIEW_AND_CONTINUE' as const;

/**
 * Adaptaciones prohibidas, declaradas para que su ausencia sea comprobable.
 *
 * Si alguna apareciera, el perfil dejaría de ser una política y pasaría a ser un ajuste al
 * resultado que se quiere demostrar.
 */
export const PROHIBITED_ADAPTATIONS = [
  'mirar la clave de respuesta',
  'ajustar la respuesta al veredicto esperado',
  'reaccionar a los umbrales del observador',
  'reproducir el recorrido humano',
  'cambiar de política según el resultado anterior',
] as const;

export interface ProfileManifest {
  readonly profileId: string;
  readonly profileVersion: string;
  readonly answerPolicy: string;
  readonly confidencePolicy: string;
  readonly interruptionOrdinals: readonly number[];
  readonly availability: typeof AVAILABILITY_INPUT;
  readonly feedbackBehaviour: typeof FEEDBACK_BEHAVIOUR;
  readonly prohibitedAdaptations: readonly string[];
  readonly seeded: false;
}

export function profileManifest(): ProfileManifest {
  return {
    profileId: PROFILE_ID,
    profileVersion: PROFILE_VERSION,
    answerPolicy: 'siempre la primera opción ofrecida, sin mirar el contenido',
    confidencePolicy: '3 en ordinal impar, 2 en par',
    interruptionOrdinals: [...INTERRUPTION_ORDINALS],
    availability: AVAILABILITY_INPUT,
    feedbackBehaviour: FEEDBACK_BEHAVIOUR,
    prohibitedAdaptations: [...PROHIBITED_ADAPTATIONS],
    // Sin azar: no hay nada que sembrar. Dos ejecuciones dan la misma secuencia.
    seeded: false,
  };
}

/** Decisión del perfil ante una pantalla. Función pura: misma pantalla, misma decisión. */
export function decide(screen: ObservableScreen): Decision {
  if (screen.path === '/hoy') return { action: 'START_ACTION' };
  if (screen.path.startsWith('/aprender')) {
    return interruptionPolicy(screen) ? { action: 'INTERRUPT' } : { action: 'READ_AND_CONTINUE' };
  }
  if (screen.path.startsWith('/comprobar')) {
    if (screen.offeredOptionKeys.length > 0) {
      return { action: 'SELECT_OPTION', optionKey: answerPolicy(screen) };
    }
    return { action: 'VIEW_FEEDBACK' };
  }
  if (screen.path === '/fin') return { action: 'OPEN_TODAY' };
  return { action: 'OPEN_TODAY' };
}
