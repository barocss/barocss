import type { Vec3 } from './internal-types.js';
import { error } from './validation.js';

export interface RoundedBoxHit { fraction: number; normalLocal: Vec3 }
interface Fraction { n: bigint; d: bigint }

const ZERO: Fraction = { n: 0n, d: 1n };
const ONE: Fraction = { n: 1n, d: 1n };

function numericLimit(): never {
  return error('NUMERIC_LIMIT', 'sphere CCD rounded-box calculation exceeded numeric limits');
}

function compare(a: Fraction, b: Fraction): number {
  const difference = a.n * b.d - b.n * a.d;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

/** Exact integer coordinates on one binary scale. No input rounding is repeated. */
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

/** Sign of (-B + branch*sqrt(D))/(2A) - boundary, without rounding a root. */
function rootCompare(a: bigint, b: bigint, discriminant: bigint, branch: -1 | 1,
  boundary: Fraction): number {
  const offset = -b * boundary.d - 2n * a * boundary.n;
  if (branch === -1 && offset < 0n) return -1;
  if (branch === 1 && offset > 0n) return 1;
  const squaredDifference = offset * offset - discriminant * boundary.d * boundary.d;
  const sign = squaredDifference < 0n ? -1 : squaredDifference > 0n ? 1 : 0;
  return branch === -1 ? sign : -sign;
}

/**
 * Segment versus the Euclidean radius-offset of a box, in box coordinates.
 * At most six exact plane crossings split distance squared into seven quadratics.
 * Integer predicates retain tangencies and closed endpoints without sign epsilons.
 */
export function sweepRoundedBox(start: Vec3, end: Vec3, halfExtents: Vec3,
  radius: number): RoundedBoxHit | null {
  if (!(radius > 0) || halfExtents.some((value) => !(value > 0))) numericLimit();
  const coordinates = integerCoordinates([...start, ...end, ...halfExtents, radius]);
  const p = coordinates.slice(0, 3);
  const velocity = coordinates.slice(3, 6).map((value, axis) => value - p[axis]);
  const half = coordinates.slice(6, 9);
  const r = coordinates[9];
  const radiusSquared = r * r;
  let initialDistanceSquared = 0n;
  const breaks: Fraction[] = [ZERO, ONE];
  for (let axis = 0; axis < 3; axis++) {
    const gap = p[axis] < -half[axis] ? p[axis] + half[axis]
      : p[axis] > half[axis] ? p[axis] - half[axis] : 0n;
    initialDistanceSquared += gap * gap;
    if (velocity[axis] === 0n) continue;
    for (const side of [-1n, 1n]) {
      let n = side * half[axis] - p[axis];
      let d = velocity[axis];
      if (d < 0n) { n = -n; d = -d; }
      if (n > 0n && n < d) breaks.push({ n, d });
    }
  }
  // True initial touch/overlap belongs to discrete contact, including a centre in the box.
  if (initialDistanceSquared <= radiusSquared) return null;
  if (velocity.every((value) => value === 0n)) return null;
  breaks.sort(compare);
  const boundaries = breaks.filter((value, index) => index === 0 || compare(value, breaks[index - 1]) !== 0);
  for (let interval = 0; interval + 1 < boundaries.length; interval++) {
    const lo = boundaries[interval];
    const hi = boundaries[interval + 1];
    const middle = { n: lo.n * hi.d + hi.n * lo.d, d: 2n * lo.d * hi.d };
    const gap: bigint[] = [0n, 0n, 0n];
    const motion: bigint[] = [0n, 0n, 0n];
    const sides = [0, 0, 0];
    let a = 0n;
    let b = 0n;
    let c = -radiusSquared;
    for (let axis = 0; axis < 3; axis++) {
      const point = p[axis] * middle.d + velocity[axis] * middle.n;
      const bound = half[axis] * middle.d;
      const side = point < -bound ? -1 : point > bound ? 1 : 0;
      sides[axis] = side;
      if (side === 0) continue;
      gap[axis] = p[axis] - BigInt(side) * half[axis];
      motion[axis] = velocity[axis];
      a += motion[axis] * motion[axis];
      b += 2n * gap[axis] * motion[axis];
      c += gap[axis] * gap[axis];
    }
    if (a === 0n) {
      if (c > 0n) continue;
      if (c < 0n) numericLimit(); // An earlier interval must have owned the entry.
      const normal = gap.map((value) => ratio(value, r)) as Vec3;
      return finish(ratio(lo.n, lo.d), normal, sides);
    }
    const discriminant = b * b - 4n * a * c;
    if (discriminant < 0n) continue;
    for (const branch of [-1, 1] as const) {
      if (branch === 1 && discriminant === 0n) continue;
      if (rootCompare(a, b, discriminant, branch, lo) < 0 ||
        rootCompare(a, b, discriminant, branch, hi) > 0) continue;
      if (discriminant === 0n) {
        const normal = gap.map((value, axis) => ratio(2n * a * value - motion[axis] * b,
          2n * a * r)) as Vec3;
        return finish(ratio(-b, 2n * a), normal, sides);
      }
      // Normalize D before sqrt. Its exact sign is already known; no clamp is used.
      const sqrtExponent = Math.ceil(discriminant.toString(2).length / 2);
      const sqrtMantissa = Math.sqrt(scaled(discriminant, 2 * sqrtExponent));
      const coefficientExponent = Math.max(a.toString(2).length,
        (b < 0n ? -b : b).toString(2).length, (c < 0n ? -c : c).toString(2).length);
      const aa = scaled(a, coefficientExponent);
      const bb = scaled(b, coefficientExponent);
      const cc = scaled(c, coefficientExponent);
      const rootDiscriminant = powerOfTwo(sqrtMantissa, sqrtExponent - coefficientExponent);
      const q = -0.5 * (bb + (b < 0n ? -rootDiscriminant : rootDiscriminant));
      if (!(aa > 0) || !(rootDiscriminant > 0) || q === 0 ||
        ![aa, bb, cc, q].every(Number.isFinite)) numericLimit();
      const fraction = branch === (b < 0n ? 1 : -1) ? q / aa : cc / q;
      // Compute the normal from exact projection numerators, not p + t*v - half.
      // Both terms are bounded by the radius for an admitted feature root.
      const normal = gap.map((value, axis) => {
        const projected = ratio(2n * a * value - motion[axis] * b, 2n * a * r);
        const offset = ratio(motion[axis] << BigInt(sqrtExponent), 2n * a * r) * sqrtMantissa;
        return projected + branch * offset;
      }) as Vec3;
      return finish(fraction, normal, sides);
    }
  }
  return null;
}

function finish(fraction: number, normal: Vec3, sides: number[]): RoundedBoxHit {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1 ||
    normal.some((value, axis) => !Number.isFinite(value) || value * sides[axis] < 0)) numericLimit();
  const magnitude = Math.hypot(...normal);
  if (!(magnitude > 0) || Math.abs(magnitude - 1) > 1e-12) numericLimit();
  return { fraction, normalLocal: normal.map((value) => value / magnitude) as Vec3 };
}
