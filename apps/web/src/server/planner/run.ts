import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { ENGINE_VERSION } from '@study-os/learning-engine';
import {
  PLANNER_VERSION,
  canonicalDecision,
  canonicalInput,
  eligibleActionMinutes,
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
 * **Duración · P4-D2 resuelta el 2026-09-20 (ADR-013).** La duración de cada candidato sigue
 * siendo **entrada** del contrato (§I.3), y ahora su origen está autorizado y partido por tipo de
 * paso: la unidad trae metadato de autoría fijado a su versión exacta, y la pregunta una
 * estimación gobernada en `planner_config`. `hybridDurationSource` es esa fuente y se construye
 * desde el contexto, no desde ninguna constante de este módulo. Las pruebas pueden seguir
 * inyectando una fuente de fixture, distinguible por su procedencia.
 */

export const PLANNER_RPC = {
  context: 'planner_context',
  engineSnapshot: 'engine_planner_snapshot',
  createRun: 'create_planner_run',
  startSession: 'start_planned_session',
} as const;

/**
 * Destinos cuya duración se pide.
 *
 * **Reclavado por versión (P4-D2 §2.4).** Antes se indexaba por identidad de unidad; la decisión
 * exige fijación a la **versión exacta**, porque una duración pertenece a un contenido concreto y
 * no a la unidad que lo contiene. `planner_context` ya devuelve esa identidad.
 */
export interface DurationTargets {
  readonly learningUnitVersionIds: readonly string[];
  readonly questionIds: readonly string[];
}

/**
 * Fuente de duración. Es **entrada del contrato** (§I.3): quien la inyecta responde de su
 * procedencia.
 *
 * `null` en una unidad significa **metadato ausente**, no cero: el motor puro lo traduce a la
 * exclusión `NO_DURATION_METADATA` y nunca lo rellena (ADR-013 §2.5).
 */
export interface DurationSource {
  readonly provenance: DurationProvenance;
  minutesFor(targets: DurationTargets): {
    readonly units: ReadonlyMap<string, number | null>;
    readonly questions: ReadonlyMap<string, number>;
  };
}

/**
 * La fuente de producción que P4-D2 autoriza · **`HYBRID_V1`** · ADR-013.
 *
 * Partida por tipo de paso, exactamente como la decisión la parte:
 *
 *   - **unidad**: metadato de autoría versionado, leído de la versión exacta que el Planner va a
 *     seleccionar. Estimación operativa de planificación, no un hecho de ciencia del aprendizaje
 *     ni una predicción sobre esta persona;
 *   - **pregunta**: estimación gobernada, determinista e **independiente de la persona**, idéntica
 *     para toda pregunta en v1, leída de la `planner_config` `ACTIVE`. No usa historial,
 *     `response_ms`, confianza, dificultad inferida ni rendimiento de la pregunta.
 *
 * No hay ninguna constante de duración en este módulo: los dos valores vienen de datos con
 * procedencia. Si la configuración activa no declara la estimación de paso, no se planifica y se
 * dice por qué; no se elige un número.
 */
export function hybridDurationSource(context: {
  readonly checkStepMinutes: number;
  readonly units: ReadonlyArray<{
    readonly learningUnitVersionId: string;
    readonly estimatedMinutes: number | null;
  }>;
}): DurationSource {
  const units = new Map<string, number | null>(
    context.units.map((unit) => [
      unit.learningUnitVersionId,
      unit.estimatedMinutes === null || unit.estimatedMinutes === undefined
        ? null
        : Number(unit.estimatedMinutes),
    ]),
  );
  return {
    provenance: 'HYBRID_V1',
    minutesFor: (targets) => ({
      units: new Map(
        targets.learningUnitVersionIds.map((id) => [id, units.has(id) ? units.get(id)! : null]),
      ),
      questions: new Map(targets.questionIds.map((id) => [id, context.checkStepMinutes])),
    }),
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
      /** §I.2 · el presupuesto con el que se decidió, tal y como la persona lo declaró. */
      readonly budgetMinutes: number;
      /**
       * P4B-D1 · minutos de cada acción elegible que **no cupo**.
       *
       * Derivado de la misma entrada, nunca persistido: ampliar `PlanDecision` cambiaría el texto
       * canónico de toda ejecución pasada al reproducirla (P4-G4). Vacío cuando todo cupo.
       */
      readonly shortestOverBudgetMinutes: readonly number[];
    }
  /** §N · la sesión abierta gana: no se crea ninguna ejecución. */
  | { readonly kind: 'RESUME_REQUIRED' }
  /** §I.1 · sin zona horaria declarada no existe «hoy». No se deduce ni se rellena. */
  | { readonly kind: 'TIMEZONE_REQUIRED' }
  | { readonly kind: 'NO_ACTIVE_GOAL' }
  /** §I.2 · sin declaraciones de disponibilidad no hay presupuesto, y no se inventa. */
  | { readonly kind: 'SETTINGS_REQUIRED' }
  /**
   * ADR-013 · la configuración activa no declara la estimación de paso.
   *
   * No se elige un número: sin la autoridad que la gobierna, esa duración no existe. Sustituye a
   * `DURATION_SOURCE_UNDECIDED`, que nombraba una decisión pendiente y ya no lo está.
   */
  | { readonly kind: 'DURATION_POLICY_MISSING' }
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
  /** ADR-013 §2.2 · estimación gobernada del paso COMPROBAR, de la configuración `ACTIVE`. */
  readonly checkStepMinutes: number | null;
  readonly concepts: readonly ContextConcept[];
  readonly units: ReadonlyArray<{
    readonly learningUnitId: string;
    readonly conceptId: string;
    readonly learningUnitVersionId: string;
    readonly sourceExcluded: boolean;
    /** ADR-013 §2.1 · fijada a la versión exacta. `null` es dato, no cero. */
    readonly estimatedMinutes: number | null;
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
    learningUnitVersionIds: context.units.map((u) => u.learningUnitVersionId),
    questionIds: context.questions.map((q) => q.questionId),
  });
  const need = (map: ReadonlyMap<string, number>, id: string): number => {
    const value = map.get(id);
    if (value === undefined) throw new Error(`la fuente de duración no cubre ${id}`);
    return value;
  };
  // La ausencia es una respuesta válida de la fuente; lo que no es válido es que no responda.
  const unitMinutes = (id: string): number | null => {
    const map = minutes.units;
    if (!map.has(id)) throw new Error(`la fuente de duración no cubre ${id}`);
    return map.get(id) ?? null;
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
          minutes: unitMinutes(u.learningUnitVersionId),
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

/**
 * Minutos de las acciones elegibles que no cupieron (§E · `OVER_BUDGET`, §J).
 *
 * P4B-D1 autoriza a la interfaz a comunicar con verdad la estimación de la acción elegible más
 * corta. Esa verdad se deriva de la misma decisión que acaba de producirse, con las mismas
 * reglas; **no se consulta ninguna fuente de duración aparte** y no se persiste nada nuevo.
 */
function overBudgetMinutesOf(input: PlannerInput, decision: PlanDecision): readonly number[] {
  const eligible = eligibleActionMinutes(input);
  return decision.candidates
    .filter((candidate) => candidate.exclusion === 'OVER_BUDGET')
    .map((candidate) => eligible.get(candidate.conceptId))
    .filter((minutes): minutes is number => typeof minutes === 'number');
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

    // P4-D2 · la duración ya tiene fuente de producción. Las pruebas pueden inyectar una de
    // fixture; en ausencia de inyección, la de producción es la híbrida de ADR-013, construida
    // **desde el contexto** y no desde ninguna constante de este módulo.
    let durations = options.durations;
    if (!durations) {
      if (context.checkStepMinutes === null || context.checkStepMinutes === undefined) {
        return { kind: 'DURATION_POLICY_MISSING' };
      }
      durations = hybridDurationSource({
        checkStepMinutes: Number(context.checkStepMinutes),
        units: context.units,
      });
    }

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

    const input = buildInput(userId, context, engine, tuple, durations);
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
      budgetMinutes: input.budget.minutes,
      shortestOverBudgetMinutes: overBudgetMinutesOf(input, decision),
    };
  }
  return { kind: 'CONTENTION' };
}
