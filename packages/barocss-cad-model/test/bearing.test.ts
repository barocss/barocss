import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, usesOf, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluatedPart } from '../src/engine/wireDoc';
import { commands, type Ctx } from '../src/app/commands';
import { editBearingRows } from '../src/engine/bearings';
import { editFitTables } from '../src/engine/fits';
import { deleteFeature } from '../src/chat/features';
import { runTool, type ChatState } from '../src/chat/tools';

// R12c.4 (D158) in the studio: the user's bearing rows (none built in), a bearing on the default shaft's Ø20 step 1
// against the Ø25 shoulder at its end, in a housing, its seats' classes from the user's fit tables. The row is a test row
// (D139 B1's 6204 values); the oracle is the kernel test's: Pappus on the rounded section (19800.6522 mm³).

const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const ROW = { id: '6204', designation: '6204', bore: 20, outside: 47, width: 14, chamfer: 1, daMin: 25, daMax: 26.5, DaMax: 42, raMax: 1, boreDeviationUM: [0, -10] as [number, number], source: 'B1 (D139)' };
const FITS = { id: 'seat-fits', rows: [{ class: 'k5', over: 18, upTo: 30, upperUM: 11, lowerUM: 2, estimate: true }] };
function onShaft(doc: StudioDoc, values: Record<string, string | number> = {}) {
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const ctx: Ctx = { doc, bodies: r.bodies, selection: { faces: [], edges: [], bodies: [r.bodies.findIndex(b => b.ref?.node === 0)] } }, c = cmd('bearing'), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : ok.reason);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}

test('Bearing (R12c.4): no rows, no bearing; the user\'s row loaded — on the default shaft against its first shoulder, in a housing, k5 on the shaft — its notes; it refers to the shaft and the housing', () => {
  let doc = cmd('shaft').build!(blank, { ...cmd('shaft').defaults!(blank), ks: 0, gs: 0, r: 0 });
  const r0 = evaluateDoc(doc, 1); assert.ok(r0.ok);
  const none = cmd('bearing').available({ doc, bodies: r0.bodies, selection: { faces: [], edges: [], bodies: [0] } });
  assert.ok(!none.ok && /Load your bearing rows first .* none is built in/.test(none.reason));
  assert.match(String((editBearingRows(doc, [{ ...ROW, source: undefined }]) as { error: string }).error), /never neither/);
  doc = (editBearingRows(doc, [ROW]) as { doc: StudioDoc }).doc;
  doc = (editFitTables(doc, [FITS]) as { doc: StudioDoc }).doc;
  // (A housing: a tube Ø70 with a Ø47 bore over z 14–34, around step 1's end.)
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 35, ri: 23.5, h: 20, x: 0, y: 0, z: 14 });
  const housing = doc.nodes.length - 1;
  doc = onShaft(doc, { housing: String(housing), sc: 'k5' });
  const b = doc.nodes[doc.nodes.length - 1] as Extract<ModelNode, { kind: 'bearing' }>;
  assert.deepEqual([b.row, b.step, b.against, b.housing, b.shaftClass], ['6204', 1, 'end', housing, 'k5']);
  assert.deepEqual(usesOf(b), [0, housing]); assert.equal(featureLabel(b, 0, doc.nodes), 'Bearing 6204 on step 1');
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const body = r.ok ? r.bodies.find(x => x.ref && doc.nodes[x.ref.node].kind === 'bearing')! : null!, notes = body.notes!.map(n => n.text);
  assert.ok(Math.abs(body.volume! - 19800.6522) < 1e-3, String(body.volume));
  assert.ok(notes.includes('Bearing 6204: Ø20 × Ø47 × 14, corners r 1 (your row, B1 (D139))'), JSON.stringify(notes));
  assert.ok(notes.includes('On step 1 from 16 to 30, against the Ø25 shoulder; its other side not located; no overlap with the shaft'), JSON.stringify(notes));
  assert.ok(notes.includes('In the housing\'s Ø47 bore; no overlap'), JSON.stringify(notes));
  assert.ok(notes.includes('Shaft seat k5: 20.002 to 20.011 — interference -21 to -2 µm with the ring, an estimate'), JSON.stringify(notes));
  assert.ok(body.notes!.some(n => /not located/.test(n.text) && n.warning) && body.notes!.some(n => /not for structural calculation/.test(n.text)));
  // The rows and the fit tables cross to the engine worker; a row in use stays; the shaft cannot go from under it.
  assert.deepEqual([evaluatedPart(doc).bearings, !!evaluatedPart(doc).fits], [doc.bearings, true]);
  assert.match(String((editBearingRows(doc, [], ['6204']) as { error: string }).error), /used by a bearing/);
  assert.match(String((deleteFeature(doc, 0) as { error?: string }).error), /used by feature/);
});

