import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDrawingFrames, framesProperty, readFrames, type DrawingFrame } from '../src/drawing/controls';
import { defaultDrawing, readDrawing } from '../src/drawing/types';
import { starterDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { runDrawingTool } from '../src/chat/drawing';
import { validate, type JsonSchema } from '../src/chat/contract';

const attached: DrawingFrame = { id: 'attached', dim: 'd1', characteristic: 'position', value: 0.25, datums: ['A'] };
const standalone: DrawingFrame = { id: 'standalone', view: 'top', place: [12, -8], characteristic: 'angularity', value: 0.1, datums: ['A'], diameter: false, material: 'maximum', datumModifiers: { A: 'least' }, projected: 12, freeState: true };

test('standalone frames share the existing view contract and keep attachment exclusive', () => {
  assert.deepEqual(validate(framesProperty as JsonSchema, [attached, standalone]), []);
  assert.deepEqual(framesProperty.items.oneOf, [
    { required: ['dim'], not: { anyOf: [{ required: ['view'] }, { required: ['place'] }] } },
    { required: ['view', 'place'], not: { required: ['dim'] } },
  ]);
  for (const view of ['front', 'top', 'right', 'iso', 'section:A', 'section:ZZ', 'detail:B', 'detail:AZ'] as const)
    assert.deepEqual(checkDrawingFrames({ frames: [{ ...standalone, view }] }), [], view);
  assert.deepEqual(checkDrawingFrames({ frames: [attached, standalone, { ...standalone, id: 'second' }] }), [], 'standalone frames do not share an undefined dimension identity');
  const sparse = new Array(2); sparse[1] = 4;
  const sparseRows = new Array(1);
  const sparseDatums = new Array(1);
  const common = { id: 'unplaced', characteristic: 'flatness', value: 0.1, datums: [] };
  const invalid: unknown[] = [
    null, sparseRows, [common], [attached, { ...standalone, id: attached.id }], [attached, { ...attached, id: 'other' }],
    [{ ...standalone, dim: 'd1' }], [{ ...attached, view: 'top' }], [{ ...attached, place: [1, 2] }], [{ ...standalone, dim: undefined }],
    ...['section:AAA', 'section:a', 'detail:', 'back', '', null].map(view => [{ ...standalone, view }]),
    ...[sparse, [], [1], [1, 2, 3], [1, Infinity], [NaN, 2], '1,2', null].map(place => [{ ...standalone, place }]),
    [{ ...standalone, extra: true }], [{ ...standalone, datums: sparseDatums }], [{ ...standalone, value: 0 }], [{ ...standalone, value: 100 }],
    [{ ...standalone, material: 'guess' }], [{ ...standalone, datumModifiers: { B: 'maximum' } }], [{ ...standalone, projected: 0 }],
    Array.from({ length: 201 }, (_, i) => ({ ...standalone, id: `f${i}` })),
  ];
  for (const frames of invalid) assert.equal(checkDrawingFrames({ frames })[0]?.code, 'DRAWING_OPTIONS');
});

test('saved frames retain legacy attachment and copy standalone placement without dimension deduplication', () => {
  const rows = [attached, standalone, { ...standalone, id: 'second' }];
  const before = structuredClone(rows);
  const read = readDrawing({ frames: rows }).frames!;
  assert.deepEqual(read, rows);
  assert.deepEqual(readFrames([{ ...attached, freeState: false, tangentPlane: false }]), [{ ...attached, freeState: false, tangentPlane: false }]);
  assert.deepEqual(readFrames([attached, { ...attached, id: 'same-dimension' }, standalone, { ...standalone, id: attached.id }, { ...standalone, id: 'second' }]), rows);
  assert.notEqual(read[1], standalone);
  assert.notEqual(read[1].place, standalone.place);
  assert.notEqual(read[1].datums, standalone.datums);
  assert.notEqual(read[1].datumModifiers, standalone.datumModifiers);
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify({ frames: read }))).frames, rows);
  assert.deepEqual(rows, before);
});

test('drawing.set atomically preserves, replaces and clears mixed frames through the real file codec', async () => {
  const doc = { ...starterDoc(), drawing: { ...defaultDrawing(), frames: [attached], notes: [{ id: 'keep', text: 'Keep this note', at: [8, 12] as [number, number] }] } };
  const before = JSON.stringify(doc);
  const sparseRows = new Array(1), sparsePlace = new Array(2); sparsePlace[1] = 2;
  const invalid: unknown[] = [sparseRows, [{ ...standalone, place: sparsePlace }], [{ ...standalone, place: [1] }], [{ ...standalone, place: [0, Infinity] }], [{ ...standalone, view: 'back' }], [{ ...standalone, dim: 'd1' }], [attached, { ...standalone, id: attached.id }], [attached, { ...attached, id: 'other' }]];
  for (const frames of invalid) {
    const refused = runDrawingTool(doc, 'set_drawing', { title: 'Must not apply', frames });
    assert.ok('error' in refused && /DRAWING_OPTIONS/.test(refused.error));
    assert.equal(JSON.stringify(doc), before);
  }
  const kept = runDrawingTool(doc, 'set_drawing', { title: 'Kept frames' });
  if ('error' in kept) assert.fail(kept.error);
  assert.deepEqual(kept.doc.drawing?.frames, [attached]);
  const applied = runDrawingTool(doc, 'set_drawing', { frames: [attached, standalone] });
  if ('error' in applied) assert.fail(applied.error);
  assert.deepEqual(applied.doc.drawing?.frames, [attached, standalone]);
  assert.notEqual(applied.doc.drawing!.frames![1].place, standalone.place);
  assert.deepEqual(applied.doc.drawing?.notes, doc.drawing.notes);
  const opened = await readStudioFile(encodeStudioFile(applied.doc));
  assert.ok('doc' in opened);
  assert.deepEqual(opened.doc.drawing?.frames, [attached, standalone]);
  const cleared = runDrawingTool(opened.doc, 'set_drawing', { frames: [] });
  if ('error' in cleared) assert.fail(cleared.error);
  assert.equal(cleared.doc.drawing?.frames, undefined);
  assert.deepEqual(cleared.doc.drawing?.notes, doc.drawing.notes);
  assert.equal(JSON.stringify(doc), before);
});
