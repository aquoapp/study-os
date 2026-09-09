import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONFIDENCE_SCALE_V1 } from '@study-os/domain';

import {
  buildSyntheticPack,
  purgePack,
  question,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  eventFor,
  itemAt,
  itemEvent,
  optionsOf,
  reject,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { attack, one, query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * Confianza y respuesta en blanco · SD-008 (BD-03) · INV-102 · REQ-C08 · SD-003 ·
 * Knowledge Engine (respuesta en blanco) · gate P2-G3.
 *
 * Confianza: cuatro niveles, versión `v1` persistida con cada intento, valor validado contra
 * la escala **activa**, y capturada **antes** del feedback (INV-102). La escala es un
 * registro inmutable: cambiarla es publicar otra versión, porque la calibración acumulada
 * depende de la escala con la que se recogió.
 *
 * Blanco: `selected_option_id NULL` es un intento **válido** y su verdad se conserva. Phase 2
 * lo guarda como evidencia y no lo puntúa: la política de puntuación es BD-06 y vive en
 * Phase 6. Un blanco no es lo mismo que un envío malformado, y se distinguen.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;

async function questionSession(index = 0): Promise<{ session: CreatedSession; rep: string }> {
  const q = question(pack, index);
  const session = await createSession(ana, [{ item_type: 'QUESTION', target_id: q.questionId }]);
  await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
  await accept(
    ana,
    itemEvent(ana, session, itemAt(session, 0), 'QUESTION_PRESENTED', {
      question_representation_id: q.representationId,
    }),
  );
  return { session, rep: q.representationId };
}

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2conf');
  ana = await createLearner(env, 'conf', pack);
}, 300_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('SD-008 · la escala de confianza v1 es la aceptada y es inmutable', () => {
  it('hay exactamente una escala ACTIVE, con cuatro niveles y las etiquetas canónicas', () => {
    const scales = query<{ version: string; levels: number; labels: string[]; status: string }>(
      'select version, levels, labels, status from public.confidence_scales order by version',
    );
    expect(scales).toHaveLength(1);
    const [scale] = scales;
    expect(scale?.version).toBe('v1');
    expect(Number(scale?.levels)).toBe(4);
    expect(scale?.labels).toEqual(['Nada segura', 'Dudosa', 'Bastante', 'Segura']);
    expect(scale?.status).toBe('ACTIVE');
    // Y el contrato del dominio dice exactamente lo mismo (D-06: listas espejo probadas).
    expect(scale?.labels).toEqual([...CONFIDENCE_SCALE_V1.labels]);
    expect(Number(scale?.levels)).toBe(CONFIDENCE_SCALE_V1.levels);
  });

  it('una escala publicada no se edita ni se borra: se publica otra versión', () => {
    const edited = attack(
      'update public.confidence_scales set labels = \'["a","b","c","d"]\'::jsonb where version = \'v1\';',
    );
    expect(edited.rejected, edited.message).toBe(true);
    expect(edited.message).toContain('SD-008');
    const relabelled = attack(
      "update public.confidence_scales set levels = 5 where version = 'v1';",
    );
    expect(relabelled.rejected, relabelled.message).toBe(true);
    const removed = attack("delete from public.confidence_scales where version = 'v1';");
    expect(removed.rejected, removed.message).toBe(true);
    const twoActive = attack(
      'insert into public.confidence_scales (version, levels, labels, status) values (\'v2\', 4, \'["a","b","c","d"]\'::jsonb, \'ACTIVE\');',
    );
    expect(twoActive.rejected, twoActive.message).toBe(true);
  });

  it('el aprendiz puede leer la escala: la necesita para pintar las cuatro opciones', async () => {
    const { data, error } = await ana.client
      .from('confidence_scales')
      .select('version, levels, labels');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect((data?.[0] as { labels: string[] }).labels).toHaveLength(4);
  });
});

describe('SD-008 · el intento persiste valor y versión de escala, y rechaza lo que no es de la escala', () => {
  for (const value of [1, 2, 3, 4]) {
    it(`acepta el nivel ${value} y lo persiste con su versión`, async () => {
      const { session, rep } = await questionSession(value % 3);
      const options = await optionsOf(ana, rep);
      const answered = await accept(
        ana,
        itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
          question_representation_id: rep,
          answer_kind: 'OPTION',
          selected_option_id: options[0]?.id,
          confidence_value: value,
          confidence_scale_version: 'v1',
        }),
      );
      const row = one<{ confidence_value: number; confidence_scale_version: string }>(
        `select confidence_value, confidence_scale_version from public.question_attempts where submitted_event_id = '${answered.event_id}'`,
      );
      expect(Number(row.confidence_value)).toBe(value);
      expect(row.confidence_scale_version).toBe('v1');
    });
  }

  const invalid: Array<[string, unknown, string]> = [
    ['cero', 0, 'CONFIDENCE_OUT_OF_RANGE'],
    ['cinco (fuera de una escala de cuatro)', 5, 'CONFIDENCE_OUT_OF_RANGE'],
    ['negativo', -1, 'CONFIDENCE_OUT_OF_RANGE'],
  ];

  for (const [nombre, value, code] of invalid) {
    it(`rechaza el nivel ${nombre}`, async () => {
      const { session, rep } = await questionSession();
      const options = await optionsOf(ana, rep);
      await reject(
        ana,
        itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
          question_representation_id: rep,
          answer_kind: 'OPTION',
          selected_option_id: options[0]?.id,
          confidence_value: value,
          confidence_scale_version: 'v1',
        }),
        code,
      );
    });
  }

  it('rechaza una versión de escala inexistente o no activa', async () => {
    const { session, rep } = await questionSession();
    const options = await optionsOf(ana, rep);
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: rep,
        answer_kind: 'OPTION',
        selected_option_id: options[0]?.id,
        confidence_value: 3,
        confidence_scale_version: 'v99',
      }),
      'CONFIDENCE_SCALE_INACTIVE',
    );
  });

  it('una respuesta con opción exige confianza: sin ella no hay calibración posible', async () => {
    const { session, rep } = await questionSession();
    const options = await optionsOf(ana, rep);
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: rep,
        answer_kind: 'OPTION',
        selected_option_id: options[0]?.id,
      }),
      'CONFIDENCE_REQUIRED',
    );
  });

  it('CONFIDENCE_RECORDED valida contra la misma escala', async () => {
    const { session, rep } = await questionSession();
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'CONFIDENCE_RECORDED', {
        confidence_value: 7,
        confidence_scale_version: 'v1',
      }),
      'CONFIDENCE_OUT_OF_RANGE',
    );
    const ok = await accept(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'CONFIDENCE_RECORDED', {
        confidence_value: 2,
        confidence_scale_version: 'v1',
      }),
    );
    expect(ok.idempotent).toBe(false);
    expect(rep).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un valor fuera de escala tampoco entra por la base (defensa en profundidad)', () => {
    const outcome = attack(
      `insert into public.question_attempts (user_id, question_id, question_representation_id, answer_key_version_id, session_id, session_item_id, submitted_event_id, answer_kind, is_correct_at_submission, confidence_value, confidence_scale_version, attempt_number, answer_payload_hash, canonicalization_version, submitted_at)
       select a.user_id, a.question_id, a.question_representation_id, a.answer_key_version_id, a.session_id, a.session_item_id, gen_random_uuid(), 'OPTION', false, 42, 'v1', 999, a.answer_payload_hash, 'v1', now() from public.question_attempts a limit 1;`,
    );
    expect(outcome.rejected, outcome.message).toBe(true);
  });
});