test('Bearing (R12c.4) refusals in the studio: a row removed from under it, a shoulder above da max', () => {
  let doc = cmd('shaft').build!(blank, { ...cmd('shaft').defaults!(blank), ks: 0, gs: 0, r: 0 });
  doc = (editBearingRows(doc, [ROW]) as { doc: StudioDoc }).doc;
  doc = onShaft(doc);
  const gone = evaluateDoc({ ...doc, bearings: { version: 1, rows: [] } }, 3);
  assert.ok(!gone.ok && gone.error.title === 'A bearing names a row that is not in your bearing rows', gone.ok ? 'built' : gone.error.detail);
  const tight = evaluateDoc({ ...doc, bearings: { version: 1, rows: [{ ...ROW, daMax: 24.5, daMin: 22 }] } }, 4);
  assert.ok(!tight.ok && tight.error.title === 'The bearing does not sit right on its shoulder' && /above da max 24\.5/.test(tight.error.detail), tight.ok ? 'built' : tight.error.detail);
});

test('Bearing (R12c.4) in the chat: a v2 features command, its values behind describe', async () => {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1), state: ChatState = { doc: emptyDoc(), bodies: [] };
  const d = await runTool(state, 'describe', { command: 'bearing' }, evaluate);
  assert.ok(!d.isError, d.content); assert.match(d.content, /none built in: if none, say so/);
});

test('D181 in the notes: the housing\'s shoulder at the bearing\'s end, Ø40 under Da max 42, said on the housing line; a bore with none says so', () => {
  let doc = cmd('shaft').build!(blank, { ...cmd('shaft').defaults!(blank), ks: 0, gs: 0, r: 0 });
  doc = (editBearingRows(doc, [ROW]) as { doc: StudioDoc }).doc;
  // (The housing: a Ø47 bore over the bearing's 16–30, then a Ø40 lip over 30–34 — one body, its step the shoulder.)
  const tube = cmd('tube');
  doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 35, ri: 23.5, h: 14, x: 0, y: 0, z: 16 });
  doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 35, ri: 20, h: 4, x: 0, y: 0, z: 30 });
  const r0 = evaluateDoc(doc, 1); assert.ok(r0.ok, r0.ok ? '' : r0.error.detail);
  const keys = r0.bodies.map(b => b.key);
  doc = cmd('union').build!({ ...blank, doc, bodies: r0.bodies, selection: { faces: [], edges: [], bodies: [1, 2] } }, {});
  const housing = doc.nodes.length - 1;
  doc = onShaft(doc, { housing: String(housing) });
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const notes = r.bodies.find(x => x.ref && doc.nodes[x.ref.node].kind === 'bearing')!.notes!.map(n => n.text);
  assert.ok(notes.includes('In the housing\'s Ø47 bore against its Ø40 shoulder at the bearing\'s end; no overlap'), JSON.stringify([keys, notes]));
  assert.ok(!notes.some(n => /the housing has no shoulder/.test(n)), JSON.stringify(notes));
});

test('D181 in the notes: a plain Ø47 bore has no shoulder — the housing line says none, the kernel\'s warning comes through as a warning', () => {
  let doc = cmd('shaft').build!(blank, { ...cmd('shaft').defaults!(blank), ks: 0, gs: 0, r: 0 });
  doc = (editBearingRows(doc, [ROW]) as { doc: StudioDoc }).doc;
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 35, ri: 23.5, h: 20, x: 0, y: 0, z: 14 });
  doc = onShaft(doc, { housing: String(doc.nodes.length - 1) });
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const notes = r.bodies.find(x => x.ref && doc.nodes[x.ref.node].kind === 'bearing')!.notes!;
  assert.ok(notes.some(n => n.text === 'In the housing\'s Ø47 bore; no overlap'), JSON.stringify(notes));
  assert.ok(notes.some(n => n.warning && /^the housing has no shoulder at either face of the bearing/.test(n.text)), JSON.stringify(notes));
});
