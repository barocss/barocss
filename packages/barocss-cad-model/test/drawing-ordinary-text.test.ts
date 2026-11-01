import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ordinaryTextFixture } from './drawing-ordinary-text-fixture';
import { valueMarks, type Mark } from '../src/drawing/sheet';
import { presetFor } from '../src/drawing/standard';
import { textCorners } from '../src/drawing/text';
import { sheetSvg } from '../src/io/svg';
const texts = (marks: readonly Mark[]) => marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
function bounds(mark: Extract<Mark, { kind: 'text' }>) { const corners = textCorners(mark.at, mark.text, mark.size, mark.anchor, mark.angle ?? 0, !!mark.bold); return [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1])), Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))]; }
test('ASME ordinary labels, tables, weld labels and stacked deviations meet recorded3mm product height', () => {
  const { context } = ordinaryTextFixture('asme');
  for (const role of ['label', 'table', 'weld', 'dimension']) {
    const marks = context.sheet.groups.filter(g => g.role === role).flatMap(g => texts(g.marks)); assert.ok(marks.length, role);
    assert.ok(marks.every(m => m.size >= 3), `${role}: ${marks.map(m => `${m.text}:${m.size}`).join(', ')}`);
  }
});
test('plain and ISO rich fixture SVG bytes remain exact, including default table and weld metrics', () => {
  const golden = { plain: '00d4543a0861bdc8dc0a696e0966526c491958d9387046d968f6738fab9958b4', iso: '212d6496b768480e7965566f0dd80bbf24350cc36b5cc252545de8a60fffa5be' };
  for (const standard of [undefined, 'iso'] as const) { const { context } = ordinaryTextFixture(standard); assert.equal(createHash('sha256').update(sheetSvg(context.sheet, 'Ordinary text')).digest('hex'), golden[standard ?? 'plain']); }
});
test('ASME stacked rows have separate text extents for normal and rotated dimension marks without changing numbers', () => {
  for (const angle of [0, 90]) {
    const marks = texts(valueMarks([30, 30], angle, 'middle', '30', { kind: 'deviation', upper: 0.1, lower: -0.05 }, '', presetFor({ standard: 'asme' }), undefined, 30));
    assert.deepEqual(marks.map(m => m.text), ['30', '+0.1', '-0.05']); assert.deepEqual(marks.map(m => m.size), [3, 3, 3]);
    const upper = bounds(marks[1]), lower = bounds(marks[2]);
    assert.ok(angle === 0 ? upper[3] + 0.1 <= lower[1] : lower[2] + 0.1 <= upper[0] || upper[2] + 0.1 <= lower[0], 'stacked row bounds must not overlap');
  }
});

