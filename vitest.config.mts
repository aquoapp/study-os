import { defineConfig } from 'vitest/config';

/**
 * Tres proyectos, tres comandos de CI distintos (Execution Plan §4):
 *
 *   unit        · no toca red ni base de datos
 *   integration · exige base de datos alcanzable
 *   rls         · exige base de datos y credenciales de dos usuarios distintos
 *
 * Separarlos permite que un fallo diga *qué* está roto sin tener que leer el log.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@study-os/design-system': new URL('./packages/design-system/src/index.ts', import.meta.url)
        .pathname,
      '@study-os/domain/internal/identity': new URL(
        './packages/domain/src/identity.ts',
        import.meta.url,
      ).pathname,
      '@study-os/domain': new URL('./packages/domain/src/index.ts', import.meta.url).pathname,
      '@study-os/config/destructive': new URL(
        './packages/config/src/destructive.ts',
        import.meta.url,
      ).pathname,
      '@study-os/config/server-env-keys': new URL(
        './packages/config/src/server-env-keys.ts',
        import.meta.url,
      ).pathname,
      '@study-os/config/server': new URL('./packages/config/src/server.ts', import.meta.url)
        .pathname,
      '@study-os/config/client': new URL('./packages/config/src/client.ts', import.meta.url)
        .pathname,
      '@study-os/config': new URL('./packages/config/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
          /**
           * Sin paralelismo entre ficheros.
           *
           * Los tests del gate P0-G5 escriben una violación deliberada en el árbol
           * y ejecutan la guarda sobre él. Si dos ficheros hicieran eso a la vez,
           * cada uno vería los fixtures del otro y el resultado dependería del
           * orden. Un test de invariante que a veces pasa no sirve de nada.
           */
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.spec.ts'],
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'rls',
          include: ['tests/rls/**/*.spec.ts'],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
