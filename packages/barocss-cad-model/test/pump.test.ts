import test from 'node:test';
import assert from 'node:assert/strict';
import { latestPump, reshareNodes } from '../src/chat/pump';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';

test('latestPump: one run at a time, a burst runs its first and its latest only, a superseded result is dropped, close stops it', async () => {
  const ran: number[] = [], shown: number[] = [];
  const gates: (() => void)[] = [];
  const pump = latestPump((v: number) => { ran.push(v); return new Promise<number>(r => gates.push(() => r(v * 10))); }, r => shown.push(r));
  pump.push(1); pump.push(2); pump.push(3); pump.push(4);
  assert.deepEqual(ran, [1]);
  gates.shift()!(); await new Promise(r => setTimeout(r, 0));
  // (1's result superseded by 4 waiting: dropped; 4 runs.)
  assert.deepEqual(ran, [1, 4]); assert.deepEqual(shown, []);
  gates.shift()!(); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(shown, [40]);
  pump.push(5); pump.close(); gates.shift()?.(); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(shown, [40]);
});

test('reshareNodes: nodes equal to the earlier document are its objects (moved too), changed ones are not, an unchanged document is itself', () => {
  const a = withNode(rectanglePart(20, 10, 5), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [5, 5], radius: 1 });
  const read: StudioDoc = JSON.parse(JSON.stringify(a));
  const r = reshareNodes(a, read);
  assert.ok(r.nodes.every((n, i) => n === a.nodes[i]));
  const edited: StudioDoc = JSON.parse(JSON.stringify({ ...a, nodes: [...a.nodes.slice(0, 2), { ...a.nodes[2], radius: 2 }, a.nodes[0]] }));
  const e = reshareNodes(a, edited);
  assert.equal(e.nodes[0], a.nodes[0]); assert.equal(e.nodes[1], a.nodes[1]); assert.notEqual(e.nodes[2], a.nodes[2]); assert.equal(e.nodes[3], a.nodes[0]);
  assert.equal(reshareNodes(a, a), a);
});
