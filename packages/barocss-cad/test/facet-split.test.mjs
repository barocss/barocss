import test from 'node:test';
import assert from 'node:assert/strict';
import { facetBrepFromTriangles, splitFacetBrep, brepMassProperties, checkBrep, evaluateCadPart } from '../dist/index.js';

// F1 (R4, D50): a facet body split by a plane on its own triangles, each side closed by an exact planar cap.
const vol = b => brepMassProperties(b, 1).volumeMM3;
/** A cube of side 10 at the origin, each face an n × n grid of quads. */
function cube(n) {
  const P = [], I = [], key = new Map(), v = (x, y, z) => { const k = `${x},${y},${z}`; if (!key.has(k)) { key.set(k, P.length / 3); P.push(x, y, z); } return key.get(k); };
  const faces = [[[0, 0, 0], [0, 1, 0], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, 0, 0], [0, 0, 1], [0, 1, 0]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
  for (const [o, u, w] of faces) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = (a, b) => v(...[0, 1, 2].map(k => 10 * (o[k] + u[k] * a / n + w[k] * b / n)));
    const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1); I.push(a, b, c, a, c, d);
  }
  return { P, I };
}
function torus(R, r, n, m) {
  const P = [], I = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m; P.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)); }
  const at = (i, j) => (i % n) * m + (j % m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) I.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  return { P, I };
}
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });

test('a cube split across, through its grid vertices, and obliquely: the volumes exact, both sides valid, the cap named as the analytic split names it', () => {
  const { P, I } = cube(4), b = facetBrepFromTriangles(P, I, { id: 'm' });
  for (const [normal, offset, below] of [[[0, 0, 1], 3.7, 370], [[0, 0, 1], 5, 500], [[1, 1, 1], 12, 284], [[0, 1, 0], 2.5, 250]]) {
    const r = splitFacetBrep(b, { normal, offset, at: 'c' });
    assert.ok(Math.abs(vol(r.below) - below) < 1e-9 && Math.abs(vol(r.above) - (1000 - below)) < 1e-9, `${normal} ${offset}: ${vol(r.below)} ${vol(r.above)}`);
    assert.equal(checkBrep(r.below).valid, true); assert.equal(checkBrep(r.above).valid, true);
    assert.ok(r.below.faces.some(f => f.name === 'c.cut.top') && r.above.faces.some(f => f.name === 'c.cut.bottom'));
    assert.equal(r.loops.length, 1);
    // The cap is flat on the plane: every loop point on n·p = offset.
    const nn = Math.hypot(...normal);
    for (const p of r.loops[0]) assert.ok(Math.abs((normal[0] * p[0] + normal[1] * p[1] + normal[2] * p[2]) / nn - offset / nn) < 1e-12);
  }
});

test('a torus: across its midplane the cap is an annulus (a hole by containment); through its axis two discs a side; a tilted cut', () => {
  const { P, I } = torus(20, 5, 48, 24), b = facetBrepFromTriangles(P, I, { id: 'm' }), V = vol(b);
  const mid = splitFacetBrep(b, { normal: [0, 0, 1], offset: 0, at: 'c' });
  assert.equal(mid.loops.length, 2); assert.ok(Math.abs(vol(mid.below) - V / 2) < 1e-9 * V && Math.abs(vol(mid.above) - V / 2) < 1e-9 * V);
  assert.equal(checkBrep(mid.below).topology[0].genus, 1);
  const axis = splitFacetBrep(b, { normal: [1, 0, 0], offset: 0, at: 'c' });
  assert.deepEqual(axis.below.faces.filter(f => /cut/.test(f.name)).map(f => f.name.replace(/#\d+$/, '')), ['c.cut.top', 'c.cut.top']);
  assert.equal(axis.below.bodies.length, 1);
  const tilt = splitFacetBrep(b, { normal: [0.3, 0.2, 1], offset: 1, at: 'c' });
  assert.ok(Math.abs(vol(tilt.below) + vol(tilt.above) - V) < 1e-9 * V);
  assert.equal(checkBrep(tilt.below).valid, true); assert.equal(checkBrep(tilt.above).valid, true);
});

test('one tie rule: a vertex within the tie of the plane is on it (moved onto it); a face in the plane stays with the material it bounds', () => {
  // A stepped block: 10 × 10 × 5 with a 4 × 4 × 5 boss on top; cut at the step.
  const P = [], I = [], key = new Map(), v = (x, y, z) => { const k = `${x},${y},${z}`; if (!key.has(k)) { key.set(k, P.length / 3); P.push(x, y, z); } return key.get(k); };
  const quad = (a, b, c, d) => I.push(a, b, c, a, c, d), g = [0, 3, 7, 10];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { quad(v(g[i], g[j], 0), v(g[i], g[j + 1], 0), v(g[i + 1], g[j + 1], 0), v(g[i + 1], g[j], 0)); if (!(i === 1 && j === 1)) quad(v(g[i], g[j], 5), v(g[i + 1], g[j], 5), v(g[i + 1], g[j + 1], 5), v(g[i], g[j + 1], 5)); }
  const ring = (z0, z1, lo, hi, cuts) => { const c = [[lo, lo], [hi, lo], [hi, hi], [lo, hi]]; for (let k = 0; k < 4; k++) { const [x0, y0] = c[k], [x1, y1] = c[(k + 1) % 4], s = [[x0, y0], ...cuts.map(t => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]), [x1, y1]]; for (let q = 0; q + 1 < s.length; q++) quad(v(s[q][0], s[q][1], z0), v(s[q + 1][0], s[q + 1][1], z0), v(s[q + 1][0], s[q + 1][1], z1), v(s[q][0], s[q][1], z1)); } };
  ring(0, 5, 0, 10, [0.3, 0.7]); ring(5, 10, 3, 7, []); quad(v(3, 3, 10), v(7, 3, 10), v(7, 7, 10), v(3, 7, 10));
  const b = facetBrepFromTriangles(P, I, { id: 's' });
  for (const offset of [5, 5 + 1e-9]) {
    const r = splitFacetBrep(b, { normal: [0, 0, 1], offset, at: 'c' });
    assert.ok(Math.abs(vol(r.below) - 500) < 1e-6 && Math.abs(vol(r.above) - 80) < 1e-6, `${offset}: ${vol(r.below)} ${vol(r.above)}`);
    assert.equal(checkBrep(r.below).valid, true); assert.equal(checkBrep(r.above).valid, true);
  }
});

test('an open mesh (a sheet) splits into two sheets, no cap', () => {
  const P = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 5, 5, 4], I = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4];
  const b = facetBrepFromTriangles(P, I, { id: 'p', open: true }), r = splitFacetBrep(b, { normal: [1, 0, 0], offset: 3, at: 'c' });
  assert.ok(r.below.bodies.every(x => x.kind === 'sheet') && r.above.bodies.every(x => x.kind === 'sheet'));
  assert.ok(!r.below.faces.some(f => /cut/.test(f.name)));
});

