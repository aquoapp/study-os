'use server';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '../../server/supabase/server-client';

/**
 * Server Actions de autenticación.
 *
 * Ninguna de estas acciones decide *acceso*: crean o destruyen sesión. Las
 * decisiones de acceso viven en `requireVerifiedIdentity` (INV-116).
 *
 * REQ-A07 · esqueleto de auth con `profiles` 1:1
 *
 * ---------------------------------------------------------------------------
 * Destino de la entrada · Product UX Contract §O
 *
 * «ENTRADA └─ HOY · único destino», y `/cuenta` es «superficie de identidad, fuera del
 * vertical». Estas dos acciones mandaban a `/cuenta` porque en Phase 0 era el único destino
 * autenticado que existía; nunca se revisaron al aparecer `/hoy`. El resultado era un
 * callejón: `/cuenta` no enlaza a ninguna parte, `/onboarding` solo se alcanza desde HOY, y
 * una cuenta nueva no tenía camino navegable hasta el producto.
 *
 * HOY resuelve por sí mismo el caso de onboarding incompleto: su acción primaria lleva a
 * `/onboarding`. Por eso el destino correcto es HOY y no `/onboarding`: la entrada no decide
 * en qué estado está la persona, lo decide HOY.
 * ---------------------------------------------------------------------------
 */

export interface AuthActionState {
  readonly error: string | null;
}

function readCredentials(formData: FormData): { email: string; password: string } | null {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  if (email.trim() === '' || password === '') return null;
  return { email: email.trim(), password };
}

export async function signUpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (!credentials) return { error: 'Introduce un correo y una contraseña.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp(credentials);

  // El mensaje del proveedor se devuelve tal cual: en Phase 0 no hay capa de copy
  // y ocultar la causa real dificultaría el diagnóstico sin aportar seguridad.
  if (error) return { error: error.message };

  redirect('/hoy');
}

export async function signInAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (!credentials) return { error: 'Introduce un correo y una contraseña.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) return { error: error.message };

  redirect('/hoy');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
