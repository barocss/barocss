import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDrawingFrames, checkSavedCompositeFrames, checkSavedDrawingFrames, frameOk, framesProperty, readFrames, type DrawingFrame } from '../src/drawing/controls';
import { defaultDrawing, readDrawing } from '../src/drawing/types';
import { starterDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { runDrawingTool } from '../src/chat/drawing';
import { validate, type JsonSchema } from '../src/chat/contract';

const legacy: DrawingFrame = { id: 'legacy', dim: 'd1', characteristic: 'flatness', value: 0.2, datums: ['A'] };
const composite: DrawingFrame = { id: 'position', view: 'right', place: [12, -4], characteristic: 'position', value: 0.3, datums: ['A', 'B'], composite: { value: 0.1, datums: ['A'], diameter: false, material: 'maximum', datumModifiers: { A: 'least' } } };

test('composite position frames accept two independently validated rows and copy the lower row', () => {
  assert.deepEqual(checkDrawingFrames({ frames: [legacy, composite] }), []);
  assert.deepEqual(validate(framesProperty as JsonSchema, [legacy, composite]), []);
  const read = readFrames([legacy, composite]);
  assert.deepEqual(read, [legacy, composite]);
  assert.notEqual(read[1].composite, composite.composite);
  assert.notEqual(read[1].composite!.datums, composite.composite!.datums);
  assert.notEqual(read[1].composite!.datumModifiers, composite.composite!.datumModifiers);
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify({ frames: [legacy, composite] }))).frames, [legacy, composite]);
  assert.deepEqual(readFrames([legacy]), [legacy]);
});

test('invalid lower rows and non-position composites are rejected without partial changes', () => {
  const sparse = new Array(1);
  const lower = composite.composite!;
  const invalid: unknown[] = [
    null, {}, { value: 0.1 }, { value: 0, datums: [] }, { value: 100, datums: [] },
    { value: Infinity, datums: [] }, { value: 0.1, datums: sparse }, { value: 0.1, datums: ['A', 'A'] },
    { value: 0.1, datums: ['I'] }, { value: 0.1, datums: ['A', 'B', 'C', 'D'] },
    { ...lower, diameter: 'yes' }, { ...lower, material: 'unknown' },
    { ...lower, datumModifiers: { B: 'maximum' } }, { ...lower, projected: 1 },
  ];
  const doc = { ...starterDoc(), drawing: { ...defaultDrawing(), frames: [legacy] } };
  const before = JSON.stringify(doc);
  for (const row of invalid) {
    const bad: Record<string, unknown> = { ...composite, composite: row };
    assert.equal(frameOk(bad), false);
    assert.equal(checkDrawingFrames({ frames: [legacy, bad] })[0]?.code, 'DRAWING_OPTIONS');
    assert.deepEqual(readFrames([bad]), []);
    const result = runDrawingTool(doc, 'set_drawing', { title: 'Must not apply', frames: [legacy, bad] });
    assert.ok('error' in result && /DRAWING_OPTIONS/.test(result.error));
    assert.equal(JSON.stringify(doc), before);
  }
  const wrongCharacteristic = { ...composite, characteristic: 'flatness' };
  assert.equal(frameOk(wrongCharacteristic), false);
  assert.equal(checkDrawingFrames({ frames: [wrongCharacteristic] })[0]?.code, 'DRAWING_OPTIONS');
  assert.equal(checkDrawingFrames({ frames: [composite, { ...composite }] })[0]?.code, 'DRAWING_OPTIONS');
  const attached = { ...legacy, characteristic: 'position', composite: lower };
  assert.equal(checkDrawingFrames({ frames: [attached, { ...attached, id: 'duplicate-dim' }] })[0]?.code, 'DRAWING_OPTIONS');
});

test('drawing.set and file codec preserve legacy and composite frames', async () => {
  const doc = { ...starterDoc(), drawing: { ...defaultDrawing(), frames: [legacy] } };
  const before = structuredClone(doc);
  assert.equal(doc.schema, 3);
  const applied = runDrawingTool(doc, 'set_drawing', { frames: [legacy, composite] });
  if ('error' in applied) assert.fail(applied.error);
  assert.equal(applied.doc.schema, doc.schema);
  assert.deepEqual(applied.doc.drawing?.frames, [legacy, composite]);
  const opened = await readStudioFile(encodeStudioFile(applied.doc));
  assert.ok('doc' in opened);
  assert.equal(opened.doc.schema, doc.schema);
  assert.deepEqual(opened.doc.drawing?.frames, [legacy, composite]);
  const kept = runDrawingTool(opened.doc, 'set_drawing', { title: 'Updated title' });
  if ('error' in kept) assert.fail(kept.error);
  assert.equal(kept.doc.schema, doc.schema);
  assert.deepEqual(kept.doc.drawing?.frames, [legacy, composite]);
  assert.deepEqual(doc, before);
});

test('saved composite checks refuse malformed or unsupported rows without changing input', () => {
  const valid = { frames: [legacy, composite] }, before = structuredClone(valid);
  assert.deepEqual(checkSavedCompositeFrames(valid), []);
  assert.deepEqual(valid, before);
  const invalid: unknown[] = [
    { ...composite, composite: null }, { ...composite, composite: undefined },
    { ...composite, composite: {} }, { ...composite, composite: { value: 0.1, datums: ['A'], future: true } },
    { ...composite, composite: { value: 0, datums: [] } },
    { ...composite, characteristic: 'flatness' }, { ...composite, future: true },
  ];
  for (const bad of invalid) {
    const input: { frames: unknown[] } = { frames: [legacy, bad] }, saved = structuredClone(input);
    assert.equal(checkSavedCompositeFrames(input)[0]?.code, 'DRAWING_OPTIONS');
    assert.deepEqual(input, saved);
  }
});

