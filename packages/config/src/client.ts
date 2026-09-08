/**
 * Configuración visible desde el cliente.
 *
 * Solo lee variables de `PUBLIC_ENV_ALLOWLIST`. Cualquier otra lectura desde este
 * módulo es un defecto: este fichero **se compila dentro del bundle del navegador**.
 *
 * REQ-A03 · REQ-A05 · EC-010
 */

import { isEnvironment, policyFor, type Environment, type EnvironmentPolicy } from './environments';

export interface PublicConfig {
  readonly environment: Environment;
  readonly policy: EnvironmentPolicy;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Configuración ausente: ${name}. Defínela en el entorno; no se versiona en el repositorio.`,
    );
  }
  return value;
}

/**
 * Next.js sustituye `process.env.NEXT_PUBLIC_*` en tiempo de compilación solo cuando
 * la referencia es literal y estática. Por eso están escritas una a una y no mediante
 * un índice calculado.
 */
export function readPublicConfig(): PublicConfig {
  const rawEnvironment = process.env.NEXT_PUBLIC_ENVIRONMENT;

  if (!isEnvironment(rawEnvironment)) {
    throw new Error(
      `NEXT_PUBLIC_ENVIRONMENT inválido: ${String(rawEnvironment)}. Valores permitidos: local, staging, production.`,
    );
  }

  return {
    environment: rawEnvironment,
    policy: policyFor(rawEnvironment),
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: required(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}
