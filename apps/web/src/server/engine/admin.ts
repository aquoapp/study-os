import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readServerConfig } from '@study-os/config/server';

/**
 * Cliente de rol de servicio para el Learning Engine.
 *
 * El motor escribe estado derivado, y **solo el servidor persiste proyecciones** (INV-113).
 * Este cliente atraviesa RLS, de modo que su uso está acotado a este directorio: nunca sirve
 * datos a partir de un `user_id` suministrado por el cliente (Manifest §14), sino a partir de
 * una identidad ya verificada o de un barrido de recuperación de servidor.
 *
 * Se construye **perezosamente y sin lanzar hacia fuera**: si el entorno no tiene configurada
 * la clave de servicio, el motor no puede correr, pero la evidencia ya está aceptada y el
 * trabajo queda recuperable. Esa es exactamente la garantía que el contrato exige: la
 * durabilidad de la evidencia no depende del éxito de la proyección.
 */
export function tryCreateEngineClient(): SupabaseClient | null {
  try {
    const config = readServerConfig();
    return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-study-os-actor': 'learning-engine' } },
    });
  } catch {
    return null;
  }
}
