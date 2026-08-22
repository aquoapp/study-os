#!/usr/bin/env node
/**
 * GUARDA 4 · Identidad verificada en servidor (INV-116 · SD-016).
 *
 * > «Las decisiones de autenticación y autorización en rutas, Server Actions y Route
 * > Handlers protegidos deben basarse en una identidad verificada en servidor. Con
 * > Supabase SSR se utilizará `auth.getClaims()` para validar el token y proteger
 * > páginas/datos, o `auth.getUser()` cuando sea necesaria una consulta actualizada
 * > al servidor de Auth. `getSession()`, una cookie o una sesión local sin
 * > verificación nunca constituyen autoridad suficiente.»
 *
 * REQ-A07 · EC-009 · Manifest §14
 *
 * Comprueba tres cosas:
 *
 *   1. **`getSession()` no decide acceso.** Devuelve el contenido de la cookie sin
 *      validar su firma. Si una ruta protegida decide con ese valor, la autorización
 *      se evalúa sobre un dato que el atacante controla.
 *   2. **La marca de identidad verificada tiene un único origen.**
 *      `unsafeBrandVerifiedIdentity` solo puede invocarse desde el módulo de servidor
 *      de auth. Si pudiera llamarse desde cualquier sitio, el tipo dejaría de
 *      probar nada.
 *   3. **Ninguna consulta filtra por un `user_id` recibido del cliente**
 *      (Manifest §14 · «never trust user-supplied user_id without auth context»).
 */

import { join } from 'node:path';

import { REPO_ROOT, lineOf, read, report, stripComments, walk } from './lib/walk.mjs';

/** Único fichero autorizado a construir una identidad verificada. */
const IDENTITY_FACTORY_OWNER = 'apps/web/src/server/auth/identity.ts';

/** El propio tipo, donde se define la función. */
const IDENTITY_TYPE_MODULE = 'packages/domain/src/identity.ts';

/** Ficheros donde `getSession` puede nombrarse sin decidir acceso (guardas y tests). */
const GETSESSION_MENTION_ALLOWED = ['tools/guards/', 'tests/'];

const files = [
  ...walk(join(REPO_ROOT, 'apps'), (p) => /\.(ts|tsx|js|jsx|mjs)$/.test(p)),
  ...walk(join(REPO_ROOT, 'packages'), (p) => /\.(ts|tsx|js|jsx|mjs)$/.test(p)),
];

const findings = [];

for (const file of files) {
  const source = read(file);
  const code = stripComments(source);

  // 1 · getSession()
  if (!GETSESSION_MENTION_ALLOWED.some((prefix) => file.startsWith(prefix))) {
    const pattern = /\.getSession\s*\(/g;
    let match;
    while ((match = pattern.exec(code)) !== null) {
      findings.push({
        file,
        line: lineOf(code, match.index),
        message:
          'Uso de getSession(). No valida la firma del token: no puede ser la base de una ' +
          'decisión de acceso. Usa getClaims() o getUser() (INV-116).',
      });
    }
  }

  // 2 · origen único de la marca de identidad
  if (file !== IDENTITY_FACTORY_OWNER && file !== IDENTITY_TYPE_MODULE) {
    const pattern = /unsafeBrandVerifiedIdentity/g;
    let match;
    while ((match = pattern.exec(code)) !== null) {
      findings.push({
        file,
        line: lineOf(code, match.index),
        message:
          `Solo "${IDENTITY_FACTORY_OWNER}" puede construir una identidad verificada. ` +
          'Fuera de ahí, la marca deja de demostrar que hubo verificación.',
      });
    }
  }

  // 3 · user_id suministrado por el cliente
  const suppliedIdPattern =
    /\.eq\(\s*['"`]user_id['"`]\s*,\s*(?:body|payload|params|searchParams|req|request|formData|input)\b/g;
  let match;
  while ((match = suppliedIdPattern.exec(code)) !== null) {
    findings.push({
      file,
      line: lineOf(code, match.index),
      message:
        'Consulta filtrada por un user_id procedente de la petición. La identidad viene de la ' +
        'verificación en servidor, nunca del cliente (Manifest §14).',
    });
  }
}

report(
  'auth-authority-guard',
  findings,
  'INV-116 (SD-016) · REQ-A07. La identidad se obtiene con\n' +
    '`getVerifiedIdentity()` / `requireVerifiedIdentity()` en\n' +
    `"${IDENTITY_FACTORY_OWNER}". RLS protege los datos; esta guarda protege la capa de\n` +
    'aplicación, que es la que queda expuesta cuando la lógica no atraviesa RLS.',
);
