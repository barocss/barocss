// The sample robots cad-model ships (packages/barocss-cad-model/samples/robots), each opened and read as a robot through
// the object facade: its joints, a pose, and for some a path's check or an export with what it checks. The robots page
// includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// #region import
import { part, assembly } from '@barocss/cad-model/api';
// #endregion import

const samples = resolve(import.meta.dirname, '../../../packages/barocss-cad-model/samples/robots');
const read = file => JSON.parse(readFileSync(resolve(samples, file), 'utf8'));
// #region open
/** A sample robot: its document (a plain-JSON .bcad) opened as a studio part, the assembly read as a robot. */
const open = id => assembly(id, part(id, read(`${id}.bcad`))).robot();
// #endregion open
/** The pose's joint values come back in radians, as the agent's tool replies. */
const deg = rad => rad * 180 / Math.PI;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
const link = (pose, id) => pose.links.find(l => l.link === id);

test('the index and the 2R arm: two turns, a pose, a path checked', () => {
  // #region arm-2r
  const index = read('index.json');                         // [{ id, title, about, file }]
  assert.deepEqual(index.map(s => s.id), ['arm-2r', 'scara', 'arm-6r', 'gantry-ppp', 'pan-tilt', 'gripper', 'four-bar', 'gear-joint']);

  const arm = open('arm-2r');
  assert.deepEqual(arm.joints().joints.map(j => [j.key, j.type]), [['base~a', 'revolute'], ['a~b', 'revolute']]);
  const pose = arm.pose({ 'base~a': 90, 'a~b': -90 });      // degrees in; each link's place out
  assert.deepEqual(link(pose, 'a').rotation, [0, 0, 90]);
  assert.deepEqual(link(pose, 'b').rotation, [0, 0, 0]);   // the turns add up: 90 − 90
  const [sweep] = arm.path([{}, { 'base~a': 60, 'a~b': -90 }]).check();
  assert.equal(sweep.clear, true);                          // nothing hit on the way
  // #endregion arm-2r
});

test('the SCARA arm: turn, turn, slide, turn', () => {
  // #region scara
  const scara = open('scara');
  assert.deepEqual(scara.joints().joints.map(j => j.type), ['revolute', 'revolute', 'prismatic', 'revolute']);
  const home = link(scara.pose(), 'quill').position, down = link(scara.pose({ 'arm2~quill': -30 }), 'quill').position;
  assert.deepEqual([down[0] - home[0], down[1] - home[1], down[2] - home[2]], [0, 0, -30]);   // the quill slides 30 mm down
  // #endregion scara
});

test('the 6R arm: six turns, its demo motion swept, URDF read back', () => {
  // #region arm-6r
  const arm = open('arm-6r');
  const axes = arm.joints().joints.map(j => 'XYZ'[j.axis.findIndex(v => Math.abs(v) > 0.5)]);
  assert.deepEqual(axes, ['Z', 'Y', 'Y', 'Z', 'Y', 'Z']);   // waist, shoulder, elbow, a three-axis wrist
  const [reach] = read('arm-6r.bcad').robot.motions;       // the sample's demo motion, in degrees
  assert.ok(arm.path(reach.path.waypoints).check().every(s => s.clear));
  const urdf = arm.urdf('arm-6r');                          // { urdf, files, notes, check }
  assert.deepEqual(urdf.check, []);                         // read back by our own URDF reader: nothing wrong
  // #endregion arm-6r
});

test('the Cartesian gantry: three slides', () => {
  // #region gantry
  const gantry = open('gantry-ppp');
  const home = gantry.pose(), moved = gantry.pose({ 'base~x': 150, 'x~y': 100, 'y~z': -30 });
  const by = id => link(moved, id).position.map((v, k) => v - link(home, id).position[k]);
  assert.deepEqual(by('x'), [150, 0, 0]);                   // each slide carries the ones after it
  assert.deepEqual(by('y'), [150, 100, 0]);
  assert.deepEqual(by('z'), [150, 100, -30]);
  // #endregion gantry
});

test('the pan-tilt head: a camera frame, and a limit', () => {
  // #region pan-tilt
  const head = open('pan-tilt');
  const [camera] = head.pose({ 'base~pan': 90, 'pan~tilt': 30 }).frames;
  assert.equal(camera.frame, 'camera');                     // the sensor frame on the head
  assert.deepEqual(camera.rotation, [30, 0, 90]);
  assert.deepEqual(head.pose({ 'pan~tilt': 80 }).out_of_limits, ['pan~tilt']);   // the tilt stops at ±60°
  // #endregion pan-tilt
});

