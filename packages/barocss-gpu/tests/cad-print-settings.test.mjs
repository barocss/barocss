// Current-source document control contracts. No worker, Model evaluation, browser or renderer run.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-print-settings.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temp = await mkdtemp(join(tmpdir(), 'cad-print-settings-'));
let printOptionsOf, withPrintPreviewSettings, emptyDoc, carryOver, readStudioDoc;
try {
  const outfile = join(temp, 'settings.mjs');
  await build({
    stdin: { contents: 'export * from "./apps/cad-studio/src/viewport/printSettings.ts"; export {emptyDoc,carryOver} from "./packages/barocss-cad-model/src/engine/doc.ts"; export {readStudioDoc} from "./packages/barocss-cad-model/src/engine/migrate.ts";', resolveDir: root },
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
  });
  ({ printOptionsOf, withPrintPreviewSettings, emptyDoc, carryOver, readStudioDoc } = await import(pathToFileURL(outfile).href));
} finally { await rm(temp, { recursive: true, force: true }); }

const frozenDoc = () => {
  const doc = emptyDoc(); Object.freeze(doc.parameters); Object.freeze(doc.nodes); Object.freeze(doc.outputs); return Object.freeze(doc);
};

test('omitted settings remain absent while display defaults retain estimate and direction provenance', () => {
  const doc = frozenDoc(), before = JSON.stringify(doc);
  assert.deepEqual(printOptionsOf(doc), { layer: 0, supports: true, printed: true });
  assert.equal(printOptionsOf(doc).layerMM, undefined); assert.equal(printOptionsOf(doc).direction, undefined);
  assert.equal(Object.hasOwn(printOptionsOf(doc), 'layerMM'), false); assert.equal(Object.hasOwn(printOptionsOf(doc), 'direction'), false);
  assert.equal(Object.hasOwn(doc, 'printPreview'), false); assert.equal(Object.hasOwn(doc, 'print'), false);
  assert.equal(JSON.stringify(doc), before);
  const authored = { ...doc, print: { direction: [0, -2, 0] }, printPreview: { version: 1, layerMM: 0.25 } };
  const options = printOptionsOf(authored, 37);
  assert.deepEqual(options, { layer: 0, supports: true, printed: true, layerMM: 0.25, direction: [0, -2, 0], limitDeg: 37 });
  options.direction[0] = 9; assert.deepEqual(authored.print.direction, [0, -2, 0], 'options do not alias the authored direction');
});

test('zero and false survive immutable patches; omitted values stay saved and explicit undefined deletes only that field', () => {
  const original = frozenDoc(), first = withPrintPreviewSettings(original, { layer: 7, layerMM: 0.4, supports: true, printed: true });
  Object.freeze(first.printPreview); Object.freeze(first);
  const next = withPrintPreviewSettings(first, { layer: 0, supports: false, printed: false });
  assert.notEqual(next, first); assert.notEqual(next.printPreview, first.printPreview);
  assert.deepEqual(next.printPreview, { version: 1, layer: 0, layerMM: 0.4, supports: false, printed: false });
  assert.deepEqual(printOptionsOf(next), { layer: 0, supports: false, printed: false, layerMM: 0.4 });
  const removed = withPrintPreviewSettings(next, { layerMM: undefined, supports: undefined });
  assert.deepEqual(removed.printPreview, { version: 1, layer: 0, printed: false });
  assert.equal(Object.hasOwn(removed.printPreview, 'layerMM'), false); assert.equal(Object.hasOwn(removed.printPreview, 'supports'), false);
  assert.deepEqual(printOptionsOf(removed), { layer: 0, supports: true, printed: false });
  assert.equal(Object.hasOwn(removed, 'print'), false); assert.equal(next.nodes, original.nodes); assert.equal(next.outputs, original.outputs);
  assert.deepEqual(first.printPreview, { version: 1, layer: 7, layerMM: 0.4, supports: true, printed: true });
});

test('actual Model validators refuse invalid controls, unknown fields, version changes and invalid nested document state', () => {
  const doc = frozenDoc();
  for (const patch of [{ layer: -1 }, { layer: 0.5 }, { layer: Number.MAX_SAFE_INTEGER + 1 }, { layerMM: 0 }, { layerMM: NaN }, { layerMM: Infinity }, { supports: 0 }, { printed: 'false' }, { version: 2 }, { version: undefined }, { direction: [0, 0, 1] }]) {
    assert.throws(() => withPrintPreviewSettings(doc, patch), /\[PRINT_PREVIEW_INPUT\]/);
  }
  const invalid = { ...doc, printPreview: { version: 1, layer: -1 } };
  assert.throws(() => printOptionsOf(invalid), /\[PRINT_PREVIEW_INPUT\]/);
  assert.throws(() => withPrintPreviewSettings(invalid, { layer: 0 }), /\[PRINT_PREVIEW_INPUT\]/);
  const nested = { ...doc, instances: [{ id: 'child', doc: invalid }] };
  assert.throws(() => printOptionsOf(nested), /instances\[0\]\.doc\.printPreview/);
  assert.throws(() => withPrintPreviewSettings(nested, { printed: true }), /instances\[0\]\.doc\.printPreview/);
  assert.equal(Object.hasOwn(doc, 'printPreview'), false);
});

test('actual Model reader and carryOver retain sparse settings through an independent model command and JSON roundtrip', () => {
  const was = emptyDoc(), current = withPrintPreviewSettings(was, { layer: 0, supports: false, printed: false });
  // An independent command rebuilt the geometry nodes from the previously evaluated document.
  const command = { ...was, nodes: [...was.nodes], outputs: { ...was.outputs } };
  const carried = carryOver(command, was, current);
  assert.equal(carried.printPreview, current.printPreview); assert.equal(carried.nodes, command.nodes);
  const read = readStudioDoc(JSON.stringify(carried)); assert.equal('error' in read, false);
  assert.deepEqual(read.doc.printPreview, { version: 1, layer: 0, supports: false, printed: false });
  assert.deepEqual(printOptionsOf(read.doc), { layer: 0, supports: false, printed: false });
  assert.equal(Object.hasOwn(read.doc.printPreview, 'layerMM'), false); assert.equal(Object.hasOwn(read.doc, 'print'), false);
  const authored = withPrintPreviewSettings({ ...read.doc, print: { direction: [1, 0, 0] } }, { layerMM: 0.3 });
  const readAuthored = readStudioDoc(JSON.stringify(authored)); assert.equal('error' in readAuthored, false);
  assert.deepEqual(printOptionsOf(readAuthored.doc).direction, [1, 0, 0]); assert.equal(printOptionsOf(readAuthored.doc).layerMM, 0.3);
});
