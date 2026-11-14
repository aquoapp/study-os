/**
 * Observation Adapter · CP2 · **solo lectura, y solo sobre la instancia efímera**.
 *
 * ---------------------------------------------------------------------------
 * Qué observa y por qué no es una superficie de producto
 *
 * La barrera de completitud vive en `engine.projection_watermarks.consumed_position`, cuya
 * semántica transaccional quedó demostrada en el preflight de bindings. Esto es **estado
 * interno**: sirve para saber si el motor terminó de plegar, y **no prueba que una persona pueda
 * ver nada**. Confundir ambas cosas es exactamente el defecto D-26, que costó una corrección
 * entera.
 *
 * `engine_processed_at` queda excluido por decisión: nadie lo escribe, y usarlo como barrera
 * haría concluir «no procesado» sobre evidencia ya plegada.
 *
 * El adaptador se niega a ejecutar cualquier cosa que no sea una lectura. No es una convención
 * documentada: es una comprobación sobre el texto de la sentencia antes de enviarla.
 * ---------------------------------------------------------------------------
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';

import type { ObserverCredentials } from './credentials';
import type { SubstrateIdentity } from './substrate';

/** Lectura de la barrera para un sujeto. */
export interface BarrierReading {
  readonly subjectRef: string;
  readonly maxPosition: number | null;
  readonly consumedPosition: number | null;
  readonly pending: boolean | null;
  readonly substrateFingerprint: string;
  readonly readAt: string;
}

export class ObservationRefused extends Error {
  constructor(message: string) {
    super(`observación rechazada · ${message}`);
    this.name = 'ObservationRefused';
  }
}

/** Palabras que convierten una consulta en algo que no es una lectura. */
const MUTATING = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'create',
  'truncate',
  'grant',
  'revoke',
  'copy',
  'call',
  'do ',
];

/**
 * Comprueba que una sentencia es de lectura.
 *
 * No pretende ser un analizador de SQL: pretende que una mutación no se cuele por descuido. El
 * adaptador solo emite consultas de este módulo, así que la superficie real es diminuta; esta
 * comprobación existe para que siga siéndolo cuando alguien añada la siguiente.
 */
export function assertReadOnly(statement: string): void {
  const normalized = statement.trim().toLowerCase();
  if (!normalized.startsWith('select')) {
    throw new ObservationRefused('una observación empieza por SELECT y esta no');
  }
  if (normalized.includes(';') && !normalized.endsWith(';')) {
    throw new ObservationRefused('varias sentencias en una observación');
  }
  for (const verb of MUTATING) {
    if (normalized.includes(` ${verb}`)) {
      throw new ObservationRefused(`la sentencia contiene "${verb.trim()}": no es una lectura`);
    }
  }
}

export interface ObservationContext {
  readonly credentials: ObserverCredentials;
  readonly identity: SubstrateIdentity;
  /** Inyectable para poder probar el adaptador sin base de datos. */
  readonly runQuery?: (databaseUrl: string, statement: string) => string;
}

/**
 * Localiza el CLI fijado del repositorio **sin `import.meta`**.
 *
 * Playwright transforma estas pruebas a CommonJS, donde `import.meta` es un error de sintaxis:
 * usarlo dejaba el módulo sin cargar y la campaña «sin pruebas». Se resuelve subiendo desde el
 * directorio de trabajo, que funciona igual en los dos sistemas de módulos.
 */
export function resolveLauncher(from: string = process.cwd()): string {
  let current = resolvePath(from);
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(current, 'node_modules', 'supabase', 'dist', 'supabase.js');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new ObservationRefused(
    'no se encuentra el CLI fijado del repositorio: sin él no hay observación posible',
  );
}

/** Ejecuta la consulta con el CLI fijado del repositorio, que redacta la cadena en los errores. */
function defaultRunQuery(databaseUrl: string, statement: string): string {
  return execFileSync(
    process.execPath,
    [
      resolveLauncher(),
      'db',
      'query',
      '--db-url',
      databaseUrl,
      '--output',
      'json',
      '--agent',
      'no',
      statement,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

function parseRows(output: string): ReadonlyArray<Record<string, unknown>> {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    return JSON.parse(output.slice(start, end + 1)) as ReadonlyArray<Record<string, unknown>>;
  } catch {
    return [];
  }
}

/**
 * Ejecuta **una** observación y devuelve sus filas.
 *
 * Fail-closed por diseño: cualquier fallo devuelve `null`, no una lista vacía. Una lista vacía
 * es un dato —«no hay filas»— y confundirla con «no se pudo leer» convertiría un fallo de
 * lectura en una aserción negativa. Quien reciba `null` solo puede concluir `INCONCLUSIVE`.
 *
 * El error nunca se propaga con su texto: puede contener la cadena de conexión.
 */
export function observe(
  context: ObservationContext,
  statement: string,
): ReadonlyArray<Record<string, unknown>> | null {
  assertReadOnly(statement);
  try {
    const run = context.runQuery ?? defaultRunQuery;
    const output = run(context.credentials.databaseUrl, statement);
    // Sin array JSON en la salida no hubo lectura: `parseRows` devolvería `[]`, que es un dato.
    const start = output.indexOf('[');
    const end = output.lastIndexOf(']');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(output.slice(start, end + 1)) as ReadonlyArray<Record<string, unknown>>;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Lee la barrera de un sujeto.
 *
 * **Fail-closed**: cualquier fallo devuelve una lectura con posiciones nulas y `pending` nulo, que
 * el oráculo solo puede traducir a `INCONCLUSIVE`. Nunca se devuelve un cero por defecto, porque
 * un cero es un dato y aquí no hay dato.
 */
export function readBarrier(context: ObservationContext, subjectRef: string): BarrierReading {
  const statement =
    'select (select max(stream_position) from public.learning_events where user_id = ' +
    `'${subjectRef}') as max_position, ` +
    'w.consumed_position from engine.projection_watermarks w ' +
    `where w.user_id = '${subjectRef}' and w.projection_name = 'concept_mastery'`;

  assertReadOnly(statement);

  const base = {
    subjectRef,
    substrateFingerprint: context.identity.fingerprint,
    readAt: new Date().toISOString(),
  };

  try {
    const run = context.runQuery ?? defaultRunQuery;
    const rows = parseRows(run(context.credentials.databaseUrl, statement));
    const row = rows[0];
    if (!row) return { ...base, maxPosition: null, consumedPosition: null, pending: null };

    const max = typeof row['max_position'] === 'number' ? row['max_position'] : null;
    const consumed = typeof row['consumed_position'] === 'number' ? row['consumed_position'] : null;
    const pending = max === null || consumed === null ? null : max > consumed;
    return { ...base, maxPosition: max, consumedPosition: consumed, pending };
  } catch {
    // El error no se propaga con su texto: puede contener la cadena de conexión.
    return { ...base, maxPosition: null, consumedPosition: null, pending: null };
  }
}

/**
 * El adaptador **no** ejecuta acciones de aprendiz, y esto lo hace explícito.
 *
 * Existe para que un checkpoint posterior no caiga en la tentación de «aprovechar» la conexión
 * privilegiada para simular un envío: eso produciría un producto que nadie puede usar y un
 * laboratorio que no lo nota.
 */
export function actAsLearner(): never {
  throw new ObservationRefused(
    'el Observation Adapter observa; no actúa. Una acción de aprendiz que no pase por su ' +
      'superficie real no prueba nada sobre el producto.',
  );
}
