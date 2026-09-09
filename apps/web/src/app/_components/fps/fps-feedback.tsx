import styles from './fps.module.css';

/**
 * Corrección posterior al envío.
 *
 * Todo lo que se muestra viene del **resultado devuelto por la RPC** al aceptar el envío. No
 * se consulta la clave por separado, no se muestra el identificador de la versión de clave y
 * no se calcula nada en el cliente (INV-101, REQ-F09).
 *
 * Orden de los bloques (REQ-F10, parcialmente satisfecho): resultado → tu respuesta →
 * respuesta correcta → por qué → tu confianza → procedencia → siguiente. El análisis del
 * distractor y la ayuda del Tutor **no se fabrican**: no existe modelo de datos para el
 * primero ni capacidad para la segunda.
 *
 * El color nunca es el único portador del resultado: hay texto y una marca de forma distinta.
 */

export interface FeedbackOutcome {
  readonly answerKind: 'OPTION' | 'BLANK';
  readonly isCorrect: boolean;
  readonly selectedOptionId: string | null;
  readonly correctOptionId: string;
  readonly explanation: string | null;
  readonly confidenceValue: number | null;
}

export interface FeedbackOption {
  readonly id: string;
  readonly key: string;
  readonly body: string;
}

interface Props {
  readonly outcome: FeedbackOutcome;
  readonly options: readonly FeedbackOption[];
  readonly confidenceLabel: string | null;
  readonly reference: string | null;
}

/** Calibración descriptiva, nunca evaluativa: describe lo ocurrido, no juzga a quien responde. */
function calibrationSentence(outcome: FeedbackOutcome, high: boolean): string {
  if (outcome.answerKind === 'BLANK') {
    return 'No respondiste. Esta es la respuesta y el porqué.';
  }
  if (outcome.isCorrect) {
    return high ? 'Acertaste y estabas segura.' : 'Acertaste, aunque no lo tenías claro.';
  }
  return high
    ? 'Esta la dabas por segura. Merece una segunda lectura.'
    : 'No lo tenías claro, y aquí está la explicación.';
}

function optionLabel(options: readonly FeedbackOption[], id: string | null): string | null {
  if (!id) return null;
  const found = options.find((option) => option.id === id);
  return found ? `${found.key} · ${found.body}` : null;
}

export function FpsFeedback({ outcome, options, confidenceLabel, reference }: Props) {
  const blank = outcome.answerKind === 'BLANK';
  const resultLabel = blank ? 'Sin responder' : outcome.isCorrect ? 'Correcto' : 'Incorrecto';
  const resultClass = blank
    ? styles.outcomeBlank
    : outcome.isCorrect
      ? styles.outcomeCorrect
      : styles.outcomeIncorrect;
  const mark = blank ? '–' : outcome.isCorrect ? '✓' : '✕';
  const highConfidence = (outcome.confidenceValue ?? 0) >= 3;

  return (
    <section className={styles.surface} aria-label="Corrección" data-testid="feedback">
      <p className={`${styles.outcome} ${resultClass}`} data-testid="resultado">
        <span className={styles.mark} aria-hidden="true">
          {mark}
        </span>
        <span>{resultLabel}</span>
      </p>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Tu respuesta</p>
        <p className={styles.blockValue} data-testid="tu-respuesta">
          {optionLabel(options, outcome.selectedOptionId) ?? 'No respondiste.'}
        </p>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Respuesta correcta</p>
        <p className={styles.blockValue} data-testid="respuesta-correcta">
          {optionLabel(options, outcome.correctOptionId) ?? '—'}
        </p>
      </div>

      {outcome.explanation ? (
        <div className={styles.block}>
          <p className={styles.blockLabel}>Por qué</p>
          <p className={styles.blockValue} data-testid="explicacion">
            {outcome.explanation}
          </p>
        </div>
      ) : null}

      <div className={styles.block}>
        <p className={styles.blockLabel}>Tu confianza</p>
        <p className={styles.blockValue} data-testid="calibracion">
          {confidenceLabel ? `${confidenceLabel}. ` : ''}
          {calibrationSentence(outcome, highConfidence)}
        </p>
      </div>

      {reference ? (
        <div className={styles.block}>
          <p className={styles.blockLabel}>Procedencia</p>
          <p className={styles.secondary}>{reference}</p>
        </div>
      ) : null}
    </section>
  );
}
