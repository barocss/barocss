import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';

// FR2 (D124): a frame — one member per segment of a skeleton, each its own body. Oracles written here: each member's
// A·L by the textbook area and its segment's length; its centroidal line on its segment's points (anchored at the
// centroid); the section frame orthonormal and square to the line, y along up made square to it; a mirrored angle's
// centroid by its moments; refusals by the skeleton's own geometry. Section sizes are test values.
const D = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const run = (features, parameters) => evaluateCadPart(D(features, parameters));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(...a);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)), `${what}: ${got} vs ${want} (${Math.abs(got - want)})`);
const SP = 1 - Math.PI / 4;
const RHS = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 }, A_RHS = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9);
const SHS = { kind: 'rect-tube', width: 50, height: 50, wall: 4, outerRadius: 0 }, A_SHS = 2500 - 42 * 42;
const ANG = { kind: 'angle', legX: 50, legY: 30, thickness: 5, rootRadius: 6, toeRadius: 3 }, A_ANG = 5 * 75 + SP * (36 - 18);

/** A box skeleton W × D × H: its 8 corners, its 4 legs (0–3), 4 top rails (4–7) and 4 bottom rails (8–11). */
function box(W, Dp, H) {
  const points = [[0, 0, 0], [W, 0, 0], [W, Dp, 0], [0, Dp, 0], [0, 0, H], [W, 0, H], [W, Dp, H], [0, Dp, H]];
  const segments = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4], [0, 1], [1, 2], [2, 3], [3, 0]];
  return { points, segments };
}

