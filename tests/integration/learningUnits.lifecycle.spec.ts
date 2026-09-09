import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSyntheticPack,
  publish,
  purgePack,
  stage,
  validate,
  type SyntheticPack,
} from '../support/phase1a-fixtures';
import {
  accept,
  createLearner,
  createSession,
  eventFor,
  itemAt,
  itemEvent,
  publishLearningUnit,
  reject,
  type Learner,
} from '../support/phase2-fixtures';
import { attack, one, query } from '../support/sql';
import {
  adminClient,
  anonClient,
  deleteTestUser,
  readTestEnv,
  type TestEnv,
} from '../support/supabase-test-env';

/**
 * `learningUnits.lifecycle.spec` · H-FPS-1 (opción A) · CDEM §6 capa 1 · ADR-007 v1.1 ·
 * EC-001, EC-008, INV-110 · gate P2-G2.
 *
 * Las unidades de aprendizaje entran en Phase 2 como **adenda de contenido canónico**: por
 * la misma frontera `ingest` de Phase 1A, con identidad estable y contenido versionado e
 * inmutable, con procedencia y sin ninguna ruta de escalado. Solo contenido `GENERATED`
 * sintético: el corpus oficial es de Phase 1B y no entra en este repositorio.
 */

let env: TestEnv;
let admin: ReturnType<typeof adminClient>;
let pack: SyntheticPack;
let ana: Learner;
let unitId = '';
let versionId = '';

beforeAll(async () => {
  env = readTestEnv();
  admin = adminClient(env);
  pack = await buildSyntheticPack(admin, 'p2units');
  ana = await createLearner(env, 'units', pack);
  const published = await publishLearningUnit(admin, pack, 0, 'alfa');
  unitId = published.unitId;
  versionId = published.versionId;
}, 300_000);

afterAll(async () => {
  if (ana) await deleteTestUser(env, ana.id);
  if (pack) await purgePack(admin, pack.packId);
}, 120_000);

describe('la unidad entra por la frontera de ingestión, no por escritura directa', () => {
  it('la publicación deja identidad, versión y promoción enlazadas', () => {
    const unit = one<{
      status: string;
      concept_id: string;
      exam_pack_id: string;
      promotion_id: string;
    }>(
      `select status::text as status, concept_id, exam_pack_id, promotion_id from public.learning_units where id = '${unitId}'`,
    );
    expect(unit.status).toBe('PUBLISHED');
    expect(unit.exam_pack_id).toBe(pack.packId);
    expect(unit.concept_id).toBe(pack.conceptIds[0]);
    expect(unit.promotion_id).toMatch(/^[0-9a-f-]{36}$/);

    const version = one<{
      version_no: number;
      status: string;
      provenance_class: string;
      superseded_by_version_id: string | null;
      published_at: string | null;
    }>(
      `select version_no, status::text as status, provenance_class::text as provenance_class, superseded_by_version_id, published_at from public.learning_unit_versions where id = '${versionId}'`,
    );
    expect(Number(version.version_no)).toBe(1);
    expect(version.status).toBe('PUBLISHED');
    expect(version.provenance_class).toBe('GENERATED');
    expect(version.superseded_by_version_id).toBeNull();
    expect(version.published_at).not.toBeNull();
  });

  it('la promoción registra el destino real y el actor (PI-1A-6)', () => {
    const promo = one<{ target_table: string; target_id: string; promoted_by: string }>(
      `select target_table, target_id, promoted_by from ingest.promotions where target_id = '${versionId}'`,
    );
    expect(promo.target_table).toBe('public.learning_unit_versions');
    expect(promo.promoted_by).not.toBe('');
  });

  it('el rol de servicio no puede insertar una unidad por el Data API: solo la frontera publica', async () => {
    const { error } = await admin.from('learning_units').insert({
      exam_pack_id: pack.packId,
      concept_id: pack.conceptIds[0],
      unit_type: 'LESSON',
    });
    expect(error).not.toBeNull();
  });

  it('un concepto de otro pack no puede colgar de esta unidad', async () => {
    const otro = await buildSyntheticPack(admin, 'p2units2');
    try {
      const staged = await stage(admin, 'learning_unit', {
        exam_pack_id: pack.packId,
        concept_id: otro.conceptIds[0],
        unit_type: 'LESSON',
      });
      expect(await validate(admin, staged)).toBe('VALIDATED');
      // La validación no lo ve; la publicación sí, porque la integridad es de la base.
      const { error } = await admin.rpc('publish_staged_item', { p_id: staged });
      expect(error).not.toBeNull();
    } finally {
      await purgePack(admin, otro.packId);
    }
  });
});

