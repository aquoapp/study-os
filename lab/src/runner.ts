/**
 * Scenario Runner · CP4 · §5–6.
 *
 * ---------------------------------------------------------------------------------------
 * Ordena pasos; no actúa como aprendiz y no ajusta nada
 *
 * El runner recorre `SC-LAB-CORE-01` tal y como está pre-registrado, delegando **cada decisión**
 * en `profile.decide()`. No elige respuestas, no elige confianza y no elige cuándo interrumpir:
 * si lo hiciera, el perfil dejaría de ser una política declarada de antemano y pasaría a ser un
 * ajuste al resultado que se pretende comprobar.
 *
 * Todo pasa por superficies reales: rutas, campos y botones. Ninguna RPC, ninguna cookie
 * escrita a mano, ningún estado inyectado. Si una pantalla no se alcanza pulsando, para el
 * laboratorio no se alcanza.
 *
 * El perfil interrumpe en `/aprender`, no en `/comprobar`. Es su política congelada, y el
 * runner la respeta aunque eso deje a P-07 sin precondición: fabricarle una sería decidir el
 * veredicto antes de ejecutar.
 * ---------------------------------------------------------------------------------------
 */

import { appendVisit, emptyActorLog, type ActorLog, type ScreenVisit } from './actor-log';
import { AVAILABILITY_INPUT, confidencePolicy, decide, type ObservableScreen } from './profile';
import type { SyntheticIdentity } from './harness';

export class ScenarioAborted extends Error {
  /** Razón de aborto, de `ABORT_CONDITIONS` o de los límites del runner. */
  readonly reason: string;

  constructor(reason: string) {
    super(`escenario abortado · ${reason}`);
    this.name = 'ScenarioAborted';
    this.reason = reason;
  }
}

/**
 * Tope de acciones. No es una expectativa sobre el plan: es una red para que un bucle del
 * producto no se convierta en una ejecución infinita. Alcanzarlo **aborta** y es `INVALID_RUN`,
 * nunca un final satisfactorio.
 */
export const MAX_SCREEN_VISITS = 60;

/**
 * Selector del enunciado.
 *
 * El producto no expone el enunciado con un `data-testid`, y el laboratorio no se lo añade:
 * CP4 prueba el producto, no lo modifica. Se lee por su etiqueta de accesibilidad, que es
 * exactamente lo que tiene disponible cualquier cliente equivalente a un aprendiz.
 */
export const QUESTION_STEM = 'section[aria-label="Pregunta"] h2';

/** Lo mínimo que el runner necesita de la página. No se ata a Playwright en los tipos. */
export interface CampaignPage {
  goto(url: string): Promise<unknown>;
  url(): string;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  selectOption(selector: string, value: string): Promise<void>;
  textContent(selector: string): Promise<string | null>;
  isVisible(selector: string): Promise<boolean>;
  /** Claves de opción ofrecidas, en el orden presentado. */
  offeredOptionKeys(): Promise<readonly string[]>;
  /**
   * Espera a que la URL cambie respecto a la dada. Devuelve si cambió; **no lanza**.
   *
   * Las acciones de servidor de Next redirigen por navegación RSC, **sin carga de documento**:
   * esperar `domcontentloaded` vuelve de inmediato, porque el documento ya estaba cargado. El
   * runner correría entonces una carrera contra el producto y leería el DOM anterior. Es la
   * misma clase de error que D-26: creer probada una ruta que nadie recorrió de verdad.
   */
  waitForUrlChange(previous: string, timeoutMs: number): Promise<boolean>;
  /** Espera a que un selector sea visible. Devuelve si apareció; **no lanza**. */
  waitForVisible(selector: string, timeoutMs: number): Promise<boolean>;
}

