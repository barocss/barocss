import type { SectionFraction } from '../section-rational-internal.js';
import type { CylindricalWrapWallReferenceResult } from './cylindrical-wrap-source-walls.js';
import { ReferenceProofContext, closedReferenceFailure as fail } from './cylindrical-wrap-reference-context.js';

interface Interval { readonly lo: bigint; readonly hi: bigint }
const SCALE = 1n << 128n;
const NEGATIVE_SCALE = -SCALE;
const FACTORS = [32n, 64n, 128n] as const;
const DEGREE = [0, 1, 1, 0, 2, 2, 0, 2, 1, 1] as const;
const AXIAL = [0, 0, 0, 1, 0, 0, 2, 0, 1, 1] as const;
function add(a: bigint, b: bigint, ctx: ReferenceProofContext): bigint { return ctx.integer(a + b); }
function sub(a: bigint, b: bigint, ctx: ReferenceProofContext): bigint { return ctx.integer(a - b); }
function mul(a: bigint, b: bigint, ctx: ReferenceProofContext): bigint { return ctx.integer(a * b); }
function floor(n: bigint, d: bigint, ctx: ReferenceProofContext): bigint {
  ctx.direct(1); if (d <= 0n) fail('REPRESENTABILITY', 'a positive reference interval denominator is required');
  const value = ctx.integer(n / d), remainder = ctx.integer(n % d); ctx.direct(2);
  return n < 0n && remainder !== 0n ? sub(value, 1n, ctx) : value;
}
function ceil(n: bigint, d: bigint, ctx: ReferenceProofContext): bigint { return ctx.integer(-floor(ctx.integer(-n), d, ctx)); }
function fractionInterval(value: SectionFraction, ctx: ReferenceProofContext): Interval {
  ctx.structure(value.numerator.length + value.denominator.length);
  const n = ctx.integer(BigInt(value.numerator)), d = ctx.integer(BigInt(value.denominator)), scaled = mul(n, SCALE, ctx);
  return { lo: floor(scaled, d, ctx), hi: ceil(scaled, d, ctx) };
}
function numberInterval(value: number, ctx: ReferenceProofContext): Interval {
  const r = ctx.from(value), n = mul(r.n, SCALE, ctx); return { lo: floor(n, r.d, ctx), hi: ceil(n, r.d, ctx) };
}
function plus(a: Interval, b: Interval, ctx: ReferenceProofContext): Interval { return { lo: add(a.lo, b.lo, ctx), hi: add(a.hi, b.hi, ctx) }; }
function minus(a: Interval, b: Interval, ctx: ReferenceProofContext): Interval { return { lo: sub(a.lo, b.hi, ctx), hi: sub(a.hi, b.lo, ctx) }; }
function times(a: Interval, b: Interval, ctx: ReferenceProofContext): Interval {
  const values = [mul(a.lo, b.lo, ctx), mul(a.lo, b.hi, ctx), mul(a.hi, b.lo, ctx), mul(a.hi, b.hi, ctx)]; let low = values[0], high = low;
  for (const value of values) { ctx.direct(2); if (value < low) low = value; if (value > high) high = value; }
  return { lo: floor(low, SCALE, ctx), hi: ceil(high, SCALE, ctx) };
}
function quotient(a: Interval, b: Interval, ctx: ReferenceProofContext): Interval {
  ctx.direct(1); if (b.lo <= 0n) fail('REPRESENTABILITY', 'the enclosed reference volume must remain strictly positive');
  let low: bigint | undefined, high: bigint | undefined;
  for (const x of [a.lo, a.hi]) for (const y of [b.lo, b.hi]) {
    const n = mul(x, SCALE, ctx), l = floor(n, y, ctx), h = ceil(n, y, ctx); ctx.direct(2);
    if (low === undefined || l < low) low = l; if (high === undefined || h > high) high = h;
  }
  return { lo: low!, hi: high! };
}
function square(a: Interval, ctx: ReferenceProofContext): Interval {
  const x = mul(a.lo, a.lo, ctx), y = mul(a.hi, a.hi, ctx); ctx.direct(4);
  return { lo: a.lo <= 0n && a.hi >= 0n ? 0n : floor(x < y ? x : y, SCALE, ctx), hi: ceil(x > y ? x : y, SCALE, ctx) };
}
function receipt(a: Interval, ctx: ReferenceProofContext) { return { lower: ctx.fraction(a.lo, SCALE), upper: ctx.fraction(a.hi, SCALE) }; }
function positiveProduct(a: bigint, b: bigint, ctx: ReferenceProofContext): bigint { return ceil(mul(a, b, ctx), SCALE, ctx); }
function representationErrors(parent: CylindricalWrapWallReferenceResult, ctx: ReferenceProofContext): bigint[] {
  const source = parent.reference.formal.source, delta = fractionInterval(parent.sourceWalls.cycle.radial, ctx).hi;
  const r = numberInterval(source.radius, ctx).hi, height = minus(numberInterval(source.z[1], ctx), numberInterval(source.z[0], ctx), ctx).hi;
  const a = add(r, delta, ctx), h2 = ceil(height, 2n, ctx), a2 = positiveProduct(a, a, ctx), a3 = positiveProduct(a2, a, ctx);
  const powers = [a, a2, a3], axial = [SCALE, h2, positiveProduct(h2, h2, ctx)], common = positiveProduct(height, delta, ctx), errors: bigint[] = [];
  // At every angle/Z, the closed union has radius s*rho(theta), s in {1,2}.
  // |rho-R|<=delta and pi<4 imply this absolute monomial integral bound:
  // 2^(degree+5) * H * delta * (R+delta)^(degree+1) * (H/2)^axial.
  // It covers source and pad together; their shared interface is not material.
  for (let i = 0; i < 10; i++) {
    const value = positiveProduct(positiveProduct(common, powers[DEGREE[i]], ctx), axial[AXIAL[i]], ctx);
    errors.push(mul(value, FACTORS[DEGREE[i]], ctx));
  }
  return errors;
}
function audit(value: number, interval: Interval, budget: number, ctx: ReferenceProofContext) {
  const actual = ctx.from(value), allowed = ctx.from(budget), n = mul(actual.n, SCALE, ctx);
  let left = sub(n, mul(interval.lo, actual.d, ctx), ctx), right = sub(n, mul(interval.hi, actual.d, ctx), ctx); ctx.direct(3);
  if (left < 0n) left = ctx.integer(-left); if (right < 0n) right = ctx.integer(-right);
  const error = left > right ? left : right, denominator = mul(actual.d, SCALE, ctx);
  ctx.direct(1); if (mul(error, allowed.d, ctx) > mul(allowed.n, denominator, ctx)) fail('REPRESENTABILITY', 'an actual public Number exceeds its full reference geometry and arithmetic error budget');
  return { estimate: value, ...receipt(interval, ctx), error: ctx.fraction(error, denominator) };
}
/** Private mass continuation, after the caller proves the closed radial-reference decomposition. */
export function certifyClosedReferenceMass(parent: CylindricalWrapWallReferenceResult, ctx: ReferenceProofContext) {
  const formal = parent.reference.formal, properties = formal.properties, budget = formal.options.budgets, errors = representationErrors(parent, ctx), values: Interval[] = [];
  const raw = [], errorReceipts = [];
  for (let i = 0; i < 10; i++) {
    const low = fractionInterval(formal.moments[i].lower, ctx).lo, high = fractionInterval(formal.moments[i].upper, ctx).hi;
    const interval = { lo: sub(low, errors[i], ctx), hi: add(high, errors[i], ctx) }; values.push(interval); raw.push(receipt(interval, ctx)); errorReceipts.push(ctx.fraction(errors[i], SCALE));
  }
  ctx.direct(1); if (values[0].lo <= 0n) fail('REPRESENTABILITY', 'the closed reference volume lower bound must be positive');
  const center = [quotient(values[1], values[0], ctx), quotient(values[2], values[0], ctx), quotient(values[3], values[0], ctx)];
  const centroid = [center[0], center[1], plus(center[2], fractionInterval(formal.frame.zCenter, ctx), ctx)];
  const qxx = minus(values[4], quotient(square(values[1], ctx), values[0], ctx), ctx), qyy = minus(values[5], quotient(square(values[2], ctx), values[0], ctx), ctx), qzz = minus(values[6], quotient(square(values[3], ctx), values[0], ctx), ctx);
  const qxy = minus(values[7], quotient(times(values[1], values[2], ctx), values[0], ctx), ctx), qxz = minus(values[8], quotient(times(values[1], values[3], ctx), values[0], ctx), ctx), qyz = minus(values[9], quotient(times(values[2], values[3], ctx), values[0], ctx), ctx);
  const density = numberInterval(formal.options.density, ctx), factor = { lo: floor(density.lo, 1000n, ctx), hi: ceil(density.hi, 1000n, ctx) }, negative = { lo: NEGATIVE_SCALE, hi: NEGATIVE_SCALE };
  const inertia = [times(plus(qyy, qzz, ctx), factor, ctx), times(plus(qxx, qzz, ctx), factor, ctx), times(plus(qxx, qyy, ctx), factor, ctx), times(times(qxy, negative, ctx), factor, ctx), times(times(qxz, negative, ctx), factor, ctx), times(times(qyz, negative, ctx), factor, ctx)];
  const mass = times(values[0], factor, ctx), actualInertia = [properties.inertia[0][0], properties.inertia[1][1], properties.inertia[2][2], properties.inertia[0][1], properties.inertia[0][2], properties.inertia[1][2]], centerAudit = [], inertiaAudit = [];
  for (let i = 0; i < 3; i++) centerAudit.push(audit(properties.centroid[i], centroid[i], budget.centroid[i], ctx));
  for (let i = 0; i < 6; i++) inertiaAudit.push(audit(actualInertia[i], inertia[i], budget.inertia[i], ctx));
  return { authority: 'closed-original-radial-reference' as const, frame: formal.frame, order: formal.order, properties,
    radial: parent.sourceWalls.cycle.radial, rawMomentGeometryErrors: errorReceipts, moments: raw,
    audit: { volume: audit(properties.volume, values[0], budget.volume, ctx), mass: audit(properties.mass, mass, budget.mass, ctx), centroid: centerAudit, inertia: inertiaAudit },
    includesFullRadialGeometryError: true as const, actualReturnedNumbersCertified: true as const,
    literalStoredBrepMass: false as const, nativeSIAccuracy: false as const, partMassProvider: false as const };
}
