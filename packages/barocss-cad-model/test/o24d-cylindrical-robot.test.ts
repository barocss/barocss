import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { addMate, editMate, type AddMateOptions, type EditMateOptions } from '../src/assembly/edit';
import { tablesFor } from '../src/assembly/faces';
import type { Mate, Vec3 } from '../src/assembly/mates';
import { jointTree, readRobot, type JointTree, type RobotSettings } from '../src/robot/joints';
import { applyTo, forwardKinematics } from '../src/robot/fk';
import { Robot } from '../src/api/robot';
import { treeOf, viewOf } from '../src/api/robotCore';
import { poseOf as nativePose } from '../src/robot/verbs';
import { robotParts } from '../src/robot/urdf';
import { loopTermsOf } from '../src/robot/loop';
import { camFacesOf } from '../src/robot/cam';
import { isRefusal } from '../src/engine/refusal';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Independent geometry oracle: hand-declared axes, home poses, Rodrigues rotation
// and axial translation. Production placement/connector/FK helpers are not oracles.
const Z: Vec3 = [0, 0, 1], X: Vec3 = [1, 0, 0], ANCHOR: Vec3 = [10, 20, 30];
const close = (a: number, b: number) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= 1e-9, `${a} != ${b}`);
const vector = (a: readonly number[], b: readonly number[]) => { assert.equal(a.length, b.length); a.forEach((v, k) => close(v, b[k])); };
const mv = (r: number[], p: readonly number[]): Vec3 => [0, 1, 2].map(i => r[i * 3] * p[0] + r[i * 3 + 1] * p[1] + r[i * 3 + 2] * p[2]) as Vec3;
const minus = (a: readonly number[], b: readonly number[]): Vec3 => a.map((v, k) => v - b[k]) as Vec3;
const plus = (a: readonly number[], b: readonly number[]): Vec3 => a.map((v, k) => v + b[k]) as Vec3;
function turn([x, y, z]: Vec3, q: number): number[] {
  const c = Math.cos(q), s = Math.sin(q), v = 1 - c;
  return [c + v * x * x, v * x * y - s * z, v * x * z + s * y,
    v * y * x + s * z, c + v * y * y, v * y * z - s * x,
    v * z * x - s * y, v * z * y + s * x, c + v * z * z];
}
const expectedPoint = (p: readonly number[], axis: Vec3, anchor: Vec3, slide: number, q: number) =>
  plus(plus(anchor, mv(turn(axis, q), minus(p, anchor))), axis.map(v => v * slide));
const source = (): StudioDoc => ({ ...rectanglePart(20, 20, 5), instances: [
  { id: 'p', name: 'Moving', doc: rectanglePart(10, 10, 3), position: [9, 8, 7], rotation: [0, 0, 90] },
] });
const options = (): AddMateOptions => ({ kind: 'cylindrical',
  a: { part: 'base', face: 'origin:xy', at: { offset: [...ANCHOR] } },
  b: { part: 'p', face: 'origin:xy', at: { offset: [2, 0, 4] } } });
function solved() {
  const r = addMate(source(), options());
  assert.deepEqual(r.problems, []); assert.deepEqual(r.freedom, { turns: 1, slides: 1 }); return r.doc;
}
const tree = (doc: StudioDoc, settings: RobotSettings = doc.robot ?? { version: 1 }) => jointTree({
  instances: doc.instances!, mates: doc.mates!, tables: tablesFor(doc), settings,
});
function chain(t: JointTree, anchor = ANCHOR, axis = Z, reverse = false) {
  assert.deepEqual(t.problems, []); assert.deepEqual(t.loops, []); assert.equal(t.joints.length, 2);
  assert.deepEqual(t.joints.map(j => j.key), reverse ? ['base~p#1', 'base~p#0'] : ['base~p#0', 'base~p#1']);
  assert.equal(t.joints.find(j => j.key === 'base~p#0')!.type, 'prismatic');
  assert.ok(['continuous', 'revolute'].includes(t.joints.find(j => j.key === 'base~p#1')!.type));
  assert.ok(t.joints.every(j => j.type !== 'fixed' && !j.mimic));
  assert.equal(t.joints[0].parent, reverse ? 'p' : 'base'); assert.equal(t.joints[1].child, reverse ? 'base' : 'p');
  assert.equal(t.joints[0].child, t.joints[1].parent);
  assert.equal(t.links.filter(l => l.part === null).length, 1);
  assert.equal(t.links.find(l => l.id === t.joints[0].child)!.part, null);
  assert.deepEqual(t.links.filter(l => l.part !== null).map(l => l.part).sort(), ['base', 'p']);
  for (const j of t.joints) { vector(j.origin, anchor); vector(j.axis, axis); assert.equal(j.mates.length, 1); }
}
const unsupported = (t: JointTree, id: string) => {
  assert.ok(t.problems.some(p => p.code === 'MOTION_UNSUPPORTED' && p.mates?.includes(id)), JSON.stringify(t.problems));
  assert.ok(!t.joints.some(j => j.mates.includes(id)), 'unsupported mate must not produce a substitute chain');
};

