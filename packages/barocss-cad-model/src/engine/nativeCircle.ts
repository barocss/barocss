import { CadNumericPolicy, type Curve } from '@barocss/cad';
import { add, cross, dot, len, scale, sub, unit, type Vec3 } from './vec3';

export interface NativeCircle {
  centre: Vec3;
  normal: Vec3;
  radius: number;
}

const linear = (radius: number) => Math.max(CadNumericPolicy.linearTolerance, CadNumericPolicy.relativeLinearTolerance * radius);

export function sameNativeCircle(a: NativeCircle, b: NativeCircle): boolean {
  const tolerance = linear(Math.max(a.radius, b.radius));
  return len(sub(a.centre, b.centre)) <= tolerance && Math.abs(a.radius - b.radius) <= tolerance
    && len(cross(a.normal, b.normal)) <= 1e-9;
}

/** Read native rational quadratic Bézier spans that have one common circular support. */
export function nativeCircleOf(curve: Curve): NativeCircle | undefined {
  const { controlPoints: points, weights, knots } = curve, count = (points.length - 1) / 2;
  if (curve.degree !== 2 || !Number.isInteger(count) || count < 1 || weights.length !== points.length || knots.length !== 2 * count + 4) return;
  const first = knots[2], last = knots[knots.length - 3], weight = weights[0];
  if (knots[0] !== first || knots[1] !== first || knots.at(-2) !== last || knots.at(-1) !== last
    || !(weight > 0) || !Number.isFinite(weight)) return;
  let support: NativeCircle | undefined, previous = first;
  for (let i = 0; i < count; i++) {
    const k = 2 * i, start = knots[k + 2], end = knots[k + 3], w = weights[k + 1] / weight;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start !== previous || !(end > start)
      || weights[k] !== weight || weights[k + 2] !== weight || !(w > 0 && w < 1)) return;
    previous = end;
    const a = points[k], chord = sub(points[k + 2], a), length = len(chord), halfChord = scale(chord, 0.5);
    const pole = sub(sub(points[k + 1], a), halfChord), axis = unit(chord);
    const skew = dot(pole, axis), bisector = sub(pole, scale(axis, skew)), height = len(bisector);
    const sine = Math.sqrt((1 - w) * (1 + w)), radius = length / (2 * sine), tolerance = linear(radius);
    if (!Number.isFinite(radius) || !(radius > tolerance) || !(height > tolerance)) return;
    // A circular span's tangent intersection lies on the chord bisector at this exact height.
    // A shallow span needs a bound relative to its height before that direction is used at radius scale.
    const expectedHeight = radius * sine * sine / w;
    const poleTolerance = Math.min(tolerance, expectedHeight * CadNumericPolicy.relativeComparison);
    if (!(Math.abs(skew) <= poleTolerance) || !(Math.abs(height - expectedHeight) <= poleTolerance)) return;
    const direction = unit(bisector);
    const centre = add(a, sub(halfChord, scale(direction, radius * w)));
    const normal = unit(cross(direction, chord));
    if (!centre.every(Number.isFinite) || !(Math.abs(len(normal) - 1) <= 1e-9)) return;
    const circle = { centre, normal, radius };
    if (support && !sameNativeCircle(support, circle)) return;
    support ??= circle;
  }
  return support;
}
