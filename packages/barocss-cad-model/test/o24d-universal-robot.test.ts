import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { addMate, type AddMateOptions } from '../src/assembly/edit';
import { tablesFor } from '../src/assembly/faces';
import type { Mate, Vec3 } from '../src/assembly/mates';
import { jointTree, type JointTree, type RobotSettings } from '../src/robot/joints';
import { applyTo, forwardKinematics } from '../src/robot/fk';
import { Robot } from '../src/api/robot';
import { treeOf, viewOf } from '../src/api/robotCore';
import { poseOf as nativePose } from '../src/robot/verbs';
import { robotParts } from '../src/robot/urdf';
import { loopTermsOf } from '../src/robot/loop';
import { isRefusal } from '../src/engine/refusal';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Candidate source only until the coordinator runs this suite. Expected geometry below
// is hand-declared; no production connector, placement or FK function computes it.
const DEG = Math.PI / 180, C = Math.sqrt(3) / 2;
type Matrix = number[];
const close = (a: number, b: number) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= 1e-9, `${a} != ${b}`);
const vector = (a: readonly number[], b: readonly number[]) => { assert.equal(a.length, b.length); a.forEach((v, k) => close(v, b[k])); };
const mv = (a: Matrix, p: readonly number[]): Vec3 => [0, 1, 2].map(i => a[i * 3] * p[0] + a[i * 3 + 1] * p[1] + a[i * 3 + 2] * p[2]) as Vec3;
const mm = (a: Matrix, b: Matrix): Matrix => Array.from({ length: 9 }, (_, k) => {
  const i = Math.floor(k / 3), j = k % 3; return a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
});
const minus = (a: readonly number[], b: readonly number[]): Vec3 => a.map((v, k) => v - b[k]) as Vec3;
const plus = (a: readonly number[], b: readonly number[]): Vec3 => a.map((v, k) => v + b[k]) as Vec3;
function turn([x, y, z]: Vec3, q: number): Matrix {
  const c = Math.cos(q), s = Math.sin(q), v = 1 - c;
  return [c + v * x * x, v * x * y - s * z, v * x * z + s * y,
    v * y * x + s * z, c + v * y * y, v * y * z - s * x,
    v * z * x - s * y, v * z * y + s * x, c + v * z * z];
}
const X: Vec3 = [1, 0, 0], Z: Vec3 = [0, 0, 1], ANCHOR: Vec3 = [10, 20, 30];
const RX30 = [1, 0, 0, 0, C, -0.5, 0, 0.5, C];
const source = (rotation: Vec3 = [30, 0, 0]): StudioDoc => ({ ...rectanglePart(20, 20, 5),
  instances: [{ id: 'p', name: 'Moving', doc: rectanglePart(10, 10, 3), position: [9, 8, 7], rotation }] });
const options = (): AddMateOptions => ({ kind: 'universal',
  a: { part: 'base', face: 'origin:xy', at: { offset: [...ANCHOR] } },
  b: { part: 'p', face: 'origin:xy', at: { offset: [2, 0, 0] } } });
