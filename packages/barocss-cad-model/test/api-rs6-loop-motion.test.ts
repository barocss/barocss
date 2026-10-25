// RS6 facade playback: independent linkage geometry and public degree/mm/s oracles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BarocssError, Robot } from '../src/api';
import { treeOf } from '../src/api/robotCore';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import type { Mate } from '../src/assembly/mates';
import { forwardKinematics } from '../src/robot/fk';

const RAD = Math.PI / 180;
const limits = { default: { velocity: 90, acceleration: 180 } };
const sample = (name: string): StudioDoc => JSON.parse(readFileSync(join(import.meta.dirname, `../samples/robots/${name}.bcad`), 'utf8'));
const near = (got: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(got - expected) <= tolerance, `${got} vs ${expected}; tolerance ${tolerance}`);
const code = (...codes: string[]) => (e: unknown) => e instanceof BarocssError && codes.includes(e.code);
const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Freudenstein's equation for the assembled branch: ground 60, crank 20, coupler 70, rocker 50 mm. */
function fourBarAngle(crank: number): number {
  const p = 3 - Math.cos(crank), q = -Math.sin(crank), r = 0.8 - 1.2 * Math.cos(crank);
  return Math.atan2(q, p) + Math.acos(-r / Math.hypot(p, q));
}

test('RS6 four-bar: driver timing, closed geometry, saved round trip and seam continuity in degrees', () => {
  const doc = sample('four-bar'), before = JSON.stringify(doc), robot = new Robot(doc), tree = treeOf(doc);
  const crank = tree.joints.find(j => j.key === 'base~crank')!, rocker = tree.joints.find(j => j.key === 'base~rocker')!;
  const homeCrank = doc.instances!.find(i => i.id === 'crank')!.rotation[2] * RAD;
  const homeRocker = doc.instances!.find(i => i.id === 'rocker')!.rotation[2] * RAD;
  const path = robot.path([{ [crank.key]: 0 }, { [crank.key]: 60 }, { [crank.key]: -60 }, { [crank.key]: 0 }], { limits });
  const saved = robot.withMotion('facade-round-trip', path).motion('facade-round-trip');
  // Each segment starts/stops: D/90 + 90/180 seconds for D = 60, 120, 60 degrees.
  near(saved.duration(), 25 / 6, 1e-12);
  assert.deepEqual(saved.problems(), []);
  for (const [time, expected] of [[0, 0], [7 / 12, 30], [7 / 6, 60], [3, -60], [25 / 6, 0], [-1, 0], [100, 0]]) {
    const drivers = saved.poseAt(time);
    assert.deepEqual(Object.keys(drivers), [crank.key], 'passive joints must not become extra pose() drivers');
    near(drivers[crank.key], expected);
    const posed = robot.pose(drivers), theta2 = homeCrank + expected * RAD * Math.sign(crank.axis[2]);
    const theta4 = homeRocker + posed.values[rocker.key] * RAD * Math.sign(rocker.axis[2]);
    near(angleDifference(theta4, fourBarAngle(theta2)), 0);
    // Independent pin positions: the coupler remains 70 mm, on the assembled circle-intersection branch.
    const bx = 20 + 20 * Math.cos(theta2), by = 20 + 20 * Math.sin(theta2);
    const cx = 80 + 50 * Math.cos(theta4), cy = 20 + 50 * Math.sin(theta4);
    near(Math.hypot(cx - bx, cy - by), 70);
    assert.ok((cx - bx) * (20 - by) - (cy - by) * (80 - bx) < 0, 'assembled intersection branch');
  }
  for (const seam of [7 / 6, 3]) {
    const left = robot.pose(saved.poseAt(seam - 1e-4)).values[rocker.key];
    const right = robot.pose(saved.poseAt(seam + 1e-4)).values[rocker.key];
    assert.ok(Math.abs(left - right) < 1e-3, `${seam} s: passive seam discontinuity ${left} vs ${right}`);
  }
  // A later seek followed by an earlier one has the same branch as a fresh seek.
  const early = robot.pose(saved.poseAt(0.5));
  saved.poseAt(4);
  assert.deepEqual(robot.pose(saved.poseAt(0.5)), early);
  assert.throws(() => saved.check(), code('LOOP_OPEN'), 'facade sweep/CCD is still outside this slice');
  assert.equal(JSON.stringify(doc), before, 'playback leaves source documents unchanged');
  assert.ok(!robot.doc.robot?.motions?.some(m => m.name === 'facade-round-trip'));
});

type Hole = { axis: 'x' | 'z'; center: [number, number]; radius: number };
function block(w: number, d: number, h: number, holes: Hole[]): StudioDoc {
  const nodes: ModelNode[] = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] }, { kind: 'extrude', sketch: 0, height: h }];
  for (const hole of holes) nodes.push({ kind: 'hole', parent: { node: nodes.length - 1, side: 'solid' }, center: hole.center, radius: hole.radius, ...(hole.axis === 'x' ? { axis: 'x' as const } : {}) });
  return { ...emptyDoc(), nodes };
}

