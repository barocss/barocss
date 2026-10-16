import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, projectBrepHiddenLines } from '../dist/index.js';

const part = features => evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features }).outputs.map(o => o.brep);
const plate = () => part([{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] }, { id: 'n1', kind: 'extrude', sketch: 'n0', height: 8 }, { id: 'n2', kind: 'hole', target: 'n1', center: [32, 16], radius: 4 }]);
const cylinder = () => part([{ id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'n1', kind: 'extrude', sketch: 'n0', height: 10 }]);
const FRONT = { toward: [0, -1, 0], up: [0, 0, 1] }, TOP = { toward: [0, 0, 1], up: [0, 1, 0] }, ISO = { toward: [1, -1, 1], up: [0, 0, 1] };
const pieces = (pr, visible) => pr.edges.flatMap(e => e.pieces.filter(p => p.visible === visible).map(p => ({ ...p.curve, edge: e })));
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const lineIs = (c, a, b, tol = 1e-9) => (near(c.a[0], a[0], tol) && near(c.a[1], a[1], tol) && near(c.b[0], b[0], tol) && near(c.b[1], b[1], tol)) || (near(c.a[0], b[0], tol) && near(c.a[1], b[1], tol) && near(c.b[0], a[0], tol) && near(c.b[1], a[1], tol));

test('a plate with a through hole: outline visible, the hole as two exact hidden lines in the front view', () => {
  const pr = projectBrepHiddenLines(plate(), FRONT);
  assert.deepEqual([pr.right, pr.up].map(v => v.map(x => Math.round(x * 1e9) / 1e9 + 0)), [[1, 0, 0], [0, 0, 1]]);
  const vis = pieces(pr, true), hid = pieces(pr, false);
  assert.equal(vis.length, 4, 'the four sides of the outline');
  for (const [a, b] of [[[0, 0], [64, 0]], [[64, 0], [64, 8]], [[0, 8], [64, 8]], [[0, 0], [0, 8]]]) assert.ok(vis.some(c => c.kind === 'line' && lineIs(c, a, b)), `outline ${a}–${b}`);
  // The back edges and the hole's rims lie on the outline: visible lines take precedence.
  assert.equal(hid.length, 2);
  for (const x of [28, 36]) assert.ok(hid.some(c => c.kind === 'line' && lineIs(c, [x, 0], [x, 8])), `hidden hole wall at x = ${x}`);
  assert.deepEqual(pr.min, [0, 0]); assert.deepEqual(pr.max, [64, 8]);
});

test('the top view shows the hole as an exact circle with its radius and centre', () => {
  const pr = projectBrepHiddenLines(plate(), TOP);
  const arcs = pieces(pr, true).filter(c => c.kind === 'arc');
  assert.ok(arcs.length >= 1);
  for (const a of arcs) {
    assert.ok(near(a.center[0], 32) && near(a.center[1], 16), 'centred on the hole');
    assert.ok(near(Math.hypot(...a.u), 4) && near(Math.hypot(...a.v), 4) && near(a.u[0] * a.v[0] + a.u[1] * a.v[1], 0), 'a true circle of radius 4');
    assert.equal(a.edge.kind, 'circle'); assert.ok(near(a.edge.circle.radius, 4)); assert.deepEqual(a.edge.circle.center.map(x => Math.round(x * 1e9) / 1e9), [32, 16, 8]);
  }
  assert.ok(near(arcs.reduce((t, a) => t + a.t1 - a.t0, 0), 2 * Math.PI, 1e-9), 'the whole circle');
  assert.equal(pieces(pr, false).length, 0, 'the bottom rim lies under the top one');
  // Edges carry their persistent names, and their 3D ends.
  const edge = pr.edges.find(e => e.name === 'n1.side0|n1.top');
  assert.ok(edge && edge.kind === 'line'); assert.deepEqual(edge.ends.map(p => p.map(x => Math.round(x))).sort(), [[0, 0, 8], [64, 0, 8]]);
});

test('a cylinder seen at an angle: exact silhouettes, and its base hidden from where they touch it', () => {
  const pr = projectBrepHiddenLines(cylinder(), ISO);
  const sil = pr.edges.filter(e => e.kind === 'silhouette');
  assert.equal(sil.length, 2);
  const s = Math.SQRT1_2 * 5;
  for (const e of sil) {
    assert.equal(e.pieces.length, 1); assert.ok(e.pieces[0].visible); assert.equal(e.pieces[0].curve.kind, 'line');
    const [a, b] = e.ends; assert.ok(near(Math.abs(a[0]), s, 1e-9) && near(a[0], a[1], 1e-9) && near(Math.abs(a[2] - b[2]), 10), 'a generator on the exact surface, the full height');
  }
  // The base circle turns hidden where the silhouettes meet it (45° round from the X axis), to within
  // the facets that hide it.
  const base = pr.edges.filter(e => e.kind === 'circle' && e.circle.center[2] === 0);
  const cuts = base.flatMap(e => e.pieces.flatMap(p => [p.curve.t0, p.curve.t1]));
  assert.ok(cuts.some(t => near(Math.abs(t), Math.PI / 4, 1e-4)) && cuts.some(t => near(Math.abs(t), 3 * Math.PI / 4, 1e-4)), String(cuts));
  assert.ok(base.some(e => e.pieces.some(p => !p.visible)), 'its back half is hidden');
  // The top rim is all visible.
  assert.ok(pr.edges.filter(e => e.kind === 'circle' && e.circle.center[2] === 10).every(e => e.pieces.every(p => p.visible)));
});

