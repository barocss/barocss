import test from 'node:test';
import assert from 'node:assert/strict';
import { starterDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { dispatchTool } from '../src/chat/tools';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { defaultDrawing, readDrawing, type DrawingSettings } from '../src/drawing/types';
import { checkDrawingMetadata, readRevisions, revisionTableContent } from '../src/drawing/metadata';
import { withManufacturingDrawing } from '../src/drawing/options';
import { buildSheet, type Mark } from '../src/drawing/sheet';
import { layoutSheet } from '../src/drawing/views';
import { textWidth } from '../src/drawing/text';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { sheetSvg } from '../src/io/svg';
import { sheetDxf } from '../src/io/dxf';

const records = [{ revision: 'A', date: '2026-10-24', description: 'Initial issue', by: 'Designer' }, { revision: 'B', date: '2026-10-25', description: 'Hole position changed' }];
const block = { template: 'extended' as const, organization: 'Example shop', number: 'DR-005', drawnBy: 'Designer', checkedBy: 'Checker', material: 'User material', finish: 'User finish' };
const texts = (marks: Mark[]) => marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
function sheetOf(settings: DrawingSettings) {
  const i = drawingInputs(starterDoc(), settings); assert.ok(typeof i !== 'string', String(i));
  const layout = layoutSheet(i.views, settings);
  return { layout, sheet: buildSheet(i.views, layout, settings, { title: 'Metadata test', date: '2026-10-24' }), inputs: i };
}

test('basic preserves the original drawing; extended reserves exactly 120 × 50 and draws six cells inside it', () => {
  const base = { ...defaultDrawing(), sheet: 'A3' as const }, a = sheetOf(base), b = sheetOf({ ...base, titleBlock: { template: 'basic' } });
  assert.deepEqual(a.layout, b.layout, 'explicit basic leaves layout unchanged');
  assert.deepEqual(a.sheet, b.sheet, 'explicit basic leaves marks unchanged');
  const x = sheetOf({ ...base, titleBlock: block }), [x0, y0, x1, y1] = x.layout.title;
  assert.equal(x1 - x0, 120); assert.equal(y1 - y0, 50);
  assert.equal(a.layout.title[1] - y0, 18);
  const marks = texts(x.sheet.groups.find(g => g.role === 'title')!.marks);
  for (const [value, col, row] of [['Example shop', 0, 0], ['DR-005', 1, 0], ['Designer', 2, 0], ['Checker', 0, 1], ['User material', 1, 1], ['User finish', 2, 1]] as const) {
    const m = marks.find(m => m.text === value)!; assert.ok(m, value);
    assert.deepEqual(m.at, [x0 + col * 40 + 2, y0 + row * 9 + 7]);
    assert.ok(m.at[0] + textWidth(m.text, m.size, false) <= x0 + (col + 1) * 40 - 2);
  }
  for (const id of ['front', 'top', 'right', 'iso'] as const) assert.ok(x.layout.views[id].box[3] <= y0, id);
});

test('long metadata fits each field and switching templates retains authored values', () => {
  const value = 'Organization '.repeat(9), { sheet, layout } = sheetOf({ ...defaultDrawing(), titleBlock: { ...block, organization: value } });
  const m = texts(sheet.groups.find(g => g.role === 'title')!.marks).find(m => m.text.startsWith('Organization '))!;
  assert.ok(m.text.endsWith('…') && m.size >= 1.5);
  assert.ok(m.at[0] + textWidth(m.text, m.size, false) <= layout.title[0] + 38);
  const data = readDrawing({ titleBlock: { ...block, template: 'basic' }, revisions: records });
  assert.deepEqual(data.titleBlock, { ...block, template: 'basic' }); assert.deepEqual(data.revisions, records);
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(data))), data);
});

test('saved-file readers drop malformed fields and duplicate records without copying unknown keys', () => {
  const r = readDrawing({ titleBlock: { ...block, material: 7, injected: 'no' }, revisions: [records[0], { ...records[1], date: '2026-02-30' }, { ...records[0], description: 'Duplicate' }, { ...records[1], ignored: true }] });
  const { material: _m, ...rest } = block; void _m;
  assert.deepEqual(r.titleBlock, rest); assert.deepEqual(r.revisions, records);
  assert.deepEqual(readRevisions(null), []);
  assert.deepEqual(checkDrawingMetadata({ revisions: [{ ...records[0], date: '2024-02-29' }] }), []);
});

