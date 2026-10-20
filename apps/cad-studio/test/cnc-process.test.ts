import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { withLook } from '../src/app/bodies';
import { MATERIALS_DATA, checkMaterials, processProfile } from '../src/library/materials';
import { printability } from '../src/print/rules';
import { dispatchTool } from '../src/chat/tools';

// CNC1 (O84): machining's process rule — the milling and turning profiles sourced page by page (Hubs, Protolabs, read
// 2026-10-21); the material's family choosing the wall limits (a metal's 0.5 feasible, 0.8 recommended; a plastic's
// 1.0 and 1.5) and naming the general tolerance class (its values not copied); the part against a mill's envelope; the
// later stages said to come; nothing assumed.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const block = (w: number, d: number, h: number): StudioDoc => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] }), { kind: 'extrude', sketch: 0, height: h });
const shelled = (t: number): StudioDoc => withNode(block(60, 40, 25), { kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: t, open: ['n1.top'] });
const machined = (d: StudioDoc, material: string | null, process = 'cnc-milling'): StudioDoc => { const x = { ...d, process }; return material ? withLook(x, bodiesOf(x)[0], { material }) : x; };
const report = async (d: StudioDoc) => { const r = await printability(d, bodiesOf(d), evaluate); return { r, by: Object.fromEntries(r.rules.map(x => [x.id, x])) }; };

test('CNC1 data: the milling and turning profiles, every value with its page; the tolerance classes named for metals and plastics', () => {
  assert.deepEqual(checkMaterials(MATERIALS_DATA), []);
  const mill = processProfile('cnc-milling')!, turn = processProfile('cnc-turning')!;
  assert.deepEqual(['wallMetalMin', 'wallMetalRec', 'wallPlasticMin', 'wallPlasticRec', 'insideRadiusDepthRatio', 'holeDepthRec', 'holeDepthMax', 'maxPartLongMM', 'maxPartWideMM', 'maxPartDepthMM', 'tolMM'].map(k => +mill.thresholds[k].value.toFixed(6)), [0.5, 0.8, 1, 1.5, 0.333333, 4, 6, 400, 250, 150, 0.125]);
  assert.deepEqual(['maxDiameterMM', 'maxLengthMM', 'minDiameterMM', 'grooveWidthMinMM', 'tolMM'].map(k => turn.thresholds[k].value), [500, 1000, 0.76, 1.2, 0.13]);
  for (const p of [mill, turn]) for (const [k, v] of Object.entries(p.thresholds)) assert.ok(v.source === 'W-WEB' && v.page && /^https:\/\/www\.(hubs|protolabs)\.com\//.test(v.page.url) && v.page.read === '2026-10-21', `${p.id}.${k}`);
  assert.deepEqual([mill.toleranceClasses!.metal, mill.toleranceClasses!.plastic], ['ISO 2768-1 f', 'ISO 2768-1 m']);
  assert.match(mill.toleranceClasses!.page.note!, /not copied/);
});

test('CNC1 an aluminium block 100 × 60 × 20, milled: a metal, its walls and size pass; ±0.125 mm general, ISO 2768-1 f named; holes, corners, access and the drawing said to come (CNC2–CNC5)', async () => {
  const { r, by } = await report(machined(block(100, 60, 20), 'al6061'));
  assert.equal(r.process, 'cnc-milling');
  assert.deepEqual([by.material.status, by.wall.status, by.size.status], ['pass', 'pass', 'pass']);
  assert.equal(by.size.value, Math.max(100 / 400, 60 / 250, 20 / 150));
  for (const [id, stage] of [['holes', 'CNC2'], ['corners', 'CNC3'], ['access', 'CNC4'], ['drawing', 'CNC5']]) { assert.equal(by[id].status, 'unknown'); assert.match(by[id].why!, new RegExp(stage)); }
  assert.deepEqual([r.machining!.family, r.machining!.tolerance.mm, r.machining!.toleranceClass!.name], ['metal', 0.125, 'ISO 2768-1 f']);
});

test('CNC1 walls by family: a metal box 0.6 thick warned (under 0.8), 0.4 failed (under 0.5); in ABS 1.2 warned (under 1.5), 0.9 failed (under 1.0), and ISO 2768-1 m named', async () => {
  for (const [t, material, status, limit] of [[0.6, 'al6061', 'warn', 0.8], [0.4, 'al6061', 'fail', 0.5], [1.2, 'abs', 'warn', 1.5], [0.9, 'abs', 'fail', 1], [2, 'abs', 'pass', 1.5]] as const) {
    const { r, by } = await report(machined(shelled(t), material));
    assert.equal(by.wall.status, status, `${t} in ${material}`); assert.equal(by.wall.limit, limit);
    if (material === 'abs') assert.equal(r.machining!.toleranceClass!.name, 'ISO 2768-1 m');
  }
});

test('CNC1 nothing assumed: no material — material and walls unknown, no class; 450 mm long — off a typical mill; turned — its size and own rules said to come (CNC6); no process — none assumed', async () => {
  let { r, by } = await report(machined(block(100, 60, 20), null));
  assert.equal(by.material.status, 'unknown'); assert.equal(by.wall.status, 'unknown'); assert.equal(r.machining!.toleranceClass, null);
  ({ by } = await report(machined(block(450, 60, 20), 'al6061'))); assert.equal(by.size.status, 'fail');
  ({ by } = await report(machined(block(100, 60, 20), 'al6061', 'cnc-turning')));
  assert.equal(by.size.status, 'unknown'); assert.match(by.turning.why!, /CNC6/);
  ({ r } = await report(block(100, 60, 20))); assert.equal(r.process, null);
});

test('CNC1 through the agent\'s tools: the brief states CNC milling in aluminium — it becomes the part\'s process; check_printability judges by it', async () => {
  let s = { doc: block(100, 60, 20), bodies: bodiesOf(block(100, 60, 20)), turns: ['an aluminium bracket, CNC milled'] } as never as Parameters<typeof dispatchTool>[0];
  const b = await dispatchTool(s, 'set_brief', { fields: { purpose: { value: 'a bracket', basis: 'stated', source: 'bracket' }, process: { value: 'cnc-milling', basis: 'stated', source: 'CNC milled' }, material: { value: 'al6061', basis: 'stated', source: 'aluminium' } } }, evaluate);
  assert.ok(!b.isError, b.content); s = b.state;
  assert.equal(s.doc.process, 'cnc-milling');
  const out = JSON.parse((await dispatchTool(s, 'check_printability', {}, evaluate)).content);
  assert.equal(out.process, 'cnc-milling'); assert.equal(out.machining.family, 'metal');
});
