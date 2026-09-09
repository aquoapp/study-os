import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy de sesión y protección de rutas (convención `proxy` de Next.js 16;
 * antes `middleware`).
 *
 * Dos responsabilidades, y solo dos:
 *
 * 1. **Refrescar el token.** Los Server Components no pueden escribir cookies; el
 *    proxy sí. Sin este paso la sesión caduca en mitad de la navegación.
 * 2. **Proteger rutas.** La decisión se toma sobre una identidad **verificada en
 *    servidor** (INV-116): `getClaims()` valida el token; `getUser()` consulta al
 *    servidor de Auth. `getSession()` no se usa aquí y no debe usarse: devuelve lo
 *    que hay en la cookie sin comprobar su firma, de modo que una cookie manipulada
 *    produciría una identidad falsa.
 *
 * El proxy es una **primera** barrera, no la única. Cada superficie protegida
 * vuelve a verificar con `requireVerifiedIdentity`, y RLS protege los datos con
 * independencia de ambas (EC-009).
 */

/** Prefijos que exigen identidad verificada. */
const PROTECTED_PREFIXES = [
  '/cuenta',
  '/onboarding',
  '/hoy',
  '/aprender',
  '/comprobar',
  '/fin',
] as const;

/** Rutas de autenticación: un usuario ya identificado no debe quedarse en ellas. */
const AUTH_ROUTES = ['/entrar', '/registro'] as const;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Sin configuración de Supabase no puede verificarse ninguna identidad. Cerrar,
    // no abrir: una ruta protegida sin verificador posible es una ruta denegada.
    if (isProtected(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/entrar';
      url.searchParams.set('motivo', 'sin-configuracion');
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Verificación en servidor. Nunca `getSession()`.
  const auth = supabase.auth as typeof supabase.auth & {
    getClaims?: () => Promise<{ data: { claims: Record<string, unknown> } | null; error: unknown }>;
  };

  let userId: string | null = null;

  if (typeof auth.getClaims === 'function') {
    const { data, error } = await auth.getClaims();
    const sub = data?.claims?.['sub'];
    userId = !error && typeof sub === 'string' && sub !== '' ? sub : null;
  } else {
    const { data, error } = await supabase.auth.getUser();
    userId = !error && data.user ? data.user.id : null;
  }

  const { pathname } = request.nextUrl;

  if (!userId && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.searchParams.set('siguiente', pathname);
    return NextResponse.redirect(url);
  }

  if (userId && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/cuenta';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /**
   * Se excluyen estáticos, imágenes y los artefactos de PWA. El service worker y el
   * manifest deben servirse sin pasar por la lógica de sesión.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)'],
};
