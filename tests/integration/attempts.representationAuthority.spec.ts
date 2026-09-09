import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSyntheticPack,
  publish,
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
  send,
  type CreatedSession,
  type Learner,
} from '../support/phase2-fixtures';
import { one, query } from '../support/sql';
import {
  adminClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * Autoridad de representación y de tiempo · SD-023 (`ACCEPTED` 2026-09-09) · corrección
 * obligatoria §2 de la Phase 2 Build Authorization.
 *
 * ---------------------------------------------------------------------------
 * Qué prueba este fichero
 *
 * SD-023 declara siete suites de regresión. Se implementan como siete bloques `describe`
 * con los nombres declarados, compartiendo un único pack sintético: construir un pack por
 * fichero cuesta ~50 publicaciones a través de la frontera y no añade una sola aserción.
 * La agrupación es mecánica; la cobertura es la declarada.
 *
 * El contrato: `client_created_at` **nunca** elige representación ni versión de clave. La
 * cadena es ítem de sesión → `QUESTION_PRESENTED` con la representación exacta presentada →
 * `ANSWER_SUBMITTED` verificado por el servidor contra esa representación → clave resuelta
 * en servidor para esa representación → intento inmutable.
 *
 * El escenario central usa una pregunta con DOS representaciones: A (presentada) y B
 * (publicada después, que supersede a A). Un aprendiz que vio A debe seguir evaluándose
 * contra A y contra la clave de A, hoy y después de una enmienda.
 * ---------------------------------------------------------------------------
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;

/** Pregunta con dos representaciones: A presentada, B publicada después. */
let repA = '';
let keyA = '';
let repB = '';
let questionAB = '';
/** Pregunta publicada sin ninguna clave de respuesta. */
let questionSinClave = '';
let repSinClave = '';

const attemptOf = (eventId: string) =>
  one<{
    question_representation_id: string;
    answer_key_version_id: string;
    is_correct_at_submission: boolean;
    attempt_number: number;
    submitted_at: string;
    answer_payload_hash: string;
  }>(
    `select question_representation_id, answer_key_version_id, is_correct_at_submission, attempt_number, submitted_at, answer_payload_hash from public.question_attempts where submitted_event_id = '${eventId}'`,
  );

const positions = (userId: string) =>
  query<{ p: number }>(
    `select stream_position as p from public.learning_events where user_id = '${userId}' order by 1`,
  ).map((r) => Number(r.p));

/** Sesión nueva de una sola pregunta, ya ACTIVE. */
async function sessionFor(questionId: string): Promise<CreatedSession> {
  const created = await createSession(ana, [{ item_type: 'QUESTION', target_id: questionId }]);
  await accept(ana, eventFor(ana, created, 'SESSION_STARTED'));
  return created;
}

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2repauth');
  ana = await createLearner(env, 'repauth', pack);

  // Pregunta con dos representaciones. A es la que verá el aprendiz.
  questionAB = question(pack, 0).questionId;
  repA = question(pack, 0).representationId;
  keyA = question(pack, 0).keyId;

  // Pregunta publicada SIN clave: no es respondible (SD-023 §3d).
  const { targetId: qSinClave } = await publish(admin, 'question', {
    exam_pack_id: pack.packId,
    question_type: 'SINGLE_CHOICE',
  });
  questionSinClave = qSinClave;
  const { targetId: rSinClave } = await publish(admin, 'question_representation', {
    question_id: questionSinClave,
    stem: 'fixture: enunciado sin clave publicada',
    provenance_class: 'GENERATED',
    source_version_id: pack.sourceVersionId,
    options: [
      { option_key: 'A', body: 'fixture: opción A', sort_order: 1 },
      { option_key: 'B', body: 'fixture: opción B', sort_order: 2 },
    ],
  });
  repSinClave = rSinClave;
}, 300_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

