'use server';

import { revalidatePath } from 'next/cache';

import { requireVerifiedIdentity } from '../../server/auth/identity';
import { createSupabaseServerClient } from '../../server/supabase/server-client';

/**
 * Onboarding mínimo · REQ-C01 · Master §6 y §7 · gate P2-G7.
 *
 * El Manifest pide para Phase 2 «profile/settings/goal; onboarding; availability». Esto es
 * exactamente eso y nada más: no es la superficie de producto de Phase 5 ni el vertical del
 * First Product Sight, que no están autorizados.
 *
 * La identidad la decide el servidor (INV-116, Manifest §14): el `user_id` sale de
 * `requireVerifiedIdentity`, nunca del formulario. La escritura va con el token del propio
 * aprendiz, de modo que la política RLS —`user_id = auth.uid()` en `USING` y en
 * `WITH CHECK`— es quien autoriza la fila, no este código.
 */

export interface OnboardingActionState {
  readonly error: string | null;
  readonly ok: boolean;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function readMinutes(formData: FormData, field: string): number | null {
  const raw = formData.get(field);
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 600) return null;
  return value;
}

export async function completeOnboardingAction(
  _previous: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const identity = await requireVerifiedIdentity('/onboarding');
  const supabase = await createSupabaseServerClient();

  const dailyMinutes = readMinutes(formData, 'default_daily_minutes');
  if (dailyMinutes === null || dailyMinutes < 5) {
    return { error: 'Indica cuántos minutos al día puedes dedicar (entre 5 y 600).', ok: false };
  }

  const availability: Record<string, number> = {};
  for (const day of DAYS) {
    const minutes = readMinutes(formData, `availability_${day}`);
    if (minutes !== null && minutes > 0) availability[day] = minutes;
  }

  const packId = formData.get('exam_pack_id');
  if (typeof packId !== 'string' || packId.trim() === '') {
    return { error: 'Elige el examen que quieres preparar.', ok: false };
  }

  const startingLevel = formData.get('starting_level');
  const targetDate = formData.get('target_date');
  const diagnostic = formData.get('diagnostic_preference');

  const settings = await supabase.from('learner_settings').upsert(
    {
      user_id: identity.userId,
      default_daily_minutes: dailyMinutes,
      weekly_availability_json: availability,
      diagnostic_preference: diagnostic === 'TAKE' || diagnostic === 'SKIP' ? diagnostic : null,
    },
    { onConflict: 'user_id' },
  );
  // El mensaje del proveedor no se propaga tal cual: puede describir restricciones internas.
  if (settings.error) return { error: 'No se pudieron guardar tus preferencias.', ok: false };

  const existing = await supabase
    .from('learner_exam_goals')
    .select('id')
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (existing.error) return { error: 'No se pudo comprobar tu objetivo actual.', ok: false };

  if (!existing.data) {
    const goal = await supabase.from('learner_exam_goals').insert({
      user_id: identity.userId,
      exam_pack_id: packId,
      target_date: typeof targetDate === 'string' && targetDate !== '' ? targetDate : null,
      starting_level:
        typeof startingLevel === 'string' && /^[A-Z_]{2,40}$/.test(startingLevel)
          ? startingLevel
          : null,
    });
    if (goal.error) return { error: 'No se pudo crear tu objetivo de estudio.', ok: false };
  }

  revalidatePath('/onboarding');
  return { error: null, ok: true };
}
