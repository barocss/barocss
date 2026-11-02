// Shared read-only path authority for Kernel and Model CUT consumers.
import { planCurveCutPath } from '../features/curve-cut-pattern.js';
import { refuse } from './refusal.js';
const failPlan = (_code, message) => { throw refuse('VALUE', message); };
/** Plan fixed-orientation relative CUT offsets. Curved placements are certified within the existing linear policy.
 * Legacy offsets and endpoint admission preserve their Number contract; length bounds also enclose the true polyline length.
 * The finite estimate is diagnostic and must not be used to admit curved endpoint placements.
 */
export function planCurveFeaturePatternPath(raw, spacing, count) {
    return planCurveCutPath(raw, spacing, count, 10000, failPlan);
}
