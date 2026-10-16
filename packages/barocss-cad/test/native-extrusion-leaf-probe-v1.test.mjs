import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph } from '../dist/index.js';
import { probeNativeExtrusionLeafV1 } from '../dist/native-extrusion-leaf-probe-v1.js';

const fixture = fileURLToPath(new URL('./fixtures/boolean-extrusion.authored-graph.json', import.meta.url));
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };

test('actual native extrusion leaf selective probe agrees with independent full rebuild', { timeout: 180000 }, () => {
  const document = JSON.parse(readFileSync(fixture, 'utf8'));
  const previous = evaluateBooleanExtrusionFeatureGraph(document, options);
  const before = structuredClone(previous);
  const edits = {
    expectedRevision: 0, revision: 1,
    parameterEdits: [{ parameterId: 'base_height', definition: { kind: 'literal', valueMM: 3 } }],
    faceEdits: [], booleanEdits: [], distanceEdits: [],
  };
  const next = updateBooleanExtrusionFeatureGraph(previous, edits);
  const candidateBefore = structuredClone(next);
  const observed = probeNativeExtrusionLeafV1(previous, next, 'extrusion_feature');
  assert.deepEqual(observed, {
    status: 'matched-full-rebuild',
    schema: 'barocss-cad-native-extrusion-leaf-probe',
    graphId: 'cad_boolean_extrusion',
    priorRevision: 0,
    candidateRevision: 1,
    featureId: 'extrusion_feature',
    probeExtrusionCalls: 1,
    completeGraphValidationExecuted: true,
    selectiveProductExecution: false,
  });
  assert.deepEqual(previous, before);
  assert.deepEqual(next, candidateBefore);
  assert.deepEqual(probeNativeExtrusionLeafV1(previous, next, 'unknown_feature'),
    { status: 'refused', reason: 'unsupported-feature' });

  const tampered = structuredClone(next);
  tampered.report.summary.materialAreaUV += 1;
  assert.deepEqual(probeNativeExtrusionLeafV1(previous, tampered, 'extrusion_feature'),
    { status: 'refused', reason: 'invalid-native-graph' });
  assert.deepEqual(next, candidateBefore);

  const wrongRevision = evaluateBooleanExtrusionFeatureGraph({ ...document, revision: 2 }, options);
  assert.deepEqual(probeNativeExtrusionLeafV1(previous, wrongRevision, 'extrusion_feature'),
    { status: 'refused', reason: 'revision-or-identity' });
});
