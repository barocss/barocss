import { kernelRefusal, isFrom, type KernelError } from '../core/barocss-error.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import type { SectionRationalContext, SectionRational, SectionFraction } from '../section-rational-internal.js';
import type { Point } from '../types.js';

type R = SectionRational;
export interface WallCycleContext {
  readonly q: SectionRationalContext;
  direct(amount: number): void;
  integer(value: bigint): bigint;
  structure(amount: number): void;
  check(): void;
}
/** Private mathematical operands, already owned by the caller. No provenance flag is consumed. */
export interface WallCycleSpan {
  readonly face: string; readonly span: 0 | 1; readonly sense: 'forward' | 'reversed';
  readonly controlPoints: readonly Point[]; readonly weights: readonly number[];
}
export interface WallCycleSpanProof {
  readonly face: string; readonly span: 0 | 1; readonly sense: 'forward' | 'reversed';
  readonly minimumWeight: SectionFraction;
  readonly radialDefectCoefficients: readonly SectionFraction[];
  /** Degree two Bernstein coefficients of X Y' - Y X', in directed local t in [0,1]. */
  readonly angularCoefficients: readonly SectionFraction[];
  readonly halfPlane: { readonly normal: readonly [number, number]; readonly minimum: SectionFraction };
  readonly radial: SectionFraction;
}
export interface WallCycleProof {
  readonly spans: readonly WallCycleSpanProof[]; readonly cycle: readonly number[];
  readonly radial: SectionFraction; readonly radialNormalizationL1: SectionFraction;
  readonly winding: 1; readonly simpleRadialGraph: true;
  readonly projection: 'xy';
  readonly authority: 'exact-stored-rational-coefficients';
  readonly nativeEvaluatorCertified: false;
}
export type WallCycleCode = 'SUPPORT' | 'BUDGET';
export type WallCycleError = KernelError & { readonly code: WallCycleCode };
export function wallCycleFailure(code: WallCycleCode, detail: string): never { throw kernelRefusal('cylindrical-wrap-source-walls', code, `Cylindrical wrap source walls: ${detail}`) as WallCycleError; }
export function isWallCycleError(error: unknown): error is WallCycleError { try { return isFrom<WallCycleCode>(error, 'cylindrical-wrap-source-walls'); } catch { return false; } }

