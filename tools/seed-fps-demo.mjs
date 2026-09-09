#!/usr/bin/env node
/**
 * Sembrado del pack de demostración del First Product Slice.
 *
 * Publica **un** pack sintético estable en STAGING a través de la frontera de ingestión
 * (`stage_item` → `validate_staged_item` → `publish_staged_item`), exactamente igual que los
 * fixtures de prueba: sin escrituras directas, sin saltarse ninguna validación y con toda la
 * procedencia en `GENERATED`.
 *
 * Por qué existe: el FPS necesita contenido publicado para que el onboarding tenga algo que
 * elegir y para que la sesión fija tenga ítems. Los fixtures de prueba se purgan al terminar
 * cada ejecución; este pack es lo contrario, deliberadamente **persistente**, para que el
 * recorrido manual pueda repetirse.
 *
 * Uso:
 *   node --env-file=.env.staging.local tools/seed-fps-demo.mjs            (sembrar)
 *   node --env-file=.env.staging.local tools/seed-fps-demo.mjs --status   (solo comprobar)
 *   node --env-file=.env.staging.local tools/seed-fps-demo.mjs --purge    (retirar)
 *
 * El fichero de entorno **no se lee aquí**: lo inyecta Node. Ninguna clave se imprime.
 *
 * Idempotente: si el pack ya está publicado, no crea nada y lo dice. La purga es deliberada
 * y falla si algún aprendiz tiene todavía un objetivo sobre el pack, que es la protección
 * correcta: no se borra contenido que la evidencia de alguien todavía resuelve.
 *
 * Nunca se ejecuta contra PRODUCTION: la comprobación mira la etiqueta del entorno **y** el
 * host real, porque la etiqueta la escribe una persona y puede estar mal.
 */

import { createClient } from '@supabase/supabase-js';

const PRODUCTION_REF = 'nzcgufeycvehczroryoe';
const PACK_SLUG = 'demo-estudio-eficaz';

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
        'Inyéctalas con: node --env-file=.env.staging.local tools/seed-fps-demo.mjs',
      ].join('\n'),
    );
  }
  // Dos comprobaciones independientes: etiqueta declarada y host real.
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
  if (outcome !== 'VALIDATED') throw new Error(`el ítem ${kind} no validó: ${outcome}`);
  const targetId = await boundary('publish_staged_item', () =>
    admin.rpc('publish_staged_item', { p_id: stagedId }),
  );
  return targetId;
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
    unidades: await count('learning_units', 'exam_pack_id', packId),
    preguntas: await count('canonical_questions', 'exam_pack_id', packId),
    conceptos: await count('concepts', 'exam_pack_id', packId),
  };
}

// ---------------------------------------------------------------------------------------
// Contenido. Sintético y de desarrollo, pero escrito para leerse como producto: el FPS es
// una rebanada de producto, no una demostración de base de datos. Ningún texto procede de
// ningún corpus oficial ni de ninguna fuente externa con derechos.
// ---------------------------------------------------------------------------------------

const UNITS = [
  {
    concept: 0,
    title: 'Practicar recordando, no releyendo',
    body: [
      'Releer subrayados produce una sensación de dominio que no se corresponde con lo que',
      'luego se recuerda. El texto resulta familiar, y esa familiaridad se confunde con',
      'saberlo.',
      '',
      'La alternativa es sencilla: cerrar el material e intentar recuperar lo leído sin',
      'mirarlo. El esfuerzo de recuperar es justamente lo que consolida el recuerdo, y por eso',
      'una respuesta incompleta enseña más que otra lectura pasiva.',
      '',
      'En la práctica basta con una regla: después de cada bloque, escribe de memoria las tres',
      'ideas principales antes de comprobar si acertaste.',
    ].join('\n'),
  },
  {
    concept: 1,
    title: 'Repartir el estudio en el tiempo',
    body: [
      'El mismo número de horas rinde de forma muy distinta según cómo se reparta. Concentrar',
      'todo el estudio de un tema en una sesión larga permite responder bien esa tarde y muy',
      'mal dos semanas después.',
      '',
      'Separar las sesiones obliga a recuperar lo aprendido cuando ya se ha empezado a olvidar,',
      'y ese es el momento en que la recuperación deja más huella. El olvido parcial no es un',
      'fallo del método: es la condición que lo hace funcionar.',
      '',
      'Regla práctica: vuelve a un tema cuando empieces a dudar de él, no cuando aún lo tengas',
      'fresco.',
    ].join('\n'),
  },
];

