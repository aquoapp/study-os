export {
  ACTIVE_DIMENSIONS,
  ENGINE_ALGORITHM_ID,
  ENGINE_ALGORITHM_VERSION,
  ENGINE_VERSION,
  EngineConfigError,
  INACTIVE_DIMENSIONS,
  UNSET_POLICY_SLOTS,
  assertEngineConfigV1,
  type EngineConfigDocument,
  type UnsetPolicySlot,
} from './config';

export {
  classifyAttempt,
  foldEvidence,
  isTemporallyAnomalous,
  outcomeOf,
  type Eligibility,
  type FoldOutcome,
} from './fold';

export { canonicalProjection, canonicalResult, runEngine } from './engine';

export {
  decideRunMode,
  historyReasonOf,
  type DeclaredSemantics,
  type RunMode,
  type RunModeInput,
} from './mode';

export { deriveMasteryState, deriveUncertainty } from './state';

export {
  CONFIDENCE_LEVELS,
  ERROR_PATTERN_RECURRENCE,
  MAX_CONFIDENCE_LEVEL,
  RESERVED_MASTERY_STATES,
  V1_ERROR_PATTERN_TYPES,
  V1_MASTERY_STATES,
  V1_UNCERTAINTY,
  type AttemptOutcome,
  type AttemptRow,
  type AttributionSnapshot,
  type ConceptProjection,
  type ConceptVector,
  type ConfidenceCells,
  type ConfidenceLevel,
  type EngineInput,
  type EngineResult,
  type ErrorPattern,
  type ErrorPatternType,
  type ExposureRow,
  type MasteryState,
  type ReservedMasteryState,
  type Uncertainty,
} from './types';
