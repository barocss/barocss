import { buildProfileLoop } from '@barocss/cad';
import type { P2 } from './profile';
import type { Polygon } from './rules';

// The existing XY solver's linear residual and minimum segment limits. The seed must also
// keep both the source and target triangle well away from their collinear boundaries.
const LINEAR = 1e-7;
const MIN_LENGTH = 0.001;
const MAX_COORDINATE = 10000;

export type FixedTriangleSeed = [P2, P2, P2];

const distance = (a: P2, b: P2) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const inRange = (p: P2) => p.length === 2 && p.every(value => Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE);

function admitsLoop(points: readonly P2[]): boolean {
  try { return !buildProfileLoop(points.map(start => ({ kind: 'line', start }))).reversed; }
  catch { return false; }
}

/** Move C on the existing CCW branch of a settled A–B–C triangle. A and B remain fixed. */
export function fixedTriangleLengthSeed(s: Polygon, length: number): FixedTriangleSeed | null {
  const { points, lengths, rules, hv } = s;
  const fix = rules?.[0];
  if (!s.closed || s.pending || s.construction || points.length !== 3 ||
    s.fromEllipse || s.ellipse || s.fromSpline || s.spline || s.fromRectangle ||
    (s.bulges && (s.bulges.length !== 3 || s.bulges.some(bulge => bulge !== 0))) ||
    s.circles?.length || Object.keys(s.radii ?? {}).length ||
    s.tangents?.length || s.equalRadii?.length || s.concentric?.length ||
    !hv || hv.h.length || hv.v.length || rules?.length !== 1 || fix?.kind !== 'fix' || fix.point !== 1 ||
    !lengths || Object.keys(lengths).length !== 2 || lengths[1] === undefined || lengths[2] === undefined) return null;

  const [a, oldB, oldC] = points, b = fix.at;
  const old = lengths[2], radius = lengths[1], base = distance(a, b);
  if (![a, oldB, oldC, b].every(inRange) || ![old, radius, length, base].every(Number.isFinite) ||
    Math.min(old, radius, length, base) < MIN_LENGTH || length === old) return null;
  if (oldB[0] !== b[0] || oldB[1] !== b[1] ||
    Math.abs(distance(oldB, oldC) - radius) > LINEAR || Math.abs(distance(a, oldC) - old) > LINEAR) return null;

  const ux = (b[0] - a[0]) / base, uy = (b[1] - a[1]) / base;
  const altitude = (point: P2) => ux * (point[1] - a[1]) - uy * (point[0] - a[0]);
  if (altitude(oldC) < MIN_LENGTH || !admitsLoop(points)) return null;

  const sum = length + radius, delta = length - radius;
  if (sum - base <= LINEAR || base - Math.abs(delta) <= LINEAR) return null;
  const x = (base + delta * sum / base) / 2;
  const y = Math.sqrt((sum + base) * (sum - base) * (base + delta) * (base - delta)) / (2 * base);
  const c: P2 = [a[0] + ux * x - uy * y, a[1] + uy * x + ux * y];
  if (!inRange(c) || altitude(c) < MIN_LENGTH ||
    Math.abs(distance(a, c) - length) > LINEAR / 4 || Math.abs(distance(b, c) - radius) > LINEAR / 4) return null;

  const seed: FixedTriangleSeed = [[...a], [...b], c];
  return admitsLoop(seed) ? seed : null;
}
