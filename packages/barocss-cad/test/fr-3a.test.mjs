import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, faceGeometry, booleanAnalytic, brepMassProperties, massPropertiesOf, outputOf, checkOutput } from '../dist/index.js';

// FR3a (D125): the planar Boolean's fix, and two-member corners. Oracles written here: a prism cut by planes holds
// A × (its centroidal axis between them); a mitre's end angle θ = acos(u1·m) and its long point L + c·tan θ; a butt's
// through member runs on (b/2)·sin φ, the other ends (b/2)/sin φ short of the point along its line; members that meet
// face to face unite to the sum of their volumes. Section sizes are test values.
const D = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const run = (features) => evaluateCadPart(D(features));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(...a), unit = a => a.map(x => x / len(a));
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)), `${what}: ${got} vs ${want} (${Math.abs(got - want) / Math.max(1, Math.abs(want))})`);
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A_SHARP = 1600 - 34 * 34;
const ROUND = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 }, A_ROUND = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9);
const volume = o => massPropertiesOf(o).volume;
/** All the members united by the analytic Boolean: one body when they meet face to face, its volume their sum. */
function welded(outputs) { let b = outputs[0].brep; for (const o of outputs.slice(1)) b = booleanAnalytic(b, o.brep, 'union'); return b; }

test('FR3a the planar route: a sharp tube on a 120° corner is split, and two mitred sharp tubes united, by the part\'s own features (refused "not planar" before)', () => {
  // (The polyhedral Boolean needs each face's vertices exactly coplanar; a member off the axes has them so to ~1e-15.)
  const p0 = [0, 0, 0], p = [200, 0, 0], p2 = [200 + 150 * Math.cos(Math.PI / 3), 150 * Math.sin(Math.PI / 3), 0];
  const u1 = unit(sub(p, p0)), u2 = unit(sub(p2, p)), m = unit([u1[0] + u2[0], u1[1] + u2[1], 0]);
  const feats = [
    { id: 'a', kind: 'frame-member', section: SHARP, start: p0, end: [260, 0, 0] },
    { id: 'b', kind: 'frame-member', section: SHARP, start: [p[0] - 60 * u2[0], p[1] - 60 * u2[1], 0], end: p2 },
    { id: 'ac', kind: 'split', target: 'a', normal: m, at: dot(m, p) }, { id: 'bc', kind: 'split', target: 'b', normal: m, at: dot(m, p) },
    { id: 'w', kind: 'union', target: 'ac/0', tool: 'bc/1' },
  ];
  const w = outputOf(run(feats), 'w');
  near(volume(w), A_SHARP * 350, 1e-12, 'the welded pair'); assert.equal(w.bodyCount, 1); assert.ok(checkOutput(w).valid);
});

test('FR3a mitres: a 600 × 400 rectangle of sharp tubes — each A·L, 45° ends, long points L + b; the four meet face to face (welded: one body, their sum)', () => {
  const points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0]], segments = [[0, 1], [1, 2], [2, 3], [3, 0]];
  const snap = run([{ id: 'f', kind: 'frame', points, segments, section: SHARP, corners: { default: 'mitre' } }]);
  snap.outputs.forEach((o, k) => {
    const [i, j] = segments[k], L = len(sub(points[j], points[i])), u = o.member.axis;
    near(volume(o), A_SHARP * L, 1e-12, `member ${k} volume`); assert.equal(o.bodyCount, 1); assert.ok(checkOutput(o).valid, `member ${k}`);
    const along = o.brep.vertices.map(v => dot(sub(v.point, points[i]), u));
    near(Math.max(...along) - Math.min(...along), L + 40, 1e-12, `member ${k} long point`);
    assert.deepEqual(o.member.ends.map(e => [e.end, e.kind, e.point]), [['start', 'mitre', i], ['end', 'mitre', j]]);
    o.member.ends.forEach(e => near(e.angle, 45, 1e-12, `member ${k} ${e.end} angle`));
    // The cut faces by name, at 45° to the line.
    const cut = o.brep.faces.filter(f => /^f\.m\d\.(start|end)\.mitre/.test(f.name)).map(f => faceGeometry(f));
    assert.equal(cut.length, 2, `member ${k} cut faces`); cut.forEach(g => near(Math.abs(dot(g.n, u)), Math.SQRT1_2, 1e-12, `member ${k} cut`));
  });
  const all = welded(snap.outputs);
  assert.equal(all.bodies.length, 1); near(brepMassProperties(all, 1).volume, A_SHARP * 2000, 1e-12, 'welded');
});

