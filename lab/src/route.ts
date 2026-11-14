/**
 * Procedencia de ruta del pliegue · CP4 · §7–8.
 *
 * ---------------------------------------------------------------------------------------
 * Route A y Route B **no están registradas**: se infieren, y eso se dice
 *
 * `engine.mastery_history` guarda la razón del pliegue —`INCREMENTAL`, `REBUILD`, …— y su
 * `reason_json` lleva vectores y posiciones, pero **no lleva quién lo disparó**. De modo que el
 * estado persistido no distingue un pliegue de Route A (`after()` dentro de la acción de envío)
 * de uno de Route B (al volver a HOY).
 *
 * El único discriminador disponible para un observador es temporal: un pliegue que alcanza la
 * posición de un envío **antes** de que el aprendiz volviera a HOY solo puede venir de Route A,
 * porque Route B todavía no había tenido ocasión de ejecutarse. Es el mismo argumento con el que
 * Phase 4B demostró Route A por interacción humana.
 *
 * Por eso este módulo devuelve `INFERRED_*` y nunca `OBSERVED_*`. La atribución de ruta es una
 * inferencia sobre marcas de tiempo, no un hecho que el producto afirme, y presentarla como
 * hecho sería exactamente el tipo de sobreafirmación que ya costó una corrección (IR-P4A-02).
 * ---------------------------------------------------------------------------------------
 */

import { observe, type ObservationContext } from './observation';

/** Atribución de ruta. Todas las etiquetas dicen que son inferidas. */
export const ROUTE_ATTRIBUTIONS = [
  'INFERRED_ROUTE_A',
  'INFERRED_ROUTE_B',
  'INFERRED_NOT_FOLDED',
  'UNATTRIBUTABLE',
] as const;
export type RouteAttribution = (typeof ROUTE_ATTRIBUTIONS)[number];

export interface FoldObservation {
  readonly reason: string;
  readonly fromPosition: number;
  readonly toPosition: number;
  readonly createdAt: string;
}

export interface SubmitMoment {
  /** Posición del evento de envío en el stream. */
  readonly streamPosition: number;
  /** Instante en que el servidor lo recibió. */
  readonly serverReceivedAt: string;
  /**
   * Instante en que el aprendiz volvió a HOY después de este envío, si volvió.
   *
   * Lo aporta el diario del Actor: es lo que el aprendiz hizo, no un dato del servidor.
   */
  readonly returnedToTodayAt: string | null;
}

export interface RouteEvidence {
  readonly streamPosition: number;
  readonly attribution: RouteAttribution;
  readonly foldReason: string | null;
  readonly foldedAt: string | null;
  /** Segundos entre la recepción del envío y el pliegue que lo alcanza. */
  readonly latencySeconds: number | null;
  readonly rationale: string;
}

/** Lee el historial de pliegues del motor. Solo lectura, como todo lo del Observador. */
export function readFolds(
  context: ObservationContext,
  subjectRef: string,
): readonly FoldObservation[] | null {
  const rows = observe(
    context,
    'select reason::text as reason, from_position, to_position, ' +
      // `OF` rinde «+00», que `Date.parse` no interpreta: daría NaN y toda ruta saldría
      // inatribuible. Se normaliza a UTC con sufijo Z, que sí es ISO 8601.
      'to_char(created_at at time zone \'UTC\', \'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\') as created_at ' +
      `from engine.mastery_history where user_id = '${subjectRef}' order by created_at`,
  );
  if (rows === null) return null;
  return rows.map((row) => ({
    reason: typeof row['reason'] === 'string' ? row['reason'] : 'DESCONOCIDA',
    fromPosition: Number(row['from_position'] ?? -1),
    toPosition: Number(row['to_position'] ?? -1),
    createdAt: typeof row['created_at'] === 'string' ? row['created_at'] : '',
  }));
}