function solved(rotation?: Vec3) {
  const result = addMate(source(rotation), options());
  assert.deepEqual(result.problems, []); assert.deepEqual(result.freedom, { turns: 2, slides: 0 });
  return result.doc;
}
const tree = (doc: StudioDoc, settings: RobotSettings = doc.robot ?? { version: 1 }) => jointTree({
  instances: doc.instances!, mates: doc.mates!, tables: tablesFor(doc), settings,
});
function chain(t: JointTree, anchor = ANCHOR, axes: Vec3[] = [Z, X], reversed = false) {
  assert.deepEqual(t.problems, []); assert.deepEqual(t.loops, []);
  assert.equal(t.links.filter(l => l.part === null).length, 1);
  assert.deepEqual(t.links.filter(l => l.part !== null).map(l => l.part).sort(), ['base', 'p']);
  assert.equal(t.joints.length, 2);
  assert.deepEqual(t.joints.map(j => j.key), reversed ? ['base~p#1', 'base~p#0'] : ['base~p#0', 'base~p#1']);
  assert.ok(t.joints.every(j => j.type === 'continuous' || j.type === 'revolute'));
  assert.ok(t.joints.every(j => j.type !== 'fixed' && j.type !== 'prismatic' && !j.mimic));
  assert.equal(t.joints[0].parent, reversed ? 'p' : 'base');
  assert.equal(t.joints[1].child, reversed ? 'base' : 'p');
  assert.equal(t.joints[0].child, t.joints[1].parent);
  assert.equal(t.links.find(l => l.id === t.joints[0].child)!.part, null);
  t.joints.forEach((j, k) => { vector(j.origin, anchor); vector(j.axis, axes[k]); assert.equal(j.mates.length, 1); });
}
const unsupported = (t: JointTree, mate: string) => {
  assert.ok(t.problems.some(p => p.code === 'MOTION_UNSUPPORTED' && p.mates?.includes(mate)), JSON.stringify(t.problems));
  assert.ok(!t.joints.some(j => j.mates.includes(mate)), 'unsupported mate must create no fixed or moving substitute');
};

test('Universal robot: an actual connector pair yields exactly two turns and one bodyless logical intermediate', () => {
  const doc = solved(), before = structuredClone(doc), t = tree(doc);
  vector(doc.instances![0].position, [8, 20, 30]); chain(t);
  assert.deepEqual(t.joints.map(j => j.mates), [[doc.mates![0].id], [doc.mates![0].id]]);
  assert.deepEqual(doc, before);
});

test('Universal robot: finite FK equals independent R(a.Z) R(b.X), with a common anchor and no slide', () => {
  const t = tree(solved()); chain(t);
  for (const [a, b] of [[0, 0], [0.7, 0], [0, -0.8], [0.7, -0.8], [-1.2, 1.4], [Math.PI, -Math.PI / 2]]) {
    const expected = mm(turn(Z, a), turn(X, b)), fk = forwardKinematics(t, { 'base~p#0': a, 'base~p#1': b });
    assert.deepEqual(fk.unknown, []); assert.deepEqual(fk.outOfLimits, []);
    const motion = fk.motions.get('p')!; assert.ok(motion);
    vector(Array.from(motion.R), expected);
    vector(applyTo(motion, ANCHOR), ANCHOR);
    for (const local of [[0, 0, 0], [2, 0, 0], [3, -4, 7]]) {
      const home = plus([8, 20, 30], mv(RX30, local));
      vector(applyTo(motion, home), plus(ANCHOR, mv(expected, minus(home, ANCHOR))));
    }
    // Home b.X is world X. Its moved direction remains perpendicular to a.Z.
    close(mv(expected, X)[2], 0);
    vector(mv(expected, X), mv(turn(Z, a), X));
    vector(Array.from(fk.motions.get(t.joints[0].child)!.R), turn(Z, a));
  }
});

test('Universal robot: local connector turn and offset use the selected tilted axes, not world-axis substitutes', () => {
  // origin:yz has local X=world Y, local Y=world Z, local Z=world X.
  // b's local turn90 makes its X=local Y; Rx30 carries it to (0,cos30,sin30).
  const o: AddMateOptions = { kind: 'universal',
    a: { part: 'base', face: 'origin:yz', at: { offset: [2, 3, 4] } },
    b: { part: 'p', face: 'origin:xy', at: { turn: 90, offset: [2, 0, 0] } } };
  const r = addMate(source(), o), anchor: Vec3 = [4, 2, 3], axis: Vec3 = [0, C, 0.5], t = tree(r.doc);
  assert.deepEqual(r.problems, []); vector(r.doc.instances![0].position, [4, 2 - 2 * C, 2]);
  chain(t, anchor, [X, axis]);
  for (const [a, b] of [[0.3, -0.6], [-1.1, 0.9]]) {
    const expected = mm(turn(X, a), turn(axis, b)), motion = forwardKinematics(t, { 'base~p#0': a, 'base~p#1': b }).motions.get('p')!;
    vector(Array.from(motion.R), expected); vector(applyTo(motion, anchor), anchor);
    vector(applyTo(motion, [7, 11, -2]), plus(anchor, mv(expected, minus([7, 11, -2], anchor))));
  }
});

