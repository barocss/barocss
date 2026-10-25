import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { processProfile } from '../src/library/materials';
import { machinability } from '../src/machining/report';
import { holesOf } from '../src/machining/holes';
import { turningOf } from '../src/machining/turning';

// CNC6 (O89): turning against closed forms — a revolved stepped shaft (Ø20 × 52, a groove 10 wide and 2 deep, a point
// of 2·atan(8/12)), a cylinder with a flat (its 12 × 30 = 360 mm² not turned, planar: exact), holes by their axes,
// a box (no axis), and mutants: a narrower groove (in steel warned, in aluminium not), a sharper point, a part too large.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][], material = 'al6061', start = emptyDoc()): Promise<ChatState> {
  let s = { doc: start, bodies: evaluateDoc(start, 1).ok ? (evaluateDoc(start, 1) as { bodies: ChatState['bodies'] }).bodies : [], turnBase: start } as never as ChatState;
  for (const [tool, args] of [...calls, ['set_material', { material }] as [string, Record<string, unknown>]]) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const turningP = processProfile('cnc-turning')!;
const report = (s: ChatState) => Object.fromEntries(machinability(s.doc, s.bodies, turningP).rules.map(x => [x.id, x]));
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
/** A shaft revolved about Y from a half profile (x the radius, y along the axis). */
const shaft = (pts: [number, number][]) => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: pts }), { kind: 'revolve', sketch: 0, axis: 'y', angle: 360 } as never);
const SHAFT: [number, number][] = [[0, 0], [10, 0], [10, 20], [6, 20], [6, 30], [8, 30], [8, 40], [0, 52]];

test('CNC6 a stepped shaft revolved: its axis Y, every surface turned; Ø20 × 52; a groove 10 wide and 2 deep; the least outside Ø12; a point of 2·atan(8/12) = 67.38° — all pass', async () => {
  const s = await build([], 'al6061', shaft(SHAFT)), tu = turningOf(s.doc, s.bodies, holesOf(s.bodies));
  assert.ok(tu.axis && near(Math.abs(tu.axis.a[1]), 1, 1e-9));
  assert.ok(near(tu.turnedArea, tu.area, 1e-9) && tu.offAxis.length === 0, JSON.stringify(tu.offAxis));
  assert.ok(near(tu.diameter, 20) && near(tu.length, 52), `${tu.diameter} ${tu.length}`);
  assert.deepEqual(tu.grooves.map(g => [+g.width.toFixed(9), +g.depth.toFixed(9)]), [[10, 2]]);
  assert.ok(near(tu.minOuterDiameter!, 12));
  assert.equal(tu.points.length, 1); assert.ok(near(tu.points[0].includedAngle, 2 * Math.atan(8 / 12) * 180 / Math.PI, 1e-4), String(tu.points[0].includedAngle));
  const r = report(s);
  assert.deepEqual(['size', 'turning', 'diameter', 'groove', 'holes', 'point', 'corners'].map(id => r[id].status), ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass']);
  assert.ok(!('access' in r) && !('setups' in r), 'a lathe\'s access is its turning');
});

test('CNC6 mutants on the shaft: a groove 1 wide — in steel warned (under 1.2), in aluminium not (0.5); a point 2·atan(8/40) = 22.6° — warned (under 30°)', async () => {
  const narrow: [number, number][] = [[0, 0], [10, 0], [10, 20], [6, 20], [6, 21], [8, 21], [8, 40], [0, 52]];
  let r = report(await build([], 'steel', shaft(narrow)));
  assert.equal(r.groove.status, 'warn'); assert.match(r.groove.message, /1 mm wide \(under 1\.2\)/);
  r = report(await build([], 'al6061', shaft(narrow))); assert.equal(r.groove.status, 'pass', r.groove.message);
  r = report(await build([], 'al6061', shaft([[0, 0], [10, 0], [10, 20], [6, 20], [6, 30], [8, 30], [8, 40], [0, 80]])));
  assert.equal(r.point.status, 'warn'); assert.match(r.point.message, /22\.6\d*° included, under 30°/);
});

test('CNC6 a cylinder with a flat: its 12 × 30 = 360 mm² not turned (planar, exact) — warned, milled by live tools; a radial hole Ø1.5 in it — in steel warned (under 2), in aluminium not (1); on the axis Ø0.8 — warned (under 1)', async () => {
  const flat = [cmd('cylinder', { r: 10, h: 30, x: 0, y: 0, z: 0 }), cmd('box', { w: 10, d: 30, h: 40, x: 8, y: -15, z: -5 }), cmd('difference', {}, { bodies: ['b1', 'b3'] })] as [string, Record<string, unknown>][];
  let s = await build(flat), tu = turningOf(s.doc, s.bodies, holesOf(s.bodies));
  assert.ok(near(tu.area - tu.turnedArea, 2 * Math.sqrt(100 - 64) * 30, 1e-6), String(tu.area - tu.turnedArea));
  assert.equal(report(s).turning.status, 'warn'); assert.match(report(s).turning.message, /^360 mm² not turned/);
  const radial = [...flat, cmd('hole', { d: 1.5, x: 0, y: 15 }, { faces: [{ normal: [1, 0, 0], pick: 'max' }] })] as [string, Record<string, unknown>][];
  s = await build(radial, 'steel'); tu = turningOf(s.doc, s.bodies, holesOf(s.bodies));
  assert.deepEqual(tu.holes.map(h => [h.kind, +h.diameter.toFixed(9)]), [['radial', 1.5]]);
  assert.equal(report(s).holes.status, 'warn'); assert.match(report(s).holes.message, /a radial hole Ø1\.5 \(under 2\)/);
  assert.equal(report(await build(radial, 'al6061')).holes.status, 'pass');
  s = await build([cmd('cylinder', { r: 10, h: 30, x: 0, y: 0, z: 0 }), cmd('hole', { type: 'blind', d: 0.8, depth: 3, x: 0, y: 0 }, { faces: ['n1.top'] })]);
  assert.equal(report(s).holes.status, 'warn'); assert.match(report(s).holes.message, /an on-axis hole Ø0\.8 \(under 1\)/);
});

test('CNC6 no lathe part: a box has no axis — failed; Ø520 — over the lathe\'s Ø500, failed; Ø3 — under the least part (Ø4.07), warned; an inside groove — warned (ID grooves not supported)', async () => {
  let r = report(await build([cmd('box', { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 })]));
  assert.equal(r.turning.status, 'fail'); assert.match(r.turning.message, /no axis of revolution/); assert.equal(r.size.status, 'unknown');
  r = report(await build([cmd('cylinder', { r: 260, h: 10, x: 0, y: 0, z: 0 })])); assert.equal(r.size.status, 'fail'); assert.match(r.size.message, /^Ø520 × 10/);
  r = report(await build([cmd('cylinder', { r: 1.5, h: 10, x: 0, y: 0, z: 0 })])); assert.equal(r.size.status, 'warn'); assert.match(r.size.message, /under the least part, Ø4\.07/);
  r = report(await build([cmd('cylinder', { r: 20, h: 30, x: 0, y: 0, z: 0 }), cmd('hole', { d: 10, x: 0, y: 0 }, { faces: ['n1.top'] }), cmd('cylinder', { r: 8, h: 4, x: 0, y: 0, z: 13 }), cmd('difference', {}, { bodies: ['b2', 'b4'] })]));
  assert.equal(r.groove.status, 'warn'); assert.match(r.groove.message, /1 inside \(ID grooves not supported\)/);
});