test('FR2 a box frame of 12 round-cornered tubes: one body each (f/0 … f/11), A·L by the textbook area, centroidal lines on the skeleton\'s points, frames orthonormal and square to the line; its time', () => {
  const { points, segments } = box(600, 400, 700);
  const t0 = performance.now(), snap = run([{ id: 'f', kind: 'frame', points, segments, section: RHS }]), ms = performance.now() - t0;
  assert.deepEqual(snap.outputs.map(o => o.id), segments.map((_, k) => `f/${k}`));
  let total = 0;
  snap.outputs.forEach((o, k) => {
    const [i, j] = segments[k], L = len(sub(points[j], points[i])), m = o.member, v = o.massProperties(1).volumeMM3;
    near(v, A_RHS * L, 1e-12, `member ${k} volume`); total += v;
    assert.deepEqual(m.frame, { member: k, from: i, to: j }); assert.equal(o.bodyCount, 1); assert.ok(o.validate().valid, `member ${k}`);
    [0, 1, 2].forEach(c => { near(m.centroidLine.start[c], points[i][c], 1e-12, `member ${k} line start`); near(m.centroidLine.end[c], points[j][c], 1e-12, `member ${k} line end`); });
    const u = m.axis, x = m.xAxis, y = m.yAxis;
    for (const [a, b, w] of [[x, x, 1], [y, y, 1], [u, u, 1], [x, y, 0], [x, u, 0], [y, u, 0]]) near(dot(a, b), w, 1e-15, `member ${k} frame`);
    cross(x, y).forEach((c, n) => near(c, u[n], 1e-15, `member ${k} right-handed`));
    // Legs stand along up (+Z): their y takes +X; the rails' y is +Z.
    if (k < 4) assert.deepEqual([m.upFallback, m.yAxis], [[1, 0, 0], [1, 0, 0]], `leg ${k}`); else assert.deepEqual([m.upFallback, m.yAxis], [undefined, [0, 0, 1]], `rail ${k}`);
  });
  near(total, A_RHS * (4 * 700 + 4 * 600 + 4 * 400), 1e-12, 'the frame');
  // Faces by member: each body's own names, f.m<k>.<role>.
  const names = new Set(snap.outputs[5].brep.faces.map(f => f.name.replace(/#\d+$/, '')));
  assert.ok(names.has('f.m5.top') && names.has('f.m5.bore.left') && names.has('f.m5.start') && names.has('f.m5.end'), [...names].join(' '));
  assert.ok(ms < 3000, `${ms} ms`);
});

test('FR2 overrides: the legs a heavier sharp tube rolled 45°, one rail anchored on its top face; the rest the frame\'s own', () => {
  const { points, segments } = box(600, 400, 700);
  const overrides = [0, 1, 2, 3].map(member => ({ member, section: SHS, roll: 45 })).concat([{ member: 4, anchor: 'top' }]);
  const snap = run([{ id: 'f', kind: 'frame', points, segments, section: RHS, overrides }]);
  snap.outputs.forEach((o, k) => {
    const [i, j] = segments[k], L = len(sub(points[j], points[i]));
    near(o.massProperties(1).volumeMM3, (k < 4 ? A_SHS : A_RHS) * L, 1e-12, `member ${k}`);
    if (k < 4) { near(o.member.rollDegrees, 45, 0, `leg ${k} roll`); near(Math.abs(o.member.xAxis[0]), Math.SQRT1_2, 1e-15, `leg ${k} x turned 45°`); }
  });
  // Rail 4 (along +X at z 700) hangs below its line: its top face on it, its centroid 20 below.
  const r = snap.output('f/4').member;
  assert.equal(r.anchor, 'top'); near(r.centroidLine.start[2], 680, 1e-12, 'rail 4 centroid z');
  // Rail 5 keeps the frame's centroid anchor.
  near(snap.output('f/5').member.centroidLine.start[2], 700, 1e-12, 'rail 5');
});

test('FR2 mirror: an angle turned over across its own y axis — the same area, its centroid at −x̄ in its frame; per member by override', () => {
  // A ladder side: two angle stiles along +Y, the second mirrored so their legs face each other.
  const points = [[0, 0, 0], [0, 1000, 0], [400, 0, 0], [400, 1000, 0]], segments = [[0, 1], [2, 3]];
  const snap = run([{ id: 'f', kind: 'frame', points, segments, section: ANG, anchor: 'origin', overrides: [{ member: 1, mirror: true }] }]);
  const [a, b] = snap.outputs, ca = a.member.centroid, cb = b.member.centroid;
  near(a.massProperties(1).volumeMM3, A_ANG * 1000, 1e-12, 'stile'); near(b.massProperties(1).volumeMM3, A_ANG * 1000, 1e-12, 'mirrored stile');
  near(cb[0], -ca[0], 1e-15, 'mirrored centroid x'); near(cb[1], ca[1], 1e-15, 'mirrored centroid y');
  assert.equal(b.member.mirrored, true); assert.match(b.member.section, /, mirrored$/);
  // Along +Y, up +Z: x = −X. The first stile's leg reaches to −X; the mirrored one's to +X.
  const xs = o => o.brep.vertices.map(v => v.point[0]);
  assert.deepEqual([Math.min(...xs(a)), Math.max(...xs(a))], [-50, 0]); assert.deepEqual([Math.min(...xs(b)), Math.max(...xs(b))], [400, 450]);
  // The centre of mass by the moments: the heel on the line, the centroid at (−x̄)(−X) for the mirrored one.
  near(b.massProperties(1).centroidMM[0], 400 + ca[0], 1e-12, 'mirrored centre of mass x');
  // (Mirrored, a wall's faces keep their role names.)
  assert.ok(b.brep.faces.some(f => f.name === 'f.m1.root'));
});

test('FR2 an oblique skeleton (a tetrahedron of round tubes): A·L each, its frame square to each line; points by parameter', () => {
  const tube = { kind: 'round-tube', diameter: 26.9, wall: 2.3 }, A = Math.PI / 4 * (26.9 ** 2 - 22.3 ** 2);
  const points = [[0, 0, 0], [{ parameter: 's' }, 0, 0], [250, 433.0127, 0], [250, 144.3376, 408.2483]], segments = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]];
  const snap = run([{ id: 'f', kind: 'frame', points, segments, section: tube }], { s: 500 });
  const P = points.map(p => p.map(c => typeof c === 'number' ? c : 500));
  snap.outputs.forEach((o, k) => { const [i, j] = segments[k]; near(o.massProperties(1).volumeMM3, A * len(sub(P[j], P[i])), 1e-12, `member ${k}`); near(dot(o.member.yAxis, o.member.axis), 0, 1e-15, `member ${k}`); });
  const again = snap.withParameters({ s: 620 });
  near(again.output('f/0').massProperties(1).volumeMM3, A * 620, 1e-12, 'the parameter moved point 1');
});

test('FR2 refusals by name: SEGMENT_ZERO_LENGTH (one point twice, or two points together), MEMBER_DUPLICATE, SKELETON_OVERLAP; bad indices and overrides', () => {
  const refuse = (points, segments, re, more = {}) => assert.throws(() => run([{ id: 'f', kind: 'frame', points, segments, section: RHS, ...more }]), e => e.code !== undefined && re.test(e.message), String(re));
  const P = [[0, 0, 0], [100, 0, 0], [300, 0, 0], [100, 0, 0], [0, 100, 0]];
  refuse(P, [[0, 0]], /\[SEGMENT_ZERO_LENGTH\] segment 0 runs from point 0 to point 0/);
  refuse(P, [[1, 3]], /\[SEGMENT_ZERO_LENGTH\] segment 0 runs from point 1 to point 3/);
  refuse(P, [[0, 1], [1, 0]], /\[MEMBER_DUPLICATE\] segments 0 and 1/);
  refuse(P, [[0, 1], [3, 0]], /\[MEMBER_DUPLICATE\] segments 0 and 1/);
  refuse(P, [[0, 2], [1, 2]], /\[SKELETON_OVERLAP\] segments 0 and 1 lie on one line and share 200 mm/);
  // (Collinear but only touching end to end: a straight run of two members, allowed.)
  assert.equal(run([{ id: 'f', kind: 'frame', points: P, segments: [[0, 1], [1, 2]], section: RHS }]).outputs.length, 2);
  refuse(P, [[0, 7]], /segments\[0\]\[1\] must be an integer from 0 to 4/);
  refuse(P, [[0, 1], [0, 4]], /member 1 is overridden twice/, { overrides: [{ member: 1, roll: 10 }, { member: 1, roll: 20 }] });
  refuse(P, [[0, 1]], /overrides\[0\]\.member must be an integer from 0 to 0/, { overrides: [{ member: 3 }] });
  refuse(P, [[0, 1]], /\[SECTION_DIMENSIONS\]/, { overrides: [{ member: 0, section: { ...RHS, wall: 30 } }] });
  refuse(P, [[0, 1]], /overrides\[0\]\.mirror must be true or false/, { overrides: [{ member: 0, mirror: 'yes' }] });
});
