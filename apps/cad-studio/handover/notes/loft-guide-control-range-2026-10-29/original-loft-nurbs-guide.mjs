// CG1.3: one polynomial B-spline seam guide on two to eight parallel height sections.
// Let h(λ) = (Gz(λ) - Gz(0)) / (Gz(1) - Gz(0)). Then
//   S(u, λ) = (1 - h(λ)) a(u) + h(λ) b(u) + G(λ) - (1 - h(λ)) G(0) - h(λ) G(1).
// Height is a linear combination of the guide's basis functions. Its control values therefore lift the ruled
// chord into that same basis exactly, even when the guide's height is not linear in its parameter. Strictly
// increasing control heights keep distinct translated ruled slices at distinct heights.
import { BrepError } from '../brep/brep-core.js';
import { evaluateCurve, validateCurve } from '../core/math.js';
import { evaluateCurveD1 } from '../core/derivatives.js';
import { insertCurveKnotCoefficientsTrusted } from '../nurbs/curves/curve-knot-insertion.js';
import { ExtrudedProfileLimits } from './extruded-profile-solid.js';
const fail = (detail) => { throw new BrepError('INPUT', `loft: guide ${detail}`); };
/**
 * The guide admitted against the sections' heights `z` (strictly increasing) and cut into one piece a span. Its ends
 * must lie at the bottom and top heights (within `tol`); the points where it crosses each section's plane are returned
 * for the loft to find the vertex there.
 */
