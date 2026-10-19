import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, evaluateSurface, evaluateCurve, curveDomain, surfaceDomain, evaluateSurfaceCurvature, buildBrep, checkBrep, brepMassProperties, nurbsOf } from '../dist/index.js';
import { evaluateSurfaceD1 } from '../dist/derivatives.js';

// R11 S0 (D105): the feasibility checkpoint before general shell and offset. The research note's R11.1–R11.3
// (handover/notes/research-r10-r11-fillet-shell-2026-10-18.md) extend today's method — the wall as the union of a slab
// per face (`general-shell.ts`), the shell the body within it — to more faces. Probed here: today's results against
// closed forms (two silent over-thick walls found: a slab grown across a smooth edge, a cylinder slab past a concave
// junction), the same slabs built by hand with the growth rule changed (exact), and the note's NURBS offsets as faces on
// the body's own topology (a closed smooth body's cavity, no Boolean), against Steiner's formula.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const vol = features => out(features).massProperties(1).volumeMM3;
const yzAt = x => ({ origin: [x, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }), xz = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const refused = (features, code, pattern) => assert.throws(() => out(features), e => e.code === code && pattern.test(e.message), String(pattern));
const pol = (c, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];

/** Bodies extruded along X from 0 to L, as unions (not upright, so the general shell takes them). */
const L = 40;
const plate = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [L, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }];
const rodOn = r => [...plate, { id: 'c', kind: 'sketch', profile: 'circle', center: [0, 10], radius: r, plane: yzAt(0) }, { id: 'ce', kind: 'extrude', sketch: 'c', height: L }, { id: 'u', kind: 'union', target: 'pe', tool: 'ce' }];

/**
 * A wall built by hand: slabs as loops in the YZ section (the section's own coordinates: y, z), each extruded along X past
 * both ends, the two end faces' slabs as boxes, all unioned, the body within them. `ends` reach the section's box.
 */
function handShell(bodyId, t, slabs, box) {
  const e = 1.53 * t, o = 1.37 * t, feats = [], ids = [];
  slabs.forEach((segments, k) => { feats.push({ id: `w${k}s`, kind: 'sketch', profile: 'loop', segments, plane: yzAt(-e) }, { id: `w${k}`, kind: 'extrude', sketch: `w${k}s`, height: L + 2 * e }); ids.push(`w${k}`); });
  const [y0, z0, y1, z1] = box, m = 1.6 * t;
  feats.push({ id: 'e0s', kind: 'sketch', profile: 'rectangle', min: [y0 - m, z0 - m], max: [y1 + m, z1 + m], plane: yzAt(-o) }, { id: 'e0', kind: 'extrude', sketch: 'e0s', height: o + t });
  feats.push({ id: 'e1s', kind: 'sketch', profile: 'rectangle', min: [y0 - m, z0 - m], max: [y1 + m, z1 + m], plane: yzAt(L - t) }, { id: 'e1', kind: 'extrude', sketch: 'e1s', height: o + t });
  ids.push('e0', 'e1');
  let acc = ids[0];
  ids.slice(1).forEach((id, k) => { feats.push({ id: `U${k}`, kind: 'union', target: acc, tool: id }); acc = `U${k}`; });
  feats.push({ id: 'S', kind: 'intersect', target: bodyId, tool: acc });
  return feats;
}
const rect = (y0, z0, y1, z1) => [{ kind: 'line', start: [y0, z0] }, { kind: 'line', start: [y1, z0] }, { kind: 'line', start: [y1, z1] }, { kind: 'line', start: [y0, z1] }];
/** An annular sector about c, radii r0 < r1 (r0 = 0: a circular sector), counter-clockwise from a0 to a1. */
const sector = (c, r0, r1, a0, a1) => r0 > 0
  ? [{ kind: 'line', start: pol(c, r0, a0) }, { kind: 'arc', start: pol(c, r1, a0), center: c, direction: 'ccw' }, { kind: 'line', start: pol(c, r1, a1) }, { kind: 'arc', start: pol(c, r0, a1), center: c, direction: 'cw' }]
  : [{ kind: 'line', start: c }, { kind: 'arc', start: pol(c, r1, a0), center: c, direction: 'ccw' }, { kind: 'line', start: pol(c, r1, a1) }];

