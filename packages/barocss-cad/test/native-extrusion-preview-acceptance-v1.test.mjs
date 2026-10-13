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

test('one admitted private Native frame is isolated from later caller document and option edits', { timeout: 180000 }, () => {
  const document = authored(), settings = { ...options };
  const prior = evaluateBooleanExtrusionFeatureGraph(document, settings);
  const session = createNativeExtrusionPreviewAcceptanceV1(document, settings, 'extrusion_feature');
  const expected = prior.features.find(row => row.featureId === 'extrusion_feature').evaluation;

  // The caller is not allowed to replace the native Boolean region, update
  // admitted extrusion options or poison subsequent preview/accept operations.
  const boolean = document.features.find(row => row.id === 'boolean_feature');
  boolean.options.operation = 'difference';
  const extrusion = document.features.find(row => row.id === 'extrusion_feature');
  extrusion.options.resultIdPrefix = 'external_changed';
  settings.maximumFeatureEvaluations = 1;

  const prepared = session.prepareDistanceMM(2);
  assert.deepEqual(prepared.geometry, expected);
  const accepted = session.accept(prepared.token);
  assert.deepEqual(accepted.accepted,
    updateBooleanExtrusionFeatureGraph(prior, edit(prior, 2)));
  assert.equal(session.getAccepted().document.features.find(
    row => row.id === 'boolean_feature').options.operation, 'union');
  assert.equal(session.getAccepted().document.features.find(
    row => row.id === 'extrusion_feature').options.resultIdPrefix, 'gext');
});

test('acceptance creation refuses unsupported feature and host getters without executing them', { timeout: 180000 }, () => {
  const document = authored();
  let reads = 0;
  const hostile = { ...document };
  Object.defineProperty(hostile, 'features', {
    enumerable: true,
    get() { reads++; return document.features; },
  });
  assert.throws(() => createNativeExtrusionPreviewAcceptanceV1(
    hostile, options, 'extrusion_feature'));
  assert.equal(reads, 0);
  for (const invalid of ['', 'missing_feature', 'boolean_feature']) {
    assert.throws(() => createNativeExtrusionPreviewAcceptanceV1(
      document, options, invalid));
  }
});

test('dispose invalidates outstanding Native preview, is idempotent, preserves owned caller copies and other sessions', { timeout: 180000 }, () => {
  const doc = authored();
  const first = createNativeExtrusionPreviewAcceptanceV1(doc, options, 'extrusion_feature');
  const other = createNativeExtrusionPreviewAcceptanceV1(doc, options, 'extrusion_feature');
  const acceptedCopy = first.getAccepted();
  const preview = first.prepareDistanceMM(3);
  const ownedPreview = structuredClone(preview.geometry);
  first.dispose();
  first.dispose();
  for (const invoke of [
    () => first.getAccepted(),
    () => first.prepareDistanceMM(4),
    () => first.accept(preview.token),
    () => first.cancel(preview.token),
  ]) assert.throws(invoke, /DISPOSED/);
  assert.deepEqual(preview.geometry, ownedPreview, 'returned preview remains independently owned');
  assert.equal(acceptedCopy.document.revision, 0, 'prior caller-owned accepted data remains usable');
  const next = other.prepareDistanceMM(3);
  assert.equal(other.accept(next.token).revision, 1, 'disposing one session must not affect another');
  other.dispose();
});
