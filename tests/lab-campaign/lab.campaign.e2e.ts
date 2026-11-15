import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

import { emptyActorLog, resolveTestimony, type ActorLog } from '../../lab/src/actor-log';
import { freezeCampaignManifest, type ExecutionMode } from '../../lab/src/campaign';
import { CORPUS_PACK_NAME, corpusManifest } from '../../lab/src/corpus';
import { harnessCredentials } from '../../lab/src/credentials';
import { EPHEMERAL_SUBSTRATE, LAB_ENV, SUBSTRATE_ENV_VAR } from '../../lab/src/environment';
import { readEvidenceSnapshot } from '../../lab/src/evidence';
import { isSynthetic, syntheticIdentity } from '../../lab/src/harness';
import { installLabCorpus, verifyInstalled } from '../../lab/src/ingest';
import { buildCampaignRecord, routeProvenanceFor } from '../../lab/src/ledger-build';
import {
  LEDGER_SCHEMA_VERSION_CAMPAIGN,
  writeDurableLedger,
  type DurableLedger,
} from '../../lab/src/ledger-store';
import { observe, readBarrier, type ObservationContext } from '../../lab/src/observation';
import { evaluate, summarize } from '../../lab/src/oracle';
import { seal } from '../../lab/src/preregistration';
import { PROFILE_ID, PROFILE_VERSION, profileManifest } from '../../lab/src/profile';
import {
  deriveVerdict,
  humanReport,
  machineReport,
  type CampaignOutcome,
} from '../../lab/src/report';
import {
  attributeRoutes,
  readFolds,
  readSubmitMoments,
  summarizeRoutes,
} from '../../lab/src/route';
import { ScenarioAborted, runScenario, type CampaignPage } from '../../lab/src/runner';
import { scenarioManifest } from '../../lab/src/scenario';
import { resolveSubstrate } from '../../lab/src/substrate';

/**
 * Campaña Golden MVP · CP4.
 *
 * ---------------------------------------------------------------------------------------
 * Esto es una prueba **del producto**
 *
 * Un aprendiz sintético, un escenario pre-registrado, una instancia efímera y un corpus
 * generado. Si aparece un incumplimiento se registra y se clasifica; **no** se modifica STUDY OS
 * para que el escenario pase. La campaña se declara inconcluyente antes que ajustada.
 * ---------------------------------------------------------------------------------------
 */

const declared = process.env[SUBSTRATE_ENV_VAR] === EPHEMERAL_SUBSTRATE;

test.skip(
  !declared,
  `sin ${SUBSTRATE_ENV_VAR}=${EPHEMERAL_SUBSTRATE} no hay sustrato efímero: la campaña no se ` +
    'ejecuta en lugar de buscar otro destino',
);

/** Una campaña recorre un día entero del producto: el tope por defecto no le llega. */
test.setTimeout(12 * 60 * 1000);

const OUT = join(process.cwd(), 'test-results', 'lab-campaign');

function head(): string {
  const sha = process.env['GITHUB_SHA'];
  if (sha) return sha.slice(0, 7);
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
}

/** Adapta la página de Playwright al contrato mínimo del runner. */
function adapt(page: Page): CampaignPage {
  return {
    goto: (url) => page.goto(url, { waitUntil: 'domcontentloaded' }),
    url: () => page.url(),
    fill: (selector, value) => page.fill(selector, value),
    click: async (selector) => {
      await page.click(selector);
    },
    selectOption: async (selector, value) => {
      await page.selectOption(selector, value);
    },
    textContent: (selector) => page.textContent(selector, { timeout: 2_000 }).catch(() => null),
    isVisible: (selector) => page.isVisible(selector).catch(() => false),
    offeredOptionKeys: async () => {
      const handles = await page.locator('[data-testid^="opcion-"]').all();
      const keys: string[] = [];
      for (const handle of handles) {
        const id = await handle.getAttribute('data-testid');
        if (id) keys.push(id.replace('opcion-', ''));
      }
      return keys;
    },
    waitForUrlChange: async (previous, timeoutMs) =>
      page
        .waitForFunction((prev) => window.location.href !== prev, previous, { timeout: timeoutMs })
        .then(() => true)
        .catch(() => false),
    waitForVisible: async (selector, timeoutMs) =>
      page
        .waitForSelector(selector, { state: 'visible', timeout: timeoutMs })
        .then(() => true)
        .catch(() => false),
  };
}

