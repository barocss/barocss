import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { withLook } from '@barocss/cad-model/app/bodies';
import { printability } from '@barocss/cad-model/print/rules';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { processProfile } from '@barocss/cad-model/library/materials';
import { solidification } from '@barocss/cad-model/casting/solidification';

// IM8c (O109): hot spots and feeding, against closed forms — a plate's one hot spot on its mid-plane, r = t/2; IM8 S0's
// L junction (walls t = 4), one hot spot of r = t(2 − √2) on the corner's bisector, isolated from a gate at a leg's end
// (the walls, r = t/2, are thinner: the way is cut) and fed from a gate on the outer corner; a 20 mm block on a 4 mm
// plate, isolated from a gate at the plate's far end and fed from one on the block; Engineers Edge's 2:1 section change
// (a mutant: a feeding floor a cell lower than the hot spot's would feed the L junction from the leg's end, and fails).

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<StudioDoc> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s.doc;
}
const cast = (doc: StudioDoc, gate?: [number, number, number], process = 'sand-casting', material = 'a356'): StudioDoc => {
  const d: StudioDoc = { ...doc, process, mould: { version: 1, pull: [0, 0, 1] }, ...(gate ? { casting: { version: 1, gate } } : {}) };
  return withLook(d, bodiesOf(d)[0], { material });
};
const rules = async (d: StudioDoc) => { const r = await printability(d, bodiesOf(d), evaluate); return Object.fromEntries(r.rules.map(x => [x.id, x])); };
const T = 4, R_L = T * (2 - Math.SQRT2);
const L = () => build([cmd('box', { w: 60, d: 30, h: T, x: 0, y: 0, z: 0 }), cmd('box', { w: T, d: 30, h: 60, x: 0, y: 0, z: 0 }), ['run_command', { command: 'union', values: {}, bodies: ['b1', 'b3'] }]]);
const blockOnPlate = () => build([cmd('box', { w: 100, d: 40, h: 4, x: 0, y: 0, z: 0 }), cmd('box', { w: 20, d: 20, h: 20, x: 0, y: 10, z: 0 }), ['run_command', { command: 'union', values: {}, bodies: ['b1', 'b3'] }]]);

test('IM8c a plate 100 × 60 × 10: one hot spot on its mid-plane, r = 5 (within half a cell), modulus ≈ r (a sheet); fed from a gate on its top; the section 1 : 1', async () => {
  const plate = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [100, 60] }), { kind: 'extrude', sketch: 0, height: 10 });
  const s = solidification(bodiesOf(plate), [50, 30, 10]);
  assert.equal(s.hotSpots.length, 1, JSON.stringify(s.hotSpots));
  const hs = s.hotSpots[0];
  assert.ok(Math.abs(hs.radiusMM - 5) <= s.grid.h / 2 && Math.abs(hs.at[2] - 5) <= s.grid.h && hs.shape === 'sheet' && Math.abs(hs.modulusMM - hs.radiusMM) <= 1e-3, JSON.stringify(hs));
  assert.equal(hs.fed, true);
  const r = await rules(cast(plate, [50, 30, 10]));
  assert.deepEqual([r['hot-spots'].status, r.feeding.status, r['section-change'].status], ['pass', 'pass', 'pass']);
  assert.ok(Math.abs(r['section-change'].value! - 1) <= 0.15, String(r['section-change'].value));
});

test('IM8c the L junction (walls 4): one hot spot r = t(2 − √2) = 2.343 on the bisector, isolated from a gate at a leg\'s end, fed from one on the outer corner; a feeding floor a cell lower (the mutant) would feed it from the leg', async () => {
  const bodies = bodiesOf(await L()), h = 0.4;
  const far = solidification(bodies, [60, 15, T / 2], { h }), near = solidification(bodies, [0, 15, R_L], { h });
  assert.equal(far.hotSpots.length, 1, JSON.stringify(far.hotSpots));
  const hs = far.hotSpots[0];
  assert.ok(Math.abs(hs.radiusMM - R_L) <= h / 2, `r ${hs.radiusMM} vs ${R_L}`);
  assert.ok(Math.abs(hs.at[0] - hs.at[2]) <= h && Math.abs(hs.at[0] - R_L) <= h && Math.abs(hs.at[1] - 15) <= 2, JSON.stringify(hs.at));
  assert.deepEqual([far.hotSpots[0].fed, near.hotSpots[0].fed], [false, true]);
  // (The mutant: the walls' r = 2 is under the junction's 2.343 by less than one cell of 0.4 — a floor of r − h would let
  // the liquid region run down the legs to the far gate. The floor of r − h/4 does not.)
  assert.ok(R_L - h < T / 2 && R_L - h / 4 > T / 2);
});

