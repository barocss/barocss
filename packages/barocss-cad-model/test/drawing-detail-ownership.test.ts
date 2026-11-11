import assert from 'node:assert/strict';
import test from 'node:test';
import { runDrawingTool } from '../src/chat/drawing';
import { starterDoc } from '../src/engine/doc';
import { withManufacturingDrawing } from '../src/drawing/options';
import { forSheet, mergeSheet, sheetOf } from '../src/drawing/sheets';
import { defaultDrawing, readDrawing, type DrawingDetail, type DrawingDimension, type DrawingFrame } from '../src/drawing/types';

const detail: DrawingDetail = { id: 'B', view: 'top', center: [32, 16], radius: 6 };
const diameter: DrawingDimension = {
  id: 'b-diameter', kind: 'diameter', view: 'detail:B', edge: 'n1.top|n2.side0#1', near: [32, 16, 8], place: [41, 21],
  tol: { kind: 'symmetric', value: 0.15 },
};
const standalone: DrawingFrame = {
  id: 'b-frame', characteristic: 'flatness', value: 0.07, datums: [], view: 'detail:B', place: [40, 9],
};

test('drawing.set refuses to attach legacy annotations or a sheet assignment to a new detail', () => {
  const base = defaultDrawing();
  const cases = [{ dimensions: [diameter] }, { frames: [standalone] }, { sheets: [{ id: 's2', views: ['detail:B'] }] }];
  for (const saved of cases) {
    const input = readDrawing({ ...base, ...saved });
    const before = structuredClone(input);
    assert.throws(() => withManufacturingDrawing(input, { details: [detail] }), /DRAWING_DETAIL_REFERENCES/);
    assert.deepEqual(input, before);
    const changed = withManufacturingDrawing(input, { details: [{ ...detail, id: 'C' }], ...(input.sheets ? { sheets: [{ id: 's2', views: [] }] } : {}) });
    assert.deepEqual(changed.details, [{ ...detail, id: 'C' }]);
    assert.deepEqual(changed.dimensions, input.dimensions);
    assert.deepEqual(changed.frames, input.frames);
  }
});

test('the drawing tool keeps an unresolved diameter when adding a different detail letter', () => {
  const doc = { ...starterDoc(), drawing: readDrawing({ ...defaultDrawing(), sheet: 'A3', dimensions: [diameter] }) };
  const before = structuredClone(doc);
  const rejected = runDrawingTool(doc, 'set_drawing', { details: [detail] });
  assert.ok('error' in rejected && /DRAWING_DETAIL_REFERENCES/.test(rejected.error));
  assert.deepEqual(doc, before);

  const accepted = runDrawingTool(doc, 'set_drawing', { details: [{ ...detail, id: 'C' }] });
  assert.ok(!('error' in accepted), JSON.stringify(accepted));
  assert.deepEqual(accepted.doc.drawing?.details, [{ ...detail, id: 'C' }]);
  assert.deepEqual(accepted.doc.drawing?.dimensions, [diameter]);
  assert.deepEqual(accepted.doc.nodes, before.nodes);
});

test('a standalone detail frame protects its view definition while allowing scale and placement edits', () => {
  const original = { ...defaultDrawing(), details: [detail], frames: [standalone] };
  for (const details of [[], [{ ...detail, radius: 7 }], [{ ...detail, view: 'front' }], [{ ...detail, center: [33, 16] }]]) {
    assert.throws(() => withManufacturingDrawing(original, { details }), /DRAWING_DETAIL_REFERENCES/);
  }
  const placed = { ...detail, scale: 2, at: [300, 80] };
  const changed = withManufacturingDrawing(original, { details: [placed] });
  assert.deepEqual(changed.details, [placed]);
  assert.deepEqual(changed.frames, [standalone]);
  assert.equal(withManufacturingDrawing({ ...original, frames: [] }, { details: [] }).details, undefined);
});

test('a continuation-sheet collision skips the unresolved letter and moves only new annotations', () => {
  const other: DrawingDetail = { ...detail, id: 'C' };
  const original = readDrawing({
    ...defaultDrawing(), section: { y: 16 }, details: [other], dimensions: [diameter],
    frames: [standalone], sheets: [{ id: 's2', views: ['front', 'detail:E'] }],
  });
  const before = structuredClone(original), sheet = forSheet(original, 1);
  const added: DrawingDimension = { ...diameter, id: 'new-diameter', view: 'detail:C' };
  const frame: DrawingFrame = { ...standalone, id: 'new-frame', view: 'detail:C' };
  const next = mergeSheet(original, 1, {
    ...sheet, details: [{ ...other, view: 'front', radius: 7 }], dimensions: [added], frames: [frame],
  });
  assert.deepEqual(next.details, [other, { ...other, id: 'D', view: 'front', radius: 7 }]);
  assert.deepEqual(next.dimensions, [diameter, { ...added, view: 'detail:D' }]);
  assert.deepEqual(next.frames, [standalone, { ...frame, view: 'detail:D' }]);
  assert.equal(sheetOf(next, 'detail:D'), 1);
  assert.deepEqual(original, before);

  const requestedB = mergeSheet(original, 1, { ...sheet, details: [{ ...detail, view: 'front' }] });
  assert.equal(requestedB.details?.at(-1)?.id, 'D');
  assert.deepEqual(requestedB.dimensions, [diameter]);
  assert.deepEqual(requestedB.frames, [standalone]);
});
