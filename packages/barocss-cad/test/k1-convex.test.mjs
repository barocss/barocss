import test from 'node:test';
import assert from 'node:assert/strict';
import { convexHull, convexDistance, HullError } from '../dist/index.js';

// K1 (D140): the convex hull (quickhull) and the convex distance (GJK), moved down from the studio's robot track.
// Oracles, none of them the kernel's: a brute-force hull (every triple of points with all others on one side is a
// facet, in general position), closed-form volumes (cube, regular octahedron and icosahedron), and a brute-force
// polytope distance (the least over vertex–triangle and edge–edge pairs of the two brute-force hulls, each in closed form).

/** A seeded generator (mulberry32), so the random cases are the same every run. */
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const pt = (P, i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
const flat = pts => pts.flat();

/** The hull's volume by the divergence theorem over its triangles (positive when they face out). */
function hullVolume(h) { let v = 0; for (let t = 0; t < h.indices.length; t += 3) { const a = pt(h.positions, h.indices[t]), b = pt(h.positions, h.indices[t + 1]), c = pt(h.positions, h.indices[t + 2]); v += dot(a, cross(b, c)) / 6; } return v; }
/** A closed, consistently oriented triangle surface: each directed edge once, with its reverse once; V − E + F = 2. */
function assertClosed(h, what) {
  const edges = new Map(); const nt = h.indices.length / 3;
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) { const u = h.indices[3 * t + e], v = h.indices[3 * t + (e + 1) % 3], k = `${u},${v}`; assert.ok(!edges.has(k), `${what}: edge ${k} twice`); edges.set(k, t); }
  for (const k of edges.keys()) { const [u, v] = k.split(','); assert.ok(edges.has(`${v},${u}`), `${what}: edge ${k} has no twin`); }
  assert.equal(h.positions.length / 3 - edges.size / 2 + nt, 2, `${what}: Euler`);
}
/** No point of P in front of any of the hull's facet planes (beyond `tol` times the size). */
function assertInside(P, h, tol, what) {
  const n = P.length / 3;
  for (let t = 0; t < h.indices.length; t += 3) {
    const a = pt(h.positions, h.indices[t]), nrm = cross(sub(pt(h.positions, h.indices[t + 1]), a), sub(pt(h.positions, h.indices[t + 2]), a)), l = Math.hypot(...nrm);
    for (let m = 0; m < n; m++) { const s = (nrm[0] * (P[3 * m] - a[0]) + nrm[1] * (P[3 * m + 1] - a[1]) + nrm[2] * (P[3 * m + 2] - a[2])) / l; if (s > tol) assert.fail(`${what}: point ${m} ${s} in front of a facet`); }
  }
}
/** Brute force: the facets (sorted index triples) of points in general position, each with all other points on one side. */
function bruteFacets(P) {
  const n = P.length / 3, out = new Set();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const a = pt(P, i), nrm = cross(sub(pt(P, j), a), sub(pt(P, k), a)); let pos = 0, neg = 0;
    for (let m = 0; m < n; m++) { if (m === i || m === j || m === k) continue; const s = dot(nrm, sub(pt(P, m), a)); if (s > 0) pos++; else if (s < 0) neg++; }
    if (pos === 0 || neg === 0) out.add(`${i},${j},${k}`);
  }
  return out;
}
/** The kernel's hull triangles as sorted triples of the input points' indices (corners matched by exact coordinates). */
function hullFacets(P, h) {
  const at = new Map(); for (let i = 0; i < P.length / 3; i++) at.set(pt(P, i).join(','), i);
  const out = new Set();
  for (let t = 0; t < h.indices.length; t += 3) { const tri = [0, 1, 2].map(e => at.get(pt(h.positions, h.indices[t + e]).join(','))); assert.ok(tri.every(x => x !== undefined)); out.add(tri.sort((x, y) => x - y).join(',')); }
  return out;
}

