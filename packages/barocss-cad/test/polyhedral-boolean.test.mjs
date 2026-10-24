import test from 'node:test';
import assert from 'node:assert/strict';
import { cad, brepFromBody, buildBrep, lineCurve, checkBrep, assertValidBrep, extrudeProfileWithHoles, booleanPolyhedra, tessellateBrep, BrepError } from '../dist/index.js';

const box = (x0, y0, z0, x1, y1, z1, id = 'b') => extrudeProfileWithHoles({ id, outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => ({ kind: 'line', start: p })), height: z1 - z0, from: z0 });
/** Watertight mesh volume and triangles of a B-rep (empty B-reps measure 0). */
function measure(brep) {
  if (!brep.faces.length) return { vol: 0, tris: [] };
  const m = tessellateBrep(brep), p = m.positions, I = m.indices, key = i => `${p[3 * i]},${p[3 * i + 1]},${p[3 * i + 2]}`, d = new Map(); let vol = 0; const tris = [];
  for (let t = 0; t < I.length; t += 3) {
    const k = [key(I[t]), key(I[t + 1]), key(I[t + 2])]; for (let e = 0; e < 3; e++) { const s = k[e] + '>' + k[(e + 1) % 3]; d.set(s, (d.get(s) ?? 0) + 1); }
    const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3]; tris.push([[p[a], p[a + 1], p[a + 2]], [p[b], p[b + 1], p[b + 2]], [p[c], p[c + 1], p[c + 2]]]);
    vol += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  for (const [s, n] of d) { const [x, y] = s.split('>'); assert.equal(n, 1, 'duplicate ' + s); assert.equal(d.get(y + '>' + x), 1, 'open ' + s); }
  return { vol, tris };
}
/** Ray parity against triangles (direction chosen off-axis). */
function inside(tris, p) {
  const r = [0.6129, 0.2903, 0.7349]; let c = 0;
  for (const [a, b, q] of tris) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [q[0] - a[0], q[1] - a[1], q[2] - a[2]], h = [r[1] * e2[2] - r[2] * e2[1], r[2] * e2[0] - r[0] * e2[2], r[0] * e2[1] - r[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2]; if (Math.abs(det) < 1e-14) continue;
    const s = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det; if (u < 0 || u > 1) continue;
    const qv = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (r[0] * qv[0] + r[1] * qv[1] + r[2] * qv[2]) / det; if (v < 0 || u + v > 1) continue;
    if ((e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det > 0) c++;
  }
  return c % 2 === 1;
}
/** A tetrahedron (or any triangle-faced polyhedron) straight from points and outward triangles. */
function polyhedron(points, triangles, id) {
  const edges = new Map(), face = (t, k) => {
    const uses = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].map(([s, e]) => { const lo = Math.min(s, e), hi = Math.max(s, e), key = `${id}e${lo}_${hi}`;
      if (!edges.has(key)) edges.set(key, { id: key, curve: lineCurve(key, points[lo], points[hi]), vertices: [`${id}v${lo}`, `${id}v${hi}`] });
      return { edge: key, sense: s === lo ? 'forward' : 'reversed' }; });
    const [a, b, c] = t.map(i => points[i]);
    return { id: 'f' + k, surface: { kind: 'surface', id: `${id}s${k}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[a, c], [b, [b[0] + c[0] - a[0], b[1] + c[1] - a[1], b[2] + c[2] - a[2]]]], weights: [[1, 1], [1, 1]] }, sense: 'forward', loops: [{ kind: 'outer', uses }] };
  };
  const faces = triangles.map(face);
  return buildBrep({ source: { family: 'test', id }, vertices: points.map((p, i) => ({ id: `${id}v${i}`, point: p })), edges: [...edges.values()], bodies: [{ id, kind: 'solid', shells: [{ id: 's', closed: true, faces }] }] });
}
function tetra(p, id) {
  const [a, b, c, d] = p, vol = ((b[0] - a[0]) * ((c[1] - a[1]) * (d[2] - a[2]) - (c[2] - a[2]) * (d[1] - a[1])) - (b[1] - a[1]) * ((c[0] - a[0]) * (d[2] - a[2]) - (c[2] - a[2]) * (d[0] - a[0])) + (b[2] - a[2]) * ((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0])));
  const tris = vol > 0 ? [[0, 2, 1], [0, 1, 3], [1, 2, 3], [0, 3, 2]] : [[0, 1, 2], [0, 3, 1], [1, 3, 2], [0, 2, 3]];
  return { brep: polyhedron(p, tris, id), volume: Math.abs(vol) / 6 };
}

test('boxes: overlap, stacked, through hole, cavity, identical, partial touch, shared-face notch', () => {
  const A = box(0, 0, 0, 10, 10, 10, 'a');
  const cases = [
    [A, box(5, 5, 5, 15, 15, 15, 'b'), 'union', 1875, 1], [A, box(5, 5, 5, 15, 15, 15, 'b'), 'intersection', 125, 1], [A, box(5, 5, 5, 15, 15, 15, 'b'), 'difference', 875, 1],
    [A, box(0, 0, 10, 10, 10, 20, 't'), 'union', 2000, 1], [A, box(0, 0, 10, 10, 10, 20, 't'), 'difference', 1000, 1], [A, box(0, 0, 10, 10, 10, 20, 't'), 'intersection', 0, 0],
    [box(0, 0, 0, 30, 30, 10, 'p'), box(10, 10, -5, 20, 20, 15, 'q'), 'difference', 8000, 1],
    [box(0, 0, 0, 30, 30, 30, 'p'), box(10, 10, 10, 20, 20, 20, 'q'), 'difference', 26000, 1],
    [A, box(0, 0, 0, 10, 10, 10, 'c'), 'union', 1000, 1], [A, box(0, 0, 0, 10, 10, 10, 'c'), 'difference', 0, 0],
    [A, box(5, 0, 10, 15, 10, 20, 'u'), 'union', 2000, 1], [A, box(5, 5, 0, 10, 10, 10, 'n'), 'difference', 750, 1],
    [box(0, 0, 0, 30, 10, 10, 'w'), box(10, -5, -5, 20, 15, 15, 'x'), 'difference', 2000, 2],
  ];
  for (const [a, b, op, vol, bodies] of cases) {
    const r = booleanPolyhedra(a, b, op), report = assertValidBrep(r);
    assert.equal(r.bodies.length, bodies, `${op} ${vol}`);
    assert.ok(Math.abs(measure(r).vol - vol) < 1e-9, `${op}: ${measure(r).vol} vs ${vol}`);
    if (vol === 8000) assert.equal(report.topology[0].genus, 1);
    if (vol === 26000) assert.equal(r.shells.length, 2);
  }
});

test('random tetrahedra: volume identities and point classification for all operations', () => {
  let seed = 17; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pt = (s, o) => [o[0] + (rnd() - .5) * s, o[1] + (rnd() - .5) * s, o[2] + (rnd() - .5) * s];
  let checked = 0;
  for (let k = 0; k < 120; k++) {
    const A = tetra([pt(20, [0, 0, 0]), pt(20, [0, 0, 0]), pt(20, [0, 0, 0]), pt(20, [0, 0, 0])], 'A' + k), B = tetra([pt(20, [3, 2, 1]), pt(20, [3, 2, 1]), pt(20, [3, 2, 1]), pt(20, [3, 2, 1])], 'B' + k);
    if (A.volume < 50 || B.volume < 50) continue;
    const U = booleanPolyhedra(A.brep, B.brep, 'union'), I = booleanPolyhedra(A.brep, B.brep, 'intersection'), D = booleanPolyhedra(A.brep, B.brep, 'difference');
    for (const r of [U, I, D]) assert.equal(checkBrep(r).valid, true, checkBrep(r).issues.join('\n'));
    const mu = measure(U), mi = measure(I), md = measure(D), tol = 1e-9 * (A.volume + B.volume);
    assert.ok(Math.abs(mu.vol + mi.vol - A.volume - B.volume) < tol, `U+I ${k}`);
    assert.ok(Math.abs(md.vol + mi.vol - A.volume) < tol, `D+I ${k}`);
    const ta = measure(A.brep).tris, tb = measure(B.brep).tris;
    for (let s = 0; s < 30; s++) {
      const p = pt(26, [1.5, 1, 0.5]), a = inside(ta, p), b = inside(tb, p);
      assert.equal(inside(mu.tris, p), a || b, `U ${k}`); assert.equal(inside(mi.tris, p), a && b, `I ${k}`); assert.equal(inside(md.tris, p), a && !b, `D ${k}`);
    }
    checked++;
  }
  assert.ok(checked >= 30, String(checked));
});

test('non-convex and holed inputs: an L-prism minus a tilted tetrahedron, a plate with holes ∪ a bar', () => {
  const L = extrudeProfileWithHoles({ id: 'L', outer: [[0, 0], [30, 0], [30, 10], [10, 10], [10, 25], [0, 25]].map(p => ({ kind: 'line', start: p })), height: 8 });
  const T = tetra([[5, 5, -3], [26, 4, 4], [8, 22, 5], [9, 7, 14]], 'T');
  const D = booleanPolyhedra(L, T.brep, 'difference'), I = booleanPolyhedra(L, T.brep, 'intersection');
  assertValidBrep(D); assertValidBrep(I);
  assert.ok(Math.abs(measure(D).vol + measure(I).vol - (30 * 10 + 10 * 15) * 8) < 1e-8);
  const plate = extrudeProfileWithHoles({ id: 'P', outer: [[0, 0], [40, 0], [40, 20], [0, 20]].map(p => ({ kind: 'line', start: p })), holes: [[[5, 5], [5, 15], [15, 15], [15, 5]].map(p => ({ kind: 'line', start: p }))], height: 4 });
  const U = booleanPolyhedra(plate, box(10, -5, 0, 30, 25, 4, 'bar'), 'union');
  // Plate 700 + bar 600 − overlap 350 = 950 mm²; the bar fills part of the hole, which stays open (genus 1).
  assert.ok(Math.abs(measure(U).vol - 950 * 4) < 1e-8, String(measure(U).vol)); assert.equal(assertValidBrep(U).topology[0].genus, 1);
});

test('curved inputs are refused (planar polyhedra only for now)', () => {
  const m = cad.model(), cyl = brepFromBody(m.build({ b: m.sketch.circle({ center: [0, 0], radius: 5 }).extrude(10) }).bodies.b);
  assert.throws(() => booleanPolyhedra(box(0, 0, 0, 10, 10, 10), cyl, 'union'), e => e instanceof BrepError && /not straight/.test(e.message));
});

test('solids touching only along an edge or at a vertex are refused as non-manifold, not returned broken', () => {
  const A = box(0, 0, 0, 10, 10, 10, 'a');
  assert.throws(() => booleanPolyhedra(A, box(10, 10, 0, 20, 20, 10, 'e'), 'union'), e => e instanceof BrepError && /not a manifold solid/.test(e.message));
  assert.throws(() => booleanPolyhedra(A, box(10, 10, 10, 20, 20, 20, 'v'), 'union'), e => e instanceof BrepError && /not a manifold solid/.test(e.message));
  // The same pairs are fine for intersection (empty) and difference (A unchanged).
  assert.equal(booleanPolyhedra(A, box(10, 10, 0, 20, 20, 10, 'e'), 'intersection').bodies.length, 0);
  assert.ok(Math.abs(measure(booleanPolyhedra(A, box(10, 10, 10, 20, 20, 20, 'v'), 'difference')).vol - 1000) < 1e-9);
});

test('the general path reproduces the special-purpose families: orthogonal-cell union, convex intersection', () => {
  // The model graph cannot hold a union and an intersection together (one more reason for the general path).
  const pair = op => { const m = cad.model(), a = m.sketch.rectangle({ width: 16, height: 16 }).extrude(16), b = m.sketch.rectangle({ min: [8, 8], max: [24, 24] }).extrude(16);
    return m.build({ a, b, r: op === 'union' ? a.union(b) : a.intersect(b) }); };
  for (const [op, family] of [['union', 'orthogonal-cell'], ['intersection', 'convex-planar']]) {
    const snap = pair(op); assert.equal(snap.bodies.r.family, family);
    const special = measure(brepFromBody(snap.bodies.r)).vol, general = measure(booleanPolyhedra(brepFromBody(snap.bodies.a), brepFromBody(snap.bodies.b), op)).vol;
    assert.ok(Math.abs(special - general) < 1e-9, `${op}: ${special} vs ${general}`);
  }
});
