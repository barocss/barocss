import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = (x = 0, y = 0, rotation = 0) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation });
const tree = createDisplayTree('LocalBoundsProbe');
assert.equal('getLocalBounds' in tree.stage, false);
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose(20, 30) });
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(),
  width: 10, height: 10, fill: [0, 0, 0, 0], clip: true });
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose(8, 8),
  width: 8, height: 8, fill: [1, 0, 0, 1] });
const sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(4, 5),
  imageId: 'Blue', width: 6, height: 4, opacity: 1, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5 });
const line = tree.createLine({ id: 'Line', layer: 2, transform: pose(),
  x1: 0, y1: 0, x2: 10, y2: 0, width: 2, stroke: [1, 1, 1, 1] });
const path = tree.createPath({ id: 'Path', layer: 3, transform: pose(),
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'C', c1x: 10, c1y: 20,
    c2x: 20, c2y: 20, x: 30, y: 0 }], stroke: { color: [0, 0, 0, 1], width: 2 } });
const glyph = tree.createGlyphRun({ id: 'Glyph', layer: 4, transform: pose(),
  atlasId: 'Blue', text: 'A', baseline: 0, opacity: 1, sampling: 'nearest',
  glyphs: [{ sourceRect: { x: 0, y: 0, width: 1, height: 1 },
    x: 2, y: 3, width: 4, height: 5, textStart: 0, textEnd: 1 }] });
assert.equal(group.getLocalBounds(), null);
assert.equal(path.getLocalBounds().width > 0, true);
tree.stage.addChild(group); group.addChild(frame); frame.addChild(rect);
for (const child of [sprite, line, path, glyph]) group.addChild(child);
assert.deepEqual(rect.getLocalBounds(), { x: 0, y: 0, width: 8, height: 8 });
assert.deepEqual(rect.getWorldBounds(), { x: 28, y: 38, width: 2, height: 2 });
assert.deepEqual(sprite.getLocalBounds(), { x: -3, y: -2, width: 6, height: 4 });
assert.deepEqual(line.getLocalBounds(), { x: 0, y: -1, width: 10, height: 2 });
assert.deepEqual(glyph.getLocalBounds(), { x: 2, y: 3, width: 4, height: 5 });
assert.deepEqual(frame.getLocalBounds(), { x: 0, y: 0, width: 10, height: 10 });
const local = group.getLocalBounds();
const world = group.getWorldBounds();
assert(local && world);
assert.equal(world.x, local.x + 20);
assert.equal(world.y, local.y + 30);
local.x = 999;
assert.notEqual(group.getLocalBounds().x, 999);
const scene = stringifySceneJSON(tree.snapshot());
group.setPosition(40, 50);
assert.equal(group.getLocalBounds().x, world.x - 20);
assert.equal(group.getWorldBounds().x, world.x + 20);
frame.setFrame({ width: 10, height: 10, fill: [0, 0, 0, 0], clip: false });
const unrotatedLocal = group.getLocalBounds();
const unrotatedWorld = group.getWorldBounds();
group.setRotation(Math.PI / 2);
assert.deepEqual(group.getLocalBounds(), unrotatedLocal);
assert.notDeepEqual(group.getWorldBounds(), unrotatedWorld);
const rectLocal = rect.getLocalBounds();
const groupBeforeChildEdit = group.getLocalBounds();
rect.setScale(2, 1);
rect.setRotation(Math.PI / 4);
assert.deepEqual(rect.getLocalBounds(), rectLocal);
assert.notDeepEqual(group.getLocalBounds(), groupBeforeChildEdit);
rect.setTransform(pose(8, 8));
for (const handle of [group, frame, rect, sprite, line, path, glyph]) {
  const before = handle.getLocalBounds();
  handle.setVisible(false); handle.setAlpha(0); handle.setHitMode('none');
  assert.deepEqual(handle.getLocalBounds(), before);
  handle.setVisible(true); handle.setAlpha(1); handle.setHitMode('auto');
}
const beforeBad = group.getLocalBounds();
assert.throws(() => group.setPosition(Infinity, 0), error => error.code === 'INVALID_SCENE');
assert.deepEqual(group.getLocalBounds(), beforeBad);
frame.removeChild(rect);
assert.deepEqual(rect.getLocalBounds(), { x: 0, y: 0, width: 8, height: 8 });
assert.deepEqual(rect.getWorldBounds(), { x: 8, y: 8, width: 8, height: 8 });
frame.addChild(rect);
tree.reparentChild(rect, group, 0);
assert.deepEqual(rect.getLocalBounds(), { x: 0, y: 0, width: 8, height: 8 });
assert.deepEqual(rect.getWorldBounds(), tree.get('Rect').getWorldBounds());
assert.notEqual(stringifySceneJSON(tree.snapshot()), scene);
const restored = createDisplayTreeFromScene(tree.snapshot());
assert.deepEqual(restored.get('Group').getLocalBounds(), group.getLocalBounds());
const pixels = new Uint8Array([0, 0, 255, 255]);
const file = await serializeCanvasDocument(tree.snapshot(), id => id === 'Blue'
  ? { width: 1, height: 1, pixels } : null);
const parsed = await parseCanvasDocument(file);
assert.deepEqual([...parsed.assets.get('Blue').pixels], [...pixels]);
assert.deepEqual(createDisplayTreeFromScene(parsed.scene).get('Group').getLocalBounds(), group.getLocalBounds());
const huge = createDisplayTree('LocalBoundsOverflow');
const outer = huge.createContainer({ id: 'Outer', layer: 0,
  transform: { ...pose(), scaleX: 100, scaleY: 100 } });
const inner = huge.createContainer({ id: 'Inner', layer: 0,
  transform: { ...pose(), scaleX: 100, scaleY: 100 } });
const wide = huge.createRect({ id: 'Wide', layer: 0,
  transform: { ...pose(), scaleX: 100, scaleY: 100 },
  width: 1e6, height: 1, fill: [1, 1, 1, 1] });
huge.stage.addChild(outer); outer.addChild(inner); inner.addChild(wide);
assert.throws(() => outer.getLocalBounds(), error => error.code === 'SCENE_LIMIT');
assert.deepEqual(wide.getLocalBounds(), { x: 0, y: 0, width: 1e6, height: 1 });
console.log(JSON.stringify({ result: 'ok', kinds: 7, sceneVersion: 11,
  fileBytes: Buffer.byteLength(file) }));
