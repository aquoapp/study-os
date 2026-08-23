import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  AUTHORIZATION_ENV_VAR,
  assertAutomatedTestsAllowed,
  isLoopbackUrl,
} from '@study-os/config/destructive';

/**
 * Acceso a una instancia de Supabase para los tests de integración y de RLS.
 *
 * ---------------------------------------------------------------------------
 * Dos garantías, y ninguna de las dos es opcional
 *
 * **1 · No hay modo «saltar en silencio».** Si falta la instancia, estos tests
 * fallan con un mensaje que dice exactamente qué falta. El Checkpoint Contract
 * lista «acceptance tests skipped without approved reason» como fallo duro.
 *
 * **2 · No pueden apuntar a producción.** Estos tests crean y borran usuarios con
 * la clave de rol de servicio, que atraviesa RLS. Contra producción eso no es un
 * test: es una escritura no autorizada sobre datos de personas reales. La
 * comprobación mira **dos** cosas independientes —la etiqueta del entorno y el
 * host real de la URL—, porque la etiqueta la escribe una persona y puede estar
 * mal, y es precisamente cuando está mal cuando el control tiene que actuar.
 *
 * Para staging se exige autorización explícita en el entorno. Se admite, pero
 * nunca por defecto ni por descuido.
 * ---------------------------------------------------------------------------
 */

export interface TestEnv {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
  readonly environment: string;
}

const MISSING_ENV_MESSAGE = [
  'No hay instancia de Supabase disponible para los tests de integración/RLS.',
  '',
  'Se necesitan estas variables:',
  '  NEXT_PUBLIC_ENVIRONMENT        (local | staging)',
  '  NEXT_PUBLIC_SUPABASE_URL       (local: http://127.0.0.1:54321)',
  '  NEXT_PUBLIC_SUPABASE_ANON_KEY',
  '  SUPABASE_SERVICE_ROLE_KEY',
  '',
  'Para levantarla en local: `npm run db:start` (requiere Docker).',
  'Bloqueo registrado: MI-05a · repositorio, organización/proyecto Supabase y Vercel.',
].join('\n');

export function readTestEnv(): TestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const environment = process.env['NEXT_PUBLIC_ENVIRONMENT'] ?? '';

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(MISSING_ENV_MESSAGE);
  }

  // Etiqueta del entorno.
  assertAutomatedTestsAllowed(environment, process.env[AUTHORIZATION_ENV_VAR]);

  // Host real. Un `NEXT_PUBLIC_ENVIRONMENT=local` apuntando a un proyecto remoto
  // es exactamente el error que esta comprobación existe para detener.
  if (environment === 'local' && !isLoopbackUrl(url)) {
    throw new Error(
      `NEXT_PUBLIC_ENVIRONMENT dice "local" pero NEXT_PUBLIC_SUPABASE_URL apunta a "${url}", ` +
        'que no es loopback. Estos tests crean y borran usuarios con rol de servicio: una ' +
        'etiqueta equivocada no puede autorizarlos contra una instancia remota.',
    );
  }

  return { url, anonKey, serviceRoleKey, environment };
}

