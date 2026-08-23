import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  AUTHORIZATION_ENV_VAR,
  assertAutomatedTestsAllowed,
  isLoopbackUrl,
} from '../../../packages/config/src/destructive';
import { adminClient, isTestEmail, readTestEnv } from '../../support/supabase-test-env';

/**
 * Guarda de arranque de los E2E de autenticación.
 *
 * ---------------------------------------------------------------------------
 * Las credenciales de limpieza se exigen ANTES de crear nada
 *
 * Estos tests dan de alta usuarios reales a través del formulario. El navegador no
 * tiene rol de servicio, así que no puede deshacerlo: la limpieza depende de una
 * credencial que solo existe fuera del navegador.
 *
 * Si esa credencial falta, la respuesta correcta no es «crear los usuarios y avisar
 * de que no se pudieron borrar». Es no crearlos. Por eso la comprobación va aquí,
 * antes de abrir ningún navegador, y no en el teardown.
 *
 * También se comprueba que la limpieza **funciona**, no solo que la clave está
 * presente: una clave inválida daría exactamente el mismo resultado que ninguna.
 * ---------------------------------------------------------------------------
 */

/** Fichero donde el setup deja constancia para el teardown. */
export const RUN_MARKER = join(tmpdir(), 'study-os-e2e-auth-run.json');

export default async function globalSetup(): Promise<void> {
  const environment = process.env['NEXT_PUBLIC_ENVIRONMENT'] ?? '';
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';

  // 1 · el entorno admite tests automatizados (producción nunca)
  assertAutomatedTestsAllowed(environment, process.env[AUTHORIZATION_ENV_VAR]);

  // 2 · el host real, no solo la etiqueta
  if (environment === 'local' && supabaseUrl !== '' && !isLoopbackUrl(supabaseUrl)) {
    throw new Error(
      `NEXT_PUBLIC_ENVIRONMENT dice "local" pero NEXT_PUBLIC_SUPABASE_URL apunta a ` +
        `"${supabaseUrl}", que no es loopback. Los E2E de auth crean usuarios: una ` +
        'etiqueta equivocada no puede autorizarlos contra una instancia remota.',
    );
  }

  // 3 · credenciales de limpieza, presentes y válidas
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    throw new Error(
      'Los E2E de autenticación NO se ejecutan sin credenciales de limpieza.\n\n' +
        'Estos tests dan de alta usuarios a través del formulario y el navegador no puede\n' +
        'borrarlos. Sin SUPABASE_SERVICE_ROLE_KEY la limpieza es imposible, así que no se\n' +
        'crean los usuarios: la suite se detiene aquí.\n\n' +
        'Para los E2E que no necesitan Supabase: `npm run test:e2e:static`.',
    );
  }

  const env = readTestEnv();
  const admin = adminClient(env);

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    throw new Error(
      `Las credenciales de limpieza no funcionan: ${error.message}. Una clave inválida ` +
        'deja exactamente los mismos usuarios huérfanos que ninguna clave.',
    );
  }
  void data;

  // 4 · censo previo, para que el teardown distinga lo que creó esta ejecución
  const existing: string[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = listed.data?.users ?? [];
    if (users.length === 0) break;
    for (const user of users) {
      if (isTestEmail(user.email)) existing.push(user.id);
    }
    if (users.length < 200) break;
  }

  writeFileSync(
    RUN_MARKER,
    JSON.stringify({ startedAt: new Date().toISOString(), preexisting: existing }, null, 2),
    'utf8',
  );

  console.log(
    `E2E de auth autorizados en "${environment}" (${supabaseUrl}). ` +
      `Limpieza verificada. Usuarios de prueba preexistentes: ${existing.length}.`,
  );
}
