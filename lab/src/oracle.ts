/**
 * Contract Oracle · CP4 · §10.
 *
 * ---------------------------------------------------------------------------------------
 * Qué puede y qué no puede hacer este módulo
 *
 * Evalúa **solo** las propiedades pre-registradas, una por criterio sellado y en su orden. No
 * puede añadir una propiedad al ver el resultado, porque no recorre el escenario: recorre el
 * pre-registro. Si apareciera una obligación interesante que nadie pre-registró, el camino es
 * una señal de producto y una decisión humana, no un veredicto nuevo.
 *
 * Es una **función pura sobre lo observado**. No toca la red, no consulta el producto y no
 * escribe nada. Lo que no se pudo observar no se supone: se devuelve `INCONCLUSIVE`, que cuenta
 * en el denominador, o `NOT_APPLICABLE` cuando la precondición de la propiedad no se dio, que
 * no cuenta y nunca es un aprobado disfrazado.
 *
 * Los cinco ejes viajan separados. Un `FAIL` real **no** invalida el run (§03.2).
 * ---------------------------------------------------------------------------------------
 */

import { resolveNegativeAssertion } from './contracts';
import type { OraclePreregistration, PreregisteredCriterion } from './preregistration';
import { CONTRACT_PROPERTIES, SCENARIO_VERSION } from './scenario';
import type { ContractVerdict, EvaluationRecord } from './verdict';
import { assertEvaluationRecord } from './verdict';

export class OracleRefused extends Error {
  constructor(message: string) {
    super(`oráculo · ${message}`);
    this.name = 'OracleRefused';
  }
}

// ---------------------------------------------------------------------------------------
// Lo observado. Nombres y tipos siguen las columnas reales del esquema congelado.
// ---------------------------------------------------------------------------------------

export interface EventObservation {
  readonly streamPosition: number;
  readonly eventType: string;
  readonly sessionItemId: string | null;
}

export interface AttemptObservation {
  readonly sessionItemId: string;
  readonly questionId: string;
  readonly questionRepresentationId: string;
  readonly submittedEventId: string;
  readonly answerKind: 'OPTION' | 'BLANK';
  readonly selectedOptionKey: string | null;
  readonly isCorrectAtSubmission: boolean;
  readonly confidenceValue: number | null;
  readonly confidenceScaleVersion: string | null;
  readonly attemptNumber: number;
  /**
   * Clave correcta según el servidor, leída por el Observador **después** de la ejecución.
   * El Actor nunca la ve: por eso es evidencia de P-05 y no una filtración.
   */
  readonly serverCorrectOptionKey: string;
}

export interface PresentedItemObservation {
  readonly sessionItemId: string;
  readonly itemType: string;
  readonly presentedRepresentationId: string | null;
  readonly presentedLearningUnitVersionId: string | null;
  readonly status: string;
}

export interface BarrierObservation {
  readonly maxPosition: number | null;
  readonly consumedPosition: number | null;
  readonly pending: boolean | null;
}

export interface PlannerObservation {
  readonly plannedConceptKeys: readonly string[];
  readonly exclusions: ReadonlyArray<{ readonly conceptKey: string; readonly reason: string }>;
}

/**
 * Lo que el Actor registró **desde la superficie de aprendiz**, y nada más.
 *
 * No es autoridad sobre el producto: es la mitad de la comparación. Confrontarlo con lo que el
 * servidor guardó es justamente lo que hace comprobables P-03, P-04 y P-07.
 */
export interface ActorTestimony {
  /** Confianza que introdujo antes de enviar, por ítem. */
  readonly confidenceByItem: ReadonlyMap<string, number>;
  /** Representación que vio en pantalla, por ítem. */
  readonly presentedRepresentationByItem: ReadonlyMap<string, string>;
  /** Ítems que abandonó sin enviar. Precondición de P-07. */
  readonly abandonedWithoutSubmit: readonly string[];
  /** Si alguna carga previa al envío contenía una clave de respuesta. */
  readonly answerKeyVisibleBeforeSubmit: boolean;
  /** Envíos distintos que intentó por ítem. */
  readonly submitsByItem: ReadonlyMap<string, number>;
}

