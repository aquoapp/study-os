/**
 * Construcción del registro de campaña · CP4 · §12.
 *
 * ---------------------------------------------------------------------------------------
 * Acción intentada ≠ acción aceptada
 *
 * Cada visita del Actor produce una acción **intentada**, con su propia huella. La acción
 * **aceptada** solo existe si la observación encontró evidencia del producto para ese ítem, y
 * lleva una huella distinta. `appendAccepted` se niega a registrar una aceptación sin su intento
 * previo, de modo que el ledger no puede fabricar evidencia por descuido.
 *
 * Las acciones que el producto **no** aceptó no desaparecen: se quedan como intento sin
 * aceptación, que es precisamente lo que hace enumerable un abandono.
 *
 * Las evaluaciones del oráculo son de campaña, no de paso: se registran en un paso final de
 * observación en vez de repartirse por el recorrido, porque atribuirlas a un paso concreto
 * sería inventar qué pantalla decidió cada propiedad.
 * ---------------------------------------------------------------------------------------
 */

import { createHash } from 'node:crypto';

import type { ActorLog, ScreenVisit } from './actor-log';
import type { CampaignManifest } from './campaign';
import { appendAccepted, type LedgerRouteProvenance } from './ledger-store';
import type {
  ActionRecord,
  CampaignRecord,
  ContractReference,
  ObservationRecord,
  ScenarioRecord,
  StepRecord,
  SyntheticLearnerRecord,
} from './ledger';
import { LEDGER_SCHEMA_VERSION } from './ledger';
import type { AttemptObservation, PropertyEvaluation } from './oracle';
import type { BarrierReading } from './observation';
import type { RouteEvidence } from './route';
import { CONTRACT_PROPERTIES } from './scenario';

