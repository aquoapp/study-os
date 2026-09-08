/**
 * Gemelo en Node de `@study-os/config/destructive`.
 *
 * Lee **el mismo** `packages/config/src/environment-policies.json` que el código
 * TypeScript. No reimplementa las reglas: solo aplica los datos.
 *
 * Existe porque las herramientas de línea de comandos son `.mjs` y no pueden
 * importar TypeScript. Un test comprueba que ambos lados dan la misma respuesta
 * para todas las combinaciones de entorno y operación.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const policies = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages/config/src/environment-policies.json'), 'utf8'),
);

export const AUTHORIZATION_ENV_VAR = policies.authorizationEnvVar;

export function authorizationTokenFor(environment, operation) {
  return `${environment}:${operation}`;
}

export class DestructiveOperationDenied extends Error {
  constructor(message) {
    super(message);
    this.name = 'DestructiveOperationDenied';
  }
}

export function assertDestructiveOperationAllowed(operation, environment, authorization) {
  const policy = policies.environments[environment];

  if (!policy) {
    throw new DestructiveOperationDenied(
      `Operación "${operation}" bloqueada: entorno desconocido "${String(environment)}". ` +
        'Ante la duda se cierra, no se abre.',
    );
  }

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

export function isLoopbackUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  } catch {
    return false;
  }
}

export { policies };