test('FR3a a mitre at 120° and one out of the plane (a 3D corner), round-cornered tubes: A·L, θ = acos(u1·m), long point L + (b/2)tan θ, the pair meets face to face', () => {
  for (const [name, p2] of [['120°', [200 + 150 * Math.cos(Math.PI / 3), 150 * Math.sin(Math.PI / 3), 0]], ['3d', [260, 90, 70]]]) {
    const points = [[0, 0, 0], [200, 0, 0], p2], u1 = [1, 0, 0], u2 = unit(sub(p2, points[1])), m = unit(u1.map((x, k) => x + u2[k])), theta = Math.acos(dot(u1, m));
    // (The section's x in the corner's plane, its y square to it — so the two mirror in the mitre plane: up = the plane's normal.)
    const n = unit([u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]]);
    const snap = run([{ id: 'f', kind: 'frame', points, segments: [[0, 1], [1, 2]], section: ROUND, up: n, corners: { default: 'mitre' } }]);
    const [a, b] = snap.outputs, L1 = 200, L2 = len(sub(p2, points[1]));
    // (Round corners cut obliquely: the kernel's quadrature mass, about 1e-9.)
    near(volume(a), A_ROUND * L1, 1e-8, `${name} a`); near(volume(b), A_ROUND * L2, 1e-8, `${name} b`);
    near(a.member.ends[1].angle, theta * 180 / Math.PI, 1e-12, `${name} θ`);
    const along = a.brep.vertices.map(v => dot(v.point, u1));
    near(Math.max(...along), L1 + 20 * Math.tan(theta), 1e-12, `${name} long point`);
    const w = booleanAnalytic(a.brep, b.brep, 'union');
    assert.equal(w.bodies.length, 1); near(brepMassProperties(w, 1).volume, A_ROUND * (L1 + L2), 1e-8, `${name} welded`);
  }
});

test('FR3a butts: square and at 60° — the through member runs on (b/2)·sin φ, the other ends on its face (b/2)/sin φ short along its line; they meet without overlap; default through the larger section', () => {
  for (const deg of [90, 60]) {
    const phi = deg * Math.PI / 180, L = 300, P = [400, 0, 0], F = [400 - L * Math.cos(phi), L * Math.sin(phi), 0];
    // Member 0 along +X to P (through), member 1 from F to P.
    const points = [[0, 0, 0], P, F], segments = [[0, 1], [2, 1]];
    const snap = run([{ id: 'f', kind: 'frame', points, segments, section: SHARP, corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }]);
    const [t, o] = snap.outputs, run0 = 20 * Math.sin(phi), short = 20 / Math.sin(phi);
    near(volume(t), A_SHARP * (400 + run0), 1e-12, `${deg}° through`); near(volume(o), A_SHARP * (L - short), 1e-12, `${deg}° butt`);
    assert.deepEqual([t.member.ends[1].kind, o.member.ends[1].kind], ['through', 'butt']);
    near(t.member.ends[1].extended, run0, 1e-12, `${deg}° run on`); near(o.member.ends[1].angle, 90 - deg, 1e-9, `${deg}° butt angle`);
    const w = welded(snap.outputs);
    assert.equal(w.bodies.length, 1); near(brepMassProperties(w, 1).volume, A_SHARP * (400 + run0 + L - short), 1e-12, `${deg}° welded`);
  }
  // By default the larger section runs through: a 50 × 50 × 4 leg under a 40 × 40 × 3 rail.
  const big = { kind: 'rect-tube', width: 50, height: 50, wall: 4, outerRadius: 0 }, A_BIG = 2500 - 42 * 42;
  const snap = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 700], [600, 0, 700]], segments: [[0, 1], [1, 2]], section: SHARP, overrides: [{ member: 0, section: big }], corners: { default: 'butt' } }]);
  const [leg, rail] = snap.outputs;
  assert.equal(leg.member.ends[1].kind, 'through'); near(volume(leg), A_BIG * (700 + 20), 1e-12, 'the leg covers the rail');
  near(volume(rail), A_SHARP * (600 - 25), 1e-12, 'the rail on the leg\'s face');
});

