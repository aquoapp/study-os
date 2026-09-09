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