interface H { readonly x: bigint; readonly y: bigint; readonly w: bigint }
interface Dyadic { readonly n: bigint; readonly d: bigint }
const NORMALS: readonly (readonly [number, number])[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
function endpoint(span: WallCycleSpan, end: boolean, ctx: WallCycleContext): Point {
  ctx.direct(2);
  return span.controlPoints[(span.sense === 'forward') !== end ? 0 : 2];
}
function sameXY(a: Point, b: Point, ctx: WallCycleContext): boolean {
  ctx.direct(2); return Object.is(a[0], b[0]) && Object.is(a[1], b[1]);
}
function endpointCycle(spans: readonly WallCycleSpan[], ctx: WallCycleContext): number[] {
  // Every start is distinct. Thus a matching end has at most one successor.
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    if (sameXY(endpoint(spans[i], false, ctx), endpoint(spans[j], false, ctx), ctx)) wallCycleFailure('SUPPORT', 'four distinct directed junctions are required');
  }
  const cycle: number[] = []; let slot = 0;
  for (let step = 0; step < 4; step++) {
    ctx.structure(5);
    if (cycle.includes(slot)) wallCycleFailure('SUPPORT', 'the four spans must belong to one connected cycle');
    cycle.push(slot); let next = -1;
    for (let j = 0; j < 4; j++) if (sameXY(endpoint(spans[slot], true, ctx), endpoint(spans[j], false, ctx), ctx)) next = j;
    if (next < 0) wallCycleFailure('SUPPORT', 'directed endpoints must join with unchanged Cartesian bits');
    slot = next;
  }
  ctx.direct(1); if (slot !== 0) wallCycleFailure('SUPPORT', 'the directed cycle must close');
  return cycle;
}
function product(a: bigint, b: bigint, ctx: WallCycleContext): bigint { return ctx.integer(a * b); }
function sum(a: bigint, b: bigint, ctx: WallCycleContext): bigint { return ctx.integer(a + b); }
function difference(a: bigint, b: bigint, ctx: WallCycleContext): bigint { return ctx.integer(a - b); }
function dyadicProduct(a: R, b: R, ctx: WallCycleContext): Dyadic { return { n: product(a.n, b.n, ctx), d: product(a.d, b.d, ctx) }; }
function aligned(value: Dyadic, denominator: bigint, ctx: WallCycleContext): bigint {
  // Each denominator is a positive power of two obtained from exact binary64 inputs.
  // Their maximum is a common multiple; this division has no rounding.
  const remainder = ctx.integer(denominator % value.d); ctx.direct(1);
  if (remainder !== 0n) wallCycleFailure('SUPPORT', 'the homogeneous common denominator must divide exactly');
  return product(value.n, ctx.integer(denominator / value.d), ctx);
}
function homogeneous(span: WallCycleSpan, ctx: WallCycleContext): { poles: H[]; denominator: bigint } {
  const q = ctx.q, rows: (readonly Dyadic[])[] = []; let denominator = 1n;
  for (let j = 0; j < 3; j++) {
    ctx.direct(2);
    const i = span.sense === 'forward' ? j : 2 - j, p = span.controlPoints[i], w = q.from(span.weights[i]);
    const row = [dyadicProduct(q.from(p[0]), w, ctx), dyadicProduct(q.from(p[1]), w, ctx), w]; ctx.check();
    for (const value of row) { ctx.direct(1); if (value.d > denominator) denominator = value.d; }
    rows.push(row);
  }
  const poles: H[] = [];
  for (const row of rows) poles.push({ x: aligned(row[0], denominator, ctx), y: aligned(row[1], denominator, ctx), w: aligned(row[2], denominator, ctx) });
  return { poles, denominator };
}
function cross(a: H, b: H, ctx: WallCycleContext): bigint { return difference(product(a.x, b.y, ctx), product(a.y, b.x, ctx), ctx); }
function defect(a: H, b: H, radius: R, ctx: WallCycleContext): bigint {
  const dot = sum(product(a.x, b.x, ctx), product(a.y, b.y, ctx), ctx);
  return difference(product(dot, product(radius.d, radius.d, ctx), ctx), product(product(radius.n, radius.n, ctx), product(a.w, b.w, ctx), ctx), ctx);
}
function fraction(n: bigint, d: bigint, ctx: WallCycleContext): SectionFraction { const value = ctx.q.text(ctx.q.rat(n, d)); ctx.check(); return value; }
function halfPlane(poles: readonly H[], denominator: bigint, ctx: WallCycleContext): WallCycleSpanProof['halfPlane'] {
  for (const normal of NORMALS) {
    let minimum: bigint | undefined;
    for (const p of poles) {
      ctx.direct(3);
      const dot = sum(normal[0] === 1 ? p.x : ctx.integer(-p.x), normal[1] === 1 ? p.y : ctx.integer(-p.y), ctx);
      if (dot <= 0n) { minimum = undefined; break; }
      ctx.direct(1); if (minimum === undefined || dot < minimum) minimum = dot;
    }
    if (minimum !== undefined) return { normal: [normal[0], normal[1]], minimum: fraction(minimum, denominator, ctx) };
  }
  return wallCycleFailure('SUPPORT', 'each complete span must lie in a proved open half-plane');
}
function fractions(values: readonly bigint[], denominator: bigint, ctx: WallCycleContext): SectionFraction[] {
  const out: SectionFraction[] = []; for (const value of values) out.push(fraction(value, denominator, ctx)); return out;
}
function spanProof(span: WallCycleSpan, radius: R, ctx: WallCycleContext): { proof: WallCycleSpanProof; radial: R } {
  const q = ctx.q, data = homogeneous(span, ctx), h = data.poles, d = data.denominator;
  // All homogeneous coordinates share d. Integer products are exact and checked
  // against the same bit/operation cap; only final receipts need reduced fractions.
  const angular = [product(2n, cross(h[0], h[1], ctx), ctx), cross(h[0], h[2], ctx), product(2n, cross(h[1], h[2], ctx), ctx)];
  for (const k of angular) { ctx.direct(1); if (k <= 0n) wallCycleFailure('SUPPORT', 'every directed angular Bernstein coefficient must be strictly positive'); }
  const plane = halfPlane(h, d, ctx);
  // Q = X^2 + Y^2 - R^2 W^2 in degree four. Multiplication by three
  // clears its sole Bernstein combinatorial denominator without approximation.
  const middle = sum(defect(h[0], h[2], radius, ctx), product(2n, defect(h[1], h[1], radius, ctx), ctx), ctx);
  const coefficients = [product(3n, defect(h[0], h[0], radius, ctx), ctx), product(3n, defect(h[0], h[1], radius, ctx), ctx), middle, product(3n, defect(h[1], h[2], radius, ctx), ctx), product(3n, defect(h[2], h[2], radius, ctx), ctx)];
  let minimum = h[0].w, error = 0n;
  for (const pole of h) { ctx.direct(1); if (pole.w < minimum) minimum = pole.w; }
  for (const coefficient of coefficients) { ctx.direct(2); const absolute = coefficient < 0n ? ctx.integer(-coefficient) : coefficient; if (absolute > error) error = absolute; }
  // d cancels in max|Q|/(R*min(W)^2), leaving this exact rational.
  const radial = q.rat(error, product(product(3n, product(radius.d, radius.n, ctx), ctx), product(minimum, minimum, ctx), ctx)); ctx.check();
  if (q.compare(radial, q.from(CadNumericPolicy.linearTolerance)) > 0 || q.compare(q.mul(radial, q.integer(2)), radius) >= 0) wallCycleFailure('SUPPORT', 'the complete radial bound must satisfy the native linear policy and exclude the origin');
  const d2 = product(d, d, ctx), qDenominator = product(3n, product(product(radius.d, radius.d, ctx), d2, ctx), ctx);
  const proof: WallCycleSpanProof = { face: span.face, span: span.span, sense: span.sense, minimumWeight: fraction(minimum, d, ctx), radialDefectCoefficients: fractions(coefficients, qDenominator, ctx), angularCoefficients: fractions(angular, d2, ctx), halfPlane: plane, radial: q.text(radial) };
  ctx.check(); return { proof, radial };
}
/**
 * Private coefficient theorem. The caller owns finite operands and the aggregate ledger.
 * This function proves no producer identity, topology, cap, native evaluation or mass claim.
 */