test('K1 hull: random points in general position — the facets equal the brute force\'s, outward, closed; every point inside', () => {
  const r = rng(1);
  for (const n of [4, 5, 8, 13, 21, 34, 40]) for (let trial = 0; trial < 6; trial++) {
    const P = Float64Array.from({ length: 3 * n }, () => r() * 20 - 10), h = convexHull(P);
    assert.deepEqual([...hullFacets(P, h)].sort(), [...bruteFacets(P)].sort(), `n ${n} trial ${trial}`);
    assertClosed(h, `n ${n}`);
    // Outward: no input point in front of any facet's plane (beyond rounding).
    for (let t = 0; t < h.indices.length; t += 3) {
      const a = pt(h.positions, h.indices[t]), nrm = cross(sub(pt(h.positions, h.indices[t + 1]), a), sub(pt(h.positions, h.indices[t + 2]), a)), l = Math.hypot(...nrm);
      for (let m = 0; m < n; m++) assert.ok(dot(nrm, sub(pt(P, m), a)) / l <= 1e-9, `n ${n}: a point in front of a facet`);
    }
  }
});

test('K1 hull: closed-form solids — a cube with points on its faces, edges and inside (8 corners, V 1); the octahedron and icosahedron', () => {
  const r = rng(2), pts = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) pts.push([x, y, z]);
  for (let i = 0; i < 60; i++) { const u = r(), v = r(), f = i % 6, ax = f >> 1, side = f & 1, p = [u, v]; p.splice(ax, 0, side); pts.push(p); }
  for (let i = 0; i < 12; i++) { const t = r(), ax = i % 3, p = [i & 1 ? 1 : 0, i & 2 ? 1 : 0]; p.splice(ax, 0, t); pts.push(p); }
  for (let i = 0; i < 100; i++) pts.push([r(), r(), r()]);
  const cube = convexHull(flat(pts));
  assert.equal(cube.positions.length / 3, 8, 'only the corners'); assertClosed(cube, 'cube');
  assert.ok(Math.abs(hullVolume(cube) - 1) < 1e-15, `cube V ${hullVolume(cube)}`);
  const a = 3, oct = convexHull(flat([[a, 0, 0], [-a, 0, 0], [0, a, 0], [0, -a, 0], [0, 0, a], [0, 0, -a]]));
  // Edge a√2, V = √2/3 (a√2)³ = 4a³/3.
  assert.ok(Math.abs(hullVolume(oct) - 4 * a ** 3 / 3) < 1e-12); assert.equal(oct.indices.length / 3, 8);
  const g = (1 + Math.sqrt(5)) / 2, ico = [];
  for (const s of [-1, 1]) for (const t of [-1, 1]) ico.push([0, s, t * g], [s, t * g, 0], [t * g, 0, s]);
  const hi = convexHull(flat(ico)), edge = 2;
  assert.equal(hi.indices.length / 3, 20); assertClosed(hi, 'icosahedron');
  assert.ok(Math.abs(hullVolume(hi) - 5 / 12 * (3 + Math.sqrt(5)) * edge ** 3) < 1e-12, `ico V ${hullVolume(hi)}`);
});

test('K1 hull: points on a sphere (every one extreme) and in a ball — closed, all inside, the volume below the sphere\'s; scale and order do not matter', () => {
  const r = rng(3), sphere = [];
  for (let i = 0; i < 4000; i++) { const z = 2 * r() - 1, f = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); sphere.push([50 * s * Math.cos(f), 50 * s * Math.sin(f), 50 * z]); }
  const t0 = performance.now(), h = convexHull(flat(sphere)), ms = performance.now() - t0;
  assert.equal(h.positions.length / 3, 4000, 'every point on a sphere is a corner'); assertClosed(h, 'sphere');
  const V = hullVolume(h), Vs = 4 / 3 * Math.PI * 50 ** 3;
  assert.ok(V < Vs && V > 0.99 * Vs, `sphere hull V ${V} of ${Vs}`);
  assert.ok(ms < 2000, `4000 extreme points in ${ms} ms`); assertInside(Float64Array.from(flat(sphere)), h, 1e-8, 'sphere');
  // The same points at 1e6 times the size, shuffled: the same corners, scaled.
  const big = sphere.map(p => scl(p, 1e6)).reverse(), hb = convexHull(flat(big));
  assert.equal(hb.positions.length / 3, 4000); assert.ok(Math.abs(hullVolume(hb) / 1e18 - V) <= 1e-9 * V);
  const ball = []; for (let i = 0; i < 100000; i++) { const p = [2 * r() - 1, 2 * r() - 1, 2 * r() - 1]; if (dot(p, p) <= 1) ball.push(p); }
  const t1 = performance.now(), hb2 = convexHull(flat(ball)), ms2 = performance.now() - t1;
  assertClosed(hb2, 'ball'); assertInside(Float64Array.from(flat(ball)), hb2, 1e-9, 'ball'); assert.ok(ms2 < 2000, `${ball.length} points in a ball in ${ms2} ms`);
});

