import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { ENGINE_VERSION } from '@study-os/learning-engine';
import {
  PLANNER_VERSION,
  canonicalDecision,
  canonicalInput,
  inputHash,
  plan,
  type BudgetSource,
  type ConceptStatus,
  type DurationProvenance,
  type EngineTuple,
  type MasteryState,
  type PlanDecision,
  type PlanOutcome,
  type PlannerConcept,
  type PlannerInput,
  type Uncertainty,
} from '@study-os/planner-engine';

import { ENGINE_RPC, runEngineForUser } from '../engine/run';
import { tryCreatePlannerClient } from './admin';

/**
 * Ejecución del Planner para una persona · `docs/PLANNER_CONTRACT.md` v1.4 · ADR-012.
 *
 * Reparto de responsabilidades, el mismo que en el Learning Engine:
 *
 *   - **leer**: dos funciones de servidor, una para `public` (contexto) y otra para el motor
 *     (estado categórico y posición proyectada, nunca el vector). La pertenencia la resuelve el
 *     servidor, no un filtro de aplicación;
 *   - **decidir**: `@study-os/planner-engine`, puro y determinista;
 *   - **persistir**: una función `SECURITY DEFINER` que revalida la entrada en la misma
 *     transacción que la escribe (§U.1). Si ha cambiado, no escribe y aquí se recalcula.
 *
 * La identidad que recibe este módulo tiene que venir ya verificada en servidor (INV-116).
 *
 * **Duración · P4-D2 diferida.** La duración de cada candidato es **entrada** (§I.3) y su origen
 * no está decidido. Por eso no hay ninguna fuente de producción: sin una fuente inyectada, el
 * Planner responde `DURATION_SOURCE_UNDECIDED` y **no escribe nada**. Las pruebas inyectan una
 * fuente de fixture; ninguna duración de fixture es una constante de runtime.
 */

export const PLANNER_RPC = {
  context: 'planner_context',
  engineSnapshot: 'engine_planner_snapshot',
  createRun: 'create_planner_run',
  startSession: 'start_planned_session',
} as const;

/** Destinos cuya duración se pide. */
export interface DurationTargets {
  readonly learningUnitIds: readonly string[];
  readonly questionIds: readonly string[];
}

/**
 * Fuente de duración. Es **entrada del contrato** (§I.3): quien la inyecta responde de su
 * procedencia, y en Phase 4A la única admitida es `FIXTURE`.
 */
export interface DurationSource {
  readonly provenance: DurationProvenance;
  minutesFor(targets: DurationTargets): {
    readonly units: ReadonlyMap<string, number>;
    readonly questions: ReadonlyMap<string, number>;
  };
}

export type PlannerRequestOutcome =
  | {
      readonly kind: 'RUN';
      readonly runId: string;
      readonly reused: boolean;
      readonly outcome: PlanOutcome;
      readonly decision: PlanDecision;
      readonly inputHash: string;
    }
  /** §N · la sesión abierta gana: no se crea ninguna ejecución. */
  | { readonly kind: 'RESUME_REQUIRED' }
  /** §I.1 · sin zona horaria declarada no existe «hoy». No se deduce ni se rellena. */
  | { readonly kind: 'TIMEZONE_REQUIRED' }
  | { readonly kind: 'NO_ACTIVE_GOAL' }
  /** §I.2 · sin declaraciones de disponibilidad no hay presupuesto, y no se inventa. */
  | { readonly kind: 'SETTINGS_REQUIRED' }
  /** P4-D2 · sin fuente de duración decidida no se planifica. */
  | { readonly kind: 'DURATION_SOURCE_UNDECIDED' }
  /** §M · el motor está atrasado y la puesta al día bloqueante no lo dejó al día. */
  | { readonly kind: 'PLAN_UNAVAILABLE_ENGINE'; readonly reason: string }
  /** Revalidación perdida varias veces seguidas: no se escribe nada. */
  | { readonly kind: 'CONTENTION' }
  | { readonly kind: 'SKIPPED'; readonly reason: string };

