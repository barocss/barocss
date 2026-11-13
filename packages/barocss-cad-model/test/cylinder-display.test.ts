import assert from 'node:assert/strict';
import test from 'node:test';
import type { StudioDoc } from '../src/engine/doc';
import { evaluateDoc, shareMeshes } from '../src/engine/evaluate';
import { MeshReceiver, MeshSender } from '../src/engine/meshWire';

const doc: StudioDoc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [{ id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 5 }],
  outputs: { b1: { node: 1, side: 'solid' } },
};

test('cylinder refinements preserve canonical owners and transfer once per retained mesh', () => {
  shareMeshes(true);
  try {
    const canonical = evaluateDoc(doc, 1);
    const qualified = evaluateDoc(doc, 2, 8, true);
    assert.ok(canonical.ok && qualified.ok);
    const base = canonical.bodies[0].mesh;
    const detailMesh = qualified.bodies[0].mesh;
    assert.equal(base.cylinderDetail, undefined);
    assert.equal(detailMesh.faces, base.faces);
    assert.equal(detailMesh.edges, base.edges);
    assert.equal(detailMesh.positions, base.positions);
    assert.equal(qualified.bodies[0].volume, canonical.bodies[0].volume);
    assert.equal(detailMesh.cylinderDetail?.tiers.length, 2);
    const [middle, fine] = detailMesh.cylinderDetail.tiers;
    assert.ok(middle.chordErrorMM < detailMesh.cylinderDetail.baseChordErrorMM && fine.chordErrorMM < middle.chordErrorMM);
    const sender = new MeshSender(), receiver = new MeshReceiver();
    const packet = sender.pack('scene', qualified);
    assert.equal(packet.transfer.length, 18);
    const wire = structuredClone(packet.result, { transfer: packet.transfer });
    const restored = receiver.unpack('scene', wire);
    assert.ok(restored.ok);
    assert.deepEqual(restored.bodies[0].mesh, detailMesh);
    assert.ok(fine.positions.byteLength > 0);
    const again = evaluateDoc(doc, 3, 8, true);
    assert.ok(again.ok);
    const reused = sender.pack('scene', again);
    assert.equal(reused.transfer.length, 0);
    const retained = receiver.unpack('scene', reused.result);
    assert.ok(retained.ok);
    assert.equal(retained.bodies[0].mesh, restored.bodies[0].mesh);
  } finally {
    shareMeshes(false);
  }
});
