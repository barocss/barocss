import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { drawingInputs } from '../src/chat/drawing';
import { applyFix, drawingIssues, issueContext, type IssueContext } from '../src/drawing/issues';
import { tableLayout, tableSize, cellText, TABLE_PAD, TABLE_ROW, TABLE_TEXT, type TableContent } from '../src/drawing/table';
import { bendTable, tableContent } from '../src/drawing/tables';
import { textWidth } from '../src/drawing/text';
import { readDrawing, type DrawingSettings, type DrawingTable } from '../src/drawing/types';
import { sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { sheetDxf } from '../src/drawing/dxf';
import { dxfText } from '@barocss/cad';

// The drawing table (O49) and R12's bend table on it. A table laid out from its content (widths from its texts, its box
// at any corner of an anchor), drawn by the sheet's writers as lines and texts (SVG, PDF, DXF through the R11b
// writer), checked by R14's issue list as any annotation (over a view, a note, the title block; moved clear by its
// fix), its source's refusal an error; the bend table's BA and BD by the closed forms, and a shop table's deduction.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const CASE = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/r14/tables/bends');
async function run(calls: { tool: string; args: object }[]): Promise<StudioDoc> { let s: ChatState = { doc: emptyDoc(), bodies: [] }; for (const c of calls) { const r = await dispatchTool(s, c.tool, c.args as Record<string, unknown>, evaluate); assert.ok(!r.isError, r.content); s = r.state; } return s.doc; }
const lBracket = async () => run(JSON.parse(readFileSync(join(resolve(import.meta.dirname, '..'), 'test/fixtures/sheet-l-bracket.calls.json'), 'utf8')).calls);
const ctxOf = (doc: StudioDoc, settings: DrawingSettings): IssueContext => { const i = drawingInputs(doc, settings); assert.ok(typeof i !== 'string', String(i)); return issueContext({ ...i, meta: { ...i.meta, date: '2026-10-20' } }); };
const codes = (ctx: IssueContext, table: string) => drawingIssues(ctx).filter(x => x.tables?.includes(table)).map(x => x.code);

test('layout: widths from the texts, the box from the rows; any corner on the anchor; numbers to their digits, null a dash', () => {
  const t: TableContent = { title: 'T', columns: [{ key: 'a', label: 'ITEM' }, { key: 'b', label: 'L', unit: 'mm', digits: 1 }, { key: 'c', label: 'QTY' }], rows: [['tube', 120, 2], ['plate', 7.25, null]] };
  const w = [Math.max(textWidth('ITEM', TABLE_TEXT, true), textWidth('tube', TABLE_TEXT, false), textWidth('plate', TABLE_TEXT, false)), Math.max(textWidth('L [mm]', TABLE_TEXT, true), textWidth('120.0', TABLE_TEXT, false), textWidth('7.3', TABLE_TEXT, false)), Math.max(textWidth('QTY', TABLE_TEXT, true), textWidth('2', TABLE_TEXT, false), textWidth('—', TABLE_TEXT, false))].map(x => x + 2 * TABLE_PAD);
  const s = tableSize(t);
  assert.deepEqual(s.widths, w); assert.equal(s.height, 4 * TABLE_ROW);
  assert.deepEqual([cellText(120, t.columns[1]), cellText(7.25, t.columns[1]), cellText(null, t.columns[2]), cellText(0.1 + 0.2, { key: 'x', label: 'x' }), cellText(-0.001, { key: 'x', label: 'x', digits: 2 })], ['120.0', '7.3', '—', '0.3', '0.00']);
  const W = w.reduce((a, b) => a + b, 0), H = 20;
  for (const [corner, box] of [['top-left', [10, 10, 10 + W, 30]], ['top-right', [10 - W, 10, 10, 30]], ['bottom-left', [10, 10 - H, 10 + W, 10]], ['bottom-right', [10 - W, 10 - H, 10, 10]]] as const) {
    const l = tableLayout(t, [10, 10], corner); box.forEach((v, i) => assert.ok(Math.abs(l.box[i] - v) < 1e-9, `${corner}: ${l.box} vs ${box}`));
  }
  const l = tableLayout(t, [0, 0]), texts = l.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text);
  assert.deepEqual(texts, ['T', 'ITEM', 'L [mm]', 'QTY', 'tube', '120.0', '2', 'plate', '7.3', '—']);
  // (Numbers aligned right, text left; the border with the visible pen.)
  assert.deepEqual(l.marks.filter(m => m.kind === 'text').map(m => (m as { anchor: string }).anchor), ['start', 'start', 'end', 'end', 'start', 'end', 'end', 'start', 'end', 'end']);
  assert.equal(l.marks.filter(m => m.kind === 'line' && m.pen === 'visible').length, 5, 'the border and the rule under the header');
  // (Read leniently: a malformed table dropped, a valid one kept; ids unique.)
  const read = readDrawing({ tables: [{ id: 'a', columns: [{ key: 'x', label: 'X' }], rows: [[1, 2]] }, { id: 'b', from: 'bends' }, { id: 'b', from: 'bends' }, { id: 'c', columns: [{ key: 'x', label: 'X' }], rows: [['ok']] }] }).tables;
  assert.deepEqual(read?.map(x => x.id), ['b', 'c']);
});

