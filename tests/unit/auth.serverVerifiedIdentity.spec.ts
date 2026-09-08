import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  VERIFIED_IDENTITY_METHODS,
  isVerifiedIdentityMethod,
  unsafeBrandVerifiedIdentity,
} from '@study-os/domain/internal/identity';

import { REPO_ROOT, runGuard, withViolation } from './lib/run-guard';

/**
 * `auth.serverVerifiedIdentity.spec` · enforcement de **INV-116** (SD-016).
 *
 * > «Las decisiones de autenticación y autorización en rutas, Server Actions y Route
 * > Handlers protegidos deben basarse en una identidad verificada en servidor. Con
 * > Supabase SSR se utilizará `auth.getClaims()` para validar el token y proteger
 * > páginas/datos, o `auth.getUser()` cuando sea necesaria una consulta actualizada
 * > al servidor de Auth. `getSession()`, una cookie o una sesión local sin
 * > verificación nunca constituyen autoridad suficiente.»
 *
 * Vinculado a **REQ-A07**. El rechazo de una cookie manipulada se prueba de extremo
 * a extremo en `tests/e2e/auth.forgedCookieRejected.e2e.ts`, porque exige un servidor
 * de Auth real: aquí se prueba lo que puede probarse sin él.
 */

function readRepoFile(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), 'utf8');
}

const IDENTITY_MODULE = readRepoFile('apps/web/src/server/auth/identity.ts');
const PROXY = readRepoFile('apps/web/src/proxy.ts');
const ACCOUNT_PAGE = readRepoFile('apps/web/src/app/cuenta/page.tsx');

