import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { createViewerController } from './apps/cad-viewer/controller.js';
export { createReviewFile } from './apps/cad-viewer/review-file.js';`, resolveDir: root.pathname },
bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    if (path === '@barocss/viewer') return { path: 'viewer', namespace: 'mock-viewer' };
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
  builder.onLoad({ filter: /.*/, namespace: 'mock-viewer' }, () => ({
    contents: 'export const createViewer = async () => globalThis.__assemblyReviewViewer;', loader: 'js' }));
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-assembly-review-');
let api;
try { await writeFile(temp + '/test.mjs', built.outputFiles[0].contents); api = await import(pathToFileURL(temp + '/test.mjs').href); }
finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision0.json', root), 'utf8');
const documentWire = await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8');
globalThis.HTMLCanvasElement = class extends EventTarget {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
  focus() {}
};
globalThis.window = new EventTarget();
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const file = text => ({ size: Buffer.byteLength(text), name: 'test.json', text: async () => text });
async function setup(sourceWire = wire) {
  const canvas = new HTMLCanvasElement();
  const presenter = { show() {}, setLighting() {}, dispose() {} };
  const viewer = new api.Viewer(canvas, { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  viewer.attachPointerControls = viewer.attachKeyboardControls = () => ({ dispose() {} });
  globalThis.__assemblyReviewViewer = viewer;
  let model;
  const controller = api.createViewerController({ canvas, stage: canvas, onChange: next => { model = next; } });
  await controller.start();
  await controller.openDocument(file(sourceWire)); controller.admit();
  function setPoint(id, endpoint) {
    const binding = viewer.getState().assemblyInstances.find(value => value.instanceId === id);
    controller.select(binding.ref); controller.setAssemblyPoint(endpoint);
  }
  return { viewer, presenter, controller, get model() { return model; }, setPoint };
}
function measurement(model) {
  const query = point => ({ assemblyId: point.assemblyId, assemblyRevision: point.assemblyRevision,
    instanceId: point.instanceId, reference: point.reference, query: point.query });
  return { first: query(model.assemblyPoints[0]), second: query(model.assemblyPoints[1]),
    distanceMM: model.assemblyDistance, metric: 'straight-line', space: 'assembly-space-xyz', certification: 'not-certified' };
}
async function review(context, pair = measurement(context.model)) {
  return api.createReviewFile(context.viewer.captureReviewState(), null, context.model.active.kind === 'assembly'
    ? window.cadViewerEvidence.source() : null, undefined, [], pair);
}
function accepted(context) {
  return { review: context.viewer.captureReviewState(), points: structuredClone(context.model.assemblyPoints),
    distance: context.model.assemblyDistance, named: window.cadViewerEvidence.namedViews() };
}

test('assembly review restores both SDK-evaluated points and distance; a review without distance clears them', async () => {
  const context = await setup();
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const before = accepted(context), saved = await review(context);
    context.controller.clearAssemblyPoints();
    await context.controller.openReview(file(JSON.stringify(saved)));
    assert.deepEqual(accepted(context), before);
    assert.equal(context.model.statusError, false);
    const withoutDistance = await review(context, null);
    await context.controller.openReview(file(JSON.stringify(withoutDistance)));
    assert.deepEqual(context.model.assemblyPoints, [null, null]);
    assert.equal(context.model.assemblyDistance, null);
  } finally { context.controller.dispose(); }
});

test('bad distance, hidden target, bad named view, and source mismatch leave the accepted scene and points intact', async () => {
  const context = await setup();
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const valid = await review(context), before = accepted(context);
    const badDistance = structuredClone(valid); badDistance.assemblyMeasurement.distanceMM += 1;
    const hidden = structuredClone(valid);
    const target = context.viewer.getState().assemblyInstances.find(row => row.instanceId === 'child').ref;
    hidden.review.visibleGeometry = hidden.review.visibleGeometry.filter(ref => ref.modelId !== target.modelId);
    hidden.review.selectedGeometry = null;
    const badNamed = structuredClone(valid);
    badNamed.namedViews = [{ name: 'bad', review: structuredClone(valid.review), measurement: null }];
    badNamed.namedViews[0].review.camera.near = -1;
    const wrongSource = structuredClone(valid); wrongSource.sourceSHA256 = '0'.repeat(64);
    for (const altered of [badDistance, hidden, badNamed, wrongSource]) {
      await context.controller.openReview(file(JSON.stringify(altered)));
      assert.equal(context.model.statusError, true);
      assert.deepEqual(accepted(context), before);
    }
  } finally { context.controller.dispose(); }
});

test('point changes while the review is read prevent a stale restore', async () => {
  const context = await setup();
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const saved = await review(context);
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    const pending = context.controller.openReview({ size: 1, text: () => waiting });
    context.controller.clearAssemblyPoints();
    const before = accepted(context);
    release(JSON.stringify(saved)); await pending;
    assert.equal(context.model.statusError, true);
    assert.match(context.model.status, /changed/);
    assert.deepEqual(accepted(context), before);
  } finally { context.controller.dispose(); }
});

test('download stores a complete pair only and never stores a partial point', async () => {
  const context = await setup();
  const oldDocument = globalThis.document, oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  let saved;
  globalThis.document = { createElement: () => ({ click() {} }) };
  URL.createObjectURL = blob => { saved = blob; return 'blob:review'; };
  URL.revokeObjectURL = () => {};
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const expected = measurement(context.model);
    await context.controller.downloadReview();
    assert.deepEqual(JSON.parse(await saved.text()).assemblyMeasurement, expected);
    context.controller.clearAssemblyPoints(); context.setPoint('child', 'a');
    await context.controller.downloadReview();
    assert.equal(JSON.parse(await saved.text()).assemblyMeasurement, null);
  } finally {
    context.controller.dispose();
    globalThis.document = oldDocument; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
  }
});

test('a failed review presentation preserves the accepted review and assembly measurement', async () => {
  const context = await setup();
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const saved = await review(context), before = accepted(context);
    let first = true;
    context.presenter.show = () => { if (first) { first = false; throw new Error('present failed'); } };
    await context.controller.openReview(file(JSON.stringify(saved)));
    assert.equal(context.model.statusError, true);
    assert.deepEqual(accepted(context), before);
  } finally { context.controller.dispose(); }
});

test('changing points while the review is hashed prevents a stale download', async () => {
  const context = await setup();
  const oldDocument = globalThis.document, oldCreate = URL.createObjectURL;
  let created = false;
  globalThis.document = { createElement: () => ({ click() {} }) };
  URL.createObjectURL = () => { created = true; return 'blob:review'; };
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const pending = context.controller.downloadReview();
    context.controller.clearAssemblyPoints();
    await pending;
    assert.equal(created, false); assert.equal(context.model.statusError, true);
    assert.match(context.model.status, /changed/);
    assert.deepEqual(context.model.assemblyPoints, [null, null]);
  } finally {
    context.controller.dispose(); globalThis.document = oldDocument; URL.createObjectURL = oldCreate;
  }
});

test('a failed inspection preserves the accepted pair and its distance in an immediate review save', async () => {
  const context = await setup();
  const oldDocument = globalThis.document, oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  let blob;
  globalThis.document = { createElement: () => ({ click() {} }) };
  URL.createObjectURL = value => { blob = value; return 'blob:review'; };
  URL.revokeObjectURL = () => {};
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const initial = accepted(context);
    context.controller.inspectAssemblyPoint({ kind: 'curve', parameter: Infinity });
    assert.ok(context.model.assemblyInspection.error);
    assert.equal(context.model.assemblyDistance, initial.distance);
    assert.equal(context.model.assemblyDistanceError, '');
    assert.deepEqual(context.model.assemblyPoints, initial.points);
    await context.controller.downloadReview();
    const saved = JSON.parse(await blob.text());
    assert.equal(saved.assemblyMeasurement.distanceMM, initial.distance);
    context.controller.clearAssemblyPoints();
    await context.controller.openReview(file(JSON.stringify(saved)));
    assert.deepEqual(accepted(context), initial);
  } finally {
    context.controller.dispose(); globalThis.document = oldDocument;
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
  }
});

test('a failed distance reevaluation keeps the value hidden until reevaluation succeeds', async () => {
  const context = await setup();
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const distance = context.model.assemblyDistance;
    const original = context.viewer.measureAssemblyPoints.bind(context.viewer);
    context.viewer.measureAssemblyPoints = () => { throw new Error('reevaluation failed'); };
    context.controller.setAssemblyPoint('b');
    assert.equal(context.model.assemblyDistance, null);
    context.controller.inspectAssemblyPoint({ kind: 'curve', parameter: 2 });
    assert.equal(context.model.assemblyDistance, null);
    assert.match(context.model.assemblyDistanceError, /reevaluation failed/);
    context.viewer.measureAssemblyPoints = original;
    context.controller.inspectAssemblyPoint({ kind: 'curve', parameter: 2 });
    assert.equal(context.model.assemblyDistance, distance);
  } finally { context.controller.dispose(); }
});

test('direct replacement loads only after confirmation and invalid choices preserve the scene', async () => {
  const context = await setup();
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    const original = accepted(context), originalIds = [...context.model.admitted];
    assert.equal(originalIds.length, 4);
    context.controller.openBodies();
    assert.deepEqual(accepted(context), original);
    context.controller.cancelCandidate();
    assert.deepEqual(accepted(context), original);
    context.controller.openBodies();
    for (const replacement of [
      { targetId: 'child', replacedId: 'shared_root' },
      { targetId: 'parent', replacedId: 'missing' },
      { targetId: 'missing', replacedId: 'child' },
    ]) {
      context.controller.admit(replacement);
      assert.ok(context.model.admissionError);
      assert.deepEqual(accepted(context), original);
      assert.deepEqual(context.model.admitted, originalIds);
    }
    context.controller.admit({ targetId: 'parent', replacedId: 'child' });
    assert.equal(context.model.candidate, null);
    assert.deepEqual(context.model.admitted, originalIds.map(id => id === 'child' ? 'parent' : id));
    assert.equal(context.model.admitted.length, 4);
    assert.equal(context.model.assemblyPoints[0], null);
    assert.equal(context.model.assemblyPoints[1].instanceId, 'shared_root');
    assert.equal(context.model.assemblyDistance, null);
  } finally { context.controller.dispose(); }
});

test('a presenter failure during replacement redraws the accepted review and keeps retry state', async () => {
  const context = await setup();
  try {
    context.setPoint('child', 'a'); context.setPoint('shared_root', 'b');
    await context.controller.saveNamedView('Keep');
    const original = accepted(context), ids = [...context.model.admitted];
    context.controller.openBodies();
    let calls = 0;
    context.presenter.show = () => { calls++; if (calls === 1) throw new Error('replacement failed'); };
    context.controller.admit({ targetId: 'parent', replacedId: 'child' });
    assert.equal(calls, 2);
    assert.match(context.model.admissionError, /replacement failed/);
    assert.ok(context.model.candidate);
    assert.deepEqual(context.model.admitted, ids);
    assert.deepEqual(accepted(context), original);
    context.controller.admit({ targetId: 'parent', replacedId: 'child' });
    assert.equal(context.model.candidate, null);
    assert.ok(context.model.admitted.includes('parent'));
  } finally { context.controller.dispose(); }
});

test('replacement reports a recovery failure without adopting the requested members', async () => {
  const context = await setup();
  try {
    const ids = [...context.model.admitted]; context.controller.openBodies();
    context.presenter.show = () => { throw new Error('presenter unavailable'); };
    context.controller.admit({ targetId: 'parent', replacedId: 'child' });
    assert.match(context.model.admissionError, /View recovery failed/);
    assert.deepEqual(context.model.admitted, ids);
    assert.ok(context.model.candidate);
  } finally { context.controller.dispose(); }
});

test('failed document replacement preserves the SDK distance cache after UI Clear', async () => {
  const context = await setup(documentWire);
  try {
    context.controller.openBodies();
    for (const id of ['body_0_skip', 'body_1_surface']) context.controller.toggleAdmission(id, true);
    context.controller.admit();
    assert.equal(context.model.admitted.length, 4);
    const curve = context.viewer.getState().documentBodies.find(body => body.binding.bodyId === 'body_0_curve');
    context.controller.select(curve.ref);
    context.controller.setInspectedMeasurementPoint('a');
    context.controller.inspectDocumentPoint({ kind: 'curve', parameter: 7 });
    context.controller.setInspectedMeasurementPoint('b');
    assert.ok(context.model.measurement.result);
    context.controller.clearMeasurement();
    assert.equal(context.model.measurement.result, null);
    context.viewer.setLighting({ ambientStrength: 0.3, directionalStrength: 0.5, direction: [0, 1, 0] });
    context.controller.setInspectedMeasurementPoint('a');
    const hostMeasurement = structuredClone(context.model.measurement);
    assert.equal(hostMeasurement.active, true);
    assert.equal(hostMeasurement.points.length, 1);
    const beforeState = context.viewer.getState(), beforeReview = context.viewer.captureReviewState();
    assert.ok(beforeState.nativeMeasurement);
    assert.deepEqual(beforeState.lighting, { ambientStrength: 0.3, directionalStrength: 0.5, direction: [0, 1, 0] });
    context.controller.openBodies();
    let calls = 0;
    context.presenter.show = () => { calls++; if (calls === 1) throw new Error('presenter failed'); };
    context.controller.admit({ targetId: 'body_1_curve', replacedId: 'body_0_skip' });
    assert.equal(calls, 2);
    assert.match(context.model.admissionError, /presenter failed/);
    assert.deepEqual(context.viewer.getState(), beforeState);
    assert.deepEqual(context.viewer.captureReviewState(), beforeReview);
    assert.deepEqual(context.model.measurement, hostMeasurement);
  } finally { context.controller.dispose(); }
});
