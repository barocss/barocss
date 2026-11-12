import { signedArea, settledOutlineMovablePoints } from './profile';
import { constraintsOf, type Polygon } from './rules';
import type { SketchRule } from './terms';

export interface OutlineMobility { points: readonly number[]; edges: readonly number[] }

const validIndex = (index: number, count: number) => Number.isInteger(index) && index >= 0 && index < count;

function supportedRule(rule: SketchRule, count: number): boolean {
  const valid = (index: number) => validIndex(index, count);
  switch (rule.kind) {
    case 'fix': return valid(rule.point) && Array.isArray(rule.at) && rule.at.length === 2 && rule.at.every(Number.isFinite);
    case 'parallel': case 'perpendicular': case 'equal':
    case 'distance': case 'dx': case 'dy': case 'angle':
      return valid(rule.a) && valid(rule.b) && rule.a !== rule.b;
    case 'symmetric': return valid(rule.a) && valid(rule.b) && rule.a !== rule.b && valid(rule.line);
    default: return false;
  }
}

/** Local numerical mobility of the current settled material outline only. */
export function outlineMobility(shape: Polygon): OutlineMobility | null {
  if (shape.kind !== 'polygon' || !shape.closed || shape.pending || shape.construction || shape.points.length < 3 || shape.points.length > 16
    || shape.bulges?.some(value => value !== 0) || shape.fromSpline || shape.spline || shape.fromEllipse || shape.ellipse
    || shape.circles?.length || shape.circleIds?.length || shape.tangents?.length || shape.equalRadii?.length || shape.concentric?.length
    || Object.keys(shape.radii ?? {}).length || shape.rules?.some(rule => !supportedRule(rule, shape.points.length))) return null;

  const { points, hv } = shape;
  if (hv && [...hv.h, ...hv.v].some(index => !validIndex(index, points.length))) return null;

  const [x, y] = points[0];
  const relative = points.map(([u, v]) => [u - x, v - y]);
  const scale = Math.max(...relative.map(point => Math.hypot(...point)));
  if (!(Math.abs(signedArea(relative)) > 32 * Number.EPSILON * scale * scale)) return null;

  const moving = settledOutlineMovablePoints(points, constraintsOf(shape), shape.bulges);
  if (!moving) return null;
  const movable = new Set(moving);
  const edges = points.flatMap((_, i) => movable.has(i) || movable.has((i + 1) % points.length) ? [i] : []);
  return { points: moving, edges };
}
