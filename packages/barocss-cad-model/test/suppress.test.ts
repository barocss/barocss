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

test('separate: a bar cut in two shows two pieces; separated, each is a body of its own', () => {
  let doc = rectanglePart(30, 10, 5);                                                            // 0, 1
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [10, -5], max: [20, 15] });   // 2
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 7, from: -1 });                       // 3
  doc = withNode(doc, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } }); // 4
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  assert.equal(r.bodies.length, 1); assert.equal(r.bodies[0].pieces, 2);
  const sep = withNode(doc, { kind: 'separate', parent: { node: 4, side: 'solid' } }), s = evaluateDoc(sep, 1); assert.ok(s.ok);
  assert.deepEqual(s.bodies.map(b => [b.key, Math.round(b.volumeMM3!), b.pieces ?? 1]), [['b5_part0', 500, 1], ['b5_part1', 500, 1]]);
  // A hole in one piece only.
  const holed = withNode(sep, { kind: 'hole', parent: { node: 5, side: 'part1' }, center: [25, 5], radius: 1 }), h = evaluateDoc(holed, 1); assert.ok(h.ok);
  assert.deepEqual(h.bodies.map(b => b.key), ['b5_part0', 'b6']);
});
