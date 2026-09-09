/**
 * Canonicalización v1 · SD-022 (ACCEPTED 2026-09-09) · prerrequisito de ADR-008.
 *
 * Forma canónica CJF-1: claves NFC ordenadas por punto de código, cadenas NFC con escapes
 * fijos, solo enteros en el rango seguro, arrays en el orden recibido, ausente ≠ nulo,
 * SHA-256 en hexadecimal minúsculas. Es la MISMA regla que `ingest.canonical_text` y
 * `ingest.canonical_hash` en la migración 18: `canonical.crossImplementation.spec` compara
 * ambas implementaciones sobre los vectores fijos de `canonical-vectors.json`.
 *
 * Esta implementación existe para que el cliente y las pruebas puedan calcular el hash que el
 * servidor calculará; la autoridad sigue siendo el servidor (el hash almacenado es el suyo).
 */

export const CANONICALIZATION_VERSION = 'v1' as const;

/** Conjunto exacto de campos del hash de evento (SD-022). */
export const EVENT_HASH_FIELDS_V1 = [
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
] as const;

/** Conjunto exacto de campos del hash de respuesta (SD-022). */
export const ANSWER_HASH_FIELDS_V1 = [
  'question_id',
  'question_representation_id',
  'answer_kind',
  'selected_option_id',
  'presented_option_order',
  'confidence_value',
  'confidence_scale_version',
  'response_ms',
  'answer_key_version_id',
] as const;

const MAX_SAFE = 9007199254740991;

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(`SD-022 · ${message}`);
    this.name = 'CanonicalizationError';
  }
}

function canonicalString(value: string): string {
  const nfc = value.normalize('NFC');
  let out = '"';
  for (const ch of nfc) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (code < 0x20) out += '\\u00' + code.toString(16).padStart(2, '0');
    else out += ch;
  }
  return out + '"';
}

function compareCodePoints(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const na = ia.next();
    const nb = ib.next();
    if (na.done && nb.done) return 0;
    if (na.done) return -1;
    if (nb.done) return 1;
    const ca = na.value.codePointAt(0) ?? 0;
    const cb = nb.value.codePointAt(0) ?? 0;
    if (ca !== cb) return ca < cb ? -1 : 1;
  }
}

/**
 * Texto canónico de un valor JSON. Lanza `CanonicalizationError` ante un numérico no entero,
 * un entero fuera del rango seguro, un valor no representable en JSON o dos claves que
 * coinciden tras NFC.
 */
export function canonicalText(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new CanonicalizationError(`solo enteros: ${String(value)}`);
    if (Math.abs(value) > MAX_SAFE)
      throw new CanonicalizationError(`fuera del rango seguro: ${String(value)}`);
    // `String(-0)` ya es `"0"`: el cero negativo no sobrevive a la serialización, que es
    // justo lo que pide el contrato («sin signo para el cero»).
    return String(value);
  }
  if (typeof value === 'bigint') {
    if (value > BigInt(MAX_SAFE) || value < -BigInt(MAX_SAFE)) {
      throw new CanonicalizationError(`fuera del rango seguro: ${value.toString()}`);
    }
    return value.toString();
  }
  if (typeof value === 'string') return canonicalString(value);
  if (Array.isArray(value)) return '[' + value.map((item) => canonicalText(item)).join(',') + ']';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key.normalize('NFC'), item] as const);
    const keys = entries.map(([key]) => key);
    if (new Set(keys).size !== keys.length) {
      throw new CanonicalizationError('dos claves distintas coinciden tras NFC');
    }
    entries.sort(([a], [b]) => compareCodePoints(a, b));
    return (
      '{' +
      entries.map(([key, item]) => canonicalString(key) + ':' + canonicalText(item)).join(',') +
      '}'
    );
  }
  throw new CanonicalizationError(`valor no representable: ${typeof value}`);
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 (hex minúsculas) de los bytes UTF-8 del texto canónico. */
export async function canonicalHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalText(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
}

/** Instante en la forma fija del contrato: UTC con milisegundos. */
export function canonicalTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new CanonicalizationError(`instante inválido: ${String(value)}`);
  return date.toISOString();
}