test('K1 hull: refusals, typed — fewer than 4 points, one point, a line, a plane', () => {
  const code = (pts, want) => assert.throws(() => convexHull(flat(pts)), e => e instanceof HullError && e.code === want, want);
  code([[0, 0, 0], [1, 0, 0], [0, 1, 0]], 'TOO_FEW');
  code([[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], 'DEGENERATE');
  code([[0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3], [-1, -1, -1]], 'DEGENERATE');
  code([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0.3, 0.6, 0]], 'DEGENERATE');
});

// ---- the brute-force distance -------------------------------------------------------------------------------------------
/** The least distance from p to triangle abc: inside its prism the plane's, else the least to its three edges. */
function pointTriangle(p, a, b, c) {
  const n = cross(sub(b, a), sub(c, a)), nn = dot(n, n), w = sub(p, a), s = dot(w, n) / nn, q = sub(p, scl(n, s));
  const inside = [[a, b], [b, c], [c, a]].every(([u, v]) => dot(cross(sub(v, u), sub(q, u)), n) >= 0);
  if (inside) return Math.abs(s) * Math.sqrt(nn);
  return Math.min(pointSegment(p, a, b), pointSegment(p, b, c), pointSegment(p, c, a));
}
function pointSegment(p, a, b) { const d = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d))); return Math.hypot(...sub(p, add(a, scl(d, t)))); }
/** Segments: the interior solution of the two lines when it falls inside both, else the least of the four end distances. */
function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), b = dot(d1, d2), c = dot(d1, r), f = dot(d2, r), den = a * e - b * b;
  let best = Math.min(pointSegment(p1, p2, q2), pointSegment(q1, p2, q2), pointSegment(p2, p1, q1), pointSegment(q2, p1, q1));
  if (den > 1e-14 * a * e) { const s = (b * f - c * e) / den, t = (a * f - b * c) / den; if (s > 0 && s < 1 && t > 0 && t < 1) best = Math.min(best, Math.hypot(...sub(add(p1, scl(d1, s)), add(p2, scl(d2, t))))); }
  return best;
}
/** Whether p lies inside (or on) the polytope of facets F over points P. */
function insideFacets(P, F, p) {
  const n = P.length / 3; let c = [0, 0, 0]; for (let i = 0; i < n; i++) c = add(c, pt(P, i)); c = scl(c, 1 / n);
  for (const f of F) { const [i, j, k] = f.split(',').map(Number), a = pt(P, i), nrm = cross(sub(pt(P, j), a), sub(pt(P, k), a)), sc = dot(nrm, sub(c, a)); if (dot(nrm, sub(p, a)) * Math.sign(sc) < -1e-12 * Math.hypot(...nrm)) return false; }
  return true;
}
/** Whether segment pq crosses triangle abc (the segment's ends on opposite sides, the crossing inside by edge signs). */
function segmentCrossesTriangle(p, q, a, b, c) {
  const n = cross(sub(b, a), sub(c, a)), sp = dot(n, sub(p, a)), sq = dot(n, sub(q, a));
  if (sp * sq > 0 || sp === sq) return false;
  const x = add(p, scl(sub(q, p), sp / (sp - sq)));
  return [[a, b], [b, c], [c, a]].every(([u, v]) => dot(cross(sub(v, u), sub(x, u)), n) >= 0);
}
function bruteDistance(A, B) {
  const FA = bruteFacets(A), FB = bruteFacets(B), tri = (P, f) => f.split(',').map(Number).map(i => pt(P, i));
  const verts = P => Array.from({ length: P.length / 3 }, (_, i) => pt(P, i));
  // They meet when a corner of one is inside the other, or an edge of one crosses a facet of the other.
  if (verts(A).some(p => insideFacets(B, FB, p)) || verts(B).some(p => insideFacets(A, FA, p))) return 0;
  const edgesOf = (P, F) => { const E = []; for (const f of F) { const t = tri(P, f); E.push([t[0], t[1]], [t[1], t[2]], [t[2], t[0]]); } return E; };
  for (const [P, F, Q, G] of [[A, FA, B, FB], [B, FB, A, FA]]) for (const [p, q] of edgesOf(P, F)) for (const g of G) { const [a, b, c] = tri(Q, g); if (segmentCrossesTriangle(p, q, a, b, c)) return 0; }
  let best = Infinity;
  for (const f of FB) { const [a, b, c] = tri(B, f); for (const p of verts(A)) best = Math.min(best, pointTriangle(p, a, b, c)); }
  for (const f of FA) { const [a, b, c] = tri(A, f); for (const p of verts(B)) best = Math.min(best, pointTriangle(p, a, b, c)); }
  const edges = (P, F) => { const E = []; for (const f of F) { const t = tri(P, f); E.push([t[0], t[1]], [t[1], t[2]], [t[2], t[0]]); } return E; };
  for (const [p1, q1] of edges(A, FA)) for (const [p2, q2] of edges(B, FB)) best = Math.min(best, segSeg(p1, q1, p2, q2));
  return best;
}