export interface RunnerContext {
  readonly page: CampaignPage;
  readonly baseUrl: string;
  readonly identity: SyntheticIdentity;
  /**
   * Nombre visible del pack del laboratorio.
   *
   * Se elige por nombre y no por posición ni por identificador: el `value` de cada opción es el
   * uuid del pack, que un aprendiz no conoce, y depender del orden del select haría que el
   * escenario cambiara de objetivo al cambiar el catálogo.
   */
  readonly packLabel: string;
  /** Fecha objetivo que el onboarding exige. Entrada del escenario, no un resultado. */
  readonly targetDate: string;
  readonly now: () => string;
}

/**
 * Superficies de decisión de HOY que **no** ofrecen acción primaria.
 *
 * Son tres y no significan lo mismo: un presupuesto en el que nada cabe, un vacío veraz y un
 * fallo. Tratarlas todas como «el producto cerró el día» convertiría un fallo de planificación
 * en una ejecución satisfactoria, que es justo el autoengaño que este checkpoint prohíbe.
 */
export const TODAY_TERMINAL_SURFACES = {
  'hoy-nada-cabe': 'NOTHING_FITS',
  'hoy-nada-elegible': 'NOTHING_ELIGIBLE',
  'hoy-sin-plan': 'CANNOT_PLAN',
} as const;

export type TodayTerminalState =
  | (typeof TODAY_TERMINAL_SURFACES)[keyof typeof TODAY_TERMINAL_SURFACES]
  | 'UNKNOWN'
  | 'NOT_REACHED';

/**
 * Qué decisiones de HOY cuentan como día cerrado.
 *
 * `NOTHING_FITS` y `NOTHING_ELIGIBLE` son decisiones **veraces** del producto: con ese
 * presupuesto no cabe nada, o con lo que se sabe no se puede justificar nada. `CANNOT_PLAN` es
 * un fallo, y una superficie desconocida es una desviación: ninguno de los dos cierra el día.
 */
export const CLOSING_STATES: readonly TodayTerminalState[] = ['NOTHING_FITS', 'NOTHING_ELIGIBLE'];

async function readTodayTerminalState(page: CampaignPage): Promise<TodayTerminalState> {
  for (const [testId, state] of Object.entries(TODAY_TERMINAL_SURFACES)) {
    if (await page.isVisible(`[data-testid="${testId}"]`)) return state;
  }
  return 'UNKNOWN';
}

export interface RunnerResult {
  readonly log: ActorLog;
  readonly completed: boolean;
  /** Última ruta observada: deja constancia de dónde terminó la ejecución. */
  readonly finalPath: string;
  /** Qué decidió HOY al final. Se registra aunque no cierre el día. */
  readonly todayTerminalState: TodayTerminalState;
  readonly visits: number;
  /**
   * Desviaciones del escenario pre-registrado · §13.
   *
   * Un paso que no se pudo dar tal y como estaba descrito **no se silencia** y tampoco aborta
   * la campaña cuando el escenario puede seguir sin él. Se registra, y el informe lo dice: una
   * ejecución que se desvió y no lo cuenta vale menos que una que abortó.
   */
  readonly deviations: readonly string[];
}

/** Cuánto se espera a que el producto reaccione a una pulsación que navega. */
export const SETTLE_TIMEOUT_MS = 20_000;

/**
 * Espera a que el producto reaccione, sin lanzar.
 *
 * Si la URL no cambia no es necesariamente un fallo: hay pulsaciones que guardan y se quedan
 * en la misma pantalla. Quien necesite una condición más fuerte la pide explícitamente.
 */
async function advance(page: CampaignPage, from: string, timeoutMs: number): Promise<void> {
  await page.waitForUrlChange(from, timeoutMs);
}

/** Pulsa y espera. Captura la URL **antes** de pulsar: después ya sería la nueva. */
async function clickAndAdvance(
  page: CampaignPage,
  selector: string,
  timeoutMs: number = SETTLE_TIMEOUT_MS,
): Promise<void> {
  const before = page.url();
  await page.click(selector);
  await advance(page, before, timeoutMs);
}

function pathOf(page: CampaignPage): string {
  try {
    return new URL(page.url()).pathname;
  } catch {
    return page.url();
  }
}

