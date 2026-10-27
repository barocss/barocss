import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { exportIGES } from './packages/barocss-cad/src/index.ts';
export { parseSource, readSource, admitSource } from './apps/cad-viewer/source.js';
export { createViewerController } from './apps/cad-viewer/controller.js';
export { inspectDocumentPoint } from './apps/cad-viewer/native-inspection.js';`, resolveDir: root.pathname },
bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'own-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    if (path === '@barocss/viewer') return { path: 'viewer', namespace: 'mock-viewer' };
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
  builder.onLoad({ filter: /.*/, namespace: 'mock-viewer' }, () => ({
    contents: 'export const createViewer = async () => globalThis.__igesTestViewer;', loader: 'js' }));
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-iges-');
let api;
try { await writeFile(temp + '/test.mjs', built.outputFiles[0].contents); api = await import(pathToFileURL(temp + '/test.mjs').href); }
finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8');
const original = api.parseSource(wire), native = original.result.compiledAssets[0].model;
const iges = api.exportIGES(native, ['guide_path_native', 'support_patch_native']).iges;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function file(bytes, name = 'input.igs') {
  const input = Buffer.from(bytes);
  return { name, size: input.length, arrayBuffer: async () => input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) };
}
globalThis.HTMLCanvasElement = class extends EventTarget {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
  focus() {}
};
globalThis.window = new EventTarget();
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
function viewer() {
  const presenter = { calls: 0, show() { this.calls++; }, dispose() {} };
  return { presenter, instance: new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter) };
}

test('writer-compatible 126/128 input opens through document admission and original parameter queries', async () => {
  const source = await api.readSource(file(iges, 'part.IGES'));
  assert.equal(source.kind, 'document');
  assert.equal(source.origin.format, 'iges-5.3-126-128');
  assert.equal(source.origin.sourceSHA256, sha256(iges));
  assert.deepEqual(source.origin.mappings, [
    { directoryPointer: 1, nativeId: 'iges_d1', bodyId: 'iges_body_d1' },
    { directoryPointer: 3, nativeId: 'iges_d3', bodyId: 'iges_body_d3' },
  ]);
  assert.deepEqual(source.catalog.map(row => [row.id, row.kind, row.supported]),
    [['iges_body_d1', 'curve', true], ['iges_body_d3', 'surface', true]]);
  const { instance } = viewer(); api.admitSource(instance, source, source.origin.mappings.map(row => row.bodyId));
  const state = instance.getState();
  assert.equal(state.documentBodies.length, 2);
  for (const [id, query] of [['iges_body_d1', { kind: 'curve', parameter: 2 }],
    ['iges_body_d3', { kind: 'surface', u: 0, v: 0 }]]) {
    const binding = state.documentBodies.find(row => row.binding.bodyId === id);
    instance.selectGeometry(binding.ref);
    assert.ok(api.inspectDocumentPoint(source, instance.getState(), query).pointMM.every(Number.isFinite));
  }
});

test('the same bytes reopen deterministically, regardless of filename, and changed bytes have a distinct origin', async () => {
  const a = await api.readSource(file(iges, 'first.igs'));
  const b = await api.readSource(file(iges, 'renamed.iges'));
  assert.deepEqual(a.origin, b.origin); assert.deepEqual(a.source, b.source);
  assert.deepEqual(a.catalog, b.catalog); assert.equal(a.id, b.id);
  const changed = 'B' + iges.slice(1);
  const c = await api.readSource(file(changed));
  assert.notEqual(a.origin.sourceSHA256, c.origin.sourceSHA256);
  assert.notEqual(a.id, c.id);
  assert.deepEqual(a.origin.mappings, c.origin.mappings);
  assert.equal(a.source.assets[0].source, c.source.assets[0].source);
});

test('size, malformed records, unsupported entities and non-ASCII bytes are refused before admission', async () => {
  let read = false;
  await assert.rejects(api.readSource({ name: 'huge.igs', size: 1024 * 1024 + 1,
    async arrayBuffer() { read = true; throw Error('must not read'); } }), /1 MiB/);
  assert.equal(read, false);
  await assert.rejects(api.readSource({ name: 'bad.igs', size: 4, async arrayBuffer() { return new ArrayBuffer(1); } }), /declared size/);
  await assert.rejects(api.readSource(file(Buffer.from([0xff]))), /ASCII/);
  await assert.rejects(api.readSource(file(iges.replaceAll('\n', '\r\n'))), /IGES import/);
  assert.ok(iges.includes('2HMM'));
  await assert.rejects(api.readSource(file(iges.replace('2HMM', '2HIN'))), /units/);
  const globalRows = iges.split('\n'), indices = globalRows.flatMap((row, index) => row[72] === 'G' ? [index] : []);
  const globals = indices.map(index => globalRows[index].slice(0, 72)).join('');
  assert.ok(globals.includes('1.0,2,2HMM'));
  const wrongScale = globals.replace('1.0,2,2HMM', '2.0,2,2HMM');
  indices.forEach((index, offset) => { globalRows[index] = wrongScale.slice(offset * 72, (offset + 1) * 72) + globalRows[index].slice(72); });
  await assert.rejects(api.readSource(file(globalRows.join('\n'))), /scale/);
  const rows = iges.split('\n'), directory = rows.findIndex(row => row[72] === 'D');
  rows[directory] = '     124' + rows[directory].slice(8);
  await assert.rejects(api.readSource(file(rows.join('\n'))), /126\/128/);
});

test('up to sixteen IGES entities retain their Directory mappings and the app displays at most four', async () => {
  const model = structuredClone(native);
  const template = model.objects.find(value => value.kind === 'curve');
  while (model.objects.length < 16) model.objects.push({ ...structuredClone(template), id: `extra_${model.objects.length}` });
  const text = api.exportIGES(model, model.objects.map(value => value.id)).iges;
  const source = await api.readSource(file(text));
  assert.equal(source.origin.mappings.length, 16);
  assert.deepEqual(source.origin.mappings.map(value => value.directoryPointer), Array.from({ length: 16 }, (_, index) => 2 * index + 1));
  const { instance } = viewer();
  api.admitSource(instance, source, source.origin.mappings.slice(0, 4).map(value => value.bodyId));
  assert.equal(instance.getState().documentBodies.length, 4);
  assert.throws(() => api.admitSource(instance, source, source.origin.mappings.slice(0, 5).map(value => value.bodyId)), /1 to 4/);
});

test('a rejected IGES read does not change the accepted document, review or presentation', async () => {
  const { instance, presenter } = viewer();
  api.admitSource(instance, original, ['body_0_curve']);
  const before = instance.getState(), review = instance.captureReviewState(), calls = presenter.calls;
  await assert.rejects(api.readSource(file('not a supported IGES file')));
  assert.deepEqual(instance.getState(), before); assert.deepEqual(instance.captureReviewState(), review);
  assert.equal(presenter.calls, calls);
});

test('an invalid IGES file leaves the controller candidate and accepted scene unchanged', async () => {
  const { instance, presenter } = viewer();
  instance.attachPointerControls = instance.attachKeyboardControls = () => ({ dispose() {} });
  globalThis.__igesTestViewer = instance;
  const canvas = new HTMLCanvasElement(); let model;
  const controller = api.createViewerController({ canvas, stage: canvas, onChange: value => { model = value; } });
  try {
    await controller.start();
    await controller.openDocument({ name: 'existing.json', size: Buffer.byteLength(wire), text: async () => wire });
    controller.admit();
    const before = instance.getState(), review = instance.captureReviewState(), calls = presenter.calls;
    await controller.openDocument(file('unsupported'));
    assert.equal(model.candidate, null); assert.equal(model.statusError, true);
    assert.match(model.status, /Document not opened/);
    assert.deepEqual(instance.getState(), before); assert.deepEqual(instance.captureReviewState(), review);
    assert.equal(presenter.calls, calls);
  } finally { controller.dispose(); }
});