test('through a wide hole the far rim of its bottom shows, exactly where the sight line clears the top', () => {
  const holed = r => part([{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] }, { id: 'n1', kind: 'extrude', sketch: 'n0', height: 8 }, { id: 'n2', kind: 'hole', target: 'n1', center: [32, 16], radius: r }]);
  const bottomVisible = pr => pr.edges.filter(e => e.kind === 'circle' && near(e.circle.center[2], 0, 1e-9)).flatMap(e => e.pieces.filter(p => p.visible).map(p => p.curve));
  assert.equal(bottomVisible(projectBrepHiddenLines(holed(4), ISO)).length, 0, 'a narrow hole hides its bottom');
  const arcs = bottomVisible(projectBrepHiddenLines(holed(6), ISO));
  assert.equal(arcs.length, 1);
  // Visible where the chord along the sight line (2r·−cos(θ + 45°)) is longer than the 8 mm depth's run, 8 / tan 35.26°.
  const run = 8 * Math.SQRT2, half = Math.acos(run / 12);
  assert.ok(near(arcs[0].t0, Math.PI * 3 / 4 - half, 0.01) && near(arcs[0].t1, Math.PI * 3 / 4 + half, 0.01), `${arcs[0].t0}–${arcs[0].t1}`);
});

test('a cylinder seen along its axis has no silhouette; seen side on, its rims are lines', () => {
  assert.equal(projectBrepHiddenLines(cylinder(), TOP).edges.filter(e => e.kind === 'silhouette').length, 0);
  const pr = projectBrepHiddenLines(cylinder(), FRONT);
  const vis = pieces(pr, true);
  for (const [a, b] of [[[-5, 0], [5, 0]], [[-5, 10], [5, 10]], [[-5, 0], [-5, 10]], [[5, 0], [5, 10]]]) assert.ok(vis.some(c => c.kind === 'line' && lineIs(c, a, b)), `${a}–${b}`);
  assert.equal(pieces(pr, false).length, 0);
});

test('a torus seen along its axis: both silhouette circles visible, nothing hidden', () => {
  const torus = part([{ id: 'n0', kind: 'sketch', profile: 'circle', center: [20, 0], radius: 5 }, { id: 'n1', kind: 'revolve', sketch: 'n0', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }]);
  const pr = projectBrepHiddenLines(torus, { toward: [0, -1, 0], up: [0, 0, 1] });
  assert.equal(pieces(pr, false).length, 0);
  const radii = pieces(pr, true).flatMap(c => c.kind === 'polyline' ? c.points : c.kind === 'line' ? [c.a, c.b] : []).map(p => Math.hypot(p[0], p[1]));
  assert.ok(radii.length > 20);
  assert.ok(radii.every(r => near(r, 15, 0.05) || near(r, 25, 0.05)), 'on the inner or the outer equator');
  assert.ok(radii.some(r => r < 20) && radii.some(r => r > 20));
});

test('one body hides another behind it', () => {
  const near_ = part([{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10] }, { id: 'n1', kind: 'extrude', sketch: 'n0', height: 10 }]);
  const far = part([{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [5, 20], max: [15, 30] }, { id: 'n1', kind: 'extrude', sketch: 'n0', height: 20 }]);
  const pr = projectBrepHiddenLines([...near_, ...far], FRONT);
  const hid = pieces(pr, false), vis = pieces(pr, true);
  // The far box's lower part is behind the near box: its sides are hidden up to z = 10, visible above.
  for (const x of [5, 15]) {
    assert.ok(hid.some(c => c.kind === 'line' && lineIs(c, [x, 0], [x, 10], 1e-5)), `hidden below at x = ${x}`);
    assert.ok(vis.some(c => c.kind === 'line' && lineIs(c, [x, 10], [x, 20], 1e-5)), `visible above at x = ${x}`);
  }
});

test('an up direction along the view direction is refused', () => {
  assert.throws(() => projectBrepHiddenLines(cylinder(), { toward: [0, 0, 1], up: [0, 0, 2] }), /parallel/);
});
