import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `adr.acceptedDecisions.spec` · los ADR aceptados y lo que dejan intacto.
 *
 * Revisado el 2026-09-09 (Phase 1A Build Authorization, decisión C-7): ADR-011 es el sexto
 * ADR aceptado; ADR-009 y ADR-010 llevan un anexo v1.1 aceptado; la frontera «aceptar no
 * es implementar» pasa a vigilar solo lo que sigue sin autorizar (Phase 2 en adelante).
 *
 * ---------------------------------------------------------------------------
 * Qué vigila este fichero
 *
 * El 2026-09-07 Ana Victoria aprobó cinco decisiones —SD-007, SD-006, SD-018,
 * BD-02 y BD-05— mediante `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md`. Cada
 * una tiene **un único propietario normativo**: ADR-006 … ADR-010, versión 1.0,
 * `ACCEPTED`, y **sin implementar**. Nada más fue aprobado: ADR-001 … ADR-005
 * siguen `PROPOSED`, y solo sus puntos solapados apuntan al ADR que los sustituye.
 *
 * Estas pruebas verifican tres cosas distintas:
 *
 *   1. que cada ADR aceptado dice lo que la decisión aprobada dice —estado,
 *      aprobación, propiedad y las cláusulas vinculantes—;
 *   2. que los ADR existentes no han cambiado de estado y que los que no se
 *      tocaron conservan su hash congelado;
 *   3. que **nada** de lo aceptado ha llegado al esquema: aceptar no es implementar.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const sha256 = (relative: string) =>
  createHash('sha256')
    .update(readFileSync(join(REPO_ROOT, relative)))
    .digest('hex');

const PACKET_SHA256 = '6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d';
const BASELINE = '8823c2bdf2d31ec01a2f15b1566a94c1ad0eb04a';

const ACCEPTED: Array<{ file: string; owns: string; decision: string }> = [
  {
    file: 'architecture/ADR-006-answer-key-data-api-boundary.md',
    owns: 'OWNS: **SD-007**',
    decision: 'SD-007',
  },
  {
    file: 'architecture/ADR-007-enforceable-item-targets.md',
    owns: 'OWNS: **SD-006**',
    decision: 'SD-006',
  },
  {
    file: 'architecture/ADR-008-per-user-event-order-and-idempotency.md',
    owns: 'OWNS: **SD-018**',
    decision: 'SD-018',
  },
  {
    file: 'architecture/ADR-009-stable-concept-identity.md',
    owns: 'OWNS: **BD-02 / SD-002**',
    decision: 'BD-02 / SD-002',
  },
  {
    file: 'architecture/ADR-010-official-exam-occurrences.md',
    owns: 'OWNS: **BD-05 / SD-001**',
    decision: 'BD-05 / SD-001',
  },
];

const PHASE_1A_PACKET_SHA256 = '806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4';

/** ADR aceptados cuya implementación autoriza la Phase 1A Build Authorization. */
const PHASE_1A_AUTHORIZED = new Set([
  'architecture/ADR-006-answer-key-data-api-boundary.md',
  'architecture/ADR-009-stable-concept-identity.md',
  'architecture/ADR-010-official-exam-occurrences.md',
]);

const PROPOSED = [
  'architecture/ADR-001-stack-and-boundaries.md',
  'architecture/ADR-002-canonical-evidence-events.md',
  'architecture/ADR-003-mastery-vs-readiness.md',
  'architecture/ADR-004-offline-reconciliation.md',
  'architecture/ADR-005-provenance-and-official-versioning.md',
];

/** Hashes de importación de `docs/PROVENANCE.md` §2, escritos literalmente. */
const FROZEN_UNTOUCHED: Record<string, string> = {
  'architecture/ADR-000-template.md':
    '383782a8bbf69333c7f3d0c97b47d2993098f623a73728636580e76bd2886103',
  'architecture/ADR-003-mastery-vs-readiness.md':
    '4155d6d2b54caad99c9bc5ce4bd5c5e5fce9f5f66ec6f3410ff2942d52c3cf4a',
  'architecture/ADR-004-offline-reconciliation.md':
    'f7a9833f787d2d3e939f54d9b758bf1ec0a8c9f7bbd97454b6529a5a0c4518fd',
};

