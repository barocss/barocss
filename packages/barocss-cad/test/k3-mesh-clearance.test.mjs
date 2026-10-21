import test from 'node:test';
import assert from 'node:assert/strict';
import { meshClearance, triangleBvh, nearestDistance2, meshDistance } from '../dist/index.js';

// K3 (D142): the exact least distance between two meshes' surfaces, with the closest points. Oracles, none of them the
// kernel's: an all-pairs brute force written here differently (a point to a triangle by its plane and its edges; segments
// by their lines' interior solution or the four end distances; a crossing by an edge's sign change through a triangle),
// closed forms (two boxes, two crossed edges 16 − 10√2, spheres apart), and the witnesses checked on their own meshes.

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const tri = (P, I, k) => [0, 1, 2].map(v => [P[3 * I[3 * k + v]], P[3 * I[3 * k + v] + 1], P[3 * I[3 * k + v] + 2]]);
function pointSegment(p, a, b) { const d = sub(b, a), dd = dot(d, d), t = dd > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / dd)) : 0; return Math.hypot(...sub(p, add(a, scl(d, t)))); }
function pointTriangle(p, [a, b, c]) {
  // (A triangle of no area — a sphere mesh's poles — is its edges.)
  const n = cross(sub(b, a), sub(c, a)), nn = dot(n, n), s = nn > 0 ? dot(sub(p, a), n) / nn : 0, q = sub(p, scl(n, s));
  if (nn > 0 && [[a, b], [b, c], [c, a]].every(([u, v]) => dot(cross(sub(v, u), sub(q, u)), n) >= 0)) return Math.abs(s) * Math.sqrt(nn);
  return Math.min(pointSegment(p, a, b), pointSegment(p, b, c), pointSegment(p, c, a));
}
function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), b = dot(d1, d2), c = dot(d1, r), f = dot(d2, r), den = a * e - b * b;
  let best = Math.min(pointSegment(p1, p2, q2), pointSegment(q1, p2, q2), pointSegment(p2, p1, q1), pointSegment(q2, p1, q1));
  if (den > 1e-14 * a * e) { const s = (b * f - c * e) / den, t = (a * f - b * c) / den; if (s > 0 && s < 1 && t > 0 && t < 1) best = Math.min(best, Math.hypot(...sub(add(p1, scl(d1, s)), add(p2, scl(d2, t))))); }
  return best;
}
function crosses(p, q, [a, b, c]) {
  const n = cross(sub(b, a), sub(c, a)), sp = dot(n, sub(p, a)), sq = dot(n, sub(q, a));
  if (sp * sq > 0 || sp === sq) return false;
  const x = add(p, scl(sub(q, p), sp / (sp - sq)));
  return [[a, b], [b, c], [c, a]].every(([u, v]) => dot(cross(sub(v, u), sub(x, u)), n) >= 0);
}
function triTri(T, U) {
  for (let e = 0; e < 3; e++) if (crosses(T[e], T[(e + 1) % 3], U) || crosses(U[e], U[(e + 1) % 3], T)) return 0;
  let best = Infinity;
  for (let v = 0; v < 3; v++) best = Math.min(best, pointTriangle(T[v], U), pointTriangle(U[v], T));
  for (let e = 0; e < 3; e++) for (let f = 0; f < 3; f++) best = Math.min(best, segSeg(T[e], T[(e + 1) % 3], U[f], U[(f + 1) % 3]));
  return best;
}
function brute(PA, IA, PB, IB) { let best = Infinity; for (let i = 0; i < IA.length / 3; i++) for (let j = 0; j < IB.length / 3; j++) best = Math.min(best, triTri(tri(PA, IA, i), tri(PB, IB, j))); return best; }
/** The witnesses: |pA − pB| is the distance, pA on mesh A's surface and pB on B's (to rounding). */
function witnesses(c, PA, IA, PB, IB, what) {
  assert.ok(Math.abs(Math.hypot(...sub(c.pointA, c.pointB)) - c.distanceMM) <= 1e-9 * Math.max(1, c.distanceMM), `${what}: |pA − pB|`);
  assert.ok(nearestDistance2(triangleBvh(PA, IA), ...c.pointA) <= 1e-18, `${what}: pA on A`);
  assert.ok(nearestDistance2(triangleBvh(PB, IB), ...c.pointB) <= 1e-18, `${what}: pB on B`);
}
/** A bumpy closed sphere of 2n² triangles, centre (cx, 0, 0). */
function bumpy(n, R, cx = 0) {
  const P = [], I = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j < n; j++) { const th = Math.PI * i / n, ph = 2 * Math.PI * j / n, r = R + 0.3 * Math.sin(5 * th) * Math.cos(3 * ph); P.push(cx + r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n; I.push(a, c, b, b, c, d); }
  return { P: Float64Array.from(P), I: Uint32Array.from(I) };
}
/** A box [x0, x1] × [y0, y1] × [z0, z1]'s 12 triangles. */
function box(x0, y0, z0, x1, y1, z1) {
  const P = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  return { P: Float64Array.from(P), I: Uint32Array.from([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]) };
}
const turned = (m, axis, deg, off = [0, 0, 0]) => { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180), P = Float64Array.from(m.P); for (let i = 0; i < P.length; i += 3) { const [x, y, z] = [P[i], P[i + 1], P[i + 2]], q = axis === 'x' ? [x, c * y - s * z, s * y + c * z] : axis === 'y' ? [c * x + s * z, y, -s * x + c * z] : [c * x - s * y, s * x + c * y, z]; P[i] = q[0] + off[0]; P[i + 1] = q[1] + off[1]; P[i + 2] = q[2] + off[2]; } return { P, I: m.I }; };

