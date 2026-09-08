/**
 * Identidad verificada en servidor.
 *
 * INV-116 (SD-016) · «Las decisiones de autenticación y autorización en rutas,
 * Server Actions y Route Handlers protegidos deben basarse en una identidad
 * verificada en servidor. Con Supabase SSR se utilizará `auth.getClaims()` para
 * validar el token y proteger páginas/datos, o `auth.getUser()` cuando sea necesaria
 * una consulta actualizada al servidor de Auth. `getSession()`, una cookie o una
 * sesión local sin verificación nunca constituyen autoridad suficiente.»
 *
 * REQ-A07 · EC-009 · Manifest §14 («never trust user-supplied user_id without auth context»)
 *
 * ---------------------------------------------------------------------------
 * Por qué un tipo y no una convención
 *
 * `VerifiedIdentity` lleva una marca privada que solo puede colocar el verificador
 * de servidor. Un `{ userId }` construido a mano —o leído de una cookie, o recibido
 * en el cuerpo de una petición— **no es asignable** a este tipo. La frontera deja de
 * depender de que alguien recuerde comprobarla.
 * ---------------------------------------------------------------------------
 */

/**
 * Marca privada de la identidad verificada.
 *
 * Es un símbolo **real**, no una declaración ambiente. La primera versión decía
 * `declare const serverVerified: unique symbol`, que para TypeScript existe y para
 * el runtime no: el tipo compilaba, las pruebas unitarias nunca construían una
 * identidad de verdad, y la primera alta real contra un servidor de Auth terminó
 * en `ReferenceError: serverVerified is not defined` al renderizar `/cuenta`
 * (CI run 34229491576, `test:e2e:auth`). El símbolo no se exporta: sigue siendo
 * imposible fabricar la marca desde fuera de este módulo.
 */
const serverVerified: unique symbol = Symbol('study-os.identity.serverVerified');

/** Métodos aceptados de verificación. Ambos validan contra el servidor de Auth. */
export const VERIFIED_IDENTITY_METHODS = ['getClaims', 'getUser'] as const;

export type VerifiedIdentityMethod = (typeof VERIFIED_IDENTITY_METHODS)[number];

export function isVerifiedIdentityMethod(value: unknown): value is VerifiedIdentityMethod {
  return (
    typeof value === 'string' && (VERIFIED_IDENTITY_METHODS as readonly string[]).includes(value)
  );
}

/**
 * Identidad cuya procedencia es una verificación en servidor.
 *
 * Solo `verifiedIdentityFromServer` puede construirla, y ese constructor vive en
 * `apps/web/src/server/auth/identity.ts`, es decir, del lado servidor.
 */
export interface VerifiedIdentity {
  readonly [serverVerified]: true;
  /** `sub` del token validado. */
  readonly userId: string;
  /** Correo del token validado, cuando el proveedor lo emite. */
  readonly email: string | null;
  /** Cómo se verificó. Queda en el objeto para poder auditarlo. */
  readonly method: VerifiedIdentityMethod;
}

/**
 * Constructor restringido.
 *
 * No se exporta desde el índice del paquete a propósito: se importa por ruta
 * profunda y únicamente desde el módulo de servidor de auth. La guarda
 * `tools/guards/auth-authority-guard.mjs` falla si aparece en cualquier otro sitio.
 *
 * @internal
 */
export function unsafeBrandVerifiedIdentity(fields: {
  userId: string;
  email: string | null;
  method: VerifiedIdentityMethod;
}): VerifiedIdentity {
  if (!fields.userId || fields.userId.trim() === '') {
    throw new Error('INV-116: no puede construirse una identidad verificada sin userId.');
  }
  if (!isVerifiedIdentityMethod(fields.method)) {
    throw new Error(
      `INV-116: método de verificación no aceptado: ${String(fields.method)}. ` +
        `Permitidos: ${VERIFIED_IDENTITY_METHODS.join(', ')}.`,
    );
  }
  return {
    [serverVerified]: true,
    userId: fields.userId,
    email: fields.email,
    method: fields.method,
  } as VerifiedIdentity;
}