test('Golden MVP · un aprendiz sintético recorre un día y el contrato se evalúa', async ({
  page,
  baseURL,
}) => {
  mkdirSync(OUT, { recursive: true });

  // §3 · mundo efímero verificado y corpus instalado por la frontera real.
  const { substrate, identity } = resolveSubstrate(process.env);
  expect(identity.kind).toBe(EPHEMERAL_SUBSTRATE);

  const harness = harnessCredentials(substrate);
  const admin = createClient(harness.apiUrl, harness.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const installed = await installLabCorpus(admin, identity);
  const corpus = corpusManifest();
  const counts = await verifyInstalled(admin, installed.packId);

  // El corpus se verifica **antes** de que el Actor empiece. Diverger aquí es INVALID_RUN.
  expect(installed.manifest.contentHash).toBe(corpus.contentHash);
  expect(counts).toEqual({
    concepts: corpus.conceptCount,
    units: corpus.unitCount,
    questions: corpus.questionCount,
  });

  // §2 · manifiesto congelado antes de arrancar.
  const preregistration = seal(new Date().toISOString());
  const build = head();
  const manifest = freezeCampaignManifest({
    // El laboratorio vive en este repositorio: los dos commits coinciden, y se registran por
    // separado porque la arquitectura no garantiza que vayan a coincidir siempre.
    labBuild: build,
    studyOsBuild: build,
    identity,
    preregistration,
    executionMode: (process.env['LAB_EXECUTION_MODE'] as ExecutionMode) ?? 'ephemeral-ci',
    startedAt: new Date().toISOString(),
    runOrdinal: process.env['LAB_RUN_ORDINAL'] === '2' ? 2 : 1,
  });

  // §4–6 · el Actor se da de alta por la interfaz y recorre el escenario.
  const synthetic = syntheticIdentity('mvp');
  expect(isSynthetic(synthetic.email)).toBe(true);

  const observation: ObservationContext = {
    credentials: { databaseUrl: process.env[LAB_ENV.databaseUrl] as string },
    identity,
  };

  let abortReason: string | null = null;
  let scenarioCompleted = false;
  let todayTerminalState: string = 'NOT_REACHED';
  let deviations: readonly string[] = [];
  let log: ActorLog = emptyActorLog();

  try {
    const result = await runScenario({
      page: adapt(page),
      baseUrl: baseURL ?? '',
      identity: synthetic,
      packLabel: CORPUS_PACK_NAME,
      targetDate: '2027-06-01',
      now: () => new Date().toISOString(),
    });
    log = result.log;
    scenarioCompleted = result.completed;
    todayTerminalState = result.todayTerminalState;
    deviations = result.deviations;
  } catch (error) {
    abortReason =
      error instanceof ScenarioAborted
        ? error.reason
        : `fallo inesperado del recorrido: ${String(error)}`;
    // Un aborto no borra lo ya recorrido: el diario parcial sigue siendo evidencia.
  }

  /**
   * La fase de observación **no puede tirar la campaña**.
   *
   * §9 dice que una observación incompleta da `INCONCLUSIVE`, no «no sabemos nada». Si una
   * lectura falla y la excepción se propaga, se pierde el ledger, los informes y el recorrido
   * que ya ocurrió: la ejecución deja de ser evidencia y pasa a ser una traza de error. Así
   * que cada fallo de observación se convierte en una razón registrada, y el artefacto se
   * escribe igual.
   */
  const observationFailures: string[] = [];
  function observing<T>(label: string, read: () => T, fallback: T): T {
    try {
      return read();
    } catch (error) {
      observationFailures.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return fallback;
    }
  }

  // §9 · el sujeto se resuelve observando, no desde el Actor.
  const subjectRows = observing(
    'resolución del sujeto',
    () =>
      observe(
        observation,
        `select id::text as id from auth.users where email = '${synthetic.email}'`,
      ),
    null,
  );
  const subjectRef = typeof subjectRows?.[0]?.['id'] === 'string' ? subjectRows[0]['id'] : null;
  if (subjectRef === null) {
    abortReason ??= 'no se pudo resolver el sujeto sintético: sin sujeto no hay nada que observar';
  }

  // Barrera **antes** de observar el resto, para que la completitud no dependa de una lectura.
  const barrierBefore =
    subjectRef === null
      ? null
      : observing('barrera antes', () => readBarrier(observation, subjectRef), null);

  const conceptKeyById = new Map([...installed.conceptIds.entries()].map(([key, id]) => [id, key]));
  const resolved =
    subjectRef === null
      ? null
      : observing(
          'resolución del testimonio',
          () => resolveTestimony(observation, subjectRef, log),
          null,
        );
  const snapshotResult =
    subjectRef === null || resolved === null
      ? null
      : observing(
          'snapshot de evidencia',
          () =>
            readEvidenceSnapshot({
              context: observation,
              subjectRef,
              conceptKeyById,
              actor: resolved.testimony,
              structuralScarcityConcepts: [...corpus.structuralScarcityConcepts],
            }),
          null,
        );
  const snapshot = snapshotResult?.snapshot ?? null;
  for (const failure of snapshotResult?.failures ?? []) observationFailures.push(failure);

  // Barrera **después**: si las dos lecturas no concuerdan, la proyección se movió mientras
  // observábamos y la completitud no puede declararse.
  const barrierAfter =
    subjectRef === null
      ? null
      : observing('barrera después', () => readBarrier(observation, subjectRef), null);
  const barrierStable =
    barrierBefore !== null &&
    barrierAfter !== null &&
    barrierBefore.maxPosition === barrierAfter.maxPosition &&
    barrierBefore.consumedPosition === barrierAfter.consumedPosition &&
    barrierBefore.pending === barrierAfter.pending;

  const observationComplete =
    snapshot !== null &&
    snapshot.observationComplete &&
    (resolved?.resolved ?? false) &&
    barrierStable &&
    observationFailures.length === 0;

  // §7–8 · procedencia de ruta. Inferida por tiempo: el producto no la registra.
  const folds =
    subjectRef === null
      ? null
      : observing(
          'historial de pliegues',
          () => readFolds(observation, subjectRef, observationFailures),
          null,
        );
  const submitMoments =
    subjectRef === null
      ? null
      : observing(
          'instantes de envío',
          () => readSubmitMoments(observation, subjectRef, observationFailures),
          null,
        );
  const returnsToToday = log.visits
    .filter((visit) => visit.path === '/hoy')
    .map((visit) => visit.visitedAt);
  const routeEvidence =
    folds === null || submitMoments === null
      ? []
      : attributeRoutes(
          submitMoments.map((moment) => ({
            ...moment,
            returnedToTodayAt: returnsToToday.find((at) => at > moment.serverReceivedAt) ?? null,
          })),
          folds,
        );
  const routes = summarizeRoutes(routeEvidence);

  // §10 · el oráculo evalúa solo lo pre-registrado.
  const evaluations =
    snapshot === null ? [] : evaluate({ ...snapshot, observationComplete }, preregistration);
  const summary = summarize(evaluations);

  const runValidity =
    abortReason !== null || snapshot === null || evaluations.length === 0
      ? ('INVALID_RUN' as const)
      : ('VALID' as const);

  // §11 · notas no evaluativas. El Observer sigue NOT_ACTIVE.
  const notes: string[] = [
    `visitas del Actor: ${log.visits.length} · envíos: ${log.visits.filter((v) => v.submitted).length}`,
    `escenario completado: ${scenarioCompleted ? 'sí' : 'no'} · HOY decidió: ${todayTerminalState}`,
    `barrera estable entre lecturas: ${barrierStable ? 'sí' : 'no'}`,
    `ruta inferida · A: ${routes.inferredRouteA} · B: ${routes.inferredRouteB} · ` +
      `sin plegar: ${routes.notFolded} · no atribuible: ${routes.unattributable}`,
    'el producto no registra qué ruta plegó: la atribución de ruta es inferencia temporal',
  ];
  for (const failure of observationFailures) {
    notes.push(`lectura de observación fallida · ${failure}`);
  }
  if (resolved && !resolved.resolved) {
    notes.push(`enunciados vistos que la observación no situó: ${resolved.unresolvedStems.length}`);
  }
  if (snapshot) {
    notes.push(
      `eventos: ${snapshot.events.length} · intentos: ${snapshot.attempts.length} · ` +
        `ítems presentados: ${snapshot.presentedItems.length}`,
    );
    notes.push(
      `plan observado: ${snapshot.planner.plannedConceptKeys.join(', ') || 'ninguno'} · ` +
        `exclusiones: ${snapshot.planner.exclusions.length}`,
    );
  }

  // §12 · ledger completo.
  const runId = `run-${manifest.runOrdinal}`;
  const profile = profileManifest();
  const scenario = scenarioManifest();
  const barrierReadings = [barrierBefore, barrierAfter].filter(
    (reading): reading is NonNullable<typeof reading> => reading !== null,
  );

  const ledger: DurableLedger = {
    ledgerSchemaVersion: LEDGER_SCHEMA_VERSION_CAMPAIGN,
    campaignId: manifest.campaignId,
    runId,
    provenance: {
      studyOsBuild: manifest.studyOsBuild,
      labBuild: manifest.labBuild,
      substrateFingerprint: manifest.substrateFingerprint,
      profileId: PROFILE_ID,
      profileVersion: PROFILE_VERSION,
      profileHash: profile.profileHash,
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      scenarioHash: scenario.scenarioHash,
      corpusId: corpus.corpusId,
      corpusVersion: corpus.corpusVersion,
      corpusHash: corpus.contentHash,
      preregistrationDigest: preregistration.digest,
    },
    observerState: 'NOT_ACTIVE',
    campaign: buildCampaignRecord({
      manifest,
      log,
      attempts: snapshot?.attempts ?? [],
      sessionItemByStem: resolved?.sessionItemByStem ?? new Map(),
      barrierReadings,
      evaluations,
      subjectRef,
      learnerId: `sl-${manifest.runOrdinal}`,
    }),
    operationalTimestamps: {
      startedAt: manifest.startedAt,
      writtenAt: new Date().toISOString(),
    },
    // La destrucción del sustrato la ejecuta el job, **después** de recoger la evidencia (§14).
    teardown: null,
    artifacts: [
      { kind: 'corpus', sha256: corpus.contentHash },
      { kind: 'manifest', sha256: manifest.digest },
      { kind: 'preregistration', sha256: preregistration.digest },
    ],
    runValidity,
    routeProvenance: routeProvenanceFor(routeEvidence),
  };

  const written = writeDurableLedger(ledger, join(OUT, `${runId}.json`));

  // §13 · informes. El generador redacta; no recalcula.
  const outcome: CampaignOutcome = {
    manifest,
    runValidity,
    verdict: deriveVerdict({ runValidity, summary }),
    evaluations,
    summary,
    abortReason,
    notes,
    deviations,
    teardownVerified: false,
    observationComplete,
    scenarioCompleted,
    ledgerPath: written.path,
    ledgerSha256: written.sha256,
  };

  writeFileSync(join(OUT, `${runId}.machine.json`), machineReport(outcome), 'utf8');
  writeFileSync(join(OUT, `${runId}.report.md`), humanReport(outcome), 'utf8');

  // La campaña **no falla** por un FAIL contractual: un FAIL es su resultado, no su error.
  // Lo que sí se exige es que haya quedado evidencia citable de lo ocurrido.
  expect(written.sha256).toHaveLength(64);
  expect(ledger.campaign.scenarios[0]?.steps.length ?? 0).toBeGreaterThan(0);
});