async function readOrdinal(page: CampaignPage): Promise<number | null> {
  const text = await page.textContent('[data-testid="accion-posicion"]');
  if (text === null) return null;
  const matched = /Acci[oó]n\s+(\d+)\s+de\s+\d+/i.exec(text);
  return matched?.[1] === undefined ? null : Number(matched[1]);
}

async function observeScreen(page: CampaignPage): Promise<ObservableScreen> {
  const path = pathOf(page);
  const offeredOptionKeys = path.startsWith('/comprobar') ? await page.offeredOptionKeys() : [];
  return {
    path,
    actionOrdinal: await readOrdinal(page),
    offeredOptionKeys,
    canContinue:
      (await page.isVisible('[data-testid="aprender-continuar"]')) ||
      (await page.isVisible('[data-testid="comprobar"]')),
  };
}

// ---------------------------------------------------------------------------------------
// Pasos 1–3 · identidad, disponibilidad y objetivo. Todo por la interfaz real.
// ---------------------------------------------------------------------------------------

async function register(context: RunnerContext): Promise<void> {
  const { page } = context;
  await page.goto(`${context.baseUrl}/registro`);
  await page.fill('[data-testid="email-input"]', context.identity.email);
  await page.fill('[data-testid="password-input"]', context.identity.password);
  await clickAndAdvance(page, '[data-testid="submit-button"]');
  if (pathOf(page) !== '/hoy') {
    throw new ScenarioAborted(
      `el alta no llevó a HOY sino a «${pathOf(page)}»: una cuenta nueva debe tener camino`,
    );
  }
}

/** Declara zona horaria y disponibilidad en `/ajustes`, que es donde el producto las pide. */
async function declareAvailability(context: RunnerContext, deviations: string[]): Promise<void> {
  const { page } = context;
  await page.goto(`${context.baseUrl}/ajustes`);
  if (await page.isVisible('[data-testid="ajustes-zona-select"]')) {
    await page.selectOption('[data-testid="ajustes-zona-select"]', AVAILABILITY_INPUT.timezone);
    await clickAndAdvance(page, '[data-testid="ajustes-zona-guardar"]');
  } else {
    deviations.push('/ajustes no ofreció el selector de zona horaria a una cuenta nueva');
  }
  // `ajustes-habitual` es el **panel**, no el campo: rellenarlo lanzaría y dejaría toda la
  // ejecución inválida. El campo del tiempo habitual es `ajustes-defecto`; el panel sirve de
  // sonda de visibilidad, que es para lo que un aprendiz lo usa: ver si está ahí.
  if (await page.isVisible('[data-testid="ajustes-defecto"]')) {
    await page.fill(
      '[data-testid="ajustes-defecto"]',
      String(AVAILABILITY_INPUT.defaultDailyMinutes),
    );
    await clickAndAdvance(page, '[data-testid="ajustes-guardar"]');
  } else {
    deviations.push('/ajustes no ofreció el campo de tiempo habitual a una cuenta nueva');
  }
}

async function chooseGoal(context: RunnerContext): Promise<void> {
  const { page } = context;
  await page.goto(`${context.baseUrl}/onboarding`);
  if (await page.isVisible('[data-testid="onboarding-sin-packs"]')) {
    throw new ScenarioAborted('el onboarding no ofrece ningún pack: el corpus no está publicado');
  }
  if (!(await page.isVisible('[data-testid="onboarding-form"]'))) {
    // Objetivo ya declarado: el escenario no vuelve a declararlo.
    return;
  }
  await page.selectOption('[data-testid="pack-select"]', context.packLabel);
  // La zona horaria es obligatoria en el onboarding: sin ella no existe «hoy» (§I.1) y el
  // formulario no se envía. Es la misma que el perfil declara, no una elegida aquí.
  await page.selectOption('[data-testid="timezone-select"]', AVAILABILITY_INPUT.timezone);
  await page.fill(
    '[data-testid="daily-minutes-input"]',
    String(AVAILABILITY_INPUT.defaultDailyMinutes),
  );
  if (await page.isVisible('[data-testid="target-date-input"]')) {
    await page.fill('[data-testid="target-date-input"]', context.targetDate);
  }
  await clickAndAdvance(page, '[data-testid="onboarding-submit"]');
}