test('explicit table text height changes widths, row baselines and note bounds consistently; default is exact', async () => {
  const { tableLayout, tableSize } = await import('../src/drawing/table');
  const content = { title: 'Inspection', columns: [{ key: 'a', label: 'ITEM' }], rows: [['A long part'], ['End']], notes: ['Independent note wider than the table'] };
  assert.deepEqual(tableLayout(content, [10, 20]), tableLayout(content, [10, 20], 'top-left', 2.5));
  const layout = tableLayout(content, [10, 20], 'top-left', 3), size = tableSize(content, 3); assert.equal(layout.rowHeight, 6); assert.equal(size.height, 30); assert.equal(layout.box[3] - layout.box[1], size.height);
  assert.ok(size.width > tableSize(content).width);
  for (const mark of texts(layout.marks)) { const b = bounds(mark); assert.equal(mark.size, 3); assert.ok(b[0] >= layout.box[0] && b[2] <= layout.box[2] + 1e-10 && b[1] >= layout.box[1] && b[3] <= layout.box[3], mark.text + ' stays within actual layout bounds'); }
  const baselines = [...new Set(texts(layout.marks).map(m => m.at[1]))]; for (let i = 1; i < baselines.length; i++) assert.ok(Math.abs(baselines[i] - baselines[i - 1] - 6) < 1e-10);
});
test('weld style reaches direct marks and placement bounds without changing model tip or text values', async () => {
  const { symbolMarks, weldSymbols } = await import('../src/drawing/welds');
  const { context, inputs } = ordinaryTextFixture('asme'), joint = inputs.meta.welds![0];
  const defaults = symbolMarks([20, 20], [10, 10], 'left', joint, 'W1'), explicitDefault = symbolMarks([20, 20], [10, 10], 'left', joint, 'W1', undefined, 2.5);
  assert.deepEqual(defaults, explicitDefault); const styled = symbolMarks([20, 20], [10, 10], 'left', joint, 'W1', undefined, 3);
  assert.deepEqual(texts(styled).map(m => m.text), texts(defaults).map(m => m.text)); assert.ok(texts(styled).every(m => m.size === 3));
  const placed = weldSymbols(context.layout, context.views, inputs.meta.welds!, undefined, undefined, 3); assert.equal(placed.placed.length, 1);
  for (const group of placed.groups) for (const mark of texts(group.marks)) { const b = bounds(mark), frame = context.layout.frame, title = context.layout.title; assert.ok(b[0] >= frame[0] && b[1] >= frame[1] && b[2] <= frame[2] && b[3] <= frame[3]); assert.ok(b[2] <= title[0] || b[0] >= title[2] || b[3] <= title[1] || b[1] >= title[3]); for (const v of Object.values(context.layout.views)) if (!v.hidden) assert.ok(b[2] <= v.box[0] || b[0] >= v.box[2] || b[3] <= v.box[1] || b[1] >= v.box[3], 'weld text stays clear of each view'); }
});
test('table and weld text height options reject nonfinite or nonpositive values before producing marks', async () => {
  const { tableLayout, tableSize } = await import('../src/drawing/table'), { symbolMarks, weldSymbols } = await import('../src/drawing/welds');
  const { context, inputs } = ordinaryTextFixture(), joint = inputs.meta.welds![0], content = { columns: [{ key: 'a', label: 'A' }], rows: [['x']] };
  for (const h of [0, -1, NaN, Infinity]) { assert.throws(() => tableSize(content, h), RangeError); assert.throws(() => tableLayout(content, [0, 0], 'top-left', h), RangeError); assert.throws(() => symbolMarks([0, 0], [10, 10], 'left', joint, 'W1', undefined, h), RangeError); assert.throws(() => weldSymbols(context.layout, context.views, [], undefined, undefined, h), RangeError); }
});
test('ASME detail and cross-sheet captions use ordinary3mm while ISO retains recorded sizes', async () => {
  const { starterDoc } = await import('../src/engine/doc'), { drawingInputs } = await import('../src/chat/drawing'), { buildSheets } = await import('../src/drawing/sheetSet'), { defaultDrawing } = await import('../src/drawing/types');
  for (const standard of ['asme', 'iso'] as const) {
    const settings = { ...defaultDrawing(), standard, details: [{ id: 'B', view: 'front' as const, center: [10, 4] as [number, number], radius: 6, scale: 5 }], sheets: [{ id: 'S2', views: ['iso' as const, 'detail:B' as const] }] };
    const inputs = drawingInputs(starterDoc(), settings); assert.ok(typeof inputs !== 'string', String(inputs)); const built = buildSheets(inputs.views, settings, { ...inputs.meta, callout: inputs.callout }, inputs.sections);
    const selected = built.flatMap(b => b.sheet.groups.flatMap(g => texts(g.marks))).filter(m => /^(DETAIL B|FROM SHEET|SEE SHEET)/.test(m.text)); assert.equal(selected.length, 3);
    for (const mark of selected) assert.equal(mark.size, standard === 'asme' ? 3 : mark.text.startsWith('DETAIL') ? 2.5 : 2);
  }
});
test('ASME removed section label and cross-sheet caption use3mm', async () => {
  const { starterDoc } = await import('../src/engine/doc'), { drawingInputs } = await import('../src/chat/drawing'), { buildSheets } = await import('../src/drawing/sheetSet'), { defaultDrawing } = await import('../src/drawing/types');
  const settings = { ...defaultDrawing(), standard: 'asme' as const, sections: [{ id: 'A', view: 'top' as const, at: -4, removed: { scale: 1 } }], sheets: [{ id: 'S2', views: ['iso' as const, 'section:A' as const] }] };
  const inputs = drawingInputs(starterDoc(), settings); assert.ok(typeof inputs !== 'string', String(inputs)); const built = buildSheets(inputs.views, settings, { ...inputs.meta, callout: inputs.callout }, inputs.sections);
  const selected = built.flatMap(b => b.sheet.groups.flatMap(g => texts(g.marks))).filter(m => /^(SECTION A|FROM SHEET|SEE SHEET)/.test(m.text)); assert.ok(selected.length >= 2); assert.ok(selected.every(m => m.size >= 3));
});
test('ASME split table probes, placed blocks and row boxes use the same3mm metrics', async () => {
  const { buildSheet } = await import('../src/drawing/sheet'); const { context } = ordinaryTextFixture('asme');
  const layout = { ...context.layout, views: Object.fromEntries(Object.entries(context.layout.views).map(([id, v]) => [id, { ...v, hidden: true }])) as typeof context.layout.views };
  const settings = { ...context.settings, dimensions: [], weldSymbols: false, tables: [{ id: 'long', columns: [{ key: 'item', label: 'ITEM' }, { key: 'quantity', label: 'QTY' }], rows: Array.from({ length: 45 }, (_, i) => [String(i + 1), i]) }] };
  const sheet = buildSheet(context.views, layout, settings, { title: 'Blocks', date: '2026-11-01' }); assert.ok(sheet.tables!.some(t => t.part), 'must exercise split block placement');
  for (const table of sheet.tables!) { assert.ok(table.box[0] >= layout.frame[0] && table.box[1] >= layout.frame[1] && table.box[2] <= layout.frame[2] && table.box[3] <= layout.title[1] - 3, 'actual blocks fit the available sheet region, not only the probe'); }
  for (let i = 0; i < sheet.tables!.length; i++) for (let j = i + 1; j < sheet.tables!.length; j++) { const a = sheet.tables![i].box, b = sheet.tables![j].box; assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], 'placed blocks do not overlap'); }
  for (const [k, table] of sheet.tables!.entries()) { const group = sheet.groups.filter(g => g.role === 'table')[k]; assert.ok(texts(group.marks).every(m => m.size === 3)); for (const mark of texts(group.marks)) { const b = bounds(mark); assert.ok(b[0] >= table.box[0] - 1e-10 && b[2] <= table.box[2] + 1e-10 && b[1] >= table.box[1] - 1e-10 && b[3] <= table.box[3] + 1e-10); } }
});
test('3mm table header and cell glyphs retain both side pads without title or notes masking narrow columns', async () => {
  const { tableLayout, TABLE_PAD } = await import('../src/drawing/table');
  const layout = tableLayout({ columns: [{ key: 'wideHeader', label: 'WWWWWWWWWWWW' }, { key: 'wideCell', label: 'I' }], rows: [['i', 'xxxxxxxxxxxxxxxxxxxxxxxx']] }, [10, 10], 'top-left', 3);
  const candidates = texts(layout.marks).filter(m => m.text.startsWith('WW') || m.text.startsWith('xx'));
  assert.equal(candidates.length, 2);
  for (const mark of candidates) { const index = mark.text.startsWith('WW') ? 0 : 1, left = layout.box[0] + (index ? layout.widths[0] : 0), b = bounds(mark); assert.ok(b[0] >= left + TABLE_PAD - 1e-10 && b[2] <= left + layout.widths[index] - TABLE_PAD + 1e-10, 'actual3mm text stays within its column padding'); }
});
test('column-block balancing uses the actual3mm header metrics at a near-boundary partition', async () => {
  const { buildSheet } = await import('../src/drawing/sheet'), { context } = ordinaryTextFixture('asme');
  const layout = { ...context.layout, frame: [0, 0, 29.5, 100] as [number, number, number, number], title: [0, 90, 29.5, 100] as [number, number, number, number], views: Object.fromEntries(Object.entries(context.layout.views).map(([id, v]) => [id, { ...v, hidden: true }])) as typeof context.layout.views };
  const settings = { ...context.settings, dimensions: [], weldSymbols: false, tables: [{ id: 'columns', columns: ['ITEM', 'M', 'WW', 'I', 'xxxxxx'].map((label, k) => ({ key: String(k), label })), rows: [['', '', '', '', '']] }] };
  const sheet = buildSheet(context.views, layout, settings, { title: 'Columns', date: '2026-11-01' }), groups = sheet.groups.filter(g => g.role === 'table'); assert.equal(groups.length, 2, 'whole table must split by columns');
  assert.deepEqual(groups.map(g => texts(g.marks).filter(m => m.bold).map(m => m.text)), [['ITEM', 'M', 'WW', 'I'], ['ITEM', 'xxxxxx']]);
  assert.ok(sheet.tables!.every(t => t.box[2] - t.box[0] < 29.2), 'actual3mm balanced maximum width stays below29.2mm');
});
test('3mm weld collision placement respects the1mm gap beside a feasible nearby view', async () => {
  const { weldSymbols } = await import('../src/drawing/welds'), { context, inputs } = ordinaryTextFixture('asme');
  // A nearby right view makes the font-height difference affect the chosen knee; a clear alternate knee exists.
  const layout = { ...context.layout, views: { ...context.layout.views, right: { ...context.layout.views.right, box: [context.layout.views.front.box[2] + 28.9, ...context.layout.views.right.box.slice(1)] as [number, number, number, number] } } };
  const placed = weldSymbols(layout, context.views, inputs.meta.welds!, undefined, undefined, 3); assert.equal(placed.placed.length, 1); assert.deepEqual(placed.placed[0].tip, context.sheet.welds!.placed[0].tip);
  for (const group of placed.groups) for (const mark of texts(group.marks)) { const b = bounds(mark); for (const view of Object.values(layout.views)) if (!view.hidden) assert.ok(b[2] + 1 <= view.box[0] || b[0] >= view.box[2] + 1 || b[3] + 1 <= view.box[1] || b[1] >= view.box[3] + 1, `${mark.text} keeps the actual3mm glyph bounds1mm from each view`); }
});
