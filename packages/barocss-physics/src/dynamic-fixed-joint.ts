import type { Body, Joint, PhysicsJointState, Quat, Vec3 } from './types.js';
import { MAX_STEP_DISPLACEMENT_M } from './limits.js';
import { error } from './validation.js';
import { add, advanceOrientation, cross, inertia, inverse, inverseInertia,
  multiplyQuaternion, rotate, scale, sub, worldPoint } from './math.js';

function solve3(columns: Vec3[], target: Vec3): Vec3 {
  const rows = [0, 1, 2].map((row) => [columns[0][row], columns[1][row],
    columns[2][row], target[row]]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (!Number.isFinite(rows[pivot][column]) || Math.abs(rows[pivot][column]) < 1e-12) {
      error('NUMERIC_LIMIT', 'dynamic fixed joint effective mass is singular');
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index < 4; index++) rows[column][index] /= divisor;
    for (let row = 0; row < 3; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index < 4; index++) rows[row][index] -= factor * rows[column][index];
    }
  }
  const result = rows.map((row) => row[3]) as Vec3;
  if (result.some((value) => !Number.isFinite(value))) {
    error('NUMERIC_LIMIT', 'dynamic fixed joint correction is not finite');
  }
  return result;
}

function orientationError(actual: Quat, desired: Quat): Vec3 {
  const relative = multiplyQuaternion(actual, inverse(desired));
  const sign = relative[3] < 0 ? -1 : 1;
  const vector = scale([relative[0], relative[1], relative[2]], sign);
  const sine = Math.hypot(...vector);
  if (sine < 1e-12) return scale(vector, 2);
  return scale(vector, 2 * Math.atan2(sine, sign * relative[3]) / sine);
}

function applyAngular(body: Body, angle: Vec3, dt: number): void {
  if (Math.hypot(...angle) > 1) error('NUMERIC_LIMIT', 'dynamic fixed joint angular correction exceeds limit');
  body.orientation = advanceOrientation(body.orientation, angle, 1);
  body.angularVelocityRadps = add(body.angularVelocityRadps, scale(angle, 1 / dt));
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
  const angularImpulse = solve3(angularColumns, scale(angularError, -1));
  applyAngular(a, scale(inverseInertia(a, angularImpulse), -1), dt);
  applyAngular(b, inverseInertia(b, angularImpulse), dt);

  const armA = rotate(a.orientation, joint.anchorALocalM);
  const armB = rotate(b.orientation, joint.anchorBLocalM);
  const separation = sub(worldPoint(b, joint.anchorBLocalM), worldPoint(a, joint.anchorALocalM));
  if (Math.hypot(...separation) > MAX_STEP_DISPLACEMENT_M) {
    error('NUMERIC_LIMIT', 'dynamic fixed joint anchor separation exceeds limit');
  }
  const linearColumns = basis.map((axis) => add(
    scale(axis, a.inverseMass + b.inverseMass),
    add(cross(inverseInertia(a, cross(armA, axis)), armA),
      cross(inverseInertia(b, cross(armB, axis)), armB))));
  const correction = solve3(linearColumns, scale(separation, -1));
  const moveA = scale(correction, -a.inverseMass);
  const moveB = scale(correction, b.inverseMass);
  a.positionM = add(a.positionM, moveA);
  b.positionM = add(b.positionM, moveB);
  a.velocityMps = add(a.velocityMps, scale(moveA, 1 / dt));
  b.velocityMps = add(b.velocityMps, scale(moveB, 1 / dt));
  applyAngular(a, scale(inverseInertia(a, cross(armA, correction)), -1), dt);
  applyAngular(b, inverseInertia(b, cross(armB, correction)), dt);

  return { id: joint.id, kind: joint.kind, aId: a.id, bId: b.id,
    linearImpulseNs: scale(sub(b.velocityMps, beforeLinear), 1 / b.inverseMass),
    angularImpulseNms: inertia(b, sub(b.angularVelocityRadps, beforeAngular)) };
}
