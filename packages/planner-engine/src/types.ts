/**
 * Tipos del Planner v1 · `docs/PLANNER_CONTRACT.md` v1.4.
 *
 * Todo lo que entra aquí tiene una fuente de producción autorizada (ADR-012, decisión 15), salvo
 * la duración, que es **entrada del contrato** (§I.3) y cuyo origen es P4-D2, diferida.
 */

/** Versión del algoritmo. Constante de código: sube con la release (§T). */
export const PLANNER_VERSION = 'planner-v1' as const;

/** Los cinco estados categóricos del Learning Engine v1, leídos, nunca derivados (§W). */
export const V1_MASTERY_STATES = [
  'NEW',
  'EXPOSED',
  'EVIDENCE_POSITIVE',
  'EVIDENCE_NEGATIVE',
  'EVIDENCE_CONFLICTING',
] as const;
export type MasteryState = (typeof V1_MASTERY_STATES)[number];

export const V1_UNCERTAINTY = [
  'NO_EVIDENCE',
  'SINGLE_OBSERVATION',
  'REPEATED_SAME_QUESTION',
  'MULTIPLE_QUESTIONS',
] as const;
export type Uncertainty = (typeof V1_UNCERTAINTY)[number];

/** Estado de publicación del concepto en el pack. */
export type ConceptStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

/** Procedencia del presupuesto (§I.2). El override del día no tiene almacenamiento en 4A. */
export const BUDGET_SOURCES = ['TODAY_OVERRIDE', 'WEEKLY_ENTRY', 'DEFAULT_DAILY'] as const;
export type BudgetSource = (typeof BUDGET_SOURCES)[number];

/**
 * Procedencia de la duración.
 *
 * `FIXTURE` se conserva para que las ejecuciones de prueba sigan siendo expresables y
 * distinguibles de las de producción. **`HYBRID_V1`** es la procedencia de producción que P4-D2
 * autoriza (ADR-013): minutos de unidad desde el metadato de autoría **fijado a la versión exacta**
 * que el Planner selecciona, y minutos de pregunta desde la `planner_config` de la versión
 * registrada. Ninguna reproducción consulta jamás una fuente de duración: la entrada canónica ya
 * lleva los minutos de cada candidato, de modo que toda ejecución pasada sigue siendo byte a byte
 * reproducible (P4-G4).
 *
 * Una fuente aprendida o adaptativa sería aditiva y **no está autorizada** (DEF-11, §D).
 */
export const DURATION_PROVENANCES = ['FIXTURE', 'HYBRID_V1'] as const;
export type DurationProvenance = (typeof DURATION_PROVENANCES)[number];

/** Días de la semana de `weekly_availability_json`, en orden ISO (1 = lunes). */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Unidad de aprendizaje publicada del concepto, con su versión publicada vigente. */
export interface UnitCandidate {
  readonly learningUnitId: string;
  readonly learningUnitVersionId: string;
  /** INV-109 · la fuente de la versión está desactualizada o bloqueada. */
  readonly sourceExcluded: boolean;
  /**
   * Minutos declarados. Entrada del contrato (§I.3), con la procedencia que P4-D2 autoriza.
   *
   * **`null` es dato, no hueco.** Una versión publicada sin metadato de duración es una condición
   * estructural veraz: no se rellena en silencio, y el candidato queda excluido con
   * `NO_DURATION_METADATA` (ADR-013 §2.5).
   */
  readonly minutes: number | null;
}

/**
 * Pregunta publicada con mapeo `PRIMARY` `VALIDATED` al concepto en la generación de atribución
 * vigente, con su representación publicada vigente.
 */
export interface QuestionCandidate {
  readonly questionId: string;
  readonly representationId: string;
  /** INV-109 · la fuente de la representación está desactualizada o bloqueada. */
  readonly sourceExcluded: boolean;
  /** Ya respondida en el día de plan (§H: se eligen preguntas no respondidas ese día). */
  readonly answeredToday: boolean;
  readonly minutes: number;
}

/** Clave de sílabo (§H). Solo datos estables de contenido. */
export interface SyllabusKey {
  readonly blockSortOrder: number;
  readonly topicSortOrder: number;
  readonly conceptSortOrder: number;
  readonly conceptKey: string;
}

/** Un concepto del pack resuelto, con lo que el motor dice de él y su contenido elegible. */
export interface PlannerConcept {
  readonly conceptId: string;
  readonly conceptStatus: ConceptStatus;
  readonly syllabus: SyllabusKey;
  /** `NEW` cuando el motor no tiene fila (§W.2). */
  readonly masteryState: MasteryState;
  readonly uncertainty: Uncertainty;
  /** Algún patrón de error estructural activo (§F.1). */
  readonly activeErrorPattern: boolean;
  /**
   * `last_negative_position` del motor (P4-D6, contrato del motor §25). No nulo exactamente
   * cuando el estado es `EVIDENCE_NEGATIVE` o `EVIDENCE_CONFLICTING`. El Planner **nunca** lo
   * calcula.
   */
  readonly lastNegativePosition: number | null;
  /** Algún ítem de sesión de este concepto quedó completado en el día de plan (§E.5). */
  readonly completedToday: boolean;
  readonly units: readonly UnitCandidate[];
  readonly questions: readonly QuestionCandidate[];
}

