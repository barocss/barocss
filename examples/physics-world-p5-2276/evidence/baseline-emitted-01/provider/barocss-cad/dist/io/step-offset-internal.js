// Private D419 admission: direct analytic offsets only. No general offset construction or repair.
import { BrepError } from '../brep/brep-core.js';
import { SectionRationalContext } from '../section-rational-internal.js';
function unavailable(_kind, detail) { throw new BrepError('INPUT', `STEP: OFFSET_SURFACE boundary proof is not supported yet (${detail})`); }
function minus(q, a, b) { return [q.sub(q.from(a[0]), q.from(b[0])), q.sub(q.from(a[1]), q.from(b[1])), q.sub(q.from(a[2]), q.from(b[2]))]; }
function vector(q, a) { return [q.from(a[0]), q.from(a[1]), q.from(a[2])]; }
function dot(q, a, b) { return q.add(q.add(q.mul(a[0], b[0]), q.mul(a[1], b[1])), q.mul(a[2], b[2])); }
function radial(q, p, n, nn) {
    const k = q.div(dot(q, p, n), nn);
    return [q.sub(p[0], q.mul(k, n[0])), q.sub(p[1], q.mul(k, n[1])), q.sub(p[2], q.mul(k, n[2]))];
}
const CHOOSE = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]];
function mismatch(face, edge) { throw new BrepError('GEOMETRY', `STEP: OFFSET_SURFACE edge ${edge} is separated from its surface (${face})`); }
function uncertain(face, edge) { throw new BrepError('INPUT', `STEP: OFFSET_SURFACE boundary ${edge} is not supported yet (analytic containment not certified for ${face})`); }
/**
 * A=literal raw axis, N=stored normalized axis, k=(N.A)/(A.A)>0, e=N-kA.
 * ||N-unit(A)|| <= L1(e)+|k²(A.A)-1| (the omitted denominator k||A||+1>=1).
 * Unit(N) adds at most |N.N-1|. Triangle bounds cover reduction and local axis error.
 * All budgets remain exact rationals and are subtracted ONCE from the declared edge tolerance.
 */
function reductionError(q, s, c, n, nn) {
    const input = s.input;
    if (!input)
        return q.rat(0n);
    const a = vector(q, input.axis), aa = dot(q, a, a), one = q.rat(1n);
    if (aa.n === 0n)
        unavailable('REPRESENTABILITY', 'zero raw offset axis');
    const k = q.div(dot(q, n, a), aa);
    if (k.n <= 0n)
        unavailable('REPRESENTABILITY', 'offset axis orientation is not represented');
    let normalError = q.rat(0n);
    for (let i = 0; i < 3; i++)
        normalError = q.add(normalError, q.abs(q.sub(n[i], q.mul(k, a[i]))));
    normalError = q.add(normalError, q.abs(q.sub(q.mul(q.mul(k, k), aa), one)));
    const axisError = q.add(normalError, q.abs(q.sub(nn, one)));
    let size = q.rat(0n);
    for (const point of c.controlPoints) {
        const v = minus(q, point, s.f.o);
        let bound = q.rat(0n);
        for (const value of v)
            bound = q.add(bound, q.abs(value));
        size = q.max(size, bound);
    }
    const distance = q.from(input.distance);
    let error = q.mul(size, axisError);
    if (s.kind === 'plane') {
        error = q.add(error, q.mul(q.abs(distance), normalError));
        for (let i = 0; i < 3; i++) {
            const ideal = q.add(q.from(input.origin[i]), q.mul(distance, n[i]));
            error = q.add(error, q.abs(q.sub(q.from(s.f.o[i]), ideal)));
        }
    }
    else
        error = q.add(error, q.abs(q.sub(q.from(s.r), q.add(q.from(input.radius), distance))));
    return error;
}
/** Raw LINE support/direction or generated conic endpoints, checked before endpoint pinning is accepted. */
export function checkOffsetSourceEndpoints(source, a, b, tolerance, face, edge) {
    const q = new SectionRationalContext(unavailable), t = q.from(tolerance), tt = q.mul(t, t);
    if (source.kind === 'line') {
        const n = vector(q, source.z), nn = dot(q, n, n);
        if (nn.n === 0n)
            uncertain(face, edge);
        for (const p of [a, b]) {
            const r = radial(q, minus(q, p, source.o), n, nn);
            if (q.compare(dot(q, r, r), tt) > 0)
                mismatch(face, edge);
        }
        const along = dot(q, minus(q, b, a), n).n;
        if (source.same ? along <= 0n : along >= 0n)
            mismatch(face, edge);
    }
    else {
        for (const [p, generated] of [[a, source.start], [b, source.end]]) {
            const d = minus(q, p, generated);
            if (q.compare(dot(q, d, d), tt) > 0)
                mismatch(face, edge);
        }
    }
}
/**
 * Certifies the actual stored binary64 rational curve against the literal analytic offset support,
 * with conservative exact normalization/reduction budgets; not samples of the source conic.
 * Plane: its positive-weight control hull stays in the tolerance slab.
 * Cylinder: homogeneous squared radial distance is bounded using Bernstein coefficients on each
 * line/quadratic Bezier span; positive W makes [max(0,R-tol)^2 W^2,(R+tol)^2 W^2] sufficient.
 * Failure to certify is capability, unless an endpoint itself proves separation. No tolerance slack.
 */