test('K3: random triangle soups, apart and crossing — equal to the all-pairs brute force; the witnesses on their meshes', () => {
  const r = rng(11); let crossing = 0, apart = 0;
  for (let trial = 0; trial < 60; trial++) {
    const soup = (n, off) => { const P = [], I = []; for (let t = 0; t < n; t++) { const c = [r() * 10 + off[0], r() * 10 + off[1], r() * 10 + off[2]]; for (let v = 0; v < 3; v++) P.push(c[0] + r() * 4 - 2, c[1] + r() * 4 - 2, c[2] + r() * 4 - 2); I.push(3 * t, 3 * t + 1, 3 * t + 2); } return { P: Float64Array.from(P), I: Uint32Array.from(I) }; };
    const A = soup(5 + trial % 17, [0, 0, 0]), B = soup(5 + (trial * 5) % 13, [r() * 14 - 2, r() * 8, r() * 8]);
    const c = meshClearance(A.P, A.I, B.P, B.I), want = brute(A.P, A.I, B.P, B.I);
    if (want === 0) crossing++; else apart++;
    assert.ok(Math.abs(c.distanceMM - want) <= 1e-9 * Math.max(1, want), `trial ${trial}: ${c.distanceMM} vs ${want}`);
    witnesses(c, A.P, A.I, B.P, B.I, `trial ${trial}`);
  }
  assert.ok(crossing > 5 && apart > 20, `${crossing} crossing, ${apart} apart`);
});

test('K3: closed forms — two boxes (the per-axis gaps), two edges crossed at right angles 16 − 10√2 apart, a box inside a box', () => {
  const r = rng(12);
  for (let k = 0; k < 40; k++) {
    const a = [r() * 10, r() * 10, r() * 10], b = [r() * 10, r() * 10, r() * 10], A = box(...a, ...add(a, [3, 4, 5])), B = box(...b, ...add(b, [2, 3, 2]));
    const gap = [0, 1, 2].map(i => Math.max(0, b[i] - (a[i] + [3, 4, 5][i]), a[i] - (b[i] + [2, 3, 2][i]))), c = meshClearance(A.P, A.I, B.P, B.I);
    assert.ok(Math.abs(c.distanceMM - Math.hypot(...gap)) <= 1e-12, `boxes ${k}: ${c.distanceMM} vs ${Math.hypot(...gap)}`);
  }
  // A 40 × 10 × 10 bar turned 45° about X (its lower edge along X at z −5√2), and one turned 45° about Y raised 16.
  const A = turned(box(-20, -5, -5, 20, 5, 5), 'x', 45), B = turned(box(-5, -20, -5, 5, 20, 5), 'y', 45, [0, 0, 16]);
  const c = meshClearance(A.P, A.I, B.P, B.I);
  assert.ok(Math.abs(c.distanceMM - (16 - 10 * Math.SQRT2)) <= 1e-12, `crossed edges ${c.distanceMM}`);
  assert.ok(Math.abs(c.pointA[0]) < 1e-9 && Math.abs(c.pointA[1]) < 1e-9 && Math.abs(c.pointB[0]) < 1e-9, 'at the crossing over the origin');
  // A box inside another: its surfaces 2 apart (not 0: neither surface crosses the other).
  const outer = box(0, 0, 0, 10, 10, 10), inner = box(2, 3, 4, 7, 7, 7);
  assert.equal(meshClearance(outer.P, outer.I, inner.P, inner.I).distanceMM, 2);
  // Touching faces and overlapping boxes: 0.
  const t1 = box(0, 0, 0, 1, 1, 1), t2 = box(1, 0, 0, 2, 1, 1), t3 = box(0.5, 0.5, 0.5, 3, 3, 3);
  assert.equal(meshClearance(t1.P, t1.I, t2.P, t2.I).distanceMM, 0); assert.equal(meshClearance(t1.P, t1.I, t3.P, t3.I).distanceMM, 0);
});

test('K3: spheres apart — the least distance within the bumps, the brute force on coarse meshes; 28 800 × 28 800 triangles fast; distinct from the one-way meshDistance', () => {
  const A = bumpy(12, 10), B = bumpy(12, 10, 23), c = meshClearance(A.P, A.I, B.P, B.I);
  assert.ok(Math.abs(c.distanceMM - brute(A.P, A.I, B.P, B.I)) <= 1e-12, 'coarse spheres against the brute force');
  witnesses(c, A.P, A.I, B.P, B.I, 'spheres');
  const FA = bumpy(120, 20), FB = bumpy(120, 20, 41), t0 = performance.now(), f = meshClearance(FA.P, FA.I, FB.P, FB.I), ms = performance.now() - t0;
  // Two spheres of radius 20 ± 0.3, centres 41 apart: between 0.4 and 1.6.
  assert.ok(f.distanceMM > 0.39 && f.distanceMM < 1.61, String(f.distanceMM)); assert.ok(ms < 2000, `${ms} ms`);
  // The one-way R9 distance (A's samples to B, the largest) is another quantity: far larger here.
  assert.ok(meshDistance(FA.P, FA.I, FB.P, FB.I).maxMM > 40);
  // Prebuilt trees give the same.
  assert.equal(meshClearance(FA.P, FA.I, FB.P, FB.I, { bvhA: triangleBvh(FA.P, FA.I), bvhB: triangleBvh(FB.P, FB.I) }).distanceMM, f.distanceMM);
  assert.equal(meshClearance(FA.P, FA.I, new Float64Array(0), new Uint32Array(0)).distanceMM, Infinity);
});
