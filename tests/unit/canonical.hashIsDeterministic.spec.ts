import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  ANSWER_HASH_FIELDS_V1,
  CANONICALIZATION_VERSION,
  CanonicalizationError,
  EVENT_HASH_FIELDS_V1,
  canonicalHash,
  canonicalText,
  canonicalTimestamp,
} from '@study-os/domain';

import vectors from '../../packages/domain/src/canonical-vectors.json';

/**
 * `canonical.hashIsDeterministic.spec` · SD-022 · contrato de canonicalización v1.
 *
 * Dos codificaciones equivalentes del mismo payload producen el mismo hash; cualquier
 * diferencia semántica produce otro; ausente y nulo no son lo mismo; los numéricos no
 * enteros se rechazan. Los vectores fijos son la referencia que la implementación SQL del
 * servidor debe reproducir (`canonical.crossImplementation.spec`, integración).
 */

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('SD-022 · forma canónica CJF-1', () => {
  it('ordena las claves por punto de código, no por orden local', () => {
    expect(canonicalText({ b: 1, a: 2, é: 3, Z: 4, _: 5, '10': 6, '9': 7 })).toBe(
      '{"10":6,"9":7,"Z":4,"_":5,"a":2,"b":1,"é":3}',
    );
  });

  it('es insensible al orden de claves y a los espacios de la codificación de origen', async () => {
    const a = JSON.parse('{"x": 1, "y": {"n": [1, 2], "m": "s"}}') as unknown;
    const b = JSON.parse('{"y":{"m":"s","n":[1,2]},"x":1}') as unknown;
    expect(canonicalText(a)).toBe(canonicalText(b));
    expect(await canonicalHash(a)).toBe(await canonicalHash(b));
  });

  it('normaliza las cadenas a NFC: descompuesta y compuesta son la misma', async () => {
    expect(await canonicalHash({ k: 'café' })).toBe(await canonicalHash({ k: 'café' }));
    expect(await canonicalHash({ 'café': 1 })).toBe(await canonicalHash({ 'café': 1 }));
  });

  it('distingue ausente de nulo', async () => {
    expect(await canonicalHash({ a: null })).not.toBe(await canonicalHash({}));
    expect(canonicalText({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it('conserva el orden de los arrays: el orden es semántico', async () => {
    expect(await canonicalHash({ o: ['a', 'b'] })).not.toBe(await canonicalHash({ o: ['b', 'a'] }));
  });

  it('usa escapes fijos y deja lo no ASCII tal cual', () => {
    expect(canonicalText('a"b\\c\nd\r\t\b\f\u0001\u001f/\u2028 é')).toBe('"a\\"b\\\\c\\nd\\r\\t\\b\\f\\u0001\\u001f/\u2028 é"');
  });

  it('solo admite enteros en el rango seguro; -0 es 0', () => {
    expect(canonicalText({ n: -0 })).toBe('{"n":0}');
    expect(canonicalText(9007199254740991)).toBe('9007199254740991');
    expect(() => canonicalText({ n: 1.5 })).toThrow(CanonicalizationError);
    expect(() => canonicalText({ n: 9007199254740992 })).toThrow(CanonicalizationError);
    expect(() => canonicalText({ n: Number.NaN })).toThrow(CanonicalizationError);
  });

  it('rechaza dos claves distintas que coinciden tras NFC', () => {
    expect(() => canonicalText({ 'café': 1, 'café': 2 })).toThrow(CanonicalizationError);
  });

  it('serializa los instantes en UTC con milisegundos', () => {
    expect(canonicalTimestamp('2026-09-09T10:00:00.5+02:00')).toBe('2026-09-09T08:00:00.500Z');
    expect(canonicalTimestamp(new Date(Date.UTC(2026, 8, 9, 8, 0, 0)))).toBe('2026-09-09T08:00:00.000Z');
    expect(() => canonicalTimestamp('ayer')).toThrow(CanonicalizationError);
  });

  it('SHA-256 en hexadecimal minúsculas sobre los bytes UTF-8 del texto canónico', async () => {
    const value = { id: '0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9', n: 3, s: 'é' };
    expect(await canonicalHash(value)).toBe(sha256(canonicalText(value)));
    expect(await canonicalHash({})).toBe('44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
  });

  it('los vectores de referencia se reproducen exactamente', async () => {
    expect(vectors.length).toBeGreaterThanOrEqual(9);
    for (const vector of vectors) {
      expect(canonicalText(vector.value), vector.name).toBe(vector.canonical);
      expect(await canonicalHash(vector.value), vector.name).toBe(vector.sha256);
      expect(vector.sha256).toBe(sha256(vector.canonical));
    }
  });

  it('declara la versión y los dos conjuntos exactos de campos del contrato', () => {
    expect(CANONICALIZATION_VERSION).toBe('v1');
    expect([...EVENT_HASH_FIELDS_V1]).toEqual([
      'event_type',
      'schema_version',
      'session_id',
      'session_item_id',
      'device_id',
      'client_created_at',
      'client_sequence',
      'created_offline',
      'source_event_id',
      'payload',
    ]);
    expect([...ANSWER_HASH_FIELDS_V1]).toEqual([
      'question_id',
      'question_representation_id',
      'answer_kind',
      'selected_option_id',
      'presented_option_order',
      'confidence_value',
      'confidence_scale_version',
      'response_ms',
      'answer_key_version_id',
    ]);
  });
});