test('Universal robot: reversing the base keeps semantic keys and gives the exact inverse finite transform', () => {
  const doc = solved(), forward = tree(doc), reverse = tree(doc, { version: 1, base: 'p' });
  chain(reverse, ANCHOR, [[-1, 0, 0], [0, 0, -1]], true);
  for (const [a, b] of [[0.6, -0.8], [-1.2, 1.4]]) {
    const q = { 'base~p#0': a, 'base~p#1': b }, f = forwardKinematics(forward, q).motions.get('p')!, r = forwardKinematics(reverse, q).motions.get('base')!;
    vector(Array.from(r.R), mm(turn(X, -b), turn(Z, -a)));
    for (const point of [ANCHOR, [0, 0, 0], [7, -11, 19]]) vector(applyTo(r, applyTo(f, point)), point);
  }
});

test('Universal robot: an opposite initial branch keeps b.X sign and finite motion', () => {
  const doc = solved([0, 0, 180]), t = tree(doc); chain(t, ANCHOR, [Z, [-1, 0, 0]]);
  vector(doc.instances![0].position, [12, 20, 30]);
  const motion = forwardKinematics(t, { 'base~p#0': 0.4, 'base~p#1': -0.7 }).motions.get('p')!;
  vector(Array.from(motion.R), mm(turn(Z, 0.4), turn([-1, 0, 0], -0.7)));
  vector(applyTo(motion, ANCHOR), ANCHOR);
});

test('Universal robot: the public degree/mm contract and native radians stay separate for both keys', () => {
  const doc = solved(); doc.robot = { version: 1, joints: {
    'base~p#0': { lower: -90, upper: 90, effort: 2000, velocity: 180 },
    'base~p#1': { lower: -60, upper: 60, effort: 3000, velocity: 90 },
  } };
  const before = structuredClone(doc), r = new Robot(doc), native = treeOf(doc), publicTree = r.joints();
  for (const [key, lower, upper, effort, velocity] of [['base~p#0', -90, 90, 2, Math.PI], ['base~p#1', -60, 60, 3, Math.PI / 2]] as const) {
    const j = native.joints.find(j => j.key === key)!; close(j.limit!.lower!, lower * DEG); close(j.limit!.upper!, upper * DEG);
    close(j.limit!.effort!, effort); close(j.limit!.velocity!, velocity);
    const p = publicTree.joints.find(j => j.key === key)!; close(p.limit!.lower!, lower); close(p.limit!.upper!, upper); close(p.limit!.effort!, effort * 1000);
  }
  const publicPose = r.pose({ 'base~p#0': 30, 'base~p#1': -45 }), internal = nativePose(viewOf(doc), { 'base~p#0': Math.PI / 6, 'base~p#1': -Math.PI / 4 }).reply;
  close(publicPose.values['base~p#0'], 30); close(publicPose.values['base~p#1'], -45);
  close(internal.values['base~p#0'], Math.PI / 6); close(internal.values['base~p#1'], -Math.PI / 4);
  assert.deepEqual(publicPose.links, internal.links);
  assert.equal(publicPose.links.length, 2, 'logical intermediate is not a physical part pose');
  const moved = publicPose.links.find(l => l.link === 'p')!;
  vector(moved.position, [10 - Math.sqrt(3), 19, 30].map(v => Math.round(v * 1e6) / 1e6));
  vector(moved.rotation, [-15, 0, 30]);
  assert.deepEqual(r.pose({ 'base~p#1': 80 }).out_of_limits, ['base~p#1']);
  assert.deepEqual(doc, before);
});

