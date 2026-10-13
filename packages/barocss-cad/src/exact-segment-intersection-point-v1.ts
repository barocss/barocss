import { classifyExactSegmentCrossingV1 } from './exact-segment-crossing-v1.js';
import { snapshotExactSegmentPointsV1 } from './exact-segment-points-v1.js';


/** Rational coordinates in millimetres; decimal strings contain exact integers. */
export interface ExactRationalMMV1 { readonly numerator: string; readonly denominator: string }
export type ExactProperSegmentIntersectionV1 =
  | { readonly status: 'exact'; readonly relation: 'proper-interior-crossing';
      readonly pointMM: { readonly x: ExactRationalMMV1; readonly y: ExactRationalMMV1 };
      readonly parameterAB: ExactRationalMMV1; readonly parameterCD: ExactRationalMMV1;
      readonly method: 'binary64-dyadic-cramer-bigint' }
  | { readonly status: 'refused'; readonly reason: 'not-proper-interior-crossing' }
  | { readonly status: 'unsupported'; readonly reason: string };

const view = new DataView(new ArrayBuffer(8));
function dyadic(value: number): { n: bigint; exponent: number } {
  view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false);
  const exponentBits = Number((bits >> 52n) & 2047n);
  const fraction = bits & ((1n << 52n) - 1n);
  const mantissa = exponentBits === 0 ? fraction : (1n << 52n) | fraction;
  return { n: (bits >> 63n) === 0n ? mantissa : -mantissa,
    exponent: exponentBits === 0 ? -1074 : exponentBits - 1075 };
}
const abs = (n: bigint): bigint => n < 0n ? -n : n;
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  while (b !== 0n) { const r = a % b; a = b; b = r; }
  return a;
}
function fraction(n: bigint, d: bigint): ExactRationalMMV1 {
  if (d === 0n) throw new RangeError('Zero rational denominator');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { numerator: (n / g).toString(), denominator: (d / g).toString() };
}
const cross = (ax: bigint, ay: bigint, bx: bigint, by: bigint) => ax * by - ay * bx;

/** Only proper crossings; no endpoint, overlap, tolerance snapping or topology changes. */
export function intersectProperSegmentsExactBinary64V1(
  a: unknown, b: unknown, c: unknown, d: unknown,
  maxAbsCoordinateMM = 10000,
): ExactProperSegmentIntersectionV1 {
  const snapshot = snapshotExactSegmentPointsV1(a, b, c, d, maxAbsCoordinateMM);
  if (snapshot.status === 'unsupported')
    return { status: 'unsupported', reason: snapshot.reason };
  const classified = classifyExactSegmentCrossingV1(...snapshot.points, maxAbsCoordinateMM);
  if (classified.status === 'unsupported')
    return { status: 'unsupported', reason: classified.reason };
  if (classified.relation !== 'proper-interior-crossing')
    return { status: 'refused', reason: 'not-proper-interior-crossing' };
  // Dyadic Cramer uses the SAME admitted finite endpoint snapshot as classification.
  const values = snapshot.points.flatMap(p => [dyadic(p.x), dyadic(p.y)]);
  const common = Math.min(...values.map(value => value.exponent));
  const [ax, ay, bx, by, cx, cy, dx, dy] = values.map(value =>
    value.n << BigInt(value.exponent - common));
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const denominator = cross(rx, ry, sx, sy);
  const qx = cx - ax, qy = cy - ay;
  const tNum = cross(qx, qy, sx, sy), uNum = cross(qx, qy, rx, ry);
  // The four exact orientations imply denominator != 0 and 0<t,u<1.
  if (denominator === 0n) throw new Error('Exact classifier/Cramer inconsistency');
  const scale = common < 0 ? 1n << BigInt(-common) : 1n;
  const whole = common > 0 ? 1n << BigInt(common) : 1n;
  const xNum = (ax * denominator + rx * tNum) * whole;
  const yNum = (ay * denominator + ry * tNum) * whole;
  return { status: 'exact', relation: 'proper-interior-crossing',
    pointMM: { x: fraction(xNum, denominator * scale), y: fraction(yNum, denominator * scale) },
    parameterAB: fraction(tNum, denominator), parameterCD: fraction(uNum, denominator),
    method: 'binary64-dyadic-cramer-bigint' };
}
