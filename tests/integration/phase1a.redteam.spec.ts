import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSyntheticPack,
  idAt,
  publish,
  purgePack,
  question,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import { attack, one, query } from '../support/sql';
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
  type TestUser,
} from '../support/supabase-test-env';

/**
 * `phase1a.redteam.spec` · auditoría adversarial de Phase 1A (2026-09-09).
 *
 * Cada prueba intenta romper un invariante aceptado y exige que la base lo rechace.
 * Dos superficies:
 *
 *   - **Rutas de cliente** por PostgREST con `anon`, `authenticated` y el rol de servicio:
 *     descubrimiento, embeds, cabeceras de perfil, RPC, mensajes de error (INV-101,
 *     ADR-011, SI-1A-1…6).
 *   - **Enforcement de la base** con `attack()`: bloques `DO` que siempre se revierten,
 *     ejecutados como propietario, de modo que ni la RLS ni los grants intervienen y lo
 *     único que puede detener el ataque son triggers, restricciones e índices
 *     (SD-021, ADR-009 v1.1, ADR-010 v1.1, PI-1A-1…6, EC-007). Sin residuo.
 *
 * Un ataque que prospera es un fallo duro del checkpoint, no una deuda.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let user: TestUser;
let userToken = '';
let pack: SyntheticPack;
let other: SyntheticPack;

const UUID = /^[0-9a-f-]{36}$/;

function rejected(statements: string, expectation: RegExp): void {
  const outcome = attack(statements);
  expect(outcome.rejected, `el ataque prosperó: ${outcome.message.slice(0, 300)}`).toBe(true);
  expect(outcome.message).toMatch(expectation);
}

/** Inserta una promoción provisional dentro de un ataque (el propietario puede). */
const promotionSql = (table: string) =>
  `insert into ingest.promotions (target_table) values ('${table}') returning id into promo;`;

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  user = await createTestUser(env, 'redteam');
  const { data: session } = await user.client.auth.getSession();
  userToken = session.session?.access_token ?? '';
  expect(userToken).not.toBe('');
  pack = await buildSyntheticPack(admin, 'r');
  other = await buildSyntheticPack(admin, 's', { sectionCodes: ['ONE'], modelCodes: ['Z'] });
}, 180_000);

afterAll(async () => {
  for (const p of [pack, other]) if (p) await purgePack(admin, p.packId);
  if (user) await deleteTestUser(env, user.id);
}, 120_000);

// ---------------------------------------------------------------------------
// 1 · Rutas de cliente (INV-101 · ADR-011)
// ---------------------------------------------------------------------------

