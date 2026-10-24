import test from 'node:test';
import assert from 'node:assert/strict';
import { facetBrepFromTriangles, facetBoolean, isFacetBooleanError, evaluateCadPart, brepMassProperties, checkBrep, exportStep, importStep, massPropertiesOf, outputOf, checkOutput } from '../dist/index.js';

// F2 (R6, D52): a mesh body with an exact one — the mesh near the tool through the exact Boolean, the tool's faces
// kept exact (their rims polylines on them), the far mesh untouched; mixed bodies go on through F1 and F2.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const vol = b => brepMassProperties(b, 1).volume;
/** A cube of side s at the origin, each side an n × n grid of quads. */
function cube(n, s = 20) {
  const P = [], I = [], key = new Map(), v = (x, y, z) => { const k = `${x},${y},${z}`; if (!key.has(k)) { key.set(k, P.length / 3); P.push(x, y, z); } return key.get(k); };
  const faces = [[[0, 0, 0], [0, 1, 0], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, 0, 0], [0, 0, 1], [0, 1, 0]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
  for (const [o, u, w] of faces) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = (a, b) => v(...[0, 1, 2].map(k => s * (o[k] + u[k] * a / n + w[k] * b / n)));
    const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1); I.push(a, b, c, a, c, d);
  }
  return { P, I };
}
const cylinder = (r, z0, h, cx = 10, cy = 10) => evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'circle', center: [cx, cy], radius: r }, { id: 'c', kind: 'extrude', sketch: 's', height: h, from: z0 }])).outputs[0].brep;
const sphere = (r, c) => evaluateCadPart(D([{ id: 'ss', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, -r] }, { kind: 'arc', start: [0, r], center: [0, 0], direction: 'cw' }], plane: { origin: c, normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { id: 'sp', kind: 'revolve', sketch: 'ss', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }])).outputs[0].brep;

