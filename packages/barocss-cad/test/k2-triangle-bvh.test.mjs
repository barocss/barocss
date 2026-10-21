import test from 'node:test';
import assert from 'node:assert/strict';
import { triangleBvh, rayHit, nearestDistance2, pointTriangleDistance2, facetBvh, classifyPointInFacets, facetBrepFromTriangles, meshDistance } from '../dist/index.js';

// K2 (D141): one triangle hierarchy for the kernel and the studio, its ray and nearest-point queries. Oracles, none of
// them the hierarchy: a brute-force ray over every triangle (Möller–Trumbore, the same arithmetic, so equality is
// exact), a brute-force nearest point over every triangle, closed forms (a box's faces, a sphere's chord), and the
// tree's own invariants (every triangle in exactly one leaf, every box holding its triangles).

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** A bumpy closed sphere of 2n² triangles (radius about R), outward. */
function bumpy(n, R = 30) {
  const P = [], I = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j < n; j++) { const th = Math.PI * i / n, ph = 2 * Math.PI * j / n, r = R + 0.5 * Math.sin(5 * th) * Math.cos(3 * ph); P.push(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n; I.push(a, c, b, b, c, d); }
  return { P: Float64Array.from(P), I: Uint32Array.from(I) };
}
/** The box [0, 10]³'s 12 triangles, outward. */
const BOX = { P: Float64Array.from([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10]), I: Uint32Array.from([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]) };
function bruteRay(P, I, o, d, minT = 1e-6, skip = -1, detTol = 1e-14) {
  let best = Infinity;
  for (let k = 0; k < I.length / 3; k++) {
    if (k === skip) continue;
    const a = 3 * I[3 * k], c = 3 * I[3 * k + 1], f = 3 * I[3 * k + 2];
    const e1 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]], e2 = [P[f] - P[a], P[f + 1] - P[a + 1], P[f + 2] - P[a + 2]];
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (det > -detTol && det < detTol) continue;
    const s = [o[0] - P[a], o[1] - P[a + 1], o[2] - P[a + 2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det; if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det; if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det; if (t > minT && t < best) best = t;
  }
  return best;
}
const bruteNearest2 = (P, I, x, y, z) => { let best = Infinity; for (let k = 0; k < I.length / 3; k++) best = Math.min(best, pointTriangleDistance2(P, I, k, x, y, z)); return best; };

test('K2 tree: every triangle in exactly one leaf, every node\'s box holds its triangles, leaves at most leafSize, depth logarithmic', () => {
  for (const [n, leaf] of [[6, 4], [40, 4], [40, 1], [40, 8]]) {
    const { P, I } = bumpy(n), b = triangleBvh(P, I, { leafSize: leaf }), nt = I.length / 3, seen = new Uint8Array(nt);
    let maxDepth = 0; const todo = [[0, 0]];
    while (todo.length) {
      const [id, depth] = todo.pop(); maxDepth = Math.max(maxDepth, depth);
      for (let i = b.start[id]; i < b.start[id] + b.count[id]; i++) for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) {
        const x = P[3 * I[3 * b.order[i] + v] + k]; assert.ok(x >= b.box[6 * id + k] && x <= b.box[6 * id + 3 + k], 'a box holds its triangles');
      }
      if (b.left[id] >= 0) { todo.push([b.left[id], depth + 1], [b.left[id] + 1, depth + 1]); continue; }
      assert.ok(b.count[id] <= leaf); for (let i = b.start[id]; i < b.start[id] + b.count[id]; i++) seen[b.order[i]]++;
    }
    assert.ok(seen.every(c => c === 1), 'each triangle in one leaf');
    assert.ok(maxDepth <= Math.ceil(Math.log2(nt / leaf)) + 1, `depth ${maxDepth} for ${nt} triangles`);
  }
});

test('K2 rays: equal to the brute force over every triangle — inside out, outside in, misses, skip, minT; d need not be unit', () => {
  const { P, I } = bumpy(40), b = triangleBvh(P, I), r = rng(7);
  for (let k = 0; k < 1500; k++) {
    const z = 2 * r() - 1, ph = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z), d = [s * Math.cos(ph), s * Math.sin(ph), z].map(x => x * (k % 3 === 0 ? 2.5 : 1));
    const o = k % 2 ? [r() * 10 - 5, r() * 10 - 5, r() * 10 - 5] : [r() * 120 - 60, r() * 120 - 60, r() * 120 - 60];
    const skip = k % 5 === 0 ? Math.floor(r() * I.length / 3) : -1, minT = k % 7 === 0 ? 3 : 1e-6;
    assert.equal(rayHit(b, o, d, minT, skip), bruteRay(P, I, o, d, minT, skip), `ray ${k}`);
  }
});