describe('INV-102 · la confianza se captura antes del feedback', () => {
  it('FEEDBACK_VIEWED antes de que exista intento se rechaza', async () => {
    const { session } = await questionSession();
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'FEEDBACK_VIEWED'),
      'FEEDBACK_BEFORE_ATTEMPT',
    );
  });

  it('tras el envío con confianza, el feedback se acepta y el intento ya la lleva', async () => {
    const { session, rep } = await questionSession();
    const item = itemAt(session, 0);
    const options = await optionsOf(ana, rep);
    const answered = await accept(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: rep,
        answer_kind: 'OPTION',
        selected_option_id: options[0]?.id,
        confidence_value: 4,
        confidence_scale_version: 'v1',
      }),
    );
    expect(answered.attempt?.['confidence_value']).toBe(4);
    expect(answered.attempt?.['confidence_scale_version']).toBe('v1');
    const feedback = await accept(ana, itemEvent(ana, session, item, 'FEEDBACK_VIEWED'));
    expect(feedback.idempotent).toBe(false);
    // El orden queda en el stream: el envío precede al feedback.
    const order = query<{ event_type: string; stream_position: number }>(
      `select event_type, stream_position from public.learning_events where session_id = '${session.session_id}' and event_type in ('ANSWER_SUBMITTED','FEEDBACK_VIEWED') order by stream_position`,
    );
    expect(order.map((r) => r.event_type)).toEqual(['ANSWER_SUBMITTED', 'FEEDBACK_VIEWED']);
  });
});

