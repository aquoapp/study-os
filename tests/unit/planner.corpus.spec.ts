import { describe, expect, it } from 'vitest';

import {
  EXCLUSION_REASONS,
  canonicalDecision,
  plan,
  type MasteryState,
  type PlannerConcept,
} from '@study-os/planner-engine';

import { rng } from '../governance/model/simulate';
import { input } from '../support/planner-fixtures';

/**
 * `planner.corpus.spec` · corpus sintético adversarial (autorización de gobernanza §22).
 *
 * `GENERATED` y visiblemente sintético: 3 bloques · 8 temas · 40 conceptos, y una variante de 100.
 * De 0 a 3 preguntas por concepto, duraciones de fixture heterogéneas —alguna acción más larga
 * que los presupuestos pequeños—, conceptos retirados, sin atribución, excluidos por estado de
 * fuente, con mapeo incompleto, con patrón activo y con estados mezclados, incluidos `EXPOSED`
 * posteriores en el temario (el caso raro de P4-D4). Sirve para validación **estructural**; no
 * simula el corpus oficial.
 */

const STATES: MasteryState[] = [
  'NEW',
  'EXPOSED',
  'EVIDENCE_POSITIVE',
  'EVIDENCE_NEGATIVE',
  'EVIDENCE_CONFLICTING',
];

function corpus(size: number, seed: number): PlannerConcept[] {
  const random = rng(seed);
  const perTopic = Math.ceil(size / 8);
  let position = 0;
  return Array.from({ length: size }, (_, i) => {
    const topic = Math.floor(i / perTopic);
    const block = topic < 3 ? 1 : topic < 6 ? 2 : 3;
    const state = STATES[Math.floor(random() * STATES.length)]!;
    const remediation = state === 'EVIDENCE_NEGATIVE' || state === 'EVIDENCE_CONFLICTING';
    position += 1 + Math.floor(random() * 7);
    const kind = random();
    const units = kind < 0.08 ? 0 : 1 + Math.floor(random() * 2);
    const questions = kind > 0.9 ? 0 : Math.floor(random() * 4);
    const id = `fixture-c-${String(i).padStart(3, '0')}`;
    return {
      conceptId: id,
      conceptStatus: random() < 0.05 ? 'RETIRED' : 'PUBLISHED',
      syllabus: {
        blockSortOrder: block,
        topicSortOrder: (topic % 3) + 1,
        conceptSortOrder: (i % perTopic) + 1,
        conceptKey: `fixture-k-${String(i).padStart(3, '0')}`,
      },
      masteryState: state,
      uncertainty: state === 'NEW' || state === 'EXPOSED' ? 'NO_EVIDENCE' : 'MULTIPLE_QUESTIONS',
      activeErrorPattern: remediation && random() < 0.3,
      lastNegativePosition: remediation ? position : null,
      completedToday: random() < 0.07,
      units: Array.from({ length: units }, (_, u) => ({
        learningUnitId: `${id}-u${u}`,
        learningUnitVersionId: `${id}-uv${u}`,
        sourceExcluded: random() < 0.05,
        minutes: 2 + Math.floor(random() * 14),
      })),
      questions: Array.from({ length: questions }, (_, q) => ({
        questionId: `${id}-q${q}`,
        representationId: `${id}-r${q}`,
        sourceExcluded: random() < 0.05,
        answeredToday: random() < 0.1,
        minutes: 1 + Math.floor(random() * 6),
      })),
    };
  });
}

describe('corpus sintético · 40 y 100 conceptos · barrido de presupuesto', () => {
  for (const size of [40, 100]) {
    for (const seed of [3, 11, 29]) {
      it(`${size} conceptos · semilla ${seed} · invariantes estructurales en 0–120 minutos`, () => {
        const concepts = corpus(size, seed);
        const seen = new Set<string>();
        for (let budget = 0; budget <= 120; budget += 1) {
          const decision = plan(input(concepts, budget));
          // Nunca por encima del presupuesto; nunca un positivo; ningún candidato perdido.
          expect(decision.plannedMinutes).toBeLessThanOrEqual(budget);
          expect(decision.candidates).toHaveLength(size);
          const byId = new Map(concepts.map((c) => [c.conceptId, c]));
          for (const action of decision.actions) {
            expect(byId.get(action.conceptId)?.masteryState).not.toBe('EVIDENCE_POSITIVE');
          }
          // Como mucho una garantía, y siempre en la cabeza.
          const guarantees = decision.actions.filter((a) => a.reason === 'REMEDIATION_GUARANTEE');
          expect(guarantees.length).toBeLessThanOrEqual(1);
          if (guarantees.length === 1)
            expect(decision.actions[0]?.reason).toBe('REMEDIATION_GUARANTEE');
          // El desbordamiento solo llega cuando ninguna continuidad elegible quedó sin colocar
          // por algo distinto del presupuesto.
          const overflowAt = decision.actions.findIndex((a) => a.reason === 'REMEDIATION_OVERFLOW');
          if (overflowAt >= 0) {
            expect(decision.actions.slice(overflowAt).every((a) => a.reason !== 'COVERAGE')).toBe(
              true,
            );
          }
          // Todo candidato no colocado tiene una razón del enum cerrado.
          for (const candidate of decision.candidates) {
            if (candidate.placedOrdinal === null) {
              expect(EXCLUSION_REASONS).toContain(candidate.exclusion);
            } else {
              expect(candidate.exclusion).toBeNull();
            }
          }
          seen.add(decision.outcome);
          for (const c of decision.candidates) if (c.exclusion) seen.add(c.exclusion);
        }
        // El barrido ejercita de verdad los desenlaces y las exclusiones del corpus.
        expect(seen).toContain('ZERO_TIME');
        expect(seen).toContain('PLANNED');
        expect(seen).toContain('OVER_BUDGET');
        expect(seen).toContain('POSITIVE_NO_REVIEW_POLICY');
      });
    }
  }

  it('P4-D4 · un EXPOSED posterior en el temario va antes que un NEW anterior', () => {
    const concepts = corpus(40, 7).map((c, i) => ({
      ...c,
      conceptStatus: 'PUBLISHED' as const,
      completedToday: false,
      masteryState: (i === 39 ? 'EXPOSED' : i === 0 ? 'NEW' : 'EVIDENCE_POSITIVE') as MasteryState,
      activeErrorPattern: false,
      lastNegativePosition: null,
      units: [
        {
          learningUnitId: `u${i}`,
          learningUnitVersionId: `uv${i}`,
          sourceExcluded: false,
          minutes: 3,
        },
      ],
      questions: [
        {
          questionId: `q${i}`,
          representationId: `r${i}`,
          sourceExcluded: false,
          answeredToday: false,
          minutes: 2,
        },
      ],
    }));
    const decision = plan(input(concepts, 60));
    expect(decision.actions.map((a) => a.conceptId)).toEqual([
      concepts[39]!.conceptId,
      concepts[0]!.conceptId,
    ]);
  });

  it('la salida del corpus completo no contiene vocabulario de readiness ni porcentajes', () => {
    const text = canonicalDecision(plan(input(corpus(100, 5), 90)));
    expect(text).not.toMatch(
      /percent|ratio|score|weight|ready|readiness|probab|risk|weak|mastered/i,
    );
  });
});
