import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import registry from '../../packages/domain/src/authority-registry.json';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `phase4a.freeze.spec` · Phase 4A · FROZEN · PASS WITH DEBT.
 *
 * Vigila la congelación de Phase 4A sin relajar ninguna guarda existente:
 *
 *   - `phase-4a-v1.0` identifica el merge de **implementación** (PR #19), cuyo árbol es el del
 *     candidato aceptado, y no el merge de esta congelación documental;
 *   - las migraciones 22 y 23 y sus rollback no cambian en silencio;
 *   - lo aceptado sigue aceptado: P4-D5 es la última evidencia negativa, P4-D6 la proyecta el motor,
 *     `NO_PUBLISHED_UNIT` está ratificado, la errata E-P4A-1 está cerrada, y la unicidad de sesión
 *     abierta es **global** (EC-019), no solo del Planner;
 *   - lo diferido sigue diferido: P4-D2, P4-G2 en su partición exacta, P4-G18 en Phase 4B;
 *   - la congelación no autoriza Phase 4B ni expone el esquema del motor.
 *
 * Donde el clon trae los tags, las identidades se comprueban contra Git. El checkout superficial
 * de CI no los trae: ahí la comprobación es la de las huellas y el registro, sin red ni secretos.
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const sha256 = (relative: string) =>
  createHash('sha256')
    .update(readFileSync(join(REPO_ROOT, relative)))
    .digest('hex');

const ACCEPTED_CANDIDATE = '120d166ecd5928445e773bc141ee04f8a0ed7c6f';
const ACCEPTED_TREE = 'ea6a228a45d661ca1e89bdf8afee37dd8907c5b6';
const BASE = 'a96cafc86830238ae813e80763530f0455ee56ac';
const IMPLEMENTATION_MERGE = '5a8f6038537fc8fce5dc092ec472ec4b2a418f91';
const TAG_OBJECT = 'dd78090f586caef15b196d5a5ec3faf9af650592';

/** Tags históricos: objeto anotado → commit al que pelan. Ninguno se mueve. */
const HISTORICAL_TAGS: Record<string, [string, string]> = {
  'phase-0-v1.0': [
    '59b0e62ccfa5e89d3080056131279b00fe3320b8',
    '5d8296c1776be778b075d9e239b383a0476a6514',
  ],
  'phase-1a-v1.0': [
    '2c3e72812180e1a2d9b6e4d53321fe6dc3c39bd5',
    'be5a26ade5ac384a572d62568d7ac29fd2a568f6',
  ],
  'phase-2-v1.0': [
    '3df518eb26da4e1838284e136bfe46258f079190',
    '46b8fcd705e32c86ed6ddac225cd50f80e4faca9',
  ],
  'fps-v1.0': [
    'bc73147851b8d7bd9fd10e938621e90e68eafbc3',
    '6bde0a045532c8ffb2769c0a24d4bbb94958dd57',
  ],
  'phase-3-v1.0': [
    'fbd9530ec548db6f16958955f05337a2b3d87e2c',
    'f5d0b101b58bae4d1003ea91f15ff0ecfe924f97',
  ],
  'phase-3-v1.1': [
    '284ba3e01d3f025b56223f29e0bccfaa459ef040',
    '577cc711e017f1fb48ba881ea34288d865317429',
  ],
};

/** Huellas de las migraciones congeladas en `phase-4a-v1.0`. Una migración aplicada no se edita. */
const FROZEN_MIGRATIONS: Record<string, string> = {
  'supabase/migrations/00000000000022_engine_last_negative_position.sql':
    '4702b00e917f915fe65953ad81a3d95c847fc9985f2f7464e4a3d29c1c86d630',
  'supabase/migrations/down/00000000000022_engine_last_negative_position.down.sql':
    'b53356d106068cd63b2d15e7750db946cf5a333a36575ba8d33e634776242128',
  'supabase/migrations/00000000000023_planner_domain.sql':
    'e3d2eb8b78389fbe7c65734f4072f5684dcbc1d39e756c7c6059e2d97acad0bb',
  'supabase/migrations/down/00000000000023_planner_domain.down.sql':
    '859082ae71a60256605275b2c22020887c2d2ab88eacc569c2784be766707dc9',
};

function gitTagsAvailable(): boolean {
  if (!existsSync(join(REPO_ROOT, '.git'))) return false;
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', 'phase-4a-v1.0^{commit}'], {
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

describe('Phase 4A · el registro de congelación no confunde los SHA', () => {
  const checkpoint = flat(read('docs/PHASE_4A_CHECKPOINT.md'));
  const state = flat(read('docs/ARCHITECTURE_STATE.md'));

  it('registra candidato, árbol, base, merge, tag, paquete y la identidad de árbol', () => {
    expect(checkpoint).toContain('**PHASE 4A · FROZEN · PASS WITH DEBT.**');
    expect(checkpoint).toContain('**PHASE 4A · FINAL CANDIDATE · HUMAN ACCEPTANCE: APPROVED**');
    for (const sha of [
      ACCEPTED_CANDIDATE,
      ACCEPTED_TREE,
      BASE,
      IMPLEMENTATION_MERGE,
      TAG_OBJECT,
      '461ae82bfc073cb4ad8f59f1d6ea0e5fd6b9b9dd85850fa297b85fe57df54b72',
      'ffb27450abd03e91bd1952e4ade38d03b51d490121dec68586d1932a6328afce',
    ]) {
      expect(checkpoint, `falta ${sha}`).toContain(sha);
    }
    expect(checkpoint).toContain('**==** árbol del candidato');
    expect(checkpoint).toContain('**no** el de esta congelación documental');
    expect(state).toContain('**PHASE 4A · FROZEN · PASS WITH DEBT.**');
  });

  it('la deuda al congelar es la aceptada: tres cerradas, tres viajan, la heredada sin cambio', () => {
    expect(checkpoint).toContain('| **OBS-4A-B1**, **OBS-4A-B2**, **OBS-4A-B4** | **CERRADAS** |');
    expect(checkpoint).toContain(
      '| OBS-4A-B3, OBS-4A-B5, OBS-4A-B6 | viajan como vigilancia u observación |',
    );
    expect(checkpoint).toContain(
      '| D-13, D-18, D-20, D-22, D-23 · WATCH-P2-1 · OBS-3.1-01 | heredadas **sin cambio** |',
    );
  });

  // Corrección documental posterior a la congelación: el estado vivo no puede quedarse atrás.
  const lines = read('docs/ARCHITECTURE_STATE.md').split('\n');

  it('la línea base viva de `main` no apunta a una fase congelada anterior', () => {
    const live = lines.find((line) => line.startsWith('**Estado global:**')) ?? '';
    const baseline = /línea base congelada `main` = `([0-9a-f]{40})`/.exec(live)?.[1];
    expect(baseline, 'la línea «Estado global» no declara la línea base de `main`').toBeDefined();
    for (const [tag, [, merge]] of Object.entries(HISTORICAL_TAGS)) {
      expect(baseline, `la línea base viva es la de ${tag}`).not.toBe(merge);
    }
    expect(live).toContain('`phase-4a-v1.0`');
  });

  it('el inventario no da el Planner por candidato sin integrar', () => {
    const row = lines.find((line) => line.startsWith('| `packages/planner-engine` |')) ?? '';
    expect(row).not.toMatch(/sin integrar|Candidato en `phase\//);
    expect(row).toContain('**Integrado y congelado en Phase 4A**');
    expect(row).toContain('`phase-4a-v1.0`');
  });
});

describe('Phase 4A · lo aceptado sigue aceptado y lo diferido sigue diferido', () => {
  const contract = read('docs/PLANNER_CONTRACT.md');
  const migration23 = read('supabase/migrations/00000000000023_planner_domain.sql');
  const checkpoint = flat(read('docs/PHASE_4A_CHECKPOINT.md'));

  it('P4-D5 es la última evidencia negativa, más antigua primero, y P4-D6 la proyecta el motor', () => {
    expect(flat(contract)).toContain('**P4-D5 · `ACCEPTED` · última evidencia negativa**');
    expect(flat(contract)).toContain('la primera de **R** en el orden de §F.5');
    expect(read('packages/planner-engine/src/plan.ts')).toContain(
      'export function byLastNegative(a: PlannerConcept, b: PlannerConcept): number {',
    );
    expect(flat(read('docs/LEARNING_ENGINE_CONTRACT.md'))).toContain(
      '## 25 · Anexo v1.1 · posición de la última evidencia negativa · P4-D6',
    );
    // Ni último contacto ni sílabo como orden de la reparación.
    expect(read('packages/planner-engine/src/plan.ts')).not.toMatch(/lastContact|LAST_CONTACT/);
  });

  it('NO_PUBLISHED_UNIT sigue ratificado, nunca pendiente', () => {
    expect(migration23).not.toContain('pending_ratification');
    expect(migration23).toContain("'ratified', jsonb_build_object('NO_PUBLISHED_UNIT'");
  });

  it('E-P4A-1 sigue cerrada', () => {
    expect(contract).toContain('**FE DE ERRATAS:** **E-P4A-1**');
  });

  it('P4-G10 sigue siendo global: una sola sesión abierta por persona, para todo origen', () => {
    const code = migration23.replace(/--[^\n]*/g, '');
    expect(code).toMatch(
      /add constraint study_sessions_one_open_per_user\s+exclude using btree \(user_id with =\)\s+where \(status in \('PLANNED', 'ACTIVE', 'INTERRUPTED'\)\)\s+deferrable initially deferred/,
    );
    expect(code).not.toContain('check_planned_session_exclusive');
    expect(code).not.toMatch(/where \(status in \([^)]*\)\s+and planner_run_id/);
  });

  it('el cuerpo v1.4 conserva su redacción sobre P4-D2, ya superseded', () => {
    // **Retirada parcial por autorización · P4-G36.** P4-D2 quedó resuelta el 2026-09-20
    // (ADR-013), de modo que la guarda ya no puede afirmar que sigue diferida.
    //
    // Lo que sí sigue vigilando, y es lo que la congelación protege: el cuerpo v1.4 del contrato
    // **no se reescribe**. La frase original permanece literalmente dentro de su nota de
    // supersesión, como ADR-003, ADR-007, ADR-008 y ADR-011 conservaron las suyas.
    expect(flat(contract)).toContain('P4-D2 está deliberadamente diferida');
    expect(contract).toContain('SUPERSESIÓN PARCIAL');
    expect(flat(contract)).toContain('P4-D2');
    // El checkpoint de Phase 4A es historia y no se edita.
    expect(checkpoint).toContain(
      '**CONTRATO DE DOMINIO PROBADO · CAPTURA DE PRODUCTO DIFERIDA A 4B**',
    );
    expect(checkpoint).toContain('P4-G18 pertenece a Phase 4B');
  });

  it('la resolución de P4-D2 está registrada donde la gobernanza la pone', () => {
    // Lo que sustituye a la guarda retirada: la duración de producción existe **porque** hay una
    // decisión que la autoriza, con propietario normativo nombrado.
    expect(read('architecture/ADR-013-operational-duration-authority.md')).toContain('ACCEPTED');
    expect(read('docs/PHASE_4B_PREAUTHORIZATION.md')).toContain('P4-D2');
    expect(read('docs/SPEC_DIFF_LOG.md')).toContain('SD-033');
  });

  it('la congelación no autoriza Phase 4B ni expone el esquema del motor', () => {
    expect(checkpoint).toContain('**Phase 4B no está autorizada.**');
    expect(flat(read('CLAUDE.md'))).toContain('**Phase 4B, Phase 1B, corpus oficial, readiness');
    expect(registry.dataApi.exposedSchemas).toEqual(['public']);
    expect(registry.dataApi.nonExposedSchemas).toContain('engine');
    expect(registry.clientInvokableRpcs.names).toEqual([
      'append_learning_event',
      'create_study_session',
    ]);
  });
});

describe('Phase 4A · las migraciones congeladas no cambian en silencio', () => {
  for (const [file, hash] of Object.entries(FROZEN_MIGRATIONS)) {
    it(`${file} conserva su huella`, () => {
      expect(sha256(file)).toBe(hash);
    });
  }

  it.runIf(gitTagsAvailable())('las migraciones del árbol de trabajo son las del tag', () => {
    for (const file of Object.keys(FROZEN_MIGRATIONS)) {
      expect(git('rev-parse', `phase-4a-v1.0:${file}`)).toBe(git('hash-object', file));
    }
  });
});

describe('Phase 4A · identidades en Git, donde el clon trae los tags', () => {
  const available = gitTagsAvailable();

  it.runIf(available)('phase-4a-v1.0 pela al merge de implementación con el árbol aceptado', () => {
    expect(git('cat-file', '-t', 'phase-4a-v1.0')).toBe('tag');
    expect(git('rev-parse', 'phase-4a-v1.0')).toBe(TAG_OBJECT);
    expect(git('rev-parse', 'phase-4a-v1.0^{commit}')).toBe(IMPLEMENTATION_MERGE);
    expect(git('rev-parse', 'phase-4a-v1.0^{tree}')).toBe(ACCEPTED_TREE);
    expect(git('rev-parse', `${IMPLEMENTATION_MERGE}^1`)).toBe(BASE);
    expect(git('rev-parse', `${IMPLEMENTATION_MERGE}^2`)).toBe(ACCEPTED_CANDIDATE);
    expect(git('rev-parse', `${ACCEPTED_CANDIDATE}^{tree}`)).toBe(ACCEPTED_TREE);
  });

  it.runIf(available)('ningún tag histórico se ha movido', () => {
    for (const [tag, [object, commit]] of Object.entries(HISTORICAL_TAGS)) {
      expect(git('rev-parse', tag), tag).toBe(object);
      expect(git('rev-parse', `${tag}^{commit}`), tag).toBe(commit);
    }
  });
});
