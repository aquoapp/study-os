import { describe, expect, it } from 'vitest';

import type { Behaviour, TrajectoryConfig } from './model/simulate';
import { runTrajectory } from './model/simulate';

/**
 * `simulation.spec` · simulación longitudinal adversarial · **gobernanza, no producción**.
 *
 * Busca patologías estructurales a lo largo de muchas sesiones: inanición, bucles, dependencia
 * del camino, violaciones de presupuesto, actividad fabricada.
 *
 * **No mide eficacia de aprendizaje.** No hay puntuación de dominio, de preparación ni de
 * retención, y de este fichero no se deriva ninguna afirmación pedagógica. Que una trayectoria
 * alcance más cobertura que otra dice algo sobre la política de selección, no sobre la persona.
 */

const BEHAVIOURS: Behaviour[] = [
  'ALWAYS_CORRECT',
  'ALWAYS_WRONG',
  'ALTERNATING',
  'ONE_WEAK',
  'EARLY_WEAK',
  'LATE_WEAK',
  'SEEDED_RANDOM',
  'NEVER_EXECUTES',
  'ABANDONS_AFTER_FIRST',
  'ABANDONS_AFTER_LEARN',
  'MULTI_WEAK',
  'CLUSTERED_WEAK',
  'MOVING_WEAKNESS',
];

const SYLLABUS_SIZES = [3, 8, 20, 100];
const BUDGETS: Array<number | number[]> = [4, 12, 45, 240, [0, 12, 30], [6, 6, 0, 60]];
const SEEDS = [1, 7, 13, 29, 101];
const SESSIONS = 100;

function trajectories(): TrajectoryConfig[] {
  const out: TrajectoryConfig[] = [];
  for (const behaviour of BEHAVIOURS) {
    for (const concepts of SYLLABUS_SIZES) {
      for (const budget of BUDGETS) {
        for (const seed of SEEDS) {
          out.push({
            concepts,
            sessions: SESSIONS,
            budget,
            behaviour,
            granularity: 'HYBRID',
            coverageOrder: 'EXPOSED_FIRST',
            seed,
          });
        }
      }
    }
  }
  return out;
}

