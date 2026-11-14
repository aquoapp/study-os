#!/usr/bin/env node
/**
 * Sembrado del **corpus sintético de Preview** · Phase 4B.
 *
 * Publica un pack sintético estable a través de la frontera de ingestión
 * (`stage_item` → `validate_staged_item` → `publish_staged_item`), exactamente igual que los
 * fixtures de prueba y que el pack del FPS: sin escrituras directas, sin saltarse ninguna
 * validación y con toda la procedencia en `GENERATED`.
 *
 * **Qué es y qué no es.** Es el mínimo contenido lícito que permite ejercitar el producto: ocho
 * conceptos, siete unidades con su duración declarada y dieciocho preguntas, escritos de cero
 * para este repositorio. **No** es el corpus oficial del primer pack, que sigue sin autorizar y
 * que nunca entra en este repositorio público; **no** abre Phase 1B; y **no** representa la
 * cobertura de ninguna convocatoria. Existe para **validación de producto**, no de examen.
 *
 * Determinista: el mismo pack, los mismos conceptos y las mismas duraciones en cada siembra.
 *
 * Uso:
 *   node --env-file=.env.staging.local tools/seed-preview-corpus.mjs            (sembrar)
 *   node --env-file=.env.staging.local tools/seed-preview-corpus.mjs --status   (comprobar)
 *   node --env-file=.env.staging.local tools/seed-preview-corpus.mjs --purge    (retirar)
 *
 * El fichero de entorno **no se lee aquí**: lo inyecta Node. Ninguna clave se imprime nunca.
 *
 * Idempotente: si el pack ya está publicado no crea nada y lo dice. La purga falla si alguien
 * tiene todavía un objetivo sobre el pack, que es la protección correcta: no se borra contenido
 * que la evidencia de una persona todavía resuelve.
 *
 * **Nunca se ejecuta contra PRODUCTION.** La comprobación mira la etiqueta del entorno **y** el
 * host real, porque la etiqueta la escribe una persona y puede estar mal.
 */

import { createClient } from '@supabase/supabase-js';

import { CONCEPTS, OPTION_KEYS, QUESTIONS, SYLLABUS, UNITS } from './preview-corpus-content.mjs';

const PRODUCTION_REF = 'nzcgufeycvehczroryoe';
const PACK_SLUG = 'preview-4b-fundamentos';
const PACK_NAME = 'Preview · Fundamentos (contenido sintético)';

const argv = new Set(process.argv.slice(2));
const MODE = argv.has('--purge') ? 'purge' : argv.has('--status') ? 'status' : 'seed';

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function readEnv() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const environment = process.env['NEXT_PUBLIC_ENVIRONMENT'] ?? '';
  if (!url || !serviceRoleKey) {
    fail(
      [
        'Faltan variables de entorno.',
        '  NEXT_PUBLIC_ENVIRONMENT   (staging | local)',
        '  NEXT_PUBLIC_SUPABASE_URL',
        '  SUPABASE_SERVICE_ROLE_KEY',
        '',
        'Inyéctalas con: node --env-file=.env.staging.local tools/seed-preview-corpus.mjs',
      ].join('\n'),
    );
  }
  if (environment !== 'staging' && environment !== 'local') {
    fail(`entorno no admitido para el sembrado: «${environment}». Solo staging o local.`);
  }
  if (url.includes(PRODUCTION_REF)) {
    fail('la URL apunta a PRODUCTION. El sembrado nunca se ejecuta ahí.');
  }
  return { url, serviceRoleKey, environment };
}

const env = readEnv();
const admin = createClient(env.url, env.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Errores transitorios de validación de token en el borde gestionado (D-22). */
const TRANSIENT_TOKEN_ERROR = /JWT (issued at future|expired)|token has invalid claims/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function boundary(label, call) {
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await call();
    if (!error) return data;
    last = error.message;
    // Un rechazo de PostgreSQL nunca se reintenta: enmascararlo escondería un invariante.
    if (!TRANSIENT_TOKEN_ERROR.test(error.message)) break;
    if (attempt < 3) await sleep(attempt * 1500);
  }
  throw new Error(`${label} falló: ${last}`);
}

async function publish(kind, payload) {
  const stagedId = await boundary(`stage_item(${kind})`, () =>
    admin.rpc('stage_item', { p_kind: kind, p_payload: payload }),
  );
  const outcome = await boundary('validate_staged_item', () =>
    admin.rpc('validate_staged_item', { p_id: stagedId }),
  );
  if (outcome !== 'VALIDATED') {
    const { data } = await admin
      .from('staged_items')
      .select('reason')
      .eq('id', stagedId)
      .maybeSingle()
      .then((r) => r)
      .catch(() => ({ data: null }));
    throw new Error(`el ítem ${kind} no validó: ${outcome}${data ? ` · ${data.reason}` : ''}`);
  }
  return boundary('publish_staged_item', () =>
    admin.rpc('publish_staged_item', { p_id: stagedId }),
  );
}

async function findPack() {
  const { data, error } = await admin
    .from('exam_packs')
    .select('id, name, status')
    .eq('slug', PACK_SLUG)
    .maybeSingle();
  if (error) throw new Error(`consulta del pack: ${error.message}`);
  return data;
}

async function inventory(packId) {
  const count = async (table, column, value) => {
    const { count: n, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, value);
    if (error) throw new Error(`recuento de ${table}: ${error.message}`);
    return n ?? 0;
  };
  return {
    conceptos: await count('concepts', 'exam_pack_id', packId),
    unidades: await count('learning_units', 'exam_pack_id', packId),
    preguntas: await count('canonical_questions', 'exam_pack_id', packId),
  };
}