test('the bend table on R12\'s L-bracket: BA = θ(R + K·T), BD = 2(R + T)tan(θ/2) − BA; a shop table\'s row deduction (4.2) and its row named', async () => {
  const doc = await lBracket(), c = bendTable({ doc }); assert.ok(!('error' in c), JSON.stringify(c));
  assert.deepEqual(c.columns.map(x => x.label), ['BEND', 'DIR', 'ANGLE', 'R', 'K', 'BA', 'BD', 'TABLE ROWS']);
  assert.equal(c.rows.length, 1);
  const [, dir, angle, R, K, ba, bd, rows] = c.rows[0] as [string, string, number, number, number, number, number, string | null];
  const T = 1.5, th = angle * Math.PI / 180;
  // (The kernel's own measure of the bend: 90 and 1.5 to rounding.)
  assert.ok(Math.abs(angle - 90) < 1e-9 && Math.abs(R - 1.5) < 1e-9 && K === 0.44 && rows === null, JSON.stringify(c.rows[0])); assert.ok(dir === 'UP' || dir === 'DOWN');
  assert.deepEqual([cellText(angle, c.columns[2]), cellText(R, c.columns[3])], ['90.0', '1.50']);
  assert.ok(Math.abs(ba - th * (R + K * T)) < 1e-12 && Math.abs(bd - (2 * (R + T) * Math.tan(th / 2) - th * (R + K * T))) < 1e-12, `${ba} ${bd}`);
  assert.deepEqual(c.notes, ['T 1.5 mm; K 0.44 for every bend']);
  // (D120's case: a contour L with a shop's table — its 90° row gives the deduction.)
  const shop = await run([{ tool: 'add_features', args: { features: [{ kind: 'sheet-contour', path: [[0, 0], [50, 0], [50, 35]], side: 'left', width: 20, thickness: 2, bendRadius: 3, bendTable: { id: 'shop-2mm', sources: [{ id: 'shop', label: 'a shop\'s own test bends (illustrative values for the case)' }], rows: [{ thicknessMM: 2, radiusMM: 3, angleDegrees: 90, deductionMM: 4.2, source: 'shop' }, { thicknessMM: 2, radiusMM: 3, angleDegrees: 120, kFactor: 0.42, source: 'shop' }] } }] } }]);
  const s = bendTable({ doc: shop }); assert.ok(!('error' in s), JSON.stringify(s));
  const r = s.rows[0];
  assert.ok(Math.abs((r[6] as number) - 4.2) < 1e-9, String(r[6])); assert.equal(cellText(r[6], s.columns[6]), '4.200');
  assert.match(String(r[7]), /^shop-2mm row 0/); assert.match(s.notes![0], /K from the bend table, by bend/);
  // (A part with no sheet body: the source says so.)
  const box = await run([{ tool: 'run_command', args: { command: 'box', values: { w: 10, d: 10, h: 10, x: 0, y: 0, z: 0 } } }]);
  assert.deepEqual(bendTable({ doc: box }), { error: 'no sheet-metal body with a flat pattern' });
  assert.match((tableContent({ id: 'x', from: 'nope' }, { doc: box }) as { error: string }).error, /^no table source "nope" \(sources: bends, cut-list\)/);
});

