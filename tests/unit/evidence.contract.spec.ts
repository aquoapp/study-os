import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CLIENT_AUTHORITATIVE_FIELDS_REJECTED,
  CONFIDENCE_SCALE_V1,
  EVENT_ENVELOPE_KEYS,
  EVENT_SCHEMAS_V1,
  LEARNING_EVENT_TYPES,
  PHASE_2_ACCEPTED_EVENT_TYPES,
} from '@study-os/domain';

import registry from '../../packages/domain/src/authority-registry.json';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `evidence.contract.spec` · las listas espejo de Phase 2 dicen lo mismo en TypeScript y en
 * la migración 18 (D-06: las herramientas y el servidor no pueden importar TypeScript; se
 * comparan por prueba).
 *
 *   - la taxonomía P0 del enum `learning_event_type` es la del CDEM §11, en el mismo orden;
 *   - los esquemas v1 de `ingest.event_field_types` son exactamente `EVENT_SCHEMAS_V1`;
 *   - los campos autoritativos rechazados coinciden con SD-023 §4 y con el registro;
 *   - la escala de confianza sembrada es la de SD-008.
 */

const migration = readFileSync(
  join(REPO_ROOT, 'supabase/migrations/00000000000018_evidence_core.sql'),
  'utf8',
);

function sqlEnumLabels(): string[] {
  const start = migration.indexOf('create type public.learning_event_type as enum (');
  const end = migration.indexOf(');', start);
  return [...migration.slice(start, end).matchAll(/'([A-Z_]+)'/g)].map((m) => m[1] ?? '');
}

function sqlSchemas(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const match of migration.matchAll(/when '([A-Z_]+)' then '(\{"scope"[^']*\})'::jsonb/g)) {
    out[match[1] ?? ''] = JSON.parse(match[2] ?? '{}');
  }
  return out;
}

describe('evidence.contract · taxonomía y esquemas espejo', () => {
  it('el enum de la migración 18 es la taxonomía P0 del CDEM, en orden', () => {
    expect(sqlEnumLabels()).toEqual([...LEARNING_EVENT_TYPES]);
    expect(LEARNING_EVENT_TYPES).toHaveLength(34);
  });

  it('ingest.event_field_types declara exactamente los esquemas de EVENT_SCHEMAS_V1', () => {
    const sql = sqlSchemas();
    expect(Object.keys(sql).sort()).toEqual([...PHASE_2_ACCEPTED_EVENT_TYPES].sort());
    for (const type of PHASE_2_ACCEPTED_EVENT_TYPES) {
      expect(sql[type], type).toEqual(EVENT_SCHEMAS_V1[type]);
    }
  });

  it('los tipos mínimos exigidos por la autorización (§12) están aceptados', () => {
    for (const type of [
      'SESSION_STARTED',
      'SESSION_INTERRUPTED',
      'SESSION_RESUMED',
      'SESSION_COMPLETED',
      'QUESTION_PRESENTED',
      'ANSWER_SELECTED',
      'CONFIDENCE_RECORDED',
      'ANSWER_SUBMITTED',
    ]) {
      expect(PHASE_2_ACCEPTED_EVENT_TYPES, type).toContain(type);
    }
    // Y ninguno de los que pertenecen a fases posteriores.
    for (const type of ['SYNC_PENDING', 'NOTE_CREATED', 'REPLAN_CONFIRMED', 'SIMULATION_STARTED']) {
      expect(PHASE_2_ACCEPTED_EVENT_TYPES, type).not.toContain(type);
    }
  });

  it('los campos autoritativos rechazados coinciden con la migración y con el registro (SD-023 §4)', () => {
    const forbiddenInSql = /forbidden text\[\] := array\[([^\]]+)\]/g;
    const lists = [...migration.matchAll(forbiddenInSql)].map((m) =>
      [...(m[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort(),
    );
    expect(lists.length).toBeGreaterThanOrEqual(2);
    for (const list of lists) expect(list).toEqual([...CLIENT_AUTHORITATIVE_FIELDS_REJECTED].sort());
    for (const field of registry.clientInvokableRpcs.contracts.append_learning_event.rejects) {
      expect(CLIENT_AUTHORITATIVE_FIELDS_REJECTED).toContain(field);
    }
  });

  it('el sobre admite exactamente las claves declaradas', () => {
    const match = /allowed_envelope text\[\] := array\[([^\]]+)\]/.exec(migration);
    const sqlKeys = [...(match?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    expect(sqlKeys).toEqual([...EVENT_ENVELOPE_KEYS]);
  });

  it('la escala de confianza sembrada es la de SD-008', () => {
    expect(CONFIDENCE_SCALE_V1).toEqual({
      version: 'v1',
      levels: 4,
      labels: ['Nada segura', 'Dudosa', 'Bastante', 'Segura'],
    });
    expect(migration).toContain(
      `select 'v1', 4, '["Nada segura", "Dudosa", "Bastante", "Segura"]'::jsonb, 'ACTIVE'`,
    );
  });
});