test('R11 S0 today: the hollow sphere exact; freeform, saddle-trimmed, conic-bounded and mesh faces refused by name; thicken folds through its axis unchecked', () => {
  // A sphere R 10 (a revolved half disc), shelled 1: 4/3 π (R³ − (R − t)³).
  const sphere = [{ id: 's', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, -10] }, { kind: 'arc', start: [0, 10], center: [0, 0], direction: 'cw' }], plane: xz }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
  const hollow = vol([...sphere, { id: 'sh', kind: 'shell', target: 'r', thickness: 1 }]);
  assert.ok(Math.abs(hollow / (4 / 3 * Math.PI * (1000 - 729)) - 1) < 1e-9, `${hollow}`);
  // A SubD body: every face freeform (R11.2's case). (Refused at S0; R11.2a, D110, shells it as its offset cavity.)
  const CUBE = { positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10], faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
  assert.equal(out([{ id: 'c', kind: 'subd', cage: CUBE }, { id: 'sh', kind: 'shell', target: 'c', thickness: 1 }]).brep.shells.length, 2);
  // A pipe tee filleted (R10.2a): refused at its branch, a cylinder trimmed by the junction's saddle, before its fillet face.
  const tee = [{ id: 'as', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: yzAt(0) }, { id: 'a', kind: 'extrude', sketch: 'as', height: 60 }, { id: 'bs', kind: 'sketch', profile: 'circle', center: [30, 0], radius: 5 }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 25 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }, { id: 'f', kind: 'fillet', target: 'u', edges: ['a.side0#1|b.side0#2#4'], radius: 2 }];
  refused([...tee, { id: 'sh', kind: 'shell', target: 'f', thickness: 1 }], 'CAPABILITY', /trimmed by a curve other than its rulings and circles/);
  // A box edge with a conic fillet (R10.5b, no shell history recorded): its end faces are bounded by the conic.
  const box = [{ id: 'q', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 'q', height: 20 }];
  refused([...box, { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.top'], radius: 3, section: { kind: 'conic', rho: 0.5 } }, { id: 'sh', kind: 'shell', target: 'f', thickness: 2, open: ['e.bottom'] }], 'CAPABILITY', /not a line or an arc/);
  // A mesh body (an octahedron of facets).
  const P = [10, 0, 0, -10, 0, 0, 0, 10, 0, 0, -10, 0, 0, 0, 10, 0, 0, -10], I = [0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5];
  refused([{ id: 'm', kind: 'mesh', positions: P, indices: I, representation: 'facets' }, { id: 'sh', kind: 'shell', target: 'm', thickness: 1 }], 'CAPABILITY', /faceted \(mesh\) faces are not supported yet/);
  // thicken: a quarter cylinder R 10 thickened 12 towards its axis — its inner sheet crosses the axis (radius 10 − 12 → 2 on
  // the far side). Accepted as a valid solid (the mesh's topology is sound); nothing checks t·κ ≥ 1 (R11.3 refuses it).
  const w = Math.SQRT1_2, QUARTER = { degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[10, 0, 0], [10, 10, 0]], [[10, 0, 10], [10, 10, 10]], [[0, 0, 10], [0, 10, 10]]], weights: [[1, 1], [w, w], [1, 1]] };
  const folded = out([{ id: 't', kind: 'thicken', surface: QUARTER, thickness: 12 }]);
  assert.equal(folded.validate().valid, true);
  assert.ok(Math.abs(Math.min(...folded.brep.vertices.map(v => Math.hypot(v.point[0], v.point[2]))) - 2) < 1e-9, 'the inner sheet has passed through the axis');
});

