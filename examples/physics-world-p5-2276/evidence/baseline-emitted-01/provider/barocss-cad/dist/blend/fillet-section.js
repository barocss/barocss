// R10.1 (D88): a fillet's cross-section where its two faces are lines or circles in the section — the translational
// case (planes along the edge, cylinders whose axis runs along it: the section square to the edge) and the coaxial
// case (surfaces of revolution about the edge's circle's axis: the meridian section). The rolling ball's centre is
// where the two curves offset by r towards the corner meet, its contacts the centre's feet on the curves (exact:
// lines and circles offset to lines and circles). The tool is the region between the faces and the fillet arc,
// grown by g outside the corner along the faces' own outward offsets (exact lines and concentric arcs), so no
// tool face lies on a face of the body and the growth stays on the faces' far side however they curve.
import { BrepError } from '../brep/brep-core.js';
const KIND = { TANGENT_FACES: 'SELECTION', RADIUS_EXCEEDS_FACE: 'PARAMETER', RADIUS_EXCEEDS_CURVATURE: 'PARAMETER', NOT_ANALYTIC_PAIR: 'CAPABILITY', CONTACT_LEAVES_FACE: 'PARAMETER', APPROX_TOLERANCE_NOT_MET: 'CAPABILITY' };
/** A typed refusal: `B-rep: <SELECTION|CAPABILITY|PARAMETER>: [<code>] <detail>` (finishEdges maps it to the part error). */
export const refuseFillet = (code, detail) => { throw new BrepError(KIND[code] === 'PARAMETER' ? 'INPUT' : 'GEOMETRY', `${KIND[code]}: [${code}] ${detail}`); };
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const at2 = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit2 = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** +1 when the side's outward normal at X points away from its circle's centre, −1 towards it; 0 for a line. */
function outwardOf(s, X) {
    return s.curve.kind === 'line' ? 0 : Math.sign(dot2(s.n, sub2(X, s.curve.c)));
}
/** The side's curve moved k along its outward normal (k < 0: inward), or null when a circle shrinks to nothing. */
function offsetCurve(s, tau, k) {
    if (s.curve.kind === 'line')
        return { kind: 'line', p: at2(s.curve.p, s.n, k), d: s.curve.d };
    const r = s.curve.r + tau * k;
    return r > 0 ? { kind: 'circle', c: s.curve.c, r } : null;
}
/** Where two section curves meet (lines whole, circles whole). */
function meet(a, b) {
    if (a.kind === 'line' && b.kind === 'line') {
        const det = cross2(a.d, b.d);
        if (Math.abs(det) < 1e-14)
            return [];
        return [at2(a.p, a.d, cross2(sub2(b.p, a.p), b.d) / det)];
    }
    if (a.kind === 'circle' && b.kind === 'line')
        return meet(b, a);
    if (a.kind === 'line' && b.kind === 'circle') {
        const f = at2(a.p, a.d, dot2(sub2(b.c, a.p), a.d)), h2 = b.r * b.r - dot2(sub2(b.c, f), sub2(b.c, f));
        if (h2 < -1e-12 * b.r * b.r)
            return [];
        const h = Math.sqrt(Math.max(0, h2));
        return h === 0 ? [f] : [at2(f, a.d, -h), at2(f, a.d, h)];
    }
    const A = a, B = b;
    const D = dist2(A.c, B.c);
    if (D < 1e-14 * Math.max(A.r, B.r))
        return [];
    const x = (D * D + A.r * A.r - B.r * B.r) / (2 * D), h2 = A.r * A.r - x * x;
    if (h2 < -1e-12 * A.r * A.r)
        return [];
    const e = unit2(sub2(B.c, A.c)), f = at2(A.c, e, x), h = Math.sqrt(Math.max(0, h2)), m = [-e[1], e[0]];
    return h === 0 ? [f] : [at2(f, m, -h), at2(f, m, h)];
}
/** The point of the side's curve nearest y (a circle's in y's direction from its centre). */
function footOn(c, y) {
    if (c.kind === 'line')
        return at2(c.p, c.d, dot2(sub2(y, c.p), c.d));
    return at2(c.c, unit2(sub2(y, c.c)), c.r);
}
/** The side's outward normal at a point of its curve. */
function normalAt(s, tau, y) {
    if (s.curve.kind === 'line')
        return s.n;
    const u = unit2(sub2(y, s.curve.c));
    return [u[0] * tau, u[1] * tau];
}
/** The short way about c from a to b. */
const shortWay = (c, a, b) => cross2(sub2(a, c), sub2(b, c)) > 0 ? 'ccw' : 'cw';
/** The segment from `start` along the curve (a line, or an arc of a circle the short way) to the next segment's start. */
function along(c, start, end) {
    return c.kind === 'line' ? { kind: 'line', start } : { kind: 'arc', start, center: c.c, direction: shortWay(c.c, start, end) };
}
/** Of points, the one nearest X (or null). */
function nearest(points, X) {
    let best = null, d = Infinity;
    for (const p of points) {
        const e = dist2(p, X);
        if (e < d) {
            d = e;
            best = p;
        }
    }
    return best;
}
/**
 * The fillet of radius r between two sides meeting at X, its tool grown by g outside the corner (g is reduced
 * where a face's outward offset would shrink a circle past half its radius). `scale` sets the tolerances.
 */