function millis(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Atribuye ruta a cada envío.
 *
 * El primer pliegue que alcanza la posición del envío es el que cuenta. Si ocurrió antes del
 * regreso a HOY, la inferencia es Route A; si ocurrió después, Route B. Si no se puede situar
 * uno de los dos instantes, la atribución es `UNATTRIBUTABLE`: no se elige la etiqueta más
 * favorable.
 */
export function attributeRoutes(
  submits: readonly SubmitMoment[],
  folds: readonly FoldObservation[],
): readonly RouteEvidence[] {
  return submits.map((submit) => {
    const reaching = folds
      .filter((fold) => fold.toPosition >= submit.streamPosition)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

    if (reaching === undefined) {
      return {
        streamPosition: submit.streamPosition,
        attribution: 'INFERRED_NOT_FOLDED',
        foldReason: null,
        foldedAt: null,
        latencySeconds: null,
        rationale: 'ningún pliegue alcanza la posición de este envío',
      };
    }

    const submittedAt = millis(submit.serverReceivedAt);
    const foldedAt = millis(reaching.createdAt);
    const latencySeconds =
      submittedAt === null || foldedAt === null ? null : (foldedAt - submittedAt) / 1000;

    if (submit.returnedToTodayAt === null) {
      return {
        streamPosition: submit.streamPosition,
        attribution: 'INFERRED_ROUTE_A',
        foldReason: reaching.reason,
        foldedAt: reaching.createdAt,
        latencySeconds,
        rationale:
          'el pliegue alcanzó este envío y el aprendiz no había vuelto a HOY: Route B no tuvo ' +
          'ocasión de ejecutarse',
      };
    }

    const returnedAt = millis(submit.returnedToTodayAt);
    if (foldedAt === null || returnedAt === null) {
      return {
        streamPosition: submit.streamPosition,
        attribution: 'UNATTRIBUTABLE',
        foldReason: reaching.reason,
        foldedAt: reaching.createdAt,
        latencySeconds,
        rationale: 'no se pudo situar en el tiempo el pliegue o el regreso a HOY',
      };
    }

    return foldedAt < returnedAt
      ? {
          streamPosition: submit.streamPosition,
          attribution: 'INFERRED_ROUTE_A',
          foldReason: reaching.reason,
          foldedAt: reaching.createdAt,
          latencySeconds,
          rationale: 'el pliegue precede al regreso a HOY',
        }
      : {
          streamPosition: submit.streamPosition,
          attribution: 'INFERRED_ROUTE_B',
          foldReason: reaching.reason,
          foldedAt: reaching.createdAt,
          latencySeconds,
          rationale: 'el pliegue no precede al regreso a HOY',
        };
  });
}

export interface RouteSummary {
  readonly submits: number;
  readonly inferredRouteA: number;
  readonly inferredRouteB: number;
  readonly notFolded: number;
  readonly unattributable: number;
  /** Siempre falso en v1: ninguna ruta está registrada por el producto. */
  readonly recordedByProduct: false;
}

export function summarizeRoutes(evidence: readonly RouteEvidence[]): RouteSummary {
  const count = (attribution: RouteAttribution): number =>
    evidence.filter((item) => item.attribution === attribution).length;
  return {
    submits: evidence.length,
    inferredRouteA: count('INFERRED_ROUTE_A'),
    inferredRouteB: count('INFERRED_ROUTE_B'),
    notFolded: count('INFERRED_NOT_FOLDED'),
    unattributable: count('UNATTRIBUTABLE'),
    recordedByProduct: false,
  };
}

/** Lee el instante de recepción de cada envío aceptado. */
export function readSubmitMoments(
  context: ObservationContext,
  subjectRef: string,
): ReadonlyArray<{ streamPosition: number; serverReceivedAt: string }> | null {
  const rows = observe(
    context,
    'select e.stream_position, ' +
      'to_char(e.server_received_at at time zone \'UTC\', ' +
      '\'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\') as server_received_at ' +
      'from public.learning_events e ' +
      'join public.question_attempts a on a.submitted_event_id = e.event_id ' +
      `where e.user_id = '${subjectRef}' order by e.stream_position`,
  );
  if (rows === null) return null;
  return rows.map((row) => ({
    streamPosition: Number(row['stream_position'] ?? -1),
    serverReceivedAt:
      typeof row['server_received_at'] === 'string' ? row['server_received_at'] : '',
  }));
}
