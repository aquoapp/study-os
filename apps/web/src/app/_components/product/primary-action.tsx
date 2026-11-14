'use client';

import { useState, useTransition, type ReactNode } from 'react';

import styles from './product.module.css';

/**
 * La acción primaria de una superficie · UX-INV-1 · UX-INV-20.
 *
 * De la acción de servidor solo viaja al cliente **su tipo**: el módulo de servidor no entra en la
 * superficie de cliente ni por resolución de importaciones (ADR-001 · guarda de importación).
 *
 * El estado ocupado es **real** —`useTransition`—, no una animación: mientras la acción está en
 * curso el botón se deshabilita, de modo que un doble toque no produce un segundo envío. Y es
 * distinguible de uno completado (UX-INV-20): dice que está en vuelo, nunca que ya está guardado
 * (EC-012).
 *
 * **No hay retardo artificial.** Si la operación termina rápido, el estado ocupado termina rápido:
 * §S.5 prohíbe que una señal de sistema persista para que la interfaz parezca tecnológica.
 */

interface Props {
  readonly action: () => Promise<{ readonly error: string | null }>;
  readonly children: ReactNode;
  readonly pendingLabel: string;
  readonly variant?: 'primary' | 'secondary';
  readonly testId?: string;
}

export function PrimaryAction({
  action,
  children,
  pendingLabel,
  variant = 'primary',
  testId,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={variant === 'primary' ? styles.primary : styles['secondary-action']}
        disabled={pending}
        aria-busy={pending}
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
        <p role="alert" data-testid="accion-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
