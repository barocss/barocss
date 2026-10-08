import type { Body, Vec3 } from './types.js';
import { rotate } from './math.js';
import { error } from './validation.js';

export interface Bounds { min: Vec3; max: Vec3 }

export function bodyBounds(body: Body): Bounds {
  const shape = body.shape;
  let half: Vec3;
  if (shape.kind === 'sphere') {
    half = [shape.radiusM, shape.radiusM, shape.radiusM];
  } else if (shape.kind === 'capsule') {
    const axis = rotate(body.orientation, [0, 1, 0]);
    half = axis.map((value) => shape.radiusM + shape.halfLengthM * Math.abs(value)) as Vec3;
  } else {
    const axes = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[])
      .map((axis) => rotate(body.orientation, axis));
    half = [0, 1, 2].map((axis) => axes.reduce((extent, basis, localAxis) =>
      extent + Math.abs(basis[axis]) * shape.halfExtentsM[localAxis], 0)) as Vec3;
  }
  const min = body.positionM.map((value, axis) => value - half[axis]) as Vec3;
  const max = body.positionM.map((value, axis) => value + half[axis]) as Vec3;
  if ([...min, ...max].some((value) => !Number.isFinite(value))) error('NUMERIC_LIMIT', 'nonfinite broad-phase bounds');
  return { min, max };
}

export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  for (let axis = 0; axis < 3; axis++) {
    if (a.max[axis] + 1e-9 < b.min[axis] || b.max[axis] + 1e-9 < a.min[axis]) return false;
  }
  return true;
}
