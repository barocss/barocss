import { arcCurve, extrudedProfile } from './gear.js';
import { isFrom, kernelRefusal } from '../core/barocss-error.js';
export const CAM_LAWS = ['uniform', 'harmonic', 'cycloidal', 'polynomial-345', 'modified-trapezoid'];
/** This module's refusal (R7.3a batch 2: the CamError class folded, D279): a BarocssError, `details.source` 'cam'. */
export const camError = (code, detail) => kernelRefusal('cam', code, `cam: ${detail}`);
/** Whether something thrown is this module's refusal. */
export const isCamError = (e) => isFrom(e, 'cam');
const fail = (code, detail) => { throw camError(code, detail); };
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const deg = (x) => x * 180 / Math.PI;
const r6 = (x) => +x.toFixed(6);
const MT_A = 8 * Math.PI / (Math.PI + 2), W4 = 4 * Math.PI;
/** The modified trapezoid on u ∈ [0, 1/2]: [f, f', f'']. */
function mtHalf(u) {
    if (u <= 1 / 8)
        return [MT_A / W4 * (u - Math.sin(W4 * u) / W4), MT_A / W4 * (1 - Math.cos(W4 * u)), MT_A * Math.sin(W4 * u)];
    const f1 = MT_A / W4 * (1 / 8 - 1 / W4), v1 = MT_A / W4;
    if (u <= 3 / 8) {
        const w = u - 1 / 8;
        return [f1 + v1 * w + MT_A * w * w / 2, v1 + MT_A * w, MT_A];
    }
    const w = u - 3 / 8, f2 = f1 + v1 / 4 + MT_A / 32, v2 = v1 + MT_A / 4;
    return [f2 + v2 * w + MT_A * (1 - Math.cos(W4 * w)) / (W4 * W4), v2 + MT_A * Math.sin(W4 * w) / W4, MT_A * Math.cos(W4 * w)];
}
/** The law's f, f', f'' at u ∈ [0, 1]. */
export function camLaw(law, u) {
    switch (law) {
        case 'uniform': return [u, 1, 0];
        case 'harmonic': return [(1 - Math.cos(Math.PI * u)) / 2, Math.PI / 2 * Math.sin(Math.PI * u), Math.PI * Math.PI / 2 * Math.cos(Math.PI * u)];
        case 'cycloidal': return [u - Math.sin(2 * Math.PI * u) / (2 * Math.PI), 1 - Math.cos(2 * Math.PI * u), 2 * Math.PI * Math.sin(2 * Math.PI * u)];
        case 'polynomial-345': return [u * u * u * (10 - 15 * u + 6 * u * u), 30 * u * u * (1 - u) * (1 - u), 60 * u - 180 * u * u + 120 * u * u * u];
        case 'modified-trapezoid': {
            if (u <= 0.5)
                return mtHalf(u);
            const [f, f1, f2] = mtHalf(1 - u);
            return [1 - f, f1, -f2];
        }
    }
}
/**
 * The law's peak velocity and acceleration coefficients (Cv = max f', Ca = max |f''|), from the forms above: harmonic π/2
 * and π²/2 (at u = 0); cycloidal 2 and 2π (u = 1/4); 3-4-5 15/8 and 10/√3 (f''' = 0 at u = (3 − √3)/6); the modified
 * trapezoid 2 and 8π/(π + 2); uniform 1 and ∞ (its ends).
 */
