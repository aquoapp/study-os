import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readServerConfig } from '@study-os/config/server';

/**
 * Cliente de rol de servicio para el Planner.
 *
 * Un plan es una decisión que el cliente no puede redactar (Planner Contract §U.4): su
 * persistencia solo es invocable con rol de servicio. Este cliente atraviesa RLS, de modo que su
 * uso está acotado a este directorio y siempre parte de una identidad ya verificada en servidor
 * (INV-116), nunca de un `user_id` que llegue del cliente (Manifest §14).
 *
 * Igual que el del motor, se construye sin lanzar hacia fuera: sin clave de servicio el Planner
 * no corre, y lo dice (OBS-3.1-01 sigue abierto para el Preview; no se añade ninguna clave).
 */
export function tryCreatePlannerClient(): SupabaseClient | null {
  try {
    const config = readServerConfig();
    return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-study-os-actor': 'planner' } },
    });
  } catch {
    return null;
  }
}
