import { describe, expect, it } from 'vitest';

import { canonicalDecision, canonicalInput, inputHash, plan } from '@study-os/planner-engine';

import { concept, input } from '../support/planner-fixtures';

/**
 * `planner.performance.spec` · coste del Planner puro con 40, 100, 500 y 1000 conceptos.
 *
 * Mide decisión + texto canónico + hash, que es lo que el servidor hace por petición. Las cotas
 * son generosas a propósito: detectan una regresión de orden (cuadrática o peor), no compiten
 * con el ruido de la máquina. Sin red y sin base de datos.
 */

const STATES = [
  'NEW',
  'EXPOSED',
  'EVIDENCE_POSITIVE',
  'EVIDENCE_NEGATIVE',
  'EVIDENCE_CONFLICTING',
] as const;

function corpus(size: number) {
  return Array.from({ length: size }, (_, i) =>
    concept({
      n: i + 1,
      state: STATES[i % STATES.length]!,
      block: 1 + Math.floor(i / 100),
      topic: 1 + Math.floor(i / 10),
      sort: i + 1,
      questions: 1 + (i % 3),
      learnMinutes: 2 + (i % 9),
      checkMinutes: 1 + (i % 5),
    }),
  );
}

async function measure(size: number): Promise<number> {
  const request = input(corpus(size), 120);
  const samples: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const start = performance.now();
    canonicalDecision(plan(request));
    canonicalInput(request);
    await inputHash(request);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[3]!;
}

describe('rendimiento del Planner puro', () => {
  const BOUNDS: Record<number, number> = { 40: 50, 100: 100, 500: 400, 1000: 800 };

  for (const size of [40, 100, 500, 1000]) {
    it(`${size} conceptos · mediana por debajo de ${BOUNDS[size]} ms`, async () => {
      const median = await measure(size);
      console.warn(`planner.performance · ${size} conceptos · mediana ${median.toFixed(2)} ms`);
      expect(median).toBeLessThan(BOUNDS[size]!);
    });
  }
});
