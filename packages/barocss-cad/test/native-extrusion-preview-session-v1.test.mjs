import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph } from '../dist/index.js';
import { createNativeExtrusionPreviewSessionV1 } from '../dist/native-extrusion-preview-session-v1.js';

const fixture = fileURLToPath(new URL('./fixtures/boolean-extrusion.authored-graph.json', import.meta.url));
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };
const ownedDocument = () => JSON.parse(readFileSync(fixture, 'utf8'));
const leaf = result => result.features.find(row => row.featureId === 'extrusion_feature').evaluation;
const distanceEdits = value => ({
  expectedRevision: 0, revision: 1, parameterEdits: [], faceEdits: [], booleanEdits: [],
  distanceEdits: [{ featureId: 'extrusion_feature', definition: { kind: 'literal', valueMM: value } }],
});

test('owned Native region permits repeated single-leaf previews with full-rebuild result parity', { timeout: 180000 }, () => {
  const document = ownedDocument(), docBefore = structuredClone(document);
  const optionsBefore = structuredClone(options);
  const accepted = evaluateBooleanExtrusionFeatureGraph(document, options);
  const acceptedBefore = structuredClone(accepted);
  const session = createNativeExtrusionPreviewSessionV1(document, options, 'extrusion_feature');
  assert.equal(Object.isFrozen(session), true);
  assert.equal(session.graphId, 'cad_boolean_extrusion');
  assert.equal(session.acceptedRevision, 0);
  assert.equal(session.executionMode, 'one-native-extrusion-per-preview-after-initial-full-evaluation');
  assert.deepEqual(session.previewDistanceMM(2), leaf(accepted));

  for (const distance of [3, 4]) {
    const full = updateBooleanExtrusionFeatureGraph(accepted, distanceEdits(distance));
    const preview = session.previewDistanceMM(distance);
    assert.deepEqual(preview, leaf(full), 'actual native extrusion must match independently full rebuilt graph');
    assert.equal(preview.options.distanceMM, distance);
    const another = session.previewDistanceMM(distance);
    assert.deepEqual(another, preview);
    assert.notEqual(another, preview);
    assert.notEqual(another.vertices, preview.vertices);
  }

  assert.deepEqual(document, docBefore);
  assert.deepEqual(options, optionsBefore);
  assert.deepEqual(accepted, acceptedBefore);
  // Only the private accepted frame may be reused: mutating caller-owned
  // source after creation cannot retarget or alter subsequent previews.
  document.id = 'outside_mutation';
  options.maximumFeatureEvaluations = 1;
  assert.deepEqual(session.previewDistanceMM(2), leaf(accepted));
  assert.deepEqual(accepted, acceptedBefore);
  options.maximumFeatureEvaluations = optionsBefore.maximumFeatureEvaluations;
});

test('native preview refuses hostile caller data and invalid distances without poisoning accepted frame', { timeout: 180000 }, () => {
  const document = ownedDocument();
  let getterReads = 0;
  const hostile = { ...document };
  Object.defineProperty(hostile, 'features', { enumerable: true, get() { getterReads++; return document.features; } });
  assert.throws(() => createNativeExtrusionPreviewSessionV1(hostile, options, 'extrusion_feature'));
  assert.equal(getterReads, 0, 'caller accessors must never execute');
  assert.throws(() => createNativeExtrusionPreviewSessionV1(document, options, 'boolean_feature'), /extrusion leaf/);
  assert.throws(() => createNativeExtrusionPreviewSessionV1(document, options, 'missing_feature'), /extrusion leaf/);

  const session = createNativeExtrusionPreviewSessionV1(document, options, 'extrusion_feature');
  const before = session.previewDistanceMM(2);
  for (const bad of [NaN, Infinity, -Infinity, 0, -1, 10001, '3', null]) {
    assert.throws(() => session.previewDistanceMM(bad), /Finite native extrusion preview distance/);
  }
  assert.deepEqual(session.previewDistanceMM(2), before, 'rejected input cannot corrupt private frame');
});