// ---------------------------------------------------------------------------
describe('attempt.notPresented.rejected · una respuesta sin presentación previa se rechaza', () => {
  it('ANSWER_SUBMITTED sin QUESTION_PRESENTED aceptado para el ítem → NOT_PRESENTED, sin intento ni posición', async () => {
    const session = await sessionFor(questionAB);
    const before = positions(ana.id);
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: repA,
        answer_kind: 'BLANK',
      }),
      'NOT_PRESENTED',
    );
    expect(positions(ana.id)).toEqual(before);
    const attempts = one<{ n: number }>(
      `select count(*)::int as n from public.question_attempts where session_id = '${session.session_id}'`,
    );
    expect(Number(attempts.n)).toBe(0);
    // El ítem tampoco quedó marcado con representación presentada.
    const item = one<{ r: string | null }>(
      `select presented_representation_id as r from public.session_items where id = '${itemAt(session, 0).session_item_id}'`,
    );
    expect(item.r).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('attempt.noAnswerKey.rejected · una representación sin clave no es respondible', () => {
  it('QUESTION_PRESENTED sobre una representación sin clave → NO_ANSWER_KEY', async () => {
    const session = await sessionFor(questionSinClave);
    const before = positions(ana.id);
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'QUESTION_PRESENTED', {
        question_representation_id: repSinClave,
      }),
      'NO_ANSWER_KEY',
    );
    expect(positions(ana.id)).toEqual(before);
    // Y la respuesta tampoco pasa: nunca nace un intento sin answer_key_version_id (EC-007).
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'ANSWER_SUBMITTED', {
        question_representation_id: repSinClave,
        answer_kind: 'BLANK',
      }),
      'NOT_PRESENTED',
    );
    const nulls = one<{ n: number }>(
      'select count(*)::int as n from public.question_attempts where answer_key_version_id is null',
    );
    expect(Number(nulls.n)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('attempt.representationAuthority.mismatchRejected · solo vale la representación presentada', () => {
  it('otra representación, otra pregunta o una opción ajena se rechazan sin consumir posición', async () => {
    const session = await sessionFor(questionAB);
    const item = itemAt(session, 0);
    await accept(
      ana,
      itemEvent(ana, session, item, 'QUESTION_PRESENTED', { question_representation_id: repA }),
    );
    const before = positions(ana.id);

    // Representación de otra pregunta del mismo pack.
    const foreignRep = question(pack, 1).representationId;
    await reject(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: foreignRep,
        answer_kind: 'BLANK',
      }),
      'REPRESENTATION_MISMATCH',
    );

    // Opción que pertenece a otra representación.
    const foreignOption = one<{ id: string }>(
      `select id from public.question_options where representation_id = '${foreignRep}' limit 1`,
    );
    await reject(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: repA,
        answer_kind: 'OPTION',
        selected_option_id: foreignOption.id,
        confidence_value: 3,
        confidence_scale_version: 'v1',
      }),
      'OPTION_NOT_IN_REPRESENTATION',
    );

    // Un identificador inventado tampoco.
    await reject(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: '00000000-0000-4000-8000-000000000000',
        answer_kind: 'BLANK',
      }),
      'REPRESENTATION_MISMATCH',
    );

    expect(positions(ana.id)).toEqual(before);
    const attempts = one<{ n: number }>(
      `select count(*)::int as n from public.question_attempts where session_id = '${session.session_id}'`,
    );
    expect(Number(attempts.n)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('attempt.representationAuthority.presentedWins · una representación posterior no sustituye a la presentada', () => {
  let session: CreatedSession;
  let submittedEventId = '';

  it('A se presenta, B se publica después, y la respuesta se liga a A y a la clave de A', async () => {
    session = await sessionFor(questionAB);
    const item = itemAt(session, 0);
    await accept(
      ana,
      itemEvent(ana, session, item, 'QUESTION_PRESENTED', { question_representation_id: repA }),
    );

    // El contenido cambia: se publica una representación nueva que supersede a A (SD-021).
    const published = await publish(admin, 'question_representation', {
      question_id: questionAB,
      stem: 'fixture: enunciado corregido (representación B)',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
      options: [
        { option_key: 'A', body: 'fixture: opción A (B)', sort_order: 1 },
        { option_key: 'B', body: 'fixture: opción B (B)', sort_order: 2 },
        { option_key: 'C', body: 'fixture: opción C (B)', sort_order: 3 },
      ],
    });
    repB = published.targetId;
    const chain = one<{ a_superseded_by: string; b_status: string }>(
      `select (select superseded_by_representation_id from public.question_representations where id = '${repA}') as a_superseded_by, (select status::text from public.question_representations where id = '${repB}') as b_status`,
    );
    expect(chain.a_superseded_by).toBe(repB);
    expect(chain.b_status).toBe('PUBLISHED');

    // Invariante que descubre este escenario: B nace SIN clave propia. Sus opciones son
    // filas nuevas, así que la clave de A no la evalúa —eso sería exactamente el retroceso
    // a «la clave más reciente de la pregunta» que SD-023 §3 prohíbe—. Mientras B no tenga
    // su clave, B no es presentable (SD-023 §3d): una pregunta a medio corregir no se sirve.
    const otraSesion = await sessionFor(questionAB);
    await reject(
      ana,
      itemEvent(ana, otraSesion, itemAt(otraSesion, 0), 'QUESTION_PRESENTED', {
        question_representation_id: repB,
      }),
      'NO_ANSWER_KEY',
    );

    // La autoridad completa la corrección publicando la clave de B. Al hacerlo, la clave
    // vigente de la PREGUNTA pasa a ser la de B y la de A queda cerrada por fechas.
    const { targetId: keyB } = await publish(admin, 'answer_key_version', {
      question_id: questionAB,
      correct_option_key: 'C',
      key_status: 'FINAL',
      source_version_id: pack.sourceVersionId,
      effective_from: new Date().toISOString().slice(0, 10),
      explanation: 'fixture: clave de la representación B',
    });
    const bound = one<{ rep: string }>(
      `select representation_id as rep from content.answer_key_versions where id = '${keyB}'`,
    );
    expect(bound.rep).toBe(repB);
    const closed = one<{ effective_to: string | null }>(
      `select effective_to from content.answer_key_versions where id = '${keyA}'`,
    );
    expect(closed.effective_to).not.toBeNull();

    // El aprendiz responde lo que vio: la representación A. Aunque la clave vigente de la
    // pregunta sea ya la de B, el intento debe ligarse a la clave de A.
    const options = await optionsOf(ana, repA);
    const chosen = options.find((o) => o.option_key === question(pack, 0).correctOptionKey);
    const answered = await accept(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: repA,
        answer_kind: 'OPTION',
        selected_option_id: chosen?.id,
        confidence_value: 4,
        confidence_scale_version: 'v1',
      }),
    );
    submittedEventId = answered.event_id;
    const attempt = attemptOf(submittedEventId);
    expect(attempt.question_representation_id).toBe(repA);
    expect(attempt.answer_key_version_id).toBe(keyA);
    expect(attempt.is_correct_at_submission).toBe(true);
    // El ítem conserva lo presentado.
    const stored = one<{ r: string }>(
      `select presented_representation_id as r from public.session_items where id = '${item.session_item_id}'`,
    );
    expect(stored.r).toBe(repA);
  });

  it('presentar B sobre el mismo ítem ya presentado con A se rechaza', async () => {
    const otra = await sessionFor(questionAB);
    const item = itemAt(otra, 0);
    await accept(
      ana,
      itemEvent(ana, otra, item, 'QUESTION_PRESENTED', { question_representation_id: repA }),
    );
    await reject(
      ana,
      itemEvent(ana, otra, item, 'QUESTION_PRESENTED', { question_representation_id: repB }),
      'REPRESENTATION_MISMATCH',
    );
    const stored = one<{ r: string }>(
      `select presented_representation_id as r from public.session_items where id = '${item.session_item_id}'`,
    );
    expect(stored.r).toBe(repA);
  });

  it('un aprendiz que empieza ahora ve B, y su intento se liga a B: cada uno con lo suyo', async () => {
    const nueva = await sessionFor(questionAB);
    const item = itemAt(nueva, 0);
    await accept(
      ana,
      itemEvent(ana, nueva, item, 'QUESTION_PRESENTED', { question_representation_id: repB }),
    );
    const options = await optionsOf(ana, repB);
    const answered = await accept(
      ana,
      itemEvent(ana, nueva, item, 'ANSWER_SUBMITTED', {
        question_representation_id: repB,
        answer_kind: 'OPTION',
        selected_option_id: options[0]?.id,
        confidence_value: 2,
        confidence_scale_version: 'v1',
      }),
    );
    const attempt = attemptOf(answered.event_id);
    expect(attempt.question_representation_id).toBe(repB);
    // Y con la clave DE B, no con la de A: cada representación se evalúa con la suya.
    const key = one<{ representation_id: string }>(
      `select representation_id from content.answer_key_versions where id = '${attempt.answer_key_version_id}'`,
    );
    expect(key.representation_id).toBe(repB);
    expect(attempt.answer_key_version_id).not.toBe(keyA);
    const belongs = one<{ n: number }>(
      `select count(*)::int as n from public.question_options where id = (select correct_option_id from content.answer_key_versions where id = '${attempt.answer_key_version_id}') and representation_id = '${repB}'`,
    );
    expect(Number(belongs.n)).toBe(1);
  });

  it('el intento ligado a A sigue intacto tras todo lo anterior', () => {
    const attempt = attemptOf(submittedEventId);
    expect(attempt.question_representation_id).toBe(repA);
    expect(attempt.answer_key_version_id).toBe(keyA);
  });
});

