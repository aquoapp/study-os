'use client';

import { useState, useTransition, type ReactNode } from 'react';

import styles from './fps.module.css';

/**
 * Acción del vertical: un botón que ejecuta una acción de servidor ya vinculada a su ítem.
 *
 * De la acción solo viaja al cliente **su tipo**, igual que en el formulario de onboarding: el
 * módulo de servidor no entra en la superficie de cliente ni por resolución de importaciones.
 *
 * El estado ocupado es real —`useTransition`—, no una animación: mientras la acción está en
 * curso el botón se deshabilita, de modo que un doble clic no produce un segundo envío.
 */

export interface FpsActionResult {
  readonly error: string | null;
}

interface Props {
  readonly action: () => Promise<FpsActionResult>;
  readonly children: ReactNode;
  readonly pendingLabel: string;
  readonly variant?: 'primary' | 'text';
  readonly disabled?: boolean;
  readonly testId?: string;
}

export function FpsActionButton({
  action,
  children,
  pendingLabel,
  variant = 'primary',
  disabled = false,
  testId,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={variant === 'primary' ? styles.primary : styles.textAction}
        disabled={pending || disabled}
        data-testid={testId}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? pendingLabel : children}
      </button>
      {error ? (
        <p className={styles.error} role="alert" data-testid="fps-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
