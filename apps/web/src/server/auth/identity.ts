import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  unsafeBrandVerifiedIdentity,
  type VerifiedIdentity,
} from '@study-os/domain/internal/identity';

import { createSupabaseServerClient } from '../supabase/server-client';

/**
 * INV-116 · única fuente de identidad para superficies protegidas.
 *
 * > «Las decisiones de autenticación y autorización en rutas, Server Actions y Route
 * > Handlers protegidos deben basarse en una identidad verificada en servidor. Con
 * > Supabase SSR se utilizará `auth.getClaims()` para validar el token y proteger
 * > páginas/datos, o `auth.getUser()` cuando sea necesaria una consulta actualizada
 * > al servidor de Auth. `getSession()`, una cookie o una sesión local sin
 * > verificación nunca constituyen autoridad suficiente.»
 *
 * Este módulo es el **único** lugar del repositorio autorizado a construir una
 * `VerifiedIdentity`. La guarda `tools/guards/auth-authority-guard.mjs` falla si
 * `unsafeBrandVerifiedIdentity` aparece en cualquier otro fichero, y falla también
 * si `getSession()` se usa como base de una decisión de acceso.
 *
 * REQ-A07 · EC-009 · Manifest §14
 */

type AuthApi = SupabaseClient['auth'] & {
  getClaims?: (jwt?: string) => Promise<{
    data: { claims: Record<string, unknown> } | null;
    error: { message: string } | null;
  }>;
};

function readStringClaim(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Devuelve la identidad verificada, o `null` si no hay ninguna.
 *
 * Prefiere `getClaims()` —valida la firma del token localmente cuando hay clave
 * asimétrica y evita un viaje de red por petición— y recurre a `getUser()`, que
 * consulta el servidor de Auth. Ambos caminos son verificación en servidor; el
 * fallback existe porque `getClaims()` no está en todas las versiones del SDK, no
 * porque haya una alternativa más débil aceptable.
 */
export async function getVerifiedIdentity(): Promise<VerifiedIdentity | null> {
  const supabase = await createSupabaseServerClient();
  const auth = supabase.auth as AuthApi;

  if (typeof auth.getClaims === 'function') {
    const { data, error } = await auth.getClaims();
    if (error) return null;

    const claims = data?.claims;
    if (claims) {
      const userId = readStringClaim(claims, 'sub');
      if (userId) {
        return unsafeBrandVerifiedIdentity({
          userId,
          email: readStringClaim(claims, 'email'),
          method: 'getClaims',
        });
      }
    }
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return unsafeBrandVerifiedIdentity({
    userId: data.user.id,
    email: data.user.email ?? null,
    method: 'getUser',
  });
}

/**
 * Error de autorización. Se lanza cuando una superficie protegida no puede
 * establecer una identidad verificada.
 */
export class UnauthenticatedError extends Error {
  constructor(surface: string) {
    super(`INV-116: acceso denegado a "${surface}" sin identidad verificada en servidor.`);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Igual que `getVerifiedIdentity`, pero falla en lugar de devolver `null`.
 *
 * Es la forma preferible en Server Actions y Route Handlers: convierte «olvidé
 * comprobar el resultado» en un error, no en un acceso concedido.
 */
export async function requireVerifiedIdentity(surface: string): Promise<VerifiedIdentity> {
  const identity = await getVerifiedIdentity();
  if (!identity) throw new UnauthenticatedError(surface);
  return identity;
}
