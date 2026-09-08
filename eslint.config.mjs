import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Configuración de ESLint (flat config).
 *
 * Check de CI `lint` (Execution Plan §4): «ESLint incluida la regla de import de
 * motores».
 *
 * La regla de import de motores se declara aquí **y** en
 * `tools/guards/import-guard.mjs`. No es redundancia inútil: ESLint la señala
 * mientras se escribe el código; la guarda la comprueba en CI sin depender de que
 * el editor tenga ESLint activo, y produce el fallo explícito que exige el gate
 * P0-G5.
 */

/** Paquetes de motor que no deben alcanzar el cliente (ADR-001 v1.1 punto 2). */
const ENGINE_PACKAGES = ['@study-os/learning-engine', '@study-os/planner-engine'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      '_handoff/**',
      'spec/**',
      'architecture/**',
      'docs/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ---------------------------------------------------------------------------
  // Cliente: sin motores, sin secretos de servidor.
  // ADR-001 v1.1 punto 2 · EC-010 · INV-113
  // ---------------------------------------------------------------------------
  {
    files: ['apps/web/src/lib/**/*.{ts,tsx}', 'apps/web/src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...ENGINE_PACKAGES.map((name) => ({
              name,
              message:
                'ADR-001 · las reglas del motor no viajan al cliente. Expón el cálculo como ' +
                'superficie de servidor y consume su resultado.',
            })),
            {
              name: '@study-os/config/server',
              message:
                'EC-010 · `@study-os/config/server` es `server-only`. En cliente usa ' +
                '`@study-os/config/client`.',
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // INV-116 · `getSession()` no autoriza.
  // ---------------------------------------------------------------------------
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='getSession']",
          message:
            'INV-116 · getSession() no valida la firma del token y no puede ser la base de una ' +
            'decisión de acceso. Usa getClaims() o getUser() mediante ' +
            '`apps/web/src/server/auth/identity.ts`.',
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Scripts de Node: guardas y herramientas.
  // ---------------------------------------------------------------------------
  {
    files: ['tools/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        // Node 24: `fetch` y los temporizadores son globales de la plataforma.
        // Los usa `secret-scan` para inspeccionar la salida renderizada.
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Response: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Service worker: entorno propio, sin `window` ni `document`.
  {
    files: ['apps/web/public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
      },
    },
  },

  // Tests: se permite `any` en dobles y fixtures deliberadamente inválidos.
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
);
