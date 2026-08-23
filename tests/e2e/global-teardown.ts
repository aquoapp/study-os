import { purgeTestUsers, readTestEnv } from '../support/supabase-test-env';

/**
 * Limpieza de los usuarios que los E2E crean a través de la interfaz.
 *
 * ---------------------------------------------------------------------------
 * Corrección de un error del informe anterior
 *
 * El checkpoint de Phase 0 afirmaba que los usuarios de prueba se eliminaban. Era
 * falso para los E2E: los tests de integración y RLS sí borraban los suyos, porque
 * los crean con la API de administración, pero los E2E dan de alta a través del
 * formulario y el navegador no tiene rol de servicio con el que deshacerlo. Cada
 * ejecución dejaba cuentas huérfanas.
 *
 * Esto lo arregla desde fuera del navegador. Si no hay clave de rol de servicio,
 * **no se calla**: avisa de que la limpieza no se ha hecho, para que la deuda sea
 * visible en lugar de acumularse en silencio.
 * ---------------------------------------------------------------------------
 */
export default async function globalTeardown(): Promise<void> {
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    console.warn(
      '⚠ Limpieza de usuarios E2E omitida: no hay SUPABASE_SERVICE_ROLE_KEY en el entorno.\n' +
        '  Los usuarios creados por los E2E siguen en la instancia. Bórralos antes de reutilizarla.',
    );
    return;
  }

  const env = readTestEnv();
  const { deleted, scanned } = await purgeTestUsers(env);

  console.log(`Limpieza de E2E: ${deleted} usuario(s) de prueba borrados de ${scanned} revisados.`);
}
