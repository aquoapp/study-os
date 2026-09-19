import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `phase3_1.freeze.spec` · Phase 3.1 · FROZEN · PASS WITH DEBT.
 *
 * Vigila el registro de congelación de la corrección D-26, sin relajar ninguna guarda existente:
 *
 *   - `phase-3-v1.0` sigue siendo el tag inmutable de Phase 3, y el registro no reescribe que
 *     contenía el defecto;
 *   - `phase-3-v1.1` identifica el merge de implementación de Phase 3.1, cuyo árbol es el del
 *     candidato aceptado;
 *   - la frontera de invocación congelada (migración 21 y su rollback) no cambia en silencio;
 *   - D-26 está cerrada **solo** en Phase 3.1;
 *   - la congelación no autoriza Phase 4.
 *
 * Donde el clon tiene los tags —local, o cualquier clon completo— las identidades se comprueban
 * también contra Git. El checkout superficial de CI no trae tags: ahí la comprobación mecánica es
 * la de los hashes congelados y el registro, que no dependen de la red.
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const sha256 = (relative: string) =>
  createHash('sha256')
    .update(readFileSync(join(REPO_ROOT, relative)))
    .digest('hex');

const ACCEPTED_CANDIDATE = '04d4669719e75ab172e80da712ea7e155b3352bd';
const ACCEPTED_TREE = 'bd1c9c5c3e6a553f52f312de8de81cf21b5d5f30';
const IMPLEMENTATION_MERGE = '577cc711e017f1fb48ba881ea34288d865317429';
const TAG_V11_OBJECT = '284ba3e01d3f025b56223f29e0bccfaa459ef040';
const TAG_V10_OBJECT = 'fbd9530ec548db6f16958955f05337a2b3d87e2c';
const PHASE_3_MERGE = 'f5d0b101b58bae4d1003ea91f15ff0ecfe924f97';

/** Huellas de la frontera congelada en `phase-3-v1.1`. Una migración aplicada no se edita. */
const FROZEN_BOUNDARY: Record<string, string> = {
  'supabase/migrations/00000000000021_engine_invocation_boundary.sql':
    '2df2183a00b1c93060b29cbd74fba8e0da21c4750aaf47f791ca89f721b94a32',
  'supabase/migrations/down/00000000000021_engine_invocation_boundary.down.sql':
    'bbb26752fe4f2e54948b3d53ad88db3a60c9a2015b0c317ddbccb075c66ea8f0',
};