/** Offset slider-crank: r = 30, rod = 70, bore y = 35 mm. Bore first puts the slide along X in the tree. */
function sliderCrank() {
  const dx = Math.sqrt(70 * 70 - 5 * 5), yb = 35, W0: [number, number, number] = [60 + dx, yb, 20];
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

test('RS6 slider-crank: 720 unwrapped degrees, a passive slide in mm and the closed-form wrist point', () => {
  const s = sliderCrank(), robot = new Robot(s.doc), tree = treeOf(s.doc);
  const crank = tree.joints.find(j => j.child === 'crank')!, slide = tree.joints.find(j => j.child === 'piston' && j.type === 'prismatic')!;
  assert.equal(tree.loops.length, 1);
  assert.ok(slide, 'the fixture exposes the prismatic joint, not only a turn');
  const path = robot.path([{}, { [crank.key]: 360 }, { [crank.key]: 720 }], { limits });
  near(path.duration(), 9, 1e-12);
  near(path.poseAt(4.5)[crank.key], 360);
  near(path.poseAt(9)[crank.key], 720);
  assert.deepEqual(path.problems(), []);
  for (const time of [0, 0.5, 2.25, 4.5 - 1e-4, 4.5, 4.5 + 1e-4, 6.75, 9]) {
    const drivers = path.poseAt(time), posed = robot.pose(drivers);
    assert.deepEqual(Object.keys(drivers), [crank.key]);
    // Convert each reported turn exactly once, independently of the production unit helper; slides remain mm.
    const native = Object.fromEntries(Object.entries(posed.values).map(([key, value]) => [key,
      tree.joints.some(j => j.key === key && (j.type === 'revolute' || j.type === 'continuous')) ? value * RAD : value]));
    const fk = forwardKinematics(tree, native), P = transform(fk.motions.get('crank')!, [60, 30, 15]);
    const W = transform(fk.motions.get('piston')!, s.W0), theta = drivers[crank.key] * RAD * Math.sign(crank.axis[2]);
    near(P[0], 30 + 30 * Math.cos(theta));
    near(P[1], 30 + 30 * Math.sin(theta));
    const expectedX = 30 + 30 * Math.cos(theta) + Math.sqrt(70 * 70 - (35 - (30 + 30 * Math.sin(theta))) ** 2);
    near(W[0], expectedX); near(W[1], 35); near(W[2], 20);
    near(posed.values[slide.key] * slide.axis[0], expectedX - s.W0[0]);
    const piston = posed.links.find(l => l.link === 'piston')!;
    near(piston.position[0] + 10, expectedX, 1e-6); // Public link placements are rounded to 1e-6 mm.
  }
});

test('RS6 refuses missing motion limits, unknown joints, extra loop drivers and unsupported passive bounds', () => {
  const robot = new Robot(sample('four-bar')), waypoints = [{ 'base~crank': 0 }, { 'base~crank': 20 }];
  const cases = [
    { path: robot.path(waypoints), expected: 'LIMITS_MISSING' },
    { path: robot.path([{ nope: 0 }, { nope: 1 }], { limits }), expected: 'JOINT_UNKNOWN' },
    { path: robot.path([{ 'base~crank': 0, 'base~rocker': 0 }, { 'base~crank': 20, 'base~rocker': 10 }], { limits }), expected: 'LOOP_PASSIVE' },
    { path: robot.setJoints({ joints: { 'base~crank': { lower: -10, upper: 10 } } }).path(waypoints, { limits }), expected: 'JOINT_LIMIT' },
    { path: robot.setJoints({ joints: { 'base~rocker': { lower: -180, upper: 180 } } }).path(waypoints, { limits }), expected: 'LOOP_OPEN' },
  ];
  for (const { path, expected } of cases) {
    assert.throws(() => path.duration(), code(expected));
    assert.throws(() => path.poseAt(0.1), code(expected));
    assert.deepEqual(path.problems().map(p => p.code), [expected]);
  }
  const path = robot.path(waypoints, { limits });
  assert.throws(() => path.poseAt(Number.NaN), code('VALUE'));
  const bad = robot.path([{}, { 'base~crank': Infinity }], { limits });
  assert.throws(() => bad.duration(), code('VALUE'));
  assert.deepEqual(bad.problems().map(p => p.code), ['VALUE']);
});

test('RS6 cannot skip an unreachable excursion by seeking its home endpoint; toggle refusal stays typed', () => {
  const doc = sample('four-bar'), robot = new Robot(doc), tree = treeOf(doc);
  const rocker = tree.joints.find(j => j.key === 'base~rocker')!;
  const home = doc.instances!.find(i => i.id === 'rocker')!.rotation[2] * RAD;
  // At the toggle, |A-C| = 70 - 20 = 50: 60² + 50² + 2*60*50*cos(theta4) = 50².
  const toggle = Math.acos(-0.6), beyond = (toggle + 0.02 - home) / (RAD * Math.sign(rocker.axis[2]));
  assert.ok(60 * 60 + 50 * 50 + 2 * 60 * 50 * Math.cos(toggle + 0.02) < 50 * 50);
  const path = robot.path([{ [rocker.key]: 0 }, { [rocker.key]: beyond }, { [rocker.key]: 0 }], { limits });
  assert.throws(() => path.duration(), code('DEAD_POINT', 'NO_CLOSURE'));
  assert.throws(() => path.poseAt(100), code('DEAD_POINT', 'NO_CLOSURE'), 'the preceding seam must be closed before the final home pose');
  assert.ok(['DEAD_POINT', 'NO_CLOSURE'].includes(path.problems()[0].code));
  // A reachable initial prefix is independent of a later failed excursion.
  near(path.poseAt(0)[rocker.key], 0);
});

test('open-chain motion keeps degrees for turns, mm for slides and the original synchronized timing', () => {
  const robot = new Robot(sample('scara'));
  const path = robot.path([{}, { 'base~arm1': 60, 'arm2~quill': -30 }], { limits });
  assert.deepEqual(path.problems(), []);
  near(path.duration(), 7 / 6, 1e-12);
  const mid = path.poseAt(7 / 12), end = path.poseAt(7 / 6);
  near(mid['base~arm1'], 30); near(mid['arm2~quill'], -15);
  near(end['base~arm1'], 60); near(end['arm2~quill'], -30);
  near(robot.pose(mid).values['base~arm1'], 30);
  near(robot.pose(mid).values['arm2~quill'], -15);
});
