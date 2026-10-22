import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { editBearingRows } from '../src/engine/bearings';
import { editFitTables } from '../src/engine/fits';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { snapPoints } from '../src/drawing/dimensions';

// O172 (A9's F8). Fix's Auto-dimension had no part elements, so it dropped the keyseat's dimensions (O146's plans);
// a snap point kept the first edge found at a place, hidden or not; and in a later round of one Fix, Auto-dimension and the
// moves undid each other on issues it cannot meet. (Kept from O170's note:) One Fix leaves a sheet it can fix fixed. On the default shaft with its key and bearing, Fix adds the
// keyseat's section B (O148 X3) and places the dimensions again; the new section is a new view, and the overlap it brings
// (a dimension over the key's note) was invisible to that same pass, so a second Fix was needed. Fix now builds the sheet
// again and fixes what it shows until a round applies none.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const ROW = { id: '6204', designation: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, DaMaxMM: 42, raMaxMM: 1, source: 'test' };
const FITS = { id: 'f', rows: [{ class: 'k5', overMM: 18, upToMM: 30, upperUM: 11, lowerUM: 2, estimate: true }] };
async function shaft(): Promise<ChatState> {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state; return JSON.parse(r.content); };
  await call('features', { action: 'command', command: 'shaft', values: {} });
  s = { ...s, doc: (editFitTables((editBearingRows(s.doc, [ROW]) as { doc: StudioDoc }).doc, [FITS]) as { doc: StudioDoc }).doc };
  await call('features', { action: 'command', command: 'key', values: { h: 6 }, bodies: ['b0'] });
  await call('features', { action: 'command', command: 'bearing', values: { sc: 'k5', step: 3, against: 'start' }, bodies: ['b0'] });
  await call('drawing', { action: 'auto' });
  return s;
}

test('O172: one Fix on the shaft keeps the keyseat\'s dimension, on its section B; it dimensions again only in its first round and after the section', async () => {
  let s = await shaft();
  const r = await dispatchTool(s, 'drawing', { action: 'fix' }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  const applied = (JSON.parse(r.content) as { applied: string[] }).applied;
  assert.ok(applied.includes('add-section'));
  assert.equal(applied.filter(k => k === 'auto-dimension').length, 2, JSON.stringify(applied));
  const onSection = (s.doc.drawing?.dimensions ?? []).filter(d => d.view === 'section:B');
  assert.equal(onSection.length, 1, 'the keyseat\'s d − t1 on section B–B');
  const i = drawingInputs(s.doc); if (typeof i === 'string') throw Error(i);
  assert.deepEqual(drawingIssues(issueContext(i)).filter(x => x.severity === 'error').map(x => x.code), []);
});

test('O172: where two edges meet one place on the view, the snap point is the visible edge\'s, whichever was found first', () => {
  const line = (x: number) => ({ kind: 'line' as const, a: [x, 0] as [number, number], b: [x, 10] as [number, number] });
  const edge = (name: string, visible: boolean) => ({ name, kind: 'line' as const, ends: [[0, 0, 0], [0, 10, 0]] as [[number, number, number], [number, number, number]], circle: null, pieces: [{ curve: line(0), visible }] });
  const pr = { right: [1, 0, 0], up: [0, 1, 0], toward: [0, 0, 1], edges: [edge('hidden.one', false), edge('shown.one', true)], min: [0, 0], max: [0, 10] } as never;
  assert.deepEqual(snapPoints(pr).map(p => p.ref.edge), ['shown.one', 'shown.one']);
  const first = { ...(pr as object), edges: [edge('shown.one', true), edge('hidden.one', false)] } as never;
  assert.deepEqual(snapPoints(first).map(p => p.ref.edge), ['shown.one', 'shown.one']);
});
