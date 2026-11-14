/**
 * Report Generator · CP4 · §13.
 *
 * ---------------------------------------------------------------------------------------
 * Redacta; no recalcula
 *
 * El informe no vuelve a evaluar nada. Recibe los veredictos que el oráculo emitió y los
 * presenta. Si recalculara, habría **dos** autoridades sobre el mismo hecho y la discrepancia
 * entre ellas sería invisible: el informe diría una cosa y el ledger otra.
 *
 * Por eso tampoco deriva el veredicto global. Lo recibe, y se niega a redactar si no le llega.
 * ---------------------------------------------------------------------------------------
 */

import type { CampaignManifest } from './campaign';
import type { ContractSummary, PropertyEvaluation } from './oracle';
import type { RunValidity } from './verdict';

/** Los cuatro desenlaces que CP4 admite. Ninguno se infiere aquí. */
export const CAMPAIGN_VERDICTS = [
  'VALID_PASS',
  'VALID_CONTRACT_FAILURES',
  'VALID_INCONCLUSIVE',
  'INVALID_RUN',
] as const;
export type CampaignVerdict = (typeof CAMPAIGN_VERDICTS)[number];

export class ReportRefused extends Error {
  constructor(message: string) {
    super(`informe · ${message}`);
    this.name = 'ReportRefused';
  }
}

export interface CampaignOutcome {
  readonly manifest: CampaignManifest;
  readonly runValidity: RunValidity;
  readonly verdict: CampaignVerdict;
  readonly evaluations: readonly PropertyEvaluation[];
  readonly summary: ContractSummary;
  /** Razón de invalidez o de aborto, si la hubo. */
  readonly abortReason: string | null;
  /** Observaciones de producto, no evaluativas. El Observer sigue NOT_ACTIVE. */
  readonly notes: readonly string[];
  /** §13 · desviaciones del escenario pre-registrado. Vacío significa ninguna, no «sin mirar». */
  readonly deviations: readonly string[];
  readonly teardownVerified: boolean;
  readonly observationComplete: boolean;
  readonly scenarioCompleted: boolean;
  readonly ledgerPath: string;
  readonly ledgerSha256: string;
}

/**
 * Deriva el veredicto global a partir de hechos, en un solo sitio.
 *
 * Existe para que nadie lo elija a mano, y su orden es deliberado: la invalidez manda sobre
 * todo lo demás, un `FAIL` manda sobre la cobertura, y un `INCONCLUSIVE` impide declarar PASS.
 * Un run sin ninguna propiedad evaluada **no** es un PASS: es inconcluyente.
 */
export function deriveVerdict(facts: {
  readonly runValidity: RunValidity;
  readonly summary: ContractSummary;
}): CampaignVerdict {
  if (facts.runValidity === 'INVALID_RUN') return 'INVALID_RUN';
  if (facts.summary.fail > 0) return 'VALID_CONTRACT_FAILURES';
  if (facts.summary.inconclusive > 0 || facts.summary.pass === 0) return 'VALID_INCONCLUSIVE';
  return 'VALID_PASS';
}

/** Informe legible por máquina. Es el artefacto citable. */
export function machineReport(outcome: CampaignOutcome): string {
  if (!CAMPAIGN_VERDICTS.includes(outcome.verdict)) {
    throw new ReportRefused(`veredicto no admitido: «${outcome.verdict}»`);
  }
  return `${JSON.stringify(
    {
      campaign: {
        campaignId: outcome.manifest.campaignId,
        runOrdinal: outcome.manifest.runOrdinal,
        digest: outcome.manifest.digest,
        labBuild: outcome.manifest.labBuild,
        studyOsBuild: outcome.manifest.studyOsBuild,
        substrateFingerprint: outcome.manifest.substrateFingerprint,
        executionMode: outcome.manifest.executionMode,
        startedAt: outcome.manifest.startedAt,
        profile: `${outcome.manifest.profileId}@${outcome.manifest.profileVersion}`,
        scenario: `${outcome.manifest.scenarioId}@${outcome.manifest.scenarioVersion}`,
        corpus: `${outcome.manifest.corpusId}@${outcome.manifest.corpusVersion}`,
        corpusHash: outcome.manifest.corpusHash,
        preregistrationDigest: outcome.manifest.preregistrationDigest,
      },
      run: {
        validity: outcome.runValidity,
        verdict: outcome.verdict,
        abortReason: outcome.abortReason,
        scenarioCompleted: outcome.scenarioCompleted,
        deviations: outcome.deviations,
        observationComplete: outcome.observationComplete,
        teardownVerified: outcome.teardownVerified,
      },
      contract: {
        ...outcome.summary,
        properties: outcome.evaluations.map((evaluation) => ({
          propertyId: evaluation.propertyId,
          contract: evaluation.record.contract,
          coverage: evaluation.record.coverage,
          runValidity: evaluation.record.runValidity,
          humanReview: evaluation.record.humanReview,
          negativeAssertion: evaluation.record.negativeAssertion,
          completenessEstablished: evaluation.record.completenessEstablished,
          ruleVersion: evaluation.record.ruleVersion,
          rationale: evaluation.rationale,
        })),
      },
      observer: { state: 'NOT_ACTIVE', notes: outcome.notes },
      ledger: { path: outcome.ledgerPath, sha256: outcome.ledgerSha256 },
    },
    null,
    2,
  )}\n`;
}