const TEMPLATE_SECTIONS = [
  '## Context',
  '## Decision',
  '## Alternatives considered',
  '## Consequences',
  '## Product impact',
  '## Data/migration impact',
  '## Security impact',
  '## Test/acceptance impact',
  '## Rollback',
  '## Human approval',
];

describe('ADR-006 … ADR-010 · aceptados, con aprobación y propietario', () => {
  it('existen exactamente doce ficheros en architecture/: plantilla + once ADR', () => {
    const files = readdirSync(join(REPO_ROOT, 'architecture')).sort();
    expect(files).toHaveLength(12);
    for (const { file } of ACCEPTED) expect(files).toContain(file.replace('architecture/', ''));
    expect(files).toContain('ADR-011-schema-topology-and-data-api-exposure.md');
  });

  for (const { file, owns, decision } of ACCEPTED) {
    describe(file, () => {
      const text = read(file);

      it('es ACCEPTED, v1.0 o v1.1 con anexo aceptado el 2026-09-09', () => {
        expect(text).toMatch(/^STATUS: ACCEPTED · v1\.(0|1)/m);
        if (/^STATUS: ACCEPTED · v1\.1/m.test(text)) {
          expect(text).toContain('## Anexo v1.1');
          expect(text).toContain('ACCEPTED 2026-09-09');
          expect(text).toContain(PHASE_1A_PACKET_SHA256);
        }
        expect(text).toMatch(/^DATE: 2026-09-07$/m);
        expect(text).toMatch(/^DECISION OWNER: Ana Victoria$/m);
      });

      it('lo aprobó Ana Victoria el 2026-09-07 mediante el registro de decisión', () => {
        expect(text).toMatch(/^Approved by: Ana Victoria$/m);
        expect(text).toMatch(/^Date: 2026-09-07$/m);
        expect(text).toContain('STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md');
        expect(text).toContain(PACKET_SHA256);
        expect(text).toContain(BASELINE);
      });

      it('es el propietario normativo único de su decisión', () => {
        expect(text).toContain(owns);
        expect(text).toContain('propietario normativo único');
        // Y nadie más reclama esa decisión.
        const claimants = [...ACCEPTED.map((entry) => entry.file), ...PROPOSED].filter((other) =>
          read(other).includes(owns),
        );
        expect(claimants, `más de un propietario para ${decision}`).toEqual([file]);
      });

      it('registra la decisión como ACCEPTED · NOT IMPLEMENTED y un estado de implementación explícito', () => {
        expect(text).toContain('ACCEPTED · NOT IMPLEMENTED');
        // Phase 1A (2026-09-09) autoriza implementar ADR-006, ADR-009 y ADR-010; ADR-007 y
        // ADR-008 siguen sin implementar hasta Phase 2 y Phase 4.
        if (PHASE_1A_AUTHORIZED.has(file)) {
          expect(text).toMatch(/^IMPLEMENTATION STATUS: AUTHORIZED · Phase 1A/m);
        } else {
          expect(text).toMatch(/^IMPLEMENTATION STATUS: NOT IMPLEMENTED/m);
          expect(text).toContain('no autoriza ninguna migración');
        }
      });

      it('acota la aprobación a gobernanza', () => {
        expect(text).toContain('no autoriza migraciones');
        expect(text).toContain('ni Phase 1');
      });

      it('sigue la plantilla ADR-000', () => {
        for (const section of TEMPLATE_SECTIONS) {
          expect(text, `falta ${section}`).toContain(`${section}\n`);
        }
      });
    });
  }
});

