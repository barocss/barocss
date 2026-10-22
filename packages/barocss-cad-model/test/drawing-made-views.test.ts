import test from 'node:test';
import assert from 'node:assert/strict';
import { brepsFor, evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { editBearingRows } from '../src/engine/bearings';
import { editFitTables } from '../src/engine/fits';
import { editORingRows } from '../src/engine/orings';
import { drawingInputs } from '../src/chat/drawing';
import { issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';

// O174 (A9's F8, the coordinator's decision): a part's drawing is projected from what the part makes — its bought
// elements (the BOM's boughtOf) out of its views and sections, as DFM, print and CAM leave them (O160). The A9 shaft's
// bearing had hidden its Ø25 shoulders (DIM_ON_HIDDEN) and its bore, with the O-ring's circles, counted as holes. And a
// view whose outline is a full circle locates every circle on its centre by that alone (HOLE_NOT_LOCATED had counted a
// shaft's own steps and a cover's bore and gland). After Auto-dimension and one Fix, the shaft and the cover say nothing.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const ROW = { id: '6204', designation: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, DaMaxMM: 42, raMaxMM: 1, source: 'a test row' };
const FITS = { id: 'f', rows: [{ class: 'k5', overMM: 18, upToMM: 30, upperUM: 11, lowerUM: 2, estimate: true }] };
async function build(steps: (s: ChatState, call: (tool: string, args: Record<string, unknown>) => Promise<unknown>) => Promise<ChatState | void>): Promise<ChatState> {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state; return JSON.parse(r.content); };
  const out = await steps(s, call); if (out) s = out;
  return s;
}
const shaft = () => build(async (s0, call) => {
  await call('features', { action: 'command', command: 'shaft', values: {} });
  return undefined;
}).then(async s => {
  let st: ChatState = { ...s, doc: (editFitTables((editBearingRows(s.doc, [ROW]) as { doc: StudioDoc }).doc, [FITS]) as { doc: StudioDoc }).doc };
  for (const [command, values] of [['key', { h: 6 }], ['bearing', { sc: 'k5', step: 3, against: 'start' }]] as const) {
    const r = await dispatchTool(st, 'features', { action: 'command', command, values, bodies: ['b0'] }, evaluate); assert.ok(!r.isError, r.content); st = r.state;
  }
  return st;
});
const settle = async (s: ChatState) => {
  for (const action of ['auto', 'fix']) { const r = await dispatchTool(s, 'drawing', { action }, evaluate); assert.ok(!r.isError, r.content); s = r.state; }
  const r = await dispatchTool(s, 'drawing', { action: 'issues' }, evaluate); return (JSON.parse(r.content) as { issues: { code: string }[] }).issues.map(x => x.code);
};

test('O174: the shaft\'s drawing without its bought key and bearing — none of their edges in its views; after Auto-dimension and Fix, no issue', async () => {
  const s = await shaft(), i = drawingInputs(s.doc); if (typeof i === 'string') throw Error(i);
  for (const v of ['front', 'top', 'right'] as const) assert.deepEqual(i.views[v].edges.filter(e => e.name.split('|').every(f => /^n[12]\./.test(f))).map(e => e.name), [], v);
  assert.deepEqual(await settle(s), []);
  // (The B-reps: the shaft's alone when made; all three for an assembly's drawing, which keeps its bought parts.)
  const made = brepsFor(s.doc, { made: true }), all = brepsFor(s.doc);
  assert.ok(!('error' in made) && !('error' in all)); assert.deepEqual([made.breps.length, all.breps.length], [1, 3]);
});

test('O174: the cover — its Ø22 bore and its gland concentric with its round outline, located by it; the bought O-ring not drawn; no issue', async () => {
  let s = await build(async (_s, call) => { await call('features', { action: 'command', command: 'cylinder', values: { r: 30, h: 8, x: 0, y: 0, z: 0 } }); });
  s = { ...s, doc: (editORingRows(s.doc, [{ id: '214', dash: '2-214', insideDiameterMM: 24.99, crossSectionMM: 3.53, source: 'a test row' }]) as { doc: StudioDoc }).doc };
  for (const args of [{ command: 'oring-gland', values: {}, faces: ['n1.top'] }, { command: 'hole', faces: ['n1.top'], values: { d: 22, x: 0, y: 0 } }]) {
    const r = await dispatchTool(s, 'features', { action: 'command', ...args }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  }
  assert.deepEqual(await settle(s), []);
  // (An off-centre hole is still located by its dimensions: the round outline locates only what is on its centre.)
  const off = await (async () => { const r = await dispatchTool(s, 'features', { action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 4, x: 20, y: 0 } }, evaluate); assert.ok(!r.isError, r.content); return r.state; })();
  const i = drawingInputs(off.doc); if (typeof i === 'string') throw Error(i);
  const r = await dispatchTool(off, 'drawing', { action: 'issues' }, evaluate);
  assert.ok((JSON.parse(r.content) as { issues: { code: string }[] }).issues.some(x => x.code === 'HOLE_NOT_LOCATED'), 'the Ø4 off centre, not yet dimensioned');
});

// O175: a part's sheet with balloons draws its bought elements — each balloon points at its BOM line's item, the key too.
test('O175: the shaft and its bought key on a part sheet with balloons — the key drawn, both balloons on their items\' edges', async () => {
  const s = await build(async (_s, call) => {
    await call('features', { action: 'command', command: 'shaft', values: {} });
    await call('features', { action: 'command', command: 'key', values: {}, bodies: ['b0'] });
  });
  const plain = drawingInputs(s.doc, { ...readDrawing(s.doc.drawing), scope: { kind: 'part' }, sheet: 'A3' });
  const ballooned = drawingInputs(s.doc, { ...readDrawing(s.doc.drawing), scope: { kind: 'part' }, sheet: 'A3', balloons: true, tables: [{ id: 'bom', from: 'bom' }] });
  if (typeof plain === 'string' || typeof ballooned === 'string') throw Error(String(plain) + String(ballooned));
  const keyEdges = (i: typeof plain) => i.views.iso.edges.filter(e => e.name.split('|').some(f => f.startsWith('n1.'))).length;
  assert.equal(keyEdges(plain), 0, 'without balloons the bought key is not drawn');
  assert.ok(keyEdges(ballooned) > 0, 'with balloons it is');
  const b = issueContext({ ...ballooned, meta: { ...ballooned.meta, date: '2026-10-23' } }).sheet.balloons!;
  assert.deepEqual([b.placed.map(p => p.no), b.noEdge], [[1, 2], []]);
});
