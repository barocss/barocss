import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, dispatchTool, type ChatState } from '../src/chat/tools';
import { personFile } from './person-file';

// O171 (A9's F8): a welded table frame's drawing — A3, four views asked, weld symbols, balloons, the BOM, cut-list and
// weld-list tables — after Auto-dimension and one Fix has no error. Its members' bores give no levels (their walls are
// their sections'): at every member end they had given a 3 and a 37, crowding the sheet into TEXT_OVER_LINES and leaving
// no clean scale; the overall sizes stay.
import { drawingInputs } from '../src/chat/drawing';
import { issueContext } from '../src/drawing/issues';
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
test('O171: the welded table frame\'s drawing — after Auto-dimension and one Fix, no error; no dimension to a member\'s bore; the overall 400, 300 and 320 given', async () => {
  const sections = personFile('sections.json', [{ id: 'R40', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, estimate: true }]);
  let s: ChatState = { doc: emptyDoc(), bodies: [], rowFiles: sections.rowFiles };
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state; return JSON.parse(r.content); };
  await call('features', { action: 'frame_sections', file: sections.file });
  await call('features', { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } });
  await call('features', { action: 'material', material: 'steel' });
  for (const [leg, rail] of [['b0_part0', 'b0_part4'], ['b0_part1', 'b0_part4'], ['b0_part2', 'b0_part6'], ['b0_part3', 'b0_part6']]) await call('features', { action: 'command', command: 'gusset', values: { l1: 60, l2: 60, t: 5, clip: 10, offset: 0 }, bodies: [leg, rail] });
  for (const leg of ['b0_part0', 'b0_part1', 'b0_part2', 'b0_part3']) await call('features', { action: 'command', command: 'end-cap', values: { end: 'start', fit: 'inset', t: 4 }, bodies: [leg] });
  const joints = (await call('query', { action: 'welds' })).joints as { id: string; kind: string }[];
  await call('features', { action: 'welds', welds: joints.filter(j => j.kind !== 'cap').map(j => ({ joint: j.id, kind: 'fillet', size: 3 })), beadOwnership: { version: 1, policy: 'equal-length' } });
  s = { ...s, doc: { ...s.doc, instances: [{ id: 'p1', name: 'Plate', doc: rectanglePart(200, 300, 14), position: [100, 0, 320], rotation: [0, 0, 0] }] } };
  const pr = await dispatchTool(s, 'proposals', { action: 'propose', title: 'Weldment drawing', ops: [{ tool: 'drawing', args: { action: 'set', sheet: 'A3', views: ['front', 'top', 'right', 'iso'], weldSymbols: true, balloons: true, tables: [{ id: 'bom', from: 'bom' }, { id: 'cut', from: 'cut-list' }, { id: 'welds', from: 'weld-list' }] } }] }, evaluate);
  assert.ok(!pr.isError, pr.content); const a = await acceptProposal(pr.state, pr.state.doc.proposals!.at(-1)!.id, evaluate); assert.ok(!('error' in a)); s = a.state;
  await call('drawing', { action: 'auto' });
  const fixed = await call('drawing', { action: 'fix' }) as { issues: { code: string; severity: string }[] };
  assert.deepEqual(fixed.issues.filter(x => x.severity === 'error').map(x => x.code), []);
  const i = drawingInputs(s.doc); if (typeof i === 'string') throw Error(i);
  const dims = issueContext(i).sheet.dimensions.filter((d): d is Extract<typeof d, { ok: true }> => d.ok);
  assert.deepEqual(dims.filter(d => /n\d+\.m\d+\.bore/.test(JSON.stringify([d.dim.a, d.dim.b]))).map(d => d.text), []);
  for (const t of ['400', '300', '320']) assert.ok(dims.some(d => d.text === t), `the overall ${t}`);
});
