import assert from 'node:assert/strict';
import { Canvas2DError, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { initialScene } from './scene.mjs';

const serialized = stringifySceneJSON(initialScene);
const opened = parseSceneJSON(serialized);
assert.equal(opened.version, 0);
assert.equal(opened.unit, 'logical-px');
assert.equal(opened.contextId, 'DesignBoard');
assert.equal(opened.nodes.length, 2);
assert.equal(stringifySceneJSON(opened), serialized);
for (const candidate of [
  { ...opened, version: 1 },
  { ...opened, nodes: [...opened.nodes, opened.nodes[0]] },
  { ...opened, nodes: [{ ...opened.nodes[0], transform: { ...opened.nodes[0].transform, rotation: 0.1 } }] },
]) {
  assert.throws(() => stringifySceneJSON(candidate), error => error instanceof Canvas2DError);
}
console.log(JSON.stringify({ result: 'ok', version: opened.version, nodes: opened.nodes.length,
  bytes: Buffer.byteLength(serialized), IDs: opened.nodes.map(node => node.id) }));
