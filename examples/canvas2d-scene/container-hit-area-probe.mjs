import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0, scaleX = 1) => ({ x, y, scaleX, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('ContainerHitProbe');
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose(20, 20, -1), pivot: { x: 2, y: 0 } });
tree.stage.addChild(group);
assert.equal(tree.snapshot().version, 17);
assert.equal(group.getLocalBounds(), null);
assert.equal(group.getWorldBounds(), null);
const area = { x: -4, y: -3, width: 8, height: 6 };
group.setHitArea(area); area.x = 100;
assert.deepEqual(group.data.hitArea, { x: -4, y: -3, width: 8, height: 6 });
const copy = group.data; copy.hitArea.x = 100;
assert.equal(group.data.hitArea.x, -4);
assert.equal(group.getWorldBounds(), null);
assert.deepEqual(group.toWorld({ x: -4, y: -3 }), { x: 26, y: 17 });
const accepted = stringifySceneJSON(tree.snapshot());
for (const bad of [{}, { x: 0, y: 0, width: 0, height: 1 },
  { x: -0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: Infinity },
  { x: 0, y: 0, width: 1, height: 1000001 }, { x: 0, y: 0, width: 1, height: 1, extra: true }]) {
  assert.throws(() => group.setHitArea(bad), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
}
const restored = createDisplayTreeFromScene(parseSceneJSON(accepted));
assert.equal(restored.snapshot().version, 17);
assert.equal(stringifySceneJSON(restored.snapshot()), accepted);
restored.get('Group').setHitArea(null);
assert.equal(restored.get('Group').data.hitArea, undefined);
const old = structuredClone(tree.snapshot()); old.version = 16;
assert.throws(() => stringifySceneJSON(old), error => error.code === 'INVALID_SCENE');
delete old.nodes[0].hitArea;
assert.equal(parseSceneJSON(JSON.stringify(old)).version, 16);
assert.equal(createDisplayTreeFromScene(old).snapshot().version, 17);
const nonGroup = structuredClone(tree.snapshot());
nonGroup.nodes[0].kind = 'frame'; nonGroup.nodes[0].width = 4; nonGroup.nodes[0].height = 4;
nonGroup.nodes[0].fill = [1, 0, 0, 1]; nonGroup.nodes[0].clip = false;
assert.throws(() => stringifySceneJSON(nonGroup), error => error.code === 'INVALID_SCENE');
const imageTree = createDisplayTree('LegacySpriteArea');
const sprite = imageTree.createSprite({ id: 'Sprite', layer: 0, transform: pose(), imageId: 'Atlas',
  width: 2, height: 2, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0,
  hitArea: { x: -1, y: -1, width: 4, height: 4 } });
imageTree.stage.addChild(sprite);
const imageV16 = structuredClone(imageTree.snapshot()); imageV16.version = 16;
const imageRestored = createDisplayTreeFromScene(parseSceneJSON(JSON.stringify(imageV16)));
assert.deepEqual(imageRestored.get('Sprite').data.hitArea, { x: -1, y: -1, width: 4, height: 4 });
assert.equal(imageRestored.snapshot().version, 17);
for (const version of Array.from({ length: 18 }, (_, index) => index)) {
  assert.equal(parseSceneJSON(JSON.stringify({ version, unit: 'logical-px', contextId: 'Empty', nodes: [] })).version, version);
}
console.log(JSON.stringify({ result: 'ok', sceneVersion: 17, oldVersions: 17,
  hitArea: group.data.hitArea, restoredHitArea: restored.get('Group').data.hitArea ?? null }));
