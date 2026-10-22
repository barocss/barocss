import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, exportStep, importStep } from '../dist/index.js';
import { brepMassProperties } from '../dist/solid-mass.js';
import { tessellateBrep } from '../dist/brep-tessellate.js';

// R11.3 (D114): a mesh body's shell — its cavity the mesh's own triangles, each vertex moved in to the least-squares point
// of its triangles' planes moved in by the wall (where up to three planes meet, their sharp join exactly), the wall it
// achieves measured and reported on the output — and thicken's fold refused by name. Refused on HEAD (faceted faces).
// Oracles in closed form: the sharp-join inset of a polyhedron, every face's plane moved in by the wall.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const refused = (features, code, pattern) => assert.throws(() => out(features), e => e.code === code && pattern.test(e.message), String(pattern));
const xz = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const mesh = (P, I) => ({ id: 'm', kind: 'mesh', positions: [...P], indices: [...I], representation: 'facets' });
const shell = (P, I, t, open) => [mesh(P, I), { id: 'sh', kind: 'shell', target: 'm', thickness: t, ...(open ? { open } : {}) }];
const OCTA = { P: [10, 0, 0, -10, 0, 0, 0, 10, 0, 0, -10, 0, 0, 0, 10, 0, 0, -10], I: [0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5] };
function boxMesh(a, b, c) {
  const P = [0, 0, 0, a, 0, 0, a, b, 0, 0, b, 0, 0, 0, c, a, 0, c, a, b, c, 0, b, c], I = [];
  for (const [p0, p1, p2, p3] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) I.push(p0, p1, p2, p0, p2, p3);
  return { P, I };
}
/** An icosahedron's sphere of radius R, its faces cut in four `levels` times. */
function icosphere(R, levels) {
  const g = (1 + Math.sqrt(5)) / 2;
  const P = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]].map(p => { const l = Math.hypot(...p); return p.map(x => x / l); });
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let l = 0; l < levels; l++) {
    const mid = new Map(), m = (a, b) => { const k = a < b ? `${a},${b}` : `${b},${a}`; if (!mid.has(k)) { const p = P[a].map((x, i) => x + P[b][i]), n = Math.hypot(...p); P.push(p.map(x => x / n)); mid.set(k, P.length - 1); } return mid.get(k); };
    F = F.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
  }
  return { P: P.flatMap(p => p.map(x => x * R)), I: F.flat() };
}
/** An exact body's tessellation as a mesh. */
const meshOf = features => { const m = tessellateBrep(out(features).brep, { segmentsPerQuarter: 4 }); return { P: m.positionsMM, I: m.indices }; };
/** A U-prism (40 × 20 section, a slot 10 wide down to 2 mm above the bottom) 30 long; a box with a blind pocket. */
const U = meshOf([{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [40, 0], [40, 20], [25, 20], [25, 2], [15, 2], [15, 20], [0, 20]], plane: xz }, { id: 'e', kind: 'extrude', sketch: 's', height: 30 }]);
const POCKET = meshOf([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 20 }, { id: 'p', kind: 'sketch', profile: 'rectangle', min: [10, 10], max: [30, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 30, from: 2 }, { id: 'd', kind: 'difference', target: 'e', tool: 'pe' }]);

test('R11.3 mesh bodies shelled: polyhedra exactly their sharp-join insets, the wall reported (refused on HEAD: faceted faces)', () => {
  const cases = [
    // |x| + |y| + |z| ≤ a moved in by t is ≤ a − √3 t.
    ['octahedron', OCTA, 1, 4 / 3 * 1000 - 4 / 3 * (10 - Math.sqrt(3)) ** 3, [1, 1]],
    ['octahedron', OCTA, 3, 4 / 3 * 1000 - 4 / 3 * (10 - 3 * Math.sqrt(3)) ** 3, [3, 3]],
    ['box', boxMesh(40, 30, 20), 2, 24000 - 36 * 26 * 16, [2, 2]],
    // The U's section inset (its slot grown by t): (40 − 2t)(20 − 2t) − (10 + 2t)·18, over 30 − 2t.
    ...[0.5, 0.9].map(t => ['U-prism', U, t, 18600 - ((40 - 2 * t) * (20 - 2 * t) - (10 + 2 * t) * 18) * (30 - 2 * t), [t, t]]),
    // The box less its pocket grown by t: the pocket's inside corners, sharply joined, leave the wall up to 2 − t there.
    ['pocket', POCKET, 0.9, 20400 - (38.2 * 28.2 * 18.2 - 21.8 * 11.8 * 18), [0.9, 1.1]],
  ];
  for (const [name, m, t, exact, [lo, hi]] of cases) {
    const o = out(shell(m.P, m.I, t)), r = checkBrep(o.brep, { strict: true }), v = o.massProperties(1), what = `${name} t ${t}`;
    assert.equal(r.valid, true, `${what}: ${r.issues}`);
    assert.equal(o.brep.shells.length, 2, what);
    assert.ok(Math.abs(v.volumeMM3 / exact - 1) < 1e-12, `${what}: ${v.volumeMM3} vs ${exact}`);
    assert.equal(o.shell.wallMM, t);
    assert.ok(Math.abs(o.shell.wallMinMM - lo) < 1e-9 && Math.abs(o.shell.wallMaxMM - hi) < 1e-9, `${what}: wall ${o.shell.wallMinMM} … ${o.shell.wallMaxMM}`);
  }
});

