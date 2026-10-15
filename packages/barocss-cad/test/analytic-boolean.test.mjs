import test from 'node:test';
import assert from 'node:assert/strict';
import { booleanAnalytic, brepFromPrismatic, prismaticFromProfile, transformBrep, quarterTurn, checkBrep, tessellateBrep, brepMassProperties, BrepError } from '../dist/index.js';

const mulberry = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
const circle = (cx, cy, r) => [{ kind: 'arc', start: [cx + r, cy], center: [cx, cy], direction: 'ccw' }];
const prism = (outer, z0, z1, id) => brepFromPrismatic(prismaticFromProfile({ outer, heightMM: z1 - z0, fromMM: z0, tag: id }), { id });
const box = (a, b, id = 'b') => prism(rect(a[0], a[1], b[0], b[1]), a[2], b[2], id);
/** A cylinder along x, y or z: centre (c0, c1) in the other two axes in cyclic order, over [h0, h1]. */
function cylinder(axis, c, r, h0, h1, id = 'c') {
  const z = prism(circle(c[0], c[1], r), h0, h1, id);
  if (axis === 'z') return z;
  // Cyclic permutations: local (x, y, z) → world (y, z, x) for x, → (z, x, y) for y.
  return transformBrep(z, { matrix: axis === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [0, 1, 0, 0, 0, 1, 1, 0, 0] });
}
const pi = Math.PI;
function mesh(brep, q) {
  const m = tessellateBrep(brep, { segmentsPerQuarter: q }), p = m.positionsMM, ix = m.indices, he = new Map(), key = i => p[i * 3] + ',' + p[i * 3 + 1] + ',' + p[i * 3 + 2];
  let volume = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    volume += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
    for (let e = 0; e < 3; e++) { const k = key(ix[t + e]) + '>' + key(ix[t + (e + 1) % 3]); he.set(k, (he.get(k) ?? 0) + 1); }
  }
  return { volume, watertight: [...he].every(([k, n]) => { const [x, y] = k.split('>'); return he.get(y + '>' + x) === n; }), kinds: new Set(m.faces.map(f => f.kind)) };
}

test('planes and cylinders of any axis: exact cases', () => {
  const lens = 2 * (3 * Math.sqrt(91) + 100 * Math.asin(0.3));
  const cases = [
    ['box ∪ box (overlapping corners)', box([0, 0, 0], [10, 10, 10]), box([5, 5, 5], [15, 15, 15]), 'union', 1875],
    ['through hole along z', box([0, 0, 0], [20, 20, 10]), cylinder('z', [10, 10], 3, -1, 11), 'difference', 4000 - 90 * pi],
    ['cross hole along x', box([0, 0, 0], [20, 20, 10]), cylinder('x', [10, 5], 3, -1, 21), 'difference', 4000 - 180 * pi],
    ['cross hole along y', box([0, 0, 0], [20, 20, 10]), cylinder('y', [5, 10], 3, -1, 21), 'difference', 4000 - 180 * pi],
    ['pin along x half sunk', box([0, 0, 0], [20, 20, 10]), cylinder('x', [10, 10], 3, -5, 25), 'union', 4000 + 270 * pi - 90 * pi],
    ['cylinder ∩ bar', cylinder('z', [0, 0], 10, 0, 20), box([-20, -3, 5], [20, 3, 9]), 'intersection', lens * 4],
    ['cylinder ∪ bar (holes in the wall)', cylinder('z', [0, 0], 10, 0, 20), box([-20, -3, 5], [20, 3, 9]), 'union', 2000 * pi + 960 - lens * 4],
    ['parallel cylinders along x', cylinder('x', [0, 0], 4, 0, 10), cylinder('x', [5, 0], 4, 2, 8), 'union', null],
    ['coaxial bore along y', cylinder('y', [0, 0], 6, 0, 10), cylinder('y', [0, 0], 3, -1, 11), 'difference', 270 * pi],
    ['touching faces (stacked)', box([0, 0, 0], [10, 10, 5]), box([2, 2, 5], [8, 8, 9]), 'union', 500 + 144],
  ];
  for (const [name, a, b, op, expected] of cases) {
    const r = booleanAnalytic(a, b, op), report = checkBrep(r);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.ok(r.faces.every(f => f.name) && r.edges.every(e => e.name), `${name}: names`);
    for (const q of [4, 16, 32]) assert.ok(mesh(r, q).watertight, `${name}: watertight at ${q}`);
    const v = brepMassProperties(r, 1, { segmentsPerQuarter: 64 }).volumeMM3;
    if (expected !== null) assert.ok(Math.abs(v - expected) < 2e-4 * expected, `${name}: ${v} vs ${expected}`);
  }
  // Cylinder walls notched (bar across) or holed (a stub inside a half) in their (θ, height) domain
  // are tessellated as trimmed faces.
  const notched = booleanAnalytic(cylinder('z', [0, 0], 10, 0, 20), box([-20, -3, 5], [20, 3, 9]), 'union');
  assert.ok(mesh(notched, 8).kinds.has('trimmed'));
  const holed = booleanAnalytic(cylinder('z', [0, 0], 10, 0, 20), box([-2, 5, 8], [2, 20, 12]), 'union');
  assert.ok(holed.faces.some(f => f.surface.degreeU === 2 && f.loops.length > 1), 'a wall face with an inner loop');
  for (const q of [2, 8, 32]) assert.ok(mesh(holed, q).watertight && mesh(holed, q).kinds.has('trimmed'));
  // Cylinder + stub (4 × 15 × 4) − their overlap: ∫ (√(100 − x²) − 5) dx over |x| ≤ 2, times 4.
  const overlap = 4 * (2 * (Math.sqrt(96) + 50 * Math.asin(0.2)) - 20), v = brepMassProperties(holed, 1).volumeMM3;
  assert.ok(Math.abs(v - (2000 * pi + 240 - overlap)) < 2e-4 * v, String(v));
});