test('saved composite checks catch duplicate ids and attached dimensions in either order', () => {
  const sameId = { ...legacy, id: composite.id };
  const attached = { ...legacy, id: 'attached', characteristic: 'position', composite: composite.composite };
  const sameDim = { ...legacy, id: 'other' };
  for (const pair of [[sameId, composite], [composite, sameId], [sameDim, attached], [attached, sameDim]])
    assert.equal(checkSavedCompositeFrames({ frames: pair })[0]?.code, 'DRAWING_OPTIONS');
  assert.deepEqual(checkSavedCompositeFrames({ frames: [legacy, { ...legacy, id: 'duplicate-dim', future: true }] }), []);
  assert.deepEqual(checkSavedCompositeFrames({ frames: [null, { unexpected: true }] }), []);
  assert.deepEqual(checkSavedCompositeFrames({ frames: [legacy, composite, { ...legacy, id: 'legacy-copy' }] }), []);
  assert.deepEqual(checkSavedCompositeFrames(null), []);
});

test('saved standalone and composite frames are validated before normalization', () => {
  const standalone: DrawingFrame = { id: 'single', view: 'right', place: [1, 2], characteristic: 'flatness', value: 0.2, datums: [] };
  const good: unknown[] = [
    undefined, null, {}, { frames: [] }, { frames: [legacy, standalone, composite] },
    { frames: [legacy, { ...legacy, id: 'duplicate-dim', future: true }] },
    { frames: { dim: 'd1' } }, { datumTargets: [{ view: 'front', place: [1, 2] }] },
  ];
  for (const input of good) {
    const before = structuredClone(input);
    assert.deepEqual(checkSavedDrawingFrames(input), []);
    assert.deepEqual(input, before);
  }
  const bad: unknown[] = [
    ...[{ view: null }, { place: null }, { composite: null }].map(frames => ({ frames })),
    { frames: [{ ...standalone, view: 'unknown' }] }, { frames: [{ ...standalone, place: [1] }] },
    { frames: [{ ...standalone, dim: 'd1' }] }, { frames: [{ ...standalone, future: true }] },
    { frames: [{ ...composite, composite: null }] }, { frames: [{ ...composite, composite: { ...composite.composite, future: true } }] },
    { frames: [standalone, { ...legacy, id: standalone.id }] }, { frames: [{ ...legacy, id: standalone.id }, standalone] },
    { frames: [{ ...legacy, characteristic: 'position', composite: composite.composite }, { ...legacy, id: 'same-dim' }] },
    { frames: [{ ...legacy, id: 'same-dim' }, { ...legacy, characteristic: 'position', composite: composite.composite }] },
  ];
  for (const input of bad) {
    const before = structuredClone(input);
    assert.equal(checkSavedDrawingFrames(input)[0]?.code, 'DRAWING_OPTIONS');
    assert.deepEqual(input, before);
  }
});

test('explicit false, true and absent frame flags survive the file codec and drawing normalization', async () => {
  for (const value of [undefined, false, true] as const) {
    const flags = value === undefined ? {} : { diameter: value, freeState: value, tangentPlane: value };
    const lowerDiameter = value === undefined ? {} : { diameter: value };
    const frames: DrawingFrame[] = [
      { ...legacy, ...flags },
      { id: 'single', view: 'top', place: [1, 2], characteristic: 'flatness', value: 0.2, datums: [], ...flags },
      { ...composite, ...flags, composite: { value: 0.1, datums: ['A'], material: 'maximum', datumModifiers: { A: 'least' }, ...lowerDiameter } },
    ];
    const authored = { ...starterDoc(), drawing: { ...defaultDrawing(), frames } }, before = structuredClone(authored);
    const normalized = readFrames(frames);
    assert.deepEqual(normalized, frames);
    for (const row of normalized) for (const key of ['diameter', 'freeState', 'tangentPlane'] as const) {
      assert.equal(Object.hasOwn(row, key), value !== undefined, `${key} presence for ${String(value)}`);
      assert.equal(row[key], value);
    }
    const lower = normalized[2].composite;
    assert.ok(lower);
    assert.equal(Object.hasOwn(lower, 'diameter'), value !== undefined);
    assert.equal(lower.diameter, value);

    const first = await readStudioFile(encodeStudioFile(authored));
    assert.ok('doc' in first);
    const firstDrawing = readDrawing(first.doc.drawing);
    assert.deepEqual(firstDrawing.frames, frames);
    const normalizedDoc = { ...first.doc, drawing: firstDrawing };
    const second = await readStudioFile(encodeStudioFile(normalizedDoc));
    assert.ok('doc' in second);
    assert.deepEqual(readDrawing(second.doc.drawing).frames, frames);
    assert.equal(second.doc.schema, authored.schema);
    assert.deepEqual(authored, before);
  }
});

test('free-state and tangent-plane flags retain independent mixed values', () => {
  const frames: DrawingFrame[] = [
    { ...legacy, freeState: false, tangentPlane: true },
    { ...composite, freeState: true, tangentPlane: false },
  ];
  const before = structuredClone(frames);
  assert.deepEqual(readFrames(frames), frames);
  assert.deepEqual(readDrawing({ frames }).frames, frames);
  assert.deepEqual(frames, before);
});
