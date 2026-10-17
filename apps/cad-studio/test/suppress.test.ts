import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';

const vols = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title + ' ' + r.error.detail); return r.bodies.map(b => Math.round(b.volumeMM3!)); };
const off = (doc: StudioDoc, i: number): StudioDoc => ({ ...doc, nodes: doc.nodes.map((n, k) => k === i ? { ...n, suppressed: true } as ModelNode : n) });

test('suppress: a hole passes its body on; a body made by an extrude goes, and a union keeps the other side', () => {
  let doc = rectanglePart(20, 20, 10);                                                     // 0 sketch, 1 box
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 }); // 2
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [30, 20] });             // 3
  doc = withNode(doc, { kind: 'extrude', sketch: 3, height: 10 });                                         // 4
  doc = withNode(doc, { kind: 'union', left: { node: 2, side: 'solid' }, right: { node: 4, side: 'solid' } }); // 5
  doc = withNode(doc, { kind: 'translate', parent: { node: 5, side: 'solid' }, offset: [0, 0, 5] });       // 6
  const hole = Math.round(Math.PI * 9 * 10);
  assert.deepEqual(vols(doc), [6000 - hole]);
  assert.deepEqual(vols(off(doc, 2)), [6000], 'no hole');
  assert.deepEqual(vols(off(doc, 4)), [4000 - hole], 'the second block gone, the union keeps the first');
  assert.deepEqual(vols(off(doc, 5)).sort((a, b) => a - b), [2000, 4000 - hole], 'the union suppressed: two bodies again');
  assert.equal(evaluateDoc(off(doc, 1), 1).ok, true, 'the first block gone: the second one stays');
  assert.deepEqual(vols(off(doc, 1)), [2000]);
});
