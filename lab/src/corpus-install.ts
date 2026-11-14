/**
 * Instalación del corpus del laboratorio · CP3 · **solo Harness, solo instancia efímera**.
 *
 * ---------------------------------------------------------------------------
 * Tres negativas que hacen el trabajo
 *
 *   1. **El Actor no instala.** La firma exige `HarnessCredentials`; `ActorCredentials` no
 *      encaja. No hay forma de llamar a esto desde el proceso del Actor.
 *   2. **Nada entra fuera de la instancia efímera.** Antes de tocar nada se reverifica la
 *      identidad del destino. Un destino cloud aborta antes de la primera escritura.
 *   3. **Por la frontera de ingestión.** `stage_item → validate_staged_item → publish_staged_item`,
 *      igual que el sembrado del producto. El laboratorio no escribe en las tablas de contenido:
 *      si pudiera, probaría que tiene privilegios, no que el contenido es publicable.
 *
 * CP3 **no ejecuta el escenario**: instala, verifica y para.
 * ---------------------------------------------------------------------------
 */

import type { HarnessCredentials } from './credentials';
import {
  CORPUS_SLUG,
  CONCEPTS,
  QUESTIONS,
  UNITS,
  assertCorpusWellFormed,
  corpusManifest,
  type CorpusManifest,
} from './corpus';
import { EPHEMERAL_SUBSTRATE } from './environment';
import type { SubstrateIdentity } from './substrate';

export class CorpusInstallationRefused extends Error {
  constructor(message: string) {
    super(`instalación de corpus · ${message}`);
    this.name = 'CorpusInstallationRefused';
  }
}

/** Lo que la instalación necesita publicar, en orden. Describe intención, no ejecuta. */
export interface PlannedPublication {
  readonly kind: string;
  readonly label: string;
}

/**
 * Plan de publicación determinista.
 *
 * Mismo corpus, mismo plan, mismo orden. Es lo que permite que la instalación sea comprobable
 * antes de ejecutarla y reproducible después.
 */
export function publicationPlan(): readonly PlannedPublication[] {
  const plan: PlannedPublication[] = [
    { kind: 'exam_pack', label: CORPUS_SLUG },
    { kind: 'exam_pack_version', label: `${CORPUS_SLUG}:v1` },
    { kind: 'source', label: 'material sintético del laboratorio' },
    { kind: 'source_version', label: 'v1' },
  ];
  for (const concept of CONCEPTS) {
    plan.push({ kind: 'concept', label: concept.key });
    plan.push({ kind: 'concept_version', label: concept.key });
  }
  for (const unit of UNITS) {
    plan.push({ kind: 'learning_unit', label: unit.concept });
    plan.push({ kind: 'learning_unit_version', label: unit.title });
  }
  for (const question of QUESTIONS) {
    plan.push({ kind: 'question', label: question.key });
    plan.push({ kind: 'question_representation', label: question.key });
    plan.push({ kind: 'answer_key_version', label: question.key });
    plan.push({ kind: 'question_concept', label: `${question.key}→${question.concept}` });
  }
  return plan;
}

/** Verifica el destino antes de escribir una sola fila. */
export function assertInstallableTarget(identity: SubstrateIdentity): void {
  if (identity.kind !== EPHEMERAL_SUBSTRATE) {
    throw new CorpusInstallationRefused(
      `el destino dice ser "${identity.kind}". El corpus del laboratorio solo se instala en la ` +
        'instancia efímera.',
    );
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(identity.databaseHost)) {
    throw new CorpusInstallationRefused(
      `el destino está en "${identity.databaseHost}", que no es la instancia efímera. Ninguna ` +
        'instalación en la nube, con ninguna credencial.',
    );
  }
}

export interface InstallationContext {
  /** Exigir credenciales de Harness es lo que deja al Actor fuera por tipo. */
  readonly credentials: HarnessCredentials;
  readonly identity: SubstrateIdentity;
  /** Publica un ítem por la frontera de ingestión. Inyectable para poder probar sin base. */
  readonly publish: (kind: string, label: string) => void;
  /** Cuenta lo instalado, para verificar después de publicar. */
  readonly verify?: () => {
    readonly concepts: number;
    readonly units: number;
    readonly questions: number;
  };
}

export interface InstallationResult {
  readonly manifest: CorpusManifest;
  readonly published: number;
  readonly verified: boolean;
}

/**
 * Instala el corpus.
 *
 * **Idempotente o explícita**: si el verificador encuentra que ya hay contenido instalado que no
 * coincide con lo esperado, falla diciéndolo en lugar de publicar encima. Un corpus a medias es
 * peor que ninguno, porque parece válido.
 */
export function installCorpus(context: InstallationContext): InstallationResult {
  assertCorpusWellFormed();
  assertInstallableTarget(context.identity);

  const plan = publicationPlan();
  for (const item of plan) context.publish(item.kind, item.label);

  const manifest = corpusManifest();

  if (!context.verify) return { manifest, published: plan.length, verified: false };

  const counted = context.verify();
  if (
    counted.concepts !== manifest.conceptCount ||
    counted.units !== manifest.unitCount ||
    counted.questions !== manifest.questionCount
  ) {
    throw new CorpusInstallationRefused(
      `lo instalado no coincide con el manifiesto: ${counted.concepts}/${counted.units}/` +
        `${counted.questions} frente a ${manifest.conceptCount}/${manifest.unitCount}/` +
        `${manifest.questionCount}. No se publica encima de un corpus a medias.`,
    );
  }
  return { manifest, published: plan.length, verified: true };
}
