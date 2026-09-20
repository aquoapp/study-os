'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import styles from './product.module.css';

/**
 * S11 · **El tiempo de hoy** · `docs/PRODUCT_UX_CONTRACT.md` §H, §E.
 *
 * Una hoja que declara el tiempo de **un solo día**. Nunca cambia el valor habitual, y lo dice.
 *
 * UX-INV-22 · **abre sin preselección**. No hay valor por defecto, ni destacado, ni sugerencia, ni
 * gesto cuyo significado sea que la persona debería tener más tiempo. El cero es un valor como los
 * demás, con el mismo peso visual: es una declaración legítima, no una deuda.
 *
 * UX-INV-14 · operable solo con teclado, devuelve el foco a su disparador y **Esc cierra**.
 *
 * §S.6 · al guardar, la actividad del sistema se hace perceptible mientras el plan se recompone de
 * verdad, y se resuelve al llegar la decisión nueva. **No hay retardo artificial**: si el cálculo
 * termina antes, la señal termina antes.
 */

/** C-17 · los seis valores del control. El cero va primero porque es una opción, no un castigo. */
const CHOICES = [0, 5, 10, 20, 30] as const;

export function TodayTimeControl({
  currentMinutes,
  onSave,
  label = 'Cambiar el tiempo de hoy',
  testId = 'tiempo-hoy',
}: {
  readonly currentMinutes: number;
  readonly onSave: (minutes: number) => Promise<{ readonly error: string | null }>;
  readonly label?: string;
  readonly testId?: string;
}) {
  const [open, setOpen] = useState(false);
  // **Sin preselección** (UX-INV-22): `null` hasta que la persona elige.
  const [chosen, setChosen] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>('button, input')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setChosen(null);
    setCustom('');
    setError(null);
    // El foco vuelve a su disparador: una superposición no puede perderlo (UX-INV-14).
    trigger.current?.focus();
  }

  const selected = chosen ?? (custom.trim() === '' ? null : Number(custom));
  const valid = selected !== null && Number.isInteger(selected) && selected >= 0 && selected <= 600;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles['secondary-action']}
        onClick={() => setOpen(true)}
        data-testid={`${testId}-abrir`}
      >
        {label}
      </button>

      {open ? (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="El tiempo de hoy"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className={styles.sheet} ref={sheet} data-testid={`${testId}-hoja`}>
            <h2 className={styles.actionTitle}>El tiempo de hoy</h2>
            <p className={styles.secondary} data-testid={`${testId}-alcance`}>
              Solo para hoy. Tu disponibilidad habitual no cambia.
            </p>

            <div className={styles.timeChoices} role="group" aria-label="Minutos para hoy">
              {CHOICES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={styles.timeChoice}
                  aria-pressed={chosen === value}
                  onClick={() => {
                    setChosen(value);
                    setCustom('');
                  }}
                  data-testid={`${testId}-opcion-${value}`}
                >
                  {value} min
                </button>
              ))}
            </div>

            <label className={styles.secondary}>
              Personalizar, en minutos
              <input
                type="number"
                min={0}
                max={600}
                step={1}
                inputMode="numeric"
                value={custom}
                className={styles.timeChoice}
                onChange={(event) => {
                  setCustom(event.target.value);
                  setChosen(null);
                }}
                data-testid={`${testId}-personalizar`}
              />
            </label>

            {error ? (
              <p role="alert" data-testid={`${testId}-error`}>
                {error}
              </p>
            ) : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                disabled={!valid || pending}
                onClick={() => {
                  if (selected === null) return;
                  setError(null);
                  startTransition(async () => {
                    const result = await onSave(selected);
                    if (result?.error) {
                      setError(result.error);
                      return;
                    }
                    close();
                  });
                }}
                data-testid={`${testId}-guardar`}
              >
                {pending ? 'Ajustando la sesión…' : 'Guardar'}
              </button>
              <a className={styles['secondary-action']} href="/ajustes">
                Mi disponibilidad habitual
              </a>
              <button
                type="button"
                className={styles['secondary-action']}
                onClick={close}
                data-testid={`${testId}-cancelar`}
              >
                Cancelar
              </button>
            </div>

            <p className={styles.secondary}>
              El tiempo actual de hoy es <span className={styles.numeric}>{currentMinutes}</span>{' '}
              min.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
