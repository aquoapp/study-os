/**
 * Diario del Actor y su resolución a identidades · CP4.
 *
 * ---------------------------------------------------------------------------------------
 * El Actor solo sabe lo que la pantalla muestra
 *
 * La interfaz de STUDY OS **no expone `session_item_id`** en el DOM, y el laboratorio no puede
 * añadirlo: CP4 es una prueba del producto, no una autorización para modificarlo. De modo que el
 * Actor registra lo que un aprendiz ve —el enunciado, el título, el ordinal de la acción, la
 * opción que eligió, la confianza que introdujo— y nada más.
 *
 * Los identificadores los pone **la observación**, después, resolviendo el enunciado presentado
 * a su ítem de sesión. Esto no es un rodeo: es la frontera. Si el Actor conociera los ids
 * internos, dejaría de ser un aprendiz y la ejecución ya no probaría que el producto es usable.
 * ---------------------------------------------------------------------------------------
 */

import { observe, type ObservationContext } from './observation';
import type { ActorTestimony } from './oracle';

/** Una visita a una pantalla de acción, tal y como el Actor la vivió. */
export interface ScreenVisit {
  /** «Acción N de M», leído de la cabecera. */
  readonly ordinal: number | null;
  readonly path: string;
  readonly phase: string | null;
  /** Enunciado presentado, si era una pantalla de comprobación. Es la clave de resolución. */
  readonly questionStem: string | null;
  readonly unitTitle: string | null;
  readonly optionKeysOffered: readonly string[];
  readonly chosenOptionKey: string | null;
  readonly confidenceEntered: number | null;
  readonly submitted: boolean;
  /**
   * Si antes de enviar la pantalla revelaba la respuesta correcta.
   *
   * Se comprueba por ausencia del indicador de corrección en el DOM previo al envío: INV-101 y
   * INV-103. Es una observación del Actor, hecha desde su propia superficie.
   */
  readonly answerKeyVisibleBeforeSubmit: boolean;
  readonly feedbackSeen: boolean;
  readonly visitedAt: string;
}

export interface ActorLog {
  readonly visits: readonly ScreenVisit[];
}

export function emptyActorLog(): ActorLog {
  return { visits: [] };
}

export function appendVisit(log: ActorLog, visit: ScreenVisit): ActorLog {
  return { visits: [...log.visits, visit] };
}

export interface ResolvedTestimony {
  readonly testimony: ActorTestimony;
  /** Falso si la resolución no se pudo hacer: el snapshot no puede declararse completo. */
  readonly resolved: boolean;
  /** Enunciados que el Actor vio y la observación no supo situar. */
  readonly unresolvedStems: readonly string[];
  /**
   * Enunciado visto → ítem de sesión, tal y como la observación lo situó.
   *
   * Lo necesita el ledger para enlazar cada acción **intentada** por el Actor con la acción
   * **aceptada** por el producto. Sin este puente habría que fiarse del orden, y el orden no es
   * evidencia.
   */
  readonly sessionItemByStem: ReadonlyMap<string, string>;
}

/**
 * Resuelve el diario del Actor a identidades reales.
 *
 * Si algún enunciado visto no se puede situar, se dice: devolver un testimonio con huecos
 * silenciosos haría que el oráculo concluyera sobre ítems que no existen, y un `INCONCLUSIVE`
 * honesto es mejor que un `PASS` construido sobre una resolución parcial.
 */
export function resolveTestimony(
  context: ObservationContext,
  subjectRef: string,
  log: ActorLog,
): ResolvedTestimony {
  const rows = observe(
    context,
    'select si.id::text as session_item_id, qr.id::text as representation_id, qr.stem as stem ' +
      'from public.session_items si ' +
      'join public.question_representations qr on qr.id = si.presented_representation_id ' +
      `where si.user_id = '${subjectRef}'`,
  );

  const empty: ActorTestimony = {
    confidenceByItem: new Map(),
    presentedRepresentationByItem: new Map(),
    abandonedWithoutSubmit: [],
    answerKeyVisibleBeforeSubmit: log.visits.some((visit) => visit.answerKeyVisibleBeforeSubmit),
    submitsByItem: new Map(),
  };

  if (rows === null) {
    return { testimony: empty, resolved: false, unresolvedStems: [], sessionItemByStem: new Map() };
  }

  const byStem = new Map<string, { sessionItemId: string; representationId: string }>();
  for (const row of rows) {
    const stem = typeof row['stem'] === 'string' ? row['stem'] : null;
    const sessionItemId =
      typeof row['session_item_id'] === 'string' ? row['session_item_id'] : null;
    const representationId =
      typeof row['representation_id'] === 'string' ? row['representation_id'] : null;
    if (stem === null || sessionItemId === null || representationId === null) continue;
    byStem.set(stem, { sessionItemId, representationId });
  }

  const confidenceByItem = new Map<string, number>();
  const presentedRepresentationByItem = new Map<string, string>();
  const submitsByItem = new Map<string, number>();
  const abandoned = new Set<string>();
  const unresolved: string[] = [];

  for (const visit of log.visits) {
    if (visit.questionStem === null) continue;
    const resolved = byStem.get(visit.questionStem);
    if (resolved === undefined) {
      unresolved.push(visit.questionStem);
      continue;
    }
    presentedRepresentationByItem.set(resolved.sessionItemId, resolved.representationId);
    if (visit.submitted) {
      submitsByItem.set(
        resolved.sessionItemId,
        (submitsByItem.get(resolved.sessionItemId) ?? 0) + 1,
      );
      if (visit.confidenceEntered !== null) {
        confidenceByItem.set(resolved.sessionItemId, visit.confidenceEntered);
      }
    } else {
      abandoned.add(resolved.sessionItemId);
    }
  }

  // Un ítem que se abandonó y luego se envió no está abandonado: el envío manda.
  for (const itemId of submitsByItem.keys()) abandoned.delete(itemId);

  return {
    testimony: {
      confidenceByItem,
      presentedRepresentationByItem,
      abandonedWithoutSubmit: [...abandoned],
      answerKeyVisibleBeforeSubmit: empty.answerKeyVisibleBeforeSubmit,
      submitsByItem,
    },
    resolved: unresolved.length === 0,
    unresolvedStems: unresolved,
    sessionItemByStem: new Map(
      [...byStem.entries()].map(([stem, resolved]) => [stem, resolved.sessionItemId]),
    ),
  };
}