export function admitNurbsGuide(value, z, tol) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return fail('must be one guide object');
    const g = value;
    const keys = Object.keys(g).sort().join(',');
    if (keys !== 'controlPoints,degree,kind,knots')
        return fail('needs exactly kind nurbs, degree, knots and controlPoints');
    const p = g.degree;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 1 || p > 5)
        return fail('degree must be a whole number from 1 to 5');
    if (!Array.isArray(g.controlPoints) || g.controlPoints.length < p + 1 || g.controlPoints.length > 64)
        return fail(`needs ${p + 1} to 64 control points`);
    const P = g.controlPoints.map((q, i) => {
        if (!Array.isArray(q) || q.length !== 3 || !q.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= ExtrudedProfileLimits.coordinateMM))
            return fail(`controlPoints[${i}] must be three finite numbers within the coordinate range`);
        return [q[0], q[1], q[2]];
    });
    const n = P.length;
    if (!Array.isArray(g.knots) || g.knots.length !== n + p + 1 || !g.knots.every(x => typeof x === 'number' && Number.isFinite(x)))
        return fail(`needs ${n + p + 1} finite knots (control points + degree + 1)`);
    const U = [...g.knots];
    for (let i = 1; i < U.length; i++)
        if (!(U[i] >= U[i - 1]))
            return fail('knots must not decrease');
    for (let i = 1; i <= p; i++)
        if (U[i] !== U[0] || U[U.length - 1 - i] !== U[U.length - 1])
            return fail(`must be clamped: ${p + 1} equal knots at each end`);
    if (!(U[U.length - 1] > U[0]))
        return fail('knots must span a positive range');
    for (let i = p + 1; i < n; i++) {
        let m = 1;
        while (i + m < n && U[i + m] === U[i])
            m++;
        if (m > p)
            return fail(`an interior knot repeats more than ${p} times`);
    }
    // Its height rises strictly: each control point above the one before (so its derivative's control points are positive).
    for (let i = 1; i < n; i++)
        if (!(P[i][2] > P[i - 1][2]))
            return fail(`must rise along the sections' normal: controlPoints[${i}] is not above controlPoints[${i - 1}]`);
    const curve = { kind: 'curve', id: 'guide', degree: p, knots: U, controlPoints: P, weights: Array(n).fill(1) };
    try {
        validateCurve(curve);
    }
    catch (e) {
        return fail(`is not a valid curve (${e.message})`);
    }
    const K = z.length - 1, a = U[0], b = U[U.length - 1];
    if (Math.abs(P[0][2] - z[0]) > tol)
        return fail(`must start on the bottom section (z ${z[0]}), not at z ${P[0][2]}`);
    if (Math.abs(P[n - 1][2] - z[K]) > tol)
        return fail(`must end on the top section (z ${z[K]}), not at z ${P[n - 1][2]}`);
    // The parameters where it crosses the inner sections' planes (its height is monotone: bisection).
    const t = [a];
    for (let k = 1; k < K; k++) {
        // (A knot the guide reaches the section's height at is taken as it is: bisected, the crossing landed an ulp beside
        // it, and the cut there left the next span a piece of zero length.)
        const atKnot = [...new Set(U)].find(u => u > t[k - 1] && u < b && Math.abs(evaluateCurve(curve, u)[2] - z[k]) <= tol);
        if (atKnot !== undefined) {
            t.push(atKnot);
            continue;
        }
        let lo = t[k - 1], hi = b;
        for (let it = 0; it < 200 && hi - lo > 0; it++) {
            const m = lo + (hi - lo) / 2;
            if (m <= lo || m >= hi)
                break;
            if (evaluateCurve(curve, m)[2] < z[k])
                lo = m;
            else
                hi = m;
        }
        const tk = Math.abs(evaluateCurve(curve, lo)[2] - z[k]) <= Math.abs(evaluateCurve(curve, hi)[2] - z[k]) ? lo : hi;
        if (!(tk > t[k - 1] && tk < b))
            return fail(`does not cross section ${k} between its neighbours`);
        t.push(tk);
    }
    t.push(b);
    // Cut it at each inner crossing (the knot raised to the degree's multiplicity), then each piece onto [0, 1].
    const spans = [], through = [P[0]];
    let rest = curve;
    for (let k = 0; k < K; k++) {
        let piece = rest;
        if (k < K - 1) {
            const tk = t[k + 1], have = rest.knots.filter(x => x === tk).length;
            const cut = have < p ? insertCurveKnotCoefficientsTrusted(rest, tk, p - have).candidate : rest, V = cut.knots;
            const r = V.indexOf(tk);
            piece = { ...cut, knots: [...V.slice(0, r + p), tk], controlPoints: cut.controlPoints.slice(0, r), weights: cut.weights.slice(0, r) };
            rest = { ...cut, knots: [tk, ...V.slice(r)], controlPoints: cut.controlPoints.slice(r - 1), weights: cut.weights.slice(r - 1) };
            through.push(cut.controlPoints[r - 1]);
        }
        else
            through.push(P[n - 1]);
        spans.push(spanOf(piece, t[k], t[k + 1]));
    }
    return { spans, through };
}
/** One piece on [t0, t1] as a span on λ in [0, 1]. */
function spanOf(c, t0, t1) {
    const p = c.degree, d = t1 - t0, knots = c.knots.map((x, i) => (i <= p ? 0 : i >= c.knots.length - 1 - p ? 1 : (x - t0) / d));
    const Q = c.controlPoints, m = Q.length, unit = { kind: 'curve', id: 'guide-span', degree: p, knots, controlPoints: Q, weights: Array(m).fill(1) };
    const start = Q[0], end = Q[m - 1];
    return {
        degree: p, knots, start, end,
        controls: (lo, hi) => controlsAtHeight(Q, start, end, lo, hi),
        offset: l => offsetAtHeight(unit, start, end, l),
        height: l => evaluateCurve(unit, l)[2],
        rise: l => evaluateCurveD1(unit, l).derivative[2],
        breaks: [...new Set(knots)],
    };
}
/** Lift a ruling with the guide's height coefficients, without per-control callback allocation. */
function controlsAtHeight(points, start, end, lo, hi) {
    const result = [], height = end[2] - start[2];
    for (let i = 0; i < points.length; i++) {
        if (i === 0) {
            result.push(lo);
            continue;
        }
        if (i === points.length - 1) {
            result.push(hi);
            continue;
        }
        const q = points[i], a = (q[2] - start[2]) / height, b = 1 - a;
        result.push([q[0] + b * (lo[0] - start[0]) + a * (hi[0] - end[0]), q[1] + b * (lo[1] - start[1]) + a * (hi[1] - end[1]), q[2] + b * (lo[2] - start[2]) + a * (hi[2] - end[2])]);
    }
    return result;
}
function offsetAtHeight(curve, start, end, parameter) {
    const q = evaluateCurve(curve, parameter), a = (q[2] - start[2]) / (end[2] - start[2]), b = 1 - a;
    return [q[0] - b * start[0] - a * end[0], q[1] - b * start[1] - a * end[1], 0];
}