test('on the sheet: auto-placed above the title block and clean; over a view, a note, the title block: each issue and its fix; a source\'s refusal TABLE_SOURCE, drawn with its reason', async () => {
  const doc = await lBracket(), base = readDrawing(doc.drawing), withTables = (tables: DrawingTable[], extra: Partial<DrawingSettings> = {}): DrawingSettings => ({ ...base, ...extra, tables });
  const auto = ctxOf(doc, withTables([{ id: 'bends', from: 'bends' }]));
  const placed = auto.sheet.tables![0], [, ty0, tx1] = auto.layout.title;
  // (Searched from just above the title block's right end, upward then leftward in 5 mm steps, clear of everything.)
  assert.ok(placed.box[2] <= tx1 + 1e-9 && placed.box[3] <= ty0 - 3 + 1e-9 && Number.isInteger(Math.round((tx1 - placed.box[2]) / 5 * 1e9) / 1e9) && Number.isInteger(Math.round((ty0 - 3 - placed.box[3]) / 5 * 1e9) / 1e9), JSON.stringify(placed.box));
  assert.deepEqual(codes(auto, 'bends'), [], JSON.stringify(drawingIssues(auto).filter(x => x.tables)));
  // (Over the front view.)
  const fv = auto.layout.views.front.box, over = ctxOf(doc, withTables([{ id: 'bends', from: 'bends', at: [(fv[0] + fv[2]) / 2 - 20, (fv[1] + fv[3]) / 2 - 5] }]));
  const issue = drawingIssues(over).find(x => x.tables?.includes('bends'))!;
  assert.equal(issue.code, 'TEXT_OVER_LINES'); assert.equal(issue.fix?.kind, 'move-table');
  assert.deepEqual(codes(ctxOf(doc, applyFix(over, issue.fix!)), 'bends'), [], 'its fix clears it');
  // (Over a note.)
  const n = { id: 'n1', text: 'BREAK ALL EDGES', at: [placed.box[0] + 2, placed.box[1] + 6] as [number, number] };
  // (Anchored where it was placed: an auto-placed one would find room clear of the note.)
  const onNote = ctxOf(doc, withTables([{ id: 'bends', from: 'bends', at: [placed.box[0], placed.box[1]] }], { notes: [n] }));
  assert.notDeepEqual(ctxOf(doc, withTables([{ id: 'bends', from: 'bends' }], { notes: [n] })).sheet.tables![0].box, placed.box, 'auto-placed, it moves clear of the note');
  assert.ok(drawingIssues(onNote).some(x => x.code === 'TEXT_OVERLAP' && (x.tables?.includes('bends') || x.notes?.includes('n1'))), JSON.stringify(drawingIssues(onNote).map(x => x.code)));
  // (Into the title block.)
  const inTitle = ctxOf(doc, withTables([{ id: 'bends', from: 'bends', at: [auto.layout.title[0] + 5, auto.layout.title[1] + 5] }]));
  const off = drawingIssues(inTitle).find(x => x.tables?.includes('bends') && x.code === 'OFF_SHEET')!;
  assert.ok(off, JSON.stringify(drawingIssues(inTitle).map(x => [x.code, x.tables]))); assert.equal(off.fix?.kind, 'move-table');
  assert.ok(!codes(ctxOf(doc, applyFix(inTitle, off.fix!)), 'bends').includes('OFF_SHEET'));
  // (A source's refusal — the cut list's, FR4b, on a part with no frame member: an error, the table drawn with its title and the reason.)
  const bad = ctxOf(doc, withTables([{ id: 'cut', from: 'cut-list' }]));
  assert.deepEqual(codes(bad, 'cut'), ['TABLE_SOURCE']);
  const texts = bad.sheet.groups.find(g => g.role === 'table')!.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text);
  assert.deepEqual(texts, ['CUT-LIST', 'NOT AVAILABLE', 'no frame members (make a frame or a structural member)']);
});

// O67: a table with no room where it is (the views and it cannot share the sheet at this scale) gets a sheet or scale
// fix, offered only when that sheet built again leaves it clear; none clears it, the issue says so.
test('no room for a table: A3 at the same scale, else a smaller standard scale — each built again and clear; nothing fits, said so', async () => {
  const doc = await lBracket(), base = readDrawing(doc.drawing);
  const big = (cols: number, rows: number, whole = true): DrawingTable => ({ id: 't', title: 'BIG', ...(whole ? { whole: true } : {}), columns: Array.from({ length: cols }, (_, k) => ({ key: `c${k}`, label: `COLUMN${k}` })), rows: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, k) => `R${r}C${k}`)) });
  const issueOf = (ctx: IssueContext) => drawingIssues(ctx).find(x => x.tables?.includes('t'));
  // (A4, a 156 × 40 table: no room beside the views at 1:1 — A3 at 1:1 clears it.)
  const a4 = ctxOf(doc, { ...base, sheet: 'A4', tables: [big(10, 6)] }), i4 = issueOf(a4)!;
  assert.equal(i4.code, 'TEXT_OVERLAP'); assert.deepEqual(i4.fix, { kind: 'scale', sheet: 'A3', scale: a4.layout.scale });
  const on3 = ctxOf(doc, applyFix(a4, i4.fix!)); assert.equal(on3.settings.sheet, 'A3'); assert.deepEqual(codes(on3, 't'), [], 'A3 clears it');
  // (A3 at its own 2:1, a 190 × 50 table: no room — 1:1 on A3 clears it.)
  const a3 = ctxOf(doc, { ...base, sheet: 'A3', tables: [big(12, 8)] }), i3 = issueOf(a3)!;
  assert.equal(a3.layout.scale, 2); assert.deepEqual(i3.fix, { kind: 'scale', scale: 1 });
  assert.deepEqual(codes(ctxOf(doc, applyFix(a3, i3.fix!)), 't'), [], '1:1 clears it');
  // (A 495 mm table: wider than any frame — no fix, and the issue says nothing clears it.)
  const wide = issueOf(ctxOf(doc, { ...base, sheet: 'A3', tables: [big(30, 4)] }))!;
  assert.equal(wide.fix, undefined); assert.match(wide.message, /Nothing clears it: the table has no room on this sheet, on A3 or at a smaller standard scale/);
  // (FRa, O115: the same tables not kept whole go in blocks — columns after the key, rows in order — each clear, no issue.)
  for (const [sheet, cols, rows] of [['A4', 10, 6], ['A3', 12, 8]] as const) {
    const c = ctxOf(doc, { ...base, sheet, tables: [big(cols, rows, false)] }), parts = c.sheet.tables!.filter(x => x.id === 't');
    assert.ok(parts.length >= 2 && parts.every(p => p.part?.[1] === parts.length), `${sheet}: ${JSON.stringify(parts)}`);
    assert.deepEqual(codes(c, 't'), [], `${sheet}: in blocks, clear`);
    const texts = c.sheet.groups.filter(g => g.role === 'table' && g.id === 't').flatMap(g => g.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text));
    for (let k = 0; k < cols; k++) assert.ok(texts.includes(`COLUMN${k}`), `${sheet}: column ${k} in a block`);
  }
  // (Without a way to build the sheet again — a context made by hand — no sheet or scale fix is guessed.)
  assert.equal(issueOf({ ...a4, rebuild: undefined })!.fix, undefined);
});

