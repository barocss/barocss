import assert from 'node:assert/strict';
import { Canvas2DError, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { initialScene, initialSceneV0 } from './scene.mjs';

const serialized = stringifySceneJSON(initialScene);
const opened = parseSceneJSON(serialized);
assert.equal(opened.version, 1);
assert.equal(opened.unit, 'logical-px');
assert.equal(opened.contextId, 'DesignBoard');
assert.equal(opened.nodes.length, 2);
assert.equal(opened.nodes[1].children.at(-1).kind, 'path');
assert.equal(opened.nodes[1].children.at(-1).commands[2].c2x, 345);
assert.equal(stringifySceneJSON(opened), serialized);
const oldJSON = stringifySceneJSON(initialSceneV0);
assert.equal(parseSceneJSON(oldJSON).version, 0);
for (const candidate of [
  { ...opened, version: 2 },
  { ...opened, nodes: [...opened.nodes, opened.nodes[0]] },
  { ...opened, nodes: [{ ...opened.nodes[0], transform: { ...opened.nodes[0].transform, rotation: 0.1 } }] },
  { ...opened, version: 0 },
]) {
  assert.throws(() => stringifySceneJSON(candidate), error => error instanceof Canvas2DError);
}
console.log(JSON.stringify({ result: 'ok', versions: [parseSceneJSON(oldJSON).version, opened.version],
  nodes: opened.nodes.length, bytes: Buffer.byteLength(serialized),
  path: opened.nodes[1].children.at(-1).id }));