interface ContextConcept {
  readonly conceptId: string;
  readonly conceptKey: string;
  readonly conceptStatus: ConceptStatus;
  readonly blockSortOrder: number;
  readonly topicSortOrder: number;
  readonly conceptSortOrder: number;
}

interface PlannerContext {
  readonly profile: boolean;
  readonly timezone: string | null;
  readonly planDay: string | null;
  readonly goalId: string | null;
  readonly packVersionId: string | null;
  readonly attributionGeneration: number;
  readonly budget: { readonly minutes: number; readonly source: BudgetSource } | null;
  readonly openSession: boolean;
  readonly plannerConfigVersion: string | null;
  readonly concepts: readonly ContextConcept[];
  readonly units: ReadonlyArray<{
    readonly learningUnitId: string;
    readonly conceptId: string;
    readonly learningUnitVersionId: string;
    readonly sourceExcluded: boolean;
  }>;
  readonly questions: ReadonlyArray<{
    readonly questionId: string;
    readonly conceptId: string;
    readonly representationId: string;
    readonly sourceExcluded: boolean;
    readonly answeredToday: boolean;
  }>;
  readonly completedToday: readonly string[];
}

interface EngineSnapshot {
  readonly maxPosition: number;
  readonly watermark: {
    readonly consumedPosition: number;
    readonly engineVersion: string | null;
    readonly engineConfigVersion: string | null;
    readonly attributionPackVersionId: string | null;
    readonly attributionGeneration: number | null;
    readonly projectionCoherent: boolean;
  } | null;
  readonly concepts: ReadonlyArray<{
    readonly conceptId: string;
    readonly masteryState: MasteryState;
    readonly uncertainty: Uncertainty;
    readonly lastNegativePosition: number | null;
    readonly activeErrorPattern: boolean;
  }>;
}

async function readContext(client: SupabaseClient, userId: string): Promise<PlannerContext> {
  const call = await client.rpc(PLANNER_RPC.context, { p_user: userId });
  if (call.error) throw new Error(`contexto del Planner: ${call.error.message}`);
  return call.data as PlannerContext;
}

async function readEngine(client: SupabaseClient, userId: string): Promise<EngineSnapshot> {
  const call = await client.rpc(PLANNER_RPC.engineSnapshot, { p_user_id: userId });
  if (call.error) throw new Error(`estado del motor: ${call.error.message}`);
  return call.data as EngineSnapshot;
}

async function readActiveEngineConfig(client: SupabaseClient): Promise<string | null> {
  const call = await client.rpc(ENGINE_RPC.activeConfigVersion);
  if (call.error) throw new Error(`engine_config: ${call.error.message}`);
  return typeof call.data === 'string' && call.data !== '' ? call.data : null;
}

/**
 * La tupla de frescura, si la proyección está al día; `null` si no lo está (§M). Sin evidencia
 * todavía no hay nada que plegar: la tupla es la de «nada consumido» bajo la configuración y la
 * atribución vigentes, y la persistencia lo vuelve a comprobar.
 */
function currentTuple(
  engine: EngineSnapshot,
  context: PlannerContext,
  activeConfig: string,
): EngineTuple | null {
  const packVersionId = context.packVersionId;
  if (!packVersionId) return null;
  const maxPosition = Number(engine.maxPosition);
  const w = engine.watermark;
  if (!w) {
    return maxPosition === 0
      ? {
          engineVersion: ENGINE_VERSION,
          engineConfigVersion: activeConfig,
          attributionPackVersionId: packVersionId,
          attributionGeneration: Number(context.attributionGeneration),
          consumedPosition: 0,
        }
      : null;
  }
  const fresh =
    Number(w.consumedPosition) === maxPosition &&
    w.engineVersion === ENGINE_VERSION &&
    w.engineConfigVersion === activeConfig &&
    w.attributionPackVersionId === packVersionId &&
    Number(w.attributionGeneration) === Number(context.attributionGeneration) &&
    w.projectionCoherent === true;
  return fresh
    ? {
        engineVersion: ENGINE_VERSION,
        engineConfigVersion: activeConfig,
        attributionPackVersionId: packVersionId,
        attributionGeneration: Number(w.attributionGeneration),
        consumedPosition: maxPosition,
      }
    : null;
}