test('IM8c a 20 mm block on a 4 mm plate: one hot spot in the block (r ≈ 10) — gated at the plate\'s far end, [SHRINK_POROSITY] warned with where; gated on the block, fed; the section 20 : 4 past Engineers Edge\'s 2 : 1, warned', async () => {
  const doc = await blockOnPlate();
  const far = await rules(cast(doc, [95, 20, 4])), on = await rules(cast(doc, [10, 20, 20]));
  assert.equal(far.feeding.status, 'warn'); assert.match(far.feeding.message, /\[SHRINK_POROSITY\] 1 hot spot not fed from the gate/);
  assert.match(far['hot-spots'].message, /^1 hot spot/);
  assert.ok(Math.abs(far['hot-spots'].value! - 10) <= 0.6, String(far['hot-spots'].value));
  assert.equal(on.feeding.status, 'pass');
  assert.equal(far['section-change'].status, 'warn'); assert.ok(far['section-change'].value! >= 4, String(far['section-change'].value));
  assert.equal(far['section-change'].limit, 2); assert.match(far['section-change'].source!, /engineersedge\.com\/sand_cast\.htm/);
  assert.equal(processProfile('sand-casting')!.thresholds.sectionRatioMax.page!.label, 'If a section change of over 2:1 thickness ratio is unavoidable … use a wedge form between the unequal sections.');
});

test('IM8c the unknowns, said: no gate — feeding unknown; die casting — no section-change ratio read; set_casting\'s gate refused unless a point, set through the v2 action', async () => {
  const doc = await blockOnPlate();
  const none = await rules(cast(doc));
  assert.equal(none.feeding.status, 'unknown'); assert.match(none.feeding.why!, /no gate is set \(set_casting gate/);
  const die = await rules(cast(doc, [10, 20, 20], 'die-casting', 'a380'));
  assert.equal(die['section-change'].status, 'unknown'); assert.match(die['section-change'].why!, /no die casting section-change ratio/);
  const s = { doc, bodies: bodiesOf(doc) } as never as ChatState;
  for (const gate of [[1, 2], [1, 2, 'x'], 'top']) { const r = await dispatchTool(s, 'set_casting', { gate }, evaluate); assert.ok(r.isError); assert.match(JSON.parse(r.content).error, /\[CASTING_GATE\]/); }
  const set = await dispatchTool(s, 'features', { action: 'casting', gate: [10, 20, 20] }, evaluate);
  assert.ok(!set.isError, set.content); assert.deepEqual(set.state.doc.casting, { version: 1, gate: [10, 20, 20] });
});

test('IM8c the modulus from the hot spot\'s shape (O110): a plate 2r thick is a sheet, V/A ≈ r (the S0 plate 100 × 100 × 10: 4.17 against r = 5); a long round bar a line, ≈ r/2; a cube in a plate a point, ≈ r/3; always within [r/3, r], an estimate', async () => {
  const ext = (sketch: Record<string, unknown>, h: number) => withNode(withNode(emptyDoc(), sketch as never), { kind: 'extrude', sketch: 0, height: h });
  const plate = solidification(bodiesOf(ext({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [100, 100] }, 10)), null).hotSpots[0];
  assert.equal(plate.shape, 'sheet'); assert.equal(plate.modulusMM, plate.radiusMM);
  assert.ok(Math.abs(plate.modulusMM - 100000 / 24000) <= 1, `${plate.modulusMM} against the plate's exact V/A 4.17`);
  const bar = solidification(bodiesOf(ext({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, 200)), null).hotSpots[0];
  assert.equal(bar.shape, 'line'); assert.ok(Math.abs(bar.modulusMM - bar.radiusMM / 2) <= 1e-3 && Math.abs(bar.radiusMM - 10) <= 1, JSON.stringify(bar));
  const cube = solidification(bodiesOf(await blockOnPlate()), null).hotSpots[0];
  assert.equal(cube.shape, 'point'); assert.ok(Math.abs(cube.modulusMM - cube.radiusMM / 3) <= 1e-3, JSON.stringify(cube));
  for (const hs of [plate, bar, cube]) assert.ok(hs.modulusRangeMM[0] <= hs.modulusMM + 1e-9 && hs.modulusMM <= hs.modulusRangeMM[1] + 1e-9 && Math.abs(hs.modulusRangeMM[0] - hs.radiusMM / 3) <= 1e-3);
  const L1 = solidification(bodiesOf(await L()), null, { h: 0.4 }).hotSpots[0]; assert.equal(L1.shape, 'line', 'the L junction runs along its corner');
});
