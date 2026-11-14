import assert from 'node:assert/strict';
import test from 'node:test';
import { rectanglePart } from '../src/engine/doc';
import { readEdgeContinuity } from '../src/engine/edgeContinuity';
import { evaluateDoc, placeBody } from '../src/engine/evaluate';

const doc = rectanglePart(20, 10, 6);

test('a viewport pick binds its exact native edge and incident face IDs', () => {
  const evaluated = evaluateDoc(doc, 1);
  assert.ok(evaluated.ok);
  const [body] = evaluated.bodies;
  const edge = body.mesh.edges.find(item => item.names.includes('n1.side0|n1.top'));
  assert.ok(edge?.nativeJoint);

  const list = readEdgeContinuity(doc, body.key, { kind: 'list', picked: edge.nativeJoint });
  assert.ok('edges' in list);
  assert.equal(list.selected, edge.nativeJoint.edgeId);
  assert.equal(list.edges.find(item => item.id === list.selected)?.name, 'n1.side0|n1.top');

  const sharp = readEdgeContinuity(doc, body.key, { kind: 'measure', edgeId: list.selected! });
  assert.ok('measurement' in sharp && sharp.measurement.status === 'measured');
  assert.equal(sharp.measurement.minimumAngleDegrees, 90);
  assert.equal(sharp.measurement.maximumAngleDegrees, 90);
  assert.equal(sharp.measurement.sampleCount, 8);

  const wrong = readEdgeContinuity(doc, body.key, { kind: 'list', picked: { ...edge.nativeJoint, faces: ['another face', 'another face'] } });
  assert.ok('edges' in wrong);
  assert.equal(wrong.selected, null);
  const placed = placeBody(body, [1, 0, 0, 0, 1, 0, 0, 0, 1], [1, 0, 0]);
  assert.ok(placed.mesh.edges.every(item => item.nativeJoint === undefined));
  assert.ok('error' in readEdgeContinuity(doc, 'missing', { kind: 'list' }));
});
