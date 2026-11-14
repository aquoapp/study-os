/**
 * Experimental Harness · CP2 · prepara y destruye **solo** la instancia efímera.
 *
 * ---------------------------------------------------------------------------
 * La guarda destructiva
 *
 * Destruir es la operación en la que un error no se puede deshacer, así que aquí no se confía en
 * la intención de quien llama: antes de cada operación destructiva se comprueba que la identidad
 * del destino coincide **exactamente** con la del sustrato que se verificó al arrancar.
 *
 * Esto cubre un caso concreto y real: que alguien reutilice el Harness con un entorno distinto
 * del que validó, por ejemplo porque una variable cambió a mitad de ejecución. La identidad se
 * captura una vez y se compara, en lugar de releerse.
 * ---------------------------------------------------------------------------
 */

import { randomUUID } from 'node:crypto';

import type { HarnessCredentials } from './credentials';
import type { SubstrateIdentity } from './substrate';

/** Prefijo inequívoco de todo lo que crea el laboratorio. */
export const SYNTHETIC_PREFIX = 'lab-synthetic';

export class DestructiveRefused extends Error {
  constructor(message: string) {
    super(`operación destructiva rechazada · ${message}`);
    this.name = 'DestructiveRefused';
  }
}

export interface SyntheticIdentity {
  readonly email: string;
  readonly password: string;
  readonly label: string;
}

/**
 * Crea los datos de una identidad sintética.
 *
 * El correo lleva el prefijo del laboratorio y un dominio reservado para pruebas, de modo que
 * nadie pueda confundirla con una persona ni enviarle nada por error.
 */
export function syntheticIdentity(label: string): SyntheticIdentity {
  const unique = randomUUID();
  return {
    email: `${SYNTHETIC_PREFIX}-${label}-${unique}@study-os.test`,
    password: `Lab-${unique.slice(0, 12)}!`,
    label,
  };
}

/** Verdadero solo para lo que el laboratorio creó. */
export function isSynthetic(email: string): boolean {
  return email.startsWith(`${SYNTHETIC_PREFIX}-`) && email.endsWith('@study-os.test');
}

export interface TeardownResult {
  readonly destroyed: boolean;
  readonly substrateFingerprint: string;
  readonly at: string;
}

export interface HarnessContext {
  readonly credentials: HarnessCredentials;
  /** Identidad capturada al verificar el sustrato. No se relee. */
  readonly identity: SubstrateIdentity;
}

/**
 * Comprueba que la operación destructiva se dirige al sustrato verificado.
 *
 * @param observed identidad recalculada en el momento de destruir
 */
export function assertDestructiveAllowed(
  context: HarnessContext,
  observed: SubstrateIdentity,
): void {
  if (observed.kind !== context.identity.kind) {
    throw new DestructiveRefused(
      `el destino dice ser "${observed.kind}" y el sustrato verificado era ` +
        `"${context.identity.kind}"`,
    );
  }
  if (observed.fingerprint !== context.identity.fingerprint) {
    throw new DestructiveRefused(
      'la huella del destino no coincide con la del sustrato verificado al arrancar. Una ' +
        'instancia distinta de la que se validó no se destruye, se aborta.',
    );
  }
  if (observed.databaseHost !== context.identity.databaseHost) {
    throw new DestructiveRefused('el host del destino cambió respecto al verificado');
  }
}

/**
 * Destruye el entorno efímero.
 *
 * La destrucción del sustrato **es** la limpieza: no hay que recorrer tablas ni borrar filas, de
 * modo que ninguna operación del laboratorio puede alcanzar evidencia humana. No existe en este
 * módulo ninguna función que borre datos de un proyecto remoto, y esa ausencia es deliberada.
 */
export function teardown(
  context: HarnessContext,
  observed: SubstrateIdentity,
  destroy: () => void,
): TeardownResult {
  assertDestructiveAllowed(context, observed);
  destroy();
  return {
    destroyed: true,
    substrateFingerprint: context.identity.fingerprint,
    at: new Date().toISOString(),
  };
}
