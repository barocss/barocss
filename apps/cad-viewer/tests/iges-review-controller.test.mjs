import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { exportIGES } from './packages/barocss-cad/src/index.ts';
export { parseSource } from './apps/cad-viewer/source.js';
export { createViewerController } from './apps/cad-viewer/controller.js';`, resolveDir: root.pathname },
bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'own-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    if (path === '@barocss/viewer') return { path: 'viewer', namespace: 'mock-viewer' };
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
  builder.onLoad({ filter: /.*/, namespace: 'mock-viewer' }, () => ({
    contents: 'export const createViewer = async () => globalThis.__igesReviewViewer;', loader: 'js' }));
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-iges-review-');
let api;
try { await writeFile(temp + '/test.mjs', built.outputFiles[0].contents); api = await import(pathToFileURL(temp + '/test.mjs').href); }
finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8');
const native = api.parseSource(wire).result.compiledAssets[0].model;
const iges = api.exportIGES(native, ['guide_path_native', 'support_patch_native']).iges;
globalThis.HTMLCanvasElement = class extends EventTarget {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
  focus() {}
};
globalThis.window = new EventTarget();
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const file = (text, name) => {
  const bytes = Buffer.from(text);
  return { name, size: bytes.length, text: async () => text,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};
async function setup() {
  const canvas = new HTMLCanvasElement(), presenter = { show() {}, dispose() {} };
  const viewer = new api.Viewer(canvas, { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  viewer.attachPointerControls = viewer.attachKeyboardControls = () => ({ dispose() {} });
  globalThis.__igesReviewViewer = viewer; let model;
  const controller = api.createViewerController({ canvas, stage: canvas, onChange: value => { model = value; } });
  await controller.start();
  return { controller, viewer, get model() { return model; } };
}
async function open(context, text, name) {
  await context.controller.openDocument(file(text, name));
  assert.ok(context.model.candidate, context.model.status);
  context.controller.admit();
  assert.equal(context.model.candidate, null, context.model.admissionError);
}
async function measureAndName(context, name) {
  const body = context.viewer.getState().documentBodies.find(row => row.ref.kind === 'curve');
  context.controller.select(body.ref);
  context.controller.inspectDocumentPoint({ kind: 'curve', parameter: 2 });
  context.controller.setInspectedMeasurementPoint('a');
  context.controller.inspectDocumentPoint({ kind: 'curve', parameter: 7 });
  context.controller.setInspectedMeasurementPoint('b');
  assert.ok(context.model.measurement.result);
  assert.equal(await context.controller.saveNamedView(name), true, context.model.status);
}
function accepted(context) {
  return { state: context.viewer.getState(), review: context.viewer.captureReviewState(),
    source: window.cadViewerEvidence.source(), measurement: structuredClone(context.model.measurement),
    names: window.cadViewerEvidence.namedViews() };
}
async function captureDownload(context) {
  const previousDocument = globalThis.document, previousCreate = URL.createObjectURL, previousRevoke = URL.revokeObjectURL;
  let blob;
  globalThis.document = { createElement: () => ({ click() {} }) };
  URL.createObjectURL = value => { blob = value; return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  try {
    await context.controller.downloadReview();
    assert.ok(blob, context.model.status);
    return await blob.text();
  } finally { globalThis.document = previousDocument; URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke; }
}
async function expectRefused(context, text) {
  const before = accepted(context);
  await context.controller.openReview(file(text, 'review.json'));
  assert.equal(context.model.statusError, true);
  assert.match(context.model.status, /original CAD file/);
  assert.deepEqual(accepted(context), before);
}

test('real writer IGES review saves and restores the Viewer, measurement and named views', async () => {
  const context = await setup();
  try {
    await open(context, iges, 'part.igs'); await measureAndName(context, 'View A');
    const expected = accepted(context), saved = await captureDownload(context), data = JSON.parse(saved);
    assert.equal(data.origin.format, 'iges-5.3-126-128');
    assert.equal(data.origin.mappings.length, 2);
    assert.equal(data.measurement.distanceMM, expected.measurement.result.distanceMM);
    context.controller.clearMeasurement(); context.controller.standardView('front');
    await context.controller.openReview(file(saved, 'review.json'));
    assert.equal(context.model.statusError, false);
    assert.deepEqual(accepted(context), expected);
  } finally { context.controller.dispose(); }
});

test('different IGES bytes with the same generated geometry refuse the old review and preserve the new work', async () => {
  const context = await setup();
  try {
    await open(context, iges, 'original.igs'); await measureAndName(context, 'Original');
    const sourceA = window.cadViewerEvidence.source(), saved = await captureDownload(context);
    const altered = 'B' + iges.slice(1);
    await open(context, altered, 'changed.igs');
    const sourceB = window.cadViewerEvidence.source();
    assert.equal(sourceA.assets[0].source, sourceB.assets[0].source);
    assert.notEqual(sourceA.documentId, sourceB.documentId);
    await measureAndName(context, 'Changed');
    await expectRefused(context, saved);
  } finally { context.controller.dispose(); }
});

test('native CAD and IGES review contexts refuse each other without changing accepted work', async () => {
  const context = await setup();
  try {
    await open(context, wire, 'native.json'); await measureAndName(context, 'CAD');
    const nativeReview = await captureDownload(context);
    await open(context, iges, 'part.iges'); await measureAndName(context, 'IGES');
    const igesReview = await captureDownload(context);
    await expectRefused(context, nativeReview);
    await open(context, wire, 'native.json'); await measureAndName(context, 'CAD again');
    await expectRefused(context, igesReview);
  } finally { context.controller.dispose(); }
});

test('origin is required even when the generated CAD document is byte-identical', async () => {
  const context = await setup();
  try {
    await open(context, iges, 'part.igs'); await measureAndName(context, 'IGES source');
    const derived = JSON.stringify(window.cadViewerEvidence.source());
    const igesReview = await captureDownload(context);
    await open(context, derived, 'derived.json'); await measureAndName(context, 'CAD source');
    assert.deepEqual(window.cadViewerEvidence.source(), JSON.parse(derived));
    const nativeReview = await captureDownload(context);
    await expectRefused(context, igesReview);
    await open(context, iges, 'part.igs'); await measureAndName(context, 'IGES restored');
    assert.deepEqual(window.cadViewerEvidence.source(), JSON.parse(derived));
    await expectRefused(context, nativeReview);
  } finally { context.controller.dispose(); }
});
