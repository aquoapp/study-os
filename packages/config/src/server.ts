import 'server-only';

/**
 * Configuración exclusiva de servidor.
 *
 * `import 'server-only'` hace que el build **falle** si este módulo entra en un
 * Client Component. Es la diferencia entre una convención y un control (EC-010,
 * Manifest §14 «never expose service-role/provider secret in browser»).
 *
 * REQ-A03 · REQ-A05
 */

import { readPublicConfig, type PublicConfig } from './client';
import {
  AUTHORIZATION_ENV_VAR,
  assertDestructiveOperationAllowed as assertDestructiveOperationAllowedIn,
} from './destructive';

export { SERVER_ONLY_ENV_KEYS, type ServerOnlyEnvKey } from './server-env-keys';
export {
  AUTHORIZATION_ENV_VAR,
  DestructiveOperationDenied,
  assertAutomatedTestsAllowed,
  authorizationTokenFor,
  destructivePolicyFor,
  isLoopbackUrl,
} from './destructive';

export interface ServerConfig extends PublicConfig {
  /**
   * Clave de rol de servicio. Atraviesa RLS: solo puede usarse en superficies de
   * servidor con identidad ya verificada (INV-116) y nunca para servir datos de un
   * usuario a partir de un `user_id` suministrado por el cliente (Manifest §14).
   */
  readonly supabaseServiceRoleKey: string;
}

function requiredServer(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Configuración de servidor ausente: ${name}. Se configura en el gestor de secretos del entorno.`,
    );
  }
  return value;
}

export function readServerConfig(): ServerConfig {
  const publicConfig = readPublicConfig();

  return {
    ...publicConfig,
    supabaseServiceRoleKey: requiredServer(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}

/**
 * Guarda operativa: impide que una operación destructiva se ejecute contra un
 * entorno que no la admite.
 *
 * Delega en `./destructive`, que es donde vive la regla, para que la misma
 * decisión pueda tomarla también `tools/db.mjs` y el arranque de los tests. Antes
 * la lógica estaba aquí dentro, tras `import 'server-only'`, lo que la hacía
 * inalcanzable desde esos dos sitios y en la práctica dejaba la función sin usar.
 */
export function assertDestructiveOperationAllowed(operation: string): void {
  const { environment } = readPublicConfig();
  assertDestructiveOperationAllowedIn(operation, environment, process.env[AUTHORIZATION_ENV_VAR]);
}