describe('ADR-011 · aceptado el 2026-09-09 por la Phase 1A Build Authorization', () => {
  const text = read('architecture/ADR-011-schema-topology-and-data-api-exposure.md');

  it('es v1.0, ACCEPTED, de Ana Victoria, con el registro de decisión de Phase 1A', () => {
    expect(text).toMatch(/^STATUS: ACCEPTED · v1\.0$/m);
    expect(text).toMatch(/^DATE: 2026-09-09$/m);
    expect(text).toMatch(/^DECISION OWNER: Ana Victoria$/m);
    expect(text).toMatch(/^Approved by: Ana Victoria$/m);
    expect(text).toMatch(/^Date: 2026-09-09$/m);
    expect(text).toContain(PHASE_1A_PACKET_SHA256);
    expect(text).toMatch(/^IMPLEMENTATION STATUS: AUTHORIZED · Phase 1A/m);
  });

  it('sigue la plantilla ADR-000', () => {
    for (const section of TEMPLATE_SECTIONS) {
      expect(text, `falta ${section}`).toContain(`${section}\n`);
    }
  });

  it('fija la frontera: public expuesto, content e ingest no expuestos, lista gobernada', () => {
    const flatText = flat(text);
    for (const needle of [
      '`public` es la única superficie expuesta',
      '`content` es un esquema no expuesto',
      '`ingest` es un esquema no expuesto',
      'La lista de exposición es explícita, gobernada y probada',
      'dataApi.exposedSchemas',
      'dataApi.nonExposedSchemas',
      'La exposición automática permanece desactivada',
      'no tienen `USAGE` sobre `content` ni `ingest`',
      'SECURITY DEFINER',
      'cambio de frontera de seguridad',
    ]) {
      expect(flatText, `falta: ${needle}`).toContain(needle);
    }
  });

  it('el registro de autoridad declara la misma lista', () => {
    const registry = JSON.parse(read('packages/domain/src/authority-registry.json')) as {
      dataApi: { exposedSchemas: string[]; nonExposedSchemas: string[] };
    };
    expect(registry.dataApi.exposedSchemas).toEqual(['public']);
    expect(registry.dataApi.nonExposedSchemas).toEqual(['content', 'ingest']);
  });
});

