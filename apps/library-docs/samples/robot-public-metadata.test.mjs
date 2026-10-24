import { robotCheckOfDoc as canonicalRobotCheckOfDoc, robotSizeOfDoc as canonicalRobotSizeOfDoc } from '@barocss/cad-model/chat/robot';
import { readDuty } from '@barocss/cad-model/robot/native/duty';
// Actual shipped robot documents and the same parsers/projectors used by cad-cli. No fabricated report DTOs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Robot } from '@barocss/cad-model/api';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { treeOfDoc, nativeRobotCheckOfDoc, nativeRobotSizeOfDoc, runRobotTool } from '@barocss/cad-model/chat/robot';
import { dutyJson, harnessJson, sizedJson } from '@barocss/cad-model/robot/reports';
import { MOTORS, REDUCERS } from '@barocss/cad-model/robot/actuators';

const folder = resolve(import.meta.dirname, '../../../packages/barocss-cad-model/samples/robots');
const read = name => JSON.parse(readFileSync(resolve(folder, `${name}.bcad`), 'utf8'));
const evaluate = async doc => evaluatePart(doc, 1);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('actual gear placements expose degrees once and preserve the original GearSpec', async t => {
  const doc = read('gear-joint');
  // The +Z coupling frame takes +Y as its x axis: world turns 180° and 45° are 90° and -45° in that frame.
  doc.instances.find(i => i.id === 'g1').rotation = [0, 0, 180];
  doc.instances.find(i => i.id === 'g2').rotation = [0, 0, 45];
  const evaluated = await evaluate(doc);
  assert.ok(evaluated.ok);
  const internal = await treeOfDoc(doc, evaluated.bodies, evaluate);
  const robot = new Robot(doc), before = robot.doc;
  const [coupling] = robot.joints().couplings;
  assert.ok(coupling);
  near(coupling.g1.rotation, 90);
  near(coupling.g2.rotation, -45);
  assert.deepEqual(coupling.g1.spec, internal.couplings[0].g1.spec);
  assert.deepEqual(coupling.g2.spec, internal.couplings[0].g2.spec);
  for (const key of ['g1', 'g2']) assert.deepEqual(Object.keys(coupling[key]).sort(), ['center', 'from', 'rotation', 'spec']);
  const home = robot.pose(), moved = robot.pose({ 'base~g1': 30 });
  const [gear] = moved.gears;
  assert.ok(gear.held);
  near(gear.phase, home.gears[0].phase);
  near(gear.homePhase, home.gears[0].homePhase);
  near(gear.backlash, home.gears[0].backlash);
  for (const key of ['phase_deg', 'home_phase_deg', 'backlash_mm']) assert.equal(key in gear, false);
  assert.deepEqual(robot.doc, before);
  t.diagnostic(JSON.stringify({ rotations: [coupling.g1.rotation, coupling.g2.rotation], spec: coupling.g1.spec, gear }));
});

async function scaraDuty() {
  const doc = read('scara'), evaluation = await evaluate(doc);
  assert.ok(evaluation.ok);
  const tree = await treeOfDoc(doc, evaluation.bodies, evaluate);
  const actuators = Object.fromEntries(tree.joints.filter(j => ['revolute', 'continuous'].includes(j.type))
    .map(j => [j.key, { motor: MOTORS[0].id, reducer: REDUCERS[0].id }]));
  const input = { moves: [{ from: { 'base~arm1': 0, 'arm2~quill': 0 }, to: { 'base~arm1': 10, 'arm2~quill': -5 },
    profile: 's-curve', joint_limits: { 'base~arm1': { velocity: 60, acceleration: 120, jerk: 240 },
      'arm2~quill': { velocity: 5, acceleration: 10, jerk: 20 } }, dwell: 0.5 }],
    serviceLife: 7200, clearance: 0.25, g: [0, 0, -9810], actuators };
  const duty = readDuty(tree, input);
  assert.ok(!('error' in duty), duty.error);
  return { doc, bodies: evaluation.bodies, tree, input, duty };
}

test('actual mixed SCARA duty round-trips public degrees/mm, limits, seconds and gravity through shared producers', async () => {
  const { tree, input, duty } = await scaraDuty(), before = structuredClone(input);
  // #region duty
  const output = dutyJson(tree, duty);
  assert.deepEqual(output.moves[0].to, { 'base~arm1': 10, 'arm2~quill': -5 }); // degrees, mm
  near(output.moves[0].joint_limits['base~arm1'].velocity, 60);              // degree/s
  near(output.moves[0].joint_limits['arm2~quill'].velocity, 5);              // mm/s
  assert.equal(output.moves[0].dwell, 0.5);                                 // seconds
  assert.equal(output.serviceLife, 7200);                                  // seconds
  assert.equal(output.clearance, 0.25);                                    // mm
  assert.deepEqual(output.g, [0, 0, -9810]);                                // mm/s²
  // #endregion duty
  const replay = readDuty(tree, output);
  assert.ok(!('error' in replay), replay.error);
  for (const key of ['base~arm1', 'arm2~quill']) {
    near(replay.moves[0].to[key], duty.moves[0].to[key]);
    for (const field of ['velocity', 'acceleration', 'jerk']) near(replay.moves[0].joint_limits[key][field], duty.moves[0].joint_limits[key][field]);
  }
  for (const patch of [{ life_h: 2 }, { clearance_mm: 0.25 }]) assert.ok('error' in readDuty(tree, { ...input, ...patch }));
  assert.ok('error' in readDuty(tree, { ...input, moves: [{ ...input.moves[0], dwell_s: 0.5 }] }));
  assert.deepEqual(input, before);
});