// ---------------------------------------------------------------------------
describe('attempt.clockManipulation · el reloj del cliente no elige contenido', () => {
  const escenarios: Array<[string, () => string]> = [
    ['reloj adelantado tres años', () => new Date(Date.now() + 3 * 365 * 86_400_000).toISOString()],
    ['reloj atrasado tres años', () => new Date(Date.now() - 3 * 365 * 86_400_000).toISOString()],
    ['reloj anterior a la publicación de A', () => '2020-01-01T00:00:00.000Z'],
    ['reloj en el instante exacto de la supersesión', () => new Date().toISOString()],
  ];

  for (const [nombre, instante] of escenarios) {
    it(`${nombre} → misma representación presentada y misma clave`, async () => {
      const session = await sessionFor(questionAB);
      const item = itemAt(session, 0);
      const at = instante();
      // Se presenta A con el reloj manipulado…
      await accept(
        ana,
        itemEvent(
          ana,
          session,
          item,
          'QUESTION_PRESENTED',
          { question_representation_id: repA },
          { client_created_at: at },
        ),
      );
      const options = await optionsOf(ana, repA);
      // …y se responde con el mismo reloj manipulado.
      const answered = await accept(
        ana,
        itemEvent(
          ana,
          session,
          item,
          'ANSWER_SUBMITTED',
          {
            question_representation_id: repA,
            answer_kind: 'OPTION',
            selected_option_id: options[0]?.id,
            confidence_value: 1,
            confidence_scale_version: 'v1',
          },
          { client_created_at: at },
        ),
      );
      const attempt = attemptOf(answered.event_id);
      expect(attempt.question_representation_id).toBe(repA);
      expect(attempt.answer_key_version_id).toBe(keyA);
      // El dato temporal se conserva tal cual: es evidencia, no autoridad.
      expect(new Date(attempt.submitted_at).toISOString()).toBe(at);
    });
  }

  it('un reloj manipulado tampoco permite presentar una representación que no existía entonces', async () => {
    const session = await sessionFor(questionAB);
    const item = itemAt(session, 0);
    // B se publicó hoy; con el reloj en 2020 el servidor la sigue admitiendo como presentada
    // porque la autoridad es la presentación verificada, no la fecha declarada por el cliente.
    await accept(
      ana,
      itemEvent(
        ana,
        session,
        item,
        'QUESTION_PRESENTED',
        { question_representation_id: repB },
        { client_created_at: '2020-01-01T00:00:00.000Z' },
      ),
    );
    // Y lo que no puede es responder contra A: no fue lo presentado.
    await reject(
      ana,
      itemEvent(
        ana,
        session,
        item,
        'ANSWER_SUBMITTED',
        { question_representation_id: repA, answer_kind: 'BLANK' },
        { client_created_at: '2020-01-01T00:00:00.000Z' },
      ),
      'REPRESENTATION_MISMATCH',
    );
  });
});

