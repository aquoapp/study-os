import { existsSync, readFileSync, rmSync } from 'node:fs';

import {
  adminDirectory,
  isEmailOfRun,
  listAllUsers,
  purgeRunUsers,
  readTestEnv,
  RUN_ID_ENV_VAR,
  type ListedUser,
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
 * huérfanas: exactamente el fallo que el aviso decía prevenir.
 *
 * ---------------------------------------------------------------------------
 * Ni limpieza de más
 *
 * La segunda versión borraba **todo** usuario con el prefijo de prueba. Contra una
 * instancia compartida eso significa borrar los usuarios de otra ejecución mientras
 * los está usando.
 *
 * ---------------------------------------------------------------------------
 * Ni acusaciones falsas
 *
 * La tercera versión corrigió el alcance del borrado pero verificaba mal: censaba
 * los usuarios preexistentes al arrancar y, al terminar, exigía que **siguieran
 * ahí**. Contra una instancia compartida eso es una carrera: si la ejecución A
 * termina y borra legítimamente sus usuarios entre el censo de B y la verificación
 * de B, B falla acusando de un borrado que no hizo nadie indebidamente. La
 * ejecución que revienta no es la que hizo nada mal, y el fallo es intermitente.
 *
 * La comprobación correcta no mira el mundo: mira **lo que esta ejecución pidió**.
 * `purgeRunUsers` devuelve la lista de identificadores enviados a `deleteUser`, y
 * aquí se exige que todos y cada uno pertenezcan a esta ejecución. Eso es una
 * propiedad de la ejecución, no del estado global, y ninguna otra ejecución puede
 * hacerla fallar.
 *
 * ---------------------------------------------------------------------------
 * El marcador se conserva mientras algo pueda ir mal
 *
 * Se borra **al final**, cuando todas las verificaciones han pasado. Si la limpieza
 * falla, el marcador sobrevive: es lo único que dice qué ejecución dejó qué, y
 * borrarlo convertiría un fallo diagnosticable en un misterio.
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
  const directory = adminDirectory(env);

  let report;
  try {
    report = await purgeRunUsers(directory, runId);
  } catch (error) {
    // El marcador se queda. Es lo que permite reintentar sabiendo qué buscar.
    throw new Error(
      `La limpieza de usuarios E2E falló: ${error instanceof Error ? error.message : String(error)}\n` +
        `El marcador de la ejecución se conserva en ${markerPath} para diagnóstico y reintento.`,
    );
  }

  // 1 · Nada ajeno. Se comprueba sobre lo que se PIDIÓ borrar, no sobre lo que
  //     desapareció del mundo: lo segundo depende de las demás ejecuciones.
  const ajenos: ListedUser[] = report.requested.filter((user) => !isEmailOfRun(user.email, runId));

  if (ajenos.length > 0) {
    throw new Error(
      `La limpieza pidió borrar ${ajenos.length} usuario(s) que NO son de la ejecución ` +
        `${runId}:\n  ${ajenos.map((user) => user.email ?? user.id).join('\n  ')}\n` +
        `El marcador se conserva en ${markerPath}.`,
    );
  }

  // 2 · Nada propio pendiente. Se vuelve a listar y se miran solo los de esta
  //     ejecución: los de otras pueden aparecer y desaparecer, y da igual.
  const remaining = (await listAllUsers(directory))
    .filter((user) => isEmailOfRun(user.email, runId))
    .map((user) => user.email ?? user.id);

  if (remaining.length > 0) {
    throw new Error(
      `La limpieza dejó ${remaining.length} usuario(s) de la ejecución ${runId}:\n` +
        `  ${remaining.slice(0, 10).join('\n  ')}\n` +
        'Crear usuarios y no borrarlos es un defecto. ' +
        `El marcador se conserva en ${markerPath}.`,
    );
  }

  // Solo ahora. Antes de este punto el marcador es la única pista que quedaría.
  rmSync(markerPath, { force: true });

  console.log(
    `Limpieza de la ejecución ${runId}: ${report.deleted.length} usuario(s) borrados · ` +
      `0 restantes · ${report.preserved} preservados (preexistentes o de ejecuciones ` +
      `concurrentes) sobre ${report.scanned} listados.`,
  );
}
