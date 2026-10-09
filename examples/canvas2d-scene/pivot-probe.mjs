import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0, rotation = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation });
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`);
const closePoint = (actual, expected) => { close(actual.x, expected.x); close(actual.y, expected.y); };
const tree = createDisplayTree('PivotProbe');
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose(20, 20, Math.PI / 2),
  width: 10, height: 4, fill: [1, 0, 0, 1] });
tree.stage.addChild(rect);
assert.equal(tree.snapshot().version, 16);
closePoint(rect.toWorld({ x: 0, y: 0 }), { x: 20, y: 20 });
rect.setPivot(5, 2);
assert.deepEqual(rect.data.pivot, { x: 5, y: 2 });
closePoint(rect.toWorld({ x: 5, y: 2 }), { x: 20, y: 20 });
closePoint(rect.toWorld({ x: 0, y: 0 }), { x: 22, y: 15 });
closePoint(rect.toLocal({ x: 22, y: 15 }), { x: 0, y: 0 });
const bounds = rect.getWorldBounds();
assert(bounds); close(bounds.x, 18); close(bounds.y, 15);
close(bounds.width, 4); close(bounds.height, 10);
const local = rect.getLocalBounds();
assert.deepEqual(local, { x: 0, y: 0, width: 10, height: 4 });
const accepted = stringifySceneJSON(tree.snapshot());
for (const point of [{ x: NaN, y: 0 }, { x: -0, y: 0 }, { x: 0, y: Infinity },
  { x: 1000001, y: 0 }, { x: 0, y: -1000001 }]) {
  assert.throws(() => rect.setPivot(point.x, point.y), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
}

const parent = tree.createContainer({ id: 'Parent', layer: 1, transform: pose(50, 50, Math.PI / 2) });
const sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(0, 0),
  imageId: 'Atlas', width: 4, height: 4, opacity: 1, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5 });
tree.stage.addChild(parent); parent.addChild(sprite);
parent.setPivot(10, 0);
closePoint(sprite.toWorld({ x: 0, y: 0 }), { x: 50, y: 40 });
sprite.setPivot(2, 2);
closePoint(sprite.toWorld({ x: 2, y: 2 }), { x: 50, y: 40 });
const path = tree.createPath({ id: 'Path', layer: 2, transform: pose(),
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 3, y: 0 },
    { kind: 'L', x: 3, y: 3 }, { kind: 'Z' }], fill: { color: [0, 1, 0, 1], rule: 'evenodd' } });
tree.stage.addChild(path); path.setPivot(1, 1);
path.setPath({ commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 4, y: 0 },
  { kind: 'L', x: 4, y: 4 }, { kind: 'Z' }], fill: { color: [0, 1, 0, 1], rule: 'evenodd' } });
assert.deepEqual(path.data.pivot, { x: 1, y: 1 });
rect.setRect({ width: 10, height: 4, fill: [1, 0, 0, 1] });
assert.deepEqual(rect.data.pivot, { x: 5, y: 2 });
assert.equal('setPivot' in tree.stage, false);

const finalScene = tree.snapshot();
const restored = createDisplayTreeFromScene(parseSceneJSON(stringifySceneJSON(finalScene)));
assert.equal(restored.snapshot().version, 16);
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(finalScene));
assert.deepEqual(restored.get('Parent')?.data.pivot, { x: 10, y: 0 });
restored.get('Rect')?.setPivot(0, 0);
assert.deepEqual(restored.get('Rect')?.data.pivot, { x: 0, y: 0 });

const old = structuredClone(finalScene); old.version = 13;
for (const node of old.nodes) delete node.pivot;
delete old.nodes[1].children[0].pivot;
assert.equal(parseSceneJSON(JSON.stringify(old)).version, 13);
assert.equal(createDisplayTreeFromScene(old).snapshot().version, 16);
old.nodes[0].pivot = { x: 5, y: 2 };
assert.throws(() => parseSceneJSON(JSON.stringify(old)), error => error.code === 'INVALID_SCENE');
for (const version of Array.from({ length: 15 }, (_, index) => index)) {
  assert.equal(parseSceneJSON(JSON.stringify({ version, unit: 'logical-px', contextId: 'Empty', nodes: [] })).version, version);
}
for (const pivot of [null, {}, { x: 1 }, { x: 1, y: 2, z: 3 }, { x: -0, y: 0 },
  { x: 1, y: NaN }, { x: 1000001, y: 0 }]) {
  const bad = structuredClone(finalScene); bad.nodes[0].pivot = pivot;
  assert.throws(() => stringifySceneJSON(bad), error => error.code === 'INVALID_SCENE');
}

console.log(JSON.stringify({ result: 'ok', sceneVersion: 16, oldVersions: 14,
  worldBounds: bounds, pivot: rect.data.pivot }));
