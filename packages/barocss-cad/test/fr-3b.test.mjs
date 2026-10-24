import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, booleanPolyhedra, booleanAnalytic, brepMassProperties, BrepError, massPropertiesOf, outputOf, checkOutput } from '../dist/index.js';

// FR3b (D126): the planar fallback's typed reason; butts never leave a silent gap (an open side refused); ordered trims at
// joints of three or more; copes and trims to the envelope; T-joints; trims to a plane or a body; crossing members.
// Oracles written here: a prism cut by planes holds A × its centroidal axis between them; S0's quadratures for a member
// reaching into a round-cornered envelope and for a fish-mouth cope; members trimmed apart unite to their sum.
const D = (features) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const run = (features) => evaluateCadPart(D(features));
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)), `${what}: ${got} vs ${want} (${Math.abs(got - want) / Math.max(1, Math.abs(want))})`);
const volume = o => massPropertiesOf(o).volume;
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A_SHARP = 1600 - 34 * 34;
const ROUND = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 }, A_ROUND = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9);
const refuse = (features, re) => assert.throws(() => run(features), e => e.code !== undefined && re.test(e.message), String(re));
function welded(outputs) { let b = outputs[0].brep; for (const o of outputs.slice(1)) b = booleanAnalytic(b, o.brep, 'union'); return b; }
const GL5 = [[-0.906179845938664, 0.2369268850561891], [-0.5384693101056831, 0.4786286704993665], [0, 0.5688888888888889], [0.5384693101056831, 0.4786286704993665], [0.906179845938664, 0.2369268850561891]];
function gauss(f, a, b, n = 400) { let I = 0; const h = (b - a) / n; for (let i = 0; i < n; i++) for (const [x, w] of GL5) I += w * h / 2 * f(a + h * (i + 0.5) + h / 2 * x); return I; }

test('FR3b the planar fallback is typed: the polyhedral Boolean refuses a face coplanar only within binary64 with reason NOT_PLANAR_WITHIN_FLOAT (the dispatch reads the reason, not the words)', () => {
  // Two sharp tubes on oblique lines: planar bodies whose faces' vertices are coplanar to ~1e-15 only.
  const s = run([{ id: 'a', kind: 'frame-member', section: SHARP, start: [0, 0, 0], end: [300, 120, 80] }, { id: 'b', kind: 'frame-member', section: SHARP, start: [150, 60, 40], end: [150, 300, 260] }]);
  const a = outputOf(s, 'a').brep, b = outputOf(s, 'b').brep;
  assert.throws(() => booleanPolyhedra(a, b, 'union'), e => e instanceof BrepError && e.reason === 'NOT_PLANAR_WITHIN_FLOAT');
  // (Through the part, the same pair unites: the dispatch took the reason.)
  const u = outputOf(run([{ id: 'a', kind: 'frame-member', section: SHARP, start: [0, 0, 0], end: [300, 120, 80] }, { id: 'b', kind: 'frame-member', section: SHARP, start: [150, 60, 40], end: [150, 300, 260] }, { id: 'w', kind: 'union', target: 'a', tool: 'b' }]), 'w');
  assert.equal(u.bodyCount, 1); assert.ok(checkOutput(u).valid);
});

test('FR3b a butt never leaves a silent gap: on an angle\'s open side, a round tube or a round-cornered tube it is refused BUTT_ON_OPEN_SIDE (naming the side and the material\'s span); on an angle\'s back it builds', () => {
  const ANG = { kind: 'angle', legX: 60, legY: 60, thickness: 6, rootRadius: 6, toeRadius: 3 };
  // The angle runs along +X (its heel on the line, its legs along +Y and +Z); a tube comes in from +Y or from −Y.
  // (The tube raised 20 in its own y, +Z: its end spans 10 to 30 up the angle's upright leg.)
  const corner = (from, section, through) => [{ id: 'f', kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [400, from, 0]], segments: [[0, 1], [2, 1]], section: through, anchor: 'origin', overrides: [{ member: 1, section, anchor: 'centroid', offset: [0, 20] }], corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }];
  // The angle along +X, up +Z: its section x is +Y, y +Z. From +Y the tube lands on the leg's end (open: material only 0 to 3, below the toe's round).
  refuse(corner(300, { ...SHARP, width: 20, height: 20, wall: 2 }, ANG), /\[BUTT_ON_OPEN_SIDE\] point 1: member 1 meets member 0: its end spans 10 to 30 mm along the through member's section y, but the side \+x of that section has material only at 0 to 3/);
  // From −Y it lands on the angle's back (x 0, material 0 to 60): built, A·300 — the heel's line is on the back itself.
  const ok = run(corner(-300, { ...SHARP, width: 20, height: 20, wall: 2 }, ANG)), A20 = 400 - 16 * 16;
  near(volume(ok.outputs[1]), A20 * 300, 1e-12, 'on the back'); assert.equal(ok.outputs[1].member.ends[1].kind, 'butt');
  // A round-cornered through member: its flat side spans only 28 of the 40 the other member's end covers.
  refuse([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [400, 300, 0]], segments: [[0, 1], [1, 2]], section: ROUND, corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }], /\[BUTT_ON_OPEN_SIDE\] point 1: member 1 meets member 0: its end spans -20 to 20 .* material only at -14 to 14/);
  // A round tube through: no flat side at all.
  refuse([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [400, 300, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'round-tube', diameter: 40, wall: 3 }, corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }], /BUTT_ON_OPEN_SIDE.*material only at none/);
});

