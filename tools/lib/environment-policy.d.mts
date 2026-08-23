/**
 * Tipos del gemelo en Node de `@study-os/config/destructive`.
 *
 * El módulo es `.mjs` porque lo consumen herramientas de línea de comandos que no
 * pasan por TypeScript. Esta declaración existe para que el test que compara ambas
 * implementaciones pueda importarlo sin `any` implícito.
 */

export declare const AUTHORIZATION_ENV_VAR: string;

export declare function authorizationTokenFor(environment: string, operation: string): string;

export declare class DestructiveOperationDenied extends Error {}

export declare function assertDestructiveOperationAllowed(
  operation: string,
  environment: string,
  authorization: string | undefined,
): void;

export declare function isLoopbackUrl(url: string): boolean;

export declare const policies: {
  environments: Record<
    string,
    {
      allowsDestructiveReset: boolean;
      requiresExplicitAuthorization: boolean;
      holdsRealUserData: boolean;
      requiresSecureTransport: boolean;
      allowsAutomatedTests: boolean;
    }
  >;
  authorizationEnvVar: string;
};
