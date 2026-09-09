/**
 * First Product Slice · asignación fija y semántica de sesión.
 *
 * **Fuente:** `docs/FPS_AUTHORIZATION_PACKET.md` §4 (H-FPS-C, semántica aceptada).
 *
 * `fps-fixed-v1` es una **función pura** sobre el contenido publicado del pack del objetivo.
 * No hay planificador, ni dominio, ni preparación, ni aleatoriedad, ni personalización: la
 * misma entrada produce siempre la misma sesión. Eso es lo que la hace comprobable y lo que
 * permite decir la verdad en HOY, que es que la selección no está personalizada.
 *
 * La selección se **deriva**; lo que persiste son las filas de `session_items` que produce.
 * El literal `fps-fixed-v1` es el nombre del algoritmo, no una columna: el marcador
 * persistido es `session_type = 'FPS_FIXED'` con `planner_run_id IS NULL`.
 */

/** Tipo de sesión persistido. `study_sessions.session_type` exige `^[A-Z_]{2,40}$`. */
export const FPS_SESSION_TYPE = 'FPS_FIXED' as const;

/** Nombre del algoritmo de asignación. No se persiste en ninguna columna. */
export const FPS_ASSIGNMENT_STRATEGY = 'fps-fixed-v1' as const;

/** Unidad de aprendizaje publicada, tal como la lee el aprendiz. */
export interface PublishedUnit {
  readonly id: string;
  /** Clave estable del concepto al que pertenece. Ordena de forma reproducible. */
  readonly conceptKey: string;
}

/** Pregunta canónica publicada, tal como la lee el aprendiz. */
export interface PublishedQuestion {
  readonly id: string;
}

/** Destino tipado de un ítem de sesión, en el formato que espera `create_study_session`. */
export interface FixedSessionItem {
  readonly item_type: 'LEARNING_UNIT' | 'QUESTION';
  readonly target_id: string;
}

/**
 * `fps-fixed-v1` · selección determinista.
 *
 * 1. las unidades del pack, ordenadas por `(conceptKey, id)`;
 * 2. después las preguntas del pack, ordenadas por `id`;
 * 3. el orden resultante es el `sort_order` de los ítems, empezando en 1.
 *
 * Primero se aprende y después se comprueba, que es la única secuencia que el vertical
 * afirma. No hay ninguna otra decisión: cualquier «cuál toca ahora» pertenece al Planner.
 */
export function selectFixedSessionItems(
  units: readonly PublishedUnit[],
  questions: readonly PublishedQuestion[],
): FixedSessionItem[] {
  const orderedUnits = [...units].sort(
    (a, b) => a.conceptKey.localeCompare(b.conceptKey, 'en') || a.id.localeCompare(b.id, 'en'),
  );
  const orderedQuestions = [...questions].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return [
    ...orderedUnits.map((unit) => ({ item_type: 'LEARNING_UNIT' as const, target_id: unit.id })),
    ...orderedQuestions.map((question) => ({
      item_type: 'QUESTION' as const,
      target_id: question.id,
    })),
  ];
}

// ---------------------------------------------------------------------------------------
// Derivación del paso actual. Función pura sobre la evidencia del servidor.
// ---------------------------------------------------------------------------------------

/** Lo mínimo de un ítem de sesión que la derivación necesita. */
export interface FpsItemView {
  readonly id: string;
  readonly item_type: string;
  readonly sort_order: number;
  readonly status: string;
}

/** Lo mínimo de un evento aceptado que la derivación necesita. */
export interface FpsEventView {
  readonly event_type: string;
  readonly session_item_id: string | null;
}

export type FpsStepKind = 'learn' | 'check' | 'feedback' | 'end';

export interface FpsStepRef {
  readonly kind: FpsStepKind;
  readonly ordinal: number;
  readonly itemId: string;
}

export type FpsStepResult = FpsStepRef | { readonly kind: 'end' };

/**
 * El paso exacto en el que está una sesión, derivado de la evidencia y de nada más.
 *
 * Orden de las reglas, y el porqué de la primera:
 *
 * 1. **La corrección pendiente precede al cursor.** Tras `ANSWER_SUBMITTED` el ítem queda
 *    `COMPLETED` y el cursor del servidor avanza al siguiente. Quien se fuera entre el envío y
 *    la corrección volvería a la pregunta siguiente sin haber visto nunca la respuesta que se
 *    ganó, y esa respuesta es justamente lo que hace de la comprobación un acto de aprender.
 *    Se detecta con evidencia legible: un envío sin `FEEDBACK_VIEWED` posterior del mismo ítem.
 * 2. El primer ítem que no está `COMPLETED`, por `sort_order`.
 * 3. Si no queda ninguno, la sesión está lista para terminar.
 *
 * Una sesión terminal nunca reanuda: es la regla del grafo de estados, no una decisión de la
 * interfaz.
 */
export function deriveFpsStep(
  sessionStatus: string,
  items: readonly FpsItemView[],
  events: readonly FpsEventView[],
): FpsStepResult {
  if (sessionStatus === 'COMPLETED' || sessionStatus === 'ABANDONED') return { kind: 'end' };

  const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);

  for (const item of ordered) {
    if (item.item_type !== 'QUESTION') continue;
    const submitted = events.some(
      (event) => event.session_item_id === item.id && event.event_type === 'ANSWER_SUBMITTED',
    );
    const seen = events.some(
      (event) => event.session_item_id === item.id && event.event_type === 'FEEDBACK_VIEWED',
    );
    if (submitted && !seen) {
      return { kind: 'feedback', ordinal: item.sort_order, itemId: item.id };
    }
  }

  const pending = ordered.find((item) => item.status !== 'COMPLETED');
  if (!pending) return { kind: 'end' };
  return {
    kind: pending.item_type === 'LEARNING_UNIT' ? 'learn' : 'check',
    ordinal: pending.sort_order,
    itemId: pending.id,
  };
}

/** La ruta que corresponde a un paso. Única fuente de navegación del vertical. */
export function fpsPathForStep(step: FpsStepResult): string {
  switch (step.kind) {
    case 'learn':
      return `/aprender/${step.ordinal}`;
    case 'check':
    case 'feedback':
      return `/comprobar/${step.ordinal}`;
    default:
      return '/fin';
  }
}
