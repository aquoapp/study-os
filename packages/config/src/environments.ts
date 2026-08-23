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

import policies from './environment-policies.json';

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

/*
 * Las variables exclusivamente de servidor NO se declaran aquí.
 *
 * Este módulo es alcanzable desde el navegador a través del barril
 * `@study-os/config`, y el inventario de claves de servidor no tiene por qué
 * estar en ese grafo. Vive en `./server-env-keys`, que solo se exporta desde
 * `@study-os/config/server`. Ver EC-010 y el comentario de ese fichero.
 */

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
  /** Aun admitiéndola, la operación exige autorización explícita en el entorno. */
  readonly requiresExplicitAuthorization: boolean;
  /** Los datos de este entorno son datos reales de personas. */
  readonly holdsRealUserData: boolean;
  /** Se exige HTTPS y cookies `Secure`. */
  readonly requiresSecureTransport: boolean;
  /** Pueden ejecutarse tests que crean y borran usuarios. */
  readonly allowsAutomatedTests: boolean;
}

/**
 * Los valores viven en `environment-policies.json` y no aquí.
 *
 * `tools/db.mjs` es un script de Node sin resolutor de TypeScript y necesita
 * exactamente las mismas reglas para decidir si un `db reset` puede ejecutarse.
 * Con dos tablas, la del código y la de la herramienta se separan a la primera
 * modificación, y la que decide en la línea de comandos es justo la que protege
 * los datos.
 */
export const ENVIRONMENT_POLICIES: Readonly<Record<Environment, EnvironmentPolicy>> = Object.freeze(
  Object.fromEntries(
    ENVIRONMENTS.map((environment) => {
      const raw = policies.environments[environment];
      return [environment, { environment, ...raw }];
    }),
  ) as Record<Environment, EnvironmentPolicy>,
);

export function policyFor(environment: Environment): EnvironmentPolicy {
  const policy = ENVIRONMENT_POLICIES[environment];
  /* c8 ignore next */
  if (!policy) throw new Error(`Entorno desconocido: ${String(environment)}`);
  return policy;
}
