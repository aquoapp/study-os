/**
 * `@study-os/planner-engine` · Planner v1 · `docs/PLANNER_CONTRACT.md` v1.4 · ADR-012.
 *
 * Paquete puro de servidor: determinista, sin red, sin reloj, sin azar y sin dependencias fuera
 * del monorepo. Nunca viaja al cliente (ADR-001 · guarda de importación).
 */
import { canonicalDecision } from './canonical';
import { plan } from './plan';
import type { PlannerInput } from './types';

export { resolveBudget, weekdayOf, type BudgetDeclarations } from './budget';
export { canonicalDecision, canonicalInput, inputHash, sha256OfText } from './canonical';
export {
  PlannerInputError,
  assertPlannerInput,
  byContinuity,
  byLastNegative,
  bySyllabus,
  compareCodePoints,
  eligibleActionMinutes,
  isExclusionReason,
  plan,
} from './plan';
export * from './types';

/**
 * Reproducción desde la instantánea (§B.4, P4-G4): el texto canónico de entrada guardado en la
 * auditoría, y nada más, vuelve a dar la decisión canónica. No consulta estado posterior.
 */
export function replayFromSnapshot(inputCanonical: string): string {
  return canonicalDecision(plan(JSON.parse(inputCanonical) as PlannerInput));
}
