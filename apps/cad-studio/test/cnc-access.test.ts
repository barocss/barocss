import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { processProfile } from '@barocss/cad-model/library/materials';
import { machinability } from '@barocss/cad-model/machining/report';
import { accessOf } from '@barocss/cad-model/machining/access';

// CNC4 (O87): access from ±X, ±Y, ±Z with the tool's side, and greedy setups, against closed forms — a box's faces
// (the first setup the axis whose end and sides see the most, the second its opposite face), a sealed box void's
// surface (planar: its area exact), a side slot open to +X (reached) against the same slot sealed (the mutant), an
// internal groove (its area against 142π, within the chord).

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of [...calls, ['set_material', { material: 'al6061' }] as [string, Record<string, unknown>]]) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const milling = processProfile('cnc-milling')!;
const report = (s: ChatState) => Object.fromEntries(machinability(s.doc, s.bodies, milling).rules.map(x => [x.id, x]));
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

test('CNC4 a box 40 × 30 × 20: every face reached; two setups — +X first (its end on 30 × 20, its sides on the ±Y and ±Z faces: 600 + 1600 + 2400), then −X (600)', async () => {
  const s = await build([cmd('box', { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 })]), a = accessOf(s.bodies);
  assert.ok(near(a.areaMM2, 2 * (40 * 30 + 40 * 20 + 30 * 20)), String(a.areaMM2)); assert.equal(a.unreachedMM2, 0);
  assert.deepEqual(a.setups.map(x => [x.direction, +x.addsMM2.toFixed(6)]), [['+X', 30 * 20 + 2 * 40 * 20 + 2 * 40 * 30], ['−X', 30 * 20]]);
  const r = report(s); assert.deepEqual([r.access.status, r.setups.status, r.setups.value], ['pass', 'pass', 2]);
});

test('CNC4 a sealed void 10 × 10 × 5 inside a block: its whole surface, 400 mm², reached from none of the six — warned, its faces named', async () => {
  const s = await build([cmd('box', { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 10, d: 10, h: 5, x: 15, y: 10, z: 7.5 }), cmd('difference', {}, { bodies: ['b1', 'b3'] })]);
  const a = accessOf(s.bodies);
  assert.ok(near(a.unreachedMM2, 2 * (100 + 50 + 50)), String(a.unreachedMM2));
  assert.ok(a.unreached.every(u => u.face.startsWith('n3.')), JSON.stringify(a.unreached));
  const r = report(s); assert.equal(r.access.status, 'warn'); assert.match(r.access.message, /^400 mm² reached from none of ±X, ±Y, ±Z/);
});

test('CNC4 a side slot 10 deep, 6 high, open to +X: reached (from +X, and its floor and ceiling by side milling); the mutant, the slot stopped 1 mm short of the face — a sealed void, all its 2·(10·20 + 10·6 + 20·6) = 760 mm² hidden', async () => {
  // (Open: the slot box runs past the +X face; sealed: it stops 1 mm inside.)
  const slot = (x: number, w: number) => [cmd('box', { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w, d: 20, h: 6, x, y: 5, z: 7 }), cmd('difference', {}, { bodies: ['b1', 'b3'] })] as [string, Record<string, unknown>][];
  let a = accessOf((await build(slot(30, 15))).bodies);
  assert.equal(a.unreachedMM2, 0, JSON.stringify(a.unreached));
  a = accessOf((await build(slot(29, 10))).bodies);
  assert.ok(near(a.unreachedMM2, 2 * (10 * 20 + 10 * 6 + 20 * 6)), String(a.unreachedMM2));
});

test('CNC4 an internal groove (r 8, 4 high, round a Ø10 bore): its wall and its two annuli hidden — 142π within the chord; the bore itself reached along ±Z', async () => {
  const s = await build([cmd('box', { w: 40, d: 40, h: 30, x: 0, y: 0, z: 0 }), cmd('hole', { d: 10, x: 20, y: 20 }, { faces: ['n1.top'] }), cmd('cylinder', { r: 8, h: 4, x: 20, y: 20, z: 13 }), cmd('difference', {}, { bodies: ['b2', 'b4'] })]);
  const a = accessOf(s.bodies), exact = 64 * Math.PI + 2 * Math.PI * (64 - 25);
  assert.ok(a.unreachedMM2 <= exact + 1e-6 && a.unreachedMM2 >= exact * 0.98, `${a.unreachedMM2} vs ${exact}`);
  assert.ok(!a.unreached.some(u => u.face.startsWith('n2.')), 'the bore is reached');
  const r = report(s); assert.equal(r.access.status, 'warn'); assert.match(r['hole-depth'].why!, /see the access rule \(CNC4\)/);
});