// ---------------------------------------------------------------------------------------
// Pasos 4–8 · el recorrido. Cada pantalla se registra antes de actuar sobre ella.
// ---------------------------------------------------------------------------------------

async function visitFor(
  context: RunnerContext,
  screen: ObservableScreen,
  outcome: {
    readonly chosenOptionKey: string | null;
    readonly confidenceEntered: number | null;
    readonly submitted: boolean;
    readonly answerKeyVisibleBeforeSubmit: boolean;
    readonly feedbackSeen: boolean;
  },
): Promise<ScreenVisit> {
  const { page } = context;
  return {
    ordinal: screen.actionOrdinal,
    path: screen.path,
    phase: await page.textContent('[data-testid="accion-fase"]'),
    questionStem: screen.path.startsWith('/comprobar')
      ? await page.textContent(QUESTION_STEM)
      : null,
    unitTitle: screen.path.startsWith('/aprender')
      ? await page.textContent('[data-testid="aprender-titulo"]')
      : null,
    optionKeysOffered: screen.offeredOptionKeys,
    chosenOptionKey: outcome.chosenOptionKey,
    confidenceEntered: outcome.confidenceEntered,
    submitted: outcome.submitted,
    answerKeyVisibleBeforeSubmit: outcome.answerKeyVisibleBeforeSubmit,
    feedbackSeen: outcome.feedbackSeen,
    visitedAt: context.now(),
  };
}

/**
 * Recorre una pantalla de comprobación.
 *
 * Antes de enviar comprueba que la corrección **no** está en el DOM: INV-101 y INV-103 se
 * observan aquí, desde la superficie del aprendiz, no deduciéndolos del esquema.
 */
async function walkCheck(
  context: RunnerContext,
  screen: ObservableScreen,
  log: ActorLog,
): Promise<ActorLog> {
  const { page } = context;
  const decision = decide(screen);

  if (decision.action === 'VIEW_FEEDBACK') {
    // Estado de FEEDBACK: se lee y se continúa. No se reintenta.
    const visit = await visitFor(context, screen, {
      chosenOptionKey: null,
      confidenceEntered: null,
      submitted: false,
      answerKeyVisibleBeforeSubmit: false,
      feedbackSeen: true,
    });
    const before = page.url();
    await page.click('[data-testid="feedback-siguiente"]').catch(async () => {
      await page.goto(`${context.baseUrl}/hoy`);
    });
    await advance(page, before, SETTLE_TIMEOUT_MS);
    return appendVisit(log, visit);
  }

  if (decision.action !== 'SELECT_OPTION') {
    throw new ScenarioAborted(
      `el perfil decidió «${decision.action}» en una pantalla de comprobación`,
    );
  }

  const leakedBeforeSubmit =
    (await page.isVisible('[data-testid="respuesta-correcta"]')) ||
    (await page.isVisible('[data-testid="explicacion"]'));

  // Elegir opción y confianza **no navega**: son botones de cliente con autoguardado. Esperar
  // un cambio de URL aquí gastaría el tiempo de espera entero por pregunta sin ganar nada. El
  // botón de comprobar está deshabilitado hasta que hay confianza, y la pulsación espera por sí
  // misma a que sea accionable: la condición la impone el producto, no el runner.
  await page.click(`[data-testid="opcion-${decision.optionKey}"]`);

  const confidence = confidencePolicy(screen);
  await page.click(`[data-testid="confianza-${confidence}"]`);

  // El envío sí cambia de estado: FEEDBACK es un estado de `/comprobar`, no una ruta, así que
  // la URL puede no cambiar. Se espera la superficie de corrección, que es la condición real.
  const beforeSubmit = page.url();
  await page.click('[data-testid="comprobar"]');
  const feedbackShown = await page.waitForVisible('[data-testid="feedback"]', SETTLE_TIMEOUT_MS);
  if (!feedbackShown) await advance(page, beforeSubmit, SETTLE_TIMEOUT_MS);

  const visit = await visitFor(context, screen, {
    chosenOptionKey: decision.optionKey ?? null,
    confidenceEntered: confidence,
    submitted: true,
    answerKeyVisibleBeforeSubmit: leakedBeforeSubmit,
    feedbackSeen: await page.isVisible('[data-testid="feedback"]'),
  });
  return appendVisit(log, visit);
}