/** La tupla de frescura del motor que la ejecución consume (§M). */
export interface EngineTuple {
  readonly engineVersion: string;
  readonly engineConfigVersion: string;
  readonly attributionPackVersionId: string;
  readonly attributionGeneration: number;
  readonly consumedPosition: number;
}

export interface Budget {
  readonly minutes: number;
  readonly source: BudgetSource;
}

/** Entrada canónica completa de una ejecución. Todo lo que decide está aquí, y nada más. */
export interface PlannerInput {
  readonly plannerVersion: typeof PLANNER_VERSION;
  readonly plannerConfigVersion: string;
  readonly userId: string;
  readonly goalId: string;
  readonly packVersionId: string;
  /** Fecha de calendario `YYYY-MM-DD` en la zona horaria declarada de la persona (§I.1). */
  readonly planDay: string;
  readonly timezone: string;
  readonly budget: Budget;
  readonly engine: EngineTuple;
  readonly durationProvenance: DurationProvenance;
  readonly concepts: readonly PlannerConcept[];
}

/** Acciones de v1 bajo granularidad híbrida (P4-D3). */
export type ActionKind = 'LEARN' | 'CHECK' | 'RELEARN_CHECK';

/** Razón de composición (§R). */
export type CompositionReason = 'REMEDIATION_GUARANTEE' | 'COVERAGE' | 'REMEDIATION_OVERFLOW';

/** Necesidad categórica de un candidato (§F). */
export type Need = 'REMEDIATION' | 'VERIFICATION' | 'COVERAGE' | 'NONE';

/** Enum cerrado de razones de exclusión (§E, más `NO_PUBLISHED_UNIT`, ver `plan.ts`). */
export const EXCLUSION_REASONS = [
  'TARGET_RETIRED',
  'NO_ATTRIBUTED_QUESTION',
  'NO_PUBLISHED_UNIT',
  'SOURCE_STATUS_EXCLUDED',
  'COMPLETED_TODAY',
  'POSITIVE_NO_REVIEW_POLICY',
  'OVER_BUDGET',
  /**
   * ADR-013 §2.5 · la versión publicada no declara duración. Razón **propia**: reutilizar
   * `NO_PUBLISHED_UNIT` confundiría dos causas distintas y degradaría la explicabilidad que §R
   * exige. La ejecución continúa con el resto: §E excluye candidatos, no aborta planes.
   * **Nunca es superficie de aprendiz.**
   */
  'NO_DURATION_METADATA',
] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export const COMPOSITION_REASONS = [
  'REMEDIATION_GUARANTEE',
  'COVERAGE',
  'REMEDIATION_OVERFLOW',
] as const;

export const PLAN_OUTCOMES = ['PLANNED', 'NOTHING_FITS', 'NOTHING_ELIGIBLE', 'ZERO_TIME'] as const;
export type PlanOutcome = (typeof PLAN_OUTCOMES)[number];

/** Un paso de una acción: exactamente un destino tipado, como un ítem de sesión (ADR-007). */
export type PlannedStep =
  | {
      readonly step: 'LEARN';
      readonly itemType: 'LEARNING_UNIT';
      readonly learningUnitId: string;
      readonly learningUnitVersionId: string;
      readonly minutes: number;
    }
  | {
      readonly step: 'CHECK';
      readonly itemType: 'QUESTION';
      readonly questionId: string;
      readonly representationId: string;
      readonly minutes: number;
    };

export interface PlannedAction {
  /** Posición de la acción en el plan, desde 1. */
  readonly ordinal: number;
  readonly conceptId: string;
  readonly kind: ActionKind;
  readonly reason: CompositionReason;
  readonly minutes: number;
  readonly steps: readonly PlannedStep[];
}

/** Lo que la auditoría conserva de cada candidato, elegido o no (§S). */
export interface CandidateAudit {
  readonly conceptId: string;
  readonly masteryState: MasteryState;
  readonly uncertainty: Uncertainty;
  readonly activeErrorPattern: boolean;
  readonly lastNegativePosition: number | null;
  readonly need: Need;
  readonly exclusion: ExclusionReason | null;
  readonly syllabus: SyllabusKey;
  /** Ordinal de la acción que lo colocó, o `null`. */
  readonly placedOrdinal: number | null;
}

export interface PlanDecision {
  readonly outcome: PlanOutcome;
  readonly plannedMinutes: number;
  readonly actions: readonly PlannedAction[];
  /** Todos los candidatos, ordenados por `conceptId` por punto de código. */
  readonly candidates: readonly CandidateAudit[];
}