export interface EvidenceSnapshot {
  readonly subjectRef: string;
  readonly events: readonly EventObservation[];
  readonly attempts: readonly AttemptObservation[];
  readonly presentedItems: readonly PresentedItemObservation[];
  readonly barrier: BarrierObservation;
  readonly planner: PlannerObservation;
  readonly actor: ActorTestimony;
  /** Conceptos que el corpus declara sin unidad publicada. Precondición de P-08. */
  readonly structuralScarcityConcepts: readonly string[];
  /** Falso si alguna lectura del Observador falló: ninguna aserción negativa puede ser PASS. */
  readonly observationComplete: boolean;
}

// ---------------------------------------------------------------------------------------
// Resultado por criterio.
// ---------------------------------------------------------------------------------------

export interface PropertyEvaluation {
  readonly propertyId: string;
  readonly record: EvaluationRecord;
  /** Por qué ese veredicto, en una frase. Va al informe; no sustituye al veredicto. */
  readonly rationale: string;
}

interface Finding {
  readonly verdict: ContractVerdict;
  readonly rationale: string;
}

/** La barrera queda establecida cuando se pudo leer, no hay pendiente y el consumo alcanzó. */
function barrierEstablished(snapshot: EvidenceSnapshot): boolean {
  const { maxPosition, consumedPosition, pending } = snapshot.barrier;
  if (!snapshot.observationComplete) return false;
  if (maxPosition === null || consumedPosition === null || pending === null) return false;
  return !pending && consumedPosition >= maxPosition;
}

function lastAcceptedPosition(snapshot: EvidenceSnapshot): number {
  return snapshot.events.reduce((max, event) => Math.max(max, event.streamPosition), 0);
}

// ---------------------------------------------------------------------------------------
// Las ocho propiedades. Cada una mira evidencia y devuelve veredicto, nunca al revés.
// ---------------------------------------------------------------------------------------

function evaluateP01(snapshot: EvidenceSnapshot): Finding {
  if (snapshot.events.length === 0) {
    return {
      verdict: 'INCONCLUSIVE',
      rationale: 'no se observó ningún evento: no hay stream sobre el que afirmar contigüidad',
    };
  }
  const positions = snapshot.events.map((event) => event.streamPosition).sort((a, b) => a - b);
  const duplicates = positions.filter(
    (value, index) => index > 0 && value === positions[index - 1],
  );
  if (duplicates.length > 0) {
    return {
      verdict: 'FAIL',
      rationale: `posiciones duplicadas: ${[...new Set(duplicates)].join(', ')}`,
    };
  }
  if (positions[0] !== 1) {
    return { verdict: 'FAIL', rationale: `el stream empieza en ${positions[0]} y no en 1` };
  }
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i] !== positions[i - 1]! + 1) {
      return {
        verdict: 'FAIL',
        rationale: `hueco entre ${positions[i - 1]} y ${positions[i]}`,
      };
    }
  }
  return {
    verdict: 'PASS',
    rationale: `${positions.length} evento(s) contiguos de 1 a ${positions[positions.length - 1]}`,
  };
}

function evaluateP02(snapshot: EvidenceSnapshot): Finding {
  if (snapshot.attempts.length === 0) {
    return { verdict: 'NOT_APPLICABLE', rationale: 'no hubo ningún intento registrado' };
  }
  const events = new Set<string>();
  for (const attempt of snapshot.attempts) {
    if (events.has(attempt.submittedEventId)) {
      return {
        verdict: 'FAIL',
        rationale: 'dos intentos aceptados comparten el mismo evento de envío',
      };
    }
    events.add(attempt.submittedEventId);
  }
  // Un ítem no puede haber aceptado más intentos que envíos distintos hizo el Actor.
  const perItem = new Map<string, number>();
  for (const attempt of snapshot.attempts) {
    perItem.set(attempt.sessionItemId, (perItem.get(attempt.sessionItemId) ?? 0) + 1);
  }
  for (const [itemId, accepted] of perItem) {
    const attempted = snapshot.actor.submitsByItem.get(itemId);
    if (attempted === undefined) {
      return {
        verdict: 'INCONCLUSIVE',
        rationale: `hay intentos aceptados del ítem ${itemId} y el Actor no registró envíos suyos`,
      };
    }
    if (accepted > attempted) {
      return {
        verdict: 'FAIL',
        rationale: `el ítem ${itemId} acumula ${accepted} intento(s) frente a ${attempted} envío(s)`,
      };
    }
  }
  return {
    verdict: 'PASS',
    rationale: `${snapshot.attempts.length} intento(s), uno por envío, sin duplicados`,
  };
}