test('Cylindrical robot: real connectors yield one slide and one turn with a bodyless intermediate', () => {
  const doc = solved(), before = structuredClone(doc), t = tree(doc); chain(t);
  vector(doc.instances![0].position, [10, 18, 7]); vector(doc.instances![0].rotation, [0, 0, 90]);
  assert.deepEqual(t.joints.map(j => j.mates), [[doc.mates![0].id], [doc.mates![0].id]]);
  assert.deepEqual(doc, before);
});

test('Cylindrical robot: independent finite rotation and translation retain the initial axial gap and twist', () => {
  const t = tree(solved()); chain(t);
  for (const [slide, angle] of [[0, 0], [12, 0], [0, 0.7], [-19, -0.8], [55, 1.4], [-7, Math.PI]]) {
    const fk = forwardKinematics(t, { 'base~p#0': slide, 'base~p#1': angle }), m = fk.motions.get('p')!;
    assert.deepEqual(fk.unknown, []); vector(Array.from(m.R), turn(Z, angle));
    for (const local of [[0, 0, 0], [2, 0, 4], [3, -4, 7]]) {
      // Home Rz90: local (x,y,z) -> (-y,x,z), translated by (10,18,7).
      const home: Vec3 = [10 - local[1], 18 + local[0], 7 + local[2]];
      vector(applyTo(m, home), expectedPoint(home, Z, ANCHOR, slide, angle));
    }
    vector(applyTo(m, [10, 20, 11]), [10, 20, 11 + slide]);
    vector(applyTo(m, ANCHOR), [10, 20, 30 + slide]);
    close(applyTo(m, [10, 20, 11])[2] - applyTo(m, ANCHOR)[2], -19);
    vector(Array.from(fk.motions.get(t.joints[0].child)!.R), turn(Z, 0));
    vector(Array.from(fk.motions.get(t.joints[0].child)!.t), [0, 0, slide]);
  }
  const home = forwardKinematics(t, {}).motions.get('p')!;
  vector(Array.from(home.R), turn(Z, 0)); vector(Array.from(home.t), [0, 0, 0]);
});

test('Cylindrical robot: selected X-axis connectors preserve offset geometry and an initial 45 degree twist', () => {
  const doc = source(); doc.instances![0].rotation = [45, 0, 0];
  const o: AddMateOptions = { kind: 'cylindrical',
    a: { part: 'base', face: 'origin:yz', at: { offset: [2, 3, 4] } },
    b: { part: 'p', face: 'origin:yz', at: { offset: [2, 0, 4] } } };
  const r = addMate(doc, o), anchor: Vec3 = [4, 2, 3], t = tree(r.doc); chain(t, anchor, X);
  assert.deepEqual(r.problems, []); vector(r.doc.instances![0].position, [9, 2 - Math.SQRT2, 3 - Math.SQRT2]);
  for (const [slide, angle] of [[-12, 0.6], [17, -1.2]]) {
    const motion = forwardKinematics(t, { 'base~p#0': slide, 'base~p#1': angle }).motions.get('p')!;
    vector(Array.from(motion.R), turn(X, angle));
    for (const point of [[9, 2 - Math.SQRT2, 3 - Math.SQRT2], [13, 2, 3], [1, 7, -2]])
      vector(applyTo(motion, point), expectedPoint(point, X, anchor, slide, angle));
    vector(applyTo(motion, [13, 2, 3]), [13 + slide, 2, 3]);
  }
});