// ---------------------------------------------------------------------------
describe('attempt.clientAuthoritativeFields.rejected · el cliente no aporta autoridad', () => {
  const campos: Array<[string, unknown]> = [
    ['user_id', '00000000-0000-4000-8000-000000000001'],
    ['stream_position', 1],
    ['server_received_at', '2026-01-01T00:00:00.000Z'],
    ['engine_processed_at', '2026-01-01T00:00:00.000Z'],
    ['attempt_number', 99],
    ['is_correct_at_submission', true],
    ['correct_option_id', '00000000-0000-4000-8000-000000000002'],
    ['answer_key_version_id', '00000000-0000-4000-8000-000000000003'],
    ['payload_hash', 'a'.repeat(64)],
    ['canonicalization_version', 'v1'],
  ];

  let session: CreatedSession;
  let item: { session_item_id: string; sort_order: number; item_type: string; target_id: string };

  beforeAll(async () => {
    session = await sessionFor(questionAB);
    item = itemAt(session, 0);
    await accept(
      ana,
      itemEvent(ana, session, item, 'QUESTION_PRESENTED', { question_representation_id: repA }),
    );
  }, 120_000);

  for (const [campo, valor] of campos) {
    it(`en el sobre: ${campo} → AUTHORITATIVE_FIELD_REJECTED`, async () => {
      const before = positions(ana.id);
      const event = {
        ...itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
          question_representation_id: repA,
          answer_kind: 'BLANK',
        }),
        [campo]: valor,
      };
      await reject(ana, event, 'AUTHORITATIVE_FIELD_REJECTED');
      expect(positions(ana.id)).toEqual(before);
    });

    it(`en el payload: ${campo} → AUTHORITATIVE_FIELD_REJECTED`, async () => {
      const before = positions(ana.id);
      await reject(
        ana,
        itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
          question_representation_id: repA,
          answer_kind: 'BLANK',
          [campo]: valor,
        }),
        'AUTHORITATIVE_FIELD_REJECTED',
      );
      expect(positions(ana.id)).toEqual(before);
    });
  }

  it('el user_id del sobre nunca sustituye a auth.uid(): la identidad es la del JWT', async () => {
    // Sin campo prohibido, el evento se acepta y queda a nombre del usuario autenticado.
    const options = await optionsOf(ana, repA);
    const answered = await accept(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: repA,
        answer_kind: 'OPTION',
        selected_option_id: options[1]?.id,
        confidence_value: 3,
        confidence_scale_version: 'v1',
      }),
    );
    const owner = one<{ user_id: string }>(
      `select user_id from public.learning_events where event_id = '${answered.event_id}'`,
    );
    expect(owner.user_id).toBe(ana.id);
    const attempt = one<{ user_id: string }>(
      `select user_id from public.question_attempts where submitted_event_id = '${answered.event_id}'`,
    );
    expect(attempt.user_id).toBe(ana.id);
  });
});

