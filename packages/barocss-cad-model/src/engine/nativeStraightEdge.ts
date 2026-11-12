import { CadNumericPolicy, type Curve } from '@barocss/cad';
import type { Vec3 } from './vec3';

const axes = [0, 1, 2] as const;
const inRange = (point: Vec3) => point.length === 3 && axes.every(axis =>
  Number.isFinite(point[axis]) && Math.abs(point[axis]) <= CadNumericPolicy.coordinateAbs);

/** Check that a native line's full curve and ordered B-rep endpoints describe the same segment. */
export function nativeStraightEdgeMatches(curve: Curve, a: Vec3, b: Vec3): boolean {
  const { controlPoints, degree, knots, weights } = curve;
  if (degree !== 1 || controlPoints.length !== 2 || knots.length !== 4 || weights.length !== 2
    || !inRange(a) || !inRange(b) || axes.every(axis => a[axis] === b[axis])) return false;

  const [start, startRepeat, endRepeat, end] = knots;
  if (!(end > start) || !Number.isFinite(end - start) || start !== startRepeat || end !== endRepeat
    || !(weights[0] > 0) || !Number.isFinite(weights[0]) || weights[0] !== weights[1]) return false;

  const [first, last] = controlPoints;
  return first.length === 3 && last.length === 3
    && axes.every(axis => first[axis] === a[axis] && last[axis] === b[axis]);
}
