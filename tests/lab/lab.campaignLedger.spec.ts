import { describe, expect, it } from 'vitest';

import type { ActorLog, ScreenVisit } from '../../lab/src/actor-log';
import { freezeCampaignManifest } from '../../lab/src/campaign';
import { buildCampaignRecord, routeProvenanceFor, walkSteps } from '../../lab/src/ledger-build';
import {
  LEDGER_SCHEMA_VERSION_CAMPAIGN,
  LedgerPersistenceRefused,
  writeDurableLedger,
  type DurableLedger,
} from '../../lab/src/ledger-store';
import { LEDGER_SCHEMA_VERSION } from '../../lab/src/ledger';
import type { BarrierReading } from '../../lab/src/observation';
import type { AttemptObservation } from '../../lab/src/oracle';
import { seal } from '../../lab/src/preregistration';
import { attributeRoutes, summarizeRoutes, type FoldObservation } from '../../lab/src/route';
import { CONTRACT_PROPERTIES } from '../../lab/src/scenario';
import type { SubstrateIdentity } from '../../lab/src/substrate';

/**
 * Ledger de campaña y procedencia de ruta · CP4 · §7–8 y §12.
 *
 * Dos cosas se protegen aquí. Que una acción **rechazada no desaparezca** del ledger, porque un
 * abandono solo es enumerable si su intento quedó registrado sin aceptación. Y que la ruta se
 * presente como **inferida**, nunca como registrada: el producto no guarda quién plegó.
 */

const IDENTITY: SubstrateIdentity = {
  kind: 'ephemeral-ci',
  apiUrl: 'http://127.0.0.1:54321',
  databaseHost: '127.0.0.1',
  databasePort: '54322',
  fingerprint: '0123456789abcdef',
  observedAt: '2026-11-14T00:00:00Z',
};

const MANIFEST = freezeCampaignManifest({
  labBuild: 'b989eb6',
  studyOsBuild: 'b989eb6',
  identity: IDENTITY,
  preregistration: seal('2026-11-14T00:00:00Z'),
  executionMode: 'ephemeral-ci',
  startedAt: '2026-11-14T21:00:00Z',
});

function visit(partial: Partial<ScreenVisit>): ScreenVisit {
  return {
    ordinal: 1,
    path: '/comprobar/1',
    phase: 'Comprobar',
    questionStem: '¿Enunciado 1?',
    unitTitle: null,
    optionKeysOffered: ['A', 'B', 'C', 'D'],
    chosenOptionKey: 'A',
    confidenceEntered: 3,
    submitted: true,
    answerKeyVisibleBeforeSubmit: false,
    feedbackSeen: true,
    visitedAt: '2026-11-14T21:01:00Z',
    ...partial,
  };
}

const ATTEMPT: AttemptObservation = {
  sessionItemId: 'item-1',
  questionId: 'q-1',
  questionRepresentationId: 'rep-1',
  submittedEventId: 'evt-2',
  answerKind: 'OPTION',
  selectedOptionKey: 'A',
  isCorrectAtSubmission: true,
  confidenceValue: 3,
  confidenceScaleVersion: 'v1',
  attemptNumber: 1,
  serverCorrectOptionKey: 'A',
};

const BARRIER: BarrierReading = {
  subjectRef: '11111111-2222-3333-4444-555555555555',
  maxPosition: 2,
  consumedPosition: 2,
  pending: false,
  substrateFingerprint: IDENTITY.fingerprint,
  readAt: '2026-11-14T21:02:00Z',
};

function buildInput(log: ActorLog, attempts: readonly AttemptObservation[]) {
  return {
    manifest: MANIFEST,
    log,
    attempts,
    sessionItemByStem: new Map([['¿Enunciado 1?', 'item-1']]),
    barrierReadings: [BARRIER, BARRIER],
    evaluations: [],
    subjectRef: BARRIER.subjectRef,
    learnerId: 'sl-1',
  };
}