test('Cylindrical robot: reverse parent preserves semantic keys and exactly inverts both finite coordinates', () => {
  const doc = solved(), normal = tree(doc), reverse = tree(doc, { version: 1, base: 'p' });
  chain(reverse, ANCHOR, [0, 0, -1], true);
  for (const [slide, angle] of [[12, 0.6], [-21, -1.4]]) {
    const q = { 'base~p#0': slide, 'base~p#1': angle }, f = forwardKinematics(normal, q).motions.get('p')!, r = forwardKinematics(reverse, q).motions.get('base')!;
    vector(Array.from(r.R), turn(Z, -angle));
    for (const p of [ANCHOR, [0, 0, 0], [3, -4, 7]]) {
      vector(applyTo(r, p), expectedPoint(p, Z, ANCHOR, -slide, -angle));
      vector(applyTo(r, applyTo(f, p)), p);
    }
  }
});

test('Cylindrical robot: connector flips retain the actual signed common axis', () => {
  const o: AddMateOptions = { kind: 'cylindrical', a: { part: 'base', face: 'origin:xy', at: { flip: true } }, b: { part: 'p', face: 'origin:xy', at: { flip: true } } };
  const r = addMate(source(), o), t = tree(r.doc); chain(t, [0, 0, 0], [0, 0, -1]);
  vector(r.doc.instances![0].position, [0, 0, 7]);
  const motion = forwardKinematics(t, { 'base~p#0': 12, 'base~p#1': 0.7 }).motions.get('p')!;
  vector(Array.from(motion.R), turn(Z, -0.7)); vector(applyTo(motion, [0, 0, 7]), [0, 0, -5]);
});

const settings = (): RobotSettings => ({ version: 1, joints: {
  'base~p#0': { lower: -20, upper: 50, effort: 40, velocity: 12 },
  'base~p#1': { lower: -90, upper: 90, effort: 2000, velocity: 180 },
} });
test('Cylindrical robot: public degrees/mm and per-axis units become native radians/mm exactly once', () => {
  const doc = solved(); doc.robot = settings();
  const before = structuredClone(doc), robot = new Robot(doc), native = treeOf(doc), pub = robot.joints();
  const slide = native.joints.find(j => j.key === 'base~p#0')!, rotation = native.joints.find(j => j.key === 'base~p#1')!;
  assert.deepEqual(slide.limit, { lower: -20, upper: 50, effort: 40, velocity: 12 });
  close(rotation.limit!.lower!, -Math.PI / 2); close(rotation.limit!.upper!, Math.PI / 2);
  close(rotation.limit!.effort!, 2); close(rotation.limit!.velocity!, Math.PI);
  assert.deepEqual(pub.joints.find(j => j.key === 'base~p#0')!.limit, settings().joints!['base~p#0']);
  const rotational = pub.joints.find(j => j.key === 'base~p#1')!.limit!;
  close(rotational.lower!, -90); close(rotational.upper!, 90); close(rotational.effort!, 2000); close(rotational.velocity!, 180);
  const p = robot.pose({ 'base~p#0': 12, 'base~p#1': 30 }), n = nativePose(viewOf(doc), { 'base~p#0': 12, 'base~p#1': Math.PI / 6 }).reply;
  close(p.values['base~p#0'], 12); close(p.values['base~p#1'], 30);
  close(n.values['base~p#0'], 12); close(n.values['base~p#1'], Math.PI / 6);
  assert.deepEqual(p.links, n.links); assert.equal(p.links.length, 2);
  vector(p.links.find(l => l.link === 'p')!.position, [11, 20 - Math.sqrt(3), 19].map(v => Math.round(v * 1e6) / 1e6));
  vector(p.links.find(l => l.link === 'p')!.rotation, [0, 0, 120]);
  assert.deepEqual(robot.pose({ 'base~p#0': 51, 'base~p#1': 100 }).out_of_limits.sort(), ['base~p#0', 'base~p#1']);
  assert.deepEqual(doc, before);
});

