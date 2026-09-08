import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { readPublicConfig } from '@study-os/config/client';

/**
 * Cliente Supabase para superficies de servidor (Server Components, Server Actions,
 * Route Handlers).
 *
 * Usa **exclusivamente** la clave anónima: las peticiones viajan con el token del
 * usuario y RLS sigue siendo el control de acceso a datos (EC-009). No hay aquí
 * ninguna clave de rol de servicio (EC-010, Manifest §14).
 *
 * REQ-A07 · INV-116
 */
export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = readPublicConfig();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies. El refresco de sesión
          // ocurre en el proxy, que sí puede; ignorar aquí es correcto y no
          // enmascara ningún fallo de autorización, porque la autorización no
          // depende de la cookie sino de la verificación en servidor (INV-116).
        }
      },
    },
  });
}