test('refusals: ellipses and crossing cylinders; contact along a line is not a solid', () => {
  // A plane at 45° to a cylinder's axis (a box turned about z, against a cylinder along x).
  const turned = transformBrep(box([-5, -5, -5], [5, 5, 5]), { matrix: [Math.SQRT1_2, -Math.SQRT1_2, 0, Math.SQRT1_2, Math.SQRT1_2, 0, 0, 0, 1] });
  assert.throws(() => booleanAnalytic(turned, cylinder('x', [0, 0], 2, -10, 10), 'difference'), e => e instanceof BrepError && /at an angle \(an ellipse/.test(e.message));
  assert.throws(() => booleanAnalytic(cylinder('z', [0, 0], 5, -5, 5), cylinder('x', [0, 0], 2, -10, 10), 'difference'), e => /crossing axes/.test(e.message));
  // Crossing cylinders that stay apart are fine.
  const apart = booleanAnalytic(cylinder('z', [0, 0], 2, 0, 10), cylinder('x', [8, 5], 2, -10, 10), 'union');
  assert.equal(checkBrep(apart).valid, true); assert.equal(apart.bodies.length, 2);
  assert.throws(() => booleanAnalytic(box([0, 0, 0], [10, 10, 5]), box([10, 0, 5], [20, 10, 10]), 'union'), e => e instanceof BrepError && e.code === 'TOPOLOGY' && /not a manifold/.test(e.message));
  // A quarter turn keeps every face recognisable (exact entries).
  assert.equal(checkBrep(transformBrep(cylinder('z', [1, 2], 3, 0, 5), { matrix: quarterTurn('x', 90) })).valid, true);
});

test('random boxes and cylinders along x, y and z: valid watertight results, volume identities, point classification', () => {
  const rnd = mulberry(1), ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let n = 0;
  const prim = () => {
    const id = 'p' + n++;
    if (rnd() < 0.5) { const a = [ri(-6, 4), ri(-6, 4), ri(-6, 4)], b = a.map(v => v + ri(2, 8)); return { inside: p => p.every((v, k) => v > a[k] && v < b[k]), brep: box(a, b, id) }; }
    const axis = 'xyz'[ri(0, 2)], r = ri(1, 4), c = [ri(-4, 4), ri(-4, 4)], h0 = ri(-7, 0), h1 = h0 + ri(3, 10), k = 'xyz'.indexOf(axis);
    const others = [(k + 1) % 3, (k + 2) % 3];
    return { inside: p => Math.hypot(p[others[0]] - c[0], p[others[1]] - c[1]) < r && p[k] > h0 && p[k] < h1, brep: cylinder(axis, c, r, h0, h1, id) };
  };
  const inMesh = (b, p) => {
    const m = tessellateBrep(b, { segmentsPerQuarter: 32 }), P = m.positionsMM, ix = m.indices, d = [0.5377, 0.3138, 0.7832]; let c = 0;
    for (let t = 0; t < ix.length; t += 3) {
      const A = [0, 1, 2].map(k => P[ix[t] * 3 + k]), e1 = [0, 1, 2].map(k => P[ix[t + 1] * 3 + k] - A[k]), e2 = [0, 1, 2].map(k => P[ix[t + 2] * 3 + k] - A[k]);
      const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], a = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2]; if (Math.abs(a) < 1e-14) continue;
      const f = 1 / a, s = p.map((x, k) => x - A[k]), u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]); if (u < 0 || u > 1) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = f * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]); if (v < 0 || u + v > 1) continue;
      if (f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) > 1e-9) c++;
    }
    return c % 2 === 1;
  };
  let checked = 0, refused = 0;
  for (let k = 0; k < 45; k++) {
    const A = prim(), B = prim(), R = {};
    try { for (const op of ['union', 'intersection', 'difference']) R[op] = booleanAnalytic(A.brep, B.brep, op); }
    catch (e) { assert.ok(/not supported yet|not a manifold/.test(e.message), e.message); refused++; continue; }
    const V = {};
    for (const [op, b] of Object.entries(R)) {
      if (!b.bodies.length) { V[op] = 0; continue; }
      assert.equal(checkBrep(b).valid, true, `${op} ${k}`);
      const m = mesh(b, 32); assert.ok(m.watertight, `${op} ${k} watertight`); V[op] = m.volume;
    }
    const va = mesh(A.brep, 32).volume, vb = mesh(B.brep, 32).volume, tol = 2e-3 * (va + vb);
    assert.ok(Math.abs(V.union + V.intersection - va - vb) < tol, `U+I ${k}`);
    assert.ok(Math.abs(V.difference + V.intersection - va) < tol, `D+I ${k}`);
    for (let s = 0; s < 8; s++) {
      const p = [rnd() * 20 - 10 + 1e-3, rnd() * 20 - 10 + 2e-3, rnd() * 20 - 10 + 3e-3], a = A.inside(p), b = B.inside(p);
      const far = [[0.06, 0, 0], [-0.06, 0, 0], [0, 0.06, 0], [0, -0.06, 0], [0, 0, 0.06], [0, 0, -0.06]].every(d => { const q = p.map((x, i) => x + d[i]); return A.inside(q) === a && B.inside(q) === b; });
      if (!far) continue;
      for (const [op, want] of [['union', a || b], ['intersection', a && b], ['difference', a && !b]]) assert.equal(R[op].bodies.length ? inMesh(R[op], p) : false, want, `${op} ${k} at ${p}`);
    }
    checked++;
  }
  assert.ok(checked >= 25, `${checked} checked, ${refused} refused`);
});