export function camLawPeaks(law) {
    switch (law) {
        case 'uniform': return { cv: 1, ca: Infinity };
        case 'harmonic': return { cv: Math.PI / 2, ca: Math.PI * Math.PI / 2 };
        case 'cycloidal': return { cv: 2, ca: 2 * Math.PI };
        case 'polynomial-345': return { cv: 15 / 8, ca: 10 / Math.sqrt(3) };
        case 'modified-trapezoid': return { cv: 2, ca: MT_A };
    }
}
/** The program as segments (θ in radians, positions in the program's units scaled by `k`: 1 for mm, π/180 for degrees). */
function program(spec, k) {
    const list = spec.segments;
    if (!Array.isArray(list) || list.length < 2)
        fail('INVALID_INPUT', 'segments must list at least two motions (a rise and a return)');
    let at = 0, pos = 0;
    const out = [];
    list.forEach((g, i) => {
        if (!(num(g.angle) && g.angle > 0))
            fail('INVALID_INPUT', `segment ${i + 1}: angle must be a number of degrees above 0`);
        if (g.to !== undefined && !num(g.to))
            fail('INVALID_INPUT', `segment ${i + 1}: to must be a number`);
        if (g.to !== undefined && g.to < 0)
            fail('INVALID_INPUT', `segment ${i + 1}: to ${g.to} below 0 — the follower never goes below its rest on the base circle`);
        const to = g.to === undefined ? pos : g.to * k, moves = Math.abs(to - pos) > 1e-12;
        if (moves && (g.law === undefined || !CAM_LAWS.includes(g.law)))
            fail('INVALID_INPUT', `segment ${i + 1}: a motion needs a law (${CAM_LAWS.join(', ')})`);
        if (g.law !== undefined && !CAM_LAWS.includes(g.law))
            fail('INVALID_INPUT', `segment ${i + 1}: law ${String(g.law)} is not one of ${CAM_LAWS.join(', ')}`);
        const a = at, b = at + g.angle * Math.PI / 180;
        out.push({ a, b, p0: pos, p1: to, ...(moves ? { law: g.law } : {}), motion: !moves ? 'dwell' : to > pos ? 'rise' : 'return' });
        at = b;
        pos = to;
    });
    if (Math.abs(at - 2 * Math.PI) > 1e-9)
        fail('INVALID_INPUT', `the segments turn the cam ${r6(deg(at))}°, not 360°`);
    if (Math.abs(pos) > 1e-12)
        fail('INVALID_INPUT', `the program ends at ${r6(pos / k)}, not back at 0`);
    if (!out.some(s => s.motion !== 'dwell'))
        fail('INVALID_INPUT', 'the program never moves the follower');
    return out;
}
/** s, s', s'' on segment `g` at θ (inside it). */
function segMotion(g, th) {
    if (!g.law)
        return [g.p0, 0, 0];
    const be = g.b - g.a, d = g.p1 - g.p0, [f, f1, f2] = camLaw(g.law, Math.min(1, Math.max(0, (th - g.a) / be)));
    return [g.p0 + d * f, d * f1 / be, d * f2 / (be * be)];
}
const J = (v) => [-v[1], v[0]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
/** The world turned back into the cam's frame: Rot(−θ). */
const back = (v, th) => { const c = Math.cos(th), s = Math.sin(th); return [c * v[0] + s * v[1], -s * v[0] + c * v[1]]; };
function geometry(spec, motion, segs) {
    const rb = spec.baseRadius, k = motion === 'oscillating' ? Math.PI / 180 : 1;
    if (spec.follower === 'roller') {
        const rr = spec.rollerRadius;
        if (!(num(rr) && rr > 0))
            fail('INVALID_INPUT', 'rollerRadius must be a number of mm above 0');
        const Rp = rb + rr;
        const point = (C, C1, C2, u, th) => {
            const Q1 = [C1[0] + C[1], C1[1] - C[0]], JC1 = J(C1), Q2 = [C2[0] - 2 * JC1[0] - C[0], C2[1] - 2 * JC1[1] - C[1]];
            const q = Math.hypot(Q1[0], Q1[1]), kap = cross(Q1, Q2) / (q * q * q), n = [-Q1[1] / q, Q1[0] / q];
            const Kw = [C[0] - rr * n[0], C[1] - rr * n[1]], g = 1 + rr * kap;
            return { K: back(Kw, th), dK: back([Q1[0] * g, Q1[1] * g], th), rho: kap < 0 ? -1 / kap - rr : Infinity, pitchRho: kap < 0 ? -1 / kap : Infinity, phi: Math.atan2(cross(u, n), dot(u, n)) };
        };
        if (motion === 'translating') {
            const e = spec.offset ?? 0;
            if (!num(e))
                fail('INVALID_INPUT', 'offset must be a number of mm');
            if (!(Math.abs(e) < Rp))
                fail('INVALID_INPUT', `an offset of ${e} mm reaches past the prime circle (R ${r6(Rp)} = base + roller)`);
            const d = Math.sqrt(Rp * Rp - e * e);
            return {
                at: (g, th) => { const [s, s1, s2] = segMotion(g, th); return point([e, d + s], [0, s1], [0, s2], [0, 1], th); },
                roller: p => [e, d + p], convexStep: (_p, dv) => dv < 0, units: 'mm', k, mmPerUnit: 1,
                report: { rollerRadius: rr, primeRadius: r6(Rp), offset: e },
            };
        }
        const a = spec.pivotDistance, l = spec.armLength;
        if (!(num(a) && a > 0) || !(num(l) && l > 0))
            fail('INVALID_INPUT', 'an oscillating roller follower needs pivotDistance and armLength, numbers of mm above 0');
        const c0 = (a * a + l * l - Rp * Rp) / (2 * a * l);
        if (!(c0 > -1 && c0 < 1))
            fail('INVALID_INPUT', `an arm of ${l} mm about a pivot ${a} mm off the centre never reaches the prime circle (R ${r6(Rp)})`);
        const psi0 = Math.acos(c0), top = Math.max(...segs().map(g => g.p1));
        if (!(psi0 + top < Math.PI))
            fail('INVALID_INPUT', `the arm swings past the line of centres (ψ0 ${r6(deg(psi0))}° + ${r6(deg(top))}° ≥ 180°)`);
        return {
            at: (g, th) => {
                const [s, s1, s2] = segMotion(g, th), ps = psi0 + s, sn = Math.sin(ps), cs = Math.cos(ps);
                return point([a - l * cs, l * sn], [l * s1 * sn, l * s1 * cs], [l * (s2 * sn + s1 * s1 * cs), l * (s2 * cs - s1 * s1 * sn)], [sn, cs], th);
            },
            roller: p => [a - l * Math.cos(psi0 + p), l * Math.sin(psi0 + p)], convexStep: (_p, dv) => dv < 0, units: 'deg', k, mmPerUnit: l * Math.PI / 180,
            report: { rollerRadius: rr, primeRadius: r6(Rp), pivotDistance: a, armLength: l, restAngle: r6(deg(psi0)) },
        };
    }
    if (spec.follower !== 'flat')
        fail('INVALID_INPUT', `follower ${String(spec.follower)} is not roller or flat`);
    if (spec.rollerRadius !== undefined)
        fail('INVALID_INPUT', 'a flat-faced follower has no roller');
    // The envelope of the face's lines in the cam's frame (support function h at angle β, both of θ).
    const envelope = (h, h1, h2, be, b1, b2, nw, w, A) => {
        const hb = h1 / b1, hbb = (h2 * b1 - h1 * b2) / (b1 * b1 * b1), rho = h + hbb, m = [Math.cos(be), Math.sin(be)], Jm = J(m);
        const Kw = [h * nw[0] + hb * -nw[1], h * nw[1] + hb * nw[0]];
        const ww = A ? [Kw[1] - A[1], -(Kw[0] - A[0])] : w;
        // (Along the face: from the follower's line, translating; from the pivot along the arm, oscillating.)
        const along = A ? dot(J(nw), [Kw[0] - A[0], Kw[1] - A[1]]) : Kw[0] - (spec.offset ?? 0);
        return { K: [h * m[0] + hb * Jm[0], h * m[1] + hb * Jm[1]], dK: [rho * b1 * Jm[0], rho * b1 * Jm[1]], rho: b1 < 0 ? rho : -Infinity, phi: Math.atan2(cross(ww, nw), dot(ww, nw)), along };
    };
    if (motion === 'translating') {
        const e = spec.offset ?? 0;
        if (!num(e))
            fail('INVALID_INPUT', 'offset must be a number of mm');
        return {
            at: (g, th) => { const [s, s1, s2] = segMotion(g, th); return envelope(rb + s, s1, s2, Math.PI / 2 - th, -1, 0, [0, 1], [0, 1], null); },
            face: p => ({ n: [0, 1], h: rb + p }), convexStep: (_p, dv) => dv < 0, units: 'mm', k, mmPerUnit: 1, report: { offset: e },
        };
    }
    const a = spec.pivotDistance, c = spec.faceOffset ?? 0;
    if (!(num(a) && a > 0))
        fail('INVALID_INPUT', 'an oscillating flat-faced follower needs pivotDistance, a number of mm above 0');
    if (!num(c))
        fail('INVALID_INPUT', 'faceOffset must be a number of mm');
    const s0 = (rb + c) / a;
    if (!(s0 > 0 && s0 < 1))
        fail('INVALID_INPUT', `a face ${c} mm from a pivot ${a} mm off the centre never touches the base circle (sin ψ0 = (r_b + c)/a = ${r6(s0)})`);
    const psi0 = Math.asin(s0), top = Math.max(...segs().map(g => g.p1));
    if (!(psi0 + top < Math.PI / 2))
        fail('INVALID_INPUT', `the arm swings past square to the line of centres (ψ0 ${r6(deg(psi0))}° + ${r6(deg(top))}° ≥ 90°)`);
    const A = [a, 0];
    return {
        at: (g, th) => {
            const [s, s1, s2] = segMotion(g, th), ps = psi0 + s, sn = Math.sin(ps), cs = Math.cos(ps);
            return envelope(a * sn - c, a * cs * s1, a * (cs * s2 - sn * s1 * s1), Math.PI / 2 - ps - th, -(1 + s1), -s2, [sn, cs], [0, 0], A);
        },
        face: p => ({ n: [Math.sin(psi0 + p), Math.cos(psi0 + p)], h: a * Math.sin(psi0 + p) - c }),
        // (The sweep's deviation in mm: the arm's angle at the pivot's distance.)
        convexStep: (p, dv) => dv * Math.cos(psi0 + p) < 0, units: 'deg', k, mmPerUnit: a * Math.PI / 180,
        report: { pivotDistance: a, faceOffset: c, restAngle: r6(deg(psi0)) },
    };
}
/** The cubic Bézier through Hermite data over [θa, θb]. */
function hermite(A, B, h) {
    return [A.K, [A.K[0] + h * A.dK[0], A.K[1] + h * A.dK[1]], [B.K[0] - h * B.dK[0], B.K[1] - h * B.dK[1]], B.K];
}
function bez(P, t) {
    const m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
}
/** The extreme of `f` over a segment: dense samples, then golden-section about the best. */
function extreme(f, a, b, n) {
    let best = -Infinity, bi = 0;
    for (let i = 0; i <= n; i++) {
        const v = f(a + (b - a) * i / n);
        if (v > best) {
            best = v;
            bi = i;
        }
    }
    let lo = a + (b - a) * Math.max(0, bi - 1) / n, hi = a + (b - a) * Math.min(n, bi + 1) / n;
    const gr = (Math.sqrt(5) - 1) / 2;
    let x1 = hi - gr * (hi - lo), x2 = lo + gr * (hi - lo), f1 = f(x1), f2 = f(x2);
    for (let i = 0; i < 60; i++) {
        if (f1 >= f2) {
            hi = x2;
            x2 = x1;
            f2 = f1;
            x1 = hi - gr * (hi - lo);
            f1 = f(x1);
        }
        else {
            lo = x1;
            x1 = x2;
            f1 = f2;
            x2 = lo + gr * (hi - lo);
            f2 = f(x2);
        }
    }
    const xm = (lo + hi) / 2, vm = f(xm);
    return vm >= best ? { value: vm, at: xm } : { value: best, at: a + (b - a) * bi / n };
}
/** The profile's pieces (counter-clockwise round the cam), the bore's, and the report. */
export function camProfile(spec) {
    const rb = spec.baseRadius;
    if (!(num(rb) && rb > 0))
        fail('INVALID_INPUT', 'baseRadius must be a number of mm above 0');
    if (!(num(spec.thickness) && spec.thickness > 0))
        fail('INVALID_INPUT', 'thickness must be a number of mm above 0');
    const motion = spec.motion ?? 'translating';
    if (motion !== 'translating' && motion !== 'oscillating')
        fail('INVALID_INPUT', `motion ${String(motion)} is not translating or oscillating`);
    if (spec.follower === 'roller' && spec.faceOffset !== undefined)
        fail('INVALID_INPUT', 'a roller follower has no face offset');
    if (motion === 'translating' && (spec.pivotDistance !== undefined || spec.armLength !== undefined || spec.faceOffset !== undefined))
        fail('INVALID_INPUT', 'a pivot, an arm and a face offset belong to an oscillating follower');
    if (motion === 'oscillating' && spec.offset !== undefined)
        fail('INVALID_INPUT', 'an offset belongs to a translating follower');
    const k = motion === 'oscillating' ? Math.PI / 180 : 1;
    let cached;
    const segs = () => cached ?? (cached = program(spec, k));
    const G = geometry(spec, motion, segs), list = segs();
    const tol = spec.profileTolerance ?? 1e-4 * rb;
    if (!(num(tol) && tol > 0))
        fail('INVALID_INPUT', 'profileTolerance must be a number of mm above 0');
    const limit = spec.pressureAngleLimit ?? (motion === 'oscillating' ? 35 : 30);
    if (!(num(limit) && limit > 0 && limit < 90))
        fail('INVALID_INPUT', 'pressureAngleLimit must be a number of degrees between 0 and 90');
    const warnings = [];
    const at = (th) => `${r6(deg(th))}°`, u = (x) => r6(G.units === 'deg' ? deg(x) : x);
    // Steps at the joints: of the velocity, a corner (refused); of the acceleration, infinite jerk (a warning).
    // (Steps measured against the program's own scale: its largest peak velocity and finite peak acceleration.)
    const peaks = list.filter(g => g.law).map(g => { const be = g.b - g.a, d = Math.abs(g.p1 - g.p0), pk = camLawPeaks(g.law); return [d * pk.cv / be, Number.isFinite(pk.ca) ? d * pk.ca / (be * be) : 0]; });
    const scale = Math.max(...peaks.map(x => x[0])), scaleA = Math.max(scale, ...peaks.map(x => x[1]));
    for (let i = 0; i < list.length; i++) {
        const L = list[i], R = list[(i + 1) % list.length], [, v0, a0] = segMotion(L, L.b), [, v1, a1] = segMotion(R, R.a);
        if (Math.abs(v1 - v0) > 1e-9 * scale) {
            const where = at(L.b % (2 * Math.PI)), conv = list.map((g, j) => ({ j, dv: segMotion(list[(j + 1) % list.length], list[(j + 1) % list.length].a)[1] - segMotion(g, g.b)[1], p: g.p1 })).find(x => Math.abs(x.dv) > 1e-9 * scale && G.convexStep(x.p, x.dv));
            if (conv)
                fail('CAM_UNDERCUT', `the follower's velocity steps by ${u(conv.dv)} ${G.units}/rad at ${at(list[conv.j].b % (2 * Math.PI))} (the ${list[conv.j].law ?? list[(conv.j + 1) % list.length].law ?? 'uniform'} law's end): a corner in the cam's path that no ${spec.follower === 'roller' ? 'roller' : 'flat face'} traces (its radius of curvature 0${spec.follower === 'roller' ? ` < r_r ${spec.rollerRadius}` : ''}); every law but uniform starts and ends at rest`);
            fail('INVALID_INPUT', `the follower's velocity steps by ${u(v1 - v0)} ${G.units}/rad at ${where}: the profile would need a flat there, not built (cam@0)`);
        }
        if (Math.abs(a1 - a0) > 1e-9 * scaleA)
            warnings.push({ code: 'ACCELERATION_STEP', message: `ACCELERATION_STEP: the acceleration steps by ${u(a1 - a0)} ${G.units}/rad² at ${at(L.b % (2 * Math.PI))} (infinite jerk: Norton's fundamental law of cam design; the ${L.law ?? R.law} law at a dwell)` });
    }
    // The checks over each segment: the least convex radius (undercut), the largest pressure angle, the face's contact.
    let leastRho = Infinity, leastAt = 0, leastPitch = Infinity, phiMax = 0, phiAt = 0, along = [Infinity, -Infinity];
    for (const g of list) {
        const n = Math.max(64, Math.ceil(2048 * (g.b - g.a) / (2 * Math.PI)));
        const lr = extreme(th => -G.at(g, th).rho, g.a, g.b, n);
        if (-lr.value < leastRho) {
            leastRho = -lr.value;
            leastAt = lr.at;
            const pr = G.at(g, lr.at).pitchRho;
            if (pr !== undefined)
                leastPitch = pr;
        }
        const pm = extreme(th => Math.abs(G.at(g, th).phi), g.a, g.b, n);
        if (pm.value > phiMax) {
            phiMax = pm.value;
            phiAt = pm.at;
        }
        if (spec.follower === 'flat') {
            along = [Math.min(along[0], -extreme(th => -G.at(g, th).along, g.a, g.b, n).value), Math.max(along[1], extreme(th => G.at(g, th).along, g.a, g.b, n).value)];
        }
    }
    if (!(leastRho > 0)) {
        if (spec.follower === 'roller')
            fail('CAM_UNDERCUT', `the pitch curve's convex radius of curvature falls to ${r6(leastPitch)} mm at ${at(leastAt)}, at most the roller's r_r ${spec.rollerRadius}: the profile undercuts (a larger base circle, a smaller roller or a longer rise)`);
        fail('CAM_UNDERCUT', Number.isFinite(leastRho) ? `the flat face's profile has radius of curvature ρ = h + h_ββ ${r6(leastRho)} mm ≤ 0 at ${at(leastAt)}: the face cannot follow the law (a larger base circle or a longer rise)` : `the face turns faster than the cam at ${at(leastAt)} (1 + ψ' ≤ 0): no envelope`);
    }
    const est = spec.pressureAngleLimit === undefined;
    if (deg(phiMax) > limit)
        warnings.push({ code: 'PRESSURE_ANGLE', message: `PRESSURE_ANGLE: the pressure angle reaches ${r6(deg(phiMax))}° at ${at(phiAt)}, above ${limit}°${est ? ' (a rule of thumb, an estimate)' : ''}` });
    const fw = spec.faceWidth;
    if (fw !== undefined && !(num(fw) && fw > 0))
        fail('INVALID_INPUT', 'faceWidth must be a number of mm above 0');
    if (spec.follower === 'flat' && fw !== undefined) {
        const off = motion === 'translating' ? along[0] < -fw / 2 - 1e-9 || along[1] > fw / 2 + 1e-9 : along[0] < -1e-9 || along[1] > fw + 1e-9;
        if (off)
            warnings.push({ code: 'FACE_WIDTH', message: `FACE_WIDTH: the contact runs ${r6(along[0])} to ${r6(along[1])} mm ${motion === 'translating' ? 'about the follower\'s line' : 'from the pivot'}, off a face ${fw} mm ${motion === 'translating' ? 'wide' : 'long'}` });
    }
    // The bore.
    const bd = spec.boreDiameter ?? 0, rim = spec.minimumRim ?? 1;
    if (!(num(bd) && bd >= 0) || !(num(rim) && rim >= 0))
        fail('INVALID_INPUT', 'boreDiameter and minimumRim must be numbers of mm, 0 or more');
    if (bd > 0 && !(bd / 2 <= rb - rim))
        fail('INVALID_INPUT', `a bore of ${bd} mm leaves less than the ${rim} mm rim below the base circle (Ø${2 * rb}): at most Ø${r6(2 * (rb - rim))}`);
    // The fit: Hermite cubics in θ per segment, each segment's pieces doubled until it is within the tolerance.
    const counts = list.map(g => Math.max(2, Math.ceil(32 * (g.b - g.a) / (2 * Math.PI))));
    const BUDGET = 2048;
    let poles = [], deviation = 0;
    for (;;) {
        poles = [];
        deviation = 0;
        let again = false;
        list.forEach((g, i) => {
            const n = counts[i], mine = [];
            let dev = 0, A = G.at(g, g.a);
            for (let j = 0; j < n; j++) {
                const ta = g.a + (g.b - g.a) * j / n, tb = g.a + (g.b - g.a) * (j + 1) / n, B = G.at(g, tb), P = hermite(A, B, (tb - ta) / 3);
                for (let q = 1; q < 24; q++) {
                    const t = q / 24, X = bez(P, t), E = G.at(g, ta + (tb - ta) * t).K;
                    dev = Math.max(dev, Math.hypot(X[0] - E[0], X[1] - E[1]));
                }
                mine.push(P);
                A = B;
            }
            poles.push(mine);
            deviation = Math.max(deviation, dev);
            if (dev > tol) {
                counts[i] *= 2;
                again = true;
            }
        });
        if (!again)
            break;
        if (counts.reduce((x, y) => x + y, 0) > BUDGET)
            fail('PROFILE_BUDGET_EXCEEDED', `the profile needs more than ${BUDGET} pieces to stay within ${tol} mm (a larger tolerance)`);
    }
    // The follower's position on the built profile every half degree, against the law.
    const flat = poles.flat(), samples = 720, sweep = sweepBuilt(G, flat, list, samples, spec.rollerRadius ?? 0);
    // Counter-clockwise for the solid: the pieces in falling θ, each reversed.
    const names = [], pieces = [];
    const counter = {};
    list.forEach((g, i) => { counter[g.motion] = (counter[g.motion] ?? 0) + 1; names.push({ motion: g.motion, index: counter[g.motion] }); void i; });
    for (let i = list.length - 1; i >= 0; i--)
        for (let j = poles[i].length - 1; j >= 0; j--) {
            const P = poles[i][j];
            pieces.push({ name: `${names[i].motion}${names[i].index}#${j + 1}`, curve: { kind: 'curve', id: `cam${i}_${j}`, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: [P[3], P[2], P[1], P[0]].map(q => [q[0], q[1], 0]), weights: [1, 1, 1, 1] } });
        }
    const bore = bd > 0 ? [{ name: 'bore#1', curve: arcCurve('b', bd / 2, 0, -Math.PI) }, { name: 'bore#2', curve: arcCurve('b', bd / 2, -Math.PI, -Math.PI) }] : [];
    const report = {
        generator: 'cam@0', motion, follower: spec.follower, baseRadius: rb, ...G.report, units: G.units,
        stroke: u(Math.max(...list.map(g => g.p1))),
        segments: list.map((g, i) => {
            const be = g.b - g.a, d = Math.abs(g.p1 - g.p0), pk = g.law ? camLawPeaks(g.law) : { cv: 0, ca: 0 };
            return { index: i + 1, motion: g.motion, ...(g.law ? { law: g.law } : {}), start: r6(deg(g.a)), end: r6(deg(g.b)), from: u(g.p0), to: u(g.p1), peakVelocity: u(d * pk.cv / be), peakAcceleration: u(d * pk.ca / (be * be)) };
        }),
        pressureAngle: { max: r6(deg(phiMax)), at: r6(deg(phiAt)), limit: limit, limitEstimate: est, ...(est ? { limitSource: 'a rule-of-thumb estimate, attributed to no source' } : {}) },
        curvature: { ...(spec.follower === 'roller' ? { leastPitchRadius: r6(leastPitch) } : {}), leastProfileRadius: r6(leastRho), at: r6(deg(leastAt)) },
        ...(spec.follower === 'flat' ? { faceContact: [r6(along[0]), r6(along[1])] } : {}),
        profilePieces: flat.length, profileDeviation: deviation, profileTolerance: tol, sweep, warnings, manufacturingValidated: false,
    };
    return { pieces, bore, report, segments: names };
}
/** The distance from X to piece P (samples, then golden-section about the nearest), and the support h_P(m) = max m·P. */
function pieceNear(P, f) {
    let best = -Infinity, bi = 0;
    for (let i = 0; i <= 16; i++) {
        const v = f(bez(P, i / 16));
        if (v > best) {
            best = v;
            bi = i;
        }
    }
    let lo = Math.max(0, bi - 1) / 16, hi = Math.min(16, bi + 1) / 16;
    const gr = (Math.sqrt(5) - 1) / 2;
    let x1 = hi - gr * (hi - lo), x2 = lo + gr * (hi - lo), f1 = f(bez(P, x1)), f2 = f(bez(P, x2));
    for (let i = 0; i < 40; i++) {
        if (f1 >= f2) {
            hi = x2;
            x2 = x1;
            f2 = f1;
            x1 = hi - gr * (hi - lo);
            f1 = f(bez(P, x1));
        }
        else {
            lo = x1;
            x1 = x2;
            f1 = f2;
            x2 = lo + gr * (hi - lo);
            f2 = f(bez(P, x2));
        }
    }
    return Math.max(best, f1, f2);
}
/**
 * The follower's position on the built profile: the p at which its clearance — the roller's least distance to the cam less
 * r_r, or the face's offset less the cam's support along its normal — is zero (secant steps from the law's p).
 */
function sweepBuilt(G, pieces, list, samples, rr) {
    const boxes = pieces.map(P => { const xs = P.map(q => q[0]), ys = P.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; });
    const gap = (th, p) => {
        if (G.roller) {
            const C = back(G.roller(p), th);
            let best = Infinity;
            pieces.forEach((P, i) => {
                const b = boxes[i], dx = Math.max(b[0] - C[0], 0, C[0] - b[2]), dy = Math.max(b[1] - C[1], 0, C[1] - b[3]);
                if (Math.hypot(dx, dy) >= best)
                    return;
                best = Math.min(best, -pieceNear(P, q => -Math.hypot(q[0] - C[0], q[1] - C[1])));
            });
            return best - rr;
        }
        const F = G.face(p), m = back(F.n, th);
        let sup = -Infinity;
        pieces.forEach((P, i) => {
            const b = boxes[i], top = Math.max(m[0] * b[0], m[0] * b[2]) + Math.max(m[1] * b[1], m[1] * b[3]);
            if (top <= sup)
                return;
            sup = Math.max(sup, pieceNear(P, q => m[0] * q[0] + m[1] * q[1]));
        });
        return F.h - sup;
    };
    let worst = 0, worstAt = 0;
    for (let i = 0; i < samples; i++) {
        const th = 2 * Math.PI * i / samples, g = list.find(x => th >= x.a && th < x.b) ?? list[list.length - 1], law = segMotion(g, th)[0];
        let p0 = law, g0 = gap(th, p0), p1 = law + (G.units === 'deg' ? 1e-4 : 1e-3), g1 = gap(th, p1);
        for (let it = 0; it < 30 && Math.abs(g1) > 1e-13 && g1 !== g0; it++) {
            const p2 = p1 - g1 * (p1 - p0) / (g1 - g0);
            p0 = p1;
            g0 = g1;
            p1 = p2;
            g1 = gap(th, p1);
        }
        if (Math.abs(p1 - law) > worst) {
            worst = Math.abs(p1 - law);
            worstAt = th;
        }
    }
    const k = G.units === 'deg' ? 180 / Math.PI : 1;
    return { samples, deviation: worst * k * G.mmPerUnit, at: r6(deg(worstAt)) };
}
/**
 * The cam as a solid: its profile pulled from z 0 through its thickness, the bore through it. Side faces `<id>.rise1#k`,
 * `.dwell1#k`, `.return1#k` (the program's motions counted by kind, pieces in θ), `.bore#1`/`#2`, the ends `.face0`/`.face1`.
 */
export function discCam(spec, options = {}) {
    const id = options.id ?? 'cam', { pieces, bore, report } = camProfile(spec);
    const R = Math.max(...pieces.flatMap(p => p.curve.controlPoints.map(q => Math.hypot(q[0], q[1])))) + 1;
    const brep = extrudedProfile(id, 'cam', pieces.map(p => ({ name: `${id}.${p.name}`, curve: p.curve })), bore.map(p => ({ name: `${id}.${p.name}`, curve: p.curve })), spec.thickness, R);
    return { brep, report };
}
/** The follower's position under the law at θ (degrees of the cam's turn): s in the program's units, s' and s'' per radian. */
export function camMotion(spec, thetaDeg) {
    const k = (spec.motion ?? 'translating') === 'oscillating' ? Math.PI / 180 : 1, list = program(spec, k), th = ((thetaDeg % 360) + 360) % 360 * Math.PI / 180;
    const g = list.find(x => th >= x.a && th < x.b) ?? list[list.length - 1], [s, v, a] = segMotion(g, th);
    return { s: s / k, v: v / k, a: a / k };
}