describe('acción intentada ≠ acción aceptada', () => {
  it('un envío aceptado lleva su intento y su aceptación, con huellas distintas', () => {
    const steps = walkSteps(buildInput({ visits: [visit({})] }, [ATTEMPT]));
    expect(steps[0]?.actions).toHaveLength(1);
    expect(steps[0]?.accepted).toHaveLength(1);
    expect(steps[0]?.accepted[0]?.acceptedRefs).toEqual(['evt-2']);
    expect(steps[0]?.accepted[0]?.acceptedDigest).not.toBe(
      steps[0]?.actions[0]?.requestFingerprint,
    );
  });

  it('una pantalla abandonada deja intento SIN aceptación: el rechazo no desaparece', () => {
    const steps = walkSteps(buildInput({ visits: [visit({ submitted: false })] }, []));
    expect(steps[0]?.actions).toHaveLength(1);
    expect(steps[0]?.accepted).toHaveLength(0);
    expect(steps[0]?.actions[0]?.intent).toContain('abandonar');
  });

  it('un envío que el producto no aceptó también deja intento sin aceptación', () => {
    const steps = walkSteps(buildInput({ visits: [visit({})] }, []));
    expect(steps[0]?.accepted).toHaveLength(0);
  });

  it('un enunciado que la observación no situó no fabrica una aceptación', () => {
    const input = {
      ...buildInput({ visits: [visit({ questionStem: '¿Otro?' })] }, [ATTEMPT]),
      sessionItemByStem: new Map<string, string>(),
    };
    expect(walkSteps(input)[0]?.accepted).toHaveLength(0);
  });
});

describe('el registro de campaña reúne lo que §12 exige', () => {
  it('aprendiz, escenario, pasos del recorrido y un paso final de observación', () => {
    const record = buildCampaignRecord(
      buildInput({ visits: [visit({}), visit({ path: '/hoy', questionStem: null })] }, [ATTEMPT]),
    );
    expect(record.learners[0]?.subjectRef).toBe(BARRIER.subjectRef);
    const steps = record.scenarios[0]!.steps;
    expect(steps).toHaveLength(3);
    expect(steps[2]?.expectedSurface).toContain('OBSERVER');
    expect(steps[2]?.observations).toHaveLength(2);
    expect(steps[2]?.actions).toHaveLength(0);
  });

  it('declara cada regla contractual con su fuente', () => {
    const record = buildCampaignRecord(buildInput({ visits: [visit({})] }, [ATTEMPT]));
    expect(record.contracts).toHaveLength(CONTRACT_PROPERTIES.length);
    for (const reference of record.contracts) {
      expect(reference.ruleId).toBeTruthy();
      expect(reference.sourceDocument).toBeTruthy();
    }
  });

  it('el paso de observación no es una acción del aprendiz', () => {
    const record = buildCampaignRecord(buildInput({ visits: [visit({})] }, [ATTEMPT]));
    const last = record.scenarios[0]!.steps.at(-1)!;
    expect(last.actions).toHaveLength(0);
    expect(last.accepted).toHaveLength(0);
  });
});

describe('un ledger de campaña incompleto no se escribe', () => {
  function ledger(overrides: Partial<DurableLedger> = {}): DurableLedger {
    const preregistration = seal('2026-11-14T00:00:00Z');
    return {
      ledgerSchemaVersion: LEDGER_SCHEMA_VERSION_CAMPAIGN,
      campaignId: MANIFEST.campaignId,
      runId: 'run-1',
      provenance: {
        studyOsBuild: MANIFEST.studyOsBuild,
        labBuild: MANIFEST.labBuild,
        substrateFingerprint: MANIFEST.substrateFingerprint,
        profileId: MANIFEST.profileId,
        profileVersion: MANIFEST.profileVersion,
        profileHash: MANIFEST.profileHash,
        scenarioId: MANIFEST.scenarioId,
        scenarioVersion: MANIFEST.scenarioVersion,
        scenarioHash: MANIFEST.scenarioHash,
        corpusId: MANIFEST.corpusId,
        corpusVersion: MANIFEST.corpusVersion,
        corpusHash: MANIFEST.corpusHash,
        preregistrationDigest: preregistration.digest,
      },
      observerState: 'NOT_ACTIVE',
      campaign: buildCampaignRecord(buildInput({ visits: [visit({})] }, [ATTEMPT])),
      operationalTimestamps: {
        startedAt: MANIFEST.startedAt,
        writtenAt: '2026-11-14T21:05:00Z',
      },
      teardown: null,
      artifacts: [{ kind: 'manifest', sha256: MANIFEST.digest }],
      runValidity: 'VALID',
      routeProvenance: [],
      ...overrides,
    };
  }

  it('sin validez de run se rechaza', () => {
    const roto = ledger();
    delete (roto as { runValidity?: unknown }).runValidity;
    expect(() => writeDurableLedger(roto, 'test-results/lab-ledger/nunca-1.json')).toThrow(
      LedgerPersistenceRefused,
    );
  });

  it('sin procedencia de ruta se rechaza, aunque fuera una lista vacía', () => {
    const roto = ledger();
    delete (roto as { routeProvenance?: unknown }).routeProvenance;
    expect(() => writeDurableLedger(roto, 'test-results/lab-ledger/nunca-2.json')).toThrow(
      /procedencia de ruta/,
    );
  });

  it('la versión de CP3 sigue siendo escribible y no exige los campos nuevos', () => {
    const cp3 = ledger({ ledgerSchemaVersion: LEDGER_SCHEMA_VERSION });
    delete (cp3 as { runValidity?: unknown }).runValidity;
    delete (cp3 as { routeProvenance?: unknown }).routeProvenance;
    expect(() => writeDurableLedger(cp3, 'test-results/lab-ledger/cp3.json')).not.toThrow();
  });

  it('el ledger de campaña no contiene ninguna clave de respuesta', () => {
    const result = writeDurableLedger(ledger(), 'test-results/lab-ledger/campaign.json');
    expect(result.sha256).toHaveLength(64);
  });
});

