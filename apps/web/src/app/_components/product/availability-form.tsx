'use client';

import { useState, useTransition } from 'react';

import { setAvailabilityAction, setTimezoneAction } from '../../actions/planner';
import styles from './product.module.css';

/**
 * S12 · el patrón **habitual** y la zona horaria.
 *
 * **El cero es admisible por día** (§E, INV-106): un día de la semana en el que la persona no
 * estudia es un dato, no un hueco. El mínimo de 5 pertenece solo al valor por defecto, que es otra
 * declaración distinta, y las dos no se acoplan.
 *
 * **UX-INV-21 · la zona horaria la elige ella.** No se deduce del navegador, del servidor ni de la
 * IP, y no se escribe por render, prefetch ni abandono: solo una selección explícita la declara.
 * La lista se ofrece desde el catálogo del navegador **como sugerencia visible**, y hasta que la
 * persona confirma no se escribe nada.
 */

const DAYS = [
  ['mon', 'Lunes'],
  ['tue', 'Martes'],
  ['wed', 'Miércoles'],
  ['thu', 'Jueves'],
  ['fri', 'Viernes'],
  ['sat', 'Sábado'],
  ['sun', 'Domingo'],
] as const;

export function AvailabilityForm({
  defaultDailyMinutes,
  weekly,
  timezone,
}: {
  readonly defaultDailyMinutes: number | null;
  readonly weekly: Record<string, number>;
  readonly timezone: string | null;
}) {
  const [base, setBase] = useState(String(defaultDailyMinutes ?? 30));
  const [days, setDays] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      DAYS.map(([key]) => [key, weekly[key] === undefined ? '' : String(weekly[key])]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // **Sin preselección**: la zona no se propone rellenada, aunque el navegador sepa cuál es.
  const [zone, setZone] = useState('');
  const [zoneMessage, setZoneMessage] = useState<string | null>(null);
  const [zonePending, startZone] = useTransition();
  const zones = supportedZones();

  return (
    <>
      <div className={styles.panel} data-testid="ajustes-habitual">
        <label className={styles.secondary}>
          Por defecto, cada día
          <input
            type="number"
            min={5}
            max={600}
            step={1}
            inputMode="numeric"
            className={styles.timeChoice}
            value={base}
            onChange={(event) => setBase(event.target.value)}
            data-testid="ajustes-defecto"
          />
        </label>

        <p className={styles.secondary}>
          Y si algún día concreto es distinto, dilo aquí. Déjalo vacío para usar el valor por
          defecto; escribe <span className={styles.numeric}>0</span> si ese día no estudias.
        </p>

        {DAYS.map(([key, label]) => (
          <label key={key} className={styles.secondary}>
            {label}
            <input
              type="number"
              min={0}
              max={600}
              step={1}
              inputMode="numeric"
              className={styles.timeChoice}
              value={days[key] ?? ''}
              onChange={(event) => setDays({ ...days, [key]: event.target.value })}
              data-testid={`ajustes-${key}`}
            />
          </label>
        ))}

        {error ? (
          <p role="alert" data-testid="ajustes-error">
            {error}
          </p>
        ) : null}
        <div aria-live="polite">
          {message ? <p data-testid="ajustes-guardado">{message}</p> : null}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={pending}
            aria-busy={pending}
            data-testid="ajustes-guardar"
            onClick={() => {
              setError(null);
              setMessage(null);
              const minutes = Number(base);
              const entries: Record<string, number> = {};
              for (const [key] of DAYS) {
                const raw = (days[key] ?? '').trim();
                if (raw === '') continue;
                const value = Number(raw);
                if (!Number.isInteger(value) || value < 0 || value > 600) {
                  setError('Los minutos de cada día van de 0 a 600.');
                  return;
                }
                entries[key] = value;
              }
              if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) {
                setError('El valor por defecto va de 5 a 600 minutos.');
                return;
              }
              startTransition(async () => {
                const result = await setAvailabilityAction({
                  defaultDailyMinutes: minutes,
                  weekly: entries,
                });
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                setMessage('Guardado.');
              });
            }}
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className={styles.panel} data-testid="ajustes-zona-control">
        <label className={styles.secondary}>
          Elige tu zona horaria
          <select
            className={styles.timeChoice}
            value={zone}
            onChange={(event) => setZone(event.target.value)}
            data-testid="ajustes-zona-select"
          >
            {/* Sin preselección: la opción vacía es la que está elegida al llegar. */}
            <option value="">Sin elegir</option>
            {zones.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
        <div aria-live="polite">
          {zoneMessage ? <p data-testid="ajustes-zona-guardada">{zoneMessage}</p> : null}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            // UX-INV-21 · deshabilitada hasta que haya una selección explícita.
            disabled={zone === '' || zone === timezone || zonePending}
            aria-busy={zonePending}
            data-testid="ajustes-zona-guardar"
            onClick={() => {
              setZoneMessage(null);
              startZone(async () => {
                const result = await setTimezoneAction(zone);
                setZoneMessage(result?.error ?? 'Guardada.');
              });
            }}
          >
            {zonePending ? 'Guardando…' : 'Confirmar la zona'}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * El catálogo de zonas del navegador, si lo expone.
 *
 * Es una **sugerencia visible**, no una deducción: la persona sigue teniendo que elegir. Cuando el
 * navegador no lo expone, la lista queda vacía y no se inventa ninguna.
 */
function supportedZones(): readonly string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    return supported ?? [];
  } catch {
    return [];
  }
}
