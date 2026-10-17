import test from 'node:test';
import assert from 'node:assert/strict';
import { booleanAnalytic, brepFromBody, cad, brepFromPrismatic, prismaticFromProfile, transformBrep, quarterTurn, checkBrep, tessellateBrep, brepMassProperties, BrepError } from '../dist/index.js';

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

test('ellipses, quartics, seams and merged faces (brep-core step 8)', () => {
  const vol = b => brepMassProperties(b, 1, { segmentsPerQuarter: 64 }).volumeMM3, ok = (name, b) => { assert.equal(checkBrep(b).valid, true, name); for (const q of [4, 16]) assert.ok(mesh(b, q).watertight, `${name} watertight ${q}`); };
  // A cube turned 45° about z, minus a cylinder along x: the box planes meet it in ellipses.
  const turned = transformBrep(box([-5, -5, -5], [5, 5, 5]), { matrix: [Math.SQRT1_2, -Math.SQRT1_2, 0, Math.SQRT1_2, Math.SQRT1_2, 0, 0, 0, 1] }), bar = cylinder('x', [0, 0], 2, -10, 10);
  const U = booleanAnalytic(turned, bar, 'union'), I = booleanAnalytic(turned, bar, 'intersection'), Dd = booleanAnalytic(turned, bar, 'difference');
  for (const [n, b] of [['U', U], ['I', I], ['D', Dd]]) ok(n, b);
  assert.ok(Math.abs(vol(U) + vol(I) - 1000 - 80 * pi) < 1e-3 * 1000 && Math.abs(vol(Dd) + vol(I) - 1000) < 1e-3 * 1000);
  // The cylinder inside the turned cube: |x| ≤ 5√2 − |y|·… exactly ∫ over the bar's section of the cube's width along x.
  let inside = 0; for (let i = 0, n = 2000; i < n; i++) for (let j = 0, m = 200; j < m; j++) { const y = -2 + 4 * (i + 0.5) / n, z = -2 + 4 * (j + 0.5) / m; if (y * y + z * z <= 4) inside += 2 * (5 * Math.SQRT2 - Math.abs(y)) * (4 / n) * (4 / m); }
  assert.ok(Math.abs(vol(I) - inside) < 2e-3 * inside, `${vol(I)} vs ${inside}`);
  // A small cylinder right through a larger crossing one (two quartic loops), and one partly through (one loop).
  const big = cylinder('z', [0, 0], 5, -5, 5);
  const drilled = booleanAnalytic(big, cylinder('x', [0, 0], 2, -10, 10), 'difference'); ok('drilled', drilled);
  let crossed = 0; for (let i = 0, n = 4000; i < n; i++) { const y = -2 + 4 * (i + 0.5) / n; crossed += 2 * Math.sqrt(4 - y * y) * 2 * Math.sqrt(25 - y * y) * 4 / n; }
  assert.ok(Math.abs(vol(drilled) - (250 * pi - crossed)) < 2e-4 * 250 * pi, String(vol(drilled)));
  const grazed = booleanAnalytic(big, cylinder('x', [4.5, 0], 2, -10, 10), 'difference'); ok('partly through', grazed);
  assert.ok(vol(grazed) < 250 * pi && vol(grazed) > 250 * pi - 40 * pi);
  // Equal radii with meeting axes: two ellipses crossing each other (the Steinmetz solid, 16r³/3). The
  // difference touches itself at two points and comes out as two bodies.
  const other = cylinder('x', [0, 0], 5, -10, 10), steinmetz = 16 * 125 / 3, tall = cylinder('z', [0, 0], 5, -10, 10);
  const SI = booleanAnalytic(tall, other, 'intersection'), SU = booleanAnalytic(tall, other, 'union'), SD = booleanAnalytic(tall, other, 'difference');
  for (const [n, b] of [['SI', SI], ['SU', SU], ['SD', SD]]) ok(n, b);
  assert.ok(Math.abs(vol(SI) - steinmetz) < 2e-4 * steinmetz, String(vol(SI)));
  assert.ok(Math.abs(vol(SU) - (1000 * pi - steinmetz)) < 2e-4 * 1000 * pi && Math.abs(vol(SD) - (500 * pi - steinmetz)) < 2e-4 * 500 * pi);
  assert.equal(SD.bodies.length, 2);
  // Crossing cylinders that stay apart; contact along a line is not a solid.
  const apart = booleanAnalytic(cylinder('z', [0, 0], 2, 0, 10), cylinder('x', [8, 5], 2, -10, 10), 'union');
  assert.equal(checkBrep(apart).valid, true); assert.equal(apart.bodies.length, 2);
  assert.throws(() => booleanAnalytic(box([0, 0, 0], [10, 10, 5]), box([10, 0, 5], [20, 10, 10]), 'union'), e => e instanceof BrepError && e.code === 'TOPOLOGY' && /not a manifold/.test(e.message));
  // Coplanar neighbours are one face: two overlapping slabs of one height give 1 top, 1 bottom, 8 sides.
  const slabs = booleanAnalytic(box([0, 0, 0], [10, 10, 5]), box([5, 5, 0], [15, 15, 5], 'B'), 'union');
  assert.equal(slabs.faces.length, 10); assert.ok(slabs.faces.some(f => f.name === 'b.top'));
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

test('mass: a whole B-spline patch is integrated over its spans, a wall whose surface stops short of its loop is not', () => {
  const m = cad.model(), c = m.sketch.circle({ center: [0, 0], radius: 5 }).extrude(10), seamed = brepFromBody(m.build({ c }).bodies.c);
  // The seamed wall is its whole patch: tensor Gauss on the exact surface, no tessellation.
  const whole = brepMassProperties(seamed, 1);
  assert.ok(Math.abs(whole.volumeMM3 - 250 * pi) < 1e-11 * 250 * pi, `${whole.volumeMM3}`);
  assert.ok(Math.abs(whole.centroidMM[2] - 5) < 1e-11, `${whole.centroidMM}`);
  // After a union the wall's surface spans 315° while its loop goes all round: integrated as trimmed.
  const r = booleanAnalytic(seamed, box([-2, -2, 8], [2, 2, 14]), 'union'), v = brepMassProperties(r, 1).volumeMM3;
  assert.ok(Math.abs(v - (250 * pi + 64)) < 1e-8 * (250 * pi + 64), `${v}`);
});

test('full-turn walls with a seam (schema-1 cylinders) are accepted', () => {
  const m = cad.model(), c = m.sketch.circle({ center: [0, 0], radius: 5 }).extrude(10), seamed = brepFromBody(m.build({ c }).bodies.c);
  const vol = b => brepMassProperties(b, 1, { segmentsPerQuarter: 64 }).volumeMM3;
  const strip = 2 * (Math.sqrt(24) + 25 * Math.asin(0.2));
  for (const [name, b, op, expected] of [['through a slot', box([-10, -1, 3], [10, 1, 6]), 'difference', 250 * pi - strip * 3], ['a block on top', box([-2, -2, 8], [2, 2, 14]), 'union', 250 * pi + 64], ['a slice', box([-10, -10, 2], [10, 10, 5]), 'intersection', 75 * pi]]) {
    const r = booleanAnalytic(seamed, b, op);
    assert.equal(checkBrep(r).valid, true, name); assert.ok(mesh(r, 16).watertight, name);
    assert.ok(Math.abs(vol(r) - expected) < 2e-4 * expected, `${name}: ${vol(r)} vs ${expected}`);
  }
});
