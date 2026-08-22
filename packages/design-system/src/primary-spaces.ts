/**
 * Espacios primarios de la arquitectura de información.
 *
 * EC-015 · «IA primaria exactamente: HOY · APRENDER · ENTRENAR · PROGRESO · PLAN»
 * REQ-A09 · «Constante única de espacios primarios (5)»
 * Manifest §5 · «Five primary spaces only» · «Notes is transversal, not a sixth primary space»
 *
 * Esta es la **única** declaración de la lista en todo el repositorio. Cualquier otra
 * enumeración de espacios primarios es una duplicación y un vector de deriva.
 *
 * `tests/unit/primarySpaces.frozen.spec.ts` compara esta constante contra una copia
 * literal congelada. Añadir, quitar o reordenar un espacio rompe el test **a propósito**:
 * es un cambio constitucional y exige ADR aceptado más aprobación humana (EC-019).
 */

export const PRIMARY_SPACES = ['HOY', 'APRENDER', 'ENTRENAR', 'PROGRESO', 'PLAN'] as const;

export type PrimarySpace = (typeof PRIMARY_SPACES)[number];

export const PRIMARY_SPACE_COUNT = 5 as const;

export function isPrimarySpace(value: unknown): value is PrimarySpace {
  return typeof value === 'string' && (PRIMARY_SPACES as readonly string[]).includes(value);
}

/**
 * Capacidades transversales. **No** son espacios primarios y no pueden presentarse
 * como un sexto elemento de la navegación primaria (EC-016, Manifest §5).
 */
export const TRANSVERSAL_CAPABILITIES = ['NOTAS', 'TUTOR'] as const;

export type TransversalCapability = (typeof TRANSVERSAL_CAPABILITIES)[number];
