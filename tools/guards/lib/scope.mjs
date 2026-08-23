/**
 * Resolución de identificadores por **ámbito léxico**.
 *
 * ---------------------------------------------------------------------------
 * Por qué hacía falta
 *
 * Las guardas anteriores razonaban sobre la **forma** de la expresión: si veían
 * `caches.delete(k)` aplicaban la excepción de navegador; si veían `q.update(p)`
 * denunciaban la escritura. Eso deja fuera todo lo que separa el nombre de su
 * significado:
 *
 *     function f(caches) { return caches.update(p); }   // parámetro sombreando el global
 *     const { getVerifiedIdentity } = falso;             // import canónico sombreado
 *     let w; w = query.update;                           // asignación posterior
 *
 * La respuesta anterior fue «si el fichero declara ese nombre en cualquier parte,
 * se retira la excepción». Funciona, pero es tosca: un fichero con una variable
 * local `document` en una función perdía la exención en todas las demás.
 *
 * Aquí se construye una cadena de ámbitos de verdad y se resuelve cada
 * identificador a **la declaración que lo introduce**, o a nada si es global. Con
 * eso, las guardas dejan de razonar sobre nombres y pasan a razonar sobre símbolos.
 *
 * ---------------------------------------------------------------------------
 * Qué NO es
 *
 * No es el resolvedor de TypeScript. No sigue tipos, no resuelve `export *`, no
 * entiende `declare global`. Es deliberadamente pequeño y **conservador**: cuando
 * no sabe resolver algo, devuelve `null` y quien pregunta decide, y en las guardas
 * `null` significa «no se puede demostrar que sea seguro».
 *
 * Simplificación conocida: `var` se trata como si tuviera ámbito de bloque. Eso
 * puede resolver un `var` a un ámbito más interno del que le corresponde, lo que
 * produce **más** sombreado detectado, no menos. Es la dirección segura.
 * ---------------------------------------------------------------------------
 */

import { ts } from './ast.mjs';

/** Clases de declaración que este módulo reconoce. */
export const DECL_KINDS = {
  IMPORT_NAMED: 'import-named',
  IMPORT_DEFAULT: 'import-default',
  IMPORT_NAMESPACE: 'import-namespace',
  VARIABLE: 'variable',
  PARAMETER: 'parameter',
  FUNCTION: 'function',
  CLASS: 'class',
  CATCH: 'catch',
  BINDING: 'binding',
};

function isScopeNode(node) {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isClassExpression(node) ||
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isCatchClause(node) ||
    ts.isCaseBlock(node)
  );
}

/** Ámbito al que pertenece una declaración: el nodo de ámbito que la contiene. */
function enclosingScope(node) {
  let current = node.parent;
  while (current) {
    if (isScopeNode(current)) return current;
    current = current.parent;
  }
  return null;
}

/**
 * @typedef {{
 *   name: string,
 *   kind: string,
 *   declaration: import('typescript').Node,
 *   scope: import('typescript').Node,
 *   importedFrom?: string,
 *   exportedName?: string,
 * }} Binding
 */

/**
 * Construye la tabla de ámbitos del fichero.
 *
 * @returns {{
 *   resolve: (identifier: import('typescript').Node) => Binding | null,
 *   bindings: Binding[],
 * }}
 */
export function buildScopeTable(sourceFile) {
  /** @type {Map<import('typescript').Node, Map<string, Binding>>} */
  const scopes = new Map();
  /** @type {Binding[]} */
  const bindings = [];

  const declare = (nameNode, kind, declaration, extra = {}) => {
    if (!nameNode || !ts.isIdentifier(nameNode)) return;
    const scope = enclosingScope(declaration) ?? sourceFile;
    if (!scopes.has(scope)) scopes.set(scope, new Map());
    const binding = { name: nameNode.text, kind, declaration, scope, ...extra };
    // La primera declaración gana. Redeclarar el mismo nombre en el mismo ámbito
    // es un error de programa, no un caso que esta tabla deba arbitrar.
    if (!scopes.get(scope).has(binding.name)) scopes.get(scope).set(binding.name, binding);
    bindings.push(binding);
  };

  /** Nombres introducidos por un patrón de enlace, con su declaración de origen. */
  const declarePattern = (nameNode, kind, declaration) => {
    if (!nameNode) return;
    if (ts.isIdentifier(nameNode)) {
      declare(nameNode, kind, declaration);
      return;
    }
    if (ts.isObjectBindingPattern(nameNode) || ts.isArrayBindingPattern(nameNode)) {
      for (const element of nameNode.elements) {
        if (ts.isBindingElement(element)) declarePattern(element.name, DECL_KINDS.BINDING, element);
      }
    }
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const moduleSpecifier = ts.isStringLiteralLike(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : null;

      if (node.importClause.name) {
        declare(node.importClause.name, DECL_KINDS.IMPORT_DEFAULT, node.importClause, {
          importedFrom: moduleSpecifier,
          exportedName: 'default',
        });
      }
      const named = node.importClause.namedBindings;
      if (named && ts.isNamespaceImport(named)) {
        declare(named.name, DECL_KINDS.IMPORT_NAMESPACE, named, {
          importedFrom: moduleSpecifier,
        });
      }
      if (named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          declare(element.name, DECL_KINDS.IMPORT_NAMED, element, {
            importedFrom: moduleSpecifier,
            exportedName: (element.propertyName ?? element.name).text,
          });
        }
      }
    } else if (ts.isVariableDeclaration(node)) {
      declarePattern(node.name, DECL_KINDS.VARIABLE, node);
    } else if (ts.isParameter(node)) {
      declarePattern(node.name, DECL_KINDS.PARAMETER, node);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      declare(node.name, DECL_KINDS.FUNCTION, node);
    } else if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) {
      declare(node.name, DECL_KINDS.CLASS, node);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      declarePattern(node.variableDeclaration.name, DECL_KINDS.CATCH, node.variableDeclaration);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  /**
   * Resuelve un identificador subiendo por la cadena de ámbitos.
   *
   * Devuelve `null` cuando ningún ámbito lo declara: entonces el nombre es global
   * —del navegador, de Node o de una declaración de tipos ambiental—.
   */
  const resolve = (identifier) => {
    if (!identifier || !ts.isIdentifier(identifier)) return null;
    let current = identifier.parent;
    while (current) {
      if (isScopeNode(current)) {
        const found = scopes.get(current)?.get(identifier.text);
        if (found) return found;
      }
      current = current.parent;
    }
    return null;
  };

  return { resolve, bindings };
}

/**
 * ¿Este identificador es el símbolo **global** con ese nombre?
 *
 * Global significa aquí «ningún ámbito del fichero lo declara». Es lo más que se
 * puede afirmar sin un resolvedor de tipos, y basta para lo que las guardas
 * necesitan: distinguir el `caches` del navegador de uno que alguien introdujo.
 */
export function isGlobalIdentifier(resolve, identifier) {
  return ts.isIdentifier(identifier) && resolve(identifier) === null;
}
