import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeMidpointPlane } from '@barocss/cad-model/app/nativeMidpointPlane';
import { cylinderPart, rectanglePart } from '@barocss/cad-model/engine/doc';
import { evaluatePart, partBreps } from '@barocss/cad-model/engine/evaluate';
import { bodyMesh } from '@barocss/cad-model/engine/mesh';
import { bindMidpointPick, midpointFaces } from '../src/app/midpointSketch';

test('midpoint face picks require current document and original mesh provenance', () => {
  const doc = rectanglePart(20, 10, 4);
  const result = evaluatePart(doc, 1);
  assert.ok(result.ok);
  const [body] = result.bodies;
  const faces = ['n1.top', 'n1.bottom'].map(name => ({ body: 0, face: body.mesh.faces.findIndex(face => face.name === name) }));
  assert.ok(faces.every(pick => pick.face >= 0));
  const selection = { faces, edges: [], bodies: [] };
  const ctx = { doc, bodies: result.bodies, selection };
  assert.equal(midpointFaces(ctx), null, 'numeric indices alone do not prove a pick');
  for (const pick of faces) bindMidpointPick(pick, doc, body);
  assert.deepEqual(midpointFaces(ctx)?.faces.map(face => face.name), ['n1.top', 'n1.bottom']);
  assert.equal(midpointFaces(ctx, { ...doc }), null);
  assert.equal(midpointFaces({ ...ctx, bodies: [{ ...body, mesh: { ...body.mesh } }] }), null);
  assert.equal(midpointFaces({ ...ctx, selection: { ...selection, edges: [{ body: 0, edge: 0 }] } }), null);
  assert.equal(midpointFaces({ ...ctx, selection: { ...selection, faces: [faces[0], { ...faces[1], body: 1 }] } }), null);
  assert.equal(midpointFaces({ ...ctx, selection: { ...selection, faces: [faces[0], faces[0]] } }), null);
});

test('a same-name merged planar display face lacks unique native provenance', () => {
  const [{ brep }] = partBreps(rectanglePart(20, 10, 4));
  const altered = { ...brep, faces: brep.faces.map(face => face.name === 'n1.side0' ? { ...face, name: 'n1.top#1' } : face) };
  const display = bodyMesh(altered, 1);
  assert.equal(display.faces.length, brep.faces.length - 1);
  const topGroup = display.faces.find(face => face.name === 'n1.top');
  assert.ok(topGroup);
  assert.equal(topGroup.kind, 'plane');
  assert.ok(topGroup.exact);
  assert.equal(topGroup.nativePlaneName, undefined);
});

test('fresh cap picks resolve the same native midpoint at different display tessellation qualities', () => {
  const doc = cylinderPart(7, 8);
  const faceNames = ['n1.top', 'n1.bottom'];
  const frame = { origin: [0, 0, 4], normal: [0, 0, 1], xAxis: [1, 0, 0] };
  const counts = [];
  for (const quality of [4, 16]) {
    const result = evaluatePart(doc, quality, quality);
    assert.ok(result.ok);
    const [body] = result.bodies;
    counts.push(body.mesh.indices.length / 3);
    const faces = faceNames.map(name => ({ body: 0, face: body.mesh.faces.findIndex(face => face.nativePlaneName === name) }));
    assert.ok(faces.every(pick => pick.face >= 0));
    for (const pick of faces) bindMidpointPick(pick, doc, body);
    const bound = midpointFaces({ doc, bodies: result.bodies, selection: { faces, edges: [], bodies: [] } });
    assert.ok(bound);
    assert.deepEqual(bound.faces.map(face => face.name), faceNames);
    assert.deepEqual(nativeMidpointPlane(doc, bound.key, bound.faces), frame);
  }
  assert.ok(counts[1] > counts[0], counts.join(' vs '));
});