test('a facet cube with a cylinder and a sphere: holes, a boss, a bite and an intersection — volumes exact, the tool faces exact, the mesh faces keep their names', () => {
  const { P, I } = cube(4), m = facetBrepFromTriangles(P, I, { id: 'm' });
  for (const [what, tool, op, want, rel] of [
    ['through hole', cylinder(3, -5, 30), 'difference', 8000 - Math.PI * 9 * 20, 1e-9],
    ['blind hole', cylinder(3, 12, 20), 'difference', 8000 - Math.PI * 9 * 8, 1e-9],
    ['boss', cylinder(3, 15, 10), 'union', 8000 + Math.PI * 9 * 5, 1e-9],
    // (The rim at the default 32 segments a quarter: 1.008e-5 off. It was 6.4e-6 while spurious crossings of an arc and its copy split
    // the arc into 41 edges, each tessellated on its own — D152.)
    ['sphere bite', sphere(6, [20, 20, 20]), 'difference', 8000 - Math.PI * 4 / 3 * 216 / 8, 1.5e-5],
    ['sphere ∩', sphere(6, [20, 20, 20]), 'intersection', Math.PI * 4 / 3 * 216 / 8, 1e-9],
  ]) {
    const r = facetBoolean(m, tool, op, { id: 'r' });
    assert.equal(checkBrep(r).valid, true, `${what}: ${checkBrep(r).issues[0]}`);
    assert.ok(Math.abs(vol(r) / want - 1) < rel, `${what}: ${vol(r)} vs ${want}`);
    assert.ok(r.faces.some(f => f.surface.kind !== 'facets'), `${what}: an exact face`);
    assert.ok(r.faces.filter(f => f.surface.kind === 'facets').every(f => /^m\.region\d+(#\d+)?$/.test(f.name)), `${what}: mesh names`);
  }
  // The rim: a polyline on the exact face, its tolerance the chords' distance from it (under a micrometre here).
  const r = facetBoolean(m, cylinder(3, -5, 30), 'difference', { id: 'r' }), wall = r.faces.find(f => f.surface.kind !== 'facets');
  // (32 segments a quarter on r 3: the sagitta 3(1 − cos(π/128)), doubled.)
  const rims = r.edges.filter(e => e.curve.controlPoints.length > 2), sag = 2 * 3 * (1 - Math.cos(Math.PI / 128));
  assert.ok(rims.length && rims.every(e => e.toleranceMM <= 1.01 * sag), rims.map(e => e.toleranceMM).join(' '));
  assert.ok(wall);
});

test('part model: holes and Booleans on a mesh of 25,600 triangles (past F0\'s 16,000), the result going on — a second hole, a split; a box − mesh still F0 (F3)', () => {
  const n = 160, m = 80, P = [], I = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m; P.push((20 + 6 * Math.cos(v)) * Math.cos(u), (20 + 6 * Math.cos(v)) * Math.sin(u), 6 * Math.sin(v)); }
  const at = (i, j) => (i % n) * m + (j % m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) I.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  const mesh = { id: 'm', kind: 'mesh', positions: P, indices: I, representation: 'facets' }, V = massPropertiesOf(evaluateCadPart(D([mesh])).outputs[0]).volume;
  const hole = { id: 'h', kind: 'hole', target: 'm', center: [20, 0.37], radius: 2 };
  const one = outputOf(evaluateCadPart(D([mesh, hole])), 'h');
  assert.equal(one.representation, 'faceted'); assert.ok(checkOutput(one).valid);
  assert.ok(V - massPropertiesOf(one).volume > 0.9 * Math.PI * 4 * 12 && V - massPropertiesOf(one).volume < 1.1 * Math.PI * 4 * 12);
  const two = outputOf(evaluateCadPart(D([mesh, hole, { id: 'h2', kind: 'hole', target: 'h', center: [-20, 0.41], radius: 2 }])), 'h2');
  assert.ok(checkOutput(two).valid);
  assert.equal(two.brep.faces.filter(f => f.surface.kind !== 'facets').length, 4, 'both holes\' walls exact (two halves each)');
  const cut = evaluateCadPart(D([mesh, hole, { id: 'c', kind: 'split', target: 'h', axis: 'z', at: 1 }]));
  assert.equal(cut.outputs.length, 2); assert.ok(cut.outputs.every(o => checkOutput(o).valid));
  assert.ok(Math.abs(cut.outputs.reduce((s, o) => s + massPropertiesOf(o).volume, 0) / massPropertiesOf(one).volume - 1) < 1e-6);
  const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [15, -3], max: [25, 3] }, { id: 'b', kind: 'extrude', sketch: 's', height: 10, from: 4 }];
  const u = outputOf(evaluateCadPart(D([mesh, ...box, { id: 'u', kind: 'union', target: 'm', tool: 'b' }])), 'u');
  assert.ok(checkOutput(u).valid && massPropertiesOf(u).volume > V);
  assert.throws(() => evaluateCadPart(D([mesh, ...box, { id: 'd', kind: 'difference', target: 'b', tool: 'm' }])), e => e.code === 'CAPABILITY' && /F3/.test(e.message));
});

test('refusals: too much mesh near the tool is CAPABILITY, saying how much; a sheet is GEOMETRY', () => {
  const { P, I } = cube(40), m = facetBrepFromTriangles(P, I, { id: 'm' });
  assert.throws(() => facetBoolean(m, cylinder(3, -5, 30), 'difference', { id: 'r', nearTriangles: 100 }), e => isFacetBooleanError(e) && e.code === 'CAPABILITY' && /the tool meets \d+ triangles of the mesh near it, more than the 100/.test(e.message));
  const sheet = facetBrepFromTriangles([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 5, 5, 4], [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4], { id: 'p', open: true });
  assert.throws(() => facetBoolean(sheet, cylinder(1, -5, 30, 5, 5), 'difference', { id: 'r' }), e => isFacetBooleanError(e) && e.code === 'GEOMETRY' && /open \(a sheet\)/.test(e.message));
});

test('a mixed body (mesh faces and exact ones) out to STEP as a mesh body (its exact faces sampled) and back: the volume within the sampling', () => {
  const { P, I } = cube(4), m = facetBrepFromTriangles(P, I, { id: 'm' }), r = facetBoolean(m, cylinder(3, -5, 30), 'difference', { id: 'r' });
  const back = importStep(exportStep([r], { name: 'mixed', meshes: 'tessellated' }));
  // (The hole a polygon inscribed in its circle: the body larger by its slivers, under 2e-4 of it here.)
  assert.ok(vol(back) > vol(r) && vol(back) / vol(r) - 1 < 2e-4, `${vol(back)} vs ${vol(r)}`);
  assert.ok(back.faces.some(f => /^c\.side0/.test(f.name ?? '')), 'the tool faces\' names');
});
