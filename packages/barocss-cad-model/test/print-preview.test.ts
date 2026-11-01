import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, withNode, type PrintPreviewSettings, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { checkPrintPreview } from '../src/engine/printPreview';
import { firstProblem } from '../src/engine/refusal';
import { encodeStudioFile, isContainer, readStudioFile } from '../src/engine/container';
import { meshNodeBlobs } from '../src/engine/blobs';
import { evaluateDoc } from '../src/engine/evaluate';
import { printLayers } from '../src/print/layers';

// G23 persistence only: no preview default becomes an authored direction or explicit layer thickness.
test('G23: preview-only JSON Save/Open preserves omissions, zero and false without creating print.direction', async () => {
  const values: PrintPreviewSettings[] = [
    { version: 1 }, { version: 1, layer: 0 }, { version: 1, supports: false, printed: false },
    { version: 1, layer: Number.MAX_SAFE_INTEGER, layerHeight: 0.15, supports: true, printed: true },
  ];
  for (const value of values) {
    assert.equal(firstProblem(checkPrintPreview(value)), null);
    const doc: StudioDoc = { ...rectanglePart(4, 3, 2), printPreview: value }, before = JSON.stringify(doc);
    const read = readStudioDoc(before); assert.ok('doc' in read, JSON.stringify(read));
    assert.deepEqual(read.doc.printPreview, value); assert.equal('print' in read.doc, false);
    const bytes = encodeStudioFile(read.doc); assert.equal(isContainer(bytes), false);
    const back = await readStudioFile(bytes); assert.ok('doc' in back, JSON.stringify(back));
    assert.deepEqual(back.doc.printPreview, value); assert.equal('print' in back.doc, false);
    assert.equal(JSON.stringify(doc), before, 'reader and encoder leave the input unchanged');
  }
});

test('G23: absent preview fields retain the existing default direction and 0.2 mm estimate', () => {
  const doc: StudioDoc = { ...rectanglePart(4, 3, 2), printPreview: { version: 1, layer: 0, supports: false } };
  const read = readStudioDoc(JSON.stringify(doc)); assert.ok('doc' in read);
  assert.equal('layerHeight' in read.doc.printPreview!, false); assert.equal('printed' in read.doc.printPreview!, false);
  assert.equal('print' in read.doc, false);
  const evaluated = evaluateDoc(read.doc, 1); assert.ok(evaluated.ok);
  const layers = printLayers(evaluated.bodies.map(b => b.mesh), { layerHeight: read.doc.printPreview?.layerHeight, direction: read.doc.print?.direction });
  assert.deepEqual(layers.layerHeight, { value: 0.2, basis: 'estimate' });
  assert.equal(layers.directionSource, 'default'); assert.deepEqual(layers.direction, [0, 0, 1]);
});

test('G23: existing print-only files and documents with both fields keep their authored direction', async () => {
  for (const schema of [3] as const) for (const preview of [undefined, { version: 1 as const, layer: 0, printed: false }]) {
    const doc: StudioDoc = { ...rectanglePart(4, 3, 2), schema, print: { direction: [1, 0, 0] }, ...(preview ? { printPreview: preview } : {}) };
    const read = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in read, JSON.stringify(read));
    assert.deepEqual(read.doc.print, doc.print); assert.deepEqual(read.doc.printPreview, preview);
    assert.equal('printPreview' in read.doc, preview !== undefined);
  }
  const old = readStudioDoc(JSON.stringify(rectanglePart(4, 3, 2))); assert.ok('doc' in old);
  assert.equal('printPreview' in old.doc, false); assert.equal('print' in old.doc, false);
});