test('R11 S0 then and now: a slab grown across a smooth edge into a concave face over-thickened the wall — the same slabs not grown there are exact, as the shell now is (D106)', () => {
  // A rod R 5 (axis along X at the plate's top) on a plate, both junctions filleted 2 (R10.1, closed form): a prism along X,
  // so its hollow is the section eroded, times L − 2t. The section has no reflex corner (its joints are tangent; four
  // convex right-angled corners), so the eroded area is A − P t + t² (Σ cot(α/2) + ½ ∫κ ds) = A − P t + 4t² (∫κ ds = 0).
  const R = 5, rf = 2, body = [...rodOn(R), { id: 'f', kind: 'fillet', target: 'u', edges: ['ce.side0|pe.top#1', 'ce.side0|pe.top#2'], radius: rf }];
  const yc = Math.sqrt((R + rf) ** 2 - rf ** 2), phi = Math.atan2(rf, yc), fil = yc * rf / 2 - rf * rf * Math.atan2(yc, rf) / 2 - R * R * Math.atan2(rf, yc) / 2;
  const A = 400 + Math.PI * R * R / 2 + 2 * fil, P = 40 + 20 + 2 * (20 - yc) + 2 * rf * (Math.PI / 2 - phi) + R * (Math.PI - 2 * phi);
  assert.ok(Math.abs(vol(body) / (A * L) - 1) < 1e-12);
  const exact = t => A * L - (A - P * t + 4 * t * t) * (L - 2 * t);
  // Today's slabs as general-shell.ts makes them — each face's region grown by t within its surface — and with no growth
  // across the four tangent edges (T1 on the plate, T2 on the rod, both sides). The fillets' slabs are annular sectors about
  // their centres F; the rod's about its axis.
  const hand = (t, grow) => {
    const o = 1.37 * t, g = grow ? t : 0, F1 = [yc, 10 + rf], F2 = [-yc, 10 + rf], ri = Math.max(rf - o, rf / 2), dF = grow ? t / ri : 0, dR = grow ? t / (R - t) : 0;
    return handShell('f', t, [rect(-20 - t, -o, 20 + t, t), rect(20 - t, -t, 20 + o, 10 + t), rect(-20 - o, -t, -20 + t, 10 + t), rect(yc - g, 10 - t, 20 + t, 10 + o), rect(-20 - t, 10 - t, -yc + g, 10 + o),
      sector(F1, ri, rf + t, -Math.PI + phi - dF, -Math.PI / 2 + dF), sector(F2, ri, rf + t, -Math.PI / 2 - dF, -phi + dF), sector([0, 10], R - t, R + o, phi - dR, Math.PI - phi + dR)], [-20, 0, 20, 10 + R]);
  };
  for (const [t, over] of [[0.5, 6.9e-4], [1, 2.6e-3]]) {
    // (At S0 the general shell was 6.9e-4 and 2.65e-3 over; R11.1a, D106, stops its slabs at smooth edges: exact.)
    const now = vol([...body, { id: 'sh', kind: 'shell', target: 'f', thickness: t }]);
    assert.ok(Math.abs(now / exact(t) - 1) < 1e-12, `general shell t ${t}: ${(now - exact(t)) / exact(t)}`);
    // The hand-built grown slabs (the S0 general shell's to the digit): the growth was the cause.
    assert.ok((vol([...body, ...hand(t, true)]) - exact(t)) / exact(t) > over, `grown by hand, t ${t}`);
    // Not grown across the smooth edges: the slabs meet there in one plane (the normal at the contact), coincident side
    // walls the analytic Boolean takes exactly.
    const fixed = out([...body, ...hand(t, false)]);
    assert.equal(fixed.validate().valid, true);
    assert.ok(Math.abs(fixed.massProperties(1).volumeMM3 / exact(t) - 1) < 1e-12, `not grown, t ${t}`);
  }
  // (At S0 the error grew with the wall: 7.9 % at t 2.5.)
  const t = 2.5, now = vol([...body, { id: 'sh', kind: 'shell', target: 'f', thickness: t }]);
  assert.ok(Math.abs(now / exact(t) - 1) < 1e-12);
});

