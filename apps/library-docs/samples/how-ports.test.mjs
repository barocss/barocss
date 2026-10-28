// The "How it works" pages' figures run small copies of kernel algorithms in the page
// (docs/.vitepress/components/algorithms/ports/). These tests run each copy and the kernel's own function on the same
// inputs and require the same answer, bit for bit: a kernel change that the pages no longer describe fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solveXYNumericalSketchPoints, triangleBvh } from '@barocss/cad';
import { solveCubicBernsteinRoots } from '@barocss/cad/intersect/own-cubic-bernstein-roots';
import { solveTrace } from '../docs/.vitepress/components/algorithms/ports/sketch-solver.mjs';
import { cubicRoots } from '../docs/.vitepress/components/algorithms/ports/bernstein-roots.mjs';
import { build } from '../docs/.vitepress/components/algorithms/ports/bvh2d.mjs';

/** A seeded generator (mulberry32), so every run draws the same cases. */
function random(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('the sketch figures\' solver copy takes the kernel\'s iterates and reports its rank', () => {
  const DEG = Math.PI / 180, rnd = random(20261028);
  const sketch = {
    points: ['p0', 'p1', 'p2', 'p3'],
    segments: { s0: ['p0', 'p1'], s1: ['p1', 'p2'], s2: ['p2', 'p3'], s3: ['p3', 'p0'] },
    constraints: [
      { id: 'anchor', kind: 'fixed', pointId: 'p0', target: [0, 0] },
      { id: 'h0', kind: 'horizontal', segmentId: 's0' }, { id: 'v3', kind: 'vertical', segmentId: 's3' },
      { id: 'l0', kind: 'length', segmentId: 's0', length: 40 }, { id: 'l3', kind: 'length', segmentId: 's3', length: 24 },
      { id: 'a01', kind: 'signed-angle', segmentA: 's0', segmentB: 's1', angle: 100 * DEG }, { id: 'h2', kind: 'horizontal', segmentId: 's2' },
    ],
  };
  // The figure's drawing, then rough drawings around it.
  const drawings = [[0, 0, 36, 3, 30, 19, -3, 21]];
  for (let k = 0; k < 40; k++) drawings.push(drawings[0].map(v => v + 6 * (rnd() - 0.5)));
  let compared = 0;
  for (const x0 of drawings) {
    const kernel = solveXYNumericalSketchPoints({
      format: 'barocss-xy-numerical-sketch', version: 0, profile: 'bounded-length-angle-v1', id: 'ports', lengthUnit: 'mm', angleUnit: 'rad',
      points: sketch.points.map((id, i) => ({ id, position: [x0[2 * i], x0[2 * i + 1]] })),
      segments: Object.entries(sketch.segments).map(([id, [a, b]]) => ({ id, startPointId: a, endPointId: b })),
      constraints: sketch.constraints, branchGuards: [],
    });
    const copy = solveTrace(sketch, x0);
    assert.equal(copy.ok, kernel.ok, `converged on ${x0}`);
    if (!kernel.ok) continue;
    assert.deepEqual(copy.its.at(-1).x, kernel.solution.points.flatMap(p => p.position), `points from ${x0}`);
    assert.equal(copy.its.length - 1, kernel.report.iterations, 'iterations');
    assert.equal(copy.rank, kernel.report.numericalRank, 'rank');
    compared++;
  }
  assert.ok(compared >= 30, `${compared} drawings compared`);
});

test('the curve-roots figure\'s solver copy finds the kernel\'s roots and brackets', () => {
  const rnd = random(7), cases = [[1.2, -2.4, 2.0, -0.8]];
  for (let k = 0; k < 3000; k++) cases.push([0, 1, 2, 3].map(() => 2 * rnd() - 1));
  let compared = 0;
  for (const c of cases) {
    let kernel;
    try { kernel = solveCubicBernsteinRoots(c, 1e-12); } catch { continue; } // a refusal: the copy has only the success path
    const copy = cubicRoots(c, 1e-12);
    assert.deepEqual(copy.roots.map(r => r.t), kernel.roots.map(r => r.t), `roots of ${c}`);
    assert.deepEqual(copy.roots.map(r => r.iterations), kernel.roots.map(r => r.iterations), `halvings for ${c}`);
    compared++;
  }
  assert.ok(compared >= 2500, `${compared} cubics compared`);
});

test('the BVH figure\'s 2D build is the kernel\'s tree on the same flat triangles', () => {
  const rnd = random(141), meshes = [];
  // The figure's ring of 28 triangles.
  { const SEG = 14, P = [], I = [];
    for (let k = 0; k < SEG; k++) {
      const a = 2 * Math.PI * k / SEG + 0.1, ri = 3 + 0.5 * Math.sin(2 * a + 0.4), ro = ri + 1 + 0.3 * Math.cos(3 * a);
      P.push(1.55 * ri * Math.cos(a), ri * Math.sin(a), 1.55 * ro * Math.cos(a), ro * Math.sin(a));
    }
    for (let k = 0; k < SEG; k++) { const a = 2 * k, b = 2 * k + 1, c = 2 * ((k + 1) % SEG), d = c + 1; I.push(a, c, b, b, c, d); }
    meshes.push({ P, I }); }
  // Triangle soups of 5 to 200 triangles.
  for (let m = 0; m < 30; m++) {
    const nt = 5 + Math.floor(rnd() * 196), P = [], I = [];
    for (let t = 0; t < nt; t++) {
      const cx = 100 * rnd(), cy = 60 * rnd();
      for (let v = 0; v < 3; v++) { P.push(cx + 4 * rnd(), cy + 4 * rnd()); I.push(3 * t + v); }
    }
    meshes.push({ P, I });
  }
  for (const { P, I } of meshes) {
    const copy = build(P, I, 4), P3 = [];
    for (let i = 0; i < P.length; i += 2) P3.push(P[i], P[i + 1], 0);
    const kernel = triangleBvh(P3, I, { leafSize: 4 });
    assert.deepEqual(copy.order, Array.from(kernel.order), 'triangle order');
    assert.equal(copy.nodes.length, kernel.nodes, 'node count');
    for (const n of copy.nodes) {
      assert.deepEqual([n.start, n.count, n.left], [kernel.start[n.n], kernel.count[n.n], kernel.left[n.n]], `node ${n.n}`);
      const b = 6 * n.n;
      assert.deepEqual(n.box, [kernel.box[b], kernel.box[b + 1], kernel.box[b + 3], kernel.box[b + 4]], `node ${n.n} box`);
    }
  }
});
