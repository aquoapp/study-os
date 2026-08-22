import { redirect } from 'next/navigation';

import { signOutAction } from '../actions/auth';
import { getVerifiedIdentity } from '../../server/auth/identity';
import { createSupabaseServerClient } from '../../server/supabase/server-client';

export const metadata = { title: 'Mi cuenta · Study OS' };

/**
 * Superficie protegida de referencia.
 *
 * Verifica **otra vez** la identidad aunque el proxy ya lo haya hecho: el proxy
 * es una barrera de enrutado, no una autorización de datos, y una ruta
 * que se fía de él queda expuesta en cuanto alguien la invoca por otro camino
 * (INV-116).
 *
 * El perfil se lee con el token del usuario, de modo que RLS es quien decide qué
 * fila puede verse (EC-009 · REQ-C13). No se filtra por un `user_id` recibido del
 * cliente (Manifest §14).
 */
export default async function AccountPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/entrar?siguiente=/cuenta');

  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, display_name, locale, created_at')
    .single();

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1>Mi cuenta</h1>

      <dl data-testid="identity-block">
        <dt>Identidad verificada en servidor</dt>
        <dd data-testid="verification-method">{identity.method}</dd>

        <dt>Usuario</dt>
        <dd data-testid="user-id">{identity.userId}</dd>

        <dt>Correo</dt>
        <dd data-testid="user-email">{identity.email ?? '—'}</dd>
      </dl>

      <h2>Perfil</h2>
      {error ? (
        <p role="alert" data-testid="profile-error">
          <span aria-hidden="true">⚠ </span>
          No se pudo leer el perfil: {error.message}
        </p>
      ) : (
        <dl data-testid="profile-block">
          <dt>Identificador de perfil</dt>
          <dd data-testid="profile-id">{profile?.id ?? '—'}</dd>

          <dt>Nombre visible</dt>
          <dd data-testid="profile-display-name">{profile?.display_name ?? '—'}</dd>

          <dt>Idioma</dt>
          <dd data-testid="profile-locale">{profile?.locale ?? '—'}</dd>
        </dl>
      )}

      <form action={signOutAction}>
        <button
          type="submit"
          data-testid="signout-button"
          style={{
            minHeight: 'var(--so-touch-target-min)',
            borderRadius: 'var(--so-radius-md)',
            border: '1px solid var(--so-color-border-strong)',
            background: 'var(--so-color-surface-raised)',
            color: 'var(--so-color-text-primary)',
            padding: '0 16px',
            cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
