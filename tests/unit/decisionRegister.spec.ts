import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `decisionRegister.spec` · los registros vivos no afirman estados caducados.
 *
 * ---------------------------------------------------------------------------
 * Qué vigila este fichero
 *
 * El 2026-09-07 cinco decisiones dejaron de estar pendientes: SD-007, SD-006,
 * SD-018, BD-02 (SD-002) y BD-05 (SD-001), con ADR-006 … ADR-010 como propietarios
 * normativos, y SD-015 quedó superseded. Un documento vivo que siga diciendo
 * «SD-018 PROPOSED», «SD-007 pendiente» o «BD-02 abierta» describe un estado que ya
 * no existe; y uno que presente `server_sequence` como contrato vigente describe
 * un diseño descartado.
 *
 * Tres reglas:
 *
 *   1. en los ficheros vivos, toda línea que mencione una de esas decisiones junto
 *      a una palabra de estado caducado debe llevar una marca de historicidad;
 *   2. `server_sequence` solo puede aparecer como diseño superseded;
 *   3. los ficheros importados de Phase −1 que siguen diciendo «pendiente» no se
 *      editan —su hash lo demuestra— y se leen como cronología, no como estado.
 *
 * Y el estado que sí debe afirmarse, se afirma: la matriz de aceptación está en
 * cada registro vivo con el mismo propietario normativo.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const sha256 = (relative: string) =>
  createHash('sha256')
    .update(readFileSync(join(REPO_ROOT, relative)))
    .digest('hex');

const PACKET_SHA256 = '6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d';

/** Ficheros vivos: se editan en cada checkpoint y describen el estado operativo. */
const LIVING = [
  'docs/ARCHITECTURE_STATE.md',
  'docs/GOVERNING_DOCUMENTS.md',
  'docs/PHASE_0_CHECKPOINT.md',
  'docs/PROVENANCE.md',
  'docs/DEPENDENCY_PROPOSAL.md',
  'CLAUDE.md',
  'README.md',
  'packages/domain/src/authority.ts',
  'packages/domain/src/authority-registry.json',
  'supabase/config.toml',
  'supabase/functions/README.md',
  'architecture/ADR-006-answer-key-data-api-boundary.md',
  'architecture/ADR-007-enforceable-item-targets.md',
  'architecture/ADR-008-per-user-event-order-and-idempotency.md',
  'architecture/ADR-009-stable-concept-identity.md',
  'architecture/ADR-010-official-exam-occurrences.md',
  'architecture/ADR-011-schema-topology-and-data-api-exposure.md',
];

const PHASE_1A_PACKET_SHA256 = '806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4';

/** El SPEC_DIFF_LOG es vivo solo en su adenda: las primeras 174 líneas son el cuerpo congelado. */
const FROZEN_BODY_LINES = 174;
const FROZEN_BODY_SHA256 = '4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3';

/** Importados de Phase −1 que no se editan. Hashes de `docs/PROVENANCE.md` §2, literales. */
const FROZEN_IMPORTS: Record<string, string> = {
  'docs/PHASE_0_EXECUTION_PLAN.md':
    'd7371a2e31cc7ea1ddbd5ef7505d962ad2625c9c81035520d7e386ac20164d57',
  'docs/PHASE_MINUS_1_INDEX.md': '769c24175400db4e5fb5359025fbf509cbecd8e088fc09e3ca1a5cf79cd8b415',
  'spec/contradiction-register.md':
    'f4953721d2ddc1148987c7a324547bc4b8b71207d472a7149540f1dbbf5bf2d3',
  'spec/domain-model.md': 'e1f028e1bbcbd8c2f4ca7b87bcef5f816da254bb932a393ce72d9ca4522d3203',
};

const DECISIONS = ['SD-018', 'SD-015', 'SD-007', 'SD-006', 'SD-002', 'SD-001', 'BD-02', 'BD-05'];

const STALE_STATUS =
  /\b(PROPOSED|PROPUEST[OA]|pendiente|sin aprobar|pending|abierta|abiertas|open|sin decidir|sin cerrar)\b/i;

/**
 * Marcas que convierten una mención en cronología. La lista es cerrada a propósito:
 * si una frase nueva necesita otra marca, se añade aquí y queda a la vista.
 */
const HISTORICAL =
  /(histórico|histórica|históricamente|historical|cronología|\bera\b|decía|quedó|ronda anterior|superseded|sustituid[oa]|cuerpo congelado|congelad[oa]|ya no|dejó de|dejaron de|resuelt[oa]|cerrad[oa]s? el 2026-09-07|hasta el 2026-09-07|antes del 2026-09-07|no se ha editado|no se han editado)/i;

