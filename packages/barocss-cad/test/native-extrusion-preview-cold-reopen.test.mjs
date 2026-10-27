import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph, serializeBooleanExtrusionFeatureGraph, parseBooleanExtrusionFeatureGraph } from '../dist/index.js';
import { createNativeExtrusionPreviewAcceptanceV1 } from '../dist/exact-proof/native-extrusion-preview-acceptance-v1.js';

const fixture = fileURLToPath(new URL('./fixtures/boolean-extrusion.authored-graph.json', import.meta.url));
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };

test('Native preview acceptance survives authored-only cold reopen without imported tokens/cache', { timeout: 180000 }, () => {
  const authored = JSON.parse(readFileSync(fixture, 'utf8'));
  const session = createNativeExtrusionPreviewAcceptanceV1(authored, options, 'extrusion_feature');
  const pending = session.prepareDistanceMM(3);
  const accepted = session.accept(pending.token);
  // The native authored codec preserves signed zero, unlike JSON.stringify.
  const savedDocument = serializeBooleanExtrusionFeatureGraph(accepted.accepted.document, options);
  const cold = parseBooleanExtrusionFeatureGraph(savedDocument, options);
  const reopenedDocument = cold.document;
  assert.deepEqual(cold, accepted.accepted, 'authored cold evaluation retains actual Native geometry');
  assert.equal(Object.hasOwn(reopenedDocument, 'preview'), false);
  assert.equal(Object.hasOwn(reopenedDocument, 'token'), false);
  assert.equal(Object.hasOwn(reopenedDocument, 'cache'), false);
  const reopenedSession = createNativeExtrusionPreviewAcceptanceV1(reopenedDocument, options, 'extrusion_feature');
  assert.deepEqual(reopenedSession.getAccepted(), cold);
  assert.throws(() => reopenedSession.accept(pending.token), /STALE/, 'in-memory tickets are not imported');
  const newPending = reopenedSession.prepareDistanceMM(4);
  const next = reopenedSession.accept(newPending.token);
  const expected = updateBooleanExtrusionFeatureGraph(cold, {
    expectedRevision: 1, revision: 2,
    parameterEdits: [], faceEdits: [], booleanEdits: [],
    distanceEdits: [{ featureId: 'extrusion_feature', definition: { kind: 'literal', valueMM: 4 } }],
  });
  assert.deepEqual(next.accepted, expected);
  session.dispose();
  reopenedSession.dispose();
});
