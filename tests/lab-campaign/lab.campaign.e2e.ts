import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

import { emptyActorLog, resolveTestimony, type ActorLog } from '../../lab/src/actor-log';
import { freezeCampaignManifest, type ExecutionMode } from '../../lab/src/campaign';
import { corpusManifest, CORPUS_SLUG } from '../../lab/src/corpus';
import { harnessCredentials } from '../../lab/src/credentials';
import { EPHEMERAL_SUBSTRATE, LAB_ENV, SUBSTRATE_ENV_VAR } from '../../lab/src/environment';
import { readEvidenceSnapshot } from '../../lab/src/evidence';
import { isSynthetic, syntheticIdentity } from '../../lab/src/harness';
import { installLabCorpus, verifyInstalled } from '../../lab/src/ingest';
import { emptyCampaign } from '../../lab/src/ledger';
import { writeDurableLedger, type DurableLedger } from '../../lab/src/ledger-store';
import { observe, type ObservationContext } from '../../lab/src/observation';
import { evaluate, summarize } from '../../lab/src/oracle';
import { seal } from '../../lab/src/preregistration';
import { PROFILE_ID, PROFILE_VERSION, profileManifest } from '../../lab/src/profile';
import {
  deriveVerdict,
  humanReport,
  machineReport,
  type CampaignOutcome,
} from '../../lab/src/report';
import { runScenario, ScenarioAborted, type CampaignPage } from '../../lab/src/runner';
import { scenarioManifest } from '../../lab/src/scenario';
import { resolveSubstrate } from '../../lab/src/substrate';

/**
 * Campaña Golden MVP · CP4.
 *
 * ---------------------------------------------------------------------------------------
 * Esto es una prueba **del producto**
 *
 * Un aprendiz sintético, un escenario pre-registrado, una instancia efímera y un corpus
 * generado. Si aparece un incumplimiento, se registra y se clasifica; **no** se modifica STUDY
 * OS para que el escenario pase. La campaña se declara inconcluyente antes que ajustada.
 *
 * El escenario se recorre entero por superficies reales. El oráculo evalúa solo lo
 * pre-registrado. La evidencia queda en un ledger durable con su propia huella.
 * ---------------------------------------------------------------------------------------
 */

const declared = process.env[SUBSTRATE_ENV_VAR] === EPHEMERAL_SUBSTRATE;

test.skip(
  !declared,
  `sin ${SUBSTRATE_ENV_VAR}=${EPHEMERAL_SUBSTRATE} no hay sustrato efímero: la campaña no se ` +
    'ejecuta en lugar de buscar otro destino',
);

/** Una campaña recorre un día entero del producto: el tope por defecto no le llega. */
test.setTimeout(10 * 60 * 1000);

const OUT = join(process.cwd(), 'test-results', 'lab-campaign');

function head(): string {
  if (process.env['GITHUB_SHA']) return process.env['GITHUB_SHA'].slice(0, 7);
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
    waitForNavigation: async () => {
      await page.waitForLoadState('domcontentloaded');
    },
  };
}

