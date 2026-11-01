import { intersectProperSegmentsExactBinary64V1 } from './exact-segment-intersection-point-v1.js';
import { snapshotExactSegments } from './exact-segment-snapshot-internal.js';
const buffer = new DataView(new ArrayBuffer(8));
const abs = (v) => v < 0n ? -v : v;
function gcd(a, b) {
    a = abs(a);
    b = abs(b);
    while (b) {
        const rem = a % b;
        a = b;
        b = rem;
    }
    return a;
}
function rational(n, d) {
    if (d < 0n) {
        n = -n;
        d = -d;
    }
    const divisor = gcd(n, d);
    return { numerator: (n / divisor).toString(), denominator: (d / divisor).toString() };
}
function coordinate(v) {
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
function point(p) {
    return { x: coordinate(p.x), y: coordinate(p.y) };
}
const zero = () => ({ numerator: '0', denominator: '1' });
const one = () => ({ numerator: '1', denominator: '1' });
/** Pure four-subedge plan; no B-Rep mutation, sewing, snapping, or invented vertex IDs. */
export function planExactStraightEdgeCrossingSplitV1(firstId, a, b, secondId, c, d, maxAbsCoordinateMM = 10000) {
    if (typeof firstId !== 'string' || typeof secondId !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(firstId) ||
        !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(secondId) || firstId === secondId)
        return { status: 'unsupported', reason: 'invalid-edge-ids' };
    // Read the caller's points once: the crossing and the subedge endpoints come from the same snapshot,
    // so a Proxy or accessor cannot hand the intersection one point and the plan another.
    const admitted = snapshotExactSegments(a, b, c, d, maxAbsCoordinateMM);
    if (admitted.reason)
        return { status: 'unsupported', reason: admitted.reason };
    const [pa, pb, pc, pd] = admitted.points;
    const result = intersectProperSegmentsExactBinary64V1(pa, pb, pc, pd, maxAbsCoordinateMM);
    if (result.status !== 'exact')
        return result;
    const endpointA = point(pa), endpointB = point(pb), endpointC = point(pc), endpointD = point(pd);
    const crossing = result.pointMM;
    const segment = (id, t0, t1, p0, p1) => ({ parentEdgeId: id, startParameter: t0, endParameter: t1, startMM: p0, endMM: p1 });
    return { status: 'exact', intersectionMM: crossing,
        subedges: [
            segment(firstId, zero(), result.parameterAB, endpointA, crossing),
            segment(firstId, result.parameterAB, one(), crossing, endpointB),
            segment(secondId, zero(), result.parameterCD, endpointC, crossing),
            segment(secondId, result.parameterCD, one(), crossing, endpointD),
        ] };
}
