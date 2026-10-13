import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph } from '../dist/index.js';
import { createNativeExtrusionPreviewAcceptanceV1 } from '../dist/native-extrusion-preview-acceptance-v1.js';

const fixture = fileURLToPath(new URL('../../../apps/cad-editor/fixtures/boolean-extrusion.authored-graph.json', import.meta.url));
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };
const authored = () => JSON.parse(readFileSync(fixture, 'utf8'));
const edit = (previous, value) => ({
  expectedRevision: previous.document.revision,
  revision: previous.document.revision + 1,
  parameterEdits: [], faceEdits: [], booleanEdits: [],
  distanceEdits: [{ featureId: 'extrusion_feature', definition: { kind: 'literal', valueMM: value } }],
});

test('native preview acceptance is private, revision-guarded and FULL rebuilt on commit', { timeout: 180000 }, () => {
  const document = authored(), before = structuredClone(document);
  const baseline = evaluateBooleanExtrusionFeatureGraph(document, options);
  const session = createNativeExtrusionPreviewAcceptanceV1(document, options, 'extrusion_feature');
  assert.equal(Object.isFrozen(session), true);
  assert.deepEqual(session.getAccepted(), baseline);

  const first = session.prepareDistanceMM(3);
  assert.equal(first.baseRevision, 0);
  const priorPreview = structuredClone(first.geometry);
  // Caller modifications must not influence a privately retained native preview.
  first.geometry.vertices[0].pointMM[0] += 1000;
  const accepted1 = session.accept(first.token);
  const full1 = updateBooleanExtrusionFeatureGraph(baseline, edit(baseline, 3));
  assert.deepEqual(accepted1.accepted, full1);
  assert.equal(accepted1.revision, 1);
  assert.equal(accepted1.executionMode, 'full-native-rebuild-on-accept');
  assert.deepEqual(accepted1.accepted.features.find(f => f.featureId === 'extrusion_feature').evaluation, priorPreview);
  assert.deepEqual(session.getAccepted(), full1);
  assert.throws(() => session.accept(first.token), /STALE/);

  const second = session.prepareDistanceMM(4);
  assert.equal(second.baseRevision, 1);
  const accepted2 = session.accept(second.token);
  const full2 = updateBooleanExtrusionFeatureGraph(full1, edit(full1, 4));
  assert.deepEqual(accepted2.accepted, full2);
  assert.equal(accepted2.revision, 2);
  // Returned accepted state is another copy, not the private accepted session.
  accepted2.accepted.document.id = 'caller_mutation';
  assert.deepEqual(session.getAccepted(), full2);
  assert.deepEqual(document, before);
  assert.deepEqual(baseline.document, before);
});

test('stale, cancelled, forged and invalid previews cannot mutate accepted Native state', { timeout: 180000 }, () => {
  const session = createNativeExtrusionPreviewAcceptanceV1(authored(), options, 'extrusion_feature');
  const initial = session.getAccepted();
  assert.throws(() => session.accept(Object.freeze({ kind: 'native-extrusion-preview-token' })), /STALE/);
  const first = session.prepareDistanceMM(3);
  const second = session.prepareDistanceMM(4);
  assert.throws(() => session.accept(first.token), /STALE/);
  assert.throws(() => session.cancel(first.token), /STALE/);
  session.cancel(second.token);
  assert.throws(() => session.accept(second.token), /STALE/);
  for (const invalid of [0, -1, Infinity, NaN, 10001, null, '3'])
    assert.throws(() => session.prepareDistanceMM(invalid));
  assert.deepEqual(session.getAccepted(), initial);
  const third = session.prepareDistanceMM(3);
  assert.equal(session.accept(third.token).revision, 1);
});