test('Golden MVP · un aprendiz sintético recorre un día y el contrato se evalúa', async ({
  page,
  baseURL,
}) => {
  mkdirSync(OUT, { recursive: true });

  // ---------------------------------------------------------------------------------------
  // §3 · mundo efímero verificado y corpus instalado por la frontera real.
  // ---------------------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------------------
  // §2 · manifiesto congelado antes de arrancar.
  // ---------------------------------------------------------------------------------------
  const preregistration = seal(new Date().toISOString());
  const build = head();
  const manifest = freezeCampaignManifest({
    // El laboratorio vive en este repositorio: los dos commits coinciden, y se registran
    // por separado porque la arquitectura no garantiza que vayan a coincidir siempre.
    labBuild: build,
    studyOsBuild: build,
    identity,
    preregistration,
    executionMode: (process.env['LAB_EXECUTION_MODE'] as ExecutionMode) ?? 'ephemeral-ci',
    startedAt: new Date().toISOString(),
    runOrdinal: process.env['LAB_RUN_ORDINAL'] === '2' ? 2 : 1,
    ...(process.env['LAB_CAMPAIGN_ID'] ? { campaignId: process.env['LAB_CAMPAIGN_ID'] } : {}),
  });

  // ---------------------------------------------------------------------------------------
  // §4–6 · el Actor se da de alta por la interfaz y recorre el escenario.
  // ---------------------------------------------------------------------------------------
  const synthetic = syntheticIdentity('mvp');
  expect(isSynthetic(synthetic.email)).toBe(true);

  const observation: ObservationContext = {
    credentials: { databaseUrl: process.env[LAB_ENV.databaseUrl] as string },
    identity,
  };

  let abortReason: string | null = null;
  let scenarioCompleted = false;
  let log: ActorLog = emptyActorLog();

  try {
    const result = await runScenario({
      page: adapt(page),
      baseUrl: baseURL ?? '',
      identity: synthetic,
      packSlug: CORPUS_SLUG,
      targetDate: '2027-06-01',
      now: () => new Date().toISOString(),
    });
    log = result.log;
    scenarioCompleted = result.completed;
  } catch (error) {
    abortReason =
      error instanceof ScenarioAborted
        ? error.reason
        : `fallo inesperado del recorrido: ${String(error)}`;
  }

  // ---------------------------------------------------------------------------------------
  // §9 · observación: el sujeto se resuelve observando, no desde el Actor.
  // ---------------------------------------------------------------------------------------
  const subjectRows = observe(
    observation,
    `select id::text as id from auth.users where email = '${synthetic.email}'`,
  );
  const subjectRef = typeof subjectRows?.[0]?.['id'] === 'string' ? subjectRows[0]['id'] : null;

  if (subjectRef === null) {
    abortReason ??= 'no se pudo resolver el sujeto sintético: sin sujeto no hay nada que observar';
  }

  const conceptKeyById = new Map([...installed.conceptIds.entries()].map(([key, id]) => [id, key]));

  const resolved = subjectRef === null ? null : resolveTestimony(observation, subjectRef, log);

  const snapshot =
    subjectRef === null || resolved === null
      ? null
      : readEvidenceSnapshot({
          context: observation,
          subjectRef,
          conceptKeyById,
          actor: resolved.testimony,
          structuralScarcityConcepts: [...corpus.structuralScarcityConcepts],
        });

  // Una resolución parcial del testimonio hace la observación incompleta: no se oculta.
  const observationComplete =
    snapshot !== null && snapshot.observationComplete && (resolved?.resolved ?? false);

  // ---------------------------------------------------------------------------------------
  // §10 · el oráculo evalúa solo lo pre-registrado.
  // ---------------------------------------------------------------------------------------
  const evaluations =
    snapshot === null ? [] : evaluate({ ...snapshot, observationComplete }, preregistration);
  const summary = summarize(evaluations);

  const runValidity =
    abortReason !== null || snapshot === null || evaluations.length === 0
      ? ('INVALID_RUN' as const)
      : ('VALID' as const);

  // ---------------------------------------------------------------------------------------
  // §11–12 · notas no evaluativas y ledger durable.
  // ---------------------------------------------------------------------------------------
  const notes: string[] = [
    `visitas registradas por el Actor: ${log.visits.length}`,
    `envíos del Actor: ${log.visits.filter((visit) => visit.submitted).length}`,
    `escenario completado: ${scenarioCompleted ? 'sí' : 'no'}`,
  ];
  if (resolved && !resolved.resolved) {
    notes.push(`enunciados vistos que la observación no situó: ${resolved.unresolvedStems.length}`);
  }
  if (snapshot) {
    notes.push(
      `eventos observados: ${snapshot.events.length} · intentos: ${snapshot.attempts.length} · ` +
        `ítems presentados: ${snapshot.presentedItems.length}`,
    );
    notes.push(
      `plan observado: ${snapshot.planner.plannedConceptKeys.join(', ') || 'ninguno'} · ` +
        `exclusiones: ${snapshot.planner.exclusions.length}`,
    );
  }

  const runId = `run-${manifest.runOrdinal}`;
  const ledgerPath = join(OUT, `${runId}.json`);
  const profile = profileManifest();
  const scenario = scenarioManifest();

  const ledger: DurableLedger = {
    ledgerSchemaVersion: 'lab-ledger-1.0.0',
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
    campaign: emptyCampaign(manifest.campaignId, 'LAB-ARCH-DF-001', {
      appCommit: manifest.studyOsBuild,
      engineVersion: 'concept-evidence-1.0.0',
      plannerVersion: 'v1',
      corpusVersion: corpus.corpusVersion,
      configDigest: manifest.digest,
      substrateIdentity: manifest.executionMode,
    }),
    operationalTimestamps: {
      startedAt: manifest.startedAt,
      writtenAt: new Date().toISOString(),
    },
    // La destrucción del sustrato la ejecuta el job, después de recoger la evidencia.
    teardown: null,
    artifacts: [
      { kind: 'corpus', sha256: corpus.contentHash },
      { kind: 'manifest', sha256: manifest.digest },
      { kind: 'preregistration', sha256: preregistration.digest },
    ],
  };

  const written = writeDurableLedger(ledger, ledgerPath);

  // ---------------------------------------------------------------------------------------
  // §13 · informes. El generador redacta; no recalcula.
  // ---------------------------------------------------------------------------------------
  const outcome: CampaignOutcome = {
    manifest,
    runValidity,
    verdict: deriveVerdict({ runValidity, summary }),
    evaluations,
    summary,
    abortReason,
    notes,
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
  expect(outcome.verdict).toBeTruthy();
});
