import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import registry from '../../packages/domain/src/authority-registry.json';

import { REPO_ROOT, runGuard, withViolation } from './lib/run-guard';

/**
 * `phase2.governance.spec` · el aterrizaje de gobernanza de Phase 2 dice lo que debe.
 *
 * ---------------------------------------------------------------------------
 * Qué vigila este fichero
 *
 * La Phase 2 Build Authorization (2026-09-09) aceptó cinco actos de gobernanza y una
 * corrección obligatoria. Cada uno tiene un texto vinculante cuya pérdida reabriría la
 * decisión sin que nadie lo note:
 *
 *   1. ADR-007 v1.1 · exactamente cuatro `item_type` y `ON DELETE RESTRICT`;
 *   2. SD-022 · el contrato de canonicalización v1, con sus dos conjuntos de campos;
 *   3. SD-023 · `client_created_at` nunca elige representación ni clave; la cadena de
 *      autoridad presentada → verificada → resuelta en servidor;
 *   4. SD-008 · escala de confianza v1: cuatro niveles con sus etiquetas;
 *   5. el registro declara las RPC invocables por cliente y la guarda las trata como
 *      invocación directa con literal, igual que la allowlist de lectura.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

const PHASE_2_PACKET_SHA256 = 'da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67';
const log = read('docs/SPEC_DIFF_LOG.md');
const entry = (heading: string) => {
  const start = log.indexOf(heading);
  expect(start, `falta ${heading}`).toBeGreaterThanOrEqual(0);
  const rest = log.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
};

describe('ADR-007 v1.1 · anexo aceptado', () => {
  const text = read('architecture/ADR-007-enforceable-item-targets.md');
  const annex = text.slice(text.indexOf('## Anexo v1.1'));

  it('existe, cita el registro de decisión de Phase 2 y cierra D-12 (a)', () => {
    expect(text).toMatch(/^STATUS: ACCEPTED · v1\.1/m);
    expect(annex).toContain('ACCEPTED 2026-09-09');
    expect(annex).toContain(PHASE_2_PACKET_SHA256);
    expect(annex).toContain('H-P2-1');
    expect(annex).toContain('D-12 (a)');
  });

  it('fija exactamente cuatro item_type y ON DELETE RESTRICT en las cuatro claves', () => {
    const flatAnnex = flat(annex);
    expect(flatAnnex).toContain('**exactamente cuatro** valores');
    for (const value of ['`LEARNING_UNIT`', '`QUESTION`', '`PRACTICAL`', '`CONCEPT_REVIEW`']) {
      expect(flatAnnex).toContain(value);
    }
    expect(flatAnnex).toContain(
      '**`ON DELETE RESTRICT` en las cuatro claves foráneas de destino**',
    );
    const rows = annex
      .split('\n')
      .filter((line) => /^\| `(LEARNING_UNIT|QUESTION|PRACTICAL|CONCEPT_REVIEW)` \|/.test(line));
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row).toContain('**RESTRICT**');
    // Los tres candidatos no determinados siguen excluidos.
    expect(flatAnnex).toContain('**siguen excluidos**');
  });

  it('no autoriza planner_items ni motores', () => {
    expect(flat(annex)).toContain('**No autoriza** `planner_items` (Phase 4) ni ningún motor');
  });
});

describe('SD-022 · contrato de canonicalización v1', () => {
  const text = entry('## SD-022 · Contrato de canonicalización v1');
  const flatText = flat(text);

  it('está ACCEPTED con el registro de Phase 2 y no enmienda ADR-008', () => {
    expect(text).toContain('**`ACCEPTED`** · 2026-09-09');
    expect(text).toContain(PHASE_2_PACKET_SHA256);
    expect(flatText).toContain('**sin enmendarlo**');
  });

  const rules: Array<[string, string]> = [
    ['claves ordenadas por punto de código', 'punto de código Unicode'],
    ['cadenas en NFC', 'normalizadas a **NFC**'],
    ['escapes fijos', '`\\u00xx`'],
    ['ausente distinto de nulo', '**Ausente ≠ nulo:**'],
    ['arrays en orden recibido', 'los arrays conservan el orden recibido'],
    ['solo enteros', 'solo se admiten **enteros**'],
    ['UUID en minúsculas', 'los UUID se serializan en minúsculas'],
    ['instantes en UTC con milisegundos', 'AAAA-MM-DDTHH:MM:SS.sssZ'],
    ['SHA-256 en hexadecimal minúsculas', 'SHA-256 sobre los bytes UTF-8'],
    ['versión almacenada por fila', "`canonicalization_version` (`'v1'`)"],
  ];

  for (const [name, needle] of rules) {
    it(`regla · ${name}`, () => {
      expect(flatText, `falta: ${needle}`).toContain(needle);
    });
  }

  it('fija el conjunto exacto de campos del hash de evento', () => {
    const section = flatText.slice(flatText.indexOf('Conjunto de campos del hash de evento'));
    for (const field of [
      '`event_type`',
      '`schema_version`',
      '`session_id`',
      '`session_item_id`',
      '`device_id`',
      '`client_created_at`',
      '`client_sequence`',
      '`created_offline`',
      '`source_event_id`',
      '`payload`',
    ]) {
      expect(section, `falta ${field}`).toContain(field);
    }
    expect(section).toContain('`user_id` (se compara aparte');
    expect(section).toContain('`stream_position`, `server_received_at`');
  });

  it('fija el conjunto exacto de campos del hash de respuesta', () => {
    const section = flatText.slice(flatText.indexOf('Conjunto de campos del hash de respuesta'));
    for (const field of [
      '`question_id`',
      '`question_representation_id`',
      '`answer_kind`',
      '`selected_option_id`',
      '`presented_option_order`',
      '`confidence_value`',
      '`confidence_scale_version`',
      '`response_ms`',
      '`answer_key_version_id`',
    ]) {
      expect(section, `falta ${field}`).toContain(field);
    }
    expect(section).toContain('`attempt_number`, `is_correct_at_submission`, `correct_option_id`');
  });
});

describe('SD-023 · autoridad de representación y de tiempo', () => {
  const text = entry('## SD-023 · Autoridad de representación y de tiempo');
  const flatText = flat(text);

  it('está ACCEPTED, es aclaración y no activa STOP', () => {
    expect(text).toContain('**`ACCEPTED`** · 2026-09-09');
    expect(text).toContain(PHASE_2_PACKET_SHA256);
    expect(flatText).toContain('**aclarado, no enmendado**');
    expect(flatText).toContain('**No se activa STOP.**');
  });

  const clauses: Array<[string, string]> = [
    ['client_created_at nunca es autoridad', '**`client_created_at` nunca es autoridad**'],
    ['la presentación fija la representación', '`session_items.presented_representation_id`'],
    ['la discrepancia se rechaza', 'REPRESENTATION_MISMATCH'],
    ['sin presentación previa se rechaza', 'NOT_PRESENTED'],
    [
      'clave resuelta en servidor para la representación presentada',
      'en servidor y para la representación presentada',
    ],
    ['vigente en la aceptación por fechas del servidor', 'vigente en la aceptación'],
    ['sin clave no hay intento', 'NO_ANSWER_KEY'],
    [
      'prohibido el retroceso a la clave más reciente de la pregunta',
      '«la clave más reciente de la pregunta»',
    ],
    ['campos autoritativos rechazados', 'hace **malformado** el payload'],
    ['una clave AMENDED no reescribe', 'una clave `AMENDED` posterior no reescribe'],
  ];

  for (const [name, needle] of clauses) {
    it(`contrato · ${name}`, () => {
      expect(flatText, `falta: ${needle}`).toContain(needle);
    });
  }

  it('declara las pruebas de regresión exigidas por la corrección §2', () => {
    for (const spec of [
      'attempt.representationAuthority.presentedWins.spec',
      'attempt.representationAuthority.mismatchRejected.spec',
      'attempt.clockManipulation.spec',
      'attempt.clientAuthoritativeFields.rejected.spec',
      'attempt.keyAmendmentDoesNotRewrite.spec',
      'attempt.notPresented.rejected.spec',
      'attempt.noAnswerKey.rejected.spec',
    ]) {
      expect(text, `${spec} no está declarada`).toContain(spec);
    }
  });
});

describe('SD-008 · escala de confianza v1 (BD-03)', () => {
  const text = entry('## SD-008 · **aceptación**');

  it('está ACCEPTED con cuatro niveles, versión v1 y etiquetas canónicas', () => {
    expect(text).toContain('**`ACCEPTED`** · 2026-09-09');
    expect(text).toContain(PHASE_2_PACKET_SHA256);
    expect(flat(text)).toContain('**Cuatro niveles**, versión de escala **`v1`**');
    for (const [value, label] of [
      ['1', 'Nada segura'],
      ['2', 'Dudosa'],
      ['3', 'Bastante'],
      ['4', 'Segura'],
    ]) {
      expect(text).toMatch(new RegExp(`^\\s*\\| ${value} \\| ${label} \\|`, 'm'));
    }
    expect(flat(text)).toContain('`confidence_value` y `confidence_scale_version`');
    expect(flat(text)).toContain(
      'rechaza un valor fuera de la escala y cualquier versión que no esté `ACTIVE`',
    );
  });
});

describe('registro de autoridad · RPC invocables por cliente (H-P2-3)', () => {
  const clientRpcs = registry.clientInvokableRpcs;

  it('declara exactamente append_learning_event y create_study_session, con contrato', () => {
    expect(clientRpcs.names).toEqual(['append_learning_event', 'create_study_session']);
    for (const name of clientRpcs.names) {
      const contract = clientRpcs.contracts[name as keyof typeof clientRpcs.contracts];
      expect(contract, `${name} sin contrato`).toBeDefined();
      expect(contract.identity).toContain('auth.uid()');
      expect(contract.writes.length).toBeGreaterThan(0);
      expect(contract.rejects).toContain('user_id');
    }
    // Los campos autoritativos de SD-023 punto 4 se rechazan en la RPC de evidencia.
    for (const field of [
      'stream_position',
      'server_received_at',
      'attempt_number',
      'is_correct_at_submission',
      'correct_option_id',
      'answer_key_version_id',
    ]) {
      expect(clientRpcs.contracts.append_learning_event.rejects).toContain(field);
    }
  });

  it('no se solapa con las RPC reservadas al servidor ni con la allowlist de lectura', () => {
    for (const name of clientRpcs.names) {
      expect(registry.rpcs.names).not.toContain(name);
      expect(registry.readOnlyRpcs.names).not.toContain(name);
    }
  });

  it('la guarda admite una RPC invocable por cliente solo como invocación directa con literal', () => {
    const allowed = withViolation(
      'apps/web/src/app/_rpc-client-invokable.tsx',
      [
        "'use client';",
        "import { createSupabaseBrowserClient } from '../lib/supabase/browser-client';",
        'export async function guardar(payload: unknown) {',
        '  const supabase = createSupabaseBrowserClient();',
        "  return supabase.rpc('append_learning_event', { p_event: payload });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );
    expect(allowed.output).toContain('sin hallazgos');
    expect(allowed.exitCode).toBe(0);

    const dynamic = withViolation(
      'apps/web/src/app/_rpc-client-dynamic.tsx',
      [
        "'use client';",
        "import { createSupabaseBrowserClient } from '../lib/supabase/browser-client';",
        'export async function guardar(name: string, payload: unknown) {',
        '  const supabase = createSupabaseBrowserClient();',
        '  return supabase.rpc(name, { p_event: payload });',
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );
    expect(dynamic.exitCode).toBe(1);
    expect(dynamic.output).toContain('no puede resolverse');

    const undeclared = withViolation(
      'apps/web/src/app/_rpc-undeclared.tsx',
      [
        "'use client';",
        "import { createSupabaseBrowserClient } from '../lib/supabase/browser-client';",
        'export async function corregir(payload: unknown) {',
        '  const supabase = createSupabaseBrowserClient();',
        "  return supabase.rpc('grade_attempt', { p_attempt: payload });",
        '}',
      ].join('\n'),
      () => runGuard('client-authority-guard.mjs'),
    );
    expect(undeclared.exitCode).toBe(1);
    expect(undeclared.output).toContain('RPC autoritativa');
  });
});

describe('el aterrizaje de gobernanza no crea objetos de runtime de Phase 2 por sí mismo', () => {
  it('toda migración que cree una tabla de Phase 2 tiene rollback y entra en el lock', () => {
    // Regla de acompañamiento: no prohíbe las tablas (el BUILD está autorizado), exige
    // que lleguen con la disciplina de migración de §27 de la autorización.
    const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
    const downs = new Set(readdirSync(join(migrationsDir, 'down')));
    const lock = JSON.parse(read('supabase/migrations/.lock.json')) as {
      units?: Array<{ name?: string; file?: string }>;
    } & Record<string, unknown>;
    const lockText = JSON.stringify(lock);
    for (const name of readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'))) {
      const sql = read(`supabase/migrations/${name}`).toLowerCase();
      if (
        !/create\s+table\s+(if\s+not\s+exists\s+)?(public\.)?(learner_settings|learner_exam_goals|devices|sync_state|diagnostic_runs|study_sessions|session_items|learning_events|question_attempts|learning_units)\b/.test(
          sql,
        )
      ) {
        continue;
      }
      expect(downs, `${name} sin rollback`).toContain(name.replace(/\.sql$/, '.down.sql'));
      expect(lockText, `${name} fuera del lock`).toContain(name);
    }
  });
});
