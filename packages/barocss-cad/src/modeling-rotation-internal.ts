import type { Point } from './types.js';

/** Discrete right-handed rotations around the origin, in authored XYZ millimetres. */
export type CardinalRotationAxis = 'x' | 'y' | 'z';
export type CardinalRotationDegrees = 90 | 180 | 270;
export type CardinalRotationSpec = Readonly<{ axis: CardinalRotationAxis; degrees: CardinalRotationDegrees }>;

/**
 * Signed coordinate permutation: no trig, rounding, tolerance, or Float32.
 * The caller must separately qualify the parent, provenance and target solid.
 */
export function rotateCardinalPoint(point: Point, spec: CardinalRotationSpec): Point {
  const [x, y, z] = point;
  if (![x, y, z].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10000) ||
      (spec.axis !== 'x' && spec.axis !== 'y' && spec.axis !== 'z') ||
      (spec.degrees !== 90 && spec.degrees !== 180 && spec.degrees !== 270))
    throw new RangeError('Finite XYZ and supported cardinal rotation required');
  let rotated: Point;
  switch (spec.axis) {
    case 'x':
      rotated = spec.degrees === 90 ? [x, -z, y] :
        spec.degrees === 180 ? [x, -y, -z] : [x, z, -y];
      break;
    case 'y':
      rotated = spec.degrees === 90 ? [z, y, -x] :
        spec.degrees === 180 ? [-x, y, -z] : [-z, y, x];
      break;
    case 'z':
      rotated = spec.degrees === 90 ? [-y, x, z] :
        spec.degrees === 180 ? [-x, -y, z] : [y, -x, z];
  }
  if (rotated.some(v => Math.abs(v) > 10000))
    throw new RangeError('Cardinal target coordinate exceeds +/-10000mm');
  return rotated;
}
