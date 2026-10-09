import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0, scaleX = 1, scaleY = 1) => ({ x, y, scaleX, scaleY, rotation: 0 });
const tree = createDisplayTree('SignedScaleProbe');
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose(20, 20), pivot: { x: 2, y: 0 } });
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose(0, 0), width: 4, height: 2,
  fill: [1, 0, 0, 1] });
tree.stage.addChild(group); group.addChild(rect);
assert.equal(tree.snapshot().version, 15);
assert.deepEqual(rect.getWorldBounds(), { x: 18, y: 20, width: 4, height: 2 });
group.setScale(-1, 1);
assert.deepEqual(group.data.transform, pose(20, 20, -1, 1));
assert.deepEqual(rect.toWorld({ x: 0, y: 0 }), { x: 22, y: 20 });
assert.deepEqual(rect.toLocal({ x: 22, y: 20 }), { x: 0, y: 0 });
assert.deepEqual(rect.getWorldBounds(), { x: 18, y: 20, width: 4, height: 2 });
assert.deepEqual(rect.getLocalBounds(), { x: 0, y: 0, width: 4, height: 2 });
rect.setScale(1, -1);
assert.deepEqual(rect.getWorldBounds(), { x: 18, y: 18, width: 4, height: 2 });
rect.setScale(-1, -1);
assert.deepEqual(rect.getWorldBounds(), { x: 22, y: 18, width: 4, height: 2 });
const accepted = stringifySceneJSON(tree.snapshot());
for (const value of [0, -0, 0.009, -0.009, 100.001, -100.001, NaN, Infinity]) {
  assert.throws(() => group.setScale(value, 1), error => error.code === 'INVALID_SCENE');
  assert.throws(() => rect.setScale(1, value), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
}
assert.throws(() => group.setTransform(pose(20, 20, 0, 1)), error => error.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
const restored = createDisplayTreeFromScene(parseSceneJSON(accepted));
assert.equal(restored.snapshot().version, 15);
assert.equal(stringifySceneJSON(restored.snapshot()), accepted);
restored.get('Group').setScale(1, 1);
assert.deepEqual(restored.get('Group').data.transform, pose(20, 20));
const legacy = structuredClone(tree.snapshot()); legacy.version = 14;
assert.throws(() => stringifySceneJSON(legacy), error => error.code === 'INVALID_SCENE');
legacy.nodes[0].transform.scaleX = 1;
legacy.nodes[0].children[0].transform.scaleX = 1;
legacy.nodes[0].children[0].transform.scaleY = 1;
assert.equal(parseSceneJSON(JSON.stringify(legacy)).version, 14);
assert.equal(createDisplayTreeFromScene(legacy).snapshot().version, 15);
for (const version of Array.from({ length: 16 }, (_, index) => index)) {
  assert.equal(parseSceneJSON(JSON.stringify({ version, unit: 'logical-px', contextId: 'Empty', nodes: [] })).version, version);
}
console.log(JSON.stringify({ result: 'ok', sceneVersion: 15, oldVersions: 15,
  worldBounds: rect.getWorldBounds(), transform: group.data.transform }));
