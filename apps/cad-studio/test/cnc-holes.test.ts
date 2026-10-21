import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { processProfile, type ProcessProfile } from '@barocss/cad-model/library/materials';
import { machinability } from '../src/machining/report';
import { holesOf, onDrillTable, tappedHoles } from '../src/machining/holes';

// CNC2 (O85): holes and threads against closed forms — depths and diameters as built (the oracle is the construction,
// not the geometry read back), an enumerated drill table against the step rule, tapped holes against the fastener
// table's tap drill (d − P) — machinability, which `check_printability` dispatches to for milling — and mutants: a bore off its tap drill, the profile's limits moved.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][], material = 'al6061'): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of [...calls, ['set_material', { material }] as [string, Record<string, unknown>]]) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return { ...s, doc: { ...s.doc, process: 'cnc-milling' } };
}
const milling = processProfile('cnc-milling')!;
const report = (s: ChatState, profile: ProcessProfile = milling) => machinability(s.doc, s.bodies, profile);
const rule = (r: ReturnType<typeof report>, id: string) => r.rules.find(x => x.id === id)!;
const block = (h = 40) => cmd('box', { w: 40, d: 30, h, x: 0, y: 0, z: 0 });
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9;

test('CNC2 hole depth: blind Ø5 drilled 20, 30 and 32 deep — 4, 6 and 6.4 × its diameter: pass, warned (over 4), failed (over 6); the limit moved, the verdict moves', async () => {
  const at = async (depth: number) => build([block(), cmd('hole', { type: 'blind', d: 5, depth, x: 20, y: 15 }, { faces: ['n1.top'] })]);
  for (const [depth, status] of [[20, 'pass'], [30, 'warn'], [32, 'fail']] as const) {
    const s = await at(depth), [h] = holesOf(s.bodies), r = rule(report(s), 'hole-depth');
    assert.deepEqual(h.open, [false, true], 'blind: open at the top only');
    assert.ok(near(h.steps[0].diameterMM, 5) && Math.abs(h.steps[0].reachMM! - depth) <= 1e-9, JSON.stringify(h.steps));
    assert.equal(r.status, status, r.message); assert.ok(Math.abs(r.value! - depth / 5) <= 1e-3, String(r.value));
  }
  // (Mutant: the profile's maximum moved to 7 — 6.4 is now warned, not failed; the recommended to 7 too — passed.)
  const s = await at(32), T = milling.thresholds, moved = (o: Record<string, number>): ProcessProfile => ({ ...milling, thresholds: { ...T, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...T[k], value: v }])) } });
  assert.equal(rule(report(s, moved({ holeDepthMax: 7 })), 'hole-depth').status, 'warn');
  assert.equal(rule(report(s, moved({ holeDepthMax: 7, holeDepthRec: 7 })), 'hole-depth').status, 'pass');
});

test('CNC2 a through hole counterbored: Ø6.6 through 20 with Ø11 × 6 at the top — open both ends; the Ø11 step reached from the top (6), the Ø6.6 from the bottom (14); counterbored, both pass', async () => {
  const s = await build([block(20), cmd('hole', { type: 'counterbore', d: 6.6, cd: 11, ch: 6, x: 20, y: 15 }, { faces: ['n1.top'] })]);
  const hs = holesOf(s.bodies); assert.equal(hs.length, 1); const [h] = hs;
  assert.deepEqual(h.open, [true, true]); assert.equal(h.counterbore, true);
  assert.deepEqual(h.steps.map(x => [+x.diameterMM.toFixed(9), +x.reachMM!.toFixed(9)]), [[6.6, 14], [11, 6]]);
  const r = report(s);
  assert.equal(rule(r, 'hole-depth').status, 'pass'); assert.ok(Math.abs(rule(r, 'hole-depth').value! - 14 / 6.6) <= 1e-3);
  assert.equal(rule(r, 'hole-size').status, 'pass'); assert.match(rule(r, 'hole-size').message, /1 counterbored/);
});

test('CNC2 the drill table: its step rule against the sizes enumerated (0.35–2.75 by 0.05, 2.8–10 by 0.1 and the quarters, 10.5–25 by 0.5), every 0.01 from 0.30 to 26', () => {
  const t = (k: string) => milling.thresholds[k].value, sizes = new Set<number>(), key = (v: number) => Math.round(v * 100);
  for (let v = 35; v <= 275; v += 5) sizes.add(v);
  for (let v = 280; v <= 1000; v += 10) sizes.add(v);
  for (let v = 300; v <= 1000; v += 25) sizes.add(v);
  for (let v = 1050; v <= 2500; v += 50) sizes.add(v);
  for (let c = 30; c <= 2600; c++) {
    const d = c / 100, got = onDrillTable(d, t);
    if (d < 0.35 - 1e-9 || d > 25 + 1e-9) assert.equal(got, null, `Ø${d} off the table`);
    else assert.equal(got, sizes.has(key(d)), `Ø${d}`);
  }
});