export function checkOffsetBoundary(s, c, tolerance, face, edge) {
    if (!Number.isFinite(tolerance) || tolerance < 0 || !c.controlPoints.length)
        uncertain(face, edge);
    for (const w of c.weights)
        if (!(w > 0) || !Number.isFinite(w))
            uncertain(face, edge);
    const q = new SectionRationalContext(unavailable), n = vector(q, s.f.z), nn = dot(q, n, n), raw = q.from(tolerance);
    if (nn.n === 0n)
        uncertain(face, edge);
    const error = reductionError(q, s, c, n, nn), t = q.sub(raw, error), far = q.add(raw, error);
    if (t.n < 0n)
        unavailable('REPRESENTABILITY', `OFFSET_SURFACE reduction precision exceeds declared tolerance (${face})`);
    const tt = q.mul(t, t);
    if (s.kind === 'plane') {
        const limit = q.mul(tt, nn);
        for (let i = 0; i < c.controlPoints.length; i++) {
            const d = dot(q, minus(q, c.controlPoints[i], s.f.o), n);
            if (q.compare(q.mul(d, d), limit) > 0) {
                if ((i === 0 || i === c.controlPoints.length - 1) && q.compare(q.mul(d, d), q.mul(q.mul(far, far), nn)) > 0)
                    mismatch(face, edge);
                uncertain(face, edge);
            }
        }
        return;
    }
    const degree = c.degree;
    if (degree !== 1 && degree !== 2 || degree === 1 && c.controlPoints.length !== 2 || degree === 2 && c.controlPoints.length % 2 !== 1)
        uncertain(face, edge);
    const r = q.from(s.r), low = q.compare(r, t) > 0 ? q.sub(r, t) : q.rat(0n), high = q.add(r, t), lo2 = q.mul(low, low), hi2 = q.mul(high, high);
    const farLow = q.compare(r, far) > 0 ? q.sub(r, far) : q.rat(0n), farHigh = q.add(r, far), farLo2 = q.mul(farLow, farLow), farHi2 = q.mul(farHigh, farHigh);
    for (const i of [0, c.controlPoints.length - 1]) {
        const p = radial(q, minus(q, c.controlPoints[i], s.f.o), n, nn), d2 = dot(q, p, p);
        if (q.compare(d2, farLo2) < 0 || q.compare(d2, farHi2) > 0)
            mismatch(face, edge);
        if (q.compare(d2, lo2) < 0 || q.compare(d2, hi2) > 0)
            uncertain(face, edge);
    }
    for (let start = 0; start + degree < c.controlPoints.length; start += degree) {
        const p = [], w = [];
        for (let i = 0; i <= degree; i++) {
            const weight = q.from(c.weights[start + i]), v = radial(q, minus(q, c.controlPoints[start + i], s.f.o), n, nn);
            p.push([q.mul(v[0], weight), q.mul(v[1], weight), q.mul(v[2], weight)]);
            w.push(weight);
        }
        for (let k = 0; k <= 2 * degree; k++) {
            let rr = q.rat(0n), ww = q.rat(0n);
            for (let i = Math.max(0, k - degree); i <= Math.min(degree, k); i++) {
                const j = k - i, factor = q.rat(BigInt(CHOOSE[degree][i] * CHOOSE[degree][j]), BigInt(CHOOSE[2 * degree][k]));
                rr = q.add(rr, q.mul(factor, dot(q, p[i], p[j])));
                ww = q.add(ww, q.mul(factor, q.mul(w[i], w[j])));
            }
            if (q.compare(rr, q.mul(lo2, ww)) < 0 || q.compare(rr, q.mul(hi2, ww)) > 0)
                uncertain(face, edge);
        }
    }
}
