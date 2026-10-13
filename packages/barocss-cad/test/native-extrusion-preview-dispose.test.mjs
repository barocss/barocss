import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createNativeExtrusionPreviewAcceptanceV1 } from '../dist/native-extrusion-preview-acceptance-v1.js';

const fixture = fileURLToPath(new URL('../../../apps/cad-editor/fixtures/boolean-extrusion.authored-graph.json', import.meta.url));
const document = () => JSON.parse(readFileSync(fixture, 'utf8'));
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };

test('Native preview disposal revokes pending tickets without modifying caller-owned results', { timeout: 120000 }, () => {
  const input = document();
  const inputBefore = structuredClone(input);
  const session = createNativeExtrusionPreviewAcceptanceV1(input, options, 'extrusion_feature');
  const accepted = session.getAccepted();
  const acceptedBefore = structuredClone(accepted);
  const prepared = session.prepareDistanceMM(3);
  const geometryBefore = structuredClone(prepared.geometry);

  session.dispose();
  session.dispose(); // cancellation/closure is idempotent
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(accepted, acceptedBefore);
  assert.deepEqual(prepared.geometry, geometryBefore);
  assert.throws(() => session.getAccepted(), /DISPOSED/);
  assert.throws(() => session.prepareDistanceMM(4), /DISPOSED/);
  assert.throws(() => session.prepareDistanceMM(NaN), /DISPOSED/);
  assert.throws(() => session.accept(prepared.token), /DISPOSED/);
  assert.throws(() => session.cancel(prepared.token), /DISPOSED/);
  assert.throws(() => session.cancel(Object.freeze({ kind: 'native-extrusion-preview-token' })), /DISPOSED/);
});

test('disposing one Native preview session cannot invalidate another accepted session', { timeout: 120000 }, () => {
  const input = document();
  const first = createNativeExtrusionPreviewAcceptanceV1(input, options, 'extrusion_feature');
  const second = createNativeExtrusionPreviewAcceptanceV1(input, options, 'extrusion_feature');
  const firstTicket = first.prepareDistanceMM(3);
  first.dispose();
  assert.throws(() => first.accept(firstTicket.token), /DISPOSED/);

  const ticket = second.prepareDistanceMM(3);
  const accepted = second.accept(ticket.token);
  assert.equal(accepted.revision, 1);
  assert.equal(accepted.accepted.document.revision, 1);
  assert.equal(second.getAccepted().document.revision, 1);
  second.dispose();
  assert.throws(() => second.getAccepted(), /DISPOSED/);
});