test('G23: version, safe layer index, finite positive thickness and boolean flags refuse clearly', async () => {
  const invalid: unknown[] = [
    null, [], 1, 'preview', {}, { version: 0 }, { version: 2 }, { version: '1' },
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '0', null].map(layer => ({ version: 1, layer })),
    ...[0, -0.1, NaN, Infinity, '0.2', null].map(layerHeight => ({ version: 1, layerHeight })),
    ...['supports', 'printed'].flatMap(key => [0, 1, 'false', null].map(value => ({ version: 1, [key]: value }))),
    { version: 1, direction: [0, 0, 1] },
  ];
  assert.equal(firstProblem(checkPrintPreview(undefined)), null, 'the optional field may be absent');
  for (const value of invalid) {
    assert.match(firstProblem(checkPrintPreview(value))!, /^\[PRINT_PREVIEW_INPUT\] printPreview:/);
    const text = JSON.stringify({ ...emptyDoc(), printPreview: value }), read = readStudioDoc(text);
    assert.ok('error' in read && read.error.startsWith('[PRINT_PREVIEW_INPUT] printPreview:'), text);
    const file = await readStudioFile(new TextEncoder().encode(text));
    assert.ok('error' in file && file.error.startsWith('[PRINT_PREVIEW_INPUT] printPreview:'), text);
  }
  for (const layerHeight of [Number.MIN_VALUE, Number.MAX_VALUE]) assert.equal(firstProblem(checkPrintPreview({ version: 1, layer: 0, layerHeight })), null, 'no unrequested thickness bounds');
});

test('G23: placed documents and pending revisions use the same read refusal without filling missing controls', () => {
  const good = { ...rectanglePart(4, 3, 2), printPreview: { version: 1 as const, layer: 0 } };
  const doc: StudioDoc = { ...emptyDoc(), instances: [{ id: 'p1', name: 'P', doc: good, position: [0, 0, 0], rotation: [0, 0, 0] }], pendingParts: { p1: { name: 'P', rev: 'B', doc: good } } };
  const read = readStudioDoc(JSON.stringify(doc)); assert.ok('doc' in read);
  assert.equal('printPreview' in read.doc, false);
  assert.deepEqual(read.doc.instances![0].doc.printPreview, good.printPreview);
  assert.deepEqual(read.doc.pendingParts!.p1.doc.printPreview, good.printPreview);
  assert.equal('print' in read.doc.instances![0].doc, false);
  const instance = readStudioDoc(JSON.stringify({ ...doc, instances: [{ ...doc.instances![0], doc: { ...good, printPreview: { version: 1, layer: -1 } } }] }));
  assert.ok('error' in instance && instance.error.includes('instances[0].doc.printPreview: layer'));
  const pending = readStudioDoc(JSON.stringify({ ...doc, pendingParts: { p1: { ...doc.pendingParts!.p1, doc: { ...good, printPreview: { version: 1, printed: 1 } } } } }));
  assert.ok('error' in pending && pending.error.includes('pendingParts["p1"].doc.printPreview: printed'));
});

test('G23: chunked BCAD Save/Open carries preview values and uses the same validation', async () => {
  const mesh = await meshNodeBlobs({ kind: 'mesh' as const, name: 'triangle', unit: 'mm', representation: 'facets' as const }, [0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
  const doc: StudioDoc = { ...withNode(emptyDoc(), mesh), printPreview: { version: 1, layer: 0, supports: false, printed: true } };
  const bytes = encodeStudioFile(doc); assert.ok(isContainer(bytes));
  const read = await readStudioFile(bytes); assert.ok('doc' in read, JSON.stringify(read));
  assert.deepEqual(read.doc.printPreview, doc.printPreview); assert.equal('layerHeight' in read.doc.printPreview!, false); assert.equal('print' in read.doc, false);
  const invalid = encodeStudioFile({ ...doc, printPreview: { version: 1, layer: -1 } });
  assert.ok(isContainer(invalid));
  const refused = await readStudioFile(invalid);
  assert.ok('error' in refused && refused.error.startsWith('[PRINT_PREVIEW_INPUT] printPreview: layer'));
});