describe('el contenido publicado es inmutable y se corrige por supersesión (SD-021 por analogía)', () => {
  it('una versión nueva supersede a la anterior y el número crece', async () => {
    const { targetId: second } = await publish(admin, 'learning_unit_version', {
      learning_unit_id: unitId,
      title: 'fixture: unidad alfa corregida',
      body: 'fixture: cuerpo corregido, sin contenido real.',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
    });
    const chain = one<{
      first_superseded_by: string;
      second_no: number;
      second_supersedes: string;
    }>(
      `select (select superseded_by_version_id from public.learning_unit_versions where id = '${versionId}') as first_superseded_by,
              (select version_no from public.learning_unit_versions where id = '${second}') as second_no,
              (select supersedes_version_id from public.learning_unit_versions where id = '${second}') as second_supersedes`,
    );
    expect(chain.first_superseded_by).toBe(second);
    expect(Number(chain.second_no)).toBe(2);
    expect(chain.second_supersedes).toBe(versionId);
    // Exactamente una versión vigente por unidad.
    const current = one<{ n: number }>(
      `select count(*)::int as n from public.learning_unit_versions where learning_unit_id = '${unitId}' and status = 'PUBLISHED' and superseded_by_version_id is null`,
    );
    expect(Number(current.n)).toBe(1);
  });

  it('el texto de una versión publicada no se reescribe', () => {
    const edited = attack(
      `update public.learning_unit_versions set body = 'reescrito' where id = '${versionId}';`,
    );
    expect(edited.rejected, edited.message).toBe(true);
    expect(edited.message).toContain('H-FPS-1');
    const retitled = attack(
      `update public.learning_unit_versions set title = 'reescrito' where id = '${versionId}';`,
    );
    expect(retitled.rejected, retitled.message).toBe(true);
  });

  it('una versión publicada no se borra: se retira (DI-1A-3)', () => {
    const deleted = attack(`delete from public.learning_unit_versions where id = '${versionId}';`);
    expect(deleted.rejected, deleted.message).toBe(true);
  });

  it('el enlace de supersesión no puede apuntar a otra unidad ni retroceder', () => {
    const otraUnidad = attack(
      `insert into public.learning_units (exam_pack_id, concept_id, unit_type, status, promotion_id)
         select '${pack.packId}', '${pack.conceptIds[1]}', 'LESSON', 'PUBLISHED', promotion_id from public.learning_units where id = '${unitId}'
         returning id;
       insert into public.learning_unit_versions (learning_unit_id, version_no, title, body, provenance_class, status, supersedes_version_id, promotion_id)
         select (select id from public.learning_units where concept_id = '${pack.conceptIds[1]}' limit 1), 1, 'x', 'y', 'GENERATED', 'DRAFT', '${versionId}', promotion_id from public.learning_unit_versions where id = '${versionId}';`,
    );
    expect(otraUnidad.rejected, otraUnidad.message).toBe(true);
  });

  it('la clase de procedencia es inmutable: no hay ruta GENERATED → OFFICIAL (PI-1A-4)', async () => {
    // Sobre una versión **publicada** el escalado lo detiene antes la inmutabilidad del
    // contenido (H-FPS-1), que también cubre la procedencia. Para probar el trigger de
    // procedencia por sí mismo hace falta una fila donde el otro no se interponga: una
    // versión en borrador, que sí admite cambios de otro tipo.
    const { targetId: draft } = await publish(admin, 'learning_unit_version', {
      learning_unit_id: unitId,
      title: 'fixture: borrador para el ataque de procedencia',
      body: 'fixture: cuerpo en preparación.',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
      status: 'DRAFT',
    });
    const onDraft = attack(
      `update public.learning_unit_versions set provenance_class = 'OFFICIAL' where id = '${draft}';`,
    );
    expect(onDraft.rejected, onDraft.message).toBe(true);
    expect(onDraft.message).toContain('PI-1A-4');

    // Y sobre la publicada el escalado tampoco pasa, aunque el guardián sea el otro.
    const onPublished = attack(
      `update public.learning_unit_versions set provenance_class = 'OFFICIAL' where id = '${versionId}';`,
    );
    expect(onPublished.rejected, onPublished.message).toBe(true);
    expect(onPublished.message).toMatch(/PI-1A-4|H-FPS-1/);
  });

  it('una unidad OFFICIAL sin fuente primaria OFFICIAL queda en cuarentena (INV-110)', async () => {
    const staged = await stage(admin, 'learning_unit_version', {
      learning_unit_id: unitId,
      title: 'fixture: unidad que se declara oficial',
      body: 'fixture: cuerpo sin fuente oficial.',
      provenance_class: 'OFFICIAL',
      source_version_id: pack.sourceVersionId,
    });
    expect(await validate(admin, staged)).toBe('QUARANTINE');
    const reason = one<{ reason: string }>(
      `select reason from ingest.staged_items where id = '${staged}'`,
    );
    expect(reason.reason).toContain('INV-110');
  });

  it('una unidad con marcador de corrección se rechaza (SI-1A-5)', async () => {
    const staged = await stage(admin, 'learning_unit_version', {
      learning_unit_id: unitId,
      title: 'fixture: unidad con marcador',
      body: 'fixture: cuerpo.',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
      correct_option: 'A',
    });
    expect(await validate(admin, staged)).toBe('REJECTED');
  });

  it('título o cuerpo vacíos se rechazan', async () => {
    const staged = await stage(admin, 'learning_unit_version', {
      learning_unit_id: unitId,
      title: '',
      body: 'fixture: cuerpo.',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
    });
    expect(await validate(admin, staged)).toBe('REJECTED');
  });
});

