export { createPhysicsWorld as createCandidateWorld } from './reference-world.ts';
export { createPhysicsWorld as createOriginalWorld } from '../../packages/barocss-physics/src/index.js';
export { PhysicsError } from '../../packages/barocss-physics/src/types.js';
export {FrozenContactIsland} from './global-island.ts';
export {compatiblePatch} from './warm-cache.ts';
export {featureContact} from '../physics-rigid-feature-geometry/geometry.ts';
export {adaptContactGeometry} from './geometry-adapter.ts';
