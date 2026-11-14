/**
 * Persistencia durable del Experimental Ledger · CP3 · cierra el punto M de CP2.
 *
 * ---------------------------------------------------------------------------
 * Artefacto del laboratorio, no tabla de STUDY OS
 *
 * El ledger se escribe como **fichero JSON del laboratorio**. No es una tabla del producto, no
 * vive en su esquema y nada suyo lo lee. Esa separación es la que impide que el registro del
 * experimento adquiera autoridad sobre lo observado.
 *
 * Dos negativas que son estructura, no advertencias:
 *
 *   1. **Sin secretos.** Antes de escribir, el contenido se barre buscando claves y cadenas de
 *      conexión. Si aparece una, no se escribe nada.
 *   2. **Sin claves de respuesta.** El ledger puede registrar qué pregunta se presentó; nunca
 *      cuál era la correcta. Un fichero que el Actor pudiera leer y que contuviera la clave
 *      haría trivial el experimento.
 *
 * Y una inmutabilidad: las acciones aceptadas no se reescriben. `appendAccepted` rechaza
 * duplicados, de modo que el registro no puede «corregirse» después para que cuadre.
 * ---------------------------------------------------------------------------
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  LEDGER_SCHEMA_VERSION,
  type AcceptedActionRecord,
  type CampaignRecord,
  type StepRecord,
} from './ledger';
import type { ObserverState } from './observer';

export class LedgerPersistenceRefused extends Error {
  constructor(message: string) {
    super(`ledger durable · ${message}`);
    this.name = 'LedgerPersistenceRefused';
  }
}

/** Identidades que el ledger debe registrar para que una ejecución sea reproducible. */
export interface DurableProvenance {
  readonly studyOsBuild: string;
  readonly labBuild: string;
  readonly substrateFingerprint: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly profileHash: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly scenarioHash: string;
  readonly corpusId: string;
  readonly corpusVersion: string;
  readonly corpusHash: string;
  readonly preregistrationDigest: string;
}

/**
 * Versión del ledger de campaña · CP4.
 *
 * CP3 congeló `lab-ledger-1.0.0` sin campaña real. §12 exige además validez del run y
 * procedencia de ruta, de modo que el esquema crece. El cambio es **aditivo** y por eso la
 * versión sube en el menor: ampliar un esquema versionado sin decirlo dejaría dos ficheros
 * distintos con la misma etiqueta, que es lo que una versión existe para evitar.
 */
export const LEDGER_SCHEMA_VERSION_CAMPAIGN = 'lab-ledger-1.1.0';

export const ACCEPTED_LEDGER_SCHEMA_VERSIONS = [
  LEDGER_SCHEMA_VERSION,
  LEDGER_SCHEMA_VERSION_CAMPAIGN,
] as const;
export type LedgerSchemaVersion = (typeof ACCEPTED_LEDGER_SCHEMA_VERSIONS)[number];

/** Procedencia de ruta por envío, tal y como el Observador la infirió. */
export interface LedgerRouteProvenance {
  readonly streamPosition: number;
  readonly attribution: string;
  readonly foldReason: string | null;
  readonly foldedAt: string | null;
  readonly latencySeconds: number | null;
  readonly rationale: string;
  /** Falso siempre en v1: el producto no registra qué ruta plegó. */
  readonly recordedByProduct: false;
}

export interface DurableLedger {
  readonly ledgerSchemaVersion: LedgerSchemaVersion;
  readonly campaignId: string;
  readonly runId: string;
  readonly provenance: DurableProvenance;
  readonly observerState: ObserverState;
  readonly campaign: CampaignRecord;
  readonly operationalTimestamps: {
    readonly startedAt: string;
    readonly writtenAt: string;
  };
  readonly teardown: { readonly destroyed: boolean; readonly at: string } | null;
  readonly artifacts: readonly { readonly kind: string; readonly sha256: string }[];
  /** §12 · validez del run. Obligatoria desde `lab-ledger-1.1.0`. */
  readonly runValidity?: 'VALID' | 'INVALID_RUN';
  /** §12 · procedencia de ruta. Obligatoria desde `lab-ledger-1.1.0`, aunque esté vacía. */
  readonly routeProvenance?: readonly LedgerRouteProvenance[];
}

