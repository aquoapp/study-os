/**
 * Utilidades de análisis sintáctico para las guardas.
 *
 * ---------------------------------------------------------------------------
 * Por qué AST y no expresiones regulares
 *
 * Las guardas de la primera entrega buscaban texto. Eso las hacía a la vez
 * demasiado estrictas —una mención en un comentario contaba como infracción— y
 * demasiado laxas: bastaba una desestructuración, un alias o una variable
 * intermedia para atravesarlas sin que saltara nada. Una guarda que se esquiva
 * renombrando una variable no es un control, es una molestia.
 *
 * Se usa el compilador de TypeScript, que ya es dependencia del proyecto
 * (`typecheck`), así que esto no añade ninguna dependencia nueva.
 * ---------------------------------------------------------------------------
 */

import ts from 'typescript';

/** Extensiones que las guardas analizan. */
export const SOURCE_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

export function parseSource(relPath, source) {
  return ts.createSourceFile(
    relPath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    relPath.endsWith('.tsx') || relPath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Recorre todo el árbol. */
export function walkAst(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => walkAst(child, visitor));
}

/** Línea 1-indexada de un nodo. */
export function lineOfNode(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * ¿El fichero lleva la directiva `'use client'`?
 *
 * Debe ser una directiva real —una expresión de cadena al principio del módulo—,
 * no la cadena `'use client'` mencionada en cualquier sitio.
 */
export function hasUseClientDirective(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteralLike(statement.expression) &&
      statement.expression.text === 'use client'
    ) {
      return true;
    }
    // Solo el prólogo de directivas cuenta. En cuanto aparece otra cosa, se acabó.
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteralLike(statement.expression)) {
      return false;
    }
  }
  return false;
}

/** ¿El fichero importa `server-only`? Actúa como frontera: nunca es cliente. */
export function importsServerOnly(sourceFile) {
  return moduleSpecifiers(sourceFile).some((entry) => entry.module === 'server-only');
}

/**
 * ¿El fichero declara `'use server'`?
 *
 * Un módulo de Server Actions es una **frontera de red**, no una dependencia de
 * código: cuando un componente de cliente lo importa, el empaquetador sustituye la
 * importación por una referencia remota y el cuerpo del módulo nunca llega al
 * navegador. Seguir el grafo a través de él produciría falsos positivos justo en
 * el patrón que Next.js recomienda.
 */
export function hasUseServerDirective(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteralLike(statement.expression) &&
      statement.expression.text === 'use server'
    ) {
      return true;
    }
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteralLike(statement.expression)) {
      return false;
    }
  }
  return false;
}

/**
 * Todos los especificadores de módulo: `import`, `import()` dinámico,
 * `export … from` y `require()`.
 */
export function moduleSpecifiers(sourceFile) {
  const found = [];

  walkAst(sourceFile, (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      found.push({ module: node.moduleSpecifier.text, node: node.moduleSpecifier, kind: 'static' });
      return;
    }

    if (ts.isCallExpression(node)) {
      // import('...')
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) {
          found.push({ module: arg.text, node: arg, kind: 'dynamic' });
        }
        return;
      }
      // require('...')
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) {
          found.push({ module: arg.text, node: arg, kind: 'require' });
        }
      }
    }
  });

  return found;
}

/**
 * Descompone una cadena de llamadas en su raíz y la lista de métodos aplicados.
 *
 * `supabase.from('x').update(y).eq('id', z)` produce
 * `{ root: supabase, steps: [{name:'from',call}, {name:'update',call}, {name:'eq',call}] }`.
 *
 * Es lo que permite ver que un `.update()` pertenece a un `.from('concept_mastery')`
 * aunque entre medias haya saltos de línea, comentarios o llamadas intermedias.
 */
export function callChain(node) {
  if (!ts.isCallExpression(node)) return null;

  const steps = [];
  let current = node;

  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    steps.unshift({ name: current.expression.name.text, call: current });
    current = current.expression.expression;
  }

  return steps.length > 0 ? { root: current, steps } : null;
}

/** Texto de un argumento si es un literal de cadena; si no, `null`. */
export function stringArg(call, index = 0) {
  const arg = call.arguments[index];
  return arg && ts.isStringLiteralLike(arg) ? arg.text : null;
}

export { ts };