describe('las cláusulas vinculantes están escritas, no resumidas', () => {
  it('ADR-006 · la frontera de claves', () => {
    const text = flat(read('architecture/ADR-006-answer-key-data-api-boundary.md'));
    for (const needle of [
      'fuera de todo esquema expuesto a clientes no confiables',
      'antes del envío de la respuesta',
      'INV-116',
      'answer_key_version_id',
      'clave reutilizable',
      'anon',
      'authenticated',
      'devuelve la clave reutilizable ni un payload del que la respuesta correcta pueda derivarse',
      'ADR-001 punto 3',
      'ADR-005 punto 4',
      'Ratifica INV-101',
    ]) {
      expect(text, `falta: ${needle}`).toContain(needle);
    }
  });

  it('ADR-007 · destinos tipados con CHECK de exclusividad y matriz', () => {
    const text = flat(read('architecture/ADR-007-enforceable-item-targets.md'));
    for (const needle of [
      'Una columna de clave foránea tipada y nullable por cada destino admitido',
      'exige exactamente un destino',
      'corresponde al `item_type` declarado',
      'Ningún `item_ref_id` genérico, ninguna referencia en JSON y ninguna validación solo de aplicación',
      'Añadir un tipo de destino exige migración',
      'PRERREQUISITO DE IMPLEMENTACIÓN',
      '| Tipo de ítem (nombre recomendado) | Columna FK → tabla | Clasificación | Regla de propiedad | `ON DELETE` | `session_items` | `planner_items` |',
      'learning_unit_id → learning_units(id)',
      'question_id → canonical_questions(id)',
      'practical_id → practicals(id)',
      'concept_id → concepts(id)',
      'ADR-002 punto 6',
    ]) {
      expect(text, `falta: ${needle}`).toContain(needle);
    }
    // La regla de no invención: lo no determinado se marca, no se inventa.
    expect(text).toContain('no enumeran los valores de `item_type`');
    expect(text).toContain('ni fijan el comportamiento de borrado');
  });

  it('ADR-008 · los once puntos, question_attempts y la canonicalización', () => {
    const text = flat(read('architecture/ADR-008-per-user-event-order-and-idempotency.md'));
    for (const needle of [
      'monotónica y sin huecos',
      'unique(user_id, stream_position)',
      'FOR UPDATE',
      'El bloqueo del contador precede a la comprobación de `event_id`',
      'coinciden `user_id` y el hash del payload canónico completo',
      'sin avanzar el contador',
      'es un conflicto de integridad',
      'Solo para un evento nuevo se reserva la posición y se inserta, en la misma transacción',
      'Ningún `ON CONFLICT DO NOTHING` después de asignar la posición',
      'revierte la transacción entera, incluido el contador',
      'Tras el rollback, una transacción nueva recupera el evento existente',
      'por usuario y por proyección',
      'conserva `client_created_at` y dispara recálculo sin reescribir la historia',
      'Ninguna ausencia se declara definitiva por timeout',
      'bloquear el contador del par `(user_id, question_id)`',
      'comprobar `submitted_event_id`',
      'triple coincidencia',
      'answer_payload_hash',
      'sin asignar número nuevo',
      'no consume ningún `attempt_number`',
      'contrato de canonicalización versionado',
      'el orden de claves',
      'la normalización de cadenas',
      'el tratamiento de nulos',
      'el orden de las colecciones',
      'conjunto completo de campos',
      'identificador del algoritmo y de la versión del contrato',
      'SUPERSEDED BY SD-018 / ADR-008',
      'ADR-002 v1.2** no se acepta tal como está',
    ]) {
      expect(text, `falta: ${needle}`).toContain(needle);
    }
  });

  it('ADR-009 · identidad estable en dos capas, con el anexo v1.1', () => {
    const text = flat(read('architecture/ADR-009-stable-concept-identity.md'));
    for (const needle of [
      '<slug>-<hash8>',
      '(exam_pack_id, concept_key)',
      'copy_forward_question_concepts',
      'PENDING_REVALIDATION',
      'identidades estables, mismo pack, sin autorreferencia',
      '(exam_pack_id, concept_key)',
      'inmutable una vez referenciada',
      'concept_versions',
      'se indexa por la identidad estable',
      'versionados o con vigencia',
      'Retiro explícito',
      'split',
      'merge',
      'Sin transferencia silenciosa de mastery',
      'Política de recálculo o reinicio declarada antes de publicar',
      'Exam Pack → Version → Block → Topic → Concept',
    ]) {
      expect(text, `falta: ${needle}`).toContain(needle);
    }
  });

  it('ADR-010 · convocatorias y ocurrencias, con el anexo v1.1', () => {
    const text = flat(read('architecture/ADR-010-official-exam-occurrences.md'));
    for (const needle of [
      'exam_sections',
      'exam_sitting_models',
      'sin enum global',
      '(sitting_model_id, section_id, display_no)',
      '(sitting_model_id, question_id)',
      'is_reserve boolean NOT NULL',
      'exam_sittings',
      'exam_occurrences',
      'estado de reserva',
      'pueden compartir una pregunta canónica',
      'son independientes',
      'posiciones oficiales duplicadas',
      'no duplicados canónicos',
      'metadato de procedencia',
      'ADR-006 fija su frontera de exposición; este ADR no la redefine',
      'ADR-005 punto 5',
      '270 preguntas canónicas, 405 ocurrencias, 30',
    ]) {
      expect(text, `falta: ${needle}`).toContain(needle);
    }
  });
});