test('R11.3 a mesh sphere shelled: the wall it achieves within its normals\' spread, reported', () => {
  for (const [levels, t, spread] of [[3, 1, 5e-4], [3, 5, 5e-4], [1, 3, 7e-3], [0, 3, 1e-12]]) {
    const m = icosphere(10, levels), o = out(shell(m.P, m.I, t)), r = checkBrep(o.brep, { strict: true }), what = `level ${levels} t ${t}`;
    assert.equal(r.valid, true, `${what}: ${r.issues}`);
    assert.equal(o.brep.shells.length, 2, what);
    assert.ok(o.shell.wallMinMM >= t * (1 - spread) && o.shell.wallMaxMM <= t * (1 + spread), `${what}: ${o.shell.wallMinMM} … ${o.shell.wallMaxMM}`);
    assert.ok(o.massProperties(1).volumeMM3 > 0 && o.massProperties(1).volumeMM3 < out([mesh(m.P, m.I)]).massProperties(1).volumeMM3, what);
  }
});

test('R11.3 a hollow mesh body through STEP and back, planar and tessellated: its void kept (HEAD wrote both shells as one, refused on reading)', () => {
  const ball = icosphere(10, 3), o = out(shell(ball.P, ball.I, 1)), v = o.massProperties(1).volumeMM3;
  for (const meshes of ['planar', 'tessellated']) {
    const back = importStep(exportStep(o.brep, { meshes }));
    assert.equal(back.shells.length, 2, meshes);
    assert.ok(Math.abs(brepMassProperties(back, 1).volumeMM3 / v - 1) < 1e-9, meshes);
  }
});

test('R11.3 refused by name: a fold, a sphere turned inside out, offsets crossing through a thin floor, an opened mesh face', () => {
  // The U's slot floor is 2 thick: at 1.5 its two offsets cross, the end caps' triangles turned over.
  refused(shell(U.P, U.I, 1.5), 'CAPABILITY', /\[OFFSET_FOLDS\] the mesh's offset turns over at its triangle \d+ near/);
  const ball = icosphere(10, 3);
  refused(shell(ball.P, ball.I, 11), 'CAPABILITY', /\[OFFSET_FOLDS\] the mesh's offset turns inside out: the wall 11 mm/);
  // The pocket's floor 2 above the bottom: no triangle joins the two, so nothing turns over — the offsets cross.
  refused(shell(POCKET.P, POCKET.I, 1.5), 'CAPABILITY', /\[WALL_TOO_THIN\] the wall's inner surface meets itself or the mesh's surface at \(.*\) \(\d+ crossings\)/);
  const face = out([mesh(OCTA.P, OCTA.I)]).brep.faces[0].name;
  refused(shell(OCTA.P, OCTA.I, 1, [face]), 'CAPABILITY', /opening a face of a mesh body .* is not supported yet/);
});

test('R11.3 thicken refuses its fold by name: a quarter cylinder R 10 thickened towards its axis past its radius (HEAD made it, its sheet through the axis)', () => {
  const w = Math.SQRT1_2, QUARTER = { degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[10, 0, 0], [10, 10, 0]], [[10, 0, 10], [10, 10, 10]], [[0, 0, 10], [0, 10, 10]]], weights: [[1, 1], [w, w], [1, 1]] };
  const thicken = (t, side) => [{ id: 't', kind: 'thicken', surface: QUARTER, thickness: t, side }];
  refused(thicken(12, 'normal'), 'CAPABILITY', /\[OFFSET_FOLDS\] face t curves more tightly than the wall .*its radius there 10 mm, the wall 12 mm/);
  refused(thicken(21, 'both'), 'CAPABILITY', /\[OFFSET_FOLDS\] face t curves more tightly than the wall .*the wall 10\.5 mm/);
  // Within the radius, or away from the axis: made (a sampled mesh, so the volume is near the exact one).
  for (const [t, side, exact] of [[9, 'normal', Math.PI / 4 * (100 - 1) * 10], [12, 'reverse', Math.PI / 4 * (22 * 22 - 100) * 10], [19, 'both', Math.PI / 4 * (19.5 ** 2 - 0.5 ** 2) * 10]]) {
    const v = out(thicken(t, side)).massProperties(1).volumeMM3;
    assert.ok(Math.abs(v / exact - 1) < 2e-3, `${t} ${side}: ${v} vs ${exact}`);
  }
});
