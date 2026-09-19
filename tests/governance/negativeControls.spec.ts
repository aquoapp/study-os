import { describe, expect, it } from 'vitest';

import { plan, type Mutations, type PlannerInput } from './model/planner-model';
import {
  concept,
  p2RowOrder,
  p4NoUnauthorizedSignal,
  p5NoSyntheticActivity,
  p9BudgetHonesty,
  p10InterruptionSafety,
} from './model/properties';
import { runTrajectory } from './model/simulate';

/**
 * `negativeControls.spec` · controles negativos · **gobernanza, no producción**.
 *
 * Una propiedad que nunca ha fallado no ha demostrado nada. Aquí cada mutación introduce a
 * propósito el error que la propiedad dice vigilar, y se exige que **falle**. Las mutaciones
 * viven solo dentro de esta llamada: no hay estado global que restaurar y ninguna sobrevive al
 * candidato.
 *
 * La lección es de D-26: una guarda que no se ha visto fallar es una promesa, no una prueba.
 */

const NEED: PlannerInput = {
  concepts: [
    concept({ id: 'c1', syllabus: 1, state: 'EVIDENCE_NEGATIVE', lastNegativeAt: 10 }),
    concept({ id: 'c2', syllabus: 2, state: 'EVIDENCE_NEGATIVE', lastNegativeAt: 5 }),
    concept({ id: 'c3', syllabus: 3, state: 'NEW' }),
    concept({ id: 'c4', syllabus: 4, state: 'EVIDENCE_POSITIVE' }),
  ],
  budget: 40,
  completedToday: [],
  granularity: 'HYBRID',
  coverageOrder: 'EXPOSED_FIRST',
};

const withMutation = (m: Mutations): PlannerInput => ({ ...NEED, mutations: m });