function evaluateP03(snapshot: EvidenceSnapshot): Finding {
  if (snapshot.attempts.length === 0) {
    return { verdict: 'NOT_APPLICABLE', rationale: 'sin intentos no hay representación evaluada' };
  }
  const presented = new Map(
    snapshot.presentedItems.map((item) => [item.sessionItemId, item.presentedRepresentationId]),
  );
  for (const attempt of snapshot.attempts) {
    const server = presented.get(attempt.sessionItemId);
    if (server === undefined || server === null) {
      return {
        verdict: 'INCONCLUSIVE',
        rationale: `el ítem ${attempt.sessionItemId} no registró qué representación presentó`,
      };
    }
    if (server !== attempt.questionRepresentationId) {
      return {
        verdict: 'FAIL',
        rationale: `el ítem ${attempt.sessionItemId} evaluó una representación distinta de la presentada`,
      };
    }
    // Y lo presentado por el servidor es lo que el Actor vio en pantalla.
    const seen = snapshot.actor.presentedRepresentationByItem.get(attempt.sessionItemId);
    if (seen !== undefined && seen !== server) {
      return {
        verdict: 'FAIL',
        rationale: `el Actor vio otra representación que la registrada en el ítem ${attempt.sessionItemId}`,
      };
    }
  }
  return { verdict: 'PASS', rationale: 'toda representación evaluada es la presentada y la vista' };
}

function evaluateP04(snapshot: EvidenceSnapshot): Finding {
  const withOption = snapshot.attempts.filter((attempt) => attempt.answerKind === 'OPTION');
  if (withOption.length === 0) {
    return { verdict: 'NOT_APPLICABLE', rationale: 'ningún intento con opción elegida' };
  }
  for (const attempt of withOption) {
    if (attempt.confidenceValue === null || attempt.confidenceScaleVersion === null) {
      return {
        verdict: 'FAIL',
        rationale: `el ítem ${attempt.sessionItemId} se aceptó sin confianza o sin versión de escala`,
      };
    }
    const declared = snapshot.actor.confidenceByItem.get(attempt.sessionItemId);
    if (declared === undefined) {
      return {
        verdict: 'INCONCLUSIVE',
        rationale: `el Actor no registró la confianza que introdujo en ${attempt.sessionItemId}`,
      };
    }
    if (declared !== attempt.confidenceValue) {
      return {
        verdict: 'FAIL',
        rationale: `confianza alterada en ${attempt.sessionItemId}: ${declared} → ${attempt.confidenceValue}`,
      };
    }
  }
  return {
    verdict: 'PASS',
    rationale: `${withOption.length} intento(s) conservan la confianza declarada antes del envío`,
  };
}

