/**
 * Guarda de operaciones destructivas y de tests con privilegios.
 *
 * Engineering Constitution · «Human approval required for: destructive migrations,
 * canonical source mutations, RLS weakening, … production-secret changes.»
 * EC-011 · REQ-A03.
 *
 * ---------------------------------------------------------------------------
 * Por qué está en su propio módulo
 *
 * La versión anterior tenía esta comprobación dentro de `server.ts`, que empieza
 * con `import 'server-only'`. Eso la volvía inutilizable desde los tests y desde
 * las herramientas de línea de comandos, de modo que **nadie la llamaba**: era una
 * función muerta que daba apariencia de control. La auditoría lo señaló.
 *
 * Aquí no hay `server-only` porque no hay ningún secreto: solo se decide, a partir
 * del nombre del entorno, si una operación puede ejecutarse. `server.ts` la sigue
 * exponiendo con su firma anterior, y ahora la usan de verdad `tools/db.mjs` y el
 * arranque de los tests de integración y RLS.
 * ---------------------------------------------------------------------------
 */

import policies from './environment-policies.json';
import { isEnvironment, type Environment } from './environments';

export interface DestructivePolicy {
  readonly allowsDestructiveReset: boolean;
  readonly requiresExplicitAuthorization: boolean;
  readonly holdsRealUserData: boolean;
  readonly requiresSecureTransport: boolean;
  readonly allowsAutomatedTests: boolean;
}

const TABLE: Record<string, DestructivePolicy> = policies.environments;

export const AUTHORIZATION_ENV_VAR = policies.authorizationEnvVar;

export function destructivePolicyFor(environment: Environment): DestructivePolicy {
  const policy = TABLE[environment];
  if (!policy) throw new Error(`Entorno sin política declarada: ${String(environment)}`);
  return policy;
}

/** El texto exacto que debe llevar la variable de autorización. */
export function authorizationTokenFor(environment: Environment, operation: string): string {
  return `${environment}:${operation}`;
}

export class DestructiveOperationDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DestructiveOperationDenied';
  }
}

/**
 * Permite o deniega una operación destructiva.
 *
 * @param operation identificador estable, p. ej. `db-reset` o `create-test-user`
 * @param environment entorno objetivo
 * @param authorization contenido de `STUDY_OS_DESTRUCTIVE_AUTHORIZATION`
 */
export function assertDestructiveOperationAllowed(
  operation: string,
  environment: string,
  authorization: string | undefined,
): void {
  if (!isEnvironment(environment)) {
    throw new DestructiveOperationDenied(
      `Operación "${operation}" bloqueada: entorno desconocido "${String(environment)}". ` +
        'Ante la duda se cierra, no se abre.',
    );
  }

  const policy = destructivePolicyFor(environment);

  if (!policy.allowsDestructiveReset) {
    throw new DestructiveOperationDenied(
      `Operación destructiva "${operation}" prohibida en "${environment}". ` +
        'Este entorno contiene datos reales de personas y ninguna variable de entorno lo ' +
        'desbloquea: exige aprobación humana fuera de banda (Engineering Constitution).',
    );
  }

  if (policy.requiresExplicitAuthorization) {
    const expected = authorizationTokenFor(environment, operation);
    if (authorization !== expected) {
      throw new DestructiveOperationDenied(
        `Operación destructiva "${operation}" en "${environment}" requiere autorización ` +
          `explícita. Define ${AUTHORIZATION_ENV_VAR}="${expected}". ` +
          'Debe coincidir exactamente: no hay comodines, y una autorización sirve para una ' +
          'sola operación en un solo entorno.',
      );
    }
  }
}

/**
 * Permite o deniega la ejecución de tests que crean y borran usuarios.
 *
 * Separado de lo anterior porque la pregunta es distinta: no «puedo destruir esto»
 * sino «puedo escribir datos de prueba aquí». Producción responde que no en ambos
 * casos, pero por motivos que conviene no mezclar.
 */
export function assertAutomatedTestsAllowed(
  environment: string,
  authorization: string | undefined,
): void {
  if (!isEnvironment(environment)) {
    throw new DestructiveOperationDenied(
      `Tests automatizados bloqueados: entorno desconocido "${String(environment)}".`,
    );
  }

  const policy = destructivePolicyFor(environment);

  if (!policy.allowsAutomatedTests) {
    throw new DestructiveOperationDenied(
      `Los tests automatizados están prohibidos en "${environment}". ` +
        'Crean y borran usuarios con la clave de rol de servicio, que atraviesa RLS. ' +
        'Ninguna variable de entorno lo desbloquea.',
    );
  }

  if (policy.requiresExplicitAuthorization) {
    const expected = authorizationTokenFor(environment, 'automated-tests');
    if (authorization !== expected) {
      throw new DestructiveOperationDenied(
        `Ejecutar tests automatizados contra "${environment}" requiere autorización explícita. ` +
          `Define ${AUTHORIZATION_ENV_VAR}="${expected}".`,
      );
    }
  }
}

/**
 * ¿La URL apunta a una instancia local?
 *
 * El nombre del entorno lo escribe una persona y puede estar mal. La URL es el
 * dato que decide contra qué se ejecuta realmente, así que se comprueban las dos
 * cosas y no solo la etiqueta.
 */
export function isLoopbackUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  } catch {
    return false;
  }
}