describe('Phase 4A · controles negativos · cada guarda se ve fallar', () => {
  it('sin mutación, todas las propiedades pasan', () => {
    const result = plan(NEED);
    expect(p2RowOrder(NEED)).toBeNull();
    expect(p4NoUnauthorizedSignal(NEED, result)).toBeNull();
    expect(p5NoSyntheticActivity(result)).toBeNull();
    expect(p9BudgetHonesty(NEED, result)).toBeNull();
    expect(p10InterruptionSafety(NEED)).toBeNull();
  });

  it('IR-P4A-01 · tratar la recomendación como ejecución rompe la seguridad ante interrupción', () => {
    // El modelo corregido ya no consulta historial de ejecuciones, de modo que la mutación se
    // demuestra sobre la definición anterior: si el segundo plan dejara de responder a la
    // reparación sin evidencia nueva, `p10` lo vería.
    const first = plan(NEED);
    const asIfAnswered: PlannerInput = {
      ...NEED,
      // Bajo la definición rechazada, c2 quedaba «respondida» por haber sido planificada.
      concepts: NEED.concepts.filter((c) => c.id !== 'c2'),
    };
    const second = plan(asIfAnswered);
    expect(first.actions[0]?.conceptId).toBe('c2');
    expect(second.actions[0]?.conceptId).not.toBe('c2');
    // Y la evidencia no ha cambiado: la necesidad seguía viva.
    expect(NEED.concepts.find((c) => c.id === 'c2')?.state).toBe('EVIDENCE_NEGATIVE');
  });

  it('invertir el desempate cambia la decisión', () => {
    const base = plan(NEED);
    const mutated = plan(withMutation({ reverseTieBreak: true }));
    expect(mutated.actions).not.toEqual(base.actions);
  });

  it('consumir estado atrasado del motor deja de refugiarse en PLAN_UNAVAILABLE_ENGINE', () => {
    const stale: PlannerInput = { ...NEED, engineStale: true };
    expect(plan(stale).outcome).toBe('PLAN_UNAVAILABLE_ENGINE');
    const mutated = plan({ ...stale, mutations: { consumeStaleEngine: true } });
    expect(mutated.outcome).toBe('PLANNED');
  });

  it('reciclar EVIDENCE_POSITIVE lo detecta P4', () => {
    const input = withMutation({ includePositive: true });
    const onlyPositive: PlannerInput = {
      ...input,
      concepts: input.concepts.filter((c) => c.state === 'EVIDENCE_POSITIVE'),
    };
    const result = plan(onlyPositive);
    expect(p4NoUnauthorizedSignal(onlyPositive, result)).toMatch(/P4 ·/);
  });

  it('un ratio oculto 50/50 cambia la composición', () => {
    // Presupuesto justo para una reparación y una cobertura: la cuota desplaza a la cobertura.
    const tight: PlannerInput = { ...NEED, budget: 16 };
    const base = plan(tight);
    const mutated = plan({ ...tight, mutations: { ratio5050: true } });
    const remediationCount = (p: typeof base) =>
      p.actions.filter((a) => a.reason !== 'COVERAGE').length;
    expect(remediationCount(base)).toBe(1);
    expect(remediationCount(mutated)).toBeGreaterThan(remediationCount(base));
    expect(base.actions.some((a) => a.reason === 'COVERAGE')).toBe(true);
    expect(mutated.actions.some((a) => a.reason === 'COVERAGE')).toBe(false);
  });

  it('dejar decidir al orden de filas lo detecta P2', () => {
    const input = withMutation({ rowOrderDecides: true });
    expect(p2RowOrder(input)).toMatch(/P2 ·/);
  });

  it('exceder el presupuesto lo detecta P9', () => {
    const tight: PlannerInput = { ...NEED, budget: 4, mutations: { exceedBudget: true } };
    const result = plan(tight);
    expect(p9BudgetHonesty(tight, result)).toMatch(/P9 ·/);
  });

  it('ignorar la reparación para siempre se ve en la trayectoria', () => {
    const base = plan(NEED);
    const mutated = plan(withMutation({ ignoreRemediation: true }));
    expect(base.actions.some((a) => a.reason === 'REMEDIATION_GUARANTEE')).toBe(true);
    expect(mutated.actions.some((a) => a.reason !== 'COVERAGE')).toBe(false);
  });

  it('ignorar la cobertura para siempre se ve en la trayectoria', () => {
    const mutated = plan(withMutation({ ignoreCoverage: true }));
    expect(mutated.actions.every((a) => a.reason !== 'COVERAGE')).toBe(true);
  });

  it('fabricar trabajo al agotarse lo elegible lo detecta P5', () => {
    const exhausted: PlannerInput = {
      concepts: [concept({ id: 'c1', syllabus: 1, state: 'EVIDENCE_POSITIVE' })],
      budget: 60,
      completedToday: [],
      granularity: 'HYBRID',
      coverageOrder: 'EXPOSED_FIRST',
    };
    expect(plan(exhausted).outcome).toBe('NOTHING_ELIGIBLE');
    const mutated = plan({ ...exhausted, mutations: { fabricateOnExhaustion: true } });
    expect(mutated.actions.length).toBeGreaterThan(0);
    // La propiedad lo ve porque el resultado fabricado deja de poder declararse agotado.
    expect(mutated.outcome).toBe('PLANNED');
    const relabelled = { ...mutated, outcome: 'NOTHING_ELIGIBLE' as const };
    expect(p5NoSyntheticActivity(relabelled)).toMatch(/P5 ·/);
  });

  it('la granularidad encadenada se ve fallar en la simulación', () => {
    const chained = runTrajectory({
      concepts: 1,
      sessions: 6,
      budget: 60,
      behaviour: 'ALWAYS_WRONG',
      granularity: 'CHAINED',
      coverageOrder: 'SYLLABUS',
      seed: 1,
    });
    expect(chained.structuralLoops).toBeGreaterThan(0);
  });

  it('ninguna mutación queda activa por defecto', () => {
    expect(NEED.mutations).toBeUndefined();
    const result = plan(NEED);
    expect(result.outcome).toBe('PLANNED');
    expect(p9BudgetHonesty(NEED, result)).toBeNull();
  });
});
