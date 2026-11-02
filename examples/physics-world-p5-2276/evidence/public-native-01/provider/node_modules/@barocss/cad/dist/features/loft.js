// A ruled loft: closed profiles at increasing heights joined by straight rulings, each section's edge
// to the matching edge of the next. Sections with fewer edges have their longest edges halved until
// the counts agree, and each section's edges are turned to start where the previous section's start
// (about the centroids). Every side between two sections is one exact NURBS patch, linear across:
// planar or bilinear between parallel lines, otherwise a rational quadratic in u (a line meeting an
// arc takes the arc's weights). The section at a fraction λ of a span is (1 − λ)·C₀(s) + λ·C₁(s), so
// its area moments are polynomials of degree ≤ 4 in λ: the mass integrals are exact by three-point
// Gauss quadrature across, and to rounding along the (rational) edges by 24-point quadrature.
import { buildBrep, lineCurve, BrepError } from '../brep/brep-core.js';
import { buildProfileLoop, capSurface } from './extruded-profile-solid.js';
import { solidMassFromIntegrals } from '../brep/solid-mass.js';
import { gauss } from '../core/quadrature.js';
import { admitNurbsGuide } from './loft-nurbs-guide.js';
import { orientedLoftSolid } from './oriented-loft.js';
import { patchLoftGuideSides } from './loft-guide-patches.js';
const startOf = (q) => q.kind === 'line' ? q.a : [q.c[0] + q.r * Math.cos(q.t0), q.c[1] + q.r * Math.sin(q.t0)];
const lengthOf = (q) => q.kind === 'line' ? Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) : q.r * Math.abs(q.dt);
const half = (q) => {
    if (q.kind === 'line') {
        const m = [(q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2];
        return [{ kind: 'line', a: q.a, b: m }, { kind: 'line', a: m, b: q.b }];
    }
    return [{ ...q, dt: q.dt / 2 }, { ...q, t0: q.t0 + q.dt / 2, dt: q.dt / 2 }];
};
const bezier = (q) => {
    if (q.kind === 'line')
        return { p: [q.a, q.b], w: [1, 1] };
    const t1 = q.t0 + q.dt, tm = q.t0 + q.dt / 2, w = Math.cos(Math.abs(q.dt) / 2), rm = q.r / w;
    return { p: [startOf(q), [q.c[0] + rm * Math.cos(tm), q.c[1] + rm * Math.sin(tm)], [q.c[0] + q.r * Math.cos(t1), q.c[1] + q.r * Math.sin(t1)]], w: [1, w, 1] };
};
/** Degree 2 with the given middle weight (a line stays straight). */
const quadratic = (b, w) => b.p.length === 3 ? b : { p: [b.p[0], [(b.p[0][0] + b.p[1][0]) / 2, (b.p[0][1] + b.p[1][1]) / 2], b.p[1]], w: [1, w, 1] };
const curve3 = (b, z, id) => ({ kind: 'curve', id, degree: b.p.length - 1, knots: b.p.length === 2 ? [0, 0, 1, 1] : [0, 0, 0, 1, 1, 1], controlPoints: b.p.map(p => [p[0], p[1], z]), weights: [...b.w] });
const G3 = gauss(3), G4 = gauss(4), G6 = gauss(6), G24 = gauss(24);
/** A rational Bézier's point and derivative at s. */
function at(b, s) {
    const n = b.p.length - 1, B = n === 1 ? [1 - s, s] : [(1 - s) ** 2, 2 * s * (1 - s), s * s], dB = n === 1 ? [-1, 1] : [-2 * (1 - s), 2 - 4 * s, 2 * s];
    let W = 0, dW = 0, X = 0, Y = 0, dX = 0, dY = 0;
    for (let j = 0; j <= n; j++) {
        const c = B[j] * b.w[j], d = dB[j] * b.w[j];
        W += c;
        dW += d;
        X += c * b.p[j][0];
        Y += c * b.p[j][1];
        dX += d * b.p[j][0];
        dY += d * b.p[j][1];
    }
    const x = X / W, y = Y / W;
    return [[x, y], [(dX - x * dW) / W, (dY - y * dW) / W]];
}
export function loftSolid(input) {
    const zPath = !input.sections.some(s => s.frame !== undefined || !Array.isArray(s.profile));
    // (CG1.3: a general guide on sections stacked along z, ruled; the Bézier guides keep their framed paths.)
    if (input.guide?.kind === 'nurbs' && zPath)
        return legacyLoft({ ...input, guide: undefined }, undefined, input.guide);
    if (input.guide !== undefined || !zPath)
        return orientedLoftSolid(input, legacyLoft);
    return legacyLoft(input);
}
/** Shared ruled builder; the optional guide factory is internal to admitted framed mixed lofts. */
function legacyLoft(input, guideFactory, nurbsGuide) {
    const fail = (detail) => { throw new BrepError('INPUT', `loft: ${detail}`); };
    const S = input.sections;
    if (S.length < 2)
        fail('needs at least two sections');
    for (let k = 1; k < S.length; k++)
        if (!(S[k].z > S[k - 1].z))
            fail(`section ${k} must lie above section ${k - 1}`);
    // Each section's pieces (arcs in spans of at most 90°), counter-clockwise.
    // (The first section's pieces each keep the authored segment they come from, for tagged names.)
    const src0 = [];
    const sections = S.map((s, si) => {
        const loop = buildProfileLoop(s.profile), m = loop.segments.length;
        return loop.segments.flatMap((g, gi) => {
            const from = loop.reversed ? m - 1 - gi : gi;
            if (g.kind === 'line') {
                if (si === 0)
                    src0.push(from);
                return [{ kind: 'line', a: g.start, b: g.end }];
            }
            const n = Math.max(1, Math.ceil(Math.abs(g.sweep) / (Math.PI / 2) - 1e-9));
            if (si === 0)
                for (let k = 0; k < n; k++)
                    src0.push(from);
            return Array.from({ length: n }, (_, k) => ({ kind: 'arc', c: g.center, r: g.radius, t0: g.startAngle + g.sweep * k / n, dt: g.sweep / n }));
        });
    });
    const n = Math.max(...sections.map(p => p.length));
    for (const p of sections)
        while (p.length < n) {
            let i = 0;
            p.forEach((q, j) => { if (lengthOf(q) > lengthOf(p[i]))
                i = j; });
            p.splice(i, 1, ...half(p[i]));
            if (p === sections[0])
                src0.splice(i, 1, src0[i], src0[i]);
        }
    const tagged = taggedSides(src0, input.sideTags);
    // Turn each section to start nearest the previous one's start (directions about the centroids).
    const shape = (p) => { const pts = p.map(startOf), c = pts.reduce((m, q) => [m[0] + q[0] / n, m[1] + q[1] / n], [0, 0]), rms = Math.sqrt(pts.reduce((m, q) => m + (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2, 0) / n) || 1; return pts.map(q => [(q[0] - c[0]) / rms, (q[1] - c[1]) / rms]); };
    for (let k = 1; !guideFactory && !nurbsGuide && k < sections.length; k++) {
        const a = shape(sections[k - 1]), b = shape(sections[k]);
        let best = 0, cost = Infinity;
        for (let sh = 0; sh < n; sh++) {
            const c = a.reduce((m, q, i) => m + (q[0] - b[(i + sh) % n][0]) ** 2 + (q[1] - b[(i + sh) % n][1]) ** 2, 0);
            if (c < cost - 1e-12) {
                cost = c;
                best = sh;
            }
        }
        sections[k] = [...sections[k].slice(best), ...sections[k].slice(0, best)];
    }
    const K = sections.length - 1, z = S.map(s => s.z), id = input.id, nm = input.name;
    const scale = Math.max(1, ...sections.flat().map(q => Math.max(...startOf(q).map(Math.abs))), ...z.map(Math.abs)), tol = 1e-9 * scale;
    // Each piece as a Bézier ending exactly where the next one starts (its vertex).
    // CG1.3: each section turned to start at the vertex the guide passes through (it runs along the first edge's start).
    let nurbsSpans = null;
    if (nurbsGuide) {
        if (input.smooth && K >= 2)
            fail('a guide takes ruled sections (not smooth)');
        const { spans, through } = admitNurbsGuide(nurbsGuide, z, tol);
        sections.forEach((p, k) => {
            const at = p.findIndex(q => { const v = startOf(q); return Math.hypot(v[0] - through[k][0], v[1] - through[k][1]) <= tol; });
            if (at < 0)
                fail(`guide must pass through a vertex of section ${k} (it crosses it at ${through[k].map(x => +x.toPrecision(9)).join(', ')})`);
            sections[k] = [...p.slice(at), ...p.slice(0, at)];
            if (k === 0)
                src0.splice(0, src0.length, ...src0.slice(at), ...src0.slice(0, at));
        });
        nurbsSpans = spans;
    }
    const piece = (k, i) => { const b = bezier(sections[k][i]); return { p: [...b.p.slice(0, -1), startOf(sections[k][(i + 1) % n])], w: b.w }; };
    if (input.smooth && K >= 2)
        return smoothLoft(sections.map((p, k) => p.map((_, i) => piece(k, i))), z, id, nm, tagged);
    const sideName = (k, i) => K === 1 ? `${nm}.${tagged ? tagged[i] : `side${i}`}` : `${nm}.s${k}.${tagged ? tagged[i] : `side${i}`}`;
    const vid = (k, i) => `v${k}_${i % n}`, rid = (k, i) => `r${k}_${i % n}`, lid = (k, i) => `l${k}_${i % n}`;
    const vertices = sections.flatMap((p, k) => p.map((q, i) => ({ id: vid(k, i), point: [...startOf(q), z[k]] })));
    const guide1 = guideFactory?.(vertices[0].point, vertices[n].point), guideOf = (k) => nurbsSpans ? nurbsSpans[k] : guide1;
    const edges = [];
    sections.forEach((p, k) => p.forEach((q, i) => {
        const below = k > 0 ? sideName(k - 1, i) : `${nm}.bottom`, above = k < K ? sideName(k, i) : `${nm}.top`;
        edges.push({ id: rid(k, i), curve: curve3(piece(k, i), z[k], rid(k, i)), vertices: [vid(k, i), vid(k, i + 1)], name: [below, above].sort().join('|') });
        const guide = k < K ? guideOf(k) : undefined;
        if (k < K)
            edges.push({ id: lid(k, i), curve: guide ? { kind: 'curve', id: lid(k, i), degree: guide.degree, knots: [...guide.knots], controlPoints: guide.controls(vertices[k * n + i].point, vertices[(k + 1) * n + i].point), weights: Array(guide.knots.length - guide.degree - 1).fill(1) } : lineCurve(lid(k, i), [...startOf(q), z[k]], [...startOf(sections[k + 1][i]), z[k + 1]]), vertices: [vid(k, i), vid(k + 1, i)], name: [sideName(k, (i + n - 1) % n), sideName(k, i)].sort().join('|') });
    }));
    // The sides: each a patch between a section's edge and the next one's, with the curves the mass uses.
    const faces = [], spans = [];
    for (let k = 0; k < K; k++)
        for (let i = 0; i < n; i++) {
            const guide = guideOf(k);
            let lo = piece(k, i), hi = piece(k + 1, i);
            if (lo.p.length !== hi.p.length) {
                const w = (lo.p.length === 3 ? lo : hi).w[1];
                lo = quadratic(lo, w);
                hi = quadratic(hi, w);
            }
            else if (lo.p.length === 2) {
                // Two lines: a plane when they are parallel or meet, otherwise twisted (made quadratic, exact still).
                const [a0, b0] = lo.p.map(p => [p[0], p[1], z[k]]), [a1, b1] = hi.p.map(p => [p[0], p[1], z[k + 1]]);
                const u = [b0[0] - a0[0], b0[1] - a0[1], 0], v = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], d = [b1[0] - a0[0], b1[1] - a0[1], b1[2] - a0[2]];
                const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0], nl = Math.hypot(nx, ny, nz);
                if (Math.abs(nx * d[0] + ny * d[1] + nz * d[2]) / nl > tol) {
                    lo = quadratic(lo, 1);
                    hi = quadratic(hi, 1);
                }
            }
            if (guide && lo.w.some((w, j) => w !== hi.w[j]))
                fail('guided mixed curves need identical rational weights');
            spans.push({ lo, hi, z0: z[k], z1: z[k + 1], ...(nurbsSpans ? { nurbs: nurbsSpans[k] } : {}) });
            const surface = { kind: 'surface', id: `f${k}_${i}`, degreeU: lo.p.length - 1, degreeV: guide ? guide.degree : 1, knotsU: lo.p.length === 2 ? [0, 0, 1, 1] : [0, 0, 0, 1, 1, 1], knotsV: guide ? [...guide.knots] : [0, 0, 1, 1],
                controlPoints: lo.p.map((p, j) => { const a = [p[0], p[1], z[k]], b = [hi.p[j][0], hi.p[j][1], z[k + 1]]; return guide ? guide.controls(a, b) : [a, b]; }), weights: lo.w.map((w, j) => guide ? Array(guide.knots.length - guide.degree - 1).fill(w) : [w, hi.w[j]]) };
            faces.push({ id: `f${k}_${i}`, surface, sense: 'forward', name: sideName(k, i), loops: [{ kind: 'outer', uses: [
                            { edge: rid(k, i), sense: 'forward' }, { edge: lid(k, i + 1), sense: 'forward' }, { edge: rid(k + 1, i), sense: 'reversed' }, { edge: lid(k, i), sense: 'reversed' }
                        ] }] });
        }
    const bounds = (p) => { const pts = p.flatMap(q => bezier(q).p); return { min: [Math.min(...pts.map(q => q[0])) - 1, Math.min(...pts.map(q => q[1])) - 1], max: [Math.max(...pts.map(q => q[0])) + 1, Math.max(...pts.map(q => q[1])) + 1] }; };
    faces.push({ id: 'bottom', surface: capSurface(bounds(sections[0]), z[0], 'bottom', false), sense: 'forward', name: `${nm}.bottom`, loops: [{ kind: 'outer', uses: Array.from({ length: n }, (_, j) => ({ edge: rid(0, n - 1 - j), sense: 'reversed' })) }] });
    faces.push({ id: 'top', surface: capSurface(bounds(sections[K]), z[K], 'top', true), sense: 'forward', name: `${nm}.top`, loops: [{ kind: 'outer', uses: Array.from({ length: n }, (_, j) => ({ edge: rid(K, j), sense: 'forward' })) }] });
    if (nurbsSpans)
        patchLoftGuideSides(vertices, edges, faces);
    const brep = buildBrep({ source: { family: 'loft', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}.shell`, faces, closed: true }] }] });
    // Volume integrals [V, ∫x, ∫y, ∫z, ∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz] by sections (Green's theorem along them).
    const I = Array(10).fill(0);
    for (const { lo, hi, z0, z1, nurbs } of spans) {
        if (nurbs) {
            guidedSpanMoments(I, lo, hi, nurbs);
            continue;
        }
        const h = z1 - z0;
        // Quadratic translation gives degree at most seven in l; cubic gives at most ten.
        // The no-guide path keeps the original Gauss(3) arithmetic.
        const G = guide1 ? (guide1.degree === 3 ? G6 : G4) : G3;
        G.x.forEach((l, a) => {
            const zz = z0 + l * h, wl = G.w[a] * h, offset = guide1?.offset(l);
            let A = 0, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0;
            G24.x.forEach((s, b) => {
                const [p0, d0] = at(lo, s), [p1, d1] = at(hi, s), ws = G24.w[b];
                const baseX = (1 - l) * p0[0] + l * p1[0], baseY = (1 - l) * p0[1] + l * p1[1];
                const x = offset ? baseX + offset[0] : baseX, y = offset ? baseY + offset[1] : baseY, dx = (1 - l) * d0[0] + l * d1[0], dy = (1 - l) * d0[1] + l * d1[1];
                A += ws * x * dy;
                Sx += ws * x * x / 2 * dy;
                Sy -= ws * y * y / 2 * dx;
                Sxx += ws * x ** 3 / 3 * dy;
                Syy -= ws * y ** 3 / 3 * dx;
                Sxy += ws * x * x * y / 2 * dy;
            });
            I[0] += wl * A;
            I[1] += wl * Sx;
            I[2] += wl * Sy;
            I[3] += wl * zz * A;
            I[4] += wl * Sxx;
            I[5] += wl * Syy;
            I[6] += wl * zz * zz * A;
            I[7] += wl * Sxy;
            I[8] += wl * zz * Sx;
            I[9] += wl * zz * Sy;
        });
    }
    return { brep, mass: density => solidMassFromIntegrals(I, density, 'quadrature') };
}
/**
 * A span under a general guide (CG1.3) into the volume integrals: the slice at λ is the ruled one moved by the guide's
 * departure from its chord, at the guide's height, so dz = rise(λ) dλ. Between the guide's knots each moment is a
 * polynomial in λ of degree at most 5p - 1, including dz (p is the guide degree). The Gauss rule
 * therefore needs at least ceil(5p / 2) points; retain the previous rule where it already suffices.
 */
function guidedSpanMoments(I, lo, hi, g) {
    const G = gaussFor(Math.max(2 * g.degree + 2, Math.ceil(5 * g.degree / 2)));
    for (let c = 0; c + 1 < g.breaks.length; c++) {
        const c0 = g.breaks[c], c1 = g.breaks[c + 1], d = c1 - c0;
        for (let a = 0; a < G.x.length; a++) {
            const l = c0 + G.x[a] * d, zz = g.height(l), wl = G.w[a] * d * g.rise(l), offset = g.offset(l), fraction = (zz - g.start[2]) / (g.end[2] - g.start[2]);
            let A = 0, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0;
            for (let b = 0; b < G24.x.length; b++) {
                const s = G24.x[b], [p0, d0] = at(lo, s), [p1, d1] = at(hi, s), ws = G24.w[b];
                const x = (1 - fraction) * p0[0] + fraction * p1[0] + offset[0], y = (1 - fraction) * p0[1] + fraction * p1[1] + offset[1], dx = (1 - fraction) * d0[0] + fraction * d1[0], dy = (1 - fraction) * d0[1] + fraction * d1[1];
                A += ws * x * dy;
                Sx += ws * x * x / 2 * dy;
                Sy -= ws * y * y / 2 * dx;
                Sxx += ws * x ** 3 / 3 * dy;
                Syy -= ws * y ** 3 / 3 * dx;
                Sxy += ws * x * x * y / 2 * dy;
            }
            I[0] += wl * A;
            I[1] += wl * Sx;
            I[2] += wl * Sy;
            I[3] += wl * zz * A;
            I[4] += wl * Sxx;
            I[5] += wl * Syy;
            I[6] += wl * zz * zz * A;
            I[7] += wl * Sxy;
            I[8] += wl * zz * Sx;
            I[9] += wl * zz * Sy;
        }
    }
}
const gaussRules = new Map();
const gaussFor = (n) => { let r = gaussRules.get(n); if (!r)
    gaussRules.set(n, r = gauss(n)); return r; };
/**
 * A smooth loft: each edge's pieces through the sections joined by a cubic in v, C1 — non-uniform
 * Catmull–Rom tangents on the homogeneous control points (so it passes through every section exactly),
 * as Bézier spans (triple knots). Adjacent sides share their columns, so their edges are exact. The
 * mass is the divergence theorem over the sides (Gauss quadrature on each span) and the caps (exact
 * section moments).
 */
/** Side names from the first section's pieces' source segments and the tags (`side[t]`, `#k` when one segment gives several), or null untagged. */
function taggedSides(src0, tags) {
    if (!tags)
        return null;
    const count = new Map(), seen = new Map();
    for (const g of src0)
        count.set(g, (count.get(g) ?? 0) + 1);
    return src0.map(g => { const k = (seen.get(g) ?? 0) + 1; seen.set(g, k); return count.get(g) > 1 ? `side[${tags[g]}]#${k}` : `side[${tags[g]}]`; });
}
function smoothLoft(rows, z, id, nm, tagged = null) {
    const K = rows.length - 1, n = rows[0].length, v = z.map(x => (x - z[0]) / (z[K] - z[0]));
    const hom = (p, zz, w) => [p[0] * w, p[1] * w, zz * w, w];
    // Per edge i: its pieces raised to one degree (a line among arcs becomes quadratic, straight still).
    const columns = Array.from({ length: n }, (_, i) => {
        const deg = Math.max(...rows.map(r => r[i].p.length - 1)), pcs = rows.map(r => deg === 2 ? quadratic(r[i], 1) : r[i]);
        // cols[j] = the j-th control point through the sections, homogeneous.
        return Array.from({ length: deg + 1 }, (_, j) => pcs.map((b, k) => hom(b.p[j], z[k], b.w[j])));
    });
    const spline = (H) => {
        const T = H.map((_, k) => { const a = Math.max(0, k - 1), b = Math.min(K, k + 1); return H[b].map((x, c) => (x - H[a][c]) / (v[b] - v[a])); });
        const out = [H[0]];
        for (let k = 0; k < K; k++) {
            const d = (v[k + 1] - v[k]) / 3;
            out.push(H[k].map((x, c) => x + T[k][c] * d), H[k + 1].map((x, c) => x - T[k + 1][c] * d), H[k + 1]);
        }
        return out;
    };
    const knotsV = [0, 0, 0, 0, ...v.slice(1, K).flatMap(x => [x, x, x]), 1, 1, 1, 1];
    const nets = columns.map(cols => cols.map(spline));
    for (const net of nets)
        for (const col of net)
            for (const h of col)
                if (!(h[3] > 0))
                    throw new BrepError('GEOMETRY', 'loft: the sections are too far apart for a smooth side (a weight turned negative)');
    const point = (h) => [h[0] / h[3], h[1] / h[3], h[2] / h[3]];
    const curveOf = (col, cid) => ({ kind: 'curve', id: cid, degree: 3, knots: [...knotsV], controlPoints: col.map(point), weights: col.map(h => h[3]) });
    const side = (i) => `${nm}.${tagged ? tagged[i] : `side${i}`}`;
    const vertices = rows.flatMap((r, k) => k === 0 || k === K ? r.map((b, i) => ({ id: `v${k}_${i}`, point: [b.p[0][0], b.p[0][1], z[k]] })) : []);
    const edges = [];
    for (const k of [0, K])
        rows[k].forEach((b, i) => edges.push({ id: `r${k}_${i}`, curve: curve3(b, z[k], `r${k}_${i}`), vertices: [`v${k}_${i}`, `v${k}_${(i + 1) % n}`], name: [k ? `${nm}.top` : `${nm}.bottom`, side(i)].sort().join('|') }));
    nets.forEach((net, i) => edges.push({ id: `c${i}`, curve: curveOf(net[0], `c${i}`), vertices: [`v0_${i}`, `v${K}_${i}`], name: [side((i + n - 1) % n), side(i)].sort().join('|') }));
    const faces = nets.map((net, i) => ({ id: `f${i}`, sense: 'forward', name: side(i),
        surface: { kind: 'surface', id: `f${i}`, degreeU: net.length - 1, degreeV: 3, knotsU: net.length === 2 ? [0, 0, 1, 1] : [0, 0, 0, 1, 1, 1], knotsV: [...knotsV], controlPoints: net.map(col => col.map(point)), weights: net.map(col => col.map(h => h[3])) },
        loops: [{ kind: 'outer', uses: [{ edge: `r0_${i}`, sense: 'forward' }, { edge: `c${(i + 1) % n}`, sense: 'forward' }, { edge: `r${K}_${i}`, sense: 'reversed' }, { edge: `c${i}`, sense: 'reversed' }] }] }));
    const bounds = (r) => { const pts = r.flatMap(b => b.p); return { min: [Math.min(...pts.map(q => q[0])) - 1, Math.min(...pts.map(q => q[1])) - 1], max: [Math.max(...pts.map(q => q[0])) + 1, Math.max(...pts.map(q => q[1])) + 1] }; };
    faces.push({ id: 'bottom', surface: capSurface(bounds(rows[0]), z[0], 'bottom', false), sense: 'forward', name: `${nm}.bottom`, loops: [{ kind: 'outer', uses: Array.from({ length: n }, (_, j) => ({ edge: `r0_${n - 1 - j}`, sense: 'reversed' })) }] });
    faces.push({ id: 'top', surface: capSurface(bounds(rows[K]), z[K], 'top', true), sense: 'forward', name: `${nm}.top`, loops: [{ kind: 'outer', uses: Array.from({ length: n }, (_, j) => ({ edge: `r${K}_${j}`, sense: 'forward' })) }] });
    const brep = buildBrep({ source: { family: 'loft', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}.shell`, faces, closed: true }] }] });
    // ∫f dV = ∮ g n_z dA with ∂g/∂z = f, for f in [1, x, y, z, x², y², z², xy, xz, yz].
    const gOf = (x, y, zz) => [zz, x * zz, y * zz, zz * zz / 2, x * x * zz, y * y * zz, zz ** 3 / 3, x * y * zz, x * zz * zz / 2, y * zz * zz / 2];
    const I = Array(10).fill(0), G = gauss(16);
    const bern = (d, t) => d === 1 ? [[1 - t, t], [-1, 1]] : d === 2 ? [[(1 - t) ** 2, 2 * t * (1 - t), t * t], [-2 * (1 - t), 2 - 4 * t, 2 * t]] : [[(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3], [-3 * (1 - t) ** 2, 3 * (1 - t) ** 2 - 6 * t * (1 - t), 6 * t * (1 - t) - 3 * t * t, 3 * t * t]];
    for (const net of nets)
        for (let k = 0; k < K; k++) {
            const dv = v[k + 1] - v[k], du = net.length - 1;
            G.x.forEach((a, ia) => G.x.forEach((b, ib) => {
                const [Bu, dBu] = bern(du, a), [Bv, dBv] = bern(3, b), N = [0, 0, 0, 0], Nu = [0, 0, 0, 0], Nv = [0, 0, 0, 0];
                for (let j = 0; j <= du; j++)
                    for (let m = 0; m < 4; m++) {
                        const h = net[j][3 * k + m];
                        for (let c = 0; c < 4; c++) {
                            N[c] += Bu[j] * Bv[m] * h[c];
                            Nu[c] += dBu[j] * Bv[m] * h[c];
                            Nv[c] += Bu[j] * dBv[m] * h[c] / dv;
                        }
                    }
                const P = [N[0] / N[3], N[1] / N[3], N[2] / N[3]], Su = [0, 1, 2].map(c => (Nu[c] - P[c] * Nu[3]) / N[3]), Sv = [0, 1, 2].map(c => (Nv[c] - P[c] * Nv[3]) / N[3]);
                const nz = Su[0] * Sv[1] - Su[1] * Sv[0], wgt = G.w[ia] * G.w[ib] * dv, g = gOf(P[0], P[1], P[2]);
                for (let q = 0; q < 10; q++)
                    I[q] += wgt * g[q] * nz;
            }));
        }
    // The caps: down at the bottom, up at the top (section moments by Green's theorem).
    for (const [k, sign] of [[0, -1], [K, 1]]) {
        let A = 0, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0;
        for (const b of rows[k])
            G24.x.forEach((t, j) => { const [p, d] = at(b, t), w = G24.w[j], [x, y] = p; A += w * x * d[1]; Sx += w * x * x / 2 * d[1]; Sy -= w * y * y / 2 * d[0]; Sxx += w * x ** 3 / 3 * d[1]; Syy -= w * y ** 3 / 3 * d[0]; Sxy += w * x * x * y / 2 * d[1]; });
        const zc = z[k], m = [zc * A, zc * Sx, zc * Sy, zc * zc / 2 * A, zc * Sxx, zc * Syy, zc ** 3 / 3 * A, zc * Sxy, zc * zc / 2 * Sx, zc * zc / 2 * Sy];
        for (let q = 0; q < 10; q++)
            I[q] += sign * m[q];
    }
    return { brep, mass: density => solidMassFromIntegrals(I, density, 'quadrature') };
}