/** La entrada canónica: todo lo que decide, y nada más. */
function buildInput(
  userId: string,
  context: PlannerContext,
  engine: EngineSnapshot,
  tuple: EngineTuple,
  durations: DurationSource,
): PlannerInput {
  const minutes = durations.minutesFor({
    learningUnitIds: context.units.map((u) => u.learningUnitId),
    questionIds: context.questions.map((q) => q.questionId),
  });
  const need = (map: ReadonlyMap<string, number>, id: string): number => {
    const value = map.get(id);
    if (value === undefined) throw new Error(`la fuente de duración no cubre ${id}`);
    return value;
  };
  const state = new Map(engine.concepts.map((c) => [c.conceptId, c]));
  const done = new Set(context.completedToday);

  const concepts: PlannerConcept[] = context.concepts.map((c) => {
    const projected = state.get(c.conceptId);
    return {
      conceptId: c.conceptId,
      conceptStatus: c.conceptStatus,
      syllabus: {
        blockSortOrder: Number(c.blockSortOrder),
        topicSortOrder: Number(c.topicSortOrder),
        conceptSortOrder: Number(c.conceptSortOrder),
        conceptKey: c.conceptKey,
      },
      // §W.2 · la ausencia de fila significa NEW.
      masteryState: projected?.masteryState ?? 'NEW',
      uncertainty: projected?.uncertainty ?? 'NO_EVIDENCE',
      activeErrorPattern: projected?.activeErrorPattern ?? false,
      lastNegativePosition:
        projected?.lastNegativePosition === null || projected?.lastNegativePosition === undefined
          ? null
          : Number(projected.lastNegativePosition),
      completedToday: done.has(c.conceptId),
      units: context.units
        .filter((u) => u.conceptId === c.conceptId)
        .map((u) => ({
          learningUnitId: u.learningUnitId,
          learningUnitVersionId: u.learningUnitVersionId,
          sourceExcluded: u.sourceExcluded,
          minutes: need(minutes.units, u.learningUnitId),
        })),
      questions: context.questions
        .filter((q) => q.conceptId === c.conceptId)
        .map((q) => ({
          questionId: q.questionId,
          representationId: q.representationId,
          sourceExcluded: q.sourceExcluded,
          answeredToday: q.answeredToday,
          minutes: need(minutes.questions, q.questionId),
        })),
    };
  });

  return {
    plannerVersion: PLANNER_VERSION,
    plannerConfigVersion: context.plannerConfigVersion!,
    userId,
    goalId: context.goalId!,
    packVersionId: context.packVersionId!,
    planDay: context.planDay!,
    timezone: context.timezone!,
    budget: { minutes: Number(context.budget!.minutes), source: context.budget!.source },
    engine: tuple,
    durationProvenance: durations.provenance,
    concepts,
  };
}

function payloadOf(
  input: PlannerInput,
  decision: PlanDecision,
  hash: string,
): Record<string, unknown> {
  let position = 0;
  const items = decision.actions.flatMap((action) =>
    action.steps.map((step) => {
      position += 1;
      return {
        position,
        actionOrdinal: action.ordinal,
        actionKind: action.kind,
        step: step.step,
        compositionReason: action.reason,
        conceptId: action.conceptId,
        itemType: step.itemType,
        learningUnitId: step.itemType === 'LEARNING_UNIT' ? step.learningUnitId : null,
        learningUnitVersionId:
          step.itemType === 'LEARNING_UNIT' ? step.learningUnitVersionId : null,
        questionId: step.itemType === 'QUESTION' ? step.questionId : null,
        questionRepresentationId: step.itemType === 'QUESTION' ? step.representationId : null,
        plannedMinutes: step.minutes,
      };
    }),
  );
  return {
    goalId: input.goalId,
    packVersionId: input.packVersionId,
    planDay: input.planDay,
    timezone: input.timezone,
    budget: input.budget,
    plannerVersion: input.plannerVersion,
    plannerConfigVersion: input.plannerConfigVersion,
    engine: input.engine,
    durationProvenance: input.durationProvenance,
    inputHash: hash,
    inputCanonical: canonicalInput(input),
    decisionCanonical: canonicalDecision(decision),
    outcome: decision.outcome,
    plannedMinutes: decision.plannedMinutes,
    items,
  };
}