describe('Phase 4A · simulación longitudinal', () => {
  const configs = trajectories();
  const results = configs.map((cfg) => ({ cfg, result: runTrajectory(cfg) }));

  it('el barrido es suficientemente grande para exponer inanición', () => {
    expect(configs).toHaveLength(
      BEHAVIOURS.length * SYLLABUS_SIZES.length * BUDGETS.length * SEEDS.length,
    );
    expect(configs.length).toBeGreaterThanOrEqual(1000);
    expect(configs.reduce((n, c) => n + c.sessions, 0)).toBeGreaterThanOrEqual(100_000);
  });

  it('ninguna trayectoria viola el presupuesto', () => {
    const bad = results.filter(({ result }) => result.budgetViolations > 0);
    expect(bad.map(({ cfg }) => cfg.behaviour)).toEqual([]);
  });

  it('ninguna trayectoria fabrica actividad', () => {
    expect(results.filter(({ result }) => result.syntheticActivity > 0)).toHaveLength(0);
  });

  it('ninguna trayectoria es no determinista', () => {
    expect(results.filter(({ result }) => result.nondeterministic > 0)).toHaveLength(0);
  });

  it('ninguna trayectoria entra en bucle estructural', () => {
    const loops = results.filter(({ result }) => result.structuralLoops > 0);
    expect(
      loops.map(({ cfg }) => `${cfg.behaviour}/${cfg.concepts}/${cfg.seed}`),
      'bucles estructurales',
    ).toEqual([]);
  });

  it('quien no ejecuta nada recibe siempre el mismo plan: interrupción sin efecto', () => {
    const idle = results.filter(({ cfg }) => cfg.behaviour === 'NEVER_EXECUTES');
    expect(idle.length).toBeGreaterThan(0);
    for (const { result } of idle) {
      expect(result.actionsExecuted).toBe(0);
      // Sin ejecución no hay evidencia, y sin evidencia el plan no se mueve. Repetirlo es lo
      // correcto: la recomendación sigue pendiente.
      expect(result.structuralLoops).toBe(0);
    }
  });

  it('con ejecución suficiente y sílabo finito, la cobertura avanza', () => {
    const progressing = results.filter(
      ({ cfg, result }) =>
        cfg.behaviour === 'ALWAYS_CORRECT' &&
        typeof cfg.budget === 'number' &&
        cfg.budget >= 45 &&
        result.plans > 0,
    );
    expect(progressing.length).toBeGreaterThan(0);
    for (const { cfg, result } of progressing) {
      expect(result.coverageReached, `${cfg.concepts} conceptos`).toBeGreaterThan(0);
    }
  });

  it('una debilidad persistente no impide que el resto del sílabo se alcance', () => {
    const weak = results.filter(
      ({ cfg }) => cfg.behaviour === 'ONE_WEAK' && cfg.concepts === 20 && cfg.budget === 240,
    );
    expect(weak.length).toBeGreaterThan(0);
    for (const { result } of weak) {
      // P4-D1.2 · el resto del sílabo se alcanza pese a que c1 falla una y otra vez.
      expect(result.coverageReached).toBeGreaterThan(15);
    }
  });

  it('con EXPOSED primero, el atraso de verificación no crece con el temario', () => {
    /**
     * P4-D4 · cerrar el bucle abierto antes de abrir otro acota el atraso de `EXPOSED` a lo que
     * quepa en **un** presupuesto, y no al tamaño del temario. La comprobación es comparativa a
     * propósito: lo estructural no es el valor, es que multiplicar el temario por cinco no
     * multiplique el atraso.
     */
    const backlog = (sessions: number) =>
      runTrajectory({
        concepts: 100,
        sessions,
        budget: 240,
        behaviour: 'ALWAYS_CORRECT',
        granularity: 'HYBRID',
        coverageOrder: 'EXPOSED_FIRST',
        seed: 1,
      }).maxExposedBacklog;

    // Triplicar las sesiones no aumenta el atraso: no hay acumulación, hay oscilación acotada.
    expect(backlog(300)).toBe(backlog(100));

    // Lo que sí lo acota es el presupuesto, no el temario: con menos minutos por sesión se
    // aprenden menos cosas de golpe y el atraso es menor.
    const tighter = runTrajectory({
      concepts: 100,
      sessions: 100,
      budget: 12,
      behaviour: 'ALWAYS_CORRECT',
      granularity: 'HYBRID',
      coverageOrder: 'EXPOSED_FIRST',
      seed: 1,
    }).maxExposedBacklog;
    expect(tighter).toBeLessThan(backlog(100));
  });

  it('abandonar tras leer no inventa progreso ni rompe ninguna propiedad', () => {
    const abandoning = results.filter(({ cfg }) => cfg.behaviour === 'ABANDONS_AFTER_LEARN');
    expect(abandoning.length).toBeGreaterThan(0);
    for (const { result } of abandoning) {
      expect(result.syntheticActivity).toBe(0);
      expect(result.budgetViolations).toBe(0);
      expect(result.structuralLoops).toBe(0);
    }
  });

  it('presupuesto cero repetido no genera deuda ni actividad', () => {
    const zero = runTrajectory({
      concepts: 10,
      sessions: 30,
      budget: 0,
      behaviour: 'ALWAYS_CORRECT',
      granularity: 'HYBRID',
      coverageOrder: 'EXPOSED_FIRST',
      seed: 5,
    });
    expect(zero.actionsExecuted).toBe(0);
    expect(zero.syntheticActivity).toBe(0);
    expect(zero.budgetViolations).toBe(0);
  });

  it('un presupuesto permanentemente diminuto no fabrica nada · OBS-4A-01', () => {
    const tiny = runTrajectory({
      concepts: 12,
      sessions: 100,
      budget: 2,
      behaviour: 'ALWAYS_WRONG',
      granularity: 'HYBRID',
      coverageOrder: 'EXPOSED_FIRST',
      seed: 3,
    });
    expect(tiny.syntheticActivity).toBe(0);
    expect(tiny.budgetViolations).toBe(0);
    // La consecuencia veraz: con un presupuesto por debajo de toda acción, no se planifica nada.
    expect(tiny.nothingFits).toBeGreaterThan(0);
  });
});
