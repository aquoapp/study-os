/**
 * Entornos de Study OS.
 *
 * REQ-A03 · «Entornos local/staging/producción con secretos separados»
 * EC-010  · «Secretos de servicio/proveedor nunca en cliente»
 *
 * Este módulo declara *qué* entornos existen y *qué forma* tiene su configuración.
 * No contiene ningún valor de configuración real y no debe contenerlo nunca:
 * los valores viven en el gestor de secretos de cada entorno.
 */

export const ENVIRONMENTS = ['local', 'staging', 'production'] as const;

export type Environment = (typeof ENVIRONMENTS)[number];

export function isEnvironment(value: unknown): value is Environment {
  return typeof value === 'string' && (ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Allowlist de variables que pueden alcanzar el bundle del cliente.
 *
 * El escáner de bundle (`tools/guards/secret-scan.mjs`) trata cualquier otra variable
 * `NEXT_PUBLIC_*` como un hallazgo. Añadir una entrada aquí es una decisión deliberada,
 * no un trámite: todo lo que esté en esta lista es público de facto.
 */
export const PUBLIC_ENV_ALLOWLIST = [
  'NEXT_PUBLIC_ENVIRONMENT',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export type PublicEnvKey = (typeof PUBLIC_ENV_ALLOWLIST)[number];

/**
 * Variables exclusivamente de servidor. Que una de estas aparezca en el bundle del
 * cliente es un fallo duro del Checkpoint Contract («secret exposure»).
 */
export const SERVER_ONLY_ENV_KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL'] as const;

export type ServerOnlyEnvKey = (typeof SERVER_ONLY_ENV_KEYS)[number];

/**
 * Reglas por entorno que el código puede consultar sin conocer ningún secreto.
 *
 * `allowsDestructiveReset` existe para que ninguna herramienta pueda ejecutar un
 * `db reset` contra producción por descuido: la decisión no depende de recordar
 * un flag, sino de un dato del entorno.
 */
export interface EnvironmentPolicy {
  readonly environment: Environment;
  /** Un reset destructivo de base de datos es aceptable en este entorno. */
  readonly allowsDestructiveReset: boolean;
  /** Los datos de este entorno son datos reales de personas. */
  readonly holdsRealUserData: boolean;
  /** Se exige HTTPS y cookies `Secure`. */
  readonly requiresSecureTransport: boolean;
}

export const ENVIRONMENT_POLICIES: Readonly<Record<Environment, EnvironmentPolicy>> = {
  local: {
    environment: 'local',
    allowsDestructiveReset: true,
    holdsRealUserData: false,
    requiresSecureTransport: false,
  },
  staging: {
    environment: 'staging',
    allowsDestructiveReset: true,
    holdsRealUserData: false,
    requiresSecureTransport: true,
  },
  production: {
    environment: 'production',
    allowsDestructiveReset: false,
    holdsRealUserData: true,
    requiresSecureTransport: true,
  },
};

export function policyFor(environment: Environment): EnvironmentPolicy {
  const policy = ENVIRONMENT_POLICIES[environment];
  /* c8 ignore next */
  if (!policy) throw new Error(`Entorno desconocido: ${String(environment)}`);
  return policy;
}