const MAX_ATTEMPTS = 3;

/**
 * Pide un plan para una persona con identidad ya verificada en servidor.
 *
 * Nunca degrada en silencio (§M): ni a `fps-fixed-v1`, ni a un plan sin personalizar, ni a un
 * plan sobre datos atrasados. Cada salida que no es una ejecución dice exactamente por qué.
 */
export async function requestPlanForUser(
  userId: string,
  options: {
    readonly client?: SupabaseClient;
    readonly durations?: DurationSource;
    /** Solo pruebas: se invoca entre el cálculo y la persistencia para provocar carreras. */
    readonly beforePersist?: () => Promise<void>;
  } = {},
): Promise<PlannerRequestOutcome> {
  const client = options.client ?? tryCreatePlannerClient();
  if (!client) return { kind: 'SKIPPED', reason: 'SIN_CONFIGURACION_DE_SERVIDOR' };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const context = await readContext(client, userId);
    if (!context.profile) return { kind: 'SKIPPED', reason: 'SIN_PERFIL' };
    if (context.openSession) return { kind: 'RESUME_REQUIRED' };
    if (!context.timezone || !context.planDay) return { kind: 'TIMEZONE_REQUIRED' };
    if (!context.goalId || !context.packVersionId) return { kind: 'NO_ACTIVE_GOAL' };
    if (!context.budget) return { kind: 'SETTINGS_REQUIRED' };
    if (!context.plannerConfigVersion)
      return { kind: 'SKIPPED', reason: 'SIN_CONFIGURACION_ACTIVA' };
    if (!options.durations) return { kind: 'DURATION_SOURCE_UNDECIDED' };

    const activeConfig = await readActiveEngineConfig(client);
    if (!activeConfig)
      return { kind: 'PLAN_UNAVAILABLE_ENGINE', reason: 'SIN_CONFIGURACION_DEL_MOTOR' };

    // §M · frescura y puesta al día **bloqueante** por la frontera gobernada del motor.
    let engine = await readEngine(client, userId);
    let tuple = currentTuple(engine, context, activeConfig);
    if (!tuple) {
      try {
        const stale = engine.watermark;
        const forceRebuild =
          stale !== null && (stale.engineVersion !== ENGINE_VERSION || !stale.projectionCoherent);
        const caught = await runEngineForUser(userId, { client, forceRebuild });
        if (caught.kind === 'SKIPPED') {
          return { kind: 'PLAN_UNAVAILABLE_ENGINE', reason: caught.reason };
        }
      } catch (error) {
        return {
          kind: 'PLAN_UNAVAILABLE_ENGINE',
          reason: error instanceof Error ? error.message : 'FALLO_DEL_MOTOR',
        };
      }
      engine = await readEngine(client, userId);
      tuple = currentTuple(engine, context, activeConfig);
      if (!tuple) return { kind: 'PLAN_UNAVAILABLE_ENGINE', reason: 'SIGUE_ATRASADO' };
    }

    const input = buildInput(userId, context, engine, tuple, options.durations);
    const decision = plan(input);
    const hash = await inputHash(input);

    if (options.beforePersist) await options.beforePersist();

    const persisted = await client.rpc(PLANNER_RPC.createRun, {
      p_user: userId,
      p_payload: payloadOf(input, decision, hash),
    });
    if (persisted.error) {
      const message = persisted.error.message;
      if (message.includes('STUDY_OS_PLANNER · OPEN_SESSION')) return { kind: 'RESUME_REQUIRED' };
      // §U.1 · la entrada cambió entre el cálculo y la escritura: se recalcula.
      if (message.includes('STUDY_OS_PLANNER · STALE_INPUT')) continue;
      throw new Error(`persistencia del plan: ${message}`);
    }
    const result = persisted.data as { runId: string; reused: boolean };
    return {
      kind: 'RUN',
      runId: result.runId,
      reused: result.reused,
      outcome: decision.outcome,
      decision,
      inputHash: hash,
    };
  }
  return { kind: 'CONTENTION' };
}