test('written: the table in the SVG, the PDF and the DXF (TEXT and LINE entities, through the R11b writer); the DXF frozen and read by ezdxf (audit clean)', async () => {
  const doc = await lBracket(), ctx = ctxOf(doc, { ...readDrawing(doc.drawing), tables: [{ id: 'bends', from: 'bends' }] });
  const g = ctx.sheet.groups.find(x => x.role === 'table')!, texts = g.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text), lines = g.marks.filter(m => m.kind === 'line').length;
  assert.ok(texts.includes('BEND TABLE') && texts.includes('BD [mm]'));
  const svg = sheetSvg(ctx.sheet, 'l-bracket'), body = svg.slice(svg.indexOf('<g class="table"'));
  assert.ok(svg.includes('<g class="table"'), 'the table\'s group'); for (const t of texts) assert.ok(body.includes(`>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}<`), `SVG: ${t}`);
  const pdf = new TextDecoder('latin1').decode(sheetPdf(ctx.sheet, 'l-bracket'));
  for (const t of texts.filter(x => /^[\x20-\x7e]+$/.test(x))) assert.ok(pdf.includes(`(${t.replace(/([()\\])/g, '\\$1')}) Tj`), `PDF: ${t}`);
  const dxf = sheetDxf(ctx.sheet, ctx.layout);
  for (const t of texts) assert.ok(dxf.text.includes(`\n${dxfText(t, false)}\n`), `DXF: ${t}`);
  assert.ok((dxf.report.modelSpace.TEXT ?? 0) >= texts.length && (dxf.report.modelSpace.LINE ?? 0) >= lines);
  const file = join(CASE, 'expected.AC1015.dxf');
  // (The file is the writer's bytes, Windows-1252, not its text as UTF-8: '—' is one byte there.)
  if (process.env.UPDATE_DXF_FIXTURES) { mkdirSync(CASE, { recursive: true }); writeFileSync(file, dxf.bytes); writeFileSync(join(CASE, 'case.json'), JSON.stringify({ case: 'table-bends', step: 'O49', note: 'R12.5\'s sheet L-bracket (test/fixtures/sheet-l-bracket.calls.json) on an A4 drawing with its bend table auto-placed; the date fixed at 2026-10-20. expected.AC1015.dxf is the sheet as DXF (frozen); oracle.AC1015.json is ezdxf 1.4.5\'s reading (packages/barocss-cad/scripts/dxf-oracle.py).' }, null, 1) + '\n'); }
  assert.ok(Buffer.from(dxf.bytes).equals(readFileSync(file)), 'the DXF as frozen');
  const oracle = join(CASE, 'oracle.AC1015.json');
  if (existsSync(oracle)) {
    const o = JSON.parse(readFileSync(oracle, 'utf8')), all = JSON.stringify(o);
    assert.deepEqual(o.audit?.errors ?? o.errors ?? [], []);
    for (const t of texts) assert.ok(all.includes(JSON.stringify(t)), `ezdxf read ${t}`);
  } else assert.fail('oracle.AC1015.json: run scripts/dxf-oracle.py on the frozen DXF');
});
