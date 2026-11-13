import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { bindMeasureFacePick, capturePinnedFacePair, readPinnedFacePair } from '../src/app/pinnedFaceMeasure';

function fixture(height: number) {
  const sketch = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 12] });
  const doc = withNode(sketch, { kind: 'extrude', sketch: 0, height });
  const result = evaluateDoc(doc, 1);
  assert.ok(result.ok);
  const [body] = result.bodies;
  const picks = ['n1.top', 'n1.bottom'].map(name => {
    const face = body.mesh.faces.findIndex(face => face.nativePlaneName === name);
    assert.ok(face >= 0);
    return { body: 0, face };
  });
  return { doc, body, picks };
}

test('requires current picked caps and follows the stable numeric extrusion', () => {
  const a = fixture(8), b = fixture(13.25);
  assert.equal(capturePinnedFacePair(a.doc, [a.body], a.picks), null);
  for (const pick of a.picks) bindMeasureFacePick(pick, a.doc, a.body);
  const pin = capturePinnedFacePair(a.doc, [a.body], a.picks);
  assert.ok(pin);
  assert.equal(capturePinnedFacePair(b.doc, [b.body], a.picks), null);
  assert.equal(capturePinnedFacePair(a.doc, [a.body], [a.picks[0], a.picks[0]]), null);
  assert.deepEqual(readPinnedFacePair(b.doc, [b.body], pin), {
    a: [10, 6, 13.25], b: [10, 6, 0], distance: 13.25, normalDistance: 13.25, angle: 0,
  });
});

test('refuses an ambiguous body, a missing cap and a mismatched sketch owner', () => {
  const { doc, body, picks } = fixture(8);
  for (const pick of picks) bindMeasureFacePick(pick, doc, body);
  const pin = capturePinnedFacePair(doc, [body], picks);
  assert.ok(pin);
  assert.equal(readPinnedFacePair(doc, [body, body], pin), null);
  const faces = body.mesh.faces.map(face => face.nativePlaneName === 'n1.top' ? { ...face, nativePlaneName: undefined } : face);
  assert.equal(readPinnedFacePair(doc, [{ ...body, mesh: { ...body.mesh, faces } }], pin), null);
  const changed: StudioDoc = { ...doc, nodes: [{ ...doc.nodes[0], id: 'n20' }, doc.nodes[1]] };
  assert.equal(readPinnedFacePair(changed, [body], pin), null);
});
