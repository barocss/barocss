import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { rectanglePart, withNode } from '../src/engine/doc';
import { edgeChain } from '../src/app/edgeChain';

test('a double-click chain runs round a rounded rim and stops at sharp corners', () => {
  const vertical = ['n1.side0|n1.side1', 'n1.side1|n1.side2', 'n1.side2|n1.side3', 'n1.side0|n1.side3'];
  const doc = withNode(rectanglePart(40, 20, 10), { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: vertical, radius: 4 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const m = r.bodies[0].mesh, topLine = m.edges.findIndex(e => e.straight && e.a[2] > 9.9 && e.b[2] > 9.9);
  const chain = edgeChain(m, topLine);
  assert.equal(chain.length, 8, 'four lines and four arcs round the top');
  assert.ok(chain.every(i => m.edges[i].a[2] > 9.9 && m.edges[i].b[2] > 9.9));
  // A plain box: its top edges meet at right angles, so each is a chain of one.
  const box = evaluateDoc(rectanglePart(40, 20, 10), 2); assert.ok(box.ok);
  const bm = box.bodies[0].mesh;
  assert.equal(edgeChain(bm, bm.edges.findIndex(e => e.a[2] > 9.9 && e.b[2] > 9.9)).length, 1);
});
