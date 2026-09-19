import { PlannerInputError } from './plan';
import { WEEKDAY_KEYS, type Budget, type WeekdayKey } from './types';

/**
 * Presupuesto del día (§I.2, H-P4-4). Precedencia:
 *
 *   1. override válido del mismo día, si existe;
 *   2. entrada explícita del día de la semana en `weekly_availability_json`, **incluido `0`**;
 *   3. `default_daily_minutes`.
 *
 * El cero es dato, no ausencia; una clave ausente sí es ausencia. El override nunca modifica el
 * valor por defecto (INV-106): esta función no escribe nada.
 *
 * En Phase 4A **no existe almacenamiento del override** (su captura es de 4B y `TODAY_OVERRIDE_SET`
 * no tiene contrato de campos): el servidor pasa siempre `todayOverride: null`. La rama existe
 * para que la precedencia esté probada cuando 4B le dé una fuente.
 */
export interface BudgetDeclarations {
  readonly planDay: string;
  readonly defaultDailyMinutes: number;
  readonly weeklyAvailability: Readonly<Record<string, number>>;
  readonly todayOverride: number | null;
}

/** Día ISO de la semana de una fecha de calendario, sin zona horaria: la fecha ya es local. */
export function weekdayOf(planDay: string): WeekdayKey {
  const [y, m, d] = planDay.split('-').map(Number);
  if (!y || !m || !d) throw new PlannerInputError(`planDay mal formado: ${planDay}`);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new PlannerInputError(`planDay inexistente: ${planDay}`);
  }
  // getUTCDay: 0 = domingo. ISO: lunes primero.
  return WEEKDAY_KEYS[(date.getUTCDay() + 6) % 7]!;
}

function valid(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 600;
}

export function resolveBudget(declarations: BudgetDeclarations): Budget {
  const { todayOverride, weeklyAvailability, defaultDailyMinutes, planDay } = declarations;
  if (todayOverride !== null) {
    if (!valid(todayOverride)) throw new PlannerInputError(`override inválido: ${todayOverride}`);
    return { minutes: todayOverride, source: 'TODAY_OVERRIDE' };
  }
  const key = weekdayOf(planDay);
  if (Object.prototype.hasOwnProperty.call(weeklyAvailability, key)) {
    const minutes = weeklyAvailability[key]!;
    if (!valid(minutes)) throw new PlannerInputError(`disponibilidad inválida para ${key}`);
    return { minutes, source: 'WEEKLY_ENTRY' };
  }
  if (!valid(defaultDailyMinutes)) {
    throw new PlannerInputError(`default_daily_minutes inválido: ${defaultDailyMinutes}`);
  }
  return { minutes: defaultDailyMinutes, source: 'DEFAULT_DAILY' };
}