test('R11 S0 then and now: a cylinder slab past a concave junction — a rod thinner than the wall became a ring reaching into the plate; exact now (D106)', () => {
  // A rod r 1 half sunk in a plate, a wall of 2: the rod is all wall, so the hollow is the plate's eroded box, (L − 2t)²(10 − 2t).
  const r = 1, t = 2, body = rodOn(r), exact = vol(body) - (L - 2 * t) * (L - 2 * t) * (10 - 2 * t);
  // At S0 general-shell.ts clamped the rod slab's inner radius to 1e-3 r, so its angular growth t / (1e-3 r) closed it into
  // a full ring of outer radius r + 1.37t = 3.74 about the axis: 1.74 below the plate's top under the rod, past the wall
  // (3.4 % over). R11.1a (D106): the slab reaches the axis, stops at the junction, and its corner is filled apart — exact.
  const now = vol([...body, { id: 'sh', kind: 'shell', target: 'u', thickness: t }]);
  assert.ok(Math.abs(now / exact - 1) < 1e-12, `${(now - exact) / exact}`);
  // By hand, the rod's slab the half disc of r + 1.37t above the plate, its inner band not grown (none is left: r < t), the
  // plate's top grown across the junction (a sharp, concave edge) by t: exact.
  const o = 1.37 * t, d = 0.41 * t;
  const fixed = out([...body, ...handShell('u', t, [rect(-20 - t, -o, 20 + t, t), rect(20 - t, -t, 20 + o, 10 + t), rect(-20 - o, -t, -20 + t, 10 + t),
    rect(r - t, 10 - t, 20 + t, 10 + d), rect(r, 10 - d, 20 + o, 10 + o), rect(-20 - t, 10 - t, -r + t, 10 + d), rect(-20 - o, 10 - d, -r, 10 + o),
    sector([0, 10], 0, r + d, 0, Math.PI), sector([0, 10], r - Math.min(d, r / 2), r + o, 0, Math.PI)], [-20, 0, 20, 10 + r])]);
  assert.equal(fixed.validate().valid, true);
  assert.ok(Math.abs(fixed.massProperties(1).volumeMM3 / exact - 1) < 1e-12, `${fixed.massProperties(1).volumeMM3} vs ${exact}`);
  // A thicker rod (r 5, t 1): the hollow under the sharp (intersection) join is the eroded box and the disc of r − t about
  // the axis above z = 10 − t. At S0 the wall was 1.1 % over even that join's: the rod slab's outer band, carried round past
  // the junction by its angular growth t / (r − t), lay inside the plate. Now exact (R11.1a, D106).
  const R = 5, T = 1, rho = R - T, seg = Math.PI * rho * rho - (rho * rho * Math.acos(T / rho) - T * Math.sqrt(rho * rho - T * T));
  const sharp = vol(rodOn(R)) - ((L - 2 * T) * (10 - 2 * T) + seg) * (L - 2 * T), thick = vol([...rodOn(R), { id: 'sh', kind: 'shell', target: 'u', thickness: T }]);
  assert.ok(Math.abs(thick / sharp - 1) < 1e-12, `${(thick - sharp) / sharp}`);
});

// ---- R11.2: offsets of B-spline faces, as faces on the body's own topology ----

