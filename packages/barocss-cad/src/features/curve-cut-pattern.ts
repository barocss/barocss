// CUT placement on an authored open polyline. Native quadratic line spans are admitted exactly;
// curved spans are refused rather than projected or sampled into a different path.
import { validateCurve } from '../core/math.js';
import { binary64Dyadic } from '../core/dyadic.js';
import type { Curve, Point } from '../types.js';

/** The same raw NURBS fields accepted by the part model's sweep-curve feature. */
export type RawNurbsPath = {
  readonly degree: number;
  readonly knots: readonly number[];
  readonly controlPoints: readonly (readonly [number, number, number])[];
  readonly weights: readonly number[];
};

type Refuse = (code: 'INPUT' | 'CAPABILITY' | 'PARAMETER', message: string) => never;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
function midpoint(a: number, middle: number, b: number): boolean {
  const av = binary64Dyadic(a), mv = binary64Dyadic(middle), bv = binary64Dyadic(b);
  const exponent = Math.max(av.k, mv.k, bv.k);
  const left = av.m << BigInt(exponent - av.k), mid = mv.m << BigInt(exponent - mv.k), right = bv.m << BigInt(exponent - bv.k);
  return left + right === 2n * mid;
}

/** Internal plan only: no body copies, curve refinement, input mutation or Boolean calls. */
export function curveCutOffsets(path: unknown, spacing: number, count: number, lengthLimit: number, fail: Refuse): Point[] {
  if (!record(path)) return fail('INPUT', 'path must be a NURBS curve { degree, knots, controlPoints, weights }');
  if ('objectId' in path) return fail('CAPABILITY', 'a kernel path cut pattern takes raw NURBS data; direct object references require cad-model');
  if (Object.keys(path).some(key => !['degree', 'knots', 'controlPoints', 'weights'].includes(key))) return fail('INPUT', 'path contains an unknown field');
  const curve = { kind: 'curve', id: 'path', ...path } as unknown as Curve;
  try { validateCurve(curve); }
  catch (cause) { return fail('INPUT', `path: ${cause instanceof Error ? cause.message : String(cause)}`); }
  if (curve.degree !== 1 && curve.degree !== 2) return fail('CAPABILITY', 'path cut patterns support only open polylines and exact quadratic straight spans');
  for (const point of curve.controlPoints) for (const value of point) if (Math.abs(value) > lengthLimit) return fail('PARAMETER', 'path coordinates must be within ±10000 mm');
  for (const weight of curve.weights) if (weight !== 1) return fail('CAPABILITY', 'path cut pattern weights must all be 1');
  const points: Point[] = [];
  if (curve.degree === 1) points.push(...curve.controlPoints);
  else {
    const { controlPoints: poles, knots } = curve;
    if (poles.length % 2 !== 1) return fail('CAPABILITY', 'quadratic path must consist of complete C0 straight spans');
    for (let i = 3; i < poles.length; i += 2) if (knots[i] !== knots[i + 1]) return fail('CAPABILITY', 'quadratic path needs double interior knots between straight spans');
    for (let i = 0; i + 2 < poles.length; i += 2) {
      for (let axis = 0; axis < 3; axis++) if (!midpoint(poles[i][axis], poles[i + 1][axis], poles[i + 2][axis])) return fail('CAPABILITY', 'quadratic path middle poles must be exact straight-span midpoints');
      points.push(poles[i]);
    }
    points.push(poles[poles.length - 1]);
  }
  const first = points[0], last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1] && first[2] === last[2]) return fail('CAPABILITY', 'path cut patterns require an open path');
  const lengths: number[] = [], ends: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (!(length > 0)) return fail('INPUT', 'path cut pattern segments must have positive length');
    if (!(total + length > total)) return fail('INPUT', 'path segment length is below the accumulated length resolution');
    lengths.push(length); total += length; ends.push(total);
  }
  if ((count - 1) * spacing > total) return fail('PARAMETER', 'last cut placement exceeds the open path length');
  const offsets: Point[] = [[0, 0, 0]];
  let segment = 0;
  for (let k = 1; k < count; k++) {
    const distance = k * spacing;
    while (distance > ends[segment]) segment++;
    const start = points[segment], end = points[segment + 1];
    const fraction = distance === ends[segment] ? 1 : Math.max(0, Math.min(1, (distance - (segment ? ends[segment - 1] : 0)) / lengths[segment]));
    const offset: Point = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      const value = (fraction === 1 ? end[axis] : start[axis] + fraction * (end[axis] - start[axis])) - first[axis];
      if (!Number.isFinite(value) || Math.abs(value) > lengthLimit) return fail('PARAMETER', 'path cut pattern offsets must be within ±10000 mm');
      offset[axis] = value;
    }
    offsets.push(offset);
  }
  return offsets;
}
