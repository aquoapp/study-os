/**
 * Contratos internos de los componentes de LAB CORE.
 *
 * ---------------------------------------------------------------------------
 * Qué hace este fichero y qué no
 *
 * Materializa las **interfaces** de la arquitectura congelada (LAB-ARCH-DF-001) para que los
 * checkpoints posteriores tengan dónde encajar. No implementa comportamiento: CP1 no ejecuta
 * campañas, no crea aprendices, no escribe evidencia y no implementa Route A.
 *
 * Las prohibiciones viajan en los tipos siempre que se puede. `SyntheticLearnerActor` recibe
 * `ActorCredentials` y **no** tiene forma de nombrar una clave de servicio ni una cadena de
 * conexión: no es que no deba, es que su firma no lo admite.
 * ---------------------------------------------------------------------------
 */

import type { ActorCredentials, HarnessCredentials, ObserverCredentials } from './credentials';
import type { CampaignRecord, ObservationRecord, StepRecord } from './ledger';
import type { ContractVerdict, EvaluationRecord } from './verdict';

/** Superficies por las que el Actor puede actuar. Todas son de aprendiz legítimo. */
export const ACTOR_SURFACES = ['BROWSER', 'HTTP_CLIENT'] as const;
export type ActorSurface = (typeof ACTOR_SURFACES)[number];

export interface ActorIntent {
  readonly kind: string;
  readonly surface: ActorSurface;
}

export interface ActorOutcome {
  readonly intent: ActorIntent;
  readonly screenState: string;
  readonly attemptedAt: string;
}

/**
 * Synthetic Learner Actor · **solo contrato en CP1**.
 *
 * Recibe exclusivamente credenciales de aprendiz. No conoce el escenario completo, ni los
 * umbrales, ni el golden trace, ni el veredicto: si los conociera, la comparación posterior no
 * mediría el producto, mediría nuestra capacidad de ajustarlo.
 */
export interface SyntheticLearnerActor {
  readonly credentials: ActorCredentials;
  act(intent: ActorIntent): Promise<ActorOutcome>;
}

/** Scenario Runner · ordena pasos y decide la parada. No actúa como aprendiz. */
export interface ScenarioRunner {
  run(scenarioId: string): Promise<readonly StepRecord[]>;
}

/** Experimental Harness · prepara, aísla y destruye. Única vía privilegiada declarada. */
export interface ExperimentalHarness {
  readonly credentials: HarnessCredentials;
  prepare(): Promise<void>;
  teardown(): Promise<void>;
}

/** Contract Oracle · observa y concluye. Nunca escribe en el producto. */
export interface ContractOracle {
  evaluate(step: StepRecord): Promise<readonly EvaluationRecord[]>;
}

/**
 * Observation Adapter · lee la barrera de completitud.
 *
 * Solo lectura por contrato: no hay método que escriba. La barrera es **estado interno**, no una
 * superficie de producto, y por tanto no prueba que un usuario pueda ver nada.
 */
export interface ObservationAdapter {
  readonly credentials: ObserverCredentials;
  readBarrier(subjectRef: string): Promise<ObservationRecord>;
}

/** Isolation/Safety Guard · veto previo a cada escritura. */
export interface IsolationGuard {
  assertWriteAllowed(destination: string): void;
}

/** Browser Adapter · conduce el navegador real. No inyecta estado. */
export interface BrowserAdapter {
  open(path: string): Promise<void>;
  click(testId: string): Promise<void>;
  fill(testId: string, value: string): Promise<void>;
  readScreen(): Promise<string>;
}

/** Fixture/Corpus Manager · siembra y purga corpus GENERATED. */
export interface CorpusManager {
  seed(corpusVersion: string): Promise<void>;
  purge(): Promise<void>;
}

/** Report Generator · redacta; no recalcula veredictos. */
export interface ReportGenerator {
  render(campaign: CampaignRecord): Promise<string>;
}

/** Experimental Ledger · acumula y valida; no es autoridad de STUDY OS. */
export interface ExperimentalLedger {
  appendStep(scenarioId: string, step: StepRecord): void;
  snapshot(): CampaignRecord;
}

/**
 * Lo que un veredicto necesita para ser `PASS` en una aserción negativa. Se expone como tipo
 * para que ningún checkpoint posterior lo reinvente con criterios propios.
 */
export interface NegativeAssertionGate {
  readonly completenessEstablished: boolean;
  readonly pending: boolean;
  readonly consumedPosition: number;
  readonly lastAcceptedPosition: number;
}

/** Resuelve el veredicto de una aserción negativa. Sin barrera, `INCONCLUSIVE`. */
export function resolveNegativeAssertion(gate: NegativeAssertionGate): ContractVerdict {
  if (!gate.completenessEstablished) return 'INCONCLUSIVE';
  if (gate.pending) return 'INCONCLUSIVE';
  if (gate.consumedPosition < gate.lastAcceptedPosition) return 'INCONCLUSIVE';
  return 'PASS';
}