const SUPERSEDED_SEQUENCE =
  /(superseded|no operativ|histórico|proponía|no menciona|no existe|no se implementa|descartad)/i;

function livingLines(relative: string): Array<[number, string]> {
  const lines = read(relative).split('\n');
  const start = relative === 'docs/SPEC_DIFF_LOG.md' ? FROZEN_BODY_LINES : 0;
  return lines.slice(start).map((line, index) => [start + index + 1, line]);
}

describe('ningún registro vivo afirma un estado caducado', () => {
  for (const relative of [...LIVING, 'docs/SPEC_DIFF_LOG.md']) {
    it(`${relative} · toda mención caducada lleva marca de historicidad`, () => {
      const offenders: string[] = [];
      for (const [number, line] of livingLines(relative)) {
        const mentions = DECISIONS.some((id) => line.includes(id));
        if (!mentions || !STALE_STATUS.test(line)) continue;
        if (HISTORICAL.test(line)) continue;
        offenders.push(`${relative}:${number}: ${line.trim()}`);
      }
      expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it(`${relative} · server_sequence solo como diseño superseded`, () => {
      const offenders: string[] = [];
      for (const [number, line] of livingLines(relative)) {
        if (!line.includes('server_sequence')) continue;
        if (SUPERSEDED_SEQUENCE.test(line)) continue;
        offenders.push(`${relative}:${number}: ${line.trim()}`);
      }
      expect(offenders, offenders.join('\n')).toEqual([]);
    });
  }
});

describe('la matriz de aceptación es la misma en todos los registros', () => {
  const MATRIX: Array<[string, string]> = [
    ['SD-007', 'ADR-006'],
    ['SD-006', 'ADR-007'],
    ['SD-018', 'ADR-008'],
    ['BD-02', 'ADR-009'],
    ['BD-05', 'ADR-010'],
  ];

  it('SPEC_DIFF_LOG · registro de aceptación con propietario normativo', () => {
    const addendum = read('docs/SPEC_DIFF_LOG.md').split('\n').slice(FROZEN_BODY_LINES).join('\n');
    expect(addendum).toContain('### Registro de aceptación');
    expect(addendum).toContain(PACKET_SHA256);
    for (const [row, adr] of [
      ['SD-001', 'ADR-010'],
      ['SD-002', 'ADR-009'],
      ['SD-006', 'ADR-007'],
      ['SD-007', 'ADR-006'],
      ['SD-018', 'ADR-008'],
    ]) {
      const re = new RegExp(
        `^\\| \\*\\*${row}\\*\\*[^\\n]*ACCEPTED · NOT IMPLEMENTED[^\\n]*${adr}`,
        'm',
      );
      expect(addendum, `${row} → ${adr}`).toMatch(re);
    }
    expect(addendum).toMatch(/^\| \*\*SD-015\*\*[^\n]*SUPERSEDED BY SD-018 \/ ADR-008/m);
  });

  it('SPEC_DIFF_LOG · el cuerpo congelado conserva su hash', () => {
    const head = read('docs/SPEC_DIFF_LOG.md').split('\n').slice(0, FROZEN_BODY_LINES).join('\n');
    expect(createHash('sha256').update(`${head}\n`).digest('hex')).toBe(FROZEN_BODY_SHA256);
  });

  it('SPEC_DIFF_LOG · SD-020 y SD-021 constan ACCEPTED con el registro de Phase 1A', () => {
    const addendum = read('docs/SPEC_DIFF_LOG.md').split('\n').slice(FROZEN_BODY_LINES).join('\n');
    expect(addendum).toContain('## SD-020 ·');
    expect(addendum).toContain('## SD-021 ·');
    expect(addendum).toContain(PHASE_1A_PACKET_SHA256);
    expect(addendum).toContain('tras la Phase 1A Build Authorization');
    expect(addendum).toMatch(/^\| C-1 \| ADR-011[^\n]*`ACCEPTED`/m);
    expect(addendum).toMatch(/^\| C-6 \| ADR-005[^\n]*sigue `PROPOSED`/m);
  });

  it('ARCHITECTURE_STATE · ADR-006 … ADR-011 ACCEPTED, ADR-001 … ADR-005 PROPOSED', () => {
    const state = read('docs/ARCHITECTURE_STATE.md');
    for (const adr of ['ADR-006', 'ADR-007', 'ADR-008', 'ADR-009', 'ADR-010', 'ADR-011']) {
      expect(state).toMatch(new RegExp(`^\\| ${adr} \\|[^\\n]*ACCEPTED`, 'm'));
    }
    for (const adr of ['ADR-001', 'ADR-002', 'ADR-003', 'ADR-004', 'ADR-005']) {
      expect(state).toMatch(new RegExp(`^\\| ${adr} \\|[^\\n]*PROPOSED`, 'm'));
    }
    expect(state).toContain('ACCEPTED · NOT IMPLEMENTED');
    expect(state).not.toContain('Ninguna decisión está ACCEPTED');
    for (const [decision, adr] of MATRIX) {
      expect(state, `${decision} → ${adr}`).toMatch(new RegExp(`${decision}[^\\n]*${adr}`));
    }
  });

  it('GOVERNING_DOCUMENTS · SD-018 y las decisiones de dominio constan aceptadas', () => {
    const doc = read('docs/GOVERNING_DOCUMENTS.md');
    expect(doc).toContain('ACCEPTED · NOT IMPLEMENTED');
    for (const [decision, adr] of MATRIX) {
      expect(doc, `${decision} → ${adr}`).toMatch(new RegExp(`${decision}[^\\n]*${adr}`));
    }
  });

  it('PHASE_0_CHECKPOINT · PASS WITH DEBT solo por deuda registrada; gates con su vocabulario', () => {
    const checkpoint = read('docs/PHASE_0_CHECKPOINT.md');
    expect(checkpoint).toContain('STATUS: PASS WITH DEBT');
    expect(checkpoint).not.toContain('STATUS: BLOCKED');
    expect(checkpoint).toContain(PACKET_SHA256);
    expect(checkpoint).toMatch(/^\| \*\*P0-G1\*\*[^\n]*\*\*PASS\*\*/m);
    // Ronda de infraestructura (2026-09-08): P0-G2 y P0-G4 tienen evidencia real.
    expect(checkpoint).toMatch(/^\| \*\*P0-G2\*\*[^\n]*\*\*PASS\*\*/m);
    expect(checkpoint).toMatch(/^\| \*\*P0-G3\*\*[^\n]*\*\*PASS\*\*/m);
    expect(checkpoint).toMatch(/^\| \*\*P0-G4\*\*[^\n]*\*\*PASS\*\*/m);
    expect(checkpoint).toMatch(/^\| \*\*P0-G5\*\*[^\n]*\*\*PASS\*\*/m);

    // Las filas de la tabla de deuda son deuda técnica, nunca decisiones de dominio.
    const section = checkpoint.slice(
      checkpoint.indexOf('## Por qué PASS WITH DEBT'),
      checkpoint.indexOf('## 0.'),
    );
    const rows = section.split('\n').filter((line) => line.startsWith('| **'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row, row).not.toMatch(/SD-018|SD-007|SD-006|BD-02|BD-05/);
    }
    for (const [decision, adr] of MATRIX) {
      expect(checkpoint, `${decision} → ${adr}`).toMatch(new RegExp(`${decision}[^\\n]*${adr}`));
    }
    expect(checkpoint).toContain('Phase 1 no');
  });

  it('CLAUDE.md, authority.ts, config.toml y functions/README dicen lo mismo', () => {
    expect(read('CLAUDE.md')).toContain('ADR-006');
    expect(read('CLAUDE.md')).toContain('ACCEPTED · NOT');
    expect(read('packages/domain/src/authority.ts')).toContain('ACCEPTED · NOT IMPLEMENTED');
    expect(read('packages/domain/src/authority.ts')).toContain('ADR-008');
    expect(read('supabase/config.toml')).toContain('ADR-006');
    expect(read('supabase/functions/README.md')).toContain('ADR-006');
  });
});

describe('lo importado de Phase −1 se lee como cronología y no se edita', () => {
  for (const [relative, hash] of Object.entries(FROZEN_IMPORTS)) {
    it(`${relative} conserva su hash de importación`, () => {
      expect(sha256(relative)).toBe(hash);
    });
  }

  it('PROVENANCE registra el hash actual de los ADR anotados y el del registro de decisión', () => {
    const provenance = read('docs/PROVENANCE.md');
    expect(provenance).toContain(PACKET_SHA256);
    for (const relative of [
      'architecture/ADR-001-stack-and-boundaries.md',
      'architecture/ADR-002-canonical-evidence-events.md',
      'architecture/ADR-005-provenance-and-official-versioning.md',
    ]) {
      expect(provenance, `${relative}: hash actual no registrado`).toContain(sha256(relative));
    }
  });
});