describe('ADR-001 … ADR-005 · siguen PROPOSED, con referencias precisas', () => {
  for (const file of PROPOSED) {
    it(`${file} sigue PROPOSED y no se ha marcado ACCEPTED`, () => {
      const text = read(file);
      expect(text).toMatch(/^STATUS: PROPOSED/m);
      expect(text).not.toMatch(/^STATUS: ACCEPTED/m);
      expect(text).toMatch(/^Approved by:\s*$/m);
    });
  }

  it('ADR-001 subordina su punto 3 a ADR-006', () => {
    const text = read('architecture/ADR-001-stack-and-boundaries.md');
    expect(text).toContain('subordinado a ADR-006');
    expect(text).toMatch(/^3\. \*\*\[SUBORDINADO a ADR-006/m);
  });

  it('ADR-002 señala a ADR-007 y a ADR-008 y deja SD-015 superseded', () => {
    const text = read('architecture/ADR-002-canonical-evidence-events.md');
    expect(text).toContain('superseded por ADR-007');
    expect(text).toContain('superseded por ADR-008');
    expect(text).toContain('SUPERSEDED BY SD-018 / ADR-008');
    expect(text).toMatch(/^6\. \*\*\[SUPERSEDED por ADR-007/m);
    expect(text).toMatch(/^10\. \*\*\[NO OPERATIVO · superseded por ADR-008/m);
    expect(text).toContain(
      '[NO OPERATIVO · superseded por ADR-008 · texto histórico]** La normalización',
    );
  });

  it('ADR-002 solo menciona `server_sequence` en texto marcado como no operativo', () => {
    const text = read('architecture/ADR-002-canonical-evidence-events.md');
    const noteStart = text.indexOf('> **Nota de supersesión parcial');
    const noteEnd = text.indexOf('## Context');
    const point10 = text.indexOf('10. **[NO OPERATIVO');
    const afterDecision = text.indexOf('## Alternatives considered');
    expect(noteStart).toBeGreaterThan(-1);
    expect(point10).toBeGreaterThan(-1);

    const re = /server_sequence/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const index = match.index;
      const inNote = index > noteStart && index < noteEnd;
      const inPoint10 = index > point10 && index < afterDecision;
      expect(inNote || inPoint10, `server_sequence operativo en el índice ${index}`).toBe(true);
    }
  });

  it('ADR-005 subordina su punto 4 a ADR-006 y su punto 5 a ADR-010', () => {
    const text = read('architecture/ADR-005-provenance-and-official-versioning.md');
    expect(text).toMatch(/^4\. \*\*\[SUBORDINADO a ADR-006/m);
    expect(text).toMatch(/^5\. \*\*\[SUPERSEDED por ADR-010/m);
    expect(text).toContain('referencia** esa frontera; no la duplica');
  });

  for (const [file, hash] of Object.entries(FROZEN_UNTOUCHED)) {
    it(`${file} conserva su hash de importación`, () => {
      expect(sha256(file)).toBe(hash);
    });
  }
});

describe('aceptar no es implementar · lo que sigue sin autorizar tras Phase 1A', () => {
  const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
  const sqlFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => join(migrationsDir, name));

  /**
   * Phase 1A (2026-09-09) autoriza `answer_key_versions`, `concept_versions`,
   * `concept_key`, `exam_sittings` y `exam_occurrences`. Lo de ADR-007 (migraciones 7 y
   * 11, Phase 2 y 4) y lo de ADR-008 (migraciones 8, 9 y 16, Phase 2) sigue prohibido.
   */
  const tables = [
    'session_items',
    'planner_items',
    'study_sessions',
    'learning_units',
    'user_event_counters',
    'projection_watermarks',
    'stream_position',
    'answer_payload_hash',
    'question_attempts',
    'learning_events',
    'concept_mastery',
    'exam_readiness',
  ];

  for (const table of tables) {
    it(`ninguna migración menciona ${table}`, () => {
      for (const file of sqlFiles) {
        expect(readFileSync(file, 'utf8').toLowerCase(), file).not.toContain(table);
      }
    });
  }

  it('no existe ninguna Edge Function', () => {
    const entries = readdirSync(join(REPO_ROOT, 'supabase', 'functions'));
    expect(entries).toEqual(['README.md']);
  });
});