// ---------------------------------------------------------------------------
describe('attempt.keyAmendmentDoesNotRewrite · una enmienda posterior no reescribe la historia', () => {
  it('una clave AMENDED publicada después deja el intento intacto (EC-007)', async () => {
    // Intento de referencia contra A.
    const session = await sessionFor(questionAB);
    const item = itemAt(session, 0);
    await accept(
      ana,
      itemEvent(ana, session, item, 'QUESTION_PRESENTED', { question_representation_id: repA }),
    );
    const options = await optionsOf(ana, repA);
    const wrong = options.find((o) => o.option_key !== question(pack, 0).correctOptionKey);
    const answered = await accept(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: repA,
        answer_kind: 'OPTION',
        selected_option_id: wrong?.id,
        confidence_value: 4,
        confidence_scale_version: 'v1',
      }),
    );
    const before = attemptOf(answered.event_id);
    expect(before.answer_key_version_id).toBe(keyA);
    expect(before.is_correct_at_submission).toBe(false);

    // La autoridad publica una clave nueva (AMENDED) para la pregunta.
    const { targetId: amendedKey } = await publish(admin, 'answer_key_version', {
      question_id: questionAB,
      correct_option_key: wrong?.option_key,
      key_status: 'AMENDED',
      source_version_id: pack.sourceVersionId,
      effective_from: new Date().toISOString().slice(0, 10),
      explanation: 'fixture: clave enmendada',
    });
    expect(amendedKey).not.toBe(keyA);

    // El intento histórico no cambia: ni la clave, ni la corrección, ni el hash.
    const after = attemptOf(answered.event_id);
    expect(after.answer_key_version_id).toBe(keyA);
    expect(after.is_correct_at_submission).toBe(false);
    expect(after.answer_payload_hash).toBe(before.answer_payload_hash);
    expect(after.attempt_number).toBe(before.attempt_number);
  });

  it('un intento es inmutable incluso para el propietario de la base: UPDATE y DELETE se rechazan', async () => {
    const row = one<{ id: string }>(
      `select id from public.question_attempts where user_id = '${ana.id}' limit 1`,
    );
    const { attack } = await import('../support/sql');
    const updated = attack(
      `update public.question_attempts set is_correct_at_submission = not is_correct_at_submission where id = '${row.id}';`,
    );
    expect(updated.rejected, updated.message).toBe(true);
    expect(updated.message).toContain('EC-007');
    const deleted = attack(`delete from public.question_attempts where id = '${row.id}';`);
    expect(deleted.rejected, deleted.message).toBe(true);
    expect(deleted.message).toContain('EC-007');
  });

  it('un evento aceptado es igualmente inmutable (EC-005)', async () => {
    const row = one<{ id: string }>(
      `select event_id as id from public.learning_events where user_id = '${ana.id}' limit 1`,
    );
    const { attack } = await import('../support/sql');
    const updated = attack(
      `update public.learning_events set payload = '{}'::jsonb where event_id = '${row.id}';`,
    );
    expect(updated.rejected, updated.message).toBe(true);
    expect(updated.message).toContain('EC-005');
    const deleted = attack(`delete from public.learning_events where event_id = '${row.id}';`);
    expect(deleted.rejected, deleted.message).toBe(true);
    expect(deleted.message).toContain('EC-005');
  });
});

