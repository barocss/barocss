// G25 (G-R10), experimental compute: the kernel's triangle hierarchy packed for WGSL, and the CPU mirror of the shaders'
// two queries on the packed f32 words. Against the kernel's own rayHit and nearestDistance2 on the same meshes: the
// same hit (within f32 rounding of the vertices) and the same nearest distance, a missed ray still missed; boxes rounded
// outward so no f32 vertex leaves its node; the leaf links and counts cover every triangle once; too deep refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { triangleBvh, rayHit, nearestDistance2 } from '@barocss/cad';
import { BVH_NODE_WORDS, BVH_TRIANGLE_WORDS, f32Down, f32Up, packBvh, packedNearestDistance2, packedRayHit } from '../dist/compute/bvhPack.js';

let seed = 11; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
/** A UV sphere of radius r about c (n × 2n quads), and a box, as meshes. */
function sphere(r, c, n) {
  const P = [], I = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= 2 * n; j++) { const th = Math.PI * i / n, ph = Math.PI * j / n; P.push(c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.sin(th) * Math.sin(ph), c[2] + r * Math.cos(th)); }
  const row = 2 * n + 1;
  for (let i = 0; i < n; i++) for (let j = 0; j < 2 * n; j++) { const a = i * row + j, b = a + 1, d = a + row, e = d + 1; I.push(a, d, b, b, d, e); }
  return { positions: P, indices: I };
}
function box(lo, hi) {
  const P = []; for (let i = 0; i < 8; i++) P.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]);
  return { positions: P, indices: [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5] };
}
const meshes = [['box 40×30×8 off the origin', box([100.1, -20.3, 3.7], [140.1, 9.7, 11.7])], ['sphere r 25, 2400 triangles', sphere(25, [3.3, -1.7, 12.9], 20)], ['sphere r 0.9, 10 000 triangles', sphere(0.9, [0.5, 0.5, 0.5], 41)]];

test('f32 rounding outward: down never above, up never below, each the nearest such f32', () => {
  for (const x of [0, 1, -1, 0.1, -0.1, 1e-40, -1e-40, 123456.789, -98765.4321, Math.PI]) {
    const d = f32Down(x), u = f32Up(x);
    assert.ok(d <= x && u >= x && Math.fround(d) === d && Math.fround(u) === u, `${x}`);
    if (Math.fround(x) === x) assert.ok(d === x && u === x);
  }
});

test('the packing: every triangle once in leaf order with its source index; each f32 vertex inside its leaf\'s f32 box', () => {
  for (const [name, m] of meshes) {
    const bvh = triangleBvh(m.positions, m.indices), p = packBvh(bvh), nf = new Float32Array(p.nodes), ni = new Int32Array(p.nodes), tf = new Float32Array(p.triangles), tu = new Uint32Array(p.triangles);
    assert.equal(p.triangleCount, m.indices.length / 3); assert.equal(p.nodeCount, bvh.nodes);
    const seen = new Uint8Array(p.triangleCount);
    for (let n = 0; n < p.nodeCount; n++) {
      const w = BVH_NODE_WORDS * n, link = ni[w + 3];
      if (link >= 0) { assert.equal(ni[w + 7], 0); continue; }
      for (let i = -1 - link; i < -1 - link + ni[w + 7]; i++) {
        const q = BVH_TRIANGLE_WORDS * i, t = tu[q + 3]; seen[t]++;
        for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) {
          const x = tf[q + 4 * v + k];
          assert.ok(x >= nf[w + k] && x <= nf[w + 4 + k], `${name}: vertex outside its box`);
          assert.equal(x, Math.fround(m.positions[3 * m.indices[3 * t + v] + k]));
        }
      }
    }
    assert.ok(seen.every(c => c === 1), `${name}: each triangle once`);
    assert.ok(p.depth > 0 && p.depth < 32);
  }
});

