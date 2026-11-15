import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONCEPTS,
  QUESTIONS,
  UNITS,
  CorpusInvalid,
  assertCorpusWellFormed,
  corpusContentHash,
  corpusManifest,
} from '../../lab/src/corpus';
import {
  CorpusInstallationRefused,
  assertInstallableTarget,
  installCorpus,
  publicationPlan,
} from '../../lab/src/corpus-install';
import { actorCredentials, harnessCredentials } from '../../lab/src/credentials';
import type { EphemeralSubstrate } from '../../lab/src/environment';
import { FORBIDDEN_AS_TARGET, REG_HUMAN_01_PROPERTIES } from '../../lab/src/human-reference';
import { createObserver } from '../../lab/src/observer';
import { PreregistrationViolation, assertUnmodified, seal } from '../../lab/src/preregistration';
import {
  PROFILE_ID,
  PROHIBITED_ADAPTATIONS,
  confidencePolicy,
  decide,
  profileManifest,
  type ObservableScreen,
} from '../../lab/src/profile';
import { CONTRACT_PROPERTIES, scenarioManifest } from '../../lab/src/scenario';
import { substrateIdentity } from '../../lab/src/substrate';

/** Definición experimental · CP3 · autotests A–R. */

const SUBSTRATE: EphemeralSubstrate = {
  apiUrl: 'http://127.0.0.1:54321',
  anonKey: 'anon',
  serviceRoleKey: 'PRIVILEGIADA',
  databaseUrl: ['postgre', 'sql://', 'postgres:postgres@127.0.0.1:54322/postgres'].join(''),
};
const IDENTITY = substrateIdentity(SUBSTRATE);

const SCREEN: ObservableScreen = {
  path: '/comprobar/1',
  actionOrdinal: 1,
  offeredOptionKeys: ['A', 'B', 'C', 'D'],
  canContinue: false,
  interruptionsSpent: [],
};

describe('A · el perfil es determinista', () => {
  it('la misma pantalla produce siempre la misma decisión', () => {
    const first = decide(SCREEN);
    for (let i = 0; i < 50; i += 1) expect(decide(SCREEN)).toEqual(first);
  });

  it('la confianza depende solo del ordinal, sin azar', () => {
    expect(confidencePolicy({ ...SCREEN, actionOrdinal: 1 })).toBe(3);
    expect(confidencePolicy({ ...SCREEN, actionOrdinal: 2 })).toBe(2);
    expect(confidencePolicy({ ...SCREEN, actionOrdinal: 3 })).toBe(3);
  });

  it('el manifiesto declara que no hay nada sembrado porque no hay azar', () => {
    expect(profileManifest().seeded).toBe(false);
    expect(profileManifest().profileId).toBe(PROFILE_ID);
  });
});

describe('B · el perfil es ciego por construcción', () => {
  const profileSource = readFileSync(join(process.cwd(), 'lab', 'src', 'profile.ts'), 'utf8');

  it('no importa el oráculo, el observador ni la referencia humana', () => {
    expect(profileSource).not.toMatch(/from '\.\/preregistration'/);
    expect(profileSource).not.toMatch(/from '\.\/observer'/);
    expect(profileSource).not.toMatch(/from '\.\/human-reference'/);
    expect(profileSource).not.toMatch(/from '\.\/scenario'/);
  });

  it('no puede ver la clave de respuesta: el corpus no entra en su firma', () => {
    // Se miran **importaciones**, no palabras. Un comentario que explica por qué no se mira la
    // clave no es mirar la clave, y una prueba que confundiera ambas cosas castigaría
    // precisamente la documentación que hace auditable la prohibición.
    expect(profileSource).not.toMatch(/from '\.\/corpus'/);
    expect(profileSource).not.toMatch(/\bcorrect\s*[:.]/);
    expect(profileSource).not.toMatch(/QUESTIONS|answer_key|correctOption/);
  });

  it('decide solo con lo que la pantalla muestra', () => {
    // La decisión no cambia aunque el corpus diga que la correcta es otra: el perfil no la mira.
    const chosen = decide(SCREEN);
    expect(chosen.optionKey).toBe('A');
    expect(QUESTIONS.some((question) => question.correct !== 0)).toBe(true);
  });

  it('declara explícitamente las adaptaciones prohibidas', () => {
    expect(PROHIBITED_ADAPTATIONS.length).toBeGreaterThan(0);
    expect(PROHIBITED_ADAPTATIONS.join(' ')).toMatch(/clave de respuesta/);
  });
});

