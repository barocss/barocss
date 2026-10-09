import type { Body, Vec3 } from './types.js';
import { MAX_STEP_DISPLACEMENT_M } from './limits.js';
import { error } from './validation.js';
import { add, advanceOrientation, cross, inverseInertia, rotate, scale, sub, worldPoint } from './math.js';

export function solvePairMatrix(columns: Vec3[], target: Vec3): Vec3 {
  const rows = [0, 1, 2].map((row) => [columns[0][row], columns[1][row],
    columns[2][row], target[row]]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (!Number.isFinite(rows[pivot][column]) || Math.abs(rows[pivot][column]) < 1e-12) {
      error('NUMERIC_LIMIT', 'dynamic pair effective mass is singular');
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
    error('NUMERIC_LIMIT', 'dynamic pair correction is not finite');
  }
  return result;
}

export function applyPairAngle(body: Body, angle: Vec3, dt: number): void {
  if (Math.hypot(...angle) > 1) error('NUMERIC_LIMIT', 'dynamic pair angular correction exceeds limit');
  body.orientation = advanceOrientation(body.orientation, angle, 1);
  body.angularVelocityRadps = add(body.angularVelocityRadps, scale(angle, 1 / dt));
}

/** Move two dynamic anchors together with equal and opposite generalized impulses. */
export function projectDynamicPairAnchors(a: Body, b: Body, anchorA: Vec3,
  anchorB: Vec3, dt: number): void {
  const armA = rotate(a.orientation, anchorA);
  const armB = rotate(b.orientation, anchorB);
  const separation = sub(worldPoint(b, anchorB), worldPoint(a, anchorA));
  if (Math.hypot(...separation) > MAX_STEP_DISPLACEMENT_M) {
    error('NUMERIC_LIMIT', 'dynamic pair anchor separation exceeds limit');
  }
  const basis: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const columns = basis.map((axis) => add(
    scale(axis, a.inverseMass + b.inverseMass),
    add(cross(inverseInertia(a, cross(armA, axis)), armA),
      cross(inverseInertia(b, cross(armB, axis)), armB))));
  const correction = solvePairMatrix(columns, scale(separation, -1));
  const moveA = scale(correction, -a.inverseMass);
  const moveB = scale(correction, b.inverseMass);
  a.positionM = add(a.positionM, moveA);
  b.positionM = add(b.positionM, moveB);
  a.velocityMps = add(a.velocityMps, scale(moveA, 1 / dt));
  b.velocityMps = add(b.velocityMps, scale(moveB, 1 / dt));
  applyPairAngle(a, scale(inverseInertia(a, cross(armA, correction)), -1), dt);
  applyPairAngle(b, inverseInertia(b, cross(armB, correction)), dt);
}
