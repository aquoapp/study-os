/**
 * Nombres de las variables de entorno exclusivamente de servidor.
 *
 * EC-010 · REQ-A05.
 *
 * ---------------------------------------------------------------------------
 * Por qué esta lista vive en su propio módulo
 *
 * Estaba en `environments.ts`, que el cliente importa a través del barril
 * `@study-os/config`. Aunque solo contiene **nombres** y no valores —y el
 * empaquetador la eliminaba por *tree-shaking*—, dejaba el inventario de claves de
 * servidor dentro del grafo de módulos del navegador. Eso convierte una garantía
 * («no llega») en una consecuencia de la optimización («no llegó esta vez»), que es
 * justo la diferencia que EC-010 no admite.
 *
 * Al separarla, `client-authority-guard` puede afirmar algo comprobable: este módulo
 * no es alcanzable desde ninguna raíz de cliente. Lo detectó la propia guarda tras
 * ampliarla a `packages/**` con alcance transitivo.
 * ---------------------------------------------------------------------------
 */

export const SERVER_ONLY_ENV_KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL'] as const;

export type ServerOnlyEnvKey = (typeof SERVER_ONLY_ENV_KEYS)[number];
