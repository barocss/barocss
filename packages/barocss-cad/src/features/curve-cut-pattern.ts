// CUT placement on authored paths. The legacy straight leaf retains its original Number arithmetic.
import { validateCurve } from '../core/math.js';
import { binary64Dyadic } from '../core/dyadic.js';
import type { Curve, Point } from '../types.js';
import { QuadraticCutWork } from './quadratic-cut-arithmetic.js';
import { cutNormBounds, cutLengthNumbers, planQuadraticCut, type CurveCutPathPlan } from './quadratic-cut-plan.js';

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
function legacyCurveCutOffsets(path: unknown, spacing: number, count: number, lengthLimit: number, fail: Refuse): Point[] {
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


function data(object: object, key: string, fail: Refuse): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !('value' in descriptor)) return fail('INPUT', 'path must contain only owned data properties');
  return descriptor.value;
}
function list(value: unknown, maximum: number, fail: Refuse): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return fail('INPUT', 'path array is missing or exceeds the native path limit');
  for (const name of Reflect.ownKeys(value)) if (typeof name !== 'string' || name !== 'length' && (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= value.length)) return fail('INPUT', 'path array contains an unknown property');
  const result: unknown[] = [];
  for (let i = 0; i < value.length; i++) result.push(data(value, String(i), fail));
  return result;
}
function numeric(value: unknown, fail: Refuse): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail('INPUT', 'path requires finite numeric data');
  return value;
}
/** Own the query input before validation, including every nested numeric array. */
function snapshot(raw: unknown, fail: Refuse): RawNurbsPath {
  if (!record(raw) || Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null) return fail('INPUT', 'path must be a plain NURBS data object');
  for (const key of Reflect.ownKeys(raw)) if (typeof key !== 'string' || !['degree', 'knots', 'controlPoints', 'weights'].includes(key)) return fail('INPUT', 'path contains an unknown field');
  const degree = numeric(data(raw, 'degree', fail), fail), knots: number[] = [], weights: number[] = [], controlPoints: [number, number, number][] = [];
  for (const v of list(data(raw, 'knots', fail), 70, fail)) knots.push(numeric(v, fail));
  for (const v of list(data(raw, 'weights', fail), 64, fail)) weights.push(numeric(v, fail));
  for (const p of list(data(raw, 'controlPoints', fail), 64, fail)) {
    const row = list(p, 3, fail); if (row.length !== 3) return fail('INPUT', 'path poles need three coordinates');
    controlPoints.push([numeric(row[0], fail), numeric(row[1], fail), numeric(row[2], fail)]);
  }
  const path = { degree, knots, controlPoints, weights };
  try { validateCurve({ kind: 'curve', id: 'path', ...path }); } catch (cause) { return fail('INPUT', `path: ${cause instanceof Error ? cause.message : String(cause)}`); }
  return path;
}
function checkedMidpoint(a: number, middle: number, b: number, work: QuadraticCutWork): boolean {
  return work.cmp(work.add(work.from(a), work.from(b)), work.scale(work.from(middle), 1)) === 0;
}
function curved(path: RawNurbsPath, work: QuadraticCutWork): boolean {
  if (path.degree !== 2 || path.controlPoints.length !== 3) return false;
  for (let axis = 0; axis < 3; axis++) if (!checkedMidpoint(path.controlPoints[0][axis], path.controlPoints[1][axis], path.controlPoints[2][axis], work)) return true;
  return false;
}
function quadratic(path: RawNurbsPath, spacing: number, count: number, limit: number, fail: Refuse, work: QuadraticCutWork): CurveCutPathPlan {
  for (const weight of path.weights) if (weight !== 1) return fail('CAPABILITY', 'path cut pattern weights must all be 1');
  const k = path.knots;
  if (k.length !== 6 || k[0] !== k[1] || k[1] !== k[2] || k[3] !== k[4] || k[4] !== k[5] || !(k[2] < k[3])) return fail('CAPABILITY', 'a curved quadratic needs one clamped polynomial span');
  for (const point of path.controlPoints) for (const value of point) if (Math.abs(value) > limit) return fail('PARAMETER', 'path coordinates must be within ±10000 mm');
  const plan = planQuadraticCut(path.controlPoints, spacing, count, limit, fail, work);
  return { offsets: plan.offsets, length: plan.length };
}
/** Preserve the legacy offset leaf; only a single nonstraight three-pole quadratic uses certification. */
export function curveCutOffsets(path: unknown, spacing: number, count: number, lengthLimit: number, fail: Refuse): Point[] {
  const degree = record(path) ? Object.getOwnPropertyDescriptor(path, 'degree') : undefined;
  const poles = record(path) ? Object.getOwnPropertyDescriptor(path, 'controlPoints') : undefined;
  if (degree && !('value' in degree) || poles && !('value' in poles)) return fail('INPUT', 'path must contain only owned data properties');
  if (degree && 'value' in degree && degree.value === 2 && poles && 'value' in poles && Array.isArray(poles.value) && poles.value.length === 3) {
    const work = new QuadraticCutWork(fail); work.take(16384);
    const owned = snapshot(path, fail);
    if (curved(owned, work)) return quadratic(owned, spacing, count, lengthLimit, fail, work).offsets;
  }
  return legacyCurveCutOffsets(path, spacing, count, lengthLimit, fail);
}
/** Query-only exact qualification avoids the legacy decoder's uncharged trailing-zero loop.
 * The Number leaf receives the very same authored span endpoints in the very same order.
 */