test('CNC2 hole size: Ø5 and Ø3.25 standard; Ø5.03 warned (5 or 5.1); Ø2 warned (under 2.5); Ø0.4 failed (under 0.5); Ø30 above the table, milled', async () => {
  for (const [d, status, re] of [[5, 'pass', /each a standard drill size/], [3.25, 'pass', /standard/], [5.03, 'warn', /Ø5\.03 not a standard drill size \(5 or 5\.1\)/], [2, 'warn', /Ø2 under the 2\.5 mm/], [0.4, 'fail', /Ø0\.4 under the 0\.5 mm/], [30, 'pass', /above the 25 mm drill table, milled/]] as const) {
    // (Ø0.4 is under the hole command's own least, 0.5: its node's radius set directly.)
    const s = await build([cmd('box', { w: 60, d: 50, h: 20, x: 0, y: 0, z: 0 }), cmd('hole', { type: 'through', d: Math.max(d, 0.5), x: 30, y: 25 }, { faces: ['n1.top'] })]);
    const doc = { ...s.doc, nodes: s.doc.nodes.map(n => n.kind === 'hole' ? { ...n, radius: d / 2 } : n) }, ev = evaluateDoc(doc, 1); assert.ok(ev.ok);
    const r = rule(machinability(doc, ev.bodies, milling), 'hole-size');
    assert.equal(r.status, status, `Ø${d}: ${r.message}`); assert.match(r.message, re);
  }
});

test('CNC2 threads: M6 blind 12 on its tap drill Ø5 passes; through 20 warned (over 3 × d, 18); M3 warned (under M6); M6 drilled Ø5.5 (a mutant: the bore off d − P) failed', async () => {
  const tapped = async (thread: string, tend: string, h = 30) => build([block(h), cmd('hole', { type: 'tapped', thread, tend, depth: 12, x: 20, y: 15 }, { faces: ['n1.top'] })]);
  let s = await tapped('M6', 'blind');
  const [x] = tappedHoles(s.doc, holesOf(s.bodies));
  assert.deepEqual([x.thread, x.tapMM, +x.boreMM!.toFixed(9), +x.lengthMM!.toFixed(9)], ['M6×1', 6 - 1, 5, 12]);
  assert.equal(rule(report(s), 'thread').status, 'pass', rule(report(s), 'thread').message);
  s = await tapped('M6', 'through', 20);
  assert.equal(rule(report(s), 'thread').status, 'warn'); assert.match(rule(report(s), 'thread').message, /20 mm long, over 3 × d \(18 mm\)/);
  s = await tapped('M3', 'blind');
  assert.equal(rule(report(s), 'thread').status, 'warn'); assert.match(rule(report(s), 'thread').message, /under M6/);
  s = await tapped('M6', 'blind');
  const doc = { ...s.doc, nodes: s.doc.nodes.map(n => n.kind === 'hole' ? { ...n, radius: 2.75 } : n) }, ev = evaluateDoc(doc, 1); assert.ok(ev.ok);
  const bad = rule(machinability(doc, ev.bodies, milling), 'thread');
  assert.equal(bad.status, 'fail'); assert.match(bad.message, /drilled Ø5\.5, not its tap drill Ø5 \(d − P\)/);
});

test('CNC2 no straight reach: an internal groove (Ø16 behind the Ø10 bore) and a sealed void — reached from neither end, said to be CNC4\'s access; no holes — passes', async () => {
  let s = await build([cmd('box', { w: 40, d: 40, h: 30, x: 0, y: 0, z: 0 }), cmd('hole', { d: 10, x: 20, y: 20 }, { faces: ['n1.top'] }), cmd('cylinder', { r: 8, h: 4, x: 20, y: 20, z: 13 }), cmd('difference', {}, { bodies: ['b2', 'b4'] })]);
  const [h] = holesOf(s.bodies);
  assert.deepEqual(h.steps.map(x => [+x.diameterMM.toFixed(9), x.reachMM === null ? null : +x.reachMM.toFixed(9)]), [[10, 30], [16, null]]);
  let r = rule(report(s), 'hole-depth'); assert.equal(r.status, 'unknown'); assert.match(r.why!, /CNC4/);
  s = await build([cmd('box', { w: 40, d: 40, h: 30, x: 0, y: 0, z: 0 }), cmd('cylinder', { r: 5, h: 10, x: 20, y: 20, z: 10 }), cmd('difference', {}, { bodies: ['b1', 'b3'] })]);
  assert.deepEqual(holesOf(s.bodies)[0].open, [false, false]);
  r = rule(report(s), 'hole-depth'); assert.equal(r.status, 'unknown'); assert.match(r.message, /1 open at neither end/);
  s = await build([block(20)]); const plain = report(s);
  assert.deepEqual(['hole-depth', 'hole-size', 'thread'].map(id => rule(plain, id).status), ['pass', 'pass', 'pass']);
  assert.ok(!plain.rules.some(x => x.id === 'holes'), 'the CNC1 placeholder is gone for milling');
});
