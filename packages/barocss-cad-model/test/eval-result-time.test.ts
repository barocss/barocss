import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, evaluatePart, evaluatePlaced, evaluatePreview, rebuildFromScratch, type EvalResult } from '../src/engine/evaluate';
import { MeshReceiver, MeshSender } from '../src/engine/meshWire';

const producers: readonly [string, (doc: StudioDoc) => EvalResult][] = [
  ['evaluateDoc', doc => evaluateDoc(doc, 71)],
  ['evaluatePart', doc => evaluatePart(doc, 71, 8, 'probe')],
  ['evaluatePreview', doc => evaluatePreview(doc, 71)],
  ['evaluatePlaced', doc => evaluatePlaced(doc, rectanglePart(10, 20, 5), { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }, 71)],
  ['rebuildFromScratch', doc => rebuildFromScratch(doc, 71)],
];

for (const [name, produce] of producers) {
  for (const valid of [true, false]) test(`${name}: public ${valid ? 'success' : 'failure'} keeps 250 ms as 0.25 s across JSON and the mesh wire`, t => {
    const doc = rectanglePart(10, 20, 5);
    if (!valid) {
      const extrude = doc.nodes.find(n => n.kind === 'extrude');
      assert.ok(extrude?.kind === 'extrude');
      extrude.sketch = 999;
    }
    const before = JSON.stringify(doc);
    // The outer start reads 1000 ms. Every later read is 1250 ms, including any nested profiling reads.
    let reads = 0;
    t.mock.method(performance, 'now', () => reads++ === 0 ? 1000 : 1250);
    const result = produce(doc);
    assert.equal(result.ok, valid);
    assert.equal(result.wallTime, 0.25);
    assert.equal('ms' in result, false);
    assert.equal(JSON.stringify(doc), before);
    const json = JSON.parse(JSON.stringify(result));
    assert.equal(json.wallTime, 0.25);
    assert.equal('ms' in json, false);
    const packed = new MeshSender().pack(name, result);
    const wire = structuredClone(packed.result, { transfer: packed.transfer });
    assert.equal(wire.wallTime, 0.25);
    assert.equal('ms' in wire, false);
    const unpacked = new MeshReceiver().unpack(name, wire);
    assert.equal(unpacked.wallTime, 0.25);
    assert.equal('ms' in unpacked, false);
    assert.deepEqual(unpacked, result);
  });
}
