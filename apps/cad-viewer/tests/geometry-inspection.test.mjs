import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Use the actual app guard, public CAD quadrature and public Viewer state.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { parseSource, admitSource } from './apps/cad-viewer/source.js';
export { inspectDocumentPoint, resolveDocumentInspection } from './apps/cad-viewer/native-inspection.js';
export { inspectDocumentGeometry, geometryInspectionDefaults } from './apps/cad-viewer/geometry-inspection.js';
export { queryCadDocumentCurveArcLength, queryCadDocumentSurfaceArea } from './packages/barocss-cad/src/index.ts';`, resolveDir: root.pathname },
bundle: true, platform: 'node', format: 'esm', write: false,
plugins: [{ name: 'own-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-geometry-inspection-');
let api;
try {
  await writeFile(temp + '/inspection.mjs', built.outputFiles[0].contents);
  api = await import(pathToFileURL(temp + '/inspection.mjs').href);
} finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8');
globalThis.HTMLCanvasElement = class {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
};
function setup(bodyId = 'body_0_skip', input = wire) {
  const source = api.parseSource(input, 'Original document.json');
  const presenter = { drawings: [], show(drawing) { this.drawings.push(drawing); } };
  const viewer = new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  api.admitSource(viewer, source, ['body_0_skip', 'body_0_surface']);
  const ref = viewer.getState().documentBodies.find(body => body.binding.bodyId === bodyId).ref;
  viewer.selectGeometry(ref);
  return { source, presenter, viewer, ref };
}
function withSkipCurve(curve) {
  const document = JSON.parse(wire);
  document.assets[0].source = document.assets[0].source.replace(/@curve #skip_path_native \{[\s\S]*?\n  \}/, curve);
  return JSON.stringify(document);
}

test('geometry inspection uses full original native length and parameterized area with native units', () => {
  for (const [bodyId, kind, expected, unit, domain] of [
    ['body_0_skip', 'curve', 8, 'mm', { parameter: [0, 1] }],
    ['body_0_surface', 'surface', 14, 'mm2', { u: [-2, 5], v: [-0, 3] }],
  ]) {
    const { source, presenter, viewer, ref } = setup(bodyId);
    const point = kind === 'curve' ? { kind, modelId: ref.modelId, curveId: ref.curveId, t: 0 }
      : { kind, modelId: ref.modelId, surfaceId: ref.surfaceId, u: -2, v: 0 };
    viewer.measureNativePoints(point, kind === 'curve' ? { ...point, t: 1 } : { ...point, u: 5, v: 3 });
    viewer.pan(50, 50);
    const state = viewer.getState(), before = structuredClone(state), sourceBefore = structuredClone(source);
    const calls = presenter.drawings.length, result = api.inspectDocumentGeometry(source, state);
    const binding = api.resolveDocumentInspection(source, state), defaults = api.geometryInspectionDefaults(kind);
    const native = kind === 'curve'
      ? api.queryCadDocumentCurveArcLength(binding.result, binding.reference, { interval: null,
        absoluteToleranceMM: defaults.absoluteTolerance, relativeTolerance: defaults.relativeTolerance,
        maximumEvaluations: 4096, maximumSubdivisions: 128, maximumDepth: 12 })
      : api.queryCadDocumentSurfaceArea(binding.result, binding.reference, { region: null,
        absoluteToleranceMM2: defaults.absoluteTolerance, relativeTolerance: defaults.relativeTolerance,
        maximumEvaluations: 16384, maximumSubdivisions: 128, maximumDepth: 8 });
    assert.equal(result.kind, kind); assert.equal(result.unit, unit); assert.deepEqual(result.domain, domain);
    assert.ok(Math.abs(result.value - expected) < 1e-6);
    assert.equal(result.value, kind === 'curve' ? native.estimatedLengthMM : native.areaEstimateMM2);
    assert.equal(result.errorEstimate, kind === 'curve' ? native.errorEstimateMM : native.errorEstimateMM2);
    assert.equal(result.criterionSatisfied, true); assert.equal(result.certification, 'not-certified');
    assert.deepEqual(result.reference, binding.reference);
    assert.deepEqual(Object.keys(result), ['kind', 'reference', 'value', 'errorEstimate', 'unit', 'domain',
      'absoluteTolerance', 'relativeTolerance', 'criterionSatisfied', 'certification']);
    assert.deepEqual(state, before); assert.deepEqual(viewer.getState(), before);
    assert.deepEqual(source, sourceBefore); assert.equal(presenter.drawings.length, calls);
    result.reference.assetId = 'changed'; Object.values(result.domain)[0][0] = 100;
    assert.deepEqual(viewer.getState(), before); assert.deepEqual(source, sourceBefore);
  }
});

test('geometry tolerance options retain CAD range authority and cannot replace the fixed work budgets', () => {
  for (const bodyId of ['body_0_skip', 'body_0_surface']) {
    const { viewer, source, presenter } = setup(bodyId), state = viewer.getState(), sourceBefore = structuredClone(source);
    const previous = api.inspectDocumentGeometry(source, state), accepted = structuredClone(previous), calls = presenter.drawings.length;
    const options = { absoluteTolerance: 1e-5, relativeTolerance: 1e-7 }, optionsBefore = structuredClone(options);
    const changed = api.inspectDocumentGeometry(source, state, options);
    assert.equal(changed.absoluteTolerance, options.absoluteTolerance); assert.equal(changed.relativeTolerance, options.relativeTolerance);
    assert.deepEqual(options, optionsBefore);
    if (previous.kind === 'curve') {
      assert.equal(api.inspectDocumentGeometry(source, state, { absoluteTolerance: 1e-9, relativeTolerance: 0 }).absoluteTolerance, 1e-9);
      assert.throws(() => api.inspectDocumentGeometry(source, state, { absoluteTolerance: 2 }));
    } else assert.throws(() => api.inspectDocumentGeometry(source, state, { absoluteTolerance: 1e-9 }));
    const defaults = api.geometryInspectionDefaults(previous.kind); defaults.absoluteTolerance = 999;
    assert.equal(api.geometryInspectionDefaults(previous.kind).absoluteTolerance, previous.absoluteTolerance);
    let getters = 0;
    const getter = Object.defineProperty({}, 'absoluteTolerance', { enumerable: true, get() { getters++; return 1e-6; } });
    for (const invalid of [null, [], { absoluteTolerance: 0 }, { absoluteTolerance: 11 },
      { absoluteTolerance: NaN }, { absoluteTolerance: Infinity }, { relativeTolerance: -.01 },
      { relativeTolerance: .02 }, { relativeTolerance: undefined }, { maximumEvaluations: 1 },
      { maximumDepth: 0 }, { interval: [0, 1] }, { region: null }, getter]) {
      assert.throws(() => api.inspectDocumentGeometry(source, state, invalid));
      assert.deepEqual(previous, accepted); assert.deepEqual(viewer.getState(), state);
      assert.deepEqual(source, sourceBefore); assert.equal(presenter.drawings.length, calls);
    }
    assert.equal(getters, 0);
  }
  assert.throws(() => api.geometryInspectionDefaults('assembly'));
});

test('point and geometry inspection share the same accepted visible source binding guard', () => {
  const { source, viewer, presenter } = setup(), state = viewer.getState(), calls = presenter.drawings.length;
  const resolved = api.resolveDocumentInspection(source, state);
  assert.equal(resolved.result, source.result); assert.equal(resolved.geometry.kind, 'curve');
  assert.equal(resolved.reference.bodyId, 'body_0_skip');
  assert.deepEqual(api.inspectDocumentPoint(source, state, { kind: 'curve', parameter: 0 }).pointMM, [-2, 5, 0]);
  assert.ok(Math.abs(api.inspectDocumentGeometry(source, state).value - 8) < 1e-10);
  const staleSource = { ...source, revision: source.revision + 1 };
  const hidden = { ...state, visibleGeometry: [] };
  for (const inspect of [
    (source, state) => api.inspectDocumentPoint(source, state, { kind: 'curve', parameter: 0 }),
    api.inspectDocumentGeometry,
  ]) {
    assert.throws(() => inspect(staleSource, state), /identity or revision/);
    assert.throws(() => inspect(source, hidden), /visible/);
  }
  assert.deepEqual(viewer.getState(), state); assert.equal(presenter.drawings.length, calls);
});

test('native geometry admission and budget failures return no partial metric and preserve all inputs', () => {
  // Degree 4 is a candidate admission failure, before native metric inspection.
  const current = setup(), query = { kind: 'curve', parameter: 0 };
  current.viewer.measureNativePoints({ kind: 'curve', modelId: current.ref.modelId, curveId: current.ref.curveId, t: 0 },
    { kind: 'curve', modelId: current.ref.modelId, curveId: current.ref.curveId, t: 1 });
  const acceptedState = current.viewer.getState(), sourceBefore = structuredClone(current.source);
  const acceptedPoint = api.inspectDocumentPoint(current.source, acceptedState, query);
  const acceptedMetric = api.inspectDocumentGeometry(current.source, acceptedState);
  const pointBefore = structuredClone(acceptedPoint), metricBefore = structuredClone(acceptedMetric);
  const calls = current.presenter.drawings.length;
  const candidate = api.parseSource(withSkipCurve(`@curve #skip_path_native {
    type: nurbs; degree: 4; knots: [0,0,0,0,0,1,1,1,1,1];
    control-points: [[-2,5,0],[0,5,0],[2,5,0],[4,5,0],[6,5,0]];
    weights: [1,1,1,1,1];
  }`)), candidateBefore = structuredClone(candidate);
  assert.throws(() => api.admitSource(current.viewer, candidate, ['body_0_skip', 'body_0_surface']),
    error => error.name === 'WideAdaptiveCurveSamplingError' && error.code === 'INPUT');
  assert.deepEqual(current.viewer.getState(), acceptedState);
  assert.deepEqual(current.source, sourceBefore); assert.deepEqual(candidate, candidateBefore);
  assert.deepEqual(acceptedPoint, pointBefore); assert.deepEqual(acceptedMetric, metricBefore);
  assert.deepEqual(api.inspectDocumentPoint(current.source, current.viewer.getState(), query), pointBefore);
  assert.deepEqual(api.inspectDocumentGeometry(current.source, current.viewer.getState()), metricBefore);
  assert.equal(current.presenter.drawings.length, calls);

  // This positive-weight straight Curve admits one display chord. Its native
  // parameter speed is concentrated near zero, beyond the fixed metric depth.
  const budgetCurve = `@curve #skip_path_native {
    type: nurbs; degree: 1; knots: [0,0,1,1];
    control-points: [[-2,5,0],[6,5,0]]; weights: [1,1000000];
  }`;
  const { source, viewer, presenter } = setup('body_0_skip', withSkipCurve(budgetCurve));
  const state = viewer.getState(), before = structuredClone(source), budgetCalls = presenter.drawings.length;
  const point = api.inspectDocumentPoint(source, state, query), savedPoint = structuredClone(point);
  const options = { absoluteTolerance: 1e-9, relativeTolerance: 0 };
  assert.throws(() => api.inspectDocumentGeometry(source, state, options), error =>
    error.name === 'CadCurveArcLengthError' && error.code === 'BUDGET');
  assert.deepEqual(point, savedPoint); assert.deepEqual(viewer.getState(), state);
  assert.deepEqual(source, before); assert.deepEqual(options, { absoluteTolerance: 1e-9, relativeTolerance: 0 });
  assert.equal(presenter.drawings.length, budgetCalls);
});
