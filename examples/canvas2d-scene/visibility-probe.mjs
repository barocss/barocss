import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('VisibilityProbe');
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose });
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose,
  width: 20, height: 20, fill: [0, 0, 1, 1], clip: true });
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose,
  width: 10, height: 10, fill: [1, 0, 0, 1] });
const line = tree.createLine({ id: 'Line', layer: 1, transform: pose,
  x1: 0, y1: 0, x2: 10, y2: 0, width: 1, stroke: [1, 1, 1, 1] });
const path = tree.createPath({ id: 'Path', layer: 2, transform: pose,
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }],
  stroke: { color: [1, 1, 1, 1], width: 1 } });
const sprite = tree.createSprite({ id: 'Sprite', layer: 3, transform: pose,
  imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
const glyph = tree.createGlyphRun({ id: 'Glyph', layer: 4, transform: pose,
  atlasId: 'Atlas', text: 'H', baseline: 0, opacity: 1, sampling: 'nearest',
  glyphs: [{ sourceRect: { x: 0, y: 0, width: 1, height: 1 },
    x: 0, y: 0, width: 10, height: 10, textStart: 0, textEnd: 1 }] });
tree.stage.addChild(group); group.addChild(frame);
for (const child of [rect, line, path, sprite, glyph]) frame.addChild(child);
assert.equal(tree.snapshot().version, 13);
for (const handle of [group, frame, rect, line, path, sprite, glyph]) {
  assert.equal(handle.data.visible, true);
  const first = stringifySceneJSON(tree.snapshot());
  for (const value of [null, undefined, 0, 1, 'false', new Boolean(false)]) {
    assert.throws(() => handle.setVisible(value), error => error.code === 'INVALID_SCENE');
    assert.equal(stringifySceneJSON(tree.snapshot()), first);
  }
  handle.setVisible(false);
  assert.equal(handle.data.visible, false);
  handle.data.transform.x = 999;
  assert.equal(handle.data.transform.x, 0);
  handle.setVisible(true);
  assert.equal(stringifySceneJSON(tree.snapshot()), first);
}
frame.setVisible(false);
sprite.setVisible(false);
assert.equal(group.data.visible, true);
assert.equal(tree.get('Sprite'), sprite);
assert.equal(frame.children.length, 5);
let delivered = 0;
sprite.onPointer('pointerdown', () => delivered++);
assert.throws(() => tree.dispatchPointer({ type: 'pointerdown', pointerId: 1,
  point: { x: 5, y: 5 }, hit: { id: 'Sprite', kind: 'image' } }),
error => error.code === 'INVALID_SCENE');
assert.equal(delivered, 0);
frame.setVisible(true);
assert.throws(() => tree.dispatchPointer({ type: 'pointerdown', pointerId: 1,
  point: { x: 5, y: 5 }, hit: { id: 'Sprite', kind: 'image' } }),
error => error.code === 'INVALID_SCENE');
frame.setVisible(false);
const saved = tree.snapshot();
const restored = createDisplayTreeFromScene(saved);
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(saved));
assert.equal(restored.get('Frame').data.visible, false);
assert.equal(restored.get('Sprite').data.visible, false);
restored.get('Frame').setVisible(true);
assert.equal(restored.get('Sprite').data.visible, false);
restored.get('Sprite').setVisible(true);
assert.equal(restored.get('Sprite').data.visible, true);
const absent = structuredClone(saved); delete absent.nodes[0].children[0].children[0].visible;
assert.throws(() => parseSceneJSON(JSON.stringify(absent)), error => error.code === 'INVALID_SCENE');
const extra = structuredClone(saved); extra.nodes[0].children[0].extra = true;
assert.throws(() => stringifySceneJSON(extra), error => error.code === 'INVALID_SCENE');
const legacy = createDisplayTree('LegacyVisibility');
legacy.stage.addChild(legacy.createSprite({ id: 'OldSprite', layer: 0, transform: pose,
  imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 }));
for (const version of [6, 7, 8]) {
  const scene = legacy.snapshot(); scene.version = version;
  delete scene.nodes[0].visible;
  delete scene.nodes[0].alpha;
  delete scene.nodes[0].hitMode;
  if (version < 8) delete scene.nodes[0].blendMode;
  if (version < 7) delete scene.nodes[0].tint;
  assert.equal(parseSceneJSON(stringifySceneJSON(scene)).version, version);
  assert.equal(createDisplayTreeFromScene(scene).get('OldSprite').data.visible, true);
}
const invalidOld = legacy.snapshot(); invalidOld.version = 8;
assert.throws(() => stringifySceneJSON(invalidOld), error => error.code === 'INVALID_SCENE');
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 128]) };
const file = await serializeCanvasDocument(saved, id => id === 'Atlas' ? image : null);
const document = await parseCanvasDocument(file);
assert.equal(document.scene.version, 13);
assert.equal(document.scene.nodes[0].children[0].children[3].visible, false);
assert.deepEqual([...document.assets.get('Atlas').pixels], [...image.pixels]);
console.log(JSON.stringify({ result: 'ok', sceneVersion: 13, fileBytes: Buffer.byteLength(file),
  kinds: 7, legacyVersions: [6, 7, 8] }));
