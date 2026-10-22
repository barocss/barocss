import test from 'node:test';
import assert from 'node:assert/strict';
import { brepFromTriangles, brepMassProperties, brepSurfaceArea, evaluateCadPart, facetBrepFromTriangles } from '../dist/index.js';

// PERF3 B9 (D82): mesh bodies (facet faces, or planar faces with straight edges) integrated exactly from their
// triangles and loops, once per B-rep, instead of through a tessellation (mass) or Green quadrature per edge (area).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
function torus(R, r, n, m) {
  const P = [], I = [], at = (i, j) => (i % n) * m + (j % m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m; P.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) I.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  return { P, I };
}
/** The oracle: tetrahedra from the origin over the input triangles (the mesh as given, not the B-rep). */
function oracle(P, I, density) {
  const S = Array(10).fill(0); let area = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = P.slice(3 * I[t], 3 * I[t] + 3), b = P.slice(3 * I[t + 1], 3 * I[t + 1] + 3), c = P.slice(3 * I[t + 2], 3 * I[t + 2] + 3);
    const d = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]), s = [0, 1, 2].map(k => a[k] + b[k] + c[k]);
    const two = (i, j) => d / 120 * (a[i] * a[j] + b[i] * b[j] + c[i] * c[j] + s[i] * s[j]);
    S[0] += d / 6; for (let k = 0; k < 3; k++) S[1 + k] += d / 24 * s[k];
    S[4] += two(0, 0); S[5] += two(1, 1); S[6] += two(2, 2); S[7] += two(0, 1); S[8] += two(0, 2); S[9] += two(1, 2);
    const u = [0, 1, 2].map(k => b[k] - a[k]), w = [0, 1, 2].map(k => c[k] - a[k]);
    area += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
  }
  const V = S[0], c = [S[1] / V, S[2] / V, S[3] / V], k = density * 1e-15;
  const xx = S[4] - V * c[0] * c[0], yy = S[5] - V * c[1] * c[1], zz = S[6] - V * c[2] * c[2];
  return { V, c, Ixx: k * (yy + zz), Izz: k * (xx + yy), area };
}
const rel = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps * Math.max(Math.abs(b), 1e-300), `${what}: ${a} vs ${b}`);

test('B9 mesh bodies: volume, centroid, inertia and area equal tetrahedra over the input triangles (facet faces, and planar faces one per triangle), method planar-exact', () => {
  const { P, I } = torus(20, 5, 48, 24);
  const want = oracle(P, I, 1000);
  for (const b of [facetBrepFromTriangles(P, I, { id: 'f' }), brepFromTriangles(P, I, { id: 'p' })]) {
    const m = brepMassProperties(b, 1000, { segmentsPerQuarter: 32 });
    assert.equal(m.method, 'planar-exact');
    rel(m.volumeMM3, want.V, 1e-12, 'volume');
    for (let k = 0; k < 2; k++) assert.ok(Math.abs(m.centroidMM[k] - want.c[k]) < 1e-11, `centroid ${k}`);
    rel(m.inertiaCentroidKgM2[0][0], want.Ixx, 1e-11, 'Ixx'); rel(m.inertiaCentroidKgM2[2][2], want.Izz, 1e-11, 'Izz');
    rel(brepSurfaceArea(b), want.area, 1e-12, 'area');
    // Once per B-rep: the same answer again.
    assert.deepEqual(brepMassProperties(b, 1000), m);
    // Density scales the mass only.
    rel(brepMassProperties(b, 2000).massKG, 2 * m.massKG, 1e-15, 'mass');
  }
});

test('B9 planar faces with holes and concave outlines: a block with a square hole through it and an L-shaped prism, as their closed forms', () => {
  const block = evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 },
    { id: 't', kind: 'sketch', profile: 'rectangle', min: [10, 10], max: [22, 18] }, { id: 'c', kind: 'extrude', sketch: 't', height: 20, from: -5 },
    { id: 'd', kind: 'difference', target: 'e', tool: 'c' }])).outputs[0].brep;
  // (The top and bottom faces each one face with an inner loop.)
  assert.ok(block.faces.some(f => f.loops.length === 2));
  const m = brepMassProperties(block, 1000);
  assert.equal(m.method, 'planar-exact');
  rel(m.volumeMM3, (40 * 30 - 12 * 8) * 10, 1e-12, 'block volume');
  rel(brepSurfaceArea(block), 2 * (40 * 30 - 12 * 8) + 10 * 2 * (40 + 30) + 10 * 2 * (12 + 8), 1e-12, 'block area');
  // The centroid: the plate's minus the hole's.
  const cx = (1200 * 20 - 96 * 16) / (1200 - 96), cy = (1200 * 15 - 96 * 14) / (1200 - 96);
  assert.ok(Math.abs(m.centroidMM[0] - cx) < 1e-10 && Math.abs(m.centroidMM[1] - cy) < 1e-10 && Math.abs(m.centroidMM[2] - 5) < 1e-10, String(m.centroidMM));
  const L = evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [30, 0], [30, 10], [10, 10], [10, 25], [0, 25]] }, { id: 'e', kind: 'extrude', sketch: 's', height: 6 }])).outputs[0];
  const exact = L.massProperties(1000), brep = brepMassProperties(L.brep, 1000);
  assert.equal(brep.method, 'planar-exact');
  rel(brep.volumeMM3, exact.volumeMM3, 1e-12, 'L volume');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(brep.inertiaCentroidKgM2[i][j] - exact.inertiaCentroidKgM2[i][j]) <= 1e-12 * exact.inertiaCentroidKgM2[0][0], `I${i}${j}`);
});

test('B9 bodies with curved faces keep their path: a cylinder by quadrature, its value unchanged', () => {
  const cyl = evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }])).outputs[0].brep;
  const m = brepMassProperties(cyl, 1000);
  assert.equal(m.method, 'quadrature');
  rel(m.volumeMM3, Math.PI * 25 * 10, 1e-9, 'cylinder');
});

test('B9 performance: a 200k-triangle facet body and a 40k-triangle planar one, mass and area cold', () => {
  const big = torus(20, 5, 400, 250), mid = torus(20, 5, 200, 100);
  const f = facetBrepFromTriangles(big.P, big.I, { id: 'f' }), p = brepFromTriangles(mid.P, mid.I, { id: 'p', maximumTriangles: 1e6 });
  let t0 = performance.now(); brepMassProperties(f, 1000); const tf = performance.now() - t0;
  t0 = performance.now(); brepMassProperties(p, 1000); const tp = performance.now() - t0;
  t0 = performance.now(); brepSurfaceArea(p); brepMassProperties(p, 1000); const again = performance.now() - t0;
  if (process.env.B9_PERF) console.log(`B9: facets 200k ${tf.toFixed(1)} ms, planar 40k ${tp.toFixed(1)} ms, again ${again.toFixed(2)} ms`);
  assert.ok(tf < 60 && tp < 400 && again < 1, `${tf}, ${tp}, ${again} ms`);
});
