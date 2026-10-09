import type { Body, Joint, PhysicsJointState, Vec3 } from './types.js';
import type { AdmittedCommands } from './validation.js';
import { error } from './validation.js';
import { add, advanceOrientation, dot, inertia, inverse, inverseInertia,
  multiplyQuaternion, scale, sub } from './math.js';

const magnitude = (vector: Vec3): number => Math.hypot(...vector);

export function admitDynamicHingeScene(joint: Joint, bodies: Body[], gravity: Vec3): void {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const identity = [0, 0, 0, 1];
  if (magnitude(gravity) !== 0 || magnitude(sub(a.positionM, b.positionM)) > 1e-9 ||
    magnitude(joint.anchorALocalM) !== 0 || magnitude(joint.anchorBLocalM) !== 0 ||
    [a, b].some((body) => magnitude(body.velocityMps) !== 0 ||
      magnitude(body.angularVelocityRadps) !== 0 ||
      body.orientation.some((value, index) => Math.abs(value - identity[index]) > 1e-12))) {
    error('INVALID_CONFIG', 'dynamic hinge needs coincident resting spheres and zero gravity');
  }
}

export function admitDynamicHingeCommands(joint: Joint, bodies: Body[],
  actions: Map<string, AdmittedCommands>): void {
  const axis = joint.axisWorld!;
  for (const bodyIndex of [joint.aIndex, joint.bIndex]) {
    const action = actions.get(bodies[bodyIndex].id);
    if (!action) continue;
    if (action.forceN || action.impulseNs || [action.torqueNm, action.angularImpulseNms]
      .filter((vector): vector is Vec3 => vector !== undefined)
      .some((vector) => magnitude(sub(vector, scale(axis, dot(vector, axis)))) > 1e-12)) {
      error('INVALID_COMMAND', 'dynamic hinge admits axis-aligned angular commands only');
    }
  }
}

export function projectDynamicHingeJoint(joint: Joint, bodies: Body[], dt: number): PhysicsJointState {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const axis = joint.axisWorld!;
  const beforeAngular = [...b.angularVelocityRadps] as Vec3;
  if (magnitude(sub(a.positionM, b.positionM)) > 1e-9) {
    error('NUMERIC_LIMIT', 'dynamic hinge centres separated');
  }
  const relative = multiplyQuaternion(b.orientation, inverse(a.orientation));
  const signed = dot([relative[0], relative[1], relative[2]], axis);
  if (magnitude(sub([relative[0], relative[1], relative[2]], scale(axis, signed))) > 1e-8) {
    error('NUMERIC_LIMIT', 'dynamic hinge left its planar axis');
  }
  const raw = 2 * Math.atan2(signed, relative[3]);
  const wrapped = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
  const angleRad = Math.max(joint.limitRad![0], Math.min(joint.limitRad![1], wrapped));
  const inverseA = dot(axis, inverseInertia(a, axis));
  const inverseB = dot(axis, inverseInertia(b, axis));
  const inverseSum = inverseA + inverseB;
  const excess = wrapped - angleRad;
  if (excess !== 0) {
    const angleA = excess * inverseA / inverseSum;
    const angleB = -excess * inverseB / inverseSum;
    a.orientation = advanceOrientation(a.orientation, scale(axis, angleA), 1);
    b.orientation = advanceOrientation(b.orientation, scale(axis, angleB), 1);
    a.angularVelocityRadps = add(a.angularVelocityRadps, scale(axis, angleA / dt));
    b.angularVelocityRadps = add(b.angularVelocityRadps, scale(axis, angleB / dt));
  }
  const relativeSpeed = dot(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  if ((angleRad === joint.limitRad![0] && relativeSpeed < 0) ||
    (angleRad === joint.limitRad![1] && relativeSpeed > 0)) {
    const impulse = -relativeSpeed / inverseSum;
    a.angularVelocityRadps = sub(a.angularVelocityRadps,
      inverseInertia(a, scale(axis, impulse)));
    b.angularVelocityRadps = add(b.angularVelocityRadps,
      inverseInertia(b, scale(axis, impulse)));
  }
  return { id: joint.id, kind: joint.kind, aId: a.id, bId: b.id,
    linearImpulseNs: [0, 0, 0],
    angularImpulseNms: inertia(b, sub(b.angularVelocityRadps, beforeAngular)), angleRad };
}