test('FR3b to the envelope: a butt on a round-cornered tube trimmed to its envelope reaches into its rounds (S0\'s quadrature, 1.1e-10 there); a fish-mouth cope at a T-joint (the two-cylinder quadrature)', () => {
  // As S0: X along +X (the through member, running on 20), Y along +Y from the corner, trimmed to X's envelope.
  const s = run([{ id: 'f', kind: 'frame', points: [[300, 0, 0], [0, 0, 0], [0, 300, 0]], segments: [[0, 1], [1, 2]], section: ROUND, corners: { at: [{ point: 1, kind: 'butt', through: 0, trim: 'envelope' }] } }]);
  const outer = gauss(t => 2 * (14 + 6 * Math.cos(t)) * (6 - 6 * Math.cos(t)) * 6 * Math.cos(t), 0, Math.PI / 2);
  const bore = gauss(t => { const q = 3 * Math.sin(t); return 2 * (14 + 3 * Math.cos(t)) * (6 - Math.sqrt(36 - q * q)) * 3 * Math.cos(t); }, 0, Math.PI / 2);
  near(volume(s.outputs[1]), A_ROUND * 280 + 2 * (outer - bore), 1e-9, 'into the rounds'); assert.equal(s.outputs[1].member.ends[0].kind, 'cope');
  near(volume(s.outputs[0]), A_ROUND * 320, 1e-8, 'the through member, 20 on');
  const w = welded(s.outputs); assert.equal(w.bodies.length, 1); near(brepMassProperties(w, 1).volume, volume(s.outputs[0]) + volume(s.outputs[1]), 1e-9, 'welded');
  // A T-joint: a Ø25 × 2 tube ends on the middle of a Ø50 × 2 one, coped to its envelope.
  const R = 25, r = 12.5, t = 2, L = 150, small = { kind: 'round-tube', diameter: 25, wall: 2 }, big = { kind: 'round-tube', diameter: 50, wall: 2 };
  const tee = run([{ id: 'f', kind: 'frame', points: [[-100, 0, 0], [100, 0, 0], [0, 0, L], [0, 0, 0]], segments: [[0, 1], [2, 3]], section: big, overrides: [{ member: 1, section: small }], corners: { tee: 'cope' } }]);
  const ov = (rr) => gauss(u => 2 * rr * Math.cos(u) * Math.sqrt(R * R - (rr * Math.sin(u)) ** 2) * rr * Math.cos(u), -Math.PI / 2, Math.PI / 2);
  near(volume(tee.outputs[1]), Math.PI * (r * r - (r - t) ** 2) * L - (ov(r) - ov(r - t)), 1e-9, 'the cope');
  near(volume(tee.outputs[0]), Math.PI * (R * R - (R - t) ** 2) * 200, 1e-9, 'the through tube, untouched');
  assert.deepEqual(tee.outputs[1].member.ends.map(e => [e.end, e.kind]), [['start', 'square'], ['end', 'cope']]);
});

test('FR3b T-joints by default butt on the face: a rail ending on a post\'s middle, A(L − b/2); the post untouched', () => {
  const s = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [0, 0, 400], [500, 0, 400]], segments: [[0, 1], [3, 2]], section: SHARP, corners: { tee: 'butt' } }]);
  near(volume(s.outputs[0]), A_SHARP * 800, 1e-12, 'post'); near(volume(s.outputs[1]), A_SHARP * 480, 1e-12, 'rail');
  assert.equal(s.outputs[1].member.ends[1].kind, 'butt');
  const w = welded(s.outputs); assert.equal(w.bodies.length, 1); near(brepMassProperties(w, 1).volume, A_SHARP * 1280, 1e-12, 'welded');
  // Without `tee` (FR3a's frames) it is left square.
  assert.equal(run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [0, 0, 400], [500, 0, 400]], segments: [[0, 1], [3, 2]], section: SHARP, corners: {} }]).outputs[1].member.ends[1].kind, 'square');
});