const QUESTIONS = [
  {
    concept: 0,
    stem: '¿Por qué releer un texto subrayado suele sobrestimar lo que realmente se recuerda?',
    options: [
      'Porque la familiaridad con el texto se confunde con la capacidad de recuperarlo.',
      'Porque el subrayado elimina la información secundaria del texto.',
      'Porque releer cansa y el cansancio impide memorizar.',
      'Porque el texto subrayado se olvida más deprisa que el texto sin marcar.',
    ],
    correct: 0,
    explanation:
      'Al releer, el texto resulta reconocible, y ese reconocimiento se interpreta como dominio. ' +
      'Recordar sin el material delante es una prueba distinta y bastante más exigente.',
  },
  {
    concept: 0,
    stem: 'Después de leer un bloque de temario, ¿qué actividad consolida mejor el recuerdo?',
    options: [
      'Volver a leerlo despacio, subrayando con otro color.',
      'Escribir de memoria sus ideas principales y comprobarlas después.',
      'Copiar literalmente los párrafos más importantes.',
      'Leer un resumen ajeno del mismo bloque.',
    ],
    correct: 1,
    explanation:
      'El esfuerzo de recuperar sin ayuda es lo que consolida. Comprobar después convierte el ' +
      'intento en aprendizaje, incluso cuando la recuperación ha sido incompleta.',
  },
  {
    concept: 1,
    stem: 'Con el mismo número total de horas, ¿qué reparto favorece la retención a largo plazo?',
    options: [
      'Una única sesión larga, sin interrupciones.',
      'Varias sesiones separadas por días.',
      'Dos sesiones seguidas el mismo día.',
      'El reparto es indiferente si las horas son las mismas.',
    ],
    correct: 1,
    explanation:
      'Separar las sesiones obliga a recuperar cuando el recuerdo ya se ha debilitado, y esa ' +
      'recuperación deja más huella que repasar algo que todavía está fresco.',
  },
  {
    concept: 1,
    stem: '¿Cuál es el mejor momento para volver a un tema ya estudiado?',
    options: [
      'Inmediatamente después de haberlo leído.',
      'Cuando empiezas a dudar de él.',
      'Solo cuando lo has olvidado por completo.',
      'El día anterior al examen, y no antes.',
    ],
    correct: 1,
    explanation:
      'El olvido parcial es la condición que hace útil el repaso. Volver demasiado pronto ' +
      'aporta poco; esperar a haberlo olvidado del todo obliga a aprenderlo de nuevo.',
  },
  {
    concept: 2,
    stem: 'Al preparar un tema extenso, ¿qué señal indica mejor que se está avanzando?',
    options: [
      'Reconocer el contenido al verlo escrito.',
      'Haber dedicado más horas que la semana anterior.',
      'Poder explicarlo sin mirar el material.',
      'Tener el tema completamente subrayado.',
    ],
    correct: 2,
    explanation:
      'Explicar sin apoyo obliga a recuperar y a ordenar. Reconocer, dedicar horas o subrayar ' +
      'son indicadores de actividad, no de aprendizaje.',
  },
];

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

