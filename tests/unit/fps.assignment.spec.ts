import { describe, expect, it } from 'vitest';

import {
  deriveFpsStep,
  FPS_ASSIGNMENT_STRATEGY,
  FPS_SESSION_TYPE,
  fpsPathForStep,
  selectFixedSessionItems,
  type FpsEventView,
  type FpsItemView,
} from '@study-os/domain';

/**
 * `fps.assignment.spec` · gates FPS-G3 y FPS-G6 · las dos reglas puras del vertical.
 *
 * La asignación y la derivación del paso son funciones puras a propósito: son las dos
 * decisiones que más fácilmente se convertirían en «lo que haga la interfaz», y separarlas
 * permite comprobarlas sin navegador, sin base de datos y sin ambigüedad.
 */

describe('fps-fixed-v1 · asignación determinista', () => {
  const units: Array<{ id: string; conceptKey: string }> = [
    { id: 'u-b', conceptKey: 'concepto-2' },
    { id: 'u-a', conceptKey: 'concepto-1' },
    { id: 'u-c', conceptKey: 'concepto-1' },
  ];
  const questions = [{ id: 'q-3' }, { id: 'q-1' }, { id: 'q-2' }];

  it('primero las unidades, después las preguntas', () => {
    const items = selectFixedSessionItems(units, questions);
    expect(items.map((item) => item.item_type)).toEqual([
      'LEARNING_UNIT',
      'LEARNING_UNIT',
      'LEARNING_UNIT',
      'QUESTION',
      'QUESTION',
      'QUESTION',
    ]);
  });

  it('el orden es reproducible y no depende del orden de entrada', () => {
    const once = selectFixedSessionItems(units, questions);
    const shuffled = selectFixedSessionItems([...units].reverse(), [...questions].reverse());
    expect(shuffled).toEqual(once);
    expect(once.map((item) => item.target_id)).toEqual(['u-a', 'u-c', 'u-b', 'q-1', 'q-2', 'q-3']);
  });

  it('sin contenido publicado no hay sesión que crear', () => {
    expect(selectFixedSessionItems([], [])).toEqual([]);
  });

  it('el marcador persistido cabe en la restricción de la columna', () => {
    expect(FPS_SESSION_TYPE).toBe('FPS_FIXED');
    expect(FPS_SESSION_TYPE).toMatch(/^[A-Z_]{2,40}$/);
    // El literal del algoritmo NO cabe ahí, y por eso no se persiste en ninguna columna.
    expect(FPS_ASSIGNMENT_STRATEGY).toBe('fps-fixed-v1');
    expect(FPS_ASSIGNMENT_STRATEGY).not.toMatch(/^[A-Z_]{2,40}$/);
  });
});

describe('derivación del paso · la corrección pendiente precede al cursor', () => {
  const items: FpsItemView[] = [
    { id: 'i1', item_type: 'LEARNING_UNIT', sort_order: 1, status: 'COMPLETED' },
    { id: 'i2', item_type: 'QUESTION', sort_order: 2, status: 'COMPLETED' },
    { id: 'i3', item_type: 'QUESTION', sort_order: 3, status: 'PENDING' },
  ];

  it('sin evidencia, el paso es el primer ítem no completado', () => {
    const step = deriveFpsStep(
      'ACTIVE',
      [{ id: 'i1', item_type: 'LEARNING_UNIT', sort_order: 1, status: 'PENDING' }],
      [],
    );
    expect(step).toEqual({ kind: 'learn', ordinal: 1, itemId: 'i1' });
  });

  it('un envío sin corrección vista gana al cursor, aunque el ítem esté completado', () => {
    const events: FpsEventView[] = [
      { event_type: 'QUESTION_PRESENTED', session_item_id: 'i2' },
      { event_type: 'ANSWER_SUBMITTED', session_item_id: 'i2' },
    ];
    const step = deriveFpsStep('ACTIVE', items, events);
    expect(step).toEqual({ kind: 'feedback', ordinal: 2, itemId: 'i2' });
  });

  it('una vez vista la corrección, el paso avanza al siguiente ítem', () => {
    const events: FpsEventView[] = [
      { event_type: 'ANSWER_SUBMITTED', session_item_id: 'i2' },
      { event_type: 'FEEDBACK_VIEWED', session_item_id: 'i2' },
    ];
    const step = deriveFpsStep('ACTIVE', items, events);
    expect(step).toEqual({ kind: 'check', ordinal: 3, itemId: 'i3' });
  });

  it('con todo completado y visto, la sesión está lista para terminar', () => {
    const done: FpsItemView[] = items.map((item) => ({ ...item, status: 'COMPLETED' }));
    const events: FpsEventView[] = [
      { event_type: 'ANSWER_SUBMITTED', session_item_id: 'i2' },
      { event_type: 'FEEDBACK_VIEWED', session_item_id: 'i2' },
      { event_type: 'ANSWER_SUBMITTED', session_item_id: 'i3' },
      { event_type: 'FEEDBACK_VIEWED', session_item_id: 'i3' },
    ];
    expect(deriveFpsStep('ACTIVE', done, events)).toEqual({ kind: 'end' });
  });

  it('una sesión terminal nunca reanuda', () => {
    const events: FpsEventView[] = [{ event_type: 'ANSWER_SUBMITTED', session_item_id: 'i2' }];
    expect(deriveFpsStep('COMPLETED', items, events)).toEqual({ kind: 'end' });
    expect(deriveFpsStep('ABANDONED', items, events)).toEqual({ kind: 'end' });
  });

  it('el orden de los ítems lo fija `sort_order`, no el orden de la consulta', () => {
    const step = deriveFpsStep('ACTIVE', [...items].reverse(), []);
    expect(step).toEqual({ kind: 'check', ordinal: 3, itemId: 'i3' });
  });

  it('cada paso tiene una única ruta, y FEEDBACK comparte la de COMPROBAR', () => {
    expect(fpsPathForStep({ kind: 'learn', ordinal: 1, itemId: 'i1' })).toBe('/aprender/1');
    expect(fpsPathForStep({ kind: 'check', ordinal: 4, itemId: 'i4' })).toBe('/comprobar/4');
    expect(fpsPathForStep({ kind: 'feedback', ordinal: 4, itemId: 'i4' })).toBe('/comprobar/4');
    expect(fpsPathForStep({ kind: 'end' })).toBe('/fin');
  });

  it('ninguna ruta del vertical lleva un identificador', () => {
    for (const ordinal of [1, 2, 3]) {
      for (const kind of ['learn', 'check', 'feedback'] as const) {
        const path = fpsPathForStep({
          kind,
          ordinal,
          itemId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        });
        expect(path).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
      }
    }
  });
});