function digest(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

function surfaceOf(visit: ScreenVisit): string {
  return visit.path.startsWith('/comprobar')
    ? 'BROWSER · /comprobar'
    : visit.path.startsWith('/aprender')
      ? 'BROWSER · /aprender'
      : `BROWSER · ${visit.path}`;
}

/** Huella de la acción intentada: lo que el Actor hizo, sin ningún identificador interno. */
function attemptedAction(visit: ScreenVisit, ordinal: number): ActionRecord {
  return {
    actionId: `act-${ordinal}`,
    surface: surfaceOf(visit),
    intent: visit.submitted
      ? `enviar respuesta ${visit.chosenOptionKey ?? '(sin opción)'} con confianza ${
          visit.confidenceEntered ?? '(sin confianza)'
        }`
      : visit.path.startsWith('/comprobar')
        ? 'abandonar la comprobación sin enviar'
        : 'leer y continuar',
    requestFingerprint: digest([
      'intento',
      visit.path,
      String(visit.ordinal),
      visit.chosenOptionKey ?? '',
      String(visit.confidenceEntered ?? ''),
      visit.visitedAt,
    ]),
    attemptedAt: visit.visitedAt,
    retryOf: null,
  };
}

export interface CampaignBuildInput {
  readonly manifest: CampaignManifest;
  readonly log: ActorLog;
  readonly attempts: readonly AttemptObservation[];
  readonly sessionItemByStem: ReadonlyMap<string, string>;
  readonly barrierReadings: readonly BarrierReading[];
  readonly evaluations: readonly PropertyEvaluation[];
  readonly subjectRef: string | null;
  readonly learnerId: string;
}

function observationRecord(reading: BarrierReading, index: number): ObservationRecord {
  return {
    observationId: `obs-${index + 1}`,
    subjectRef: reading.subjectRef,
    maxPosition: reading.maxPosition,
    consumedPosition: reading.consumedPosition,
    pending: reading.pending,
    readAt: reading.readAt,
  };
}

/** Pasos del recorrido: un paso por visita, con su intento y, si la hubo, su aceptación. */
export function walkSteps(input: CampaignBuildInput): readonly StepRecord[] {
  const acceptedByItem = new Map<string, AttemptObservation>();
  for (const attempt of input.attempts) {
    if (!acceptedByItem.has(attempt.sessionItemId))
      acceptedByItem.set(attempt.sessionItemId, attempt);
  }

  return input.log.visits.map((visit, index) => {
    const action = attemptedAction(visit, index + 1);
    const base: StepRecord = {
      ordinal: index + 1,
      intent: action.intent,
      expectedSurface: surfaceOf(visit),
      actions: [action],
      accepted: [],
      observations: [],
      evaluations: [],
      signals: [],
    };

    if (!visit.submitted || visit.questionStem === null) return base;

    const itemId = input.sessionItemByStem.get(visit.questionStem);
    const accepted = itemId === undefined ? undefined : acceptedByItem.get(itemId);
    if (accepted === undefined) return base;

    // La huella de la aceptación es la del producto, nunca la del intento.
    return appendAccepted(base, {
      actionId: action.actionId,
      acceptedRefs: [accepted.submittedEventId],
      acceptedDigest: digest([
        'aceptado',
        accepted.submittedEventId,
        String(accepted.attemptNumber),
        accepted.questionRepresentationId,
      ]),
    });
  });
}

/**
 * Paso final de observación.
 *
 * Reúne las lecturas de barrera y los veredictos del oráculo. No es una pantalla: es la fase en
 * que el laboratorio observa y concluye, y tenerla explícita evita que los veredictos parezcan
 * producidos por una acción del aprendiz.
 */
export function observationStep(input: CampaignBuildInput, ordinal: number): StepRecord {
  return {
    ordinal,
    intent: 'observar la barrera y evaluar el pre-registro',
    expectedSurface: 'OBSERVER · solo lectura',
    actions: [],
    accepted: [],
    observations: input.barrierReadings.map(observationRecord),
    evaluations: input.evaluations.map((evaluation) => evaluation.record),
    signals: [],
  };
}

/** Las reglas contractuales evaluadas, con su fuente. */
export function contractReferences(): readonly ContractReference[] {
  return CONTRACT_PROPERTIES.map((property) => ({
    ruleId: property.id,
    ruleVersion: '1.0.0',
    sourceDocument: property.source,
  }));
}

export function routeProvenanceFor(
  evidence: readonly RouteEvidence[],
): readonly LedgerRouteProvenance[] {
  return evidence.map((item) => ({
    streamPosition: item.streamPosition,
    attribution: item.attribution,
    foldReason: item.foldReason,
    foldedAt: item.foldedAt,
    latencySeconds: item.latencySeconds,
    rationale: item.rationale,
    recordedByProduct: false,
  }));
}

/** Construye el registro de campaña completo que §12 exige. */
export function buildCampaignRecord(input: CampaignBuildInput): CampaignRecord {
  const steps = walkSteps(input);
  const learner: SyntheticLearnerRecord = {
    learnerId: input.learnerId,
    profileId: input.manifest.profileId,
    profileVersion: input.manifest.profileVersion,
    subjectRef: input.subjectRef,
  };
  const scenario: ScenarioRecord = {
    scenarioId: input.manifest.scenarioId,
    scenarioVersion: input.manifest.scenarioVersion,
    preregistrationDigest: input.manifest.preregistrationDigest,
    steps: [...steps, observationStep(input, steps.length + 1)],
  };

  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    campaignId: input.manifest.campaignId,
    designVersion: 'LAB-ARCH-DF-001',
    provenance: {
      appCommit: input.manifest.studyOsBuild,
      engineVersion: 'concept-evidence-1.0.0',
      plannerVersion: 'v1',
      corpusVersion: input.manifest.corpusVersion,
      configDigest: input.manifest.digest,
      substrateIdentity: input.manifest.executionMode,
    },
    contracts: contractReferences(),
    learners: [learner],
    scenarios: [scenario],
    artifacts: [],
  };
}
