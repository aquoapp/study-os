/**
 * Modelo de veredicto del Synthetic Learner Lab · **los cinco ejes ortogonales**.
 *
 * ---------------------------------------------------------------------------
 * Por qué cinco y no una lista
 *
 * El Experimental Design v1.0 §03.2 se titula literalmente «Estados ortogonales (no mezclar)».
 * Aplanarlos en una sola enumeración pierde información que el contrato exige conservar: un run
 * puede ser `VALID` y contener un `FAIL` real; una aserción puede ser `NOT_APPLICABLE` por
 * contrato y a la vez el escenario estar `EXECUTED`; y `SIGNAL` convive con `PASS` sin anularlo.
 *
 * Aquí los ejes son **tipos distintos**, de modo que mezclarlos no compila. Es la forma más
 * barata de que la prohibición no dependa de que alguien se acuerde.
 * ---------------------------------------------------------------------------
 */

/** Eje 1 · validez del run. Un `FAIL` real **no** invalida un run (§03.2). */
export const RUN_VALIDITY = ['VALID', 'INVALID_RUN'] as const;
export type RunValidity = (typeof RUN_VALIDITY)[number];

/** Eje 2 · ejecución y cobertura. `NOT_EXECUTED` es cobertura, **nunca** un PASS. */
export const COVERAGE = ['EXECUTED', 'NOT_EXECUTED', 'BLOCKED', 'NOT_APPLICABLE'] as const;
export type Coverage = (typeof COVERAGE)[number];

/** Eje 3 · contrato por invariante. */
export const CONTRACT_VERDICT = ['PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_APPLICABLE'] as const;
export type ContractVerdict = (typeof CONTRACT_VERDICT)[number];

/** Eje 4 · producto. Dos niveles: toda señal se guarda; solo las pre-registradas se promueven. */
export const PRODUCT_FINDING = ['SIGNAL', 'OBSERVATION'] as const;
export type ProductFinding = (typeof PRODUCT_FINDING)[number];

/** Eje 5 · revisión humana. */
export const HUMAN_REVIEW = [
  'ACCEPTABLE',
  'PRODUCT_WEAKNESS',
  'MORE_EVIDENCE_REQUIRED',
  'GOVERNANCE_REVIEW_REQUIRED',
  'PENDING',
] as const;
export type HumanReview = (typeof HUMAN_REVIEW)[number];

/**
 * Un registro de evaluación. Los ejes viajan juntos pero **no se combinan**: cada uno conserva
 * su propio vocabulario.
 */
export interface EvaluationRecord {
  readonly runValidity: RunValidity;
  readonly coverage: Coverage;
  readonly contract: ContractVerdict;
  /** Cero o varios hallazgos de producto. Nunca sustituyen al veredicto contractual. */
  readonly productFindings: readonly ProductFinding[];
  readonly humanReview: HumanReview;
  /** Identificador de la regla contractual evaluada, o `null` si no hay contrato aplicable. */
  readonly ruleId: string | null;
  /** Versión de la regla: un veredicto sin versión no es reproducible. */
  readonly ruleVersion: string | null;
  /**
   * Evidencia de que la barrera de observación quedó establecida. Sin ella, `PASS` es imposible
   * para una aserción negativa (ver `assertEvaluationRecord`).
   */
  readonly completenessEstablished: boolean;
  /** Verdadero cuando la aserción afirma la **ausencia** de algo. */
  readonly negativeAssertion: boolean;
}

export class InvalidEvaluationRecord extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEvaluationRecord';
  }
}

function inSet<T extends string>(values: readonly T[], candidate: unknown): candidate is T {
  return typeof candidate === 'string' && (values as readonly string[]).includes(candidate);
}

/**
 * Valida un registro antes de que llegue al ledger.
 *
 * Las dos reglas duras del Design Freeze que no pueden quedar a criterio de quien escribe:
 *
 *   1. **Una observación ausente nunca produce `PASS`.** Si la aserción es negativa y la barrera
 *      de completitud no se estableció, el único resultado admisible es `INCONCLUSIVE`.
 *   2. **`PASS` y `FAIL` exigen contrato.** Sin `ruleId` no hay obligación que evaluar, y lo que
 *      corresponde es `NOT_APPLICABLE`, no un aprobado por defecto.
 */
export function assertEvaluationRecord(record: EvaluationRecord): void {
  if (!inSet(RUN_VALIDITY, record.runValidity)) {
    throw new InvalidEvaluationRecord(`validez de run fuera del eje 1: ${record.runValidity}`);
  }
  if (!inSet(COVERAGE, record.coverage)) {
    throw new InvalidEvaluationRecord(`cobertura fuera del eje 2: ${record.coverage}`);
  }
  if (!inSet(CONTRACT_VERDICT, record.contract)) {
    throw new InvalidEvaluationRecord(`veredicto fuera del eje 3: ${record.contract}`);
  }
  for (const finding of record.productFindings) {
    if (!inSet(PRODUCT_FINDING, finding)) {
      throw new InvalidEvaluationRecord(`hallazgo fuera del eje 4: ${finding}`);
    }
  }
  if (!inSet(HUMAN_REVIEW, record.humanReview)) {
    throw new InvalidEvaluationRecord(`revisión fuera del eje 5: ${record.humanReview}`);
  }

  if (record.negativeAssertion && record.contract === 'PASS' && !record.completenessEstablished) {
    throw new InvalidEvaluationRecord(
      'una aserción negativa sin barrera de completitud no puede ser PASS: corresponde INCONCLUSIVE',
    );
  }

  if ((record.contract === 'PASS' || record.contract === 'FAIL') && record.ruleId === null) {
    throw new InvalidEvaluationRecord(
      `${record.contract} exige una regla contractual: sin contrato corresponde NOT_APPLICABLE`,
    );
  }

  if (record.ruleId !== null && record.ruleVersion === null) {
    throw new InvalidEvaluationRecord(
      `la regla ${record.ruleId} no lleva versión: un veredicto sin versión no es reproducible`,
    );
  }
}

/**
 * Denominador de cobertura contractual.
 *
 * `NOT_APPLICABLE` queda **fuera**: no hay obligación que medir. `INCONCLUSIVE` queda **dentro**,
 * porque excluirlo inflaría la cobertura justo donde falta evidencia.
 */
export function countsTowardContractDenominator(verdict: ContractVerdict): boolean {
  return verdict !== 'NOT_APPLICABLE';
}
