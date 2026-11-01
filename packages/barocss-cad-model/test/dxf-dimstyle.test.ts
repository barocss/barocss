import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart } from '../src/engine/doc';
import { brepsFor } from '../src/engine/evaluate';
import { projectViews } from '../src/drawing/project';
import { snapPoints } from '../src/drawing/dimensions';
import { defaultDrawing, type DrawingSettings } from '../src/drawing/types';
import { buildSheet } from '../src/drawing/sheet';
import { layoutSheet } from '../src/drawing/views';
import { sheetDxf, sheetDxfDocument } from '../src/io/dxf';
function records(text: string): [number, string][][] {
  const lines = text.trimEnd().split('\n'), records: [number, string][][] = [];
  let current: [number, string][] | undefined;
  for (let i = 0; i < lines.length; i += 2) {
    const pair: [number, string] = [Number(lines[i]), lines[i + 1]];
    if (pair[0] === 0) { current = []; records.push(current); }
    current?.push(pair);
  }
  return records;
}
function stripStyle(text: string) {
  return records(text).map(record => record[0][1] === 'DIMSTYLE' ? record.filter(([code]) => ![140, 77, 73, 74].includes(code)) : record);
}
const source = brepsFor(rectanglePart(30, 12, 6));
assert.ok('breps' in source);
const projected = projectViews(source.breps, source.prefixes);
assert.ok(projected.ok);
const views = projected.views, points = snapPoints(views.front);
const at = (x: number, z: number) => points.find(p => p.at[0] === x && p.at[1] === z)!.ref;
for (const standard of ['plain', 'iso', 'asme'] as const) {
  test(`${standard}: millimetre, inch and dual sheets preserve all dimension display data and carry only explicit style defaults`, () => {
    for (const display of ['mm', 'inch', 'dual'] as const) {
      const settings: DrawingSettings = {
        ...defaultDrawing(), scale: 1,
        ...(standard === 'plain' ? {} : { standard }),
        ...(display === 'mm' ? {} : { units: 'inch', ...(display === 'dual' ? { dual: true } : {}) }),
        dimensions: [
          { id: 'width', kind: 'linear', view: 'front', orient: 'horizontal', a: at(0, 0), b: at(30, 0), place: [15, -12] },
          { id: 'height', kind: 'linear', view: 'front', orient: 'vertical', a: at(0, 0), b: at(0, 6), place: [-12, 3] },
        ],
      };
      const layout = layoutSheet(views, settings), sheet = buildSheet(views, layout, settings, { title: 'Style', date: '2026-11-01' });
      assert.equal(sheet.standard, standard === 'plain' ? undefined : standard);
      for (const version of ['AC1015', 'AC1009'] as const) {
        const doc = sheetDxfDocument(sheet, layout, version), result = sheetDxf(sheet, layout, version);
        const legacy = sheetDxf({ ...sheet, standard: undefined }, layout, version);
        assert.equal(doc.units, 'mm');
        if (standard === 'asme') {
          assert.deepEqual(doc.dimensionStyle, { textHeight: 3, textPlacement: 'center', textOrientation: 'horizontal' });
          assert.deepEqual(stripStyle(result.text), stripStyle(legacy.text));
          assert.deepEqual(result.report, legacy.report);
          const style = new Map(records(result.text).find(r => r[0][1] === 'DIMSTYLE'));
          assert.deepEqual([140, 77, 73, 74].map(code => Number(style.get(code))), [3, 0, 1, 1]);
        } else {
          assert.equal(doc.dimensionStyle, undefined);
          assert.deepEqual(result, legacy, 'default and ISO byte output stays unchanged');
        }
        const { dimensionStyle: _style, ...content } = doc; void _style;
        assert.deepEqual(content, sheetDxfDocument({ ...sheet, standard: undefined }, layout, version), 'labels, measurements, geometry and anonymous display blocks must not change');
      }
    }
  });
}
