import { redirect } from 'next/navigation';

import { getVerifiedIdentity } from '../../server/auth/identity';
import { createSupabaseServerClient } from '../../server/supabase/server-client';
import { AvailabilityForm } from '../_components/product/availability-form';
import {
  ActionTitle,
  PageTitle,
  ProductShell,
  Secondary,
  SystemVoice,
  Wordmark,
} from '../_components/product/shell';

export const metadata = { title: 'Mi disponibilidad · Study OS' };
export const dynamic = 'force-dynamic';

/**
 * S12 · **Mi disponibilidad** · `docs/PRODUCT_UX_CONTRACT.md` §E, §H, §O.
 *
 * El patrón **habitual** por día de la semana, con el cero admitido, más la zona horaria. Es el
 * otro objeto de tiempo, y vive en una superficie estructuralmente distinta de la hoja del tiempo
 * de hoy a propósito: uno es un día, el otro es una costumbre, y colapsarlos haría que cambiar hoy
 * cambiase mañana.
 *
 * **No es el espacio PLAN.** PLAN es Phase 7, y montar aquí un destino con su nombre sería
 * exactamente lo que EC-012 prohíbe. Esta ruta es mínima y hace una sola cosa.
 *
 * Lo que esta pantalla **no** implica: que reescriba nada pasado, que más tiempo sea mejor, ni que
 * declarar disponibilidad sea un compromiso. Es una declaración, y las declaraciones se cambian.
 */
export default async function AjustesPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/entrar?siguiente=/ajustes');

  const supabase = await createSupabaseServerClient();

  const settings = await supabase
    .from('learner_settings')
    .select('default_daily_minutes, weekly_availability_json')
    .maybeSingle();
  const row = settings.data as {
    default_daily_minutes: number;
    weekly_availability_json: Record<string, number>;
  } | null;

  const profile = await supabase.from('profiles').select('timezone').maybeSingle();
  const timezone = (profile.data as { timezone: string | null } | null)?.timezone ?? null;

  return (
    <ProductShell testId="ajustes">
      <Wordmark />
      <SystemVoice>Mi disponibilidad</SystemVoice>
      <PageTitle testId="ajustes-titulo">Cuánto tiempo sueles tener</PageTitle>

      <div style={{ marginLeft: 'var(--so-space-lg)', maxWidth: '62ch' }}>
        <Secondary>
          Es tu patrón habitual. Cambiarlo no toca ningún día ya pasado, y cualquier cantidad vale,
          incluido cero.
        </Secondary>

        <AvailabilityForm
          defaultDailyMinutes={row?.default_daily_minutes ?? null}
          weekly={row?.weekly_availability_json ?? {}}
          timezone={timezone}
        />

        <ActionTitle>Tu zona horaria</ActionTitle>
        {/*
         * UX-INV-21 · ningún valor de zona se escribe por render, prefetch ni abandono. Solo una
         * selección explícita la declara, y hasta entonces no hay nada seleccionado.
         */}
        <Secondary testId="ajustes-zona">
          {timezone
            ? `Tu día empieza y acaba según ${timezone}.`
            : 'Todavía no la has elegido. Sin ella no podemos saber cuándo empieza tu día.'}
        </Secondary>

        {/*
          Vuelta al único destino (§O). Una cuenta nueva llega aquí **obligada**: HOY resuelve la
          zona horaria antes que el objetivo, de modo que S3 manda aquí antes que a ningún otro
          sitio. Sin esta salida, declarar la zona dejaba a la persona sin camino de vuelta más
          que el botón atrás del navegador. `/fin` y la confirmación de replanificar ya tenían la
          suya; esta pantalla se quedó sin ella.
        */}
        <p style={{ marginTop: 'var(--so-space-lg)' }}>
          <a className="so-action" href="/hoy" data-testid="ajustes-volver-a-hoy">
            Volver a Hoy
          </a>
        </p>
      </div>
    </ProductShell>
  );
}
