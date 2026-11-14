/**
 * Fundación del Experimental Ledger · modelo lógico versionado.
 *
 * ---------------------------------------------------------------------------
 * Qué es y qué no es
 *
 * Es el registro del **experimento**: qué se intentó, qué aceptó el producto, qué se observó y
 * qué se concluyó. **No es autoridad de STUDY OS**: no decide estado de aprendizaje, no corrige
 * evidencia y nada del producto lo lee.
 *
 * Dos decisiones que el Design Freeze obliga a respetar y que aquí son estructura:
 *
 *   1. **Acción intentada ≠ acción aceptada.** Viajan en campos distintos y con digests
 *      distintos. Una acción que el producto rechazó no es evidencia de nada salvo del rechazo.
 *   2. **Un veredicto inválido no se persiste.** `appendEvaluation` valida antes de escribir, de
 *      modo que el ledger no puede contener un `PASS` que el contrato prohíbe.
 * ---------------------------------------------------------------------------
 */

import { assertEvaluationRecord, type EvaluationRecord } from './verdict';

/** Versión del esquema lógico. Cambiarla invalida comparaciones con campañas anteriores. */
export const LEDGER_SCHEMA_VERSION = 'lab-ledger-1.0.0';

export interface Provenance {
  readonly appCommit: string;
  readonly engineVersion: string;
  readonly plannerVersion: string;
  readonly corpusVersion: string;
  readonly configDigest: string;
  readonly substrateIdentity: string;
}

export interface ContractReference {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly sourceDocument: string;
}

export interface ArtifactHash {
  readonly kind: string;
  readonly sha256: string;
  readonly path: string;
}

/** Una acción **intentada**. Que exista no implica que el producto la aceptara. */
export interface ActionRecord {
  readonly actionId: string;
  readonly surface: string;
  readonly intent: string;
  readonly requestFingerprint: string;
  readonly attemptedAt: string;
  readonly retryOf: string | null;
}

/** Lo que el producto **aceptó**, verificado aparte. Digest propio, nunca el de la acción. */
export interface AcceptedActionRecord {
  readonly actionId: string;
  readonly acceptedRefs: readonly string[];
  readonly acceptedDigest: string;
}

/** Lectura de la barrera de observación. */
export interface ObservationRecord {
  readonly observationId: string;
  readonly subjectRef: string;
  readonly maxPosition: number | null;
  readonly consumedPosition: number | null;
  readonly pending: boolean | null;
  readonly readAt: string;
}

/** Señal del observador de producto. Nunca genera FAIL. */
export interface ObserverSignalRecord {
  readonly signalId: string;
  readonly pattern: string;
  readonly promoted: boolean;
}

export interface StepRecord {
  readonly ordinal: number;
  readonly intent: string;
  readonly expectedSurface: string;
  readonly actions: readonly ActionRecord[];
  readonly accepted: readonly AcceptedActionRecord[];
  readonly observations: readonly ObservationRecord[];
  readonly evaluations: readonly EvaluationRecord[];
  readonly signals: readonly ObserverSignalRecord[];
}

export interface ScenarioRecord {
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly preregistrationDigest: string | null;
  readonly steps: readonly StepRecord[];
}

export interface SyntheticLearnerRecord {
  readonly learnerId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly subjectRef: string | null;
}

export interface CampaignRecord {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly campaignId: string;
  readonly designVersion: string;
  readonly provenance: Provenance;
  readonly contracts: readonly ContractReference[];
  readonly learners: readonly SyntheticLearnerRecord[];
  readonly scenarios: readonly ScenarioRecord[];
  readonly artifacts: readonly ArtifactHash[];
}

export class LedgerRejection extends Error {
  constructor(message: string) {
    super(`ledger · ${message}`);
    this.name = 'LedgerRejection';
  }
}

/** Esqueleto de campaña vacío. CP1 **no** escribe campañas reales. */
export function emptyCampaign(
  campaignId: string,
  designVersion: string,
  provenance: Provenance,
): CampaignRecord {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    campaignId,
    designVersion,
    provenance,
    contracts: [],
    learners: [],
    scenarios: [],
    artifacts: [],
  };
}

/**
 * Valida un veredicto **antes** de admitirlo. Es el punto donde el ledger se niega a conservar
 * algo que el contrato no permite, en vez de guardarlo y confiar en que alguien lo revise.
 */
export function appendEvaluation(step: StepRecord, evaluation: EvaluationRecord): StepRecord {
  assertEvaluationRecord(evaluation);
  return { ...step, evaluations: [...step.evaluations, evaluation] };
}

/** Comprueba la coherencia estructural mínima de una campaña antes de reportarla. */
export function assertCampaign(campaign: CampaignRecord): void {
  if (campaign.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    throw new LedgerRejection(
      `versión de esquema desconocida: ${campaign.schemaVersion}. Una campaña de otra versión no ` +
        'es comparable con esta sin una migración explícita.',
    );
  }
  const acceptedIds = new Set<string>();
  for (const scenario of campaign.scenarios) {
    for (const step of scenario.steps) {
      const attempted = new Set(step.actions.map((action) => action.actionId));
      for (const accepted of step.accepted) {
        if (!attempted.has(accepted.actionId)) {
          throw new LedgerRejection(
            `la acción aceptada ${accepted.actionId} no tiene acción intentada: aceptación sin ` +
              'intento es evidencia fabricada',
          );
        }
        if (acceptedIds.has(accepted.actionId)) {
          throw new LedgerRejection(`acción aceptada duplicada: ${accepted.actionId}`);
        }
        acceptedIds.add(accepted.actionId);
      }
      for (const evaluation of step.evaluations) assertEvaluationRecord(evaluation);
    }
  }
}
