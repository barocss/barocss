import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { outputFiles } = await build({
  stdin: { contents: `
    export { querySelectedNativeSurfaceCurvature } from './examples/viewer-native-scene-replacement/selected-native-surface-curvature.js';
    export { compileCadModel } from '@barocss/cad';
  `, resolveDir: root, sourcefile: 'surface-curvature-contract.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
});
const { querySelectedNativeSurfaceCurvature, compileCadModel } =
  await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));

const source = '@model cloth_native_control { version:0; length-unit:mm; '
  + '@surface #original_panel { type:nurbs; degree-u:1; degree-v:1; '
  + 'knots-u:[-0,-0,5,5]; knots-v:[10,10,20,20]; '
  + 'control-points:[[[-700,300,-700],[-700,300,700]],[[700,300,-700],[700,300,700]]]; '
  + 'weights:[[1,1],[1,1]]; } }';
const compiled = compileCadModel(source, { sourceVersion: 0 });
assert(compiled.ok, 'Authentic complete Source0 must compile');
const ref = { kind: 'surface', modelId: compiled.model.name, surfaceId: 'original_panel' };
const state = { status: 'ready', native: { source, model: compiled.model },
  document: null, modelSet: null, assembly: null, shell: null, qualifiedFaceScene: null,
  uniformCurve: null, selectedUniformCurve: null, mixedDepth: null,
  surfaces: [{ modelId: ref.modelId, surfaceId: ref.surfaceId }], curves: [],
  selectedGeometry: ref };
const viewer = { getState: () => structuredClone(state) };
const expected = { source, model: structuredClone(compiled.model), ref: structuredClone(ref) };

test('original Surface curvature is read-only, fully pinned and uses native U/V', () => {
  const before = structuredClone(state);
  const report = querySelectedNativeSurfaceCurvature(viewer, expected, { u: 2.5, v: 15 });
  assert.deepEqual(report.parameters, { u: 2.5, v: 15 });
  assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.coordinateFrame, 'native-authored');
  assert.equal(report.certification, 'not-certified');
  assert.equal(report.curvature.meanCurvaturePerMM, 0);
  assert.equal(report.curvature.gaussianCurvaturePerMM2, 0);
  assert(report.curvature.principalCurvaturesPerMM.every(value => value === 0));
  assert.deepEqual(state, before, 'Read-only query must not change the caller scene');
  report.scope.model.name = 'modified';
  assert.equal(state.native.model.name, ref.modelId, 'Returned state must be independent');
});
test('invalid U/V, stale source and selection fail without touching Viewer state', () => {
  const before = structuredClone(state);
  assert.throws(() => querySelectedNativeSurfaceCurvature(viewer, expected, {u: 8, v: 15}));
  assert.throws(() => querySelectedNativeSurfaceCurvature(viewer, expected, {u: 2.5}));
  assert.throws(() => querySelectedNativeSurfaceCurvature(viewer, {...expected, source: source + ' '}, {u: 2.5, v: 15}));
  state.selectedGeometry = null;
  assert.throws(() => querySelectedNativeSurfaceCurvature(viewer, expected, {u: 2.5, v: 15}));
  state.selectedGeometry = ref;
  assert.deepEqual(state, before);
});
