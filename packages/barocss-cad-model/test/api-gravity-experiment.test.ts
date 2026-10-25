// Source-only regression cases for a prescribed static pose. No free-motion or measured-validation claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BarocssError, Robot } from '../src/api';
import { GravityExperiment } from '../src/api/experiment';
import type { GravityExperimentOptions } from '../src/api/experimentInput';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { treeOf } from '../src/api/robotCore';

const KEY = 'base~rod';
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} vs ${expected}`);
const code = (expected: string) => (error: unknown) => error instanceof BarocssError && error.code === expected;
const options = (angle = 0, gravity: [number, number, number] = [0, 0, -9806.65]): GravityExperimentOptions => ({ values: { [KEY]: angle }, gravity });

/** Pure 100 x 10 x 10 mm rod: no holes, fit allowances or inferred density in the independent answer. */
function rodDoc(): StudioDoc {
  const rod: StudioDoc = { ...emptyDoc(), nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, -5], max: [100, 5] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [0, 0, -5] },
  ], bodies: { b1: { material: 'al6061' } } };
  // Origin planes are real existing references. Their connectors constrain a Y axis through world zero;
  // the coincident plane removes the axial slide, leaving only the existing continuous hinge.
  return { ...emptyDoc(), instances: [{ id: 'rod', name: 'Rod', doc: rod, position: [0, 0, 0], rotation: [0, 0, 0] }],
    mates: [
      { id: 'axis', kind: 'concentric', a: { part: 'base', face: 'origin:xz', at: {} }, b: { part: 'rod', face: 'origin:xz', at: {} } },
      { id: 'seat', kind: 'coincident', a: { part: 'base', face: 'origin:xz' }, b: { part: 'rod', face: 'origin:xz' } },
    ], robot: { version: 1, base: 'base' } };
}

test('gravity experiment: a material-assigned cuboid rod matches the independent static holding torque and existing replies', () => {
  const doc = rodDoc(), robot = new Robot(doc), tree = treeOf(doc), before = structuredClone(doc);
  assert.deepEqual(tree.problems, []); assert.deepEqual(tree.loops, []); assert.equal(tree.joints.length, 1);
  const joint = tree.joints[0];
  assert.equal(joint.key, KEY); assert.equal(joint.type, 'continuous');
  joint.axis.forEach((value, i) => near(value, [0, 1, 0][i])); joint.origin.forEach(value => near(value, 0));
  // Catalogue fixture density is explicitly chosen: 2.7 g/cm3; it is not measured-material evidence.
  // m = 100*10*10*2.7/1000 = 27 g. About +Y, +q turns +X toward -Z.
  // Holding torque = -0.027 kg * 9.80665 m/s2 * 50 mm * cos(q), in N mm.
  for (const angle of [0, 60, 90, 180]) {
    const input = options(angle), experiment = robot.gravityExperiment(input), report = experiment.report;
    assert.equal(report.profile, 'static-gravity-v1');
    assert.deepEqual(report.units, { angle: 'degree', length: 'mm', mass: 'g', inertia: 'g·mm²', gravity: 'mm/s²', torque: 'N·mm' });
    assert.deepEqual(report.inertia, robot.inertia());
    assert.deepEqual(report.result, robot.gravity(input.values, input.gravity));
    const moving = report.inertia.links.find(link => link.link === 'rod')!;
    assert.ok(moving); near(moving.mass, 27); assert.deepEqual(moving.issues, []);
    assert.ok(moving.bodies.every(body => !body.assumed));
    near(report.result.torques[KEY], -0.027 * 9.80665 * 50 * Math.cos(angle * Math.PI / 180));
    near(report.result.generalized[KEY], report.result.torques[KEY]);
    assert.equal(report.result.units[KEY], 'N·mm'); assert.equal(report.result.notReady, undefined);
    assert.equal(experiment.matches(doc, input), true);
    assert.equal(Object.hasOwn(report, 'pass'), false); assert.equal(Object.hasOwn(report, 'measuredValidation'), false);
  }
  assert.deepEqual(doc, before, 'neither the facade nor experiment rewrites the authored source');
});

test('gravity experiment: explicit gravity magnitude and direction are preserved without a hidden default or second conversion', () => {
  const robot = new Robot(rodDoc());
  for (const [gravity, expected] of [
    [[0, 0, -9810], -0.027 * 9.81 * 50],
    [[0, 0, 9810], 0.027 * 9.81 * 50],
    [[9810, 0, 0], 0],
    [[0, 0, 0], 0],
  ] as const) {
    const input = options(0, [...gravity]), report = robot.gravityExperiment(input).report;
    assert.deepEqual(report.inputs.gravity, gravity);
    assert.deepEqual(report.result, robot.gravity(input.values, input.gravity));
    near(report.result.torques[KEY], expected);
  }
});

test('gravity experiment: full document binding detects geometry, material, mates, placement and robot changes', () => {
  const doc = rodDoc(), input = options(), experiment = new Robot(doc).gravityExperiment(input);
  const changes: [string, (copy: StudioDoc) => void][] = [
    ['geometry', copy => { copy.instances![0].doc.nodes.push({ id: 'n3', kind: 'translate', parent: { node: 2, side: 'solid' }, offset: [1, 0, 0] }); }],
    ['material', copy => { copy.instances![0].doc.bodies!.b1.material = 'unknown-fixture-material'; }],
    ['mate', copy => { copy.mates![0].a.face = 'origin:xy'; }],
    ['placement', copy => { copy.instances![0].position[0] = 1; }],
    ['joint settings', copy => { copy.robot!.joints = { [KEY]: { lower: -30, upper: 30 } }; }],
    ['robot frame', copy => { copy.robot!.frames = { tip: { link: 'rod', position: [100, 0, 0] } }; }],
  ];
  for (const [label, mutate] of changes) {
    const copy = structuredClone(doc); mutate(copy);
    assert.equal(experiment.matches(copy, input), false, label);
  }
  // Object key insertion order alone does not change the document or explicit-input meaning.
  const reordered = { ...doc, robot: { base: 'base', version: 1 as const } };
  assert.equal(experiment.matches(reordered, { gravity: [0, 0, -9806.65], values: { [KEY]: 0 } }), true);
});

test('gravity experiment: a changed angle or equal-magnitude gravity direction makes the result stale', () => {
  const doc = rodDoc(), experiment = new Robot(doc).gravityExperiment(options());
  assert.equal(experiment.matches(doc, options(1)), false);
  assert.equal(experiment.matches(doc, options(0, [9806.65, 0, 0])), false);
  assert.equal(experiment.matches(doc, options(0, [0, 0, 9806.65])), false);
  assert.equal(experiment.matches(doc, options(0, [0, 0, -9810])), false);
});

test('gravity experiment: constructor inputs and every report are detached snapshots', () => {
  const doc = rodDoc(), input = { values: { [KEY]: 0 }, gravity: [0, 0, -9806.65] as [number, number, number] };
  const savedDoc = structuredClone(doc), savedInput = structuredClone(input), experiment = new GravityExperiment(doc, input), before = experiment.report;
  doc.instances![0].position[0] = 123; input.values[KEY] = 45; input.gravity[2] = 9810;
  const copy = experiment.report;
  copy.inputs.values[KEY] = 88; copy.inputs.gravity[2] = 12; copy.binding.document = 'changed';
  copy.result.torques[KEY] = 999; copy.inertia.links[0].centroid[0] = 999; copy.assumptions.push('changed');
  assert.deepEqual(experiment.report, before);
  assert.equal(experiment.matches(savedDoc, savedInput), true);
  assert.equal(experiment.matches(doc, savedInput), false);
  assert.equal(experiment.matches(savedDoc, input), false);
});

test('gravity experiment: malformed and missing explicit options have typed VALUE refusals on creation and matching', () => {
  const robot = new Robot(rodDoc()), experiment = robot.gravityExperiment(options());
  const sparse = Object.assign(Array(3), { 0: 0, 2: -9806.65 });
  const invalid: unknown[] = [null, undefined, [], {}, { values: { [KEY]: 0 } }, { gravity: [0, 0, -9806.65] },
    { values: {}, gravity: [0, 0, -9806.65] }, { values: { [KEY]: 0, extra: 1 }, gravity: [0, 0, -9806.65] },
    { values: { [KEY]: NaN }, gravity: [0, 0, -9806.65] }, { values: { [KEY]: Infinity }, gravity: [0, 0, -9806.65] },
    { values: { [KEY]: '0' }, gravity: [0, 0, -9806.65] }, { values: [], gravity: [0, 0, -9806.65] },
    ...[null, [], [0, 0], [0, 0, 0, 0], sparse, [NaN, 0, 0], [0, Infinity, 0], [0, 0, '0']].map(gravity => ({ values: { [KEY]: 0 }, gravity })),
    Object.create({ values: { [KEY]: 0 }, gravity: [0, 0, -9806.65] }),
  ];
  const before = robot.doc;
  for (const value of invalid) {
    assert.throws(() => Reflect.apply(robot.gravityExperiment, robot, [value]), code('VALUE'));
    assert.throws(() => Reflect.apply(experiment.matches, experiment, [before, value]), code('VALUE'));
  }
  assert.deepEqual(robot.doc, before);
  assert.throws(() => robot.gravityExperiment({ values: { unknown: 0 }, gravity: [0, 0, -9806.65] }), code('ROBOT'));
});

test('gravity experiment: joint limits and unsupported loops, coupled, multi-joint, sliding or disconnected mechanisms are refused', () => {
  const limited = rodDoc(); limited.robot!.joints = { [KEY]: { lower: -30, upper: 30 } };
  assert.throws(() => new Robot(limited).gravityExperiment(options(31)), code('ROBOT'));
  for (const name of ['four-bar', 'gripper', 'scara']) {
    const doc = JSON.parse(readFileSync(join(import.meta.dirname, `../samples/robots/${name}.bcad`), 'utf8')) as StudioDoc;
    assert.throws(() => new Robot(doc).gravityExperiment(options()), code('ROBOT'), name);
  }
  const sliding = rodDoc();
  sliding.mates![1] = { id: 'orientation', kind: 'angle', angle: 0, flip: true,
    a: { part: 'base', face: 'origin:xy' }, b: { part: 'rod', face: 'origin:xy' } };
  assert.ok(treeOf(sliding).joints.some(joint => joint.type === 'prismatic'), 'a real sliding tree, not a fabricated joint type');
  assert.throws(() => new Robot(sliding).gravityExperiment(options()), code('ROBOT'));
  const disconnected = rodDoc();
  disconnected.instances!.push({ ...structuredClone(disconnected.instances![0]), id: 'unconnected', name: 'Unconnected' });
  assert.throws(() => new Robot(disconnected).gravityExperiment(options()), code('ROBOT'));
});

test('gravity experiment: missing, assumed or unknown material and an empty moving body never produce a completed report', () => {
  for (const material of [undefined, 'unregistered-material-id']) {
    const doc = rodDoc(); doc.instances![0].doc.bodies = material ? { b1: { material } } : {};
    const robot = new Robot(doc), before = robot.doc;
    const ordinary = robot.inertia().links.find(link => link.link === 'rod')!;
    if (material === undefined) assert.ok(ordinary.issues.some(issue => issue.code === 'MATERIAL_ASSUMED'));
    else assert.ok(ordinary.bodies.every(body => !body.assumed), 'an explicit unknown ID can bypass the ordinary assumed flag; it must still be refused here');
    assert.throws(() => robot.gravityExperiment(options()), code('ROBOT'));
    assert.deepEqual(robot.doc, before);
  }
  const noMass = rodDoc(); noMass.instances![0].doc = emptyDoc();
  assert.throws(() => new Robot(noMass).gravityExperiment(options()), code('ROBOT'));
});

test('gravity experiment: finite gravity components whose public magnitude overflows cannot complete even for a centred rod', () => {
  const doc = rodDoc(), node = doc.instances![0].doc.nodes[2];
  assert.equal(node.kind, 'translate');
  if (node.kind !== 'translate') assert.fail('the authored rod translation must remain explicit');
  node.offset = [-50, 0, -5]; // COM at the hinge: the independent static lever arm is zero.
  const robot = new Robot(doc), moving = robot.inertia().links.find(link => link.link === 'rod')!;
  moving.centroid.forEach(value => near(value, 0));
  near(robot.gravity({ [KEY]: 0 }, [0, 0, -9806.65]).torques[KEY], 0);
  const gravity: [number, number, number] = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
  assert.ok(gravity.every(Number.isFinite));
  // The existing public reply's norm is a separate field from torque. Finite input components alone cannot certify it.
  assert.equal(robot.gravity({ [KEY]: 0 }, gravity).gravity, Infinity);
  assert.throws(() => robot.gravityExperiment(options(0, gravity)), code('ROBOT'));
});