/** Cliente con rol de servicio. Atraviesa RLS: solo para preparar y limpiar datos. */
export function adminClient(env: TestEnv): SupabaseClient {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cliente anónimo, sin sesión. Sujeto a RLS. */
export function anonClient(env: TestEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Dominio reservado para los usuarios de prueba.
 *
 * `.test` es un TLD reservado por la RFC 2606: no resuelve y no puede pertenecer a
 * nadie. El prefijo permite además localizarlos.
 */
export const TEST_EMAIL_DOMAIN = 'example.test';
export const TEST_EMAIL_PREFIX = 'p0-';

/**
 * Variable donde el arranque publica el identificador de la ejecución en curso.
 *
 * Los tests corren en procesos distintos del setup: el identificador tiene que
 * viajar por el entorno para que los correos que crea el navegador lleven la marca
 * de **esta** ejecución y no de otra.
 */
export const RUN_ID_ENV_VAR = 'STUDY_OS_E2E_RUN_ID';

export function isTestEmail(email: string | undefined): boolean {
  return Boolean(
    email && email.startsWith(TEST_EMAIL_PREFIX) && email.endsWith(`@${TEST_EMAIL_DOMAIN}`),
  );
}

/**
 * Identificador único de ejecución.
 *
 * Marca de tiempo en base 36 más entropía. No pretende ser criptográfico: solo
 * tiene que ser distinto del de cualquier otra ejecución que pueda estar corriendo
 * a la vez contra la misma instancia.
 */
export function newRunId(): string {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${stamp}${noise}`;
}

/** Forma admitida de un identificador de ejecución dentro de un correo. */
const RUN_ID_SHAPE = /^[a-z0-9]{8,32}$/;

export function isValidRunId(runId: string | undefined): boolean {
  return typeof runId === 'string' && RUN_ID_SHAPE.test(runId);
}

/**
 * Correo de prueba **marcado con la ejecución que lo creó**.
 *
 * Forma: `p0-<runId>-<etiqueta>-<n>@example.test`. El identificador va justo
 * después del prefijo, en su propio segmento, para que la pertenencia pueda
 * comprobarse sin ambigüedad: un correo de otra ejecución cuyo identificador
 * empiece por el mismo texto no coincide, porque la comparación incluye el guion
 * que cierra el segmento.
 */
export function runScopedEmail(runId: string, label: string, ordinal: number): string {
  if (!isValidRunId(runId)) {
    throw new Error(
      `Identificador de ejecución inválido: "${runId}". Sin él no se puede saber qué ` +
        'usuarios ha creado esta ejecución, y la limpieza pasaría a borrar los de otras.',
    );
  }
  return `${TEST_EMAIL_PREFIX}${runId}-${label}-${ordinal}@${TEST_EMAIL_DOMAIN}`;
}

/** ¿Este correo lo creó **esta** ejecución? */
export function isEmailOfRun(email: string | undefined, runId: string | undefined): boolean {
  if (!isTestEmail(email) || !isValidRunId(runId)) return false;
  return String(email).startsWith(`${TEST_EMAIL_PREFIX}${runId}-`);
}

export interface PurgeSelection<T> {
  readonly toDelete: readonly T[];
  readonly preserved: readonly T[];
}

/**
 * Decide, sin tocar la red, qué usuarios borra la limpieza.
 *
 * Es una función pura a propósito. La regla de «solo los míos» es la parte que
 * puede equivocarse de forma silenciosa y cara, y una regla que solo se ejecuta
 * cuando hay una instancia de Supabase delante no se prueba nunca.
 *
 * Se **preserva** todo lo demás: los usuarios que ya estaban, los de ejecuciones
 * concurrentes y cualquier cuenta que no sea de prueba.
 */
export function selectUsersToPurge<T extends { email?: string | undefined }>(
  users: readonly T[],
  runId: string,
): PurgeSelection<T> {
  const toDelete: T[] = [];
  const preserved: T[] = [];

  for (const user of users) {
    if (isEmailOfRun(user.email, runId)) toDelete.push(user);
    else preserved.push(user);
  }

  return { toDelete, preserved };
}

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly client: SupabaseClient;
}

let counter = 0;

/**
 * Identificador de la ejecución en curso.
 *
 * Lo publica el arranque de los E2E. Las suites de integración y de RLS no pasan
 * por Playwright, así que generan uno al vuelo la primera vez: también ellas deben
 * marcar lo que crean.
 */
export function currentRunId(): string {
  const fromEnv = process.env[RUN_ID_ENV_VAR];
  if (isValidRunId(fromEnv)) return String(fromEnv);
  const generated = newRunId();
  process.env[RUN_ID_ENV_VAR] = generated;
  return generated;
}

/**
 * Crea un usuario confirmado y devuelve un cliente ya autenticado como él.
 *
 * El cliente se autentica de verdad (`signInWithPassword`), de modo que las
 * peticiones llevan su JWT y RLS actúa exactamente igual que en producción.
 */
export async function createTestUser(env: TestEnv, label: string): Promise<TestUser> {
  counter += 1;
  const email = runScopedEmail(currentRunId(), label, counter);
  const password = `Prueba-${Math.random().toString(36).slice(2)}-${counter}A!`;

  const admin = adminClient(env);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(
      `No se pudo crear el usuario de prueba "${label}": ${error?.message ?? 'sin usuario'}`,
    );
  }

  const client = anonClient(env);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(
      `No se pudo autenticar al usuario de prueba "${label}": ${signInError.message}`,
    );
  }

  return { id: data.user.id, email, password, client };
}

export async function deleteTestUser(env: TestEnv, userId: string): Promise<void> {
  const admin = adminClient(env);
  await admin.auth.admin.deleteUser(userId);
}

/**
 * Borra los usuarios de prueba **de una ejecución concreta**.
 *
 * ---------------------------------------------------------------------------
 * Por qué el alcance importa
 *
 * La versión anterior borraba todo lo que llevara el prefijo de prueba. Contra una
 * instancia local de una sola persona eso parece inofensivo; contra CI con dos
 * trabajos en paralelo, o contra una instancia compartida, significa que una
 * ejecución borra los usuarios que otra está usando. El síntoma es un fallo
 * intermitente en la ejecución **ajena**, que es la clase de fallo que más tarda en
 * atribuirse a su causa.
 *
 * Ahora solo se borra lo que lleva la marca de esta ejecución. Todo lo demás se
 * cuenta como preservado y se informa, para que la limpieza sea observable y no un
 * efecto invisible.
 * ---------------------------------------------------------------------------
 */
export async function purgeTestUsers(
  env: TestEnv,
  runId: string,
): Promise<{ deleted: number; preserved: number; scanned: number }> {
  if (!isValidRunId(runId)) {
    throw new Error(
      `No se puede limpiar sin un identificador de ejecución válido (recibido: "${runId}"). ` +
        'Sin él, la limpieza no distingue sus usuarios de los de otra ejecución.',
    );
  }

  const admin = adminClient(env);
  let deleted = 0;
  let preserved = 0;
  let scanned = 0;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`No se pudieron listar los usuarios de prueba: ${error.message}`);

    const users = data?.users ?? [];
    if (users.length === 0) break;
    scanned += users.length;

    const selection = selectUsersToPurge(users, runId);
    preserved += selection.preserved.length;

    for (const user of selection.toDelete) {
      await admin.auth.admin.deleteUser(user.id);
      deleted += 1;
    }

    if (users.length < 200) break;
  }

  return { deleted, preserved, scanned };
}
