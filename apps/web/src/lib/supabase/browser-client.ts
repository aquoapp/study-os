'use client';

import { createBrowserClient } from '@supabase/ssr';

import { readPublicConfig } from '@study-os/config/client';

/**
 * Cliente Supabase del navegador.
 *
 * Solo clave anónima (EC-010). Sirve para iniciar sesión, cerrarla y leer datos que
 * RLS ya protege. **Nunca** para decidir si una pantalla o un dato están permitidos:
 * esa decisión es de servidor (INV-116) y ninguna comprobación hecha aquí cuenta
 * como autorización.
 *
 * REQ-A08 / INV-113 · desde el cliente no se persiste ninguna proyección autoritativa.
 */
export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = readPublicConfig();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