function describe(counts) {
  return `${counts.conceptos} concepto(s) · ${counts.unidades} unidad(es) · ${counts.preguntas} pregunta(s)`;
}

async function seed() {
  const existing = await findPack();
  if (existing) {
    console.log('✔ el corpus de Preview ya está publicado; no se crea nada');
    console.log(`  slug: ${PACK_SLUG} · estado: ${existing.status}`);
    console.log(`  ${describe(await inventory(existing.id))}`);
    return;
  }

  console.log(`· sembrando «${PACK_SLUG}» en ${env.environment}…`);

  const packId = await publish('exam_pack', {
    slug: PACK_SLUG,
    name: PACK_NAME,
    short_name: 'Preview',
    jurisdiction: 'demo',
  });
  const versionId = await publish('exam_pack_version', {
    exam_pack_id: packId,
    version_label: 'v1',
    effective_from: '2026-01-01',
    change_summary:
      'Corpus sintetico de Preview para validacion de producto de Phase 4B. Escrito de cero; ' +
      'no procede de ningun corpus oficial ni de ninguna fuente con derechos.',
    set_current: true,
  });

  const blockIds = [];
  for (const block of SYLLABUS.blocks) {
    blockIds.push(
      await publish('syllabus_block', {
        exam_pack_version_id: versionId,
        code: block.code,
        title: block.title,
        sort_order: block.sortOrder,
      }),
    );
  }

  const topicIds = [];
  for (const topic of SYLLABUS.topics) {
    topicIds.push(
      await publish('topic', {
        block_id: blockIds[topic.block],
        code: topic.code,
        title: topic.title,
        sort_order: topic.sortOrder,
      }),
    );
  }

  /** `concept_key` → identidad publicada, para atribuir unidades y preguntas después. */
  const conceptIds = new Map();
  for (const [index, concept] of CONCEPTS.entries()) {
    const conceptId = await publish('concept', {
      exam_pack_id: packId,
      title: concept.title,
    });
    conceptIds.set(concept.key, conceptId);
    await publish('concept_version', {
      concept_id: conceptId,
      exam_pack_version_id: versionId,
      topic_id: topicIds[concept.topic],
      title: concept.title,
      description: `Contenido sintetico de Preview sobre ${concept.title.toLowerCase()}.`,
      official_code: `P.${index + 1}`,
      sort_order: index + 1,
    });
  }

  const sourceId = await publish('source', {
    title: 'Material sintetico de Preview · STUDY OS',
    authority: 'STUDY OS',
    source_type: 'DEMO',
    provenance_class: 'GENERATED',
  });
  const sourceVersionId = await publish('source_version', {
    source_id: sourceId,
    version_label: 'v1',
    effective_from: '2026-01-01',
    status: 'CURRENT',
  });

  for (const unit of UNITS) {
    const unitId = await publish('learning_unit', {
      exam_pack_id: packId,
      concept_id: conceptIds.get(unit.concept),
      unit_type: 'LESSON',
    });
    await publish('learning_unit_version', {
      learning_unit_id: unitId,
      title: unit.title,
      body: unit.body,
      provenance_class: 'GENERATED',
      source_version_id: sourceVersionId,
      // ADR-013 §2.1 · la frontera la exige y no la rellena. Es autoría, no inferencia.
      estimated_minutes: unit.minutes,
    });
  }

  for (const question of QUESTIONS) {
    const questionId = await publish('question', {
      exam_pack_id: packId,
      question_type: 'SINGLE_CHOICE',
    });
    await publish('question_representation', {
      question_id: questionId,
      stem: question.stem,
      provenance_class: 'GENERATED',
      source_version_id: sourceVersionId,
      options: question.options.map((body, i) => ({
        option_key: OPTION_KEYS[i],
        body,
        sort_order: i + 1,
      })),
    });
    await publish('answer_key_version', {
      question_id: questionId,
      correct_option_key: OPTION_KEYS[question.correct],
      key_status: 'FINAL',
      source_version_id: sourceVersionId,
      effective_from: '2026-01-01',
      explanation: question.explanation,
    });
    await publish('question_concept', {
      question_id: questionId,
      concept_id: conceptIds.get(question.concept),
      exam_pack_version_id: versionId,
      relationship_type: 'PRIMARY',
      weight: 1,
    });
  }

  const counts = await inventory(packId);
  console.log('✔ corpus de Preview publicado');
  console.log(`  ${describe(counts)}`);
  console.log(
    '  un concepto se queda sin unidad a proposito, para que NO_PUBLISHED_UNIT sea alcanzable',
  );
}

async function status() {
  const pack = await findPack();
  if (!pack) {
    console.log('· el corpus de Preview no está publicado');
    return;
  }
  console.log(`✔ ${pack.name} · ${pack.status}`);
  console.log(`  ${describe(await inventory(pack.id))}`);
}

async function purge() {
  const pack = await findPack();
  if (!pack) {
    console.log('· no hay nada que retirar');
    return;
  }
  const removed = await boundary('purge_generated_pack', () =>
    admin.rpc('purge_generated_pack', { p_pack_id: pack.id }),
  );
  console.log('✔ corpus de Preview retirado');
  console.log(`  ${JSON.stringify(removed)}`);
}

try {
  if (MODE === 'seed') await seed();
  else if (MODE === 'status') await status();
  else await purge();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