function legacyQueryPath(path: RawNurbsPath, limit: number, fail: Refuse, work: QuadraticCutWork): RawNurbsPath {
  if (path.degree !== 2) return path;
  const { controlPoints: poles, knots } = path;
  for (const point of poles) for (const value of point) if (Math.abs(value) > limit) return fail('PARAMETER', 'path coordinates must be within ±10000 mm');
  for (const weight of path.weights) if (weight !== 1) return fail('CAPABILITY', 'path cut pattern weights must all be 1');
  if (poles.length % 2 !== 1) return fail('CAPABILITY', 'quadratic path must consist of complete C0 straight spans');
  for (let i = 3; i < poles.length; i += 2) if (knots[i] !== knots[i + 1]) return fail('CAPABILITY', 'quadratic path needs double interior knots between straight spans');
  const points: (readonly [number, number, number])[] = [], lineKnots = [0, 0], weights: number[] = [];
  for (let i = 0; i + 2 < poles.length; i += 2) {
    for (let axis = 0; axis < 3; axis++) if (!checkedMidpoint(poles[i][axis], poles[i + 1][axis], poles[i + 2][axis], work)) return fail('CAPABILITY', 'quadratic path middle poles must be exact straight-span midpoints');
    points.push(poles[i]); weights.push(1);
  }
  points.push(poles[poles.length - 1]); weights.push(1);
  for (let i = 1; i < points.length; i++) lineKnots.push(i);
  lineKnots.push(points.length - 1);
  return { degree: 1, knots: lineKnots, controlPoints: points, weights };
}
/** Shared geometry query. Legacy offsets/admission retain their old Number contract; bounds are diagnostic. */
export function planCurveCutPath(raw: unknown, spacing: number, count: number, limit: number, fail: Refuse): CurveCutPathPlan {
  const w = new QuadraticCutWork(fail);
  // Pre-reserve bounded descriptor/native admission and Number-only legacy work before executing it.
  // Exact midpoint qualification is separately charged through this same work owner, not this reserve.
  w.take(16384);
  if (!Number.isFinite(spacing) || !(spacing > 0) || spacing > limit) return fail('PARAMETER', 'path cut pattern needs a positive spacing within 10000');
  if (!Number.isInteger(count) || count < 1 || count > 64) return fail('PARAMETER', 'path cut pattern count must be an integer from 1 to 64');
  const owned = snapshot(raw, fail);
  if (curved(owned, w)) return quadratic(owned, spacing, count, limit, fail, w);
  const linear = legacyQueryPath(owned, limit, fail, w);
  const offsets = legacyCurveCutOffsets(linear, spacing, count, limit, fail);
  let lower = w.from(0), upper = lower, estimate = 0;
  for (let i = 1; i < linear.controlPoints.length; i++) {
    const coordinates = [], a = linear.controlPoints[i - 1], b = linear.controlPoints[i];
    for (let axis = 0; axis < 3; axis++) coordinates.push(w.sub(w.from(b[axis]), w.from(a[axis])));
    const bounds = cutNormBounds(w, coordinates, -40); lower = w.add(lower, bounds[0]); upper = w.add(upper, bounds[1]);
    estimate += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return { offsets, length: cutLengthNumbers(w, lower, upper, estimate) };
}