describe('lectura de cliente: lo publicado sí, lo demás no', () => {
  it('el aprendiz lee la unidad y sus versiones publicadas; anon no lee nada', async () => {
    const unit = await ana.client.from('learning_units').select('id, unit_type').eq('id', unitId);
    expect(unit.error).toBeNull();
    expect(unit.data).toHaveLength(1);
    const versions = await ana.client
      .from('learning_unit_versions')
      .select('id, title, version_no')
      .eq('learning_unit_id', unitId);
    expect(versions.error).toBeNull();
    expect((versions.data ?? []).length).toBeGreaterThanOrEqual(2);

    const anon = await anonClient(env).from('learning_units').select('id').limit(1);
    expect(anon.data ?? []).toHaveLength(0);
  });

  it('una versión en borrador no es visible para el aprendiz', async () => {
    const { targetId: draft } = await publish(admin, 'learning_unit_version', {
      learning_unit_id: unitId,
      title: 'fixture: borrador no visible',
      body: 'fixture: cuerpo en preparación.',
      provenance_class: 'GENERATED',
      source_version_id: pack.sourceVersionId,
      status: 'DRAFT',
    });
    const visible = await ana.client.from('learning_unit_versions').select('id').eq('id', draft);
    expect(visible.error).toBeNull();
    expect(visible.data).toHaveLength(0);
    // Y el borrador no desplaza a la vigente.
    const current = one<{ n: number }>(
      `select count(*)::int as n from public.learning_unit_versions where learning_unit_id = '${unitId}' and status = 'PUBLISHED' and superseded_by_version_id is null`,
    );
    expect(Number(current.n)).toBe(1);
  });
});

