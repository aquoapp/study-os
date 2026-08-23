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
 * nadie. El prefijo permite además localizarlos y borrarlos en bloque.
 */
export const TEST_EMAIL_DOMAIN = 'example.test';
export const TEST_EMAIL_PREFIX = 'p0-';

export function isTestEmail(email: string | undefined): boolean {
  return Boolean(
    email && email.startsWith(TEST_EMAIL_PREFIX) && email.endsWith(`@${TEST_EMAIL_DOMAIN}`),
  );
}

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly client: SupabaseClient;
}

let counter = 0;

/**
 * Crea un usuario confirmado y devuelve un cliente ya autenticado como él.
 *
 * El cliente se autentica de verdad (`signInWithPassword`), de modo que las
 * peticiones llevan su JWT y RLS actúa exactamente igual que en producción.
 */
export async function createTestUser(env: TestEnv, label: string): Promise<TestUser> {
  counter += 1;
  const email = `${TEST_EMAIL_PREFIX}${label}-${Date.now()}-${counter}@${TEST_EMAIL_DOMAIN}`;
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
 * Borra **todos** los usuarios de prueba que queden en la instancia.
 *
 * Necesario porque los E2E dan de alta usuarios a través de la interfaz y no
 * pueden borrarlos por sí mismos: el navegador no tiene rol de servicio. Sin esta
 * limpieza, cada ejecución dejaba cuentas huérfanas acumulándose — un defecto que
 * el informe de checkpoint anterior describía como resuelto sin serlo.
 *
 * Solo toca correos con el prefijo y el dominio reservados. Devuelve cuántos borró
 * para que la limpieza sea observable y no un efecto invisible.
 */
export async function purgeTestUsers(env: TestEnv): Promise<{ deleted: number; scanned: number }> {
  const admin = adminClient(env);
  let deleted = 0;
  let scanned = 0;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`No se pudieron listar los usuarios de prueba: ${error.message}`);

    const users = data?.users ?? [];
    if (users.length === 0) break;
    scanned += users.length;

    for (const user of users) {
      if (!isTestEmail(user.email)) continue;
      await admin.auth.admin.deleteUser(user.id);
      deleted += 1;
    }

    if (users.length < 200) break;
  }

  return { deleted, scanned };
}