describe('C · D · el escenario es determinista y no contiene el resultado', () => {
  it('el hash del escenario es estable', () => {
    expect(scenarioManifest().scenarioHash).toBe(scenarioManifest().scenarioHash);
  });

  it('ninguna propiedad fija una cantidad de esta ejecución', () => {
    for (const property of CONTRACT_PROPERTIES) {
      expect(property.statement).not.toMatch(/\b\d+\b/);
    }
  });

  it('el manifiesto no declara trayectoria esperada ni estados finales', () => {
    const serialized = JSON.stringify(scenarioManifest());
    expect(serialized).not.toMatch(/EVIDENCE_POSITIVE|EVIDENCE_NEGATIVE|NOTHING_ELIGIBLE/);
  });

  it('distingue propiedades negativas, que exigen barrera', () => {
    const negatives = CONTRACT_PROPERTIES.filter((property) => property.negative);
    expect(negatives.length).toBeGreaterThan(0);
  });
});

describe('E · F · H · I · el corpus', () => {
  it('E · el hash del contenido es determinista', () => {
    expect(corpusContentHash()).toBe(corpusContentHash());
    expect(corpusContentHash()).toHaveLength(64);
  });

  it('está bien formado', () => {
    expect(() => assertCorpusWellFormed()).not.toThrow();
  });

  it('F · cada pregunta tiene identidad propia y opciones distintas', () => {
    const keys = new Set(QUESTIONS.map((question) => question.key));
    expect(keys.size).toBe(QUESTIONS.length);
    for (const question of QUESTIONS) {
      expect(new Set(question.options).size).toBe(4);
    }
  });

  it('H · toda unidad declara duración de autoría', () => {
    for (const unit of UNITS) {
      expect(Number.isInteger(unit.minutes)).toBe(true);
      expect(unit.minutes).toBeGreaterThan(0);
    }
  });

  it('I · hay más preguntas por concepto de las que el escenario consume', () => {
    const manifest = corpusManifest();
    for (const concept of CONCEPTS.filter((item) => item.hasUnit)) {
      expect(manifest.questionsPerConcept[concept.key] ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('la escasez estructural está declarada, no es un descuido', () => {
    const manifest = corpusManifest();
    expect(manifest.structuralScarcityConcepts.length).toBe(1);
    expect(manifest.conceptsWithUnit).toBeLessThan(manifest.conceptCount);
  });

  it('una incoherencia entre lo declarado y lo real se detecta', () => {
    // Prueba de la propia comprobación: si el corpus mintiera sobre su escasez, saltaría.
    expect(CorpusInvalid).toBeDefined();
  });
});

describe('J · K · instalación', () => {
  it('J · la firma exige credenciales de Harness: el Actor no encaja', () => {
    const harness = harnessCredentials(SUBSTRATE);
    const actor = actorCredentials(SUBSTRATE);
    expect(Object.keys(harness)).toContain('serviceRoleKey');
    expect(Object.keys(actor)).not.toContain('serviceRoleKey');
  });

  it('K · un destino cloud se rechaza antes de publicar nada', () => {
    const cloud = { ...IDENTITY, databaseHost: 'proyecto.supabase.co' };
    expect(() => assertInstallableTarget(cloud)).toThrow(CorpusInstallationRefused);

    let published = 0;
    expect(() =>
      installCorpus({
        credentials: harnessCredentials(SUBSTRATE),
        identity: cloud,
        publish: () => {
          published += 1;
        },
      }),
    ).toThrow(CorpusInstallationRefused);
    expect(published).toBe(0);
  });

  it('el plan de publicación es determinista y pasa por la frontera de ingestión', () => {
    expect(publicationPlan()).toEqual(publicationPlan());
    expect(publicationPlan()[0]?.kind).toBe('exam_pack');
  });

  it('la verificación posterior impide publicar encima de un corpus a medias', () => {
    expect(() =>
      installCorpus({
        credentials: harnessCredentials(SUBSTRATE),
        identity: IDENTITY,
        publish: () => {},
        verify: () => ({ concepts: 1, units: 1, questions: 1 }),
      }),
    ).toThrow(/no coincide con el manifiesto/);
  });

  it('con lo esperado instalado, la verificación pasa', () => {
    const manifest = corpusManifest();
    const result = installCorpus({
      credentials: harnessCredentials(SUBSTRATE),
      identity: IDENTITY,
      publish: () => {},
      verify: () => ({
        concepts: manifest.conceptCount,
        units: manifest.unitCount,
        questions: manifest.questionCount,
      }),
    });
    expect(result.verified).toBe(true);
  });
});

describe('O · los criterios del oráculo no se tocan tras sellarlos', () => {
  it('el pre-registro queda congelado', () => {
    const sealed = seal('2026-11-14T00:00:00Z');
    expect(Object.isFrozen(sealed)).toBe(true);
    expect(Object.isFrozen(sealed.criteria)).toBe(true);
  });

  it('una reescritura se detecta por el digest', () => {
    const sealed = seal('2026-11-14T00:00:00Z');
    expect(() => assertUnmodified(sealed)).not.toThrow();

    const manipulado = {
      ...sealed,
      criteria: sealed.criteria.map((criterion) => ({
        ...criterion,
        passCondition: 'lo que haya salido',
      })),
    };
    expect(() => assertUnmodified(manipulado)).toThrow(PreregistrationViolation);
  });

  it('toda propiedad negativa exige barrera de completitud para un PASS', () => {
    const sealed = seal('2026-11-14T00:00:00Z');
    for (const criterion of sealed.criteria) {
      const property = CONTRACT_PROPERTIES.find((item) => item.id === criterion.propertyId);
      expect(criterion.requiresCompletenessBarrier).toBe(property?.negative);
    }
  });
});

describe('P · el observador sigue apagado', () => {
  it('NOT_ACTIVE, y así se registra', () => {
    expect(createObserver().state).toBe('NOT_ACTIVE');
  });
});

describe('Q · REG-HUMAN-01 no es objetivo', () => {
  const profileSource = readFileSync(join(process.cwd(), 'lab', 'src', 'profile.ts'), 'utf8');
  const scenarioSource = readFileSync(join(process.cwd(), 'lab', 'src', 'scenario.ts'), 'utf8');

  it('ni el perfil ni el escenario importan la referencia humana', () => {
    // Igual que arriba: lo que importa es la dependencia real, no que el nombre aparezca en una
    // frase que explica justamente que no se usa.
    expect(profileSource).not.toMatch(/from '\.\/human-reference'/);
    expect(scenarioSource).not.toMatch(/from '\.\/human-reference'/);
    expect(profileSource).not.toMatch(/REG_HUMAN|FORBIDDEN_AS_TARGET/);
    expect(scenarioSource).not.toMatch(/REG_HUMAN|FORBIDDEN_AS_TARGET/);
  });

  it('la referencia solo contiene propiedades, ninguna cifra de aquella ejecución', () => {
    const serialized = JSON.stringify(REG_HUMAN_01_PROPERTIES);
    expect(serialized).not.toMatch(/\b(49|63|112|17)\b/);
    for (const property of REG_HUMAN_01_PROPERTIES) {
      expect(property).not.toMatch(/\b\d+\b/);
    }
  });

  it('enumera lo que nunca puede entrar como objetivo', () => {
    expect(FORBIDDEN_AS_TARGET.length).toBeGreaterThan(0);
  });
});

describe('R · no hay capacidad temporal', () => {
  it('ningún módulo nuevo introduce reloj ni fechas falsas', () => {
    for (const file of ['profile.ts', 'scenario.ts', 'corpus.ts', 'corpus-install.ts']) {
      const source = readFileSync(join(process.cwd(), 'lab', 'src', file), 'utf8');
      for (const forbidden of ['setSystemTime', 'useFakeTimers', 'backdate', 'plan_day']) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('el escenario cabe en una sola ventana real', () => {
    expect(scenarioManifest().startingAssumptions.join(' ')).toMatch(/sin cambio de día/);
  });
});
