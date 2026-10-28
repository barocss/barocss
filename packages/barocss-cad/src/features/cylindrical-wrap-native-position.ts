import { validateCurve, validateSurface } from '../core/math.js';
import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from '../core/own-data.js';
import { isFrom, kernelRefusal, KernelError } from '../core/barocss-error.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import type { SectionRationalContext, SectionRational } from '../section-rational-internal.js';
import type { Curve, Point, Surface } from '../types.js';

type R = SectionRational;
export type NativePositionCode = 'INPUT' | 'SUPPORT' | 'BUDGET';
export type NativePositionError = KernelError & { readonly code: NativePositionCode };
export interface NativePositionContext {
  readonly q: SectionRationalContext;
  charge(amount?: number): void;
  check(): void;
}
export interface NativePositionDomain { readonly low: R; readonly high: R; readonly guardLow: R; readonly guardHigh: R }
export interface NativePositionFace {
  readonly surface: Surface;
  readonly u: NativePositionDomain;
  readonly v: NativePositionDomain;
  /** Exact mathematical L1 derivative bounds; no native D1 evaluator is certified. */
  readonly lipschitz: { readonly u: R; readonly v: R };
}
const CURVE_FIELDS = ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'];
const SURFACE_FIELDS = ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'];
const FACES = new WeakMap<NativePositionFace, NativePositionContext>();
function fail(code: NativePositionCode, detail: string, cause?: unknown): never { throw kernelRefusal('native-position-binding', code, `Native position binding: ${detail}`, cause) as NativePositionError; }
export function isNativePositionError(error: unknown): error is NativePositionError { try { return isFrom<NativePositionCode>(error, 'native-position-binding'); } catch { return false; } }
function wrap(code: NativePositionCode, detail: string, cause: unknown): never { return fail(code, detail, cause); }
const OWN: OwnSnapshotSpec<NativePositionCode> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isNativePositionError };
function rethrow(error: unknown): never {
  if (isNativePositionError(error)) throw error;
  if (error instanceof KernelError && error.code === 'BUDGET') fail('BUDGET', error.message, error);
  throw error;
}
function structure(value: unknown, ctx: NativePositionContext): void {
  ctx.charge(4 + (typeof value === 'string' ? value.length : 0));
  if (value !== null && typeof value === 'object') for (const part of Object.values(value)) structure(part, ctx);
}
function record(input: unknown, fields: readonly string[], ctx: NativePositionContext): Record<string, unknown> {
  const value = ownSnapshot(input, false, OWN);
  if (!value || typeof value !== 'object' || Array.isArray(value) || !hasExactOwnFields(value as Record<string, unknown>, fields)) fail('INPUT', 'the complete current source fields are required');
  structure(value, ctx); ctx.check(); return value as Record<string, unknown>;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { for (const part of Object.values(value)) freeze(part); Object.freeze(value); }
  return value;
}
function spans(knots: number[], degree: number, count: number, ctx: NativePositionContext): [number, number][] {
  const q = ctx.q, half = q.rat(1n, 2n), one = q.integer(1), out: [number, number][] = [];
  if (degree <= 3 && count === degree + 1) out.push([knots[degree], knots[count]]);
  else if (degree === 2 && count === 5 && knots.length === 8 && knots[3] === knots[4]) out.push([knots[2], knots[3]], [knots[3], knots[5]]);
  else fail('SUPPORT', 'only admitted single spans or the quadratic five-pole two-half-span template are supported');
  for (const [low, high] of out) {
    if (Math.abs(low) > 1 || Math.abs(high) > 1) fail('SUPPORT', 'the exact source domains must keep native basis scale one');
    const width = q.sub(q.from(high), q.from(low)), isHalf = q.compare(width, half) === 0;
    if (!isHalf && (out.length === 2 || q.compare(width, one) !== 0)) fail('SUPPORT', 'source span widths must be exact half or unit spans');
    ctx.check();
  }
  return out;
}
function pole(point: Point, weight: number, ctx: NativePositionContext): void {
  ctx.charge(4);
  if (weight < 0.5 || weight > 1) fail('SUPPORT', 'the actual stored weights must remain in [0.5,1]');
  for (let axis = 0; axis < 3; axis++) if (Math.abs(point[axis]) > CadNumericPolicy.coordinateAbs) fail('SUPPORT', 'actual stored coordinates must remain inside 10000');
}
function sourceCurve(input: Curve, ctx: NativePositionContext): Curve {
  const source = record(input, CURVE_FIELDS, ctx) as unknown as Curve;
  try { validateCurve(source); } catch { fail('INPUT', 'the current Curve data must be valid'); }
  spans(source.knots, source.degree, source.controlPoints.length, ctx);
  for (let i = 0; i < source.controlPoints.length; i++) pole(source.controlPoints[i], source.weights[i], ctx);
  ctx.check(); return source;
}
function sourceSurface(input: Surface, ctx: NativePositionContext): Surface {
  const source = record(input, SURFACE_FIELDS, ctx) as unknown as Surface;
  try { validateSurface(source); } catch { fail('INPUT', 'the current Surface data must be valid'); }
  if (source.degreeV !== 1 || source.controlPoints[0].length !== 2) fail('SUPPORT', 'the V direction must be one linear span');
  spans(source.knotsU, source.degreeU, source.controlPoints.length, ctx); spans(source.knotsV, 1, 2, ctx);
  for (let i = 0; i < source.controlPoints.length; i++) for (let j = 0; j < 2; j++) pole(source.controlPoints[i][j], source.weights[i][j], ctx);
  ctx.check(); return source;
}
function scalar(input: R, ctx: NativePositionContext): R {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INPUT', 'an exact nonnegative rational bound is required');
  const prototype = Object.getPrototypeOf(input), keys = Reflect.ownKeys(input);
  if ((prototype !== Object.prototype && prototype !== null) || keys.length !== 2 || !keys.includes('n') || !keys.includes('d')) fail('INPUT', 'a rational bound must contain exactly n and d');
  const n = Object.getOwnPropertyDescriptor(input, 'n'), d = Object.getOwnPropertyDescriptor(input, 'd');
  if (!n || !d || !n.enumerable || !d.enumerable || !Object.hasOwn(n, 'value') || !Object.hasOwn(d, 'value') || typeof n.value !== 'bigint' || typeof d.value !== 'bigint' || n.value < 0n || d.value <= 0n) fail('INPUT', 'rational bounds must be nonnegative own BigInts with a positive denominator');
  const bits = Math.max(n.value.toString(2).length, d.value.toString(2).length); ctx.charge(4 + Math.ceil(bits / 64));
  if (bits > 8192) fail('BUDGET', 'an exact scalar exceeded the existing 8192-bit limit');
  ctx.check(); return input;
}
function point(input: Point, ctx: NativePositionContext): Point {
  const value = ownSnapshot(input, false, OWN);
  if (!Array.isArray(value) || value.length !== 3) fail('INPUT', 'a finite current three-coordinate point is required');
  structure(value, ctx);
  for (const coordinate of value) if (typeof coordinate !== 'number' || Math.abs(coordinate) > CadNumericPolicy.coordinateAbs) fail('INPUT', 'point coordinates must be finite and inside 10000');
  ctx.check(); return value as Point;
}
function tolerance(value: number, ctx: NativePositionContext): R {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) fail('INPUT', 'the unchanged entity tolerance must be positive and finite');
  const result = ctx.q.from(value); ctx.check(); return result;
}
function domain(low: number, high: number, ctx: NativePositionContext): NativePositionDomain {
  const q = ctx.q;
  // Match checkBrep's actual Number threshold operations, not an exact decimal 1e-9.
  const result = { low: q.from(low), high: q.from(high), guardLow: q.from(low - 1e-9), guardHigh: q.from(high + 1e-9) };
  ctx.check(); return result;
}
function ratio(values: readonly [number, number][], degree: number, ctx: NativePositionContext): R {
  const q = ctx.q; let maximum = q.integer(0);
  for (const [low, high] of values) maximum = q.max(maximum, q.div(q.integer(degree), q.sub(q.from(high), q.from(low))));
  ctx.check(); return maximum;
}
function prepare(input: Surface, ctx: NativePositionContext): NativePositionFace {
  const surface = sourceSurface(input, ctx), q = ctx.q, uSpans = spans(surface.knotsU, surface.degreeU, surface.controlPoints.length, ctx), vSpans = spans(surface.knotsV, 1, 2, ctx);
  let minimum = 1, maximum = 0; const axes = [0, 0, 0];
  for (let i = 0; i < surface.controlPoints.length; i++) for (let j = 0; j < 2; j++) {
    minimum = Math.min(minimum, surface.weights[i][j]); maximum = Math.max(maximum, surface.weights[i][j]);
    for (let axis = 0; axis < 3; axis++) axes[axis] = Math.max(axes[axis], Math.abs(surface.controlPoints[i][j][axis]));
  }
  const m = q.from(minimum), big = q.from(maximum), sumA = q.add(q.add(q.from(axes[0]), q.from(axes[1])), q.from(axes[2]));
  // |N'|<=2*(p/h)*A*M, |W'|<=(p/h)*(M-m), W>=m and |N|<=A*M.
  // The maximum span bound is global because the stored pieces share their endpoint row.
  const common = q.div(q.mul(q.mul(sumA, big), q.sub(q.mul(q.integer(3), big), m)), q.mul(m, m));
  const result = freeze({ surface, u: domain(uSpans[0][0], uSpans[uSpans.length - 1][1], ctx), v: domain(vSpans[0][0], vSpans[0][1], ctx),
    lipschitz: { u: q.mul(common, ratio(uSpans, surface.degreeU, ctx)), v: q.mul(common, ratio(vSpans, 1, ctx)) } });
  ctx.check(); FACES.set(result, ctx); return result;
}
function ownedFace(face: NativePositionFace, ctx: NativePositionContext): void {
  if (!face || typeof face !== 'object' || FACES.get(face) !== ctx) fail('INPUT', 'the prepared face must belong to this exact request context');
}
/** Prepare exact coefficient bounds for a supported actual native face. No B-rep qualification is returned. */
export function prepareNativePositionFace(surface: Surface, ctx: NativePositionContext): NativePositionFace {
  try { return prepare(surface, ctx); } catch (error) { return rethrow(error); }
}
export function requireNativePcurveRange(input: Curve, face: NativePositionFace, eU: R, eV: R, ctx: NativePositionContext): void {
  try {
    ownedFace(face, ctx); scalar(eU, ctx); scalar(eV, ctx); const pcurve = sourceCurve(input, ctx), q = ctx.q, low = [Infinity, Infinity], high = [-Infinity, -Infinity];
    for (const p of pcurve.controlPoints) {
      if (p[2] !== 0) fail('SUPPORT', 'pcurve poles must have exact zero Z');
      for (let axis = 0; axis < 2; axis++) { low[axis] = Math.min(low[axis], p[axis]); high[axis] = Math.max(high[axis], p[axis]); }
    }
    const domains = [face.u, face.v], errors = [eU, eV];
    for (let axis = 0; axis < 2; axis++) {
      const a = q.from(low[axis]), b = q.from(high[axis]), d = domains[axis];
      if (q.compare(a, d.low) < 0 || q.compare(b, d.high) > 0) fail('SUPPORT', 'the exact positive-weight pcurve hull must stay inside the stored surface domain');
      if (q.compare(q.sub(a, errors[axis]), d.guardLow) < 0 || q.compare(q.add(b, errors[axis]), d.guardHigh) > 0) fail('SUPPORT', 'the computed pcurve error hull exceeds the actual native UV slack');
      ctx.check();
    }
  } catch (error) { rethrow(error); }
}
/** Includes both independent world-curve and surface D0 terms, then exact UV propagation. */
export function nativePositionInflation(face: NativePositionFace, eL1: R, eU: R, eV: R, ctx: NativePositionContext): R {
  try {
    ownedFace(face, ctx); scalar(eL1, ctx); scalar(eU, ctx); scalar(eV, ctx); const q = ctx.q;
    const result = q.add(q.mul(q.integer(2), eL1), q.add(q.mul(face.lipschitz.u, eU), q.mul(face.lipschitz.v, eV))); ctx.check(); return result;
  } catch (error) { return rethrow(error); }
}
export function checkedNativePositionBound(model: R, inflation: R, limit: number, ctx: NativePositionContext): R {
  try {
    scalar(model, ctx); scalar(inflation, ctx); const q = ctx.q, tau = tolerance(limit, ctx), result = q.add(model, inflation);
    if (q.compare(result, tau) > 0) fail('SUPPORT', 'the complete native position error exceeds the unchanged entity tolerance');
    ctx.check(); return result;
  } catch (error) { return rethrow(error); }
}
export function nativeEndpointPositionBound(input: Point, vertexInput: Point, eL1: R, limit: number, ctx: NativePositionContext): R {
  try {
    scalar(eL1, ctx); const p = point(input, ctx), vertex = point(vertexInput, ctx), q = ctx.q, tau = tolerance(limit, ctx); let result = eL1;
    for (let axis = 0; axis < 3; axis++) result = q.add(result, q.abs(q.sub(q.from(p[axis]), q.from(vertex[axis]))));
    if (q.compare(result, tau) > 0) fail('SUPPORT', 'the native endpoint error exceeds the supplied unchanged entity tolerance');
    ctx.check(); return result;
  } catch (error) { return rethrow(error); }
}
function sameBasis(a: Curve, b: Curve): void {
  if (a.degree !== b.degree || a.knots.length !== b.knots.length || a.weights.length !== b.weights.length || a.controlPoints.length !== b.controlPoints.length) fail('SUPPORT', 'world and UV curves must share their complete native basis');
  for (let i = 0; i < a.knots.length; i++) if (!Object.is(a.knots[i], b.knots[i])) fail('SUPPORT', 'world and UV knot bits must match in canonical parameter direction');
  for (let i = 0; i < a.weights.length; i++) if (!Object.is(a.weights[i], b.weights[i])) fail('SUPPORT', 'world and UV weight bits must match');
}
function capResidual(worldInput: Curve, pcurveInput: Curve, surfaceInput: Surface, ctx: NativePositionContext): R {
  const world = sourceCurve(worldInput, ctx), uv = sourceCurve(pcurveInput, ctx), surface = sourceSurface(surfaceInput, ctx), q = ctx.q;
  if (surface.degreeU !== 1 || surface.degreeV !== 1 || surface.controlPoints.length !== 2) fail('SUPPORT', 'an affine cap must be a single degree1x1 surface');
  if (surface.knotsU[1] !== 0 || surface.knotsU[2] !== 1 || surface.knotsV[1] !== 0 || surface.knotsV[2] !== 1) fail('SUPPORT', 'the affine cap must retain its unit UV domain');
  for (const row of surface.weights) for (const weight of row) if (weight !== 1) fail('SUPPORT', 'an affine cap must have unit weights');
  sameBasis(world, uv);
  const origin = surface.controlPoints[0][0], u: R[] = [], v: R[] = [];
  for (let axis = 0; axis < 3; axis++) {
    const a = q.from(origin[axis]); u.push(q.sub(q.from(surface.controlPoints[1][0][axis]), a)); v.push(q.sub(q.from(surface.controlPoints[0][1][axis]), a));
    const opposite = q.add(q.add(a, u[axis]), v[axis]);
    if (q.compare(opposite, q.from(surface.controlPoints[1][1][axis])) !== 0) fail('SUPPORT', 'the stored cap net must be an exact affine parallelogram');
    ctx.check();
  }
  let maximum = q.integer(0);
  for (let i = 0; i < world.controlPoints.length; i++) {
    if (uv.controlPoints[i][2] !== 0) fail('SUPPORT', 'affine cap pcurve poles must have exact zero Z');
    const pu = q.from(uv.controlPoints[i][0]), pv = q.from(uv.controlPoints[i][1]); let residual = q.integer(0);
    for (let axis = 0; axis < 3; axis++) {
      const lift = q.add(q.from(origin[axis]), q.add(q.mul(u[axis], pu), q.mul(v[axis], pv)));
      residual = q.add(residual, q.abs(q.sub(q.from(world.controlPoints[i][axis]), lift)));
    }
    maximum = q.max(maximum, residual); ctx.check();
  }
  ctx.check(); return maximum;
}
/** Exact affine-extension residual only. A separate range check is mandatory before binding. */
export function nativeAffineCapResidual(world: Curve, pcurve: Curve, surface: Surface, ctx: NativePositionContext): R {
  try { return capResidual(world, pcurve, surface, ctx); } catch (error) { return rethrow(error); }
}