async function seed() {
  const existing = await findPack();
  if (existing) {
    const counts = await inventory(existing.id);
    console.log('✔ el pack de demostración ya está publicado; no se crea nada');
    console.log(`  slug: ${PACK_SLUG} · estado: ${existing.status}`);
    console.log(
      `  ${counts.unidades} unidad(es) · ${counts.preguntas} pregunta(s) · ${counts.conceptos} concepto(s)`,
    );
    return;
  }

  console.log(`· sembrando el pack «${PACK_SLUG}» en ${env.environment}…`);

  const packId = await publish('exam_pack', {
    slug: PACK_SLUG,
    name: 'Demostración · Estudiar mejor',
    short_name: 'Demostración',
    jurisdiction: 'demo',
  });
  const versionId = await publish('exam_pack_version', {
    exam_pack_id: packId,
    version_label: 'v1',
    effective_from: '2026-01-01',
    change_summary: 'Contenido de demostración generado para el First Product Slice.',
    set_current: true,
  });

  const blockId = await publish('syllabus_block', {
    exam_pack_version_id: versionId,
    code: 'B1',
    title: 'Cómo se estudia',
    sort_order: 1,
  });
  const topicId = await publish('topic', {
    block_id: blockId,
    code: 'B1.T1',
    title: 'Método de estudio',
    sort_order: 1,
  });

  const conceptTitles = [
    'Práctica de recuperación',
    'Práctica distribuida',
    'Señales de progreso real',
  ];
  const conceptIds = [];
  for (const [i, title] of conceptTitles.entries()) {
    const conceptId = await publish('concept', { exam_pack_id: packId, title });
    conceptIds.push(conceptId);
    await publish('concept_version', {
      concept_id: conceptId,
      exam_pack_version_id: versionId,
      topic_id: topicId,
      title,
      description: `Contenido de demostración sobre ${title.toLowerCase()}.`,
      official_code: `D.${i + 1}`,
      sort_order: i + 1,
    });
  }

  const sourceId = await publish('source', {
    title: 'Material de demostración generado',
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
      concept_id: conceptIds[unit.concept],
      unit_type: 'LESSON',
    });
    await publish('learning_unit_version', {
      learning_unit_id: unitId,
      title: unit.title,
      body: unit.body,
      provenance_class: 'GENERATED',
      source_version_id: sourceVersionId,
    });
  }

  for (const q of QUESTIONS) {
    const questionId = await publish('question', {
      exam_pack_id: packId,
      question_type: 'SINGLE_CHOICE',
    });
    await publish('question_representation', {
      question_id: questionId,
      stem: q.stem,
      provenance_class: 'GENERATED',
      source_version_id: sourceVersionId,
      options: q.options.map((body, i) => ({
        option_key: OPTION_KEYS[i],
        body,
        sort_order: i + 1,
      })),
    });
    await publish('answer_key_version', {
      question_id: questionId,
      correct_option_key: OPTION_KEYS[q.correct],
      key_status: 'FINAL',
      source_version_id: sourceVersionId,
      effective_from: '2026-01-01',
      explanation: q.explanation,
    });
    await publish('question_concept', {
      question_id: questionId,
      concept_id: conceptIds[q.concept],
      exam_pack_version_id: versionId,
      relationship_type: 'PRIMARY',
      weight: 1,
    });
  }

  const counts = await inventory(packId);
  console.log('✔ pack de demostración publicado');
  console.log(
    `  ${counts.unidades} unidad(es) · ${counts.preguntas} pregunta(s) · ${counts.conceptos} concepto(s)`,
  );
}

async function status() {
  const pack = await findPack();
  if (!pack) {
    console.log('· el pack de demostración no está publicado');
    return;
  }
  const counts = await inventory(pack.id);
  console.log(`✔ ${pack.name} · ${pack.status}`);
  console.log(
    `  ${counts.unidades} unidad(es) · ${counts.preguntas} pregunta(s) · ${counts.conceptos} concepto(s)`,
  );
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
  console.log('✔ pack de demostración retirado');
  console.log(`  ${JSON.stringify(removed)}`);
}

try {
  if (MODE === 'seed') await seed();
  else if (MODE === 'status') await status();
  else await purge();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
