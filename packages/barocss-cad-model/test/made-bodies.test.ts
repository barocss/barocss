import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { madeBodies } from '../src/engine/elements';

// O160 (A9's F1): the bodies a part's process makes — every body but a bought element's, by the BOM's own rule. A shaft's
// key is bought by default, so it is left out; the person's override (made) puts it back; the shaft itself is always in.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
test('O160 madeBodies: the shaft in, its key (bought by default) out; the person setting the key made puts it back', async () => {
  let s = { doc: emptyDoc(), bodies: [] } as ChatState;
  for (const [command, values, bodies] of [['shaft', {}, undefined], ['key', { h: 6 }, ['b0']]] as const) {
    const r = await dispatchTool(s, 'features', { action: 'command', command, values, ...(bodies ? { bodies } : {}) }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  }
  assert.deepEqual(s.bodies.map(b => b.key), ['b0', 'b1']);
  assert.deepEqual(madeBodies(s.doc.nodes, s.bodies).map(b => b.key), ['b0']);
  const made = { ...s.doc, nodes: s.doc.nodes.map(n => n.kind === 'key' ? { ...n, bought: false } : n) };
  const e = await evaluate(made); assert.ok(e.ok);
  assert.deepEqual(madeBodies(made.nodes, e.bodies).map(b => b.key), ['b0', 'b1']);
});
