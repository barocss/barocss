import { intersectProperSegmentsExactBinary64V1 } from './exact-segment-intersection-point-v1.js';
import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';
import type { ExactRationalMMV1 } from './exact-segment-intersection-point-v1.js';

export type ExactSplitPointV1 = { readonly x: ExactRationalMMV1; readonly y: ExactRationalMMV1 };
export interface ExactSplitSubedgeV1 {
  readonly parentEdgeId: string;
  readonly startParameter: ExactRationalMMV1;
  readonly endParameter: ExactRationalMMV1;
  readonly startMM: ExactSplitPointV1;
  readonly endMM: ExactSplitPointV1;
}
export type ExactStraightEdgeSplitPlanV1 =
  | { readonly status: 'exact'; readonly intersectionMM: ExactSplitPointV1;
      readonly subedges: readonly [ExactSplitSubedgeV1, ExactSplitSubedgeV1, ExactSplitSubedgeV1, ExactSplitSubedgeV1] }
  | { readonly status: 'refused'; readonly reason: string }
  | { readonly status: 'unsupported'; readonly reason: string };

const buffer = new DataView(new ArrayBuffer(8));
const abs = (v: bigint) => v < 0n ? -v : v;
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  while (b) { const rem = a % b; a = b; b = rem; }
  return a;
}
function rational(n: bigint, d: bigint): ExactRationalMMV1 {
  if (d < 0n) { n = -n; d = -d; }
  const divisor = gcd(n, d);
  return { numerator: (n / divisor).toString(), denominator: (d / divisor).toString() };
}
function coordinate(v: number): ExactRationalMMV1 {
  buffer.setFloat64(0, v, false);
  const bits = buffer.getBigUint64(0, false);
  const biased = Number((bits >> 52n) & 2047n);
  const mantissa = biased === 0 ? bits & ((1n << 52n) - 1n) :
    (bits & ((1n << 52n) - 1n)) | (1n << 52n);
  const signed = (bits >> 63n) === 0n ? mantissa : -mantissa;
  const exponent = biased === 0 ? -1074 : biased - 1075;
  return exponent >= 0 ? rational(signed << BigInt(exponent), 1n) :
    rational(signed, 1n << BigInt(-exponent));
}
function point(p: Binary64PointV1): ExactSplitPointV1 {
  return { x: coordinate(p.x), y: coordinate(p.y) };
}
const zero = () => ({ numerator: '0', denominator: '1' });
const one = () => ({ numerator: '1', denominator: '1' });

/** Pure four-subedge plan; no B-Rep mutation, sewing, snapping, or invented vertex IDs. */
export function planExactStraightEdgeCrossingSplitV1(
  firstId: unknown, a: unknown, b: unknown,
  secondId: unknown, c: unknown, d: unknown,
  maxAbsCoordinateMM = 10000,
): ExactStraightEdgeSplitPlanV1 {
  if (typeof firstId !== 'string' || typeof secondId !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(firstId) ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(secondId) || firstId === secondId)
    return { status: 'unsupported', reason: 'invalid-edge-ids' };
  const result = intersectProperSegmentsExactBinary64V1(a, b, c, d, maxAbsCoordinateMM);
  if (result.status !== 'exact') return result;
  const [pa, pb, pc, pd] = [a, b, c, d] as Binary64PointV1[];
  const endpointA = point(pa), endpointB = point(pb), endpointC = point(pc), endpointD = point(pd);
  const crossing = result.pointMM;
  const segment = (id: string, t0: ExactRationalMMV1, t1: ExactRationalMMV1,
    p0: ExactSplitPointV1, p1: ExactSplitPointV1): ExactSplitSubedgeV1 =>
    ({ parentEdgeId: id, startParameter: t0, endParameter: t1, startMM: p0, endMM: p1 });
  return { status: 'exact', intersectionMM: crossing,
    subedges: [
      segment(firstId, zero(), result.parameterAB, endpointA, crossing),
      segment(firstId, result.parameterAB, one(), crossing, endpointB),
      segment(secondId, zero(), result.parameterCD, endpointC, crossing),
      segment(secondId, result.parameterCD, one(), crossing, endpointD),
    ] };
}