test('the gripper: the right finger follows the left one through their gears', () => {
  // #region gripper
  const gripper = open('gripper');
  const [coupling] = gripper.joints().couplings;
  assert.deepEqual([coupling.leader, coupling.follower, coupling.multiplier], ['base~left', 'base~right', -1]);
  const pose = gripper.pose({ 'base~left': 25 });           // only the leader is given
  assert.ok(near(deg(pose.values['base~right']), -25));
  assert.equal(pose.gears[0].held, true);                   // the teeth stay in mesh
  // #endregion gripper
});

test('the four-bar linkage: a closed loop', () => {
  // #region four-bar
  const linkage = open('four-bar');
  const { joints, loops } = linkage.joints();
  assert.equal(joints.length, 3);                           // crank, coupler, rocker: a tree of three turns
  assert.equal(loops.length, 1);                            // and the coupler–rocker pin closing the loop
  const pose = linkage.pose({ 'base~crank': 60 });          // turn the crank: the others follow
  assert.ok(link(pose, 'rocker').rotation[2] !== 0 && link(pose, 'coupler').rotation[2] !== 0);
  assert.match(linkage.urdf('four-bar').notes[0], /closure \(Cc\) is not written/);   // URDF is a tree format
  // #endregion four-bar
});

test('the gear-driven joint: 20 teeth driving 30', () => {
  // #region gear-joint
  const pose = open('gear-joint').pose({ 'base~g1': 30 });
  assert.ok(near(deg(pose.values['base~g2']), -20));        // two thirds as far, the other way
  // #endregion gear-joint
});

test('exports: URDF, MJCF, SDF and USD, each with what it checks', () => {
  // #region exports
  const arm = open('arm-2r');
  const urdf = arm.urdf('arm-2r'), mjcf = arm.mjcf('arm-2r');
  assert.deepEqual(urdf.files.map(f => f.path), ['meshes/base.stl', 'meshes/base_collision.stl', 'meshes/a.stl',
    'meshes/a_collision.stl', 'meshes/b.stl', 'meshes/b_collision.stl']);
  assert.deepEqual([urdf.check, mjcf.check], [[], []]);     // each read back by our own reader
  assert.match(urdf.notes[0], /without a material, aluminium assumed/);   // what the export had to assume
  assert.equal(arm.sdf('arm-2r').ok, true);
  assert.equal(arm.usd('arm-2r').ok, true);
  // #endregion exports
});

test('motions: a path timed and played, a saved motion read, a path saved as one', () => {
  // #region motions
  const arm = open('arm-2r');
  // Home to 60° on the first joint, at 90°/s and 180°/s²: a trapezoid of two half-second ramps and 1/6 s between.
  // (`default` limits every joint not named; a joint's own key limits that one.)
  const swing = arm.path([{}, { 'base~a': 60 }], { limits: { default: { velocity: 90, acceleration: 180 } } });
  assert.deepEqual(swing.problems(), []);
  const T = swing.duration();
  assert.ok(near(T, 1 + 1 / 6));
  assert.ok(near(swing.poseAt(T / 2)['base~a'], 30));        // degrees: half-way at half the time
  assert.ok(near(swing.poseAt(T)['base~a'], 60));

  const wave = arm.motion('wave');                           // the sample's demo motion, saved in its robot settings
  assert.deepEqual(wave.waypoints, [{}, { 'base~a': 60, 'a~b': -90 }, { 'base~a': -45, 'a~b': 90 }, {}]);
  const saved = arm.withMotion('swing', swing);              // a new robot, the motion kept in its document
  assert.deepEqual(saved.motion('swing').waypoints, swing.waypoints);
  // #endregion motions
  assert.equal(arm.doc.robot.motions.length, 1);             // the first robot is unchanged
});

test('every sample\'s demo motion swept; designed contact is not a collision', () => {
  // #region sweeps
  // (The four-bar is left out: a motion's poses don't close its loop yet.)
  const LOOPED = ['four-bar'];
  for (const sample of read('index.json').filter(s => !LOOPED.includes(s.id))) {
    const [demo] = read(sample.file).robot.motions;
    assert.ok(open(sample.id).motion(demo.name).check().every(segment => segment.clear), sample.id);
  }
  // The gripper's fingers mesh: their teeth are the coupling's to hold, so that pair is skipped, with why.
  const [segment] = open('gripper').motion('grip').check();
  assert.match(segment.skipped.find(p => p.links.join() === 'left,right').why, /^meshing gears/);
  // A robot with a closed loop is refused, typed, rather than swept or played open.
  const crank = open('four-bar').motion('crank');
  assert.throws(() => crank.check(), e => e.code === 'LOOP_OPEN');
  assert.throws(() => crank.poseAt(1), e => e.code === 'LOOP_OPEN');
  assert.equal(crank.problems()[0].code, 'LOOP_OPEN');
  // #endregion sweeps
});
