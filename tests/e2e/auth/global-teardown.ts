import { existsSync, readFileSync, rmSync } from 'node:fs';

import {
  adminClient,
  isTestEmail,
  purgeTestUsers,
  readTestEnv,
} from '../../support/supabase-test-env';

import { RUN_MARKER } from './global-setup';

/**
 * Limpieza de los usuarios que los E2E de autenticación crean por el formulario.
 *
 * ---------------------------------------------------------------------------
 * Aquí no hay salida silenciosa
 *
 * La versión anterior hacía `console.warn()` y `return` cuando faltaba la clave de
 * servicio. El resultado era una suite **en verde** que había dejado cuentas
 * huérfanas: exactamente el fallo que el aviso decía prevenir. Un aviso que nadie
 * lee en un CI en verde no es un control.
 *
 * Ahora la limpieza es obligatoria y se comprueba su resultado:
 *
 *   · si falta el marcador del setup, la suite corrió sin autorización → error;
 *   · si la limpieza falla, → error;
 *   · si después de limpiar queda **algún** usuario de prueba creado por esta
 *     ejecución, → error.
 *
 * Un teardown que lanza hace fallar la ejecución de Playwright, que es lo que debe
 * pasar: los usuarios creados y no borrados son un defecto, no un detalle.
 * ---------------------------------------------------------------------------
 */
export default async function globalTeardown(): Promise<void> {
  if (!existsSync(RUN_MARKER)) {
    throw new Error(
      'No hay marcador de ejecución: el global-setup de auth no llegó a completarse. ' +
        'La suite no debería haberse ejecutado.',
    );
  }

  const marker = JSON.parse(readFileSync(RUN_MARKER, 'utf8')) as {
    startedAt: string;
    preexisting: string[];
  };
  const preexisting = new Set(marker.preexisting);

  const env = readTestEnv();

  let deleted = 0;
  try {
    ({ deleted } = await purgeTestUsers(env));
  } catch (error) {
    throw new Error(
      `La limpieza de usuarios E2E falló: ${error instanceof Error ? error.message : String(error)}. ` +
        'Los usuarios creados por esta ejecución siguen en la instancia.',
    );
  }

  // Verificación posterior. No basta con haber intentado borrar: se vuelve a
  // listar y se exige que no quede ninguno.
  const admin = adminClient(env);
  const remaining: string[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`No se pudo verificar la limpieza: ${error.message}`);
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const user of users) {
      if (isTestEmail(user.email)) remaining.push(user.email ?? user.id);
    }
    if (users.length < 200) break;
  }

  rmSync(RUN_MARKER, { force: true });

  if (remaining.length > 0) {
    throw new Error(
      `La limpieza dejó ${remaining.length} usuario(s) de prueba en la instancia:\n` +
        `  ${remaining.slice(0, 10).join('\n  ')}\n` +
        'La suite se marca en rojo: crear usuarios y no borrarlos es un defecto.',
    );
  }

  console.log(
    `Limpieza de E2E de auth: ${deleted} usuario(s) borrados · 0 restantes · ` +
      `${preexisting.size} preexistentes al inicio.`,
  );
}