/** Global B-spline interpolation at the Greville points of a given knot vector (degree p), rows of points at once. */
function spanOf(n, p, u, U) { if (u >= U[n + 1]) return n; let lo = p, hi = n + 1, mid = (lo + hi) >> 1; while (u < U[mid] || u >= U[mid + 1]) { if (u < U[mid]) hi = mid; else lo = mid; mid = (lo + hi) >> 1; } return mid; }
function basisAt(i, u, p, U) { const N = [1], left = [], right = []; for (let j = 1; j <= p; j++) { left[j] = u - U[i + 1 - j]; right[j] = U[i + j] - u; let saved = 0; for (let r = 0; r < j; r++) { const tmp = N[r] / (right[r + 1] + left[j - r]); N[r] = saved + right[r + 1] * tmp; saved = left[j - r] * tmp; } N[j] = saved; } return N; }
function solveRows(A, B) {
  const n = A.length, w = B[0].length, M = A.map((r, i) => [...r, ...B[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) if (r !== c && M[r][c]) { const f = M[r][c] / M[c][c]; for (let k = c; k < n + w; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r.slice(n).map(x => x / r[i]));
}
const greville = (K, p) => Array.from({ length: K.length - p - 1 }, (_, i) => { let s = 0; for (let k = 1; k <= p; k++) s += K[i + k]; return s / p; });
function interpolate(K, p, rows) {
  const g = greville(K, p), n = g.length - 1, A = g.map(u => { const row = Array(n + 1).fill(0), i = spanOf(n, p, u, K), N = basisAt(i, u, p, K); for (let k = 0; k <= p; k++) row[i - p + k] = N[k]; return row; });
  const m = rows[0].length;
  return solveRows(A, rows.map(r => r.flat())).map(r => Array.from({ length: m }, (_, j) => [r[3 * j], r[3 * j + 1], r[3 * j + 2]]));
}
/** A knot vector refined into r pieces a span; `offset` adds each interior knot once more (an offset is one order less continuous there). */
function refined(K, r, offset) {
  const outK = [];
  for (let i = 0; i < K.length; i++) { outK.push(K[i]); if (i + 1 < K.length && K[i + 1] > K[i]) for (let k = 1; k < r; k++) outK.push(K[i] + (K[i + 1] - K[i]) * k / r); }
  if (offset) for (const x of new Set(K)) if (x > K[0] && x < K[K.length - 1]) outK.push(x);
  return outK.sort((a, b) => a - b);
}
function fitSurface(KU, KV, f, id) {
  const gu = greville(KU, 3), gv = greville(KV, 3), a = interpolate(KU, 3, gu.map(u => gv.map(v => f(u, v)))), b = interpolate(KV, 3, gv.map((_, j) => a.map(r => r[j])));
  const cp = a.map((_, i) => b.map(r => r[i]));
  return { kind: 'surface', id, degreeU: 3, degreeV: 3, knotsU: KU, knotsV: KV, controlPoints: cp, weights: cp.map(r => r.map(() => 1)) };
}
function fitCurve(K, f, id) { const P = interpolate(K, 3, greville(K, 3).map(x => [f(x)])).map(r => r[0]); return { kind: 'curve', id, degree: 3, knots: K, controlPoints: P, weights: P.map(() => 1) }; }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The point t inside a face's surface at (u, v): along its outward normal (from the first derivatives; sense applied). */
function inward(S, sense, t, u, v) { const d = evaluateSurfaceD1(S, u, v), n = cross(d.du, d.dv), l = Math.hypot(...n) * sense; return [d.point[0] - t * n[0] / l, d.point[1] - t * n[1] / l, d.point[2] - t * n[2] / l]; }
/** The nearest point of a surface to p, by a grid then Newton. */
function project(S, p) {
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(S); let best = [u0, v0], bd = Infinity;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) { const u = u0 + (u1 - u0) * i / 24, v = v0 + (v1 - v0) * j / 24, d = dist(evaluateSurface(S, u, v), p); if (d < bd) { bd = d; best = [u, v]; } }
  let [u, v] = best;
  for (let it = 0; it < 40; it++) {
    const d = evaluateSurfaceD1(S, u, v), r = [d.point[0] - p[0], d.point[1] - p[1], d.point[2] - p[2]], a = d.du.reduce((s, x) => s + x * x, 0), b = d.du.reduce((s, x, k) => s + x * d.dv[k], 0), c = d.dv.reduce((s, x) => s + x * x, 0);
    const g1 = r.reduce((s, x, k) => s + x * d.du[k], 0), g2 = r.reduce((s, x, k) => s + x * d.dv[k], 0), det = a * c - b * b; if (!(Math.abs(det) > 1e-30)) break;
    const du = (c * g1 - b * g2) / det, dv = (a * g2 - b * g1) / det; u = Math.min(u1, Math.max(u0, u - du)); v = Math.min(v1, Math.max(v0, v - dv)); if (Math.abs(du) + Math.abs(dv) < 1e-15) break;
  }
  return [u, v];
}
/**
 * The body's cavity t inside it, on the body's own topology: every face's surface offset and fitted (cubic, its knots
 * refined `s` times as far as the kernel's 16 control points allow, each interior knot once more), every edge and vertex
 * offset along the normal of a face it bounds. The fit's largest deviation from the exact offset on a 49 × 49 grid.
 */
function cavity(b, t, s, offsetKnots = true) {
  const loops = new Map(b.loops.map(l => [l.id, l])), coedges = new Map(b.coedges.map(c => [c.id, c])), faceOf = new Map();
  for (const f of b.faces) for (const lid of f.loops) for (const cid of loops.get(lid).coedges) if (!faceOf.has(coedges.get(cid).edge)) faceOf.set(coedges.get(cid).edge, f);
  let deviation = 0;
  const faces = b.faces.map((f, k) => {
    const S = nurbsOf(f), sense = f.sense === 'forward' ? 1 : -1, pick = K => { let r = s; while (r > 1 && refined(K, r, offsetKnots).length - 4 > 16) r--; return r; };
    const F = fitSurface(refined(S.knotsU, pick(S.knotsU), offsetKnots), refined(S.knotsV, pick(S.knotsV), offsetKnots), (u, v) => inward(S, sense, t, u, v), `cav${k}`);
    const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(S);
    for (let i = 0; i <= 48; i++) for (let j = 0; j <= 48; j++) { const u = u0 + (u1 - u0) * i / 48, v = v0 + (v1 - v0) * j / 48; deviation = Math.max(deviation, dist(inward(S, sense, t, u, v), evaluateSurface(F, u, v))); }
    return { f, F };
  });
  const along = (f, p) => { const S = nurbsOf(f), [u, v] = project(S, p); return inward(S, f.sense === 'forward' ? 1 : -1, t, u, v); };
  const vertices = new Map();
  for (const e of b.edges) { const [c0, c1] = curveDomain(e.curve); e.vertices.forEach((id, k) => { if (!vertices.has(id)) vertices.set(id, along(faceOf.get(e.id), evaluateCurve(e.curve, k ? c1 : c0))); }); }
  const edges = b.edges.map(e => {
    const [c0, c1] = curveDomain(e.curve), K = refined(e.curve.knots, Math.max(1, Math.min(2 * s, Math.floor(60 / Math.max(1, new Set(e.curve.knots).size - 1)))), offsetKnots);
    return { id: e.id, vertices: e.vertices, curve: fitCurve(K, x => x <= c0 ? vertices.get(e.vertices[0]) : x >= c1 ? vertices.get(e.vertices[1]) : along(faceOf.get(e.id), evaluateCurve(e.curve, x)), `cave_${e.id}`) };
  });
  const inner = buildBrep({ toleranceMM: Math.max(1e-6, 2 * deviation), source: { family: 'shell', id: 'cavity' }, vertices: b.vertices.map(v => ({ id: v.id, point: vertices.get(v.id) })), edges,
    bodies: [{ id: 'cavity', kind: 'solid', shells: b.shells.map(sh => ({ id: sh.id, closed: true, faces: sh.faces.map(fid => { const x = faces.find(q => q.f.id === fid); return { id: fid, surface: x.F, sense: x.f.sense,
      loops: x.f.loops.map(lid => { const l = loops.get(lid); return { kind: l.kind, uses: l.coedges.map(cid => ({ edge: coedges.get(cid).edge, sense: coedges.get(cid).sense })) }; }) }; }) })) }] });
  return { inner, deviation, faces: faces.map(x => ({ F: x.F, sense: x.f.sense === 'forward' ? 1 : -1 })) };
}
const GL8 = [[-0.9602898564975363, 0.1012285362903763], [-0.7966664774136267, 0.2223810344533745], [-0.5255324099163290, 0.3137066458778873], [-0.1834346424956498, 0.3626837833783620], [0.1834346424956498, 0.3626837833783620], [0.5255324099163290, 0.3137066458778873], [0.7966664774136267, 0.2223810344533745], [0.9602898564975363, 0.1012285362903763]];
/** ∫ over each face's whole domain, span by span (`pieces` × `pieces` a span), Gauss–Legendre 8 × 8: f(S, sense, u, v) du dv, f a vector. */
function overFaces(faces, pieces, f) {
  let I = null;
  for (const { S, sense } of faces) {
    const ku = [...new Set(S.knotsU)], kv = [...new Set(S.knotsV)];
    for (let a = 0; a + 1 < ku.length; a++) for (let c = 0; c + 1 < kv.length; c++) for (let su = 0; su < pieces; su++) for (let sv = 0; sv < pieces; sv++) {
      const hu = (ku[a + 1] - ku[a]) / pieces, hv = (kv[c + 1] - kv[c]) / pieces;
      for (const [x, wx] of GL8) for (const [y, wy] of GL8) {
        const w = hu * hv / 4 * wx * wy, value = f(S, sense, ku[a] + hu * (su + (x + 1) / 2), kv[c] + hv * (sv + (y + 1) / 2));
        if (!I) I = value.map(() => 0);
        for (let k = 0; k < value.length; k++) I[k] += value[k] * w;
      }
    }
  }
  return I;
}
/** The volume inside closed whole-patch faces (divergence theorem over their natural domains). */
const enclosed = faces => overFaces(faces, 1, (S, sense, u, v) => { const d = evaluateSurfaceD1(S, u, v), n = cross(d.du, d.dv); return [sense * (d.point[0] * n[0] + d.point[1] * n[1] + d.point[2] * n[2]) / 3]; })[0];
/** |S_u × S_v|. */
const jacobian = (S, u, v) => { const d = evaluateSurfaceD1(S, u, v); return Math.hypot(...cross(d.du, d.dv)); };
/**
 * Steiner's data of a closed smooth body: its area A, ∫H dA (H > 0 where convex, outward normals) and ∫K dA (2πχ); and
 * where its largest convex principal curvature is, among the quadrature's points.
 */
function steiner(b) {
  const faces = b.faces.map(f => ({ S: nurbsOf(f), sense: f.sense === 'forward' ? 1 : -1 })), at = { k: -Infinity, S: null, sense: 1, u: 0, v: 0 };
  const [A, M, K] = overFaces(faces, 2, (S, sense, u, v) => {
    const r = evaluateSurfaceCurvature(S, u, v), j = jacobian(S, u, v);
    for (const k of r.principalCurvaturesPerMM) if (-sense * k > at.k) Object.assign(at, { k: -sense * k, S, sense, u, v });
    return [j, -sense * r.meanCurvaturePerMM * j, r.gaussianCurvaturePerMM2 * j];
  });
  return { A, M, K, kmax: at.k, at };
}
const CUBE = { positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10], faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
function torusCage(n, m, R = 20, r = 6) {
  const positions = [], faces = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = 2 * Math.PI * i / n, c = 2 * Math.PI * j / m; positions.push((R + r * Math.cos(c)) * Math.cos(a), (R + r * Math.cos(c)) * Math.sin(a), r * Math.sin(c)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const i1 = (i + 1) % n, j1 = (j + 1) % m; faces.push([i * m + j, i1 * m + j, i1 * m + j1, i * m + j1]); }
  return { positions, faces };
}

test('R11 S0 (R11.2) a closed SubD body\'s cavity as its faces offset and fitted on its own topology, no Boolean: Steiner\'s V − At + Mt² − (2πχ/3)t³', () => {
  const made = [];
  for (const [name, cage, t, s, chi, fitBound, volBound] of [['cube (24 caps, C1 knots)', CUBE, 0.5, 6, 2, 2e-5, 5e-6], ['torus 8 × 6', torusCage(8, 6), 1, 6, 0, 1e-4, 1e-5]]) {
    const o = out([{ id: 's', kind: 'subd', cage }]), b = o.brep, V = o.massProperties(1).volumeMM3, { A, M, K } = steiner(b);
    assert.ok(Math.abs(K / (2 * Math.PI) - chi) < 1e-4, `${name}: χ ${K / 2 / Math.PI}`);
    const expected = V - A * t + M * t * t - K / 3 * t ** 3;
    // The exact offset (not fitted) encloses Steiner's volume: the oracle holds on this body.
    const [exactOffset] = overFaces(b.faces.map(f => ({ S: nurbsOf(f), sense: f.sense === 'forward' ? 1 : -1 })), 2, (S, sense, u, v) => {
      const e = 1e-6, q = (x, y) => inward(S, sense, t, x, y), P = q(u, v), Qu = q(u + e, v).map((x, k) => (x - q(u - e, v)[k]) / (2 * e)), Qv = q(u, v + e).map((x, k) => (x - q(u, v - e)[k]) / (2 * e)), N = cross(Qu, Qv);
      return [sense * (P[0] * N[0] + P[1] * N[1] + P[2] * N[2]) / 3];
    });
    assert.ok(Math.abs(exactOffset / expected - 1) < 1e-8, `${name}: exact offset ${exactOffset} vs ${expected}`);
    const { inner, deviation, faces } = cavity(b, t, s);
    made.push({ inner, faces });
    assert.equal(checkBrep(inner).valid, true, name);
    assert.ok(deviation < fitBound, `${name}: fit ${deviation}`);
    assert.ok(Math.abs(enclosed(faces.map(x => ({ S: x.F, sense: x.sense }))) / expected - 1) < volBound, `${name}: fitted cavity`);
  }
  // Findings, recorded: (a) without the extra knot the fit cannot follow the offset across a cap's C1 knot (u = 0.25).
  const cube = out([{ id: 's', kind: 'subd', cage: CUBE }]).brep;
  assert.ok(cavity(cube, 0.5, 4, false).deviation > 3e-4 && cavity(cube, 0.5, 4).deviation < 1e-4);
  // (b) at S0 the kernel's quadrature did not take these fitted faces as whole patches (their edges lie within the fit's
  // tolerance of the patch boundaries, not on them): its mass of the cube's cavity was 7.7e-5 off the faces' own integral.
  // D110: the whole-patch test takes an edge within its own tolerance — the same to rounding.
  const { inner, faces } = made[0], mass = brepMassProperties(inner, 1).volumeMM3, own = enclosed(faces.map(x => ({ S: x.F, sense: x.sense })));
  assert.ok(Math.abs(mass / own - 1) < 1e-12, `${mass} vs ${own}`);
});

test('R11 S0 (R11.2) folding: t·κmax ≥ 1 on the convex side predicts where the offset map turns over', () => {
  const b = out([{ id: 's', kind: 'subd', cage: CUBE }]).brep, { kmax, at } = steiner(b), limit = 1 / kmax;
  assert.ok(limit > 1.5 && limit < 1.6, `${limit}`);
  // The offset map's Jacobian against the face's, (q_u × q_v)·(p_u × p_v) = (1 − tκ1)(1 − tκ2)|p_u × p_v|², by differences.
  const J = (S, sense, t, u, v) => {
    const e = 1e-7, q = (x, y) => inward(S, sense, t, x, y), Qu = q(u + e, v).map((x, k) => x - q(u - e, v)[k]), Qv = q(u, v + e).map((x, k) => x - q(u, v - e)[k]), d = evaluateSurfaceD1(S, u, v), n = cross(Qu, Qv), m = cross(d.du, d.dv);
    return n[0] * m[0] + n[1] * m[1] + n[2] * m[2];
  };
  // Where κmax is among interior points (beside a cap's extraordinary corner), the map turns over between t 1.5 and 1.6,
  // as predicted. (D110: the tightest curvature lies on a cap's side, 1.480 mm, which interior points do not reach.)
  assert.ok(J(at.S, at.sense, 1.5, at.u, at.v) > 0 && J(at.S, at.sense, 1.6, at.u, at.v) < 0);
  // At 1.5, nowhere on an 8 × 8 grid of interior points a span.
  const turned = b.faces.some(f => {
    const S = nurbsOf(f), sense = f.sense === 'forward' ? 1 : -1, ku = [...new Set(S.knotsU)], kv = [...new Set(S.knotsV)];
    for (let a = 0; a + 1 < ku.length; a++) for (let c = 0; c + 1 < kv.length; c++) for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (J(S, sense, 1.5, ku[a] + (ku[a + 1] - ku[a]) * (i + 0.5) / 8, kv[c] + (kv[c + 1] - kv[c]) * (j + 0.5) / 8) <= 0) return true;
    return false;
  });
  assert.equal(turned, false);
});