describe('descubrimiento por el Data API: nada de content ni ingest es visible', () => {
  async function rest(path: string, headers: Record<string, string>, method = 'GET') {
    const response = await fetch(`${env.url}/rest/v1${path}`, {
      method,
      headers: { apikey: env.anonKey, ...headers },
    });
    return { status: response.status, body: await response.text() };
  }

  // Desde Phase 2, `question_attempts` expone `answer_key_version_id`: una referencia opaca
  // a una fila de `content` que el cliente no puede leer, exigida por EC-007 para que el
  // intento conserve con qué versión de clave se evaluó. El patrón nombra por eso la TABLA
  // de claves y el material de corrección, no el prefijo `answer_key`.
  const PRIVATE_WORDS =
    /answer_key_versions|correct_option|explanation|staged_items|promotions|content\.|ingest\./i;

  it('el OpenAPI de la raíz se niega a los roles de cliente y, para el servidor, no describe nada privado', async () => {
    // El proyecto gestionado exige una clave secreta para el descubrimiento (401 para anon
    // y usuarios); el stack local de CI sirve el OpenAPI a cualquiera. En ambos casos el
    // invariante es el mismo: ninguna palabra privada en lo que se sirve.
    for (const headers of [{}, { Authorization: `Bearer ${userToken}` }]) {
      const { status, body } = await rest('/', headers);
      expect([200, 401]).toContain(status);
      expect(body).not.toMatch(PRIVATE_WORDS);
    }
    // Con la clave de servicio, el OpenAPI describe solo `public`: ninguna tabla, columna
    // ni función de content/ingest. Las RPC reservadas de la frontera sí se listan (viven en
    // public) pero no son ejecutables por clientes: eso lo prueba el bloque de RPC.
    const response = await fetch(`${env.url}/rest/v1/`, {
      headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toMatch(PRIVATE_WORDS);
    expect(body).toMatch(/question_options/);
  });

  it('Accept-Profile con un esquema privado se rechaza para todos los roles', async () => {
    for (const bearer of [null, userToken, env.serviceRoleKey]) {
      for (const [schema, table] of [
        ['content', 'answer_key_versions'],
        ['ingest', 'staged_items'],
        ['ingest', 'promotions'],
      ]) {
        const { status, body } = await rest(`/${table}?select=*`, {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          'Accept-Profile': schema ?? '',
        });
        expect(status, `${schema}.${table}`).toBeGreaterThanOrEqual(400);
        expect(body).not.toMatch(/correct_option_id|"explanation"/);
      }
    }
  });

  it('Content-Profile con un esquema privado no ejecuta ninguna RPC', async () => {
    for (const bearer of [null, userToken, env.serviceRoleKey]) {
      const { status } = await rest(
        '/rpc/publish_staged_item',
        {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          'Content-Profile': 'ingest',
          'Content-Type': 'application/json',
        },
        'POST',
      );
      expect(status).toBeGreaterThanOrEqual(400);
    }
  });

  it('una tabla privada nombrada en public no existe en la caché ni se sugiere', async () => {
    for (const name of ['answer_key_versions', 'staged_items', 'promotions']) {
      const { data, error } = await user.client.from(name).select('*').limit(1);
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message ?? '').not.toMatch(/content\.|ingest\./);
    }
  });

  it('ningún embed alcanza content: la relación no existe para PostgREST', async () => {
    const rep = question(pack, 0).representationId;
    for (const selection of [
      '*, answer_key_versions(*)',
      '*, content.answer_key_versions(*)',
      'id, canonical_questions(*, answer_key_versions(*))',
    ]) {
      const { data, error } = await user.client
        .from('question_options')
        .select(selection)
        .eq('representation_id', rep);
      expect(error, selection).not.toBeNull();
      expect(data).toBeNull();
      expect(JSON.stringify(error)).not.toMatch(/correct_option/);
    }
  });

  it('las opciones publicadas se leen sin ningún rastro de corrección', async () => {
    const rep = question(pack, 0).representationId;
    const { data, error } = await user.client
      .from('question_options')
      .select('*')
      .eq('representation_id', rep)
      .order('sort_order');
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    for (const row of data ?? []) {
      expect(Object.keys(row).sort()).toEqual([
        'body',
        'created_at',
        'id',
        'option_key',
        'representation_id',
        'sort_order',
      ]);
    }
    // El recuento coincide con las opciones: no hay «una menos» ni «una más» que delate nada.
    const { count } = await user.client
      .from('question_options')
      .select('id', { count: 'exact', head: true })
      .eq('representation_id', rep);
    expect(count).toBe(3);
  });

  it('un filtro malformado devuelve un error sin contenido privado', async () => {
    const { error } = await user.client
      .from('question_options')
      .select('*')
      .filter('representation_id', 'eq', 'not-a-uuid');
    expect(error).not.toBeNull();
    expect(JSON.stringify(error)).not.toMatch(/answer_key|correct/);
  });

  it('OPTIONS no anuncia métodos de escritura para un usuario', async () => {
    const response = await fetch(`${env.url}/rest/v1/question_options`, {
      method: 'OPTIONS',
      headers: { apikey: env.anonKey, Authorization: `Bearer ${userToken}` },
    });
    expect(response.status).toBeLessThan(500);
    // PostgREST no calcula «Allow» por privilegios: lo que decide es el DML de abajo.
    const { error } = await user.client.from('question_options').insert({});
    expect(error?.code).toBe('42501');
  });
});

describe('las RPC de la frontera son de servidor: denegación con argumentos correctos', () => {
  it('authenticated recibe 42501, no «función desconocida»', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [
      ['stage_item', { p_kind: 'exam_pack', p_payload: { slug: 'x', name: 'x' } }],
      ['validate_staged_item', { p_id: '00000000-0000-0000-0000-000000000000' }],
      ['publish_staged_item', { p_id: '00000000-0000-0000-0000-000000000000' }],
      [
        'copy_forward_question_concepts',
        { p_from_version: pack.versionId, p_to_version: other.versionId },
      ],
      ['purge_generated_pack', { p_pack_id: pack.packId }],
    ];
    for (const [name, args] of calls) {
      const { error } = await user.client.rpc(name, args);
      expect(error?.code, name).toBe('42501');
      const { error: anonError } = await anonClient(env).rpc(name, args);
      expect(anonError?.code, `${name} · anon`).toBe('42501');
    }
    // Ninguna publicación ni purga se produjo.
    const { data } = await admin.from('exam_packs').select('id').eq('id', pack.packId);
    expect(data).toHaveLength(1);
  });

  it('las funciones internas de ingest no existen para PostgREST', async () => {
    for (const name of ['concept_key', 'actor', 'require_keys', 'source_version_is_official']) {
      const { error } = await user.client.rpc(name, {});
      expect(error).not.toBeNull();
      expect(error?.code).not.toBe('42501');
    }
  });
});

// ---------------------------------------------------------------------------
// 2 · Auditoría de promoción (PI-1A-6)
// ---------------------------------------------------------------------------

