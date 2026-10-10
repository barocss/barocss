import type { Body } from '../../packages/barocss-physics/src/types.js';
import { detect } from '../../packages/barocss-physics/src/collision.js';
import { selectBoxSATFeature } from '../physics-rigid-feature-geometry/sat-feature.js';
export { parseBody } from '../../packages/barocss-physics/src/validation.js';
export { PhysicsError } from '../../packages/barocss-physics/src/types.js';
/** Read-only accepted-pose observation. No world or correction function. */
export function inspectPair(a: Body, b: Body) {
  return { hit: detect(a, b), selection: selectBoxSATFeature(a, b) };
}
