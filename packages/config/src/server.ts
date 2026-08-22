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
 * Guarda operativa: impide que una herramienta destructiva se ejecute contra un
 * entorno que no lo admite. Se apoya en el dato del entorno, no en recordar un flag.
 */
export function assertDestructiveOperationAllowed(operation: string): void {
  const { policy, environment } = readPublicConfig();
  if (!policy.allowsDestructiveReset) {
    throw new Error(
      `Operación destructiva "${operation}" bloqueada en el entorno "${environment}". ` +
        'Requiere aprobación humana explícita (Engineering Constitution · human approval required).',
    );
  }
}
