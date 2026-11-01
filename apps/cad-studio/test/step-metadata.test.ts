import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { WireSender, WireReceiver } from '@barocss/cad-model/engine/wireDoc';
import { exportStudioStep } from '@barocss/cad-model/engine/evaluate';
import { stepMetadata, receiveStepMetadata } from '../src/engine/stepMetadata';
test('STEP request metadata survives evaluation pack/receive recursively and changes only loss/source metadata', () => {
  const part: StudioDoc = { ...rectanglePart(10, 20, 5), bodies: { b1: { name: 'Red prism', color: '#f00', material: 'steel' } } };
  const doc: StudioDoc = { ...emptyDoc(), instances: [{ id: 'sub', name: 'Sub', position: [0, 0, 0], rotation: [0, 0, 0], doc: { ...emptyDoc(), instances: [{ id: 'leaf', name: 'Leaf', doc: part, position: [5, 0, 0], rotation: [0, 0, 90], looks: { b1: { color: '#00f' } } }] } }], drawing: { sheet: 'A4', projection: 'third', hidden: true, dimensions: [] }, references: { version: 1, references: [], keepouts: [], datums: [{ id: 'd', name: 'Origin', kind: 'point', origin: [0, 0, 0] }] } };
  const sender = new WireSender(), receiver = new WireReceiver(), before = JSON.stringify(doc), wire = structuredClone(sender.pack(doc));
  try {
    const received = receiver.unpack(wire), options = { name: 'metadata', timestamp: '2026-11-01T00:00:00' };
    assert.equal(received.instances![0].doc.instances![0].doc.bodies, undefined);
    const stripped = exportStudioStep(received, options), nodes = received.nodes;
    assert.equal(receiveStepMetadata(received, structuredClone(stepMetadata(doc))), received, 'keep received document identity and registered evaluation context'); assert.equal(received.nodes, nodes);
    const restored = exportStudioStep(received, options), losses = restored.omitted!.join(' ');
    assert.match(losses, /colours and materials/); assert.match(losses, /Drawing sheets, dimensions/); assert.match(losses, /Named reference datums/);
    assert.deepEqual(received.instances![0].doc.instances![0].doc.bodies, part.bodies);
    assert.deepEqual(received.instances![0].doc.instances![0].looks, { b1: { color: '#00f' } });
    assert.equal(restored.text.split('DATA;')[1], stripped.text.split('DATA;')[1]); assert.notEqual(restored.source, stripped.source, 'header identifies report metadata actually exported');
    assert.equal(JSON.stringify(doc), before, 'worker metadata restoration does not mutate the accepted Studio document');
  } finally { sender.dispose(); }
});
test('a following metadata-free request cannot inherit previous labels or drawing losses', () => {
  const plain = rectanglePart(10, 20, 5), sender = new WireSender(), receiver = new WireReceiver();
  try { const received = receiver.unpack(structuredClone(sender.pack(plain))); receiveStepMetadata(received, stepMetadata(plain)); const result = exportStudioStep(received, { name: 'plain' }); assert.doesNotMatch(result.omitted!.join(' '), /colours|User body|Drawing sheets|Named reference/); } finally { sender.dispose(); }
});