// ---------------------------------------------------------------------------
describe('grading.historicalResolution · la clave la resuelve el servidor, nunca «la más reciente»', () => {
  it('resolve_answer_key devuelve la clave de la representación presentada, no la vigente de la pregunta', () => {
    // Tras la enmienda, la clave vigente de la PREGUNTA puede no ser la de A. La resolución
    // para A debe seguir devolviendo una clave DE A (SD-023 §3, prohibición del retroceso).
    const resolvedA = one<{ id: string; rep: string }>(
      `select k.id, k.representation_id as rep from content.answer_key_versions k where k.id = ingest.resolve_answer_key('${repA}')`,
    );
    expect(resolvedA.rep).toBe(repA);
    const resolvedB = one<{ id: string; rep: string }>(
      `select k.id, k.representation_id as rep from content.answer_key_versions k where k.id = ingest.resolve_answer_key('${repB}')`,
    );
    expect(resolvedB.rep).toBe(repB);
    // Y son claves distintas: cada representación se evalúa con la suya.
    expect(resolvedA.id).not.toBe(resolvedB.id);
  });

  it('una representación sin clave resuelve a nulo, no a la clave de otra representación', () => {
    const sinClave = one<{ id: string | null }>(
      `select ingest.resolve_answer_key('${repSinClave}') as id`,
    );
    expect(sinClave.id).toBeNull();
  });

  it('la opción correcta de toda clave pertenece a su propia representación', () => {
    const cruzadas = one<{ n: number }>(
      `select count(*)::int as n from content.answer_key_versions k join public.question_options o on o.id = k.correct_option_id where o.representation_id <> k.representation_id`,
    );
    expect(Number(cruzadas.n)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('answerKey.privacy.rpc · la clave nunca llega antes del envío (INV-101)', () => {
  it('la respuesta de QUESTION_PRESENTED no contiene clave ni corrección', async () => {
    const session = await sessionFor(questionAB);
    const item = itemAt(session, 0);
    const presented = await send(
      ana,
      itemEvent(ana, session, item, 'QUESTION_PRESENTED', { question_representation_id: repA }),
    );
    const body = JSON.stringify(presented);
    expect(presented.error).toBeNull();
    expect(presented.data?.attempt).toBeNull();
    expect(body).not.toContain(keyA);
    expect(body).not.toMatch(/correct_option_id|answer_key|is_correct|explanation/i);
  });

  it('los errores de la RPC no filtran clave, opción correcta ni explicación', async () => {
    const session = await sessionFor(questionAB);
    const item = itemAt(session, 0);
    const fallos = [
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: repA,
        answer_kind: 'BLANK',
      }),
      itemEvent(ana, session, item, 'FEEDBACK_VIEWED', {}),
      itemEvent(ana, session, item, 'QUESTION_PRESENTED', {
        question_representation_id: repSinClave,
      }),
    ];
    for (const event of fallos) {
      const result = await send(ana, event);
      const body = JSON.stringify(result);
      expect(result.error, `debía rechazarse: ${String(event['event_type'])}`).not.toBeNull();
      expect(body).not.toContain(keyA);
      expect(body).not.toMatch(/correct_option_id|answer_key_version|explanation/i);
    }
  });

  it('tras el envío sí llega el resultado y su explicación, y solo entonces', async () => {
    const session = await sessionFor(questionAB);
    const item = itemAt(session, 0);
    await accept(
      ana,
      itemEvent(ana, session, item, 'QUESTION_PRESENTED', { question_representation_id: repA }),
    );
    const options = await optionsOf(ana, repA);
    const answered = await accept(
      ana,
      itemEvent(ana, session, item, 'ANSWER_SUBMITTED', {
        question_representation_id: repA,
        answer_kind: 'OPTION',
        selected_option_id: options[0]?.id,
        confidence_value: 3,
        confidence_scale_version: 'v1',
      }),
    );
    expect(answered.attempt).not.toBeNull();
    expect(answered.attempt?.['correct_option_id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof answered.attempt?.['is_correct']).toBe('boolean');
    // El aprendiz sigue sin poder leer la tabla de claves por ninguna vía de cliente.
    const { error } = await ana.client.from('answer_key_versions').select('*').limit(1);
    expect(error).not.toBeNull();
  });
});
