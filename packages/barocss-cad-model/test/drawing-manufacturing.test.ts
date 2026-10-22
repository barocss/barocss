import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { acceptProposal, dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { drawingInputs, runDrawingTool, DRAWING_TOOLS } from '../src/chat/drawing';
import { issueContext } from '../src/drawing/issues';
import { sectionsOf, readDrawing } from '../src/drawing/types';
import { sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { sheetDxf } from '../src/drawing/dxf';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { manufacturingDocument, manufacturingOptions } from './fixtures/drawing-manufacturing';
const evaluate = async (doc: ChatState['doc']) => evaluatePart(doc, 1);
const stateOf = async (): Promise<ChatState> => { const doc = manufacturingDocument(), e = await evaluate(doc); assert.ok(e.ok); return { doc, bodies: e.bodies }; };
const inputOf = (doc: ChatState['doc']) => { const i = drawingInputs(doc); assert.notEqual(typeof i, 'string', String(i)); if (typeof i === 'string') throw Error(i); return i; };
const op = (args: object) => ({ tool: 'drawing', args: { action: 'set', ...args } });

test('A9-4 v2 drawing.set and batch require user approval; actual proposal replay supplies symbols, source tables, sections and exports', async () => {
  const s = await stateOf(), before = JSON.stringify(s.doc);
  for (const [name, args] of [['drawing', { action: 'set', ...manufacturingOptions }], ['features', { action: 'batch', ops: [op(manufacturingOptions)] }]] as const) {
    const r = await runTool(s, name, args, evaluate);
    assert.ok(r.isError && /needs_approval/.test(r.content), r.content); assert.equal(JSON.stringify(r.state.doc), before);
  }
  const proposed = await runTool(s, 'proposals', { action: 'propose', title: 'Manufacturing options', ops: [op(manufacturingOptions)] }, evaluate);
  assert.equal(proposed.isError, false, proposed.content); assert.equal(proposed.state.doc.drawing, undefined);
  const id = proposed.state.doc.proposals!.at(-1)!.id;
  const refused = await runTool(proposed.state, 'proposals', { action: 'accept', id }, evaluate);
  assert.equal(refused.isError, true, refused.content);
  const accepted = await acceptProposal(proposed.state, id, evaluate); assert.ok(!('error' in accepted), JSON.stringify(accepted));
  const doc = accepted.state.doc, i = inputOf(doc), ctx = issueContext(i);
  assert.deepEqual(readDrawing(doc.drawing).scope, { kind: 'part' }, 'BOM/balloons never switch an implicit base scope');
  assert.equal(sectionsOf(i.settings).length, 2); assert.equal(ctx.sheet.sections?.length, 2);
  assert.ok(ctx.sheet.welds?.placed.length); assert.equal(ctx.sheet.tables?.length, 3); assert.ok(ctx.sheet.tables?.every(t => !t.error));
  assert.ok(ctx.sheet.balloons, 'the option is consumed even when a base part has no component balloons');
  const svg = sheetSvg(ctx.sheet, 'Frame manufacturing');
  assert.match(svg, /CUT LIST/); assert.match(svg, /WELD LIST/); assert.match(svg, /BILL OF MATERIALS/); assert.match(svg, /A[–-]A|A–A/);
  assert.ok(sheetPdf(ctx.sheet, 'Frame manufacturing').length > 1000);
  assert.match(sheetDxf(ctx.sheet, ctx.layout).text, /CUT LIST/);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened);
  assert.deepEqual(opened.doc.drawing, doc.drawing);
  const off = await dispatchTool({ ...accepted.state, doc: opened.doc }, 'drawing', { action: 'set', weldSymbols: false, balloons: false, sections: [], tables: [] }, evaluate);
  assert.equal(off.isError, false, off.content); const d = readDrawing(off.state.doc.drawing);
  assert.equal(d.weldSymbols, undefined); assert.equal(d.balloons, undefined); assert.deepEqual(sectionsOf(d), []); assert.equal(d.tables, undefined);
  const reset = await dispatchTool(off.state, 'drawing', { action: 'set', ...manufacturingOptions }, evaluate);
  assert.equal(reset.isError, false, reset.content); assert.deepEqual(sectionsOf(readDrawing(reset.state.doc.drawing)), manufacturingOptions.sections);
  const batch = await dispatchTool(s, 'features', { action: 'batch', ops: [op(manufacturingOptions)] }, evaluate);
  assert.equal(batch.isError, false, batch.content); assert.deepEqual(batch.state.doc.drawing, doc.drawing);
});

test('A9-4 strict nested/unknown inputs refuse atomically in dispatch, batch and proposal; no model or drawing bytes change', async () => {
  const s = await stateOf(), before = JSON.stringify(s.doc);
  const bad: Record<string, unknown>[] = [
    { weldSymbols: 'true' }, { balloons: null }, { sections: null }, { tables: false }, { mystery: true },
    { sections: [{ id: 'A', view: 'front', at: 0, supplier: 'invented' }] },
    { sections: [{ id: 'A', view: 'iso', at: 0 }] }, { sections: [{ id: 'a', view: 'front', at: 0 }] },
    { sections: [{ id: 'A', view: 'front', at: Infinity }] }, { sections: [{ id: 'A', view: 'front', at: '0' }] },
    { sections: [{ id: 'A', view: 'front', at: 0 }, { id: 'A', view: 'top', at: 0 }] },
    { tables: [{ id: 'bom', from: 'unknown' }] }, { tables: [{ id: 'bom', from: 'bom', rows: [] }] },
    { tables: [{ id: 'bom', from: 'bom', at: [1, 2, 3] }] }, { tables: [{ id: 'bom', from: 'bom', at: [NaN, 2] }] },
    { tables: [{ id: 'bom', from: 'bom', whole: 1 }] }, { tables: [{ id: 'bom', from: 'bom', corner: 'middle' }] },
    { tables: [{ id: '', from: 'bom' }] }, { tables: [{ id: 'bom', from: 'bom' }, { id: 'bom', from: 'bom' }] },
  ];
  for (const args of bad) {
    for (const [name, input] of [['drawing', { action: 'set', title: 'Must not apply', ...args }], ['features', { action: 'batch', ops: [op({ title: 'First' }), op(args)] }], ['proposals', { action: 'propose', title: 'Invalid', ops: [op(args)] }]] as const) {
      const r = await dispatchTool(s, name, input, evaluate); assert.equal(r.isError, true, `${name}: ${JSON.stringify(args)}: ${r.content}`);
      assert.equal(JSON.stringify(r.state.doc), before);
    }
  }
});

test('A9-4 section canonical storage, reference preservation, explicit assembly and omitted option retention', async () => {
  const s = await stateOf();
  const a = runDrawingTool(s.doc, 'set_drawing', { sections: [{ id: 'A', view: 'front', at: 0 }] }); assert.ok(!('error' in a));
  assert.deepEqual(a.doc.drawing?.section, { y: 0 }); assert.equal(a.doc.drawing?.sections, undefined);
  const manual = { ...a.doc, drawing: { ...readDrawing(a.doc.drawing), dimensions: [{ id: 'manual', kind: 'diameter' as const, view: 'section:A' as const, edge: 'authored-edge', near: [0, 0, 0] as [number, number, number], place: [10, 10] as [number, number] }] } };
  const protectedBytes = JSON.stringify(manual);
  for (const sections of [[], [{ id: 'A', view: 'front', at: 1 }]]) {
    const r = runDrawingTool(manual, 'set_drawing', { sections, weldSymbols: true }); assert.ok('error' in r); assert.match(r.error, /DRAWING_SECTION_REFERENCES/); assert.equal(JSON.stringify(manual), protectedBytes);
  }
  const assembly = runDrawingTool(s.doc, 'set_drawing', { scope: { kind: 'assembly' }, ...manufacturingOptions }); assert.ok(!('error' in assembly));
  const i = inputOf(assembly.doc), sheet = issueContext(i).sheet; assert.ok(sheet.balloons?.placed.some(b => b.edge.startsWith('plate/')));
  const keep = runDrawingTool(assembly.doc, 'set_drawing', { title: 'Only title' }); assert.ok(!('error' in keep));
  assert.deepEqual(keep.doc.drawing?.tables, assembly.doc.drawing?.tables); assert.deepEqual(keep.doc.drawing?.scope, { kind: 'assembly' });
  const auto = runDrawingTool(keep.doc, 'auto_dimension', {}); assert.ok('error' in auto); assert.match(auto.error, /DRAWING_SCOPE_AUTO/);
  const schema = DRAWING_TOOLS.find(t => t.name === 'set_drawing')!.input_schema.properties!;
  assert.ok('tables' in schema && 'sections' in schema && 'weldSymbols' in schema && 'balloons' in schema);
});
