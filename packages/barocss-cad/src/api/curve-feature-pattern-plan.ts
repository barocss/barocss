// Shared read-only path authority for Kernel and Model CUT consumers.
import { planCurveCutPath } from '../features/curve-cut-pattern.js';
import { refuse } from './refusal.js';
import type { RawNurbsPath } from '../features/curve-cut-pattern.js';
import type { CurveCutPathPlan } from '../features/quadratic-cut-plan.js';

export type CurveFeaturePatternPathPlan = CurveCutPathPlan;
const failPlan: Parameters<typeof planCurveCutPath>[4] = (_code, message) => { throw refuse('VALUE', message); };
/** Plan fixed-orientation relative CUT offsets. Curved placements are certified within the existing linear policy.
 * Legacy offsets and endpoint admission preserve their Number contract; length bounds also enclose the true polyline length.
 * The finite estimate is diagnostic and must not be used to admit curved endpoint placements.
 */
export function planCurveFeaturePatternPath(raw: RawNurbsPath, spacing: number, count: number): CurveFeaturePatternPathPlan {
  return planCurveCutPath(raw, spacing, count, 10000, failPlan);
}