export function filletSection(X, s1, s2, r, g, name, scale) {
    if (dot2(s1.w, s2.w) < -1 + 1e-9)
        refuseFillet('TANGENT_FACES', `edge ${name}: its faces meet tangentially; there is no corner to finish`);
    const convex = dot2(s2.w, s1.n) < 0, sigma = convex ? -1 : 1, tau1 = outwardOf(s1, X), tau2 = outwardOf(s2, X), sides = [s1, s2], taus = [tau1, tau2];
    // The ball's centre: r from both faces on the corner's side.
    const o1 = offsetCurve(s1, tau1, sigma * r), o2 = offsetCurve(s2, tau2, sigma * r);
    for (const [k, o] of [o1, o2].entries())
        if (!o) {
            const c = sides[k].curve;
            refuseFillet('RADIUS_EXCEEDS_CURVATURE', `edge ${name}: a fillet of ${r} mm does not fit inside the ${+c.r.toFixed(6)} mm radius of face ${k + 1}`);
        }
    // Of the centres, those whose contacts lie ahead of X on both faces; the nearest.
    const tol = 1e-9 * scale, ahead = (C) => sides.every(s => dot2(sub2(footOn(s.curve, C), X), s.w) > -tol);
    const C = nearest(meet(o1, o2).filter(ahead), X);
    if (!C)
        refuseFillet('RADIUS_EXCEEDS_CURVATURE', `edge ${name}: no ball of ${r} mm touches both faces at this edge`);
    const T1 = footOn(s1.curve, C), T2 = footOn(s2.curve, C);
    // The growth, outside the corner: no circle shrunk past half its radius.
    for (const [k, s] of sides.entries())
        if (s.curve.kind === 'circle' && taus[k] * -sigma < 0)
            g = Math.min(g, s.curve.r / 2);
    let O = null, g1 = null, g2 = null;
    for (let tries = 0; tries < 8 && !O; tries++) {
        g1 = offsetCurve(s1, tau1, -sigma * g);
        g2 = offsetCurve(s2, tau2, -sigma * g);
        O = g1 && g2 ? nearest(meet(g1, g2), X) : null;
        if (!O)
            g /= 2;
    }
    if (!O)
        throw new BrepError('GEOMETRY', `edge ${name}: the fillet tool's grown corner was not found`);
    const T1o = at2(T1, normalAt(s1, tau1, T1), -sigma * g), T2o = at2(T2, normalAt(s2, tau2, T2), -sigma * g);
    // The fillet arc from T2 back to T1, the way past X's side.
    const ang = (p) => Math.atan2(p[1] - C[1], p[0] - C[0]), TAU = 2 * Math.PI;
    const sweep = ((ang(T1) - ang(T2)) % TAU + TAU) % TAU, mid = ((ang(X) - ang(T2)) % TAU + TAU) % TAU;
    const profile = [
        { kind: 'line', start: T1 }, along(g1, T1o, O), along(g2, O, T2o), { kind: 'line', start: T2o },
        { kind: 'arc', start: T2, center: C, direction: mid < sweep ? 'ccw' : 'cw' },
    ];
    return { profile, tags: ['t0', 't1', 't2', 't3', 'f'], centre: C, contacts: [T1, T2], convex, g };
}
/** How far a point lies into a side from X, along its curve: a line's distance along w, a circle's angle towards w (0 to 2π). */
export function acrossOf(s, X, y) {
    if (s.curve.kind === 'line')
        return dot2(sub2(y, X), s.w);
    const a = sub2(X, s.curve.c), b = sub2(y, s.curve.c), dir = Math.sign(cross2(a, s.w)) || 1;
    const t = Math.atan2(cross2(a, b), dot2(a, b)) * dir, TAU = 2 * Math.PI;
    return ((t % TAU) + TAU) % TAU;
}