describe('la unidad como destino de sesión (ADR-007 v1.1)', () => {
  it('un ítem LEARNING_UNIT registra la versión exactamente presentada y se completa', async () => {
    const session = await createSession(ana, [{ item_type: 'LEARNING_UNIT', target_id: unitId }]);
    await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
    const item = itemAt(session, 0);
    const current = one<{ id: string }>(
      `select id from public.learning_unit_versions where learning_unit_id = '${unitId}' and status = 'PUBLISHED' and superseded_by_version_id is null`,
    );
    await accept(
      ana,
      itemEvent(ana, session, item, 'LEARNING_UNIT_VIEWED', {
        learning_unit_version_id: current.id,
      }),
    );
    const stored = one<{ v: string }>(
      `select presented_learning_unit_version_id as v from public.session_items where id = '${item.session_item_id}'`,
    );
    expect(stored.v).toBe(current.id);

    // Otra versión sobre el mismo ítem ya presentado se rechaza (SD-023 por analogía).
    await reject(
      ana,
      itemEvent(ana, session, item, 'LEARNING_UNIT_VIEWED', {
        learning_unit_version_id: versionId,
      }),
      'REPRESENTATION_MISMATCH',
    );

    await accept(ana, itemEvent(ana, session, item, 'LEARNING_UNIT_COMPLETED'));
    const completed = one<{ status: string }>(
      `select status::text as status from public.session_items where id = '${item.session_item_id}'`,
    );
    expect(completed.status).toBe('COMPLETED');
  });

  it('una unidad referenciada por un ítem no se puede borrar (ON DELETE RESTRICT)', () => {
    const deleted = attack(`delete from public.learning_units where id = '${unitId}';`);
    expect(deleted.rejected, deleted.message).toBe(true);
  });

  it('una versión inexistente o de otra unidad no se puede declarar presentada', async () => {
    const session = await createSession(ana, [{ item_type: 'LEARNING_UNIT', target_id: unitId }]);
    await accept(ana, eventFor(ana, session, 'SESSION_STARTED'));
    await reject(
      ana,
      itemEvent(ana, session, itemAt(session, 0), 'LEARNING_UNIT_VIEWED', {
        learning_unit_version_id: '00000000-0000-4000-8000-000000000000',
      }),
      'UNIT_VERSION_NOT_PUBLISHED',
    );
  });
});

describe('higiene de fixtures: las unidades sintéticas se purgan con su pack', () => {
  it('todo el contenido de unidades del pack es GENERATED', () => {
    const noGenerated = query<{ n: number }>(
      `select count(*)::int as n from public.learning_unit_versions v join public.learning_units u on u.id = v.learning_unit_id where u.exam_pack_id = '${pack.packId}' and v.provenance_class <> 'GENERATED'`,
    );
    expect(Number(noGenerated[0]?.n)).toBe(0);
  });

  it('la purga se niega mientras exista evidencia que referencie la unidad', async () => {
    // El ítem de sesión creado arriba referencia la unidad con RESTRICT: la purga del pack
    // no puede llevarse por delante contenido que la evidencia de un aprendiz todavía
    // resuelve. Se limpia al borrar la cuenta (afterAll), y solo entonces.
    const { error } = await admin.rpc('purge_generated_pack', { p_pack_id: pack.packId });
    expect(error).not.toBeNull();
    const stillThere = one<{ n: number }>(
      `select count(*)::int as n from public.learning_units where id = '${unitId}'`,
    );
    expect(Number(stillThere.n)).toBe(1);
  });
});
