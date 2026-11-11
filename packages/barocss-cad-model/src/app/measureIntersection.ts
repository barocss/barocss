import { finiteBinary64Integer } from '../engine/binary64';
import type { Vec3 } from '../engine/vec3';
import { sub } from '../engine/vec3';

type Triangle = [Vec3, Vec3, Vec3];
type Segment = [Vec3, Vec3];
type Volume = number | bigint;

function exactVolume(a: Vec3, b: Vec3, c: Vec3, d: Vec3): bigint {
  const origin = a.map(finiteBinary64Integer);
  const [u, v, w] = [b, c, d].map(p => p.map((x, i) => finiteBinary64Integer(x) - origin[i]));
  return u[0] * (v[1] * w[2] - v[2] * w[1]) +
    u[1] * (v[2] * w[0] - v[0] * w[2]) +
    u[2] * (v[0] * w[1] - v[1] * w[0]);
}

/** Keep the fast filter in an exponent range where the products and error bound stay normal. */
const ordinary = (x: number) => x === 0 || Math.abs(x) >= 2 ** -300 && Math.abs(x) <= 2 ** 300;
function volume(a: Vec3, b: Vec3, c: Vec3, d: Vec3): Volume {
  const u = sub(b, a), v = sub(c, a), w = sub(d, a);
  if (u.every(ordinary) && v.every(ordinary) && w.every(ordinary)) {
    const x = v[1] * w[2], y = v[2] * w[0], z = v[0] * w[1];
    const xx = v[2] * w[1], yy = v[0] * w[2], zz = v[1] * w[0];
    const determinant = u[0] * (x - xx) + u[1] * (y - yy) + u[2] * (z - zz);
    const magnitude = Math.abs(u[0]) * (Math.abs(x) + Math.abs(xx)) +
      Math.abs(u[1]) * (Math.abs(y) + Math.abs(yy)) +
      Math.abs(u[2]) * (Math.abs(z) + Math.abs(zz));
    // The rounding bound selects the exact fallback. The geometric boundaries remain inclusive.
    if (magnitude === 0 || Math.abs(determinant) > 8 * Number.EPSILON * magnitude) return determinant;
  }
  return exactVolume(a, b, c, d);
}

const sign = (x: Volume): number => x > 0 ? 1 : x < 0 ? -1 : 0;
const absolute = (x: bigint): bigint => x < 0n ? -x : x;
/** Round a rational in 2^-1074 units to its nearest binary64 coordinate. */
function roundedCoordinate(numerator: bigint, denominator: bigint): number {
  if (numerator === 0n) return 0;
  const magnitude = absolute(numerator);
  const estimate = magnitude.toString(2).length - denominator.toString(2).length;
  const exponent = estimate > 0 && magnitude < (denominator << BigInt(estimate)) ? estimate - 1 : estimate;
  const shift = Math.max(0, exponent - 52), unit = denominator << BigInt(shift);
  let coefficient = magnitude / unit;
  const twiceRemainder = 2n * (magnitude % unit);
  if (twiceRemainder > unit || twiceRemainder === unit && (coefficient & 1n) === 1n) coefficient++;
  return Number(numerator < 0n ? -coefficient : coefficient) * 2 ** (shift - 1074);
}

/** Noncoplanar finite segment/triangle intersection. Coplanar and degenerate cases use the usual closest features. */
function segmentTriangle([p, q]: Segment, [a, b, c]: Triangle): Vec3 | null {
  for (let k = 0; k < 3; k++) {
    if (Math.max(p[k], q[k]) < Math.min(a[k], b[k], c[k]) ||
        Math.min(p[k], q[k]) > Math.max(a[k], b[k], c[k])) return null;
  }
  if (![p, q, a, b, c].every(point => point.every(Number.isFinite))) return null;
  const sp = sign(volume(a, b, c, p)), sq = sign(volume(a, b, c, q));
  if (sp === sq) return null;

  // The side signs classify the intersection before rounding the witness coordinates.
  const ab = volume(p, q, a, b), bc = volume(p, q, b, c), ca = volume(p, q, c, a);
  const sides = [ab, bc, ca].map(sign);
  if (sides.includes(1) && sides.includes(-1)) return null;
  if (sp === 0) return p;
  if (sq === 0) return q;

  // Round the final point from the exact barycentric numerators. Rounding the weights
  // first can erase a small coordinate near a triangle side.
  const wa = absolute(typeof bc === 'bigint' ? bc : exactVolume(p, q, b, c));
  const wb = absolute(typeof ca === 'bigint' ? ca : exactVolume(p, q, c, a));
  const wc = absolute(typeof ab === 'bigint' ? ab : exactVolume(p, q, a, b));
  const total = wa + wb + wc;
  return [0, 1, 2].map(k => roundedCoordinate(
    wa * finiteBinary64Integer(a[k]) + wb * finiteBinary64Integer(b[k]) + wc * finiteBinary64Integer(c[k]),
    total,
  )) as Vec3;
}

export function firstSegmentTriangleCrossing(segments: Segment[], triangles: Triangle[]): Vec3 | null {
  for (const segment of segments) for (const triangle of triangles) {
    const point = segmentTriangle(segment, triangle);
    if (point) return point;
  }
  return null;
}