test('Cylindrical robot: Save/Open retains both per-axis settings, reversed base, home gap and finite poses', async () => {
  const doc = solved(); doc.robot = { ...settings(), base: 'p' };
  const read = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in read);
  assert.equal(read.doc.units, 'mm'); assert.deepEqual(read.doc.mates, doc.mates); assert.deepEqual(read.doc.robot, doc.robot);
  assert.deepEqual(readRobot(read.doc.robot), doc.robot);
  const t = tree(read.doc, readRobot(read.doc.robot)); chain(t, ANCHOR, [0, 0, -1], true);
  assert.deepEqual(t.joints.find(j => j.key === 'base~p#0')!.limit, { lower: -20, upper: 50, effort: 40, velocity: 12 });
  const m = forwardKinematics(t, { 'base~p#0': -3, 'base~p#1': 0.3 }).motions.get('base')!;
  vector(Array.from(m.R), turn(Z, -0.3)); vector(applyTo(m, [4, 8, 12]), expectedPoint([4, 8, 12], Z, ANCHOR, 3, -0.3));
});

test('Cylindrical robot: raw mate scalars, flip and mate limits still refuse before mutation', () => {
  const doc = source(), before = structuredClone(doc), ready = solved(), saved = structuredClone(ready);
  for (const [key, value] of [['distance', 0], ['angle', 0], ['pitch', 0], ['ratio', 0], ['rel', {}], ['limits', {}], ['flip', false], ['flip', true], ['distance', undefined]] as const) {
    assert.throws(() => addMate(doc, { ...options(), [key]: value } as AddMateOptions), e => isRefusal(e, 'VALUE'));
    assert.throws(() => editMate(ready, { id: ready.mates![0].id, [key]: value } as EditMateOptions), e => isRefusal(e, 'VALUE'));
  }
  assert.deepEqual(doc, before); assert.deepEqual(ready, saved);
});

test('Cylindrical robot: coupled mates, grounded motion and ambiguous pair-key settings refuse explicitly', () => {
  const doc = solved(), m = doc.mates![0];
  for (const kind of ['cylindrical', 'universal', 'ball', 'fastened', 'coincident'] as const)
    unsupported(tree({ ...doc, mates: [m, { ...m, id: 'extra', kind }] }), m.id);
  const lock: Mate = { id: 'held', kind: 'lock', a: { part: 'base', face: '' }, b: { part: 'p', face: '' }, rel: { position: [10, 18, 7], rotation: [0, 0, 90] } };
  unsupported(tree({ ...doc, mates: [m, lock] }), m.id);
  unsupported(tree({ ...doc, instances: doc.instances!.map(i => ({ ...i, grounded: true })) }), m.id);
  unsupported(tree(doc, { version: 1, joints: { 'base~p': { lower: -10, upper: 10 } } }), m.id);
  chain(tree(doc, settings()));
});

test('Cylindrical robot: a stored same-pair cam refuses the chain with or without cam faces', () => {
  const doc = solved(), original = structuredClone(doc), cylindrical = doc.mates![0];
  const accepted = addMate(doc, { kind: 'cam', a: { part: 'base', face: 'origin:xy' }, b: { part: 'p', face: 'origin:xy' } });
  assert.deepEqual(accepted.problems, []);
  assert.equal(accepted.mate.a.at, undefined); assert.equal(accepted.mate.b.at, undefined);
  assert.deepEqual(doc, original);
  const readTree = (d: StudioDoc, includeFaces: boolean, mateProblems: { mate: string; reason: string }[] = []) => jointTree({
    instances: d.instances!, mates: d.mates!, tables: tablesFor(d), mateProblems,
    ...(includeFaces ? { camFaces: (part: string) => {
      const own = part === 'base' ? d : d.instances!.find(i => i.id === part)?.doc;
      assert.ok(own, `real part geometry required for ${part}`); return camFacesOf(own);
    } } : {}),
  });
  const unrelatedDoc: StudioDoc = { ...doc, instances: [...doc.instances!, {
    id: 'q', name: 'Other follower', doc: rectanglePart(5, 5, 2), position: [40, 0, 0], rotation: [0, 0, 0],
  }] };
  const unrelated = addMate(unrelatedDoc, { kind: 'cam', a: { part: 'base', face: 'origin:xy' }, b: { part: 'q', face: 'origin:xy' } });
  for (const includeFaces of [false, true]) {
    const refused = readTree(accepted.doc, includeFaces);
    unsupported(refused, cylindrical.id);
    assert.ok(refused.problems.some(p => p.code === 'MOTION_UNSUPPORTED' && p.mates?.includes(cylindrical.id) && p.mates.includes(accepted.mate.id)));
    assert.equal(refused.joints.length, 0, 'same-pair cam must leave no fixed or moving substitute');
    assert.equal(refused.links.filter(l => l.part === null).length, 0);
    // Other cam diagnostics may remain; only this explicit pair's guard is checked.
    for (const unaffected of [
      readTree(unrelated.doc, includeFaces),
      readTree(accepted.doc, includeFaces, [{ mate: accepted.mate.id, reason: 'Upstream cam validation refused this mate' }]),
    ]) {
      assert.equal(unaffected.joints.filter(j => j.mates.includes(cylindrical.id)).length, 2);
      assert.ok(!unaffected.problems.some(p => p.code === 'MOTION_UNSUPPORTED' && p.mates?.includes(cylindrical.id)));
    }
  }
});