function evaluateP05(snapshot: EvidenceSnapshot): Finding {
  if (snapshot.actor.answerKeyVisibleBeforeSubmit) {
    return {
      verdict: 'FAIL',
      rationale: 'el Actor pudo ver una clave de respuesta antes de enviar (INV-101)',
    };
  }
  const withOption = snapshot.attempts.filter((attempt) => attempt.answerKind === 'OPTION');
  if (withOption.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      rationale: 'sin opción elegida no hay corrección que atribuir',
    };
  }
  for (const attempt of withOption) {
    // Una clave que no se pudo leer no es una clave distinta: concluir FAIL aquí convertiría un
    // fallo de observación en un incumplimiento del producto.
    if (attempt.serverCorrectOptionKey === '') {
      return {
        verdict: 'INCONCLUSIVE',
        rationale: `no se pudo leer la clave del servidor del ítem ${attempt.sessionItemId}`,
      };
    }
    const expected = attempt.selectedOptionKey === attempt.serverCorrectOptionKey;
    if (attempt.isCorrectAtSubmission !== expected) {
      return {
        verdict: 'FAIL',
        rationale: `la corrección guardada del ítem ${attempt.sessionItemId} no concuerda con la clave del servidor`,
      };
    }
  }
  return {
    verdict: 'PASS',
    rationale: 'la corrección coincide con la clave del servidor y el cliente no la tuvo antes',
  };
}

function evaluateP06(snapshot: EvidenceSnapshot): Finding {
  const { maxPosition, consumedPosition } = snapshot.barrier;
  if (maxPosition === null || consumedPosition === null) {
    return { verdict: 'INCONCLUSIVE', rationale: 'la barrera no se pudo leer' };
  }
  if (snapshot.events.length === 0) {
    return { verdict: 'NOT_APPLICABLE', rationale: 'sin eventos no hay proyección que alcanzar' };
  }
  if (consumedPosition < maxPosition) {
    return {
      verdict: 'FAIL',
      rationale: `la proyección consumió ${consumedPosition} y el stream llegó a ${maxPosition}`,
    };
  }
  return { verdict: 'PASS', rationale: `proyección al día: ${consumedPosition} ≥ ${maxPosition}` };
}

function evaluateP07(snapshot: EvidenceSnapshot): Finding {
  if (snapshot.actor.abandonedWithoutSubmit.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      rationale: 'el escenario no llegó a abandonar ninguna pantalla sin enviar',
    };
  }
  const accepted = new Set(snapshot.attempts.map((attempt) => attempt.sessionItemId));
  const leaked = snapshot.actor.abandonedWithoutSubmit.filter((itemId) => accepted.has(itemId));
  if (leaked.length > 0) {
    return {
      verdict: 'FAIL',
      rationale: `se aceptó evidencia de ${leaked.length} ítem(s) abandonados sin enviar`,
    };
  }
  // Aserción negativa: sin barrera no hay PASS posible, por mucho que no veamos nada.
  const gated = resolveNegativeAssertion({
    completenessEstablished: barrierEstablished(snapshot),
    pending: snapshot.barrier.pending ?? true,
    consumedPosition: snapshot.barrier.consumedPosition ?? -1,
    lastAcceptedPosition: lastAcceptedPosition(snapshot),
  });
  return gated === 'PASS'
    ? {
        verdict: 'PASS',
        rationale: 'barrera establecida y ningún ítem abandonado dejó evidencia aceptada',
      }
    : {
        verdict: 'INCONCLUSIVE',
        rationale: 'no se vio evidencia del abandono, pero la barrera no quedó establecida',
      };
}

function evaluateP08(snapshot: EvidenceSnapshot): Finding {
  if (snapshot.structuralScarcityConcepts.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      rationale: 'el corpus no declara escasez estructural en esta ejecución',
    };
  }
  const planned = new Set(snapshot.planner.plannedConceptKeys);
  const scarce = snapshot.structuralScarcityConcepts;
  const wronglyPlanned = scarce.filter((key) => planned.has(key));
  if (wronglyPlanned.length > 0) {
    return {
      verdict: 'FAIL',
      rationale: `se planificó ${wronglyPlanned.join(', ')} sin unidad publicada`,
    };
  }
  if (snapshot.planner.exclusions.length === 0) {
    return {
      verdict: 'INCONCLUSIVE',
      rationale: 'no se planificó el concepto escaso, pero no se observó la razón de exclusión',
    };
  }
  const justified = scarce.every((key) =>
    snapshot.planner.exclusions.some(
      (exclusion) => exclusion.conceptKey === key && exclusion.reason === 'NO_PUBLISHED_UNIT',
    ),
  );
  return justified
    ? {
        verdict: 'PASS',
        rationale: 'el concepto sin unidad se excluyó como NO_PUBLISHED_UNIT: escasez de contenido',
      }
    : {
        verdict: 'FAIL',
        rationale: 'el concepto sin unidad se excluyó por una razón que no es escasez de contenido',
      };
}