test('FR3a corners left alone: no corners (FR2 as it was), `none`, and three members at a point (reported square, for FR3b); one corner set apart', () => {
  const box = { points: [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 700], [600, 0, 700], [600, 400, 700], [0, 400, 700]], segments: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]] };
  const lengths = [700, 700, 700, 700, 600, 400, 600, 400];
  // Without corners: every member A·L, ends unreported.
  run([{ id: 'f', kind: 'frame', ...box, section: SHARP }]).outputs.forEach((o, k) => { near(volume(o), A_SHARP * lengths[k], 1e-12, `plain ${k}`); assert.equal(o.member.ends, undefined); });
  // A table frame mitred by default: every top corner has three members (a leg and two rails) — left square, said so.
  const t = run([{ id: 'f', kind: 'frame', ...box, section: SHARP, corners: { default: 'mitre' } }]);
  t.outputs.forEach((o, k) => { near(volume(o), A_SHARP * lengths[k], 1e-12, `table ${k}`); assert.ok(o.member.ends.every(e => e.kind === 'square'), `table ${k}`); });
  // A rectangle: one corner butted (member 1 through), the rest mitred, one left square by `none`.
  const points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0]], segments = [[0, 1], [1, 2], [2, 3], [3, 0]];
  const r = run([{ id: 'f', kind: 'frame', points, segments, section: SHARP, corners: { default: 'mitre', at: [{ point: 1, kind: 'butt', through: 1 }, { point: 3, kind: 'none' }] } }]);
  assert.deepEqual(r.outputs.map(o => o.member.ends.map(e => e.kind)), [['mitre', 'butt'], ['through', 'mitre'], ['mitre', 'square'], ['square', 'mitre']]);
  // Member 0: mitred at 0, butted at 1 (20 short): A(600 − 20); member 1: through at 1 (20 on), mitred at 2: A(400 + 20).
  near(volume(r.outputs[0]), A_SHARP * 580, 1e-12, 'butted'); near(volume(r.outputs[1]), A_SHARP * 420, 1e-12, 'through');
});

test('FR3a refusals by name: CORNER_NOT_A_JOINT, CORNER_ANGLE, MITRE_SECTIONS_DIFFER, BUTT_NOT_ON_A_FACE; bad corner fields', () => {
  const refuse = (frame, re) => assert.throws(() => run([{ id: 'f', kind: 'frame', section: SHARP, ...frame }]), e => e.code !== undefined && re.test(e.message), String(re));
  const L3 = { points: [[0, 0, 0], [300, 0, 0], [300, 300, 0], [300, 0, 300]], segments: [[0, 1], [1, 2], [1, 3]] };
  refuse({ ...L3, corners: { at: [{ point: 1, kind: 'mitre' }] } }, /\[CORNER_NOT_A_JOINT\] point 1: 3 member ends meet there/);
  refuse({ points: [[0, 0, 0], [300, 0, 0], [600, 0, 0]], segments: [[0, 1], [1, 2]], corners: { default: 'mitre' } }, /\[CORNER_ANGLE\] point 1: members 0 and 1 are in line/);
  // A 60 × 30 tube up a leg and along a rail, the rail rolled a quarter turn: its 60 side no longer matches the leg's in
  // the mitre plane, so the cut faces would not meet. (Unrolled, they do: the leg's y is +X, and the box is symmetric.)
  const flat = { kind: 'rect-tube', width: 60, height: 30, wall: 3, outerRadius: 0 }, leg = { points: [[0, 0, 0], [0, 0, 500], [400, 0, 500]], segments: [[0, 1], [1, 2]], section: flat, corners: { default: 'mitre' } };
  assert.equal(run([{ id: 'f', kind: 'frame', ...leg }]).outputs.length, 2);
  refuse({ ...leg, overrides: [{ member: 1, roll: 90 }] }, /\[MITRE_SECTIONS_DIFFER\] point 1: members 0 and 1/);
  // Two sections: refused for a mitre; a butt joins them.
  refuse({ points: [[0, 0, 0], [300, 0, 0], [300, 300, 0]], segments: [[0, 1], [1, 2]], overrides: [{ member: 1, section: ROUND }], corners: { default: 'mitre' } }, /MITRE_SECTIONS_DIFFER/);
  assert.equal(run([{ id: 'f', kind: 'frame', section: SHARP, points: [[0, 0, 0], [300, 0, 0], [300, 300, 0]], segments: [[0, 1], [1, 2]], overrides: [{ member: 1, section: ROUND }], corners: { default: 'butt' } }]).outputs.length, 2);
  // The through member rolled 30°: the other meets it at an edge of its box.
  refuse({ points: [[0, 0, 0], [300, 0, 0], [300, 300, 0]], segments: [[0, 1], [1, 2]], overrides: [{ member: 0, roll: 30 }], corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }, /\[BUTT_NOT_ON_A_FACE\] point 1: member 1 meets member 0/);
  refuse({ points: [[0, 0, 0], [300, 0, 0], [300, 300, 0], [0, 300, 0]], segments: [[0, 1], [1, 2], [2, 3]], corners: { at: [{ point: 1, kind: 'butt', through: 2 }] } }, /through must be member 0 or 1/);
  refuse({ ...L3, corners: { default: 'weld' } }, /corners\.default must be mitre, butt or none/);
  refuse({ ...L3, corners: { at: [{ point: 1, kind: 'mitre', through: 0 }] } }, /through belongs to a butt/);
});
