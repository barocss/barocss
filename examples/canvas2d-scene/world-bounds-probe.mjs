import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = (x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0) =>
  ({ x, y, scaleX, scaleY, rotation });
const tree = createDisplayTree('WorldBoundsProbe');
assert.equal(tree.stage.getWorldBounds(), null);
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose() });
assert.equal(group.getWorldBounds(), null);
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose(10, 20),
  width: 4, height: 6, fill: [1, 0, 0, 1], visible: false });
const sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 30),
  imageId: 'Atlas', width: 10, height: 6, opacity: 1, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5 });
const line = tree.createLine({ id: 'Line', layer: 2, transform: pose(5, 5),
  x1: 0, y1: 0, x2: 10, y2: 0, width: 4, stroke: [0, 0, 1, 1] });
const path = tree.createPath({ id: 'Path', layer: 3, transform: pose(),
  commands: [{ kind: 'M', x: 0, y: 0 },
    { kind: 'C', c1x: 10, c1y: 20, c2x: 20, c2y: 20, x: 30, y: 0 }],
  stroke: { color: [0, 1, 0, 1], width: 2 } });
const glyph = tree.createGlyphRun({ id: 'Glyph', layer: 4, transform: pose(1, 1),
  atlasId: 'Atlas', text: 'H', baseline: 2, opacity: 1, sampling: 'nearest',
  glyphs: [{ sourceRect: { x: 0, y: 0, width: 1, height: 1 },
    x: 3, y: 4, width: 5, height: 6, textStart: 0, textEnd: 1 }] });
assert.deepEqual(rect.getWorldBounds(), { x: 10, y: 20, width: 4, height: 6 });
assert.deepEqual(sprite.getWorldBounds(), { x: 15, y: 27, width: 10, height: 6 });
assert.deepEqual(line.getWorldBounds(), { x: 5, y: 3, width: 10, height: 4 });
assert.deepEqual(path.getWorldBounds(), { x: -1, y: -1, width: 32, height: 22 });
assert.deepEqual(glyph.getWorldBounds(), { x: 4, y: 7, width: 5, height: 6 });
for (const child of [rect, sprite, line, path, glyph]) group.addChild(child);
tree.stage.addChild(group);
assert.deepEqual(group.getWorldBounds(), { x: -1, y: -1, width: 32, height: 34 });
assert.deepEqual(tree.stage.getWorldBounds(), group.getWorldBounds());
const copy = sprite.getWorldBounds();
copy.x = 999;
assert.equal(sprite.getWorldBounds().x, 15);
const fractional = tree.createRect({ id: 'Fractional', layer: 0, transform: pose(0.1, 0.1),
  width: 0.2, height: 0.2, fill: [1, 1, 1, 1] });
const fractionalBox = fractional.getWorldBounds();
assert.ok(fractionalBox.x <= 0.1 && fractionalBox.y <= 0.1);
assert.ok(fractionalBox.x + fractionalBox.width >= Math.fround(0.1 + 0.2));
assert.ok(fractionalBox.y + fractionalBox.height >= Math.fround(0.1 + 0.2));
sprite.setAnchor(0, 0);
assert.deepEqual(sprite.getWorldBounds(), { x: 20, y: 30, width: 10, height: 6 });
sprite.setSourceRect({ x: 0, y: 0, width: 1, height: 1 });
assert.deepEqual(sprite.getWorldBounds(), { x: 20, y: 30, width: 10, height: 6 });
group.setTransform(pose(40, 20, 2, 1, Math.PI / 2));
const rotated = sprite.getWorldBounds();
assert.ok(Math.abs(rotated.x - 4) < 1e-9);
assert.ok(Math.abs(rotated.y - 60) < 1e-9);
assert.ok(Math.abs(rotated.width - 6) < 1e-9);
assert.ok(Math.abs(rotated.height - 20) < 1e-9);

const frame = tree.createFrame({ id: 'Frame', layer: 1, transform: pose(),
  width: 10, height: 10, fill: [0, 0, 0, 0], clip: true });
const beyond = tree.createRect({ id: 'Beyond', layer: 0, transform: pose(8, 8),
  width: 10, height: 10, fill: [1, 1, 1, 1] });
frame.addChild(beyond); tree.stage.addChild(frame);
assert.deepEqual(frame.getWorldBounds(), { x: 0, y: 0, width: 10, height: 10 });
assert.deepEqual(beyond.getWorldBounds(), { x: 8, y: 8, width: 2, height: 2 });
frame.setFrame({ width: 10, height: 10, fill: [0, 0, 0, 0], clip: false });
assert.deepEqual(beyond.getWorldBounds(), { x: 8, y: 8, width: 10, height: 10 });
tree.reparentChild(sprite, frame, 1);
assert.deepEqual(sprite.getWorldBounds(), { x: 20, y: 30, width: 10, height: 6 });
frame.setFrame({ width: 10, height: 10, fill: [0, 0, 0, 0], clip: true });
assert.equal(sprite.getWorldBounds(), null);
const inner = tree.createFrame({ id: 'Inner', layer: 2, transform: pose(8, 8),
  width: 10, height: 10, fill: [0, 0, 0, 0], clip: true });
const nested = tree.createRect({ id: 'Nested', layer: 0, transform: pose(1, 1),
  width: 10, height: 10, fill: [1, 1, 1, 1] });
inner.addChild(nested); frame.addChild(inner);
assert.deepEqual(inner.getWorldBounds(), { x: 8, y: 8, width: 2, height: 2 });
assert.deepEqual(nested.getWorldBounds(), { x: 9, y: 9, width: 1, height: 1 });
tree.stage.removeChild(group);
assert.ok(group.getWorldBounds());
tree.stage.addChild(group);
const alphaBox = group.getWorldBounds();
const alphaPathBox = path.getWorldBounds();
group.setAlpha(0);
assert.deepEqual(group.getWorldBounds(), alphaBox);
assert.deepEqual(path.getWorldBounds(), alphaPathBox);
group.setAlpha(1);
assert.equal(tree.snapshot().version, 17);

const file = await serializeCanvasDocument(tree.snapshot(), id => id === 'Atlas'
  ? { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) } : null);
const parsed = await parseCanvasDocument(file);
const restored = createDisplayTreeFromScene(parsed.scene);
assert.deepEqual(restored.get('Beyond').getWorldBounds(), { x: 8, y: 8, width: 2, height: 2 });
assert.equal(restored.get('Sprite').getWorldBounds(), null);
assert.deepEqual(restored.get('Nested').getWorldBounds(), { x: 9, y: 9, width: 1, height: 1 });
restored.get('Frame').setFrame({ width: 40, height: 40, fill: [0, 0, 0, 0], clip: true });
assert.deepEqual(restored.get('Sprite').getWorldBounds(), { x: 20, y: 30, width: 10, height: 6 });

const big = createDisplayTree('WorldBoundsOverflow');
const parent = big.createContainer({ id: 'Parent', layer: 0, transform: pose(0, 0, 100, 100) });
const child = big.createRect({ id: 'Child', layer: 0, transform: pose(0, 0, 100, 100),
  width: 1e6, height: 1, fill: [1, 1, 1, 1] });
big.stage.addChild(parent); parent.addChild(child);
assert.throws(() => child.getWorldBounds(), error => error.code === 'SCENE_LIMIT');
console.log(JSON.stringify({ result: 'ok', kinds: 7, sceneVersion: tree.snapshot().version,
  fileBytes: Buffer.byteLength(file) }));