/** Patrones que no pueden aparecer en un ledger escrito. */
const SECRET_SHAPES = [
  /postgres(ql)?:\/\/[^\s"']+/i,
  /\bsb_secret_[A-Za-z0-9_-]+/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /service_role_key\s*[:=]/i,
];

/** Campos cuya sola presencia delata una clave de respuesta. */
const ANSWER_KEY_SHAPES = [/correct_option/i, /correctOption/i, /answer_key/i, /answerKey/i];

export function assertNoSecrets(serialized: string): void {
  for (const shape of SECRET_SHAPES) {
    if (shape.test(serialized)) {
      throw new LedgerPersistenceRefused(
        'el contenido contiene algo con forma de credencial. No se escribe nada: un ledger con ' +
          'un secreto dentro es peor que no tener ledger.',
      );
    }
  }
}

export function assertNoAnswerKeys(serialized: string): void {
  for (const shape of ANSWER_KEY_SHAPES) {
    if (shape.test(serialized)) {
      throw new LedgerPersistenceRefused(
        'el contenido expone una clave de respuesta. El ledger registra qué se presentó, nunca ' +
          'cuál era la correcta.',
      );
    }
  }
}

/** Añade una acción aceptada. Rechaza reescribir una existente. */
export function appendAccepted(step: StepRecord, accepted: AcceptedActionRecord): StepRecord {
  if (step.accepted.some((existing) => existing.actionId === accepted.actionId)) {
    throw new LedgerPersistenceRefused(
      `la acción ${accepted.actionId} ya figura como aceptada: una aceptación no se reescribe`,
    );
  }
  if (!step.actions.some((action) => action.actionId === accepted.actionId)) {
    throw new LedgerPersistenceRefused(
      `la acción ${accepted.actionId} no fue intentada: una aceptación sin intento es evidencia ` +
        'fabricada',
    );
  }
  return { ...step, accepted: [...step.accepted, accepted] };
}

export interface WriteResult {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

/**
 * Escribe el ledger a disco.
 *
 * Serializa, **comprueba y solo entonces escribe**. El orden importa: validar después de escribir
 * dejaría el fichero con el secreto dentro aunque el proceso fallara a continuación.
 */
export function writeDurableLedger(ledger: DurableLedger, path: string): WriteResult {
  if (
    !(ACCEPTED_LEDGER_SCHEMA_VERSIONS as readonly string[]).includes(ledger.ledgerSchemaVersion)
  ) {
    throw new LedgerPersistenceRefused(
      `versión de esquema desconocida: ${ledger.ledgerSchemaVersion}`,
    );
  }

  // Un ledger de campaña sin validez de run o sin procedencia de ruta no cumple §12. Se
  // rechaza en vez de escribirse incompleto: un artefacto incompleto se cita igual que uno
  // completo, y nadie nota la diferencia leyéndolo.
  if (ledger.ledgerSchemaVersion === LEDGER_SCHEMA_VERSION_CAMPAIGN) {
    if (ledger.runValidity === undefined) {
      throw new LedgerPersistenceRefused('un ledger de campaña declara la validez del run');
    }
    if (ledger.routeProvenance === undefined) {
      throw new LedgerPersistenceRefused(
        'un ledger de campaña declara la procedencia de ruta, aunque sea una lista vacía',
      );
    }
  }
  const serialized = `${JSON.stringify(ledger, null, 2)}\n`;
  assertNoSecrets(serialized);
  assertNoAnswerKeys(serialized);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serialized, 'utf8');

  return {
    path,
    sha256: createHash('sha256').update(serialized).digest('hex'),
    bytes: Buffer.byteLength(serialized, 'utf8'),
  };
}