test('FR3b ordered trims: three at a corner (X through, Y to X, Z to X and Y); a table of sharp tubes (legs through, rails between) — A·L each by closed form, all welded to one body and their sum', () => {
  const L = 300, b = 40;
  const s = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [L, 0, 0], [0, L, 0], [0, 0, L]], segments: [[1, 0], [2, 0], [3, 0]], section: SHARP, corners: { multi: 'order' } }]);
  const [x, y, z] = s.outputs;
  near(volume(x), A_SHARP * (L + b / 2), 1e-12, 'x through'); near(volume(y), A_SHARP * (L - b / 2), 1e-12, 'y'); near(volume(z), A_SHARP * (L - b / 2), 1e-12, 'z');
  assert.deepEqual([x, y, z].map(o => o.member.ends[1].kind), ['through', 'trim', 'trim']);
  assert.deepEqual(z.member.ends[1].against, [0, 1]); assert.equal(z.member.ends[1].rank, 2);
  const w = welded(s.outputs); assert.equal(w.bodies.length, 1); near(brepMassProperties(w, 1).volume, A_SHARP * (3 * L - b / 2), 1e-12, 'welded');
  // A table 600 × 400 × 700: legs first by index (the same section), each running on 20 over the rails; rails 40 short.
  const points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 700], [600, 0, 700], [600, 400, 700], [0, 400, 700]];
  const segments = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]];
  const t0 = performance.now(), table = run([{ id: 't', kind: 'frame', points, segments, section: SHARP, corners: { multi: 'order' } }]), ms = performance.now() - t0;
  [720, 720, 720, 720, 560, 360, 560, 360].forEach((Lk, k) => near(volume(table.outputs[k]), A_SHARP * Lk, 1e-12, `table member ${k}`));
  const tw = welded(table.outputs); assert.equal(tw.bodies.length, 1); near(brepMassProperties(tw, 1).volume, A_SHARP * (4 * 720 + 2 * 560 + 2 * 360), 1e-12, 'the table welded');
  assert.ok(ms < 10000, `${ms} ms`);
  // An order given: Z through, then Y, then X.
  const o = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [L, 0, 0], [0, L, 0], [0, 0, L]], segments: [[1, 0], [2, 0], [3, 0]], section: SHARP, corners: { at: [{ point: 0, kind: 'order', order: [2, 1, 0] }] } }]);
  near(volume(o.outputs[2]), A_SHARP * (L + b / 2), 1e-12, 'z through'); near(volume(o.outputs[0]), A_SHARP * (L - b / 2), 1e-12, 'x last');
});

test('FR3b ordered trims of round-cornered tubes: each later member is trimmed to the earlier ones as trimmed (their envelopes less those before them), so a sliver at a leg\'s round goes to one rail only — welded, their sum (no overlap; no gap by construction); its time', t => {
  const points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 700], [600, 0, 700], [600, 400, 700], [0, 400, 700]];
  const segments = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]];
  const t0 = performance.now(), s = run([{ id: 't', kind: 'frame', points, segments, section: ROUND, corners: { multi: 'order' } }]), ms = performance.now() - t0;
  t.diagnostic(`a round-cornered table, ordered: ${Math.round(ms)} ms`);
  s.outputs.slice(0, 4).forEach((o, k) => near(volume(o), A_ROUND * 720, 1e-12, `leg ${k}`));
  // Every rail gives up at least the leg's flat face's worth (20 at each end) and reaches no farther than the leg's rounds.
  s.outputs.slice(4).forEach((o, k) => { const L = k % 2 ? 400 : 600; assert.ok(volume(o) > A_ROUND * (L - 40) - 1e-6 && volume(o) < A_ROUND * (L - 40) + 2 * 486.1, `rail ${k}: ${volume(o)}`); });
  const w = welded(s.outputs), sum = s.outputs.reduce((v, o) => v + volume(o), 0);
  assert.equal(w.bodies.length, 1); near(brepMassProperties(w, 1).volume, sum, 1e-9, 'no two members overlap');
});

