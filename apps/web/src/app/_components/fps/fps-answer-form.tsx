'use client';

import { useState, useTransition } from 'react';

import styles from './fps.module.css';

/**
 * Interacción de COMPROBAR: elegir opción, registrar confianza y enviar.
 *
 * Tres reglas que no son de estilo, sino de invariante:
 *
 * · **INV-103** — la opción elegida se ve con énfasis neutral y `aria-checked`. Ningún token,
 *   icono, texto ni atributo de correcto o incorrecto antes del envío, y el orden nunca cambia.
 * · **INV-102** — la confianza se registra **antes** de la corrección. Sin confianza, la acción
 *   de comprobar está deshabilitada y la pantalla dice por qué.
 * · **REQ-C08** — dejar la respuesta en blanco es una respuesta legítima, no una omisión: se
 *   puede comprobar sin elegir opción, y eso queda registrado como evidencia.
 *
 * Cada elección se autoguarda como evidencia real, de modo que volver más tarde restaura lo
 * que había: el estado local acelera la interfaz, pero la autoridad es siempre el servidor.
 */

export interface AnswerOption {
  readonly id: string;
  readonly key: string;
  readonly body: string;
}

export interface ConfidenceLevel {
  readonly value: number;
  readonly label: string;
}

interface Props {
  readonly options: readonly AnswerOption[];
  readonly levels: readonly ConfidenceLevel[];
  readonly initialSelectedOptionId: string | null;
  readonly initialConfidence: number | null;
  readonly onSelect: (optionId: string) => Promise<{ error: string | null }>;
  readonly onConfidence: (value: number) => Promise<{ error: string | null }>;
  readonly onSubmit: (
    optionId: string | null,
    confidence: number | null,
  ) => Promise<{ error: string | null }>;
}

export function FpsAnswerForm({
  options,
  levels,
  initialSelectedOptionId,
  initialConfidence,
  onSelect,
  onConfidence,
  onSubmit,
}: Props) {
  const [selected, setSelected] = useState<string | null>(initialSelectedOptionId);
  const [confidence, setConfidence] = useState<number | null>(initialConfidence);
  const [error, setError] = useState<string | null>(null);
  const [, startSaving] = useTransition();
  const [submitting, startSubmitting] = useTransition();

  // El autoguardado es evidencia de fondo: no puede bloquear la acción principal. La
  // confianza viaja también en el envío, así que comprobar antes de que aterrice no pierde
  // nada, y un botón que parpadea entre habilitado y no lo hace parecer roto.
  const canSubmit = confidence !== null && !submitting;

  return (
    <>
      <fieldset className={styles.options} role="radiogroup" aria-label="Opciones de respuesta">
        <legend className={styles.legend}>Elige una respuesta</legend>
        {options.map((option) => {
          const isSelected = option.id === selected;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid={`opcion-${option.key}`}
              className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
              onClick={() => {
                setSelected(option.id);
                setError(null);
                startSaving(async () => {
                  const result = await onSelect(option.id);
                  if (result?.error) setError(result.error);
                });
              }}
            >
              <span className={styles.optionKey} aria-hidden="true">
                {option.key}
              </span>
              <span>{option.body}</span>
            </button>
          );
        })}
      </fieldset>

      <fieldset className={styles.confidence} role="radiogroup" aria-label="Tu confianza">
        <legend className={styles.legend}>¿Cómo de segura estás?</legend>
        {levels.map((level) => {
          const isSelected = level.value === confidence;
          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid={`confianza-${level.value}`}
              className={`${styles.level} ${isSelected ? styles.levelSelected : ''}`}
              onClick={() => {
                setConfidence(level.value);
                setError(null);
                startSaving(async () => {
                  const result = await onConfidence(level.value);
                  if (result?.error) setError(result.error);
                });
              }}
            >
              {level.label}
            </button>
          );
        })}
      </fieldset>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!canSubmit}
          data-testid="comprobar"
          onClick={() => {
            setError(null);
            startSubmitting(async () => {
              const result = await onSubmit(selected, confidence);
              if (result?.error) setError(result.error);
            });
          }}
        >
          {submitting ? 'Comprobando…' : 'Comprobar'}
        </button>
        {confidence === null ? (
          <p className={styles.secondary} data-testid="falta-confianza">
            Elige cómo de segura estás para comprobar.
          </p>
        ) : null}
        {selected === null && confidence !== null ? (
          <p className={styles.secondary}>
            Puedes comprobar sin elegir opción: quedará registrado como respuesta en blanco.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className={styles.error} role="alert" data-testid="fps-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
