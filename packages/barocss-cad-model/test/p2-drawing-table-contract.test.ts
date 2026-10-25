import test from 'node:test';
import assert from 'node:assert/strict';
import { cellText, headerText, tableLayout, type TableContent } from '../src/drawing/table';
import { readDrawing, type TableColumn } from '../src/drawing/types';

// Numeric-limit and snapshot cases only. These are not physical experiment inputs,
// native geometry, exported files or evidence of manufacturing accuracy.
const column: TableColumn = { key: 'value', label: 'VALUE', unit: 'mm' };

test('finite saved table cells retain finite text when default decimal scaling would overflow', () => {
  const settings = readDrawing({ tables: [{ id: 'limits', columns: [column], rows: [[1e308], [-1e308], [Number.MAX_VALUE], [-Number.MAX_VALUE]] }] });
  assert.equal(settings.tables?.length, 1, 'the existing reader accepts finite numeric cells without a magnitude cap');
  const saved = settings.tables![0];
  assert.deepEqual(saved.rows, [[1e308], [-1e308], [Number.MAX_VALUE], [-Number.MAX_VALUE]]);
  assert.deepEqual(saved.rows!.map(row => cellText(row[0], saved.columns![0])), [
    '1e+308', '-1e+308', '1.7976931348623157e+308', '-1.7976931348623157e+308',
  ]);
  assert.equal(headerText(saved.columns![0]), 'VALUE [mm]', 'formatting does not convert or relabel the quantity');
});

test('a table with large finite values keeps finite sheet geometry and the actual cell text', () => {
  const content: TableContent = { columns: [column], rows: [[1e308], [-1e308]] };
  const laid = tableLayout(content, [120, 80], 'bottom-right');
  assert.deepEqual(laid.marks.flatMap(mark => mark.kind === 'text' ? [mark.text] : []), ['VALUE [mm]', '1e+308', '-1e+308']);
  assert.ok(laid.widths.every(Number.isFinite)); assert.ok(laid.box.every(Number.isFinite));
  assert.ok(Math.abs(laid.box[2] - 120) < 1e-9); assert.ok(Math.abs(laid.box[3] - 80) < 1e-9);
  assert.equal(laid.box[1], 65, 'header and two rows keep the existing 5 mm row height');
  for (const mark of laid.marks) {
    const points = mark.kind === 'line' ? [mark.a, mark.b] : mark.kind === 'text' ? [mark.at] : [];
    for (const point of points) assert.ok(point.every(Number.isFinite));
  }
});

test('ordinary rounding, explicit digits, strings, null and negative zero keep their existing display', () => {
  assert.deepEqual([0.1 + 0.2, 7.256, -0.001, -0, 0].map(value => cellText(value, column)), ['0.3', '7.26', '0', '0', '0']);
  assert.equal(cellText(7.25, { ...column, digits: 1 }), '7.3');
  assert.equal(cellText(-0.001, { ...column, digits: 2 }), '0.00');
  assert.equal(cellText(120, { ...column, digits: 1 }), '120.0');
  assert.equal(cellText(1e308, { ...column, digits: 2 }), '1e+308');
  assert.equal(cellText('NOT MEASURED', column), 'NOT MEASURED');
  assert.equal(cellText(null, column), '—');
});

test('saved NaN and infinities remain invalid rather than becoming accepted finite values', () => {
  const settings = readDrawing({ tables: [
    { id: 'finite', columns: [column], rows: [[1e308]] },
    { id: 'nan', columns: [column], rows: [[NaN]] },
    { id: 'positive-infinity', columns: [column], rows: [[Infinity]] },
    { id: 'negative-infinity', columns: [column], rows: [[-Infinity]] },
  ] });
  assert.deepEqual(settings.tables?.map(table => table.id), ['finite']);
  assert.deepEqual(settings.tables![0].rows, [[1e308]]);
});

test('table layout preserves caller input and snapshots text, units, values and anchor coordinates', () => {
  const content: TableContent = { title: 'Read only', columns: [{ ...column }], rows: [[1e308], [null]], notes: ['Source revision unchanged'] };
  const at: [number, number] = [30, 40], inputBefore = structuredClone({ content, at });
  const laid = tableLayout(content, at), before = structuredClone(laid);
  assert.deepEqual({ content, at }, inputBefore, 'layout does not rewrite its input');
  content.title = 'Changed'; content.columns[0].label = 'Changed'; content.columns[0].unit = 'm';
  content.rows[0][0] = 2; content.notes![0] = 'Changed'; at[0] = 99; at[1] = 99;
  assert.deepEqual(laid, before, 'caller mutation cannot alter the already generated marks or placement');
  assert.deepEqual(laid.marks.flatMap(mark => mark.kind === 'text' ? [mark.text] : []), [
    'Read only', 'VALUE [mm]', '1e+308', '—', 'Source revision unchanged',
  ]);
  assert.equal(laid.box[0], 30); assert.equal(laid.box[1], 40);
});
