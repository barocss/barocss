import test from 'node:test';
import assert from 'node:assert/strict';
import { booleanPolygons, planarArrangementCounts, extrudePolygonBoolean, assertValidBrep, tessellateBrep } from '../dist/index.js';

const sq = (x0, y0, x1, y1) => ({ outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [] });
const ringArea = r => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2;
const area = polys => polys.reduce((s, p) => s + ringArea(p.outer) + p.holes.reduce((t, h) => t + ringArea(h), 0), 0);
const inRing = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const inPolys = (p, polys) => polys.some(q => inRing(p, q.outer) && !q.holes.some(h => inRing(p, h)));

test('touching, shared edges, T-junctions and identical inputs are ordinary cases', () => {
  const cases = [
    ['shared edge union', [sq(0, 0, 10, 10)], [sq(10, 0, 20, 10)], 'union', [[4, 200, 0]]],
    ['T-junction union', [sq(0, 0, 10, 10)], [sq(10, 2, 20, 8)], 'union', [[8, 160, 0]]],
    ['corner touch union', [sq(0, 0, 10, 10)], [sq(10, 10, 20, 20)], 'union', [[4, 100, 0], [4, 100, 0]]],
    ['inner square difference', [sq(0, 0, 30, 30)], [sq(10, 10, 20, 20)], 'difference', [[4, 900, 1]]],
    ['cut through', [sq(0, 0, 30, 10)], [sq(10, -5, 20, 15)], 'difference', [[4, 100, 0], [4, 100, 0]]],
    ['hole filled', [{ outer: [[0, 0], [30, 0], [30, 30], [0, 30]], holes: [[[10, 10], [10, 20], [20, 20], [20, 10]]] }], [sq(10, 10, 20, 20)], 'union', [[4, 900, 0]]],
    ['identical intersection', [sq(0, 0, 10, 10)], [sq(0, 0, 10, 10)], 'intersection', [[4, 100, 0]]],
    ['identical difference', [sq(0, 0, 10, 10)], [sq(0, 0, 10, 10)], 'difference', []],
  ];
  for (const [name, a, b, op, expected] of cases) {
    const r = booleanPolygons(a, b, op);
    assert.deepEqual(r.map(p => [p.outer.length, ringArea(p.outer), p.holes.length]).sort((x, y) => x[1] - y[1]), expected, name);
    for (const p of r) { assert.ok(ringArea(p.outer) > 0, name); for (const h of p.holes) assert.ok(ringArea(h) < 0, name); }
  }
  assert.deepEqual(planarArrangementCounts([sq(0, 0, 10, 10), sq(10, 0, 20, 10)]), { vertices: 6, edges: 7, boundedFaces: 2 });
});

test('random polygons: area identities and point classification agree for every operation', () => {
  let seed = 9; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  // Star-shaped polygons, half of them on an integer grid (many shared / collinear / touching points).
  const star = (grid) => { const n = 3 + Math.floor(rnd() * 9), cx = (rnd() - .5) * 20, cy = (rnd() - .5) * 20, pts = [];
    for (let i = 0; i < n; i++) { const t = 2 * Math.PI * (i + rnd() * 0.8) / n, r = 4 + rnd() * 10; let p = [cx + r * Math.cos(t), cy + r * Math.sin(t)]; if (grid) p = p.map(Math.round); pts.push(p); }
    return { outer: pts, holes: [] }; };
  let checked = 0;
  for (let k = 0; k < 300; k++) {
    const grid = k % 2 === 0, A = [star(grid)], B = [star(grid)];
    if (Math.abs(ringArea(A[0].outer)) < 1 || Math.abs(ringArea(B[0].outer)) < 1) continue;
    // Skip self-intersecting stars (rounding can fold one).
    const simple = r => r.every((p, i) => r.every((q, j) => { if (Math.abs(i - j) <= 1 || (i === 0 && j === r.length - 1) || (j === 0 && i === r.length - 1)) return true;
      const a = p, b = r[(i + 1) % r.length], c = q, d = r[(j + 1) % r.length], o = (x, y, z) => Math.sign((y[0] - x[0]) * (z[1] - x[1]) - (y[1] - x[1]) * (z[0] - x[0]));
      return !(o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0); }));
    if (!simple(A[0].outer) || !simple(B[0].outer)) continue;
    const U = booleanPolygons(A, B, 'union'), I = booleanPolygons(A, B, 'intersection'), D = booleanPolygons(A, B, 'difference'), X = booleanPolygons(A, B, 'xor');
    const a = Math.abs(ringArea(A[0].outer)), b = Math.abs(ringArea(B[0].outer)), tol = 1e-9 * (a + b);
    assert.ok(Math.abs(area(U) - (a + b - area(I))) < tol, `union ${k}`);
    assert.ok(Math.abs(area(D) - (a - area(I))) < tol, `difference ${k}`);
    assert.ok(Math.abs(area(X) - (area(U) - area(I))) < tol, `xor ${k}`);
    for (let s = 0; s < 40; s++) {
      const p = [(rnd() - .5) * 50 + 0.123456, (rnd() - .5) * 50 + 0.654321], inA = inPolys(p, A), inB = inPolys(p, B);
      assert.equal(inPolys(p, U), inA || inB, `U ${k}`); assert.equal(inPolys(p, I), inA && inB, `I ${k}`);
      assert.equal(inPolys(p, D), inA && !inB, `D ${k}`); assert.equal(inPolys(p, X), inA !== inB, `X ${k}`);
    }
    checked++;
  }
  assert.ok(checked > 150, String(checked));
});

test('prism Booleans become valid B-reps: shared-edge union, through cut into two bodies, a frame', () => {
  const union = extrudePolygonBoolean([sq(0, 0, 10, 10)], [sq(10, 0, 20, 10)], 'union', { heightMM: 5 });
  assert.equal(assertValidBrep(union.brep).topology.length, 1);
  assert.deepEqual(assertValidBrep(union.brep).topology[0].faces, 6);
  const cut = extrudePolygonBoolean([sq(0, 0, 30, 10)], [sq(10, -5, 20, 15)], 'difference', { heightMM: 4, fromMM: 1 });
  assert.equal(cut.brep.bodies.length, 2); assert.equal(assertValidBrep(cut.brep).valid, true);
  const frame = extrudePolygonBoolean([sq(0, 0, 40, 30)], [sq(5, 5, 35, 25)], 'difference', { heightMM: 3 });
  assert.equal(assertValidBrep(frame.brep).topology[0].genus, 1);
  const mesh = tessellateBrep(frame.brep), p = mesh.positionsMM, I = mesh.indices; let vol = 0;
  for (let t = 0; t < I.length; t += 3) { const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3]; vol += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6; }
  assert.ok(Math.abs(vol - (1200 - 600) * 3) < 1e-9, String(vol));
});
