import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { bomPanelData, isBoughtLine, purchaseCsv } from '../src/bom/bom';
import { bomView, checkBom, deriveBom } from '../src/team/assembly';
import { withFastenerInstance } from '../src/app/fasteners';
import { checkFastenerRow } from '../src/engine/fastenerRows';
import { ROWS_NOT_FROM_PERSON } from '../src/engine/rowFiles';
import { personFile, withSampleRows } from './person-file';
import { drawingInputs } from '../src/chat/drawing';
import { issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';

// F9 (A9): a fastener placed as a part of its own is a bought BOM line, merged over its copies, named by the person's
// fastener row (kind, size, length) when one is loaded — from a file they supplied (rows rule b) — and an estimate,
// said so, when none is. Its shape is still the fastener command's own (FASTENER_SIZES, untouched).
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const ROW = { id: 'F-M6x20', kind: 'socket-screw', size: 'M6', length: 20, designation: 'cap screw M6 × 20, A2', partNumber: 'SCS-M6-20', supplier: 'the shop', source: 'a test row' };
/** A plate with four M6 × 20 cap screws placed in the assembly, each a part of its own. */
function plateWithScrews(): StudioDoc {
  // (O7: the sizes the screws are drawn by, the sample rows loaded as the person loads them.)
  let doc: StudioDoc = withSampleRows(rectanglePart(100, 80, 10));
  for (const [x, y] of [[10, 10], [90, 10], [10, 70], [90, 70]]) doc = withFastenerInstance(doc, { kind: 'socket-screw', size: 'M6', length: '20', joint: 'free', grip: 10, holeD: 0, holeDepth: 0, through: '0', insert: 'instance', model: 'cosmetic', x, y, z: 10, up: '+z' });
  return doc;
}

test('F9: four placed M6 cap screws with no row — one bought line ×4, its item an estimate, said; in the purchase list; the BOM checks out', async () => {
  const doc = plateWithScrews(), view = await bomView(doc, evaluate), bom = deriveBom(view);
  const line = bom.lines.find(l => l.kind === 'fastener')!;
  assert.ok(line, JSON.stringify(bom.lines.map(l => l.item)));
  assert.deepEqual([line.qty, line.size, line.row, line.source, line.estimate, isBoughtLine(line)], [4, 'socket-screw M6 × 20', null, null, true, true]);
  assert.deepEqual(view.parts.find(p => p.id === line.parts[0])!.fastener!.why, ['no fastener row for socket-screw M6 × 20: what is bought is an estimate']);
  assert.deepEqual(checkBom(view, bom), []);
  const csv = purchaseCsv(await bomPanelData(doc, evaluate)).trim().split('\n');
  assert.ok(csv.some(r => /,4,fastener,socket-screw M6 × 20,,,,estimate$/.test(r)), csv.join(' | '));
});

test('F9: the person\'s fastener row, from their file — the line named by it (designation, part number, supplier, source), no estimate; an agent-written row refused', async () => {
  const f = personFile('fasteners.json', [ROW]);
  let s: ChatState = { doc: plateWithScrews(), bodies: [], rowFiles: f.rowFiles };
  const r = await dispatchTool(s, 'features', { action: 'load_rows', kind: 'fasteners', file: f.file }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  const bom = deriveBom(await bomView(s.doc, evaluate)), line = bom.lines.find(l => l.kind === 'fastener')!;
  assert.deepEqual([line.qty, line.size, line.row, line.source, line.catalogue, line.estimate], [4, 'cap screw M6 × 20, A2', 'F-M6x20', 'a test row', 'SCS-M6-20, the shop', false]);
  // (Rows rule b: no file of the person's, no rows — the agent cannot write them.)
  const agent = await dispatchTool({ doc: plateWithScrews(), bodies: [] }, 'features', { action: 'load_rows', kind: 'fasteners', file: 'rows-0000' }, evaluate);
  assert.ok(agent.isError && agent.content.includes(ROWS_NOT_FROM_PERSON.slice(0, 20)), agent.content);
  // (A row of another length is not this screw's: the line stays an estimate.)
  const other = personFile('fasteners.json', [{ ...ROW, id: 'F-M6x25', length: 25 }]);
  const r2 = await dispatchTool({ doc: plateWithScrews(), bodies: [], rowFiles: other.rowFiles }, 'features', { action: 'load_rows', kind: 'fasteners', file: other.file }, evaluate); assert.ok(!r2.isError, r2.content);
  assert.equal(deriveBom(await bomView(r2.state.doc, evaluate)).lines.find(l => l.kind === 'fastener')!.estimate, true);
});

test('F9: a fastener row is checked — a kind, a thread size, a length for a screw and none for a nut, a source or estimate: true, nothing unknown', () => {
  assert.deepEqual(checkFastenerRow(ROW), []);
  assert.deepEqual(checkFastenerRow({ id: 'N6', kind: 'hex-nut', size: 'M6', estimate: true }), []);
  assert.match(checkFastenerRow({ ...ROW, source: undefined })[0].message, /cite its source or say estimate: true/);
  assert.match(checkFastenerRow({ ...ROW, length: 0 })[0].message, /lengthMM is a number of mm above 0/);
  assert.match(checkFastenerRow({ id: 'N6', kind: 'hex-nut', size: 'M6', length: 5, estimate: true })[0].message, /has no lengthMM/);
  assert.match(checkFastenerRow({ ...ROW, size: '6' })[0].message, /size is the thread's/);
  assert.match(checkFastenerRow({ ...ROW, kind: 'rivet' })[0].message, /kind is one of/);
  assert.match(checkFastenerRow({ ...ROW, strength: '8.8' })[0].message, /unknown field strength/);
});

test('F9: on the assembly\'s sheet with balloons, the screws\' line has its balloon on a screw\'s edge; the BOM table says bought', () => {
  const doc = plateWithScrews();
  const i = drawingInputs(doc, { ...readDrawing(doc.drawing), scope: { kind: 'assembly' }, sheet: 'A3', balloons: true, tables: [{ id: 'bom', from: 'bom' }] });
  if (typeof i === 'string') throw Error(i);
  const ctx = issueContext({ ...i, meta: { ...i.meta, date: '2026-10-23' } }), b = ctx.sheet.balloons!, line = i.meta.bom!.lines.findIndex(l => l.kind === 'fastener') + 1;
  assert.ok(line > 0);
  const p = b.placed.find(x => x.no === line);
  assert.ok(p && /^inst[1-4]\//.test(p.edge), JSON.stringify(b));
  // (And the base plate's own line, `base:b1`, its balloon on the plate's edge: O177.)
  assert.deepEqual(b.noEdge, [], JSON.stringify(b.noEdge));
  const table = i.meta.tableContent!({ id: 'bom', from: 'bom' });
  assert.ok(!('error' in table));
  assert.equal(table.rows[line - 1][6], 'bought');
});
