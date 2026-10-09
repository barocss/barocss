import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON,
  stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const transform = { x: 1, y: 2, scaleX: 1, scaleY: 1, rotation: 0 };
const crop = { x: 0, y: 0, width: 2, height: 2 };
const tile = { width: 2, height: 2, offsetX: 0, offsetY: 0 };
const tree = createDisplayTree('TiledProbe');
const sprite = tree.createSprite({ id: 'Floor', layer: 0, transform, imageId: 'Pattern',
  width: 5, height: 4, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0,
  sourceRect: crop, tile });
tree.stage.addChild(sprite);
assert.equal(tree.snapshot().version, 15);
assert.deepEqual(sprite.data.tile, tile);
const copy = sprite.data;
copy.tile.width = 9;
assert.deepEqual(sprite.data.tile, tile);

const saved = stringifySceneJSON(tree.snapshot());
assert.deepEqual(parseSceneJSON(saved), tree.snapshot());
const restored = createDisplayTreeFromScene(parseSceneJSON(saved));
assert.deepEqual(restored.get('Floor').data.tile, tile);
restored.get('Floor').setTile({ ...tile, offsetX: -1, offsetY: 1 });
restored.get('Floor').setSize(7, 5);
assert.equal(restored.snapshot().nodes[0].width, 7);

const before = stringifySceneJSON(tree.snapshot());
let refusals = 0;
const invalid = (operation, code = 'INVALID_SCENE') => {
  assert.throws(operation, error => error.code === code);
  assert.equal(stringifySceneJSON(tree.snapshot()), before);
  refusals++;
};
invalid(() => sprite.setTile({ ...tile, width: 0 }));
invalid(() => sprite.setTile({ ...tile, width: 4097 }));
invalid(() => sprite.setTile({ ...tile, offsetX: -0 }));
invalid(() => sprite.setTile({ ...tile, offsetY: Infinity }));
invalid(() => sprite.setTile({ ...tile, extra: 1 }));
invalid(() => sprite.setTile({ ...tile, height: new Number(2) }));
invalid(() => sprite.setSourceRect(null));
invalid(() => sprite.setImageSource('Other'));
invalid(() => sprite.setSlice({ left: 0, right: 0, top: 0, bottom: 0 }));
invalid(() => sprite.setSize(1000, 1000), 'SCENE_LIMIT');

sprite.setTile(null);
assert.equal(sprite.data.tile, undefined);
sprite.setSlice({ left: 0, right: 0, top: 0, bottom: 0 });
assert.equal(sprite.data.slice.left, 0);
sprite.setSlice(null);
sprite.setSourceRect(null);

const legacy = structuredClone(tree.snapshot());
legacy.version = 12;
assert.equal(parseSceneJSON(stringifySceneJSON(legacy)).version, 12);
assert.equal(createDisplayTreeFromScene(legacy).snapshot().version, 15);
legacy.nodes[0].tile = tile;
assert.throws(() => stringifySceneJSON(legacy), error => error.code === 'INVALID_SCENE');

console.log(JSON.stringify({ result: 'ok', sceneVersion: 15, refusals,
  restoredWidth: restored.get('Floor').data.width }));
