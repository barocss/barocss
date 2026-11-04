import type { Vec3 } from './internal-types.js';
import { error } from './validation.js';

export interface SpherePairHit { fraction: number; normal: Vec3 }

function numericLimit(): never {
  return error('NUMERIC_LIMIT', 'unsafe exact sphere-pair sweep');
}

/** Preserve every represented endpoint and radius before subtracting or adding. */
function integerCoordinates(values: number[]): bigint[] {
  const words = new DataView(new ArrayBuffer(8));
  const parts = values.map((value) => {
    if (!Number.isFinite(value)) numericLimit();
    words.setFloat64(0, value, false);
    const bits = words.getBigUint64(0, false);
    const exponent = Number((bits >> 52n) & 2047n);
    const significand = (bits & 0xfffffffffffffn) | (exponent === 0 ? 0n : 0x10000000000000n);
    return { significand: bits >> 63n ? -significand : significand,
      exponent: exponent === 0 ? -1074 : exponent - 1075 };
  });
  const exponent = Math.min(...parts.filter((part) => part.significand !== 0n).map((part) => part.exponent));
  return parts.map((part) => part.significand === 0n ? 0n
    : part.significand << BigInt(part.exponent - exponent));
}

function leading(value: bigint): { value: number; exponent: number } {
  const magnitude = value < 0n ? -value : value;
  if (magnitude === 0n) return { value: 0, exponent: 0 };
  const exponent = Math.max(0, magnitude.toString(2).length - 53);
  return { value: Number(magnitude >> BigInt(exponent)) * (value < 0n ? -1 : 1), exponent };
}

function powerOfTwo(value: number, exponent: number): number {
  if (exponent < -1022) return value * 2 ** (exponent + 1022) * 2 ** -1022;
  if (exponent > 1023) return value * 2 ** (exponent - 1023) * 2 ** 1023;
  return value * 2 ** exponent;
}

function ratio(numerator: bigint, denominator: bigint): number {
  const n = leading(numerator);
  const d = leading(denominator);
  return powerOfTwo(n.value / d.value, n.exponent - d.exponent);
}

function scaled(value: bigint, exponent: number): number {
  const head = leading(value);
  return powerOfTwo(head.value, head.exponent - exponent);
}

/**
 * First entry of two linearly swept spheres. Exact dyadic predicates classify
 * the closed segment; floating arithmetic only constructs the admitted hit.
 * There is one quadratic, no search, refinement, feature case or fallback.
 */
export function sweepSpherePairExact(markedStart: Vec3, markedEnd: Vec3,
  otherStart: Vec3, otherEnd: Vec3, markedRadius: number, otherRadius: number): SpherePairHit | null {
  if (!(markedRadius > 0) || !(otherRadius > 0)) numericLimit();
  const coordinates = integerCoordinates([
    ...markedStart, ...markedEnd, ...otherStart, ...otherEnd, markedRadius, otherRadius,
  ]);
  const p = coordinates.slice(0, 3).map((value, axis) => value - coordinates[6 + axis]);
  const v = coordinates.slice(3, 6).map((value, axis) =>
    value - coordinates[axis] - coordinates[9 + axis] + coordinates[6 + axis]);
  const radius = coordinates[12] + coordinates[13];
  let a = 0n;
  let b = 0n;
  let c = -radius * radius;
  for (let axis = 0; axis < 3; axis++) {
    a += v[axis] * v[axis];
    b += 2n * p[axis] * v[axis];
    c += p[axis] * p[axis];
  }
  // Initial real touch/overlap remains owned by discrete contact.
  if (c <= 0n || a === 0n || b >= 0n) return null;
  const discriminant = b * b - 4n * a * c;
  if (discriminant < 0n) return null;
  // C>0 and B<0 make entry strictly positive. Compare entry with one exactly.
  const endpointOffset = -b - 2n * a;
  const endpointDifference = endpointOffset < 0n ? -1n
    : endpointOffset * endpointOffset - discriminant;
  if (endpointDifference > 0n) return null;
  let fraction: number;
  let normal: Vec3;
  if (discriminant === 0n) {
    fraction = endpointDifference === 0n ? 1 : ratio(-b, 2n * a);
    normal = p.map((value, axis) =>
      ratio(2n * a * value - b * v[axis], 2n * a * radius)) as Vec3;
  } else {
    const sqrtExponent = Math.ceil(discriminant.toString(2).length / 2);
    const sqrtMantissa = Math.sqrt(scaled(discriminant, 2 * sqrtExponent));
    const coefficientExponent = Math.max(a.toString(2).length, (-b).toString(2).length,
      c.toString(2).length);
    const bb = scaled(b, coefficientExponent);
    const cc = scaled(c, coefficientExponent);
    const rootDiscriminant = powerOfTwo(sqrtMantissa, sqrtExponent - coefficientExponent);
    const q = -0.5 * (bb - rootDiscriminant);
    if (!(rootDiscriminant > 0) || !(q > 0) ||
      ![bb, cc, q].every(Number.isFinite)) numericLimit();
    fraction = endpointDifference === 0n ? 1 : cc / q;
    // Exact closest-point numerators avoid cancellation in world-space p+t*v.
    // Each of the two vector terms has norm at most one at an admitted root.
    normal = p.map((value, axis) => {
      const projected = ratio(2n * a * value - b * v[axis], 2n * a * radius);
      const offset = ratio(v[axis] << BigInt(sqrtExponent), 2n * a * radius) * sqrtMantissa;
      return projected - offset;
    }) as Vec3;
  }
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1 ||
    normal.some((value) => !Number.isFinite(value))) numericLimit();
  const magnitude = Math.hypot(...normal);
  if (!(magnitude > 0) || Math.abs(magnitude - 1) > 1e-12) numericLimit();
  return { fraction, normal: normal.map((value) => value / magnitude) as Vec3 };
}
