import test from 'node:test';
import assert from 'node:assert/strict';
import { voxelInsideFlags, voxelDepth, marchingTetrahedra, voxelNode, meshVolume } from '../dist/index.js';

// K6 (D145): a closed mesh on a voxel grid (inside flags by ray parity, a capped depth by the K2 hierarchy) and marching
// tetrahedra. Oracles, none of them the kernel's: closed-form inside and depth for a box (the distance to its nearest
// face) and a sphere mesh (its radius, within its chord error), a plane's field met exactly on the plane, an analytic
// sphere's field meshed to a closed, outward surface whose volume converges as h², and the surface's topology counted.

/** A box's 12 triangles, outward. */
function box(x0, y0, z0, x1, y1, z1) {
  return { P: [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], I: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7] };
}
/** A UV sphere of radius R about the origin, n bands, outward. */
function sphere(R, n) {
  const P = [0, 0, R], I = [];
  for (let i = 1; i < n; i++) for (let j = 0; j < 2 * n; j++) { const th = Math.PI * i / n, ph = Math.PI * j / n; P.push(R * Math.sin(th) * Math.cos(ph), R * Math.sin(th) * Math.sin(ph), R * Math.cos(th)); }
  P.push(0, 0, -R); const S = P.length / 3 - 1, ring = (i, j) => 1 + (i - 1) * 2 * n + ((j + 2 * n) % (2 * n));
  for (let j = 0; j < 2 * n; j++) I.push(0, ring(1, j), ring(1, j + 1));
  for (let i = 1; i < n - 1; i++) for (let j = 0; j < 2 * n; j++) { const a = ring(i, j), b = ring(i, j + 1), c = ring(i + 1, j), d = ring(i + 1, j + 1); I.push(a, c, b, b, c, d); }
  for (let j = 0; j < 2 * n; j++) I.push(S, ring(n - 1, j + 1), ring(n - 1, j));
  return { P, I };
}
/** The grid about a box lo…hi at spacing h, offset by irrational fractions (rows off every edge and diagonal). */
function grid(lo, hi, h) {
  const off = [1 / Math.PI, 1 / Math.E, Math.SQRT2 - 1], o = [0, 1, 2].map(k => lo[k] - 2 * h + off[k] * h), n = [0, 1, 2].map(k => Math.ceil((hi[k] - o[k] + 2 * h) / h) + 1);
  return { o, h, n };
}
/** A closed, consistently oriented surface: each directed edge once with its reverse once; and its Euler characteristic. */
function topology(I, nv) {
  const e = new Map();
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], key = `${a},${b}`; assert.ok(!e.has(key), `edge ${key} twice`); e.set(key, 1); }
  for (const key of e.keys()) { const [a, b] = key.split(','); assert.ok(e.has(`${b},${a}`), `edge ${key} unpaired`); }
  const used = new Set(I); assert.equal(used.size, nv, 'every vertex used');
  return nv - e.size / 2 + I.length / 3;
}

test('K6 inside and depth: a box — every node inside exactly when strictly within it; the depth its nearest face\'s distance, capped', () => {
  const { P, I } = box(1, 2, 3, 21, 14, 11), g = grid([1, 2, 3], [21, 14, 11], 0.7), inside = voxelInsideFlags(P, I, g.o, g.h, g.n);
  const cap = 2.5, depth = voxelDepth(P, I, g.o, g.h, g.n, cap, inside);
  let count = 0;
  for (let id = 0; id < inside.length; id++) {
    const [x, y, z] = voxelNode({ ...g, phi: new Float64Array(0) }, id), want = x > 1 && x < 21 && y > 2 && y < 14 && z > 3 && z < 11;
    assert.equal(inside[id] === 1, want, `node ${id} at ${x}, ${y}, ${z}`);
    if (want) { count++; const d = Math.min(x - 1, 21 - x, y - 2, 14 - y, z - 3, 11 - z); assert.ok(Math.abs(depth[id] - Math.min(d, cap)) <= 1e-12, `depth ${depth[id]} vs ${d}`); }
    else assert.equal(depth[id], 0);
  }
  assert.ok(count > 1000);
});

test('K6 inside and depth: a sphere mesh — inside within its chord error of |p| < R, the depth R − |p| within it', () => {
  const R = 10, n = 48, { P, I } = sphere(R, n), g = grid([-R, -R, -R], [R, R, R], 0.6), inside = voxelInsideFlags(P, I, g.o, g.h, g.n);
  const chord = R * (1 - Math.cos(Math.PI / (2 * n))) * 2.1, depth = voxelDepth(P, I, g.o, g.h, g.n, 20, inside);
  for (let id = 0; id < inside.length; id++) {
    const p = voxelNode({ ...g, phi: new Float64Array(0) }, id), r = Math.hypot(...p);
    if (r < R - chord) { assert.equal(inside[id], 1, `deep node ${r}`); assert.ok(Math.abs(depth[id] - (R - r)) <= chord, `depth ${depth[id]} vs ${R - r}`); }
    if (r > R + 1e-9) assert.equal(inside[id], 0, `outside node ${r}`);
  }
});

test('K6 marching tetrahedra: a plane\'s field met on the plane exactly; an analytic sphere\'s closed, outward, genus 0, its volume converging as h²', () => {
  // φ = 3.3 − x on a grid: the surface x = 3.3, every vertex on it (linear interpolation of a linear field is exact).
  const g = { o: [0.1, 0.2, 0.3], h: 0.5, n: [16, 9, 7] }, phi = new Float64Array(g.n[0] * g.n[1] * g.n[2]);
  for (let id = 0; id < phi.length; id++) phi[id] = 3.3 - voxelNode({ ...g, phi }, id)[0];
  const plane = marchingTetrahedra({ ...g, phi });
  assert.ok(plane.positions.length > 0); for (let v = 0; v < plane.positions.length; v += 3) assert.ok(Math.abs(plane.positions[v] - 3.3) <= 1e-12, 'on the plane');
  // φ = r − |p| (inside positive): closed, outward (positive volume), χ = 2, the volume's error falling about 4× as h halves.
  const r = 6, errs = [];
  for (const h of [0.8, 0.4, 0.2]) {
    const G = grid([-r, -r, -r], [r, r, r], h), f = new Float64Array(G.n[0] * G.n[1] * G.n[2]);
    for (let id = 0; id < f.length; id++) f[id] = r - Math.hypot(...voxelNode({ ...G, phi: f }, id));
    const m = marchingTetrahedra({ ...G, phi: f });
    assert.equal(topology(m.indices, m.positions.length / 3), 2, `χ at h ${h}`);
    const V = meshVolume(m.positions, m.indices), want = 4 / 3 * Math.PI * r ** 3;
    assert.ok(V > 0 && V < want, `V ${V} below ${want}`); errs.push(want - V);
    // Each vertex on its grid edge: a·N + b, the two nodes one step apart, the vertex between them.
    const N = f.length; for (let v = 0; v < m.edges.length; v += 97) { const a = Math.floor(m.edges[v] / N), b = m.edges[v] - a * N; assert.ok(f[a] * f[b] < 0 || f[a] === 0 || f[b] === 0, 'a crossing edge'); }
  }
  assert.ok(errs[0] / errs[1] > 3 && errs[1] / errs[2] > 3, `volume errors ${errs.map(e => e.toFixed(4)).join(', ')}`);
});
