import { existsSync, readFileSync, rmSync } from 'node:fs';

import {
  adminClient,
  isEmailOfRun,
  purgeTestUsers,
  readTestEnv,
  RUN_ID_ENV_VAR,
} from '../../support/supabase-test-env';

import { runMarkerPath, type RunMarker } from './global-setup';

/**
 * Limpieza de los usuarios que los E2E de autenticación crean por el formulario.
 *
 * ---------------------------------------------------------------------------
 * Aquí no hay salida silenciosa
 *
 * La primera versión hacía `console.warn()` y `return` cuando faltaba la clave de
 * servicio. El resultado era una suite **en verde** que había dejado cuentas
 * huérfanas: exactamente el fallo que el aviso decía prevenir. Un aviso que nadie
 * lee en un CI en verde no es un control.
 *
 * ---------------------------------------------------------------------------
 * Y ahora tampoco hay limpieza de más
 *
 * La segunda versión borraba **todo** usuario con el prefijo de prueba. Contra una
 * instancia compartida —CI con dos trabajos, dos personas contra el mismo stack—
 * eso significa borrar los usuarios de otra ejecución mientras los está usando. La
 * ejecución que sufre el fallo no es la que cometió el error, que es la peor forma
 * de fallar.
 *
 * El contrato es ahora simétrico:
 *
 *   · si falta el marcador de **esta** ejecución, la suite corrió sin autorización → error;
 *   · si la limpieza falla, → error;
 *   · si queda algún usuario **de esta ejecución**, → error;
 *   · si ha desaparecido algún usuario **preexistente**, → error. Borrar de más es
 *     un defecto tan reportable como borrar de menos, y sin esta comprobación sería
 *     invisible.
 * ---------------------------------------------------------------------------
 */
export default async function globalTeardown(): Promise<void> {
  const runId = process.env[RUN_ID_ENV_VAR] ?? '';
  if (runId === '') {
    throw new Error(
      'No hay identificador de ejecución: el global-setup de auth no llegó a completarse. ' +
        'La suite no debería haberse ejecutado.',
    );
  }

  const markerPath = runMarkerPath(runId);
  if (!existsSync(markerPath)) {
    throw new Error(
      `No existe el marcador de la ejecución ${runId} (${markerPath}). Sin él no se puede ` +
        'saber qué usuarios había antes, y una limpieza a ciegas borraría los de otras ' +
        'ejecuciones.',
    );
  }

  const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as RunMarker;
  if (marker.runId !== runId) {
    throw new Error(
      `El marcador dice "${marker.runId}" y el entorno dice "${runId}". No se limpia nada ` +
        'con esa contradicción sin resolver.',
    );
  }

  const env = readTestEnv();

  let deleted = 0;
  let preserved = 0;
  try {
    ({ deleted, preserved } = await purgeTestUsers(env, runId));
  } catch (error) {
    throw new Error(
      `La limpieza de usuarios E2E falló: ${error instanceof Error ? error.message : String(error)}. ` +
        'Los usuarios creados por esta ejecución siguen en la instancia.',
    );
  }

  // Verificación posterior. No basta con haber intentado borrar: se vuelve a listar
  // y se comprueban las dos direcciones del error.
  const admin = adminClient(env);
  const remaining: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`No se pudo verificar la limpieza: ${error.message}`);
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const user of users) {
      seen.add(user.id);
      if (isEmailOfRun(user.email, runId)) remaining.push(user.email ?? user.id);
    }
    if (users.length < 200) break;
  }

  const vanished = marker.preexisting.filter((user) => !seen.has(user.id));

  rmSync(markerPath, { force: true });

  if (remaining.length > 0) {
    throw new Error(
      `La limpieza dejó ${remaining.length} usuario(s) de la ejecución ${runId}:\n` +
        `  ${remaining.slice(0, 10).join('\n  ')}\n` +
        'La suite se marca en rojo: crear usuarios y no borrarlos es un defecto.',
    );
  }

  if (vanished.length > 0) {
    throw new Error(
      `La limpieza borró ${vanished.length} usuario(s) que NO eran de esta ejecución:\n` +
        `  ${vanished
          .slice(0, 10)
          .map((user) => user.email || user.id)
          .join('\n  ')}\n` +
        'Borrar de más es tan reportable como borrar de menos: otra ejecución podía ' +
        'estar usándolos.',
    );
  }

  console.log(
    `Limpieza de la ejecución ${runId}: ${deleted} usuario(s) borrados · 0 restantes · ` +
      `${preserved} preservados (preexistentes o de ejecuciones concurrentes).`,
  );
}
