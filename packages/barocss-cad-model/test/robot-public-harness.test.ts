import test from 'node:test';
import assert from 'node:assert/strict';
import type { JointTree } from '../src/robot/joints';
import type { LinkBody } from '../src/robot/dynamics';
import { checkDesign, marginQuantitiesOf, type Consistency, type Duty } from '../src/robot/harness';
import { harnessJson, sizedJson } from '../src/robot/reports';
import { MOTORS, REDUCERS } from '../src/robot/actuators';
import type { SweepLink } from '../src/robot/sweep';

const q = .12345678949, lower = -.98765432149, torque = .23456789149;
const tree: JointTree = { version: 1, base: 'base', links: [{ id: 'base', name: 'base', part: 'base' }, { id: 'arm', name: 'arm', part: 'arm' }], joints: [
  { key: 'turn', type: 'revolute', parent: 'base', child: 'arm', origin: [0, 0, 0], axis: [0, 0, 1], mates: [], limit: { lower, upper: 3, velocity: 2, effort: 1 } },
], loops: [], couplings: [], problems: [], notes: [] };
const bodies = new Map<string, LinkBody>([['arm', { massKg: .07, com: [0, 0, 0], I: [1e-6, 0, 0, 0, 1e-6, 0, 0, 0, 1e-6] }]]);
const motor = MOTORS[0], reducer = { ...REDUCERS[0], repeatedPeakTorque: { ...REDUCERS[0].repeatedPeakTorque, v: torque, unit: 'N·m' } };
const catalogue = { motors: [motor], reducers: [reducer] };
const duty: Duty = { moves: [{ from: { turn: q }, to: { turn: 1 }, profile: 'trapezoid', limits: { velocity: q, acceleration: 1 }, dwell_s: .5 }], actuators: { turn: { motor: motor.id, reducer: reducer.id } }, g: [0, 0, 0] };
const r9 = (x: number) => Math.round(x * 1e9) / 1e9 + 0;
const report = () => checkDesign(tree, bodies, null, duty, catalogue);

test('range, atMost and actuator raw quantities convert before r9; the full core report and catalogue are unchanged', () => {
  const core = report(), before = JSON.stringify(core), source = JSON.stringify(catalogue), out = harnessJson(tree, core);
  const range = out.margins.find(m => m.check === 'joint range' && m.detail === 'from')!;
  assert.equal(range.value, r9(q * 180 / Math.PI)); assert.equal(range.limit, r9(lower * 180 / Math.PI)); assert.equal(range.unit, 'degree');
  assert.notEqual(range.value, r9(r9(q) * 180 / Math.PI));
  const velocity = out.margins.find(m => m.check === 'joint velocity')!;
  assert.equal(velocity.value, r9(q * 180 / Math.PI)); assert.equal(velocity.unit, 'degree/s');
  const actuator = out.margins.find(m => m.check === 'reducer repeated peak torque')!;
  assert.equal(actuator.limit, r9(torque * 1000)); assert.notEqual(actuator.limit, r9(r9(torque) * 1000)); assert.equal(actuator.unit, 'N·mm');
  for (let i = 0; i < core.margins.length; i++) assert.deepEqual([out.margins[i].ok, out.margins[i].margin, out.margins[i].source], [core.margins[i].ok, core.margins[i].margin, core.margins[i].source]);
  assert.equal(out.ok, core.ok); assert.deepEqual(out.least, core.least); assert.deepEqual(out.unknowns, core.unknowns);
  assert.equal(JSON.stringify(core), before); assert.equal(JSON.stringify(report()), before); assert.equal(JSON.stringify(catalogue), source);
});

function box(link: string, x: number): SweepLink {
  const p = new Float64Array([x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0, x, 0, 1, x + 1, 0, 1, x + 1, 1, 1, x, 1, 1]);
  return { link, positions: p, hull: p, indices: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]) };
}
test('sweep stores the independent unrounded clearance limit and keeps mm unchanged', () => {
  const sweepTree: JointTree = { ...tree, links: [...tree.links, { id: 'obstacle', name: 'obstacle', part: 'obstacle' }], joints: [...tree.joints, { key: 'fixed', type: 'fixed', parent: 'base', child: 'obstacle', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] }] };
  const links = [box('obstacle', 0), box('arm', 3)];
  const core = checkDesign(sweepTree, bodies, links, { moves: [{ from: {}, to: { turn: 1e-4 }, profile: 'trapezoid', limits: { velocity: q, acceleration: 1 } }], clearance_mm: q, g: [0, 0, 0] }, catalogue);
  const margin = core.margins.find(m => m.check === 'sweep')!; assert.ok(margin);
  const raw = marginQuantitiesOf(margin)!; assert.ok(Number.isFinite(raw.value)); assert.equal(raw.limit, q); assert.notEqual(raw.limit, margin.limit);
  const out = harnessJson(tree, core).margins.find(m => m.check === 'sweep')!;
  assert.equal(out.limit, r9(q)); assert.equal(out.unit, 'mm'); assert.equal(out.value, r9(raw.value));
  const skipped = checkDesign(tree, bodies, [box('base', 0), box('arm', 3)], { moves: [{ from: {}, to: {}, profile: 'trapezoid' }], clearance_mm: q }, catalogue);
  assert.equal(harnessJson(tree, skipped).margins.find(m => m.check === 'sweep')!.value, null, 'an unmeasured infinite clearance is not replaced with a finite number');
});

test('consistency ratios preserve original decisions and explicitly handle zero limits, non-finite values and overflow', () => {
  const base = report(), cases: Consistency[] = [[2, 4], [0, 0], [1, 0], [Infinity, 2], [1e308, 1e-308]].map(([value, tol], i) => ({ check: `c${i}`, move: 0, at: 'from', ok: i % 2 === 0, value, tol }));
  const out = harnessJson(tree, { ...base, consistency: cases });
  assert.deepEqual(out.consistency.map(c => [c.errorRatio, c.limitRatio, c.reason ?? null, c.ok]), [[.5, 1, null, true], [0, 1, null, false], [null, 1, 'zero-limit', true], [null, 1, 'non-finite-ratio', false], [null, 1, 'non-finite-ratio', true]]);
  assert.ok(out.consistency.every(c => !('value' in c) && !('tol' in c)));
});

test('cloned, serialized or edited margins refuse with a typed provenance boundary; sized uses the same projector', () => {
  const core = report();
  for (const copy of [structuredClone(core), JSON.parse(JSON.stringify(core))]) assert.throws(() => harnessJson(tree, copy), { code: 'HARNESS_RAW_PROVENANCE_UNAVAILABLE' });
  const changed = report(); changed.margins[0].value += 1; assert.throws(() => harnessJson(tree, changed), { code: 'HARNESS_RAW_PROVENANCE_UNAVAILABLE' });
  const sized = { ok: core.ok, rounds: 0, trace: [], tree, duty, report: core }, before = JSON.stringify(sized);
  const out = sizedJson(sized); assert.deepEqual(out.report, harnessJson(tree, core)); assert.ok('joint_limits' in out.duty.moves[0]); assert.equal(out.tree.joints[0].limit!.effort, 1000); assert.equal(JSON.stringify(sized), before);
});