test('the mirror\'s ray hit equals the kernel\'s (to the f32 vertices\' rounding), misses included, the skipped triangle skipped', () => {
  for (const [name, m] of meshes) {
    const bvh = triangleBvh(m.positions, m.indices), p = packBvh(bvh), scale = bvh.size;
    let hits = 0;
    for (let k = 0; k < 400; k++) {
      // (From around the mesh's box toward a point in it, or anywhere: hits and misses both.)
      const ext = [0, 1, 2].map(j => bvh.box[3 + j] - bvh.box[j]), o = [0, 1, 2].map(j => bvh.box[j] - ext[j] + rand() * 3 * ext[j]);
      const aim = k % 3 ? [0, 1, 2].map(j => bvh.box[j] + rand() * ext[j]) : [0, 1, 2].map(j => o[j] + rand() - 0.5);
      const d0 = [0, 1, 2].map(j => aim[j] - o[j]), l = Math.hypot(...d0), d = d0.map(v => v / l);
      const a = rayHit(bvh, o, d), b = packedRayHit(p, o[0], o[1], o[2], d[0], d[1], d[2]);
      if (Number.isFinite(a)) hits++;
      assert.ok(Number.isFinite(a) === Number.isFinite(b) || Math.abs(a - b) < 1e-4 * scale, `${name}: ${a} vs ${b}`);
      if (Number.isFinite(a) && Number.isFinite(b)) assert.ok(Math.abs(a - b) <= 1e-5 * scale, `${name}: ${a} vs ${b}`);
    }
    assert.ok(hits > 20, `${name}: ${hits} hits`);
    // (Inward from a triangle's centre along its normal, skipping it: the wall's other side, as IM4's rays do.)
    const t = 7, I = m.indices, P = m.positions, at = [0, 1, 2].map(j => (P[3 * I[3 * t] + j] + P[3 * I[3 * t + 1] + j] + P[3 * I[3 * t + 2] + j]) / 3);
    const e1 = [0, 1, 2].map(j => P[3 * I[3 * t + 1] + j] - P[3 * I[3 * t] + j]), e2 = [0, 1, 2].map(j => P[3 * I[3 * t + 2] + j] - P[3 * I[3 * t] + j]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(...n), inward = n.map(v => -v / nl);
    const a = rayHit(bvh, at, inward, 1e-9, t), b = packedRayHit(p, at[0], at[1], at[2], inward[0], inward[1], inward[2], 1e-9, t);
    assert.ok(Number.isFinite(a) && Math.abs(a - b) <= 1e-5 * scale, `${name} inward: ${a} vs ${b}`);
  }
});

test('the mirror\'s nearest distance equals the kernel\'s, bounded queries included', () => {
  for (const [name, m] of meshes) {
    const bvh = triangleBvh(m.positions, m.indices), p = packBvh(bvh), scale = bvh.size;
    for (let k = 0; k < 300; k++) {
      const q = [0, 1, 2].map(j => bvh.box[j] - 3 + rand() * (bvh.box[3 + j] - bvh.box[j] + 6));
      const a = Math.sqrt(nearestDistance2(bvh, q[0], q[1], q[2])), b = Math.sqrt(packedNearestDistance2(p, q[0], q[1], q[2]));
      assert.ok(Math.abs(a - b) <= 1e-5 * scale, `${name}: ${a} vs ${b}`);
      const bound = 0.25, ab = nearestDistance2(bvh, q[0], q[1], q[2], bound), bb = packedNearestDistance2(p, q[0], q[1], q[2], bound);
      assert.ok((ab === bound) === (bb === bound) || Math.abs(Math.sqrt(ab) - Math.sqrt(bound)) < 1e-5 * scale, `${name} bounded`);
    }
  }
});

test('a hierarchy deeper than the shaders\' stack is refused by name', () => {
  // (A chain: one triangle per leaf down a degenerate split, built by hand.)
  const fake = { positions: new Float64Array(9), indices: new Uint32Array([0, 1, 2]), box: new Float64Array(6 * 140), left: new Int32Array(140).fill(-1), start: new Int32Array(140), count: new Int32Array(140), order: new Uint32Array([0]), nodes: 139, size: 1 };
  for (let n = 0; n < 69; n++) fake.left[2 * n] = 2 * n + 1;
  for (let n = 0; n < 139; n++) fake.count[n] = 1;
  // (left[2n] = 2n + 1 makes 2n + 1 and 2n + 2 its children: a chain 69 deep through the even nodes.)
  assert.throws(() => packBvh(fake), /GPU_BVH_DEPTH/);
});
