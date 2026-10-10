import { PhysicsError } from '../../packages/barocss-physics/src/capsule-query-error.js';
import { admitSnapshot, admitMovement, copySnapshot } from './admission.js';
import { sweepFace } from './face-sweep.js';
import { ERRORS } from './profile.js';
import type { Snapshot, Movement } from './profile.js';
export { advanceHeadOnFaceStep } from './response.js';
export { PROFILE, ERRORS } from './profile.js';
export { PhysicsError };
export { createUprightCapsuleQuery } from '../../packages/barocss-physics/src/capsule-query.js';
export { parseBody } from '../../packages/barocss-physics/src/validation.js';
export { detect } from '../../packages/barocss-physics/src/collision.js';
export function createRigidCapsuleFaceReference(input: Snapshot) {
  const snapshot = admitSnapshot(input); let disposed = false;
  const live = () => { if (disposed) throw new PhysicsError('DISPOSED', ERRORS.disposed); };
  return { sweep(input: Movement) { live(); return sweepFace(snapshot, admitMovement(input, snapshot)); }, getSnapshot() { live(); return copySnapshot(snapshot); }, dispose() { disposed = true; } };
}