test('K1 distance: random polytopes — GJK against the brute force over vertex–triangle and edge–edge pairs; symmetric', () => {
  const r = rng(4); let apart = 0, met = 0;
  for (let trial = 0; trial < 120; trial++) {
    const nA = 4 + (trial % 9), nB = 4 + ((trial * 7) % 11), sep = r() * 6;
    const dir = [r() - 0.5, r() - 0.5, r() - 0.5], l = Math.hypot(...dir), off = scl(dir, sep / l);
    const A = Float64Array.from({ length: 3 * nA }, () => r() * 4 - 2), B = Float64Array.from({ length: 3 * nB }, (_, i) => r() * 4 - 2 + off[i % 3]);
    const want = bruteDistance(A, B), got = convexDistance(A, B), back = convexDistance(B, A);
    if (want === 0) { met++; assert.ok(got <= 1e-9, `trial ${trial}: overlapping, GJK ${got}`); }
    else { apart++; assert.ok(Math.abs(got - want) <= 1e-9 * Math.max(1, want), `trial ${trial}: GJK ${got} vs brute ${want}`); }
    assert.ok(Math.abs(got - back) <= 1e-9 * Math.max(1, want), `trial ${trial}: not symmetric`);
  }
  assert.ok(apart > 30 && met > 10, `${apart} apart, ${met} meeting`);
});

test('K1 distance: closed forms — axis-aligned boxes (the per-axis gaps), a point and a box, skew segments; touching is 0', () => {
  const box = (lo, hi) => { const o = []; for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) o.push(x, y, z); return o; };
  const r = rng(5);
  for (let i = 0; i < 200; i++) {
    const lo1 = [r() * 10, r() * 10, r() * 10], hi1 = add(lo1, [1 + r() * 3, 1 + r() * 3, 1 + r() * 3]), lo2 = [r() * 10, r() * 10, r() * 10], hi2 = add(lo2, [1 + r() * 3, 1 + r() * 3, 1 + r() * 3]);
    const gap = [0, 1, 2].map(k => Math.max(0, lo2[k] - hi1[k], lo1[k] - hi2[k])), want = Math.hypot(...gap);
    const got = convexDistance(box(lo1, hi1), box(lo2, hi2));
    assert.ok(Math.abs(got - want) <= 1e-9 * Math.max(1, want), `boxes ${i}: ${got} vs ${want}`);
  }
  // A point and a box: the clamped point's distance.
  const p = [5, -2, 7], want = Math.hypot(5 - 1, -2 - 0, 7 - 1);
  assert.ok(Math.abs(convexDistance(p, box([0, 0, 0], [1, 1, 1])) - want) < 1e-12);
  // Skew segments with the common perpendicular inside both: |(p2 − p1)·(d1 × d2)|/|d1 × d2|.
  const p1 = [0, 0, 0], d1 = [4, 1, 0], p2 = [1, -2, 3], d2 = [0.5, 3, 0.2], n = cross(d1, d2), skew = Math.abs(dot(sub(p2, p1), n)) / Math.hypot(...n);
  assert.ok(Math.abs(convexDistance([...p1, ...add(p1, d1)], [...p2, ...add(p2, d2)]) - skew) < 1e-12);
  // Touching faces and a shared corner: 0.
  assert.ok(convexDistance(box([0, 0, 0], [1, 1, 1]), box([1, 0, 0], [2, 1, 1])) <= 1e-10);
  assert.ok(convexDistance(box([0, 0, 0], [1, 1, 1]), box([1, 1, 1], [2, 2, 2])) <= 1e-10);
});