test('Cylindrical robot: noncoaxial, opposite, tilted and nonfinite solved axes cannot create a chain', () => {
  const doc = solved(), m = doc.mates![0];
  for (const patch of [
    { position: [11, 18, 7] as Vec3 },
    // Keep b's connector point on the line, isolating invalid axis direction.
    { rotation: [180, 0, 0] as Vec3, position: [8, 20, 7] as Vec3 },
    { rotation: [0, 30, 0] as Vec3, position: [10 - Math.sqrt(3) - 2, 20, 7] as Vec3 },
    { position: [Number.NaN, 18, 7] as Vec3 },
  ]) unsupported(tree({ ...doc, instances: doc.instances!.map(i => ({ ...i, ...patch })) }), m.id);
  const missing = tree({ ...doc, mates: [{ ...m, a: { part: 'base', face: 'missing' } }] });
  assert.ok(missing.problems.some(p => p.code === 'MATE_PROBLEM')); assert.equal(missing.joints.length, 0);
});

test('Cylindrical robot: an actual cyclic graph remains unsupported and keeps its closure record', () => {
  const doc = solved(), m = doc.mates![0];
  const pq: Mate = { id: 'pq', kind: 'lock', a: { part: 'p', face: '' }, b: { part: 'q', face: '' }, rel: { position: [-18, 10, -7], rotation: [0, 0, -90] } };
  const qb: Mate = { id: 'qb', kind: 'lock', a: { part: 'q', face: '' }, b: { part: 'base', face: '' }, rel: { position: [0, 0, 0], rotation: [0, 0, 0] } };
  const cyclic: StudioDoc = { ...doc, instances: [...doc.instances!, { id: 'q', name: 'Return', doc: rectanglePart(5, 5, 2), position: [0, 0, 0], rotation: [0, 0, 0] }], mates: [m, pq, qb] };
  const t = tree(cyclic); unsupported(t, m.id); assert.ok(t.loops.some(l => l.mates.includes(m.id)));
  assert.throws(() => loopTermsOf(cyclic, t), e => isRefusal(e, 'LOOP_MATE_UNSUPPORTED'));
});

test('Cylindrical robot: invalid per-axis limits and missing generic export ratings remain typed', () => {
  const doc = solved(), bad = tree(doc, { version: 1, joints: { 'base~p#0': { lower: 5, upper: -5 }, 'base~p#1': { effort: 0 } } });
  assert.ok(bad.problems.some(p => p.code === 'LIMITS_BAD' && p.joint === 'base~p#0'));
  assert.ok(bad.problems.some(p => p.code === 'LIMITS_BAD' && p.joint === 'base~p#1'));
  const missing = tree(doc, { version: 1, joints: { 'base~p#0': { lower: -20, upper: 50 }, 'base~p#1': { lower: -90, upper: 90 } } });
  for (const key of ['base~p#0', 'base~p#1']) assert.ok(missing.notes.some(n => n.code === 'LIMITS_MISSING' && n.joint === key));
  const exportInputs = robotParts(missing, () => null);
  assert.ok('refusals' in exportInputs && exportInputs.refusals.some(r => r.code === 'LIMITS_MISSING'));
});