test('K2 rays: axis-parallel through a box face plane — hit (the studio tree lost it: 0·∞ = NaN dropped the box); the box\'s faces in closed form', () => {
  const b = triangleBvh(BOX.P, BOX.I);
  // Straight down at x = 0, the box's own face plane (and its root box's): the top at t 10, through the edge.
  assert.equal(rayHit(b, [0, 5, 20], [0, 0, -1]), 10);
  assert.equal(rayHit(b, [10, 10, 20], [0, 0, -1]), bruteRay(BOX.P, BOX.I, [10, 10, 20], [0, 0, -1]), 'a corner: as the brute force (a vertex hit is rounding\'s to decide)');
  assert.equal(rayHit(b, [10, 5, 20], [0, 0, -1]), 10, 'the far face plane');
  assert.equal(rayHit(b, [10.000001, 5, 20], [0, 0, -1]), Infinity, 'just outside');
  // From inside along each axis: the far face at the gap, exactly.
  for (const [o, d, t] of [[[3, 4, 5], [1, 0, 0], 7], [[3, 4, 5], [-1, 0, 0], 3], [[3, 4, 5], [0, 1, 0], 6], [[3, 4, 5], [0, -1, 0], 4], [[3, 4, 5], [0, 0, 1], 5], [[3, 4, 5], [0, 0, -1], 5]]) assert.equal(rayHit(b, o, d), t);
  // A chord of a sphere's mesh against the closed form: from the centre, the radius within the mesh's chord error.
  const { P, I } = bumpy(160, 30), s = triangleBvh(P, I);
  for (let k = 0; k < 50; k++) { const th = Math.acos(1 - 2 * (k + 0.5) / 50), ph = 2.4 * k, d = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)], t = rayHit(s, [0, 0, 0], d); assert.ok(Math.abs(t - (30 + 0.5 * Math.sin(5 * th) * Math.cos(3 * ph))) < 0.05, `${t}`); }
});

test('K2 nearest: equal to the brute force over every triangle, inside and outside; a bound returns itself when nothing is nearer', () => {
  const { P, I } = bumpy(30), b = triangleBvh(P, I), r = rng(8);
  for (let k = 0; k < 600; k++) {
    const p = [r() * 100 - 50, r() * 100 - 50, r() * 100 - 50];
    assert.equal(nearestDistance2(b, p[0], p[1], p[2]), bruteNearest2(P, I, p[0], p[1], p[2]), `point ${k}`);
  }
  assert.equal(nearestDistance2(b, 0, 0, 0, 1), 1, 'the centre: nothing within 1');
  const d2 = nearestDistance2(b, 0, 0, 0); assert.ok(d2 > 28.4 ** 2 && d2 < 30.6 ** 2);
  assert.equal(nearestDistance2(triangleBvh(BOX.P, BOX.I), 3, 4, 5), 9, 'inside the box: 3 to the face x 0');
  assert.equal(nearestDistance2(triangleBvh(BOX.P, BOX.I), 13, 14, 5), 9 + 16, 'outside: the edge');
});

test('K2 shared: facet classification and the mesh distance on the one tree, as before; 100k triangles built and queried fast', () => {
  const { P, I } = bumpy(40), brep = facetBrepFromTriangles(P, I);
  assert.equal(facetBvh(brep).nodes > 0, true);
  assert.equal(classifyPointInFacets(brep, [0, 0, 0]), 'inside'); assert.equal(classifyPointInFacets(brep, [0, 0, 40]), 'outside');
  // A sphere of radius 25 inside: the mesh distance (one way, its largest) between 4.5 and 5.5 (the bumps ±0.5).
  const inner = bumpy(20, 25), md = meshDistance(inner.P, inner.I, P, I);
  assert.ok(md.maxMM > 4.4 && md.maxMM < 6.1, String(md.maxMM));
  const big = bumpy(224), t0 = performance.now(), bb = triangleBvh(big.P, big.I), built = performance.now() - t0;
  const t1 = performance.now(); let hits = 0; for (let k = 0; k < 20000; k++) { const z = 1 - 2 * (k + 0.5) / 20000, s = Math.sqrt(1 - z * z); if (rayHit(bb, [0.1, 0.2, 0.3], [s * Math.cos(2.4 * k), s * Math.sin(2.4 * k), z]) < Infinity) hits++; }
  const rays = performance.now() - t1;
  assert.equal(hits, 20000); assert.ok(built < 1500 && rays < 1500, `built ${built} ms, 20 000 rays ${rays} ms`);
});