const VERDICT_PROSE: Readonly<Record<CampaignVerdict, string>> = {
  VALID_PASS: 'Ejecución válida · todas las propiedades aplicables en PASS',
  VALID_CONTRACT_FAILURES: 'Ejecución válida · con incumplimientos contractuales',
  VALID_INCONCLUSIVE: 'Ejecución válida · inconcluyente',
  INVALID_RUN: 'Ejecución inválida',
};

/** Informe legible por una persona. Mismos hechos, sin un número nuevo. */
export function humanReport(outcome: CampaignOutcome): string {
  const lines: string[] = [
    `# Campaña ${outcome.manifest.campaignId} · ejecución ${outcome.manifest.runOrdinal}`,
    '',
    `**${VERDICT_PROSE[outcome.verdict]}**`,
    '',
    '## Identidades',
    '',
    `- laboratorio: \`${outcome.manifest.labBuild}\``,
    `- STUDY OS: \`${outcome.manifest.studyOsBuild}\``,
    `- perfil: ${outcome.manifest.profileId} v${outcome.manifest.profileVersion} · \`${outcome.manifest.profileHash}\``,
    `- escenario: ${outcome.manifest.scenarioId} v${outcome.manifest.scenarioVersion} · \`${outcome.manifest.scenarioHash}\``,
    `- corpus: ${outcome.manifest.corpusId} v${outcome.manifest.corpusVersion} · \`${outcome.manifest.corpusHash}\``,
    `- pre-registro: \`${outcome.manifest.preregistrationDigest}\``,
    `- sustrato: \`${outcome.manifest.substrateFingerprint}\` · ${outcome.manifest.executionMode}`,
    `- manifiesto: \`${outcome.manifest.digest}\``,
    '',
    '## Ejecución',
    '',
    `- escenario completado: ${outcome.scenarioCompleted ? 'sí' : 'no'}`,
    `- observación completa: ${outcome.observationComplete ? 'sí' : 'no'}`,
    `- teardown verificado: ${outcome.teardownVerified ? 'sí' : 'no'}`,
  ];

  if (outcome.abortReason !== null) {
    lines.push(`- aborto: ${outcome.abortReason}`);
  }

  lines.push(
    '',
    '## Contrato',
    '',
    `PASS ${outcome.summary.pass} · FAIL ${outcome.summary.fail} · INCONCLUSIVE ` +
      `${outcome.summary.inconclusive} · NOT_APPLICABLE ${outcome.summary.notApplicable}`,
    '',
    `Denominador contractual: ${outcome.summary.denominator}. ` +
      '`NOT_APPLICABLE` queda fuera porque no hay obligación que medir; `INCONCLUSIVE` queda ' +
      'dentro, porque excluirlo inflaría la cobertura justo donde falta evidencia.',
    '',
    '| Propiedad | Contrato | Cobertura | Revisión | Por qué |',
    '| --- | --- | --- | --- | --- |',
  );

  for (const evaluation of outcome.evaluations) {
    lines.push(
      `| ${evaluation.propertyId} | ${evaluation.record.contract} | ` +
        `${evaluation.record.coverage} | ${evaluation.record.humanReview} | ${evaluation.rationale} |`,
    );
  }

  lines.push('', '## Desviaciones del escenario', '');
  if (outcome.deviations.length === 0) {
    lines.push('Ninguna.');
  } else {
    for (const deviation of outcome.deviations) lines.push(`- ${deviation}`);
  }

  lines.push(
    '',
    '## Observador',
    '',
    'Estado: **NOT_ACTIVE**. Las notas que siguen no son evaluativas y no promueven nada.',
    '',
  );
  if (outcome.notes.length === 0) {
    lines.push('Sin notas.');
  } else {
    for (const note of outcome.notes) lines.push(`- ${note}`);
  }

  lines.push(
    '',
    '## Ledger',
    '',
    `\`${outcome.ledgerPath}\` · sha256 \`${outcome.ledgerSha256}\``,
    '',
    '---',
    '',
    'Este informe **no afirma nada sobre eficacia pedagógica**. Mide obligaciones de contrato ' +
      'sobre una ejecución sintética, en una instancia efímera, con corpus generado.',
    '',
  );

  return lines.join('\n');
}