function gitTagsAvailable(): boolean {
  if (!existsSync(join(REPO_ROOT, '.git'))) return false;
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', 'phase-3-v1.1^{commit}'], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

describe('Phase 3.1 · el registro de congelación no confunde los SHA', () => {
  const checkpoint = flat(read('docs/PHASE_3_1_CHECKPOINT.md'));
  const state = flat(read('docs/ARCHITECTURE_STATE.md'));

  it('registra candidato, árbol, merge, padres, tags y la identidad de árbol', () => {
    expect(checkpoint).toContain('PHASE 3.1 · FROZEN · PASS WITH DEBT');
    expect(checkpoint).toContain('PHASE 3.1 · FINAL CANDIDATE · HUMAN ACCEPTANCE: APPROVED');
    for (const sha of [
      ACCEPTED_CANDIDATE,
      ACCEPTED_TREE,
      IMPLEMENTATION_MERGE,
      TAG_V11_OBJECT,
      TAG_V10_OBJECT,
      '64158b5ad19e1edcc76c21f3dd50e86e884db058',
    ]) {
      expect(checkpoint, `falta ${sha}`).toContain(sha);
    }
    expect(checkpoint).toContain('pela a `577cc71` (el merge de implementación');
    expect(checkpoint).toContain('**==** árbol del candidato');
    expect(state).toContain('**PHASE 3.1 · FROZEN · PASS WITH DEBT.**');
  });

  it('phase-3-v1.0 sigue siendo el tag de Phase 3 y conserva D-26 como historia', () => {
    expect(checkpoint).toContain(
      '`phase-3-v1.0`, objeto `fbd9530ec548db6f16958955f05337a2b3d87e2c` → `f5d0b10`, **sin mover**',
    );
    expect(checkpoint).toContain('contiene D-26 como historia');
    // El registro de Phase 3 no se reescribe: sigue diciendo lo que decía al congelarse.
    const phase3 = flat(read('docs/PHASE_3_CHECKPOINT.md'));
    expect(phase3).toContain(PHASE_3_MERGE);
    expect(phase3).not.toContain('D-26');
  });

  it('D-26 está cerrada solo en Phase 3.1', () => {
    expect(checkpoint).toContain('**D-26** | **CERRADA el 2026-09-17**');
    expect(checkpoint).toContain('**D-26 · CERRADA.**');
    expect(state).toContain('**D-26 cerrada.**');
    expect(flat(read('docs/PHASE_3_CHECKPOINT.md'))).not.toMatch(/D-26[^|]*CERRADA/);
  });

  it('la deuda al congelar es la aceptada y las tres observaciones viajan', () => {
    expect(checkpoint).toContain('Sin cambio: **D-13, D-18, D-20, D-22, D-23**');
    expect(checkpoint).toContain('**WATCH-P2-1** heredado');
    for (const obs of ['OBS-3.1-01', 'OBS-3.1-02', 'OBS-3.1-03']) {
      expect(checkpoint).toContain(obs);
    }
    expect(checkpoint).toContain(
      'OBS-3.1-01 sigue siendo una observación: no autoriza ningún cambio en Vercel',
    );
  });

  it('la congelación no autoriza Phase 4 ni ninguna decisión H-P4', () => {
    expect(checkpoint).toContain('No autoriza Phase 4, ninguna de H-P4-1 … H-P4-7');
    expect(state).toContain('Phase 4 y las decisiones H-P4-1 … H-P4-7 **siguen sin autorizar**');
    // El aterrizaje de gobernanza de Phase 4A (2026-09-17) acepta P4-D1 y difiere P4-D2, de modo
    // que CLAUDE.md ya no puede decir que ninguna decisión H-P4 está aceptada. Lo que la
    // congelación de Phase 3.1 sigue exigiendo es que el **BUILD** de Phase 4 no esté autorizado.
    expect(flat(read('CLAUDE.md'))).toContain(
      'Phase 4A · Planner Domain / Decision Engine · gobernanza aterrizada el 2026-09-17. El BUILD no',
    );
  });
});

describe('Phase 3.1 · la frontera congelada no cambia en silencio', () => {
  for (const [file, hash] of Object.entries(FROZEN_BOUNDARY)) {
    it(`${file} conserva su huella`, () => {
      expect(sha256(file)).toBe(hash);
    });
  }

  it.runIf(gitTagsAvailable())(
    'la frontera del árbol de trabajo es la del tag phase-3-v1.1',
    () => {
      for (const file of Object.keys(FROZEN_BOUNDARY)) {
        expect(git('rev-parse', `phase-3-v1.1:${file}`)).toBe(git('hash-object', file));
      }
    },
  );
});

describe('Phase 3.1 · identidades en Git, donde el clon trae los tags', () => {
  const available = gitTagsAvailable();

  it.runIf(available)('phase-3-v1.1 pela al merge de implementación con el árbol aceptado', () => {
    expect(git('rev-parse', 'phase-3-v1.1')).toBe(TAG_V11_OBJECT);
    expect(git('rev-parse', 'phase-3-v1.1^{commit}')).toBe(IMPLEMENTATION_MERGE);
    expect(git('rev-parse', 'phase-3-v1.1^{tree}')).toBe(ACCEPTED_TREE);
    expect(git('rev-parse', `${IMPLEMENTATION_MERGE}^2`)).toBe(ACCEPTED_CANDIDATE);
  });

  it.runIf(available)('phase-3-v1.0 no se ha movido', () => {
    expect(git('rev-parse', 'phase-3-v1.0')).toBe(TAG_V10_OBJECT);
    expect(git('rev-parse', 'phase-3-v1.0^{commit}')).toBe(PHASE_3_MERGE);
  });
});
