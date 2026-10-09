import type { Body, Joint, PhysicsJointState, Quat, Vec3 } from './types.js';
import { error } from './validation.js';
import { add, inertia, inverse, inverseInertia,
  multiplyQuaternion, scale, sub } from './math.js';
import { applyPairAngle, projectDynamicPairAnchors, solvePairMatrix } from './dynamic-anchor-pair.js';

function orientationError(actual: Quat, desired: Quat): Vec3 {
  const relative = multiplyQuaternion(actual, inverse(desired));
  const sign = relative[3] < 0 ? -1 : 1;
  const vector = scale([relative[0], relative[1], relative[2]], sign);
  const sine = Math.hypot(...vector);
  if (sine < 1e-12) return scale(vector, 2);
  return scale(vector, 2 * Math.atan2(sine, sign * relative[3]) / sine);
}

/** Symmetric, bounded projection for the one admitted two-sphere fixed pair. */
export function projectDynamicFixedJoint(joint: Joint, bodies: Body[], dt: number): PhysicsJointState {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const beforeLinear = [...b.velocityMps] as Vec3;
  const beforeAngular = [...b.angularVelocityRadps] as Vec3;
  const desired = multiplyQuaternion(a.orientation, joint.referenceOrientation);
  const angularError = orientationError(b.orientation, desired);
  if (Math.hypot(...angularError) > 1) {
    error('NUMERIC_LIMIT', 'dynamic fixed joint relative orientation exceeds limit');
  }
  const basis: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const angularColumns = basis.map((axis) => add(inverseInertia(a, axis), inverseInertia(b, axis)));
  const angularImpulse = solvePairMatrix(angularColumns, scale(angularError, -1));
  applyPairAngle(a, scale(inverseInertia(a, angularImpulse), -1), dt);
  applyPairAngle(b, inverseInertia(b, angularImpulse), dt);
  projectDynamicPairAnchors(a, b, joint.anchorALocalM, joint.anchorBLocalM, dt);

  return { id: joint.id, kind: joint.kind, aId: a.id, bId: b.id,
    linearImpulseNs: scale(sub(b.velocityMps, beforeLinear), 1 / b.inverseMass),
    angularImpulseNms: inertia(b, sub(b.angularVelocityRadps, beforeAngular)) };
}
