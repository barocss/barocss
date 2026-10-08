import assert from 'node:assert/strict';
import { createDisplayTree, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const sprite = id => ({ id, layer: 0, transform: pose(), imageId: 'RGBA2',
  width: 40, height: 40, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
const tree = createDisplayTree('Board');
const group = tree.createContainer({ id: 'Team', layer: 0, transform: pose(40, 50) });
const red = tree.createSprite(sprite('Red'));
const blue = tree.createSprite({ ...sprite('Blue'), transform: pose(20, 0), layer: 1 });
tree.stage.addChild(group); group.addChild(red); group.addChild(blue);
const initial = stringifySceneJSON(tree.snapshot());
assert.deepEqual(tree.stage.children, [group]);
assert.deepEqual(group.children, [red, blue]);
assert.deepEqual(parseSceneJSON(initial).nodes[0].children.map(node => node.id), ['Red', 'Blue']);

const copied = tree.snapshot();
copied.nodes[0].transform.x = 999;
copied.nodes[0].children[0].anchorX = 1;
assert.equal(stringifySceneJSON(tree.snapshot()), initial);
const data = red.data;
data.transform.x = 999;
assert.equal(red.data.transform.x, 0);

function refuses(action) {
  const before = stringifySceneJSON(tree.snapshot());
  const children = [...group.children];
  assert.throws(action, error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), before);
  assert.deepEqual(group.children, children);
}
refuses(() => red.setAnchor(-0, 0));
refuses(() => red.setOpacity(2));
refuses(() => red.setLayer(1.5));
refuses(() => red.setTransform({ ...pose(), scaleX: 0 }));
refuses(() => {
  const detached = tree.createContainer({ id: 'Detached', layer: 0, transform: pose() });
  detached.addChild(detached);
});
refuses(() => group.addChild(tree.createSprite(sprite('Red'))));
refuses(() => group.addChild(createDisplayTree('Other').createSprite(sprite('Foreign'))));
refuses(() => tree.stage.removeChild(red));

const depthTree = createDisplayTree('Depth');
let parent = depthTree.stage;
for (let level = 0; level < 15; level++) {
  const next = depthTree.createContainer({ id: `G${level}`, layer: 0, transform: pose() });
  parent.addChild(next);
  parent = next;
}
const depthBefore = stringifySceneJSON(depthTree.snapshot());
const overflow = depthTree.createContainer({ id: 'Overflow', layer: 0, transform: pose() });
assert.throws(() => parent.addChild(overflow), error => error.code === 'SCENE_LIMIT');
assert.equal(stringifySceneJSON(depthTree.snapshot()), depthBefore);

red.setOpacity(0.75);
assert.equal(tree.snapshot().nodes[0].children[0].opacity, 0.75);
red.setOpacity(1);

group.setTransform(pose(55, 60));
red.setAnchor(0.5, 0.5);
blue.setLayer(-1);
group.removeChild(red); group.addChild(red);
assert.deepEqual(group.children, [blue, red]);
assert.deepEqual(tree.snapshot().nodes[0].children.map(node => node.id), ['Blue', 'Red']);
assert.equal(tree.snapshot().nodes[0].children[1].anchorX, 0.5);
assert.equal(tree.snapshot().nodes[0].transform.x, 55);
console.log(JSON.stringify({ result: 'ok', sceneVersion: 6, initialBytes: Buffer.byteLength(initial),
  finalIds: tree.snapshot().nodes[0].children.map(node => node.id), refused: 9 }));