test('Universal robot: Save/Open round trip preserves the connector contract, semantic keys and both finite poses', async () => {
  const doc = solved(), read = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in read);
  assert.equal(read.doc.units, 'mm'); assert.deepEqual(read.doc.mates, doc.mates);
  const restored = tree(read.doc); chain(restored);
  const q = { 'base~p#0': 0.3, 'base~p#1': -0.2 };
  vector(Array.from(forwardKinematics(restored, q).motions.get('p')!.R), mm(turn(Z, 0.3), turn(X, -0.2)));
});

test('Universal robot: extra coupled mates and grounded motion refuse without a fake fixed chain', () => {
  const doc = solved(), m = doc.mates![0];
  for (const extra of [
    { ...m, id: 'second-universal' },
    { id: 'held', kind: 'lock', a: { part: 'base', face: '' }, b: { part: 'p', face: '' }, rel: { position: [8, 20, 30], rotation: [30, 0, 0] } },
  ] as Mate[]) unsupported(tree({ ...doc, mates: [m, extra] }), m.id);
  unsupported(tree({ ...doc, instances: doc.instances!.map(i => ({ ...i, grounded: true })) }), m.id);
});

test('Universal robot: stale solved anchors, impossible and singular axes, and missing geometry never create a chain', () => {
  const doc = solved(), m = doc.mates![0];
  for (const patch of [
    { position: [8, 20, 31] as Vec3 },
    { position: [Number.NaN, 20, 30] as Vec3 },
    // Positions keep the connector origins coincident, isolating the axis refusal.
    { rotation: [0, 30, 0] as Vec3, position: [10 - 2 * C, 20, 31] as Vec3 },
    { rotation: [0, 90, 0] as Vec3, position: [10, 20, 32] as Vec3 },
    { rotation: [0, -90, 0] as Vec3, position: [10, 20, 28] as Vec3 },
  ]) unsupported(tree({ ...doc, instances: doc.instances!.map(i => ({ ...i, ...patch })) }), m.id);
  const missing = tree({ ...doc, mates: [{ ...m, a: { part: 'base', face: 'missing' } }] });
  assert.ok(missing.problems.some(p => p.code === 'MATE_PROBLEM')); assert.equal(missing.joints.length, 0);
});

test('Universal robot: cyclic mates retain a typed unsupported boundary and the loop solver stays unsupported', () => {
  const doc = solved(), m = doc.mates![0];
  // The closure's two stored locks agree with the actual home placements.
  const pq: Mate = { id: 'pq', kind: 'lock', a: { part: 'p', face: '' }, b: { part: 'q', face: '' },
    rel: { position: [-8, -20 * C - 15, 10 - 30 * C], rotation: [-30, 0, 0] } };
  const qb: Mate = { id: 'qb', kind: 'lock', a: { part: 'q', face: '' }, b: { part: 'base', face: '' }, rel: { position: [0, 0, 0], rotation: [0, 0, 0] } };
  const cyclic: StudioDoc = { ...doc, instances: [...doc.instances!, { id: 'q', name: 'Return', doc: rectanglePart(5, 5, 2), position: [0, 0, 0], rotation: [0, 0, 0] }], mates: [m, pq, qb] };
  const t = tree(cyclic); unsupported(t, m.id);
  assert.ok(t.loops.some(l => l.mates.includes(m.id)), 'the cycle closure must remain recorded');
  assert.throws(() => loopTermsOf(cyclic, t), e => isRefusal(e, 'LOOP_MATE_UNSUPPORTED'));
});

test('Universal robot: bad per-axis limits remain typed, missing export ratings are not an export PASS', () => {
  const doc = solved(), bad = tree(doc, { version: 1, joints: { 'base~p#0': { lower: 30, upper: -30 } } });
  assert.ok(bad.problems.some(p => p.code === 'LIMITS_BAD' && p.joint === 'base~p#0'));
  const missing = tree(doc, { version: 1, joints: { 'base~p#0': { lower: -45, upper: 45 } } });
  assert.ok(missing.notes.some(p => p.code === 'LIMITS_MISSING' && p.joint === 'base~p#0'));
  const result = robotParts(missing, () => null);
  assert.ok('refusals' in result && result.refusals.some(r => r.code === 'LIMITS_MISSING'));
});