test('FR3b trims to a plane (an inclined floor) and to a body (a base plate, kept as it is); TRIM_PARALLEL, TRIM_EMPTY, TRIM_MISSES', () => {
  // A leg from z 0 to 500, its start trimmed to the plane z = 0.2x + 10 (through its axis at z 10): A·490.
  const leg = { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 500]], segments: [[0, 1]], section: SHARP };
  const pl = outputOf(run([{ ...leg, trims: [{ member: 0, end: 'start', plane: { origin: [0, 0, 10], normal: [-0.2, 0, 1] } }] }]), 'f');
  near(volume(pl), A_SHARP * 490, 1e-12, 'to the plane'); assert.equal(pl.member.ends[0].kind, 'trim');
  near(pl.member.ends[0].angle, Math.atan(0.2) * 180 / Math.PI, 1e-12, 'its angle');
  // A plane below the leg's start: it is run on down to meet it (A·520).
  near(volume(outputOf(run([{ ...leg, trims: [{ member: 0, end: 'start', plane: { origin: [0, 0, -20], normal: [0, 0, 1] } }] }]), 'f')), A_SHARP * 520, 1e-12, 'run on to the plane');
  // To a body: a plate 200 × 200 from z −30 to 10; the leg starts inside it at z −20 and keeps z 10 to 500. The plate stays an output.
  const plate = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-100, -100], max: [100, 100], plane: { origin: [0, 0, -30], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 40 }];
  const bodySnap = run([...plate, { ...leg, points: [[0, 0, -20], [0, 0, 500]], trims: [{ member: 0, end: 'start', body: 'p' }] }]);
  near(volume(outputOf(bodySnap, 'f')), A_SHARP * 490, 1e-12, 'to the plate'); assert.ok(bodySnap.outputs.some(o => o.id === 'p'));
  refuse([{ ...leg, trims: [{ member: 0, end: 'end', plane: { origin: [50, 0, 0], normal: [1, 0, 0] } }] }], /\[TRIM_PARALLEL\] member 0/);
  refuse([{ ...leg, trims: [{ member: 0, end: 'end', plane: { origin: [0, 0, -5], normal: [0, 0, 1] } }] }], /\[TRIM_EMPTY\] member 0/);
  refuse([...plate, { ...leg, points: [[0, 0, 100], [0, 0, 500]], trims: [{ member: 0, end: 'start', body: 'p' }] }], /\[TRIM_MISSES\] member 0 does not reach the body/);
});

test('FR3b refusals by name: MEMBERS_CLASH (crossing inside both lengths, two through one point), CORNER_NOT_A_JOINT (a setting that does not fit its joint), bad orders and trims', () => {
  const f = (extra) => [{ id: 'f', kind: 'frame', section: SHARP, ...extra }];
  refuse(f({ points: [[0, 0, 0], [400, 0, 0], [200, -200, 0], [200, 200, 0]], segments: [[0, 1], [2, 3]], corners: {} }), /\[MEMBERS_CLASH\] members 0 and 1 cross inside both their lengths/);
  refuse(f({ points: [[0, 0, 0], [400, 0, 0], [200, -200, 0], [200, 200, 0], [200, 0, 0], [200, 0, 300]], segments: [[0, 1], [2, 3], [4, 5]], corners: {} }), /\[MEMBERS_CLASH\] members 0 and 1/);
  refuse(f({ points: [[0, 0, 0], [300, 0, 0], [300, 300, 0]], segments: [[0, 1], [1, 2]], corners: { at: [{ point: 1, kind: 'order' }] } }), /\[CORNER_NOT_A_JOINT\] point 1: two members meet there; an ordered trim joins three or more/);
  refuse(f({ points: [[0, 0, 0], [0, 0, 800], [0, 0, 400], [500, 0, 400]], segments: [[0, 1], [3, 2]], corners: { at: [{ point: 2, kind: 'mitre' }] } }), /\[CORNER_NOT_A_JOINT\] point 2: a T-joint \(member 0 runs through\) takes butt, cope or none, not mitre/);
  refuse(f({ points: [[0, 0, 0], [300, 0, 0], [0, 300, 0], [0, 0, 300]], segments: [[1, 0], [2, 0], [3, 0]], corners: { at: [{ point: 0, kind: 'order', order: [0, 1] }] } }), /order must list members 0, 1, 2, each once/);
  refuse(f({ points: [[0, 0, 0], [300, 0, 0]], segments: [[0, 1]], trims: [{ member: 0, end: 'end', plane: { origin: [200, 0, 0], normal: [1, 0, 0] }, body: 'x' }] }), /takes a plane or a body \(one of them\)/);
  refuse(f({ points: [[0, 0, 0], [300, 0, 0], [300, 300, 0]], segments: [[0, 1], [1, 2]], corners: { default: 'mitre' }, trims: [{ member: 0, end: 'end', plane: { origin: [200, 0, 0], normal: [1, 0, 0] } }] }), /member 0's end is finished by its joint already/);
  refuse(f({ points: [[0, 0, 0], [300, 0, 0]], segments: [[0, 1]], corners: { weld: true } }), /corners has no weld/);
});
