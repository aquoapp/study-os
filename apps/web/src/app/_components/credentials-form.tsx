'use client';

import { useActionState } from 'react';

import type { AuthActionState } from '../actions/auth';

/**
 * Formulario de credenciales compartido por entrar y registro.
 *
 * Una sola acción primaria visible (INV-104). El error se comunica con texto, no
 * solo con color (INV-105) y se anuncia mediante `role="alert"`.
 */

interface CredentialsFormProps {
  readonly action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  readonly submitLabel: string;
  readonly passwordAutoComplete: 'current-password' | 'new-password';
  readonly testId: string;
}

const INITIAL_STATE: AuthActionState = { error: null };

export function CredentialsForm({
  action,
  submitLabel,
  passwordAutoComplete,
  testId,
}: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form
      action={formAction}
      data-testid={testId}
      style={{ display: 'grid', gap: 16, maxWidth: 360 }}
    >
      <label style={{ display: 'grid', gap: 4 }}>
        <span>Correo electrónico</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          data-testid="email-input"
          style={{
            padding: 8,
            borderRadius: 'var(--so-radius-micro)',
            border: '1px solid var(--so-color-slate)',
            background: 'var(--so-color-surface)',
            color: 'var(--so-color-ink)',
          }}
        />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Contraseña</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete={passwordAutoComplete}
          data-testid="password-input"
          style={{
            padding: 8,
            borderRadius: 'var(--so-radius-micro)',
            border: '1px solid var(--so-color-slate)',
            background: 'var(--so-color-surface)',
            color: 'var(--so-color-ink)',
          }}
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          data-testid="auth-error"
          style={{ color: 'var(--so-color-brick)', margin: 0 }}
        >
          <span aria-hidden="true">⚠ </span>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="submit-button"
        style={{
          background: 'var(--so-color-navy)',
          color: 'var(--so-color-on-dark)',
          border: 'none',
          borderRadius: 'var(--so-radius-control)',
          padding: '0 16px',
          minHeight: 'var(--so-touch-target-min)',
          cursor: pending ? 'progress' : 'pointer',
        }}
      >
        {pending ? 'Enviando…' : submitLabel}
      </button>
    </form>
  );
}