describe('la ruta se infiere; el producto no la registra', () => {
  const FOLD: FoldObservation = {
    reason: 'INCREMENTAL',
    fromPosition: 1,
    toPosition: 2,
    createdAt: '2026-11-14T21:01:02.000Z',
  };

  it('un pliegue anterior al regreso a HOY se infiere Route A', () => {
    const evidence = attributeRoutes(
      [
        {
          streamPosition: 2,
          serverReceivedAt: '2026-11-14T21:01:00.000Z',
          returnedToTodayAt: '2026-11-14T21:01:10.000Z',
        },
      ],
      [FOLD],
    );
    expect(evidence[0]?.attribution).toBe('INFERRED_ROUTE_A');
    expect(evidence[0]?.latencySeconds).toBeCloseTo(2, 1);
  });

  it('un pliegue posterior al regreso a HOY se infiere Route B', () => {
    const evidence = attributeRoutes(
      [
        {
          streamPosition: 2,
          serverReceivedAt: '2026-11-14T21:01:00.000Z',
          returnedToTodayAt: '2026-11-14T21:01:01.000Z',
        },
      ],
      [FOLD],
    );
    expect(evidence[0]?.attribution).toBe('INFERRED_ROUTE_B');
  });

  it('sin regreso a HOY, Route B no tuvo ocasión: Route A', () => {
    const evidence = attributeRoutes(
      [
        {
          streamPosition: 2,
          serverReceivedAt: '2026-11-14T21:01:00.000Z',
          returnedToTodayAt: null,
        },
      ],
      [FOLD],
    );
    expect(evidence[0]?.attribution).toBe('INFERRED_ROUTE_A');
  });

  it('un envío sin pliegue que lo alcance no se atribuye a ninguna ruta', () => {
    const evidence = attributeRoutes(
      [
        {
          streamPosition: 9,
          serverReceivedAt: '2026-11-14T21:01:00.000Z',
          returnedToTodayAt: null,
        },
      ],
      [FOLD],
    );
    expect(evidence[0]?.attribution).toBe('INFERRED_NOT_FOLDED');
  });

  it('un instante que no se puede situar da UNATTRIBUTABLE, no la etiqueta más favorable', () => {
    const evidence = attributeRoutes(
      [{ streamPosition: 2, serverReceivedAt: 'no es una fecha', returnedToTodayAt: 'tampoco' }],
      [FOLD],
    );
    expect(evidence[0]?.attribution).toBe('UNATTRIBUTABLE');
  });

  it('el resumen declara explícitamente que el producto no registra la ruta', () => {
    expect(summarizeRoutes([]).recordedByProduct).toBe(false);
  });

  it('toda etiqueta dice que es inferida: ninguna afirma observación directa', () => {
    const evidence = attributeRoutes(
      [
        {
          streamPosition: 2,
          serverReceivedAt: '2026-11-14T21:01:00.000Z',
          returnedToTodayAt: null,
        },
      ],
      [FOLD],
    );
    for (const item of routeProvenanceFor(evidence)) {
      expect(item.attribution).toMatch(/^(INFERRED_|UNATTRIBUTABLE)/);
      expect(item.recordedByProduct).toBe(false);
    }
  });
});