describe('REQ-C08 · la respuesta en blanco es evidencia válida y no se puntúa', () => {
  it('un blanco crea intento con opción nula, sin corrección y sin exigir confianza', async () => {
    const { session, rep } = await questionSession(1);
    const answered = await accept(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: rep,
        answer_kind: 'BLANK',
      }),
    );
    const row = one<{
      selected_option_id: string | null;
      is_correct_at_submission: boolean;
      answer_kind: string;
      confidence_value: number | null;
      answer_key_version_id: string;
    }>(
      `select selected_option_id, is_correct_at_submission, answer_kind::text as answer_kind, confidence_value, answer_key_version_id from public.question_attempts where submitted_event_id = '${answered.event_id}'`,
    );
    expect(row.answer_kind).toBe('BLANK');
    expect(row.selected_option_id).toBeNull();
    expect(row.is_correct_at_submission).toBe(false);
    expect(row.confidence_value).toBeNull();
    // Aun en blanco, el intento conserva la versión de clave con la que se evaluó (EC-007).
    expect(row.answer_key_version_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un blanco con confianza declarada también se admite y la conserva', async () => {
    const { session, rep } = await questionSession(2);
    const answered = await accept(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: rep,
        answer_kind: 'BLANK',
        confidence_value: 1,
        confidence_scale_version: 'v1',
      }),
    );
    expect(answered.attempt?.['confidence_value']).toBe(1);
    expect(answered.attempt?.['is_correct']).toBe(false);
  });

  it('un blanco con opción elegida es contradictorio y se rechaza: blanco no es «malformado»', async () => {
    const { session, rep } = await questionSession();
    const options = await optionsOf(ana, rep);
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: rep,
        answer_kind: 'BLANK',
        selected_option_id: options[0]?.id,
      }),
      'BLANK_WITH_OPTION',
    );
  });

  it('una respuesta con opción declarada pero sin opción es malformada, y se distingue del blanco', async () => {
    const { session, rep } = await questionSession();
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: rep,
        answer_kind: 'OPTION',
      }),
      'OPTION_REQUIRED',
    );
  });

  it('un answer_kind desconocido se rechaza, no se interpreta como blanco', async () => {
    const { session, rep } = await questionSession();
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: rep,
        answer_kind: 'SKIPPED',
      }),
      'ANSWER_KIND_MALFORMED',
    );
  });

  it('Phase 2 no puntúa: ninguna columna de puntuación existe en la evidencia (BD-06 es de Phase 6)', () => {
    const scoring = query<{ table_name: string; column_name: string }>(
      "select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name in ('question_attempts','session_items','study_sessions') and column_name ~* '(score|puntua|points|grade_value|mark)'",
    );
    expect(scoring).toEqual([]);
    const policies = query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_name ~* 'scoring'",
    );
    expect(policies).toEqual([]);
  });
});
