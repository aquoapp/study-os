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
  waitForNavigation(): Promise<void>;
}

export interface RunnerContext {
  readonly page: CampaignPage;
  readonly baseUrl: string;
  readonly identity: SyntheticIdentity;
  /** Slug del pack del laboratorio, para elegir objetivo sin depender del orden del select. */
  readonly packSlug: string;
  /** Fecha objetivo que el onboarding exige. Entrada del escenario, no un resultado. */
  readonly targetDate: string;
  readonly now: () => string;
}

export interface RunnerResult {
  readonly log: ActorLog;
  readonly completed: boolean;
  /** Última ruta observada: deja constancia de dónde terminó la ejecución. */
  readonly finalPath: string;
  readonly visits: number;
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
  await page.click('[data-testid="submit-button"]');
  await page.waitForNavigation();
  if (pathOf(page) !== '/hoy') {
    throw new ScenarioAborted(
      `el alta no llevó a HOY sino a «${pathOf(page)}»: una cuenta nueva debe tener camino`,
    );
  }
}

/** Declara zona horaria y disponibilidad en `/ajustes`, que es donde el producto las pide. */
async function declareAvailability(context: RunnerContext): Promise<void> {
  const { page } = context;
  await page.goto(`${context.baseUrl}/ajustes`);
  if (await page.isVisible('[data-testid="ajustes-zona-select"]')) {
    await page.selectOption('[data-testid="ajustes-zona-select"]', AVAILABILITY_INPUT.timezone);
    await page.click('[data-testid="ajustes-zona-guardar"]');
    await page.waitForNavigation();
  }
  if (await page.isVisible('[data-testid="ajustes-habitual"]')) {
    await page.fill(
      '[data-testid="ajustes-habitual"]',
      String(AVAILABILITY_INPUT.defaultDailyMinutes),
    );
    await page.click('[data-testid="ajustes-guardar"]');
    await page.waitForNavigation();
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
  await page.selectOption('[data-testid="pack-select"]', context.packSlug);
  await page.fill(
    '[data-testid="daily-minutes-input"]',
    String(AVAILABILITY_INPUT.defaultDailyMinutes),
  );
  if (await page.isVisible('[data-testid="target-date-input"]')) {
    await page.fill('[data-testid="target-date-input"]', context.targetDate);
  }
  await page.click('[data-testid="onboarding-submit"]');
  await page.waitForNavigation();
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
    await page.click('[data-testid="feedback-siguiente"]').catch(async () => {
      await page.goto(`${context.baseUrl}/hoy`);
    });
    await page.waitForNavigation();
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

  await page.click(`[data-testid="opcion-${decision.optionKey}"]`);
  await page.waitForNavigation();

  const confidence = confidencePolicy(screen);
  await page.click(`[data-testid="confianza-${confidence}"]`);
  await page.waitForNavigation();

  await page.click('[data-testid="comprobar"]');
  await page.waitForNavigation();

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

  if (decision.action === 'INTERRUPT') {
    await page.click('[data-testid="dejarlo"]');
  } else {
    await page.click('[data-testid="aprender-continuar"]');
  }
  await page.waitForNavigation();
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

  await register(context);
  await declareAvailability(context);
  await chooseGoal(context);

  while (visits < MAX_SCREEN_VISITS) {
    const path = pathOf(page);

    if (path === '/fin') {
      if (await page.isVisible('[data-testid="fin-volver"]')) {
        await page.click('[data-testid="fin-volver"]');
        await page.waitForNavigation();
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

    // En HOY: si no hay acción primaria, el producto dio el día por terminado.
    if (!(await page.isVisible('[data-testid="hoy-primaria"]'))) {
      return { log, completed: true, finalPath: path, visits };
    }
    await page.click('[data-testid="hoy-primaria"]');
    await page.waitForNavigation();
    visits += 1;

    // HOY puede llevar a una superficie de configuración en vez de a una acción: el escenario
    // ya declaró objetivo y disponibilidad, de modo que volver ahí es un hallazgo, no un paso.
    if (pathOf(page) === '/ajustes' || pathOf(page) === '/onboarding') {
      return { log, completed: false, finalPath: pathOf(page), visits };
    }
  }

  throw new ScenarioAborted(
    `se alcanzó el tope de ${MAX_SCREEN_VISITS} pantallas sin que el producto cerrara el día`,
  );
}