describe('auditoría de promoción', () => {
  it('toda fila con promotion_id, en toda tabla, enlaza una promoción cerrada sobre ella', () => {
    const tables = query<{ schema: string; table: string }>(
      "select table_schema as schema, table_name as table from information_schema.columns where column_name = 'promotion_id' and table_schema in ('public','content') order by 1, 2",
    );
    expect(tables.length).toBeGreaterThanOrEqual(19);
    const union = tables
      .map(({ schema, table }) => {
        const idColumn = table === 'concept_prerequisites' ? 'concept_id' : 'id';
        return `select '${schema}.${table}' as t, count(*)::int as broken from ${schema}.${table} t where not exists (select 1 from ingest.promotions p where p.id = t.promotion_id and p.target_table = '${schema}.${table}' and p.target_id = t.${idColumn})`;
      })
      .join(' union all ');
    const rows = query<{ t: string; broken: number }>(union);
    expect(rows).toHaveLength(tables.length);
    for (const row of rows) expect(row.broken, row.t).toBe(0);
    expect(
      one<{ pending: number }>(
        "select count(*)::int as pending from ingest.promotions where target_table = 'public.pending'",
      ).pending,
    ).toBe(0);
  });

  it('registra al actor real (el rol del JWT), no al propietario de la función', () => {
    const row = one<{ actor: string }>(
      `select p.promoted_by as actor from ingest.promotions p join public.exam_packs e on e.promotion_id = p.id where e.id = '${pack.packId}'`,
    );
    expect(row.actor).toBe('service_role');
    const staged = one<{ actor: string }>(
      `select s.received_by as actor from ingest.staged_items s join ingest.promotions p on p.staged_item_id = s.id join public.exam_packs e on e.promotion_id = p.id where e.id = '${pack.packId}'`,
    );
    expect(staged.actor).toBe('service_role');
  });

  it('una promoción cerrada no se reescribe ni se borra', () => {
    rejected(
      `update ingest.promotions set target_id = gen_random_uuid() where id = (select promotion_id from public.exam_packs where id = '${pack.packId}');`,
      /PI-1A-6/,
    );
    rejected(
      `delete from ingest.promotions where id = (select promotion_id from public.exam_packs where id = '${pack.packId}');`,
      /PI-1A-6/,
    );
  });

  it('no queda residuo engañoso: ninguna promoción OFFICIAL o VERIFIED apunta a una fila que ya no existe', () => {
    const row = one<{ n: number }>(
      "select count(*)::int as n from ingest.promotions p where p.provenance_class in ('OFFICIAL','VERIFIED') and p.target_table <> 'public.pending' and not exists (select 1 from public.sources s where p.target_table = 'public.sources' and s.id = p.target_id) and not exists (select 1 from public.question_representations r where p.target_table = 'public.question_representations' and r.id = p.target_id) and not exists (select 1 from public.exam_occurrences o where p.target_table = 'public.exam_occurrences' and o.id = p.target_id) and not exists (select 1 from public.practicals pr where p.target_table = 'public.practicals' and pr.id = p.target_id)",
    );
    expect(row.n).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3 · Campaña de inmutabilidad (sin residuo)
// ---------------------------------------------------------------------------

describe('identidad de concepto', () => {
  it('la clave, el pack y la fila publicada son inmutables; la recreación choca', () => {
    const concept = idAt(pack.conceptIds, 0);
    rejected(
      `update public.concepts set concept_key = 'reescrita-00000000' where id = '${concept}';`,
      /inmutable/,
    );
    rejected(
      `update public.concepts set exam_pack_id = '${other.packId}' where id = '${concept}';`,
      /no cambia de pack|foreign key|violates/,
    );
    rejected(`delete from public.concepts where id = '${concept}';`, /DI-1A-3/);
    rejected(
      `declare promo uuid; begin ${promotionSql('public.concepts')} insert into public.concepts (exam_pack_id, concept_key, status, promotion_id) select exam_pack_id, concept_key, 'PUBLISHED', promo from public.concepts where id = '${concept}'; end;`,
      /concepts_key_unique|duplicate/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.concepts')} insert into public.concepts (exam_pack_id, concept_key, status, promotion_id) values ('${pack.packId}', 'X.1', 'PUBLISHED', promo); end;`,
      /concepts_key_convention|check/,
    );
  });

  it('el slug del pack no cambia mientras existan conceptos (deriva las claves)', () => {
    rejected(
      `update public.exam_packs set slug = 'otro-slug' where id = '${pack.packId}';`,
      /ADR-009/,
    );
  });

  it('un prerrequisito no cruza packs ni se apunta a sí mismo, aunque lo inserte el propietario', () => {
    const a = idAt(pack.conceptIds, 2);
    const b = idAt(other.conceptIds, 0);
    rejected(
      `declare promo uuid; begin ${promotionSql('public.concept_prerequisites')} insert into public.concept_prerequisites (concept_id, prerequisite_concept_id, exam_pack_id, promotion_id) values ('${a}', '${b}', '${pack.packId}', promo); end;`,
      /prerequisite_fk|foreign key/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.concept_prerequisites')} insert into public.concept_prerequisites (concept_id, prerequisite_concept_id, exam_pack_id, promotion_id) values ('${a}', '${a}', '${pack.packId}', promo); end;`,
      /not_self|check/,
    );
  });
});

describe('identidad y representaciones de pregunta', () => {
  it('una pregunta no cambia de pack', () => {
    rejected(
      `update public.canonical_questions set exam_pack_id = '${other.packId}' where id = '${question(pack, 0).questionId}';`,
      /DI-1A-1|foreign key/,
    );
  });

  it('el contenido publicado no se reescribe por ninguna columna', () => {
    const rep = question(pack, 0).representationId;
    for (const assignment of [
      "stem = 'fixture: reescrito'",
      'presentation_json = \'{"x":1}\'::jsonb',
      "official_reference = 'x'",
      'published_at = now()',
      `question_id = '${question(pack, 1).questionId}'`,
      'representation_no = 9',
      'promotion_id = gen_random_uuid()',
      "status = 'DRAFT'",
    ]) {
      rejected(
        `update public.question_representations set ${assignment} where id = '${rep}';`,
        /SD-021|foreign key/,
      );
    }
    rejected(`delete from public.question_representations where id = '${rep}';`, /DI-1A-3/);
  });

  it('las opciones de una representación publicada no se tocan', () => {
    const rep = question(pack, 0).representationId;
    rejected(
      `update public.question_options set body = 'x' where representation_id = '${rep}';`,
      /SD-021/,
    );
    rejected(
      `update public.question_options set sort_order = sort_order + 10 where representation_id = '${rep}';`,
      /SD-021/,
    );
    rejected(`delete from public.question_options where representation_id = '${rep}';`, /SD-021/);
    rejected(
      `insert into public.question_options (representation_id, option_key, body, sort_order) values ('${rep}', 'Z', 'x', 99);`,
      /SD-021/,
    );
  });

  it('la procedencia es inmutable en representaciones, fuentes, ocurrencias y prácticos', () => {
    const rep = question(pack, 0).representationId;
    rejected(
      `update public.question_representations set provenance_class = 'OFFICIAL' where id = '${rep}';`,
      /PI-1A-4|SD-021/,
    );
    rejected(
      `update public.sources set provenance_class = 'OFFICIAL' where id = '${pack.sourceId}';`,
      /PI-1A-4/,
    );
    rejected(
      `update public.sources set provenance_class = 'VERIFIED' where id = '${pack.sourceId}';`,
      /PI-1A-4/,
    );
    rejected(
      `update public.exam_occurrences set provenance_class = 'VERIFIED' where id = '${idAt(pack.occurrenceIds, 0)}';`,
      /PI-1A-4/,
    );
    rejected(
      `update public.practicals set provenance_class = 'OFFICIAL' where id = '${pack.practicalId}';`,
      /PI-1A-4|INV-110/,
    );
    // Tampoco en un borrador: la clase se fija al publicar la fila.
    rejected(
      `declare promo uuid; draft uuid; begin ${promotionSql('public.question_representations')} insert into public.question_representations (question_id, representation_no, stem, provenance_class, source_version_id, status, promotion_id) values ('${question(pack, 0).questionId}', 50, 'fixture: borrador', 'GENERATED', '${pack.sourceVersionId}', 'DRAFT', promo) returning id into draft; update public.question_representations set provenance_class = 'VERIFIED' where id = draft; end;`,
      /PI-1A-4/,
    );
  });

  it('la supersesión no forma ciclos, no retrocede y no cruza preguntas', () => {
    const q = question(pack, 1);
    const v1 = q.representationId;
    // Corrección real por la frontera: v2 supersede a v1.
    let v2: string | undefined;
    const outcome = attack(
      `declare promo uuid; v2 uuid; begin ${promotionSql('public.question_representations')} ` +
        `insert into public.question_representations (question_id, representation_no, stem, provenance_class, source_version_id, status, supersedes_representation_id, promotion_id) values ('${q.questionId}', 2, 'fixture: v2', 'GENERATED', '${pack.sourceVersionId}', 'DRAFT', '${v1}', promo) returning id into v2; ` +
        `update public.question_representations set superseded_by_representation_id = v2 where id = '${v1}'; ` +
        // Ciclo: v2 «superseded por» v1 (anterior).
        `update public.question_representations set superseded_by_representation_id = '${v1}' where id = v2; end;`,
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toMatch(/SD-021/);
    void v2;
    // Retroceso: v1 «supersede» a una representación con número mayor.
    rejected(
      `declare promo uuid; v2 uuid; begin ${promotionSql('public.question_representations')} ` +
        `insert into public.question_representations (question_id, representation_no, stem, provenance_class, source_version_id, status, promotion_id) values ('${q.questionId}', 3, 'fixture: v3', 'GENERATED', '${pack.sourceVersionId}', 'DRAFT', promo) returning id into v2; ` +
        `update public.question_representations set supersedes_representation_id = v2 where id = '${v1}'; end;`,
      /SD-021/,
    );
    // Otra pregunta.
    rejected(
      `update public.question_representations set superseded_by_representation_id = '${question(pack, 2).representationId}' where id = '${v1}';`,
      /SD-021|misma pregunta/,
    );
    // Una representación nueva con supersedes hacia otra pregunta.
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_representations')} insert into public.question_representations (question_id, representation_no, stem, provenance_class, source_version_id, status, supersedes_representation_id, promotion_id) values ('${q.questionId}', 4, 'fixture: ajena', 'GENERATED', '${pack.sourceVersionId}', 'DRAFT', '${question(pack, 2).representationId}', promo); end;`,
      /SD-021|misma pregunta/,
    );
  });

  it('una representación no entra sin promoción, con clase PERSONAL, OFFICIAL sin fuente ni con marcadores', () => {
    const q = question(pack, 0).questionId;
    rejected(
      `insert into public.question_representations (question_id, representation_no, stem, provenance_class, status) values ('${q}', 60, 'x', 'GENERATED', 'DRAFT');`,
      /promotion_id|null value/,
    );
    rejected(
      `insert into public.question_representations (question_id, representation_no, stem, provenance_class, status, promotion_id) values ('${q}', 61, 'x', 'GENERATED', 'DRAFT', gen_random_uuid());`,
      /foreign key/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_representations')} insert into public.question_representations (question_id, representation_no, stem, provenance_class, status, promotion_id) values ('${q}', 62, 'x', 'PERSONAL', 'DRAFT', promo); end;`,
      /not_personal|check/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_representations')} insert into public.question_representations (question_id, representation_no, stem, provenance_class, status, promotion_id) values ('${q}', 63, 'x', 'OFFICIAL', 'DRAFT', promo); end;`,
      /official_requires_source|check/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_representations')} insert into public.question_representations (question_id, representation_no, stem, presentation_json, provenance_class, status, promotion_id) values ('${q}', 64, 'x', '{"correct":"A"}'::jsonb, 'GENERATED', 'DRAFT', promo); end;`,
      /no_markers|check/,
    );
  });
});

describe('claves de respuesta (EC-007 · INV-101)', () => {
  it('una versión de clave es inmutable, no se borra y no se reabre', () => {
    const q = question(pack, 0);
    rejected(
      `update content.answer_key_versions set correct_option_id = (select id from public.question_options where representation_id = '${q.representationId}' and option_key <> '${q.correctOptionKey}' limit 1) where id = '${q.keyId}';`,
      /EC-007/,
    );
    rejected(
      `update content.answer_key_versions set key_status = 'AMENDED' where id = '${q.keyId}';`,
      /EC-007/,
    );
    rejected(`delete from content.answer_key_versions where id = '${q.keyId}';`, /EC-007/);
    rejected(
      `update content.answer_key_versions set effective_to = '2030-01-01' where id = '${q.keyId}'; update content.answer_key_versions set effective_to = null where id = '${q.keyId}';`,
      /EC-007/,
    );
  });

  it('una clave no apunta a una opción de otra representación ni a otra pregunta', () => {
    const q0 = question(pack, 0);
    const q1 = question(pack, 1);
    rejected(
      `declare promo uuid; begin ${promotionSql('content.answer_key_versions')} insert into content.answer_key_versions (question_id, representation_id, correct_option_id, key_status, source_version_id, effective_from, effective_to, promotion_id) values ('${q0.questionId}', '${q0.representationId}', (select id from public.question_options where representation_id = '${q1.representationId}' limit 1), 'FINAL', '${pack.sourceVersionId}', '2026-01-01', '2026-02-01', promo); end;`,
      /option_fk|foreign key/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('content.answer_key_versions')} insert into content.answer_key_versions (question_id, representation_id, correct_option_id, key_status, source_version_id, effective_from, effective_to, promotion_id) values ('${q1.questionId}', '${q0.representationId}', (select id from public.question_options where representation_id = '${q0.representationId}' limit 1), 'FINAL', '${pack.sourceVersionId}', '2026-01-01', '2026-02-01', promo); end;`,
      /representation_fk|foreign key/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('content.answer_key_versions')} insert into content.answer_key_versions (question_id, representation_id, correct_option_id, key_status, source_version_id, effective_from, effective_to, supersedes_key_id, promotion_id) values ('${q0.questionId}', '${q0.representationId}', (select id from public.question_options where representation_id = '${q0.representationId}' limit 1), 'FINAL', '${pack.sourceVersionId}', '2026-01-01', '2026-02-01', '${q1.keyId}', promo); end;`,
      /EC-007|misma pregunta/,
    );
  });

  it('no hay dos claves vigentes para la misma pregunta', () => {
    const q0 = question(pack, 0);
    rejected(
      `declare promo uuid; begin ${promotionSql('content.answer_key_versions')} insert into content.answer_key_versions (question_id, representation_id, correct_option_id, key_status, source_version_id, effective_from, promotion_id) values ('${q0.questionId}', '${q0.representationId}', (select id from public.question_options where representation_id = '${q0.representationId}' limit 1), 'FINAL', '${pack.sourceVersionId}', '2026-01-01', promo); end;`,
      /one_current|duplicate/,
    );
  });

  it('el rol de servicio no escribe claves ni auditoría por SQL: solo la frontera', () => {
    const grants = query<{ table: string; privilege: string }>(
      "select table_schema || '.' || table_name as table, privilege_type as privilege from information_schema.role_table_grants where grantee = 'service_role' and table_schema in ('content','ingest') order by 1, 2",
    );
    // Phase 2 añade los dos contadores de la frontera, con el mismo contrato: el rol de
    // servicio los lee y no los escribe. Quien asigna posición e intento es la función.
    expect(grants.map((g) => `${g.table}:${g.privilege}`)).toEqual([
      'content.answer_key_versions:SELECT',
      'ingest.promotions:SELECT',
      'ingest.staged_items:SELECT',
      'ingest.user_event_counters:SELECT',
      'ingest.user_question_counters:SELECT',
    ]);
  });
});

describe('procedencia e ingest (PI-1A-1…6)', () => {
  it('OFFICIAL exige fuente OFFICIAL en ocurrencias, prácticos y claves; el propietario no lo salta', () => {
    rejected(
      `declare promo uuid; begin ${promotionSql('public.exam_occurrences')} insert into public.exam_occurrences (sitting_model_id, section_id, question_id, exam_pack_id, display_no, provenance_class, source_version_id, promotion_id) values ('${idAt(pack.modelIds, 0)}', '${idAt(pack.sectionIds, 1)}', '${question(pack, 0).questionId}', '${pack.packId}', 77, 'OFFICIAL', '${pack.sourceVersionId}', promo); end;`,
      /INV-110/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.practicals')} insert into public.practicals (exam_pack_id, title, scenario, provenance_class, source_version_id, status, promotion_id) values ('${pack.packId}', 'x', 'x', 'OFFICIAL', '${pack.sourceVersionId}', 'DRAFT', promo); end;`,
      /INV-110/,
    );
  });

  it('una fuente no es PERSONAL; una versión OFFICIAL exige checksum; la cadena no cruza fuentes ni forma ciclos', () => {
    rejected(
      `declare promo uuid; begin ${promotionSql('public.sources')} insert into public.sources (title, authority, source_type, provenance_class, promotion_id) values ('x', 'x', 'FIXTURE', 'PERSONAL', promo); end;`,
      /not_personal|check/,
    );
    rejected(
      `declare promo uuid; src uuid; begin ${promotionSql('public.sources')} insert into public.sources (title, authority, source_type, provenance_class, promotion_id) values ('fixture: fuente que se declara oficial', 'fixture', 'FIXTURE', 'OFFICIAL', promo) returning id into src; ${promotionSql('public.source_versions')} insert into public.source_versions (source_id, version_label, effective_from, status, promotion_id) values (src, 'v1', '2026-01-01', 'CURRENT', promo); end;`,
      /INV-110|checksum/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.source_versions')} insert into public.source_versions (source_id, version_label, effective_from, status, supersedes_version_id, promotion_id) values ('${other.sourceId}', 'v9', '2026-05-01', 'CURRENT', '${pack.sourceVersionId}', promo); end;`,
      /DI-1A-7|misma fuente/,
    );
    rejected(
      `declare promo uuid; v2 uuid; begin ${promotionSql('public.source_versions')} insert into public.source_versions (source_id, version_label, effective_from, status, supersedes_version_id, promotion_id) values ('${pack.sourceId}', 'v2', '2026-05-01', 'CURRENT', '${pack.sourceVersionId}', promo) returning id into v2; update public.source_versions set supersedes_version_id = v2 where id = '${pack.sourceVersionId}'; end;`,
      /DI-1A-7|ciclo/,
    );
  });

  it('una fila canónica no entra sin promoción ni con una promoción inexistente', () => {
    rejected(
      `insert into public.exam_sections (exam_pack_id, code, title, sort_order) values ('${pack.packId}', 'NOPROMO', 'x', 50);`,
      /promotion_id|null value/,
    );
    rejected(
      `insert into public.exam_sections (exam_pack_id, code, title, sort_order, promotion_id) values ('${pack.packId}', 'FAKE', 'x', 51, gen_random_uuid());`,
      /foreign key/,
    );
  });

  it('un ítem de staging no salta a PUBLISHED sin destino ni promoción', () => {
    rejected(
      `update ingest.staged_items set status = 'PUBLISHED' where id = (select id from ingest.staged_items where status = 'PUBLISHED' limit 1) and false; insert into ingest.staged_items (kind, payload, status) values ('exam_pack', '{}'::jsonb, 'PUBLISHED');`,
      /published_consistency|check/,
    );
  });

  it('la purga se niega ante una sola fila no GENERATED, aunque la inserte el propietario', () => {
    rejected(
      `declare promo uuid; src uuid; ver uuid; begin ${promotionSql('public.sources')} insert into public.sources (title, authority, source_type, provenance_class, promotion_id) values ('fixture: fuente que se declara oficial', 'fixture', 'FIXTURE', 'OFFICIAL', promo) returning id into src; ${promotionSql('public.source_versions')} insert into public.source_versions (source_id, version_label, effective_from, status, checksum, promotion_id) values (src, 'v1', '2026-01-01', 'CURRENT', repeat('a', 64), promo) returning id into ver; ${promotionSql('public.question_representations')} insert into public.question_representations (question_id, representation_no, stem, provenance_class, source_version_id, status, promotion_id) values ('${question(pack, 2).questionId}', 70, 'fixture: se declara oficial', 'OFFICIAL', ver, 'DRAFT', promo); perform ingest.purge_generated_pack('${pack.packId}'); end;`,
      /no GENERATED|no se purga/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_representations')} insert into public.question_representations (question_id, representation_no, stem, provenance_class, source_version_id, status, promotion_id) values ('${question(pack, 2).questionId}', 71, 'fixture: borrador verificado', 'VERIFIED', '${pack.sourceVersionId}', 'DRAFT', promo); perform ingest.purge_generated_pack('${pack.packId}'); end;`,
      /no GENERATED|no se purga/,
    );
  });

  it('el copy-forward exige el mismo pack y versiones distintas', () => {
    rejected(
      `perform ingest.copy_forward_question_concepts('${pack.versionId}', '${other.versionId}');`,
      /mismo pack/,
    );
    rejected(
      `perform ingest.copy_forward_question_concepts('${pack.versionId}', '${pack.versionId}');`,
      /misma versión/,
    );
  });
});

describe('mapeos y ocurrencias', () => {
  it('un segundo PRIMARY, un peso fuera de rango o un VALIDATED sin fecha se rechazan', () => {
    const q = question(pack, 0).questionId;
    const concept = idAt(pack.conceptIds, 1);
    const base = `insert into public.question_concepts (question_id, concept_id, exam_pack_id, exam_pack_version_id, relationship_type, weight, mapping_status, validated_at, promotion_id)`;
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_concepts')} ${base} values ('${q}', '${concept}', '${pack.packId}', '${pack.versionId}', 'PRIMARY', 1, 'VALIDATED', now(), promo); end;`,
      /one_primary|duplicate/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_concepts')} ${base} values ('${q}', '${concept}', '${pack.packId}', '${pack.versionId}', 'SECONDARY', 0, 'VALIDATED', now(), promo); end;`,
      /weight_range|check/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_concepts')} ${base} values ('${q}', '${concept}', '${pack.packId}', '${pack.versionId}', 'SECONDARY', 0.5, 'VALIDATED', null, promo); end;`,
      /validated_consistency|check/,
    );
    rejected(
      `declare promo uuid; begin ${promotionSql('public.question_concepts')} ${base} values ('${q}', '${idAt(other.conceptIds, 0)}', '${pack.packId}', '${pack.versionId}', 'SECONDARY', 0.5, 'VALIDATED', now(), promo); end;`,
      /concept_fk|foreign key/,
    );
  });

  it('las ocurrencias no duplican posición ni pregunta por modelo, ni cruzan packs', () => {
    const occ = `insert into public.exam_occurrences (sitting_model_id, section_id, question_id, exam_pack_id, display_no, provenance_class, source_version_id, promotion_id)`;
    rejected(
      `declare promo uuid; begin ${promotionSql('public.exam_occurrences')} ${occ} values ('${idAt(pack.modelIds, 0)}', '${idAt(pack.sectionIds, 0)}', '${question(pack, 0).questionId}', '${pack.packId}', 1, 'GENERATED', '${pack.sourceVersionId}', promo); end;`,
      /question_unique|position_unique|duplicate/,
    );
    rejected(
      `declare promo uuid; fresh uuid; begin ${promotionSql('public.canonical_questions')} insert into public.canonical_questions (exam_pack_id, question_type, status, promotion_id) values ('${pack.packId}', 'SINGLE_CHOICE', 'PUBLISHED', promo) returning id into fresh; ${promotionSql('public.exam_occurrences')} ${occ} values ('${idAt(pack.modelIds, 0)}', '${idAt(other.sectionIds, 0)}', fresh, '${pack.packId}', 9, 'GENERATED', '${pack.sourceVersionId}', promo); end;`,
      /section_fk|foreign key/,
    );
    rejected(
      `update public.exam_occurrences set exam_pack_id = '${other.packId}' where id = '${idAt(pack.occurrenceIds, 0)}';`,
      /foreign key/,
    );
  });
});

// ---------------------------------------------------------------------------
// 4 · Convención de concept_key bajo estrés (ADR-009 v1.1 §A)
// ---------------------------------------------------------------------------

describe('concept_key · determinismo, normalización y neutralidad', () => {
  const key = (slug: string, title: string) =>
    one<{ k: string }>(`select ingest.concept_key('${slug}', '${title.replace(/'/g, "''")}') as k`)
      .k;
  const expected = (slug: string, title: string) =>
    createHash('sha256')
      .update(`${slug}\n${title.normalize('NFC')}`, 'utf8')
      .digest('hex')
      .slice(0, 8);

  it('reproduce la misma huella que una implementación independiente (SHA-256 sobre slug\\nNFC(título))', () => {
    for (const [slug, title] of [
      ['fixture-a', 'Configuración de redes: DHCP'],
      ['fixture-a', 'Señales & ruido — µ/σ'],
      ['otro-pack', 'Configuración de redes: DHCP'],
      ['fixture-a', 'straße Ærø Œuvre naïve'],
    ] as const) {
      const k = key(slug, title);
      expect(k.endsWith(`-${expected(slug, title)}`), `${slug}/${title} → ${k}`).toBe(true);
      expect(k).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$/);
    }
  });

  it('NFD y NFC del mismo título son la misma clave; títulos distintos nunca la comparten', () => {
    const composed = 'Configuración';
    const decomposed = composed.normalize('NFD');
    expect(decomposed).not.toBe(composed);
    expect(key('fixture-a', composed)).toBe(key('fixture-a', decomposed));
    // Casi idénticos: mismo slug, huella distinta (la identidad es del título exacto).
    const pairs: Array<[string, string]> = [
      ['Redes: DHCP', 'Redes DHCP'],
      ['DHCP', 'dhcp'],
      ['a  b', 'a b'],
      ['Configuración', 'Configuracion'],
    ];
    for (const [x, y] of pairs) {
      const kx = key('fixture-a', x);
      const ky = key('fixture-a', y);
      expect(kx.slice(0, -9), `${x}/${y}`).toBe(ky.slice(0, -9));
      expect(kx, `${x}/${y}`).not.toBe(ky);
    }
  });

  it('el mismo título en packs distintos da claves distintas; el código oficial no participa', () => {
    expect(key('fixture-a', 'Tema 1')).not.toBe(key('fixture-b', 'Tema 1'));
    const columns = query<{ column: string }>(
      "select column_name as column from information_schema.columns where table_schema = 'public' and table_name = 'concepts'",
    ).map((c) => c.column);
    expect(columns).not.toContain('official_code');
    expect(columns).toContain('concept_key');
  });

  it('títulos largos se cortan en frontera de palabra sin superar 40; sin caracteres latinos no hay slug', () => {
    const long = key(
      'fixture-a',
      'Un título extraordinariamente largo que supera con holgura los cuarenta caracteres',
    );
    expect(long.slice(0, -9).length).toBeLessThanOrEqual(40);
    expect(long.slice(0, -9).endsWith('-')).toBe(false);
    expect(key('fixture-a', '2024')).toMatch(/^2024-[0-9a-f]{8}$/);
    expect(key('fixture-a', '   Espacios   y   más   ')).toMatch(/^espacios-y-mas-[0-9a-f]{8}$/);
    const greek = attack("perform ingest.concept_key('fixture-a', 'Ελληνικά');");
    expect(greek.rejected).toBe(true);
    expect(greek.message).toMatch(/ADR-009/);
    const emoji = attack("perform ingest.concept_key('fixture-a', '🙂🙂');");
    expect(emoji.rejected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5 · Pack deliberadamente incómodo (EC-018 · ADR-010 v1.1)
// ---------------------------------------------------------------------------

describe('un pack con estructura materialmente distinta entra sin cambio de esquema', () => {
  const snapshot = () =>
    one<{ tables: number; columns: number; enums: number }>(
      "select (select count(*)::int from pg_tables where schemaname in ('public','content','ingest')) as tables, (select count(*)::int from information_schema.columns where table_schema in ('public','content','ingest')) as columns, (select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname in ('public','ingest')) as enums",
    );

  it('una sección única, cuatro modelos, dos convocatorias, reservas, 2 y 5 opciones, prerrequisitos en cadena y títulos con acentos', async () => {
    const before = snapshot();
    const slug = `${pack.slug}-awk`;
    const { targetId: packId } = await publish(admin, 'exam_pack', {
      slug,
      name: 'fixture: pack incómodo',
    });
    try {
      const { targetId: versionId } = await publish(admin, 'exam_pack_version', {
        exam_pack_id: packId,
        version_label: '2026-r1',
        effective_from: '2026-01-01',
        set_current: true,
      });
      const { targetId: blockId } = await publish(admin, 'syllabus_block', {
        exam_pack_version_id: versionId,
        code: 'UNICO',
        title: 'fixture: único bloque',
        sort_order: 1,
      });
      const { targetId: topicId } = await publish(admin, 'topic', {
        block_id: blockId,
        code: 'T-1',
        title: 'fixture: único tema',
        sort_order: 1,
      });
      const concepts: string[] = [];
      for (const [i, title] of [
        'fixture: Señalización & control — nivel µ',
        'fixture: Configuración avanzada (v2)',
        'fixture: 2024/2025 · normativa',
      ].entries()) {
        const { targetId } = await publish(admin, 'concept', { exam_pack_id: packId, title });
        concepts.push(targetId);
        await publish(admin, 'concept_version', {
          concept_id: targetId,
          exam_pack_version_id: versionId,
          topic_id: topicId,
          title,
          sort_order: i + 1,
        });
      }
      await publish(admin, 'concept_prerequisite', {
        concept_id: idAt(concepts, 1),
        prerequisite_concept_id: idAt(concepts, 0),
      });
      await publish(admin, 'concept_prerequisite', {
        concept_id: idAt(concepts, 2),
        prerequisite_concept_id: idAt(concepts, 1),
      });
      const { targetId: sourceId } = await publish(admin, 'source', {
        title: 'fixture: fuente incómoda',
        authority: 'fixture',
        source_type: 'FIXTURE',
        provenance_class: 'GENERATED',
      });
      const { targetId: sourceVersionId } = await publish(admin, 'source_version', {
        source_id: sourceId,
        version_label: 'única',
        effective_from: '2026-01-01',
      });
      const questions: string[] = [];
      for (const optionCount of [2, 5, 4]) {
        const { targetId: questionId } = await publish(admin, 'question', {
          exam_pack_id: packId,
          question_type: optionCount === 2 ? 'TRUE_FALSE' : 'SINGLE_CHOICE',
        });
        await publish(admin, 'question_representation', {
          question_id: questionId,
          stem: `fixture: pregunta con ${optionCount} opciones`,
          provenance_class: 'GENERATED',
          source_version_id: sourceVersionId,
          options: Array.from({ length: optionCount }, (_, i) => ({
            option_key: String.fromCharCode(65 + i),
            body: `fixture: opción ${i + 1}`,
          })),
        });
        await publish(admin, 'answer_key_version', {
          question_id: questionId,
          correct_option_key: 'B',
          key_status: 'PROVISIONAL',
          source_version_id: sourceVersionId,
          effective_from: '2026-01-01',
        });
        await publish(admin, 'question_concept', {
          question_id: questionId,
          concept_id: idAt(concepts, questions.length),
          exam_pack_version_id: versionId,
          relationship_type: 'PRIMARY',
          weight: 1,
        });
        questions.push(questionId);
      }
      const { targetId: sectionId } = await publish(admin, 'exam_section', {
        exam_pack_id: packId,
        code: 'UNICA',
        title: 'fixture: sección única',
        sort_order: 1,
      });
      let placed = 0;
      for (const [s, date] of ['2026-03-01', '2026-09-01'].entries()) {
        const { targetId: sittingId } = await publish(admin, 'exam_sitting', {
          exam_pack_id: packId,
          sitting_date: date,
          call_label: `conv-${s + 1}`,
          source_version_id: sourceVersionId,
        });
        for (const model of ['M1', 'M2', 'M3', 'M4']) {
          const { targetId: modelId } = await publish(admin, 'exam_sitting_model', {
            sitting_id: sittingId,
            model_code: model,
            source_version_id: sourceVersionId,
          });
          for (const [q, questionId] of questions.entries()) {
            await publish(admin, 'exam_occurrence', {
              sitting_model_id: modelId,
              section_id: sectionId,
              question_id: questionId,
              display_no: q + 1,
              is_reserve: q === questions.length - 1,
              provenance_class: 'GENERATED',
              source_version_id: sourceVersionId,
            });
            placed += 1;
          }
        }
      }
      expect(placed).toBe(2 * 4 * 3);
      const { data } = await admin
        .from('exam_occurrences')
        .select('is_reserve')
        .eq('exam_pack_id', packId);
      expect((data ?? []).filter((o) => o.is_reserve)).toHaveLength(8);
      // Sin prácticos: el esquema no los exige.
      const { count } = await admin
        .from('practicals')
        .select('id', { count: 'exact', head: true })
        .eq('exam_pack_id', packId);
      expect(count).toBe(0);
      expect(snapshot()).toEqual(before);
    } finally {
      const deleted = await purgePack(admin, packId);
      expect(deleted['exam_packs']).toBe(1);
    }
    expect(snapshot()).toEqual(before);
  }, 240_000);

  it('el pack purgado no deja contenido canónico, solo su auditoría GENERATED', async () => {
    const { data } = await admin.from('exam_packs').select('id').like('slug', `${pack.slug}-awk`);
    expect(data ?? []).toHaveLength(0);
    const row = one<{ n: number }>(
      "select count(*)::int as n from ingest.promotions p where p.target_table = 'public.exam_packs' and not exists (select 1 from public.exam_packs e where e.id = p.target_id) and p.provenance_class is distinct from 'GENERATED' and p.provenance_class is not null",
    );
    expect(row.n).toBe(0);
  });
});

describe('sanidad del arnés de ataque', () => {
  it('un ataque que prospera se detecta como tal y no deja residuo', () => {
    const outcome = attack(
      `insert into ingest.promotions (target_table) values ('public.exam_sections');`,
    );
    expect(outcome.rejected).toBe(false);
    const row = one<{ n: number }>(
      "select count(*)::int as n from ingest.promotions where target_table = 'public.exam_sections' and target_id is null",
    );
    expect(row.n).toBe(0);
    expect(pack.packId).toMatch(UUID);
  });
});
