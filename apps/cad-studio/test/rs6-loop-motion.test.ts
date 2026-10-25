import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BarocssError } from '@barocss/cad/api';
import { emptyDoc, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Mate } from '@barocss/cad-model/assembly/mates';
import { treeOf, viewOf } from '@barocss/cad-model/api/robotCore';
import { forwardKinematics } from '@barocss/cad-model/robot/fk';
import { motionOf, poseAt, timedPathOf, type MotionPath } from '@barocss/cad-model/robot/motion';
import { motionPlaybackAt, motionPlaybackOf } from '@barocss/cad-model/robot/verbs';
import { applyMotionFrame, draftPath, motionFrame, motionPose, refuseMotionSweep, timedMotion } from '../src/state/motion';
import { createValueStore } from '../src/state/valueStore';

const RAD = Math.PI / 180, limits = { default: { velocity: 90, acceleration: 180 } };
const sample = (name: string): StudioDoc => JSON.parse(readFileSync(resolve(process.cwd(), `../../packages/barocss-cad-model/samples/robots/${name}.bcad`), 'utf8'));
const context = (doc: StudioDoc) => ({ doc, tree: treeOf(doc) });
const near = (actual: number, expected: number, tol = 1e-9) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} vs ${expected}, tolerance ${tol}`);
const code = (...codes: string[]) => (error: unknown) => error instanceof BarocssError && codes.includes(error.code);
const stores = () => ({ inputs: createValueStore<Record<string, number>>({}), pose: createValueStore<Record<string, number>>({}), time: createValueStore(0) });

/** Independent Freudenstein branch, lengths ground/crank/coupler/rocker = 60/20/70/50 mm. */
function rockerAngle(theta: number) {
  const p = 3 - Math.cos(theta), q = -Math.sin(theta), r = 0.8 - 1.2 * Math.cos(theta);
  return Math.atan2(q, p) + Math.acos(-r / Math.hypot(p, q));
}

test('Studio RS6 uses the shared closed pose, while the facade wrapper still returns driver inputs only', () => {
  const ctx = context(sample('four-bar')), before = JSON.stringify(ctx.doc), { tree } = ctx;
  const path: MotionPath = { waypoints: [{ 'base~crank': 0 }, { 'base~crank': 60 }, { 'base~crank': -60 }, { 'base~crank': 0 }], limits };
  const native = timedPathOf(tree, path), motion = timedMotion(native, ctx), publicPath = motionOf(tree, native), view = viewOf(ctx.doc);
  const pathBefore = JSON.stringify(native), crank = tree.joints.find(j => j.key === 'base~crank')!, rocker = tree.joints.find(j => j.key === 'base~rocker')!;
  const home2 = ctx.doc.instances!.find(i => i.id === 'crank')!.rotation[2] * RAD;
  const home4 = ctx.doc.instances!.find(i => i.id === 'rocker')!.rotation[2] * RAD;
  near(motion.duration, 25 / 6, 1e-12);
  for (const [time, degree] of [[0, 0], [7 / 12, 30], [7 / 6, 60], [3, -60], [25 / 6, 0], [-1, 0], [100, 0]]) {
    const frame = motionFrame(tree, motion, time), shared = motionPlaybackAt(ctx.doc, tree, publicPath, time);
    const facade = motionPlaybackOf(view, publicPath, time, tree);
    assert.deepEqual(Object.keys(facade), ['duration', 'values']);
    assert.deepEqual(facade.values, shared.values);
    assert.deepEqual(Object.keys(frame.drivers), [crank.key]);
    assert.deepEqual(frame.values, shared.closedValues);
    assert.deepEqual(motionPose(tree, motion, time), shared.closedValues);
    near(frame.drivers[crank.key], degree * RAD);
    assert.ok(Object.hasOwn(frame.values, rocker.key) && !Object.hasOwn(frame.drivers, rocker.key));
    const theta2 = home2 + frame.drivers[crank.key] * Math.sign(crank.axis[2]);
    const theta4 = home4 + frame.values[rocker.key] * Math.sign(rocker.axis[2]);
    near(Math.atan2(Math.sin(theta4 - rockerAngle(theta2)), Math.cos(theta4 - rockerAngle(theta2))), 0);
    const bx = 20 + 20 * Math.cos(theta2), by = 20 + 20 * Math.sin(theta2);
    const cx = 80 + 50 * Math.cos(theta4), cy = 20 + 50 * Math.sin(theta4);
    near(Math.hypot(cx - bx, cy - by), 70);
    assert.ok((cx - bx) * (20 - by) - (cy - by) * (80 - bx) < 0, 'assembled intersection branch');
  }
  for (const seam of [7 / 6, 3]) {
    const a = motionPose(tree, motion, seam - 1e-4), b = motionPose(tree, motion, seam + 1e-4);
    assert.ok(Math.abs(a[rocker.key] - b[rocker.key]) < 1e-6, 'passive continuity across a stopped segment seam');
  }
  const early = motionPose(tree, motion, 0.5);
  motionPose(tree, motion, 4);
  assert.deepEqual(motionPose(tree, motion, 0.5), early, 'arbitrary seek order does not change the branch');
  assert.equal(JSON.stringify(ctx.doc), before);
  assert.equal(JSON.stringify(native), pathBefore);
});

type Hole = { axis: 'x' | 'z'; center: [number, number]; radius: number };
function block(w: number, d: number, h: number, holes: Hole[]): StudioDoc {
  const nodes: ModelNode[] = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] }, { kind: 'extrude', sketch: 0, height: h }];
  for (const hole of holes) nodes.push({ kind: 'hole', parent: { node: nodes.length - 1, side: 'solid' }, center: hole.center, radius: hole.radius, ...(hole.axis === 'x' ? { axis: 'x' as const } : {}) });
  return { ...emptyDoc(), nodes };
}
/** Genuine offset slider-crank: r30/rod70/bore y35, the bore chain contains a prismatic step before its turn. */
function sliderCrank() {
  const dx = Math.sqrt(70 * 70 - 25), W0: [number, number, number] = [60 + dx, 35, 20];
  const base = block(260, 80, 10, [{ axis: 'z', center: [30, 30], radius: 5 }]);
  const crank = block(40, 10, 5, [{ axis: 'z', center: [5, 5], radius: 5 }, { axis: 'z', center: [35, 5], radius: 2.5 }]);
  const rod = block(dx + 10, 15, 5, [{ axis: 'z', center: [5, 5], radius: 2.5 }, { axis: 'z', center: [5 + dx, 10], radius: 2 }]);
  const piston = block(20, 20, 20, [{ axis: 'z', center: [10, 10], radius: 2 }, { axis: 'x', center: [10, 10], radius: 3 }]);
  const cylinder = block(40, 20, 20, [{ axis: 'x', center: [10, 10], radius: 3 }]);
  const mates: Mate[] = [
    { id: 'mainc', kind: 'concentric', a: { part: 'base', face: 'n2.side0' }, b: { part: 'crank', face: 'n2.side0' } },
    { id: 'mainf', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'crank', face: 'n1.bottom' } },
    { id: 'pinc', kind: 'concentric', a: { part: 'crank', face: 'n3.side0' }, b: { part: 'rod', face: 'n2.side0' } },
    { id: 'pinf', kind: 'coincident', a: { part: 'crank', face: 'n1.top' }, b: { part: 'rod', face: 'n1.bottom' } },
    { id: 'bore', kind: 'concentric', a: { part: 'cylinder', face: 'n2.side0' }, b: { part: 'piston', face: 'n3.side0' } },
    { id: 'wrist', kind: 'concentric', a: { part: 'rod', face: 'n3.side0' }, b: { part: 'piston', face: 'n2.side0' } },
  ];
  const doc: StudioDoc = { ...base, mates, instances: [
    { id: 'crank', name: 'crank', doc: crank, position: [25, 25, 10], rotation: [0, 0, 0] },
    { id: 'rod', name: 'rod', doc: rod, position: [55, 25, 15], rotation: [0, 0, 0] },
    { id: 'piston', name: 'piston', doc: piston, position: [W0[0] - 10, 25, 20], rotation: [0, 0, 0] },
    { id: 'cylinder', name: 'cylinder', doc: cylinder, position: [200, 25, 20], rotation: [0, 0, 0], grounded: true },
  ] };
  return { doc, W0 };
}
const transform = (m: { R: Float64Array; t: Float64Array }, p: readonly number[]) => [0, 1, 2].map(i => m.R[3 * i] * p[0] + m.R[3 * i + 1] * p[1] + m.R[3 * i + 2] * p[2] + m.t[i]);

test('Studio RS6 drives 720 degrees and renders the passive slide in mm without saving it as a driver', () => {
  const s = sliderCrank(), ctx = context(s.doc), { tree } = ctx;
  const crank = tree.joints.find(j => j.child === 'crank')!, slide = tree.joints.find(j => j.key === 'piston~cylinder#0')!;
  assert.equal(slide.type, 'prismatic'); assert.equal(slide.parent, 'cylinder'); assert.equal(slide.child, 'piston__1');
  assert.deepEqual(slide.mates, ['bore']);
  const path = timedPathOf(tree, { waypoints: [{}, { [crank.key]: 360 }, { [crank.key]: 720 }], limits });
  const motion = timedMotion(path, ctx), state = stores();
  near(motion.duration, 9, 1e-12);
  near(motionFrame(tree, motion, 4.5).drivers[crank.key], 2 * Math.PI);
  near(motionFrame(tree, motion, 9).drivers[crank.key], 4 * Math.PI);
  for (const time of [0, 0.5, 2.25, 4.5 - 1e-4, 4.5, 4.5 + 1e-4, 6.75, 9]) {
    const frame = applyMotionFrame(tree, motion, time, state), fk = forwardKinematics(tree, state.pose.get());
    assert.deepEqual(Object.keys(state.inputs.get()), [crank.key]);
    assert.ok(Object.hasOwn(state.pose.get(), slide.key));
    near(state.time.get(), time);
    const theta = frame.drivers[crank.key] * Math.sign(crank.axis[2]), P = transform(fk.motions.get('crank')!, [60, 30, 15]);
    near(P[0], 30 + 30 * Math.cos(theta)); near(P[1], 30 + 30 * Math.sin(theta));
    const expectedX = 30 + 30 * Math.cos(theta) + Math.sqrt(70 * 70 - (35 - (30 + 30 * Math.sin(theta))) ** 2);
    const W = transform(fk.motions.get('piston')!, s.W0);
    near(W[0], expectedX); near(W[1], 35); near(W[2], 20);
    near(frame.values[slide.key] * slide.axis[0], expectedX - s.W0[0]);
  }
  const recorded = { ...state.inputs.get() }, saved = motionOf(tree, draftPath(tree, [recorded], state.inputs.get()));
  for (const waypoint of saved.waypoints) assert.ok(Object.keys(waypoint).every(key => key === crank.key));
  near(saved.waypoints[1][crank.key], 720);
  near(saved.waypoints[2][crank.key], 720);
  assert.ok(Object.keys(state.pose.get()).length > Object.keys(recorded).length, 'the displayed passives were not lost, only excluded from persistence');
});

test('Studio RS6 refusals preserve typed errors and leave time, inputs and displayed pose unchanged', () => {
  const ctx = context(sample('four-bar')), { tree } = ctx;
  const path = timedPathOf(tree, { waypoints: [{}, { 'base~crank': 60 }], limits }), motion = timedMotion(path, ctx), state = stores();
  applyMotionFrame(tree, motion, 0.5, state);
  const before = { inputs: state.inputs.get(), pose: state.pose.get(), time: state.time.get() };
  for (const rejected of [() => applyMotionFrame(tree, motion, NaN, state), () => applyMotionFrame(tree, timedMotion(path), 0.5, state), () => applyMotionFrame({ ...tree }, motion, 0.5, state)]) {
    assert.throws(rejected, code('VALUE', 'LOOP_OPEN'));
    assert.deepEqual({ inputs: state.inputs.get(), pose: state.pose.get(), time: state.time.get() }, before);
  }
  assert.throws(() => refuseMotionSweep(tree), code('LOOP_OPEN'));
  const cases: [MotionPath, string][] = [
    [{ waypoints: [{}, { 'base~crank': 20 }] }, 'LIMITS_MISSING'],
    [{ waypoints: [{ nope: 0 }, { nope: 1 }], limits }, 'JOINT_UNKNOWN'],
    [{ waypoints: [{ 'base~crank': 0, 'base~rocker': 0 }, { 'base~crank': 20, 'base~rocker': 10 }], limits }, 'LOOP_PASSIVE'],
    [{ waypoints: [{}, { 'base~crank': Infinity }], limits }, 'VALUE'],
  ];
  for (const [candidate, expected] of cases) assert.throws(() => timedMotion(timedPathOf(tree, candidate), ctx), code(expected));
  for (const [key, expected] of [['base~crank', 'JOINT_LIMIT'], ['base~rocker', 'LOOP_OPEN']]) {
    const doc = sample('four-bar');
    doc.robot = { ...doc.robot, version: 1, joints: { ...doc.robot?.joints, [key]: { lower: -10, upper: 10 } } };
    const bounded = context(doc);
    assert.throws(() => timedMotion(timedPathOf(bounded.tree, { waypoints: [{}, { 'base~crank': 20 }], limits }), bounded), code(expected));
  }
});

test('Studio RS6 refuses a toggle excursion before a return-home seek can skip the preceding seam', () => {
  const ctx = context(sample('four-bar')), rocker = ctx.tree.joints.find(j => j.key === 'base~rocker')!;
  const home = ctx.doc.instances!.find(i => i.id === 'rocker')!.rotation[2] * RAD, toggle = Math.acos(-0.6);
  // 60²+50²+2*60*50*cos(theta4) < (70-20)²: the crank and coupler circles cannot meet.
  assert.ok(60 * 60 + 50 * 50 + 2 * 60 * 50 * Math.cos(toggle + 0.02) < 50 * 50);
  const degree = (toggle + 0.02 - home) / (RAD * Math.sign(rocker.axis[2]));
  const path: MotionPath = { waypoints: [{ [rocker.key]: 0 }, { [rocker.key]: degree }, { [rocker.key]: 0 }], limits };
  assert.throws(() => timedMotion(timedPathOf(ctx.tree, path), ctx), code('DEAD_POINT', 'NO_CLOSURE'));
  assert.throws(() => motionPlaybackAt(ctx.doc, ctx.tree, path, 100), code('DEAD_POINT', 'NO_CLOSURE'));
});

test('Studio open-chain motion keeps native radians/mm and public saved degrees/mm with its original timing', () => {
  const ctx = context(sample('scara')), { tree } = ctx;
  const path = timedPathOf(tree, { waypoints: [{}, { 'base~arm1': 60, 'arm2~quill': -30 }], limits });
  const motion = timedMotion(path), frame = motionFrame(tree, motion, 7 / 12), state = stores();
  near(motion.duration, 7 / 6, 1e-12);
  near(frame.drivers['base~arm1'], Math.PI / 6); near(frame.drivers['arm2~quill'], -15);
  assert.deepEqual(frame.values, poseAt(tree, path, 7 / 12));
  assert.deepEqual(frame.drivers, frame.values);
  applyMotionFrame(tree, motion, 100, state);
  near(state.inputs.get()['base~arm1'], Math.PI / 3); near(state.inputs.get()['arm2~quill'], -30);
  near(state.time.get(), 7 / 6);
  const saved = motionOf(tree, path);
  near(saved.waypoints[1]['base~arm1'], 60); near(saved.waypoints[1]['arm2~quill'], -30);
  assert.doesNotThrow(() => refuseMotionSweep(tree));
  const publicPath = motionOf(tree, path), shared = motionPlaybackAt(ctx.doc, tree, publicPath, 7 / 12), wrapper = motionPlaybackOf(viewOf(ctx.doc), publicPath, 7 / 12, tree);
  assert.deepEqual(shared.closedValues, shared.values);
  assert.deepEqual(wrapper, { duration: shared.duration, values: shared.values });
});