test('actual harness margins and consistency use shared public projections before cloning; decisions remain intact', async t => {
  const { doc, bodies, tree, input, duty } = await scaraDuty();
  // #region harness
  const original = await nativeRobotCheckOfDoc(doc, bodies, evaluate, duty);
  const before = JSON.stringify(original);
  const report = harnessJson(tree, original); // project the original before cloning or serializing it
  assert.deepEqual(await canonicalRobotCheckOfDoc(doc, bodies, evaluate, input), report);
  const range = report.margins.find(m => m.check === 'joint range' && m.joint === 'base~arm1' && m.detail === 'to');
  near(range.value, 10);                      // degrees
  near(range.limit, 130);                     // degrees, the sample's upper limit
  assert.equal(range.unit, 'degree');
  // #endregion harness
  const velocity = report.margins.find(m => m.check === 'joint velocity' && m.joint === 'base~arm1');
  near(velocity.limit, 180);
  assert.equal(velocity.unit, 'degree/s');
  const effort = report.margins.find(m => m.check === 'joint effort' && m.joint === 'base~arm1');
  near(effort.limit, 2000);
  assert.equal(effort.unit, 'N·mm');
  assert.equal(report.ok, original.ok);
  assert.deepEqual(report.least, original.least);
  assert.deepEqual(report.unknowns, original.unknowns);
  for (const [i, margin] of report.margins.entries()) {
    assert.deepEqual([margin.ok, margin.margin, margin.source], [original.margins[i].ok, Number.isFinite(original.margins[i].margin) ? original.margins[i].margin : null, original.margins[i].source]);
  }
  assert.ok(report.consistency.length > 0);
  for (const [i, check] of report.consistency.entries()) {
    assert.equal(check.limitRatio, 1);
    assert.equal(check.ok, original.consistency[i].ok);
    assert.equal('value' in check, false);
    assert.equal('tol' in check, false);
  }
  assert.throws(() => harnessJson(tree, structuredClone(original)), { code: 'HARNESS_RAW_PROVENANCE_UNAVAILABLE' });
  assert.equal(JSON.stringify(original), before);
  t.diagnostic(JSON.stringify({ ok: report.ok, range, velocity, effort, consistency: report.consistency }));
});

test('actual bounded sizer result projects its own tree, duty and report without inventing a successful design', async t => {
  const { doc, bodies, input, duty } = await scaraDuty();
  // #region sized
  const { sized } = await nativeRobotSizeOfDoc(doc, bodies, evaluate, duty, { maxRounds: 0 });
  const output = sizedJson(sized);             // actual producer output, using the same public projectors
  const canonical = await canonicalRobotSizeOfDoc(doc, bodies, evaluate, input, { maxRounds: 0 });
  assert.ok(!('error' in canonical));
  assert.deepEqual(canonical.sized, output);
  assert.equal(output.ok, sized.ok);
  assert.equal(output.rounds, sized.rounds);
  assert.deepEqual(output.trace, sized.trace);
  assert.equal(output.duty.serviceLife, 7200);
  near(output.tree.joints.find(j => j.key === 'base~arm1').limit.velocity, 180);
  near(output.tree.joints.find(j => j.key === 'base~arm1').limit.effort, 2000); // N·mm
  near(output.tree.joints.find(j => j.key === 'arm2~quill').limit.velocity, 100); // mm/s
  near(output.tree.joints.find(j => j.key === 'arm2~quill').limit.effort, 50);    // N
  // #endregion sized
  assert.deepEqual(output.stopped, sized.stopped);
  assert.equal(output.report.ok, sized.report.ok);
  assert.equal(output.rounds, 0);
  t.diagnostic(JSON.stringify({ ok: output.ok, rounds: output.rounds, stopped: output.stopped ?? null }));
});

test('actual four-bar agent replies expose residual and chordResidual in mm with no old aliases', async t => {
  const doc = read('four-bar'), evaluation = await evaluate(doc);
  assert.ok(evaluation.ok);
  const pose = await runRobotTool(doc, evaluation.bodies, 'forward_kinematics', { values: { 'base~crank': 10 } }, evaluate);
  assert.ok(!('error' in pose), pose.error);
  assert.ok(Number.isFinite(pose.content.loops.residual));
  assert.equal('residual_mm' in pose.content.loops, false);
  const motion = doc.robot.motions[0].name;
  const checked = await runRobotTool(doc, evaluation.bodies, 'check_path', { motion }, evaluate);
  assert.ok(!('error' in checked), checked.error);
  assert.ok(checked.content.loops.chords > 0);
  assert.ok(Number.isFinite(checked.content.loops.chordResidual));
  assert.equal('chord_residual_mm' in checked.content.loops, false);
  t.diagnostic(JSON.stringify({ pose: pose.content.loops, motion: checked.content.loops }));
});
