import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Acceso a una instancia de Supabase para los tests de integración y de RLS.
 *
 * **No hay modo «saltar en silencio».** Si falta la instancia, estos tests fallan
 * con un mensaje que dice exactamente qué falta. El Checkpoint Contract lista
 * «acceptance tests skipped without approved reason» como fallo duro: un test que
 * se auto-desactiva cuando no encuentra su entorno produce un CI verde que no
 * demuestra nada.
 */

export interface TestEnv {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

const MISSING_ENV_MESSAGE = [
  'No hay instancia de Supabase disponible para los tests de integración/RLS.',
  '',
  'Se necesitan estas variables:',
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

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(MISSING_ENV_MESSAGE);
  }

  return { url, anonKey, serviceRoleKey };
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
  const email = `p0-${label}-${Date.now()}-${counter}@example.test`;
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
