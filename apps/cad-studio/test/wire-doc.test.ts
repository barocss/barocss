import test from 'node:test';
import assert from 'node:assert/strict';
import { WireReceiver, WireSender } from '@barocss/cad-model/engine/wireDoc';
import { rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';

test('wire documents: each node crosses once, the worker rebuilds the document, both sides forget alike', () => {
  const send = new WireSender(), recv = new WireReceiver();
  let doc: StudioDoc = { ...rectanglePart(40, 30, 5), render: { lights: [] } as never, direct: { sources: { a: 'x'.repeat(1000) }, objects: [] } };
  const first = send.pack(doc);
  assert.equal(first.added.length, 2);
  assert.equal(first.doc.render, undefined, 'render settings stay behind');
  assert.equal(first.doc.direct, undefined, 'direct geometry stays behind');
  assert.deepEqual(recv.unpack(first).nodes, doc.nodes);
  // A new hole: only it crosses; the unchanged nodes are named.
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 2 });
  const second = send.pack(doc);
  assert.deepEqual(second.added.map(([, n]) => n.kind), ['hole']);
  assert.deepEqual(recv.unpack(second).nodes, doc.nodes);
  // Hundreds of requests later (each a fresh edit of the hole), the old holes are forgotten on both sides,
  // and the document still rebuilds.
  for (let k = 0; k < 600; k++) {
    doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 2 && n.kind === 'hole' ? { ...n, radius: 1 + k / 1000 } : n) };
    assert.deepEqual(recv.unpack(send.pack(doc)).nodes, doc.nodes);
  }
  assert.ok((recv as unknown as { nodes: Map<number, unknown> }).nodes.size < 400, 'the table does not grow with every edit');
});