test('part model: a mesh body splits on its own triangles past the explode limit, axis and oblique, flipped by the normal; a miss is SELECTION', () => {
  const { P, I } = torus(20, 5, 160, 80);
  const mesh = { id: 'm', kind: 'mesh', positions: P, indices: I, representation: 'facets' };
  const r = evaluateCadPart(D([mesh, { id: 'c', kind: 'split', target: 'm', axis: 'z', at: 1 }]));
  assert.equal(r.outputs.length, 2); assert.ok(r.outputs.every(o => o.representation === 'faceted' && o.validate().valid));
  const V = evaluateCadPart(D([mesh])).outputs[0].massProperties(1).volumeMM3, sum = r.outputs.reduce((s, o) => s + o.massProperties(1).volumeMM3, 0);
  assert.ok(Math.abs(sum - V) < 1e-9 * V);
  assert.ok(r.outputs[0].massProperties(1).centroidMM[2] < 1 && r.outputs[1].massProperties(1).centroidMM[2] > 1);
  const flipped = evaluateCadPart(D([mesh, { id: 'c', kind: 'split', target: 'm', normal: [0, 0, -2], at: -2 }]));
  assert.ok(flipped.outputs[0].massProperties(1).centroidMM[2] > 1, 'normal −z: the side it points to first');
  const oblique = evaluateCadPart(D([mesh, { id: 'c', kind: 'split', target: 'm', normal: [1, 1, 1], at: 4 }]));
  assert.ok(Math.abs(oblique.outputs.reduce((s, o) => s + o.massProperties(1).volumeMM3, 0) - V) < 1e-9 * V);
  assert.throws(() => evaluateCadPart(D([mesh, { id: 'c', kind: 'split', target: 'm', normal: [1, 1, 0], at: 40 }])), e => e.code === 'SELECTION');
});

test('oblique split of planar and curved bodies (D50): the tool is two tetrahedra on one exact plane, no longer a rotated box the exact Boolean refused', () => {
  const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'b', kind: 'extrude', sketch: 's', height: 10 }];
  const r = evaluateCadPart(D([...box, { id: 'o', kind: 'split', target: 'b', normal: [1, 1, 1], at: 12 }]));
  assert.deepEqual(r.outputs.map(o => +o.massProperties(1).volumeMM3.toFixed(9)), [284, 716]);
  assert.ok(r.outputs[0].brep.faces.some(f => f.name === 'o.cut.top') && r.outputs[1].brep.faces.some(f => f.name === 'o.cut.bottom'));
  const slab = evaluateCadPart(D([...box, { id: 'c', kind: 'split', target: 'b', axis: 'z', at: 4 }, { id: 'o', kind: 'split', target: 'c/0', normal: [1, 1, 1], at: 5 }]));
  assert.ok(Math.abs(slab.output('o/0').massProperties(1).volumeMM3 - 124 / 6) < 1e-9);
  const holed = evaluateCadPart(D([...box, { id: 'h', kind: 'hole', target: 'b', center: [5, 5], radius: 2, depth: 20 }, { id: 'o', kind: 'split', target: 'h', normal: [1, 0, 1], at: 9 }]));
  assert.ok(Math.abs(holed.outputs.reduce((s, o) => s + o.massProperties(1).volumeMM3, 0) - (1000 - 40 * Math.PI)) < 1e-6);
});

test('PERF3 B10: a plane square to an axis puts the cut points exactly on it (the section loops and both caps\' corners have its coordinate to the bit); an oblique plane interpolates as before', () => {
  const { P, I } = torus(20, 5, 37, 23), b = facetBrepFromTriangles(P, I, { id: 'm' });
  for (const [normal, at, k] of [[[0, 0, 1], 0.731, 2], [[1, 0, 0], 17.3, 0], [[0, -1, 0], -2.17, 1]]) {
    const r = splitFacetBrep(b, { normal, offset: at, at: 'c' }), c = normal[k] * at;
    assert.ok(r.loops.length && r.loops.every(l => l.every(p => p[k] === c)), `${normal}: the loops off the plane`);
    for (const side of [r.below, r.above]) {
      const cap = side.faces.filter(f => /^c\./.test(f.name ?? ''));
      assert.ok(cap.length, `${normal}: a cap`);
      for (const f of cap) for (let i = k; i < f.surface.positions.length; i += 3) assert.equal(f.surface.positions[i], c);
    }
    assert.ok(Math.abs(vol(r.below) + vol(r.above) - vol(b)) <= 1e-9 * vol(b));
  }
});