export function certifyCylindricalWallCycle(spans: readonly WallCycleSpan[], radius: number, ctx: WallCycleContext): WallCycleProof {
  ctx.direct(4); ctx.structure(4);
  if (spans.length !== 4 || !Number.isFinite(radius) || radius < 0.01 || radius > CadNumericPolicy.coordinateAbs) wallCycleFailure('SUPPORT', 'four actual quadratic spans and a native radius are required');
  for (const span of spans) {
    ctx.structure(8); ctx.direct(6);
    if (span.controlPoints.length !== 3 || span.weights.length !== 3 || span.sense !== 'forward' && span.sense !== 'reversed' || span.span !== 0 && span.span !== 1) wallCycleFailure('SUPPORT', 'each directed span must retain three original poles and weights');
    for (let i = 0; i < 3; i++) {
      const p = span.controlPoints[i], w = span.weights[i]; ctx.direct(5); ctx.structure(4);
      if (p.length !== 3 || !Number.isFinite(w) || w < 0.5 || w > 1) wallCycleFailure('SUPPORT', 'original poles and weights in [0.5,1] are required');
      for (const v of p) { ctx.direct(3); if (!Number.isFinite(v) || Math.abs(v) > CadNumericPolicy.coordinateAbs) wallCycleFailure('SUPPORT', 'finite native-range coefficients are required'); }
    }
  }
  const cycle = endpointCycle(spans, ctx), q = ctx.q, r = q.from(radius), proofs: WallCycleSpanProof[] = [];
  let radial = q.rat(0n);
  for (const span of spans) { const result = spanProof(span, r, ctx); proofs.push(result.proof); radial = q.max(radial, result.radial); ctx.check(); }
  // Each increasing argument stays inside one open half-plane, so its increment is
  // strictly between 0 and pi. A closed four-span cycle has 0 < 2*pi*k < 4*pi: k=1.
  const result: WallCycleProof = { spans: proofs, cycle, radial: q.text(radial), radialNormalizationL1: q.text(q.mul(q.integer(2), radial)), winding: 1, simpleRadialGraph: true, projection: 'xy', authority: 'exact-stored-rational-coefficients', nativeEvaluatorCertified: false };
  ctx.check(); return result;
}
