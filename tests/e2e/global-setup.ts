import {
  AUTHORIZATION_ENV_VAR,
  assertAutomatedTestsAllowed,
  isLoopbackUrl,
} from '../../packages/config/src/destructive';

/**
 * Guarda de arranque de los E2E.
 *
 * Los E2E dan de alta usuarios reales a través de la interfaz. Contra producción
 * eso no es una prueba: es escribir en la base de datos de personas reales.
 *
 * Se comprueban tres cosas antes de abrir ningún navegador, y las tres tienen que
 * pasar:
 *
 *   1. el entorno declarado admite tests automatizados (producción nunca);
 *   2. staging exige autorización explícita;
 *   3. la URL de Supabase apunta de verdad a loopback cuando el entorno dice
 *      «local» — la etiqueta la escribe una persona y puede estar mal.
 *
 * Falla antes de ejecutar nada. Un E2E que se da cuenta a mitad de camino de que
 * estaba apuntando al sitio equivocado ya ha creado el usuario.
 */
export default function globalSetup(): void {
  const environment = process.env['NEXT_PUBLIC_ENVIRONMENT'] ?? '';
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';

  assertAutomatedTestsAllowed(environment, process.env[AUTHORIZATION_ENV_VAR]);

  if (environment === 'local' && supabaseUrl !== '' && !isLoopbackUrl(supabaseUrl)) {
    throw new Error(
      `NEXT_PUBLIC_ENVIRONMENT dice "local" pero NEXT_PUBLIC_SUPABASE_URL apunta a ` +
        `"${supabaseUrl}", que no es loopback. Los E2E crean usuarios: una etiqueta ` +
        'equivocada no puede autorizarlos contra una instancia remota.',
    );
  }

  console.log(`E2E autorizados contra el entorno "${environment}" (${supabaseUrl || 'sin URL'}).`);
}