async function walkLearn(
  context: RunnerContext,
  screen: ObservableScreen,
  log: ActorLog,
): Promise<ActorLog> {
  const { page } = context;
  const decision = decide(screen);
  const visit = await visitFor(context, screen, {
    chosenOptionKey: null,
    confidenceEntered: null,
    submitted: false,
    answerKeyVisibleBeforeSubmit: false,
    feedbackSeen: false,
  });

  await clickAndAdvance(
    page,
    decision.action === 'INTERRUPT'
      ? '[data-testid="dejarlo"]'
      : '[data-testid="aprender-continuar"]',
  );
  return appendVisit(log, visit);
}

/**
 * Ejecuta el escenario.
 *
 * Termina cuando el producto deja de ofrecer acción primaria en HOY, que es **su** forma de dar
 * el día por terminado. El runner no decide el final: lo observa.
 */
export async function runScenario(context: RunnerContext): Promise<RunnerResult> {
  const { page } = context;
  let log = emptyActorLog();
  let visits = 0;

  const deviations: string[] = [];
  await register(context);
  // El paso 2 es preparación y es **redundante** con el onboarding, que pide zona horaria y
  // minutos y los exige. Si no se puede dar, se registra como desviación y el escenario sigue:
  // abortar aquí tiraría una campaña entera por un paso que el producto ya cubre después.
  try {
    await declareAvailability(context, deviations);
  } catch (error) {
    deviations.push(
      `no se pudo declarar la disponibilidad en /ajustes: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  await chooseGoal(context);

  while (visits < MAX_SCREEN_VISITS) {
    const path = pathOf(page);

    if (path === '/fin') {
      if (await page.isVisible('[data-testid="fin-volver"]')) {
        await clickAndAdvance(page, '[data-testid="fin-volver"]');
        visits += 1;
        continue;
      }
      await page.goto(`${context.baseUrl}/hoy`);
      visits += 1;
      continue;
    }

    if (path.startsWith('/aprender')) {
      log = await walkLearn(context, await observeScreen(page), log);
      visits += 1;
      continue;
    }

    if (path.startsWith('/comprobar')) {
      log = await walkCheck(context, await observeScreen(page), log);
      visits += 1;
      continue;
    }

    if (path !== '/hoy') {
      await page.goto(`${context.baseUrl}/hoy`);
      visits += 1;
      continue;
    }

    // En HOY sin acción primaria: hay que mirar **qué** decidió, no solo que no ofrece nada.
    if (!(await page.isVisible('[data-testid="hoy-primaria"]'))) {
      const todayTerminalState = await readTodayTerminalState(page);
      return {
        log,
        completed: CLOSING_STATES.includes(todayTerminalState),
        finalPath: path,
        todayTerminalState,
        visits,
        deviations,
      };
    }
    await clickAndAdvance(page, '[data-testid="hoy-primaria"]');
    visits += 1;

    // HOY puede llevar a una superficie de configuración en vez de a una acción: el escenario
    // ya declaró objetivo y disponibilidad, de modo que volver ahí es un hallazgo, no un paso.
    if (pathOf(page) === '/ajustes' || pathOf(page) === '/onboarding') {
      return {
        log,
        completed: false,
        finalPath: pathOf(page),
        todayTerminalState: 'NOT_REACHED',
        visits,
        deviations,
      };
    }
  }

  throw new ScenarioAborted(
    `se alcanzó el tope de ${MAX_SCREEN_VISITS} pantallas sin que el producto cerrara el día`,
  );
}
