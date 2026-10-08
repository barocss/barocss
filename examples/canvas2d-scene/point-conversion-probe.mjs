import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = (x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0) =>
  ({ x, y, scaleX, scaleY, rotation });
const tree = createDisplayTree('PointConversionProbe');
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose(10, 20, 2, 3, Math.PI / 2) });
const other = tree.createContainer({ id: 'Other', layer: 1, transform: pose(50, 10) });
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(4, 5, 2, 1),
  width: 10, height: 10, fill: [0, 0, 1, 1], clip: false });
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose(4, 5, 2, 1),
  width: 10, height: 10, fill: [1, 0, 0, 1] });
const line = tree.createLine({ id: 'Line', layer: 1, transform: pose(4, 5, 2, 1),
  x1: 0, y1: 0, x2: 10, y2: 0, width: 1, stroke: [1, 1, 1, 1] });
const path = tree.createPath({ id: 'Path', layer: 2, transform: pose(4, 5, 2, 1),
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }],
  stroke: { color: [1, 1, 1, 1], width: 1 } });
const sprite = tree.createSprite({ id: 'Sprite', layer: 3, transform: pose(4, 5, 2, 1),
  imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5 });
const glyph = tree.createGlyphRun({ id: 'Glyph', layer: 4, transform: pose(4, 5, 2, 1),
  atlasId: 'Atlas', text: 'H', baseline: 2, opacity: 1, sampling: 'nearest',
  glyphs: [{ sourceRect: { x: 0, y: 0, width: 1, height: 1 },
    x: 0, y: 0, width: 10, height: 10, textStart: 0, textEnd: 1 }] });

for (const handle of [frame, rect, line, path, sprite, glyph]) {
  assert.deepEqual(handle.toWorld({ x: 1, y: 2 }), { x: 6, y: 7 });
  assert.deepEqual(handle.toLocal({ x: 6, y: 7 }), { x: 1, y: 2 });
}
tree.stage.addChild(group); tree.stage.addChild(other);
for (const child of [frame, rect, line, path, sprite, glyph]) group.addChild(child);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `${actual} differs from ${expected}`);
for (const handle of [frame, rect, line, path, sprite, glyph]) {
  const world = handle.toWorld({ x: 1, y: 2 });
  near(world.x, -11); near(world.y, 32);
  const local = handle.toLocal(world);
  near(local.x, 1); near(local.y, 2);
  world.x = 1000;
  near(handle.toWorld({ x: 1, y: 2 }).x, -11);
}
const groupPoint = group.toWorld({ x: 6, y: 7 });
near(groupPoint.x, -11); near(groupPoint.y, 32);
const baseline = stringifySceneJSON(tree.snapshot());
for (const handle of [group, frame, rect, line, path, sprite, glyph]) {
  for (const invalid of [null, {}, { x: 0, y: 0, extra: 1 }, { x: -0, y: 0 },
    { x: NaN, y: 0 }, { x: Infinity, y: 0 }, { x: 1e6 + 1, y: 0 },
    { x: new Number(1), y: 0 }, Object.defineProperty({}, 'x', { get: () => 1, enumerable: true })]) {
    assert.throws(() => handle.toWorld(invalid), error => error.code === 'INVALID_SCENE');
    assert.throws(() => handle.toLocal(invalid), error => error.code === 'INVALID_SCENE');
  }
}
assert.equal(stringifySceneJSON(tree.snapshot()), baseline);
tree.reparentChild(sprite, other, 0);
assert.deepEqual(sprite.toWorld({ x: 1, y: 2 }), { x: 56, y: 17 });
other.setTransform(pose(60, 15));
assert.deepEqual(sprite.toWorld({ x: 1, y: 2 }), { x: 66, y: 22 });
assert.equal(stringifySceneJSON(tree.snapshot()).includes('"version":11'), true);
const saved = tree.snapshot();
const file = await serializeCanvasDocument(saved,
  id => id === 'Atlas' ? { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) } : null);
const reopened = await parseCanvasDocument(file);
const restored = createDisplayTreeFromScene(reopened.scene);
assert.deepEqual(restored.get('Sprite').toWorld({ x: 1, y: 2 }), { x: 66, y: 22 });
restored.get('Other').setTransform(pose(70, 15));
assert.deepEqual(restored.get('Sprite').toWorld({ x: 1, y: 2 }), { x: 76, y: 22 });

const big = createDisplayTree('BigPoint');
const bigParent = big.createContainer({ id: 'A', layer: 0, transform: pose(0, 0, 100, 100) });
const bigChild = big.createRect({ id: 'B', layer: 0, transform: pose(0, 0, 100, 100),
  width: 1, height: 1, fill: [1, 0, 0, 1] });
big.stage.addChild(bigParent); bigParent.addChild(bigChild);
assert.throws(() => bigChild.toWorld({ x: 1e6, y: 0 }), error => error.code === 'SCENE_LIMIT');
const small = createDisplayTree('SmallPoint');
const smallParent = small.createContainer({ id: 'A', layer: 0, transform: pose(0, 0, 0.01, 0.01) });
const smallChild = small.createRect({ id: 'B', layer: 0, transform: pose(0, 0, 0.01, 0.01),
  width: 1, height: 1, fill: [1, 0, 0, 1] });
small.stage.addChild(smallParent); smallParent.addChild(smallChild);
assert.throws(() => smallChild.toLocal({ x: 1e6, y: 0 }), error => error.code === 'SCENE_LIMIT');
console.log(JSON.stringify({ result: 'ok', kinds: 7, sceneVersion: 11,
  fileBytes: Buffer.byteLength(file) }));