test('invalid metadata is refused atomically by drawing.set; lists replace or clear and inputs are copied', () => {
  const doc = { ...starterDoc(), drawing: { ...defaultDrawing(), titleBlock: block, revisions: records } }, before = JSON.stringify(doc);
  for (const args of [{ titleBlock: null }, { titleBlock: { ...block, template: 'ISO' } }, { titleBlock: { ...block, hidden: true } }, { titleBlock: { ...block, number: '' } }, { revisions: null }, { revisions: [records[0], records[0]] }, { revisions: [{ ...records[0], date: '2026-02-29' }] }, { revisions: [{ ...records[0], description: 'a\nb' }] }, { revisions: [{ ...records[0], by: 2 }] }, { revisions: [{ ...records[0], extra: true }] }, { revisions: Array.from({ length: 51 }, (_, k) => ({ ...records[0], revision: String(k) })) }]) {
    const r = runDrawingTool(doc, 'set_drawing', { title: 'Must not apply', ...args });
    assert.ok('error' in r && r.error.startsWith('[DRAWING_OPTIONS]'), JSON.stringify(r)); assert.equal(JSON.stringify(doc), before);
  }
  const copy = withManufacturingDrawing(defaultDrawing(), { titleBlock: block, revisions: records });
  assert.notEqual(copy.titleBlock, block); assert.notEqual(copy.revisions![0], records[0]);
  assert.deepEqual(withManufacturingDrawing(copy, {}).revisions, records);
  assert.equal(withManufacturingDrawing(copy, { revisions: [] }).revisions, undefined);
  const r = runDrawingTool(starterDoc(), 'set_drawing', { titleBlock: block, revisions: records, tables: [{ id: 'history', from: 'revisions' }] });
  assert.ok(!('error' in r), JSON.stringify(r)); if ('error' in r) return;
  assert.deepEqual(r.doc.drawing?.revisions, records);
  assert.equal(r.doc.drawing?.revision, undefined, 'history does not change the active revision or claim approval');
});

test('revision table rows retain input order and content, use existing room/issue checks, and reach SVG and DXF', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', titleBlock: block, revisions: records, tables: [{ id: 'history', from: 'revisions' }] };
  assert.deepEqual(revisionTableContent(records).rows, [['A', '2026-10-24', 'Initial issue', 'Designer'], ['B', '2026-10-25', 'Hole position changed', null]]);
  const { sheet, layout, inputs } = sheetOf(settings), table = sheet.tables![0];
  assert.equal(table.error, undefined); assert.ok(table.box[3] <= layout.title[1] - 3);
  assert.deepEqual(drawingIssues(issueContext(inputs)).filter(i => i.tables?.includes('history')).map(i => i.code), []);
  const shown = texts(sheet.groups.filter(g => g.role === 'table').flatMap(g => g.marks)).map(m => m.text);
  for (const value of ['REVISIONS', 'REV', 'DATE', 'DESCRIPTION', 'BY', 'Initial issue', 'Hole position changed', '—']) assert.ok(shown.includes(value), value);
  const svg = sheetSvg(sheet, 'DR5');
  for (const value of ['DR-005', 'Example shop', 'Initial issue', 'Hole position changed']) assert.ok(svg.includes(value), value);
  const dxf = sheetDxf(sheet, layout).text;
  for (const value of ['DR-005', 'Example shop', 'Initial issue', 'Hole position changed']) assert.ok(dxf.includes(value), value);
  const overlap = { ...settings, tables: [{ id: 'history', from: 'revisions', at: [layout.title[0], layout.title[1]] as [number, number] }] };
  const i = drawingInputs(starterDoc(), overlap); assert.ok(typeof i !== 'string');
  assert.ok(drawingIssues(issueContext(i)).some(x => x.tables?.includes('history') && x.code === 'OFF_SHEET'));
});

test('the agent discovers metadata through describe and sets it through v2; invalid batch and proposal inputs are atomic', async () => {
  const doc = starterDoc(), evaluate = async (d: typeof doc) => evaluatePart(d, 1), result = await evaluate(doc);
  assert.ok(result.ok); if (!result.ok) return;
  const state = { doc, bodies: result.bodies }, before = JSON.stringify(doc);
  const described = await dispatchTool(state, 'describe', { tool: 'drawing', action: 'set' }, evaluate);
  const schema = JSON.parse(described.content).input.properties;
  assert.deepEqual(schema.titleBlock.properties.template.enum, ['basic', 'extended']);
  assert.equal(schema.revisions.maxItems, 50);
  assert.ok(schema.tables.items.properties.from.enum.includes('revisions'));
  const set = await dispatchTool(state, 'drawing', { action: 'set', titleBlock: block, revisions: records, tables: [{ id: 'history', from: 'revisions' }] }, evaluate);
  assert.ok(!set.isError, set.content); assert.deepEqual(set.state.doc.drawing?.revisions, records);
  const op = { tool: 'set_drawing', args: { title: 'Must not apply', revisions: [records[0], records[0]] } };
  for (const [tool, args] of [['drawing', { action: 'set', ...op.args }], ['features', { action: 'batch', ops: [op] }], ['proposals', { action: 'propose', title: 'Invalid revision', ops: [op] }]] as const) {
    const r = await dispatchTool(state, tool, args, evaluate);
    assert.ok(r.isError, r.content); assert.match(r.content, /DRAWING_OPTIONS/); assert.equal(JSON.stringify(r.state.doc), before);
  }
});