/** Elimina comentarios: una mención en prosa no es una decisión de acceso. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('auth.serverVerifiedIdentity · INV-116 · REQ-A07', () => {
  /**
   * El constructor se **ejecuta** aquí, no solo se cita en fixtures. La marca era
   * una declaración ambiente —existía para el tipo y no para el runtime— y ninguna
   * prueba la construía de verdad; la primera alta real contra un servidor de Auth
   * falló con `ReferenceError: serverVerified is not defined` (CI run 34229491576).
   */
  describe('el constructor funciona en tiempo de ejecución', () => {
    it('construye una identidad con su marca privada, real y no enumerable por clave', () => {
      const identity = unsafeBrandVerifiedIdentity({
        userId: '00000000-0000-4000-8000-000000000000',
        email: null,
        method: 'getClaims',
      });

      expect(identity.userId).toBe('00000000-0000-4000-8000-000000000000');
      expect(identity.email).toBeNull();
      expect(identity.method).toBe('getClaims');

      const brands = Object.getOwnPropertySymbols(identity);
      expect(brands).toHaveLength(1);
      expect(brands[0]?.description).toBe('study-os.identity.serverVerified');
      expect((identity as unknown as Record<symbol, unknown>)[brands[0] as symbol]).toBe(true);
      // La marca no viaja por las claves ordinarias: no se serializa ni se copia por accidente.
      expect(Object.keys(identity)).toEqual(['userId', 'email', 'method']);
    });

    it('rechaza un userId vacío y un método no aceptado', () => {
      expect(() =>
        unsafeBrandVerifiedIdentity({ userId: '', email: null, method: 'getUser' }),
      ).toThrow(/INV-116/);
      expect(() =>
        unsafeBrandVerifiedIdentity({
          userId: 'x',
          email: null,
          method: 'getSession' as unknown as 'getUser',
        }),
      ).toThrow(/getSession/);
    });
  });

  describe('métodos aceptados', () => {
    it('son exactamente getClaims y getUser', () => {
      expect([...VERIFIED_IDENTITY_METHODS]).toEqual(['getClaims', 'getUser']);
    });

    it('getSession no es un método de verificación aceptado', () => {
      expect(isVerifiedIdentityMethod('getSession')).toBe(false);
      expect(isVerifiedIdentityMethod('cookie')).toBe(false);
      expect(isVerifiedIdentityMethod('localStorage')).toBe(false);
    });
  });

  describe('el verificador de servidor', () => {
    it('usa getClaims como camino preferente', () => {
      expect(code(IDENTITY_MODULE)).toContain('auth.getClaims');
    });

    it('recurre a getUser, que consulta al servidor de Auth', () => {
      expect(code(IDENTITY_MODULE)).toContain('supabase.auth.getUser()');
    });

    it('no invoca getSession en ningún camino', () => {
      expect(code(IDENTITY_MODULE)).not.toMatch(/\.getSession\s*\(/);
    });

    it('expone una forma que falla en lugar de devolver null silenciosamente', () => {
      expect(IDENTITY_MODULE).toContain('requireVerifiedIdentity');
      expect(IDENTITY_MODULE).toContain('UnauthenticatedError');
    });

    it('está marcado como módulo de servidor', () => {
      expect(IDENTITY_MODULE.startsWith("import 'server-only';")).toBe(true);
    });
  });

  describe('superficies protegidas', () => {
    it('el proxy decide con identidad verificada, no con getSession', () => {
      const proxyCode = code(PROXY);
      expect(proxyCode).not.toMatch(/\.getSession\s*\(/);
      expect(proxyCode).toMatch(/getClaims|getUser/);
    });

    it('el proxy deniega la ruta protegida cuando no hay verificador posible', () => {
      // Sin configuración de Supabase no puede verificarse nada: la ruta protegida
      // debe cerrarse, no abrirse.
      expect(PROXY).toContain("url.searchParams.set('motivo', 'sin-configuracion')");
    });

    it('la página protegida vuelve a verificar y no se fía del proxy', () => {
      expect(code(ACCOUNT_PAGE)).toContain('getVerifiedIdentity()');
      expect(code(ACCOUNT_PAGE)).toContain('redirect(');
    });

    it('la página protegida no filtra por un user_id recibido del cliente', () => {
      expect(code(ACCOUNT_PAGE)).not.toMatch(/\.eq\(\s*['"`]user_id['"`]/);
    });
  });

  describe('guarda de repositorio', () => {
    it('el repositorio actual está limpio', () => {
      const result = runGuard('auth-authority-guard.mjs');
      expect(result.output).toContain('sin hallazgos');
      expect(result.exitCode).toBe(0);
    });

    it('P0-G5 · falla si una ruta autoriza con getSession()', () => {
      const result = withViolation(
        'apps/web/src/app/_violation-getsession/page.tsx',
        [
          "import { createSupabaseServerClient } from '../../server/supabase/server-client';",
          'export default async function Page() {',
          '  const supabase = await createSupabaseServerClient();',
          '  const { data } = await supabase.auth.getSession();',
          '  if (!data.session) return null;',
          '  return null;',
          '}',
        ].join('\n'),
        () => runGuard('auth-authority-guard.mjs'),
      );

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('getSession()');
    });

    it('P0-G5 · falla si la marca de identidad verificada se construye fuera del verificador', () => {
      const result = withViolation(
        'apps/web/src/app/_violation-brand.ts',
        [
          "import { unsafeBrandVerifiedIdentity } from '@study-os/domain/internal/identity';",
          "export const fake = unsafeBrandVerifiedIdentity({ userId: 'cualquiera', email: null, method: 'getUser' });",
        ].join('\n'),
        () => runGuard('auth-authority-guard.mjs'),
      );

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('identidad verificada');
    });

    it('P0-G5 · falla si una consulta filtra por un user_id de la petición', () => {
      const result = withViolation(
        'apps/web/src/app/_violation-userid.ts',
        [
          'export async function leak(supabase: any, body: { user_id: string }) {',
          "  return supabase.from('profiles').select('*').eq('user_id', body.user_id);",
          '}',
        ].join('\n'),
        () => runGuard('auth-authority-guard.mjs'),
      );

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('user_id');
    });
  });
});