const EVALUATORS: Readonly<Record<string, (snapshot: EvidenceSnapshot) => Finding>> = {
  'P-01': evaluateP01,
  'P-02': evaluateP02,
  'P-03': evaluateP03,
  'P-04': evaluateP04,
  'P-05': evaluateP05,
  'P-06': evaluateP06,
  'P-07': evaluateP07,
  'P-08': evaluateP08,
};

/** Coberturas y revisión humana se derivan del veredicto; no se eligen a mano. */
function recordFor(
  criterion: PreregisteredCriterion,
  finding: Finding,
  snapshot: EvidenceSnapshot,
): EvaluationRecord {
  const negative = criterion.requiresCompletenessBarrier;
  return {
    runValidity: 'VALID',
    coverage: finding.verdict === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'EXECUTED',
    contract: finding.verdict,
    productFindings: [],
    humanReview:
      finding.verdict === 'FAIL'
        ? 'GOVERNANCE_REVIEW_REQUIRED'
        : finding.verdict === 'INCONCLUSIVE'
          ? 'MORE_EVIDENCE_REQUIRED'
          : 'PENDING',
    ruleId: criterion.propertyId,
    ruleVersion: SCENARIO_VERSION,
    completenessEstablished: negative ? barrierEstablished(snapshot) : snapshot.observationComplete,
    negativeAssertion: negative,
  };
}

/**
 * Evalúa el pre-registro contra lo observado.
 *
 * Exige que el pre-registro esté íntegro y que cada criterio tenga evaluador: un criterio
 * sellado que nadie sepa evaluar es `INCONCLUSIVE` explícito, no una propiedad que desaparece
 * del denominador.
 */
export function evaluate(
  snapshot: EvidenceSnapshot,
  preregistration: OraclePreregistration,
): readonly PropertyEvaluation[] {
  if (preregistration.criteria.length === 0) {
    throw new OracleRefused('el pre-registro no declara ningún criterio');
  }
  const known = new Set(CONTRACT_PROPERTIES.map((property) => property.id));
  const evaluations: PropertyEvaluation[] = [];

  for (const criterion of preregistration.criteria) {
    if (!known.has(criterion.propertyId)) {
      throw new OracleRefused(
        `el criterio «${criterion.propertyId}» no corresponde a ninguna propiedad del escenario`,
      );
    }
    const evaluator = EVALUATORS[criterion.propertyId];
    const finding: Finding = evaluator
      ? evaluator(snapshot)
      : {
          verdict: 'INCONCLUSIVE',
          rationale: 'criterio pre-registrado sin evaluador: no se puede concluir',
        };

    const record = recordFor(criterion, finding, snapshot);
    // La última defensa: el propio modelo de veredicto rechaza lo que el contrato no permite.
    assertEvaluationRecord(record);
    evaluations.push({ propertyId: criterion.propertyId, record, rationale: finding.rationale });
  }

  return evaluations;
}

export interface ContractSummary {
  readonly pass: number;
  readonly fail: number;
  readonly inconclusive: number;
  readonly notApplicable: number;
  /** Denominador contractual: `NOT_APPLICABLE` fuera, `INCONCLUSIVE` dentro. */
  readonly denominator: number;
}

export function summarize(evaluations: readonly PropertyEvaluation[]): ContractSummary {
  const count = (verdict: ContractVerdict): number =>
    evaluations.filter((evaluation) => evaluation.record.contract === verdict).length;
  const pass = count('PASS');
  const fail = count('FAIL');
  const inconclusive = count('INCONCLUSIVE');
  const notApplicable = count('NOT_APPLICABLE');
  return {
    pass,
    fail,
    inconclusive,
    notApplicable,
    denominator: pass + fail + inconclusive,
  };
}
