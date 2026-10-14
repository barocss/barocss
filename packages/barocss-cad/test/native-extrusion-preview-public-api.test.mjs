import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createNativeExtrusionPreviewAcceptanceV1 } from '../dist/index.js';

const fixture = fileURLToPath(new URL('../../../apps/cad-editor/fixtures/boolean-extrusion.authored-graph.json', import.meta.url));
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };
const authored = () => JSON.parse(readFileSync(fixture, 'utf8'));

test('public Native extrusion preview bridge keeps ticket, accepted, and disposal behavior', { timeout: 180000 }, () => {
  const session = createNativeExtrusionPreviewAcceptanceV1(authored(), options, 'extrusion_feature');
  assert.equal(session.schema, 'barocss-cad-native-extrusion-preview-acceptance-session');
  assert.equal(session.version, 1);
  assert.equal(session.getAccepted().document.revision, 0);

  const old = session.prepareDistanceMM(3);
  const current = session.prepareDistanceMM(4);
  assert.equal(old.baseRevision, 0);
  assert.equal(current.previewDistanceMM, 4);
  assert.throws(() => session.accept(old.token), /STALE/);
  assert.throws(() => session.cancel(old.token), /STALE/);
  assert.equal(session.getAccepted().document.revision, 0);

  const accepted = session.accept(current.token);
  assert.equal(accepted.revision, 1);
  assert.equal(accepted.executionMode, 'full-native-rebuild-on-accept');
  assert.equal(accepted.accepted.document.revision, 1);
  assert.equal(session.getAccepted().document.revision, 1);
  assert.throws(() => session.accept(current.token), /STALE/);

  const pending = session.prepareDistanceMM(3);
  session.dispose();
  session.dispose();
  for (const operation of [
    () => session.getAccepted(),
    () => session.prepareDistanceMM(5),
    () => session.accept(pending.token),
    () => session.cancel(pending.token),
  ]) assert.throws(operation, /DISPOSED/);
  assert.equal(accepted.accepted.document.revision, 1, 'caller-owned accepted result survives disposal');
});
