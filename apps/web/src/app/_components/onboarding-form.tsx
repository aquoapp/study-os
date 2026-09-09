'use client';

import { useActionState } from 'react';

import type { OnboardingActionState } from '../actions/onboarding';

/**
 * Formulario de onboarding mínimo (REQ-C01).
 *
 * Recibe la acción como prop, igual que `CredentialsForm`: así el módulo de servidor no
 * entra en la superficie de cliente ni siquiera por resolución de importaciones. De
 * `../actions/onboarding` solo viaja el **tipo**, que se borra al compilar.
 *
 * Una sola acción primaria (INV-104). Los errores se comunican con texto y `role="alert"`,
 * no solo con color (INV-105).
 */

export interface ExamPackOption {
  readonly id: string;
  readonly name: string;
}

interface OnboardingFormProps {
  readonly action: (
    state: OnboardingActionState,
    formData: FormData,
  ) => Promise<OnboardingActionState>;
  readonly packs: readonly ExamPackOption[];
}

const INITIAL_STATE: OnboardingActionState = { error: null, ok: false };

const DAYS: ReadonlyArray<readonly [string, string]> = [
  ['mon', 'Lunes'],
  ['tue', 'Martes'],
  ['wed', 'Miércoles'],
  ['thu', 'Jueves'],
  ['fri', 'Viernes'],
  ['sat', 'Sábado'],
  ['sun', 'Domingo'],
];

const fieldStyle = {
  padding: 8,
  borderRadius: 'var(--so-radius-micro)',
  border: '1px solid var(--so-color-slate)',
  background: 'var(--so-color-surface)',
  color: 'var(--so-color-ink)',
} as const;

export function OnboardingForm({ action, packs }: OnboardingFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  if (packs.length === 0) {
    return (
      <p data-testid="onboarding-sin-packs">
        Todavía no hay ningún examen disponible para preparar. En cuanto exista, podrás elegirlo
        aquí.
      </p>
    );
  }

  return (
    <form action={formAction} data-testid="onboarding-form" style={{ display: 'grid', gap: 20 }}>
      <label style={{ display: 'grid', gap: 4 }}>
        <span>¿Qué examen preparas?</span>
        <select name="exam_pack_id" required data-testid="pack-select" style={fieldStyle}>
          {packs.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>¿Cuántos minutos al día puedes dedicar?</span>
        <input
          type="number"
          name="default_daily_minutes"
          min={5}
          max={600}
          defaultValue={30}
          required
          data-testid="daily-minutes-input"
          style={fieldStyle}
        />
      </label>

      <fieldset style={{ display: 'grid', gap: 8, border: 'none', padding: 0 }}>
        <legend>Disponibilidad por día (opcional, en minutos)</legend>
        {DAYS.map(([key, label]) => (
          <label key={key} style={{ display: 'grid', gap: 4 }}>
            <span>{label}</span>
            <input
              type="number"
              name={`availability_${key}`}
              min={0}
              max={600}
              data-testid={`availability-${key}`}
              style={fieldStyle}
            />
          </label>
        ))}
      </fieldset>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Fecha objetivo (opcional)</span>
        <input type="date" name="target_date" data-testid="target-date-input" style={fieldStyle} />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Diagnóstico inicial</span>
        <select name="diagnostic_preference" data-testid="diagnostic-select" style={fieldStyle}>
          <option value="TAKE">Quiero hacerlo</option>
          <option value="SKIP">Prefiero saltarlo</option>
        </select>
      </label>

      {state.error ? (
        <p
          role="alert"
          data-testid="onboarding-error"
          style={{ color: 'var(--so-color-brick)', margin: 0 }}
        >
          <span aria-hidden="true">⚠ </span>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        className="so-action"
        disabled={pending}
        data-testid="onboarding-submit"
      >
        {pending ? 'Guardando…' : 'Guardar y continuar'}
      </button>
    </form>
  );
}
